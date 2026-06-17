// pages/org/prescriptions.js

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/router";
import { useAuthContext } from "@/hooks/useAuth";
import { X, Zap, Users, RefreshCw } from "lucide-react";

import { DEFAULT_STRUCTURED } from "@/lib/org/prescriptions/prescriptions-utils";
import { useOrgPrescriptionsData } from "@/hooks/org/useOrgPrescriptionsData";
import { useRosterSpeedMode } from "@/hooks/org/useRosterSpeedMode";
import { buildOptions } from "@/lib/org/prescriptions/prescriptions-constants";

import { useOrgPrescriptionsPageAuth } from "@/hooks/org/prescriptions/useOrgPrescriptionsPageAuth";
import { useBillingGate }   from "@/hooks/org/useBillingGate";
import BillingGateScreen    from "@/components/org/reviewQueue/BillingGateScreen";
import BillingLoadingScreen from "@/components/org/reviewQueue/BillingLoadingScreen";
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

const SpeedMode = dynamic(
  () => import("@/components/org/prescriptions/SpeedMode"),
  { ssr: false }
);

/* ── DS tokens ────────────────────────────────────────────────────────────────── */
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
  caution:      "#B86000",
  cautionBg:    "#FFFBF0",
  cautionBorder:"#FFD580",
  safe:         "#00873E",
  safeBg:       "#F0FBF4",
};

export default function OrgPrescriptionsPage() {
  const router = useRouter();
  const { user, logout } = useAuthContext();

  const { role, orgName, orgToken, orgAuthHeaders } = useOrgPrescriptionsPageAuth({ user, router });
  const isOrgSide = role === "organization" || role === "admin" || role === "trainer";

  const { billingLoading, billingErr, billing, isPaidOk, rawIsPaidOk, isAdminBypass } = useBillingGate({ user, role, isOrgSide });
  const showBillingWarning = isAdminBypass && !rawIsPaidOk;

  const onLogout = useCallback(async () => {
    try { await logout?.(); } finally { router.push("/"); }
  }, [logout, router]);

  /* ── Core state ── */
  const [loading,         setLoading]         = useState(true);
  const [view,            setView]             = useState("builder");
  const [title,           setTitle]            = useState("Nutrition + Supplements Plan");
  const [error,           setError]            = useState("");
  const [products,        setProducts]         = useState([]);
  const [showGroupBlast,  setShowGroupBlast]   = useState(false);
  const [planSavedAt,     setPlanSavedAt]      = useState(null);
  const [speedMode,       setSpeedMode]        = useState(false);

  const [structured, setStructured] = useState({ ...DEFAULT_STRUCTURED });
  const onChange     = (key, value) => setStructured((prev) => ({ ...prev, [key]: value }));
  const resetBuilder = () => {
    setTitle("Nutrition + Supplements Plan");
    setStructured({ ...DEFAULT_STRUCTURED });
  };

  // Tracks which athlete token has been auto-populated so we don't repeat it.
  const autoPopulatedTokenRef = useRef("");
  // Set true by Save & Next wrappers so the effect skips loading the next athlete's old plan.
  const skipAutoPopulateRef   = useRef(false);

  const OPTIONS = useMemo(() => buildOptions(), []);

  /* ── Data hooks ── */
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

  // Signal that the next athlete change came from Save & Next (not an explicit click),
  // so auto-populate should leave the form alone.
  const advanceSafelyWithSkip = useCallback(() => {
    skipAutoPopulateRef.current = true;
    return advanceSafely?.();
  }, [advanceSafely]);

  const goToNextAthleteWithSkip = useCallback(() => {
    skipAutoPopulateRef.current = true;
    return goToNextAthlete?.();
  }, [goToNextAthlete]);

  const { doneEmailsFromPlans, doneTokens, statusLoading, refreshRosterPlanStatus, markDoneFromPlanStatus } =
    useRosterPlanStatus({ athletes, orgAuthHeaders });

  const completedEmails = useMemo(() => {
    const merged = new Set();
    for (const e of doneEmailsFromPlans) merged.add(e);
    if (completedFromSpeedMode?.forEach) completedFromSpeedMode.forEach((e) => merged.add(e));
    return merged;
  }, [doneEmailsFromPlans, completedFromSpeedMode]);

  /* ── Refresh all ── */
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

  /* ── Template actions ── */
  const tpl = useTemplateActions({
    templates, fetchTemplates, orgAuthHeaders, user,
    structured, title, setTitle, setStructured,
    setView, setError, setTemplatesError,
  });

  /* ── Plan history ── */
  const hist = usePlanHistory({ selectedAthleteToken, orgAuthHeaders, setError, historyResetNonce });

  /* ── Page-level history trigger ── */
  // PlanBuilderForm has its own trigger but uses a narrower token lookup that can miss
  // the token when athlete data comes from Airtable fields. This is the authoritative trigger.
  const histAutoLoadRef = useRef("");
  useEffect(() => {
    if (!selectedAthleteToken) return;
    if (selectedAthleteToken === histAutoLoadRef.current) return;
    histAutoLoadRef.current = selectedAthleteToken;
    hist.searchHistory?.({ reset: true });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedAthleteToken]);

  /* ── Auto-populate form from athlete's most recent plan ── */
  useEffect(() => {
    if (!selectedAthleteToken) return;
    if (!hist.historyItems?.length) return;
    // Guard: historyItems must belong to the current athlete (not a previous athlete's stale data).
    if (hist.fetchedForToken !== selectedAthleteToken) return;
    if (autoPopulatedTokenRef.current === selectedAthleteToken) return;

    autoPopulatedTokenRef.current = selectedAthleteToken;

    // Save & Next: keep the current form data, skip loading the next athlete's old plan.
    if (skipAutoPopulateRef.current) {
      skipAutoPopulateRef.current = false;
      return;
    }

    const item = hist.historyItems[0];
    const raw  = item?._raw;
    if (!raw) return;

    const pj   = raw.planJson && typeof raw.planJson === "object" ? raw.planJson : null;
    const supp = pj?.supplements || {};

    setStructured({
      ...DEFAULT_STRUCTURED,
      phase:        String(raw.phase || pj?.phase || DEFAULT_STRUCTURED.phase),
      calories:     String(raw.dailyCalories    ?? pj?.daily?.calories  ?? ""),
      proteinGrams: String(raw.dailyProtein     ?? pj?.daily?.protein   ?? ""),
      carbsGrams:   String(raw.dailyCarbs       ?? pj?.daily?.carbs     ?? ""),
      fatsGrams:    String(raw.dailyFat         ?? pj?.daily?.fat       ?? ""),
      hydrationOz:  String(raw.dailyHydration   ?? pj?.hydrationOz ?? pj?.daily?.hydrationOz ?? ""),

      notesMacros: String(pj?.notesMacros || pj?.notes?.macros || ""),

      mealSplit:  pj?.mealSplit  && typeof pj.mealSplit  === "object" ? pj.mealSplit  : DEFAULT_STRUCTURED.mealSplit,
      mealBlocks: pj?.mealBlocks && typeof pj.mealBlocks === "object" ? pj.mealBlocks : DEFAULT_STRUCTURED.mealBlocks,

      // Supplement text recommendations (handles both old and new planJson formats)
      proteinRecommendation:      String(supp.proteinRecommendation      || supp.protein      || ""),
      creatineRecommendation:     String(supp.creatineRecommendation     || supp.creatine     || ""),
      bcaaRecommendation:         String(supp.bcaaRecommendation         || supp.bcaaEaa      || ""),
      electrolytesRecommendation: String(supp.electrolytesRecommendation || supp.electrolytes || ""),
      preWorkoutRecommendation:   String(supp.preWorkoutRecommendation   || ""),
      proteinBarRecommendation:   String(supp.proteinBarRecommendation   || ""),
      notesSupplements:           String(supp.notes || pj?.notes?.supplements || ""),

      // Product objects (affiliate card rendering)
      ...(supp.proteinProduct    ? { proteinProduct:    supp.proteinProduct    } : {}),
      ...(supp.creatineProduct   ? { creatineProduct:   supp.creatineProduct   } : {}),
      ...(supp.bcaaProduct       ? { bcaaProduct:       supp.bcaaProduct       } : {}),
      ...(supp.preWorkoutProduct ? { preWorkoutProduct: supp.preWorkoutProduct } : {}),
      ...(supp.proteinBarProduct ? { proteinBarProduct: supp.proteinBarProduct } : {}),

      metaStatus:        String(pj?.meta?.status        || DEFAULT_STRUCTURED.metaStatus),
      metaEffectiveDate: String(pj?.meta?.effectiveDate || ""),
      freeformNotes:     String(raw.prescription || pj?.freeformNotes || ""),
    });

    setTitle(String(pj?.title || item?.title || "Nutrition + Supplements Plan"));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hist.historyItems, hist.fetchedForToken, selectedAthleteToken]);

  /* ── Validate + save ── */
  const validateBuilder = useCallback(() => {
    const athleteEmail = String(selectedAthleteEmail || "").trim().toLowerCase();
    if (!athleteEmail)          return "Select an athlete first.";
    if (!selectedAthleteToken)  return "Selected athlete is missing AthleteToken.";
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
    setView, setError,
    advanceSafely:   advanceSafelyWithSkip,
    goToNextAthlete: goToNextAthleteWithSkip,
    onSuccess: () => setPlanSavedAt(Date.now()),
  });

  /* ── Templates bundle ── */
  const builderTpl = useMemo(() => ({
    templateId:                tpl.templateId,
    setTemplateId:             tpl.setTemplateId,
    templateName:              tpl.templateName,
    setTemplateName:           tpl.setTemplateName,
    applyTemplateToBuilder:    tpl.applyTemplateToBuilder,
    openDeleteTemplateConfirm: tpl.openDeleteTemplateConfirm,
    saveAsTemplate:            tpl.saveAsTemplate,
    activeTemplates,
    templatesLoading,
    templatesError,
    onRefreshTemplates:        fetchTemplates,
  }), [
    tpl.templateId, tpl.setTemplateId, tpl.templateName, tpl.setTemplateName,
    tpl.applyTemplateToBuilder, tpl.openDeleteTemplateConfirm, tpl.saveAsTemplate,
    activeTemplates, templatesLoading, templatesError, fetchTemplates,
  ]);

  /* ── Progress numbers ── */
  const activePlanCount = doneTokens.size;
  const totalAthletes   = athletes.length;
  const progressLabel   = totalAthletes > 0
    ? `${activePlanCount} / ${totalAthletes} active plans`
    : null;

  const isBusy = loading || loadingAthletes;

  /* ── Billing gates ── */
  if (billingLoading) return <BillingLoadingScreen />;
  if (billingErr || !isPaidOk) {
    return (
      <BillingGateScreen
        role={role} billing={billing} error={billingErr}
        onLogout={onLogout} onGoAccount={() => router.push("/account")}
      />
    );
  }

  /* ── Speed Mode full-screen render ── */
  if (speedMode) {
    return (
      <SpeedMode
        filteredAthletes={filteredAthletes}
        selectedAthlete={selectedAthlete}
        selectedAthleteEmail={selectedAthleteEmail}
        selectedAthleteToken={selectedAthleteToken}
        structured={structured}
        onChange={onChange}
        setStructured={setStructured}
        setTitle={setTitle}
        products={products}
        hist={hist}
        createLoading={createLoading}
        onSave={(e) => createPlan(e, { advance: false })}
        onSaveNext={(e) => createPlan(e, { advance: true })}
        onSkip={goToNextAthleteWithSkip}
        onExit={() => setSpeedMode(false)}
        error={error}
        setError={setError}
        completedEmails={completedEmails}
        doneTokens={doneTokens}
        planSavedAt={planSavedAt}
      />
    );
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: DS.pageBg, color: DS.bodyText }}>

      {/* ── Billing warning ── */}
      {showBillingWarning && (
        <div className="flex items-center justify-between gap-3 px-4 py-2.5 text-xs font-bold"
          style={{ backgroundColor: "#FFFBF0", borderBottom: "1px solid #FFE0A8", color: "#7A4A0A" }}>
          <span>⚠ Billing requires attention - your organization's subscription is not active.</span>
          <button type="button" onClick={() => router.push("/account")}
            className="shrink-0 px-3 py-1 font-black uppercase tracking-wider"
            style={{ backgroundColor: "#E87722", color: "#fff", border: "none", cursor: "pointer" }}
            onMouseEnter={(e) => { e.currentTarget.style.filter = "brightness(1.1)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.filter = "none"; }}>
            Fix billing
          </button>
        </div>
      )}

      <main className="max-w-6xl mx-auto px-4 py-8 space-y-5">

        {/* ── Page header ── */}
        <div
          className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between px-5 py-4"
          style={{ backgroundColor: DS.cardBg, borderTop: `3px solid ${DS.brand}`, border: `1px solid ${DS.border}` }}
        >
          <div>
            <h1 className="text-xl font-black uppercase tracking-wide" style={{ color: DS.bodyText }}>
              Nutrition Plans
            </h1>
            <div className="flex items-center gap-3 mt-0.5 flex-wrap">
              <span className="text-xs" style={{ color: DS.dimText }}>
                Logged in as{" "}
                <span className="font-bold" style={{ color: DS.labelText }}>{orgName}</span>
              </span>
              {progressLabel && (
                <span
                  className="text-xs font-bold px-2 py-0.5 rounded-sm"
                  style={{
                    backgroundColor: activePlanCount === totalAthletes && totalAthletes > 0 ? DS.safeBg : DS.brandBg,
                    color:           activePlanCount === totalAthletes && totalAthletes > 0 ? DS.safe  : DS.brand,
                    border:          `1px solid ${activePlanCount === totalAthletes && totalAthletes > 0 ? "#A8DFB8" : DS.brandBorder}`,
                  }}
                >
                  {progressLabel}
                </span>
              )}
              {statusLoading && (
                <span className="text-xs" style={{ color: DS.dimText }}>· updating…</span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Speed Mode toggle */}
            <button
              type="button"
              onClick={() => setSpeedMode(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-sm transition-all"
              style={{ border: `1px solid ${DS.brandBorder}`, backgroundColor: DS.brandBg, color: DS.brand }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = DS.brand; e.currentTarget.style.color = "#fff"; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = DS.brandBg; e.currentTarget.style.color = DS.brand; }}
            >
              <Zap className="h-3.5 w-3.5" />
              Speed Mode
            </button>

            {/* Group blast */}
            <button
              type="button"
              onClick={() => setShowGroupBlast(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-sm transition-all"
              style={{ border: `1px solid ${DS.border}`, backgroundColor: DS.cardBg, color: DS.labelText }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = DS.brandBorder; e.currentTarget.style.color = DS.brand; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = DS.border; e.currentTarget.style.color = DS.labelText; }}
            >
              <Users className="h-3.5 w-3.5" />
              Group Blast
            </button>

            <button
              type="button"
              onClick={() => router.push("/org/workouts-calendar")}
              className="px-3 py-1.5 text-xs font-bold rounded-sm transition-all"
              style={{ border: `1px solid ${DS.border}`, backgroundColor: DS.cardBg, color: DS.labelText }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = DS.brandBorder; e.currentTarget.style.color = DS.brand; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = DS.border; e.currentTarget.style.color = DS.labelText; }}
            >
              Dashboard
            </button>

            <button
              type="button"
              onClick={() => router.push("/org/athletes")}
              className="px-3 py-1.5 text-xs font-bold rounded-sm transition-all"
              style={{ border: `1px solid ${DS.border}`, backgroundColor: DS.cardBg, color: DS.labelText }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = DS.brandBorder; e.currentTarget.style.color = DS.brand; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = DS.border; e.currentTarget.style.color = DS.labelText; }}
            >
              Athletes
            </button>

            <button
              type="button"
              onClick={async () => { await refreshAll(); await refreshRosterPlanStatus(); }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-black uppercase tracking-wide rounded-sm transition-all"
              style={{ backgroundColor: DS.brand, color: "#fff" }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = DS.brandLight; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = DS.brand; }}
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Refresh
            </button>
          </div>
        </div>

        {/* ── Status banners ── */}
        {isBusy && (
          <div className="px-4 py-3 text-xs" style={{ backgroundColor: DS.brandBg, border: `1px solid ${DS.brandBorder}`, color: DS.labelText }}>
            Loading…
          </div>
        )}
        {error && (
          <div className="px-4 py-3 text-xs font-bold" style={{ backgroundColor: "#FFF0F0", border: "1px solid #FFC8C8", color: "#C8102E" }}>
            {error}
          </div>
        )}

        {/* ── Main layout: roster (left) + builder (right) ── */}
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
                autoPopulatedTokenRef.current = "";
                skipAutoPopulateRef.current   = false;
                histAutoLoadRef.current       = "";
                resetBuilder();
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

          {/* Plan builder */}
          <section className="col-span-12 lg:col-span-8 min-w-0">
            <PlanBuilderForm
              title={title}
              setTitle={setTitle}
              structured={structured}
              onChange={onChange}
              setStructured={setStructured}
              OPTIONS={OPTIONS}
              createLoading={createLoading}
              selectedAthleteEmail={selectedAthleteEmail}
              onReset={resetBuilder}
              onSave={(e) => createPlan(e, { advance: false })}
              onSaveNext={(e) => createPlan(e, { advance: true })}
              selectedAthlete={selectedAthlete}
              tpl={builderTpl}
              hist={hist}
              products={products}
              onOpenGroupBlast={() => setShowGroupBlast(true)}
              planSavedAt={planSavedAt}
            />
          </section>
        </div>

      </main>

      {/* ── Group Blast modal ── */}
      {showGroupBlast && (
        <div
          className="fixed inset-0 z-50 overflow-y-auto"
          style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowGroupBlast(false); }}
        >
          <div className="min-h-full flex items-start justify-center py-10 px-4">
            <div className="w-full max-w-3xl">
              {/* Modal header */}
              <div
                className="flex items-center justify-between px-5 py-3 mb-0"
                style={{ backgroundColor: DS.brand, borderRadius: "2px 2px 0 0" }}
              >
                <div className="flex items-center gap-2">
                  <Zap className="h-4 w-4" style={{ color: "rgba(255,255,255,0.8)" }} />
                  <span className="text-sm font-black uppercase tracking-wide" style={{ color: "#fff" }}>
                    Group Blast
                  </span>
                  <span className="text-xs" style={{ color: "rgba(255,255,255,0.55)" }}>
                    Assign one plan to multiple athletes at once
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowGroupBlast(false)}
                  className="inline-flex items-center justify-center h-7 w-7 rounded-sm transition-colors"
                  style={{ color: "rgba(255,255,255,0.6)" }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = "#fff"; e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.1)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = "rgba(255,255,255,0.6)"; e.currentTarget.style.backgroundColor = "transparent"; }}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <GroupBlastPanel athletes={athletes} />
            </div>
          </div>
        </div>
      )}

      {/* ── Template delete confirmation ── */}
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
