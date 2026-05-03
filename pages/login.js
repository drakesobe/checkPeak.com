"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuthContext } from "@/hooks/useAuth";

/* -------------------------------------------------------------------------- */
/* Design tokens                                                               */
/* -------------------------------------------------------------------------- */

const BRAND     = "#5B9EC9";
const FONT_BODY = "'Barlow', sans-serif";
const FONT_COND = "'Barlow Condensed', sans-serif";

const INPUT_STYLE = {
  width:        "100%",
  padding:      "11px 14px",
  border:       "1px solid rgba(255,255,255,0.1)",
  borderRadius: "10px",
  background:   "rgba(255,255,255,0.06)",
  color:        "#fff",
  fontSize:     "14px",
  fontFamily:   FONT_BODY,
  outline:      "none",
  transition:   "border-color 0.15s, box-shadow 0.15s, background 0.15s",
};

const INPUT_FOCUS = {
  onFocus: (e) => {
    e.currentTarget.style.borderColor = BRAND;
    e.currentTarget.style.boxShadow   = "0 0 0 3px rgba(91,158,201,0.2)";
    e.currentTarget.style.background  = "rgba(91,158,201,0.08)";
  },
  onBlur: (e) => {
    e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)";
    e.currentTarget.style.boxShadow   = "none";
    e.currentTarget.style.background  = "rgba(255,255,255,0.06)";
  },
};

/* -------------------------------------------------------------------------- */
/* Sub-components — module-level so they never remount on rerender            */
/* -------------------------------------------------------------------------- */

function Field({ label, children }) {
  return (
    <div>
      <label
        className="block mb-1.5 text-[10px] font-bold uppercase"
        style={{ color: "rgba(255,255,255,0.4)", fontFamily: FONT_COND, letterSpacing: "0.1em" }}
      >
        {label}
      </label>
      {children}
    </div>
  );
}

function RolePill({ label, active, disabled: dis, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={dis}
      className="flex-1 py-2 rounded-lg text-xs font-bold transition-all"
      style={{
        fontFamily:    FONT_COND,
        letterSpacing: "0.05em",
        background:    active ? BRAND : "rgba(255,255,255,0.05)",
        border:        active ? `1px solid ${BRAND}` : "1px solid rgba(255,255,255,0.1)",
        color:         active ? "#fff" : "rgba(255,255,255,0.5)",
        cursor:        dis ? "not-allowed" : "pointer",
        opacity:       dis ? 0.5 : 1,
        boxShadow:     active ? "0 2px 10px rgba(91,158,201,0.35)" : "none",
      }}
    >
      {label}
    </button>
  );
}

/* -------------------------------------------------------------------------- */
/* Page                                                                        */
/* -------------------------------------------------------------------------- */

export default function LoginPage() {
  const router = useRouter();
  const { user, login } = useAuthContext();

  const [authRole,     setAuthRole]     = useState("athlete");
  const [staffRole,    setStaffRole]    = useState("trainer");
  const [email,        setEmail]        = useState("");
  const [password,     setPassword]     = useState("");
  const [rememberMe,   setRememberMe]   = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error,        setError]        = useState("");
  const [loading,      setLoading]      = useState(false);

  const [forgotOpen,    setForgotOpen]    = useState(false);
  const [forgotEmail,   setForgotEmail]   = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotMsg,     setForgotMsg]     = useState("");

  const isOrg = authRole === "organization";

  const userRole = useMemo(() => {
    const raw = String(user?.role || user?.Role || "").trim().toLowerCase();
    if (!raw) return "";
    if (raw === "organization" || raw.includes("org"))   return "organization";
    if (raw === "admin"        || raw.includes("admin")) return "admin";
    if (raw === "trainer"      || raw.includes("train")) return "trainer";
    if (raw === "athlete"      || raw.includes("ath"))   return "athlete";
    return raw;
  }, [user]);

  const isOrgSideRole = userRole === "organization" || userRole === "admin" || userRole === "trainer";

  useEffect(() => {
    try {
      const v = typeof window !== "undefined"
        ? window.localStorage.getItem("cp_prefill_login_email")
        : "";
      if (v && !email) setEmail(String(v));
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!user) return;
    if (isOrgSideRole) router.push("/org/workouts-calendar");
    else               router.push("/dashboard");
  }, [user, isOrgSideRole, router]);

  const mapLoginError = (err) => {
    const rawMsg = String(err?.message || err?.error || "");
    const msg    = rawMsg.toLowerCase();
    const status = err?.status || err?.statusCode || err?.response?.status || err?.data?.statusCode || err?.data?.status;
    if (status >= 500 || msg.includes("failed to lookup user") || msg.includes("lookup user")) return "Login failed. Please try again.";
    if (status === 401 || msg.includes("invalid credentials")) return "Invalid email or password.";
    if (status === 404 || msg.includes("user not found"))      return "User not found.";
    return "Login failed. Check email/password.";
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError(""); setLoading(true);
    const cleanEmail = String(email || "").trim();
    if (!cleanEmail.includes("@")) { setError("Please enter a valid email."); setLoading(false); return; }
    if (String(password || "").length < 6) { setError("Password must be at least 6 characters."); setLoading(false); return; }
    try {
      const userData = await login(cleanEmail, password, authRole === "staff" ? staffRole : authRole);
      if (rememberMe && typeof window !== "undefined") window.localStorage.setItem("user", JSON.stringify(userData));
      try { if (typeof window !== "undefined") window.localStorage.removeItem("cp_prefill_login_email"); } catch {}
      const roleLabel = String(userData?.role || userData?.Role || "").toLowerCase();
      const orgSide = roleLabel.includes("org") || roleLabel.includes("admin") || roleLabel.includes("trainer");
      if (orgSide) router.push("/org/workouts-calendar");
      else         router.push("/dashboard");
    } catch (err) {
      console.error(err);
      setError(mapLoginError(err));
    } finally { setLoading(false); }
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    setForgotMsg(""); setForgotLoading(true);
    const cleanEmail = String(forgotEmail || "").trim().toLowerCase();
    try {
      const res  = await fetch("/api/auth/forgotPassword", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email: cleanEmail, role: authRole === "staff" ? staffRole : authRole }),
      });
      const data = await res.json().catch(() => ({}));
      setForgotMsg(data?.message || "If your account exists, we've sent reset instructions.");
    } catch (err) {
      console.error(err);
      setForgotMsg("If your account exists, we've sent reset instructions.");
    } finally { setForgotLoading(false); }
  };

  /* ── Render ─────────────────────────────────────────────────────────── */
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4 py-12"
      style={{ background: "#0A0C10", fontFamily: FONT_BODY }}
    >
      {/* Ambient glow behind the card */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0"
        style={{
          background: "radial-gradient(ellipse 60% 50% at 50% 20%, rgba(91,158,201,0.08) 0%, transparent 70%)",
        }}
      />

      <div className="relative w-full max-w-sm">

        {/* ── Brand header ── */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 mb-5 group">
            <span
              className="w-2 h-2 rounded-full shrink-0 transition-all group-hover:scale-125"
              style={{ background: BRAND, boxShadow: "0 0 8px rgba(91,158,201,0.6)" }}
              aria-hidden="true"
            />
            <span
              className="text-xs font-black tracking-widest text-white transition-colors group-hover:text-[#5B9EC9]"
              style={{ fontFamily: FONT_COND, letterSpacing: "0.12em" }}
            >
              CHECKPEAK
            </span>
          </Link>

          <h1
            className="text-3xl font-black text-white leading-tight"
            style={{ fontFamily: FONT_COND, letterSpacing: "0.01em" }}
          >
            {forgotOpen ? "Reset password" : "Welcome back"}
          </h1>
          <p className="mt-1.5 text-sm" style={{ color: "rgba(255,255,255,0.45)" }}>
            {forgotOpen
              ? "We'll email you reset instructions."
              : "Sign in to your CheckPeak account."}
          </p>
        </div>

        {/* ── Card ── */}
        <div
          className="rounded-2xl p-6 space-y-5"
          style={{
            background:  "rgba(255,255,255,0.04)",
            border:      "1px solid rgba(255,255,255,0.08)",
            boxShadow:   "0 24px 60px rgba(0,0,0,0.4)",
          }}
        >

          {/* Role selector — hidden when forgot password is open */}
          {!forgotOpen && (
            <div>
              <p
                className="text-[10px] font-bold uppercase mb-2"
                style={{ color: "rgba(255,255,255,0.3)", fontFamily: FONT_COND, letterSpacing: "0.1em" }}
              >
                I am a
              </p>
              <div className="flex gap-2">
                <RolePill
                  label="Athlete"
                  active={authRole === "athlete"}
                  disabled={loading || forgotLoading}
                  onClick={() => setAuthRole("athlete")}
                />
                <RolePill
                  label="Organization"
                  active={authRole === "organization"}
                  disabled={loading || forgotLoading}
                  onClick={() => setAuthRole("organization")}
                />
                <RolePill
                  label="Staff"
                  active={authRole === "staff"}
                  disabled={loading || forgotLoading}
                  onClick={() => setAuthRole("staff")}
                />
              </div>

              {/* Contextual notices */}
              {authRole === "staff" && (
                <div
                  className="mt-2 rounded-xl px-3 py-2.5 text-xs leading-relaxed"
                  style={{ background: "rgba(91,158,201,0.07)", border: "1px solid rgba(91,158,201,0.18)", color: "rgba(255,255,255,0.6)" }}
                >
                  Staff accounts are <strong className="text-white">invite-only</strong>. Ask your organization or head trainer to send you an invite link.
                </div>
              )}
              {authRole === "organization" && (
                <div
                  className="mt-2 rounded-xl px-3 py-2.5 text-xs leading-relaxed"
                  style={{ background: "rgba(91,158,201,0.07)", border: "1px solid rgba(91,158,201,0.18)", color: "rgba(255,255,255,0.6)" }}
                >
                  Organization login is for the <strong className="text-white">Organization Owner</strong>.
                </div>
              )}
            </div>
          )}

          {/* ── LOGIN FORM ── */}
          {!forgotOpen && (
            <form onSubmit={handleLogin} className="space-y-4">

              <Field label="Email">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={isOrg ? "org@example.com" : "you@example.com"}
                  style={INPUT_STYLE}
                  {...INPUT_FOCUS}
                  required
                  autoComplete="email"
                  disabled={loading}
                />
              </Field>

              <Field label="Password">
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Your password"
                    style={{ ...INPUT_STYLE, paddingRight: "52px" }}
                    {...INPUT_FOCUS}
                    required
                    autoComplete="current-password"
                    disabled={loading}
                    onKeyDown={(e) => { if (e.key === "Enter") handleLogin(e); }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute inset-y-0 right-3 text-xs font-semibold transition-colors"
                    style={{ color: BRAND }}
                    onMouseEnter={(e) => { e.currentTarget.style.color = "#fff"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.color = BRAND; }}
                    disabled={loading}
                  >
                    {showPassword ? "Hide" : "Show"}
                  </button>
                </div>
              </Field>

              {/* Error */}
              {error && (
                <div
                  className="rounded-xl px-3 py-2.5 text-xs font-medium"
                  style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)", color: "#f87171" }}
                  role="alert"
                >
                  {error}
                </div>
              )}

              {/* Remember + Forgot */}
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="rounded"
                    style={{ accentColor: BRAND }}
                    disabled={loading}
                  />
                  <span className="text-xs" style={{ color: "rgba(255,255,255,0.5)" }}>Remember me</span>
                </label>

                <button
                  type="button"
                  onClick={() => { setForgotOpen(true); setForgotMsg(""); setForgotEmail(email || ""); }}
                  className="text-xs font-semibold transition-colors"
                  style={{ color: BRAND }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = "#fff"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = BRAND; }}
                  disabled={loading}
                >
                  Forgot password?
                </button>
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded-xl text-sm font-bold text-white transition-all"
                style={{
                  background:    loading ? "rgba(91,158,201,0.5)" : BRAND,
                  fontFamily:    FONT_COND,
                  letterSpacing: "0.06em",
                  cursor:        loading ? "not-allowed" : "pointer",
                  boxShadow:     loading ? "none" : "0 4px 14px rgba(91,158,201,0.35)",
                }}
                onMouseEnter={(e) => { if (!loading) e.currentTarget.style.background = "#4a8ab5"; }}
                onMouseLeave={(e) => { if (!loading) e.currentTarget.style.background = BRAND; }}
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.25" />
                      <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                    </svg>
                    Signing in…
                  </span>
                ) : "Log In"}
              </button>
            </form>
          )}

          {/* ── FORGOT PASSWORD FORM ── */}
          {forgotOpen && (
            <form onSubmit={handleForgotPassword} className="space-y-4">

              <Field label="Email address">
                <input
                  type="email"
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  placeholder={isOrg ? "org@example.com" : "you@example.com"}
                  style={INPUT_STYLE}
                  {...INPUT_FOCUS}
                  required
                  autoComplete="email"
                  disabled={forgotLoading}
                />
              </Field>

              {/* Success/error message */}
              {forgotMsg && (
                <div
                  className="rounded-xl px-3 py-2.5 text-xs leading-relaxed"
                  style={{ background: "rgba(91,158,201,0.08)", border: "1px solid rgba(91,158,201,0.25)", color: "rgba(255,255,255,0.7)" }}
                  role="status"
                >
                  {forgotMsg}
                </div>
              )}

              <button
                type="submit"
                disabled={forgotLoading}
                className="w-full py-3 rounded-xl text-sm font-bold text-white transition-all"
                style={{
                  background:    forgotLoading ? "rgba(91,158,201,0.5)" : BRAND,
                  fontFamily:    FONT_COND,
                  letterSpacing: "0.06em",
                  cursor:        forgotLoading ? "not-allowed" : "pointer",
                  boxShadow:     forgotLoading ? "none" : "0 4px 14px rgba(91,158,201,0.35)",
                }}
                onMouseEnter={(e) => { if (!forgotLoading) e.currentTarget.style.background = "#4a8ab5"; }}
                onMouseLeave={(e) => { if (!forgotLoading) e.currentTarget.style.background = BRAND; }}
              >
                {forgotLoading ? "Sending…" : "Send reset email"}
              </button>

              <button
                type="button"
                onClick={() => { setForgotOpen(false); setForgotMsg(""); }}
                className="w-full py-2.5 rounded-xl text-sm font-semibold transition-all"
                style={{
                  background: "transparent",
                  border:     "1px solid rgba(255,255,255,0.1)",
                  color:      "rgba(255,255,255,0.55)",
                  fontFamily: FONT_BODY,
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.05)"; e.currentTarget.style.color = "#fff"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "rgba(255,255,255,0.55)"; }}
                disabled={forgotLoading}
              >
                ← Back to login
              </button>

              <p
                className="text-[10px] text-center leading-relaxed"
                style={{ color: "rgba(255,255,255,0.25)" }}
              >
                For security, you'll see the same message whether the account exists or not.
              </p>
            </form>
          )}
        </div>

        {/* ── Footer link ── */}
        <p className="mt-6 text-center text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>
          <Link
            href="/"
            className="transition-colors"
            style={{ color: "rgba(255,255,255,0.3)" }}
            onMouseEnter={(e) => { e.currentTarget.style.color = BRAND; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = "rgba(255,255,255,0.3)"; }}
          >
            ← Back to CheckPeak
          </Link>
        </p>
      </div>
    </div>
  );
}