// pages/org/dashboard.js
"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useRouter } from "next/router";
import { useAuthContext } from "@/hooks/useAuth";
import {
  RefreshCcw,
  LogOut,
  Copy,
  Users,
  FileText,
  Activity,
  ArrowRight,
  Search,
  Link as LinkIcon,
  Mail,
  ShieldCheck,
  Sparkles,
  AlertTriangle,
  Filter,
  CheckCircle2,
  Download,
  LayoutDashboard,
  ChevronRight,
  ChevronDown,
  X,
  Pencil,
  Tag,
  ClipboardList,
  CalendarDays,
  Dumbbell,
} from "lucide-react";

/**
 * ✅ ORG ISSUE FIXES APPLIED HERE
 *
 * 1) Role gating supports Organization + Admin + Trainer (OrgMembers)
 * 2) No x-org-token headers; rely on HttpOnly cookie session + requireOrg(req)
 * 3) Invite link still token-based, token read from session payload
 *
 * ✅ NEW:
 * - Fixes triple-fetch spam by:
 *   - using "once per mount" guards (refs)
 *   - removing effect dependencies that can churn
 *   - aborting stale requests
 * - "Today's Workouts" panel with:
 *   - sport toggle (Basketball/Football/Baseball/Soccer)
 *   - workout + item + completion summary
 *   - quick list of today's workouts
 *   - CTA to /org/workouts-calendar
 */

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function safeDate(value) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function fmtDate(value) {
  const d = safeDate(value);
  if (!d) return value ? String(value) : "";
  return d.toLocaleString();
}

async function safeJson(res) {
  try {
    return await res.json();
  } catch {
    return {};
  }
}

function classNames(...xs) {
  return xs.filter(Boolean).join(" ");
}

function downloadTextFile(filename, text, mime = "text/plain") {
  try {
    const blob = new Blob([text], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  } catch {}
}

function toCSV(rows) {
  const escape = (v) => {
    const s = String(v ?? "");
    const needs = /[",\n]/.test(s);
    const escaped = s.replace(/"/g, '""');
    return needs ? `"${escaped}"` : escaped;
  };
  return rows.map((r) => r.map(escape).join(",")).join("\n");
}

/** YYYY-MM-DD in America/New_York */
function nyDateISO() {
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

function StatCard({ icon: Icon, label, value, sub }) {
  return (
    <div className="bg-white rounded-2xl shadow-md border border-blue-100 p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs text-gray-500">{label}</p>
          <p className="text-2xl font-extrabold text-gray-900 mt-1 break-words">
            {value}
          </p>
          {sub ? <p className="text-[11px] text-gray-500 mt-2">{sub}</p> : null}
        </div>
        <div className="shrink-0 w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center">
          <Icon className="w-5 h-5 text-[#46769B]" />
        </div>
      </div>
    </div>
  );
}

function Pill({ children, tone = "neutral" }) {
  const toneCls =
    tone === "warn"
      ? "bg-amber-50 text-amber-800 border-amber-200"
      : tone === "bad"
      ? "bg-red-50 text-red-800 border-red-200"
      : tone === "good"
      ? "bg-emerald-50 text-emerald-800 border-emerald-200"
      : "bg-gray-100 text-gray-700 border-gray-200";

  return (
    <span
      className={classNames(
        "inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold border",
        toneCls
      )}
    >
      {children}
    </span>
  );
}

function TagChip({ text }) {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-semibold border border-gray-200 bg-white text-gray-700">
      <Tag className="w-3.5 h-3.5 text-gray-400" />
      <span className="break-words">{text}</span>
    </span>
  );
}

function Button({
  children,
  onClick,
  variant = "primary",
  disabled = false,
  className = "",
  title = "",
  type = "button",
}) {
  const base =
    "inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition";
  const styles =
    variant === "primary"
      ? "bg-[#46769B] text-white hover:brightness-110"
      : variant === "dark"
      ? "bg-gray-900 text-white hover:opacity-90"
      : "bg-white text-gray-800 border border-gray-200 hover:bg-gray-50";

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={classNames(
        base,
        styles,
        disabled ? "opacity-70 cursor-not-allowed" : "",
        className
      )}
      type={type}
    >
      {children}
    </button>
  );
}

function CopyButton({ text, label = "Copy", compact = false }) {
  const [copied, setCopied] = useState(false);

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(String(text || ""));
      setCopied(true);
      setTimeout(() => setCopied(false), 900);
    } catch {
      setCopied(false);
    }
  };

  return (
    <Button
      variant="secondary"
      onClick={onCopy}
      disabled={!text}
      className={compact ? "px-3 py-2 text-xs" : ""}
    >
      <Copy className={compact ? "w-3.5 h-3.5" : "w-4 h-4"} />
      {copied ? "Copied" : label}
    </Button>
  );
}

function Modal({ open, title, children, onClose }) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[9999]">
      <div
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
        role="button"
        tabIndex={0}
      />
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div className="w-full max-w-xl bg-white rounded-2xl shadow-xl border border-gray-200">
          <div className="p-5 border-b flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-lg font-extrabold text-gray-900 truncate">
                {title}
              </p>
              <p className="text-[12px] text-gray-500 mt-1">
                Update status/tags to power filtering and workflow.
              </p>
            </div>
            <button
              className="p-2 rounded-xl border border-gray-200 hover:bg-gray-50"
              onClick={onClose}
              type="button"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="p-5">{children}</div>
        </div>
      </div>
    </div>
  );
}

function PlanChip({ needsPlan, stale }) {
  if (needsPlan) {
    return (
      <Pill tone="bad">
        <AlertTriangle className="w-3.5 h-3.5 mr-1.5" />
        Needs plan
      </Pill>
    );
  }
  if (stale) {
    return (
      <Pill tone="warn">
        <AlertTriangle className="w-3.5 h-3.5 mr-1.5" />
        Needs update
      </Pill>
    );
  }
  return (
    <Pill tone="good">
      <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
      Current
    </Pill>
  );
}

/** Mobile roster card (small screens) */
function AthleteCard({
  athlete,
  templates,
  isExpanded,
  onToggle,
  onEdit,
  onHistory,
  onBuild,
  fmtDate,
}) {
  const email = normalizeEmail(athlete?.email);
  const status = String(athlete?.status || "Active");
  const tags = Array.isArray(athlete?.tags) ? athlete.tags : [];

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
      <button
        type="button"
        onClick={() => onToggle(email)}
        className="w-full text-left"
        title="Expand"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              {isExpanded ? (
                <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />
              ) : (
                <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />
              )}
              <p className="font-extrabold text-gray-900 truncate">
                {athlete?.name || "Athlete"}
              </p>
            </div>

            <div className="mt-2 flex flex-wrap gap-2">
              <PlanChip needsPlan={!!athlete?.needsPlan} stale={!!athlete?.stale} />
              <Pill>{status}</Pill>
              <Pill>{athlete?.plansCount || 0} plans</Pill>
            </div>

            <p className="mt-2 text-[12px] text-gray-700 break-all">
              {email || "—"}
            </p>
            {email ? (
              <a
                href={`mailto:${email}`}
                className="inline-flex items-center gap-1 text-[11px] text-[#46769B] font-semibold hover:underline mt-1"
              >
                <Mail className="w-3.5 h-3.5" />
                Email
              </a>
            ) : null}

            <div className="mt-3">
              <p className="text-[11px] text-gray-500">Last plan</p>
              <p className="text-[12px] text-gray-800 font-semibold">
                {athlete?.lastPlanAt ? fmtDate(athlete.lastPlanAt) : "—"}
              </p>
              {athlete?.lastPlanTitle ? (
                <p className="text-[11px] text-gray-500 mt-0.5 break-words">
                  {athlete.lastPlanTitle}
                </p>
              ) : (
                <p className="text-[11px] text-gray-400 mt-0.5">No plans yet</p>
              )}
            </div>
          </div>
        </div>
      </button>

      <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-2">
        <Button
          variant="secondary"
          className="px-3 py-2 text-xs w-full"
          onClick={() => onEdit(athlete)}
          disabled={!email}
        >
          <Pencil className="w-4 h-4" />
          Edit
        </Button>

        <Button
          variant="secondary"
          className="px-3 py-2 text-xs w-full"
          onClick={() => onHistory(email)}
          disabled={!email}
        >
          History
        </Button>

        <Button
          className="px-3 py-2 text-xs w-full"
          onClick={() => onBuild(email)}
          disabled={!email}
        >
          Build
          <ArrowRight className="w-4 h-4" />
        </Button>
      </div>

      {isExpanded ? (
        <div className="mt-4 rounded-2xl border border-gray-200 bg-gray-50 p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <div className="rounded-2xl border border-gray-200 bg-white p-4">
              <p className="text-xs text-gray-500">Plan status</p>
              <p className="text-sm font-extrabold text-gray-900 mt-1">
                {athlete?.needsPlan
                  ? "Needs first plan"
                  : athlete?.stale
                  ? "Needs update"
                  : "Current"}
              </p>
              <p className="text-[11px] text-gray-500 mt-2">
                Handle needs-plan first, then stale.
              </p>
            </div>

            <div className="rounded-2xl border border-gray-200 bg-white p-4">
              <p className="text-xs text-gray-500">Quick templates</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {templates.slice(0, 3).map((t) => (
                  <Button
                    key={t.id}
                    variant="secondary"
                    className="px-3 py-2 text-xs"
                    onClick={() => onBuild(email, t.id)}
                  >
                    {t.name}
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                ))}
              </div>
              <p className="text-[11px] text-gray-500 mt-3">
                Opens builder pre-filled.
              </p>
            </div>

            <div className="rounded-2xl border border-gray-200 bg-white p-4">
              <p className="text-xs text-gray-500">Tags</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {tags.length ? (
                  tags.map((t) => <TagChip key={t} text={t} />)
                ) : (
                  <span className="text-[11px] text-gray-400">—</span>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* NEW: Today's Workouts Panel                                                */
/* -------------------------------------------------------------------------- */

function TodayWorkoutsPanel({ onOpenCalendar, isOrgSide }) {
  const [sport, setSport] = useState("Basketball");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [day, setDay] = useState({
    workouts: [],
    itemsByWorkoutId: {},
    completionByItemId: {},
  });

  const abortRef = useRef(null);
  const todayISO = useMemo(() => nyDateISO(), []);

  const fetchToday = useCallback(async () => {
    if (!isOrgSide) return;

    // Abort any in-flight request (prevents race + duplicates)
    try {
      abortRef.current?.abort?.();
    } catch {}
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setErr("");

    try {
      const res = await fetch(
        `/api/org/workouts/day?date=${encodeURIComponent(todayISO)}&sport=${encodeURIComponent(
          sport
        )}`,
        { method: "GET", credentials: "include", signal: controller.signal }
      );

      const data = await safeJson(res);
      if (!res.ok) throw new Error(data?.error || "Failed to load today's workouts");

      setDay({
        workouts: Array.isArray(data?.workouts) ? data.workouts : [],
        itemsByWorkoutId: data?.itemsByWorkoutId || {},
        completionByItemId: data?.completionByItemId || {},
      });
    } catch (e) {
      // Ignore abort errors
      const msg = String(e?.name || "").toLowerCase();
      if (msg.includes("abort")) return;

      setErr(e?.message || "Failed to load");
      setDay({ workouts: [], itemsByWorkoutId: {}, completionByItemId: {} });
    } finally {
      setLoading(false);
    }
  }, [isOrgSide, sport, todayISO]);

  // ✅ Fetch once on mount + whenever sport changes
  useEffect(() => {
    fetchToday();
    // Cleanup abort on unmount
    return () => {
      try {
        abortRef.current?.abort?.();
      } catch {}
    };
  }, [fetchToday]);

  const summary = useMemo(() => {
    const workouts = Array.isArray(day?.workouts) ? day.workouts : [];
    const itemsByWorkoutId = day?.itemsByWorkoutId || {};
    const completionByItemId = day?.completionByItemId || {};

    let workoutCount = workouts.length;
    let itemCount = 0;
    let completedCount = 0;
    let pendingReviewCount = 0;
    let rejectedCount = 0;
    let athleteSum = 0;

    workouts.forEach((w) => {
      athleteSum += Number(w?.athleteCount || 0);
      const wid = String(w?.id || "");
      const items = Array.isArray(itemsByWorkoutId?.[wid]) ? itemsByWorkoutId[wid] : [];
      itemCount += items.length;

      items.forEach((it) => {
        const itemId = String(it?.id || "");
        const completion = completionByItemId?.[itemId] || null;
        const status = String(completion?.Status || "").toLowerCase();

        if (!completion) return;
        if (status === "completed") completedCount += 1;
        else if (status === "pending_review") pendingReviewCount += 1;
        else rejectedCount += 1;
      });
    });

    const completionPct = itemCount > 0 ? Math.round((completedCount / itemCount) * 100) : 0;

    return {
      workoutCount,
      itemCount,
      athleteSum,
      completedCount,
      pendingReviewCount,
      rejectedCount,
      completionPct,
    };
  }, [day]);

  const list = useMemo(() => {
    const workouts = Array.isArray(day?.workouts) ? [...day.workouts] : [];
    workouts.sort((a, b) =>
      String(a?.Title || "").localeCompare(String(b?.Title || ""))
    );
    return workouts;
  }, [day]);

  const toneForStatus = (s) => {
    const status = String(s || "").toLowerCase();
    if (status.includes("complete")) return "good";
    if (status.includes("assign")) return "warn";
    return "neutral";
  };

  return (
    <section className="bg-white rounded-2xl shadow-md border border-blue-100 p-5 sm:p-6">
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <CalendarDays className="w-6 h-6 text-[#46769B]" />
            <h2 className="text-lg font-extrabold text-gray-900">Today’s Workouts</h2>
            <Pill>{todayISO}</Pill>
          </div>
          <p className="text-sm text-gray-600 mt-1">
            Quick ops view for <span className="font-semibold">{sport}</span>. Jump to the calendar to schedule/edit.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <Button
            variant="secondary"
            onClick={fetchToday}
            disabled={loading}
            className="w-full sm:w-auto"
          >
            <RefreshCcw className="w-4 h-4" />
            Refresh
          </Button>

          <Button onClick={onOpenCalendar} className="w-full sm:w-auto" title="Open workouts calendar">
            <ClipboardList className="w-4 h-4" />
            Open calendar
            <ArrowRight className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Sport toggle */}
      <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2">
        {["Basketball", "Football", "Baseball", "Soccer"].map((s) => {
          const active = s === sport;
          return (
            <button
              key={s}
              type="button"
              onClick={() => setSport(s)}
              className={classNames(
                "px-3 py-2 rounded-2xl border text-sm font-semibold transition",
                active
                  ? "bg-[#46769B] text-white border-[#46769B]"
                  : "bg-white text-gray-800 border-gray-200 hover:bg-gray-50"
              )}
            >
              {s}
            </button>
          );
        })}
      </div>

      {err ? (
        <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4">
          <p className="text-sm text-red-700 font-semibold">{err}</p>
          <p className="text-[11px] text-red-600 mt-1">
            If this endpoint still uses x-org-token headers, update the API to rely on the org cookie session.
          </p>
        </div>
      ) : null}

      {/* Summary cards */}
      <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
          <p className="text-xs text-gray-500">Workouts scheduled</p>
          <p className="text-2xl font-extrabold text-gray-900 mt-1">
            {loading ? "…" : summary.workoutCount}
          </p>
          <p className="text-[11px] text-gray-500 mt-2">For {sport} today</p>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
          <p className="text-xs text-gray-500">Total items</p>
          <p className="text-2xl font-extrabold text-gray-900 mt-1">
            {loading ? "…" : summary.itemCount}
          </p>
          <p className="text-[11px] text-gray-500 mt-2">
            <span className="font-semibold">{loading ? "…" : summary.athleteSum}</span> athlete assignments (sum)
          </p>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
          <p className="text-xs text-gray-500">Completed items</p>
          <p className="text-2xl font-extrabold text-gray-900 mt-1">
            {loading ? "…" : summary.completedCount}
          </p>
          <p className="text-[11px] text-gray-500 mt-2">
            {summary.itemCount > 0 ? `${summary.completionPct}% complete` : "No items yet"}
          </p>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
          <p className="text-xs text-gray-500">Pending review</p>
          <p className="text-2xl font-extrabold text-gray-900 mt-1">
            {loading ? "…" : summary.pendingReviewCount}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Pill tone={summary.pendingReviewCount > 0 ? "warn" : "good"}>
              {summary.pendingReviewCount > 0 ? "Coach review needed" : "All clear"}
            </Pill>
            {summary.rejectedCount > 0 ? <Pill tone="bad">{summary.rejectedCount} other</Pill> : null}
          </div>
        </div>
      </div>

      {/* Workouts list */}
      <div className="mt-5">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-extrabold text-gray-900">Today list</p>
          <button
            type="button"
            className="text-[11px] font-semibold text-[#46769B] hover:underline"
            onClick={onOpenCalendar}
          >
            View in calendar →
          </button>
        </div>

        {loading ? (
          <div className="mt-3 rounded-2xl border border-blue-100 bg-blue-50 p-4">
            <p className="text-sm text-gray-800 font-semibold">Loading today…</p>
          </div>
        ) : list.length === 0 ? (
          <div className="mt-3 rounded-2xl border border-gray-200 bg-gray-50 p-4">
            <p className="text-sm font-semibold text-gray-900">No workouts scheduled for today.</p>
            <p className="text-[11px] text-gray-500 mt-1">
              Click <span className="font-semibold">Open calendar</span> to add a workout.
            </p>
          </div>
        ) : (
          <div className="mt-3 grid grid-cols-1 lg:grid-cols-2 gap-3">
            {list.slice(0, 6).map((w) => {
              const wid = String(w?.id || "");
              const items = Array.isArray(day?.itemsByWorkoutId?.[wid])
                ? day.itemsByWorkoutId[wid]
                : [];
              return (
                <div key={wid} className="rounded-2xl border border-gray-200 bg-white p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-extrabold text-gray-900 truncate">
                        {w?.Title || "Workout"}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {w?.Status ? (
                          <Pill tone={toneForStatus(w.Status)}>{w.Status}</Pill>
                        ) : (
                          <Pill>assigned</Pill>
                        )}
                        <Pill>
                          <Dumbbell className="w-3.5 h-3.5 mr-1.5" />
                          {items.length} items
                        </Pill>
                        <Pill>
                          <Users className="w-3.5 h-3.5 mr-1.5" />
                          {w?.athleteCount ?? 0} athletes
                        </Pill>
                      </div>
                    </div>
                  </div>

                  {items.length ? (
                    <p className="mt-3 text-[11px] text-gray-500">
                      First item:{" "}
                      <span className="font-semibold text-gray-800">
                        {items[0]?.ExerciseName || items[0]?.ExceciseName || "—"}
                      </span>
                    </p>
                  ) : (
                    <p className="mt-3 text-[11px] text-gray-500">No items attached yet.</p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}

export default function OrgDashboard() {
  const router = useRouter();
  const { user, logout } = useAuthContext();

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

  const orgName = useMemo(() => {
    const guess =
      user?.OrgName ||
      user?.["Organization Name"] ||
      user?.OrganizationName ||
      user?.organizationName ||
      user?.Organization ||
      (role === "organization" ? (user?.Name || user?.name) : "") ||
      "Organization";
    return String(guess || "Organization");
  }, [user, role]);

  const orgEmail = useMemo(() => String(user?.Email || user?.email || ""), [user]);

  const orgToken = useMemo(() => {
    return String(user?.Token || user?.token || user?.["Organization Token"] || "").trim();
  }, [user]);

  const orgId = useMemo(() => {
    return String(user?.orgId || user?.OrgId || "").trim();
  }, [user]);

  const origin = useMemo(() => {
    if (typeof window === "undefined") return "";
    return window.location.origin;
  }, []);

  const inviteLink = useMemo(() => {
    if (!origin || !orgToken) return "";
    return `${origin}/signup?role=athlete&token=${encodeURIComponent(orgToken)}`;
  }, [origin, orgToken]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [stats, setStats] = useState({
    totalAthletes: 0,
    totalPlans: 0,
    athletesWithPlans: 0,
    coveragePct: 0,
    activeLast30: 0,
    staleCount: 0,
  });

  const [athletes, setAthletes] = useState([]);
  const [recentActivity, setRecentActivity] = useState([]);
  const [templates, setTemplates] = useState([]);

  const [search, setSearch] = useState("");
  const [filterMode, setFilterMode] = useState("all");
  const [sortMode, setSortMode] = useState("priority");
  const [expanded, setExpanded] = useState({});

  // ✅ One-time fetch guards (prevents triple/quad requests on hydration + rerenders)
  const didInitialLoadRef = useRef(false);
  const overviewAbortRef = useRef(null);
  const templatesAbortRef = useRef(null);

  const toggleExpanded = (email) => {
    const e = normalizeEmail(email);
    if (!e) return;
    setExpanded((prev) => ({ ...prev, [e]: !prev[e] }));
  };

  const [editOpen, setEditOpen] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [editErr, setEditErr] = useState("");
  const [editAthlete, setEditAthlete] = useState(null);

  const openEdit = (athlete) => {
    setEditErr("");
    setEditAthlete({
      email: normalizeEmail(athlete?.email),
      name: athlete?.name || "",
      status: athlete?.status || "Active",
      tags: Array.isArray(athlete?.tags) ? athlete.tags : [],
      notes: athlete?.notes || "",
    });
    setEditOpen(true);
  };

  const closeEdit = () => {
    setEditOpen(false);
    setEditErr("");
    setEditAthlete(null);
  };

  useEffect(() => {
    if (!user) {
      router.push("/");
      return;
    }
    if (role && !isOrgSide) {
      router.push("/dashboard");
      return;
    }
  }, [user, role, isOrgSide, router]);

  const refreshOverview = useCallback(async () => {
    // Abort in-flight
    try {
      overviewAbortRef.current?.abort?.();
    } catch {}
    const controller = new AbortController();
    overviewAbortRef.current = controller;

    setLoading(true);
    setError("");

    try {
      const res = await fetch(`/api/org/getOrgOverview`, {
        method: "GET",
        credentials: "include",
        signal: controller.signal,
      });

      const data = await safeJson(res);
      if (!res.ok) throw new Error(data?.error || "Failed to load org overview");

      setStats(data?.stats || {});
      setAthletes(Array.isArray(data?.athletes) ? data.athletes : []);
      setRecentActivity(Array.isArray(data?.recentActivity) ? data.recentActivity : []);
    } catch (err) {
      const name = String(err?.name || "").toLowerCase();
      if (name.includes("abort")) return;
      console.error("[org/dashboard] refreshOverview error:", err);
      setError(err?.message || "Failed to load organization overview.");
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshTemplates = useCallback(async () => {
    try {
      templatesAbortRef.current?.abort?.();
    } catch {}
    const controller = new AbortController();
    templatesAbortRef.current = controller;

    try {
      const res = await fetch(`/api/org/getPlanTemplates`, {
        method: "GET",
        credentials: "include",
        signal: controller.signal,
      });
      const data = await safeJson(res);
      if (!res.ok) return;
      setTemplates(Array.isArray(data?.templates) ? data.templates : []);
    } catch (err) {
      const name = String(err?.name || "").toLowerCase();
      if (name.includes("abort")) return;
    }
  }, []);

  // ✅ Single initial load (prevents duplicate fetches in dev + hydration churn)
  useEffect(() => {
    if (!user) return;
    if (!isOrgSide) return;

    if (didInitialLoadRef.current) return;
    didInitialLoadRef.current = true;

    refreshOverview();
    refreshTemplates();

    return () => {
      try {
        overviewAbortRef.current?.abort?.();
        templatesAbortRef.current?.abort?.();
      } catch {}
    };
  }, [user, isOrgSide, refreshOverview, refreshTemplates]);

  const counts = useMemo(() => {
    const list = Array.isArray(athletes) ? athletes : [];
    const needsPlan = list.filter((a) => !!a?.needsPlan).length;
    const stale = list.filter((a) => !!a?.stale && !a?.needsPlan).length;
    const current = list.filter((a) => !a?.stale && !a?.needsPlan).length;
    return { needsPlan, stale, current, total: list.length };
  }, [athletes]);

  const triageHeadline = useMemo(() => {
    if (!counts.total) return "No athletes yet — invite athletes to begin.";
    if (counts.needsPlan > 0)
      return `Start here: ${counts.needsPlan} athlete(s) need their first plan`;
    if (counts.stale > 0) return `Next: ${counts.stale} athlete(s) need an update`;
    return "All athletes are current — keep it up.";
  }, [counts]);

  const filteredAthletes = useMemo(() => {
    const q = String(search || "").trim().toLowerCase();
    let list = Array.isArray(athletes) ? [...athletes] : [];

    if (q) {
      list = list.filter((a) => {
        const name = String(a?.name || "").toLowerCase();
        const email = String(a?.email || "").toLowerCase();
        return name.includes(q) || email.includes(q);
      });
    }

    if (filterMode === "needsPlan") list = list.filter((a) => !!a?.needsPlan);
    if (filterMode === "stale") list = list.filter((a) => !!a?.stale && !a?.needsPlan);
    if (filterMode === "current") list = list.filter((a) => !a?.stale && !a?.needsPlan);

    const byLastPlanDesc = (a, b) => {
      const ad = safeDate(a?.lastPlanAt)?.getTime?.() || 0;
      const bd = safeDate(b?.lastPlanAt)?.getTime?.() || 0;
      return bd - ad;
    };

    const byNameAsc = (a, b) => {
      const an = String(a?.name || "").toLowerCase();
      const bn = String(b?.name || "").toLowerCase();
      return an.localeCompare(bn);
    };

    const byPriority = (a, b) => {
      const ap = a?.needsPlan ? 1 : 0;
      const bp = b?.needsPlan ? 1 : 0;
      if (bp !== ap) return bp - ap;

      const as = a?.stale ? 1 : 0;
      const bs = b?.stale ? 1 : 0;
      if (bs !== as) return bs - as;

      return byLastPlanDesc(a, b);
    };

    if (sortMode === "name") list.sort(byNameAsc);
    else if (sortMode === "lastPlan") list.sort(byLastPlanDesc);
    else list.sort(byPriority);

    return list;
  }, [athletes, search, filterMode, sortMode]);

  const goBuildPlan = (athleteEmail, templateId = "") => {
    const e = normalizeEmail(athleteEmail);
    const qs = new URLSearchParams();
    if (e) qs.set("athleteEmail", e);
    if (templateId) qs.set("template", templateId);
    router.push(`/org/prescriptions${qs.toString() ? `?${qs.toString()}` : ""}`);
  };

  const goHistory = (athleteEmail) => {
    const e = normalizeEmail(athleteEmail);
    if (!e) return;
    router.push(`/org/prescriptions?athleteEmail=${encodeURIComponent(e)}`);
  };

  const onLogout = async () => {
    try {
      await logout?.();
    } finally {
      router.push("/");
    }
  };

  const exportCSV = () => {
    const rows = [
      [
        "Athlete Name",
        "Athlete Email",
        "Status",
        "Tags",
        "Plans Count",
        "Last Plan At",
        "Last Plan Title",
        "Needs Plan",
        "Needs Update (Stale)",
      ],
    ];

    (Array.isArray(athletes) ? athletes : []).forEach((a) => {
      rows.push([
        a?.name || "",
        a?.email || "",
        a?.status || "",
        Array.isArray(a?.tags) ? a.tags.join(" | ") : "",
        a?.plansCount || 0,
        a?.lastPlanAt || "",
        a?.lastPlanTitle || "",
        a?.needsPlan ? "YES" : "NO",
        a?.stale ? "YES" : "NO",
      ]);
    });

    const csv = toCSV(rows);
    downloadTextFile(
      `org_roster_${String(orgName || "org").replace(/\s+/g, "_").toLowerCase()}.csv`,
      csv,
      "text/csv"
    );
  };

  const saveEdit = async () => {
    setEditErr("");
    if (!editAthlete?.email) {
      setEditErr("Missing athlete email.");
      return;
    }
    setEditSaving(true);

    try {
      const res = await fetch("/api/org/updateAthleteMeta", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          athleteEmail: editAthlete.email,
          status: editAthlete.status,
          tags: editAthlete.tags,
          notes: editAthlete.notes,
        }),
      });

      const data = await safeJson(res);
      if (!res.ok) throw new Error(data?.error || "Failed to update athlete");

      setAthletes((prev) => {
        const list = Array.isArray(prev) ? [...prev] : [];
        const idx = list.findIndex(
          (x) => normalizeEmail(x?.email) === normalizeEmail(editAthlete.email)
        );
        if (idx >= 0) {
          list[idx] = {
            ...list[idx],
            status: data?.athlete?.status || editAthlete.status,
            tags: data?.athlete?.tags || editAthlete.tags,
            notes: data?.athlete?.notes || editAthlete.notes,
          };
        }
        return list;
      });

      closeEdit();
    } catch (err) {
      setEditErr(err?.message || "Failed to save.");
    } finally {
      setEditSaving(false);
    }
  };

  const inputBase =
    "w-full px-4 py-3 rounded-xl border border-gray-300 bg-white text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#46769B]";

  const openWorkoutsCalendar = () => {
    router.push("/org/workouts-calendar");
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-blue-50 text-gray-900 font-sans">
      <main className="max-w-7xl mx-auto px-4 py-6 sm:py-8 space-y-6">
        {/* Header */}
        <div className="bg-white rounded-2xl shadow-md border border-blue-100 p-5 sm:p-6">
          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <LayoutDashboard className="w-6 h-6 text-[#46769B]" />
                <h1 className="text-2xl font-extrabold truncate">{orgName}</h1>
              </div>
              <p className="text-sm text-gray-600 mt-1 break-all">
                Logged in as <span className="font-semibold">{orgEmail}</span>
              </p>

              <div className="mt-3 flex flex-wrap gap-2">
                <Pill tone="good">
                  <ShieldCheck className="w-3.5 h-3.5 mr-1.5" />
                  Org Session Active
                </Pill>

                {orgToken ? (
                  <Pill tone="good">
                    <Sparkles className="w-3.5 h-3.5 mr-1.5" />
                    Token Loaded
                  </Pill>
                ) : (
                  <Pill tone="bad">
                    <AlertTriangle className="w-3.5 h-3.5 mr-1.5" />
                    Missing Token
                  </Pill>
                )}

                {orgId ? (
                  <Pill tone="good">
                    <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
                    orgId Loaded
                  </Pill>
                ) : (
                  <Pill tone="warn">
                    <AlertTriangle className="w-3.5 h-3.5 mr-1.5" />
                    orgId missing (legacy session)
                  </Pill>
                )}

                <Pill>
                  <ClipboardList className="w-3.5 h-3.5 mr-1.5" />
                  {triageHeadline}
                </Pill>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row flex-wrap gap-2 sm:justify-end">
              <Button
                variant="secondary"
                onClick={refreshOverview}
                disabled={loading}
                className="w-full sm:w-auto"
              >
                <RefreshCcw className="w-4 h-4" />
                Refresh
              </Button>

              <Button
                variant="secondary"
                onClick={openWorkoutsCalendar}
                className="w-full sm:w-auto"
                title="Open workouts calendar"
              >
                <CalendarDays className="w-4 h-4" />
                Workouts calendar
              </Button>

              <Button
                variant="secondary"
                onClick={exportCSV}
                disabled={!athletes?.length}
                className="w-full sm:w-auto"
              >
                <Download className="w-4 h-4" />
                Export CSV
              </Button>

              <Button variant="dark" onClick={onLogout} className="w-full sm:w-auto">
                <LogOut className="w-4 h-4" />
                Log out
              </Button>
            </div>
          </div>

          {loading ? (
            <div className="mt-5 rounded-2xl border border-blue-100 bg-blue-50 p-4">
              <p className="text-sm text-gray-800 font-semibold">
                Loading organization overview…
              </p>
              <p className="text-[11px] text-gray-600 mt-1">
                Pulling roster + plan status in one request.
              </p>
            </div>
          ) : null}

          {error ? (
            <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4">
              <p className="text-sm text-red-700 font-semibold">{error}</p>
              <p className="text-[11px] text-red-600 mt-1">
                If this persists, log out and back in to refresh your session cookie.
              </p>
            </div>
          ) : null}
        </div>

        {/* NEW: Today panel */}
        <TodayWorkoutsPanel onOpenCalendar={openWorkoutsCalendar} isOrgSide={isOrgSide} />

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard icon={Users} label="Athletes" value={stats.totalAthletes || 0} sub="Roster size" />
          <StatCard icon={FileText} label="Total Plans" value={stats.totalPlans || 0} sub="All-time plans created" />
          <StatCard
            icon={CheckCircle2}
            label="Coverage"
            value={`${stats.coveragePct || 0}%`}
            sub={`${stats.athletesWithPlans || 0} of ${stats.totalAthletes || 0} have at least 1 plan`}
          />
          <StatCard icon={Activity} label="Needs Attention" value={stats.staleCount || 0} sub="Missing plan or stale plan" />
        </div>

        {/* Templates + Invite */}
        <div className="grid lg:grid-cols-12 gap-6">
          <section className="lg:col-span-4 bg-white rounded-2xl shadow-md border border-blue-100 p-5 sm:p-6">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-lg font-extrabold">Templates</h2>
                <p className="text-sm text-gray-600 mt-1">
                  One click to preload a plan (then tweak).
                </p>
              </div>
              <Button
                variant="secondary"
                className="px-3 py-2 text-xs shrink-0"
                onClick={refreshTemplates}
              >
                <RefreshCcw className="w-4 h-4" />
                Refresh
              </Button>
            </div>

            <div className="mt-4 space-y-3">
              {templates.length === 0 ? (
                <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                  <p className="text-sm font-extrabold text-gray-900">No templates loaded</p>
                  <p className="text-[11px] text-gray-500 mt-1">
                    Make sure /api/org/getPlanTemplates is added.
                  </p>
                </div>
              ) : (
                templates.slice(0, 4).map((t) => (
                  <div key={t.id} className="rounded-2xl border border-gray-200 p-4">
                    <p className="text-sm font-extrabold text-gray-900 break-words">{t.name}</p>
                    <p className="text-[11px] text-gray-500 mt-1 break-words">{t.description}</p>
                    <div className="mt-3">
                      <Button
                        variant="secondary"
                        className="px-3 py-2 text-xs w-full sm:w-auto"
                        onClick={() => goBuildPlan("", t.id)}
                      >
                        Use template
                        <ArrowRight className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))
              )}
              <p className="text-[11px] text-gray-500">
                Pro move: from roster → “Build” can pass template too.
              </p>
            </div>
          </section>

          <section className="lg:col-span-8 bg-white rounded-2xl shadow-md border border-blue-100 p-5 sm:p-6">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
              <div className="min-w-0">
                <h2 className="text-lg font-extrabold">Invite Athletes</h2>
                <p className="text-sm text-gray-600 mt-1">
                  Token + link are always visible for coaching ops.
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-2 sm:justify-end">
                <CopyButton text={orgToken} label="Copy token" compact />
                <CopyButton text={inviteLink} label="Copy link" compact />
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                <p className="text-xs text-gray-500">Organization Token</p>
                <p className="font-mono text-sm font-semibold break-all mt-1">
                  {orgToken || "— missing Token on session user —"}
                </p>
              </div>

              <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs text-gray-500">Signup Link</p>
                  <LinkIcon className="w-4 h-4 text-gray-400" />
                </div>
                <p className="font-mono text-[12px] font-semibold break-all mt-1">
                  {inviteLink || "—"}
                </p>
              </div>
            </div>

            {!orgToken ? (
              <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4">
                <p className="text-sm font-semibold text-amber-900">
                  Token missing from session
                </p>
                <p className="text-[12px] text-amber-800 mt-1">
                  Invite links require the org token. Log out and back in to refresh your session cookie.
                  If you’re a trainer/admin, make sure lookupUser sets Token from the linked Organization record.
                </p>
              </div>
            ) : null}
          </section>
        </div>

        {/* Roster + Activity */}
        <div className="grid lg:grid-cols-12 gap-6">
          {/* Roster */}
          <section className="lg:col-span-8 bg-white rounded-2xl shadow-md border border-blue-100 p-5 sm:p-6">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
              <div className="min-w-0">
                <h2 className="text-lg font-extrabold">Roster</h2>
                <p className="text-sm text-gray-600 mt-1">
                  Status + tags make filtering & coaching workflow real.
                </p>

                <div className="mt-3 flex flex-wrap gap-2">
                  <Pill tone="bad">Needs plan: {counts.needsPlan}</Pill>
                  <Pill tone="warn">Needs update: {counts.stale}</Pill>
                  <Pill tone="good">Current: {counts.current}</Pill>
                </div>
              </div>

              <div className="w-full sm:w-[460px] space-y-2">
                <div className="relative">
                  <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    className={classNames(inputBase, "pl-10")}
                    placeholder="Search by name or email…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button
                    variant={filterMode === "all" ? "primary" : "secondary"}
                    className="px-3 py-2 text-xs"
                    onClick={() => setFilterMode("all")}
                  >
                    <Filter className="w-4 h-4" />
                    All
                  </Button>
                  <Button
                    variant={filterMode === "needsPlan" ? "primary" : "secondary"}
                    className="px-3 py-2 text-xs"
                    onClick={() => setFilterMode("needsPlan")}
                  >
                    Needs Plan
                  </Button>
                  <Button
                    variant={filterMode === "stale" ? "primary" : "secondary"}
                    className="px-3 py-2 text-xs"
                    onClick={() => setFilterMode("stale")}
                  >
                    Needs Update
                  </Button>
                  <Button
                    variant={filterMode === "current" ? "primary" : "secondary"}
                    className="px-3 py-2 text-xs"
                    onClick={() => setFilterMode("current")}
                  >
                    Current
                  </Button>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button
                    variant={sortMode === "priority" ? "primary" : "secondary"}
                    className="px-3 py-2 text-xs"
                    onClick={() => setSortMode("priority")}
                  >
                    Priority
                  </Button>
                  <Button
                    variant={sortMode === "lastPlan" ? "primary" : "secondary"}
                    className="px-3 py-2 text-xs"
                    onClick={() => setSortMode("lastPlan")}
                  >
                    Last Plan
                  </Button>
                  <Button
                    variant={sortMode === "name" ? "primary" : "secondary"}
                    className="px-3 py-2 text-xs"
                    onClick={() => setSortMode("name")}
                  >
                    Name
                  </Button>
                </div>
              </div>
            </div>

            {/* MOBILE: cards */}
            <div className="mt-5 space-y-3 lg:hidden">
              {filteredAthletes.length === 0 ? (
                <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4 text-center text-gray-500">
                  No athletes found.
                </div>
              ) : (
                filteredAthletes.map((a) => {
                  const email = normalizeEmail(a?.email);
                  const isExpanded = !!expanded[email];
                  return (
                    <AthleteCard
                      key={a.id || email}
                      athlete={a}
                      templates={templates}
                      isExpanded={isExpanded}
                      onToggle={toggleExpanded}
                      onEdit={openEdit}
                      onHistory={goHistory}
                      onBuild={goBuildPlan}
                      fmtDate={fmtDate}
                    />
                  );
                })
              )}
            </div>

            {/* DESKTOP: table */}
            <div className="mt-5 hidden lg:block overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-gray-500 border-b">
                    <th className="py-3 pr-4">Athlete</th>
                    <th className="py-3 pr-4">Email</th>
                    <th className="py-3 pr-4">Status</th>
                    <th className="py-3 pr-4">Tags</th>
                    <th className="py-3 pr-4">Plans</th>
                    <th className="py-3 pr-4">Last Plan</th>
                    <th className="py-3 pr-2 text-right">Actions</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredAthletes.length === 0 && (
                    <tr>
                      <td colSpan={7} className="py-6 text-center text-gray-500">
                        No athletes found.
                      </td>
                    </tr>
                  )}

                  {filteredAthletes.map((a) => {
                    const email = normalizeEmail(a?.email);
                    const isExpanded = !!expanded[email];

                    const status = String(a?.status || "Active");
                    const tags = Array.isArray(a?.tags) ? a.tags : [];

                    return (
                      <tr key={a.id || email} className="border-b">
                        <td className="py-3 pr-4">
                          <button
                            type="button"
                            onClick={() => toggleExpanded(email)}
                            className="text-left w-full"
                            title="Expand"
                          >
                            <div className="flex items-center gap-2">
                              {isExpanded ? (
                                <ChevronDown className="w-4 h-4 text-gray-400" />
                              ) : (
                                <ChevronRight className="w-4 h-4 text-gray-400" />
                              )}
                              <div className="min-w-0">
                                <div className="font-semibold text-gray-900 truncate">
                                  {a?.name || "Athlete"}
                                </div>
                                <div className="mt-1">
                                  <PlanChip needsPlan={!!a?.needsPlan} stale={!!a?.stale} />
                                </div>
                              </div>
                            </div>
                          </button>
                        </td>

                        <td className="py-3 pr-4">
                          <div className="text-gray-700 font-medium break-all">{email}</div>
                          {email ? (
                            <a
                              href={`mailto:${email}`}
                              className="inline-flex items-center gap-1 text-[11px] text-[#46769B] font-semibold hover:underline mt-1"
                            >
                              <Mail className="w-3.5 h-3.5" />
                              Email
                            </a>
                          ) : null}
                        </td>

                        <td className="py-3 pr-4">
                          <Pill>{status}</Pill>
                        </td>

                        <td className="py-3 pr-4">
                          <div className="flex flex-wrap gap-2">
                            {tags.length ? (
                              tags.slice(0, 3).map((t) => <TagChip key={t} text={t} />)
                            ) : (
                              <span className="text-[11px] text-gray-400">—</span>
                            )}
                          </div>
                        </td>

                        <td className="py-3 pr-4">
                          <Pill>{a?.plansCount || 0}</Pill>
                        </td>

                        <td className="py-3 pr-4">
                          <div className="text-gray-700 font-medium">
                            {a?.lastPlanAt ? fmtDate(a.lastPlanAt) : "—"}
                          </div>
                          {a?.lastPlanTitle ? (
                            <div className="text-[11px] text-gray-500 mt-0.5 truncate max-w-[240px]">
                              {a.lastPlanTitle}
                            </div>
                          ) : (
                            <div className="text-[11px] text-gray-400 mt-0.5">No plans yet</div>
                          )}
                        </td>

                        <td className="py-3 pr-2">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="secondary"
                              className="px-3 py-2 text-xs"
                              onClick={() => openEdit(a)}
                              disabled={!email}
                            >
                              <Pencil className="w-4 h-4" />
                              Edit
                            </Button>

                            <Button
                              variant="secondary"
                              className="px-3 py-2 text-xs"
                              onClick={() => goHistory(email)}
                              disabled={!email}
                            >
                              History
                            </Button>

                            <Button
                              className="px-3 py-2 text-xs"
                              onClick={() => goBuildPlan(email)}
                              disabled={!email}
                            >
                              Build
                              <ArrowRight className="w-4 h-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          {/* Activity */}
          <section className="lg:col-span-4 bg-white rounded-2xl shadow-md border border-blue-100 p-5 sm:p-6">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-lg font-extrabold">Recent Activity</h2>
                <p className="text-sm text-gray-600 mt-1">Latest plan events.</p>
              </div>
              <Button
                variant="secondary"
                className="px-3 py-2 text-xs shrink-0"
                onClick={refreshOverview}
                disabled={loading}
              >
                <RefreshCcw className="w-4 h-4" />
                Refresh
              </Button>
            </div>

            <div className="mt-4 space-y-3">
              {recentActivity.length === 0 ? (
                <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                  <p className="text-sm font-extrabold text-gray-900">No activity yet</p>
                  <p className="text-[11px] text-gray-500 mt-1">
                    Create a plan to start tracking actions here.
                  </p>
                </div>
              ) : (
                recentActivity.map((it, idx) => (
                  <div
                    key={`${it.athleteEmail}-${idx}`}
                    className="rounded-2xl border border-gray-200 p-4"
                  >
                    <p className="text-sm font-extrabold text-gray-900 break-words">
                      {it.title || "Plan"}
                    </p>
                    <p className="text-[12px] text-gray-700 mt-1 break-all">
                      <span className="font-semibold">{it.athleteEmail}</span>
                    </p>
                    <p className="text-[11px] text-gray-500 mt-2">
                      {it.createdAt ? `Created: ${fmtDate(it.createdAt)}` : "—"}
                      {it.createdBy ? ` • By: ${it.createdBy}` : ""}
                    </p>
                    <div className="mt-3">
                      <Button
                        variant="secondary"
                        className="px-3 py-2 text-xs w-full sm:w-auto"
                        onClick={() => goHistory(it.athleteEmail)}
                      >
                        View History
                        <ArrowRight className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>

        {/* Edit Modal */}
        <Modal
          open={editOpen}
          title={editAthlete ? `Edit: ${editAthlete.name || editAthlete.email}` : "Edit Athlete"}
          onClose={closeEdit}
        >
          {editErr ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-3 mb-4">
              <p className="text-sm text-red-700 font-semibold">{editErr}</p>
            </div>
          ) : null}

          <div className="space-y-4">
            <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
              <p className="text-xs text-gray-500">Athlete</p>
              <p className="text-sm font-extrabold text-gray-900 mt-1 break-words">
                {editAthlete?.name || "Athlete"}
              </p>
              <p className="text-[12px] text-gray-600 mt-1 break-all">
                {editAthlete?.email || ""}
              </p>
            </div>

            <div>
              <label className="text-xs text-gray-600 font-semibold">Status</label>
              <select
                className="mt-2 w-full px-4 py-3 rounded-xl border border-gray-300 bg-white text-sm"
                value={editAthlete?.status || "Active"}
                onChange={(e) =>
                  setEditAthlete((prev) => ({ ...prev, status: e.target.value }))
                }
              >
                <option value="Active">Active</option>
                <option value="Injured">Injured</option>
                <option value="Offseason">Offseason</option>
                <option value="Inactive">Inactive</option>
              </select>
              <p className="text-[11px] text-gray-500 mt-2">
                This becomes a filter later (and can trigger reminders).
              </p>
            </div>

            <div>
              <label className="text-xs text-gray-600 font-semibold">Tags</label>
              <input
                className={classNames(inputBase, "mt-2")}
                placeholder="Comma separated tags (e.g. Cut, High Sweat, Two-a-days)"
                value={(editAthlete?.tags || []).join(", ")}
                onChange={(e) => {
                  const raw = e.target.value;
                  const parts = raw
                    .split(",")
                    .map((x) => x.trim())
                    .filter(Boolean);
                  setEditAthlete((prev) => ({ ...prev, tags: parts }));
                }}
              />
              <p className="text-[11px] text-gray-500 mt-2">
                Stored as Airtable multi-select (Tags).
              </p>
            </div>

            <div>
              <label className="text-xs text-gray-600 font-semibold">Notes (optional)</label>
              <textarea
                className="mt-2 w-full min-h-[90px] px-4 py-3 rounded-xl border border-gray-300 bg-white text-sm"
                placeholder="Anything the coach should remember..."
                value={editAthlete?.notes || ""}
                onChange={(e) =>
                  setEditAthlete((prev) => ({ ...prev, notes: e.target.value }))
                }
              />
            </div>

            <div className="flex flex-col sm:flex-row justify-end gap-2 pt-2">
              <Button variant="secondary" onClick={closeEdit} className="w-full sm:w-auto">
                Cancel
              </Button>
              <Button onClick={saveEdit} disabled={editSaving} className="w-full sm:w-auto">
                {editSaving ? "Saving..." : "Save"}
                <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </Modal>
      </main>
    </div>
  );
}
