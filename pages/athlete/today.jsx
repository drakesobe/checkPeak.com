// pages/athlete/today.jsx
"use client";

import { useEffect, useMemo, useCallback, useState, useRef } from "react";
import { useRouter } from "next/router";
import { useAuthContext } from "@/hooks/useAuth";

import DateStrip from "@/components/athlete-today/DateStrip";
import WorkoutCard from "@/components/athlete-today/WorkoutCard";
import CompleteItemModal from "@/components/athlete-today/CompleteItemModal";
import NutritionCard from "@/components/athlete-today/nutrition/NutritionCard";

import { toISODateLocal, addDays } from "@/components/athlete-today/ui.jsx";

import { useAthleteToday } from "@/hooks/athlete-today/useAthleteToday";
import { useWorkoutCompletion } from "@/hooks/athlete-today/useWorkoutCompletion";
import { useAthleteNutritionToday } from "@/hooks/athlete-today/useAthleteNutritionToday";

import {
  ChevronLeft,
  Dumbbell,
  Salad,
  RefreshCw,
  AlertCircle,
} from "lucide-react";

/* ─────────────────────────────────────────────────────────── helpers ── */

function cx(...xs) {
  return xs.filter(Boolean).join(" ");
}

function safeNum(v) {
  const s = String(v ?? "").trim();
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function makeEmptyNutritionCompletion() {
  return {
    breakfast:  { mealDone: false, hydrationDone: false },
    lunch:      { mealDone: false, hydrationDone: false },
    afternoon:  { mealDone: false, hydrationDone: false },
    dinner:     { mealDone: false, hydrationDone: false },
  };
}

function computeNutritionCounts(nutritionCompletion) {
  const c = nutritionCompletion && typeof nutritionCompletion === "object"
    ? nutritionCompletion : {};
  const keys = ["breakfast", "lunch", "afternoon", "dinner"];
  let done = 0, total = 0;
  for (const k of keys) {
    const row = c?.[k] || {};
    total += 2;
    if (Boolean(row.mealDone))      done += 1;
    if (Boolean(row.hydrationDone)) done += 1;
  }
  return { done, total };
}

function normalizeTab(v) {
  const s = String(v || "").trim().toLowerCase();
  return s === "nutrition" ? "nutrition" : "workout";
}

function lsSafeGet(key) {
  try { if (typeof window === "undefined") return null; return window.localStorage.getItem(key); }
  catch { return null; }
}

function lsSafeSet(key, value) {
  try { if (typeof window === "undefined") return; window.localStorage.setItem(key, value); }
  catch {}
}

function isPlainObj(v) { return v && typeof v === "object" && !Array.isArray(v); }

function normalizeNutritionCompletionShape(raw) {
  const base = makeEmptyNutritionCompletion();
  if (!isPlainObj(raw)) return base;
  const keys = ["breakfast", "lunch", "afternoon", "dinner"];
  const out = { ...base };
  for (const k of keys) {
    const row = isPlainObj(raw?.[k]) ? raw[k] : {};
    out[k] = { mealDone: Boolean(row.mealDone), hydrationDone: Boolean(row.hydrationDone) };
  }
  return out;
}

/* ──────────────────────────────────────────────── Progress ring ── */

function ProgressRing({ done, total, size = 52, stroke = 4 }) {
  const r      = (size - stroke) / 2;
  const circ   = 2 * Math.PI * r;
  const pct    = total > 0 ? Math.min(done / total, 1) : 0;
  const offset = circ * (1 - pct);
  const allDone = total > 0 && done >= total;

  return (
    <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle
          cx={size / 2} cy={size / 2} r={r}
          fill="none"
          stroke="rgba(255,255,255,0.10)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2} cy={size / 2} r={r}
          fill="none"
          stroke={allDone ? "#34d399" : "#7eb8e0"}
          strokeWidth={stroke}
          strokeDasharray={circ}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 0.6s cubic-bezier(0.4,0,0.2,1), stroke 0.4s ease" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        {allDone ? (
          <CheckCircleFill size={size * 0.38} />
        ) : (
          <>
            <span className="text-[13px] font-black text-white leading-none">{done}</span>
            <span className="text-[9px] text-white/45 leading-none mt-0.5">/{total}</span>
          </>
        )}
      </div>
    </div>
  );
}

function CheckCircleFill({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none">
      <circle cx="10" cy="10" r="10" fill="#34d399" opacity="0.25" />
      <path d="M6 10.5l3 3 5-6" stroke="#34d399" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* ───────────────────────────────────────────────── Tab switcher ── */

function TabBar({ value, onChange, workoutDone, workoutTotal, nutritionDone, nutritionTotal }) {
  const tabs = [
    {
      id:    "workout",
      label: "Workout",
      icon:  <Dumbbell className="w-4 h-4" />,
      done:  workoutDone,
      total: workoutTotal,
    },
    {
      id:    "nutrition",
      label: "Nutrition",
      icon:  <Salad className="w-4 h-4" />,
      done:  nutritionDone,
      total: nutritionTotal,
    },
  ];

  return (
    <div className="flex gap-1.5 bg-gray-100/80 p-1.5 rounded-2xl">
      {tabs.map((t) => {
        const active  = value === t.id;
        const allDone = t.total > 0 && t.done >= t.total;
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => onChange(t.id)}
            aria-pressed={active}
            className={cx(
              "flex-1 flex items-center justify-center gap-2 py-3 px-3 rounded-xl text-sm font-bold transition",
              active
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-600 hover:text-gray-800 hover:bg-white/50"
            )}
          >
            <span className={cx(active ? "text-[#1E3A5F]" : "text-gray-400")}>
              {t.icon}
            </span>
            <span>{t.label}</span>
            {t.total > 0 ? (
              <span className={cx(
                "ml-auto text-[11px] font-black rounded-full px-2 py-0.5 tabular-nums",
                allDone
                  ? "bg-emerald-100 text-emerald-700"
                  : active
                  ? "bg-[#1E3A5F]/10 text-[#1E3A5F]"
                  : "bg-gray-200 text-gray-600"
              )}>
                {t.done}/{t.total}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

/* ────────────────────────────────────────────────────── Page ── */

export default function AthleteToday() {
  const router = useRouter();
  const { user, authReady } = useAuthContext();

  /* ── Role ─────────────────────────────────────────────────────────────── */
  const role = useMemo(() => {
    const raw = String(user?.role || user?.Role || "").trim().toLowerCase();
    if (!raw) return "";
    if (raw.includes("ath")) return "athlete";
    return raw;
  }, [user]);
  const isAthlete = role === "athlete";

  /* ── Tabs ─────────────────────────────────────────────────────────────── */
  const tabFromUrl = useMemo(() => normalizeTab(router?.query?.tab), [router?.query?.tab]);
  const [activeTab, setActiveTab] = useState("workout");

  useEffect(() => { setActiveTab(tabFromUrl); }, [tabFromUrl]);

  const setTab = useCallback((next) => {
    const t = normalizeTab(next);
    setActiveTab(t);
    try {
      router.replace(
        { pathname: router.pathname, query: { ...(router.query || {}), tab: t } },
        undefined,
        { shallow: true, scroll: false }
      );
    } catch {}
  }, [router]);

  /* ── Workout hook ─────────────────────────────────────────────────────── */
  const {
    selectedDate, setSelectedDate,
    loading, dailyWorkout, items,
    err, setErr, reload, dateStrip, progress,
  } = useAthleteToday({ authReady, user, isAthlete });

  const {
    modalOpen, activeItem, selectedFile, coachNote,
    submittingId, acknowledgingId, optimisticStatusById,
    openModal, closeModal, setSelectedFile, setCoachNote,
    submitCompletion, quickComplete, acknowledgeCompletion,
  } = useWorkoutCompletion({ selectedDate, reload, setErr });

  /* ── Nutrition hook ───────────────────────────────────────────────────── */
  const nutrition = useAthleteNutritionToday({ authReady, user, isAthlete, selectedDate });

  const nutritionReload = nutrition.reload;

  const [nutritionCompletion, setNutritionCompletion] = useState(makeEmptyNutritionCompletion);

  const nutritionCompletionKey = useMemo(() => {
    const email = String(user?.Email || user?.email || "").trim().toLowerCase();
    const token = String(user?.token || user?.Token || user?.athleteToken || "").trim();
    const who   = token || email || "athlete";
    const day   = String(selectedDate || "").trim() || "unknown-date";
    return `checkpeak:nutritionCompletion:${who}:${day}`;
  }, [user, selectedDate]);

  const hydratingRef = useRef(false);

  useEffect(() => {
    if (!authReady || !user || !isAthlete) return;
    hydratingRef.current = true;
    const raw = lsSafeGet(nutritionCompletionKey);
    if (!raw) {
      setNutritionCompletion(makeEmptyNutritionCompletion());
      hydratingRef.current = false;
      return;
    }
    try {
      setNutritionCompletion(normalizeNutritionCompletionShape(JSON.parse(raw)));
    } catch {
      setNutritionCompletion(makeEmptyNutritionCompletion());
    } finally {
      setTimeout(() => { hydratingRef.current = false; }, 0);
    }
  }, [authReady, user, isAthlete, nutritionCompletionKey]);

  useEffect(() => {
    if (!authReady || !user || !isAthlete) return;
    if (hydratingRef.current || !nutritionCompletionKey) return;
    lsSafeSet(nutritionCompletionKey, JSON.stringify(normalizeNutritionCompletionShape(nutritionCompletion)));
  }, [authReady, user, isAthlete, nutritionCompletionKey, nutritionCompletion]);

  // hook already resolves this from all field variants (DailyHydration, hydrationOz, etc.)
  const dailyHydrationOz = nutrition.dailyHydrationOz ?? null;

  /* ── Navigation ───────────────────────────────────────────────────────── */
  const goPrev = useCallback(() =>
    setSelectedDate((d) => toISODateLocal(addDays(new Date(`${d}T12:00:00`), -1))),
  [setSelectedDate]);

  const goNext = useCallback(() =>
    setSelectedDate((d) => toISODateLocal(addDays(new Date(`${d}T12:00:00`), 1))),
  [setSelectedDate]);

  const refresh = useCallback(() => {
    reload(selectedDate);
    nutritionReload(selectedDate);
  }, [reload, selectedDate, nutritionReload]);

  /* ── Counts ───────────────────────────────────────────────────────────── */
  const nutritionCounts = useMemo(() => computeNutritionCounts(nutritionCompletion), [nutritionCompletion]);

  const workoutDone  = progress?.done  ?? 0;
  const workoutTotal = progress?.total ?? 0;

  /* ── Early returns ────────────────────────────────────────────────────── */
  if (!authReady) return null;
  if (!user)      return <div className="p-6 text-sm text-gray-600">Please log in.</div>;
  if (!isAthlete) return <div className="p-6 text-sm text-gray-600">Not authorized.</div>;

  /* ── Derived values ───────────────────────────────────────────────────── */
  const isSubmittingActiveItem = Boolean(submittingId && activeItem?.id === submittingId);
  const firstName = String(user?.name || user?.Name || user?.firstName || "").split(" ")[0] || "Athlete";

  const canonicalItem = items?.find(i => String(i?.id || "") === String(activeItem?.id || ""));
  const evRaw = String(
    canonicalItem?.EvidenceRequired ?? activeItem?.EvidenceRequired ?? ""
  ).toLowerCase();
  const evidenceRequired = evRaw !== "" && evRaw !== "none" && evRaw !== "false" && evRaw !== "voluntary_activity_vara";

  const totalDone  = workoutDone  + nutritionCounts.done;
  const totalItems = workoutTotal + nutritionCounts.total;

  /* ── Render ───────────────────────────────────────────────────────────── */
  return (
    <div className="min-h-screen" style={{ backgroundColor: "#F0F4F8" }}>

      {/* ── Dark hero header ── */}
      <div style={{ backgroundColor: "#0F1E2E" }} className="relative overflow-hidden">
        {/* Subtle diagonal texture */}
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage: "repeating-linear-gradient(45deg, #fff 0, #fff 1px, transparent 0, transparent 50%)",
            backgroundSize: "12px 12px",
          }}
        />

        {/* ── Mobile: Option C — dates in nav bar, identity as secondary line ── */}
        <div className="relative sm:hidden">

          {/* Row 1 — nav bar: back | date strip | ring | refresh */}
          <div className="flex items-center gap-2 px-3 pt-3 pb-1.5">

            {/* Back */}
            <button
              type="button"
              onClick={() => router.push("/dashboard")}
              className="flex-shrink-0 flex items-center text-white/55 hover:text-white transition"
              aria-label="Back to dashboard"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>

            {/* Date strip — flex-1 so it owns the center of the bar */}
            <div className="flex-1 min-w-0">
              <DateStrip
                loading={loading}
                selectedDate={selectedDate}
                dateStrip={dateStrip}
                onPrev={goPrev}
                onNext={goNext}
                onSelectDate={setSelectedDate}
                darkBg
              />
            </div>

            {/* Progress ring — only when there's something to track */}
            {totalItems > 0 && (
              <ProgressRing
                done={totalDone}
                total={totalItems}
                size={32}
                stroke={3}
              />
            )}

            {/* Refresh */}
            <button
              type="button"
              onClick={refresh}
              disabled={loading}
              className="flex-shrink-0 text-white/50 hover:text-white transition disabled:opacity-30"
              aria-label="Refresh"
            >
              <RefreshCw className={cx("w-4 h-4", loading ? "animate-spin" : "")} />
            </button>
          </div>

          {/* Row 2 — secondary identity line: name · workout title */}
          <div className="flex items-center gap-1.5 px-4 pb-2.5 min-w-0">
            <span className="text-[11px] font-black text-white/85 flex-shrink-0">
              {firstName}
            </span>
            {dailyWorkout?.Title ? (
              <>
                <span className="text-[10px] text-white/25 flex-shrink-0">·</span>
                <span className="text-[11px] text-white/40 font-semibold truncate">
                  {dailyWorkout.Title}
                </span>
              </>
            ) : null}
          </div>
        </div>

        {/* ── Desktop: original spacious layout — unchanged ── */}
        <div className="hidden sm:block max-w-3xl mx-auto px-4 pt-6 pb-8">
          {/* Top nav row */}
          <div className="flex items-center justify-between mb-7">
            <button
              type="button"
              onClick={() => router.push("/dashboard")}
              className="flex items-center gap-1.5 text-white/65 hover:text-white transition text-sm font-semibold"
            >
              <ChevronLeft className="w-4 h-4" />
              Back
            </button>

            <button
              type="button"
              onClick={refresh}
              disabled={loading}
              className="flex items-center gap-1.5 text-white/65 hover:text-white transition text-sm font-semibold disabled:opacity-30"
              title="Refresh"
            >
              <RefreshCw className={cx("w-4 h-4", loading ? "animate-spin" : "")} />
              {loading ? "Loading…" : "Refresh"}
            </button>
          </div>

          {/* Identity + progress ring */}
          <div className="flex items-end justify-between gap-4">
            <div className="min-w-0">
              <p className="text-white/55 text-[11px] font-black uppercase tracking-widest mb-1.5">
                Today's Session
              </p>
              <h1 className="text-white text-2xl sm:text-3xl font-black leading-tight truncate">
                {firstName}
              </h1>
              {dailyWorkout?.Title ? (
                <p className="text-white/65 text-sm font-semibold mt-1.5 truncate">
                  {dailyWorkout.Title}
                </p>
              ) : null}
            </div>

            {totalItems > 0 ? (
              <div className="flex-shrink-0 flex flex-col items-center gap-1.5">
                <ProgressRing
                  done={totalDone}
                  total={totalItems}
                  size={60}
                  stroke={5}
                />
                <span className="text-[11px] text-white/50 font-bold uppercase tracking-widest">
                  Today
                </span>
              </div>
            ) : null}
          </div>

          {/* Date strip */}
          <div className="mt-5">
            <DateStrip
              loading={loading}
              selectedDate={selectedDate}
              dateStrip={dateStrip}
              onPrev={goPrev}
              onNext={goNext}
              onSelectDate={setSelectedDate}
              darkBg
            />
          </div>
        </div>
      </div>

      {/* ── Content area ── */}
      <div className="max-w-3xl mx-auto px-4 py-5 space-y-4">

        {/* Error banner */}
        {err ? (
          <div className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3">
            <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
            <p className="text-sm text-red-700 font-semibold">{err}</p>
          </div>
        ) : null}

        {/* Tab switcher */}
        <TabBar
          value={activeTab}
          onChange={setTab}
          workoutDone={workoutDone}
          workoutTotal={workoutTotal}
          nutritionDone={nutritionCounts.done}
          nutritionTotal={nutritionCounts.total}
        />

        {/* Workout tab */}
        {activeTab === "workout" ? (
          <>
            <WorkoutCard
              loading={loading}
              dailyWorkout={dailyWorkout}
              items={items}
              onUpload={openModal}
              onQuickComplete={quickComplete}
              submittingId={submittingId}
              acknowledgingId={acknowledgingId}
              optimisticStatusById={optimisticStatusById}
              onAcknowledge={({ completionId, workoutItemId }) =>
                acknowledgeCompletion({ completionId, workoutItemId })
              }
            />

            <CompleteItemModal
              open={modalOpen}
              item={activeItem}
              selectedFile={selectedFile}
              coachNote={coachNote}
              submitting={isSubmittingActiveItem}
              onClose={closeModal}
              onPickFile={setSelectedFile}
              onChangeNote={setCoachNote}
              evidenceRequiredOverride={evidenceRequired}
              onSubmit={() => {
                if (evidenceRequired && !selectedFile) return;
                submitCompletion({
                  workoutItemId:    String(activeItem?.id || ""),
                  evidenceRequired: String(
                    canonicalItem?.EvidenceRequired ?? activeItem?.EvidenceRequired ?? ""
                  ),
                  dailyWorkoutId: String(
                    dailyWorkout?.id || dailyWorkout?.ID || dailyWorkout?.recordId || ""
                  ),
                });
              }}
            />
          </>
        ) : null}

        {/* Nutrition tab */}
        {activeTab === "nutrition" ? (
          <NutritionCard
            loading={nutrition.loading}
            err={nutrition.err}
            hasPlan={nutrition.hasPlan}
            daily={nutrition.daily}
            mealBlocks={nutrition.mealBlocks}
            planJson={nutrition.planJson}
            selectedDate={selectedDate}
            effectiveDate={nutrition.effectiveDate}
            nextPlan={nutrition.nextPlan}
            isFuture={nutrition.isFuture}
            message={nutrition.message}
            onRefresh={() => nutritionReload(selectedDate)}
            onOpenNutrition={() => router.push("/athlete/nutrition")}
            dailyHydrationOz={dailyHydrationOz}
            nutritionCompletion={nutritionCompletion}
            onCompletionChange={(next) =>
              setNutritionCompletion(normalizeNutritionCompletionShape(next))
            }
          />
        ) : null}
      </div>
    </div>
  );
}