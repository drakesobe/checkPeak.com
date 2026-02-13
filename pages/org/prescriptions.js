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

  const orgToken = useMemo(() => String(user?.Token || user?.token || user?.["Organization Token"] || "").trim(), [user]);

  const orgAuthHeaders = useMemo(() => (orgToken ? { "x-org-token": orgToken } : {}), [orgToken]);

  // UI state
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState("builder"); // builder | history
  const [title, setTitle] = useState("Nutrition + Supplements Plan");
  const [createLoading, setCreateLoading] = useState(false);

  const [athleteSearch, setAthleteSearch] = useState("");
  const [selectedAthleteEmail, setSelectedAthleteEmail] = useState("");

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
    prescriptions,
    templates,
    activeTemplates,

    loadingAthletes,
    loadingPrescriptions,
    templatesLoading,

    error,
    templatesError,

    setError,
    setTemplatesError,

    fetchAthletes,
    fetchPrescriptionsForAthlete,
    fetchTemplates,
    setTemplates,
  } = useOrgPrescriptionsData({ orgAuthHeaders, orgToken });

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

  // styles
  const inputBase =
    "w-full px-4 py-3 rounded-xl border border-gray-300 bg-white text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#46769B]/30";
  const subtleHint = "text-[11px] text-gray-500 mt-2 leading-relaxed";

  // guards
  useEffect(() => {
    if (!user) return;
    if (role && role !== "organization") router.push("/dashboard");
  }, [user, role, router]);

  // preselect by athleteEmail OR athleteToken
  useEffect(() => {
    const qEmail = router?.query?.athleteEmail;
    const qToken = router?.query?.athleteToken;

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

  const { completedEmails, markDone, goToNextAthlete, advanceSafely } = useRosterSpeedMode({
    filteredAthletes,
    selectedAthleteEmail,
    setSelectedAthleteEmail,
    router,
  });

  const refreshAll = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const list = await fetchAthletes();
      await fetchTemplates();

      // if not selected yet, pick first
      if (!selectedAthleteEmail) {
        const first = (list || []).find((a) => a?.email);
        if (first?.email) setSelectedAthleteEmail(normalizeEmail(first.email));
      }

      const qEmail = router?.query?.athleteEmail;
      const email =
        (typeof qEmail === "string" && qEmail.includes("@") && qEmail) || selectedAthleteEmail;

      if (email) await fetchPrescriptionsForAthlete(email);
    } catch (err) {
      console.error("[org/prescriptions] refreshAll error:", err);
      setError(err?.message || "Failed to load data.");
    } finally {
      setLoading(false);
    }
  }, [
    fetchAthletes,
    fetchTemplates,
    fetchPrescriptionsForAthlete,
    router?.query?.athleteEmail,
    selectedAthleteEmail,
    setError,
  ]);

  useEffect(() => {
    if (!user) return;
    if (role !== "organization") return;
    refreshAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, role, orgToken]);

  useEffect(() => {
    if (!user) return;
    if (role !== "organization") return;
    if (!selectedAthleteEmail) return;
    fetchPrescriptionsForAthlete(selectedAthleteEmail).catch((err) =>
      setError(err?.message || "Failed to load prescriptions.")
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedAthleteEmail]);

  // builder helpers
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

  // templates actions
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
    if (!orgToken) return setTemplatesError("Missing org token. Re-login as org.");

    try {
      const res = await fetch("/api/org/createPlanTemplate", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json", ...orgAuthHeaders },
        body: JSON.stringify({
          token: orgToken,
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
  }, [orgAuthHeaders, orgToken, user, structured, templateName, templateNotes, fetchTemplates, setError, setTemplatesError]);

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

  // create plan
  const createPlan = useCallback(
    async (e, { advance = false } = {}) => {
      e?.preventDefault?.();
      setError("");
      if (createLoading) return;

      const msg = validateBuilder();
      if (msg) return setError(msg);

      const athleteEmail = normalizeEmail(selectedAthleteEmail);
      const athleteToken = selectedAthleteToken;
      if (!athleteEmail) return setError("Select an athlete first.");
      if (!athleteToken) return setError("Selected athlete is missing AthleteToken.");

      setCreateLoading(true);

      try {
        const createdBy = user?.Email || user?.email || "";
        const summaryText = buildPlanSummaryText(structured);
        const planJson = buildNutritionPlanJson(structured, { createdBy });

        // 1) new NutritionPlans upsert
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
            planJson,
            prescription: summaryText,
            createdBy,
            status: "active",
          }),
        });

        const upsertData = await upsertRes.json().catch(() => ({}));
        if (!upsertRes.ok) throw new Error(upsertData?.error || "Failed to save NutritionPlan (PlanJson).");

        // 2) legacy prescription history (non-blocking)
        const res = await fetch("/api/org/createPrescription", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json", ...orgAuthHeaders },
          body: JSON.stringify({
            athleteEmail,
            organizationName: orgName,
            title: title.trim() || "Nutrition + Supplements Plan",
            prescription: summaryText,
            createdBy,
            structured: {
              phase: structured.phase || "Maintain",
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

        const legacyData = await res.json().catch(() => ({}));
        if (!res.ok) console.warn("[org/prescriptions] legacy createPrescription failed:", legacyData);

        markDone(athleteEmail);
        fetchPrescriptionsForAthlete(athleteEmail).catch(() => {});
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
      title,
      orgName,
      user,
      createLoading,
      fetchPrescriptionsForAthlete,
      goToNextAthlete,
      advanceSafely,
      markDone,
      setError,
    ]
  );

  const isBusy = loading || loadingAthletes || loadingPrescriptions || templatesLoading;

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
            setSelectedAthleteEmail={setSelectedAthleteEmail}
            completedEmails={completedEmails}
            router={router}
            inputBase={inputBase}
          />

          <section className="lg:col-span-8 space-y-6">
            <SelectedAthleteCard
              selectedAthlete={selectedAthlete}
              selectedAthleteToken={selectedAthleteToken}
              view={view}
              setView={setView}
            />

            {view === "builder" && (
              <div className="bg-white rounded-2xl shadow-md border border-blue-100 p-6 space-y-6">
                <div>
                  <h3 className="text-lg font-bold">Create Plan</h3>
                  <p className="text-sm text-gray-600 mt-1">
                    This now saves both: (1) NutritionPlans PlanJson (new) and (2) legacy Prescription history.
                  </p>
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
                  onChange={(k, v) => setStructured((prev) => ({ ...prev, [k]: v }))}
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
                prescriptions={prescriptions}
                selectedAthleteEmail={selectedAthleteEmail}
                onRefresh={() => fetchPrescriptionsForAthlete(selectedAthleteEmail)}
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
