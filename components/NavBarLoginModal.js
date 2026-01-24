// components/NavBarLoginModal.jsx
"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useMediaQuery } from "react-responsive";
import { useAuthContext } from "@/hooks/useAuth";

/**
 * ✅ Updated for new org-side roles:
 * - Organization (primary org account)
 * - Admin (OrgMembers)
 * - Trainer (OrgMembers)
 *
 * Key changes:
 * 1) Better role routing after login (org-side -> /org/dashboard)
 * 2) Login placeholder text updated: org-side can be org/admin/trainer
 * 3) Keeps your existing athlete/org toggle (trainers login via "Organization")
 *
 * UX changes in this version:
 * - ❌ No close on outside click
 * - ✅ ESC closes
 * - ✅ Body scroll locked while open
 */
export default function NavBarLoginModal({
  isOpen,
  onClose,
  defaultTab = "login",
}) {
  const { login, signupAthlete, signupOrganization } = useAuthContext();
  const router = useRouter();

  // Tabs
  const [tab, setTab] = useState(defaultTab);

  // Role selector: "athlete" | "organization"
  // NOTE: Trainers/Admins also login under "organization"
  const [authRole, setAuthRole] = useState("athlete");

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
  const passwordRef = useRef(null);
  const isMobile = useMediaQuery({ maxWidth: 768 });

  useEffect(() => {
    if (isOpen) {
      setTab(defaultTab);
      setLoginError("");
      setSignupError("");
      setSignupSuccess(null);

      // Forgot password reset
      setShowForgot(false);
      setForgotEmail("");
      setForgotLoading(false);
      setForgotError("");
      setForgotOk(false);

      // default role reset per tab open is fine; keep last selection if you prefer
      setAuthRole("athlete");

      // Optional: prefill email if dispatched by global event
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

  // Clear "sticky" login errors as user types
  useEffect(() => {
    if (!isOpen) return;
    if (loginError) setLoginError("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [email, password, authRole]);

  // ✅ Lock body scroll while modal open
  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev || "";
    };
  }, [isOpen]);

  // ✅ ESC closes modal (since outside click no longer does)
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
    // Clear login fields
    setEmail("");
    setPassword("");
    setRememberMe(false);
    setShowPassword(false);
    setLoginError("");
    setLoginLoading(false);

    // Forgot password reset
    setShowForgot(false);
    setForgotEmail("");
    setForgotLoading(false);
    setForgotError("");
    setForgotOk(false);

    // Clear signup fields
    setSignupError("");
    setSignupSuccess(null);
    setSignupLoading(false);

    // Keep role selection reset (optional)
    setAuthRole("athlete");

    // Clear prefill
    try {
      if (typeof window !== "undefined") {
        window.localStorage.removeItem("cp_prefill_login_email");
      }
    } catch {}

    onClose?.();
  };

  const inputBase =
    "w-full p-3 border border-gray-300 rounded-xl bg-white text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-300";

  const rolePill =
    "px-3 py-2 rounded-xl border text-sm font-semibold transition";

  const isOrgSideLogin = authRole === "organization"; // includes Org, Admin, Trainer accounts

  // ---- Error mapping for better UX + consistent messaging ----
  const mapLoginError = (err) => {
    const rawMsg = String(err?.message || err?.error || "");
    const msg = rawMsg.toLowerCase();

    const status =
      err?.status ||
      err?.statusCode ||
      err?.response?.status ||
      err?.data?.statusCode ||
      err?.data?.status;

    const isLookupUserFailure =
      msg.includes("failed to lookup user") ||
      msg.includes("lookupuser") ||
      msg.includes("lookup user");

    if (status >= 500 || isLookupUserFailure) return "Login failed.";

    if (status === 401 || msg.includes("invalid credentials")) {
      return "Invalid email or password.";
    }

    if (status === 404 || msg.includes("user not found")) {
      return "User not found.";
    }

    // OrgMembers can fail with missing PasswordHash
    if (msg.includes("passwordhash")) {
      return "This account isn’t ready yet. Ask your organization admin to finish setup.";
    }

    return "Login failed. Check email/password.";
  };

  const getNormalizedRole = (userData) => {
    const raw = String(userData?.role || userData?.Role || "")
      .trim()
      .toLowerCase();
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

  // ---------- LOGIN ----------
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
      const userData = await login(cleanEmail, password, authRole);

      // NOTE: Your AuthProvider already stores user in localStorage on login.
      // Keep rememberMe behavior as an override (fine).
      if (rememberMe && typeof window !== "undefined") {
        localStorage.setItem("user", JSON.stringify(userData));
      }

      closeAndReset();

      // ✅ Route by normalized role
      const r = getNormalizedRole(userData);
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

  // ---------- FORGOT PASSWORD ----------
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
          role: authRole, // org-side requests can cover Organization/Admin/Trainer
          source: "navbar_login_modal",
        }),
      });

      // Always show generic success to prevent account enumeration
      setForgotOk(true);
      setForgotEmail("");
    } catch (err) {
      console.error("Forgot password error:", err);
      setForgotError("Unable to submit request. Please try again.");
    } finally {
      setForgotLoading(false);
    }
  };

  // ---------- SIGNUP ----------
  const handleSignup = async (e) => {
    e.preventDefault();
    setSignupError("");
    setSignupLoading(true);

    try {
      if (authRole === "athlete") {
        if (!athleteSignup.name || !athleteSignup.email || !athleteSignup.password) {
          throw new Error("Please provide name, email, and password.");
        }
        if (!athleteSignup.email.includes("@"))
          throw new Error("Please enter a valid email.");
        if (athleteSignup.password.length < 6)
          throw new Error("Password must be at least 6 characters.");

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

      // Org signup
      if (!orgSignup.name || !orgSignup.email || !orgSignup.password) {
        throw new Error("Please provide organization name, email, and password.");
      }
      if (!orgSignup.email.includes("@"))
        throw new Error("Please enter a valid email.");
      if (orgSignup.password.length < 6)
        throw new Error("Password must be at least 6 characters.");

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

  const disableRoleSwitch = loginLoading || signupLoading || forgotLoading;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center px-4 sm:px-6 bg-black/40"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          // ❌ Removed onClick close: no outside-click dismissal
          role="dialog"
          aria-modal="true"
        >
          <motion.div
            className={`bg-white rounded-2xl p-6 w-full max-w-sm shadow-lg relative max-h-[90vh] overflow-y-auto ${
              isMobile ? "mt-auto mb-0 rounded-t-3xl" : ""
            }`}
            initial={
              isMobile
                ? { y: "100%", opacity: 0 }
                : { scale: 0.9, opacity: 0, y: -50 }
            }
            animate={
              isMobile
                ? { y: 0, opacity: 1 }
                : { scale: 1, opacity: 1, y: 0 }
            }
            exit={
              isMobile
                ? { y: "100%", opacity: 0 }
                : { scale: 0.9, opacity: 0, y: -50 }
            }
            transition={{ type: "spring", stiffness: 400, damping: 35 }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close */}
            <button
              className="absolute top-3 right-3 text-gray-500 hover:text-gray-700"
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
                  tab === "login"
                    ? "border-blue-600 text-blue-600"
                    : "border-transparent text-gray-500"
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
                }}
                className={`pb-2 border-b-2 ${
                  tab === "signup"
                    ? "border-blue-600 text-blue-600"
                    : "border-transparent text-gray-500"
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
            </div>

            {/* Small hint for org-side */}
            {tab === "login" && isOrgSideLogin && !showForgot && (
              <div className="mb-3 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-[11px] text-gray-600">
                Organization login includes <b>Admins</b> and <b>Trainers</b>.
              </div>
            )}

            {/* LOGIN */}
            {tab === "login" && !showForgot && (
              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="block mb-1 font-medium text-gray-800">
                    Email
                  </label>
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
                  <label className="block mb-1 font-medium text-gray-800">
                    Password
                  </label>
                  <div className="relative">
                    <input
                      ref={passwordRef}
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

                {loginError && (
                  <p className="text-red-500 text-sm">{loginError}</p>
                )}

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
                  <h3 className="text-lg font-bold text-gray-900">
                    Reset your password
                  </h3>
                  <p className="mt-1 text-sm text-gray-600">
                    Enter your email and we’ll send you reset instructions.
                  </p>
                  <p className="mt-1 text-[11px] text-gray-500">
                    (If your account exists, you’ll receive an email.)
                  </p>
                </div>

                <div>
                  <label className="block mb-1 font-medium text-gray-800">
                    Email
                  </label>
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

                {forgotError && (
                  <p className="text-red-500 text-sm">{forgotError}</p>
                )}

                {forgotOk && (
                  <p className="text-emerald-600 text-sm">
                    If your account exists, we’ve sent reset instructions.
                  </p>
                )}

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
                    <p className="text-[11px] text-gray-500">
                      If your organization provided a token, paste it here.
                    </p>
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
                    <p className="text-[11px] text-gray-500">
                      We’ll generate a secure token for your organization automatically.
                    </p>
                  </>
                )}

                {signupError && (
                  <p className="text-red-500 text-sm">{signupError}</p>
                )}

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

            {/* optional success */}
            {tab === "signup" && signupSuccess && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-4 text-center bg-green-50 rounded-xl"
              >
                <h2 className="text-lg font-bold text-green-600">Success!</h2>
                <p className="text-gray-700 mt-1">
                  Account created successfully.
                </p>
              </motion.div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
