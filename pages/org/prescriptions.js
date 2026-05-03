// /pages/org/prescriptions.js

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { useAuthContext } from "@/hooks/useAuth";

import { DEFAULT_STRUCTURED } from "@/lib/org/prescriptions/prescriptions-utils";
import { useOrgPrescriptionsData } from "@/hooks/org/useOrgPrescriptionsData";
import { useRosterSpeedMode } from "@/hooks/org/useRosterSpeedMode";
import { buildOptions } from "@/lib/org/prescriptions/prescriptions-constants";

import { useOrgPrescriptionsPageAuth } from "@/hooks/org/prescriptions/useOrgPrescriptionsPageAuth";
import { useAthleteSelection } from "@/hooks/org/prescriptions/useAthleteSelection";
import { useRosterPlanStatus } from "@/hooks/org/prescriptions/useRosterPlanStatus";
import { useTemplateActions } from "@/hooks/org/prescriptions/useTemplateActions";
import { usePlanHistory } from "@/hooks/org/prescriptions/usePlanHistory";
import { usePlanCreator } from "@/hooks/org/prescriptions/usePlanCreator";

import ConfirmDeleteModal from "@/components/org/prescriptions/ConfirmDeleteModal";
import AthleteRoster from "@/components/org/prescriptions/AthleteRoster";

const PlanBuilderForm = dynamic(
  () => import("@/components/org/prescriptions/planBuilder/PlanBuilderForm"),
  { ssr: false }
);

const GroupBlastPanel = dynamic(
  () => import("@/components/org/prescriptions/GroupBlastPanel"),
  { ssr: false }
);

// ─── DS tokens (page-level only) ─────────────────────────────────────────────
const DS = {
  brand:        "#1E3A5F",
  brandLight:   "#2A4F7C",
  brandBg:      "#EEF3F9",
  brandBorder:  "#C0D0E0",
  border:       "#E8ECF0",
  pageBg:       "#F4F7FB",
  cardBg:       "#FFFFFF",
  bodyText:     "#1A2535",
  labelText:    "#5A6A7D",
  dimText:      "#9BA8B4",
  banned:       "#C8102E",
  bannedBg:     "#FFF0F0",
  bannedBorder: "#FFC8C8",
};

export default function OrgPrescriptionsPage() {
  const router = useRouter();
  const { user } = useAuthContext();

  const { role, orgName, orgToken, orgAuthHeaders } = useOrgPrescriptionsPageAuth({ user, router });

  /* ── UI state ── */
  const [loading,    setLoading]    = useState(true);
  const [view,       setView]       = useState("builder"); // kept for usePlanCreator compat
  const [mode,       setMode]       = useState("individual");
  const [title,      setTitle]      = useState("Nutrition + Supplements Plan");
  const [error,      setError]      = useState("");
  const [products,   setProducts]   = useState([]);

  const [structured, setStructured] = useState({ ...DEFAULT_STRUCTURED });
  const onChange     = (key, value) => setStructured((prev) => ({ ...prev, [key]: value }));
  const resetBuilder = () => {
    setTitle("Nutrition + Supplements Plan");
    setStructured({ ...DEFAULT_STRUCTURED });
  };

  const OPTIONS = useMemo(() => buildOptions(), []);

  const {
    athletes, templates, activeTemplates,
    loadingAthletes, templatesLoading,
    templatesError, setTemplatesError,
    fetchAthletes, fetchTemplates,
  } = useOrgPrescriptionsData({ orgAuthHeaders, orgToken });

  const {
    athleteSearch, setAthleteSearch,
    selectedAthleteEmail, setSelectedAthleteEmail,
    selectedAthlete, selectedAthleteToken,
    filteredAthletes,
    historyResetNonce, resetHistoryState,
  } = useAthleteSelection({ router, athletes });

  const { completedEmails: completedFromSpeedMode, markDone, goToNextAthlete, advanceSafely } = useRosterSpeedMode({
    filteredAthletes,
    selectedAthleteEmail,
    setSelectedAthleteEmail: (updater) => {
      setSelectedAthleteEmail(updater);
      resetHistoryState();
    },
    router,
  });

  const { doneEmailsFromPlans, doneTokens, statusLoading, refreshRosterPlanStatus, markDoneFromPlanStatus } =
    useRosterPlanStatus({ athletes, orgAuthHeaders });

  const completedEmails = useMemo(() => {
    const merged = new Set();
    for (const e of doneEmailsFromPlans) merged.add(e);
    if (completedFromSpeedMode?.forEach) completedFromSpeedMode.forEach((e) => merged.add(e));
    return merged;
  }, [doneEmailsFromPlans, completedFromSpeedMode]);

  const refreshAll = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [list] = await Promise.all([
        fetchAthletes(),
        fetchTemplates(),
        fetch("/api/stacks")
          .then((r) => r.ok ? r.json() : Promise.reject(new Error(`stacks ${r.status}`)))
          .then((d) => setProducts(Array.isArray(d?.records) ? d.records : []))
          .catch((err) => console.warn("[prescriptions] stacks fetch failed:", err.message)),
      ]);
      if (!selectedAthleteEmail) {
        const first = (list || []).find((a) => a?.email);
        if (first?.email) setSelectedAthleteEmail(String(first.email).toLowerCase());
      }
    } catch (err) {
      setError(err?.message || "Failed to load data.");
    } finally {
      setLoading(false);
    }
  }, [fetchAthletes, fetchTemplates, selectedAthleteEmail, setSelectedAthleteEmail]);

  useEffect(() => {
    if (!user) return;
    if (role !== "organization" && role !== "admin") return;
    refreshAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, role, orgToken]);

  const tpl = useTemplateActions({
    templates, fetchTemplates, orgAuthHeaders, user,
    structured, title, setTitle, setStructured,
    setView, setError, setTemplatesError,
  });

  const hist = usePlanHistory({ selectedAthleteToken, orgAuthHeaders, setError, historyResetNonce });

  const validateBuilder = useCallback(() => {
    const athleteEmail = String(selectedAthleteEmail || "").trim().toLowerCase();
    if (!athleteEmail)          return "Select an athlete first.";
    if (!selectedAthleteToken)  return "Selected athlete is missing AthleteToken. Please fix the athlete record.";
    const hasAny =
      structured.proteinRecommendation || structured.creatineRecommendation ||
      structured.bcaaRecommendation    || structured.electrolytesRecommendation ||
      structured.notesSupplements      || structured.calories ||
      structured.proteinGrams          || structured.carbsGrams ||
      structured.fatsGrams             || structured.hydrationOz ||
      structured.notesMacros           || structured.freeformNotes?.trim();
    if (!hasAny) return "Add at least one recommendation (supplements, macros, or notes).";
    return "";
  }, [selectedAthleteEmail, selectedAthleteToken, structured]);

  const { createLoading, createPlan } = usePlanCreator({
    orgAuthHeaders, user,
    selectedAthleteEmail, selectedAthleteToken,
    structured, validateBuilder,
    markDone, markDoneFromPlanStatus,
    view, searchHistory: hist.searchHistory,
    setHistoryOffset: hist.setHistoryOffset,
    setView, setError, advanceSafely, goToNextAthlete,
  });

  // ── Templates bundle — everything PlanBuilderForm's TemplatesDrawer needs ──
  const builderTpl = useMemo(() => ({
    // from useTemplateActions
    templateId:               tpl.templateId,
    setTemplateId:            tpl.setTemplateId,
    templateName:             tpl.templateName,
    setTemplateName:          tpl.setTemplateName,
    applyTemplateToBuilder:   tpl.applyTemplateToBuilder,
    openDeleteTemplateConfirm: tpl.openDeleteTemplateConfirm,
    saveAsTemplate:           tpl.saveAsTemplate,
    // from useOrgPrescriptionsData
    activeTemplates,
    templatesLoading,
    templatesError,
    onRefreshTemplates:       fetchTemplates,
  }), [
    tpl.templateId, tpl.setTemplateId, tpl.templateName, tpl.setTemplateName,
    tpl.applyTemplateToBuilder, tpl.openDeleteTemplateConfirm, tpl.saveAsTemplate,
    activeTemplates, templatesLoading, templatesError, fetchTemplates,
  ]);

  const isBusy = loading || loadingAthletes || templatesLoading;

  return (
    <div className="min-h-screen" style={{ backgroundColor: DS.pageBg, color: DS.bodyText }}>
      <main className="max-w-6xl mx-auto px-4 py-8 space-y-5">

        {/* ── Page header ── */}
        <div
          className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between px-5 py-4"
          style={{ backgroundColor: DS.cardBg, borderTop: `3px solid ${DS.brand}`, border: `1px solid ${DS.border}` }}
        >
          <div>
            <h1 className="text-xl font-black uppercase tracking-wide" style={{ color: DS.bodyText }}>
              Prescriptions
            </h1>
            <p className="text-xs mt-0.5" style={{ color: DS.dimText }}>
              Logged in as{" "}
              <span className="font-bold" style={{ color: DS.labelText }}>{orgName}</span>
              {statusLoading && <span className="ml-2">· checking plan status…</span>}
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Individual / Group Blast toggle */}
            <div className="flex rounded-sm overflow-hidden" style={{ border: `1px solid ${DS.border}` }}>
              {[
                { key: "individual", label: "Individual"  },
                { key: "group",      label: "Group Blast" },
              ].map(({ key, label }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setMode(key)}
                  className="px-3 py-1.5 text-xs font-black uppercase tracking-wide transition-all"
                  style={{
                    backgroundColor: mode === key ? DS.brand   : DS.cardBg,
                    color:           mode === key ? "#fff"     : DS.labelText,
                  }}
                  onMouseEnter={(e) => { if (mode !== key) { e.currentTarget.style.backgroundColor = DS.brandBg; e.currentTarget.style.color = DS.brand; } }}
                  onMouseLeave={(e) => { if (mode !== key) { e.currentTarget.style.backgroundColor = DS.cardBg;  e.currentTarget.style.color = DS.labelText; } }}
                >
                  {label}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => router.push("/org/workouts-calendar")}
              className="px-3 py-1.5 text-xs font-bold rounded-sm transition-all"
              style={{ border: `1px solid ${DS.border}`, backgroundColor: DS.cardBg, color: DS.labelText }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = DS.brandBorder; e.currentTarget.style.color = DS.brand; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = DS.border;      e.currentTarget.style.color = DS.labelText; }}
            >
              Dashboard
            </button>

            <button
              type="button"
              onClick={() => router.push("/org/athletes")}
              className="px-3 py-1.5 text-xs font-bold rounded-sm transition-all"
              style={{ border: `1px solid ${DS.border}`, backgroundColor: DS.cardBg, color: DS.labelText }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = DS.brandBorder; e.currentTarget.style.color = DS.brand; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = DS.border;      e.currentTarget.style.color = DS.labelText; }}
            >
              Athletes
            </button>

            <button
              type="button"
              onClick={async () => { await refreshAll(); await refreshRosterPlanStatus(); }}
              className="px-3 py-1.5 text-xs font-black uppercase tracking-wide rounded-sm transition-all"
              style={{ backgroundColor: DS.brand, color: "#fff" }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = DS.brandLight; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = DS.brand; }}
            >
              Refresh
            </button>
          </div>
        </div>

        {/* ── Status banners ── */}
        {isBusy && (
          <div
            className="px-4 py-3 text-xs"
            style={{ backgroundColor: DS.brandBg, border: `1px solid ${DS.brandBorder}`, color: DS.labelText }}
          >
            Loading…
          </div>
        )}
        {error && (
          <div
            className="px-4 py-3 text-xs font-bold"
            style={{ backgroundColor: DS.bannedBg, border: `1px solid ${DS.bannedBorder}`, color: DS.banned }}
          >
            {error}
          </div>
        )}

        {/* ── Group Blast mode ── */}
        {mode === "group" && (
          <div>
            <p className="text-xs mb-3 px-1" style={{ color: DS.dimText }}>
              Assign one plan to multiple athletes at once. Individual overrides live on each athlete's profile.
            </p>
            <GroupBlastPanel athletes={athletes} />
          </div>
        )}

        {/* ── Individual mode: roster (left) + unified builder (right) ── */}
        {mode === "individual" && (
          <div className="grid grid-cols-12 gap-5">

            {/* Roster */}
            <div className="col-span-12 lg:col-span-4">
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
                selectedAthleteToken={selectedAthleteToken}
                completedEmails={completedEmails}
                doneTokens={doneTokens}
                doneTokensLoading={statusLoading}
                router={router}
              />
            </div>

            {/* Unified builder — athlete header + tabs + history all in one card */}
            <section className="col-span-12 lg:col-span-8 min-w-0">
              <PlanBuilderForm
                // Plan data
                title={title}
                setTitle={setTitle}
                structured={structured}
                onChange={onChange}
                OPTIONS={OPTIONS}
                // Save
                createLoading={createLoading}
                selectedAthleteEmail={selectedAthleteEmail}
                onReset={resetBuilder}
                onSave={(e) => createPlan(e, { advance: false })}
                onSaveNext={(e) => createPlan(e, { advance: true })}
                // Athlete display
                selectedAthlete={selectedAthlete}
                // Templates
                tpl={builderTpl}
                // History
                hist={hist}
                // SmartStack products — fetched once at page level
                products={products}
              />
            </section>
          </div>
        )}

      </main>

      {/* Template delete confirmation — unchanged */}
      <ConfirmDeleteModal
        open={tpl.confirmDeleteOpen}
        title="Delete Template"
        description={
          tpl.templateById
            ? `Are you sure you want to delete "${tpl.templateById.name}"? This cannot be undone.`
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