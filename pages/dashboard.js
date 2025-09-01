"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import NavBar from "@/components/NavBar";
import { useAuthContext } from "@/hooks/useAuth";
import { LogOut, Search, Folder, Settings } from "lucide-react";

export default function DashboardPage() {
  const router = useRouter();
  const { user, logout } = useAuthContext();
  const [activeTab, setActiveTab] = useState("Dashboard");
  const [showWelcome, setShowWelcome] = useState(false);

  useEffect(() => {
    if (!user) {
      router.push("/login");
    } else {
      setShowWelcome(true);
      const timer = setTimeout(() => setShowWelcome(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [user, router]);

  if (!user) return null;

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-blue-50 text-gray-900 font-sans">
      <NavBar activeTab={activeTab} setActiveTab={setActiveTab} />

      <main className="max-w-6xl mx-auto px-4 py-8 space-y-8">
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>

        {showWelcome && (
          <div className="p-6 bg-green-50 rounded-2xl shadow-md text-center">
            <h2 className="text-xl font-bold text-green-700">Welcome, {user.Name}!</h2>
            <p className="text-gray-700">
              You’ve joined: <strong>{user.Organization}</strong>
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          <div
            onClick={() => router.push("/search")}
            className="cursor-pointer bg-white p-6 rounded-2xl shadow-md border border-blue-100 flex flex-col items-center space-y-3 hover:shadow-lg transition"
          >
            <Search className="w-8 h-8 text-[#46769B]" />
            <h3 className="font-semibold">Start a Search</h3>
            <p className="text-sm text-gray-500 text-center">
              Look up substances and ingredient safety.
            </p>
          </div>

          <div
            onClick={() => router.push("/scans")}
            className="cursor-pointer bg-white p-6 rounded-2xl shadow-md border border-blue-100 flex flex-col items-center space-y-3 hover:shadow-lg transition"
          >
            <Folder className="w-8 h-8 text-[#46769B]" />
            <h3 className="font-semibold">My Scans</h3>
            <p className="text-sm text-gray-500 text-center">
              View and manage all your scans in one place.
            </p>
          </div>

          <div
            onClick={() => router.push("/account")}
            className="cursor-pointer bg-white p-6 rounded-2xl shadow-md border border-blue-100 flex flex-col items-center space-y-3 hover:shadow-lg transition"
          >
            <Settings className="w-8 h-8 text-[#46769B]" />
            <h3 className="font-semibold">Settings</h3>
            <p className="text-sm text-gray-500 text-center">
              Update your account and preferences.
            </p>
          </div>
        </div>

        <div className="text-center">
          <button
            onClick={logout}
            className="mt-6 bg-red-600 text-white px-6 py-3 rounded-2xl flex items-center gap-2 mx-auto hover:bg-red-700 transition"
          >
            <LogOut className="w-5 h-5" />
            Logout
          </button>
        </div>
      </main>
    </div>
  );
}
