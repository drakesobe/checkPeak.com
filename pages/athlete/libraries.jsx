// pages/athlete/libraries.jsx
// My Programs - dark film room. Shows all subscriptions + completion progress.
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { useAuthContext } from "@/hooks/useAuth";
import Head from "next/head";
import Link from "next/link";

const D = {
  bg:        "#070808",
  bgSection: "#0D1117",
  bgCard:    "#0F1318",
  bgCardHov: "#141820",
  border:    "rgba(255,255,255,0.07)",
  borderMid: "rgba(255,255,255,0.13)",
  text:      "#F0F6FC",
  dim:       "rgba(255,255,255,0.52)",
  faint:     "rgba(255,255,255,0.26)",
  whisper:   "rgba(255,255,255,0.1)",
  red:       "#DA3633",
};

const TIER_COLOR = {
  Basic:   "#3FB950",
  Premium: "#F0883E",
  Ultra:   "#79B8FF",
};

const SPECIALTY_CONFIG = {
  "Strength & Conditioning Coach": { icon: "⚡" },
  "Personal Trainer":              { icon: "🏋️" },
  "Physical Therapist":            { icon: "🩺" },
  "Massage Therapist":             { icon: "💆" },
  "Sports Nutritionist":           { icon: "🥗" },
  "Online Coach":                  { icon: "💻" },
};

const GLOBAL_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:ital,wght@0,700;0,900;1,700;1,900&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  @keyframes fadeUp  { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } }
  @keyframes spin    { to { transform: rotate(360deg); } }
  @keyframes barFill { from { width: 0; } to { width: var(--pct); } }

  .lib-row {
    transition: background 0.16s ease, border-color 0.16s ease;
    cursor: pointer;
    text-decoration: none;
    display: block;
  }
  .lib-row:hover { background: rgba(20,24,32,0.9) !important; border-color: rgba(255,255,255,0.13) !important; }
  .lib-row .cta-btn { opacity: 0.65; transition: opacity 0.14s; }
  .lib-row:hover .cta-btn { opacity: 1; }

  .nav-a { transition: color 0.14s; }
  .nav-a:hover { color: #fff !important; }

  @media (max-width: 640px) {
    .libs-hero  { padding: 60px 24px 48px !important; }
    .libs-body  { padding: 28px 24px 64px !important; }
  }
`;

function splitName(name = "") {
  const parts = name.trim().split(/\s+/);
  if (parts.length <= 2) return parts;
  return [parts[0], parts.slice(1).join(" ")];
}

function ProgressBar({ pct, color }) {
  return (
    <div style={{ position: "relative", width: "100%", height: 2, background: "rgba(255,255,255,0.08)", borderRadius: 1, overflow: "hidden" }}>
      <div
        style={{
          position:        "absolute",
          top:             0,
          left:            0,
          height:          "100%",
          width:           `${pct}%`,
          background:      color,
          borderRadius:    1,
          transition:      "width 1s ease 0.3s",
        }}
      />
    </div>
  );
}

function LibraryRow({ subscription, index }) {
  const sub         = subscription.fields ?? {};
  const trainer     = subscription.trainer?.fields ?? {};
  const trainerName = trainer.name ?? "Your trainer";
  const slug        = trainer.slug ?? "";
  const specialty   = trainer.specialty ?? "";
  const tier        = sub.tier ?? "Basic";
  const tierColor   = TIER_COLOR[tier] ?? D.red;
  const icon        = SPECIALTY_CONFIG[specialty]?.icon ?? "💪";
  const parts       = splitName(trainerName);

  // Completion data from enriched subscription
  const completed  = subscription.completionCount ?? 0;
  const total      = subscription.totalVideos     ?? 0;
  const pct        = total > 0 ? Math.round((completed / total) * 100) : 0;

  const since = sub.startDate
    ? new Date(sub.startDate).toLocaleDateString(undefined, { month: "short", year: "numeric" })
    : null;

  return (
    <Link
      href={`/trainer/${slug}/library`}
      className="lib-row"
      style={{
        background:   D.bgCard,
        border:       `0.5px solid ${D.border}`,
        borderRadius: 3,
        overflow:     "hidden",
        animation:    `fadeUp 0.45s ease ${index * 0.08}s both`,
      }}
    >
      {/* Tier accent line */}
      <div style={{ height: 2, background: tierColor }} />

      <div style={{ padding: "22px 28px" }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 20, flexWrap: "wrap" }}>

          {/* Left: trainer name + info */}
          <div style={{ flex: 1, minWidth: 0 }}>
            {/* Specialty row */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <span style={{ fontSize: 13 }}>{icon}</span>
              <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: "0.18em", textTransform: "uppercase", color: D.faint }}>
                {specialty || "Coach"}
              </span>
              {since && (
                <span style={{ fontSize: 9, color: "rgba(255,255,255,0.18)" }}>· Since {since}</span>
              )}
            </div>

            {/* Trainer name - big, italic, editorial */}
            <div style={{ marginBottom: 14 }}>
              {parts.map((part, i) => (
                <div
                  key={i}
                  style={{
                    fontFamily:    "'Barlow Condensed', sans-serif",
                    fontWeight:    900,
                    fontStyle:     "italic",
                    fontSize:      "clamp(1.5rem, 4vw, 2.2rem)",
                    lineHeight:    0.88,
                    letterSpacing: "-0.02em",
                    textTransform: "uppercase",
                    color:         D.text,
                  }}
                >
                  {part}
                </div>
              ))}
            </div>

            {/* Tier badge */}
            <span style={{
              fontSize:      9,
              fontWeight:    900,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color:         tierColor,
              background:    `${tierColor}14`,
              border:        `0.5px solid ${tierColor}33`,
              padding:       "3px 10px",
            }}>
              {tier}
            </span>
          </div>

          {/* Right: stats + CTA */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 16, flexShrink: 0 }}>
            {/* Completion stat */}
            {total > 0 && (
              <div style={{ textAlign: "right" }}>
                <div style={{
                  fontFamily:    "'Barlow Condensed', sans-serif",
                  fontWeight:    900,
                  fontStyle:     "italic",
                  fontSize:      "1.6rem",
                  lineHeight:    1,
                  letterSpacing: "-0.02em",
                  color:         completed === total ? tierColor : D.text,
                }}>
                  {pct}%
                </div>
                <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: D.faint, marginTop: 3 }}>
                  {completed}/{total} done
                </div>
              </div>
            )}

            {/* CTA */}
            <div
              className="cta-btn"
              style={{
                padding:       "10px 22px",
                background:    D.red,
                color:         "#fff",
                fontSize:      11,
                fontWeight:    800,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                borderRadius:  2,
                whiteSpace:    "nowrap",
              }}
            >
              {completed > 0 ? "Continue →" : "Start →"}
            </div>
          </div>
        </div>

        {/* Progress bar */}
        {total > 0 && (
          <div style={{ marginTop: 18 }}>
            <ProgressBar pct={pct} color={tierColor} />
          </div>
        )}
      </div>
    </Link>
  );
}

export default function LibrariesPage() {
  const router  = useRouter();
  const { user, authReady } = useAuthContext();

  const [subs,    setSubs]    = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authReady) return;
    if (!user) { router.push("/login?next=/athlete/libraries"); return; }

    fetch("/api/commercial/athlete-subscriptions", { credentials: "include" })
      .then(r => r.ok ? r.json() : { subscriptions: [] })
      .then(d => setSubs(d.subscriptions ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user, authReady, router]);

  if (!authReady || !user) return null;

  return (
    <>
      <Head>
        <title>My Programs - CheckPeak</title>
        <meta name="description" content="Your active coaching library subscriptions on CheckPeak." />
      </Head>
      <style>{GLOBAL_CSS}</style>

      <div style={{ minHeight: "100vh", background: D.bg, color: D.text, fontFamily: "system-ui, -apple-system, sans-serif" }}>

        {/* ── Nav ── */}
        <nav style={{ position: "sticky", top: 0, zIndex: 50, background: "rgba(7,8,8,0.9)", backdropFilter: "blur(12px)", borderBottom: `0.5px solid ${D.border}`, padding: "0 56px", height: 52, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <a href="/" className="nav-a" style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: 14, letterSpacing: "0.12em", textTransform: "uppercase", color: D.faint, textDecoration: "none" }}>
            CheckPeak
          </a>
          <a href="/trainers" className="nav-a" style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: D.faint, textDecoration: "none" }}>
            The Arena →
          </a>
        </nav>

        {/* ── Hero ── */}
        <section
          className="libs-hero"
          style={{
            padding:    "64px 56px 48px",
            background: `
              radial-gradient(ellipse 80% 60% at 50% -10%, rgba(218,54,51,0.06) 0%, transparent 58%),
              ${D.bg}
            `,
            borderBottom: `0.5px solid ${D.border}`,
          }}
        >
          <div style={{ maxWidth: 900, margin: "0 auto" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
              <div style={{ width: 24, height: 2, background: D.red }} />
              <span style={{ fontSize: 9, fontWeight: 900, letterSpacing: "0.22em", textTransform: "uppercase", color: D.red }}>
                Your Programs
              </span>
            </div>
            <h1 style={{
              fontFamily:    "'Barlow Condensed', sans-serif",
              fontWeight:    900,
              fontStyle:     "italic",
              fontSize:      "clamp(2.5rem, 7vw, 5.5rem)",
              lineHeight:    0.88,
              letterSpacing: "-0.03em",
              textTransform: "uppercase",
              color:         D.text,
              marginBottom:  10,
            }}>
              My Libraries.
            </h1>
            <p style={{ fontSize: 14, color: D.faint }}>
              {loading ? "Loading…" : subs.length > 0 ? `${subs.length} active program${subs.length !== 1 ? "s" : ""}.` : "You haven't subscribed to any programs yet."}
            </p>
          </div>
        </section>

        {/* ── Content ── */}
        <div className="libs-body" style={{ maxWidth: 900, margin: "0 auto", padding: "36px 56px 80px" }}>

          {loading ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {[1,2,3].map(i => (
                <div key={i} style={{ height: 120, background: D.bgCard, border: `0.5px solid ${D.border}`, borderRadius: 3, animation: "pulse 1.5s ease-in-out infinite" }} />
              ))}
              <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }`}</style>
            </div>
          ) : subs.length === 0 ? (
            // ── Empty state ──
            <div style={{ textAlign: "center", padding: "100px 0" }}>
              <div style={{ marginBottom: 28 }}>
                <h2 style={{
                  fontFamily:    "'Barlow Condensed', sans-serif",
                  fontWeight:    900,
                  fontStyle:     "italic",
                  fontSize:      "clamp(2rem, 5vw, 4rem)",
                  lineHeight:    0.9,
                  letterSpacing: "-0.025em",
                  textTransform: "uppercase",
                  color:         D.text,
                  marginBottom:  12,
                }}>
                  No Programs Yet.<br />
                  <span style={{ color: D.faint }}>Let's Fix That.</span>
                </h2>
                <p style={{ fontSize: 13, color: D.faint, lineHeight: 1.7, maxWidth: 340, margin: "0 auto 32px" }}>
                  Subscribe to a coach's library to get instant access to their videos, workouts, and programming - all in one place.
                </p>
              </div>
              <a
                href="/trainers"
                style={{
                  display:       "inline-flex",
                  alignItems:    "center",
                  gap:           10,
                  padding:       "14px 36px",
                  background:    D.red,
                  color:         "#fff",
                  textDecoration:"none",
                  fontSize:      11,
                  fontWeight:    800,
                  letterSpacing: "0.14em",
                  textTransform: "uppercase",
                  borderRadius:  2,
                }}
              >
                Find a Coach in the Arena →
              </a>
            </div>
          ) : (
            <>
              {/* Library list */}
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {subs.map((sub, i) => (
                  <LibraryRow key={sub.id} subscription={sub} index={i} />
                ))}
              </div>

              {/* Discover more */}
              <div style={{ marginTop: 36, borderTop: `0.5px solid ${D.border}`, paddingTop: 36, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
                <div>
                  <p style={{
                    fontFamily:    "'Barlow Condensed', sans-serif",
                    fontWeight:    900,
                    fontStyle:     "italic",
                    fontSize:      "1.3rem",
                    letterSpacing: "-0.01em",
                    textTransform: "uppercase",
                    color:         D.text,
                    marginBottom:  4,
                  }}>
                    Want More?
                  </p>
                  <p style={{ fontSize: 12, color: D.faint }}>
                    Find elite coaches in every specialty.
                  </p>
                </div>
                <a
                  href="/trainers"
                  style={{
                    padding:       "11px 24px",
                    background:    "transparent",
                    border:        `0.5px solid ${D.borderMid}`,
                    color:         D.dim,
                    textDecoration:"none",
                    fontSize:      11,
                    fontWeight:    700,
                    letterSpacing: "0.1em",
                    textTransform: "uppercase",
                    borderRadius:  2,
                    whiteSpace:    "nowrap",
                  }}
                >
                  Browse the Arena →
                </a>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <footer style={{ borderTop: `0.5px solid ${D.border}`, padding: "24px 56px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
          <a href="/" style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: 13, letterSpacing: "0.16em", textTransform: "uppercase", color: "rgba(255,255,255,0.18)", textDecoration: "none" }}>
            CheckPeak
          </a>
          <span style={{ fontSize: 10, color: "rgba(255,255,255,0.14)" }}>Commercial Platform · {new Date().getFullYear()}</span>
        </footer>
      </div>
    </>
  );
}