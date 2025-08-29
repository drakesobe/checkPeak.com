"use client";

import { useEffect } from "react";
import { useAuthContext } from "@/hooks/useAuth";

export default function Dashboard() {
  const { user, logout } = useAuthContext();

  useEffect(() => {
    if (!user) {
      // Optionally redirect to login if no user
      // router.push("/login");
      console.log("No user logged in yet");
    }
  }, [user]);

  if (!user) {
    return (
      <div className="p-6 max-w-md mx-auto mt-10 bg-gray-50 rounded-xl shadow-lg text-center">
        <h2 className="text-xl font-bold text-gray-700 mb-2">Welcome!</h2>
        <p className="text-gray-500">Please log in or sign up to continue.</p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-3xl mx-auto mt-10 bg-white rounded-xl shadow-lg space-y-4">
      <h1 className="text-2xl font-bold">Dashboard</h1>
      <p className="text-gray-700">
        Logged in as <strong>{user.Name}</strong> ({user.Email})
      </p>
      <p className="text-gray-600">Organization: {user.Organization || "N/A"}</p>

      <button
        onClick={logout}
        className="mt-4 bg-red-600 text-white px-6 py-3 rounded-2xl hover:bg-red-700 transition"
      >
        Logout
      </button>
    </div>
  );
}
