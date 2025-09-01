"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import NavBar from "@/components/NavBar";
import { useAuthContext } from "@/hooks/useAuth";

export default function AccountPage() {
  const router = useRouter();
  const { user, logout } = useAuthContext();
  const [activeTab, setActiveTab] = useState("Account");

  useEffect(() => {
    if (!user) router.push("/login");
  }, [user, router]);

  if (!user) return null; // wait for redirect

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-blue-50 font-sans">
      <NavBar activeTab={activeTab} setActiveTab={setActiveTab} />

      <main className="max-w-3xl mx-auto px-4 py-12">
        <div className="bg-white p-8 rounded-2xl shadow-md border border-blue-100 space-y-6">
          <h1 className="text-2xl font-bold text-gray-800 text-center">Account Settings</h1>
          <p className="text-gray-600 text-center text-sm mb-6">
            Manage your profile and account preferences
          </p>

          {/* User Info */}
          <div className="space-y-4">
            <div>
              <label className="block text-gray-800 font-medium mb-1">Name</label>
              <input
                type="text"
                value={user?.Name || user?.name || ""}
                readOnly
                className="w-full border border-blue-100 rounded-2xl px-4 py-2 bg-gray-50 text-gray-800"
              />
            </div>

            <div>
              <label className="block text-gray-800 font-medium mb-1">Email</label>
              <input
                type="email"
                value={user?.Email || user?.email || ""}
                readOnly
                className="w-full border border-blue-100 rounded-2xl px-4 py-2 bg-gray-50 text-gray-800"
              />
            </div>
          </div>

          {/* Account actions */}
          <div className="mt-6 flex flex-col space-y-3">
            <button
              onClick={() => alert("Here you could implement password change flow")}
              className="w-full py-3 rounded-2xl bg-blue-100 text-blue-800 font-medium hover:bg-blue-200 transition"
            >
              Change Password
            </button>

            <button
              onClick={() => logout()}
              className="w-full py-3 rounded-2xl bg-red-100 text-red-800 font-medium hover:bg-red-200 transition"
            >
              Log Out
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
