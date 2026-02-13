// pages/org/nutrition.js
"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { useRouter } from "next/router";
import { useAuthContext } from "@/hooks/useAuth";
import { useNutritionQueue } from "@/hooks/org/useNutritionQueue";

import NutritionHeader from "@/components/org/nutrition/NutritionHeader";
import NutritionStats from "@/components/org/nutrition/NutritionStats";
import NutritionControls from "@/components/org/nutrition/NutritionControls";
import NutritionTable from "@/components/org/nutrition/NutritionTable";

function isLikelyOrgToken(v) {
  const s = String(v || "").trim().toUpperCase();
  return s.startsWith("ORG-");
}

function cx(...xs) {
  return xs.filter(Boolean).join(" ");
}

function TabButton({ active, children, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        "px-3 py-2 rounded-xl text-sm font-semibold border transition",
        active
          ? "bg-white border-blue-200 text-gray-900 shadow-sm"
          : "bg-white/60 border-transparent text-gray-600 hover:bg-white hover:border-gray-200"
      )}
    >
      {children}
    </button>
  );
}

function QuickActionCard({ title, body, tone = "neutral", onClick, right }) {
  const toneCls =
    tone === "good"
      ? "border-emerald-200"
      : tone === "warn"
      ? "border-amber-200"
      : tone === "bad"
      ? "border-red-200"
      : "border-blue-100";

  const accent =
    tone === "good"
      ? "bg-emerald-500"
      : tone === "warn"
      ? "bg-amber-500"
      : tone === "bad"
      ? "bg-red-500"
      : "bg-[#46769B]";

  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        "text-left w-full bg-white rounded-2xl shadow-md border p-4 relative overflow-hidden",
        "hover:shadow-lg hover:-translate-y-[1px] transition",
        "focus:outline-none focus:ring-2 focus:ring-[#46769B]/25",
        toneCls
      )}
    >
      <div className={cx("absolute left-0 top-0 h-1 w-full", accent)} />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-extrabold text-gray-900">{title}</p>
          <p className="text-sm text-gray-600 mt-1">{body}</p>
        </div>
        {right ? <div className="shrink-0">{right}</div> : null}
      </div>
    </button>
  );
}

export default function OrgNutritionQueuePage() {
  const router = useRouter();
  const { user } = useAuthContext();

  const role = useMemo(() => {
    const r = String(user?.role || user?.Role || "").trim().toLowerCase();
    if (!r) return "";
    if (r === "organization") return "organization";
    if (r === "admin") return "admin";
    if (r === "trainer") return "trainer";
    if (r.includes("org")) return "organization";
    if (r.includes("admin")) return "admin";
    if (r.includes("train")) return "trainer";
    if (r.includes("ath")) return "athlete";
    return r;
  }, [user]);

  const isOrgSide = role === "organization" || role === "admin" || role === "trainer";

  useEffect(() => {
    if (!user) return;
    if (!isOrgSide) router.push("/dashboard");
  }, [user, isOrgSide, router]);

  const { loading, error, rows, counts, meta, lastUpdatedLabel, refresh } = useNutritionQueue({
    enabled: Boolean(user && isOrgSide),
  });

  const [tab, setTab] = useState("queue"); // queue | templates | safe | insights

  const [search, setSearch] = useState("");
  const [filterMode, setFilterMode] = useState("action"); // action | missing_checkin | low_adherence | no_plan | all

  const setFilterFromCard = useCallback((mode) => {
    setFilterMode(mode);
    setTab("queue");
  }, []);

  const filtered = useMemo(() => {
    const q = String(search || "").trim().toLowerCase();
    let list = Array.isArray(rows) ? [...rows] : [];

    if (q) {
      list = list.filter((r) => {
        const hay = [
          r.athleteName,
          r.athleteEmail,
          r.athleteToken,
          (r.reasons || []).join(" "),
          r.priorityLabel,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return hay.includes(q);
      });
    }

    if (filterMode === "action") list = list.filter((r) => r.needsAction);
    if (filterMode === "missing_checkin") list = list.filter((r) => r.missingCheckin);
    if (filterMode === "low_adherence") list = list.filter((r) => r.lowAdherence);
    if (filterMode === "no_plan") list = list.filter((r) => !r.hasPlan);

    return list;
  }, [rows, search, filterMode]);

  const onOpenAthlete = useCallback(
    (row) => {
      const token = String(row?.athleteToken || "").trim();
      if (!token) {
        console.error("[nutrition] Missing athleteToken for row:", row);
        return;
      }
      if (isLikelyOrgToken(token)) {
        console.error("[nutrition] athleteToken looks like ORG token; refusing to navigate:", token, row);
        return;
      }
      router.push(`/org/nutrition/athlete/${encodeURIComponent(token)}`);
    },
    [router]
  );

  const headline = useMemo(() => {
    // Keep this simple + deterministic
    const week = meta?.weekStartISO ? `Week of ${meta.weekStartISO}` : "This week";
    return week;
  }, [meta?.weekStartISO]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-blue-50 text-gray-900 font-sans">
      <main className="max-w-7xl mx-auto px-4 py-8 space-y-6">
        {/* Existing header (keep) */}
        <NutritionHeader
          weekStartISO={meta?.weekStartISO}
          lastUpdatedLabel={lastUpdatedLabel}
          loading={loading}
          error={error}
          onGoDashboard={() => router.push("/org/dashboard")}
          onGoPlans={() => router.push("/org/prescriptions")}
          onRefresh={() => refresh()}
        />

        {/* NEW: Dashboard hero / action strip */}
        <section className="bg-white rounded-2xl shadow-md border border-blue-100 p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <p className="text-xs font-semibold text-gray-500">Nutrition Dashboard</p>
              <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-gray-900 truncate">
                {headline}
              </h1>
              <p className="mt-2 text-sm text-gray-600">
                Set simple targets by meal, attach safe SmartStack picks, and track weekly check-ins.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => router.push("/org/prescriptions")}
                className="px-4 py-2 rounded-xl bg-[#46769B] text-white text-sm font-semibold hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-[#46769B]/35"
              >
                Create / Update Plan →
              </button>

              <button
                type="button"
                onClick={() => setTab("templates")}
                className="px-4 py-2 rounded-xl border border-gray-200 bg-white text-sm font-semibold hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-200"
              >
                Templates
              </button>

              <button
                type="button"
                onClick={() => setTab("safe")}
                className="px-4 py-2 rounded-xl border border-gray-200 bg-white text-sm font-semibold hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-200"
              >
                Safe Picks
              </button>
            </div>
          </div>

          {/* NEW: Quick action center */}
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <QuickActionCard
              title="Needs action"
              body="Athletes flagged for plan/check-in follow-up."
              tone="neutral"
              onClick={() => setFilterFromCard("action")}
              right={
                <span className="text-[11px] px-2 py-1 rounded-lg border bg-gray-50 text-gray-700 border-gray-200 font-semibold">
                  {counts?.needsAction ?? "—"}
                </span>
              }
            />
            <QuickActionCard
              title="Missing / old check-in"
              body="No recent submission (weekly)."
              tone="warn"
              onClick={() => setFilterFromCard("missing_checkin")}
              right={
                <span className="text-[11px] px-2 py-1 rounded-lg border bg-amber-50 text-amber-900 border-amber-200 font-semibold">
                  {counts?.missingCheckin ?? "—"}
                </span>
              }
            />
            <QuickActionCard
              title="No plan"
              body="Athletes without targets + meal guidance."
              tone="bad"
              onClick={() => setFilterFromCard("no_plan")}
              right={
                <span className="text-[11px] px-2 py-1 rounded-lg border bg-red-50 text-red-800 border-red-200 font-semibold">
                  {counts?.noPlan ?? "—"}
                </span>
              }
            />
          </div>
        </section>

        {/* Keep your existing stats row */}
        <NutritionStats counts={counts} activeFilter={filterMode} onSelectFilter={setFilterFromCard} />

        {/* NEW: Tabs */}
        <div className="flex flex-wrap gap-2">
          <TabButton active={tab === "queue"} onClick={() => setTab("queue")}>
            Athlete Queue
          </TabButton>
          <TabButton active={tab === "templates"} onClick={() => setTab("templates")}>
            Plan Templates
          </TabButton>
          <TabButton active={tab === "safe"} onClick={() => setTab("safe")}>
            SmartStack Safe Picks
          </TabButton>
          <TabButton active={tab === "insights"} onClick={() => setTab("insights")}>
            Insights
          </TabButton>
        </div>

        {/* TAB: Queue (your current experience, but now framed) */}
        {tab === "queue" ? (
          <>
            <NutritionControls
              search={search}
              setSearch={setSearch}
              filterMode={filterMode}
              setFilterMode={setFilterMode}
            />
            <NutritionTable loading={loading} rows={filtered} onOpenAthlete={onOpenAthlete} />
          </>
        ) : null}

        {/* TAB: Templates (placeholder now, we build next) */}
        {tab === "templates" ? (
          <section className="bg-white rounded-2xl shadow-md border border-blue-100 p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-lg font-extrabold text-gray-900">Plan Templates</h2>
                <p className="text-sm text-gray-600 mt-1">
                  Create reusable surplus/maintain/cut templates and apply them to athletes in one click.
                </p>
              </div>
              <button
                type="button"
                onClick={() => router.push("/org/prescriptions")}
                className="px-4 py-2 rounded-xl bg-[#46769B] text-white text-sm font-semibold hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-[#46769B]/35"
              >
                Build templates in Plans →
              </button>
            </div>

            <div className="mt-4 rounded-2xl border border-gray-200 bg-gray-50 p-4">
              <p className="text-sm font-semibold text-gray-900">Coming next</p>
              <ul className="mt-2 text-sm text-gray-700 list-disc pl-5 space-y-1">
                <li>Surplus / Maintain / Cut templates</li>
                <li>Auto meal-split (Breakfast / Lunch / Dinner / Snacks)</li>
                <li>Attach SmartStack safe picks per meal</li>
                <li>Apply template to a team / position group</li>
              </ul>
            </div>
          </section>
        ) : null}

        {/* TAB: Safe picks (placeholder now, we wire next) */}
        {tab === "safe" ? (
          <section className="bg-white rounded-2xl shadow-md border border-blue-100 p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-lg font-extrabold text-gray-900">SmartStack Safe Picks</h2>
                <p className="text-sm text-gray-600 mt-1">
                  Curate “approved” protein, bars, electrolytes, and energy—then attach to meal blocks.
                </p>
              </div>

              <button
                type="button"
                onClick={() => router.push("/org/smartstack")}
                className="px-4 py-2 rounded-xl border border-gray-200 bg-white text-sm font-semibold hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-200"
              >
                Open SmartStack →
              </button>
            </div>

            <div className="mt-4 rounded-2xl border border-gray-200 bg-gray-50 p-4">
              <p className="text-sm font-semibold text-gray-900">Next build</p>
              <p className="mt-1 text-sm text-gray-700">
                This tab will show curated lists (e.g., “Protein powders”, “Bars”, “Electrolytes”, “Energy drinks”) with
                one-click attach into templates and athlete plans.
              </p>
            </div>
          </section>
        ) : null}

        {/* TAB: Insights (placeholder now, later: team adherence trends) */}
        {tab === "insights" ? (
          <section className="bg-white rounded-2xl shadow-md border border-blue-100 p-5">
            <h2 className="text-lg font-extrabold text-gray-900">Insights</h2>
            <p className="text-sm text-gray-600 mt-1">
              Team-level adherence trends, missed check-ins, and “at risk” athletes.
            </p>

            <div className="mt-4 rounded-2xl border border-gray-200 bg-gray-50 p-4">
              <p className="text-sm text-gray-700">
                Coming soon: charts (weekly adherence), filters (sport/position), and exportable reports.
              </p>
            </div>
          </section>
        ) : null}
      </main>
    </div>
  );
}
