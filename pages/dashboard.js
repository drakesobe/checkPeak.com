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
  const [recentActivity, setRecentActivity] = useState([]);

  const [stats, setStats] = useState({
    totalScans: 0,
    recentSearches: 0,
    stacksSaved: 0,
    accountCompletion: 0,
  });

  useEffect(() => {
    if (!user) {
      router.push("/login");
    } else {
      setShowWelcome(true);
      const timer = setTimeout(() => setShowWelcome(false), 3000);
      return () => clearTimeout(timer);

      // Fetch recent activity from API
      fetch(`/api/getScans?userEmail=${user.Email}`)
        .then((res) => res.json())
        .then((data) => {
          setRecentActivity(data.scans || []);
          setStats({
            totalScans: data.scans.length,
            recentSearches: 5, // Placeholder
            stacksSaved: 3,    // Placeholder
            accountCompletion: 80, // Placeholder
          });
        })
        .catch((err) => console.error(err));
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

        {/* Quick Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-white rounded-2xl shadow-md p-6 flex flex-col items-center hover:shadow-lg transition">
            <p className="text-gray-500 text-sm">Total Scans</p>
            <h3 className="text-2xl font-bold text-gray-800">{stats.totalScans}</h3>
          </div>
          <div className="bg-white rounded-2xl shadow-md p-6 flex flex-col items-center hover:shadow-lg transition">
            <p className="text-gray-500 text-sm">Recent Searches</p>
            <h3 className="text-2xl font-bold text-gray-800">{stats.recentSearches}</h3>
          </div>
          <div className="bg-white rounded-2xl shadow-md p-6 flex flex-col items-center hover:shadow-lg transition">
            <p className="text-gray-500 text-sm">Stacks Saved</p>
            <h3 className="text-2xl font-bold text-gray-800">{stats.stacksSaved}</h3>
          </div>
          <div className="bg-white rounded-2xl shadow-md p-6 flex flex-col items-center hover:shadow-lg transition">
            <p className="text-gray-500 text-sm">Account Completion</p>
            <h3 className="text-2xl font-bold text-gray-800">{stats.accountCompletion}%</h3>
          </div>
        </div>

        {/* Action Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          <div
            onClick={() => router.push("/search")}
            className="cursor-pointer bg-gradient-to-b from-white to-blue-50 p-6 rounded-2xl shadow-md flex flex-col items-center space-y-3 hover:shadow-xl hover:scale-105 transition"
          >
            <div className="bg-blue-100 p-3 rounded-full">
              <Search className="w-8 h-8 text-[#46769B]" />
            </div>
            <h3 className="font-semibold text-gray-800">Search Ingredients</h3>
            <p className="text-sm text-gray-500 text-center">
              Look up substances and ingredient safety.
            </p>
          </div>

          <div
            onClick={() => router.push("/scans")}
            className="cursor-pointer bg-gradient-to-b from-white to-blue-50 p-6 rounded-2xl shadow-md flex flex-col items-center space-y-3 hover:shadow-xl hover:scale-105 transition"
          >
            <div className="bg-blue-100 p-3 rounded-full">
              <Folder className="w-8 h-8 text-[#46769B]" />
            </div>
            <h3 className="font-semibold text-gray-800">View My Scans</h3>
            <p className="text-sm text-gray-500 text-center">
              View and manage all your scans in one place.
            </p>
          </div>

          <div
            onClick={() => router.push("/account")}
            className="cursor-pointer bg-gradient-to-b from-white to-blue-50 p-6 rounded-2xl shadow-md flex flex-col items-center space-y-3 hover:shadow-xl hover:scale-105 transition"
          >
            <div className="bg-blue-100 p-3 rounded-full">
              <Settings className="w-8 h-8 text-[#46769B]" />
            </div>
            <h3 className="font-semibold text-gray-800">Manage Account</h3>
            <p className="text-sm text-gray-500 text-center">
              Update your account and preferences.
            </p>
          </div>
        </div>

        {/* Recent Activity */}
        <div>
          <h2 className="text-xl font-bold text-gray-800 mb-4">Recent Activity</h2>
          {recentActivity.length === 0 ? (
            <p className="text-gray-500">No recent activity.</p>
          ) : (
            <div className="space-y-4">
              {recentActivity.map((item) => (
                <div
                  key={item.id}
                  className="border rounded-2xl p-4 bg-white shadow-md flex justify-between items-center hover:shadow-lg transition"
                >
                  <div>
                    <p className="text-gray-800 font-medium">{item.name}</p>
                    <p className="text-gray-500 text-sm">{item.date}</p>
                  </div>
                  <button
                    onClick={() => router.push(`/scans/${item.id}`)}
                    className="text-blue-600 hover:underline"
                  >
                    View
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Logout Button */}
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
