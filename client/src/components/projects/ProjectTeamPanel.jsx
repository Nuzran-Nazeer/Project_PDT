import { useEffect, useState } from "react";
import { getProjectTeam } from "../../services/projects";
import {
  listAssignments,
  createAssignment,
  closeAssignment,
  markTeamLead,
} from "../../services/projectAssignments";
import { listUsers } from "../../services/users";
import {
  assignmentSchema,
  closeAssignmentSchema,
  teamLeadSchema,
  teamPeriodSchema,
} from "../../schemas/projectSchema";
import { dayAfter, formatDate, lastDayOf, todayInput } from "../../utils/dates";

// ⚠️ Today mode carries `teamLead` and a flag per member; period mode carries
// `teamLeadHistory`. The panel branches on what it asked for, never on what came back.

const today = todayInput;

// On a single date a person holds at most one assignment on a project, so matching by
// user id is unambiguous. Read only in today mode.
const assignmentsByUser = (items) => {
  const map = new Map();
  for (const item of items) {
    const id = item.userId?._id || item.userId;
    if (id) map.set(String(id), item);
  }
  return map;
};

export default function ProjectTeamPanel({ project, canManage, reloadKey }) {
  const projectId = String(project._id);
  const closed = Boolean(project.endDate);

  const [mode, setMode] = useState("today");

  // Set only when the search is submitted, not on every keystroke.
  const [appliedPeriod, setAppliedPeriod] = useState(null);
  const [periodForm, setPeriodForm] = useState({ from: "", lastDay: "" });
  const [periodFieldErrors, setPeriodFieldErrors] = useState({});

  const [team, setTeam] = useState(null);
  // ⚠️ Which mode the loaded `team` answers: the shapes differ, and this doubles as the
  // loading flag, which cannot be set from an effect body.
  const [teamMode, setTeamMode] = useState(null);
  const [rows, setRows] = useState(new Map());
  const [error, setError] = useState("");
  const [teamReloadKey, setTeamReloadKey] = useState(0);

  const [assigning, setAssigning] = useState(false);
  const [assignForm, setAssignForm] = useState({ userId: "", from: "", lastDay: "" });
  const [assignFieldErrors, setAssignFieldErrors] = useState({});
  const [assignError, setAssignError] = useState("");
  const [assignSaving, setAssignSaving] = useState(false);

  const [candidates, setCandidates] = useState([]);
  const [candidateError, setCandidateError] = useState("");

  // { id, kind: "close" | "lead" }. Both ask for one date, so they share a field.
  const [rowAction, setRowAction] = useState(null);
  const [rowDate, setRowDate] = useState("");
  const [rowFieldError, setRowFieldError] = useState("");
  const [rowError, setRowError] = useState("");
  const [rowSaving, setRowSaving] = useState(false);

  const periodMode = mode === "period";

  useEffect(() => {
    if (periodMode && !appliedPeriod) return undefined;

    let cancelled = false;

    const params = periodMode
      ? // ⚠️ The API's `to` is exclusive; HR typed an inclusive last day.
        { from: appliedPeriod.from, to: dayAfter(appliedPeriod.lastDay) }
      : { on: today() };

    const requests = periodMode
      ? [getProjectTeam(projectId, params)]
      : [getProjectTeam(projectId, params), listAssignments({ projectId, on: today() })];

    Promise.all(requests)
      .then(([teamData, assignmentData]) => {
        if (cancelled) return;
        setError("");
        setTeam(teamData);
        setTeamMode(periodMode ? "period" : "today");
        setRows(assignmentsByUser(assignmentData?.items || []));
      })
      .catch((err) => !cancelled && setError(err.message));

    return () => {
      cancelled = true;
    };
  }, [projectId, periodMode, appliedPeriod, reloadKey, teamReloadKey]);

  // Anyone active may be offered; coverage is refused by the server, not worked out here.
  useEffect(() => {
    if (!assigning) return undefined;

    let cancelled = false;

    listUsers({ status: "active" })
      .then((data) => {
        if (cancelled) return;
        setCandidateError("");
        setCandidates(data.items || []);
      })
      .catch(() => {
        if (cancelled) return;
        setCandidates([]);
        setCandidateError("The people who could join this project could not be loaded.");
      });

    return () => {
      cancelled = true;
    };
  }, [assigning]);

  const refresh = () => setTeamReloadKey((key) => key + 1);

  const showPeriod = async (event) => {
    event.preventDefault();
    setPeriodFieldErrors({});

    try {
      await teamPeriodSchema.validate(periodForm, { abortEarly: false });
    } catch (validationError) {
      const errors = {};
      validationError.inner.forEach((err) => {
        if (!errors[err.path]) errors[err.path] = err.message;
      });
      setPeriodFieldErrors(errors);
      return;
    }

    // Cleared so a new period does not show the previous one's answer while it loads.
    setTeamMode(null);
    setAppliedPeriod({ from: periodForm.from, lastDay: periodForm.lastDay });
  };

  const startAssign = () => {
    setAssigning(true);
    setAssignForm({ userId: "", from: today(), lastDay: "" });
    setAssignFieldErrors({});
    setAssignError("");
  };

  const submitAssign = async (event) => {
    event.preventDefault();
    setAssignFieldErrors({});
    setAssignError("");

    try {
      await assignmentSchema.validate(assignForm, { abortEarly: false });
    } catch (validationError) {
      const errors = {};
      validationError.inner.forEach((err) => {
        if (!errors[err.path]) errors[err.path] = err.message;
      });
      setAssignFieldErrors(errors);
      return;
    }

    const payload = {
      projectId,
      userId: assignForm.userId,
      from: assignForm.from,
    };

    // Blank means ongoing; given, an inclusive last day becomes the exclusive `to`.
    if (assignForm.lastDay) payload.to = dayAfter(assignForm.lastDay);

    setAssignSaving(true);
    try {
      await createAssignment(payload);
      setAssigning(false);
      refresh();
    } catch (err) {
      setAssignError(err.message);
    } finally {
      setAssignSaving(false);
    }
  };

  const startRowAction = (id, kind) => {
    setRowAction({ id, kind });
    setRowDate(kind === "lead" ? today() : "");
    setRowFieldError("");
    setRowError("");
  };

  const submitRowAction = async (event) => {
    event.preventDefault();
    setRowFieldError("");
    setRowError("");

    const closing = rowAction.kind === "close";

    try {
      if (closing) {
        await closeAssignmentSchema.validate({ lastDay: rowDate });
      } else {
        await teamLeadSchema.validate({ from: rowDate });
      }
    } catch (validationError) {
      setRowFieldError(validationError.message);
      return;
    }

    setRowSaving(true);
    try {
      if (closing) {
        // Inclusive last working day in, exclusive `to` out.
        await closeAssignment(rowAction.id, dayAfter(rowDate));
      } else {
        // A start goes as typed.
        await markTeamLead(rowAction.id, rowDate);
      }
      setRowAction(null);
      refresh();
    } catch (err) {
      setRowError(err.message);
    } finally {
      setRowSaving(false);
    }
  };

  const inputClass =
    "w-full rounded-lg border border-line bg-surface px-3.5 py-2.5 text-sm text-ink focus:border-brand focus:outline-none";
  const labelClass = "mb-1.5 block text-[13px] font-semibold text-ink";
  const primaryClass =
    "cursor-pointer rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:cursor-not-allowed disabled:opacity-60";
  const secondaryClass =
    "cursor-pointer rounded-lg border border-line px-3.5 py-2 text-sm font-medium text-muted transition-colors hover:text-brand";
  const rowButtonClass =
    "cursor-pointer rounded-lg border border-line px-3 py-1.5 text-[13px] font-medium text-ink transition-colors hover:text-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand";
  const tabClass = (active) =>
    `cursor-pointer rounded-lg px-3 py-1.5 text-[13px] font-medium transition-colors ${
      active ? "bg-brand/10 text-brand" : "text-muted hover:text-brand"
    }`;

  const awaitingPeriod = periodMode && !appliedPeriod;
  const ready = Boolean(team) && teamMode === mode;

  const members = ready ? team.members || [] : [];
  // Writes apply only to the project as it stands now.
  const canWrite = canManage && !closed && !periodMode;

  return (
    <section className="rounded-xl border border-line bg-raised p-5">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-[13px] font-semibold uppercase tracking-wide text-muted">
          Team
        </h2>

        <div className="ml-auto flex gap-1">
          <button
            type="button"
            onClick={() => setMode("today")}
            className={tabClass(!periodMode)}
          >
            Today
          </button>
          <button
            type="button"
            onClick={() => setMode("period")}
            className={tabClass(periodMode)}
          >
            Over a period
          </button>
        </div>
      </div>

      {periodMode && (
        <form
          onSubmit={showPeriod}
          className="mt-4 rounded-xl border border-line bg-surface p-4"
        >
          <p className="text-[13px] text-muted">Both dates are included.</p>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <label className={labelClass} htmlFor="periodFrom">
                First day
              </label>
              <input
                id="periodFrom"
                type="date"
                className={inputClass}
                value={periodForm.from}
                onChange={(e) => setPeriodForm((f) => ({ ...f, from: e.target.value }))}
                aria-invalid={Boolean(periodFieldErrors.from)}
              />
              {periodFieldErrors.from && (
                <p className="mt-1.5 text-[13px] text-danger">{periodFieldErrors.from}</p>
              )}
            </div>

            <div>
              <label className={labelClass} htmlFor="periodLastDay">
                Last day
              </label>
              <input
                id="periodLastDay"
                type="date"
                className={inputClass}
                value={periodForm.lastDay}
                onChange={(e) =>
                  setPeriodForm((f) => ({ ...f, lastDay: e.target.value }))
                }
                aria-invalid={Boolean(periodFieldErrors.lastDay)}
              />
              {periodFieldErrors.lastDay && (
                <p className="mt-1.5 text-[13px] text-danger">
                  {periodFieldErrors.lastDay}
                </p>
              )}
            </div>
          </div>

          <button type="submit" className={`mt-4 ${primaryClass}`}>
            Show the team
          </button>
        </form>
      )}

      {error && (
        <p
          role="alert"
          className="mt-4 rounded-lg border border-danger/40 bg-danger/10 px-3 py-2.5 text-[13px] text-danger"
        >
          {error}
        </p>
      )}

      {!periodMode && ready && (
        <p className="mt-4 text-[13px] text-muted">
          {team.teamLead ? (
            <>
              Team lead: <span className="text-ink">{team.teamLead.name}</span>
            </>
          ) : (
            "Nobody is marked as team lead."
          )}
        </p>
      )}

      {canWrite && !assigning && (
        <button type="button" onClick={startAssign} className={`mt-4 ${rowButtonClass}`}>
          Assign somebody
        </button>
      )}

      {assigning && (
        <form
          onSubmit={submitAssign}
          className="mt-4 rounded-xl border border-line bg-surface p-4"
        >
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className={labelClass} htmlFor="assignUserId">
                Who is joining
              </label>
              <select
                id="assignUserId"
                className={inputClass}
                value={assignForm.userId}
                onChange={(e) => setAssignForm((f) => ({ ...f, userId: e.target.value }))}
                aria-invalid={Boolean(assignFieldErrors.userId)}
              >
                <option value="">Choose…</option>
                {candidates.map((person) => (
                  <option key={person._id} value={person._id}>
                    {person.name}
                  </option>
                ))}
              </select>
              {assignFieldErrors.userId && (
                <p className="mt-1.5 text-[13px] text-danger">
                  {assignFieldErrors.userId}
                </p>
              )}
            </div>

            <div>
              <label className={labelClass} htmlFor="assignFrom">
                From
              </label>
              <input
                id="assignFrom"
                type="date"
                className={inputClass}
                value={assignForm.from}
                onChange={(e) => setAssignForm((f) => ({ ...f, from: e.target.value }))}
                aria-invalid={Boolean(assignFieldErrors.from)}
              />
              {assignFieldErrors.from && (
                <p className="mt-1.5 text-[13px] text-danger">{assignFieldErrors.from}</p>
              )}
            </div>

            <div>
              <label className={labelClass} htmlFor="assignLastDay">
                Last working day
              </label>
              <input
                id="assignLastDay"
                type="date"
                className={inputClass}
                value={assignForm.lastDay}
                onChange={(e) =>
                  setAssignForm((f) => ({ ...f, lastDay: e.target.value }))
                }
                aria-invalid={Boolean(assignFieldErrors.lastDay)}
              />
              {assignFieldErrors.lastDay && (
                <p className="mt-1.5 text-[13px] text-danger">
                  {assignFieldErrors.lastDay}
                </p>
              )}
            </div>
          </div>

          <p className="mt-3 text-[13px] text-muted">
            Leave the last working day blank for ongoing work.
          </p>

          {candidateError && (
            <p role="alert" className="mt-3 text-[13px] text-danger">
              {candidateError}
            </p>
          )}

          {assignError && (
            <p
              role="alert"
              className="mt-3 rounded-lg border border-danger/40 bg-danger/10 px-3 py-2.5 text-[13px] text-danger"
            >
              {assignError}
            </p>
          )}

          <div className="mt-4 flex flex-wrap gap-2">
            <button type="submit" disabled={assignSaving} className={primaryClass}>
              {assignSaving ? "Saving…" : "Assign"}
            </button>
            <button
              type="button"
              onClick={() => setAssigning(false)}
              className={secondaryClass}
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {awaitingPeriod ? (
        <p className="mt-6 text-sm text-muted">
          Choose a period above to see who was on this project during it.
        </p>
      ) : !ready ? (
        !error && <p className="mt-6 text-sm text-muted">Loading the team…</p>
      ) : members.length === 0 ? (
        <p className="mt-6 text-sm text-muted">
          {periodMode
            ? "Nobody was assigned to this project during that period."
            : "Nobody is on this project today."}
        </p>
      ) : (
        <ul className="mt-4 divide-y divide-line rounded-xl border border-line">
          {members.map((member) => {
            const assignment = rows.get(String(member.id));
            const open = rowAction && assignment && rowAction.id === assignment._id;

            return (
              <li key={member.id} className="px-4 py-3">
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span className="text-sm text-ink">{member.name}</span>

                  {member.employeeId && (
                    <span className="text-[13px] text-muted">{member.employeeId}</span>
                  )}

                  {/* Over a period the flag sits on each stretch instead. */}
                  {!periodMode && member.isTeamLead && (
                    <span className="rounded-lg border border-brand/40 px-2 py-0.5 text-[12px] text-brand">
                      Team lead
                    </span>
                  )}

                  {canWrite && assignment && (
                    <span className="ml-auto flex flex-wrap gap-2">
                      {/* ⚠️ The server refuses team lead on any assignment carrying a `to`,
                          and one ending in the future still looks live on screen. */}
                      {!member.isTeamLead && !assignment.to && (
                        <button
                          type="button"
                          onClick={() => startRowAction(assignment._id, "lead")}
                          className={rowButtonClass}
                        >
                          Mark as team lead
                        </button>
                      )}
                      {!assignment.to && (
                        <button
                          type="button"
                          onClick={() => startRowAction(assignment._id, "close")}
                          className={rowButtonClass}
                        >
                          Close assignment
                        </button>
                      )}
                    </span>
                  )}
                </div>

                {/* More than one period means the team lead changed hands partway through. */}
                <ul className="mt-1.5 space-y-0.5">
                  {member.periods.map((period, index) => (
                    <li key={`${member.id}-${index}`} className="text-[13px] text-muted">
                      {formatDate(period.from)}
                      {/* ⚠️ `to` is the first day not covered. */}
                      {period.to ? ` to ${formatDate(lastDayOf(period.to))}` : " onwards"}
                      {period.isTeamLead && (
                        <span className="text-brand"> · team lead</span>
                      )}
                    </li>
                  ))}
                </ul>

                {open && (
                  <form
                    onSubmit={submitRowAction}
                    className="mt-3 rounded-xl border border-line bg-surface p-4"
                  >
                    <div className="max-w-xs">
                      <label className={labelClass} htmlFor="rowDate">
                        {rowAction.kind === "close"
                          ? "Last working day on this project"
                          : "Team lead from"}
                      </label>
                      <input
                        id="rowDate"
                        type="date"
                        className={inputClass}
                        value={rowDate}
                        onChange={(e) => {
                          setRowDate(e.target.value);
                          setRowError("");
                        }}
                        aria-invalid={Boolean(rowFieldError)}
                      />
                      {rowFieldError && (
                        <p className="mt-1.5 text-[13px] text-danger">{rowFieldError}</p>
                      )}
                    </div>

                    {rowAction.kind === "lead" && (
                      <p className="mt-3 text-[13px] text-muted">
                        The current lead stops on that date and stays on the project.
                      </p>
                    )}

                    {rowError && (
                      <p
                        role="alert"
                        className="mt-3 rounded-lg border border-danger/40 bg-danger/10 px-3 py-2.5 text-[13px] text-danger"
                      >
                        {rowError}
                      </p>
                    )}

                    <div className="mt-4 flex flex-wrap gap-2">
                      <button type="submit" disabled={rowSaving} className={primaryClass}>
                        {rowSaving ? "Saving…" : "Save"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setRowAction(null)}
                        className={secondaryClass}
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {periodMode && ready && (
        <div className="mt-6">
          <h3 className="text-[13px] font-semibold uppercase tracking-wide text-muted">
            Team lead during the period
          </h3>

          {(team.teamLeadHistory || []).length === 0 ? (
            <p className="mt-2 text-[13px] text-muted">
              Nobody was marked as team lead during it.
            </p>
          ) : (
            <ul className="mt-2 space-y-1">
              {team.teamLeadHistory.map((entry, index) => (
                <li key={`${entry.id}-${index}`} className="text-[13px] text-muted">
                  <span className="text-ink">{entry.name}</span>
                  {" · "}
                  {formatDate(entry.from)}
                  {entry.to ? ` to ${formatDate(lastDayOf(entry.to))}` : " onwards"}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
