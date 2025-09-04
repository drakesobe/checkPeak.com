"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useMediaQuery } from "react-responsive";
import { useAuthContext } from "@/hooks/useAuth";
import bcrypt from "bcryptjs";

export default function NavBarLoginModal({ isOpen, onClose, defaultTab = "login" }) {
  const { login, signupAthlete } = useAuthContext();
  const router = useRouter();

  // Tabs
  const [tab, setTab] = useState(defaultTab);

  // LOGIN state
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);

  // SIGNUP state (Airtable columns)
  const [signupForm, setSignupForm] = useState({
    name: "",
    email: "",
    password: "",
    token: "",
    organization: "",
    title: "Athlete", // dropdown: Athlete, Trainer, Organization
    phone: "",
  });
  const [signupLoading, setSignupLoading] = useState(false);
  const [signupError, setSignupError] = useState("");
  const [signupSuccess, setSignupSuccess] = useState(null);

  const emailRef = useRef(null);
  const passwordRef = useRef(null);
  const isMobile = useMediaQuery({ maxWidth: 768 });

  // when modal opens, reset tab to defaultTab
  useEffect(() => {
    if (isOpen) setTab(defaultTab);
  }, [isOpen, defaultTab]);

  // focus email on open when login selected
  useEffect(() => {
    if (isOpen && tab === "login" && emailRef.current) {
      emailRef.current.focus();
    }
  }, [isOpen, tab]);

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
      // current login() sends what you pass directly to your lookup endpoint.
      // To work with the current API behavior (which accepted hashed password),
      // pass password as-is (either plain or hashed depending on server expectation).
      const userData = await login(email.trim(), password);

      if (rememberMe && typeof window !== "undefined") {
        localStorage.setItem("user", JSON.stringify(userData));
      }

      // clear fields & close
      setEmail("");
      setPassword("");
      setRememberMe(false);
      onClose();
    } catch (err) {
      console.error("Login error:", err);
      setLoginError(err?.message || "Login failed. Check email/password.");
    } finally {
      setLoginLoading(false);
    }
  };

  // ---------- SIGNUP ----------
  const handleSignupChange = (e) =>
    setSignupForm({ ...signupForm, [e.target.name]: e.target.value });

  const handleSignup = async (e) => {
    e.preventDefault();
    setSignupError("");
    setSignupLoading(true);

    // basic validation
    if (!signupForm.email || !signupForm.password || !signupForm.name) {
      setSignupError("Please provide name, email, and password.");
      setSignupLoading(false);
      return;
    }
    if (!signupForm.email.includes("@")) {
      setSignupError("Please enter a valid email.");
      setSignupLoading(false);
      return;
    }
    if (signupForm.password.length < 6) {
      setSignupError("Password must be at least 6 characters.");
      setSignupLoading(false);
      return;
    }

    try {
      const devToken = "TEST123";
      const token =
        signupForm.token ||
        (process.env.NODE_ENV === "development" ? devToken : null);

      // Hash password client-side (this mirrors what you were doing).
      // Keep the hashedPassword in a variable so we can use it to login if needed.
      const hashedPassword = await bcrypt.hash(signupForm.password, 10);
      const createdAt = new Date().toISOString();

      const payload = {
        name: signupForm.name,
        email: signupForm.email,
        password: hashedPassword, // store hashed password in Airtable
        token,
        organization: signupForm.organization || null,
        title: signupForm.title,
        phone: signupForm.phone || null,
        created: createdAt,
      };

      // send to signupAthlete (server should persist these Airtable columns)
      const data = await signupAthlete(payload);
      setSignupSuccess(data);

      // ------ AUTO-LOGIN & REDIRECT FIX -------
      // Many of your logs showed the login endpoint accepted the hashed password
      // (it returned 200 when hashed was sent). The prior auto-login used the
      // plain password and thus got 401. To make auto-login succeed immediately
      // with your current backend behavior, pass the hashed password to login().
      //
      // If you prefer the secure approach, update the login API to bcrypt.compare
      // the plain password with the stored hash — see note after code.
      await login(signupForm.email.trim(), hashedPassword);

      // Optionally persist user to localStorage if your login returns user data
      // (depends on login() implementation)
      // localStorage.setItem("user", JSON.stringify(userData));

      // Redirect immediately to dashboard and close modal
      onClose();
      router.push("/dashboard");
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
          >
            {/* Close */}
            <button
              className="absolute top-3 right-3 text-gray-500 hover:text-gray-700"
              onClick={onClose}
            >
              ✕
            </button>

            {/* Tabs */}
            <div className="flex justify-center space-x-6 mb-4">
              <button
                onClick={() => setTab("login")}
                className={`pb-2 border-b-2 ${
                  tab === "login"
                    ? "border-blue-600 text-blue-600"
                    : "border-transparent text-gray-500"
                }`}
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
              >
                Sign Up
              </button>
            </div>

            {/* LOGIN */}
            {tab === "login" && (
              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="block mb-1 font-medium text-gray-800">Email</label>
                  <input
                    ref={emailRef}
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full p-3 border border-gray-300 rounded-xl"
                    required
                  />
                </div>

                <div>
                  <label className="block mb-1 font-medium text-gray-800">Password</label>
                  <div className="relative">
                    <input
                      ref={passwordRef}
                      type={showPassword ? "text" : "password"}
                      placeholder="Enter your password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full p-3 border border-gray-300 rounded-xl pr-10"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-3 text-sm text-gray-500 hover:text-gray-700"
                    >
                      {showPassword ? "Hide" : "Show"}
                    </button>
                  </div>
                </div>

                {loginError && <p className="text-red-500 text-sm">{loginError}</p>}

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
                  className="w-full py-3 rounded-2xl text-white font-medium"
                >
                  {loginLoading ? "Logging in..." : "Log In"}
                </button>
              </form>
            )}

            {/* SIGNUP */}
            {tab === "signup" && !signupSuccess && (
              <form onSubmit={handleSignup} className="space-y-4">
                <input
                  type="text"
                  name="name"
                  placeholder="Full Name"
                  value={signupForm.name}
                  onChange={handleSignupChange}
                  className="w-full p-3 border border-gray-300 rounded-xl"
                  required
                />
                <input
                  type="email"
                  name="email"
                  placeholder="Email"
                  value={signupForm.email}
                  onChange={handleSignupChange}
                  className="w-full p-3 border border-gray-300 rounded-xl"
                  required
                />
                <input
                  type="password"
                  name="password"
                  placeholder="Password"
                  value={signupForm.password}
                  onChange={handleSignupChange}
                  className="w-full p-3 border border-gray-300 rounded-xl"
                  required
                />
                <input
                  type="text"
                  name="phone"
                  placeholder="Phone Number"
                  value={signupForm.phone}
                  onChange={handleSignupChange}
                  className="w-full p-3 border border-gray-300 rounded-xl"
                />
                <input
                  type="text"
                  name="organization"
                  placeholder="Organization"
                  value={signupForm.organization}
                  onChange={handleSignupChange}
                  className="w-full p-3 border border-gray-300 rounded-xl"
                />
                <select
                  name="title"
                  value={signupForm.title}
                  onChange={handleSignupChange}
                  className="w-full p-3 border border-gray-300 rounded-xl"
                >
                  <option value="Athlete">Athlete</option>
                  <option value="Trainer">Trainer</option>
                  <option value="Organization">Organization</option>
                </select>
                <input
                  type="text"
                  name="token"
                  placeholder="Signup Token (optional)"
                  value={signupForm.token}
                  onChange={handleSignupChange}
                  className="w-full p-3 border border-gray-300 rounded-xl"
                />

                {signupError && <p className="text-red-500 text-sm">{signupError}</p>}

                <button
                  type="submit"
                  disabled={signupLoading}
                  style={{ backgroundColor: "#46769B" }}
                  className="w-full py-3 rounded-2xl text-white font-medium"
                >
                  {signupLoading ? "Signing up..." : "Sign Up"}
                </button>
              </form>
            )}

            {/* optional success (if your backend returns and you want it shown briefly) */}
            {tab === "signup" && signupSuccess && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-4 text-center bg-green-50 rounded-xl"
              >
                <h2 className="text-lg font-bold text-green-600">Success!</h2>
                <p className="text-gray-700 mt-1">
                  You’ve joined the organization:{" "}
                  <strong>{signupSuccess.organization || "N/A"}</strong>
                </p>
              </motion.div>
            )}

            {/* Social Logins */}
            <div className="border-t border-gray-200 pt-4 space-y-2 text-center mt-4">
              <button className="w-full px-6 py-3 rounded-2xl bg-gray-50 text-gray-600 font-medium border hover:bg-gray-100">
                Continue with Google
              </button>
              <button className="w-full px-6 py-3 rounded-2xl bg-gray-50 text-gray-600 font-medium border hover:bg-gray-100">
                Continue with Apple
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
