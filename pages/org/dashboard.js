// pages/org/dashboard.js
// Coach "Today" page: the first screen after sign-in.
// New programs see a getting-started checklist driven by real data (it disappears once the program
// is set up); every program sees what needs attention today and how today's sessions are going.
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import {
  Check, Copy, Users, CalendarRange, Dumbbell, UserPlus, ClipboardCheck, MessageSquare,
  ChevronRight, Plus, RefreshCw, HeartPulse,
} from "lucide-react";
import { useAuthContext } from "@/hooks/useAuth";
import { PageHeader, APP } from "@/components/app/ui";
import { refreshNavCounts, useNavCounts } from "@/components/nav/menu";
import { useBillingGate }   from "@/hooks/org/useBillingGate";
import BillingGateScreen    from "@/components/org/reviewQueue/BillingGateScreen";
import BillingLoadingScreen from "@/components/org/reviewQueue/BillingLoadingScreen";

const OK = "#15803D";
const WARN = "#B45309";

function localISO(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

function formatTime(t) {
  if (!t) return "Any time";
  const [h, m] = t.split(":").map(Number);
  const suffix = h >= 12 ? "PM" : "AM";
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${suffix}`;
}

const STYLE = `
  .td-wrap { max-width: 1120px; margin: 0 auto; padding: 20px 16px 48px; display: grid; gap: 20px; }
  @media (min-width: 700px) { .td-wrap { padding: 24px 28px 56px; } }
  .td-cols { display: grid; gap: 20px; }
  @media (min-width: 1000px) { .td-cols { grid-template-columns: minmax(0, 1fr) 340px; align-items: start; } }
  .td-card { background: ${APP.surface}; border: 1px solid ${APP.line}; border-radius: 12px; }
  .td-card-h { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 16px 18px 0; }
  .td-card-t { margin: 0; font-size: 15px; font-weight: 700; color: ${APP.ink}; letter-spacing: -0.005em; }
  .td-card-s { margin: 2px 0 0; font-size: 13px; color: ${APP.muted}; }
  .td-link { font-size: 13px; font-weight: 600; color: ${APP.brand}; text-decoration: none; display: inline-flex; align-items: center; gap: 2px; white-space: nowrap; }
  .td-link:hover { text-decoration: underline; }

  .td-stats { display: grid; gap: 12px; grid-template-columns: repeat(3, minmax(0, 1fr)); }
  @media (max-width: 640px) { .td-stats { grid-template-columns: 1fr; } }
  .td-stat { display: block; padding: 16px 18px; text-decoration: none; color: inherit; transition: border-color .12s, box-shadow .12s; }
  .td-stat:hover { border-color: #CBD5E1; box-shadow: 0 2px 8px rgba(15,23,42,0.06); }
  .td-stat:focus-visible { outline: 2px solid ${APP.brand}; outline-offset: 2px; }
  .td-stat-top { display: flex; align-items: center; justify-content: space-between; color: ${APP.muted}; font-size: 13px; font-weight: 600; }
  .td-stat-n { margin-top: 10px; font-size: 30px; line-height: 1; font-weight: 750; color: ${APP.ink}; font-variant-numeric: tabular-nums; letter-spacing: -0.02em; }
  .td-stat-n small { font-size: 16px; font-weight: 600; color: ${APP.faint}; }
  .td-stat-foot { margin-top: 8px; font-size: 13px; color: ${APP.muted}; }
  .td-bar { height: 6px; border-radius: 3px; background: ${APP.lineSoft}; overflow: hidden; margin-top: 12px; }
  .td-bar > span { display: block; height: 100%; border-radius: 3px; background: ${APP.brand}; transition: width .3s; }

  .td-steps { list-style: none; margin: 0; padding: 8px 0 6px; }
  .td-step { display: grid; grid-template-columns: 28px minmax(0,1fr) auto; gap: 12px; align-items: center; padding: 12px 18px; }
  .td-step + .td-step { border-top: 1px solid ${APP.lineSoft}; }
  .td-dot { width: 26px; height: 26px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center;
    border: 1.5px solid #CBD5E1; color: ${APP.muted}; font-size: 12px; font-weight: 700; }
  .td-step.is-done .td-dot { background: ${OK}; border-color: ${OK}; color: #fff; }
  .td-step-t { font-size: 14px; font-weight: 650; color: ${APP.ink}; }
  .td-step.is-done .td-step-t { color: ${APP.muted}; }
  .td-step-d { font-size: 13px; color: ${APP.muted}; margin-top: 2px; line-height: 1.45; }
  .td-step-btn { display: inline-flex; align-items: center; gap: 6px; height: 34px; padding: 0 12px; border-radius: 8px;
    font-size: 13px; font-weight: 600; text-decoration: none; white-space: nowrap; border: 1px solid ${APP.line}; color: ${APP.ink}; background: #fff; }
  .td-step-btn:hover { background: #F8FAFC; border-color: #D5DAE1; }
  .td-step-btn.is-next { background: ${APP.brand}; border-color: ${APP.brand}; color: #fff; }
  .td-step-btn.is-next:hover { background: ${APP.brandHover}; }
  .td-step-btn:focus-visible, .td-copy:focus-visible { outline: 2px solid ${APP.brand}; outline-offset: 2px; }
  @media (max-width: 560px) { .td-step { grid-template-columns: 28px minmax(0,1fr); } .td-step-btn { grid-column: 2; justify-self: start; } }

  .td-progress { display: flex; align-items: center; gap: 10px; font-size: 13px; color: ${APP.muted}; font-variant-numeric: tabular-nums; }
  .td-progress .td-bar { width: 96px; margin: 0; }

  .td-code { display: flex; align-items: center; gap: 10px; padding: 12px 14px; border-radius: 10px; background: ${APP.canvas}; border: 1px dashed #CBD5E1; }
  .td-code-v { flex: 1; min-width: 0; font: 700 17px/1.2 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; letter-spacing: 0.04em; color: ${APP.ink}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .td-copy { display: inline-flex; align-items: center; gap: 6px; height: 32px; padding: 0 10px; border-radius: 7px; border: 1px solid ${APP.line};
    background: #fff; font-size: 13px; font-weight: 600; color: ${APP.ink}; cursor: pointer; }
  .td-copy:hover { background: #F8FAFC; }

  .td-sess { list-style: none; margin: 0; padding: 6px 0; }
  .td-sess li { display: grid; grid-template-columns: 76px minmax(0,1fr) 120px; gap: 14px; align-items: center; padding: 12px 18px; }
  .td-sess li + li { border-top: 1px solid ${APP.lineSoft}; }
  @media (max-width: 560px) { .td-sess li { grid-template-columns: minmax(0,1fr) 96px; } .td-sess-time { grid-column: 1 / -1; } }
  .td-sess-time { font-size: 13px; font-weight: 650; color: ${APP.text}; font-variant-numeric: tabular-nums; }
  .td-sess-t { font-size: 14px; font-weight: 650; color: ${APP.ink}; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .td-sess-m { font-size: 12.5px; color: ${APP.muted}; margin-top: 2px; }
  .td-sess-p { font-size: 12.5px; color: ${APP.muted}; text-align: right; font-variant-numeric: tabular-nums; }
  .td-sess-p .td-bar { margin-top: 6px; }
  .td-pill { display: inline-flex; align-items: center; height: 20px; padding: 0 7px; border-radius: 10px; font-size: 11.5px; font-weight: 700; }

  .td-empty { padding: 28px 18px 24px; text-align: center; color: ${APP.muted}; font-size: 14px; }
  .td-empty strong { display: block; color: ${APP.ink}; font-size: 15px; margin-bottom: 4px; }
  .td-skel { height: 14px; border-radius: 6px; background: linear-gradient(90deg, ${APP.lineSoft}, #E9EDF2, ${APP.lineSoft}); background-size: 200% 100%; animation: td-sh 1.2s infinite; }
  @keyframes td-sh { to { background-position: -200% 0; } }
  @media (prefers-reduced-motion: reduce) { .td-skel { animation: none; } .td-bar > span { transition: none; } }
  .td-err { padding: 12px 14px; border-radius: 10px; background: ${APP.dangerTint}; color: ${APP.danger}; font-size: 14px; border: 1px solid #FECACA; }
`;

function TeamCode({ code, compact = false }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try { await navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch { /* clipboard blocked */ }
  };
  return (
    <div className="td-code" style={compact ? { marginTop: 10 } : undefined}>
      <span className="td-code-v">{code || "—"}</span>
      <button type="button" className="td-copy" onClick={copy} disabled={!code} aria-live="polite">
        {copied ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}

function Stat({ href, icon: Icon, label, value, total, foot, tone }) {
  const pct = total ? Math.round((value / total) * 100) : null;
  return (
    <Link href={href} className="td-card td-stat">
      <div className="td-stat-top">
        <span>{label}</span>
        <Icon size={16} aria-hidden="true" style={{ color: tone || APP.faint }} />
      </div>
      <div className="td-stat-n">
        {value}{total != null && <small> / {total}</small>}
      </div>
      {pct != null && <div className="td-bar" aria-hidden="true"><span style={{ width: `${pct}%` }} /></div>}
      <div className="td-stat-foot">{foot}</div>
    </Link>
  );
}

function SetupChecklist({ data, isOwnerish }) {
  const s = data.setup;
  const steps = [
    {
      key: "athletes", icon: Users, done: s.athletes > 0,
      title: "Get your athletes on the team",
      desc: s.athletes > 0
        ? `${s.athletes} athlete${s.athletes === 1 ? "" : "s"} joined.`
        : "Athletes download the CheckPeak app and enter your team code below.",
      href: "/org/athletes", cta: "View roster",
    },
    {
      key: "season", icon: CalendarRange, done: s.seasonSet,
      title: "Set your season dates",
      desc: "Mark preseason, in-season and off-season so countable hours are tracked against the right limits.",
      href: "/org/workouts-calendar?setup=season", cta: "Set dates",
    },
    {
      key: "workout", icon: Dumbbell, done: s.workouts > 0,
      title: "Assign your first workout",
      desc: "Pick a day, add exercises and choose whether athletes need photo or video proof.",
      href: "/org/workouts-calendar?setup=workout", cta: "Create workout",
    },
    isOwnerish && {
      key: "staff", icon: UserPlus, done: s.staff > 0,
      title: "Invite your staff",
      desc: "Assistant coaches and trainers get their own sign-in and see the same roster.",
      href: "/org/trainers?invite=1", cta: "Invite staff",
    },
  ].filter(Boolean);
  const doneCount = steps.filter((x) => x.done).length;
  const nextKey = steps.find((x) => !x.done)?.key;

  return (
    <section className="td-card" aria-labelledby="td-setup-h">
      <div className="td-card-h">
        <div>
          <h2 id="td-setup-h" className="td-card-t">Get {data.org.name} running</h2>
          <p className="td-card-s">Most programs finish this in about 10 minutes.</p>
        </div>
        <div className="td-progress" aria-label={`${doneCount} of ${steps.length} steps done`}>
          <div className="td-bar" aria-hidden="true"><span style={{ width: `${(doneCount / steps.length) * 100}%`, background: OK }} /></div>
          {doneCount}/{steps.length}
        </div>
      </div>
      <ol className="td-steps">
        {steps.map((step, i) => (
          <li key={step.key} className={`td-step${step.done ? " is-done" : ""}`}>
            <span className="td-dot" aria-hidden="true">{step.done ? <Check size={14} strokeWidth={3} /> : i + 1}</span>
            <div style={{ minWidth: 0 }}>
              <div className="td-step-t">
                {step.title}
                <span className="sr-only">{step.done ? " (done)" : " (to do)"}</span>
              </div>
              <div className="td-step-d">{step.desc}</div>
              {step.key === "athletes" && !step.done && <TeamCode code={data.org.token} compact />}
            </div>
            {!step.done && (
              <Link href={step.href} className={`td-step-btn${step.key === nextKey ? " is-next" : ""}`}>
                {step.cta} <ChevronRight size={14} aria-hidden="true" />
              </Link>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}

function Sessions({ today, loading }) {
  const sessions = today?.sessions ?? [];
  return (
    <section className="td-card" aria-labelledby="td-sess-h">
      <div className="td-card-h">
        <div>
          <h2 id="td-sess-h" className="td-card-t">Today's sessions</h2>
          {!loading && sessions.length > 0 && (
            <p className="td-card-s">{sessions.length} session{sessions.length === 1 ? "" : "s"} on the schedule</p>
          )}
        </div>
        <Link href="/org/workouts-calendar" className="td-link">Schedule <ChevronRight size={14} aria-hidden="true" /></Link>
      </div>
      {loading ? (
        <div style={{ padding: 18, display: "grid", gap: 12 }}>
          <div className="td-skel" style={{ width: "70%" }} /><div className="td-skel" style={{ width: "55%" }} /><div className="td-skel" style={{ width: "62%" }} />
        </div>
      ) : sessions.length === 0 ? (
        <div className="td-empty">
          <strong>Nothing scheduled today</strong>
          Plan a lift, conditioning or recovery session and your athletes will see it in the app.
          <div style={{ marginTop: 14 }}>
            <Link href="/org/workouts-calendar?setup=workout" className="td-step-btn is-next"><Plus size={14} aria-hidden="true" /> Create workout</Link>
          </div>
        </div>
      ) : (
        <ul className="td-sess">
          {sessions.map((s) => {
            const pct = s.assigned ? Math.round((s.done / s.assigned) * 100) : 0;
            return (
              <li key={`${s.title}|${s.time}`}>
                <span className="td-sess-time">{formatTime(s.time)}</span>
                <div style={{ minWidth: 0 }}>
                  <div className="td-sess-t" title={s.title}>{s.title}</div>
                  <div className="td-sess-m">
                    {s.assigned} athlete{s.assigned === 1 ? "" : "s"}
                    {s.sports.length > 0 && ` · ${s.sports.slice(0, 2).join(", ")}${s.sports.length > 2 ? ` +${s.sports.length - 2}` : ""}`}
                    {s.duration ? ` · ${s.duration} min` : ""}
                    {s.review > 0 && (
                      <> · <span className="td-pill" style={{ background: "#FFFBEB", color: WARN }}>{s.review} to review</span></>
                    )}
                  </div>
                </div>
                <div className="td-sess-p">
                  {s.done}/{s.assigned} done
                  <div className="td-bar" aria-hidden="true"><span style={{ width: `${pct}%`, background: pct === 100 ? OK : APP.brand }} /></div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function CheckIns({ readiness }) {
  if (!readiness) return null;
  const { summary, athletes } = readiness;
  const flagged = athletes.filter((a) => a.flags?.length).slice(0, 5);
  return (
    <section className="td-card" aria-labelledby="td-ready-h">
      <div className="td-card-h">
        <div>
          <h2 id="td-ready-h" className="td-card-t">Morning check-ins</h2>
          <p className="td-card-s">
            {summary.checkedIn} of {summary.rosterSize} checked in
            {summary.avgScore != null && ` · average ${summary.avgScore}`}
          </p>
        </div>
        <HeartPulse size={16} aria-hidden="true" style={{ color: APP.faint }} />
      </div>
      {flagged.length === 0 ? (
        <p className="td-card-s" style={{ padding: "10px 18px 16px" }}>
          {summary.checkedIn ? "No one flagged pain, poor sleep or high soreness." : "No check-ins yet today."}
        </p>
      ) : (
        <ul className="td-sess" aria-label="Athletes to check on">
          {flagged.map((a) => (
            <li key={a.athleteToken} style={{ gridTemplateColumns: "minmax(0,1fr) auto" }}>
              <div style={{ minWidth: 0 }}>
                <div className="td-sess-t">{a.name || "Athlete"}</div>
                <div className="td-sess-m">{a.flags.join(" · ")}{a.painNote ? ` · "${a.painNote}"` : ""}</div>
              </div>
              <span className="td-pill" style={{ background: APP.dangerTint, color: APP.danger }}>{a.score ?? "—"}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default function OrgToday() {
  const router = useRouter();
  const { user, logout } = useAuthContext();
  const role = String(user?.role || user?.Role || "").toLowerCase();
  const isOrgSide = /org|admin|train|coach/.test(role);
  const isOwnerish = role.includes("org") || role.includes("admin");
  const firstName = String(user?.name || user?.Name || "").trim().split(/\s+/)[0];

  const { billingLoading, billingErr, billing, isPaidOk } = useBillingGate({ user, role, isOrgSide });
  const counts = useNavCounts(isOrgSide);

  const [data, setData] = useState(null);
  const [readiness, setReadiness] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const date = useMemo(() => localISO(), []);
  const longDate = useMemo(() => new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" }), []);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [todayRes, readyRes] = await Promise.all([
        fetch(`/api/org/today?date=${date}`, { credentials: "include" }),
        fetch(`/api/org/readiness?date=${date}`, { credentials: "include" }).catch(() => null),
        refreshNavCounts({ fresh: true }),
      ]);
      if (todayRes.status === 401) { router.replace("/"); return; }
      const json = await todayRes.json();
      if (!todayRes.ok) throw new Error(json?.error || "Could not load today's overview.");
      setData(json);
      // Check-ins are optional: the card only shows when the readiness feature is set up
      const ready = readyRes?.ok ? await readyRes.json().catch(() => null) : null;
      setReadiness(ready?.ok ? ready : null);
    } catch (e) {
      setError(e.message || "Could not load today's overview.");
    } finally {
      setLoading(false);
    }
  }, [date, router]);

  useEffect(() => { if (isOrgSide) load(); }, [isOrgSide, load]);

  const onLogout = useCallback(async () => {
    try { await logout?.(); } finally { router.push("/"); }
  }, [logout, router]);

  if (billingLoading) return <BillingLoadingScreen />;
  if (billingErr || !isPaidOk) {
    return <BillingGateScreen role={role} billing={billing} error={billingErr} onLogout={onLogout} onGoAccount={() => router.push("/account")} />;
  }

  const setup = data?.setup;
  const setupDone = setup && setup.athletes > 0 && setup.seasonSet && setup.workouts > 0 && (!isOwnerish || setup.staff > 0);
  const totals = data?.today?.totals ?? { assigned: 0, done: 0 };

  return (
    <div style={{ minHeight: "100vh", background: APP.canvas, fontFamily: APP.font, color: APP.text }}>
      <Head><title>Today | CheckPeak</title></Head>
      <style>{STYLE}</style>

      <PageHeader
        title={firstName ? `${greeting()}, ${firstName}` : "Today"}
        subtitle={data ? `${longDate} · ${data.org.name}` : longDate}
        primaryAction={{ label: "New workout", icon: Plus, onClick: () => router.push("/org/workouts-calendar?setup=workout") }}
        secondaryActions={[{ label: "Refresh", icon: RefreshCw, onClick: load }]}
      />

      <div className="td-wrap">
        {error && <div className="td-err" role="alert">{error} <button type="button" className="td-copy" style={{ marginLeft: 8 }} onClick={load}>Try again</button></div>}

        {data && !setupDone && <SetupChecklist data={data} isOwnerish={isOwnerish} />}

        <div className="td-stats">
          <Stat href="/org/review-queue" icon={ClipboardCheck} label="Waiting for review" value={counts.reviewQueue || 0}
            tone={counts.reviewQueue ? WARN : undefined}
            foot={counts.reviewQueue ? "Proof submitted by athletes" : "You're all caught up"} />
          <Stat href="/org/messaging" icon={MessageSquare} label="Unread conversations" value={counts.messages || 0}
            tone={counts.messages ? APP.brand : undefined}
            foot={counts.messages ? "Athletes and staff waiting on you" : "No unread messages"} />
          <Stat href="/org/workouts-calendar" icon={Dumbbell} label="Workouts done today" value={totals.done}
            total={totals.assigned} tone={totals.assigned && totals.done === totals.assigned ? OK : undefined}
            foot={totals.assigned ? `${totals.assigned - totals.done} still to go` : "Nothing assigned today"} />
        </div>

        <div className="td-cols">
          <div style={{ display: "grid", gap: 20, minWidth: 0 }}>
            <Sessions today={data?.today} loading={loading && !data} />
            <CheckIns readiness={readiness} />
          </div>

          <aside style={{ display: "grid", gap: 20 }}>
            {data && (setupDone || setup.athletes > 0) && (
              <section className="td-card" aria-labelledby="td-code-h" style={{ paddingBottom: 16 }}>
                <div className="td-card-h">
                  <div>
                    <h2 id="td-code-h" className="td-card-t">Team code</h2>
                    <p className="td-card-s">New athletes enter this in the CheckPeak app to join.</p>
                  </div>
                </div>
                <div style={{ padding: "0 18px" }}><TeamCode code={data.org.token} compact /></div>
              </section>
            )}
            {data && (
              <section className="td-card" aria-labelledby="td-prog-h" style={{ paddingBottom: 14 }}>
                <div className="td-card-h">
                  <h2 id="td-prog-h" className="td-card-t">Program</h2>
                </div>
                <dl style={{ margin: 0, padding: "10px 18px 0", display: "grid", gap: 10, fontSize: 14 }}>
                  {[
                    ["Athletes", data.setup.athletes, "/org/athletes"],
                    ["Staff", data.setup.staff + 1, isOwnerish ? "/org/trainers" : null],
                    ["Season dates", data.setup.seasonSet ? "Set" : "Not set", "/org/workouts-calendar?setup=season"],
                  ].map(([k, v, href]) => (
                    <div key={k} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                      <dt style={{ color: APP.muted }}>{k}</dt>
                      <dd style={{ margin: 0, fontWeight: 650, color: v === "Not set" ? WARN : APP.ink, fontVariantNumeric: "tabular-nums" }}>
                        {href ? <Link href={href} style={{ color: "inherit", textDecoration: "none" }}>{v}</Link> : v}
                      </dd>
                    </div>
                  ))}
                </dl>
              </section>
            )}
          </aside>
        </div>
      </div>
    </div>
  );
}
