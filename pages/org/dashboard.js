// pages/org/dashboard.js
import { useEffect } from "react";
import { useRouter } from "next/router";
import { useAuthContext } from "@/hooks/useAuth";

export default function OrgDashboard() {
  const router = useRouter();
  const { user, logout } = useAuthContext();

  useEffect(() => {
    // If not logged in, send home
    if (!user) {
      router.push("/");
      return;
    }

    // If logged in but not an org, send to athlete dashboard
    const role = String(user?.role || user?.Role || "").toLowerCase();
    if (!role.includes("org")) {
      router.push("/dashboard");
      return;
    }
  }, [user, router]);

  const orgName = user?.Name || "Organization";
  const orgEmail = user?.Email || "";
  const token = user?.Token || "";

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-blue-50 text-gray-900 font-sans">
      <main className="max-w-6xl mx-auto px-4 py-8">
        <div className="bg-white rounded-2xl shadow-md border border-blue-100 p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold">{orgName} Dashboard</h1>
              <p className="text-sm text-gray-600 mt-1">
                Logged in as <span className="font-semibold">{orgEmail}</span>
              </p>
            </div>

            <button
              onClick={() => {
                logout?.();
                router.push("/");
              }}
              className="px-4 py-2 rounded-xl bg-gray-900 text-white text-sm font-semibold hover:opacity-90"
            >
              Log out
            </button>
          </div>

          <div className="mt-6 rounded-2xl border border-gray-200 bg-gray-50 p-4">
            <p className="text-xs text-gray-500">Organization Token</p>
            <p className="font-mono text-sm font-semibold break-all mt-1">
              {token || "— missing Token on session user —"}
            </p>
            <p className="text-[11px] text-gray-500 mt-2">
              Athletes use this token during signup to join your organization.
            </p>
          </div>

          <div className="mt-6 text-sm text-gray-700">
            Next step: we’ll add the athlete list + prescription creation UI here.
          </div>
        </div>
      </main>
    </div>
  );
}
