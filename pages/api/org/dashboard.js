// pages/org/dashboard.js
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthContext } from "@/hooks/useAuth";

export default function OrgDashboard() {
  const router = useRouter();
  const { user, logout } = useAuthContext();

  useEffect(() => {
    // If not logged in, bounce home
    if (!user) return;

    const role = String(user?.role || user?.Role || "").toLowerCase();
    if (!role.includes("org")) {
      router.push("/dashboard");
    }
  }, [user, router]);

  const orgName =
    user?.Name || user?.OrgName || user?.Organization || "Organization";

  const orgEmail = user?.Email || user?.email || "";

  const token =
    user?.Token || user?.token || user?.["Organization Token"] || "";

  const handleLogout = () => {
    logout?.();
    router.push("/");
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-blue-50 text-gray-900 font-sans">
      <main className="max-w-5xl mx-auto px-4 py-10">
        <div className="bg-white rounded-2xl shadow-md border border-blue-100 p-6 space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold">{orgName} — Dashboard</h1>
              <p className="text-sm text-gray-600 mt-1">
                Logged in as <span className="font-semibold">{orgEmail}</span>
              </p>
            </div>

            <button
              onClick={handleLogout}
              className="px-4 py-2 rounded-xl bg-gray-900 text-white text-sm font-semibold hover:opacity-90"
            >
              Log out
            </button>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
            <p className="text-xs text-gray-500">Organization Token</p>
            <p className="font-mono text-sm font-semibold break-all mt-1">
              {token || "— (token missing from session)"}
            </p>
            <p className="text-[11px] text-gray-500 mt-2">
              Athletes use this token during signup to join your organization.
            </p>
          </div>

          <div className="text-sm text-gray-700">
            Next: show athletes under your token + create prescriptions.
          </div>
        </div>
      </main>
    </div>
  );
}
