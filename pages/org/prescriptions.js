// /pages/org/prescriptions.js
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { useAuthContext } from "@/hooks/useAuth";

import { DEFAULT_STRUCTURED } from "@/lib/org/prescriptions/prescriptions-utils";
import { useOrgPrescriptionsData } from "@/hooks/org/useOrgPrescriptionsData";
import { useRosterSpeedMode } from "@/hooks/org/useRosterSpeedMode";

import { buildOptions, inputBase, subtleHint } from "@/lib/org/prescriptions/prescriptions-constants";

import { useOrgPrescriptionsPageAuth } from "@/hooks/org/prescriptions/useOrgPrescriptionsPageAuth";
import { useAthleteSelection } from "@/hooks/org/prescriptions/useAthleteSelection";
import { useRosterPlanStatus } from "@/hooks/org/prescriptions/useRosterPlanStatus";
import { useTemplateActions } from "@/hooks/org/prescriptions/useTemplateActions";
import { usePlanHistory } from "@/hooks/org/prescriptions/usePlanHistory";
import { usePlanCreator } from "@/hooks/org/prescriptions/usePlanCreator";

import ConfirmDeleteModal from "@/components/org/prescriptions/ConfirmDeleteModal";
import AthleteRoster from "@/components/org/prescriptions/AthleteRoster";
import SelectedAthleteCard from "@/components/org/prescriptions/SelectedAthleteCard";
import TemplatesPanel from "@/components/org/prescriptions/TemplatesPanel";
// ✅ NEW modular plan builder import
import PlanBuilderForm from "@/components/org/prescriptions/planBuilder/PlanBuilderForm";
import PlanHistory from "@/components/org/prescriptions/PlanHistory";

export default function OrgPrescriptionsPage() {
  const router = useRouter();
  const { user } = useAuthContext();

  // auth + org headers + guard
  const { role, orgName, orgToken, orgAuthHeaders } = useOrgPrescriptionsPageAuth({ user, router });

  /* ---------------- UI state ---------------- */
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState("builder"); // builder | history
  const [title, setTitle] = useState("Nutrition + Supplements Plan");
  const [error, setError] = useState("");

  const [structured, setStructured] = useState({ ...DEFAULT_STRUCTURED });
  const onChange = (key, value) => setStructured((prev) => ({ ...prev, [key]: value }));
  const resetBuilder = () => {
    setTitle("Nutrition + Supplements Plan");
    setStructured({ ...DEFAULT_STRUCTURED });
  };

  const OPTIONS = useMemo(() => buildOptions(), []);

  const {
    athletes,
    templates,
    activeTemplates,

    loadingAthletes,
    templatesLoading,

    templatesError,
    setTemplatesError,

    fetchAthletes,
    fetchTemplates,
  } = useOrgPrescriptionsData({ orgAuthHeaders, orgToken });

  // athlete selection + url preselect + search filtering
  const {
    athleteSearch,
    setAthleteSearch,
    selectedAthleteEmail,
    setSelectedAthleteEmail,
    selectedAthlete,
    selectedAthleteToken,
    filteredAthletes,
    historyResetNonce,
    resetHistoryState,
  } = useAthleteSelection({ router, athletes });

  // roster speed mode
  const { completedEmails: completedFromSpeedMode, markDone, goToNextAthlete, advanceSafely } = useRosterSpeedMode({
    filteredAthletes,
    selectedAthleteEmail,
    // ✅ supports both string and functional updater
    setSelectedAthleteEmail: (updater) => {
      setSelectedAthleteEmail(updater);
      resetHistoryState();
    },
    router,
  });

  // plan-status “Done” set
  const { doneEmailsFromPlans, statusLoading, refreshRosterPlanStatus, markDoneFromPlanStatus } = useRosterPlanStatus({
    athletes,
    orgAuthHeaders,
  });

  // merged completed emails
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
        if (first?.email) setSelectedAthleteEmail(String(first.email).toLowerCase());
      }
    } catch (err) {
      console.error("[org/prescriptions] refreshAll error:", err);
      setError(err?.message || "Failed to load data.");
    } finally {
      setLoading(false);
    }
  }, [fetchAthletes, fetchTemplates, selectedAthleteEmail, setSelectedAthleteEmail]);

  useEffect(() => {
    if (!user) return;
    if (role !== "organization") return;
    refreshAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, role, orgToken]);

  // templates actions + delete modal
  const tpl = useTemplateActions({
    templates,
    fetchTemplates,
    orgAuthHeaders,
    user,
    structured,
    title,
    setTitle,
    setStructured,
    setView,
    setError,
    setTemplatesError,
  });

  // history paging
  const hist = usePlanHistory({
    selectedAthleteToken,
    orgAuthHeaders,
    setError,
    historyResetNonce,
  });

  // validation stays simple in page (it touches selectedAthlete + structured)
  const validateBuilder = useCallback(() => {
    const athleteEmail = String(selectedAthleteEmail || "").trim().toLowerCase();
    if (!athleteEmail) return "Select an athlete first.";
    if (!selectedAthleteToken)
      return "Selected athlete is missing AthleteToken (lookup). Please fix the athlete record.";

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
  }, [selectedAthleteEmail, selectedAthleteToken, structured]);

  // plan creator
  const { createLoading, createPlan } = usePlanCreator({
    orgAuthHeaders,
    user,
    selectedAthleteEmail,
    selectedAthleteToken,
    structured,
    validateBuilder,
    markDone,
    markDoneFromPlanStatus,
    view,
    searchHistory: hist.searchHistory,
    setHistoryOffset: hist.setHistoryOffset,
    setView,
    setError,
    advanceSafely,
    goToNextAthlete,
  });

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
            {statusLoading ? <p className="text-[11px] text-gray-500 mt-1">Checking plan status…</p> : null}
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
              resetHistoryState();
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
                if (v === "history" && !hist.historyRequested) {
                  hist.searchHistory({ reset: true });
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
                  templateId={tpl.templateId}
                  setTemplateId={tpl.setTemplateId}
                  templateName={tpl.templateName}
                  setTemplateName={tpl.setTemplateName}
                  templateNotes={tpl.templateNotes}
                  setTemplateNotes={tpl.setTemplateNotes}
                  onRefreshTemplates={fetchTemplates}
                  onApplyTemplate={tpl.applyTemplateToBuilder}
                  onOpenDeleteConfirm={tpl.openDeleteTemplateConfirm}
                  onSaveAsTemplate={tpl.saveAsTemplate}
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
                prescriptions={hist.historyRequested ? hist.historyItems : []}
                selectedAthleteToken={selectedAthleteToken}
                selectedAthleteEmail={selectedAthleteEmail}
                selectedAthleteName={selectedAthlete?.name || ""}
                historyRequested={hist.historyRequested}
                loading={hist.historyLoading}
                hasMore={hist.historyHasMore}
                onSearch={() => hist.searchHistory({ reset: true })}
                onLoadMore={hist.loadMoreHistory}
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
        open={tpl.confirmDeleteOpen}
        title="Delete Template"
        description={
          tpl.templateById
            ? `Are you sure you want to delete “${tpl.templateById.name}”? This cannot be undone.`
            : "Are you sure you want to delete this template? This cannot be undone."
        }
        confirmText="Delete Template"
        cancelText="Cancel"
        loading={tpl.deleteBusy}
        error={tpl.deleteError}
        onClose={() => {
          if (tpl.deleteBusy) return;
          tpl.setConfirmDeleteOpen(false);
          tpl.setDeleteError("");
        }}
        onConfirm={tpl.deleteTemplate}
      />
    </div>
  );
}
