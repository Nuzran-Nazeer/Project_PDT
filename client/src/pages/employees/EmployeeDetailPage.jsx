import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { deactivateUser, getUser } from "../../services/users";
import StatusBadge from "../../components/employees/StatusBadge";
import { formatDate } from "../../utils/dates";

// One employee record, including the parts nobody types.
//
// The derived values are shown deliberately rather than hidden. Somebody will ask
// why they cannot edit a username or an appraisal group, and a screen that displays
// them beside the fields that ARE editable answers that without a conversation.

function Row({ label, value, note }) {
  return (
    <div className="border-b border-line py-3 last:border-0 sm:flex sm:gap-6">
      <dt className="text-[13px] text-muted sm:w-52 sm:shrink-0 sm:py-0.5">{label}</dt>
      <dd className="mt-0.5 text-sm text-ink sm:mt-0 sm:py-0.5">
        {value || "—"}
        {note && <span className="block text-[13px] text-muted">{note}</span>}
      </dd>
    </div>
  );
}

export default function EmployeeDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const canManage = user?.roles?.includes("hr");

  const [person, setPerson] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [working, setWorking] = useState(false);

  // No setLoading(true) here: the initial state is already `true`, and this screen
  // is only ever reached by mounting it fresh. Setting it inside the effect body
  // would be a synchronous state write in an effect, which the React lint rule
  // rejects for causing a second render pass.
  useEffect(() => {
    getUser(id)
      .then(setPerson)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [id]);

  const handleDeactivate = async () => {
    setWorking(true);
    setError("");
    try {
      const updated = await deactivateUser(id);
      setPerson(updated);
      setConfirming(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setWorking(false);
    }
  };

  if (loading) return <p className="text-muted">Loading…</p>;

  if (!person) {
    return (
      <section>
        <p role="alert" className="text-danger">
          {error || "That record could not be loaded."}
        </p>
        <button
          type="button"
          onClick={() => navigate("/employees")}
          className="mt-4 cursor-pointer text-sm font-medium text-brand hover:underline"
        >
          Back to employees
        </button>
      </section>
    );
  }

  return (
    <section>
      <Link to="/employees" className="text-[13px] text-muted hover:text-brand">
        ← Employees
      </Link>

      <div className="mt-3 flex flex-wrap items-start gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">
            {person.name}
          </h1>
          <p className="mt-1 text-muted">
            {person.designation || "No designation"} · {person.employeeId}
          </p>
        </div>

        <div className="ml-auto flex items-center gap-3">
          <StatusBadge status={person.status} />
          {canManage && (
            <Link
              to={`/employees/${person._id}/edit`}
              className="rounded-lg border border-line px-3.5 py-2 text-sm font-medium text-ink transition-colors hover:text-brand"
            >
              Edit
            </Link>
          )}
        </div>
      </div>

      {error && (
        <p
          role="alert"
          className="mt-6 rounded-lg border border-danger/40 bg-danger/10 px-3 py-2.5 text-[13px] text-danger"
        >
          {error}
        </p>
      )}

      <dl className="mt-8 rounded-xl border border-line bg-raised px-5 py-2">
        <Row label="Email" value={person.email} />
        <Row
          label="Username"
          value={person.username}
          note="Generated from the name and employee ID. Never typed, never changed."
        />
        <Row label="Level" value={person.level} />
        <Row label="Location" value={person.location} />
        <Row
          label="Job family"
          value={person.jobFamily}
          note="Follows from the designation, and selects the review form."
        />
        <Row label="Joined" value={formatDate(person.joinedDate)} />
        <Row label="Probation ends" value={formatDate(person.probationEndDate)} />
        <Row
          label="Appraisal group"
          value={person.parGroup}
          note="Set once from the joined date. Moving it would change which cycle this person's history belongs to."
        />
        <Row label="Roles" value={(person.roles || []).join(", ")} />
      </dl>

      {canManage && person.status !== "inactive" && (
        <div className="mt-8 rounded-xl border border-line bg-raised p-5">
          {!confirming ? (
            <div className="flex flex-wrap items-center gap-4">
              <div>
                <p className="text-sm font-medium text-ink">Deactivate this account</p>
                <p className="mt-1 text-[13px] text-muted">
                  The person can no longer sign in. The record itself stays.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setConfirming(true)}
                className="ml-auto cursor-pointer rounded-lg border border-danger/40 px-3.5 py-2 text-sm font-medium text-danger transition-colors hover:bg-danger/10"
              >
                Deactivate
              </button>
            </div>
          ) : (
            <div>
              <p className="text-sm text-ink">
                Deactivate <strong>{person.name}</strong>? They will not be able to sign
                in. The record is kept, because it is part of their appraisal history, and
                HR can set the account back to active later.
              </p>
              <div className="mt-4 flex gap-3">
                <button
                  type="button"
                  onClick={handleDeactivate}
                  disabled={working}
                  className="cursor-pointer rounded-lg bg-danger px-3.5 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {working ? "Deactivating…" : "Yes, deactivate"}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirming(false)}
                  className="cursor-pointer rounded-lg border border-line px-3.5 py-2 text-sm font-medium text-muted transition-colors hover:text-ink"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
