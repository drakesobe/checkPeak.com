// pages/athlete/nutrition/index.js
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/router";
import { useAuthContext } from "@/hooks/useAuth";

/* ---------------- helpers ---------------- */

function cx(...xs) {
  return xs.filter(Boolean).join(" ");
}

function asString(v) {
  return String(v ?? "").trim();
}

function asNum(v) {
  const n = Number(String(v ?? "").trim());
  return Number.isFinite(n) ? n : null;
}

function fmtMacro(v) {
  const n = asNum(v);
  return n == null ? "—" : String(n);
}

function safeText(v) {
  const s = String(v ?? "").trim();
  return s.length ? s : "";
}

function isISODateOnly(s) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(s || "").trim());
}

// Returns YYYY-MM-DD in America/New_York
function nyISODate() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const y = parts.find((p) => p.type === "year")?.value;
  const m = parts.find((p) => p.type === "month")?.value;
  const d = parts.find((p) => p.type === "day")?.value;
  return `${y}-${m}-${d}`;
}

function pickPlanJson(plan) {
  const pj = plan?.planJson || plan?.PlanJson || plan?._raw?.planJson || plan?._raw?.PlanJson;
  return pj && typeof pj === "object" ? pj : null;
}

function pickMealBlocks(planJson) {
  const mb = planJson?.mealBlocks;
  return mb && typeof mb === "object" ? mb : null;
}

function pillClass(kind) {
  if (kind === "good") return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (kind === "warn") return "bg-amber-50 text-amber-800 border-amber-200";
  if (kind === "bad") return "bg-red-50 text-red-700 border-red-200";
  return "bg-gray-50 text-gray-700 border-gray-200";
}

async function safeJson(res) {
  const ct = res.headers.get("content-type") || "";
  if (!ct.includes("application/json")) {
    const text = await res.text().catch(() => "");
    return {
      _nonJson: true,
      _contentType: ct,
      _textPreview: String(text).slice(0, 220),
    };
  }
  return res.json().catch(() => ({}));
}

/* ---------------- UI components ---------------- */

function StatPill({ label, value, sub }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4">
      <p className="text-[11px] text-gray-500">{label}</p>
      <p className="text-xl font-extrabold text-gray-900 mt-1">{value}</p>
      {sub ? <p className="text-[11px] text-gray-500 mt-1">{sub}</p> : null}
    </div>
  );
}

function SuggestionBox({ title, children }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
      <p className="text-sm font-bold text-gray-900">{title}</p>
      <div className="mt-2 text-sm text-gray-800 leading-relaxed">{children}</div>
    </div>
  );
}

function MealCard({ label, block, mode = "dining" }) {
  const t = block?.targets || {};
  const dining = safeText(block?.diningHallRules);
  const home = safeText(block?.homeExamples);

  const hasTargets =
    asNum(t.calories) != null || asNum(t.protein) != null || asNum(t.carbs) != null || asNum(t.fat) != null;

  const primaryText = mode === "home" ? home : dining;
  const fallbackText = mode === "home" ? dining : home;

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-extrabold text-gray-900">{label}</p>
          <p className="text-xs text-gray-600 mt-1">
            Target: <span className="font-semibold">{fmtMacro(t.calories)}</span> cals •{" "}
            <span className="font-semibold">{fmtMacro(t.protein)}</span>P •{" "}
            <span className="font-semibold">{fmtMacro(t.carbs)}</span>C •{" "}
            <span className="font-semibold">{fmtMacro(t.fat)}</span>F
          </p>
        </div>

        <span
          className={cx(
            "shrink-0 text-[10px] px-2 py-1 rounded-lg border font-semibold",
            hasTargets ? pillClass("good") : pillClass("neutral")
          )}
        >
          {hasTargets ? "Suggested" : "Unset"}
        </span>
      </div>

      {(primaryText || fallbackText) ? (
        <div className="mt-3 space-y-2">
          {primaryText ? (
            <div className="text-xs text-gray-700">
              <span className="font-semibold text-gray-900">
                {mode === "home" ? "Home idea:" : "Dining hall play:"}
              </span>{" "}
              {primaryText}
            </div>
          ) : null}

          {!primaryText && fallbackText ? (
            <div className="text-xs text-gray-700">
              <span className="font-semibold text-gray-900">
                {mode === "home" ? "Dining hall play:" : "Home idea:"}
              </span>{" "}
              {fallbackText}
            </div>
          ) : null}
        </div>
      ) : (
        <p className="mt-3 text-xs text-gray-500">
          No suggestions yet — staff can add quick rules of thumb (ex: 2 proteins + 1 carb + fruit).
        </p>
      )}
    </div>
  );
}

/* ---------------- page ---------------- */

export default function AthleteNutritionPage() {
  const router = useRouter();
  const { user, authReady } = useAuthContext();

  // ✅ all hooks must be before any returns
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const [plan, setPlan] = useState(null);
  const [selectedDate, setSelectedDate] = useState(nyISODate()); // YYYY-MM-DD
  const [serverMessage, setServerMessage] = useState("");
  const [nextPlan, setNextPlan] = useState(null);

  const [mode, setMode] = useState("dining"); // dining | home

  // Notes expand state (hook-safe: always defined)
  const [expandedNotes, setExpandedNotes] = useState(false);

  // Dedupe + abort
  const lastLoadedDateRef = useRef("");
  const inflightRef = useRef(null);

  useEffect(() => setMounted(true), []);

  // Pull date from URL (?date=YYYY-MM-DD) when router ready
  useEffect(() => {
    if (!router.isReady) return;
    const qd = asString(router.query?.date);
    const next = isISODateOnly(qd) ? qd : nyISODate();
    setSelectedDate(next);
  }, [router.isReady, router.query?.date]);

  const role = useMemo(() => {
    const raw = String(user?.role || user?.Role || "").trim().toLowerCase();
    if (!raw) return "";
    if (raw.includes("ath")) return "athlete";
    return raw;
  }, [user]);

  const isAthlete = role === "athlete";

  const planJson = useMemo(() => pickPlanJson(plan), [plan]);
  const mealBlocks = useMemo(() => pickMealBlocks(planJson), [planJson]);

  const hasPlan = Boolean(plan && (planJson || mealBlocks || safeText(plan?.prescription) || plan?.id));
  const hasMealBlocks = Boolean(mealBlocks);

  const daily = useMemo(() => {
    // Prefer PlanJson daily (numbers), fallback to legacy plan.daily (strings)
    const pjDaily = planJson?.daily || {};
    const legacy = plan?.daily || {};
    return {
      calories: pjDaily.calories ?? legacy.calories ?? "",
      protein: pjDaily.protein ?? legacy.protein ?? "",
      carbs: pjDaily.carbs ?? legacy.carbs ?? "",
      fat: pjDaily.fat ?? legacy.fat ?? "",
      hydrationOz: planJson?.hydrationOz ?? plan?.hydrationOz ?? "",
      phase: planJson?.phase || plan?.phase || "",
    };
  }, [planJson, plan]);

  const coachNotes = useMemo(() => safeText(planJson?.notes || planJson?.notesMacros || ""), [planJson]);
  const canExpandNotes = coachNotes.length > 500;

  const load = useCallback(
    async (isoDate, opts = {}) => {
      const force = Boolean(opts?.force);
      const date = isISODateOnly(isoDate) ? isoDate : selectedDate;

      if (!authReady || !user || !isAthlete) return;
      if (!isISODateOnly(date)) return;

      if (!force && lastLoadedDateRef.current === date && !err) return;

      // abort any in-flight request
      try {
        inflightRef.current?.abort?.();
      } catch {
        // ignore
      }

      const controller = new AbortController();
      inflightRef.current = controller;

      setLoading(true);
      setErr("");
      setServerMessage("");
      setNextPlan(null);

      try {
        const res = await fetch(`/api/athlete/nutrition/today?date=${encodeURIComponent(date)}`, {
          method: "GET",
          credentials: "include",
          signal: controller.signal,
          headers: { "Content-Type": "application/json" },
        });

        const data = await safeJson(res);

        if (!res.ok) {
          const msg =
            data?._nonJson
              ? `Non-JSON response (${data?._contentType || "unknown"}): ${data?._textPreview || ""}`
              : data?.error || "Failed to load nutrition plan.";
          throw new Error(msg);
        }

        // Your API returns { latestPlan, nextPlan, message, selectedDate }
        setPlan(data?.latestPlan || null);
        setNextPlan(data?.nextPlan || null);
        setServerMessage(safeText(data?.message || ""));
        lastLoadedDateRef.current = date;
      } catch (e) {
        if (String(e?.name || "") === "AbortError") return;
        setErr(e?.message || "Failed to load nutrition plan.");
        setPlan(null);
        setNextPlan(null);
        setServerMessage("");
      } finally {
        setLoading(false);
      }
    },
    [authReady, user, isAthlete, selectedDate, err]
  );

  // Auto-load whenever auth + date changes
  useEffect(() => {
    if (!mounted) return;
    if (!router.isReady) return;
    if (!authReady) return;
    if (!user) return;
    if (!isAthlete) return;

    load(selectedDate);
  }, [mounted, router.isReady, authReady, user, isAthlete, selectedDate, load]);

  // Navigation helpers (keeps URL date in sync)
  const goDate = useCallback(
    (next) => {
      if (!isISODateOnly(next)) return;
      setSelectedDate(next);
      router.replace(
        { pathname: "/athlete/nutrition", query: { date: next } },
        undefined,
        { shallow: true }
      );
    },
    [router]
  );

  const goPrev = useCallback(() => {
    const base = new Date(`${selectedDate}T12:00:00`);
    base.setDate(base.getDate() - 1);
    const iso = base.toISOString().slice(0, 10);
    goDate(iso);
  }, [selectedDate, goDate]);

  const goNext = useCallback(() => {
    const base = new Date(`${selectedDate}T12:00:00`);
    base.setDate(base.getDate() + 1);
    const iso = base.toISOString().slice(0, 10);
    goDate(iso);
  }, [selectedDate, goDate]);

  // Guards (after hooks)
  if (!mounted) return null;
  if (!authReady) return null;
  if (!user) return <div className="p-6">Please log in.</div>;
  if (!isAthlete) return <div className="p-6">Not authorized.</div>;

  const prescription = safeText(plan?.prescription);
  const canExpandLegacy = prescription.length > 650;

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-blue-50 text-gray-900 font-sans">
      <main className="max-w-5xl mx-auto px-4 py-8 space-y-6">
        {/* Header */}
        <div className="bg-white rounded-2xl shadow-md border border-blue-100 p-6">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div className="min-w-0">
              <h1 className="text-2xl font-extrabold text-gray-900">Nutrition Targets</h1>
              <p className="text-sm text-gray-600 mt-1">
                This is a guide — not a strict meal log. Aim for the targets and use simple “dining hall plays” to stay close.
              </p>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="text-[11px] px-2 py-1 rounded-lg border font-semibold bg-white border-gray-200 text-gray-700">
                  Date: {selectedDate}
                </span>

                <span
                  className={cx(
                    "text-[11px] px-2 py-1 rounded-lg border font-semibold",
                    hasPlan ? pillClass("good") : pillClass("warn")
                  )}
                >
                  {hasPlan ? "Plan available" : "No plan effective"}
                </span>

                {daily.phase ? (
                  <span className="text-[11px] px-2 py-1 rounded-lg border font-semibold bg-white border-gray-200 text-gray-700">
                    Phase: {daily.phase}
                  </span>
                ) : null}

                <span className="text-[11px] px-2 py-1 rounded-lg border font-semibold bg-white border-gray-200 text-gray-700">
                  Meal blocks: {hasMealBlocks ? "enabled" : "not set"}
                </span>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => router.push("/athlete/today")}
                className="px-4 py-2 rounded-xl border border-gray-200 bg-white text-sm font-semibold hover:bg-gray-50"
              >
                Back
              </button>

              <button
                type="button"
                onClick={goPrev}
                className="px-4 py-2 rounded-xl border border-gray-200 bg-white text-sm font-semibold hover:bg-gray-50"
              >
                ← Prev
              </button>

              <button
                type="button"
                onClick={goNext}
                className="px-4 py-2 rounded-xl border border-gray-200 bg-white text-sm font-semibold hover:bg-gray-50"
              >
                Next →
              </button>

              <button
                type="button"
                onClick={() => load(selectedDate, { force: true })}
                className="px-4 py-2 rounded-xl bg-[#46769B] text-white text-sm font-semibold hover:brightness-110"
              >
                Refresh
              </button>
            </div>
          </div>

          {/* If server says "starts tomorrow" etc */}
          {serverMessage ? (
            <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <p className="text-sm text-amber-900 font-semibold">{serverMessage}</p>
              {nextPlan?.effectiveDate ? (
                <p className="text-xs text-amber-900/80 mt-1">
                  Next plan starts: <span className="font-semibold">{nextPlan.effectiveDate}</span>
                </p>
              ) : null}
            </div>
          ) : null}
        </div>

        {/* Loading / Error */}
        {loading ? (
          <div className="bg-white rounded-2xl shadow-md border border-blue-100 p-5">
            <p className="text-sm text-gray-600">Loading…</p>
          </div>
        ) : null}

        {!loading && err ? (
          <div className="bg-white rounded-2xl shadow-md border border-red-200 p-5">
            <p className="text-sm text-red-700 font-semibold">{err}</p>
            <p className="mt-2 text-[11px] text-gray-500">
              If you ever see “Non-JSON response”, that means the endpoint is missing or returning HTML (like a 404 page).
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => load(selectedDate, { force: true })}
                className="px-4 py-2 rounded-xl bg-[#46769B] text-white text-sm font-semibold hover:brightness-110"
              >
                Try again
              </button>
            </div>
          </div>
        ) : null}

        {/* No plan state */}
        {!loading && !err && !hasPlan ? (
          <SuggestionBox title="No plan effective for this date">
            <div className="space-y-2">
              <p>
                You may have a plan that starts in the future. Try switching the date forward (Next →), or check back later.
              </p>
              <p className="text-sm text-gray-700">
                Your staff is using “targets + plays” so you can stay close in the dining hall without tracking every ingredient.
              </p>
            </div>
          </SuggestionBox>
        ) : null}

        {/* Plan view */}
        {!loading && !err && hasPlan ? (
          <>
            {/* Daily snapshot */}
            <div className="grid md:grid-cols-3 gap-3">
              <StatPill label="Daily Calories" value={fmtMacro(daily.calories)} sub="Target (kcal)" />
              <StatPill label="Daily Protein (g)" value={fmtMacro(daily.protein)} sub="Recovery focus" />
              <StatPill label="Daily Carbs (g)" value={fmtMacro(daily.carbs)} sub="Fuel training" />
              <StatPill label="Daily Fat (g)" value={fmtMacro(daily.fat)} sub="Supports total intake" />
              <StatPill label="Hydration (oz)" value={fmtMacro(daily.hydrationOz)} sub="Spread across the day" />
              <StatPill label="How to use this" value="Suggested" sub="Close counts — don’t overthink" />
            </div>

            {/* Mode toggle + meal blocks */}
            <div className="bg-white rounded-2xl shadow-md border border-blue-100 p-5">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <h2 className="text-lg font-extrabold text-gray-900">Targets by Meal</h2>
                  <p className="text-sm text-gray-600 mt-1">
                    Pick the closest option you can. Consistency beats perfection (especially on a meal plan).
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setMode("dining")}
                    className={cx(
                      "px-4 py-2 rounded-xl text-sm font-semibold border",
                      mode === "dining"
                        ? "bg-[#46769B] text-white border-[#46769B]"
                        : "bg-white text-gray-900 border-gray-200 hover:bg-gray-50"
                    )}
                  >
                    Dining hall
                  </button>
                  <button
                    type="button"
                    onClick={() => setMode("home")}
                    className={cx(
                      "px-4 py-2 rounded-xl text-sm font-semibold border",
                      mode === "home"
                        ? "bg-[#46769B] text-white border-[#46769B]"
                        : "bg-white text-gray-900 border-gray-200 hover:bg-gray-50"
                    )}
                  >
                    Home
                  </button>
                </div>
              </div>

              {hasMealBlocks ? (
                <div className="mt-4 grid md:grid-cols-2 gap-3">
                  <MealCard label="Breakfast" block={mealBlocks.breakfast} mode={mode} />
                  <MealCard label="Lunch" block={mealBlocks.lunch} mode={mode} />
                  <MealCard label="Afternoon" block={mealBlocks.afternoon} mode={mode} />
                  <MealCard label="Dinner" block={mealBlocks.dinner} mode={mode} />
                </div>
              ) : (
                <div className="mt-4 rounded-2xl border border-gray-200 bg-gray-50 p-4">
                  <p className="text-sm text-gray-700">
                    Meal blocks aren’t enabled for this plan yet. Staff can add Breakfast/Lunch/Afternoon/Dinner targets for a more actionable guide.
                  </p>
                </div>
              )}
            </div>

            {/* Coach notes (PlanJson.notes) */}
            {coachNotes ? (
              <div className="bg-white rounded-2xl shadow-md border border-blue-100 p-5">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <h3 className="text-lg font-extrabold text-gray-900">Coach Notes</h3>
                    <p className="text-sm text-gray-600 mt-1">Extra context (supplements, reminders, adjustments).</p>
                  </div>

                  {canExpandNotes ? (
                    <button
                      type="button"
                      onClick={() => setExpandedNotes((v) => !v)}
                      className="text-xs font-semibold text-[#46769B] hover:underline focus:outline-none focus:ring-2 focus:ring-[#46769B]/30 rounded"
                    >
                      {expandedNotes ? "Collapse" : "Expand"}
                    </button>
                  ) : null}
                </div>

                <div
                  className={cx(
                    "mt-4 whitespace-pre-wrap text-sm leading-relaxed text-gray-900 rounded-2xl border border-gray-200 bg-gray-50 p-4",
                    !expandedNotes && canExpandNotes && "max-h-56 overflow-hidden"
                  )}
                >
                  {coachNotes}
                </div>
              </div>
            ) : null}

            {/* Legacy plan text (Prescription) */}
            {prescription ? (
              <div className="bg-white rounded-2xl shadow-md border border-blue-100 p-5">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <h3 className="text-lg font-extrabold text-gray-900">Full Plan Text</h3>
                    <p className="text-sm text-gray-600 mt-1">Copyable summary (legacy-friendly).</p>
                  </div>

                  {canExpandLegacy ? (
                    <button
                      type="button"
                      onClick={() => setExpandedNotes((v) => !v)}
                      className="text-xs font-semibold text-[#46769B] hover:underline focus:outline-none focus:ring-2 focus:ring-[#46769B]/30 rounded"
                    >
                      {expandedNotes ? "Collapse" : "Expand"}
                    </button>
                  ) : null}
                </div>

                <pre
                  className={cx(
                    "mt-4 whitespace-pre-wrap text-sm leading-relaxed text-gray-900 rounded-2xl border border-gray-200 bg-gray-50 p-4",
                    !expandedNotes && canExpandLegacy && "max-h-56 overflow-hidden"
                  )}
                >
                  {prescription}
                </pre>
              </div>
            ) : null}

            {/* Bottom guidance */}
            <SuggestionBox title="How to win this week">
              <ul className="list-disc pl-5 space-y-1">
                <li>
                  <span className="font-semibold">Protein first</span>: hit it most days (recovery lever #1).
                </li>
                <li>
                  <span className="font-semibold">Close counts</span>: if you’re on a meal plan, pick the closest “play” and move on.
                </li>
                <li>
                  If a day is messy, don’t compensate — <span className="font-semibold">reset at the next meal</span>.
                </li>
              </ul>
            </SuggestionBox>
          </>
        ) : null}
      </main>
    </div>
  );
}
