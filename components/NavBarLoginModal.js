// components/NavBarLoginModal.jsx
"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useMediaQuery } from "react-responsive";
import { useAuthContext } from "@/hooks/useAuth";

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
  const [authRole, setAuthRole] = useState("athlete");

  // LOGIN state
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);

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
      // default role reset per tab open is fine; keep last selection if you prefer
      setAuthRole("athlete");
    }
  }, [isOpen, defaultTab]);

  useEffect(() => {
    if (isOpen && tab === "login" && emailRef.current) {
      emailRef.current.focus();
    }
  }, [isOpen, tab]);

  const closeAndReset = () => {
    // Clear login fields
    setEmail("");
    setPassword("");
    setRememberMe(false);
    setShowPassword(false);
    setLoginError("");
    setLoginLoading(false);

    // Clear signup fields
    setSignupError("");
    setSignupSuccess(null);
    setSignupLoading(false);

    // Keep role selection reset (optional)
    setAuthRole("athlete");

    onClose?.();
  };

  const inputBase =
    "w-full p-3 border border-gray-300 rounded-xl bg-white text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-300";

  const rolePill =
    "px-3 py-2 rounded-xl border text-sm font-semibold transition";

  const isOrg = authRole === "organization";

  // ---------- LOGIN ----------
  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError("");
    setLoginLoading(true);

    if (!email.includes("@")) {
      setLoginError("Please enter a valid email.");
      setLoginLoading(false);
      return;
    }
    if (password.length < 6) {
      setLoginError("Password must be at least 6 characters.");
      setLoginLoading(false);
      return;
    }

    try {
      const userData = await login(email.trim(), password, authRole);

      if (rememberMe && typeof window !== "undefined") {
        localStorage.setItem("user", JSON.stringify(userData));
      }

      closeAndReset();

      // Route by role
      const roleLabel = String(userData?.role || "").toLowerCase();
      if (roleLabel.includes("org")) router.push("/org/dashboard");
      else router.push("/dashboard");
    } catch (err) {
      console.error("Login error:", err);
      setLoginError(err?.message || "Login failed. Check email/password.");
    } finally {
      setLoginLoading(false);
    }
  };

  // ---------- SIGNUP ----------
  const handleAthleteSignupChange = (e) =>
    setAthleteSignup((prev) => ({ ...prev, [e.target.name]: e.target.value }));

  const handleOrgSignupChange = (e) =>
    setOrgSignup((prev) => ({ ...prev, [e.target.name]: e.target.value }));

  const handleSignup = async (e) => {
    e.preventDefault();
    setSignupError("");
    setSignupLoading(true);

    try {
      if (authRole === "athlete") {
        // Validate athlete
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

      // Org signup
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

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center px-4 sm:px-6 bg-black/40"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={closeAndReset}
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
            >
              ✕
            </button>

            {/* Tabs */}
            <div className="flex justify-center space-x-6 mb-3">
              <button
                onClick={() => setTab("login")}
                className={`pb-2 border-b-2 ${
                  tab === "login"
                    ? "border-blue-600 text-blue-600"
                    : "border-transparent text-gray-500"
                }`}
                type="button"
              >
                Log In
              </button>
              <button
                onClick={() => setTab("signup")}
                className={`pb-2 border-b-2 ${
                  tab === "signup"
                    ? "border-blue-600 text-blue-600"
                    : "border-transparent text-gray-500"
                }`}
                type="button"
              >
                Sign Up
              </button>
            </div>

            {/* Role selector */}
            <div className="flex justify-center gap-2 mb-4">
              <button
                type="button"
                onClick={() => setAuthRole("athlete")}
                className={`${rolePill} ${
                  authRole === "athlete"
                    ? "bg-[#46769B] text-white border-[#46769B]"
                    : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50"
                }`}
              >
                Athlete
              </button>
              <button
                type="button"
                onClick={() => setAuthRole("organization")}
                className={`${rolePill} ${
                  authRole === "organization"
                    ? "bg-[#46769B] text-white border-[#46769B]"
                    : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50"
                }`}
              >
                Organization
              </button>
            </div>

            {/* LOGIN */}
            {tab === "login" && (
              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="block mb-1 font-medium text-gray-800">
                    Email
                  </label>
                  <input
                    ref={emailRef}
                    type="email"
                    placeholder={isOrg ? "org@example.com" : "you@example.com"}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className={inputBase}
                    required
                    autoComplete="email"
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
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute inset-y-0 right-3 text-sm text-gray-500 hover:text-gray-700"
                    >
                      {showPassword ? "Hide" : "Show"}
                    </button>
                  </div>
                </div>

                {loginError && (
                  <p className="text-red-500 text-sm">{loginError}</p>
                )}

                <div className="flex items-center">
                  <label className="flex items-center space-x-2 text-gray-700">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="rounded"
                    />
                    <span className="text-sm">Remember me</span>
                  </label>
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
                      onChange={handleAthleteSignupChange}
                      className={inputBase}
                      required
                      autoComplete="name"
                    />
                    <input
                      type="email"
                      name="email"
                      placeholder="Email"
                      value={athleteSignup.email}
                      onChange={handleAthleteSignupChange}
                      className={inputBase}
                      required
                      autoComplete="email"
                    />
                    <input
                      type="password"
                      name="password"
                      placeholder="Password"
                      value={athleteSignup.password}
                      onChange={handleAthleteSignupChange}
                      className={inputBase}
                      required
                      autoComplete="new-password"
                    />
                    <input
                      type="text"
                      name="token"
                      placeholder="Organization Token (optional)"
                      value={athleteSignup.token}
                      onChange={handleAthleteSignupChange}
                      className={inputBase}
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
                      onChange={handleOrgSignupChange}
                      className={inputBase}
                      required
                    />
                    <input
                      type="email"
                      name="email"
                      placeholder="Organization Email"
                      value={orgSignup.email}
                      onChange={handleOrgSignupChange}
                      className={inputBase}
                      required
                      autoComplete="email"
                    />
                    <input
                      type="password"
                      name="password"
                      placeholder="Password"
                      value={orgSignup.password}
                      onChange={handleOrgSignupChange}
                      className={inputBase}
                      required
                      autoComplete="new-password"
                    />

                    <input
                      type="text"
                      name="contactName"
                      placeholder="Contact Name (optional)"
                      value={orgSignup.contactName}
                      onChange={handleOrgSignupChange}
                      className={inputBase}
                    />
                    <input
                      type="text"
                      name="phoneNumber"
                      placeholder="Phone Number (optional)"
                      value={orgSignup.phoneNumber}
                      onChange={handleOrgSignupChange}
                      className={inputBase}
                    />
                    <input
                      type="text"
                      name="website"
                      placeholder="Website (optional)"
                      value={orgSignup.website}
                      onChange={handleOrgSignupChange}
                      className={inputBase}
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

            {/* Social Logins (placeholders) */}
            <div className="border-t border-gray-200 pt-4 space-y-2 text-center mt-4">
              <button
                type="button"
                className="w-full px-6 py-3 rounded-2xl bg-gray-50 text-gray-600 font-medium border hover:bg-gray-100"
              >
                Continue with Google
              </button>
              <button
                type="button"
                className="w-full px-6 py-3 rounded-2xl bg-gray-50 text-gray-600 font-medium border hover:bg-gray-100"
              >
                Continue with Apple
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
