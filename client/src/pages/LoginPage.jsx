import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { loginSchema } from "../schemas/loginSchema";
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

export default function LoginPage() {
  const [form, setForm] = useState({ identifier: "", password: "" });
  const [fieldErrors, setFieldErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const { signIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Set by the activation page after it finishes, since activation deliberately
  // does not sign anyone in. Read once into state so it survives the re-render but
  // does not come back if the user navigates here again later.
  const [notice] = useState(location.state?.notice || "");

  const handleChange = (e) => {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
    setFormError("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError("");
    setFieldErrors({});

    try {
      await loginSchema.validate(form, { abortEarly: false });
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
      await signIn(form.identifier, form.password);
      // Back to wherever they were headed before being sent here, or to the
      // landing resolver at "/" which works out the right dashboard.
      navigate(location.state?.from?.pathname || "/", { replace: true });
    } catch (err) {
      // The server's message, shown as-is. It says the same thing for a wrong
      // password, an account that does not exist and one that is deactivated —
      // rewording or splitting it here would leak the difference it hides.
      setFormError(err.message);
      setSubmitting(false);
    }
  };

  const inputClass =
    "w-full rounded-lg border border-line bg-surface px-3.5 py-3 text-sm text-ink placeholder:text-muted focus:border-brand focus:outline-none";

  return (
    <div className="relative flex min-h-svh items-center justify-center overflow-hidden bg-surface px-4">
      {/* Decorative only, and inert to assistive technology. */}
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
            Performance &amp; Development Tracker
          </h1>
          <p className="mt-1.5 text-center text-[15px] leading-snug text-muted">
            Welcome back. Please sign in to continue.
          </p>
        </div>

        {notice && (
          <p
            role="status"
            className="mt-6 rounded-lg border border-brand/40 bg-brand/10 px-3 py-2.5 text-center text-[13px] text-ink"
          >
            {notice}
          </p>
        )}

        <form onSubmit={handleSubmit} className="mt-8 w-full" noValidate>
          <div>
            <label
              htmlFor="identifier"
              className="mb-1.5 block text-[13px] font-semibold text-ink"
            >
              Email or username
            </label>
            <input
              id="identifier"
              name="identifier"
              type="text"
              autoComplete="username"
              placeholder="you@altrium.com or perera0241"
              value={form.identifier}
              onChange={handleChange}
              aria-invalid={Boolean(fieldErrors.identifier)}
              className={inputClass}
            />
            {fieldErrors.identifier && (
              <p className="mt-1.5 text-[13px] text-danger">{fieldErrors.identifier}</p>
            )}
          </div>

          <div className="mt-4">
            <label
              htmlFor="password"
              className="mb-1.5 block text-[13px] font-semibold text-ink"
            >
              Password
            </label>
            <div className="relative flex items-center">
              <input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                placeholder="Enter your password"
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

          {formError && (
            // `role="alert"` so a screen reader announces it. Without it the
            // message appears silently and a non-sighted user is left waiting.
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
            {submitting ? "Signing in…" : "Sign in"}
          </button>
        </form>

        {/* No "forgot password" and no "sign up" link, both deliberately.
            PDT has no self-registration at all — HR creates every record and the
            employee activates it with a one-time code, so a sign-up route would
            be a promise the system cannot keep. The reset link arrives with
            "Reset a forgotten password"; until then it would go nowhere. */}
        <p className="mt-6 text-center text-[13px] text-muted">
          Accounts are created by HR. Contact them if you cannot sign in.
        </p>
      </div>
    </div>
  );
}
