import { useEffect, useState } from "react";
import { listMemberships } from "../../services/memberships";
import { appointLead, listLeads } from "../../services/unitLeads";
import { listUsers } from "../../services/users";
import { appointLeadSchema } from "../../schemas/orgStructureSchema";
import { formatDate } from "../../utils/dates";

// One unit: who is in it, who runs it, and the one write that belongs to a unit
// rather than to a person.
//
// MEMBERS ARE READ-ONLY HERE, deliberately. Moving someone happens on their own
// record, because both screens produce the identical change on the server and the
// difference is only which question is being answered. An "Add member" button here
// would read as ADD, which hides the rule that a person holds one membership at a
// time and walks HR into a refusal they have no way to understand.
//
// Appointing a lead is the exception, and a real one: a lead is a property of the
// unit, not of the person.

const today = () => new Date().toISOString().slice(0, 10);
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export default function UnitDetail({ unit, units, canAssign }) {
  const unitId = String(unit._id);
  const parent = units.find((u) => String(u._id) === String(unit.parentUnitId));

  const [members, setMembers] = useState([]);
  const [lead, setLead] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  // Bumped after an appointment to re-run the read below. The alternative is
  // patching the new lead into state by hand, which is a second copy of what the
  // server just decided.
  const [reloadKey, setReloadKey] = useState(0);

  const [appointing, setAppointing] = useState(false);
  const [form, setForm] = useState({ userId: "", from: today() });
  const [candidates, setCandidates] = useState([]);
  const [candidateError, setCandidateError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  // Both reads are "as at today", because the criterion asks for a unit's CURRENT
  // members and CURRENT lead. Browsing a unit as it stood on a past date is
  // deliberately out of Sprint 1, though the server would answer it: every filter
  // used here takes an `on` date already.
  // No setLoading(true) or setError("") in the effect body: a synchronous state
  // write inside an effect costs a second render pass and the lint rule rejects it.
  // The page mounts this component with a `key` of the unit id, so switching unit
  // gives a fresh component with `loading` already true.
  useEffect(() => {
    let cancelled = false;

    Promise.all([
      listMemberships({ unitId, on: today() }),
      listLeads({ unitId, on: today() }),
    ])
      .then(([memberList, leadList]) => {
        if (cancelled) return;
        setError("");
        setMembers(memberList.items || []);
        setLead((leadList.items || [])[0] || null);
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
              {canAssign && !appointing && (
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
        </>
      )}
    </div>
  );
}
