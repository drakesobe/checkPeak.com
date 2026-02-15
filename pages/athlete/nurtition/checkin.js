// pages/athlete/nutrition/checkin.js
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { useAuthContext } from "@/hooks/useAuth";

/* ---------------- helpers ---------------- */

function cx(...xs) {
  return xs.filter(Boolean).join(" ");
}

function asNum(v) {
  const n = Number(String(v ?? "").trim());
  return Number.isFinite(n) ? n : null;
}

function clampInt(n, min, max) {
  const x = Math.round(Number(n));
  if (!Number.isFinite(x)) return min;
  return Math.min(max, Math.max(min, x));
}

function nyWeekStartISO(d = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);

  const y = parts.find((p) => p.type === "year")?.value;
  const m = parts.find((p) => p.type === "month")?.value;
  const day = parts.find((p) => p.type === "day")?.value;

  const nyMid = new Date(`${y}-${m}-${day}T12:00:00`);
  const dow = nyMid.getDay();
  const diffToMon = (dow + 6) % 7;
  nyMid.setDate(nyMid.getDate() - diffToMon);

  const parts2 = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(nyMid);

  const y2 = parts2.find((p) => p.type === "year")?.value;
  const m2 = parts2.find((p) => p.type === "month")?.value;
  const d2 = parts2.find((p) => p.type === "day")?.value;

  return `${y2}-${m2}-${d2}`;
}

function scoreLabel(pct) {
  const n = asNum(pct);
  if (n == null) return { text: "—", tone: "neutral" };
  if (n >= 85) return { text: "Great", tone: "good" };
  if (n >= 70) return { text: "Solid", tone: "good" };
  if (n >= 50) return { text: "Okay", tone: "warn" };
  return { text: "Needs work", tone: "warn" };
}

function pillClass(tone) {
  if (tone === "good") return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (tone === "warn") return "bg-amber-50 text-amber-800 border-amber-200";
  return "bg-gray-50 text-gray-700 border-gray-200";
}

/* ---------------- tiny UI ---------------- */

function SliderRow({ label, value, setValue, hint }) {
  const meta = useMemo(() => scoreLabel(value), [value]);

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-extrabold text-gray-900">{label}</p>
          {hint ? <p className="text-xs text-gray-500 mt-1">{hint}</p> : null}
        </div>

        <span className={cx("text-[11px] px-2 py-1 rounded-lg border font-semibold", pillClass(meta.tone))}>
          {value}% • {meta.text}
        </span>
      </div>

      <div className="mt-3">
        <input
          type="range"
          min={0}
          max={100}
          step={5}
          value={value}
          onChange={(e) => setValue(clampInt(e.target.value, 0, 100))}
          className="w-full"
        />
        <div className="flex justify-between text-[10px] text-gray-400 mt-1">
          <span>0</span>
          <span>50</span>
          <span>100</span>
        </div>
      </div>
    </div>
  );
}

/* ---------------- page ---------------- */

export default function AthleteNutritionCheckinPage() {
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

  const weekStart = useMemo(() => nyWeekStartISO(new Date()), []);

  const [caloriesPct, setCaloriesPct] = useState(75);
  const [proteinPct, setProteinPct] = useState(75);
  const [hydrationPct, setHydrationPct] = useState(75);
  const [notes, setNotes] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [okMsg, setOkMsg] = useState("");
  const [err, setErr] = useState("");

  const submit = useCallback(async () => {
    setSubmitting(true);
    setOkMsg("");
    setErr("");

    try {
      const res = await fetch("/api/athlete/nutrition/checkins/create", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          caloriesPct,
          proteinPct,
          hydrationPct,
          notes,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Failed to submit check-in.");

      setOkMsg("Check-in submitted. Keep stacking wins.");
      setErr("");
    } catch (e) {
      setErr(e?.message || "Failed to submit check-in.");
      setOkMsg("");
    } finally {
      setSubmitting(false);
    }
  }, [caloriesPct, proteinPct, hydrationPct, notes]);

  // Guards after hooks
  if (!mounted) return null;
  if (!authReady) return null;
  if (!user) return <div className="p-6">Please log in.</div>;
  if (!isAthlete) return <div className="p-6">Not authorized.</div>;

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-blue-50 text-gray-900 font-sans">
      <main className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        {/* Header */}
        <div className="bg-white rounded-2xl shadow-md border border-blue-100 p-6">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div className="min-w-0">
              <h1 className="text-2xl font-extrabold text-gray-900">Weekly Nutrition Check-In</h1>
              <p className="text-sm text-gray-600 mt-1">
                Quick self-report. Not a food log. The goal is consistency, especially with a dining hall meal plan.
              </p>
              <p className="text-[11px] text-gray-500 mt-2">
                Week starting: <span className="font-semibold">{weekStart}</span> (Mon)
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => router.push("/athlete/nutrition")}
                className="px-4 py-2 rounded-xl border border-gray-200 bg-white text-sm font-semibold hover:bg-gray-50"
              >
                Back to plan
              </button>
              <button
                type="button"
                onClick={() => router.push("/dashboard")}
                className="px-4 py-2 rounded-xl border border-gray-200 bg-white text-sm font-semibold hover:bg-gray-50"
              >
                Dashboard
              </button>
            </div>
          </div>

          <div className="mt-4 rounded-2xl border border-gray-200 bg-gray-50 p-4">
            <p className="text-sm text-gray-800">
              Think of this like workouts: you still train even if the session wasn’t perfect.
              Same here — you’re aiming for <span className="font-semibold">close</span>, not laboratory-accurate.
            </p>
            <ul className="mt-2 text-sm text-gray-700 list-disc pl-5 space-y-1">
              <li>Calories: were you roughly on target most days?</li>
              <li>Protein: did you hit protein at most meals?</li>
              <li>Hydration: were you consistent daily?</li>
            </ul>
          </div>
        </div>

        {/* Sliders */}
        <div className="grid md:grid-cols-2 gap-4">
          <SliderRow
            label="Calories adherence"
            value={caloriesPct}
            setValue={setCaloriesPct}
            hint="How often were you close to your daily calories?"
          />
          <SliderRow
            label="Protein adherence"
            value={proteinPct}
            setValue={setProteinPct}
            hint="Did you prioritize protein daily?"
          />
          <div className="md:col-span-2">
            <SliderRow
              label="Hydration adherence"
              value={hydrationPct}
              setValue={setHydrationPct}
              hint="Did you consistently hit your hydration goal?"
            />
          </div>
        </div>

        {/* Notes */}
        <div className="bg-white rounded-2xl shadow-md border border-blue-100 p-5">
          <p className="text-sm font-extrabold text-gray-900">Notes (optional)</p>
          <p className="text-xs text-gray-500 mt-1">
            Anything that explains the week: travel, illness, tough schedule, appetite, practice volume, etc.
          </p>

          <textarea
            className="mt-3 w-full min-h-[120px] px-4 py-3 rounded-xl border border-gray-300 bg-white text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#46769B]/30"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Example: “Two away games; struggled to hydrate. Protein was good. Calories low on travel days.”"
          />

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={submitting}
              onClick={submit}
              className={cx(
                "px-5 py-3 rounded-xl text-sm font-semibold text-white bg-[#46769B] hover:brightness-110 transition",
                submitting && "opacity-70 cursor-not-allowed"
              )}
            >
              {submitting ? "Submitting…" : "Submit check-in"}
            </button>

            <button
              type="button"
              disabled={submitting}
              onClick={() => {
                setCaloriesPct(75);
                setProteinPct(75);
                setHydrationPct(75);
                setNotes("");
                setOkMsg("");
                setErr("");
              }}
              className={cx(
                "px-5 py-3 rounded-xl text-sm font-semibold border border-gray-200 bg-white hover:bg-gray-50",
                submitting && "opacity-70 cursor-not-allowed"
              )}
            >
              Reset
            </button>

            <span className="text-[11px] text-gray-500">
              Tip: 70–85% is “solid” for busy weeks. Keep it moving.
            </span>
          </div>

          {okMsg ? (
            <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
              <p className="text-sm text-emerald-800 font-semibold">{okMsg}</p>
              <p className="text-xs text-emerald-700 mt-1">
                Your staff will see this in your nutrition profile.
              </p>
            </div>
          ) : null}

          {err ? (
            <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4">
              <p className="text-sm text-red-700 font-semibold">{err}</p>
            </div>
          ) : null}
        </div>
      </main>
    </div>
  );
}
