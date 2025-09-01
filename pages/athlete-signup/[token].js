"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { useAuthContext } from "@/hooks/useAuth";

export default function AthleteSignupPage({ params }) {
  const router = useRouter();
  const { token: paramToken } = params || {};
  const { signupAthlete, login } = useAuthContext();

  const devToken = "TEST123";
  const token = paramToken || (process.env.NODE_ENV === "development" ? devToken : null);

  const [formData, setFormData] = useState({ name: "", email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(null);

  const handleChange = (e) =>
    setFormData({ ...formData, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const data = await signupAthlete({ token, ...formData });
      setSuccess(data);

      // Auto-login after signup
      await login(formData.email.trim(), formData.password);
    } catch (err) {
      console.error("Signup error:", err);
      setError(err?.message || "Failed to join organization.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => router.push("/dashboard"), 2000);
      return () => clearTimeout(timer);
    }
  }, [success, router]);

  if (!token) {
    return (
      <div className="p-6 max-w-md mx-auto mt-10 bg-red-50 rounded-xl shadow-lg text-center">
        <h2 className="text-xl font-bold text-red-600">Invalid Token</h2>
        <p className="text-gray-700 mt-2">Missing or invalid signup token.</p>
      </div>
    );
  }

  if (success) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="p-6 max-w-md mx-auto mt-10 bg-green-50 rounded-xl shadow-lg text-center"
      >
        <h2 className="text-xl font-bold mb-2">Success!</h2>
        <p className="text-gray-700 mb-2">
          You’ve joined the organization: <strong>{success.organization}</strong>
        </p>
        <p className="text-gray-500 text-sm">Redirecting to your dashboard...</p>
      </motion.div>
    );
  }

  return (
    <motion.form
      onSubmit={handleSubmit}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-md mx-auto mt-10 space-y-4 p-6 bg-white rounded-2xl shadow-md border border-blue-100"
    >
      <h2 className="text-2xl font-bold text-gray-800 text-center">Join Organization</h2>
      <p className="text-sm text-gray-500 text-center">
        Using token: <strong>{token}</strong>{" "}
        {process.env.NODE_ENV === "development" && "(DEV TEST TOKEN)"}
      </p>

      {error && <p className="text-red-600 text-center">{error}</p>}

      <input
        type="text"
        name="name"
        placeholder="Full Name"
        value={formData.name}
        onChange={handleChange}
        className="w-full p-3 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-400"
        required
      />
      <input
        type="email"
        name="email"
        placeholder="Email"
        value={formData.email}
        onChange={handleChange}
        className="w-full p-3 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-400"
        required
      />
      <input
        type="password"
        name="password"
        placeholder="Password"
        value={formData.password}
        onChange={handleChange}
        className="w-full p-3 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-400"
        required
      />

      <motion.button
        type="submit"
        whileHover={{ scale: 1.03 }}
        whileTap={{ scale: 0.97 }}
        className={`w-full py-3 rounded-2xl text-white font-semibold ${
          loading ? "bg-gray-500 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-700"
        }`}
        disabled={loading}
      >
        {loading ? "Joining..." : "Join & Log In"}
      </motion.button>
    </motion.form>
  );
}
