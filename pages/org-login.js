"use client";

import { useState } from "react";
import { useRouter } from "next/router";
import useAuth from "@/hooks/useAuth";

export default function OrgLogin() {
  const router = useRouter();
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    try {
      const user = await login(email, password);
      router.push("/dashboard");
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <form className="max-w-md mx-auto mt-10 p-6 bg-gray-50 rounded-xl shadow space-y-4" onSubmit={handleLogin}>
      <h2 className="text-xl font-bold">Organization Login</h2>
      {error && <p className="text-red-600">{error}</p>}

      <input
        type="email"
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="w-full p-3 rounded-lg border border-gray-300"
        required
      />
      <input
        type="password"
        placeholder="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        className="w-full p-3 rounded-lg border border-gray-300"
        required
      />

      <button className="w-full bg-green-600 text-white py-3 rounded-xl hover:bg-green-700 transition">Login</button>
    </form>
  );
}
