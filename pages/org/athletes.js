// pages/org/athletes.js
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { useAuthContext } from "@/hooks/useAuth";

export default function OrgAthletesPage() {
  const router = useRouter();
  const { user } = useAuthContext();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [athletes, setAthletes] = useState([]);

  const role = useMemo(() => {
    const r = String(user?.role || user?.Role || "").toLowerCase();
    return r.includes("org") ? "organization" : r.includes("ath") ? "athlete" : "";
  }, [user]);

  const orgToken = useMemo(() => {
    return String(user?.Token || user?.token || "").trim();
  }, [user]);

  // Guard: must be org
  useEffect(() => {
    if (!user) return; // auth restore
    if (role !== "organization") router.push("/dashboard");
  }, [user, role, router]);

  const fetchAthletes = async () => {
    setLoading(true);
    setError("");

    try {
      if (!orgToken) {
        setAthletes([]);
        setError("Missing organization token on your account. Please contact support.");
        setLoading(false);
        return;
      }

      const res = await fetch(`/api/org/getAthletes?token=${encodeURIComponent(orgToken)}`, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Failed to load athletes.");

      setAthletes(Array.isArray(data?.athletes) ? data.athletes : []);
    } catch (err) {
      console.error("[org/athletes] load error:", err);
      setError(err?.message || "Failed to load athletes.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!user) return;
    if (role !== "organization") return;
    fetchAthletes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, role, orgToken]);

  const stats = useMemo(() => {
    const total = athletes.length;
    const withEmail = athletes.filter((a) => a.email).length;
    return { total, withEmail };
  }, [athletes]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-blue-50 text-gray-900 font-sans">
      <main className="max-w-6xl mx-auto px-4 py-8 space-y-6">
        {/* Header */}
        <div className="bg-white rounded-2xl shadow-md border border-blue-100 p-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold">Athletes</h1>
            <p className="text-sm text-gray-600 mt-1">
              View athletes who joined your organization using your token.
            </p>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => router.push("/org/dashboard")}
              className="px-4 py-2 rounded-xl border border-gray-200 bg-white text-sm font-semibold hover:bg-gray-50"
            >
              Back to Dashboard
            </button>

            <button
              onClick={fetchAthletes}
              className="px-4 py-2 rounded-xl bg-[#46769B] text-white text-sm font-semibold hover:brightness-110"
            >
              Refresh
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
            <p className="text-xs text-gray-500">Total Athletes</p>
            <p className="text-3xl font-extrabold text-[#46769B] mt-1">{stats.total}</p>
          </div>
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
            <p className="text-xs text-gray-500">Athletes With Email</p>
            <p className="text-3xl font-extrabold text-[#46769B] mt-1">{stats.withEmail}</p>
          </div>
        </div>

        {/* Content */}
        <div className="bg-white rounded-2xl shadow-md border border-blue-100 p-6">
          {loading ? (
            <div className="text-sm text-gray-600">Loading athletes…</div>
          ) : error ? (
            <div className="text-sm text-red-600">{error}</div>
          ) : athletes.length === 0 ? (
            <div className="text-sm text-gray-600">
              No athletes found yet. Once an athlete signs up using your token, they will show here.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500 border-b">
                    <th className="py-2 pr-3">Name</th>
                    <th className="py-2 pr-3">Email</th>
                    <th className="py-2 pr-3">Title</th>
                    <th className="py-2 pr-3">Created</th>
                    <th className="py-2 pr-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {athletes.map((a) => (
                    <tr key={a.id} className="border-b last:border-b-0">
                      <td className="py-3 pr-3 font-semibold text-gray-900">
                        {a.name || "—"}
                      </td>
                      <td className="py-3 pr-3 text-gray-700">{a.email || "—"}</td>
                      <td className="py-3 pr-3 text-gray-700">{a.title || "Athlete"}</td>
                      <td className="py-3 pr-3 text-gray-500">
                        {a.createdAt ? new Date(a.createdAt).toLocaleString() : "—"}
                      </td>
                      <td className="py-3 pr-3">
                        <button
                          onClick={() => router.push(`/org/prescriptions?athleteEmail=${encodeURIComponent(a.email || "")}`)}
                          className="px-3 py-2 rounded-xl bg-gray-900 text-white text-xs font-semibold hover:opacity-90"
                          disabled={!a.email}
                          title={!a.email ? "Missing athlete email" : "Create/view prescriptions"}
                        >
                          Prescriptions
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <p className="mt-4 text-[11px] text-gray-500">
                Security note: this list is token-scoped. We’ll tighten it further by validating the org session server-side on every API call.
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
