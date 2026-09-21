import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { getProject, closeProject } from "../../services/projects";
import { closeProjectSchema } from "../../schemas/projectSchema";
import { formatDate, lastDayOf } from "../../utils/dates";
import PageHeader from "../../components/layout/PageHeader";
import Icon from "../../components/common/Icon";
import ProjectTeamPanel from "../../components/projects/ProjectTeamPanel";

export default function ProjectDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();

  const canManage = user?.roles?.some((role) => ["hr", "head_of_hr"].includes(role));

  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  const [closing, setClosing] = useState(false);
  const [lastDay, setLastDay] = useState("");
  const [closeFieldError, setCloseFieldError] = useState("");
  const [closeError, setCloseError] = useState("");
  const [closeSaving, setCloseSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;

    getProject(id)
      .then((data) => !cancelled && setProject(data))
      .catch((err) => !cancelled && setError(err.message))
      .finally(() => !cancelled && setLoading(false));

    return () => {
      cancelled = true;
    };
  }, [id, reloadKey]);

  const handleClose = async () => {
    setCloseError("");
    setCloseFieldError("");

    try {
      await closeProjectSchema.validate({ lastDay });
    } catch (validationError) {
      setCloseFieldError(validationError.message);
      return;
    }

    setCloseSaving(true);
    try {
      // ⚠️ Sent as typed: this is the one end date the server takes inclusively.
      await closeProject(id, lastDay);
      setClosing(false);
      // The team reloads too: closing the project closed every open assignment.
      setReloadKey((key) => key + 1);
    } catch (err) {
      setCloseError(err.message);
    } finally {
      setCloseSaving(false);
    }
  };

  const inputClass =
    "w-full rounded-lg border border-line bg-surface px-3.5 py-2.5 text-sm text-ink focus:border-brand focus:outline-none";
  const labelClass = "mb-1.5 block text-[13px] font-semibold text-ink";

  const closed = Boolean(project?.endDate);

  return (
    <>
      <PageHeader
        title={project?.name || "Project"}
        context={
          project
            ? [
                project.leadId?.name ? `Led by ${project.leadId.name}` : null,
                `Started ${formatDate(project.startDate)}`,
                // `endDate` is the first day not covered.
                closed
                  ? `Ran until ${formatDate(lastDayOf(project.endDate))}`
                  : "Running",
              ]
                .filter(Boolean)
                .join(" · ")
            : undefined
        }
      />

      <Link
        to="/projects"
        className="mb-6 inline-flex items-center gap-2 text-sm text-muted transition-colors hover:text-brand"
      >
        <Icon name="arrowLeft" className="h-4 w-4" />
        Back to projects
      </Link>

      {error && (
        <p
          role="alert"
          className="mt-4 rounded-lg border border-danger/40 bg-danger/10 px-3 py-2.5 text-[13px] text-danger"
        >
          {error}
        </p>
      )}

      {loading ? (
        <p className="mt-6 text-sm text-muted">Loading the project…</p>
      ) : (
        project && (
          <>
            <ProjectTeamPanel
              project={project}
              canManage={canManage}
              reloadKey={reloadKey}
            />

            {canManage && !closed && (
              <section className="mt-8 rounded-xl border border-line bg-raised p-5">
                {!closing ? (
                  <div className="flex flex-wrap items-center gap-4">
                    <div>
                      <p className="text-sm font-medium text-ink">Close this project</p>
                      <p className="mt-1 text-[13px] text-muted">
                        Everyone still on it is taken off on the same date.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setClosing(true)}
                      className="ml-auto cursor-pointer rounded-lg border border-danger/40 px-3.5 py-2 text-sm font-medium text-danger transition-colors hover:bg-danger/10"
                    >
                      Close
                    </button>
                  </div>
                ) : (
                  <div>
                    <p className="text-sm text-ink">
                      Close <strong>{project.name}</strong>? Open assignments end too.
                    </p>

                    <div className="mt-4 max-w-xs">
                      <label className={labelClass} htmlFor="lastDay">
                        Last day it ran
                      </label>
                      <input
                        id="lastDay"
                        type="date"
                        className={inputClass}
                        value={lastDay}
                        onChange={(e) => {
                          setLastDay(e.target.value);
                          setCloseError("");
                        }}
                        aria-invalid={Boolean(closeFieldError)}
                      />
                      {/* Not prefilled with today: guessing would invent the fact being recorded. */}
                      {closeFieldError && (
                        <p className="mt-1.5 text-[13px] text-danger">
                          {closeFieldError}
                        </p>
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
                        onClick={handleClose}
                        disabled={closeSaving}
                        className="cursor-pointer rounded-lg bg-danger px-3.5 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {closeSaving ? "Closing…" : "Yes, close it"}
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
        )
      )}
    </>
  );
}
