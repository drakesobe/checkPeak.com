// pages/org/dashboard.js
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthContext } from "@/hooks/useAuth";

export default function OrgDashboard() {
  const router = useRouter();
  const { user, logout } = useAuthContext();
  const [copied, setCopied] = useState(false);

  // ✅ Updated: org-side roles include Organization + Admin + Trainer
  const role = useMemo(() => {
    const raw = String(user?.role || user?.Role || "").trim().toLowerCase();
    if (!raw) return "";
    if (raw === "organization") return "organization";
    if (raw === "admin") return "admin";
    if (raw === "trainer") return "trainer";

    if (raw.includes("org")) return "organization";
    if (raw.includes("admin")) return "admin";
    if (raw.includes("train")) return "trainer";
    if (raw.includes("ath")) return "athlete";
    return raw;
  }, [user]);

  const isOrgSide = role === "organization" || role === "admin" || role === "trainer";

  useEffect(() => {
    // If not logged in, bounce home
    if (!user) return;

    // ✅ Only bounce if NOT org-side
    if (!isOrgSide) router.push("/dashboard");
  }, [user, isOrgSide, router]);

  if (!user) return null;

  const orgName =
    user?.OrgName ||
    user?.["Organization Name"] ||
    user?.Organization ||
    // Org primary account uses Name; trainer/admin also has Name but it's member name.
    (role === "organization" ? (user?.Name || user?.name) : "") ||
    "Organization";

  const orgEmail = user?.Email || user?.email || "";

  // ✅ Token should exist for org-side users (OrgMembers get Token via lookupUser)
  const token = String(user?.Token || user?.token || user?.["Organization Token"] || "").trim();

  const handleLogout = async () => {
    try {
      await logout?.();
    } finally {
      router.push("/");
    }
  };

  const copyToken = async () => {
    if (!token) return;
    try {
      await navigator.clipboard.writeText(token);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      // no-op (clipboard can fail on some browsers)
    }
  };

  const roleLabel =
    role === "organization" ? "Organization" : role === "admin" ? "Admin" : role === "trainer" ? "Trainer" : "Member";

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-blue-50 text-gray-900 font-sans">
      <main className="max-w-5xl mx-auto px-4 py-10">
        <div className="bg-white rounded-2xl shadow-md border border-blue-100 p-6 space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold">{orgName} — Dashboard</h1>
              <p className="text-sm text-gray-600 mt-1">
                Logged in as <span className="font-semibold">{orgEmail}</span>{" "}
                <span className="text-gray-400">•</span>{" "}
                <span className="font-semibold">{roleLabel}</span>
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
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs text-gray-500">Organization Token</p>
                <p className="font-mono text-sm font-semibold break-all mt-1">
                  {token || "— (token missing from session)"}
                </p>
                <p className="text-[11px] text-gray-500 mt-2">
                  Athletes use this token to connect to your organization.
                </p>
              </div>

              <button
                type="button"
                onClick={copyToken}
                disabled={!token}
                className={`shrink-0 px-3 py-2 rounded-xl text-sm font-semibold border transition ${
                  token
                    ? "bg-white border-gray-200 hover:bg-gray-50"
                    : "bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed"
                }`}
                aria-label="Copy organization token"
              >
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
          </div>

          <div className="text-sm text-gray-700">
            Next: show athletes, assign Daily Workouts, and collect completion evidence.
          </div>
        </div>
      </main>
    </div>
  );
}
