"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useMediaQuery } from "react-responsive";
import { useAuthContext } from "@/hooks/useAuth";
import { trackSignupConversion } from "@/lib/conversions";

function classNames(...xs) {
  return xs.filter(Boolean).join(" ");
}

/**
 * UX notes:
 * - No outside click close
 * - ESC closes
 * - ✅ Strong scroll lock (iOS-safe) while open
 * - ✅ Mobile opens as a true bottom sheet (not floating halfway)
 * - ✅ Modal content scrolls; background does not
 *
 * ✅ New:
 * - Global open trigger: window.dispatchEvent(new CustomEvent("auth:open", { detail: {...} }))
 * - Convenience: window.__openLoginModal({...})
 * - Parent-controlled open via onRequestOpen()
 */
/* -------------------------------------------------------------------------- */
/* Design tokens - module-level so sub-components don't remount on rerender  */
/* -------------------------------------------------------------------------- */

const BRAND      = "#5B9EC9";
const BRAND_DARK = "#0A0C10";
const FONT_BODY  = "'Barlow', sans-serif";
const FONT_COND  = "'Barlow Condensed', sans-serif";

const INPUT_STYLE = {
  width:        "100%",
  padding:      "10px 12px",
  border:       "1px solid rgba(0,0,0,0.12)",
  borderRadius: "10px",
  background:   "#F8F9FA",
  color:        "#0A0C10",
  fontSize:     "14px",
  fontFamily:   FONT_BODY,
  outline:      "none",
  transition:   "border-color 0.15s, box-shadow 0.15s",
};

const INPUT_FOCUS = {
  onFocus: (e) => {
    e.currentTarget.style.borderColor = BRAND;
    e.currentTarget.style.boxShadow   = "0 0 0 3px rgba(91,158,201,0.15)";
    e.currentTarget.style.background  = "#fff";
  },
  onBlur: (e) => {
    e.currentTarget.style.borderColor = "rgba(0,0,0,0.12)";
    e.currentTarget.style.boxShadow   = "none";
    e.currentTarget.style.background  = "#F8F9FA";
  },
};

function Field({ label, children }) {
  return (
    <div>
      {label && (
        <label
          className="block mb-1.5 text-[10px] font-bold uppercase"
          style={{ color: "rgba(0,0,0,0.45)", fontFamily: FONT_COND, letterSpacing: "0.1em" }}
        >
          {label}
        </label>
      )}
      {children}
    </div>
  );
}

function PrimaryBtn({ children, loading, disabled, onClick, type = "submit" }) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      onClick={onClick}
      className="w-full py-3 rounded-xl text-sm font-bold text-white transition-all"
      style={{
        background:    loading || disabled ? "rgba(91,158,201,0.5)" : BRAND,
        cursor:        loading || disabled ? "not-allowed" : "pointer",
        fontFamily:    FONT_COND,
        letterSpacing: "0.06em",
        boxShadow:     loading || disabled ? "none" : "0 4px 14px rgba(91,158,201,0.35)",
      }}
      onMouseEnter={(e) => { if (!loading && !disabled) e.currentTarget.style.background = "#4a8ab5"; }}
      onMouseLeave={(e) => { if (!loading && !disabled) e.currentTarget.style.background = BRAND; }}
    >
      {loading ? (
        <span className="flex items-center justify-center gap-2">
          <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.25" />
            <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
          </svg>
          {children}
        </span>
      ) : children}
    </button>
  );
}

function GhostBtn({ children, onClick, disabled }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="w-full py-2.5 rounded-xl text-sm font-semibold transition-all"
      style={{
        background: "transparent",
        border:     "1px solid rgba(0,0,0,0.12)",
        color:      "rgba(0,0,0,0.6)",
        cursor:     disabled ? "not-allowed" : "pointer",
        fontFamily: FONT_BODY,
      }}
      onMouseEnter={(e) => { if (!disabled) e.currentTarget.style.background = "#F1F5F9"; }}
      onMouseLeave={(e) => { if (!disabled) e.currentTarget.style.background = "transparent"; }}
    >
      {children}
    </button>
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
        letterSpacing: "0.04em",
        background:    active ? BRAND : "rgba(0,0,0,0.04)",
        border:        active ? `1px solid ${BRAND}` : "1px solid rgba(0,0,0,0.08)",
        color:         active ? "#fff" : "rgba(0,0,0,0.5)",
        cursor:        dis ? "not-allowed" : "pointer",
        opacity:       dis ? 0.45 : 1,
        boxShadow:     active ? "0 2px 8px rgba(91,158,201,0.3)" : "none",
      }}
    >
      {label}
    </button>
  );
}

/* -------------------------------------------------------------------------- */
export default function NavBarLoginModal({
  isOpen,
  onClose,
  defaultTab = "login",
  onRequestOpen,
}) {
  const { login, signupAthlete, signupOrganization } = useAuthContext();
  const router = useRouter();

  const [tab, setTab] = useState(defaultTab);
  const [authRole, setAuthRole] = useState("athlete");
  const [staffRole, setStaffRole] = useState("trainer");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);

  const [showForgot, setShowForgot] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotError, setForgotError] = useState("");
  const [forgotOk, setForgotOk] = useState(false);

  const [signupLoading, setSignupLoading] = useState(false);
  const [signupError, setSignupError] = useState("");
  const [signupSuccess, setSignupSuccess] = useState(null);

  const [athleteSignup, setAthleteSignup] = useState({ name: "", email: "", password: "", token: "" });
  const [orgSignup, setOrgSignup] = useState({ name: "", email: "", password: "", contactName: "", phoneNumber: "", website: "" });

  const emailRef = useRef(null);
  const isMobile = useMediaQuery({ maxWidth: 768 });

  /* ── Global open hook ─────────────────────────────────────────────── */
  useEffect(() => {
    if (typeof window === "undefined") return;

    const handler = (ev) => {
      const d = ev?.detail || {};
      if (d?.email) {
        try { window.localStorage.setItem("cp_prefill_login_email", String(d.email)); } catch {}
      }
      if (d?.tab === "login" || d?.tab === "signup") setTab(d.tab);
      if (d?.role === "athlete" || d?.role === "organization" || d?.role === "staff") setAuthRole(d.role);
      if (d?.staffRole === "trainer" || d?.staffRole === "admin") setStaffRole(d.staffRole);
      if (typeof onRequestOpen === "function") onRequestOpen(d);
    };

    window.addEventListener("auth:open", handler);
    window.__openLoginModal = (detail = {}) => handler({ detail });

    return () => {
      window.removeEventListener("auth:open", handler);
      try { delete window.__openLoginModal; } catch {}
    };
  }, [onRequestOpen]);

  useEffect(() => {
    if (isOpen) {
      setTab(defaultTab);
      setEmail(""); setPassword(""); setRememberMe(false); setShowPassword(false);
      setLoginError(""); setLoginLoading(false);
      setShowForgot(false); setForgotEmail(""); setForgotLoading(false);
      setForgotError(""); setForgotOk(false);
      setSignupLoading(false); setSignupError(""); setSignupSuccess(null);
      setAuthRole("athlete"); setStaffRole("trainer");
      try {
        if (typeof window !== "undefined") {
          const pre = window.localStorage.getItem("cp_prefill_login_email");
          if (pre) setEmail(String(pre));
        }
      } catch {}
    }
  }, [isOpen, defaultTab]);

  useEffect(() => {
    if (isOpen && tab === "login" && !showForgot && emailRef.current) emailRef.current.focus();
  }, [isOpen, tab, showForgot]);

  useEffect(() => {
    if (!isOpen) return;
    if (loginError) setLoginError("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [email, password, authRole, staffRole]);

  /* ── iOS-safe body scroll lock ───────────────────────────────────── */
  useEffect(() => {
    if (!isOpen) return;
    const body = document.body;
    const html = document.documentElement;
    const scrollY = window.scrollY || window.pageYOffset || 0;
    const prev = {
      bodyOverflow: body.style.overflow, bodyPosition: body.style.position,
      bodyTop: body.style.top, bodyWidth: body.style.width, htmlOverflow: html.style.overflow,
    };
    body.style.overflow = "hidden"; html.style.overflow = "hidden";
    body.style.position = "fixed"; body.style.top = `-${scrollY}px`; body.style.width = "100%";
    return () => {
      body.style.overflow = prev.bodyOverflow || ""; body.style.position = prev.bodyPosition || "";
      body.style.top = prev.bodyTop || ""; body.style.width = prev.bodyWidth || "";
      html.style.overflow = prev.htmlOverflow || "";
      window.scrollTo(0, scrollY);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e) => { if (e.key === "Escape") closeAndReset(); };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const closeAndReset = () => {
    setEmail(""); setPassword(""); setRememberMe(false); setShowPassword(false);
    setLoginError(""); setLoginLoading(false);
    setShowForgot(false); setForgotEmail(""); setForgotLoading(false);
    setForgotError(""); setForgotOk(false);
    setSignupError(""); setSignupSuccess(null); setSignupLoading(false);
    setAuthRole("athlete"); setStaffRole("trainer");
    try { if (typeof window !== "undefined") window.localStorage.removeItem("cp_prefill_login_email"); } catch {}
    onClose?.();
  };

  const disableRoleSwitch = loginLoading || signupLoading || forgotLoading;
  const isOrgSideLogin = authRole === "organization" || authRole === "staff";

  const unwrapUser = (r) => r?.user ?? r;

  const getNormalizedRole = (u) => {
    const raw = String(u?.role || u?.Role || "").trim().toLowerCase();
    if (!raw) return "";
    if (raw === "organization" || raw.includes("org"))   return "organization";
    if (raw === "trainer"      || raw.includes("train")) return "trainer";
    if (raw === "admin"        || raw.includes("admin")) return "admin";
    if (raw === "athlete"      || raw.includes("ath"))   return "athlete";
    return raw;
  };

  const mapLoginError = (err) => {
    const msg = String(err?.message || err?.error || "").toLowerCase();
    if (msg.includes("multiple organizations"))                      return "This email belongs to multiple organizations. Contact your admin to confirm which org to use.";
    if (msg.includes("not authorized") || msg.includes("not authorised")) return "Not authorized for that role. Double-check you selected the correct role.";
    if (msg.includes("only organization") || msg.includes("only admin")) return "Your account doesn't have permission for that action.";
    if (msg.includes("invalid credentials"))                         return "Invalid email or password.";
    if (msg.includes("user not found"))                              return "User not found.";
    if (msg.includes("passwordhash") || msg.includes("isn't ready")) return "This staff account isn't ready yet. Complete the invite setup link first.";
    if (msg.includes("failed to lookup user") || msg.includes("lookup user")) return "Login failed.";
    return "Login failed. Check email/password.";
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError(""); setLoginLoading(true);
    const cleanEmail = String(email || "").trim().toLowerCase();
    if (!cleanEmail.includes("@")) { setLoginError("Please enter a valid email."); setLoginLoading(false); return; }
    if (String(password || "").length < 6) { setLoginError("Password must be at least 6 characters."); setLoginLoading(false); return; }
    try {
      const roleForLogin = authRole === "staff" ? staffRole : authRole;
      const loginResult  = await login(cleanEmail, password, roleForLogin);
      const userObj      = unwrapUser(loginResult);
      if (rememberMe && typeof window !== "undefined") localStorage.setItem("user", JSON.stringify(userObj));
      closeAndReset();
      const r = getNormalizedRole(userObj);
      if (["organization", "trainer", "admin"].includes(r)) router.push("/org/workouts-calendar");
      else router.push("/dashboard");
    } catch (err) {
      console.error("Login error:", err);
      setLoginError(mapLoginError(err));
    } finally { setLoginLoading(false); }
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    if (forgotLoading) return;
    setForgotError(""); setForgotOk(false);
    const clean = String(forgotEmail || "").trim().toLowerCase();
    if (!clean || !clean.includes("@")) { setForgotError("Please enter a valid email."); return; }
    setForgotLoading(true);
    try {
      await fetch("/api/auth/forgotPassword", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: clean, role: authRole === "staff" ? staffRole : authRole, source: "navbar_login_modal" }),
      });
      setForgotOk(true); setForgotEmail("");
    } catch (err) {
      console.error("Forgot password error:", err);
      setForgotError("Unable to submit request. Please try again.");
    } finally { setForgotLoading(false); }
  };

  const handleSignup = async (e) => {
    e.preventDefault();
    setSignupError(""); setSignupLoading(true);
    try {
      if (authRole === "staff") throw new Error("Staff accounts are invite-only. Please use Log In.");
      if (authRole === "athlete") {
        if (!athleteSignup.name || !athleteSignup.email || !athleteSignup.password) throw new Error("Please provide name, email, and password.");
        if (!athleteSignup.email.includes("@")) throw new Error("Please enter a valid email.");
        if (athleteSignup.password.length < 6) throw new Error("Password must be at least 6 characters.");
        const data = await signupAthlete({ token: athleteSignup.token, name: athleteSignup.name, email: athleteSignup.email, password: athleteSignup.password });
        trackSignupConversion(athleteSignup.email, "athlete");
        setSignupSuccess(data); closeAndReset(); router.push("/dashboard"); return;
      }
      if (!orgSignup.name || !orgSignup.email || !orgSignup.password) throw new Error("Please provide organization name, email, and password.");
      if (!orgSignup.email.includes("@")) throw new Error("Please enter a valid email.");
      if (orgSignup.password.length < 6) throw new Error("Password must be at least 6 characters.");
      const data = await signupOrganization({ name: orgSignup.name, email: orgSignup.email, password: orgSignup.password, contactName: orgSignup.contactName, phoneNumber: orgSignup.phoneNumber, website: orgSignup.website });
      trackSignupConversion(orgSignup.email, "organization");
      setSignupSuccess(data); closeAndReset(); router.push("/org/workouts-calendar");
    } catch (err) {
      console.error("Signup error:", err);
      setSignupError(err?.message || "Signup failed.");
    } finally { setSignupLoading(false); }
  };

  /* ────────────────────────────────────────────────────────────────── */
  /* Render                                                              */
  /* ────────────────────────────────────────────────────────────────── */

  const modalClass = "relative w-full max-w-[400px] rounded-2xl max-h-[90svh] overflow-y-auto";

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center px-4"
          style={{ background: "rgba(10,12,16,0.6)", backdropFilter: "blur(8px)" }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          role="dialog"
          aria-modal="true"
          aria-label="Sign in or create account"
        >
          <motion.div
            className={modalClass}
            style={{
              background:  "#fff",
              boxShadow:   "0 24px 60px rgba(0,0,0,0.25), 0 4px 16px rgba(0,0,0,0.1)",
              fontFamily:  FONT_BODY,
            }}
            initial={{ scale: 0.94, opacity: 0, y: -16 }}
            animate={{ scale: 1,    opacity: 1, y: 0 }}
            exit={{    scale: 0.94, opacity: 0, y: -16 }}
            transition={{ type: "spring", stiffness: 420, damping: 36 }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close button - proper hit area */}
            <button
              type="button"
              onClick={closeAndReset}
              aria-label="Close"
              className="absolute top-3 right-3 w-8 h-8 flex items-center justify-center rounded-full transition-colors"
              style={{ color: "rgba(0,0,0,0.35)" }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(0,0,0,0.06)"; e.currentTarget.style.color = "rgba(0,0,0,0.7)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "rgba(0,0,0,0.35)"; }}
            >
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" aria-hidden="true">
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>

            <div className="px-6 pb-6">

              {/* ── Header ── */}
              <div className="pt-5 pb-5 text-center" style={{ borderBottom: "1px solid rgba(0,0,0,0.07)" }}>
                {/* Logo dot + wordmark */}
                <div className="inline-flex items-center gap-1.5 mb-3">
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ background: BRAND, boxShadow: `0 0 6px rgba(91,158,201,0.5)` }}
                    aria-hidden="true"
                  />
                  <span
                    className="text-xs font-black tracking-widest"
                    style={{ color: BRAND_DARK, fontFamily: FONT_COND, letterSpacing: "0.1em" }}
                  >
                    CHECKPEAK
                  </span>
                </div>

                <h2
                  className="text-2xl font-black leading-tight"
                  style={{ color: BRAND_DARK, fontFamily: FONT_COND, letterSpacing: "0.01em" }}
                >
                  {showForgot ? "Reset password" : tab === "login" ? "Welcome back" : "Create account"}
                </h2>
                <p className="mt-1 text-sm" style={{ color: "rgba(0,0,0,0.45)" }}>
                  {showForgot
                    ? "We'll email you reset instructions."
                    : tab === "login"
                    ? "Sign in to your CheckPeak account."
                    : "Start scanning smarter today."}
                </p>
              </div>

              {/* ── Tab switcher (hidden when forgot password is open) ── */}
              {!showForgot && (
                <div
                  className="flex mt-4 rounded-xl p-1 gap-1"
                  style={{ background: "rgba(0,0,0,0.04)" }}
                >
                  {["login", "signup"].map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => {
                        setTab(t);
                        setShowForgot(false);
                        setForgotOk(false);
                        setForgotError("");
                        if (t === "signup" && authRole === "staff") setAuthRole("athlete");
                      }}
                      disabled={loginLoading || forgotLoading || (t === "login" && signupLoading) || (t === "signup" && loginLoading)}
                      className="flex-1 py-2 rounded-lg text-sm font-bold transition-all"
                      style={{
                        background:  tab === t ? "#fff" : "transparent",
                        color:       tab === t ? BRAND_DARK : "rgba(0,0,0,0.45)",
                        boxShadow:   tab === t ? "0 1px 4px rgba(0,0,0,0.1)" : "none",
                        fontFamily:  FONT_COND,
                        letterSpacing: "0.04em",
                      }}
                    >
                      {t === "login" ? "Log In" : "Sign Up"}
                    </button>
                  ))}
                </div>
              )}

              {/* ── Role selector ── */}
              {!showForgot && (
                <div className="mt-3">
                  <p
                    className="text-[10px] font-bold uppercase tracking-widest mb-2"
                    style={{ color: "rgba(0,0,0,0.3)", fontFamily: FONT_COND }}
                  >
                    I am a
                  </p>
                  <div className="flex gap-1.5">
                    <RolePill
                      label="Athlete"
                      value="athlete"
                      active={authRole === "athlete"}
                      disabled={disableRoleSwitch}
                      onClick={() => setAuthRole("athlete")}
                    />
                    <RolePill
                      label="Organization"
                      value="organization"
                      active={authRole === "organization"}
                      disabled={disableRoleSwitch}
                      onClick={() => setAuthRole("organization")}
                    />
                    {tab === "login" && (
                      <RolePill
                        label="Staff"
                        value="staff"
                        active={authRole === "staff"}
                        disabled={disableRoleSwitch}
                        onClick={() => setAuthRole("staff")}
                      />
                    )}
                  </div>
                </div>
              )}

              {/* ── Staff notice ── */}
              {tab === "login" && authRole === "staff" && !showForgot && (
                <div
                  className="mt-3 rounded-xl px-3 py-2.5 text-xs leading-relaxed"
                  style={{ background: "rgba(91,158,201,0.07)", border: "1px solid rgba(91,158,201,0.18)", color: "rgba(0,0,0,0.6)" }}
                >
                  Staff accounts are <strong>invite-only</strong>. Ask your organization or head trainer to send you an invite link.
                </div>
              )}

              {/* ── Org owner notice ── */}
              {tab === "login" && authRole === "organization" && !showForgot && (
                <div
                  className="mt-3 rounded-xl px-3 py-2.5 text-xs leading-relaxed"
                  style={{ background: "rgba(91,158,201,0.07)", border: "1px solid rgba(91,158,201,0.18)", color: "rgba(0,0,0,0.6)" }}
                >
                  Organization login is for the <strong>Organization Owner</strong>.
                </div>
              )}

              {/* ── Forms ── */}
              <div className="mt-4 space-y-3.5">

                {/* LOGIN */}
                {tab === "login" && !showForgot && (
                  <form onSubmit={handleLogin} className="space-y-3.5">
                    <Field label="Email">
                      <input
                        ref={emailRef}
                        type="email"
                        placeholder={isOrgSideLogin ? "work@example.com" : "you@example.com"}
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        style={INPUT_STYLE}
                        {...INPUT_FOCUS}
                        required
                        autoComplete="email"
                        disabled={loginLoading}
                      />
                    </Field>

                    <Field label="Password">
                      <div className="relative">
                        <input
                          type={showPassword ? "text" : "password"}
                          placeholder="Your password"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          style={{ ...INPUT_STYLE, paddingRight: "52px" }}
                          {...INPUT_FOCUS}
                          required
                          autoComplete="current-password"
                          disabled={loginLoading}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword((v) => !v)}
                          className="absolute inset-y-0 right-3 text-xs font-semibold"
                          style={{ color: BRAND }}
                          disabled={loginLoading}
                        >
                          {showPassword ? "Hide" : "Show"}
                        </button>
                      </div>
                    </Field>

                    {/* Error */}
                    <AnimatePresence>
                      {loginError && (
                        <motion.div
                          initial={{ opacity: 0, y: -4 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0 }}
                          className="rounded-xl px-3 py-2.5 text-xs font-medium"
                          style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", color: "#dc2626" }}
                          role="alert"
                        >
                          {loginError}
                        </motion.div>
                      )}
                    </AnimatePresence>

                    <div className="flex items-center justify-between">
                      <label className="flex items-center gap-2 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={rememberMe}
                          onChange={(e) => setRememberMe(e.target.checked)}
                          className="rounded"
                          style={{ accentColor: BRAND }}
                          disabled={loginLoading}
                        />
                        <span className="text-xs" style={{ color: "rgba(0,0,0,0.55)" }}>Remember me</span>
                      </label>

                      <button
                        type="button"
                        onClick={() => { setShowForgot(true); setForgotOk(false); setForgotError(""); setForgotEmail(email || ""); }}
                        className="text-xs font-semibold transition-colors"
                        style={{ color: BRAND }}
                        onMouseEnter={(e) => { e.currentTarget.style.color = "#4a8ab5"; }}
                        onMouseLeave={(e) => { e.currentTarget.style.color = BRAND; }}
                        disabled={loginLoading}
                      >
                        Forgot password?
                      </button>
                    </div>

                    <PrimaryBtn loading={loginLoading}>
                      {loginLoading ? "Signing in…" : "Log In"}
                    </PrimaryBtn>
                  </form>
                )}

                {/* FORGOT PASSWORD */}
                {tab === "login" && showForgot && (
                  <form onSubmit={handleForgotPassword} className="space-y-3.5">
                    <Field label="Email address">
                      <input
                        type="email"
                        value={forgotEmail}
                        onChange={(e) => setForgotEmail(e.target.value)}
                        style={INPUT_STYLE}
                        {...INPUT_FOCUS}
                        placeholder={isOrgSideLogin ? "work@example.com" : "you@example.com"}
                        required
                        autoComplete="email"
                        disabled={forgotLoading}
                      />
                    </Field>

                    <AnimatePresence>
                      {forgotError && (
                        <motion.div
                          initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                          className="rounded-xl px-3 py-2.5 text-xs font-medium"
                          style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", color: "#dc2626" }}
                          role="alert"
                        >
                          {forgotError}
                        </motion.div>
                      )}
                      {forgotOk && (
                        <motion.div
                          initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                          className="rounded-xl px-3 py-2.5 text-xs font-medium"
                          style={{ background: "rgba(91,158,201,0.08)", border: "1px solid rgba(91,158,201,0.25)", color: "#2d6fa3" }}
                          role="status"
                        >
                          If your account exists, we've sent reset instructions.
                        </motion.div>
                      )}
                    </AnimatePresence>

                    <PrimaryBtn loading={forgotLoading}>
                      {forgotLoading ? "Sending…" : "Send reset email"}
                    </PrimaryBtn>
                    <GhostBtn onClick={() => setShowForgot(false)} disabled={forgotLoading}>
                      ← Back to login
                    </GhostBtn>
                  </form>
                )}

                {/* SIGNUP */}
                {tab === "signup" && !signupSuccess && (
                  <form onSubmit={handleSignup} className="space-y-3.5">
                    {authRole === "athlete" ? (
                      <>
                        <Field label="Full name">
                          <input
                            type="text" name="name" placeholder="Alex Johnson"
                            value={athleteSignup.name}
                            onChange={(e) => setAthleteSignup((p) => ({ ...p, [e.target.name]: e.target.value }))}
                            style={INPUT_STYLE} {...INPUT_FOCUS}
                            required autoComplete="name" disabled={signupLoading}
                          />
                        </Field>
                        <Field label="Email">
                          <input
                            type="email" name="email" placeholder="you@example.com"
                            value={athleteSignup.email}
                            onChange={(e) => setAthleteSignup((p) => ({ ...p, [e.target.name]: e.target.value }))}
                            style={INPUT_STYLE} {...INPUT_FOCUS}
                            required autoComplete="email" disabled={signupLoading}
                          />
                        </Field>
                        <Field label="Password">
                          <input
                            type="password" name="password" placeholder="Min. 6 characters"
                            value={athleteSignup.password}
                            onChange={(e) => setAthleteSignup((p) => ({ ...p, [e.target.name]: e.target.value }))}
                            style={INPUT_STYLE} {...INPUT_FOCUS}
                            required autoComplete="new-password" disabled={signupLoading}
                          />
                        </Field>
                        <Field label="Organization token (optional)">
                          <input
                            type="text" name="token" placeholder="Paste your org token here"
                            value={athleteSignup.token}
                            onChange={(e) => setAthleteSignup((p) => ({ ...p, [e.target.name]: e.target.value }))}
                            style={INPUT_STYLE} {...INPUT_FOCUS}
                            disabled={signupLoading}
                          />
                        </Field>
                      </>
                    ) : (
                      <>
                        <Field label="Organization name">
                          <input
                            type="text" name="name" placeholder="Apex Athletics"
                            value={orgSignup.name}
                            onChange={(e) => setOrgSignup((p) => ({ ...p, [e.target.name]: e.target.value }))}
                            style={INPUT_STYLE} {...INPUT_FOCUS}
                            required disabled={signupLoading}
                          />
                        </Field>
                        <Field label="Email">
                          <input
                            type="email" name="email" placeholder="org@example.com"
                            value={orgSignup.email}
                            onChange={(e) => setOrgSignup((p) => ({ ...p, [e.target.name]: e.target.value }))}
                            style={INPUT_STYLE} {...INPUT_FOCUS}
                            required autoComplete="email" disabled={signupLoading}
                          />
                        </Field>
                        <Field label="Password">
                          <input
                            type="password" name="password" placeholder="Min. 6 characters"
                            value={orgSignup.password}
                            onChange={(e) => setOrgSignup((p) => ({ ...p, [e.target.name]: e.target.value }))}
                            style={INPUT_STYLE} {...INPUT_FOCUS}
                            required autoComplete="new-password" disabled={signupLoading}
                          />
                        </Field>

                        {/* Optional fields in a visual group */}
                        <div
                          className="rounded-xl p-3 space-y-3"
                          style={{ background: "rgba(0,0,0,0.02)", border: "1px solid rgba(0,0,0,0.07)" }}
                        >
                          <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "rgba(0,0,0,0.3)", fontFamily: FONT_COND }}>
                            Optional details
                          </p>
                          <Field label="Contact name">
                            <input
                              type="text" name="contactName" placeholder="Your name"
                              value={orgSignup.contactName}
                              onChange={(e) => setOrgSignup((p) => ({ ...p, [e.target.name]: e.target.value }))}
                              style={INPUT_STYLE} {...INPUT_FOCUS}
                              disabled={signupLoading}
                            />
                          </Field>
                          <Field label="Phone number">
                            <input
                              type="text" name="phoneNumber" placeholder="+1 (555) 000-0000"
                              value={orgSignup.phoneNumber}
                              onChange={(e) => setOrgSignup((p) => ({ ...p, [e.target.name]: e.target.value }))}
                              style={INPUT_STYLE} {...INPUT_FOCUS}
                              disabled={signupLoading}
                            />
                          </Field>
                          <Field label="Website">
                            <input
                              type="text" name="website" placeholder="https://yourdomain.com"
                              value={orgSignup.website}
                              onChange={(e) => setOrgSignup((p) => ({ ...p, [e.target.name]: e.target.value }))}
                              style={INPUT_STYLE} {...INPUT_FOCUS}
                              disabled={signupLoading}
                            />
                          </Field>
                        </div>
                      </>
                    )}

                    <AnimatePresence>
                      {signupError && (
                        <motion.div
                          initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                          className="rounded-xl px-3 py-2.5 text-xs font-medium"
                          style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", color: "#dc2626" }}
                          role="alert"
                        >
                          {signupError}
                        </motion.div>
                      )}
                    </AnimatePresence>

                    <PrimaryBtn loading={signupLoading}>
                      {signupLoading ? "Creating account…" : "Create Account"}
                    </PrimaryBtn>
                  </form>
                )}

                {/* SIGNUP SUCCESS */}
                {tab === "signup" && signupSuccess && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.96 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="py-6 text-center"
                  >
                    <div
                      className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3"
                      style={{ background: "rgba(91,158,201,0.12)", border: "1px solid rgba(91,158,201,0.3)" }}
                    >
                      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke={BRAND} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M20 6 9 17l-5-5" />
                      </svg>
                    </div>
                    <h2
                      className="text-xl font-black"
                      style={{ color: BRAND_DARK, fontFamily: FONT_COND }}
                    >
                      You're in.
                    </h2>
                    <p className="mt-1 text-sm" style={{ color: "rgba(0,0,0,0.5)" }}>
                      Account created successfully.
                    </p>
                  </motion.div>
                )}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}