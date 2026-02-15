// pages/org/prescriptions.js
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { useAuthContext } from "@/hooks/useAuth";

import { rangeOptions } from "@/lib/rangeOptions";
import {
  buildNutritionPlanJson,
  buildPlanSummaryText,
  dateToISO,
  DEFAULT_STRUCTURED,
  getAthleteToken,
  normalizeEmail,
} from "@/lib/org/prescriptions/prescriptions-utils";

import { useOrgPrescriptionsData } from "@/hooks/org/useOrgPrescriptionsData";
import { useRosterSpeedMode } from "@/hooks/org/useRosterSpeedMode";

import ConfirmDeleteModal from "@/components/org/prescriptions/ConfirmDeleteModal";
import AthleteRoster from "@/components/org/prescriptions/AthleteRoster";
import SelectedAthleteCard from "@/components/org/prescriptions/SelectedAthleteCard";
import TemplatesPanel from "@/components/org/prescriptions/TemplatesPanel";
import PlanBuilderForm from "@/components/org/prescriptions/PlanBuilderForm";
import PlanHistory from "@/components/org/prescriptions/PlanHistory";

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

  const orgToken = useMemo(
    () => String(user?.Token || user?.token || user?.["Organization Token"] || "").trim(),
    [user]
  );

  const orgAuthHeaders = useMemo(() => (orgToken ? { "x-org-token": orgToken } : {}), [orgToken]);

  /* ---------------- UI state ---------------- */

  const [loading, setLoading] = useState(true);
  const [view, setView] = useState("builder"); // builder | history
  const [title, setTitle] = useState("Nutrition + Supplements Plan");
  const [createLoading, setCreateLoading] = useState(false);

  const [athleteSearch, setAthleteSearch] = useState("");
  const [selectedAthleteEmail, setSelectedAthleteEmail] = useState("");

  // ✅ history is user-driven; capped + paginated
  const [historyRequested, setHistoryRequested] = useState(false);
  const [historyItems, setHistoryItems] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyHasMore, setHistoryHasMore] = useState(false);
  const [historyOffset, setHistoryOffset] = useState(null);

  // ✅ roster "Done" derived from whether athlete has >=1 NutritionPlan
  const [doneEmailsFromPlans, setDoneEmailsFromPlans] = useState(() => new Set());
  const [statusLoading, setStatusLoading] = useState(false);

  // templates ui state
  const [templateId, setTemplateId] = useState("");
  const [templateName, setTemplateName] = useState("");
  const [templateNotes, setTemplateNotes] = useState("");

  // delete modal state
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  const [structured, setStructured] = useState({ ...DEFAULT_STRUCTURED });

  const {
    athletes,
    templates,
    activeTemplates,

    loadingAthletes,
    templatesLoading,

    error,
    templatesError,

    setError,
    setTemplatesError,

    fetchAthletes,
    fetchTemplates,
  } = useOrgPrescriptionsData({ orgAuthHeaders, orgToken });

  /* ---------------- OPTIONS ---------------- */

  const OPTIONS = useMemo(() => {
    const calories = rangeOptions(0, 5000, 5);
    const grams = rangeOptions(0, 400, 1);
    const hydration = rangeOptions(0, 300, 1);

    const phases = ["Surplus", "Maintain", "Cut"];

    const proteinRec = ["", "Whey Isolate", "Whey Concentrate", "Casein (night)", "Plant-based", "Mass gainer", "Hydrolyzed whey", "None"];
    const creatineRec = ["", "Creatine Monohydrate (3g daily)", "Creatine Monohydrate (5g daily)", "Creapure (5g daily)", "Loading phase (20g/day x 5–7d) then 5g/day", "None"];
    const bcaaRec = ["", "BCAA 2:1:1", "EAA", "EAA (intra-workout)", "None"];
    const electrolytesRec = ["", "Low sugar electrolytes", "Standard electrolytes", "High sodium (two-a-days)", "Sweat test guided", "None"];

    const notesMacros = ["", "Training days: +50g carbs", "Rest days: -50g carbs", "Weigh-in week: reduce sodium", "Increase calories gradually (+150/week)", "Increase hydration on travel days"];
    const notesSupps = ["", "Only NSF Certified for Sport", "Avoid proprietary blends", "Avoid stimulants", "Third-party tested only"];
    const metaStatus = ["Active", "Draft", "Archived", "Paused"];

    return {
      calories,
      grams,
      hydration,
      phases,
      proteinRecommendation: proteinRec,
      creatineRecommendation: creatineRec,
      bcaaRecommendation: bcaaRec,
      electrolytesRecommendation: electrolytesRec,
      notesMacros,
      notesSupplements: notesSupps,
      metaStatus,
    };
  }, []);

  /* ---------------- Styles ---------------- */

  const inputBase =
    "w-full px-4 py-3 rounded-xl border border-gray-300 bg-white text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#46769B]/30";
  const subtleHint = "text-[11px] text-gray-500 mt-2 leading-relaxed";

  /* ---------------- Guards ---------------- */

  useEffect(() => {
    if (!user) return;
    if (role && role !== "organization") router.push("/dashboard");
  }, [user, role, router]);

  /* ---------------- Preselect from URL ---------------- */

  useEffect(() => {
    const qEmail = router?.query?.athleteEmail;
    const qToken = router?.query?.athleteToken;

    // reset history when route param changes
    setHistoryRequested(false);
    setHistoryItems([]);
    setHistoryHasMore(false);
    setHistoryOffset(null);

    if (typeof qEmail === "string" && qEmail.includes("@")) {
      setSelectedAthleteEmail(normalizeEmail(qEmail));
      return;
    }

    if (typeof qToken === "string" && qToken.startsWith("ATH-")) {
      const token = qToken.trim();
      const match = (athletes || []).find((a) => getAthleteToken(a) === token);
      if (match?.email) setSelectedAthleteEmail(normalizeEmail(match.email));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router?.query?.athleteEmail, router?.query?.athleteToken, athletes]);

  const selectedAthlete = useMemo(() => {
    const email = normalizeEmail(selectedAthleteEmail);
    return athletes.find((a) => normalizeEmail(a?.email) === email) || null;
  }, [athletes, selectedAthleteEmail]);

  const selectedAthleteToken = useMemo(() => getAthleteToken(selectedAthlete), [selectedAthlete]);

  const filteredAthletes = useMemo(() => {
    const q = String(athleteSearch || "").trim().toLowerCase();
    if (!q) return athletes;
    return athletes.filter((a) => {
      const name = String(a?.name || "").toLowerCase();
      const email = String(a?.email || "").toLowerCase();
      const token = String(getAthleteToken(a) || "").toLowerCase();
      return name.includes(q) || email.includes(q) || token.includes(q);
    });
  }, [athletes, athleteSearch]);

  const templateById = useMemo(() => {
    const id = String(templateId || "").trim();
    if (!id) return null;
    return templates.find((t) => String(t?.id) === id) || null;
  }, [templates, templateId]);

  const { completedEmails: completedFromSpeedMode, markDone, goToNextAthlete, advanceSafely } = useRosterSpeedMode({
    filteredAthletes,
    selectedAthleteEmail,
    setSelectedAthleteEmail,
    router,
  });

  // ✅ merged done set: from automatic plan status + from "Save & Next" speed mode
  const completedEmails = useMemo(() => {
    const merged = new Set();
    for (const e of doneEmailsFromPlans) merged.add(e);
    if (completedFromSpeedMode?.forEach) completedFromSpeedMode.forEach((e) => merged.add(e));
    return merged;
  }, [doneEmailsFromPlans, completedFromSpeedMode]);

  /* ---------------- Initial load ---------------- */

  const refreshAll = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const list = await fetchAthletes();
      await fetchTemplates();

      if (!selectedAthleteEmail) {
        const first = (list || []).find((a) => a?.email);
        if (first?.email) setSelectedAthleteEmail(normalizeEmail(first.email));
      }
    } catch (err) {
      console.error("[org/prescriptions] refreshAll error:", err);
      setError(err?.message || "Failed to load data.");
    } finally {
      setLoading(false);
    }
  }, [fetchAthletes, fetchTemplates, selectedAthleteEmail, setError]);

  useEffect(() => {
    if (!user) return;
    if (role !== "organization") return;
    refreshAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, role, orgToken]);

  /* ---------------- ✅ On-load roster status: mark Done if athlete has >=1 plan ---------------- */

  const refreshRosterPlanStatus = useCallback(
    async (athleteList) => {
      const list = Array.isArray(athleteList) ? athleteList : athletes;
      if (!list || list.length === 0) {
        setDoneEmailsFromPlans(new Set());
        return;
      }

      setStatusLoading(true);
      try {
        // token-first, keep it light: pageSize=1
        const tasks = list.map(async (a) => {
          const email = normalizeEmail(a?.email);
          const token = String(getAthleteToken(a) || "").trim();
          if (!email || !token) return { email, has: false };

          const res = await fetch(
            `/api/org/nutrition/plans/getByAthlete?athleteToken=${encodeURIComponent(token)}&pageSize=1`,
            {
              method: "GET",
              credentials: "include",
              headers: { "Content-Type": "application/json", ...orgAuthHeaders },
            }
          );

          const data = await res.json().catch(() => ({}));
          if (!res.ok) return { email, has: false };

          const plans = Array.isArray(data?.plans) ? data.plans : [];
          return { email, has: plans.length > 0 };
        });

        const results = await Promise.all(tasks);

        const next = new Set();
        for (const r of results) {
          if (r?.email && r?.has) next.add(r.email);
        }
        setDoneEmailsFromPlans(next);
      } catch (e) {
        console.warn("[org/prescriptions] refreshRosterPlanStatus failed:", e);
      } finally {
        setStatusLoading(false);
      }
    },
    [athletes, orgAuthHeaders]
  );

  // run once after athletes load (and whenever list changes)
  useEffect(() => {
    if (!athletes || athletes.length === 0) return;
    refreshRosterPlanStatus(athletes);
  }, [athletes, refreshRosterPlanStatus]);

  /* ---------------- Builder helpers ---------------- */

  const onChange = (key, value) => setStructured((prev) => ({ ...prev, [key]: value }));

  const resetBuilder = () => {
    setTitle("Nutrition + Supplements Plan");
    setStructured({ ...DEFAULT_STRUCTURED });
  };

  const validateBuilder = () => {
    const athleteEmail = normalizeEmail(selectedAthleteEmail);
    if (!athleteEmail) return "Select an athlete first.";
    if (!selectedAthleteToken) return "Selected athlete is missing AthleteToken (lookup). Please fix the athlete record.";

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

  /* ---------------- Template actions ---------------- */

  const applyTemplateToBuilder = useCallback(
    (tplId) => {
      const id = String(tplId || "").trim();
      if (!id) return;

      const tpl = templates.find((t) => String(t?.id) === id);
      if (!tpl) return setTemplatesError("Template not found.");

      if (!tpl.structured || typeof tpl.structured !== "object") {
        return setTemplatesError("This template is missing structured JSON. Open Airtable and confirm the “Structured” field is valid JSON.");
      }

      setStructured((prev) => ({ ...prev, ...tpl.structured }));

      if (!title || title === "Nutrition + Supplements Plan") setTitle(tpl.name || "Nutrition + Supplements Plan");

      setView("builder");
    },
    [templates, title, setTemplatesError]
  );

  const saveAsTemplate = useCallback(async () => {
    setError("");
    setTemplatesError("");

    const name = String(templateName || "").trim();
    if (!name) return setTemplatesError("Enter a template name first.");

    try {
      const res = await fetch("/api/org/createPlanTemplate", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json", ...orgAuthHeaders },
        body: JSON.stringify({
          templateName: name,
          createdBy: user?.Email || user?.email || "",
          structured,
          notes: templateNotes || "",
          status: "Active",
          tags: "",
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || data?.airtable?.message || "Failed to save template.");

      await fetchTemplates();
      if (data?.template?.id) setTemplateId(String(data.template.id));

      setTemplateName("");
      setTemplateNotes("");
    } catch (err) {
      console.error("[org/prescriptions] saveAsTemplate error:", err);
      setTemplatesError(err?.message || "Failed to save template.");
    }
  }, [orgAuthHeaders, user, structured, templateName, templateNotes, fetchTemplates, setError, setTemplatesError]);

  const openDeleteTemplateConfirm = () => {
    setDeleteError("");
    if (!templateId) return;
    setConfirmDeleteOpen(true);
  };

  const deleteTemplate = useCallback(async () => {
    setDeleteError("");
    const id = String(templateId || "").trim();
    if (!id) return;

    setDeleteBusy(true);
    try {
      const res = await fetch("/api/org/deletePlanTemplate", {
        method: "DELETE",
        credentials: "include",
        headers: { "Content-Type": "application/json", ...orgAuthHeaders },
        body: JSON.stringify({ templateId: id }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || data?.airtable?.message || "Failed to delete template.");

      setTemplateId("");
      await fetchTemplates();
      setConfirmDeleteOpen(false);
    } catch (err) {
      console.error("[org/prescriptions] deleteTemplate error:", err);
      setDeleteError(err?.message || "Failed to delete template.");
    } finally {
      setDeleteBusy(false);
    }
  }, [templateId, orgAuthHeaders, fetchTemplates]);

  /* ---------------- ✅ History (NutritionPlans) capped + Load More ---------------- */

  const PAGE_SIZE = 10;

  const searchHistory = useCallback(
    async ({ reset = true } = {}) => {
      const token = String(selectedAthleteToken || "").trim();
      if (!token) {
        setError("Selected athlete is missing AthleteToken.");
        return;
      }

      setHistoryRequested(true);
      setHistoryLoading(true);
      setError("");

      try {
        const offset = reset ? null : historyOffset;

        const url =
          `/api/org/nutrition/plans/getByAthlete?athleteToken=${encodeURIComponent(token)}` +
          `&pageSize=${PAGE_SIZE}` +
          (offset ? `&offset=${encodeURIComponent(offset)}` : "");

        const res = await fetch(url, {
          method: "GET",
          credentials: "include",
          headers: { "Content-Type": "application/json", ...orgAuthHeaders },
        });

        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.error || data?.detail || "Failed to load plans.");

        const plans = Array.isArray(data?.plans) ? data.plans : [];
        const mapped = plans.map((p) => ({
          id: p.id,
          title: p.phase ? `Nutrition Plan • ${p.phase}` : "Nutrition Plan",
          prescription: p.prescription || "",
          createdAt: p.createdAt || "",
          createdBy: p.createdBy || "",
          _raw: p,
        }));

        if (reset) setHistoryItems(mapped);
        else setHistoryItems((prev) => prev.concat(mapped));

        const nextOffset = data?.nextOffset ? String(data.nextOffset) : null;
        const hasMore = Boolean(data?.hasMore) || Boolean(nextOffset);

        setHistoryOffset(nextOffset);
        setHistoryHasMore(hasMore);
      } catch (err) {
        console.error("[org/prescriptions] searchHistory error:", err);
        if (reset) setHistoryItems([]);
        setHistoryHasMore(false);
        setHistoryOffset(null);
        setError(err?.message || "Failed to load plans.");
      } finally {
        setHistoryLoading(false);
      }
    },
    [selectedAthleteToken, historyOffset, orgAuthHeaders, setError]
  );

  const loadMoreHistory = useCallback(() => {
    if (!historyHasMore || historyLoading) return;
    return searchHistory({ reset: false });
  }, [historyHasMore, historyLoading, searchHistory]);

  /* ---------------- Create plan ---------------- */

  const createPlan = useCallback(
    async (e, { advance = false } = {}) => {
      e?.preventDefault?.();
      setError("");
      if (createLoading) return;

      const msg = validateBuilder();
      if (msg) return setError(msg);

      const athleteEmail = normalizeEmail(selectedAthleteEmail);
      const athleteToken = String(selectedAthleteToken || "").trim();

      if (!athleteEmail) return setError("Select an athlete first.");
      if (!athleteToken) return setError("Selected athlete is missing AthleteToken.");

      setCreateLoading(true);

      try {
        const createdBy = user?.Email || user?.email || "";
        const summaryText = buildPlanSummaryText(structured);

      // ✅ Choose effective date from builder (recommended: structured.metaEffectiveDate)
      // Fallback: today
      const effectiveISO =
        dateToISO(structured?.metaEffectiveDate || structured?.startDate || new Date());

      // Build plan json
      const rawPlanJson = buildNutritionPlanJson(structured, { createdBy });

      // ✅ Force planJson.meta.effectiveDate to match what we write to Airtable
      const planJson = {
        ...(rawPlanJson && typeof rawPlanJson === "object" ? rawPlanJson : {}),
        meta: {
          ...((rawPlanJson && typeof rawPlanJson === "object" && rawPlanJson.meta) ? rawPlanJson.meta : {}),
          effectiveDate: effectiveISO,
        },
      };

      // 1) NutritionPlans upsert (source of truth)
      const upsertRes = await fetch("/api/org/nutrition/plans/upsert", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json", ...orgAuthHeaders },
        body: JSON.stringify({
          athleteToken,
          phase: structured.phase || "Maintain",
          daily: {
            calories: structured.calories || "",
            protein: structured.proteinGrams || "",
            carbs: structured.carbsGrams || "",
            fat: structured.fatsGrams || "",
          },

          // ✅ NEW: write to Airtable column "Meta Effective Date"
          metaEffectiveDate: effectiveISO,

          // ✅ Keep PlanJson in sync too
          planJson,

          prescription: summaryText,
          createdBy,
          status: "active",
        }),
      });

        const upsertData = await upsertRes.json().catch(() => ({}));
        if (!upsertRes.ok) throw new Error(upsertData?.error || "Failed to save NutritionPlan (PlanJson).");

        // ✅ mark done immediately (UI + speed mode)
        markDone(athleteEmail);
        setDoneEmailsFromPlans((prev) => {
          const next = new Set(prev);
          next.add(athleteEmail);
          return next;
        });

        // If history is open, refresh first page so newest is visible
        if (view === "history") {
          setHistoryOffset(null);
          await searchHistory({ reset: true });
        }

        setView("builder");
        if (advance) advanceSafely(() => goToNextAthlete(), 150);
      } catch (err) {
        console.error("[org/prescriptions] createPlan error:", err);
        setError(err?.message || "Failed to create plan.");
      } finally {
        setCreateLoading(false);
      }
    },
    [
      orgAuthHeaders,
      selectedAthleteEmail,
      selectedAthleteToken,
      structured,
      user,
      createLoading,
      validateBuilder,
      markDone,
      view,
      searchHistory,
      goToNextAthlete,
      advanceSafely,
      setError,
    ]
  );

  const isBusy = loading || loadingAthletes || templatesLoading;

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
            {statusLoading ? (
              <p className="text-[11px] text-gray-500 mt-1">Checking plan status…</p>
            ) : null}
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
              onClick={async () => {
                await refreshAll();
                await refreshRosterPlanStatus();
              }}
              className="px-4 py-2 rounded-xl bg-[#46769B] text-white text-sm font-semibold hover:brightness-110"
              type="button"
            >
              Refresh
            </button>
          </div>
        </div>

        {/* Status */}
        {isBusy && (
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
          <AthleteRoster
            athletes={athletes}
            filteredAthletes={filteredAthletes}
            athleteSearch={athleteSearch}
            setAthleteSearch={setAthleteSearch}
            selectedAthleteEmail={selectedAthleteEmail}
            setSelectedAthleteEmail={(email) => {
              setSelectedAthleteEmail(email);

              // reset history for new athlete
              setHistoryRequested(false);
              setHistoryItems([]);
              setHistoryHasMore(false);
              setHistoryOffset(null);
            }}
            completedEmails={completedEmails}
            router={router}
            inputBase={inputBase}
            selectedAthleteToken={selectedAthleteToken}
          />

          <section className="lg:col-span-8 space-y-6">
            <SelectedAthleteCard
              selectedAthlete={selectedAthlete}
              selectedAthleteToken={selectedAthleteToken}
              view={view}
              setView={(v) => {
                setView(v);

                // Optional QoL: load first page when you enter history (still capped)
                if (v === "history" && !historyRequested) {
                  searchHistory({ reset: true });
                }
              }}
            />

            {view === "builder" && (
              <div className="bg-white rounded-2xl shadow-md border border-blue-100 p-6 space-y-6">
                <div>
                  <h3 className="text-lg font-bold">Create Plan</h3>
                  <p className="text-sm text-gray-600 mt-1">Saves to NutritionPlans (PlanJson + Prescription).</p>
                </div>

                <TemplatesPanel
                  inputBase={inputBase}
                  subtleHint={subtleHint}
                  templatesLoading={templatesLoading}
                  templatesError={templatesError}
                  activeTemplates={activeTemplates}
                  templateId={templateId}
                  setTemplateId={setTemplateId}
                  templateName={templateName}
                  setTemplateName={setTemplateName}
                  templateNotes={templateNotes}
                  setTemplateNotes={setTemplateNotes}
                  onRefreshTemplates={fetchTemplates}
                  onApplyTemplate={applyTemplateToBuilder}
                  onOpenDeleteConfirm={openDeleteTemplateConfirm}
                  onSaveAsTemplate={saveAsTemplate}
                />

                <PlanBuilderForm
                  inputBase={inputBase}
                  subtleHint={subtleHint}
                  title={title}
                  setTitle={setTitle}
                  structured={structured}
                  onChange={(k, v) => onChange(k, v)}
                  OPTIONS={OPTIONS}
                  createLoading={createLoading}
                  selectedAthleteEmail={selectedAthleteEmail}
                  onReset={resetBuilder}
                  onSave={(e) => createPlan(e, { advance: false })}
                  onSaveNext={(e) => createPlan(e, { advance: true })}
                />
              </div>
            )}

            {view === "history" && (
              <PlanHistory
                prescriptions={historyRequested ? historyItems : []}
                selectedAthleteToken={selectedAthleteToken}
                selectedAthleteEmail={selectedAthleteEmail}
                selectedAthleteName={selectedAthlete?.name || ""}
                historyRequested={historyRequested}
                loading={historyLoading}
                hasMore={historyHasMore}
                onSearch={() => searchHistory({ reset: true })}
                onLoadMore={loadMoreHistory}
                subtleHint={subtleHint}
                onCopyNotesToBuilder={(p) => {
                  setTitle(p.title || "Nutrition + Supplements Plan");
                  setStructured((prev) => ({ ...prev, freeformNotes: p.prescription || "" }));
                  setView("builder");
                }}
              />
            )}
          </section>
        </div>
      </main>

      <ConfirmDeleteModal
        open={confirmDeleteOpen}
        title="Delete Template"
        description={
          templateById
            ? `Are you sure you want to delete “${templateById.name}”? This cannot be undone.`
            : "Are you sure you want to delete this template? This cannot be undone."
        }
        confirmText="Delete Template"
        cancelText="Cancel"
        loading={deleteBusy}
        error={deleteError}
        onClose={() => {
          if (deleteBusy) return;
          setConfirmDeleteOpen(false);
          setDeleteError("");
        }}
        onConfirm={deleteTemplate}
      />
    </div>
  );
}
