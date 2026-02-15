// pages/athlete/nutrition/today.js
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

function MealBlockCard({ label, block }) {
  const t = block?.targets || {};
  const dining = safeText(block?.diningHallRules);
  const home = safeText(block?.homeExamples);

  const hasAnyTargets =
    asNum(t.calories) != null || asNum(t.protein) != null || asNum(t.carbs) != null || asNum(t.fat) != null;

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-extrabold text-gray-900">{label}</p>
          <p className="text-xs text-gray-600 mt-1">
            Target:{" "}
            <span className="font-semibold">{fmtMacro(t.calories)}</span> cals •{" "}
            <span className="font-semibold">{fmtMacro(t.protein)}</span>P •{" "}
            <span className="font-semibold">{fmtMacro(t.carbs)}</span>C •{" "}
            <span className="font-semibold">{fmtMacro(t.fat)}</span>F
          </p>
        </div>

        <span
          className={cx(
            "shrink-0 text-[10px] px-2 py-1 rounded-lg border font-semibold",
            hasAnyTargets
              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
              : "bg-gray-100 text-gray-500 border-gray-200"
          )}
        >
          {hasAnyTargets ? "Suggested" : "Unset"}
        </span>
      </div>

      {(dining || home) ? (
        <div className="mt-3 space-y-2">
          {dining ? (
            <div className="text-xs text-gray-700">
              <span className="font-semibold text-gray-900">Dining hall:</span> {dining}
            </div>
          ) : null}
          {home ? (
            <div className="text-xs text-gray-700">
              <span className="font-semibold text-gray-900">Home:</span> {home}
            </div>
          ) : null}
        </div>
      ) : (
        <p className="mt-3 text-xs text-gray-500">No examples added for this block yet.</p>
      )}
    </div>
  );
}

/* ---------------- page ---------------- */

export default function AthleteNutritionToday() {
  const router = useRouter();
  const { user, authReady } = useAuthContext();

  const role = useMemo(() => {
    const raw = String(user?.role || user?.Role || "").trim().toLowerCase();
    if (!raw) return "";
    if (raw.includes("ath")) return "athlete";
    return raw;
  }, [user]);

  const isAthlete = role === "athlete";

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const [selectedDate, setSelectedDate] = useState(nyISODate());
  useEffect(() => {
    if (!router.isReady) return;
    const qd = asString(router.query?.date);
    setSelectedDate(isISODateOnly(qd) ? qd : nyISODate());
  }, [router.isReady, router.query?.date]);

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [latestPlan, setLatestPlan] = useState(null);
  const [message, setMessage] = useState("");
  const [nextPlan, setNextPlan] = useState(null);

  // dedupe + abort
  const lastLoadedRef = useRef("");
  const inflightRef = useRef(null);

  const load = useCallback(
    async (isoDate, opts = {}) => {
      const force = Boolean(opts?.force);
      const date = isISODateOnly(isoDate) ? isoDate : selectedDate;

      if (!authReady || !user || !isAthlete) return;
      if (!isISODateOnly(date)) return;

      if (!force && lastLoadedRef.current === date && !err) return;

      try {
        inflightRef.current?.abort?.();
      } catch {}
      const controller = new AbortController();
      inflightRef.current = controller;

      setLoading(true);
      setErr("");
      setMessage("");
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
              : data?.error || "Failed to load nutrition plan";
          throw new Error(msg);
        }

        setLatestPlan(data?.latestPlan || null);
        setMessage(safeText(data?.message || ""));
        setNextPlan(data?.nextPlan || null);

        lastLoadedRef.current = date;
      } catch (e) {
        if (String(e?.name || "") === "AbortError") return;
        setErr(e?.message || "Failed to load nutrition");
        setLatestPlan(null);
        setMessage("");
        setNextPlan(null);
      } finally {
        setLoading(false);
      }
    },
    [authReady, user, isAthlete, selectedDate, err]
  );

  useEffect(() => {
    if (!mounted) return;
    if (!router.isReady) return;
    if (!authReady || !user || !isAthlete) return;
    load(selectedDate);
  }, [mounted, router.isReady, authReady, user, isAthlete, selectedDate, load]);

  // Guards
  if (!mounted) return null;
  if (!authReady) return null;
  if (!user) return <div style={{ padding: 24 }}>Please log in.</div>;
  if (!isAthlete) return <div style={{ padding: 24 }}>Not authorized.</div>;

  const planJson = pickPlanJson(latestPlan);
  const mealBlocks = planJson?.mealBlocks || null;
  const daily = planJson?.daily || latestPlan?.daily || null;

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-blue-50 text-gray-900 font-sans">
      <main className="max-w-5xl mx-auto px-4 py-8 space-y-6">
        <div className="bg-white rounded-2xl shadow-md border border-blue-100 p-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-extrabold">Nutrition (Date View)</h1>
            <p className="text-sm text-gray-600 mt-1">
              Suggested targets by meal — built for dining halls, not calorie-perfect meal prep.
            </p>
            <p className="text-[11px] text-gray-500 mt-2">
              Date: <span className="font-semibold">{selectedDate}</span>
            </p>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => router.push(`/athlete/nutrition?date=${encodeURIComponent(selectedDate)}`)}
              className="px-4 py-2 rounded-xl border border-gray-200 bg-white text-sm font-semibold hover:bg-gray-50"
              type="button"
            >
              Open full view
            </button>
            <button
              onClick={() => load(selectedDate, { force: true })}
              className="px-4 py-2 rounded-xl bg-[#46769B] text-white text-sm font-semibold hover:brightness-110"
              type="button"
            >
              Refresh
            </button>
          </div>
        </div>

        {loading ? (
          <div className="bg-white rounded-2xl shadow-md border border-blue-100 p-5">
            <p className="text-sm text-gray-600">Loading…</p>
          </div>
        ) : null}

        {!loading && err ? (
          <div className="bg-white rounded-2xl shadow-md border border-red-200 p-5">
            <p className="text-sm text-red-700 font-semibold">{err}</p>
          </div>
        ) : null}

        {!loading && !err ? (
          <>
            {message ? (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                <p className="text-sm font-semibold text-amber-900">{message}</p>
                {nextPlan?.effectiveDate ? (
                  <p className="text-xs text-amber-900/80 mt-1">
                    Next plan starts: <span className="font-semibold">{nextPlan.effectiveDate}</span>
                  </p>
                ) : null}
              </div>
            ) : null}

            {!mealBlocks ? (
              <div className="bg-white rounded-2xl shadow-md border border-blue-100 p-5">
                <p className="text-sm text-gray-900 font-extrabold">No effective plan for this date.</p>
                <p className="text-sm text-gray-600 mt-1">
                  Try a different date or check back soon.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {daily ? (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="rounded-2xl border border-gray-200 bg-white p-4">
                      <p className="text-[11px] text-gray-500">Calories</p>
                      <p className="text-xl font-extrabold text-gray-900 mt-1">{fmtMacro(daily?.calories)}</p>
                    </div>
                    <div className="rounded-2xl border border-gray-200 bg-white p-4">
                      <p className="text-[11px] text-gray-500">Protein</p>
                      <p className="text-xl font-extrabold text-gray-900 mt-1">{fmtMacro(daily?.protein)}</p>
                    </div>
                    <div className="rounded-2xl border border-gray-200 bg-white p-4">
                      <p className="text-[11px] text-gray-500">Carbs</p>
                      <p className="text-xl font-extrabold text-gray-900 mt-1">{fmtMacro(daily?.carbs)}</p>
                    </div>
                    <div className="rounded-2xl border border-gray-200 bg-white p-4">
                      <p className="text-[11px] text-gray-500">Fat</p>
                      <p className="text-xl font-extrabold text-gray-900 mt-1">{fmtMacro(daily?.fat)}</p>
                    </div>
                  </div>
                ) : null}

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-extrabold text-gray-900">Targets by Meal</p>
                    <p className="text-[11px] text-gray-500">Breakfast • Lunch • Afternoon • Dinner</p>
                  </div>

                  <div className="grid md:grid-cols-2 gap-3">
                    <MealBlockCard label="Breakfast" block={mealBlocks.breakfast} />
                    <MealBlockCard label="Lunch" block={mealBlocks.lunch} />
                    <MealBlockCard label="Afternoon" block={mealBlocks.afternoon} />
                    <MealBlockCard label="Dinner" block={mealBlocks.dinner} />
                  </div>
                </div>
              </div>
            )}
          </>
        ) : null}
      </main>
    </div>
  );
}
