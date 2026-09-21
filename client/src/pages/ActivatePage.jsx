import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { activateSchema, CODE_SHAPE_EXACT } from "../schemas/activateSchema";
import { activateAccount } from "../services/invite";
import ThemeToggle from "../components/common/ThemeToggle";

function EyeIcon({ open }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-[18px] w-[18px]"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      aria-hidden="true"
    >
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
      <circle cx="12" cy="12" r="3" />
      {!open && <path d="M4 4l16 16" strokeLinecap="round" />}
    </svg>
  );
}

// ⚠️ Nothing is fetched before the code is submitted: an endpoint confirming whose
// account a code opens would answer the question an attacker is asking.
export default function ActivatePage() {
  const [searchParams] = useSearchParams();

  // The paste box is for a mangled link, or somebody opening the app directly.
  const rawCodeFromLink = (searchParams.get("code") || "").trim();

  // Only catches a mangled code; expiry and re-issue are knowable only on the server.
  const linkCodeUsable = CODE_SHAPE_EXACT.test(rawCodeFromLink);
  const linkWasMangled = Boolean(rawCodeFromLink) && !linkCodeUsable;
  const codeFromLink = linkCodeUsable ? rawCodeFromLink : "";

  const [form, setForm] = useState({
    code: codeFromLink,
    password: "",
    confirmPassword: "",
  });
  const [fieldErrors, setFieldErrors] = useState({});
  const [formError, setFormError] = useState("");
  // Set when the server refuses the code rather than the password: a retry cannot work.
  const [linkDead, setLinkDead] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const navigate = useNavigate();

  const handleChange = (e) => {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
    setFormError("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError("");
    setFieldErrors({});

    try {
      await activateSchema.validate(form, { abortEarly: false });
    } catch (validationError) {
      const errors = {};
      validationError.inner.forEach((err) => {
        if (!errors[err.path]) errors[err.path] = err.message;
      });
      setFieldErrors(errors);
      return;
    }

    setSubmitting(true);
    try {
      await activateAccount(form.code.trim(), form.password);

      // Activation returns no token (B11).
      navigate("/login", {
        replace: true,
        state: { notice: "Your account is ready. Sign in with your new password." },
      });
    } catch (err) {
      // ⚠️ One server message covers never issued, used and expired; never split it apart.
      // Matching on the message is the weak part: a 410 from the server would be cleaner.
      if (/invite code/i.test(err.message)) setLinkDead(true);

      setFormError(err.message);
      setSubmitting(false);
    }
  };

  const inputClass =
    "w-full rounded-lg border border-line bg-surface px-3.5 py-3 text-sm text-ink placeholder:text-muted focus:border-brand focus:outline-none";

  return (
    <div className="relative flex min-h-svh items-center justify-center overflow-hidden bg-surface px-4">
      <div className="blob-float-1 pointer-events-none absolute -top-32 -left-28 h-[420px] w-[420px] rounded-full bg-[radial-gradient(circle_at_30%_30%,var(--color-brand),transparent_70%)] opacity-25" />
      <div className="blob-float-2 pointer-events-none absolute -right-32 -bottom-36 h-[520px] w-[520px] rounded-full bg-[radial-gradient(circle_at_60%_60%,var(--color-brand),transparent_70%)] opacity-20" />

      <ThemeToggle className="absolute top-4 right-4 z-10" />

      <div className="relative w-full max-w-[420px] rounded-2xl border border-line bg-raised px-10 pt-11 pb-9 shadow-2xl">
        <div className="flex flex-col items-center">
          <div className="mb-5 flex h-13 w-13 items-center justify-center rounded-xl bg-brand p-3.5">
            <div className="relative h-full w-full rounded-[5px] border-[2.5px] border-white">
              <div className="absolute top-[3px] right-0.5 left-0.5 h-0.5 rounded-sm bg-white" />
            </div>
          </div>

          <h1 className="text-[22px] font-bold tracking-tight text-ink">
            Set your password
          </h1>
          <p className="mt-1.5 text-center text-[15px] leading-snug text-muted">
            Your account has been created. Choose a password to finish setting it up.
          </p>
        </div>

        {linkDead ? (
          <div className="mt-8">
            <p
              role="alert"
              className="rounded-lg border border-danger/40 bg-danger/10 px-3 py-2.5 text-[13px] text-danger"
            >
              {formError}
            </p>
            <p className="mt-4 text-[13px] text-muted">
              A code works once and expires after seven days. Ask HR for a new invite.
            </p>
            <Link
              to="/login"
              className="mt-6 block w-full cursor-pointer rounded-lg border border-line py-3 text-center text-sm font-semibold text-ink transition-colors hover:text-brand"
            >
              Go to sign in
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-8 w-full" noValidate>
            {codeFromLink ? (
              <p className="rounded-lg border border-line bg-surface px-3.5 py-2.5 text-[13px] text-muted">
                Using the code from your invite link.
              </p>
            ) : (
              <div>
                {linkWasMangled && (
                  <p className="mb-4 rounded-lg border border-line bg-surface px-3.5 py-2.5 text-[13px] text-muted">
                    That link is incomplete. Paste the full code from your invite email.
                  </p>
                )}

                <label
                  htmlFor="code"
                  className="mb-1.5 block text-[13px] font-semibold text-ink"
                >
                  Invite code
                </label>
                <input
                  id="code"
                  name="code"
                  type="text"
                  autoComplete="off"
                  placeholder="Paste the code from your invite email"
                  value={form.code}
                  onChange={handleChange}
                  aria-invalid={Boolean(fieldErrors.code)}
                  className={inputClass}
                />
                {fieldErrors.code && (
                  <p className="mt-1.5 text-[13px] text-danger">{fieldErrors.code}</p>
                )}
              </div>
            )}

            <div className="mt-4">
              <label
                htmlFor="password"
                className="mb-1.5 block text-[13px] font-semibold text-ink"
              >
                New password
              </label>
              <div className="relative flex items-center">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  placeholder="At least 8 characters"
                  value={form.password}
                  onChange={handleChange}
                  aria-invalid={Boolean(fieldErrors.password)}
                  className={`${inputClass} pr-11`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="absolute right-3 cursor-pointer text-muted hover:text-brand"
                >
                  <EyeIcon open={showPassword} />
                </button>
              </div>
              {fieldErrors.password && (
                <p className="mt-1.5 text-[13px] text-danger">{fieldErrors.password}</p>
              )}
            </div>

            <div className="mt-4">
              <label
                htmlFor="confirmPassword"
                className="mb-1.5 block text-[13px] font-semibold text-ink"
              >
                Confirm password
              </label>
              {/* Shares the show/hide toggle above: revealing one field and not the
                other defeats the point of confirming. */}
              <input
                id="confirmPassword"
                name="confirmPassword"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                placeholder="Type it again"
                value={form.confirmPassword}
                onChange={handleChange}
                aria-invalid={Boolean(fieldErrors.confirmPassword)}
                className={inputClass}
              />
              {fieldErrors.confirmPassword && (
                <p className="mt-1.5 text-[13px] text-danger">
                  {fieldErrors.confirmPassword}
                </p>
              )}
            </div>

            {formError && (
              <p
                role="alert"
                className="mt-4 rounded-lg border border-danger/40 bg-danger/10 px-3 py-2.5 text-[13px] text-danger"
              >
                {formError}
              </p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="mt-6 w-full cursor-pointer rounded-lg bg-brand py-3 text-sm font-semibold text-white transition-colors hover:bg-brand-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? "Setting up…" : "Set password and continue"}
            </button>
          </form>
        )}

        {!linkDead && (
          <p className="mt-6 text-center text-[13px] text-muted">
            Codes expire after seven days. If yours no longer works, ask HR for a new one.
          </p>
        )}
      </div>
    </div>
  );
}
