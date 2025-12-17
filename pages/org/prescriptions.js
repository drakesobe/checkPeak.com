// pages/org/prescriptions.js
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { useAuthContext } from "@/hooks/useAuth";

/**
 * ORG → PRESCRIPTIONS (Athlete Plans)
 *
 * What this page does:
 * 1) Loads athletes linked to the org (by org Token) via:
 *      GET /api/org/getAthletes
 * 2) Loads plan history for the selected athlete via:
 *      GET /api/org/getPrescriptionsForAthletes?athleteEmail=...
 * 3) Creates a new plan record via:
 *      POST /api/org/createPrescription
 *
 * Important:
 * - All API calls use credentials: "include" so the org auth cookie is sent.
 * - We ALSO send "x-org-token" (fallback auth) in case HttpOnly cookie is missing.
 */

/* -------------------------------------------------------------------------- */
/* 1) Update these options to match Airtable single-select choices EXACTLY     */
/* -------------------------------------------------------------------------- */

const OPTIONS = {
  // Macros (single select fields)
  calories: ["", "2500", "2800", "3000", "3200", "3500", "3800", "4000+"],
  proteinGrams: ["", "160", "180", "200", "220", "240", "260+"],
  carbsGrams: ["", "250", "300", "350", "400", "450", "500+"],
  fatsGrams: ["", "60", "70", "80", "90", "100", "110+"],
  hydrationOz: ["", "80", "100", "120", "140", "160+"],
  notesMacros: [
    "",
    "Training days: +50g carbs",
    "Rest days: -50g carbs",
    "Weigh-in week: reduce sodium",
    "Custom (see notes)",
  ],

  // Supplements (single select fields)
  proteinRecommendation: [
    "",
    "Whey Isolate",
    "Whey Concentrate",
    "Casein (night)",
    "Plant-based",
    "Mass gainer",
    "None",
  ],
  creatineRecommendation: [
    "",
    "Creatine Monohydrate (5g daily)",
    "Creatine Monohydrate (3g daily)",
    "Creapure (5g daily)",
    "None",
  ],
  bcaaRecommendation: ["", "BCAA 2:1:1", "EAA", "None"],
  electrolytesRecommendation: [
    "",
    "Low sugar electrolytes",
    "Standard electrolytes",
    "High sodium (two-a-days)",
    "None",
  ],
  notesSupplements: [
    "",
    "Only NSF Certified for Sport",
    "Avoid proprietary blends",
    "Avoid stimulants",
    "Custom (see notes)",
  ],

  // Meta (single select field)
  metaStatus: ["Active", "Draft", "Archived"],
};

/* -------------------------------------------------------------------------- */
/* Helpers                                                                     */
/* -------------------------------------------------------------------------- */

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function formatDateTime(value) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString();
}

function safeJsonParse(maybeJson) {
  if (!maybeJson || typeof maybeJson !== "string") return null;
  const s = maybeJson.trim();
  if (!s.startsWith("{") && !s.startsWith("[")) return null;
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

/**
 * Builds a readable fallback "Prescription" text.
 */
function buildPlanSummaryText(plan) {
  const lines = [];

  lines.push("SUPPLEMENTS");
  lines.push(`- Protein: ${plan.proteinRecommendation || "—"}`);
  lines.push(`- Creatine: ${plan.creatineRecommendation || "—"}`);
  lines.push(`- BCAA/EAA: ${plan.bcaaRecommendation || "—"}`);
  lines.push(`- Electrolytes: ${plan.electrolytesRecommendation || "—"}`);
  lines.push(`- Notes (Supplements): ${plan.notesSupplements || "—"}`);

  lines.push("");
  lines.push("MACROS");
  lines.push(`- Calories: ${plan.calories || "—"}`);
  lines.push(`- Protein (g): ${plan.proteinGrams || "—"}`);
  lines.push(`- Carbs (g): ${plan.carbsGrams || "—"}`);
  lines.push(`- Fat (g): ${plan.fatsGrams || "—"}`);
  lines.push(`- Hydration (oz): ${plan.hydrationOz || "—"}`);
  lines.push(`- Notes (Macros): ${plan.notesMacros || "—"}`);

  if (plan.freeformNotes?.trim()) {
    lines.push("");
    lines.push("COACH NOTES");
    lines.push(plan.freeformNotes.trim());
  }

  return lines.join("\n");
}

/**
 * Date input helper:
 * Converts YYYY-MM-DD to ISO string start of day.
 * If empty, returns "" so backend can default.
 */
function dateToISO(dateStr) {
  const s = String(dateStr || "").trim();
  if (!s) return "";
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString();
}

export default function OrgPrescriptionsPage() {
  const router = useRouter();
  const { user } = useAuthContext();

  const role = useMemo(() => {
    const r = String(user?.role || user?.Role || "").toLowerCase();
    if (r.includes("org")) return "organization";
    if (r.includes("ath")) return "athlete";
    return "";
  }, [user]);

  const orgName = useMemo(
    () => String(user?.Name || user?.name || user?.Organization || "Organization"),
    [user]
  );

  // ✅ Fallback auth header (works even if HttpOnly cookie isn’t present)
  const orgToken = useMemo(() => {
    return String(
      user?.Token || user?.token || user?.["Organization Token"] || ""
    ).trim();
  }, [user]);

  const orgAuthHeaders = useMemo(() => {
    return orgToken ? { "x-org-token": orgToken } : {};
  }, [orgToken]);

  /* ------------------------------------------------------------------------ */
  /* State                                                                    */
  /* ------------------------------------------------------------------------ */

  // Athlete list
  const [athletes, setAthletes] = useState([]);
  const [athleteSearch, setAthleteSearch] = useState("");
  const [selectedAthleteEmail, setSelectedAthleteEmail] = useState("");

  // Plans/history
  const [prescriptions, setPrescriptions] = useState([]);

  // Page status
  const [loading, setLoading] = useState(true);
  const [loadingAthletes, setLoadingAthletes] = useState(false);
  const [loadingPrescriptions, setLoadingPrescriptions] = useState(false);
  const [error, setError] = useState("");

  // UI view mode
  const [view, setView] = useState("builder"); // builder | history

  // Builder form state
  const [title, setTitle] = useState("Nutrition + Supplements Plan");
  const [createLoading, setCreateLoading] = useState(false);

  // Structured plan fields (match your createPrescription.js)
  const [structured, setStructured] = useState({
    // Macros (single select columns)
    calories: "",
    proteinGrams: "",
    carbsGrams: "",
    fatsGrams: "",
    hydrationOz: "",
    notesMacros: "",

    // Supplements (single select columns)
    proteinRecommendation: "",
    creatineRecommendation: "",
    bcaaRecommendation: "",
    electrolytesRecommendation: "",
    notesSupplements: "",

    // Meta
    metaStatus: "Active",
    metaEffectiveDate: "", // date input (YYYY-MM-DD)

    // Extra freeform notes (NOT single select — stored inside Prescription text)
    freeformNotes: "",
  });

  /* ------------------------------------------------------------------------ */
  /* Guards                                                                   */
  /* ------------------------------------------------------------------------ */

  useEffect(() => {
    if (!user) return;
    if (role && role !== "organization") {
      router.push("/dashboard");
    }
  }, [user, role, router]);

  // Allow direct linking: /org/prescriptions?athleteEmail=...
  useEffect(() => {
    const q = router?.query?.athleteEmail;
    if (typeof q === "string" && q.includes("@")) {
      setSelectedAthleteEmail(normalizeEmail(q));
    }
  }, [router?.query?.athleteEmail]);

  /* ------------------------------------------------------------------------ */
  /* API Calls                                                                */
  /* ------------------------------------------------------------------------ */

  const fetchAthletes = async () => {
    setLoadingAthletes(true);
    setError("");

    const res = await fetch("/api/org/getAthletes", {
      method: "GET",
      credentials: "include",
      headers: {
        ...orgAuthHeaders, // ✅ fallback auth header
      },
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = data?.error || data?.airtable?.message || "Failed to load athletes.";
      setLoadingAthletes(false);
      throw new Error(msg);
    }

    const list = Array.isArray(data?.athletes) ? data.athletes : [];
    setAthletes(list);

    // Auto-select first athlete if none selected
    if (!selectedAthleteEmail) {
      const first = list.find((a) => a?.email);
      if (first?.email) setSelectedAthleteEmail(normalizeEmail(first.email));
    }

    setLoadingAthletes(false);
  };

  const fetchPrescriptionsForAthlete = async (athleteEmail) => {
    const email = normalizeEmail(athleteEmail);
    if (!email) {
      setPrescriptions([]);
      return;
    }

    setLoadingPrescriptions(true);
    setError("");

    const res = await fetch(
      `/api/org/getPrescriptionsForAthlete?athleteEmail=${encodeURIComponent(email)}`,
      {
        method: "GET",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          ...orgAuthHeaders, // ✅ fallback auth header
        },
      }
    );

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg =
        data?.error || data?.airtable?.message || "Failed to load prescriptions.";
      setLoadingPrescriptions(false);
      throw new Error(msg);
    }

    setPrescriptions(Array.isArray(data?.prescriptions) ? data.prescriptions : []);
    setLoadingPrescriptions(false);
  };

  const refreshAll = async () => {
    setLoading(true);
    setError("");

    try {
      await fetchAthletes();

      const email =
        (typeof router?.query?.athleteEmail === "string" && router.query.athleteEmail) ||
        selectedAthleteEmail;

      if (email) await fetchPrescriptionsForAthlete(email);
      else setPrescriptions([]);
    } catch (err) {
      console.error("[org/prescriptions] refreshAll error:", err);
      setError(err?.message || "Failed to load prescriptions.");
    } finally {
      setLoading(false);
    }
  };

  /* ------------------------------------------------------------------------ */
  /* Lifecycle                                                                */
  /* ------------------------------------------------------------------------ */

  useEffect(() => {
    if (!user) return;
    if (role !== "organization") return;
    refreshAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, role, orgToken]);

  useEffect(() => {
    if (!user) return;
    if (role !== "organization") return;

    (async () => {
      try {
        if (!selectedAthleteEmail) {
          setPrescriptions([]);
          return;
        }
        await fetchPrescriptionsForAthlete(selectedAthleteEmail);
      } catch (err) {
        setError(err?.message || "Failed to load prescriptions.");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedAthleteEmail]);

  /* ------------------------------------------------------------------------ */
  /* Builder Handlers                                                         */
  /* ------------------------------------------------------------------------ */

  const onChange = (key, value) => {
    setStructured((prev) => ({ ...prev, [key]: value }));
  };

  const resetBuilder = () => {
    setTitle("Nutrition + Supplements Plan");
    setStructured({
      calories: "",
      proteinGrams: "",
      carbsGrams: "",
      fatsGrams: "",
      hydrationOz: "",
      notesMacros: "",

      proteinRecommendation: "",
      creatineRecommendation: "",
      bcaaRecommendation: "",
      electrolytesRecommendation: "",
      notesSupplements: "",

      metaStatus: "Active",
      metaEffectiveDate: "",

      freeformNotes: "",
    });
  };

  const validateBuilder = () => {
    const athleteEmail = normalizeEmail(selectedAthleteEmail);
    if (!athleteEmail) return "Select an athlete first.";

    const hasAny =
      structured.proteinRecommendation ||
      structured.creatineRecommendation ||
      structured.bcaaRecommendation ||
      structured.electrolytesRecommendation ||
      structured.notesSupplements ||
      structured.calories ||
      structured.proteinGrams ||
      structured.carbsGrams ||
      structured.fatsGrams ||
      structured.hydrationOz ||
      structured.notesMacros ||
      structured.freeformNotes?.trim();

    if (!hasAny) return "Add at least one recommendation (supplements, macros, or notes).";
    return "";
  };

  const createPlan = async (e) => {
    e.preventDefault();
    setError("");

    const msg = validateBuilder();
    if (msg) {
      setError(msg);
      return;
    }

    const athleteEmail = normalizeEmail(selectedAthleteEmail);

    setCreateLoading(true);
    try {
      // Fallback long-text plan summary
      const summaryText = buildPlanSummaryText(structured);

      const res = await fetch("/api/org/createPrescription", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          ...orgAuthHeaders, // ✅ fallback auth header
        },
        body: JSON.stringify({
          athleteEmail,
          organizationName: orgName,
          title: title.trim() || "Nutrition + Supplements Plan",
          prescription: summaryText,
          createdBy: user?.Email || user?.email || "",

          // ✅ Structured keys match your UPDATED createPrescription.js mapping
          structured: {
            // Macros (single select fields)
            calories: structured.calories || null,
            proteinGrams: structured.proteinGrams || null,
            carbsGrams: structured.carbsGrams || null,
            fatsGrams: structured.fatsGrams || null,
            hydrationOz: structured.hydrationOz || null,
            notesMacros: structured.notesMacros || null,

            // Supplements (single select fields)
            proteinRecommendation: structured.proteinRecommendation || null,
            creatineRecommendation: structured.creatineRecommendation || null,
            bcaaRecommendation: structured.bcaaRecommendation || null,
            electrolytesRecommendation: structured.electrolytesRecommendation || null,
            notesSupplements: structured.notesSupplements || null,

            // Meta
            metaStatus: structured.metaStatus || "Active",
            metaEffectiveDate: dateToISO(structured.metaEffectiveDate) || "",
          },
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const errMsg = data?.error || data?.airtable?.message || "Failed to create plan.";
        throw new Error(errMsg);
      }

      resetBuilder();
      await fetchPrescriptionsForAthlete(athleteEmail);
      setView("history");
    } catch (err) {
      console.error("[org/prescriptions] createPlan error:", err);
      setError(err?.message || "Failed to create plan.");
    } finally {
      setCreateLoading(false);
    }
  };

  /* ------------------------------------------------------------------------ */
  /* Derived UI                                                               */
  /* ------------------------------------------------------------------------ */

  const selectedAthlete = useMemo(() => {
    const email = normalizeEmail(selectedAthleteEmail);
    return athletes.find((a) => normalizeEmail(a?.email) === email) || null;
  }, [athletes, selectedAthleteEmail]);

  const filteredAthletes = useMemo(() => {
    const q = String(athleteSearch || "").trim().toLowerCase();
    if (!q) return athletes;

    return athletes.filter((a) => {
      const name = String(a?.name || "").toLowerCase();
      const email = String(a?.email || "").toLowerCase();
      return name.includes(q) || email.includes(q);
    });
  }, [athletes, athleteSearch]);

  const historyCards = useMemo(() => {
    return (prescriptions || []).map((p) => ({
      ...p,
      parsed: safeJsonParse(p?.prescription),
    }));
  }, [prescriptions]);

  /* ------------------------------------------------------------------------ */
  /* Styles                                                                   */
  /* ------------------------------------------------------------------------ */

  const inputBase =
    "w-full px-4 py-3 rounded-xl border border-gray-300 bg-white text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#46769B]";

  const selectBase =
    "w-full px-4 py-3 rounded-xl border border-gray-300 bg-white text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#46769B]";

  /* ------------------------------------------------------------------------ */
  /* Render                                                                   */
  /* ------------------------------------------------------------------------ */

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-blue-50 text-gray-900 font-sans">
      <main className="max-w-6xl mx-auto px-4 py-8 space-y-6">
        {/* Header */}
        <div className="bg-white rounded-2xl shadow-md border border-blue-100 p-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold">Organization Prescriptions</h1>
            <p className="text-sm text-gray-600 mt-1">
              Build supplements + macros plans for each athlete under your token.
            </p>
            <p className="text-[11px] text-gray-500 mt-2">
              Logged in as <span className="font-semibold">{orgName}</span>
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <button
              onClick={() => router.push("/org/dashboard")}
              className="px-4 py-2 rounded-xl border border-gray-200 bg-white text-sm font-semibold hover:bg-gray-50"
              type="button"
            >
              Dashboard
            </button>
            <button
              onClick={() => router.push("/org/athletes")}
              className="px-4 py-2 rounded-xl border border-gray-200 bg-white text-sm font-semibold hover:bg-gray-50"
              type="button"
            >
              Athletes
            </button>
            <button
              onClick={refreshAll}
              className="px-4 py-2 rounded-xl bg-[#46769B] text-white text-sm font-semibold hover:brightness-110"
              type="button"
            >
              Refresh
            </button>
          </div>
        </div>

        {/* Status */}
        {(loading || loadingAthletes || loadingPrescriptions) && (
          <div className="bg-white rounded-2xl shadow-md border border-blue-100 p-4">
            <p className="text-sm text-gray-600">Loading…</p>
          </div>
        )}

        {error && (
          <div className="bg-white rounded-2xl shadow-md border border-red-200 p-4">
            <p className="text-sm text-red-600 font-medium">{error}</p>
            <p className="text-[11px] text-gray-500 mt-2">
              If you see <span className="font-semibold">Not authenticated</span>, confirm you:
              (1) logged in as <span className="font-semibold">Organization</span>, and
              (2) requests include <span className="font-semibold">credentials: "include"</span>.
              This page does include it on all API calls.
            </p>
            <p className="text-[11px] text-gray-500 mt-1">
              We also send <span className="font-semibold">x-org-token</span> as a fallback.
            </p>
          </div>
        )}

        {/* Layout: Left roster + Right content */}
        <div className="grid lg:grid-cols-12 gap-6">
          {/* Left: Athlete roster */}
          <aside className="lg:col-span-4 bg-white rounded-2xl shadow-md border border-blue-100 p-5 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold">Athletes</h2>
                <p className="text-xs text-gray-500 mt-1">
                  These athletes used your org token.
                </p>
              </div>
              <span className="text-xs text-gray-500">
                {filteredAthletes.length}/{athletes.length}
              </span>
            </div>

            <input
              className={inputBase}
              placeholder="Search name or email…"
              value={athleteSearch}
              onChange={(e) => setAthleteSearch(e.target.value)}
            />

            <div className="space-y-2 max-h-[420px] overflow-auto pr-1">
              {filteredAthletes.length === 0 && (
                <div className="rounded-xl bg-gray-50 border border-gray-200 p-3">
                  <p className="text-sm text-gray-700 font-semibold">No athletes found</p>
                  <p className="text-xs text-gray-500 mt-1">
                    Try clearing the search or confirm athletes signed up with your token.
                  </p>
                </div>
              )}

              {filteredAthletes.map((a) => {
                const email = normalizeEmail(a?.email);
                const isActive = email && email === normalizeEmail(selectedAthleteEmail);

                return (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => email && setSelectedAthleteEmail(email)}
                    className={`w-full text-left rounded-xl border p-3 transition ${
                      isActive
                        ? "border-[#46769B] bg-blue-50"
                        : "border-gray-200 bg-white hover:bg-gray-50"
                    }`}
                    disabled={!email}
                  >
                    <p className="text-sm font-semibold text-gray-900">
                      {a?.name || "Athlete"}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {email || "Missing email"}
                    </p>
                    {a?.createdAt && (
                      <p className="text-[11px] text-gray-400 mt-1">
                        Joined: {formatDateTime(a.createdAt)}
                      </p>
                    )}
                  </button>
                );
              })}
            </div>
          </aside>

          {/* Right: Builder/History */}
          <section className="lg:col-span-8 space-y-6">
            {/* Selected athlete header + view toggle */}
            <div className="bg-white rounded-2xl shadow-md border border-blue-100 p-5">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <h2 className="text-lg font-bold">Selected Athlete</h2>
                  {selectedAthlete ? (
                    <p className="text-sm text-gray-700 mt-1">
                      <span className="font-semibold">{selectedAthlete.name || "Athlete"}</span>{" "}
                      <span className="text-gray-500">({normalizeEmail(selectedAthlete.email)})</span>
                    </p>
                  ) : (
                    <p className="text-sm text-gray-500 mt-1">Choose an athlete to begin.</p>
                  )}
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setView("builder")}
                    className={`px-4 py-2 rounded-xl text-sm font-semibold border ${
                      view === "builder"
                        ? "bg-[#46769B] text-white border-[#46769B]"
                        : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50"
                    }`}
                  >
                    Builder
                  </button>
                  <button
                    type="button"
                    onClick={() => setView("history")}
                    className={`px-4 py-2 rounded-xl text-sm font-semibold border ${
                      view === "history"
                        ? "bg-[#46769B] text-white border-[#46769B]"
                        : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50"
                    }`}
                  >
                    History
                  </button>
                </div>
              </div>

              <div className="mt-4 text-[11px] text-gray-500">
                Tip: Because your Airtable macro/supp fields are{" "}
                <span className="font-semibold">Single Select</span>, the values you choose must match
                the Airtable dropdown options exactly (including spelling/case).
              </div>
            </div>

            {/* Builder */}
            {view === "builder" && (
              <div className="bg-white rounded-2xl shadow-md border border-blue-100 p-6 space-y-6">
                <div>
                  <h3 className="text-lg font-bold">Create Plan</h3>
                  <p className="text-sm text-gray-600 mt-1">
                    Recommend supplements + macro targets for this athlete.
                  </p>
                </div>

                <form onSubmit={createPlan} className="space-y-6">
                  {/* Title + Meta */}
                  <div className="grid md:grid-cols-3 gap-4">
                    <div className="md:col-span-2">
                      <p className="text-xs text-gray-500 mb-2">Plan Title</p>
                      <input
                        className={inputBase}
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="e.g. In-season maintenance plan"
                      />
                    </div>

                    <div>
                      <p className="text-xs text-gray-500 mb-2">Meta Status</p>
                      <select
                        className={selectBase}
                        value={structured.metaStatus}
                        onChange={(e) => onChange("metaStatus", e.target.value)}
                      >
                        {OPTIONS.metaStatus.map((opt) => (
                          <option key={opt} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="md:col-span-3">
                      <p className="text-xs text-gray-500 mb-2">Meta Effective Date</p>
                      <input
                        type="date"
                        className={inputBase}
                        value={structured.metaEffectiveDate}
                        onChange={(e) => onChange("metaEffectiveDate", e.target.value)}
                      />
                      <p className="text-[11px] text-gray-500 mt-2">
                        If left blank, the API will default to “now”.
                      </p>
                    </div>
                  </div>

                  {/* Supplements */}
                  <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4 space-y-4">
                    <div>
                      <h4 className="font-semibold">Supplements</h4>
                      <p className="text-xs text-gray-500 mt-1">
                        Choose values that match Airtable single-select options.
                      </p>
                    </div>

                    <div className="grid md:grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs text-gray-500 mb-2">Protein Recommendation</p>
                        <select
                          className={selectBase}
                          value={structured.proteinRecommendation}
                          onChange={(e) => onChange("proteinRecommendation", e.target.value)}
                        >
                          {OPTIONS.proteinRecommendation.map((opt) => (
                            <option key={opt} value={opt}>
                              {opt || "Select…"}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <p className="text-xs text-gray-500 mb-2">Creatine Recommendation</p>
                        <select
                          className={selectBase}
                          value={structured.creatineRecommendation}
                          onChange={(e) => onChange("creatineRecommendation", e.target.value)}
                        >
                          {OPTIONS.creatineRecommendation.map((opt) => (
                            <option key={opt} value={opt}>
                              {opt || "Select…"}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <p className="text-xs text-gray-500 mb-2">BCAA/EAA Recommendation</p>
                        <select
                          className={selectBase}
                          value={structured.bcaaRecommendation}
                          onChange={(e) => onChange("bcaaRecommendation", e.target.value)}
                        >
                          {OPTIONS.bcaaRecommendation.map((opt) => (
                            <option key={opt} value={opt}>
                              {opt || "Select…"}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <p className="text-xs text-gray-500 mb-2">Electrolytes Recommendation</p>
                        <select
                          className={selectBase}
                          value={structured.electrolytesRecommendation}
                          onChange={(e) => onChange("electrolytesRecommendation", e.target.value)}
                        >
                          {OPTIONS.electrolytesRecommendation.map((opt) => (
                            <option key={opt} value={opt}>
                              {opt || "Select…"}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="md:col-span-2">
                        <p className="text-xs text-gray-500 mb-2">Notes (Supplements)</p>
                        <select
                          className={selectBase}
                          value={structured.notesSupplements}
                          onChange={(e) => onChange("notesSupplements", e.target.value)}
                        >
                          {OPTIONS.notesSupplements.map((opt) => (
                            <option key={opt} value={opt}>
                              {opt || "Select…"}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Macros */}
                  <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4 space-y-4">
                    <div>
                      <h4 className="font-semibold">Macros</h4>
                      <p className="text-xs text-gray-500 mt-1">
                        Calories / grams / hydration stored as single-select values (per your setup).
                      </p>
                    </div>

                    <div className="grid md:grid-cols-3 gap-4">
                      <div>
                        <p className="text-xs text-gray-500 mb-2">Calories</p>
                        <select
                          className={selectBase}
                          value={structured.calories}
                          onChange={(e) => onChange("calories", e.target.value)}
                        >
                          {OPTIONS.calories.map((opt) => (
                            <option key={opt} value={opt}>
                              {opt || "Select…"}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <p className="text-xs text-gray-500 mb-2">Protein (g)</p>
                        <select
                          className={selectBase}
                          value={structured.proteinGrams}
                          onChange={(e) => onChange("proteinGrams", e.target.value)}
                        >
                          {OPTIONS.proteinGrams.map((opt) => (
                            <option key={opt} value={opt}>
                              {opt || "Select…"}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <p className="text-xs text-gray-500 mb-2">Carbs (g)</p>
                        <select
                          className={selectBase}
                          value={structured.carbsGrams}
                          onChange={(e) => onChange("carbsGrams", e.target.value)}
                        >
                          {OPTIONS.carbsGrams.map((opt) => (
                            <option key={opt} value={opt}>
                              {opt || "Select…"}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <p className="text-xs text-gray-500 mb-2">Fat (g)</p>
                        <select
                          className={selectBase}
                          value={structured.fatsGrams}
                          onChange={(e) => onChange("fatsGrams", e.target.value)}
                        >
                          {OPTIONS.fatsGrams.map((opt) => (
                            <option key={opt} value={opt}>
                              {opt || "Select…"}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <p className="text-xs text-gray-500 mb-2">Hydration (oz)</p>
                        <select
                          className={selectBase}
                          value={structured.hydrationOz}
                          onChange={(e) => onChange("hydrationOz", e.target.value)}
                        >
                          {OPTIONS.hydrationOz.map((opt) => (
                            <option key={opt} value={opt}>
                              {opt || "Select…"}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="md:col-span-3">
                        <p className="text-xs text-gray-500 mb-2">Notes (Macros)</p>
                        <select
                          className={selectBase}
                          value={structured.notesMacros}
                          onChange={(e) => onChange("notesMacros", e.target.value)}
                        >
                          {OPTIONS.notesMacros.map((opt) => (
                            <option key={opt} value={opt}>
                              {opt || "Select…"}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Freeform coach notes */}
                  <div>
                    <p className="text-xs text-gray-500 mb-2">Coach Notes (optional)</p>
                    <textarea
                      className="w-full min-h-[140px] px-4 py-3 rounded-xl border border-gray-300 bg-white text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#46769B]"
                      value={structured.freeformNotes}
                      onChange={(e) => onChange("freeformNotes", e.target.value)}
                      placeholder="Examples: lactose sensitive, practice days increase carbs, hydration reminders, approved brands only, etc."
                    />
                    <p className="text-[11px] text-gray-500 mt-2">
                      This text is saved inside the long-text{" "}
                      <span className="font-semibold">Prescription</span> field as a readable summary.
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="grid sm:grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={resetBuilder}
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white text-sm font-semibold hover:bg-gray-50"
                    >
                      Reset
                    </button>

                    <button
                      type="submit"
                      disabled={createLoading || !selectedAthleteEmail}
                      className={`w-full px-4 py-3 rounded-xl bg-[#46769B] text-white text-sm font-semibold hover:brightness-110 transition ${
                        createLoading || !selectedAthleteEmail ? "opacity-70 cursor-not-allowed" : ""
                      }`}
                    >
                      {createLoading ? "Saving…" : "Save Plan"}
                    </button>
                  </div>

                  <div className="text-[11px] text-gray-500">
                    Saving creates a new Airtable record per plan (great for history/versioning).
                    Next upgrade: “Active plan” controls + edit/overwrite flow.
                  </div>
                </form>
              </div>
            )}

            {/* History */}
            {view === "history" && (
              <div className="bg-white rounded-2xl shadow-md border border-blue-100 p-6 space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-bold">Plan History</h3>
                    <p className="text-sm text-gray-600 mt-1">
                      Plans created for this athlete (newest first).
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => fetchPrescriptionsForAthlete(selectedAthleteEmail)}
                    className="px-4 py-2 rounded-xl border border-gray-200 bg-white text-sm font-semibold hover:bg-gray-50"
                    disabled={!selectedAthleteEmail}
                  >
                    Refresh
                  </button>
                </div>

                {!selectedAthleteEmail && (
                  <p className="text-sm text-gray-600">
                    Select an athlete to view plan history.
                  </p>
                )}

                {selectedAthleteEmail && historyCards.length === 0 && (
                  <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                    <p className="text-sm text-gray-700 font-medium">No plans yet.</p>
                    <p className="text-[11px] text-gray-500 mt-1">
                      Switch to Builder to create the first plan.
                    </p>
                  </div>
                )}

                <div className="space-y-3">
                  {historyCards.map((p) => (
                    <div
                      key={p.id}
                      className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-bold text-gray-900">
                            {p.title || "Plan"}
                          </p>
                          <p className="text-[11px] text-gray-500 mt-1">
                            Created: {formatDateTime(p.createdAt)}{" "}
                            {p.createdBy ? ` • By: ${p.createdBy}` : ""}
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            setTitle(p.title || "Nutrition + Supplements Plan");
                            setStructured((prev) => ({
                              ...prev,
                              freeformNotes: p.prescription || "",
                            }));
                            setView("builder");
                          }}
                          className="px-3 py-2 rounded-xl border border-gray-200 bg-white text-xs font-semibold hover:bg-gray-50"
                        >
                          Copy Notes
                        </button>
                      </div>

                      <div className="mt-3">
                        <pre className="whitespace-pre-wrap text-sm text-gray-800 bg-gray-50 border border-gray-200 rounded-xl p-3">
                          {p.prescription || ""}
                        </pre>
                      </div>

                      <div className="mt-3 text-[11px] text-gray-500">
                        Once you decide to render Airtable single-select fields back to the UI,
                        we’ll update <span className="font-semibold">getPrescriptionsForAthlete</span>{" "}
                        to return those fields too.
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
