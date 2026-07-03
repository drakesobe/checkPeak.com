"use client";
// pages/parent/[token].jsx
// Parent Portal — read-only view of an athlete's progress.
// Accessible via share_token (same token used for recruiting profile).
// VARA-safe: no coach-assigned content shown; only athlete-generated stats.

import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import Head from "next/head";
import Link from "next/link";
import { Lock, TrendingUp, TrendingDown } from "lucide-react";

/* ── Design tokens ─────────────────────────────────────────────────────────── */
const C = {
  bg:     "#060810",
  card:   "#0B1120",
  raised: "#101928",
  border: "#1C2840",
  accent: "#4FABFF",
  green:  "#22C55E",
  amber:  "#F59E0B",
  red:    "#EF4444",
  white:  "#FFFFFF",
  dim:    "rgba(255,255,255,0.45)",
  muted:  "rgba(255,255,255,0.25)",
  ghost:  "rgba(255,255,255,0.12)",
  faint:  "rgba(255,255,255,0.05)",
  font:   "'Barlow', sans-serif",
  cond:   "'Barlow Condensed', sans-serif",
};

/* ── Utilities ─────────────────────────────────────────────────────────────── */
function fmtDate(iso) {
  if (!iso) return "";
  const [, m, d] = iso.split("-");
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${months[parseInt(m, 10) - 1]} ${parseInt(d, 10)}`;
}

function nextMilestone(count) {
  const milestones = [7, 14, 21, 30, 60, 100];
  return milestones.find(m => m > count) ?? 100;
}

function streakColor(count) {
  if (count >= 21) return C.accent;
  if (count >= 7)  return C.green;
  if (count >= 1)  return C.amber;
  return C.dim;
}

/* ── Streak Hero ───────────────────────────────────────────────────────────── */
function StreakHero({ streak }) {
  const { count, startDate } = streak;
  const color     = streakColor(count);
  const milestone = nextMilestone(count);
  const progress  = count > 0 ? Math.min((count / milestone) * 100, 100) : 0;

  if (count === 0) {
    return (
      <div style={{
        padding: "20px 18px",
        background: C.card,
        borderRadius: 14,
        border: `1px solid ${C.border}`,
        marginBottom: 8,
        textAlign: "center",
      }}>
        <p style={{ fontFamily: C.cond, fontSize: 9, fontWeight: 900, letterSpacing: "0.18em",
          textTransform: "uppercase", color: C.muted, marginBottom: 8 }}>
          Current Streak
        </p>
        <p style={{ fontFamily: C.cond, fontSize: 48, fontWeight: 900, fontStyle: "italic",
          letterSpacing: "-0.04em", color: C.dim, lineHeight: 1, marginBottom: 4 }}>
          0
        </p>
        <p style={{ fontFamily: C.font, fontSize: 12, color: C.muted }}>
          No active streak — first workout starts one
        </p>
      </div>
    );
  }

  return (
    <div style={{
      padding: "20px 18px",
      background: C.card,
      borderRadius: 14,
      border: `1px solid ${C.border}`,
      marginBottom: 8,
      position: "relative",
      overflow: "hidden",
    }}>
      {/* Glow behind the card based on streak tier */}
      <div aria-hidden style={{
        position: "absolute", top: 0, left: "50%", transform: "translateX(-50%)",
        width: "120%", height: "60%",
        background: `radial-gradient(ellipse at 50% 0%, ${color}18 0%, transparent 70%)`,
        pointerEvents: "none",
      }} />

      <p style={{ fontFamily: C.cond, fontSize: 9, fontWeight: 900, letterSpacing: "0.18em",
        textTransform: "uppercase", color: C.muted, marginBottom: 12, position: "relative" }}>
        Current Streak
      </p>

      <div style={{ display: "flex", alignItems: "flex-end", gap: 8, marginBottom: 14, position: "relative" }}>
        <span style={{ fontFamily: C.cond, fontSize: 72, fontWeight: 900, fontStyle: "italic",
          letterSpacing: "-0.04em", color, lineHeight: 1 }}>{count}</span>
        <span style={{ fontFamily: C.cond, fontSize: 16, fontWeight: 800, letterSpacing: "0.06em",
          textTransform: "uppercase", color, paddingBottom: 10 }}>day streak</span>
      </div>

      {/* Progress bar toward milestone */}
      <div style={{ position: "relative", marginBottom: 8 }}>
        <div style={{ height: 4, background: C.ghost, borderRadius: 2, overflow: "hidden" }}>
          <div style={{
            height: "100%", borderRadius: 2,
            width: `${progress}%`,
            background: `linear-gradient(90deg, ${color}99, ${color})`,
            transition: "width 0.6s ease",
          }} />
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 5 }}>
          <span style={{ fontFamily: C.font, fontSize: 10, color: C.muted }}>
            {startDate ? `Since ${fmtDate(startDate)}` : "Active"}
          </span>
          <span style={{ fontFamily: C.cond, fontSize: 10, fontWeight: 700, color: C.muted }}>
            {count} / {milestone} days
          </span>
        </div>
      </div>
    </div>
  );
}

/* ── Week Progress ─────────────────────────────────────────────────────────── */
function WeekProgress({ week }) {
  const dayLabels  = ["M", "T", "W", "T", "F", "S", "S"];
  const daysWithData = week.days.filter(d => !d.isFuture).length;

  return (
    <div style={{
      padding: "16px 18px",
      background: C.card,
      borderRadius: 14,
      border: `1px solid ${C.border}`,
      marginBottom: 24,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <p style={{ fontFamily: C.cond, fontSize: 9, fontWeight: 900, letterSpacing: "0.18em",
          textTransform: "uppercase", color: C.muted }}>
          This Week
        </p>
        <p style={{ fontFamily: C.cond, fontSize: 11, fontWeight: 700, color: C.dim }}>
          {week.done} of {daysWithData} day{daysWithData !== 1 ? "s" : ""}
        </p>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        {week.days.map((day, i) => (
          <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 5 }}>
            <div style={{
              width: 30, height: 30, borderRadius: "50%",
              background: day.done
                ? "rgba(34,197,94,0.15)"
                : day.isToday
                ? "rgba(79,171,255,0.08)"
                : C.faint,
              border: day.done
                ? `1.5px solid rgba(34,197,94,0.55)`
                : day.isToday
                ? `1.5px solid rgba(79,171,255,0.4)`
                : `1px solid ${C.ghost}`,
              display: "flex", alignItems: "center", justifyContent: "center",
              flexShrink: 0,
            }}>
              {day.done && (
                <svg viewBox="0 0 12 12" width="11" height="11" fill="none">
                  <path d="M2 6.5l3 2.5 5-5.5" stroke={C.green} strokeWidth="1.8"
                    strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </div>
            <span style={{
              fontFamily: C.cond, fontSize: 9, fontWeight: 800, letterSpacing: "0.06em",
              color: day.isToday ? C.accent : day.isFuture ? C.ghost : day.done ? C.dim : C.muted,
            }}>
              {dayLabels[i]}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Activity Heatmap (60 days, week-aligned) ──────────────────────────────── */
function ActivityHeatmap({ activity }) {
  const today   = new Date();
  const doneSet = new Set((activity || []).filter(a => a.done).map(a => a.date));
  const anySet  = new Set((activity || []).map(a => a.date));

  // Pad left so first cell lands on a Monday
  const daysBack = 59;
  const startD = new Date(today);
  startD.setDate(today.getDate() - daysBack);
  const startDow = startD.getDay();
  const padLeft  = startDow === 0 ? 6 : startDow - 1; // cells to skip before first real day

  const cells = [];
  for (let i = 0; i < padLeft; i++) cells.push({ iso: null, done: false, has: false, pad: true });
  for (let i = daysBack; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const iso = d.toISOString().split("T")[0];
    cells.push({ iso, done: doneSet.has(iso), has: anySet.has(iso), pad: false });
  }

  return (
    <div>
      <div style={{ display: "flex", gap: 3, marginBottom: 8 }}>
        {["M","T","W","T","F","S","S"].map((l, i) => (
          <div key={i} style={{ width: 18, fontFamily: C.cond, fontSize: 8, fontWeight: 800,
            textAlign: "center", color: C.ghost, letterSpacing: "0.04em" }}>{l}</div>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 18px)", gap: 3 }}>
        {cells.map((cell, i) => (
          <div key={i} title={cell.iso ?? undefined} style={{
            width: 18, height: 18, borderRadius: 3,
            background: cell.pad
              ? "transparent"
              : cell.done
              ? "rgba(34,197,94,0.6)"
              : cell.has
              ? "rgba(34,197,94,0.12)"
              : C.faint,
            border: cell.pad
              ? "none"
              : `1px solid ${cell.done ? "rgba(34,197,94,0.4)" : cell.has ? "rgba(34,197,94,0.18)" : "rgba(255,255,255,0.05)"}`,
          }} />
        ))}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 10 }}>
        {[
          { color: "rgba(34,197,94,0.6)", label: "Completed" },
          { color: "rgba(34,197,94,0.15)", label: "Assigned" },
          { color: C.faint, label: "No activity" },
        ].map(({ color, label }) => (
          <div key={label} style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <div style={{ width: 10, height: 10, borderRadius: 2, background: color,
              border: "1px solid rgba(255,255,255,0.08)" }} />
            <span style={{ fontFamily: C.font, fontSize: 10, color: C.muted }}>{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── PR Row ────────────────────────────────────────────────────────────────── */
function PRRow({ title, prWeight, delta, benchmark }) {
  const tierColor = !benchmark ? C.dim
    : /Top 1%|Top 5%|Top 10%/.test(benchmark) ? C.amber
    : /Top 15%|Top 25%/.test(benchmark) ? C.green
    : C.accent;

  const hasDelta = delta !== null && delta !== undefined;
  const isUp     = hasDelta && delta > 0;
  const isSame   = hasDelta && delta === 0;

  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "12px 0", borderBottom: `1px solid ${C.border}` }}>
      <div style={{ flex: 1, minWidth: 0, paddingRight: 10 }}>
        <p style={{ fontFamily: C.cond, fontSize: 13, fontWeight: 700, color: C.white, marginBottom: 2,
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {title}
        </p>
        {benchmark && (
          <p style={{ fontFamily: C.cond, fontSize: 10, fontWeight: 700, letterSpacing: "0.08em",
            color: tierColor, textTransform: "uppercase" }}>{benchmark}</p>
        )}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
        {hasDelta && !isSame && (
          <span style={{
            display: "flex", alignItems: "center", gap: 3,
            fontFamily: C.cond, fontSize: 10, fontWeight: 800, letterSpacing: "0.04em",
            color: isUp ? C.green : C.red,
            background: isUp ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)",
            padding: "2px 8px", borderRadius: 5,
            border: `1px solid ${isUp ? "rgba(34,197,94,0.3)" : "rgba(239,68,68,0.3)"}`,
          }}>
            {isUp
              ? <TrendingUp size={9} strokeWidth={2.2} />
              : <TrendingDown size={9} strokeWidth={2.2} />
            }
            {isUp ? `+${delta}` : delta} lb
          </span>
        )}
        <div style={{ textAlign: "right" }}>
          <span style={{ fontFamily: C.cond, fontSize: 26, fontWeight: 900, fontStyle: "italic",
            color: C.white, letterSpacing: "-0.04em" }}>{prWeight}</span>
          <span style={{ fontFamily: C.font, fontSize: 11, color: C.muted, marginLeft: 3 }}>lb</span>
        </div>
      </div>
    </div>
  );
}

/* ── Stat Mini-Card ────────────────────────────────────────────────────────── */
function StatCard({ label, value, unit, color }) {
  return (
    <div style={{ flex: 1, minWidth: 90, padding: "14px 12px",
      background: C.raised, borderRadius: 12, border: `1px solid ${C.border}`, textAlign: "center" }}>
      <p style={{ fontFamily: C.cond, fontSize: 26, fontWeight: 900, fontStyle: "italic",
        color: color || C.white, letterSpacing: "-0.03em", lineHeight: 1, marginBottom: 4 }}>
        {value !== null && value !== undefined ? value : "—"}
        {unit && <span style={{ fontSize: 12, fontWeight: 700, marginLeft: 2 }}>{unit}</span>}
      </p>
      <p style={{ fontFamily: C.cond, fontSize: 9, fontWeight: 900, letterSpacing: "0.14em",
        textTransform: "uppercase", color: C.muted }}>
        {label}
      </p>
    </div>
  );
}

/* ── Section wrapper ───────────────────────────────────────────────────────── */
function Section({ title, children }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <p style={{ fontFamily: C.cond, fontSize: 9, fontWeight: 900, letterSpacing: "0.18em",
        textTransform: "uppercase", color: C.muted, marginBottom: 12 }}>{title}</p>
      {children}
    </div>
  );
}

/* ── Chip ──────────────────────────────────────────────────────────────────── */
function Chip({ children }) {
  return (
    <span style={{ fontFamily: C.cond, fontSize: 11, fontWeight: 700, letterSpacing: "0.08em",
      textTransform: "uppercase", color: "rgba(255,255,255,0.55)",
      padding: "3px 10px", borderRadius: 20,
      background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}>
      {children}
    </span>
  );
}

/* ── Page ─────────────────────────────────────────────────────────────────── */
export default function ParentPortal() {
  const router = useRouter();
  const { token } = router.query;

  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState("");

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    fetch(`/api/parent/${encodeURIComponent(token)}`)
      .then(r => r.json())
      .then(json => {
        if (json.error) { setError(json.error); setLoading(false); return; }
        setData(json);
        setLoading(false);
      })
      .catch(() => { setError("Unable to load profile."); setLoading(false); });
  }, [token]);

  /* ── Loading ── */
  if (loading) return (
    <div style={{ minHeight: "100vh", background: C.bg, display: "flex", alignItems: "center",
      justifyContent: "center", flexDirection: "column", gap: 12, fontFamily: C.font, color: C.dim }}>
      <div style={{ width: 28, height: 28, border: `2.5px solid ${C.border}`,
        borderTopColor: C.accent, borderRadius: "50%", animation: "spin 0.9s linear infinite" }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <p style={{ fontSize: 13 }}>Loading athlete profile…</p>
    </div>
  );

  /* ── Error / Not found ── */
  if (error || !data) return (
    <div style={{ minHeight: "100vh", background: C.bg, display: "flex", alignItems: "center",
      justifyContent: "center", flexDirection: "column", gap: 16, padding: 24, fontFamily: C.font }}>
      <Lock size={40} color="rgba(255,255,255,0.3)" strokeWidth={1.3} />
      <h1 style={{ color: C.white, fontFamily: C.cond, fontSize: 24, fontWeight: 900, textAlign: "center" }}>
        Profile not found
      </h1>
      <p style={{ color: C.dim, fontSize: 14, textAlign: "center", maxWidth: 300, lineHeight: 1.6 }}>
        {error === "Profile not found or not public"
          ? "This athlete's profile is private or the link has expired. Ask them to re-share."
          : error || "Something went wrong. Please try again."}
      </p>
      <Link href="/" style={{ color: C.accent, fontSize: 13, textDecoration: "none" }}>
        ← Back to CheckPeak
      </Link>
    </div>
  );

  const { athlete, stats, streak, week, prs, recentActivity } = data;
  const completionColor = stats.completionRate === null ? C.dim
    : stats.completionRate >= 80 ? C.green
    : stats.completionRate >= 50 ? C.amber
    : C.red;

  return (
    <>
      <Head>
        <title>{athlete.name} · Parent Portal | CheckPeak</title>
        <meta name="robots" content="noindex,nofollow" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link href="https://fonts.googleapis.com/css2?family=Barlow:ital,wght@0,400;0,500;0,700;1,900&family=Barlow+Condensed:ital,wght@0,700;0,800;0,900;1,700;1,900&display=swap" rel="stylesheet" />
      </Head>

      <div style={{ minHeight: "100vh", background: C.bg, fontFamily: C.font, color: C.white }}>

        {/* Ambient glow */}
        <div aria-hidden style={{ position: "fixed", inset: 0, pointerEvents: "none",
          background: "radial-gradient(ellipse 80% 35% at 50% 0%, rgba(79,171,255,0.06) 0%, transparent 70%)" }} />

        <div style={{ maxWidth: 520, margin: "0 auto", padding: "28px 18px 80px", position: "relative" }}>

          {/* ── Brand bar ── */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 28 }}>
            <Link href="/" style={{ display: "flex", alignItems: "center", gap: 7, textDecoration: "none" }}>
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: C.accent,
                boxShadow: `0 0 8px ${C.accent}99`, display: "inline-block" }} />
              <span style={{ fontFamily: C.cond, fontSize: 12, fontWeight: 900,
                letterSpacing: "0.16em", color: C.dim }}>CHECKPEAK</span>
            </Link>
            <span style={{ fontFamily: C.cond, fontSize: 10, fontWeight: 700, letterSpacing: "0.12em",
              textTransform: "uppercase", color: C.muted,
              padding: "3px 10px", borderRadius: 20, background: C.faint, border: `1px solid ${C.border}` }}>
              Parent View
            </span>
          </div>

          {/* ── Athlete hero ── */}
          <div style={{ marginBottom: 24 }}>
            <h1 style={{ fontFamily: C.cond, fontSize: 40, fontWeight: 900, fontStyle: "italic",
              letterSpacing: "-0.02em", color: C.white, lineHeight: 1, marginBottom: 10 }}>
              {athlete.name}
            </h1>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
              {athlete.sport    && <Chip>{athlete.sport}</Chip>}
              {athlete.position && <Chip>{athlete.position}</Chip>}
              {athlete.gradYear && <Chip>Class of {athlete.gradYear}</Chip>}
              {athlete.school   && <Chip>{athlete.school}</Chip>}
            </div>
            {athlete.bio && (
              <p style={{ marginTop: 12, fontSize: 13, color: C.dim, lineHeight: 1.65, maxWidth: 440 }}>
                {athlete.bio}
              </p>
            )}
          </div>

          {/* ── Achievements ── */}
          {Array.isArray(athlete.achievements) && athlete.achievements.length > 0 && (
            <div style={{ marginBottom: 24 }}>
              <p style={{ fontFamily: C.cond, fontSize: 9, fontWeight: 900, letterSpacing: "0.18em",
                textTransform: "uppercase", color: C.muted, marginBottom: 10 }}>Achievements</p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {athlete.achievements.map((a, i) => (
                  <span key={i} style={{ fontFamily: C.font, fontSize: 12, color: C.white,
                    padding: "4px 10px", borderRadius: 20,
                    background: "rgba(79,171,255,0.08)", border: "1px solid rgba(79,171,255,0.2)" }}>
                    {a}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* ── Streak hero + this week (grouped, no extra eyebrow) ── */}
          {streak && <StreakHero streak={streak} />}
          {week   && <WeekProgress week={week} />}

          {/* ── 30-day consistency stats ── */}
          {stats.totalWorkouts > 0 && (
            <Section title="30-Day Consistency">
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <StatCard
                  label="Completion"
                  value={stats.completionRate !== null ? `${stats.completionRate}` : null}
                  unit="%"
                  color={completionColor}
                />
                <StatCard
                  label="Done"
                  value={stats.completedWorkouts}
                  color={C.accent}
                />
                <StatCard
                  label="Assigned"
                  value={stats.totalWorkouts}
                  color={C.dim}
                />
              </div>
            </Section>
          )}

          {/* ── PRs ── */}
          {prs && prs.length > 0 && (
            <Section title="Personal Records">
              <div style={{ background: C.card, borderRadius: 14, border: `1px solid ${C.border}`, padding: "4px 16px" }}>
                {prs.map((pr, i) => (
                  <PRRow
                    key={i}
                    title={pr.title}
                    prWeight={pr.prWeight}
                    delta={pr.delta}
                    benchmark={pr.benchmark}
                  />
                ))}
              </div>
              <p style={{ fontFamily: C.font, fontSize: 10, color: C.ghost, marginTop: 8, lineHeight: 1.5 }}>
                Trend badges show change vs. 30 days ago.
              </p>
            </Section>
          )}

          {/* ── Activity heatmap ── */}
          {recentActivity && recentActivity.length > 0 && (
            <Section title="Activity — Last 60 Days">
              <div style={{ padding: "16px", background: C.card, borderRadius: 14, border: `1px solid ${C.border}` }}>
                <ActivityHeatmap activity={recentActivity} />
              </div>
            </Section>
          )}

          {/* ── Footer compliance notice ── */}
          <div style={{ marginTop: 36, padding: "14px 16px", background: C.faint,
            borderRadius: 12, border: `1px solid ${C.border}` }}>
            <div style={{ display: "flex", gap: 8 }}>
              <Lock size={13} color={C.muted} strokeWidth={1.8} style={{ flexShrink: 0, marginTop: 1 }} />
              <p style={{ fontSize: 11, color: C.muted, lineHeight: 1.65, margin: 0 }}>
                This page is shared privately by your athlete. Only they control what appears here.
                Workout details are not displayed in compliance with NCAA recruiting rules.
              </p>
            </div>
          </div>

          {/* ── Brand footer ── */}
          <p style={{ textAlign: "center", marginTop: 28, fontSize: 11, color: C.ghost }}>
            Powered by{" "}
            <Link href="/" style={{ color: C.accent, textDecoration: "none" }}>CheckPeak</Link>
            {" · "}Track and share your athlete's journey.
          </p>
        </div>
      </div>
    </>
  );
}
