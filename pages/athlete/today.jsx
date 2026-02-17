// pages/athlete/today.jsx
"use client";

import { useEffect, useMemo, useCallback, useState, useRef } from "react";
import { useRouter } from "next/router";
import { useAuthContext } from "@/hooks/useAuth";

import TodayHeader from "@/components/athlete-today/TodayHeader";
import DateStrip from "@/components/athlete-today/DateStrip";
import WorkoutCard from "@/components/athlete-today/WorkoutCard";
import CompleteItemModal from "@/components/athlete-today/CompleteItemModal";
// If you DID NOT keep the wrapper re-export, use this instead:
// import CompleteItemModal from "@/components/athlete-today/complete-item-modal/CompleteItemModal";

import NutritionCard from "@/components/athlete-today/NutritionCard";

// IMPORTANT: point to ui.jsx explicitly to avoid any path/alias weirdness
import { toISODateLocal, addDays } from "@/components/athlete-today/ui.jsx";

import { useAthleteToday } from "@/hooks/athlete-today/useAthleteToday";
import { useWorkoutCompletion } from "@/hooks/athlete-today/useWorkoutCompletion";
import { useAthleteNutritionToday } from "@/hooks/athlete-today/useAthleteNutritionToday";

/* ---------------- helpers ---------------- */

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
    breakfast: { mealDone: false, hydrationDone: false },
    lunch: { mealDone: false, hydrationDone: false },
    afternoon: { mealDone: false, hydrationDone: false },
    dinner: { mealDone: false, hydrationDone: false },
  };
}

/**
 * Counts nutrition items:
 * - Each meal has 2 "items": mealDone + hydrationDone
 * => 4 meals * 2 = 8 total
 */
function computeNutritionCounts(nutritionCompletion) {
  const c =
    nutritionCompletion && typeof nutritionCompletion === "object"
      ? nutritionCompletion
      : {};
  const keys = ["breakfast", "lunch", "afternoon", "dinner"];

  let done = 0;
  let total = 0;

  for (const k of keys) {
    const row = c?.[k] || {};
    total += 2;
    if (Boolean(row.mealDone)) done += 1;
    if (Boolean(row.hydrationDone)) done += 1;
  }

  return { done, total };
}

function normalizeTab(v) {
  const s = String(v || "").trim().toLowerCase();
  if (s === "nutrition") return "nutrition";
  return "workout";
}

/** localStorage helpers (persist nutrition completion by athlete+date) */
function lsSafeGet(key) {
  try {
    if (typeof window === "undefined") return null;
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function lsSafeSet(key, value) {
  try {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(key, value);
  } catch {
    // ignore quota / private mode
  }
}

function isPlainObj(v) {
  return v && typeof v === "object" && !Array.isArray(v);
}

function normalizeNutritionCompletionShape(raw) {
  const base = makeEmptyNutritionCompletion();
  if (!isPlainObj(raw)) return base;

  const keys = ["breakfast", "lunch", "afternoon", "dinner"];
  const out = { ...base };

  for (const k of keys) {
    const row = isPlainObj(raw?.[k]) ? raw[k] : {};
    out[k] = {
      mealDone: Boolean(row.mealDone),
      hydrationDone: Boolean(row.hydrationDone),
    };
  }
  return out;
}

/* ---------------- UI: tabs ---------------- */

function Tabs({ value, onChange }) {
  return (
    <div className="bg-white rounded-2xl shadow-md border border-blue-100 p-2">
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => onChange("workout")}
          className={cx(
            "rounded-2xl px-4 py-3 text-sm font-extrabold transition border",
            value === "workout"
              ? "bg-[#46769B] text-white border-[#46769B] shadow-sm"
              : "bg-white text-gray-800 border-gray-200 hover:bg-gray-50"
          )}
          aria-pressed={value === "workout"}
        >
          Workout
        </button>

        <button
          type="button"
          onClick={() => onChange("nutrition")}
          className={cx(
            "rounded-2xl px-4 py-3 text-sm font-extrabold transition border",
            value === "nutrition"
              ? "bg-[#46769B] text-white border-[#46769B] shadow-sm"
              : "bg-white text-gray-800 border-gray-200 hover:bg-gray-50"
          )}
          aria-pressed={value === "nutrition"}
        >
          Nutrition
        </button>
      </div>
    </div>
  );
}

export default function AthleteToday() {
  const router = useRouter();
  const { user, authReady } = useAuthContext();

  /* ---------------- role gating ---------------- */

  const role = useMemo(() => {
    const raw = String(user?.role || user?.Role || "").trim().toLowerCase();
    if (!raw) return "";
    if (raw.includes("ath")) return "athlete";
    return raw;
  }, [user]);

  const isAthlete = role === "athlete";

  /* ---------------- tabs (persist in URL) ---------------- */

  const tabFromUrl = useMemo(() => {
    return normalizeTab(router?.query?.tab);
  }, [router?.query?.tab]);

  const [activeTab, setActiveTab] = useState("workout");

  useEffect(() => {
    setActiveTab(tabFromUrl);
  }, [tabFromUrl]);

  const setTab = useCallback(
    (next) => {
      const t = normalizeTab(next);
      setActiveTab(t);

      try {
        const nextQuery = { ...(router.query || {}), tab: t };
        router.replace(
          { pathname: router.pathname, query: nextQuery },
          undefined,
          { shallow: true, scroll: false }
        );
      } catch {
        // router not ready
      }
    },
    [router]
  );

  /* ---------------- workouts hook ---------------- */

  const {
    selectedDate,
    setSelectedDate,
    loading,
    dailyWorkout,
    items,
    err,
    setErr,
    reload,
    dateStrip,
    progress,
  } = useAthleteToday({ authReady, user, isAthlete });

  const {
    modalOpen,
    activeItem,
    selectedFile,
    coachNote,
    submittingId,
    openModal,
    closeModal,
    setSelectedFile,
    setCoachNote,
    submitCompletion,
    quickComplete,
  } = useWorkoutCompletion({
    selectedDate,
    reload,
    setErr,
  });

  /* ---------------- nutrition hook ---------------- */

  const nutrition = useAthleteNutritionToday({
    authReady,
    user,
    isAthlete,
    selectedDate,
  });

  /**
   * ✅ Lifted state: NutritionCard writes; TodayHeader reads.
   * PLUS: persist to localStorage so athlete sees same checkmarks on return.
   */
  const [nutritionCompletion, setNutritionCompletion] = useState(
    makeEmptyNutritionCompletion
  );

  const nutritionCompletionKey = useMemo(() => {
    const email = String(user?.Email || user?.email || "")
      .trim()
      .toLowerCase();
    const token = String(
      user?.token || user?.Token || user?.athleteToken || ""
    ).trim();
    const who = token || email || "athlete";
    const day = String(selectedDate || "").trim() || "unknown-date";
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
      const parsed = JSON.parse(raw);
      setNutritionCompletion(normalizeNutritionCompletionShape(parsed));
    } catch {
      setNutritionCompletion(makeEmptyNutritionCompletion());
    } finally {
      setTimeout(() => {
        hydratingRef.current = false;
      }, 0);
    }
  }, [authReady, user, isAthlete, nutritionCompletionKey]);

  useEffect(() => {
    if (!authReady || !user || !isAthlete) return;
    if (hydratingRef.current) return;
    if (!nutritionCompletionKey) return;

    const payload = normalizeNutritionCompletionShape(nutritionCompletion);
    lsSafeSet(nutritionCompletionKey, JSON.stringify(payload));
  }, [authReady, user, isAthlete, nutritionCompletionKey, nutritionCompletion]);

  const dailyHydrationOz = useMemo(() => {
    const v1 = nutrition?.daily?.hydrationOz;
    const v2 = nutrition?.daily?.DailyHydration;
    const v3 = nutrition?.planJson?.daily?.hydrationOz;
    const v4 = nutrition?.planJson?.daily?.DailyHydration;
    return safeNum(v1) ?? safeNum(v2) ?? safeNum(v3) ?? safeNum(v4) ?? null;
  }, [nutrition?.daily, nutrition?.planJson]);

  /* ---------------- navigation actions ---------------- */

  const goPrev = useCallback(() => {
    setSelectedDate((d) =>
      toISODateLocal(addDays(new Date(`${d}T12:00:00`), -1))
    );
  }, [setSelectedDate]);

  const goNext = useCallback(() => {
    setSelectedDate((d) =>
      toISODateLocal(addDays(new Date(`${d}T12:00:00`), 1))
    );
  }, [setSelectedDate]);

  const refresh = useCallback(() => {
    reload(selectedDate);
    nutrition.reload(selectedDate);
  }, [reload, selectedDate, nutrition]);

  useEffect(() => {
    if (!authReady || !user || !isAthlete) return;
    reload(selectedDate);
  }, [authReady, user, isAthlete, selectedDate, reload]);

  /* ---------------- derived counts ---------------- */

  const nutritionCounts = useMemo(
    () => computeNutritionCounts(nutritionCompletion),
    [nutritionCompletion]
  );

  /* ---------------- early returns (AFTER all hooks) ---------------- */

  if (!authReady) return null;
  if (!user) return <div style={{ padding: 24 }}>Please log in.</div>;
  if (!isAthlete) return <div style={{ padding: 24 }}>Not authorized.</div>;

  const isSubmittingActiveItem = Boolean(
    submittingId && activeItem?.id === submittingId
  );

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-blue-50 text-gray-900 font-sans">
      <main className="max-w-5xl mx-auto px-4 py-8 space-y-6">
        <TodayHeader
          user={user}
          selectedDate={selectedDate}
          dailyWorkout={dailyWorkout}
          loading={loading}
          err={err}
          progress={progress}
          nutritionCompletion={nutritionCompletion}
          nutritionDone={nutritionCounts.done}
          nutritionTotal={nutritionCounts.total}
          onRefresh={refresh}
          onBack={() => router.push("/dashboard")}
        />

        <DateStrip
          loading={loading}
          selectedDate={selectedDate}
          dateStrip={dateStrip}
          onPrev={goPrev}
          onNext={goNext}
          onSelectDate={setSelectedDate}
        />

        <Tabs value={activeTab} onChange={setTab} />

        {activeTab === "workout" ? (
          <>
            <WorkoutCard
              loading={loading}
              dailyWorkout={dailyWorkout}
              items={items}
              onUpload={openModal}
              onQuickComplete={quickComplete}
              submittingId={submittingId}
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
              onSubmit={() =>
                submitCompletion({
                  workoutItemId: String(activeItem?.id || ""),
                  evidenceRequired: String(activeItem?.EvidenceRequired || "").toLowerCase() === "true",
                  dailyWorkoutId: String(dailyWorkout?.id || dailyWorkout?.ID || dailyWorkout?.recordId || ""),
                })
              }
            />
          </>
        ) : null}

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
            onRefresh={() => nutrition.reload(selectedDate)}
            onOpenNutrition={() => router.push("/athlete/nutrition")}
            dailyHydrationOz={dailyHydrationOz}
            nutritionCompletion={nutritionCompletion}
            onCompletionChange={(next) => {
              setNutritionCompletion(normalizeNutritionCompletionShape(next));
            }}
          />
        ) : null}

        {err ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4">
            <p className="text-sm text-red-700 font-semibold">{err}</p>
          </div>
        ) : null}
      </main>
    </div>
  );
}
