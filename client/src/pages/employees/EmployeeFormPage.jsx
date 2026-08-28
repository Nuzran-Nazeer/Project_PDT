import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { createUser, getUser, updateUser } from "../../services/users";
import {
  buildCreateEmployeeSchema,
  buildUpdateEmployeeSchema,
} from "../../schemas/employeeSchema";
import { addMonths, toDateInput } from "../../utils/dates";

// One page for creating and editing, the two being the same form minus four fields.
//
// ⚠️ Editing offers less on purpose: the server refuses to change the employee ID,
// username, joined date and appraisal group.
//
// ⚠️ There is NO PASSWORD FIELD, deliberately. The person sets their own from the
// invite link, so HR never knows it.

// HR types the number and the client assembles the rest. The prefix is hardcoded, but
// the assembled value is still checked against the pattern the server sends.
const EMPLOYEE_ID_PREFIX = "ALT-";
const EMPLOYEE_ID_DIGITS = 4;

// Probation runs 6 to 9 months PER PERSON, so this is a shortcut rather than a derived
// value: one number would contradict the range. The date field stays editable.
//
// ⚠️ The one client-side copy of a company rule. It belongs in the server constants.
const PROBATION_OPTIONS = [
  { value: "", label: "None" },
  { value: "6", label: "6 months" },
  { value: "9", label: "9 months" },
];

// Which option a record's existing dates correspond to. Derived from the dates rather
// than remembered in state, because a remembered choice and a loaded date disagree the
// moment you open an existing record: the dropdown would say None while a date sat
// filled in below it.
const presetFor = ({ joinedDate, probationEndDate }) => {
  if (!probationEndDate) return "";
  if (probationEndDate === addMonths(joinedDate, 6)) return "6";
  if (probationEndDate === addMonths(joinedDate, 9)) return "9";
  return "custom";
};

const EMPTY = {
  employeeIdDigits: "",
  name: "",
  email: "",
  joinedDate: "",
  probationEndDate: "",
  designation: "",
  level: "",
  location: "",
  roles: ["employee"],
  status: "",
};

export default function EmployeeFormPage() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const { constants } = useAuth();

  const [form, setForm] = useState(EMPTY);
  const [fieldErrors, setFieldErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [loading, setLoading] = useState(isEdit);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isEdit) return;

    getUser(id)
      .then((person) =>
        setForm({
          ...EMPTY,
          ...person,
          joinedDate: toDateInput(person.joinedDate),
          probationEndDate: toDateInput(person.probationEndDate),
          designation: person.designation || "",
          level: person.level || "",
          location: person.location || "",
          roles: person.roles || [],
        }),
      )
      .catch((err) => setFormError(err.message))
      .finally(() => setLoading(false));
  }, [id, isEdit]);

  // What the server will actually receive. Padded, so typing 241 produces ALT-0241
  // rather than a value the pattern rejects for a reason nobody can see.
  const employeeId = form.employeeIdDigits
    ? EMPLOYEE_ID_PREFIX + form.employeeIdDigits.padStart(EMPLOYEE_ID_DIGITS, "0")
    : "";

  // The constants payload pairs each designation with its family, so the family can
  // be shown the moment a designation is picked. It is display only: the server
  // derives it and ignores anything a client sends.
  const jobFamily = useMemo(() => {
    const match = (constants?.designations || []).find(
      (entry) => entry.name === form.designation,
    );
    return match?.jobFamily || "";
  }, [constants, form.designation]);

  const handleChange = (e) => {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
    setFormError("");
  };

  // Digits only, and a pasted ALT-0241 loses its prefix rather than becoming
  // ALT-ALT-0241. Pasting the whole ID is the obvious thing to do.
  const handleIdChange = (e) => {
    const digits = e.target.value
      .replace(/^\s*alt-?/i, "")
      .replace(/\D/g, "")
      .slice(0, EMPLOYEE_ID_DIGITS);

    setForm((f) => ({ ...f, employeeIdDigits: digits }));
    setFormError("");
  };

  const handleProbationPreset = (months) => {
    setForm((f) => ({
      ...f,
      probationEndDate: months ? addMonths(f.joinedDate, Number(months)) : "",
    }));
  };

  // Changing the joined date has to move a probation date that was derived FROM it, or
  // the two silently disagree and the wrong one is saved.
  const handleJoinedDateChange = (e) => {
    const joinedDate = e.target.value;
    setForm((f) => {
      const preset = presetFor(f);
      return {
        ...f,
        joinedDate,
        // A date typed by hand is left alone. One that came from an option follows the
        // joined date, or the two silently disagree and the wrong one is saved.
        probationEndDate:
          preset === "6" || preset === "9"
            ? addMonths(joinedDate, Number(preset))
            : f.probationEndDate,
      };
    });
    setFormError("");
  };

  const toggleRole = (role) => {
    setForm((f) => ({
      ...f,
      roles: f.roles.includes(role)
        ? f.roles.filter((r) => r !== role)
        : [...f.roles, role],
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError("");
    setFieldErrors({});

    const schema = isEdit
      ? buildUpdateEmployeeSchema(constants)
      : buildCreateEmployeeSchema(constants);

    try {
      await schema.validate(
        { ...form, employeeId },
        { abortEarly: false, stripUnknown: false },
      );
    } catch (validationError) {
      const errors = {};
      validationError.inner.forEach((err) => {
        if (!errors[err.path]) errors[err.path] = err.message;
      });
      setFieldErrors(errors);
      return;
    }

    // Only what the server accepts for this operation. Sending an immutable field
    // back on an edit is refused outright, so the edit payload is built from
    // scratch rather than by spreading the loaded record.
    const payload = isEdit
      ? {
          name: form.name,
          email: form.email,
          designation: form.designation || undefined,
          level: form.level,
          location: form.location || undefined,
          probationEndDate: form.probationEndDate || undefined,
          roles: form.roles,
          status: form.status || undefined,
        }
      : {
          employeeId,
          name: form.name,
          email: form.email,
          joinedDate: form.joinedDate,
          probationEndDate: form.probationEndDate || undefined,
          designation: form.designation || undefined,
          level: form.level,
          location: form.location || undefined,
          roles: form.roles,
        };

    setSubmitting(true);
    try {
      const saved = isEdit ? await updateUser(id, payload) : await createUser(payload);
      navigate(`/employees/${saved._id}`, { replace: true });
    } catch (err) {
      // The server's message: duplicate email, duplicate employee ID, an immutable
      // field, a designation it does not recognise. All of them are worth reading.
      setFormError(err.message);
      setSubmitting(false);
    }
  };

  const inputClass =
    "w-full rounded-lg border border-line bg-surface px-3.5 py-2.5 text-sm text-ink placeholder:text-muted focus:border-brand focus:outline-none";
  const labelClass = "mb-1.5 block text-[13px] font-semibold text-ink";

  const field = (name, label, extra = {}) => (
    <div>
      <label htmlFor={name} className={labelClass}>
        {label}
      </label>
      <input
        id={name}
        name={name}
        value={form[name] ?? ""}
        onChange={handleChange}
        aria-invalid={Boolean(fieldErrors[name])}
        className={inputClass}
        {...extra}
      />
      {fieldErrors[name] && (
        <p className="mt-1.5 text-[13px] text-danger">{fieldErrors[name]}</p>
      )}
    </div>
  );

  if (loading) return <p className="text-muted">Loading…</p>;

  return (
    <section className="max-w-2xl">
      <Link
        to={isEdit ? `/employees/${id}` : "/employees"}
        className="text-[13px] text-muted hover:text-brand"
      >
        ← {isEdit ? "Back to record" : "Employees"}
      </Link>

      <h1 className="mt-3 text-2xl font-semibold tracking-tight text-ink">
        {isEdit ? "Edit employee record" : "New employee record"}
      </h1>
      <p className="mt-1 text-muted">
        {isEdit
          ? "Employee ID, username, joined date and appraisal group cannot be changed."
          : "The record is created without a password. The employee sets their own from an invite."}
      </p>

      <form onSubmit={handleSubmit} className="mt-8 grid gap-5 sm:grid-cols-2" noValidate>
        {!isEdit && (
          <div>
            <label htmlFor="employeeIdDigits" className={labelClass}>
              Employee ID
            </label>
            <div className="flex items-stretch">
              <span className="flex items-center rounded-l-lg border border-r-0 border-line bg-raised px-3 text-sm text-muted">
                {EMPLOYEE_ID_PREFIX}
              </span>
              <input
                id="employeeIdDigits"
                name="employeeIdDigits"
                inputMode="numeric"
                autoComplete="off"
                placeholder="0241"
                value={form.employeeIdDigits}
                onChange={handleIdChange}
                aria-invalid={Boolean(fieldErrors.employeeId)}
                className={`${inputClass} rounded-l-none`}
              />
            </div>
            <p className="mt-1.5 text-[13px] text-muted">
              {employeeId ? `Saved as ${employeeId}` : "Four digits, e.g. 0241"}
            </p>
            {fieldErrors.employeeId && (
              <p className="mt-1.5 text-[13px] text-danger">{fieldErrors.employeeId}</p>
            )}
          </div>
        )}
        {field("name", "Full name", { placeholder: "Nuzran Nazeer" })}

        <div className={isEdit ? "" : "sm:col-span-2"}>
          <label htmlFor="email" className={labelClass}>
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            value={form.email}
            onChange={handleChange}
            placeholder="name@altrium.com"
            aria-invalid={Boolean(fieldErrors.email)}
            className={inputClass}
          />
          {fieldErrors.email && (
            <p className="mt-1.5 text-[13px] text-danger">{fieldErrors.email}</p>
          )}
        </div>

        <div>
          <label htmlFor="designation" className={labelClass}>
            Designation
          </label>
          <select
            id="designation"
            name="designation"
            value={form.designation}
            onChange={handleChange}
            className={inputClass}
          >
            <option value="">Not set</option>
            {(constants?.designations || []).map((entry) => (
              <option key={entry.name} value={entry.name}>
                {entry.name}
              </option>
            ))}
          </select>
          <p className="mt-1.5 text-[13px] text-muted">
            {jobFamily ? `Job family: ${jobFamily}` : "The job family follows from this."}
          </p>
          {fieldErrors.designation && (
            <p className="mt-1.5 text-[13px] text-danger">{fieldErrors.designation}</p>
          )}
        </div>

        {field("level", "Level", { placeholder: "SE II" })}

        <div>
          <label htmlFor="location" className={labelClass}>
            Location
          </label>
          <select
            id="location"
            name="location"
            value={form.location}
            onChange={handleChange}
            className={inputClass}
          >
            <option value="">Not set</option>
            {(constants?.locations || []).map((place) => (
              <option key={place} value={place}>
                {place}
              </option>
            ))}
          </select>
          {fieldErrors.location && (
            <p className="mt-1.5 text-[13px] text-danger">{fieldErrors.location}</p>
          )}
        </div>

        {!isEdit && (
          <div>
            <label htmlFor="joinedDate" className={labelClass}>
              Joined date
            </label>
            <input
              id="joinedDate"
              name="joinedDate"
              type="date"
              value={form.joinedDate}
              onChange={handleJoinedDateChange}
              aria-invalid={Boolean(fieldErrors.joinedDate)}
              className={inputClass}
            />
            {fieldErrors.joinedDate && (
              <p className="mt-1.5 text-[13px] text-danger">{fieldErrors.joinedDate}</p>
            )}
          </div>
        )}

        <div>
          <label htmlFor="probationPreset" className={labelClass}>
            Probation
          </label>
          <select
            id="probationPreset"
            value={presetFor(form)}
            onChange={(e) => handleProbationPreset(e.target.value)}
            disabled={!form.joinedDate}
            className={`${inputClass} disabled:cursor-not-allowed disabled:opacity-60`}
          >
            {PROBATION_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
            {/* Not selectable: it is what the dropdown reports when the date below
                matches neither option, which is how an extended probation reads. */}
            <option value="custom" disabled>
              Custom date
            </option>
          </select>
          <p className="mt-1.5 text-[13px] text-muted">
            {form.joinedDate
              ? "Counted from the joined date. The date below stays editable."
              : "Set the joined date first."}
          </p>
        </div>

        <div>
          <label htmlFor="probationEndDate" className={labelClass}>
            Probation ends
          </label>
          <input
            id="probationEndDate"
            name="probationEndDate"
            type="date"
            value={form.probationEndDate}
            onChange={handleChange}
            aria-invalid={Boolean(fieldErrors.probationEndDate)}
            className={inputClass}
          />
          {fieldErrors.probationEndDate && (
            <p className="mt-1.5 text-[13px] text-danger">
              {fieldErrors.probationEndDate}
            </p>
          )}
        </div>

        {isEdit && (
          <div>
            <label htmlFor="status" className={labelClass}>
              Status
            </label>
            <select
              id="status"
              name="status"
              value={form.status}
              onChange={handleChange}
              className={inputClass}
            >
              {(constants?.statuses || []).map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
            {fieldErrors.status && (
              <p className="mt-1.5 text-[13px] text-danger">{fieldErrors.status}</p>
            )}
          </div>
        )}

        <fieldset className="sm:col-span-2">
          <legend className={labelClass}>Roles</legend>
          <div className="flex flex-wrap gap-3">
            {(constants?.roles || []).map((role) => (
              <label
                key={role}
                className="flex cursor-pointer items-center gap-2 rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink"
              >
                <input
                  type="checkbox"
                  checked={form.roles.includes(role)}
                  onChange={() => toggleRole(role)}
                  className="accent-brand"
                />
                {role}
              </label>
            ))}
          </div>
          {/* `supervisor` is absent because it cannot be granted: you are a
              supervisor because you lead a unit on a given date, which is read from
              the org history. Offering it here would build a form whose value the
              server refuses. */}
          <p className="mt-2 text-[13px] text-muted">
            Supervisor is not listed. It is worked out from who leads a unit, not granted
            here.
          </p>
          {fieldErrors.roles && (
            <p className="mt-1.5 text-[13px] text-danger">{fieldErrors.roles}</p>
          )}
        </fieldset>

        {formError && (
          <p
            role="alert"
            className="rounded-lg border border-danger/40 bg-danger/10 px-3 py-2.5 text-[13px] text-danger sm:col-span-2"
          >
            {formError}
          </p>
        )}

        <div className="flex gap-3 sm:col-span-2">
          <button
            type="submit"
            disabled={submitting}
            className="cursor-pointer rounded-lg bg-brand px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? "Saving…" : isEdit ? "Save changes" : "Create record"}
          </button>
          <button
            type="button"
            onClick={() => navigate(isEdit ? `/employees/${id}` : "/employees")}
            className="cursor-pointer rounded-lg border border-line px-5 py-2.5 text-sm font-medium text-muted transition-colors hover:text-ink"
          >
            Cancel
          </button>
        </div>
      </form>
    </section>
  );
}
