"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { motion } from "framer-motion";
import useAuth from "@/hooks/useAuth";

export default function AthleteSignup({ params }) {
  const { token } = params;
  const router = useRouter();
  const { signupAthlete, login } = useAuth();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      // Signup the athlete
      const signupData = await signupAthlete({ token, name, email });
      setSuccess(signupData);

      // Immediately log them in
      await login(email);

      // Redirect after short delay
      setTimeout(() => {
        router.push("/dashboard");
      }, 2500);
    } catch (err) {
      setError(err?.message || "Failed to join organization.");
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="p-6 max-w-md mx-auto mt-10 bg-green-50 rounded-xl shadow-lg text-center"
      >
        <h2 className="text-xl font-bold mb-2">Success!</h2>
        <p className="text-gray-700 mb-2">
          You’ve joined the organization:{" "}
          <span className="font-semibold">{success.organization}</span>
        </p>
        <p className="mt-2 text-sm text-gray-600">
          You are now logged in. Redirecting to your dashboard...
        </p>
      </motion.div>
    );
  }

  return (
    <motion.form
      onSubmit={handleSubmit}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-md mx-auto mt-10 space-y-4 p-6 bg-gray-50 rounded-xl shadow"
    >
      <h2 className="text-xl font-bold text-gray-700">Join Organization</h2>

      {error && <p className="text-red-600">{error}</p>}

      <input
        type="text"
        placeholder="Full Name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="w-full p-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-400"
        required
      />
      <input
        type="email"
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="w-full p-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-400"
        required
      />

      <motion.button
        type="submit"
        whileHover={{ scale: 1.03 }}
        whileTap={{ scale: 0.97 }}
        className={`w-full py-3 rounded-xl text-white font-semibold ${
          loading ? "bg-gray-500 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-700"
        }`}
        disabled={loading}
      >
        {loading ? "Joining..." : "Join & Log In"}
      </motion.button>
    </motion.form>
  );
}
