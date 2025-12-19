// pages/org/prescriptions.js
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/router";
import { useAuthContext } from "@/hooks/useAuth";

import WheelSelect from "@/components/WheelSelect";
import { rangeOptions } from "@/lib/rangeOptions";

/**
 * ORG → PRESCRIPTIONS
 *
 * Adds Plan Templates:
 * - Save current builder as a template (POST /api/org/createPlanTemplate)
 * - Load templates for org token (GET /api/org/getPlanTemplates)
 * - Apply a template to builder (fills structured fields)
 *
 * Speed mode for coaches:
 * - Save & Next (auto-advance through filtered roster)
 * - Keyboard: Enter = Save & Next, Ctrl/Cmd+Enter = Save
 * - Keeps builder values by default (so you can fly through 100 athletes)
 */

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function formatDateTime(value) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString();
}

function dateToISO(dateStr) {
  const s = String(dateStr || "").trim();
  if (!s) return "";
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString();
}

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

const DEFAULT_STRUCTURED = {
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
};

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

  // Prefer org token from user context; used for template scoping
  const orgToken = useMemo(() => {
    return String(user?.Token || user?.token || user?.["Organization Token"] || "").trim();
  }, [user]);

  const orgAuthHeaders = useMemo(() => {
    // Your org APIs typically read x-org-token; keep it consistent.
    return orgToken ? { "x-org-token": orgToken } : {};
  }, [orgToken]);

  /* ------------------------------------------------------------------------ */
  /* Wheel “Unlimited-ish” Options                                            */
  /* ------------------------------------------------------------------------ */

  const WHEEL = useMemo(() => {
    const calories = rangeOptions(0, 5000, 5);
    const grams = rangeOptions(0, 400, 1);
    const hydration = rangeOptions(0, 300, 1);

    const proteinRec = [
      "",
      "Whey Isolate",
      "Whey Concentrate",
      "Casein (night)",
      "Plant-based",
      "Mass gainer",
      "Hydrolyzed whey",
      "None",
    ];

    const creatineRec = [
      "",
      "Creatine Monohydrate (3g daily)",
      "Creatine Monohydrate (5g daily)",
      "Creapure (5g daily)",
      "Loading phase (20g/day x 5–7d) then 5g/day",
      "None",
    ];

    const bcaaRec = ["", "BCAA 2:1:1", "EAA", "EAA (intra-workout)", "None"];

    const electrolytesRec = [
      "",
      "Low sugar electrolytes",
      "Standard electrolytes",
      "High sodium (two-a-days)",
      "Sweat test guided",
      "None",
    ];

    const notesMacros = [
      "",
      "Training days: +50g carbs",
      "Rest days: -50g carbs",
      "Weigh-in week: reduce sodium",
      "Increase calories gradually (+150/week)",
      "Increase hydration on travel days",
      "Custom (type your own)",
    ];

    const notesSupps = [
      "",
      "Only NSF Certified for Sport",
      "Avoid proprietary blends",
      "Avoid stimulants",
      "Third-party tested only",
      "Custom (type your own)",
    ];

    const metaStatus = ["Active", "Draft", "Archived", "Paused", "Custom"];

    return {
      calories,
      grams,
      hydration,

      proteinRecommendation: proteinRec,
      creatineRecommendation: creatineRec,
      bcaaRecommendation: bcaaRec,
      electrolytesRecommendation: electrolytesRec,

      notesMacros,
      notesSupplements: notesSupps,

      metaStatus,
    };
  }, []);

  /* ------------------------------------------------------------------------ */
  /* State                                                                    */
  /* ------------------------------------------------------------------------ */

  const [athletes, setAthletes] = useState([]);
  const [athleteSearch, setAthleteSearch] = useState("");
  const [selectedAthleteEmail, setSelectedAthleteEmail] = useState("");

  const [prescriptions, setPrescriptions] = useState([]);

  const [loading, setLoading] = useState(true);
  const [loadingAthletes, setLoadingAthletes] = useState(false);
  const [loadingPrescriptions, setLoadingPrescriptions] = useState(false);

  const [error, setError] = useState("");
  const [view, setView] = useState("builder"); // builder | history
  const [title, setTitle] = useState("Nutrition + Supplements Plan");
  const [createLoading, setCreateLoading] = useState(false);

  // Templates
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [templatesError, setTemplatesError] = useState("");
  const [templates, setTemplates] = useState([]);
  const [templateId, setTemplateId] = useState("");
  const [templateName, setTemplateName] = useState("");
  const [templateNotes, setTemplateNotes] = useState("");

  // Session-only “done” indicator for roster speed runs
  const [completedEmails, setCompletedEmails] = useState(() => new Set());

  const [structured, setStructured] = useState({ ...DEFAULT_STRUCTURED });

  /* ------------------------------------------------------------------------ */
  /* Guards                                                                   */
  /* ------------------------------------------------------------------------ */

  useEffect(() => {
    if (!user) return;
    if (role && role !== "organization") {
      router.push("/dashboard");
    }
  }, [user, role, router]);

  // Optional: allow direct linking /org/prescriptions?athleteEmail=...
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
      headers: { ...orgAuthHeaders },
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = data?.error || data?.airtable?.message || "Failed to load athletes.";
      setLoadingAthletes(false);
      throw new Error(msg);
    }

    const list = Array.isArray(data?.athletes) ? data.athletes : [];
    setAthletes(list);

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
          ...orgAuthHeaders,
        },
      }
    );

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = data?.error || data?.airtable?.message || "Failed to load prescriptions.";
      setLoadingPrescriptions(false);
      throw new Error(msg);
    }

    setPrescriptions(Array.isArray(data?.prescriptions) ? data.prescriptions : []);
    setLoadingPrescriptions(false);
  };

  const fetchTemplates = async () => {
    setTemplatesLoading(true);
    setTemplatesError("");

    if (!orgToken) {
      setTemplates([]);
      setTemplatesLoading(false);
      return;
    }

    const res = await fetch("/api/org/getPlanTemplates", {
      method: "GET",
      credentials: "include",
      headers: { ...orgAuthHeaders },
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setTemplates([]);
      setTemplatesLoading(false);
      setTemplatesError(data?.error || "Failed to load templates");
      return;
    }

    const list = Array.isArray(data?.templates) ? data.templates : [];
    // Filter Active by default, but don’t hard-break if Status doesn’t exist
    const activeFirst = list
      .slice()
      .sort((a, b) => String(a?.status || "").localeCompare(String(b?.status || "")));
    setTemplates(activeFirst);

    setTemplatesLoading(false);
  };

  const saveAsTemplate = async () => {
    setError("");
    setTemplatesError("");

    const name = String(templateName || "").trim();
    if (!name) {
      setTemplatesError("Enter a template name first.");
      return;
    }
    if (!orgToken) {
      setTemplatesError("Missing org token. Re-login as org.");
      return;
    }

    setTemplatesLoading(true);

    try {
      const res = await fetch("/api/org/createPlanTemplate", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          ...orgAuthHeaders,
        },
        body: JSON.stringify({
          token: orgToken,
          templateName: name,
          organizationName: orgName,
          createdBy: user?.Email || user?.email || "",
          structured,
          notes: templateNotes || "",
          status: "Active",
          tags: [],
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = data?.error || data?.airtable?.message || "Failed to save template.";
        throw new Error(msg);
      }

      // Refresh templates and auto-select new one
      await fetchTemplates();

      // If API returns id, select it
      if (data?.template?.id) setTemplateId(String(data.template.id));

      setTemplateName("");
      setTemplateNotes("");
    } catch (err) {
      console.error("[org/prescriptions] saveAsTemplate error:", err);
      setTemplatesError(err?.message || "Failed to save template.");
    } finally {
      setTemplatesLoading(false);
    }
  };

  const refreshAll = async () => {
    setLoading(true);
    setError("");
    try {
      await fetchAthletes();
      await fetchTemplates();

      const qEmail = router?.query?.athleteEmail;
      const email =
        (typeof qEmail === "string" && qEmail.includes("@") && qEmail) || selectedAthleteEmail;

      if (email) await fetchPrescriptionsForAthlete(email);
      else setPrescriptions([]);
    } catch (err) {
      console.error("[org/prescriptions] refreshAll error:", err);
      setError(err?.message || "Failed to load data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!user) return;
    if (role !== "organization") return;
    refreshAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, role, orgToken]);

  useEffect(() => {
    if (!user) return;
    if (role !== "organization") return;
    if (!selectedAthleteEmail) {
      setPrescriptions([]);
      return;
    }
    fetchPrescriptionsForAthlete(selectedAthleteEmail).catch((err) =>
      setError(err?.message || "Failed to load prescriptions.")
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedAthleteEmail]);

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

  const activeTemplates = useMemo(() => {
    // Hide archived by default
    return (templates || []).filter((t) => {
      const st = String(t?.status || "Active").toLowerCase();
      return !st.includes("arch");
    });
  }, [templates]);

  const templateById = useMemo(() => {
    const id = String(templateId || "").trim();
    if (!id) return null;
    return templates.find((t) => String(t?.id) === id) || null;
  }, [templates, templateId]);

  /* ------------------------------------------------------------------------ */
  /* Template Apply                                                           */
  /* ------------------------------------------------------------------------ */

  const applyTemplateToBuilder = useCallback(
    (tplId) => {
      const id = String(tplId || "").trim();
      if (!id) return;

      const tpl = templates.find((t) => String(t?.id) === id);
      if (!tpl) {
        setTemplatesError("Template not found.");
        return;
      }

      if (!tpl.structured || typeof tpl.structured !== "object") {
        setTemplatesError(
          "This template is missing structured JSON. Open Airtable and confirm the “Structured” field is valid JSON."
        );
        return;
      }

      setStructured((prev) => ({
        ...prev,
        ...tpl.structured,
      }));

      // Helpful default: set title if user hasn't customized
      if (!title || title === "Nutrition + Supplements Plan") {
        setTitle(tpl.name || "Nutrition + Supplements Plan");
      }

      setView("builder");
    },
    [templates, title]
  );

  /* ------------------------------------------------------------------------ */
  /* Next Athlete Navigation (Speed Mode)                                     */
  /* ------------------------------------------------------------------------ */

  const getEmail = (a) => normalizeEmail(a?.email || a?.fields?.Email || a?.Email);
  const advancingRef = useRef(false);

  const goToNextAthlete = useCallback(() => {
    const list = Array.isArray(filteredAthletes) ? filteredAthletes : [];
    if (!list.length) return;

    const current = normalizeEmail(selectedAthleteEmail);
    const currentIdx = list.findIndex((a) => getEmail(a) === current);

    if (currentIdx < 0) {
      const first = list.find((a) => getEmail(a));
      if (first) setSelectedAthleteEmail(getEmail(first));
      return;
    }

    let nextIdx = currentIdx + 1;
    if (nextIdx >= list.length) nextIdx = 0;

    let safety = 0;
    while (safety < list.length && !getEmail(list[nextIdx])) {
      nextIdx = (nextIdx + 1) % list.length;
      safety++;
    }

    const nextEmail = getEmail(list[nextIdx]);
    if (!nextEmail) return;

    setSelectedAthleteEmail(nextEmail);

    // Keep URL in sync (optional, but helpful for refresh/share)
    router.push(`/org/prescriptions?athleteEmail=${encodeURIComponent(nextEmail)}`, undefined, {
      shallow: true,
    });
  }, [filteredAthletes, selectedAthleteEmail, router]);

  /* ------------------------------------------------------------------------ */
  /* Builder                                                                  */
  /* ------------------------------------------------------------------------ */

  const onChange = (key, value) => {
    setStructured((prev) => ({ ...prev, [key]: value }));
  };

  const resetBuilder = () => {
    setTitle("Nutrition + Supplements Plan");
    setStructured({ ...DEFAULT_STRUCTURED });
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

  const createPlan = async (e, { advance = false } = {}) => {
    e?.preventDefault?.();
    setError("");

    if (createLoading) return;

    const msg = validateBuilder();
    if (msg) {
      setError(msg);
      return;
    }

    const athleteEmail = normalizeEmail(selectedAthleteEmail);
    if (!athleteEmail) {
      setError("Select an athlete first.");
      return;
    }

    setCreateLoading(true);

    try {
      const summaryText = buildPlanSummaryText(structured);

      const res = await fetch("/api/org/createPrescription", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          ...orgAuthHeaders,
        },
        body: JSON.stringify({
          athleteEmail,
          organizationName: orgName,
          title: title.trim() || "Nutrition + Supplements Plan",
          prescription: summaryText,
          createdBy: user?.Email || user?.email || "",
          structured: {
            calories: structured.calories || "",
            proteinGrams: structured.proteinGrams || "",
            carbsGrams: structured.carbsGrams || "",
            fatsGrams: structured.fatsGrams || "",
            hydrationOz: structured.hydrationOz || "",
            notesMacros: structured.notesMacros || "",

            proteinRecommendation: structured.proteinRecommendation || "",
            creatineRecommendation: structured.creatineRecommendation || "",
            bcaaRecommendation: structured.bcaaRecommendation || "",
            electrolytesRecommendation: structured.electrolytesRecommendation || "",
            notesSupplements: structured.notesSupplements || "",

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

      // Mark “done” for roster UX (session only)
      setCompletedEmails((prev) => {
        const next = new Set(prev);
        next.add(athleteEmail);
        return next;
      });

      // Refresh history for this athlete (non-blocking)
      fetchPrescriptionsForAthlete(athleteEmail).catch(() => {});

      // Stay in builder for speed
      setView("builder");

      if (advance) {
        if (!advancingRef.current) {
          advancingRef.current = true;
          setTimeout(() => {
            goToNextAthlete();
            advancingRef.current = false;
          }, 150);
        }
      } else {
        // If you want “Save” to reset but Save&Next to keep values:
        // resetBuilder();
      }
    } catch (err) {
      console.error("[org/prescriptions] createPlan error:", err);
      setError(err?.message || "Failed to create plan.");
    } finally {
      setCreateLoading(false);
    }
  };

  /* ------------------------------------------------------------------------ */
  /* Styles                                                                   */
  /* ------------------------------------------------------------------------ */

  const inputBase =
    "w-full px-4 py-3 rounded-xl border border-gray-300 bg-white text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#46769B]/30";

  const subtleHint = "text-[11px] text-gray-500 mt-2 leading-relaxed";

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
              Build supplement + macro plans fast. Save templates. Save & Next through the roster.
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
        {(loading || loadingAthletes || loadingPrescriptions || templatesLoading) && (
          <div className="bg-white rounded-2xl shadow-md border border-blue-100 p-4">
            <p className="text-sm text-gray-600">Loading…</p>
          </div>
        )}

        {error && (
          <div className="bg-white rounded-2xl shadow-md border border-red-200 p-4">
            <p className="text-sm text-red-600 font-medium">{error}</p>
          </div>
        )}

        <div className="grid lg:grid-cols-12 gap-6">
          {/* Left: Athlete roster */}
          <aside className="lg:col-span-4 bg-white rounded-2xl shadow-md border border-blue-100 p-5 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold">Athletes</h2>
                <p className="text-xs text-gray-500 mt-1">
                  Filter the list, then Save & Next to batch through that subset.
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
                  <p className="text-xs text-gray-500 mt-1">Clear search or confirm signups.</p>
                </div>
              )}

              {filteredAthletes.map((a) => {
                const email = normalizeEmail(a?.email);
                const isActive = email && email === normalizeEmail(selectedAthleteEmail);
                const done = email && completedEmails.has(email);

                return (
                  <button
                    key={a.id || email || Math.random().toString(36).slice(2)}
                    type="button"
                    onClick={() => email && setSelectedAthleteEmail(email)}
                    className={`w-full text-left rounded-xl border p-3 transition ${
                      isActive
                        ? "border-[#46769B] bg-blue-50"
                        : "border-gray-200 bg-white hover:bg-gray-50"
                    }`}
                    disabled={!email}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-gray-900">{a?.name || "Athlete"}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{email || "Missing email"}</p>
                      </div>

                      {done ? (
                        <span className="text-xs px-2 py-1 rounded-lg bg-emerald-100 text-emerald-700 border border-emerald-200">
                          ✓ Done
                        </span>
                      ) : (
                        <span className="text-xs px-2 py-1 rounded-lg bg-gray-100 text-gray-600 border border-gray-200">
                          Pending
                        </span>
                      )}
                    </div>

                    {a?.createdAt && (
                      <p className="text-[11px] text-gray-400 mt-1">
                        Joined: {formatDateTime(a.createdAt)}
                      </p>
                    )}
                  </button>
                );
              })}
            </div>

            <div className="text-[11px] text-gray-500">
              Speed shortcuts: <span className="font-semibold">Enter</span> = Save & Next,{" "}
              <span className="font-semibold">Ctrl/Cmd+Enter</span> = Save
            </div>
          </aside>

          {/* Right: Builder/History */}
          <section className="lg:col-span-8 space-y-6">
            {/* Selected athlete + view toggle */}
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
            </div>

            {/* Builder */}
            {view === "builder" && (
              <div className="bg-white rounded-2xl shadow-md border border-blue-100 p-6 space-y-6">
                <div>
                  <h3 className="text-lg font-bold">Create Plan</h3>
                  <p className="text-sm text-gray-600 mt-1">
                    Use templates to go fast: build once → Save Template → Apply + Save & Next.
                  </p>
                </div>

                {/* Templates block */}
                <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4 space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-gray-900">Plan Templates</p>
                      <p className="text-xs text-gray-500 mt-1">
                        Templates are saved presets of the builder fields scoped to your org token.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={fetchTemplates}
                      className="px-3 py-2 rounded-xl border border-gray-200 bg-white text-xs font-semibold hover:bg-gray-50"
                      disabled={templatesLoading}
                    >
                      {templatesLoading ? "Refreshing…" : "Refresh Templates"}
                    </button>
                  </div>

                  {templatesError ? (
                    <div className="rounded-xl bg-white border border-red-200 p-3">
                      <p className="text-sm text-red-600 font-medium">{templatesError}</p>
                      <p className="text-[11px] text-gray-500 mt-2">
                        If you see UNKNOWN_FIELD_NAME, confirm Airtable fields:{" "}
                        <span className="font-semibold">
                          Name, Organization Token, Structured, Created By, Status
                        </span>
                        .
                      </p>
                    </div>
                  ) : null}

                  <div className="grid sm:grid-cols-3 gap-3">
                    <select
                      className="w-full px-4 py-3 rounded-xl border border-gray-300 bg-white text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#46769B]/30"
                      value={templateId}
                      onChange={(e) => setTemplateId(e.target.value)}
                    >
                      <option value="">Select a template…</option>
                      {activeTemplates.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name || "Template"}
                        </option>
                      ))}
                    </select>

                    <button
                      type="button"
                      onClick={() => applyTemplateToBuilder(templateId)}
                      className="px-4 py-3 rounded-xl bg-white border border-gray-200 text-sm font-semibold hover:bg-gray-50"
                      disabled={!templateId}
                    >
                      Apply Template
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setTemplateId("");
                        setTemplatesError("");
                      }}
                      className="px-4 py-3 rounded-xl bg-white border border-gray-200 text-sm font-semibold hover:bg-gray-50"
                      disabled={!templateId}
                    >
                      Clear
                    </button>
                  </div>

                  {templateById ? (
                    <div className="rounded-xl bg-white border border-gray-200 p-3">
                      <p className="text-xs text-gray-500">
                        Selected:{" "}
                        <span className="font-semibold text-gray-800">{templateById.name}</span>
                        {templateById.createdBy ? (
                          <>
                            {" "}
                            • <span className="text-gray-600">{templateById.createdBy}</span>
                          </>
                        ) : null}
                      </p>
                      {templateById.notes ? (
                        <p className="text-xs text-gray-600 mt-1">{templateById.notes}</p>
                      ) : null}
                    </div>
                  ) : null}

                  <div className="grid sm:grid-cols-3 gap-3">
                    <input
                      className={inputBase}
                      placeholder="Template name (e.g., Offseason Bulk)"
                      value={templateName}
                      onChange={(e) => setTemplateName(e.target.value)}
                    />

                    <input
                      className={inputBase}
                      placeholder="Template notes (optional)"
                      value={templateNotes}
                      onChange={(e) => setTemplateNotes(e.target.value)}
                    />

                    <button
                      type="button"
                      onClick={saveAsTemplate}
                      className="px-4 py-3 rounded-xl bg-[#46769B] text-white text-sm font-semibold hover:brightness-110 disabled:opacity-70 disabled:cursor-not-allowed"
                      disabled={templatesLoading || !templateName.trim()}
                    >
                      {templatesLoading ? "Saving…" : "Save as Template"}
                    </button>
                  </div>

                  <p className={subtleHint}>
                    Pro move: apply a template once, then don’t reset the builder — just Save & Next
                    through the roster.
                  </p>
                </div>

                <form onSubmit={(e) => createPlan(e, { advance: false })} className="space-y-6">
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
                      <WheelSelect
                        label="Meta Status"
                        options={WHEEL.metaStatus}
                        value={structured.metaStatus}
                        onChange={(v) => onChange("metaStatus", v)}
                        allowCustom
                        placeholder="Type or scroll…"
                      />
                    </div>

                    <div className="md:col-span-3">
                      <p className="text-xs text-gray-500 mb-2">Meta Effective Date</p>
                      <input
                        type="date"
                        className={inputBase}
                        value={structured.metaEffectiveDate}
                        onChange={(e) => onChange("metaEffectiveDate", e.target.value)}
                      />
                      <p className={subtleHint}>If blank, the API can default to “now”.</p>
                    </div>
                  </div>

                  {/* Supplements */}
                  <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4 space-y-4">
                    <div>
                      <h4 className="font-semibold">Supplements</h4>
                      <p className="text-xs text-gray-500 mt-1">
                        Scroll to select, or type to auto-jump. Custom values are allowed.
                      </p>
                    </div>

                    <div className="grid md:grid-cols-2 gap-4">
                      <WheelSelect
                        label="Protein Recommendation"
                        options={WHEEL.proteinRecommendation}
                        value={structured.proteinRecommendation}
                        onChange={(v) => onChange("proteinRecommendation", v)}
                        allowCustom
                      />

                      <WheelSelect
                        label="Creatine Recommendation"
                        options={WHEEL.creatineRecommendation}
                        value={structured.creatineRecommendation}
                        onChange={(v) => onChange("creatineRecommendation", v)}
                        allowCustom
                      />

                      <WheelSelect
                        label="BCAA/EAA Recommendation"
                        options={WHEEL.bcaaRecommendation}
                        value={structured.bcaaRecommendation}
                        onChange={(v) => onChange("bcaaRecommendation", v)}
                        allowCustom
                      />

                      <WheelSelect
                        label="Electrolytes Recommendation"
                        options={WHEEL.electrolytesRecommendation}
                        value={structured.electrolytesRecommendation}
                        onChange={(v) => onChange("electrolytesRecommendation", v)}
                        allowCustom
                      />

                      <div className="md:col-span-2">
                        <WheelSelect
                          label="Notes (Supplements)"
                          options={WHEEL.notesSupplements}
                          value={structured.notesSupplements}
                          onChange={(v) => onChange("notesSupplements", v)}
                          allowCustom
                          placeholder="Pick a suggestion or type your own…"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Macros */}
                  <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4 space-y-4">
                    <div>
                      <h4 className="font-semibold">Macros</h4>
                      <p className="text-xs text-gray-500 mt-1">
                        Big ranges for speed. Still type any value if needed.
                      </p>
                    </div>

                    <div className="grid md:grid-cols-3 gap-4">
                      <WheelSelect
                        label="Calories"
                        options={WHEEL.calories}
                        value={structured.calories}
                        onChange={(v) => onChange("calories", v)}
                        allowCustom
                        placeholder="Type or scroll…"
                      />

                      <WheelSelect
                        label="Protein (g)"
                        options={WHEEL.grams}
                        value={structured.proteinGrams}
                        onChange={(v) => onChange("proteinGrams", v)}
                        allowCustom
                      />

                      <WheelSelect
                        label="Carbs (g)"
                        options={WHEEL.grams}
                        value={structured.carbsGrams}
                        onChange={(v) => onChange("carbsGrams", v)}
                        allowCustom
                      />

                      <WheelSelect
                        label="Fat (g)"
                        options={WHEEL.grams}
                        value={structured.fatsGrams}
                        onChange={(v) => onChange("fatsGrams", v)}
                        allowCustom
                      />

                      <WheelSelect
                        label="Hydration (oz)"
                        options={WHEEL.hydration}
                        value={structured.hydrationOz}
                        onChange={(v) => onChange("hydrationOz", v)}
                        allowCustom
                      />

                      <div className="md:col-span-3">
                        <WheelSelect
                          label="Notes (Macros)"
                          options={WHEEL.notesMacros}
                          value={structured.notesMacros}
                          onChange={(v) => onChange("notesMacros", v)}
                          allowCustom
                          placeholder="Pick a suggestion or type your own…"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Freeform notes */}
                  <div>
                    <p className="text-xs text-gray-500 mb-2">Coach Notes (optional)</p>
                    <textarea
                      className="w-full min-h-[140px] px-4 py-3 rounded-xl border border-gray-300 bg-white text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#46769B]/30"
                      value={structured.freeformNotes}
                      onChange={(e) => onChange("freeformNotes", e.target.value)}
                      onKeyDown={(e) => {
                        // Ctrl/Cmd+Enter = Save (no advance)
                        if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                          e.preventDefault();
                          createPlan(e, { advance: false });
                          return;
                        }

                        // Enter = Save & Next (unless Shift+Enter for newline)
                        if (
                          e.key === "Enter" &&
                          !e.shiftKey &&
                          !e.ctrlKey &&
                          !e.metaKey &&
                          !e.altKey
                        ) {
                          e.preventDefault();
                          createPlan(e, { advance: true });
                        }
                      }}
                      placeholder="Examples: lactose sensitive, practice days increase carbs… (Enter = Save & Next)"
                    />
                    <p className={subtleHint}>
                      Tip: use <span className="font-semibold">Shift+Enter</span> for new lines.
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="grid sm:grid-cols-3 gap-3">
                    <button
                      type="button"
                      onClick={resetBuilder}
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white text-sm font-semibold hover:bg-gray-50"
                    >
                      Reset
                    </button>

                    <button
                      type="button"
                      onClick={(e) => createPlan(e, { advance: false })}
                      disabled={createLoading || !selectedAthleteEmail}
                      className={`w-full px-4 py-3 rounded-xl border border-gray-200 bg-white text-sm font-semibold hover:bg-gray-50 ${
                        createLoading || !selectedAthleteEmail ? "opacity-70 cursor-not-allowed" : ""
                      }`}
                    >
                      {createLoading ? "Saving…" : "Save"}
                    </button>

                    <button
                      type="button"
                      onClick={(e) => createPlan(e, { advance: true })}
                      disabled={createLoading || !selectedAthleteEmail}
                      className={`w-full px-4 py-3 rounded-xl bg-[#46769B] text-white text-sm font-semibold hover:brightness-110 transition ${
                        createLoading || !selectedAthleteEmail ? "opacity-70 cursor-not-allowed" : ""
                      }`}
                    >
                      {createLoading ? "Saving…" : "Save & Next"}
                    </button>
                  </div>

                  <div className={subtleHint}>
                    Built for speed: apply a template once, then Save & Next through the roster. All
                    wheel inputs still allow custom values.
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
                    <p className="text-sm text-gray-600 mt-1">Newest first.</p>
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
                  <p className="text-sm text-gray-600">Select an athlete to view plan history.</p>
                )}

                {selectedAthleteEmail && prescriptions.length === 0 && (
                  <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                    <p className="text-sm text-gray-700 font-medium">No plans yet.</p>
                    <p className="text-[11px] text-gray-500 mt-1">
                      Switch to Builder to create the first plan.
                    </p>
                  </div>
                )}

                <div className="space-y-3">
                  {(prescriptions || []).map((p) => (
                    <div
                      key={p.id || `${p.createdAt}-${p.title}`}
                      className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-bold text-gray-900">{p.title || "Plan"}</p>
                          <p className="text-[11px] text-gray-500 mt-1">
                            Created: {formatDateTime(p.createdAt)}{" "}
                            {p.createdBy ? ` • By: ${p.createdBy}` : ""}
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            setTitle(p.title || "Nutrition + Supplements Plan");
                            // Pasting text summary into notes can be useful for quick edits
                            setStructured((prev) => ({
                              ...prev,
                              freeformNotes: p.prescription || "",
                            }));
                            setView("builder");
                          }}
                          className="px-3 py-2 rounded-xl border border-gray-200 bg-white text-xs font-semibold hover:bg-gray-50"
                        >
                          Copy Notes to Builder
                        </button>
                      </div>

                      <div className="mt-3">
                        <pre className="whitespace-pre-wrap text-sm text-gray-800 bg-gray-50 border border-gray-200 rounded-xl p-3">
                          {p.prescription || ""}
                        </pre>
                      </div>

                      <div className={subtleHint}>
                        If you want history to rehydrate structured fields (calories, creatine, etc.),
                        update <span className="font-semibold">getPrescriptionsForAthlete</span> to
                        return those Airtable columns too.
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
