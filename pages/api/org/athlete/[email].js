// pages/org/athlete/[email].js
"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useAuthContext } from "@/hooks/useAuth";

export default function OrgAthleteDetailPage() {
  const router = useRouter();
  const params = useParams();
  const { user } = useAuthContext();

  // ✅ Normalize org-side roles: Organization | Admin | Trainer
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

  const athleteEmail = useMemo(() => {
    const raw = params?.email;
    if (!raw) return "";
    try {
      return decodeURIComponent(String(raw)).toLowerCase();
    } catch {
      return String(raw).toLowerCase();
    }
  }, [params]);

  // ✅ Prefer orgId from session (new canonical), but keep token for backward-compatible APIs
  const orgId = String(user?.orgId || user?.OrgId || "").trim();

  const orgToken = String(
    user?.Token ||
      user?.token ||
      user?.["Organization Token"] ||
      user?.orgToken ||
      ""
  ).trim();

  const orgName = String(
    user?.OrgName ||
      user?.["Organization Name"] ||
      user?.Organization ||
      user?.orgName ||
      // if primary org login, Name is org name; if trainer/admin, Name is member name
      (role === "organization" ? (user?.Name || user?.name || "") : "") ||
      "Organization"
  ).trim();

  const orgEmail = String(user?.Email || user?.email || "").trim();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [prescriptions, setPrescriptions] = useState([]);

  // Create form
  const [title, setTitle] = useState("");
  const [prescriptionText, setPrescriptionText] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [saveSuccess, setSaveSuccess] = useState("");

  // ✅ Guard: must be org-side user
  useEffect(() => {
    if (!user) return;
    if (!isOrgSide) router.push("/dashboard");
  }, [user, isOrgSide, router]);

  /**
   * ✅ IMPORTANT CHANGE:
   * Stop passing orgToken in query params.
   * All /api/org/* routes should rely on HttpOnly cookie + requireOrg.
   *
   * That means:
   * - fetch("/api/org/getPrescriptionsForAthlete?athleteEmail=...")
   * - and on server: requireOrg(req) gives orgId/token
   */
  const loadPrescriptions = useCallback(async () => {
    setLoading(true);
    setError("");

    if (!athleteEmail) {
      setLoading(false);
      setError("Missing athlete email in route.");
      return;
    }

    // Backward compatible warning (optional):
    // If your org APIs still need token and you're not yet reading it from cookie,
    // this will fail until you update the API route. (But this is the correct direction.)
    if (!orgToken && !orgId) {
      setLoading(false);
      setError("Missing organization session. Please log out and log back in.");
      return;
    }

    try {
      const url = `/api/org/getPrescriptionsForAthlete?athleteEmail=${encodeURIComponent(
        athleteEmail
      )}`;

      const res = await fetch(url, { method: "GET", credentials: "include" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Failed to load prescriptions.");

      setPrescriptions(Array.isArray(data.prescriptions) ? data.prescriptions : []);
    } catch (err) {
      setError(err?.message || "Failed to load prescriptions.");
    } finally {
      setLoading(false);
    }
  }, [athleteEmail, orgToken, orgId]);

  useEffect(() => {
    loadPrescriptions();
  }, [loadPrescriptions]);

  const handleCreate = async (e) => {
    e.preventDefault();
    setSaveError("");
    setSaveSuccess("");

    if (!title.trim()) return setSaveError("Please add a title.");
    if (!prescriptionText.trim()) return setSaveError("Please write the prescription.");
    if (!athleteEmail) return setSaveError("Missing athlete email.");
    if (!orgToken && !orgId) return setSaveError("Missing organization session. Please log out and log back in.");

    setSaving(true);
    try {
      // ✅ IMPORTANT CHANGE:
      // Do NOT send orgToken/orgName/createdBy from the client as "truth".
      // Server should derive org scope + creator from HttpOnly cookie (requireOrg).
      const res = await fetch("/api/org/createPrescription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          title: title.trim(),
          prescription: prescriptionText.trim(),
          athleteEmail,
          // Optional display-only values (non-trusted):
          athleteName: "",
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Failed to create prescription.");

      setSaveSuccess("Prescription created.");
      setTitle("");
      setPrescriptionText("");
      await loadPrescriptions();
    } catch (err) {
      setSaveError(err?.message || "Failed to create prescription.");
    } finally {
      setSaving(false);
      setTimeout(() => setSaveSuccess(""), 2500);
    }
  };

  const headerOrgLabel =
    role === "trainer" ? "Trainer" : role === "admin" ? "Admin" : "Organization";

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-blue-50 text-gray-900 font-sans">
      <main className="max-w-6xl mx-auto px-3 sm:px-6 py-6 sm:py-10 space-y-6">
        {/* Top bar */}
        <div className="flex items-center justify-between gap-3">
          <Link href="/org/workouts-calendar">
            <button
              type="button"
              className="px-4 py-2 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-sm font-semibold"
            >
              ← Back to Org Dashboard
            </button>
          </Link>

          <div className="text-right">
            <p className="text-xs text-gray-500">Athlete Email</p>
            <p className="text-sm font-semibold break-all">{athleteEmail || "-"}</p>
            <p className="text-[11px] text-gray-400 mt-1">
              Viewing as {headerOrgLabel}
              {orgName ? ` • ${orgName}` : ""}
              {orgEmail ? ` • ${orgEmail}` : ""}
            </p>
          </div>
        </div>

        {/* Create prescription */}
        <div className="bg-white rounded-2xl shadow-md border border-blue-100 p-5 sm:p-6">
          <h1 className="text-xl sm:text-2xl font-bold">Create Prescription</h1>
          <p className="text-xs sm:text-sm text-gray-600 mt-1">
            Saved in Airtable <span className="font-semibold">Prescriptions</span> and scoped to your org session.
          </p>

          <form onSubmit={handleCreate} className="mt-4 space-y-3">
            <div>
              <label className="block text-sm font-semibold text-gray-800 mb-1">
                Title
              </label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Example: Supplement Protocol - Week 1"
                className="w-full px-4 py-3 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#46769B]"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-800 mb-1">
                Prescription
              </label>
              <textarea
                value={prescriptionText}
                onChange={(e) => setPrescriptionText(e.target.value)}
                rows={7}
                placeholder="Write the guidance, dosage, timing, restrictions, and notes…"
                className="w-full px-4 py-3 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#46769B]"
              />
              <p className="text-[11px] text-gray-500 mt-1">
                Stored in Airtable column: <span className="font-semibold">Prescription</span>
              </p>
            </div>

            {saveError ? <p className="text-sm text-red-600">{saveError}</p> : null}
            {saveSuccess ? <p className="text-sm text-emerald-600">{saveSuccess}</p> : null}

            <button
              type="submit"
              disabled={saving}
              className={`w-full sm:w-auto px-6 py-3 rounded-xl bg-[#46769B] text-white font-semibold text-sm hover:brightness-110 transition ${
                saving ? "opacity-70 cursor-not-allowed" : ""
              }`}
            >
              {saving ? "Saving…" : "Create Prescription"}
            </button>
          </form>

          {/* Dev note (optional) */}
          {!orgId && orgToken ? (
            <div className="mt-4 text-[11px] text-amber-700 bg-amber-50 border border-amber-100 rounded-xl p-3">
              Heads up: you’re authenticated via org token only (legacy). For best security, make sure your org
              session cookie includes <span className="font-mono">orgId</span> and update org APIs to use{" "}
              <span className="font-mono">requireOrg</span>.
            </div>
          ) : null}
        </div>

        {/* History */}
        <div className="bg-white rounded-2xl shadow-md border border-blue-100 p-5 sm:p-6">
          <h2 className="text-lg sm:text-xl font-bold">Prescription History</h2>
          <p className="text-xs text-gray-600 mt-1">
            Showing prescriptions for this athlete under your organization session.
          </p>

          {loading ? (
            <p className="text-sm text-gray-600 mt-4">Loading…</p>
          ) : error ? (
            <p className="text-sm text-red-600 mt-4">{error}</p>
          ) : prescriptions.length === 0 ? (
            <div className="mt-4 p-4 rounded-2xl bg-gray-50 border border-gray-200 text-gray-700 text-sm">
              No prescriptions yet.
            </div>
          ) : (
            <div className="mt-4 grid gap-3">
              {prescriptions.map((p) => (
                <div
                  key={p.id}
                  className="p-4 rounded-2xl border border-gray-200 bg-white"
                >
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                    <div>
                      <p className="font-semibold text-sm">{p.title || "Untitled"}</p>
                      <p className="text-[11px] text-gray-500 mt-1">
                        {p.createdAt ? `Created: ${String(p.createdAt)}` : ""}
                        {p.createdBy ? ` • By: ${String(p.createdBy)}` : ""}
                      </p>
                    </div>
                    {p.organization ? (
                      <div className="text-[11px] text-gray-500">
                        Org: <span className="font-semibold">{p.organization}</span>
                      </div>
                    ) : null}
                  </div>

                  <div className="mt-3 whitespace-pre-wrap text-sm text-gray-800">
                    {p.prescription || ""}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="text-[11px] text-gray-500 text-center pb-8">
          Columns used: Athlete, Organization, Title, Prescription, Athlete Email, CreatedAt, CreatedBy
        </div>
      </main>
    </div>
  );
}
