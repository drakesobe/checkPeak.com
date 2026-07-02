"use client";
// pages/parent/[token].jsx
// Parent Portal — read-only view of an athlete's progress.
// Accessible via share_token (same token used for recruiting profile).
// VARA-safe: no coach-assigned content shown; only athlete-generated stats.

import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import Head from "next/head";
import Link from "next/link";
import { Lock } from "lucide-react";

/* ── Design tokens ─────────────────────────────────────────────────────────── */
const C = {
  bg:     "#060810",
  card:   "#0C1220",
  raised: "#121B2E",
  border: "#1C2A42",
  accent: "#5B9EC9",
  green:  "#22C55E",
  amber:  "#D4A017",
  white:  "#FFFFFF",
  dim:    "rgba(255,255,255,0.45)",
  muted:  "rgba(255,255,255,0.25)",
  faint:  "rgba(255,255,255,0.07)",
  font:   "'Barlow', sans-serif",
  cond:   "'Barlow Condensed', sans-serif",
};

/* ── Activity Heatmap (last 30 days, 7-column week grid) ─────────────────── */
function ActivityHeatmap({ activity }) {
  // Build a 30-day grid
  const today   = new Date();
  const cells   = [];
  const doneSet = new Set((activity || []).filter(a => a.done).map(a => a.date));
  const anySet  = new Set((activity || []).map(a => a.date));

  for (let i = 29; i >= 0; i--) {
    const d   = new Date(today);
    d.setDate(d.getDate() - i);
    const iso = d.toISOString().split("T")[0];
    const done = doneSet.has(iso);
    const has  = anySet.has(iso);
    cells.push({ iso, done, has });
  }

  return (
    <div>
      <p style={{ fontFamily: C.cond, fontSize: 9, fontWeight: 900, letterSpacing: "0.18em",
        textTransform: "uppercase", color: C.muted, marginBottom: 10 }}>
        Last 30 Days
      </p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
        {cells.map(({ iso, done, has }) => (
          <div key={iso} title={iso}
            style={{
              width: 18, height: 18, borderRadius: 3,
              background: done ? C.green : has ? "rgba(34,197,94,0.15)" : C.faint,
              border:     `1px solid ${done ? "rgba(34,197,94,0.5)" : has ? "rgba(34,197,94,0.25)" : "rgba(255,255,255,0.06)"}`,
            }}
          />
        ))}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 8 }}>
        {[
          { color: C.green, label: "Completed" },
          { color: "rgba(34,197,94,0.2)", label: "Assigned" },
          { color: C.faint, label: "No activity" },
        ].map(({ color, label }) => (
          <div key={label} style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <div style={{ width: 10, height: 10, borderRadius: 2, background: color }} />
            <span style={{ fontFamily: C.font, fontSize: 10, color: C.muted }}>{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── PR Card ──────────────────────────────────────────────────────────────── */
function PRRow({ title, prWeight, benchmark }) {
  const tierColor = benchmark
    ? benchmark.includes("Top 1%") || benchmark.includes("Top 5%") || benchmark.includes("Top 10%")
        ? C.amber
        : benchmark.includes("Top 15%") || benchmark.includes("Top 25%")
        ? C.green
        : C.accent
    : C.dim;

  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "12px 0", borderBottom: `1px solid ${C.border}` }}>
      <div>
        <p style={{ fontFamily: C.cond, fontSize: 13, fontWeight: 700, color: C.white, marginBottom: 2 }}>{title}</p>
        {benchmark && (
          <p style={{ fontFamily: C.cond, fontSize: 10, fontWeight: 700, letterSpacing: "0.08em",
            color: tierColor, textTransform: "uppercase" }}>{benchmark}</p>
        )}
      </div>
      <div style={{ textAlign: "right" }}>
        <span style={{ fontFamily: C.cond, fontSize: 26, fontWeight: 900, fontStyle: "italic",
          color: C.white, letterSpacing: "-0.04em" }}>{prWeight}</span>
        <span style={{ fontFamily: C.font, fontSize: 11, color: C.muted, marginLeft: 3 }}>lb</span>
      </div>
    </div>
  );
}

/* ── Stat Pill ────────────────────────────────────────────────────────────── */
function StatPill({ label, value, unit, color }) {
  return (
    <div style={{ flex: 1, minWidth: 100, padding: "16px 14px",
      background: C.raised, borderRadius: 12, border: `1px solid ${C.border}`, textAlign: "center" }}>
      <p style={{ fontFamily: C.cond, fontSize: 28, fontWeight: 900, fontStyle: "italic",
        color: color || C.white, letterSpacing: "-0.03em", lineHeight: 1 }}>
        {value !== null && value !== undefined ? value : "—"}
        {unit && <span style={{ fontSize: 13, fontWeight: 700, marginLeft: 2 }}>{unit}</span>}
      </p>
      <p style={{ fontFamily: C.cond, fontSize: 9, fontWeight: 900, letterSpacing: "0.14em",
        textTransform: "uppercase", color: C.muted, marginTop: 4 }}>{label}</p>
    </div>
  );
}

/* ── Section ──────────────────────────────────────────────────────────────── */
function Section({ title, children }) {
  return (
    <div style={{ marginBottom: 28 }}>
      <p style={{ fontFamily: C.cond, fontSize: 9, fontWeight: 900, letterSpacing: "0.18em",
        textTransform: "uppercase", color: C.muted, marginBottom: 14 }}>{title}</p>
      {children}
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
      <div style={{ width: 32, height: 32, border: `3px solid ${C.border}`,
        borderTopColor: C.accent, borderRadius: "50%", animation: "spin 0.9s linear infinite" }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <p style={{ fontSize: 13 }}>Loading athlete profile…</p>
    </div>
  );

  /* ── Error / Not found ── */
  if (error || !data) return (
    <div style={{ minHeight: "100vh", background: C.bg, display: "flex", alignItems: "center",
      justifyContent: "center", flexDirection: "column", gap: 16, padding: 24, fontFamily: C.font }}>
      <div style={{ display: "flex", justifyContent: "center", marginBottom: 0 }}><Lock size={40} color="rgba(255,255,255,0.35)" strokeWidth={1.3} /></div>
      <h1 style={{ color: C.white, fontFamily: C.cond, fontSize: 24, fontWeight: 900, textAlign: "center" }}>
        Profile not found
      </h1>
      <p style={{ color: C.dim, fontSize: 14, textAlign: "center", maxWidth: 300 }}>
        {error === "Profile not found or not public"
          ? "This athlete's profile is private or the link has expired. Ask them to re-share."
          : error || "Something went wrong. Please try again."}
      </p>
      <Link href="/" style={{ color: C.accent, fontSize: 13, textDecoration: "none" }}>← Back to CheckPeak</Link>
    </div>
  );

  const { athlete, stats, prs, recentActivity } = data;
  const completionColor = stats.completionRate >= 80 ? C.green
    : stats.completionRate >= 50 ? C.amber
    : "#EF4444";

  return (
    <>
      <Head>
        <title>{athlete.name} · Parent Portal | CheckPeak</title>
        <meta name="robots" content="noindex,nofollow" />
      </Head>

      <div style={{ minHeight: "100vh", background: C.bg, fontFamily: C.font, color: C.white }}>

        {/* Ambient glow */}
        <div aria-hidden style={{ position: "fixed", inset: 0, pointerEvents: "none",
          background: "radial-gradient(ellipse 70% 40% at 50% 0%, rgba(91,158,201,0.07) 0%, transparent 70%)" }} />

        <div style={{ maxWidth: 520, margin: "0 auto", padding: "32px 20px 80px", position: "relative" }}>

          {/* ── Brand header ── */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 32 }}>
            <Link href="/" style={{ display: "flex", alignItems: "center", gap: 8, textDecoration: "none" }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: C.accent,
                boxShadow: `0 0 8px ${C.accent}99`, display: "inline-block" }} />
              <span style={{ fontFamily: C.cond, fontSize: 12, fontWeight: 900,
                letterSpacing: "0.14em", color: C.dim }}>CHECKPEAK</span>
            </Link>
            <span style={{ fontFamily: C.cond, fontSize: 10, fontWeight: 700, letterSpacing: "0.12em",
              textTransform: "uppercase", color: C.muted,
              padding: "3px 10px", borderRadius: 20, background: C.faint,
              border: `1px solid ${C.border}` }}>Parent View</span>
          </div>

          {/* ── Athlete hero ── */}
          <div style={{ marginBottom: 28 }}>
            <h1 style={{ fontFamily: C.cond, fontSize: 36, fontWeight: 900, fontStyle: "italic",
              letterSpacing: "-0.02em", color: C.white, lineHeight: 1, marginBottom: 6 }}>
              {athlete.name}
            </h1>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
              {athlete.sport    && <Chip>{athlete.sport}</Chip>}
              {athlete.position && <Chip>{athlete.position}</Chip>}
              {athlete.gradYear && <Chip>Class of {athlete.gradYear}</Chip>}
              {athlete.school   && <Chip>{athlete.school}</Chip>}
            </div>
            {athlete.bio && (
              <p style={{ marginTop: 14, fontSize: 13, color: C.dim, lineHeight: 1.6, maxWidth: 440 }}>
                {athlete.bio}
              </p>
            )}
          </div>

          {/* ── Achievements ── */}
          {Array.isArray(athlete.achievements) && athlete.achievements.length > 0 && (
            <Section title="Achievements">
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {athlete.achievements.map((a, i) => (
                  <span key={i} style={{ fontFamily: C.font, fontSize: 12, color: C.white,
                    padding: "4px 10px", borderRadius: 20,
                    background: "rgba(79,171,255,0.08)",
                    border: "1px solid rgba(79,171,255,0.2)" }}>{a}</span>
                ))}
              </div>
            </Section>
          )}

          {/* ── Workout stats ── */}
          {stats.totalWorkouts > 0 && (
            <Section title="Training Consistency (30 days)">
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <StatPill
                  label="Completion Rate"
                  value={stats.completionRate !== null ? `${stats.completionRate}%` : null}
                  color={completionColor}
                />
                <StatPill
                  label="Workouts Completed"
                  value={stats.completedWorkouts}
                  color={C.accent}
                />
                <StatPill
                  label="Total Assigned"
                  value={stats.totalWorkouts}
                  color={C.dim}
                />
              </div>
            </Section>
          )}

          {/* ── Activity heatmap ── */}
          {recentActivity && recentActivity.length > 0 && (
            <Section title="Activity">
              <div style={{ padding: "16px", background: C.card, borderRadius: 12,
                border: `1px solid ${C.border}` }}>
                <ActivityHeatmap activity={recentActivity} />
              </div>
            </Section>
          )}

          {/* ── PRs ── */}
          {prs && prs.length > 0 && (
            <Section title="Personal Records">
              <div style={{ background: C.card, borderRadius: 12, border: `1px solid ${C.border}`, padding: "4px 16px" }}>
                {prs.map((pr, i) => (
                  <PRRow key={i} title={pr.title} prWeight={pr.prWeight} benchmark={pr.benchmark} />
                ))}
              </div>
            </Section>
          )}

          {/* ── Footer notice ── */}
          <div style={{ marginTop: 40, padding: "14px 16px", background: C.faint,
            borderRadius: 10, border: `1px solid ${C.border}` }}>
            <p style={{ fontSize: 11, color: C.muted, lineHeight: 1.6 }}>
              This page is shared privately by your athlete. Only they control what appears here.
              Workout details are not displayed in compliance with NCAA recruiting rules.
            </p>
          </div>

          {/* ── Brand footer ── */}
          <p style={{ textAlign: "center", marginTop: 32, fontSize: 11, color: C.muted }}>
            Powered by <Link href="/" style={{ color: C.accent, textDecoration: "none" }}>CheckPeak</Link>
            {" · "}Track and share your athlete's journey.
          </p>
        </div>
      </div>
    </>
  );
}

function Chip({ children }) {
  return (
    <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 11, fontWeight: 700,
      letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(255,255,255,0.55)",
      padding: "3px 10px", borderRadius: 20,
      background: "rgba(255,255,255,0.05)",
      border: "1px solid rgba(255,255,255,0.1)" }}>
      {children}
    </span>
  );
}
