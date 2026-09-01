"use client";
// pages/parent/[token].jsx
// Parent Portal — read-only view of an athlete's progress.
// Accessible via share_token (same token used for recruiting profile).
// VARA-safe: no coach-assigned content shown; only athlete-generated stats.

import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import Head from "next/head";
import Link from "next/link";
import { Lock, TrendingUp, TrendingDown, Film, ExternalLink } from "lucide-react";

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
  // Raised contrast — these parents need readable text on a dark background
  dim:    "rgba(220,230,255,0.78)",
  muted:  "rgba(190,210,255,0.60)",
  ghost:  "rgba(255,255,255,0.40)",
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
  return "rgba(255,255,255,0.30)";
}

/* ── Eyebrow ───────────────────────────────────────────────────────────────── */
function Eyebrow({ children, style }) {
  return (
    <p style={{
      fontFamily: C.cond, fontSize: 10, fontWeight: 900,
      letterSpacing: "0.18em", textTransform: "uppercase",
      color: C.muted, marginBottom: 12, ...style,
    }}>
      {children}
    </p>
  );
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
        <Eyebrow style={{ marginBottom: 8 }}>Current Streak</Eyebrow>
        <p style={{ fontFamily: C.cond, fontSize: 48, fontWeight: 900, fontStyle: "italic",
          letterSpacing: "-0.04em", color: "rgba(255,255,255,0.25)", lineHeight: 1, marginBottom: 4 }}>
          0
        </p>
        <p style={{ fontFamily: C.font, fontSize: 13, color: C.muted }}>
          No active streak — first workout starts one
        </p>
      </div>
    );
  }

  return (
    <div style={{
      padding: "22px 20px",
      background: C.card,
      borderRadius: 14,
      border: `1px solid ${C.border}`,
      marginBottom: 8,
      position: "relative",
      overflow: "hidden",
    }}>
      <div aria-hidden style={{
        position: "absolute", top: 0, left: "50%", transform: "translateX(-50%)",
        width: "120%", height: "60%",
        background: `radial-gradient(ellipse at 50% 0%, ${color}18 0%, transparent 70%)`,
        pointerEvents: "none",
      }} />

      <Eyebrow style={{ position: "relative", marginBottom: 14 }}>Current Streak</Eyebrow>

      <div style={{ display: "flex", alignItems: "flex-end", gap: 8, marginBottom: 16, position: "relative" }}>
        <span style={{ fontFamily: C.cond, fontSize: 72, fontWeight: 900, fontStyle: "italic",
          letterSpacing: "-0.04em", color, lineHeight: 1 }}>{count}</span>
        <span style={{ fontFamily: C.cond, fontSize: 16, fontWeight: 800, letterSpacing: "0.06em",
          textTransform: "uppercase", color, paddingBottom: 10 }}>day streak</span>
      </div>

      <div style={{ position: "relative", marginBottom: 8 }}>
        <div style={{ height: 4, background: "rgba(255,255,255,0.10)", borderRadius: 2, overflow: "hidden" }}>
          <div style={{
            height: "100%", borderRadius: 2,
            width: `${progress}%`,
            background: `linear-gradient(90deg, ${color}99, ${color})`,
            transition: "width 0.6s ease",
          }} />
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
          <span style={{ fontFamily: C.font, fontSize: 12, color: C.muted }}>
            {startDate ? `Since ${fmtDate(startDate)}` : "Active"}
          </span>
          <span style={{ fontFamily: C.cond, fontSize: 12, fontWeight: 700, color: C.muted }}>
            {count} / {milestone} days
          </span>
        </div>
      </div>
    </div>
  );
}

/* ── Week Progress ─────────────────────────────────────────────────────────── */
function WeekProgress({ week }) {
  const dayLabels    = ["M", "T", "W", "T", "F", "S", "S"];
  const daysWithData = week.days.filter(d => !d.isFuture).length;

  return (
    <div style={{
      padding: "18px 20px",
      background: C.card,
      borderRadius: 14,
      border: `1px solid ${C.border}`,
      marginBottom: 30,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <Eyebrow style={{ marginBottom: 0 }}>This Week</Eyebrow>
        <p style={{ fontFamily: C.cond, fontSize: 12, fontWeight: 700, color: C.muted }}>
          {week.done} of {daysWithData} day{daysWithData !== 1 ? "s" : ""}
        </p>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        {week.days.map((day, i) => (
          <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 5 }}>
            <div style={{
              width: 32, height: 32, borderRadius: "50%",
              background: day.done
                ? "rgba(34,197,94,0.15)"
                : day.isToday
                ? "rgba(79,171,255,0.08)"
                : C.faint,
              border: day.done
                ? "1.5px solid rgba(34,197,94,0.55)"
                : day.isToday
                ? "1.5px solid rgba(79,171,255,0.4)"
                : `1px solid rgba(255,255,255,0.10)`,
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
              fontFamily: C.cond, fontSize: 10, fontWeight: 800, letterSpacing: "0.06em",
              color: day.isToday ? C.accent : day.isFuture ? "rgba(255,255,255,0.20)" : day.done ? C.dim : C.muted,
            }}>
              {dayLabels[i]}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Film Section ──────────────────────────────────────────────────────────── */
function FilmSection({ reel, hudlUrl, athleteName }) {
  if (!reel && !hudlUrl) return null;

  const linkCard = {
    display: "flex", alignItems: "center", gap: 14,
    padding: "16px 18px",
    background: C.raised, borderRadius: 14,
    border: `1px solid ${C.border}`,
    textDecoration: "none", color: "inherit",
    marginBottom: 10, cursor: "pointer",
  };
  const iconBox = {
    width: 44, height: 44, borderRadius: 11, flexShrink: 0,
    display: "flex", alignItems: "center", justifyContent: "center",
  };

  return (
    <div style={{ marginBottom: 30 }}>
      <Eyebrow>Highlights &amp; Film</Eyebrow>
      <p style={{ fontSize: 14, color: C.dim, marginBottom: 14, lineHeight: 1.6 }}>
        Film and highlights {athleteName} chose to share.
      </p>

      {reel && (
        <a href={`/reel/${reel.shareToken}`} target="_blank" rel="noopener noreferrer" style={linkCard}>
          <div style={{ ...iconBox, background: "rgba(79,171,255,0.08)", border: "1px solid rgba(79,171,255,0.22)" }}>
            <Film size={18} color={C.accent} strokeWidth={1.6} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontFamily: C.cond, fontSize: 15, fontWeight: 800, color: C.white, marginBottom: 3 }}>
              {reel.title || "Highlight Reel"}
            </p>
            <p style={{ fontFamily: C.font, fontSize: 13, color: C.muted }}>
              {reel.playCount} clip{reel.playCount !== 1 ? "s" : ""} · Watch on CheckPeak
            </p>
          </div>
          <ExternalLink size={14} color={C.ghost} strokeWidth={1.8} style={{ flexShrink: 0 }} />
        </a>
      )}

      {hudlUrl && (
        <a href={hudlUrl} target="_blank" rel="noopener noreferrer" style={linkCard}>
          <div style={{ ...iconBox, background: "rgba(244,164,23,0.08)", border: "1px solid rgba(244,164,23,0.22)" }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill={C.amber}>
              <polygon points="5,3 19,12 5,21" />
            </svg>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontFamily: C.cond, fontSize: 15, fontWeight: 800, color: C.white, marginBottom: 3 }}>
              Hudl Highlights
            </p>
            <p style={{ fontFamily: C.font, fontSize: 13, color: C.muted }}>
              Full highlight film on Hudl
            </p>
          </div>
          <ExternalLink size={14} color={C.ghost} strokeWidth={1.8} style={{ flexShrink: 0 }} />
        </a>
      )}
    </div>
  );
}

/* ── Activity Heatmap (60 days, week-aligned) ──────────────────────────────── */
function ActivityHeatmap({ activity }) {
  const today   = new Date();
  const doneSet = new Set((activity || []).filter(a => a.done).map(a => a.date));
  const anySet  = new Set((activity || []).map(a => a.date));

  const daysBack = 59;
  const startD = new Date(today);
  startD.setDate(today.getDate() - daysBack);
  const startDow = startD.getDay();
  const padLeft  = startDow === 0 ? 6 : startDow - 1;

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
          <div key={i} style={{ width: 18, fontFamily: C.cond, fontSize: 9, fontWeight: 800,
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
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 12 }}>
        {[
          { color: "rgba(34,197,94,0.6)", label: "Completed" },
          { color: "rgba(34,197,94,0.15)", label: "Assigned" },
          { color: C.faint, label: "No activity" },
        ].map(({ color, label }) => (
          <div key={label} style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <div style={{ width: 10, height: 10, borderRadius: 2, background: color,
              border: "1px solid rgba(255,255,255,0.08)" }} />
            <span style={{ fontFamily: C.font, fontSize: 11, color: C.muted }}>{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── PR Row ────────────────────────────────────────────────────────────────── */
function PRRow({ title, prWeight, delta, benchmark }) {
  const tierColor = !benchmark ? C.muted
    : /Top 1%|Top 5%|Top 10%/.test(benchmark) ? C.amber
    : /Top 15%|Top 25%/.test(benchmark) ? C.green
    : C.accent;

  const hasDelta = delta !== null && delta !== undefined;
  const isUp     = hasDelta && delta > 0;
  const isSame   = hasDelta && delta === 0;

  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "14px 0", borderBottom: `1px solid ${C.border}` }}>
      <div style={{ flex: 1, minWidth: 0, paddingRight: 12 }}>
        <p style={{ fontFamily: C.cond, fontSize: 15, fontWeight: 700, color: C.white, marginBottom: 3,
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {title}
        </p>
        {benchmark && (
          <p style={{ fontFamily: C.cond, fontSize: 11, fontWeight: 700, letterSpacing: "0.08em",
            color: tierColor, textTransform: "uppercase" }}>{benchmark}</p>
        )}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 9, flexShrink: 0 }}>
        {hasDelta && !isSame && (
          <span style={{
            display: "flex", alignItems: "center", gap: 3,
            fontFamily: C.cond, fontSize: 11, fontWeight: 800, letterSpacing: "0.04em",
            color: isUp ? C.green : C.red,
            background: isUp ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)",
            padding: "3px 8px", borderRadius: 5,
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
          <span style={{ fontFamily: C.font, fontSize: 12, color: C.muted, marginLeft: 3 }}>lb</span>
        </div>
      </div>
    </div>
  );
}

/* ── Stat Mini-Card ────────────────────────────────────────────────────────── */
function StatCard({ label, value, unit, color }) {
  return (
    <div style={{ flex: 1, minWidth: 90, padding: "16px 14px",
      background: C.raised, borderRadius: 12, border: `1px solid ${C.border}`, textAlign: "center" }}>
      <p style={{ fontFamily: C.cond, fontSize: 28, fontWeight: 900, fontStyle: "italic",
        color: color || C.white, letterSpacing: "-0.03em", lineHeight: 1, marginBottom: 5 }}>
        {value !== null && value !== undefined ? value : "—"}
        {unit && <span style={{ fontSize: 13, fontWeight: 700, marginLeft: 2 }}>{unit}</span>}
      </p>
      <p style={{ fontFamily: C.cond, fontSize: 10, fontWeight: 900, letterSpacing: "0.14em",
        textTransform: "uppercase", color: C.muted }}>
        {label}
      </p>
    </div>
  );
}

/* ── Section wrapper ───────────────────────────────────────────────────────── */
function Section({ title, children }) {
  return (
    <div style={{ marginBottom: 30 }}>
      <Eyebrow>{title}</Eyebrow>
      {children}
    </div>
  );
}

/* ── Chip ──────────────────────────────────────────────────────────────────── */
function Chip({ children }) {
  return (
    <span style={{ fontFamily: C.cond, fontSize: 12, fontWeight: 700, letterSpacing: "0.08em",
      textTransform: "uppercase", color: C.dim,
      padding: "4px 12px", borderRadius: 20,
      background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)" }}>
      {children}
    </span>
  );
}

/* ── Avatar ────────────────────────────────────────────────────────────────── */
function Avatar({ url, name, size = 76 }) {
  const initials = (name || "A")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map(w => w[0].toUpperCase())
    .join("");

  return (
    <div style={{
      width: size, height: size, borderRadius: "50%", flexShrink: 0,
      background: url ? "transparent" : "linear-gradient(135deg, #1A2540 0%, #0D1530 100%)",
      border: `2.5px solid ${url ? "rgba(255,255,255,0.14)" : "rgba(79,171,255,0.30)"}`,
      overflow: "hidden",
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      {url
        ? <img src={url} alt={name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        : <span style={{
            fontFamily: C.cond, fontSize: size * 0.36, fontWeight: 900,
            color: C.accent, letterSpacing: "-0.02em",
          }}>{initials}</span>
      }
    </div>
  );
}

/* ── Parent Message ─────────────────────────────────────────────────────────── */
function ParentMessage({ message, firstName }) {
  if (!message) return null;
  return (
    <div style={{
      padding: "16px 18px", marginBottom: 28,
      background: "rgba(79,171,255,0.05)",
      borderRadius: 14, border: "1px solid rgba(79,171,255,0.18)",
    }}>
      <p style={{
        fontFamily: C.cond, fontSize: 10, fontWeight: 900,
        letterSpacing: "0.18em", textTransform: "uppercase",
        color: "rgba(79,171,255,0.65)", marginBottom: 9,
      }}>
        A note from {firstName || "your athlete"}
      </p>
      <p style={{ fontSize: 15, color: C.dim, lineHeight: 1.7, fontStyle: "italic", margin: 0 }}>
        &ldquo;{message}&rdquo;
      </p>
    </div>
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
      <p style={{ fontSize: 14 }}>Loading athlete profile…</p>
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
      <p style={{ color: C.dim, fontSize: 15, textAlign: "center", maxWidth: 300, lineHeight: 1.65 }}>
        {error === "Profile not found or not public"
          ? "This athlete's profile is private or the link has expired. Ask them to re-share."
          : error || "Something went wrong. Please try again."}
      </p>
      <Link href="/" style={{ color: C.accent, fontSize: 14, textDecoration: "none" }}>
        ← Back to CheckPeak
      </Link>
    </div>
  );

  const { athlete, stats, streak, week, prs, recentActivity, reel, hudlUrl } = data;
  const completionColor = stats.completionRate === null ? C.dim
    : stats.completionRate >= 80 ? C.green
    : stats.completionRate >= 50 ? C.amber
    : C.red;

  return (
    <>
      <Head>
        <title>{athlete.name} · Parent Portal | CheckPeak</title>
        <meta name="robots" content="noindex,nofollow" />
        {/* Fonts are self-hosted via _document.js — no Google Fonts request needed */}
      </Head>

      <div style={{ minHeight: "100vh", background: C.bg, fontFamily: C.font, color: C.white }}>

        {/* Ambient glow */}
        <div aria-hidden style={{ position: "fixed", inset: 0, pointerEvents: "none",
          background: "radial-gradient(ellipse 80% 35% at 50% 0%, rgba(79,171,255,0.06) 0%, transparent 70%)" }} />

        <div style={{ maxWidth: 520, margin: "0 auto", padding: "32px 20px 80px", position: "relative" }}>

          {/* ── Brand bar ── */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 32 }}>
            <Link href="/" style={{ display: "flex", alignItems: "center", gap: 7, textDecoration: "none" }}>
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: C.accent,
                boxShadow: `0 0 8px ${C.accent}99`, display: "inline-block" }} />
              <span style={{ fontFamily: C.cond, fontSize: 12, fontWeight: 900,
                letterSpacing: "0.16em", color: C.muted }}>CHECKPEAK</span>
            </Link>
            <span style={{ fontFamily: C.cond, fontSize: 10, fontWeight: 700, letterSpacing: "0.12em",
              textTransform: "uppercase", color: C.muted,
              padding: "4px 12px", borderRadius: 20, background: C.faint, border: `1px solid ${C.border}` }}>
              Parent View
            </span>
          </div>

          {/* ── Athlete hero ── */}
          <div style={{ marginBottom: 28 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 14 }}>
              <Avatar url={athlete.avatarUrl} name={athlete.name} size={76} />
              <div style={{ minWidth: 0 }}>
                <h1 style={{ fontFamily: C.cond, fontSize: 34, fontWeight: 900, fontStyle: "italic",
                  letterSpacing: "-0.02em", color: C.white, lineHeight: 1.0, marginBottom: 10 }}>
                  {athlete.name}
                </h1>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 5, alignItems: "center" }}>
                  {athlete.sport    && <Chip>{athlete.sport}</Chip>}
                  {athlete.position && <Chip>{athlete.position}</Chip>}
                  {athlete.gradYear && <Chip>Class of {athlete.gradYear}</Chip>}
                  {athlete.school   && <Chip>{athlete.school}</Chip>}
                </div>
              </div>
            </div>
            {athlete.bio && (
              <p style={{ fontSize: 15, color: C.dim, lineHeight: 1.7, maxWidth: 440 }}>
                {athlete.bio}
              </p>
            )}
          </div>

          {/* ── Achievements ── */}
          {Array.isArray(athlete.achievements) && athlete.achievements.length > 0 && (
            <div style={{ marginBottom: 30 }}>
              <Eyebrow>Achievements</Eyebrow>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
                {athlete.achievements.map((a, i) => (
                  <span key={i} style={{ fontFamily: C.font, fontSize: 13, color: C.white,
                    padding: "5px 12px", borderRadius: 20,
                    background: "rgba(79,171,255,0.08)", border: "1px solid rgba(79,171,255,0.22)" }}>
                    {a}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* ── Parent message ── */}
          <ParentMessage message={athlete.parentMessage} firstName={athlete.name?.split(" ")[0]} />

          {/* ── Highlights & Film ── */}
          <FilmSection reel={reel} hudlUrl={hudlUrl} athleteName={athlete.name} />

          {/* ── Streak hero + this week (grouped) ── */}
          {streak && <StreakHero streak={streak} />}
          {week   && <WeekProgress week={week} />}

          {/* ── 30-day consistency stats ── */}
          {stats.totalWorkouts > 0 && (
            <Section title="30-Day Consistency">
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
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
              <div style={{ background: C.card, borderRadius: 14, border: `1px solid ${C.border}`, padding: "4px 18px" }}>
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
              <p style={{ fontFamily: C.font, fontSize: 12, color: C.muted, marginTop: 9, lineHeight: 1.5 }}>
                Trend badges show change vs. 30 days ago.
              </p>
            </Section>
          )}

          {/* ── Activity heatmap ── */}
          {recentActivity && recentActivity.length > 0 && (
            <Section title="Activity — Last 60 Days">
              <div style={{ padding: "18px", background: C.card, borderRadius: 14, border: `1px solid ${C.border}` }}>
                <ActivityHeatmap activity={recentActivity} />
              </div>
            </Section>
          )}

          {/* ── Footer compliance notice ── */}
          <div style={{ marginTop: 36, padding: "16px 18px", background: C.faint,
            borderRadius: 12, border: `1px solid ${C.border}` }}>
            <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
              <Lock size={14} color={C.muted} strokeWidth={1.8} style={{ flexShrink: 0, marginTop: 2 }} />
              <p style={{ fontSize: 13, color: C.dim, lineHeight: 1.7, margin: 0 }}>
                This page is shared privately by your athlete. Only they control what appears here —
                including which film clips are visible. Workout details are not displayed in compliance
                with NCAA recruiting rules.
              </p>
            </div>
          </div>

          {/* ── Brand footer ── */}
          <p style={{ textAlign: "center", marginTop: 30, fontSize: 12, color: C.muted }}>
            Powered by{" "}
            <Link href="/" style={{ color: C.accent, textDecoration: "none" }}>CheckPeak</Link>
            {" · "}Track and share your athlete's journey.
          </p>
        </div>
      </div>
    </>
  );
}
