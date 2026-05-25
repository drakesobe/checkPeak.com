// pages/trainer/[slug]/index.jsx
// Public trainer profile — CheckPeak Commercial.
// Redesigned: dark, apex athlete, editorial-brutal aesthetic.
// Inspired by Nike athlete profiles + fight-poster typography.
"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/router";
import { useAuthContext } from "@/hooks/useAuth";
import Head from "next/head";

// ─── Design tokens ────────────────────────────────────────────────────────────
const D = {
  bg:         "#070808",
  bgSection:  "#0D1117",
  bgCard:     "#0F1318",
  bgCardHov:  "#141820",
  border:     "rgba(255,255,255,0.07)",
  borderMid:  "rgba(255,255,255,0.13)",
  text:       "#F0F6FC",
  dim:        "rgba(255,255,255,0.52)",
  faint:      "rgba(255,255,255,0.26)",
  whisper:    "rgba(255,255,255,0.11)",
  red:        "#DA3633",
  redGlow:    "rgba(218,54,51,0.12)",
};

// ─── Tier config ──────────────────────────────────────────────────────────────
const TIER = {
  Basic:   { color: "#3FB950", glow: "rgba(63,185,80,0.12)",   priceKey: "basicPrice",   perksKey: "basicPerks"   },
  Premium: { color: "#F0883E", glow: "rgba(240,136,62,0.12)",  priceKey: "premiumPrice", perksKey: "premiumPerks" },
  Ultra:   { color: "#79B8FF", glow: "rgba(121,184,255,0.12)", priceKey: "ultraPrice",   perksKey: "ultraPerks"   },
};

const DEFAULT_PERKS = {
  Basic:   ["Full video library access", "Filter by workout type & difficulty", "Watch on any device"],
  Premium: ["Everything in Basic", "Custom workouts built by your trainer", "Workout calendar assignments"],
  Ultra:   ["Everything in Premium", "In-person training sessions", "Direct trainer access"],
};

// ─── Utilities ────────────────────────────────────────────────────────────────
function parsePerks(raw, tier) {
  try { return JSON.parse(raw || "null") || DEFAULT_PERKS[tier]; }
  catch { return DEFAULT_PERKS[tier]; }
}

function muxThumb(id, w = 800, h = 450) {
  return `https://image.mux.com/${id}/thumbnail.jpg?width=${w}&height=${h}&fit_mode=smartcrop`;
}

function splitName(name = "") {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return [name];
  if (parts.length === 2) return parts;
  return [parts[0], parts.slice(1).join(" ")];
}

// ─── Global CSS ───────────────────────────────────────────────────────────────
const GLOBAL_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:ital,wght@0,700;0,900;1,700;1,900&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  @keyframes fadeUp {
    from { opacity: 0; transform: translateY(20px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes fadeIn {
    from { opacity: 0; }
    to   { opacity: 1; }
  }
  @keyframes lineSlide {
    from { transform: scaleX(0); transform-origin: left; }
    to   { transform: scaleX(1); transform-origin: left; }
  }
  @keyframes chevronBounce {
    0%, 100% { transform: translateY(0) translateX(-50%); }
    50%       { transform: translateY(7px) translateX(-50%); }
  }
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
  @keyframes pulseGlow {
    0%, 100% { opacity: 0.6; }
    50%       { opacity: 1; }
  }

  /* Nav */
  .cp-nav { transition: background 0.3s ease, border-color 0.3s ease, backdrop-filter 0.3s ease; }

  /* Hover: video cards */
  .cp-vid { transition: transform 0.22s ease, box-shadow 0.22s ease, border-color 0.22s ease; cursor: default; }
  .cp-vid:hover { transform: translateY(-3px) scale(1.01); box-shadow: 0 20px 48px rgba(0,0,0,0.65); border-color: rgba(255,255,255,0.16) !important; }
  .cp-vid .cp-vid-overlay { opacity: 0; transition: opacity 0.2s; }
  .cp-vid:hover .cp-vid-overlay { opacity: 1; }

  /* Hover: plan cards */
  .cp-plan { transition: transform 0.2s ease, border-color 0.25s ease, box-shadow 0.2s ease; }
  .cp-plan:hover { transform: translateY(-4px); box-shadow: 0 24px 56px rgba(0,0,0,0.5); }

  /* Buttons */
  .cp-btn { transition: opacity 0.14s ease, transform 0.1s ease; }
  .cp-btn:hover:not(:disabled) { opacity: 0.84; }
  .cp-btn:active:not(:disabled) { transform: scale(0.98); }

  .cp-ghost-btn { transition: background 0.15s ease, border-color 0.15s ease, color 0.15s ease; }
  .cp-ghost-btn:hover { background: rgba(255,255,255,0.07) !important; border-color: rgba(255,255,255,0.3) !important; }

  /* Nav links */
  .cp-nav-a { transition: color 0.15s; }
  .cp-nav-a:hover { color: #fff !important; }

  /* Responsive */
  @media (max-width: 768px) {
    .cp-hero-name { font-size: clamp(3.2rem, 16vw, 6rem) !important; }
    .cp-vid-grid  { grid-template-columns: 1fr !important; }
    .cp-plan-grid { grid-template-columns: 1fr !important; }
    .cp-hero-inner { padding: 0 24px !important; }
    .cp-section   { padding: 60px 24px !important; }
    .cp-stat-row  { gap: 24px !important; }
  }
`;

// ─── VideoCard ────────────────────────────────────────────────────────────────
function VideoCard({ video, isLarge, isLocked }) {
  const f     = video?.fields ?? {};
  const thumb = f.muxPlaybackId ? muxThumb(f.muxPlaybackId, isLarge ? 900 : 480, isLarge ? 506 : 270) : null;

  return (
    <div
      className="cp-vid"
      style={{
        position: "relative",
        borderRadius: 3,
        overflow: "hidden",
        background: D.bgCard,
        border: `0.5px solid ${D.border}`,
        aspectRatio: "16/9",
      }}
    >
      {/* Thumbnail */}
      {thumb
        ? <img src={thumb} alt={f.title} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
        : (
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none">
              <polygon points="5,3 19,12 5,21" fill="rgba(255,255,255,0.1)" />
            </svg>
          </div>
        )
      }

      {/* Bottom gradient */}
      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(0,0,0,0.88) 0%, rgba(0,0,0,0.18) 55%, transparent 100%)" }} />

      {/* Hover play icon */}
      <div className="cp-vid-overlay" style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.22)" }}>
        <div style={{ width: 48, height: 48, borderRadius: "50%", background: "rgba(255,255,255,0.12)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid rgba(255,255,255,0.2)" }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <polygon points="5,3 19,12 5,21" fill="rgba(255,255,255,0.9)" />
          </svg>
        </div>
      </div>

      {/* Lock */}
      {isLocked && (
        <div style={{ position: "absolute", top: 12, right: 12, padding: "4px 10px", background: "rgba(0,0,0,0.72)", backdropFilter: "blur(6px)", border: "0.5px solid rgba(255,255,255,0.12)", fontSize: 9, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.4)" }}>
          Members only
        </div>
      )}

      {/* Title */}
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: isLarge ? "18px 20px" : "12px 16px" }}>
        <p style={{ fontSize: isLarge ? 14 : 11, fontWeight: 700, color: D.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", letterSpacing: "-0.01em" }}>
          {f.title || "Untitled"}
        </p>
      </div>
    </div>
  );
}

// ─── PlanCard ─────────────────────────────────────────────────────────────────
function PlanCard({ tier, f, onSubscribe, checkoutTier, user, slug }) {
  const cfg      = TIER[tier];
  const price    = f[cfg.priceKey];
  const perks    = parsePerks(f[cfg.perksKey], tier);
  const isFree   = Number(price) === 0;
  const isActive = checkoutTier === tier;
  const isPop    = tier === "Premium";

  return (
    <div
      className="cp-plan"
      style={{
        background: D.bgCard,
        border: `0.5px solid rgba(255,255,255,0.09)`,
        borderTop: `3px solid ${cfg.color}`,
        padding: "28px 22px 22px",
        display: "flex",
        flexDirection: "column",
        position: "relative",
        borderRadius: 3,
      }}
    >
      {/* Popular badge */}
      {isPop && (
        <div style={{ position: "absolute", top: 0, right: 20, transform: "translateY(-50%)", background: cfg.color, color: "#fff", fontSize: 8, fontWeight: 900, letterSpacing: "0.14em", textTransform: "uppercase", padding: "3px 10px" }}>
          Most Popular
        </div>
      )}

      {/* Tier label */}
      <p style={{ fontSize: 9, fontWeight: 900, letterSpacing: "0.22em", textTransform: "uppercase", color: cfg.color, marginBottom: 18 }}>
        {tier}
      </p>

      {/* Price */}
      <div style={{ marginBottom: 26, minHeight: 72, display: "flex", alignItems: "flex-start" }}>
        {isFree ? (
          <div>
            <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontStyle: "italic", fontSize: "clamp(2.2rem, 4.5vw, 3rem)", lineHeight: 0.88, textTransform: "uppercase", color: cfg.color, letterSpacing: "-0.02em" }}>
              Open
            </div>
            <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontStyle: "italic", fontSize: "clamp(2.2rem, 4.5vw, 3rem)", lineHeight: 0.88, textTransform: "uppercase", color: cfg.color, letterSpacing: "-0.02em" }}>
              Access
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", alignItems: "flex-start", gap: 3 }}>
            <span style={{ fontSize: 16, fontWeight: 700, color: D.faint, marginTop: 10, lineHeight: 1 }}>$</span>
            <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontStyle: "italic", fontSize: "clamp(2.5rem, 5vw, 3.5rem)", lineHeight: 1, letterSpacing: "-0.02em", color: D.text }}>
              {price}
            </span>
            <span style={{ fontSize: 11, color: D.faint, marginTop: 14, lineHeight: 1 }}>/mo</span>
          </div>
        )}
      </div>

      {/* Divider */}
      <div style={{ height: "0.5px", background: D.border, marginBottom: 22 }} />

      {/* Features */}
      <div style={{ flex: 1, marginBottom: 26 }}>
        {perks.map((perk, i) => (
          <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start", marginBottom: 11 }}>
            <span style={{ color: cfg.color, fontSize: 10, flexShrink: 0, marginTop: 2, fontWeight: 700 }}>✓</span>
            <span style={{ fontSize: 12, color: D.dim, lineHeight: 1.55 }}>{perk}</span>
          </div>
        ))}
      </div>

      {/* CTA */}
      <button
        className="cp-btn"
        type="button"
        onClick={() => onSubscribe(tier)}
        disabled={!!checkoutTier}
        style={{
          width:      "100%",
          padding:    "13px",
          background: isActive ? cfg.color + "99" : cfg.color,
          color:      "#fff",
          border:     "none",
          cursor:     checkoutTier ? "not-allowed" : "pointer",
          opacity:    checkoutTier && !isActive ? 0.35 : 1,
          fontSize:   11,
          fontWeight: 800,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          fontFamily: "inherit",
          display:    "flex",
          alignItems: "center",
          justifyContent: "center",
          gap:        8,
          borderRadius: 2,
        }}
      >
        {isActive ? (
          <>
            <span style={{ display: "inline-block", width: 11, height: 11, border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
            {isFree ? "Setting up…" : "Redirecting…"}
          </>
        ) : (
          isFree ? "Access for Free →" : "Subscribe →"
        )}
      </button>

      {!user && (
        <p style={{ textAlign: "center", marginTop: 10, fontSize: 11, color: D.faint }}>
          <a href={`/login?next=/trainer/${slug}`} style={{ color: cfg.color, fontWeight: 700, textDecoration: "none" }}>
            Log in
          </a>{" "}to {isFree ? "access" : "subscribe"}
        </p>
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function TrainerProfile() {
  const router   = useRouter();
  const { slug } = router.query;
  const { user, authReady } = useAuthContext();

  const [trainer,       setTrainer]       = useState(null);
  const [previewVideos, setPreview]        = useState([]);
  const [totalVideos,   setTotal]          = useState(0);
  const [clientTier,    setClientTier]     = useState(null);
  const [loading,       setLoading]        = useState(true);
  const [checkoutTier,  setCheckoutTier]   = useState(null);
  const [checkoutError, setCheckoutError]  = useState("");
  const [scrolled,      setScrolled]       = useState(false);

  const plansRef = useRef(null);

  // Scroll detection for nav
  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 80);
    window.addEventListener("scroll", fn, { passive: true });
    return () => window.removeEventListener("scroll", fn);
  }, []);

  // Fetch trainer + videos
  useEffect(() => {
    if (!slug) return;
    fetch(`/api/commercial/trainer-public?slug=${slug}`)
      .then(r => { if (!r.ok) { router.replace("/404"); return null; } return r.json(); })
      .then(data => {
        if (!data) return;
        setTrainer(data.trainer);
        return fetch(`/api/commercial/trainer-videos-public?slug=${slug}`)
          .then(r => r.ok ? r.json() : { videos: [], total: 0 })
          .then(({ videos, total }) => { setPreview(videos ?? []); setTotal(total ?? 0); });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [slug, router]);

  // Fetch client access
  useEffect(() => {
    if (!slug || !authReady || !user) return;
    fetch(`/api/commercial/client-access?slug=${slug}`, { credentials: "include" })
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data?.tier) setClientTier(data.tier); })
      .catch(() => {});
  }, [slug, user, authReady]);

  const handleSubscribe = useCallback(async (tier) => {
    if (!user) { router.push(`/login?next=/trainer/${slug}`); return; }

    setCheckoutError("");
    setCheckoutTier(tier);

    const f         = trainer?.fields ?? {};
    const tierPrice = Number(f[TIER[tier].priceKey] ?? 1);

    // Free tier — bypass Stripe
    if (tierPrice === 0) {
      try {
        const res  = await fetch("/api/commercial/subscribe-free", {
          method: "POST", credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ slug, tier }),
        });
        const data = await res.json();
        if (res.ok) {
          window.location.href = `/trainer/${slug}?checkout=success&tier=${tier}`;
        }
        else { setCheckoutError(data.error || "Something went wrong."); setCheckoutTier(null); }
      } catch { setCheckoutError("Connection error. Please try again."); setCheckoutTier(null); }
      return;
    }

    // Paid — Stripe
    try {
      const res  = await fetch("/api/commercial/create-checkout", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, tier }),
      });
      const data = await res.json();
      if (!res.ok) { setCheckoutError(data.error || "Something went wrong."); setCheckoutTier(null); return; }
      window.location.href = data.url;
    } catch { setCheckoutError("Connection error. Please try again."); setCheckoutTier(null); }
  }, [user, trainer, slug, router]);

  const checkoutSuccess = router.query.checkout === "success";
  const successTier     = router.query.tier || "";
  const scrollToPlans   = () => plansRef.current?.scrollIntoView({ behavior: "smooth" });

  // ── Loading ──────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: D.bg, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "system-ui, sans-serif" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 14, height: 14, border: "2px solid rgba(255,255,255,0.1)", borderTopColor: D.red, borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
          <span style={{ fontSize: 12, color: D.faint, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase" }}>Loading</span>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (!trainer) return null;

  const f         = trainer.fields ?? {};
  const nameParts = splitName(f.name);
  const hasPaid   = ["Basic","Premium","Ultra"].some(t => {
    const p = f[TIER[t].priceKey];
    return !(p === null || p === undefined || p === "") && Number(p) > 0;
  });

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <>
      <Head>
        <title>{f.name} · {f.specialty} · CheckPeak</title>
        <meta name="description" content={f.bio || `Train with ${f.name} on CheckPeak.`} />
      </Head>

      <div style={{ background: D.bg, color: D.text, minHeight: "100vh", fontFamily: "system-ui, -apple-system, sans-serif", overflowX: "hidden" }}>

        {/* ── STICKY NAV ── */}
        <nav
          className="cp-nav"
          style={{
            position:   "fixed",
            top:        0,
            left:       0,
            right:      0,
            zIndex:     100,
            padding:    "0 40px",
            height:     56,
            display:    "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: scrolled ? "rgba(7,8,8,0.92)" : "transparent",
            backdropFilter: scrolled ? "blur(12px)" : "none",
            borderBottom: scrolled ? `0.5px solid ${D.border}` : "none",
          }}
        >
          <a href="/" style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: 15, letterSpacing: "0.12em", textTransform: "uppercase", color: scrolled ? D.text : "rgba(255,255,255,0.7)", textDecoration: "none" }}
            className="cp-nav-a">
            CheckPeak
          </a>

          <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
            {clientTier && (
              <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", color: D.faint }}>
                {clientTier} plan
              </span>
            )}
            {!user && authReady && (
              <a href={`/login?next=/trainer/${slug}`}
                className="cp-nav-a"
                style={{ fontSize: 12, fontWeight: 700, color: D.faint, textDecoration: "none", letterSpacing: "0.04em" }}>
                Log in →
              </a>
            )}
            {user && clientTier && (
              <a href={`/trainer/${slug}/library`}
                style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", padding: "7px 16px", background: D.red, color: "#fff", textDecoration: "none", borderRadius: 2 }}>
                My Library
              </a>
            )}
          </div>
        </nav>

        {/* ── CHECKOUT SUCCESS BANNER ── */}
        {checkoutSuccess && (
          <div style={{ position: "relative", zIndex: 10, padding: "20px 40px", background: "rgba(35,134,54,0.1)", borderBottom: "0.5px solid rgba(63,185,80,0.2)", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
            <div>
              <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontStyle: "italic", fontSize: "1.3rem", letterSpacing: "-0.01em", textTransform: "uppercase", color: "#3FB950", marginBottom: 2 }}>
                You're In.
              </p>
              <p style={{ fontSize: 12, color: D.dim }}>
                {successTier ? `${successTier} plan · ` : ""}Access granted. Your library is ready.
              </p>
            </div>
            <a href={`/trainer/${slug}/library`}
              style={{ padding: "10px 22px", background: "#238636", color: "#fff", textDecoration: "none", fontSize: 12, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", borderRadius: 2 }}>
              Open Library →
            </a>
          </div>
        )}

        {/* ── HERO ── */}
        <section style={{
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          position: "relative",
          overflow: "hidden",
          background: `
            radial-gradient(ellipse 90% 70% at 50% -8%, rgba(218,54,51,0.1) 0%, transparent 58%),
            radial-gradient(ellipse 50% 40% at 80% 90%, rgba(218,54,51,0.04) 0%, transparent 60%),
            repeating-linear-gradient(0deg, transparent, transparent 47px, rgba(255,255,255,0.012) 47px, rgba(255,255,255,0.012) 48px),
            repeating-linear-gradient(90deg, transparent, transparent 47px, rgba(255,255,255,0.012) 47px, rgba(255,255,255,0.012) 48px),
            #070808
          `,
        }}>
          <div className="cp-hero-inner" style={{ maxWidth: 1000, margin: "0 auto", width: "100%", padding: "0 56px", paddingTop: 80 }}>

            {/* Red label row */}
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 32, animation: "fadeUp 0.5s ease 0.1s both" }}>
              <div style={{ width: 32, height: 2.5, background: D.red, borderRadius: 1 }} />
              <span style={{ fontSize: 9, fontWeight: 900, letterSpacing: "0.25em", textTransform: "uppercase", color: D.red }}>
                CheckPeak Commercial
              </span>
            </div>

            {/* Coach name — the monument */}
            <div style={{ marginBottom: 28, animation: "fadeUp 0.6s ease 0.18s both" }}>
              {nameParts.map((part, i) => (
                <div
                  key={i}
                  className="cp-hero-name"
                  style={{
                    fontFamily:     "'Barlow Condensed', sans-serif",
                    fontWeight:     900,
                    fontStyle:      "italic",
                    fontSize:       "clamp(4rem, 12.5vw, 9.5rem)",
                    lineHeight:     0.86,
                    letterSpacing:  "-0.025em",
                    textTransform:  "uppercase",
                    color:          D.text,
                    display:        "block",
                    userSelect:     "none",
                  }}
                >
                  {part}
                </div>
              ))}
            </div>

            {/* Specialty */}
            <div style={{ marginBottom: bio => bio ? 18 : 36, animation: "fadeUp 0.6s ease 0.26s both" }}>
              <span style={{
                display:       "inline-flex",
                alignItems:    "center",
                gap:           8,
                padding:       "6px 16px",
                border:        `0.5px solid rgba(255,255,255,0.16)`,
                fontSize:      10,
                fontWeight:    700,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                color:         D.dim,
              }}>
                {f.specialty}
              </span>
            </div>

            {/* Bio */}
            {f.bio && (
              <p style={{
                fontSize:           15,
                lineHeight:         1.7,
                color:              "rgba(255,255,255,0.44)",
                maxWidth:           520,
                marginBottom:       36,
                display:            "-webkit-box",
                WebkitLineClamp:    2,
                WebkitBoxOrient:    "vertical",
                overflow:           "hidden",
                animation:          "fadeUp 0.6s ease 0.32s both",
              }}>
                {f.bio}
              </p>
            )}

            {/* Stats */}
            <div className="cp-stat-row" style={{ display: "flex", gap: 40, marginBottom: 48, animation: "fadeUp 0.6s ease 0.38s both" }}>
              {[
                { value: totalVideos, label: "Videos"   },
                { value: f.activeClientCount ?? 0, label: "Athletes" },
              ].map(({ value, label }) => (
                <div key={label}>
                  <div style={{
                    fontFamily:    "'Barlow Condensed', sans-serif",
                    fontWeight:    900,
                    fontStyle:     "italic",
                    fontSize:      "clamp(2.2rem, 5vw, 4rem)",
                    lineHeight:    1,
                    letterSpacing: "-0.03em",
                    color:         D.text,
                  }}>
                    {value}
                  </div>
                  <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: "0.18em", textTransform: "uppercase", color: D.faint, marginTop: 5 }}>
                    {label}
                  </div>
                </div>
              ))}
            </div>

            {/* CTAs */}
            <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap", animation: "fadeUp 0.6s ease 0.44s both" }}>
              {!clientTier ? (
                <>
                  <button
                    className="cp-btn"
                    onClick={scrollToPlans}
                    style={{
                      padding:       "15px 40px",
                      background:    D.red,
                      color:         "#fff",
                      border:        "none",
                      cursor:        "pointer",
                      fontSize:      12,
                      fontWeight:    800,
                      letterSpacing: "0.14em",
                      textTransform: "uppercase",
                      fontFamily:    "inherit",
                      borderRadius:  2,
                    }}
                  >
                    Start Training →
                  </button>
                  {previewVideos.length > 0 && (
                    <button
                      className="cp-ghost-btn"
                      onClick={() => document.getElementById("cp-program")?.scrollIntoView({ behavior: "smooth" })}
                      style={{
                        padding:       "14px 28px",
                        background:    "transparent",
                        color:         D.dim,
                        border:        `0.5px solid rgba(255,255,255,0.18)`,
                        cursor:        "pointer",
                        fontSize:      12,
                        fontWeight:    700,
                        letterSpacing: "0.12em",
                        textTransform: "uppercase",
                        fontFamily:    "inherit",
                        borderRadius:  2,
                      }}
                    >
                      View Program
                    </button>
                  )}
                </>
              ) : (
                <a
                  href={`/trainer/${slug}/library`}
                  style={{
                    padding:       "15px 40px",
                    background:    D.red,
                    color:         "#fff",
                    textDecoration:"none",
                    fontSize:      12,
                    fontWeight:    800,
                    letterSpacing: "0.14em",
                    textTransform: "uppercase",
                    borderRadius:  2,
                    display:       "inline-block",
                  }}
                >
                  Open Library →
                </a>
              )}
            </div>
          </div>

          {/* Scroll chevron */}
          <div style={{ position: "absolute", bottom: 36, left: "50%", animation: "chevronBounce 2s ease-in-out infinite" }}>
            <svg width="22" height="13" viewBox="0 0 22 13" fill="none">
              <path d="M1 1L11 11L21 1" stroke="rgba(255,255,255,0.22)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        </section>

        {/* ── PROGRAM / VIDEOS SECTION ── */}
        {previewVideos.length > 0 && (
          <section id="cp-program" style={{ background: D.bgSection, padding: "88px 56px" }} className="cp-section">
            <div style={{ maxWidth: 1000, margin: "0 auto" }}>

              {/* Header */}
              <div style={{ marginBottom: 52 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
                  <div style={{ width: 24, height: 2, background: D.red }} />
                  <span style={{ fontSize: 9, fontWeight: 900, letterSpacing: "0.22em", textTransform: "uppercase", color: D.red }}>
                    The Program
                  </span>
                </div>
                <h2 style={{
                  fontFamily:    "'Barlow Condensed', sans-serif",
                  fontWeight:    900,
                  fontStyle:     "italic",
                  fontSize:      "clamp(2.2rem, 6vw, 5rem)",
                  lineHeight:    0.88,
                  letterSpacing: "-0.025em",
                  textTransform: "uppercase",
                  color:         D.text,
                  marginBottom:  14,
                }}>
                  {totalVideos} Workouts.<br />
                  Filmed. Indexed.<br />
                  Yours.
                </h2>
                <p style={{ fontSize: 13, color: D.faint, maxWidth: 380, lineHeight: 1.65 }}>
                  Subscribe to unlock the full library and train with {f.name?.split(" ")[0] || "this coach"} from anywhere.
                </p>
              </div>

              {/* Video grid */}
              <div
                className="cp-vid-grid"
                style={{
                  display:               "grid",
                  gridTemplateColumns:   previewVideos.length > 1 ? "3fr 2fr" : "1fr",
                  gap:                   10,
                }}
              >
                <VideoCard video={previewVideos[0]} isLarge isLocked={!clientTier} />
                {previewVideos.length > 1 && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {previewVideos.slice(1, 3).map(v => (
                      <VideoCard key={v.id} video={v} isLocked={!clientTier} />
                    ))}
                  </div>
                )}
              </div>

              {totalVideos > previewVideos.length && (
                <div style={{ marginTop: 22, display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ flex: 1, height: "0.5px", background: D.border }} />
                  <span style={{ fontSize: 11, color: D.faint, whiteSpace: "nowrap", letterSpacing: "0.04em" }}>
                    + {totalVideos - previewVideos.length} more inside the program
                  </span>
                  <div style={{ flex: 1, height: "0.5px", background: D.border }} />
                </div>
              )}
            </div>
          </section>
        )}

        {/* ── PLANS SECTION ── */}
        <section
          ref={plansRef}
          style={{
            padding:    "88px 56px 100px",
            background: `
              radial-gradient(ellipse 60% 50% at 50% 110%, rgba(218,54,51,0.06) 0%, transparent 60%),
              ${D.bg}
            `,
          }}
          className="cp-section"
        >
          <div style={{ maxWidth: 1000, margin: "0 auto" }}>

            {/* Header */}
            <div style={{ marginBottom: 56 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
                <div style={{ width: 24, height: 2, background: D.red }} />
                <span style={{ fontSize: 9, fontWeight: 900, letterSpacing: "0.22em", textTransform: "uppercase", color: D.red }}>
                  {clientTier ? "Your Access" : "Choose Your Level"}
                </span>
              </div>

              {clientTier ? (
                <div>
                  <h2 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontStyle: "italic", fontSize: "clamp(2.5rem, 7vw, 5.5rem)", lineHeight: 0.88, letterSpacing: "-0.025em", textTransform: "uppercase", color: "#3FB950", marginBottom: 14 }}>
                    You're In.
                  </h2>
                  <p style={{ fontSize: 14, color: D.dim, marginBottom: 28 }}>
                    {clientTier} plan · Your library is ready.
                  </p>
                  <a
                    href={`/trainer/${slug}/library`}
                    style={{ display: "inline-block", padding: "15px 40px", background: D.red, color: "#fff", textDecoration: "none", fontSize: 12, fontWeight: 800, letterSpacing: "0.14em", textTransform: "uppercase", borderRadius: 2 }}
                  >
                    Open Library →
                  </a>
                </div>
              ) : (
                <>
                  <h2 style={{
                    fontFamily:    "'Barlow Condensed', sans-serif",
                    fontWeight:    900,
                    fontStyle:     "italic",
                    fontSize:      "clamp(2.5rem, 7vw, 5.5rem)",
                    lineHeight:    0.88,
                    letterSpacing: "-0.025em",
                    textTransform: "uppercase",
                    color:         D.text,
                    marginBottom:  14,
                  }}>
                    Your Level.<br />
                    Your Program.
                  </h2>
                  <p style={{ fontSize: 13, color: D.faint, maxWidth: 420, lineHeight: 1.65 }}>
                    Pick the plan that fits your commitment. Upgrade or cancel anytime.
                  </p>
                </>
              )}
            </div>

            {/* Error */}
            {checkoutError && (
              <div style={{ marginBottom: 24, padding: "12px 18px", background: "rgba(218,54,51,0.1)", border: `0.5px solid rgba(218,54,51,0.3)`, borderRadius: 2, fontSize: 13, color: "#FF7B72", fontWeight: 600 }}>
                {checkoutError}
              </div>
            )}

            {/* Plan cards */}
            {!clientTier && (
              <>
                <div
                  className="cp-plan-grid"
                  style={{
                    display:             "grid",
                    gridTemplateColumns: `repeat(${["Basic","Premium","Ultra"].filter(t => { const p = f[TIER[t].priceKey]; return !(p === null || p === undefined || p === ""); }).length}, 1fr)`,
                    gap:                 16,
                    marginBottom:        32,
                  }}
                >
                  {["Basic", "Premium", "Ultra"].map(tier => {
                    const price = f[TIER[tier].priceKey];
                    if (price === null || price === undefined || price === "") return null;
                    return (
                      <PlanCard
                        key={tier}
                        tier={tier}
                        f={f}
                        onSubscribe={handleSubscribe}
                        checkoutTier={checkoutTier}
                        user={user}
                        slug={slug}
                      />
                    );
                  })}
                </div>

                {/* Stripe note */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                  {hasPaid && (
                    <>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                        <rect x="2" y="5" width="20" height="14" rx="2" stroke="rgba(255,255,255,0.2)" strokeWidth="1.5"/>
                        <path d="M2 10h20" stroke="rgba(255,255,255,0.2)" strokeWidth="1.5"/>
                      </svg>
                      <span style={{ fontSize: 11, color: D.faint }}>Secure checkout powered by Stripe · Cancel anytime</span>
                    </>
                  )}
                  {!hasPaid && (
                    <span style={{ fontSize: 11, color: D.faint }}>Free access · No credit card required</span>
                  )}
                </div>
              </>
            )}
          </div>
        </section>

        {/* ── FOOTER ── */}
        <footer style={{ borderTop: `0.5px solid ${D.border}`, padding: "28px 56px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
          <a href="/"
            style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: 13, letterSpacing: "0.16em", textTransform: "uppercase", color: "rgba(255,255,255,0.18)", textDecoration: "none" }}
            className="cp-nav-a">
            CheckPeak
          </a>
          <span style={{ fontSize: 10, color: "rgba(255,255,255,0.14)", letterSpacing: "0.06em" }}>
            Commercial Platform · {new Date().getFullYear()}
          </span>
        </footer>

      </div>

      {/* Global styles */}
      <style>{GLOBAL_CSS}</style>
    </>
  );
}