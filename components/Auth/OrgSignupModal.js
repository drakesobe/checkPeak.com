"use client";

import { useState } from "react";
import useAuth from "@/hooks/useAuth";

export default function OrgSignupModal({ token, onClose }) {
  const { signupOrg } = useAuth();
  const [orgName, setOrgName] = useState("");
  const [contactName, setContactName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const handleSignup = async (e) => {
    e.preventDefault();
    setError("");
    try {
      const data = await signupOrg({ orgName, contactName, email, password, token });
      console.log("Org created:", data);
      setSuccess(true);
    } catch (err) {
      setError(err.message);
    }
  };

  if (success)
    return (
      <div className="p-6 bg-green-50 rounded-xl max-w-md mx-auto shadow space-y-4">
        <h3 className="text-xl font-bold">Organization Created!</h3>
        <p>You can now log in using your email and password.</p>
        <button
          onClick={onClose}
          className="px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition"
        >
          Close
        </button>
      </div>
    );

  return (
    <form
      onSubmit={handleSignup}
      className="p-6 bg-gray-50 rounded-xl max-w-md mx-auto shadow space-y-4"
    >
      <h3 className="text-xl font-bold">Organization Signup</h3>
      {error && <p className="text-red-600">{error}</p>}

      <input
        type="text"
        placeholder="Organization Name"
        value={orgName}
        onChange={(e) => setOrgName(e.target.value)}
        className="w-full p-3 rounded-lg border border-gray-300"
        required
      />
      <input
        type="text"
        placeholder="Contact Name"
        value={contactName}
        onChange={(e) => setContactName(e.target.value)}
        className="w-full p-3 rounded-lg border border-gray-300"
        required
      />
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

      <button
        type="submit"
        className="w-full bg-green-600 text-white py-3 rounded-xl hover:bg-green-700 transition"
      >
        Sign Up
      </button>
    </form>
  );
}
