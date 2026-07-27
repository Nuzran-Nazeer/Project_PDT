import { useState } from "react";

export default function LoginPage() {
  const [form, setForm] = useState({ email: "", password: "" });
  const [showPassword, setShowPassword] = useState(false);

  const handleChange = (e) =>
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const handleSubmit = (e) => {
    e.preventDefault();
    console.log("Login submitted:", form);
  };

  return (
    <div style={styles.page}>
      <div style={styles.blobTop} />
      <div style={styles.blobBottom} />
      <div style={styles.sheen} />

      <div style={styles.card}>
        <div style={styles.logo}>
          <div style={styles.logoMark}>
            <div style={styles.logoBar} />
          </div>
        </div>

        <div style={styles.title}>PAR Manager</div>
        <div style={styles.subtitle}>Welcome back! Please enter your details.</div>

        <form onSubmit={handleSubmit} style={{ width: "100%" }}>
          <div style={{ width: "100%", marginTop: 32 }}>
            <label style={styles.label}>Email</label>
            <input
              type="email"
              name="email"
              placeholder="Enter your email"
              value={form.email}
              onChange={handleChange}
              required
              style={styles.input}
            />
          </div>

          <div style={{ width: "100%", marginTop: 18 }}>
            <label style={styles.label}>Password</label>
            <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
              <input
                type={showPassword ? "text" : "password"}
                name="password"
                placeholder="Enter your password"
                value={form.password}
                onChange={handleChange}
                required
                style={{ ...styles.input, paddingRight: 40 }}
              />
              <div
                onClick={() => setShowPassword((s) => !s)}
                style={styles.eyeIcon}
              >
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              </div>
            </div>
          </div>

          <div style={styles.row}>
            <a href="#" style={styles.link}>Forgot password?</a>
          </div>

          <button type="submit" style={styles.button}>Sign In</button>
        </form>

        <div style={styles.footer}>
          Don't have an account? <a href="/signup" style={styles.link}>Sign up</a>
        </div>
      </div>
    </div>
  );
}

const styles = {
  page: {
    width: "100%", minHeight: "100vh", display: "flex", alignItems: "center",
    justifyContent: "center", position: "relative", overflow: "hidden",
    background: "linear-gradient(135deg, #000000, #000000)",
    fontFamily: "Helvetica, Arial, system-ui, sans-serif",
  },
  blobTop: {
    position: "absolute", top: -120, left: -100, width: 420, height: 420, borderRadius: "50%",
    background: "radial-gradient(circle at 30% 30%, oklch(0.55 0.1 250 / 0.35), transparent 70%)",
    animation: "float1 14s ease-in-out infinite",
  },
  blobBottom: {
    position: "absolute", bottom: -140, right: -120, width: 520, height: 520, borderRadius: "50%",
    background: "radial-gradient(circle at 60% 60%, oklch(0.4 0.09 280 / 0.35), transparent 70%)",
    animation: "float2 16s ease-in-out infinite",
  },
  sheen: {
    position: "absolute", inset: 0,
    background: "radial-gradient(circle at 50% 0%, oklch(1 0 0 / 0.06), transparent 60%)",
  },
  card: {
    position: "relative", width: 420, background: "oklch(0.99 0.002 250)", borderRadius: 16,
    boxShadow: "0 30px 60px -15px oklch(0.1 0.02 260 / 0.5), 0 0 0 1px oklch(1 0 0 / 0.08)",
    padding: "44px 40px 36px", display: "flex", flexDirection: "column", alignItems: "center",
  },
  logo: {
    width: 52, height: 52, borderRadius: 12,
    background: "linear-gradient(135deg, oklch(0.5 0.1 258), oklch(0.38 0.09 268))",
    display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 20,
    boxShadow: "0 8px 16px -6px oklch(0.4 0.1 260 / 0.5)",
  },
  logoMark: { width: 22, height: 22, border: "2.5px solid white", borderRadius: 5, position: "relative" },
  logoBar: { position: "absolute", top: 5, left: 2, right: 2, height: 2, background: "white", borderRadius: 1 },
  title: { fontSize: 22, fontWeight: 700, color: "oklch(0.22 0.02 260)", letterSpacing: "-0.01em" },
  subtitle: { fontSize: 15, color: "oklch(0.45 0.02 260)", marginTop: 6, textAlign: "center", lineHeight: 1.4 },
  label: { display: "block", fontSize: 13, fontWeight: 600, color: "oklch(0.3 0.02 260)", marginBottom: 7 },
  input: {
    width: "100%", boxSizing: "border-box", padding: "12px 14px", borderRadius: 8,
    border: "1.5px solid oklch(0.88 0.01 260)", fontSize: 14, color: "oklch(0.2 0.02 260)",
    background: "oklch(0.995 0.002 260)", outline: "none",
  },
  eyeIcon: {
    position: "absolute", right: 14, width: 18, height: 18, color: "oklch(0.55 0.02 260)",
    cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
  },
  row: { width: "100%", display: "flex", alignItems: "center", justifyContent: "flex-end", marginTop: 16 },
  link: { fontSize: 13, color: "oklch(0.42 0.1 265)", textDecoration: "none", fontWeight: 600 },
  button: {
    width: "100%", marginTop: 26, padding: "13px 0", borderRadius: 8, border: "none",
    color: "white", fontSize: "14.5px", fontWeight: 700, cursor: "pointer",
    boxShadow: "0 8px 18px -6px oklch(0.4 0.1 260 / 0.55)", letterSpacing: "0.01em",
    backgroundColor: "#000000",
  },
  footer: { marginTop: 22, fontSize: 13, color: "oklch(0.45 0.02 260)" },
};
