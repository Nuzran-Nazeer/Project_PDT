import { useEffect, useState } from "react";
import { listMemberships } from "../../services/memberships";
import { appointLead, listLeads } from "../../services/unitLeads";
import { assignCoverage, getEffectiveCoverage } from "../../services/hrCoverage";
import { listUsers } from "../../services/users";
import { discontinueUnit } from "../../services/orgUnits";
import { useAuth } from "../../hooks/useAuth";
import {
  appointLeadSchema,
  assignCoverageSchema,
  discontinueSchema,
} from "../../schemas/orgStructureSchema";
import { formatDate, todayInput } from "../../utils/dates";

// Members are read-only here: moving someone happens on their own record. An "Add
// member" button would read as ADD and hide the rule that a person holds one
// membership at a time. Appointing a lead is the exception, a lead being a property of
// the unit.

// Local calendar date, not UTC. See the note on todayInput.
const today = todayInput;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export default function UnitDetail({ unit, units, canAssign, canManage, onChanged }) {
  const { constants } = useAuth();
  const unitId = String(unit._id);
  const parent = units.find((u) => String(u._id) === String(unit.parentUnitId));
  const closed = unit.active === false;
  // The root is not closeable. The server refuses it; this hides the button.
  const isRoot = !unit.parentUnitId;

  const [members, setMembers] = useState([]);
  const [lead, setLead] = useState(null);
  const [coverage, setCoverage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  // Bumped after an appointment to re-run the read, rather than patching state by
  // hand with a second copy of what the server decided.
  const [reloadKey, setReloadKey] = useState(0);

  const [appointing, setAppointing] = useState(false);
  const [form, setForm] = useState({ userId: "", from: today() });
  const [candidates, setCandidates] = useState([]);
  const [candidateError, setCandidateError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  // Which HR coverage role a form is open for, or null. Only one role's form is open
  // at a time, the same way appointing a lead is one form, not two.
  const [assigningRole, setAssigningRole] = useState(null);
  const [coverageForm, setCoverageForm] = useState({ userId: "", from: today() });
  const [coverageCandidates, setCoverageCandidates] = useState([]);
  const [coverageCandidateError, setCoverageCandidateError] = useState("");
  const [coverageFieldErrors, setCoverageFieldErrors] = useState({});
  const [coverageFormError, setCoverageFormError] = useState("");
  const [coverageSaving, setCoverageSaving] = useState(false);

  const [closing, setClosing] = useState(false);
  const [lastDay, setLastDay] = useState("");
  const [closeFieldError, setCloseFieldError] = useState("");
  const [closeError, setCloseError] = useState("");
  const [closingSaving, setClosingSaving] = useState(false);

  // Both reads are "as at today". The server would answer a past date, every filter
  // used here taking an `on` already, but no screen asks for one.
  // No setLoading(true) in the effect body: the lint rule rejects the second render
  // pass. Mounted with a `key` of the unit id, so switching unit gives a fresh
  // component with `loading` already true.
  useEffect(() => {
    let cancelled = false;

    Promise.all([
      listMemberships({ unitId, on: today() }),
      listLeads({ unitId, on: today() }),
      getEffectiveCoverage(unitId, today()),
    ])
      .then(([memberList, leadList, coverageData]) => {
        if (cancelled) return;
        setError("");
        setMembers(memberList.items || []);
        setLead((leadList.items || [])[0] || null);
        setCoverage(coverageData);
      })
      .catch((err) => !cancelled && setError(err.message))
      .finally(() => !cancelled && setLoading(false));

    return () => {
      cancelled = true;
    };
  }, [unitId, reloadKey]);

  // Who may be offered as this unit's lead.
  //
  // The rule is that a lead belongs to the unit ABOVE the one they lead, or they
  // would supervise themselves and the reporting line closes into a loop. So the
  // list is the PARENT unit's members, and it is re-read whenever the date changes,
  // because membership is dated and eligibility is judged on the day the
  // appointment starts.
  //
  // The company unit is the exception the server also makes: it has no parent, so
  // there is no unit its lead could belong to, and anyone may be offered.
  useEffect(() => {
    if (!appointing || !ISO_DATE.test(form.from)) return undefined;

    let cancelled = false;

    const request = unit.parentUnitId
      ? listMemberships({ unitId: String(unit.parentUnitId), on: form.from }).then(
          (data) => (data.items || []).map((m) => m.userId).filter(Boolean),
        )
      : listUsers({ status: "active" }).then((data) => data.items || []);

    request
      .then((people) => {
        if (cancelled) return;
        setCandidateError("");
        setCandidates(people);
      })
      .catch(() => {
        if (cancelled) return;
        setCandidates([]);
        setCandidateError("The people who may lead this unit could not be loaded.");
      });

    return () => {
      cancelled = true;
    };
  }, [appointing, unit.parentUnitId, form.from]);

  // Who may be offered as an HR officer: anyone ACTIVE who holds one of the roles the
  // server itself enforces (`constants.hrOfficerRoles`), so this list can never offer
  // someone the server would then refuse. Not scoped to this unit or its parent --
  // unlike a lead, an HR officer does not have to belong to the unit they cover.
  //
  // ⚠️ `status: "active"` is explicit rather than left to the default: the roster's
  // default hides only LEAVERS, so an invited joiner who has never opened their account
  // would otherwise be offered, and the server refuses exactly those.
  useEffect(() => {
    if (!assigningRole) return undefined;

    let cancelled = false;
    const roles = constants?.hrOfficerRoles || [];

    Promise.all(roles.map((role) => listUsers({ role, status: "active" })))
      .then((results) => {
        if (cancelled) return;
        const byId = new Map();
        results.forEach((data) => {
          (data.items || []).forEach((person) => byId.set(String(person._id), person));
        });
        const people = [...byId.values()].sort((a, b) => a.name.localeCompare(b.name));
        setCoverageCandidateError("");
        setCoverageCandidates(people);
      })
      .catch(() => {
        if (cancelled) return;
        setCoverageCandidates([]);
        setCoverageCandidateError(
          "The people who may cover this unit could not be loaded.",
        );
      });

    return () => {
      cancelled = true;
    };
  }, [assigningRole, constants]);

  const startAppoint = () => {
    setAppointing(true);
    setForm({ userId: "", from: today() });
    setFieldErrors({});
    setFormError("");
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
    setFormError("");
  };

  const handleAppoint = async (e) => {
    e.preventDefault();
    setFormError("");
    setFieldErrors({});

    try {
      await appointLeadSchema.validate(form, { abortEarly: false });
    } catch (validationError) {
      const errors = {};
      validationError.inner.forEach((err) => {
        if (!errors[err.path]) errors[err.path] = err.message;
      });
      setFieldErrors(errors);
      return;
    }

    setSaving(true);
    try {
      await appointLead({ unitId, userId: form.userId, from: form.from });
      setAppointing(false);
      setReloadKey((key) => key + 1);
    } catch (err) {
      // The server's own words: a lead who was not in the parent unit on that date,
      // a handover dated before the current term began, a person who already leads
      // this unit, a discontinued unit. Each names the rule that stopped it.
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const startAssignCoverage = (role) => {
    setAssigningRole(role);
    setCoverageForm({ userId: "", from: today() });
    setCoverageFieldErrors({});
    setCoverageFormError("");
  };

  const handleCoverageChange = (e) => {
    const { name, value } = e.target;
    setCoverageForm((f) => ({ ...f, [name]: value }));
    setCoverageFormError("");
  };

  const handleCoverageSubmit = async (e) => {
    e.preventDefault();
    setCoverageFormError("");
    setCoverageFieldErrors({});

    try {
      await assignCoverageSchema.validate(coverageForm, { abortEarly: false });
    } catch (validationError) {
      const errors = {};
      validationError.inner.forEach((err) => {
        if (!errors[err.path]) errors[err.path] = err.message;
      });
      setCoverageFieldErrors(errors);
      return;
    }

    setCoverageSaving(true);
    try {
      await assignCoverage({
        unitId,
        role: assigningRole,
        userId: coverageForm.userId,
        from: coverageForm.from,
      });
      setAssigningRole(null);
      setReloadKey((key) => key + 1);
    } catch (err) {
      // The server's own words: someone not on the hr/head_of_hr roster, a handover
      // dated before the current holder's term began, the same person already
      // covering this unit as the other role, a discontinued unit.
      setCoverageFormError(err.message);
    } finally {
      setCoverageSaving(false);
    }
  };

  const handleDiscontinue = async () => {
    setCloseError("");
    setCloseFieldError("");

    try {
      await discontinueSchema.validate({ lastDay });
    } catch (validationError) {
      setCloseFieldError(validationError.message);
      return;
    }

    setClosingSaving(true);
    try {
      await discontinueUnit(unitId, lastDay);
      setClosing(false);
      setReloadKey((key) => key + 1);
      // The tree itself has to be re-read, not just this panel: the unit is now
      // struck through in the rail beside us, and the page owns that list.
      onChanged?.();
    } catch (err) {
      // The server's own words, and these are the ones that matter most in this
      // the unit still has members, and they are NAMED, so HR is told where
      // to move them rather than being told no.
      setCloseError(err.message);
    } finally {
      setClosingSaving(false);
    }
  };

  const inputClass =
    "w-full rounded-lg border border-line bg-surface px-3.5 py-2.5 text-sm text-ink focus:border-brand focus:outline-none";
  const labelClass = "mb-1.5 block text-[13px] font-semibold text-ink";

  return (
    <div>
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 className="text-lg font-semibold text-ink">{unit.name}</h2>
        <span className="text-[11px] font-medium uppercase tracking-wider text-muted">
          {unit.type}
        </span>
        {parent && <span className="text-[13px] text-muted">inside {parent.name}</span>}
      </div>

      {/* `discontinuedOn` is the LAST DAY the unit operated, not the day the record
          closed: the server stores what HR typed for exactly this line to read back. */}
      {closed && (
        <p className="mt-2 text-[13px] text-muted">
          Discontinued. Its last day was {formatDate(unit.discontinuedOn)}. It stays in
          the tree because the appraisal history recorded against it has to stay readable.
        </p>
      )}

      {error && (
        <p
          role="alert"
          className="mt-5 rounded-lg border border-danger/40 bg-danger/10 px-3 py-2.5 text-[13px] text-danger"
        >
          {error}
        </p>
      )}

      {loading ? (
        <p className="mt-6 text-sm text-muted">Loading the unit…</p>
      ) : (
        <>
          <section className="mt-6">
            <div className="flex flex-wrap items-center gap-3">
              <h3 className="text-[13px] font-semibold uppercase tracking-wide text-muted">
                Lead
              </h3>
              {/* A discontinued unit cannot be given a lead: closing one
                  deliberately ends its leadership record, and allowing a new one
                  straight afterwards would undo what had just happened. */}
              {canAssign && !appointing && !closed && (
                <button
                  type="button"
                  onClick={startAppoint}
                  className="ml-auto cursor-pointer rounded-lg border border-line px-3 py-1.5 text-[13px] font-medium text-ink transition-colors hover:text-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                >
                  {lead ? "Change lead" : "Appoint a lead"}
                </button>
              )}
            </div>

            {lead ? (
              <p className="mt-2 text-sm text-ink">
                {lead.userId?.name || "Unknown"}
                <span className="text-muted">
                  {" · since "}
                  {formatDate(lead.from)}
                  {lead.userId?.employeeId ? ` · ${lead.userId.employeeId}` : ""}
                </span>
              </p>
            ) : (
              // Not an error state. A unit with no lead is allowed: the reporting
              // line resolves upward to the parent's lead, so nobody is left
              // without a supervisor while the post is vacant.
              <p className="mt-2 text-sm text-muted">
                Nobody leads this unit. Its members report to the lead of the unit above.
              </p>
            )}

            {appointing && (
              <form
                onSubmit={handleAppoint}
                className="mt-4 rounded-xl border border-line bg-surface p-4"
              >
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label htmlFor="userId" className={labelClass}>
                      Who leads it
                    </label>
                    <select
                      id="userId"
                      name="userId"
                      value={form.userId}
                      onChange={handleChange}
                      aria-invalid={Boolean(fieldErrors.userId)}
                      className={inputClass}
                    >
                      <option value="">Choose…</option>
                      {candidates.map((person) => (
                        <option key={person._id} value={person._id}>
                          {person.name}
                        </option>
                      ))}
                    </select>
                    {fieldErrors.userId && (
                      <p className="mt-1.5 text-[13px] text-danger">
                        {fieldErrors.userId}
                      </p>
                    )}
                  </div>

                  <div>
                    <label htmlFor="from" className={labelClass}>
                      From
                    </label>
                    <input
                      id="from"
                      name="from"
                      type="date"
                      value={form.from}
                      onChange={handleChange}
                      aria-invalid={Boolean(fieldErrors.from)}
                      className={inputClass}
                    />
                    {fieldErrors.from && (
                      <p className="mt-1.5 text-[13px] text-danger">{fieldErrors.from}</p>
                    )}
                  </div>
                </div>

                <p className="mt-3 text-[13px] text-muted">
                  {unit.parentUnitId
                    ? `Only people who were in ${parent?.name || "the unit above"} on that date can lead this one, so that nobody ends up supervising themselves.`
                    : "This is the top of the company, so anyone can lead it."}
                  {lead &&
                    " Appointing someone new ends the current term on the same date."}
                </p>

                {candidateError && (
                  <p role="alert" className="mt-3 text-[13px] text-danger">
                    {candidateError}
                  </p>
                )}

                {!candidateError && candidates.length === 0 && (
                  <p className="mt-3 text-[13px] text-muted">
                    Nobody was in {parent?.name || "the unit above"} on that date, so
                    there is nobody who can lead this unit yet.
                  </p>
                )}

                {formError && (
                  <p
                    role="alert"
                    className="mt-3 rounded-lg border border-danger/40 bg-danger/10 px-3 py-2.5 text-[13px] text-danger"
                  >
                    {formError}
                  </p>
                )}

                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="submit"
                    disabled={saving}
                    className="cursor-pointer rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {saving ? "Saving…" : "Appoint"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setAppointing(false)}
                    className="cursor-pointer rounded-lg border border-line px-3.5 py-2 text-sm font-medium text-muted transition-colors hover:text-brand"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </section>

          <section className="mt-8">
            <h3 className="text-[13px] font-semibold uppercase tracking-wide text-muted">
              HR coverage
            </h3>

            {/* Covers this unit and, unless overridden below, everything under it.
                Once a unit has ANY direct coverage of its own, that stops the walk
                entirely: a direct primary with no direct backup shows the backup as
                vacant here, not inherited from further up. */}
            <p className="mt-2 text-[13px] text-muted">
              {coverage?.resolvedUpward
                ? `No HR officer is assigned directly to ${unit.name}, so it is covered from ${coverage.resolvedUnit?.name || "the unit above"}.`
                : "Covers this unit and, unless a sub-unit has its own HR officer, everything beneath it too."}
            </p>

            {["primary", "backup"].map((role) => {
              const holder = coverage?.[role] || null;
              const label = role === "primary" ? "Primary" : "Backup";

              return (
                <div key={role} className="mt-4">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="text-sm font-medium text-ink">{label}</span>
                    {canManage && assigningRole !== role && !closed && (
                      <button
                        type="button"
                        onClick={() => startAssignCoverage(role)}
                        className="ml-auto cursor-pointer rounded-lg border border-line px-3 py-1.5 text-[13px] font-medium text-ink transition-colors hover:text-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                      >
                        {holder && !coverage?.resolvedUpward
                          ? `Change ${label.toLowerCase()}`
                          : `Assign ${label.toLowerCase()}`}
                      </button>
                    )}
                  </div>

                  {holder ? (
                    <p className="mt-1.5 text-sm text-ink">
                      {holder.name}
                      <span className="text-muted">
                        {" · since "}
                        {formatDate(holder.from)}
                        {holder.employeeId ? ` · ${holder.employeeId}` : ""}
                      </span>
                    </p>
                  ) : (
                    <p className="mt-1.5 text-sm text-muted">
                      {coverage?.resolvedUpward
                        ? `No ${label.toLowerCase()} either, even from ${coverage.resolvedUnit?.name || "the unit above"}.`
                        : `Nobody covers this unit as ${label.toLowerCase()}.`}
                    </p>
                  )}

                  {assigningRole === role && (
                    <form
                      onSubmit={handleCoverageSubmit}
                      className="mt-3 rounded-xl border border-line bg-surface p-4"
                    >
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div>
                          <label htmlFor="coverageUserId" className={labelClass}>
                            Who covers it
                          </label>
                          <select
                            id="coverageUserId"
                            name="userId"
                            value={coverageForm.userId}
                            onChange={handleCoverageChange}
                            aria-invalid={Boolean(coverageFieldErrors.userId)}
                            className={inputClass}
                          >
                            <option value="">Choose…</option>
                            {coverageCandidates.map((person) => (
                              <option key={person._id} value={person._id}>
                                {person.name}
                              </option>
                            ))}
                          </select>
                          {coverageFieldErrors.userId && (
                            <p className="mt-1.5 text-[13px] text-danger">
                              {coverageFieldErrors.userId}
                            </p>
                          )}
                        </div>

                        <div>
                          <label htmlFor="coverageFrom" className={labelClass}>
                            From
                          </label>
                          <input
                            id="coverageFrom"
                            name="from"
                            type="date"
                            value={coverageForm.from}
                            onChange={handleCoverageChange}
                            aria-invalid={Boolean(coverageFieldErrors.from)}
                            className={inputClass}
                          />
                          {coverageFieldErrors.from && (
                            <p className="mt-1.5 text-[13px] text-danger">
                              {coverageFieldErrors.from}
                            </p>
                          )}
                        </div>
                      </div>

                      <p className="mt-3 text-[13px] text-muted">
                        Only people holding the HR officer or Head of HR role can be
                        offered here.
                        {holder &&
                          !coverage?.resolvedUpward &&
                          ` Assigning someone new ends the current ${label.toLowerCase()}'s term on the same date.`}
                      </p>

                      {coverageCandidateError && (
                        <p role="alert" className="mt-3 text-[13px] text-danger">
                          {coverageCandidateError}
                        </p>
                      )}

                      {!coverageCandidateError && coverageCandidates.length === 0 && (
                        <p className="mt-3 text-[13px] text-muted">
                          Nobody holds the HR officer or Head of HR role yet, so there is
                          nobody who can cover this unit.
                        </p>
                      )}

                      {coverageFormError && (
                        <p
                          role="alert"
                          className="mt-3 rounded-lg border border-danger/40 bg-danger/10 px-3 py-2.5 text-[13px] text-danger"
                        >
                          {coverageFormError}
                        </p>
                      )}

                      <div className="mt-4 flex flex-wrap gap-2">
                        <button
                          type="submit"
                          disabled={coverageSaving}
                          className="cursor-pointer rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {coverageSaving ? "Saving…" : "Assign"}
                        </button>
                        <button
                          type="button"
                          onClick={() => setAssigningRole(null)}
                          className="cursor-pointer rounded-lg border border-line px-3.5 py-2 text-sm font-medium text-muted transition-colors hover:text-brand"
                        >
                          Cancel
                        </button>
                      </div>
                    </form>
                  )}
                </div>
              );
            })}
          </section>

          <section className="mt-8">
            <h3 className="text-[13px] font-semibold uppercase tracking-wide text-muted">
              Members
            </h3>

            {members.length === 0 ? (
              <p className="mt-2 text-sm text-muted">
                Nobody is in this unit today. People are placed from their own employee
                record.
              </p>
            ) : (
              <ul className="mt-2 divide-y divide-line rounded-xl border border-line">
                {members.map((membership) => (
                  <li
                    key={membership._id}
                    className="flex flex-wrap items-baseline gap-x-3 px-4 py-2.5"
                  >
                    <span className="text-sm text-ink">
                      {membership.userId?.name || "Unknown"}
                    </span>
                    {membership.userId?.employeeId && (
                      <span className="text-[13px] text-muted">
                        {membership.userId.employeeId}
                      </span>
                    )}
                    <span className="ml-auto text-[13px] text-muted">
                      since {formatDate(membership.from)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Closing the unit. Head of HR only: an HR officer can move people between
              units but cannot close one out from under them. Never for the root, or
              for a unit that is already closed. */}
          {canManage && !closed && !isRoot && (
            <section className="mt-8 border-t border-line pt-5">
              {!closing ? (
                <div className="flex flex-wrap items-center gap-4">
                  <div>
                    <p className="text-sm font-medium text-ink">Discontinue this unit</p>
                    <p className="mt-1 text-[13px] text-muted">
                      It stays in the tree, marked closed. Its members have to be moved
                      somewhere else first.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setClosing(true)}
                    className="ml-auto cursor-pointer rounded-lg border border-danger/40 px-3.5 py-2 text-sm font-medium text-danger transition-colors hover:bg-danger/10"
                  >
                    Discontinue
                  </button>
                </div>
              ) : (
                <div>
                  <p className="text-sm text-ink">
                    Discontinue <strong>{unit.name}</strong>? Nothing is deleted: it stays
                    in the tree marked closed, and whoever leads it has their term closed
                    on the same date.
                  </p>

                  <div className="mt-4 max-w-xs">
                    <label htmlFor="lastDay" className={labelClass}>
                      Last day it operated
                    </label>
                    <input
                      id="lastDay"
                      name="lastDay"
                      type="date"
                      value={lastDay}
                      onChange={(e) => {
                        setLastDay(e.target.value);
                        setCloseError("");
                      }}
                      aria-invalid={Boolean(closeFieldError)}
                      className={inputClass}
                    />
                    {/* Deliberately not prefilled with today. Every other date on
                        these screens has a sensible default; this one does not,
                        because a unit closing is a decision with a date somebody
                        chose, and guessing at it invents the fact being recorded. */}
                    {closeFieldError && (
                      <p className="mt-1.5 text-[13px] text-danger">{closeFieldError}</p>
                    )}
                  </div>

                  {closeError && (
                    <p
                      role="alert"
                      className="mt-4 rounded-lg border border-danger/40 bg-danger/10 px-3 py-2.5 text-[13px] text-danger"
                    >
                      {closeError}
                    </p>
                  )}

                  <div className="mt-4 flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={handleDiscontinue}
                      disabled={closingSaving}
                      className="cursor-pointer rounded-lg bg-danger px-3.5 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {closingSaving ? "Closing…" : "Yes, discontinue"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setClosing(false)}
                      className="cursor-pointer rounded-lg border border-line px-3.5 py-2 text-sm font-medium text-muted transition-colors hover:text-ink"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </section>
          )}
        </>
      )}
    </div>
  );
}
