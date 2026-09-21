import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { createProjectSchema } from "../../schemas/projectSchema";
import { listProjects, createProject } from "../../services/projects";
import { listUsers } from "../../services/users";
import { formatDate, lastDayOf, todayInput } from "../../utils/dates";
import PageHeader from "../../components/layout/PageHeader";

// ⚠️ Every rule here is the server's. The button is drawn for anyone who could plausibly
// use it, and a coverage refusal arrives in the response.

const blankForm = () => ({ name: "", leadId: "", startDate: todayInput() });

export default function ProjectsPage() {
  const { user } = useAuth();

  // The coarse half of the server's gate; the fine half is per person and per date.
  const canManage = user?.roles?.some((role) => ["hr", "head_of_hr"].includes(role));

  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState(blankForm);
  const [fieldErrors, setFieldErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  const [leads, setLeads] = useState([]);
  const [leadError, setLeadError] = useState("");

  useEffect(() => {
    let cancelled = false;

    listProjects()
      .then((data) => !cancelled && setProjects(data.items || []))
      .catch((err) => !cancelled && setLoadError(err.message))
      .finally(() => !cancelled && setLoading(false));

    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  // Anyone active may lead a project: nothing ties them to a place in the tree.
  useEffect(() => {
    if (!showCreate) return undefined;

    let cancelled = false;

    listUsers({ status: "active" })
      .then((data) => {
        if (cancelled) return;
        setLeadError("");
        setLeads(data.items || []);
      })
      .catch(() => {
        if (cancelled) return;
        setLeads([]);
        setLeadError("The people who could lead this project could not be loaded.");
      });

    return () => {
      cancelled = true;
    };
  }, [showCreate]);

  const startCreate = () => {
    setShowCreate(true);
    setForm(blankForm());
    setFieldErrors({});
    setFormError("");
  };

  const submitCreate = async (event) => {
    event.preventDefault();
    setFieldErrors({});
    setFormError("");

    try {
      await createProjectSchema.validate(form, { abortEarly: false });
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
      await createProject({
        name: form.name.trim(),
        leadId: form.leadId,
        startDate: form.startDate,
      });
      setShowCreate(false);
      setReloadKey((key) => key + 1);
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const inputClass =
    "w-full rounded-lg border border-line bg-surface px-3.5 py-2.5 text-sm text-ink placeholder:text-muted focus:border-brand focus:outline-none";
  const labelClass = "mb-1.5 block text-[13px] font-semibold text-ink";
  const primaryClass =
    "cursor-pointer rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:cursor-not-allowed disabled:opacity-60";
  const secondaryClass =
    "cursor-pointer rounded-lg border border-line px-3.5 py-2 text-sm font-medium text-muted transition-colors hover:text-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand";

  return (
    <>
      <PageHeader
        title="Projects"
        context="Cross unit work, project leads and team leads"
        backTo="/dashboard"
      />

      {canManage && !showCreate && (
        <button type="button" onClick={startCreate} className={primaryClass}>
          New project
        </button>
      )}

      {loadError && <Alert>{loadError}</Alert>}

      {showCreate && (
        <form
          onSubmit={submitCreate}
          className="mt-6 rounded-xl border border-line bg-raised p-5"
        >
          <h2 className="text-[13px] font-semibold uppercase tracking-wide text-muted">
            New project
          </h2>

          <p className="mt-2 max-w-prose text-[13px] text-muted">
            The lead is assigned from the start date automatically.
          </p>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className={labelClass} htmlFor="name">
                Name
              </label>
              <input
                id="name"
                className={inputClass}
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                aria-invalid={Boolean(fieldErrors.name)}
              />
              <FieldError>{fieldErrors.name}</FieldError>
            </div>

            <div>
              <label className={labelClass} htmlFor="leadId">
                Who leads it
              </label>
              <select
                id="leadId"
                className={inputClass}
                value={form.leadId}
                onChange={(e) => setForm({ ...form, leadId: e.target.value })}
                aria-invalid={Boolean(fieldErrors.leadId)}
              >
                <option value="">Choose…</option>
                {leads.map((person) => (
                  <option key={person._id} value={person._id}>
                    {person.name}
                  </option>
                ))}
              </select>
              <FieldError>{fieldErrors.leadId}</FieldError>
            </div>

            <div>
              <label className={labelClass} htmlFor="startDate">
                Starts
              </label>
              <input
                id="startDate"
                type="date"
                className={inputClass}
                value={form.startDate}
                onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                aria-invalid={Boolean(fieldErrors.startDate)}
              />
              <FieldError>{fieldErrors.startDate}</FieldError>
            </div>
          </div>

          {leadError && <Alert>{leadError}</Alert>}
          {formError && <Alert>{formError}</Alert>}

          <div className="mt-5 flex flex-wrap gap-3">
            <button type="submit" disabled={saving} className={primaryClass}>
              {saving ? "Creating…" : "Create project"}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowCreate(false);
                setFieldErrors({});
                setFormError("");
              }}
              className={secondaryClass}
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <p className="mt-6 text-sm text-muted">Loading projects…</p>
      ) : projects.length === 0 ? (
        <div className="mt-6 rounded-xl border border-line bg-raised px-6 py-12 text-center">
          <p className="text-sm font-semibold text-ink">No projects yet</p>
          <p className="mx-auto mt-1.5 max-w-md text-sm text-muted">
            {canManage
              ? "Create the first one, then assign the people working on it."
              : "Nobody has recorded a project yet."}
          </p>
        </div>
      ) : (
        <ul className="mt-6 space-y-3">
          {projects.map((project) => (
            <li key={project._id} className="rounded-xl border border-line bg-raised p-5">
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <h2 className="text-[15px] font-semibold text-ink">{project.name}</h2>

                <span
                  className={`rounded-lg border px-2.5 py-1 text-[12px] ${
                    project.endDate
                      ? "border-line text-muted"
                      : "border-brand/40 text-brand"
                  }`}
                >
                  {project.endDate ? "Closed" : "Running"}
                </span>
              </div>

              <p className="mt-2 text-[13px] text-muted">
                Led by{" "}
                <span className="text-ink">{project.leadId?.name || "Unknown"}</span>
                {" · started "}
                {formatDate(project.startDate)}
                {/* ⚠️ `endDate` is the first day not covered. */}
                {project.endDate &&
                  ` · ran until ${formatDate(lastDayOf(project.endDate))}`}
              </p>

              <div className="mt-4 flex flex-wrap gap-3">
                <Link to={`/projects/${project._id}`} className={secondaryClass}>
                  View the team
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

function Alert({ children }) {
  return (
    <p
      role="alert"
      className="mt-4 rounded-lg border border-danger/40 bg-danger/10 px-3 py-2.5 text-[13px] text-danger"
    >
      {children}
    </p>
  );
}

function FieldError({ children }) {
  if (!children) return null;
  return <p className="mt-1.5 text-[13px] text-danger">{children}</p>;
}
