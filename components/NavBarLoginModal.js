"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useMediaQuery } from "react-responsive";
import { useAuthContext } from "@/hooks/useAuth";

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
export default function NavBarLoginModal({
  isOpen,
  onClose,
  defaultTab = "login",
  onRequestOpen, // ✅ NEW: lets any component ask parent to open modal
}) {
  const { login, signupAthlete, signupOrganization } = useAuthContext();
  const router = useRouter();

  // Tabs
  const [tab, setTab] = useState(defaultTab);

  // Role selector: "athlete" | "organization" | "staff"
  const [authRole, setAuthRole] = useState("athlete");

  // Staff subtype: "trainer" | "admin"
  const [staffRole, setStaffRole] = useState("trainer");

  // LOGIN state
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);

  // Forgot password state
  const [showForgot, setShowForgot] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotError, setForgotError] = useState("");
  const [forgotOk, setForgotOk] = useState(false);

  // SIGNUP state
  const [signupLoading, setSignupLoading] = useState(false);
  const [signupError, setSignupError] = useState("");
  const [signupSuccess, setSignupSuccess] = useState(null);

  // Athlete signup fields
  const [athleteSignup, setAthleteSignup] = useState({
    name: "",
    email: "",
    password: "",
    token: "",
  });

  // Org signup fields
  const [orgSignup, setOrgSignup] = useState({
    name: "",
    email: "",
    password: "",
    contactName: "",
    phoneNumber: "",
    website: "",
  });

  const emailRef = useRef(null);
  const isMobile = useMediaQuery({ maxWidth: 768 });

  /* ------------------------------------------------------------------ */
  /* ✅ NEW: Global open hook for SmartStack (and anywhere else)          */
  /* ------------------------------------------------------------------ */
  useEffect(() => {
    if (typeof window === "undefined") return;

    const handler = (ev) => {
      const d = ev?.detail || {};

      // Optional email prefill
      if (d?.email) {
        try {
          window.localStorage.setItem("cp_prefill_login_email", String(d.email));
        } catch {}
      }

      // Optional preselects (only if provided)
      if (d?.tab === "login" || d?.tab === "signup") setTab(d.tab);
      if (d?.role === "athlete" || d?.role === "organization" || d?.role === "staff") setAuthRole(d.role);
      if (d?.staffRole === "trainer" || d?.staffRole === "admin") setStaffRole(d.staffRole);

      // Ask parent to open modal (single source of truth)
      if (typeof onRequestOpen === "function") onRequestOpen(d);
    };

    window.addEventListener("auth:open", handler);

    // Convenience helper
    window.__openLoginModal = (detail = {}) => {
      handler({ detail });
    };

    return () => {
      window.removeEventListener("auth:open", handler);
      try {
        delete window.__openLoginModal;
      } catch {}
    };
  }, [onRequestOpen]);
  /* ------------------------------------------------------------------ */

  useEffect(() => {
    if (isOpen) {
      setTab(defaultTab);

      setEmail("");
      setPassword("");
      setRememberMe(false);
      setShowPassword(false);
      setLoginError("");
      setLoginLoading(false);

      setShowForgot(false);
      setForgotEmail("");
      setForgotLoading(false);
      setForgotError("");
      setForgotOk(false);

      setSignupLoading(false);
      setSignupError("");
      setSignupSuccess(null);

      setAuthRole("athlete");
      setStaffRole("trainer");

      try {
        if (typeof window !== "undefined") {
          const pre = window.localStorage.getItem("cp_prefill_login_email");
          if (pre) setEmail(String(pre));
        }
      } catch {}
    }
  }, [isOpen, defaultTab]);

  useEffect(() => {
    if (isOpen && tab === "login" && !showForgot && emailRef.current) {
      emailRef.current.focus();
    }
  }, [isOpen, tab, showForgot]);

  useEffect(() => {
    if (!isOpen) return;
    if (loginError) setLoginError("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [email, password, authRole, staffRole]);

  /**
   * ✅ iOS-safe body scroll lock
   */
  useEffect(() => {
    if (!isOpen) return;

    const body = document.body;
    const html = document.documentElement;

    const scrollY = window.scrollY || window.pageYOffset || 0;

    const prev = {
      bodyOverflow: body.style.overflow,
      bodyPosition: body.style.position,
      bodyTop: body.style.top,
      bodyWidth: body.style.width,
      htmlOverflow: html.style.overflow,
    };

    body.style.overflow = "hidden";
    html.style.overflow = "hidden";
    body.style.position = "fixed";
    body.style.top = `-${scrollY}px`;
    body.style.width = "100%";

    return () => {
      body.style.overflow = prev.bodyOverflow || "";
      body.style.position = prev.bodyPosition || "";
      body.style.top = prev.bodyTop || "";
      body.style.width = prev.bodyWidth || "";
      html.style.overflow = prev.htmlOverflow || "";

      window.scrollTo(0, scrollY);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const onKeyDown = (e) => {
      if (e.key === "Escape") closeAndReset();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const closeAndReset = () => {
    setEmail("");
    setPassword("");
    setRememberMe(false);
    setShowPassword(false);
    setLoginError("");
    setLoginLoading(false);

    setShowForgot(false);
    setForgotEmail("");
    setForgotLoading(false);
    setForgotError("");
    setForgotOk(false);

    setSignupError("");
    setSignupSuccess(null);
    setSignupLoading(false);

    setAuthRole("athlete");
    setStaffRole("trainer");

    try {
      if (typeof window !== "undefined") {
        window.localStorage.removeItem("cp_prefill_login_email");
      }
    } catch {}

    onClose?.();
  };

  const inputBase =
    "w-full p-3 border border-gray-300 rounded-xl bg-white text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-300";

  const rolePill = "px-3 py-2 rounded-xl border text-sm font-semibold transition";
  const disableRoleSwitch = loginLoading || signupLoading || forgotLoading;

  const isOrgSideLogin = authRole === "organization" || authRole === "staff";

  const unwrapUser = (loginResult) => {
    // ✅ supports either: { user: {...} } OR direct user object
    return loginResult?.user ?? loginResult;
  };

  const getNormalizedRole = (userObj) => {
    const raw = String(userObj?.role || userObj?.Role || "").trim().toLowerCase();
    if (!raw) return "";
    if (raw === "organization") return "organization";
    if (raw === "trainer") return "trainer";
    if (raw === "admin") return "admin";
    if (raw === "athlete") return "athlete";
    if (raw.includes("org")) return "organization";
    if (raw.includes("train")) return "trainer";
    if (raw.includes("admin")) return "admin";
    if (raw.includes("ath")) return "athlete";
    return raw;
  };

  const mapLoginError = (err) => {
    const rawMsg = String(err?.message || err?.error || "");
    const msg = rawMsg.toLowerCase();

    if (msg.includes("multiple organizations")) {
      return "This email belongs to multiple organizations. Please contact your admin to confirm which org you should use.";
    }

    if (msg.includes("not authorized") || msg.includes("not authorised")) {
      return "Not authorized for that role. Double-check you selected the correct role (Trainer/Admin/Organization).";
    }

    if (msg.includes("only organization/admin") || msg.includes("only organization") || msg.includes("only admin")) {
      return "Your account doesn’t have permission for that action. Try Staff → Trainer/Admin if you are a staff member.";
    }

    if (msg.includes("invalid credentials")) {
      return "Invalid email or password.";
    }

    if (msg.includes("user not found")) {
      return "User not found.";
    }

    if (msg.includes("passwordhash") || msg.includes("isn’t ready") || msg.includes("isn't ready")) {
      return "This staff account isn’t ready yet. Complete the invite setup link first (set password).";
    }

    if (msg.includes("failed to lookup user") || msg.includes("lookupuser") || msg.includes("lookup user")) {
      return "Login failed.";
    }

    return "Login failed. Check email/password.";
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError("");
    setLoginLoading(true);

    const cleanEmail = String(email || "").trim().toLowerCase();

    if (!cleanEmail.includes("@")) {
      setLoginError("Please enter a valid email.");
      setLoginLoading(false);
      return;
    }
    if (String(password || "").length < 6) {
      setLoginError("Password must be at least 6 characters.");
      setLoginLoading(false);
      return;
    }

    try {
      // ✅ staff -> trainer/admin (underlying role)
      const roleForLogin = authRole === "staff" ? staffRole : authRole;

      const loginResult = await login(cleanEmail, password, roleForLogin);
      const userObj = unwrapUser(loginResult);

      // Remember me (store ONLY the user object)
      if (rememberMe && typeof window !== "undefined") {
        localStorage.setItem("user", JSON.stringify(userObj));
      }

      closeAndReset();

      const r = getNormalizedRole(userObj);
      const isOrgSide = ["organization", "trainer", "admin"].includes(r);

      if (isOrgSide) router.push("/org/dashboard");
      else router.push("/dashboard");
    } catch (err) {
      console.error("Login error:", err);
      setLoginError(mapLoginError(err));
    } finally {
      setLoginLoading(false);
    }
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    if (forgotLoading) return;

    setForgotError("");
    setForgotOk(false);

    const clean = String(forgotEmail || "").trim().toLowerCase();
    if (!clean || !clean.includes("@")) {
      setForgotError("Please enter a valid email.");
      return;
    }

    setForgotLoading(true);
    try {
      await fetch("/api/auth/forgotPassword", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: clean,
          // if staff, send the underlying staff role; otherwise pass authRole
          role: authRole === "staff" ? staffRole : authRole,
          source: "navbar_login_modal",
        }),
      });

      setForgotOk(true);
      setForgotEmail("");
    } catch (err) {
      console.error("Forgot password error:", err);
      setForgotError("Unable to submit request. Please try again.");
    } finally {
      setForgotLoading(false);
    }
  };

  const handleSignup = async (e) => {
    e.preventDefault();
    setSignupError("");
    setSignupLoading(true);

    try {
      if (authRole === "staff") {
        throw new Error("Staff accounts are invite-only. Please use Log In.");
      }

      if (authRole === "athlete") {
        if (!athleteSignup.name || !athleteSignup.email || !athleteSignup.password) {
          throw new Error("Please provide name, email, and password.");
        }
        if (!athleteSignup.email.includes("@")) throw new Error("Please enter a valid email.");
        if (athleteSignup.password.length < 6) throw new Error("Password must be at least 6 characters.");

        const payload = {
          token: athleteSignup.token,
          name: athleteSignup.name,
          email: athleteSignup.email,
          password: athleteSignup.password,
        };

        const data = await signupAthlete(payload);
        setSignupSuccess(data);

        closeAndReset();
        router.push("/dashboard");
        return;
      }

      // Organization signup
      if (!orgSignup.name || !orgSignup.email || !orgSignup.password) {
        throw new Error("Please provide organization name, email, and password.");
      }
      if (!orgSignup.email.includes("@")) throw new Error("Please enter a valid email.");
      if (orgSignup.password.length < 6) throw new Error("Password must be at least 6 characters.");

      const payload = {
        name: orgSignup.name,
        email: orgSignup.email,
        password: orgSignup.password,
        contactName: orgSignup.contactName,
        phoneNumber: orgSignup.phoneNumber,
        website: orgSignup.website,
      };

      const data = await signupOrganization(payload);
      setSignupSuccess(data);

      closeAndReset();
      router.push("/org/dashboard");
    } catch (err) {
      console.error("Signup error:", err);
      setSignupError(err?.message || "Signup failed.");
    } finally {
      setSignupLoading(false);
    }
  };

  const mobileSheetClass =
    "w-full max-w-none rounded-t-3xl rounded-b-none mt-auto mb-0 " +
    "max-h-[85svh] overflow-y-auto overscroll-contain touch-pan-y " +
    "pb-[env(safe-area-inset-bottom)]";

  const desktopModalClass = "w-full max-w-sm rounded-2xl max-h-[90vh] overflow-y-auto";

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className={classNames(
            "fixed inset-0 z-50 bg-black/40 px-4 sm:px-6",
            isMobile ? "flex items-end justify-center" : "flex items-center justify-center"
          )}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          role="dialog"
          aria-modal="true"
        >
          <motion.div
            className={classNames(
              "bg-white shadow-lg relative",
              isMobile ? mobileSheetClass : desktopModalClass,
              isMobile ? "p-5" : "p-6"
            )}
            initial={isMobile ? { y: "100%" } : { scale: 0.92, opacity: 0, y: -20 }}
            animate={isMobile ? { y: 0 } : { scale: 1, opacity: 1, y: 0 }}
            exit={isMobile ? { y: "100%" } : { scale: 0.92, opacity: 0, y: -20 }}
            transition={{ type: "spring", stiffness: 420, damping: 36 }}
            onClick={(e) => e.stopPropagation()}
          >
            {isMobile ? (
              <div className="flex justify-center pb-2">
                <div className="h-1.5 w-12 rounded-full bg-gray-200" />
              </div>
            ) : null}

            <button
              className={classNames(
                "absolute text-gray-500 hover:text-gray-700",
                isMobile ? "top-3 right-4" : "top-3 right-3"
              )}
              onClick={closeAndReset}
              aria-label="Close"
              type="button"
            >
              ✕
            </button>

            {/* Tabs */}
            <div className="flex justify-center space-x-6 mb-3">
              <button
                onClick={() => {
                  setTab("login");
                  setShowForgot(false);
                  setForgotOk(false);
                  setForgotError("");
                }}
                className={`pb-2 border-b-2 ${
                  tab === "login" ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500"
                }`}
                type="button"
                disabled={signupLoading || forgotLoading}
              >
                Log In
              </button>
              <button
                onClick={() => {
                  setTab("signup");
                  setShowForgot(false);
                  // Staff is login-only
                  if (authRole === "staff") setAuthRole("athlete");
                }}
                className={`pb-2 border-b-2 ${
                  tab === "signup" ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500"
                }`}
                type="button"
                disabled={loginLoading || forgotLoading}
              >
                Sign Up
              </button>
            </div>

            {/* Role selector */}
            <div className="flex justify-center gap-2 mb-4">
              <button
                type="button"
                disabled={disableRoleSwitch}
                onClick={() => setAuthRole("athlete")}
                className={`${rolePill} ${
                  authRole === "athlete"
                    ? "bg-[#46769B] text-white border-[#46769B]"
                    : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50"
                } ${disableRoleSwitch ? "opacity-60 cursor-not-allowed" : ""}`}
              >
                Athlete
              </button>

              <button
                type="button"
                disabled={disableRoleSwitch}
                onClick={() => setAuthRole("organization")}
                className={`${rolePill} ${
                  authRole === "organization"
                    ? "bg-[#46769B] text-white border-[#46769B]"
                    : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50"
                } ${disableRoleSwitch ? "opacity-60 cursor-not-allowed" : ""}`}
              >
                Organization
              </button>

              <button
                type="button"
                disabled={disableRoleSwitch || tab === "signup"}
                onClick={() => setAuthRole("staff")}
                className={`${rolePill} ${
                  authRole === "staff"
                    ? "bg-[#46769B] text-white border-[#46769B]"
                    : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50"
                } ${(disableRoleSwitch || tab === "signup") ? "opacity-60 cursor-not-allowed" : ""}`}
                title={tab === "signup" ? "Staff accounts are invite-only (login only)." : ""}
              >
                Staff
              </button>
            </div>

            {tab === "login" && authRole === "staff" && !showForgot && (
              <div className="mb-3 space-y-2">
                <label className="block text-xs font-semibold text-gray-700">Staff role</label>
                <select
                  value={staffRole}
                  onChange={(e) => setStaffRole(e.target.value)}
                  className={inputBase}
                  disabled={loginLoading}
                >
                  <option value="trainer">Trainer</option>
                </select>

                <div className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-[11px] text-gray-600">
                  Staff accounts are <b>invite-only</b>. Ask your Organization or Head Trainer to invite you.
                </div>
              </div>
            )}

            {tab === "login" && isOrgSideLogin && authRole !== "staff" && !showForgot && (
              <div className="mb-3 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-[11px] text-gray-600">
                Organization login is for the <b>Organization Owner</b>.
              </div>
            )}

            {/* LOGIN */}
            {tab === "login" && !showForgot && (
              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="block mb-1 font-medium text-gray-800">Email</label>
                  <input
                    ref={emailRef}
                    type="email"
                    placeholder={isOrgSideLogin ? "work@example.com" : "you@example.com"}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className={inputBase}
                    required
                    autoComplete="email"
                    disabled={loginLoading}
                  />
                </div>

                <div>
                  <label className="block mb-1 font-medium text-gray-800">Password</label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      placeholder="Enter your password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className={`${inputBase} pr-10`}
                      required
                      autoComplete="current-password"
                      disabled={loginLoading}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute inset-y-0 right-3 text-sm text-gray-500 hover:text-gray-700"
                      disabled={loginLoading}
                    >
                      {showPassword ? "Hide" : "Show"}
                    </button>
                  </div>
                </div>

                {loginError && <p className="text-red-500 text-sm">{loginError}</p>}

                <div className="flex items-center justify-between">
                  <label className="flex items-center space-x-2 text-gray-700">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="rounded"
                      disabled={loginLoading}
                    />
                    <span className="text-sm">Remember me</span>
                  </label>

                  <button
                    type="button"
                    onClick={() => {
                      setShowForgot(true);
                      setForgotOk(false);
                      setForgotError("");
                      setForgotEmail(email || "");
                    }}
                    className="text-sm text-[#46769B] font-semibold hover:underline"
                    disabled={loginLoading}
                  >
                    Forgot password?
                  </button>
                </div>

                <button
                  type="submit"
                  disabled={loginLoading}
                  style={{ backgroundColor: "#46769B" }}
                  className={`w-full py-3 rounded-2xl text-white font-medium ${
                    loginLoading ? "opacity-70 cursor-not-allowed" : ""
                  }`}
                >
                  {loginLoading ? "Logging in..." : "Log In"}
                </button>

                <p className="text-center text-[11px] text-gray-500">
                  Tip: press <b>ESC</b> to close.
                </p>
              </form>
            )}

            {/* FORGOT PASSWORD */}
            {tab === "login" && showForgot && (
              <form onSubmit={handleForgotPassword} className="space-y-4">
                <div className="text-center">
                  <h3 className="text-lg font-bold text-gray-900">Reset your password</h3>
                  <p className="mt-1 text-sm text-gray-600">Enter your email and we’ll send you reset instructions.</p>
                  <p className="mt-1 text-[11px] text-gray-500">(If your account exists, you’ll receive an email.)</p>
                </div>

                <div>
                  <label className="block mb-1 font-medium text-gray-800">Email</label>
                  <input
                    type="email"
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    className={inputBase}
                    placeholder={isOrgSideLogin ? "work@example.com" : "you@example.com"}
                    required
                    autoComplete="email"
                    disabled={forgotLoading}
                  />
                </div>

                {forgotError && <p className="text-red-500 text-sm">{forgotError}</p>}

                {forgotOk && <p className="text-emerald-600 text-sm">If your account exists, we’ve sent reset instructions.</p>}

                <button
                  type="submit"
                  disabled={forgotLoading}
                  style={{ backgroundColor: "#46769B" }}
                  className={`w-full py-3 rounded-2xl text-white font-medium ${
                    forgotLoading ? "opacity-70 cursor-not-allowed" : ""
                  }`}
                >
                  {forgotLoading ? "Sending..." : "Send reset email"}
                </button>

                <button
                  type="button"
                  onClick={() => setShowForgot(false)}
                  className="w-full py-3 rounded-2xl border border-gray-200 text-gray-900 font-semibold hover:bg-gray-50"
                  disabled={forgotLoading}
                >
                  Back to login
                </button>
              </form>
            )}

            {/* SIGNUP */}
            {tab === "signup" && !signupSuccess && (
              <form onSubmit={handleSignup} className="space-y-4">
                {authRole === "athlete" ? (
                  <>
                    <input
                      type="text"
                      name="name"
                      placeholder="Full Name"
                      value={athleteSignup.name}
                      onChange={(e) =>
                        setAthleteSignup((prev) => ({
                          ...prev,
                          [e.target.name]: e.target.value,
                        }))
                      }
                      className={inputBase}
                      required
                      autoComplete="name"
                      disabled={signupLoading}
                    />
                    <input
                      type="email"
                      name="email"
                      placeholder="Email"
                      value={athleteSignup.email}
                      onChange={(e) =>
                        setAthleteSignup((prev) => ({
                          ...prev,
                          [e.target.name]: e.target.value,
                        }))
                      }
                      className={inputBase}
                      required
                      autoComplete="email"
                      disabled={signupLoading}
                    />
                    <input
                      type="password"
                      name="password"
                      placeholder="Password"
                      value={athleteSignup.password}
                      onChange={(e) =>
                        setAthleteSignup((prev) => ({
                          ...prev,
                          [e.target.name]: e.target.value,
                        }))
                      }
                      className={inputBase}
                      required
                      autoComplete="new-password"
                      disabled={signupLoading}
                    />
                    <input
                      type="text"
                      name="token"
                      placeholder="Organization Token (optional)"
                      value={athleteSignup.token}
                      onChange={(e) =>
                        setAthleteSignup((prev) => ({
                          ...prev,
                          [e.target.name]: e.target.value,
                        }))
                      }
                      className={inputBase}
                      disabled={signupLoading}
                    />
                    <p className="text-[11px] text-gray-500">If your organization provided a token, paste it here.</p>
                  </>
                ) : (
                  <>
                    <input
                      type="text"
                      name="name"
                      placeholder="Organization Name"
                      value={orgSignup.name}
                      onChange={(e) =>
                        setOrgSignup((prev) => ({
                          ...prev,
                          [e.target.name]: e.target.value,
                        }))
                      }
                      className={inputBase}
                      required
                      disabled={signupLoading}
                    />
                    <input
                      type="email"
                      name="email"
                      placeholder="Organization Email"
                      value={orgSignup.email}
                      onChange={(e) =>
                        setOrgSignup((prev) => ({
                          ...prev,
                          [e.target.name]: e.target.value,
                        }))
                      }
                      className={inputBase}
                      required
                      autoComplete="email"
                      disabled={signupLoading}
                    />
                    <input
                      type="password"
                      name="password"
                      placeholder="Password"
                      value={orgSignup.password}
                      onChange={(e) =>
                        setOrgSignup((prev) => ({
                          ...prev,
                          [e.target.name]: e.target.value,
                        }))
                      }
                      className={inputBase}
                      required
                      autoComplete="new-password"
                      disabled={signupLoading}
                    />
                    <input
                      type="text"
                      name="contactName"
                      placeholder="Contact Name (optional)"
                      value={orgSignup.contactName}
                      onChange={(e) =>
                        setOrgSignup((prev) => ({
                          ...prev,
                          [e.target.name]: e.target.value,
                        }))
                      }
                      className={inputBase}
                      disabled={signupLoading}
                    />
                    <input
                      type="text"
                      name="phoneNumber"
                      placeholder="Phone Number (optional)"
                      value={orgSignup.phoneNumber}
                      onChange={(e) =>
                        setOrgSignup((prev) => ({
                          ...prev,
                          [e.target.name]: e.target.value,
                        }))
                      }
                      className={inputBase}
                      disabled={signupLoading}
                    />
                    <input
                      type="text"
                      name="website"
                      placeholder="Website (optional)"
                      value={orgSignup.website}
                      onChange={(e) =>
                        setOrgSignup((prev) => ({
                          ...prev,
                          [e.target.name]: e.target.value,
                        }))
                      }
                      className={inputBase}
                      disabled={signupLoading}
                    />
                    <p className="text-[11px] text-gray-500">We’ll generate a secure token for your organization automatically.</p>
                  </>
                )}

                {signupError && <p className="text-red-500 text-sm">{signupError}</p>}

                <button
                  type="submit"
                  disabled={signupLoading}
                  style={{ backgroundColor: "#46769B" }}
                  className={`w-full py-3 rounded-2xl text-white font-medium ${
                    signupLoading ? "opacity-70 cursor-not-allowed" : ""
                  }`}
                >
                  {signupLoading ? "Creating..." : "Create Account"}
                </button>

                <p className="text-center text-[11px] text-gray-500">
                  Tip: press <b>ESC</b> to close.
                </p>
              </form>
            )}

            {tab === "signup" && signupSuccess && (
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="p-4 text-center bg-green-50 rounded-xl">
                <h2 className="text-lg font-bold text-green-600">Success!</h2>
                <p className="text-gray-700 mt-1">Account created successfully.</p>
              </motion.div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
