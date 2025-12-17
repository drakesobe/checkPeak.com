// pages/org/athlete/[email].js
"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useAuthContext } from "@/hooks/useAuth";

export default function OrgAthleteDetailPage() {
  const router = useRouter();
  const params = useParams();
  const { user } = useAuthContext();

  const athleteEmail = useMemo(() => {
    const raw = params?.email;
    if (!raw) return "";
    try {
      return decodeURIComponent(String(raw)).toLowerCase();
    } catch {
      return String(raw).toLowerCase();
    }
  }, [params]);

  const orgToken =
    user?.Token ||
    user?.token ||
    user?.["Organization Token"] ||
    user?.orgToken ||
    "";

  const orgName =
    user?.OrgName ||
    user?.Organization ||
    user?.orgName ||
    user?.Name ||
    "Organization";

  const orgEmail = user?.Email || user?.email || "";

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [prescriptions, setPrescriptions] = useState([]);

  // Create form
  const [title, setTitle] = useState("");
  const [prescriptionText, setPrescriptionText] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [saveSuccess, setSaveSuccess] = useState("");

  // Guard: must be org user
  useEffect(() => {
    if (!user) return;
    const role = String(user?.role || user?.Role || "").toLowerCase();
    if (role && !role.includes("org")) {
      router.push("/dashboard");
    }
  }, [user, router]);

  const loadPrescriptions = async () => {
    setLoading(true);
    setError("");

    if (!orgToken) {
      setLoading(false);
      setError("Missing organization token on your account.");
      return;
    }
    if (!athleteEmail) {
      setLoading(false);
      setError("Missing athlete email in route.");
      return;
    }

    try {
      const url = `/api/org/getPrescriptionsForAthlete?orgToken=${encodeURIComponent(
        orgToken
      )}&athleteEmail=${encodeURIComponent(athleteEmail)}`;

      const res = await fetch(url, { method: "GET" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Failed to load prescriptions.");

      setPrescriptions(Array.isArray(data.prescriptions) ? data.prescriptions : []);
    } catch (err) {
      setError(err?.message || "Failed to load prescriptions.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPrescriptions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgToken, athleteEmail]);

  const handleCreate = async (e) => {
    e.preventDefault();
    setSaveError("");
    setSaveSuccess("");

    if (!title.trim()) {
      setSaveError("Please add a title.");
      return;
    }
    if (!prescriptionText.trim()) {
      setSaveError("Please write the prescription.");
      return;
    }
    if (!orgToken) {
      setSaveError("Missing organization token on your account.");
      return;
    }
    if (!athleteEmail) {
      setSaveError("Missing athlete email.");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/org/createPrescription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          prescription: prescriptionText.trim(),
          orgToken: orgToken,
          athleteEmail: athleteEmail,
          athleteName: "", // optional (you can fill from athlete list later)
          organizationName: orgName,
          createdBy: orgEmail || orgName,
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

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-blue-50 text-gray-900 font-sans">
      <main className="max-w-6xl mx-auto px-3 sm:px-6 py-6 sm:py-10 space-y-6">
        {/* Top bar */}
        <div className="flex items-center justify-between gap-3">
          <Link href="/org/dashboard">
            <button
              type="button"
              className="px-4 py-2 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-sm font-semibold"
            >
              ← Back to Org Dashboard
            </button>
          </Link>

          <div className="text-right">
            <p className="text-xs text-gray-500">Athlete Email</p>
            <p className="text-sm font-semibold break-all">{athleteEmail || "—"}</p>
          </div>
        </div>

        {/* Create prescription */}
        <div className="bg-white rounded-2xl shadow-md border border-blue-100 p-5 sm:p-6">
          <h1 className="text-xl sm:text-2xl font-bold">
            Create Prescription
          </h1>
          <p className="text-xs sm:text-sm text-gray-600 mt-1">
            This saves to your Airtable table <span className="font-semibold">Prescriptions</span> and is scoped to your org token.
          </p>

          <form onSubmit={handleCreate} className="mt-4 space-y-3">
            <div>
              <label className="block text-sm font-semibold text-gray-800 mb-1">
                Title
              </label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Example: Supplement Protocol — Week 1"
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

            {saveError ? (
              <p className="text-sm text-red-600">{saveError}</p>
            ) : null}
            {saveSuccess ? (
              <p className="text-sm text-emerald-600">{saveSuccess}</p>
            ) : null}

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
        </div>

        {/* History */}
        <div className="bg-white rounded-2xl shadow-md border border-blue-100 p-5 sm:p-6">
          <h2 className="text-lg sm:text-xl font-bold">Prescription History</h2>
          <p className="text-xs text-gray-600 mt-1">
            Showing prescriptions for this athlete under your organization token.
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
          Columns used: Athlete, Organization, Title, Prescription, Organization Token, Athlete Email, CreatedAt, CreatedBy
        </div>
      </main>
    </div>
  );
}
