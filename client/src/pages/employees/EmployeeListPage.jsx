import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { listUsers } from "../../services/users";
import StatusBadge from "../../components/employees/StatusBadge";

// The roster. Read by HR, Head of HR and Leadership; written only by HR, which is
// what the server enforces. The buttons below only decide what is worth showing.
//
// It lives at /employees rather than /hr/employees because three roles reach it and
// naming the route after one of them would be wrong the moment the other two arrive.

// Left blank, the server hides deactivated people. That is the useful default: a
// roster is a list of the people who work here, and someone who has left is a
// deliberate search rather than background noise.
const STATUS_FILTERS = [
  { value: "", label: "Currently employed" },
  { value: "active", label: "Active only" },
  { value: "invited", label: "Awaiting activation" },
  { value: "inactive", label: "Deactivated" },
];

export default function EmployeeListPage() {
  const { user } = useAuth();
  const canManage = user?.roles?.includes("hr");

  const [items, setItems] = useState([]);
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // The spinner is turned on by whatever CAUSED the reload (the first render, or the
  // status handler below), never inside the effect: a synchronous state write in an
  // effect body costs a second render pass and the lint rule rejects it.
  useEffect(() => {
    let cancelled = false;

    listUsers({ status })
      .then((data) => !cancelled && setItems(data.items || []))
      .catch((err) => !cancelled && setError(err.message))
      .finally(() => !cancelled && setLoading(false));

    return () => {
      cancelled = true;
    };
  }, [status]);

  const handleStatusChange = (value) => {
    setStatus(value);
    setLoading(true);
    setError("");
  };

  // Filtered here rather than on the server: the whole roster is one request and a
  // few dozen rows, so a round trip per keystroke would buy nothing. Status is the
  // server's job because it decides which records are returned at all.
  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return items;

    return items.filter((person) =>
      [person.name, person.email, person.username, person.employeeId]
        .filter(Boolean)
        .some((field) => field.toLowerCase().includes(term)),
    );
  }, [items, search]);

  const inputClass =
    "rounded-lg border border-line bg-raised px-3.5 py-2.5 text-sm text-ink placeholder:text-muted focus:border-brand focus:outline-none";

  return (
    <section>
      <div className="flex flex-wrap items-center gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">Employees</h1>
          <p className="mt-1 text-muted">The people data every review depends on.</p>
        </div>

        {canManage && (
          <Link
            to="/employees/new"
            className="ml-auto rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          >
            New employee
          </Link>
        )}
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name, email, username or ID"
          aria-label="Search employees"
          className={`${inputClass} min-w-[260px] flex-1`}
        />
        <select
          value={status}
          onChange={(e) => handleStatusChange(e.target.value)}
          aria-label="Filter by status"
          className={inputClass}
        >
          {STATUS_FILTERS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      {error && (
        <p
          role="alert"
          className="mt-6 rounded-lg border border-danger/40 bg-danger/10 px-3 py-2.5 text-[13px] text-danger"
        >
          {error}
        </p>
      )}

      <div className="mt-6 overflow-x-auto rounded-xl border border-line bg-raised">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="border-b border-line text-[13px] text-muted">
            <tr>
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Employee ID</th>
              <th className="px-4 py-3 font-medium">Designation</th>
              <th className="px-4 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-muted">
                  Loading…
                </td>
              </tr>
            )}

            {!loading && visible.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-muted">
                  {items.length === 0
                    ? "No records match this filter."
                    : "No records match that search."}
                </td>
              </tr>
            )}

            {!loading &&
              visible.map((person) => (
                <tr key={person._id} className="border-b border-line last:border-0">
                  <td className="px-4 py-3">
                    <Link
                      to={`/employees/${person._id}`}
                      className="font-medium text-ink hover:text-brand"
                    >
                      {person.name}
                    </Link>
                    <span className="block text-[13px] text-muted">
                      {person.username || person.email}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted">{person.employeeId}</td>
                  <td className="px-4 py-3">
                    <span className="text-ink">{person.designation || "—"}</span>
                    {person.jobFamily && (
                      <span className="block text-[13px] text-muted">
                        {person.jobFamily}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={person.status} />
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      <p className="mt-3 text-[13px] text-muted">
        Unit, project, supervisor and HR coverage are not shown here. All four are derived
        from dated records that do not exist yet.
      </p>
    </section>
  );
}
