// pages/athlete-signup/[token].js
"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { motion } from "framer-motion";
import { useAuthContext } from "@/hooks/useAuth";

export default function AthleteSignup() {
  const router = useRouter();
  const params = useParams();
  const devToken = "TEST123"; // dev default token

  const token = params?.token || (process.env.NODE_ENV === "development" ? devToken : null);

  const { signupAthlete, login } = useAuthContext();
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
      const signupData = await signupAthlete({ token, name, email });
      setSuccess(signupData);
      await login(email.trim());
    } catch (err) {
      setError(err?.message || "Failed to join organization.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => router.push("/dashboard"), 2500);
      return () => clearTimeout(timer);
    }
  }, [success, router]);

  if (!token) {
    return <p className="text-center mt-10 text-red-600">Invalid or missing token.</p>;
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
      className="max-w-md mx-auto mt-10 space-y-4 p-6 bg-gray-50 rounded-xl shadow"
    >
      <h2 className="text-xl font-bold text-gray-700">Join Organization</h2>
      <p className="text-sm text-gray-500">
        Using token: <strong>{token}</strong> {process.env.NODE_ENV === "development" && "(DEV TEST TOKEN)"}
      </p>

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
