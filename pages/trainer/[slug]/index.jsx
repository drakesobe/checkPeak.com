// pages/trainer/[slug]/index.jsx
// Public trainer profile — CheckPeak Commercial.
// Subscribers see: current plan, upgrade options, cancel subscription.
"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/router";
import { useAuthContext } from "@/hooks/useAuth";
import Head from "next/head";

const D = {
  bg:        "#070808",
  bgSection: "#0D1117",
  bgCard:    "#0F1318",
  border:    "rgba(255,255,255,0.07)",
  borderMid: "rgba(255,255,255,0.13)",
  text:      "#F0F6FC",
  dim:       "rgba(255,255,255,0.52)",
  faint:     "rgba(255,255,255,0.26)",
  whisper:   "rgba(255,255,255,0.1)",
  red:       "#DA3633",
};

const TIER = {
  Basic:   { color: "#3FB950", glow: "rgba(63,185,80,0.12)",   priceKey: "basicPrice",   perksKey: "basicPerks",   rank: 1 },
  Premium: { color: "#F0883E", glow: "rgba(240,136,62,0.12)",  priceKey: "premiumPrice", perksKey: "premiumPerks", rank: 2 },
  Ultra:   { color: "#79B8FF", glow: "rgba(121,184,255,0.12)", priceKey: "ultraPrice",   perksKey: "ultraPerks",   rank: 3 },
};

const DEFAULT_PERKS = {
  Basic:   ["Full video library access", "Filter by workout type & difficulty", "Watch on any device"],
  Premium: ["Everything in Basic", "Custom workouts built by your trainer", "Workout calendar assignments"],
  Ultra:   ["Everything in Premium", "In-person training sessions", "Direct trainer access"],
};

function parsePerks(raw, tier) {
  try { return JSON.parse(raw || "null") || DEFAULT_PERKS[tier]; }
  catch { return DEFAULT_PERKS[tier]; }
}

function muxThumb(id, w = 640, h = 360) {
  return `https://image.mux.com/${id}/thumbnail.jpg?width=${w}&height=${h}&fit_mode=smartcrop`;
}

function splitName(name = "") {
  const parts = name.trim().split(/\s+/);
  if (parts.length <= 1) return [name];
  if (parts.length === 2) return parts;
  return [parts[0], parts.slice(1).join(" ")];
}

const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:ital,wght@0,700;0,900;1,700;1,900&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  @keyframes fadeUp   { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:translateY(0); } }
  @keyframes fadeIn   { from { opacity:0; } to { opacity:1; } }
  @keyframes spin     { to { transform:rotate(360deg); } }
  @keyframes bounce   { 0%,100%{transform:translateY(0) translateX(-50%)} 50%{transform:translateY(7px) translateX(-50%)} }
  @keyframes slideDown { from { opacity:0; transform:translateY(-8px); } to { opacity:1; transform:translateY(0); } }

  .cp-nav { transition: background 0.3s, border-color 0.3s, backdrop-filter 0.3s; }
  .cp-nav-a { transition: color 0.15s; }
  .cp-nav-a:hover { color: #fff !important; }
  .cp-vid { transition: transform 0.2s, box-shadow 0.2s, border-color 0.2s; }
  .cp-vid:hover { transform: translateY(-2px) scale(1.01); box-shadow: 0 16px 40px rgba(0,0,0,0.6); border-color: rgba(255,255,255,0.16) !important; }
  .cp-vid .overlay { opacity:0; transition: opacity 0.18s; }
  .cp-vid:hover .overlay { opacity:1; }
  .cp-plan { transition: transform 0.18s, box-shadow 0.18s; }
  .cp-plan:hover { transform: translateY(-3px); box-shadow: 0 20px 48px rgba(0,0,0,0.5); }
  .cp-btn { transition: opacity 0.14s, transform 0.1s; }
  .cp-btn:hover:not(:disabled) { opacity: 0.84; }
  .cp-btn:active:not(:disabled) { transform: scale(0.98); }
  .ghost { transition: background 0.14s, border-color 0.14s; }
  .ghost:hover { background: rgba(255,255,255,0.07) !important; border-color: rgba(255,255,255,0.28) !important; }
  .cancel-link { transition: color 0.14s; }
  .cancel-link:hover { color: rgba(255,255,255,0.5) !important; }

  @media (max-width: 900px) {
    .hero-grid { grid-template-columns: 1fr !important; }
    .hero-right { display: none !important; }
    .hero-name  { font-size: clamp(3rem, 14vw, 6rem) !important; }
    .cp-section { padding: 56px 24px !important; }
    .cp-plan-grid { grid-template-columns: 1fr !important; }
  }
`;

// ─── Video preview card ───────────────────────────────────────────────────────
function VideoCard({ video, isLarge, isLocked }) {
  const f     = video?.fields ?? {};
  const thumb = videoThumb(f, isLarge ? 900 : 480, isLarge ? 506 : 270);

  return (
    <div className="cp-vid" style={{ position: "relative", borderRadius: 2, overflow: "hidden", background: D.bgCard, border: `0.5px solid ${D.border}`, aspectRatio: "16/9" }}>
      {thumb
        ? <img src={thumb} alt={f.title} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
        : <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}><svg width="32" height="32" viewBox="0 0 24 24" fill="none"><polygon points="5,3 19,12 5,21" fill="rgba(255,255,255,0.1)" /></svg></div>
      }
      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.15) 55%, transparent 100%)" }} />
      <div className="overlay" style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.2)" }}>
        <div style={{ width: 44, height: 44, borderRadius: "50%", background: "rgba(255,255,255,0.1)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid rgba(255,255,255,0.2)" }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><polygon points="5,3 19,12 5,21" fill="rgba(255,255,255,0.9)" /></svg>
        </div>
      </div>
      {isLocked && (
        <div style={{ position: "absolute", top: 10, right: 10, padding: "3px 9px", background: "rgba(0,0,0,0.72)", backdropFilter: "blur(6px)", border: "0.5px solid rgba(255,255,255,0.12)", fontSize: 9, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.38)" }}>
          Members only
        </div>
      )}
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: isLarge ? "16px 18px" : "10px 14px" }}>
        <p style={{ fontSize: isLarge ? 13 : 10, fontWeight: 700, color: D.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", letterSpacing: "-0.01em" }}>
          {f.title || "Untitled"}
        </p>
      </div>
    </div>
  );
}

function ytId(url = "") {
  const m = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{11})/);
  return m ? m[1] : null;
}

// Best available thumbnail: stored → Mux → YouTube-derived → none.
function videoThumb(f = {}, w = 480, h = 270) {
  if (f.thumbnailUrl) return f.thumbnailUrl;                 // captured at save time (Vimeo, etc.)
  if (f.muxPlaybackId) return `https://image.mux.com/${f.muxPlaybackId}/thumbnail.jpg?width=${w}&height=${h}&fit_mode=smartcrop`;
  const yt = ytId(f.embedUrl);
  if (yt) return `https://img.youtube.com/vi/${yt}/hqdefault.jpg`;
  return null;                                              // Vimeo w/o stored thumb, or unknown source
}

// ─── Plan card (for upgrade) ──────────────────────────────────────────────────
function PlanCard({ tier, f, onSubscribe, checkoutTier, user, slug, isUpgrade = false }) {
  const cfg    = TIER[tier];
  const price  = f[cfg.priceKey];
  const perks  = parsePerks(f[cfg.perksKey], tier);
  const isFree = Number(price) === 0;
  const isActive = checkoutTier === tier;
  const isPop    = tier === "Premium" && !isUpgrade;

  return (
    <div className="cp-plan" style={{ background: D.bgCard, border: `0.5px solid rgba(255,255,255,0.08)`, borderTop: `3px solid ${cfg.color}`, padding: "26px 20px 20px", display: "flex", flexDirection: "column", position: "relative", borderRadius: 2 }}>
      {isPop && (
        <div style={{ position: "absolute", top: 0, right: 18, transform: "translateY(-50%)", background: cfg.color, color: "#fff", fontSize: 8, fontWeight: 900, letterSpacing: "0.14em", textTransform: "uppercase", padding: "3px 9px" }}>
          Most Popular
        </div>
      )}
      {isUpgrade && (
        <div style={{ position: "absolute", top: 0, right: 18, transform: "translateY(-50%)", background: "rgba(255,255,255,0.1)", border: `1px solid ${cfg.color}40`, color: cfg.color, fontSize: 8, fontWeight: 900, letterSpacing: "0.14em", textTransform: "uppercase", padding: "3px 9px", backdropFilter: "blur(4px)" }}>
          Upgrade
        </div>
      )}
      <p style={{ fontSize: 9, fontWeight: 900, letterSpacing: "0.22em", textTransform: "uppercase", color: cfg.color, marginBottom: 16 }}>{tier}</p>
      <div style={{ marginBottom: 22, minHeight: 64, display: "flex", alignItems: "flex-start" }}>
        {isFree ? (
          <div>
            <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontStyle: "italic", fontSize: "clamp(2rem, 4vw, 2.8rem)", lineHeight: 0.88, textTransform: "uppercase", color: cfg.color, letterSpacing: "-0.02em" }}>Open</div>
            <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontStyle: "italic", fontSize: "clamp(2rem, 4vw, 2.8rem)", lineHeight: 0.88, textTransform: "uppercase", color: cfg.color, letterSpacing: "-0.02em" }}>Access</div>
          </div>
        ) : (
          <div style={{ display: "flex", alignItems: "flex-start", gap: 3 }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: D.faint, marginTop: 9, lineHeight: 1 }}>$</span>
            <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontStyle: "italic", fontSize: "clamp(2.2rem, 4.5vw, 3.2rem)", lineHeight: 1, letterSpacing: "-0.02em", color: D.text }}>{price}</span>
            <span style={{ fontSize: 11, color: D.faint, marginTop: 12, lineHeight: 1 }}>/mo</span>
          </div>
        )}
      </div>
      <div style={{ height: "0.5px", background: D.border, marginBottom: 18 }} />
      <div style={{ flex: 1, marginBottom: 22 }}>
        {perks.map((perk, i) => (
          <div key={i} style={{ display: "flex", gap: 9, alignItems: "flex-start", marginBottom: 9 }}>
            <span style={{ color: cfg.color, fontSize: 9, flexShrink: 0, marginTop: 2, fontWeight: 700 }}>✓</span>
            <span style={{ fontSize: 12, color: D.dim, lineHeight: 1.55 }}>{perk}</span>
          </div>
        ))}
      </div>
      <button className="cp-btn" type="button" onClick={() => onSubscribe(tier)} disabled={!!checkoutTier}
        style={{ width: "100%", padding: "12px", background: isActive ? cfg.color + "99" : cfg.color, color: "#fff", border: "none", cursor: checkoutTier ? "not-allowed" : "pointer", opacity: checkoutTier && !isActive ? 0.35 : 1, fontSize: 11, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: 2 }}>
        {isActive
          ? <><span style={{ display: "inline-block", width: 11, height: 11, border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />{isFree ? "Setting up…" : "Redirecting…"}</>
          : isUpgrade ? `Upgrade to ${tier} →` : isFree ? "Access for Free →" : "Subscribe →"
        }
      </button>
      {!user && (
        <p style={{ textAlign: "center", marginTop: 10, fontSize: 11, color: D.faint }}>
          <a href={`/login?next=/trainer/${slug}`} style={{ color: cfg.color, fontWeight: 700, textDecoration: "none" }}>Log in</a>{" "}to {isFree ? "access" : "subscribe"}
        </p>
      )}
    </div>
  );
}

// ─── Cancel confirmation ──────────────────────────────────────────────────────
function CancelConfirm({ onConfirm, onDismiss, cancelling, isPaid }) {
  return (
    <div style={{ animation: "slideDown 0.2s ease both", padding: "20px", background: "rgba(218,54,51,0.06)", border: `0.5px solid rgba(218,54,51,0.2)`, borderRadius: 2 }}>
      <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontStyle: "italic", fontSize: "1.2rem", letterSpacing: "-0.01em", textTransform: "uppercase", color: D.text, marginBottom: 8 }}>
        Cancel subscription?
      </p>
      <p style={{ fontSize: 13, color: D.dim, lineHeight: 1.65, marginBottom: 20 }}>
        {isPaid
          ? "Your access continues until the end of the current billing period. After that, you'll lose access to the library."
          : "You'll lose access to the library immediately."
        }
      </p>
      <div style={{ display: "flex", gap: 10 }}>
        <button
          type="button"
          onClick={onConfirm}
          disabled={cancelling}
          style={{ padding: "10px 22px", background: D.red, border: "none", color: "#fff", fontSize: 11, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", cursor: cancelling ? "not-allowed" : "pointer", opacity: cancelling ? 0.6 : 1, fontFamily: "inherit", borderRadius: 2, display: "flex", alignItems: "center", gap: 8 }}>
          {cancelling && <span style={{ display: "inline-block", width: 11, height: 11, border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />}
          {cancelling ? "Cancelling…" : "Yes, cancel"}
        </button>
        <button
          type="button"
          onClick={onDismiss}
          disabled={cancelling}
          style={{ padding: "10px 22px", background: "transparent", border: `0.5px solid ${D.border}`, color: D.dim, fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", cursor: cancelling ? "not-allowed" : "pointer", fontFamily: "inherit", borderRadius: 2 }}>
          Never mind
        </button>
      </div>
    </div>
  );
}

// ─── One-time item card ───────────────────────────────────────────────────────
function PricedItemCard({ item, itemType, onBuy, buyingItem, user, clientTier }) {
  const f           = item.fields ?? {};
  const price       = Number(f.price);
  const isLoading   = buyingItem === item.id;
  const thumb       = videoThumb(f, 560, 315);
  const tierCfg     = TIER[f.tier];
  const alreadyHas  = tierCfg && TIER[clientTier]?.rank >= tierCfg.rank;

  return (
    <div style={{ background: D.bgCard, border: `0.5px solid ${D.border}`, borderTop: `2px solid ${tierCfg?.color ?? D.red}`, borderRadius: 2, overflow: "hidden", display: "flex", flexDirection: "column" }}>
      {itemType === "video" && (
        <div style={{ position: "relative", paddingBottom: "56.25%", background: "#0A0C10", flexShrink: 0 }}>
          {thumb
            ? <img src={thumb} alt={f.title} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
            : <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}><svg width="28" height="28" viewBox="0 0 24 24" fill="none"><polygon points="5,3 19,12 5,21" fill="rgba(255,255,255,0.08)" /></svg></div>
          }
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(0,0,0,0.75) 0%, transparent 50%)" }} />
          <div style={{ position: "absolute", top: 8, left: 8, padding: "3px 9px", background: "rgba(0,0,0,0.72)", backdropFilter: "blur(6px)", fontSize: 9, fontWeight: 900, letterSpacing: "0.12em", textTransform: "uppercase", color: D.red }}>
            One-Time
          </div>
        </div>
      )}
      {itemType === "workout" && (
        <div style={{ position: "relative", paddingBottom: "56.25%", background: `radial-gradient(ellipse 80% 70% at 50% 50%, ${tierCfg?.color ?? D.red}12 0%, transparent 70%), #0A0C10`, flexShrink: 0 }}>
          <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10 }}>
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke={tierCfg?.color ?? D.red} strokeWidth="1.4" strokeLinecap="round" opacity="0.7"><path d="M6 4v16M18 4v16M6 12h12M3 7h3M18 7h3M3 17h3M18 17h3"/></svg>
            <span style={{ fontSize: 8, fontWeight: 900, letterSpacing: "0.18em", textTransform: "uppercase", color: tierCfg?.color ?? D.red, opacity: 0.7 }}>Workout</span>
          </div>
          <div style={{ position: "absolute", top: 8, left: 8, padding: "3px 9px", background: "rgba(0,0,0,0.72)", backdropFilter: "blur(6px)", fontSize: 9, fontWeight: 900, letterSpacing: "0.12em", textTransform: "uppercase", color: D.red }}>
            One-Time
          </div>
        </div>
      )}
      <div style={{ padding: "12px 16px 16px", flex: 1, display: "flex", flexDirection: "column", gap: 10 }}>
        <div>
          <p style={{ fontSize: 13, fontWeight: 700, color: D.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", letterSpacing: "-0.01em", marginBottom: 4 }}>{f.title || "Untitled"}</p>
          {f.description && itemType === "workout" && (
            <p style={{ fontSize: 11, color: D.faint, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.description}</p>
          )}
          {tierCfg && (
            <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", color: alreadyHas ? tierCfg.color : "rgba(255,255,255,0.22)" }}>
              {alreadyHas ? `${f.tier} · included in your plan` : `Subscribe to ${f.tier} for full access →`}
            </span>
          )}
        </div>
        <button
          type="button"
          className="cp-btn"
          onClick={() => onBuy(itemType, item.id)}
          disabled={!!buyingItem}
          style={{ width: "100%", padding: "11px", background: isLoading ? `${D.red}88` : D.red, color: "#fff", border: "none", cursor: buyingItem ? "not-allowed" : "pointer", fontSize: 11, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", fontFamily: "inherit", borderRadius: 2, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, opacity: buyingItem && !isLoading ? 0.4 : 1 }}>
          {isLoading
            ? <><span style={{ display: "inline-block", width: 11, height: 11, border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />Redirecting…</>
            : !user ? `Log In to Unlock · $${price}` : `Own It · $${price} →`
          }
        </button>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function TrainerProfile() {
  const router   = useRouter();
  const { slug } = router.query;
  const { user, authReady } = useAuthContext();

  const [trainer,        setTrainer]       = useState(null);
  const [previewVideos,  setPreview]       = useState([]);
  const [totalVideos,    setTotal]         = useState(0);
  const [totalWorkouts,  setTotalWorkouts] = useState(0);
  const [pricedVideos,   setPricedVideos]  = useState([]);
  const [pricedWorkouts, setPricedWorkouts]= useState([]);
  const [clientTier,     setClientTier]    = useState(null);
  const [loading,        setLoading]       = useState(true);
  const [checkoutTier,   setCheckoutTier]  = useState(null);
  const [checkoutError,  setCheckoutError] = useState("");
  const [buyingItem,     setBuyingItem]    = useState(null);
  const [buyError,       setBuyError]      = useState("");
  const [scrolled,       setScrolled]      = useState(false);

  // Cancel state
  const [cancelMode,    setCancelMode]   = useState(false);
  const [cancelling,    setCancelling]   = useState(false);
  const [cancelDone,    setCancelDone]   = useState(false);
  const [cancelError,   setCancelError]  = useState("");

  const plansRef = useRef(null);

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 60);
    window.addEventListener("scroll", fn, { passive: true });
    return () => window.removeEventListener("scroll", fn);
  }, []);

  useEffect(() => {
    if (!slug) return;
    fetch(`/api/commercial/trainer-public?slug=${slug}`)
      .then(r => { if (!r.ok) { router.replace("/404"); return null; } return r.json(); })
      .then(data => {
        if (!data) return;
        setTrainer(data.trainer);
        return fetch(`/api/commercial/trainer-videos-public?slug=${slug}`)
          .then(r => r.ok ? r.json() : { videos: [], total: 0, totalVideos: 0, totalWorkouts: 0, pricedVideos: [], pricedWorkouts: [] })
          .then(({ videos, total, totalVideos, totalWorkouts, pricedVideos: pv, pricedWorkouts: pw }) => {
            setPreview(videos ?? []);
            setTotal(totalVideos ?? total ?? 0);
            setTotalWorkouts(totalWorkouts ?? 0);
            setPricedVideos(pv ?? []);
            setPricedWorkouts(pw ?? []);
          });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [slug, router]);

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

    if (tierPrice === 0) {
      try {
        const res  = await fetch("/api/commercial/subscribe-free", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug, tier }) });
        const data = await res.json();
        if (res.ok) { window.location.href = `/trainer/${slug}/welcome?tier=${tier}`; }
        else { setCheckoutError(data.error || "Something went wrong."); setCheckoutTier(null); }
      } catch { setCheckoutError("Connection error."); setCheckoutTier(null); }
      return;
    }

    try {
      const res  = await fetch("/api/commercial/create-checkout", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug, tier }) });
      const data = await res.json();
      if (!res.ok) { setCheckoutError(data.error || "Something went wrong."); setCheckoutTier(null); return; }
      window.location.href = data.url;
    } catch { setCheckoutError("Connection error."); setCheckoutTier(null); }
  }, [user, trainer, slug, router]);

  const handleCancel = useCallback(async () => {
    setCancelError("");
    setCancelling(true);
    try {
      const res  = await fetch("/api/commercial/cancel", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Something went wrong.");
      setCancelDone(true);
      setCancelMode(false);
      setClientTier(null);
    } catch (e) {
      setCancelError(e.message);
      setCancelling(false);
    }
  }, [slug]);

  const handleBuyItem = useCallback(async (itemType, itemId) => {
    if (!user) { router.push(`/login?next=/trainer/${slug}`); return; }
    setBuyError("");
    setBuyingItem(itemId);
    try {
      const res  = await fetch("/api/commercial/purchase-checkout", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, itemType, itemId, returnTo: "profile" }),
      });
      const data = await res.json();
      if (res.ok && data.url) { window.location.href = data.url; }
      else { setBuyError(data.error || "Could not start checkout."); setBuyingItem(null); }
    } catch { setBuyError("Connection error."); setBuyingItem(null); }
  }, [user, slug, router]);

  const checkoutSuccess = router.query.checkout === "success";
  const successTier     = router.query.tier || "";

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: D.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 14, height: 14, border: "2px solid rgba(255,255,255,0.08)", borderTopColor: D.red, borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
          <span style={{ fontSize: 11, color: D.faint, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", fontFamily: "system-ui, sans-serif" }}>Loading</span>
        </div>
        <style>{`@keyframes spin { to { transform:rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (!trainer) return null;

  const f              = trainer.fields ?? {};
  const nameParts      = splitName(f.name ?? "");
  const hasPaid        = ["Basic","Premium","Ultra"].some(t => { const p = f[TIER[t].priceKey]; return !(p === null || p === undefined || p === "") && Number(p) > 0; });
  const availableTiers = ["Basic","Premium","Ultra"].filter(t => { const p = f[TIER[t].priceKey]; return !(p === null || p === undefined || p === ""); });
  const clientTierRank = TIER[clientTier]?.rank ?? 0;

  // Tiers the client can upgrade to (available && higher rank than current)
  const upgradableTiers = availableTiers.filter(t => TIER[t].rank > clientTierRank);

  // Is client on a paid plan?
  const clientIsPaid = clientTier ? Number(f[TIER[clientTier]?.priceKey] ?? 0) > 0 : false;

  const stats = [
    totalVideos   > 0 && { value: totalVideos,   label: "Videos"   },
    totalWorkouts > 0 && { value: totalWorkouts,  label: "Workouts" },
  ].filter(Boolean);

  return (
    <>
      <Head>
        <title>{f.name} · {f.specialty} · CheckPeak</title>
        <meta name="description" content={f.bio || `Train with ${f.name} on CheckPeak.`} />
      </Head>
      <style>{CSS}</style>

      <div style={{ background: D.bg, color: D.text, minHeight: "100vh", fontFamily: "system-ui, -apple-system, sans-serif", overflowX: "hidden" }}>

        {/* ── NAV ── */}
        <nav className="cp-nav" style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 100, padding: "0 40px", height: 54, display: "flex", alignItems: "center", justifyContent: "space-between", background: scrolled ? "rgba(7,8,8,0.94)" : "transparent", backdropFilter: scrolled ? "blur(12px)" : "none", borderBottom: scrolled ? `0.5px solid ${D.border}` : "none" }}>
          <a href="/" className="cp-nav-a" style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: 14, letterSpacing: "0.12em", textTransform: "uppercase", color: scrolled ? D.text : "rgba(255,255,255,0.65)", textDecoration: "none" }}>CheckPeak</a>
          <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
            {clientTier && <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", color: D.faint }}>{clientTier} plan</span>}
            {!user && authReady && <a href={`/login?next=/trainer/${slug}`} className="cp-nav-a" style={{ fontSize: 12, fontWeight: 700, color: D.faint, textDecoration: "none" }}>Log in →</a>}
            {user && clientTier && (
              <a href={`/trainer/${slug}/library`} style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", padding: "7px 16px", background: D.red, color: "#fff", textDecoration: "none", borderRadius: 2 }}>
                My Library
              </a>
            )}
          </div>
        </nav>

        {/* ── CHECKOUT SUCCESS ── */}
        {checkoutSuccess && (
          <div style={{ position: "relative", zIndex: 10, padding: "18px 40px", background: "rgba(35,134,54,0.08)", borderBottom: "0.5px solid rgba(63,185,80,0.18)", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
            <div>
              <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontStyle: "italic", fontSize: "1.2rem", letterSpacing: "-0.01em", textTransform: "uppercase", color: "#3FB950", marginBottom: 2 }}>You're In.</p>
              <p style={{ fontSize: 12, color: D.dim }}>{successTier ? `${successTier} plan · ` : ""}Access granted. Your library is ready.</p>
            </div>
            <a href={`/trainer/${slug}/library`} style={{ padding: "9px 20px", background: "#238636", color: "#fff", textDecoration: "none", fontSize: 12, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", borderRadius: 2 }}>
              Open Library →
            </a>
          </div>
        )}

        {/* ── CANCELLATION DONE BANNER ── */}
        {cancelDone && (
          <div style={{ position: "relative", zIndex: 10, padding: "18px 40px", background: "rgba(218,54,51,0.06)", borderBottom: "0.5px solid rgba(218,54,51,0.18)", display: "flex", alignItems: "center", gap: 12 }}>
            <p style={{ fontSize: 13, color: D.dim }}>
              Subscription cancelled.{" "}
              {clientIsPaid
                ? "You'll keep access until the end of your current billing period."
                : "Your access has been removed."
              }
            </p>
          </div>
        )}

        {/* ── HERO ── */}
        <section style={{
          minHeight: "75vh",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          background: `
            radial-gradient(ellipse 100% 80% at 30% -5%, rgba(218,54,51,0.09) 0%, transparent 55%),
            radial-gradient(ellipse 60% 50% at 85% 95%, rgba(218,54,51,0.04) 0%, transparent 60%),
            repeating-linear-gradient(0deg, transparent, transparent 47px, rgba(255,255,255,0.01) 47px, rgba(255,255,255,0.01) 48px),
            repeating-linear-gradient(90deg, transparent, transparent 47px, rgba(255,255,255,0.01) 47px, rgba(255,255,255,0.01) 48px),
            #070808
          `,
          padding: "0 56px",
        }}>
          <div style={{ maxWidth: 1140, margin: "0 auto", width: "100%", paddingTop: 80, paddingBottom: 48 }}>
            <div className="hero-grid" style={{ display: "grid", gridTemplateColumns: previewVideos.length > 0 ? "1fr 1fr" : "1fr", gap: 64, alignItems: "center" }}>

              {/* LEFT */}
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 24, animation: "fadeUp 0.5s ease 0.1s both" }}>
                  <div style={{ width: 24, height: 2, background: D.red }} />
                  <span style={{ fontSize: 9, fontWeight: 900, letterSpacing: "0.24em", textTransform: "uppercase", color: D.red }}>CheckPeak Commercial</span>
                </div>
                <div style={{ marginBottom: 20, animation: "fadeUp 0.55s ease 0.18s both" }}>
                  {nameParts.map((part, i) => (
                    <div key={i} className="hero-name" style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontStyle: "italic", fontSize: "clamp(3.5rem, 9vw, 7.5rem)", lineHeight: 0.87, letterSpacing: "-0.025em", textTransform: "uppercase", color: D.text, display: "block" }}>{part}</div>
                  ))}
                </div>
                <div style={{ marginBottom: f.bio ? 16 : 28, animation: "fadeUp 0.55s ease 0.24s both" }}>
                  <span style={{ display: "inline-flex", alignItems: "center", padding: "5px 14px", border: `0.5px solid rgba(255,255,255,0.14)`, fontSize: 10, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: D.dim }}>{f.specialty}</span>
                </div>
                {f.bio && (
                  <p style={{ fontSize: 14, lineHeight: 1.7, color: "rgba(255,255,255,0.42)", maxWidth: 480, marginBottom: 28, animation: "fadeUp 0.55s ease 0.3s both" }}>{f.bio}</p>
                )}
                {stats.length > 0 && (
                  <div style={{ display: "flex", gap: 32, marginBottom: 36, animation: "fadeUp 0.55s ease 0.36s both" }}>
                    {stats.map(({ value, label }) => (
                      <div key={label}>
                        <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontStyle: "italic", fontSize: "clamp(2rem, 4vw, 3.2rem)", lineHeight: 1, letterSpacing: "-0.03em", color: D.text }}>{value}</div>
                        <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: "0.18em", textTransform: "uppercase", color: D.faint, marginTop: 4 }}>{label}</div>
                      </div>
                    ))}
                  </div>
                )}
                <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", animation: "fadeUp 0.55s ease 0.42s both" }}>
                  {!clientTier ? (
                    <>
                      <button className="cp-btn" onClick={() => plansRef.current?.scrollIntoView({ behavior: "smooth" })}
                        style={{ padding: "13px 36px", background: D.red, color: "#fff", border: "none", cursor: "pointer", fontSize: 12, fontWeight: 800, letterSpacing: "0.14em", textTransform: "uppercase", fontFamily: "inherit", borderRadius: 2 }}>
                        Start Training →
                      </button>
                      {previewVideos.length > 0 && (
                        <button className="ghost" onClick={() => plansRef.current?.scrollIntoView({ behavior: "smooth" })}
                          style={{ padding: "12px 24px", background: "transparent", color: D.dim, border: `0.5px solid rgba(255,255,255,0.16)`, cursor: "pointer", fontSize: 12, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", fontFamily: "inherit", borderRadius: 2 }}>
                          View Program
                        </button>
                      )}
                    </>
                  ) : (
                    <a href={`/trainer/${slug}/library`} style={{ padding: "13px 36px", background: D.red, color: "#fff", textDecoration: "none", fontSize: 12, fontWeight: 800, letterSpacing: "0.14em", textTransform: "uppercase", borderRadius: 2, display: "inline-block" }}>
                      Open Library →
                    </a>
                  )}
                </div>
              </div>

              {/* RIGHT: video previews */}
              {previewVideos.length > 0 && (
                <div className="hero-right" style={{ display: "flex", flexDirection: "column", gap: 10, animation: "fadeUp 0.6s ease 0.28s both" }}>
                  <VideoCard video={previewVideos[0]} isLarge isLocked={!clientTier} />
                  {previewVideos.length > 1 && (
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                      {previewVideos.slice(1, 3).map(v => <VideoCard key={v.id} video={v} isLocked={!clientTier} />)}
                    </div>
                  )}
                  {(totalVideos + totalWorkouts) > previewVideos.length && (
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{ flex: 1, height: "0.5px", background: D.border }} />
                      <span style={{ fontSize: 10, color: D.faint, whiteSpace: "nowrap", letterSpacing: "0.04em" }}>+{(totalVideos + totalWorkouts) - previewVideos.length} more in the program</span>
                      <div style={{ flex: 1, height: "0.5px", background: D.border }} />
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </section>

        {/* ── PLANS / ACCESS SECTION ── */}
        <section ref={plansRef} style={{ padding: "52px 56px 72px", background: `radial-gradient(ellipse 60% 50% at 50% 110%, rgba(218,54,51,0.05) 0%, transparent 60%), ${D.bg}` }} className="cp-section">
          <div style={{ maxWidth: 1140, margin: "0 auto" }}>

            {/* Section label */}
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
              <div style={{ width: 20, height: 2, background: D.red }} />
              <span style={{ fontSize: 9, fontWeight: 900, letterSpacing: "0.22em", textTransform: "uppercase", color: D.red }}>
                {clientTier ? "Your Access" : "Choose Your Level"}
              </span>
            </div>

            {/* ── SUBSCRIBER VIEW ── */}
            {clientTier ? (
              <div style={{ maxWidth: 800 }}>

                {/* Current plan callout */}
                <div style={{ marginBottom: 40 }}>
                  <h2 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontStyle: "italic", fontSize: "clamp(2.5rem, 6vw, 5rem)", lineHeight: 0.88, letterSpacing: "-0.025em", textTransform: "uppercase", color: TIER[clientTier]?.color ?? "#3FB950", marginBottom: 12 }}>
                    You're In.
                  </h2>
                  <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 24 }}>
                    <span style={{ fontSize: 13, color: D.dim }}>{clientTier} plan · Your library is ready.</span>
                    <span style={{ width: "0.5px", height: 14, background: D.border }} />
                    <span style={{ fontSize: 12, color: TIER[clientTier]?.color, fontWeight: 700, background: `${TIER[clientTier]?.color}14`, border: `0.5px solid ${TIER[clientTier]?.color}33`, padding: "3px 10px", letterSpacing: "0.04em" }}>
                      {clientTier}
                    </span>
                  </div>
                  <a href={`/trainer/${slug}/library`}
                    style={{ display: "inline-block", padding: "13px 36px", background: D.red, color: "#fff", textDecoration: "none", fontSize: 12, fontWeight: 800, letterSpacing: "0.14em", textTransform: "uppercase", borderRadius: 2 }}>
                    Open Library →
                  </a>
                </div>

                {/* Upgrade options */}
                {upgradableTiers.length > 0 && !cancelMode && (
                  <div style={{ marginBottom: 40 }}>
                    <div style={{ height: "0.5px", background: D.border, marginBottom: 32 }} />
                    <div style={{ marginBottom: 24 }}>
                      <h3 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontStyle: "italic", fontSize: "clamp(1.5rem, 3vw, 2.5rem)", lineHeight: 0.9, letterSpacing: "-0.02em", textTransform: "uppercase", color: D.text, marginBottom: 8 }}>
                        Upgrade Your Plan.
                      </h3>
                      <p style={{ fontSize: 13, color: D.faint }}>
                        Switch to a higher tier anytime. Your new access starts immediately.
                      </p>
                    </div>

                    {checkoutError && (
                      <div style={{ marginBottom: 16, padding: "11px 16px", background: "rgba(218,54,51,0.1)", border: `0.5px solid rgba(218,54,51,0.28)`, borderRadius: 2, fontSize: 13, color: "#FF7B72", fontWeight: 600 }}>
                        {checkoutError}
                      </div>
                    )}

                    <div className="cp-plan-grid" style={{ display: "grid", gridTemplateColumns: `repeat(${upgradableTiers.length}, 1fr)`, gap: 14, maxWidth: upgradableTiers.length === 1 ? 360 : 640 }}>
                      {upgradableTiers.map(tier => (
                        <PlanCard
                          key={tier}
                          tier={tier}
                          f={f}
                          onSubscribe={handleSubscribe}
                          checkoutTier={checkoutTier}
                          user={user}
                          slug={slug}
                          isUpgrade
                        />
                      ))}
                    </div>

                    {hasPaid && (
                      <p style={{ fontSize: 11, color: D.faint, marginTop: 14 }}>
                        Secure checkout powered by Stripe · Cancel anytime
                      </p>
                    )}
                  </div>
                )}

                {/* Cancel section */}
                <div style={{ borderTop: `0.5px solid ${D.border}`, paddingTop: 28 }}>
                  {cancelError && (
                    <p style={{ fontSize: 13, color: D.red, marginBottom: 14, fontWeight: 600 }}>{cancelError}</p>
                  )}
                  {!cancelMode ? (
                    <button
                      type="button"
                      onClick={() => setCancelMode(true)}
                      className="cancel-link"
                      style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, color: D.faint, fontFamily: "inherit", letterSpacing: "0.04em", padding: 0 }}>
                      Cancel subscription
                    </button>
                  ) : (
                    <CancelConfirm
                      onConfirm={handleCancel}
                      onDismiss={() => { setCancelMode(false); setCancelError(""); }}
                      cancelling={cancelling}
                      isPaid={clientIsPaid}
                    />
                  )}
                </div>
              </div>

            ) : (
              /* ── NON-SUBSCRIBER VIEW ── */
              <>
                <div style={{ marginBottom: 44 }}>
                  <h2 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontStyle: "italic", fontSize: "clamp(2.5rem, 6vw, 5rem)", lineHeight: 0.88, letterSpacing: "-0.025em", textTransform: "uppercase", color: D.text, marginBottom: 12 }}>
                    Your Level.<br />Your Program.
                  </h2>
                  <p style={{ fontSize: 13, color: D.faint, maxWidth: 400, lineHeight: 1.65 }}>
                    Pick the plan that fits your commitment. Upgrade or cancel anytime.
                  </p>
                </div>

                {checkoutError && (
                  <div style={{ marginBottom: 20, padding: "11px 16px", background: "rgba(218,54,51,0.1)", border: `0.5px solid rgba(218,54,51,0.28)`, borderRadius: 2, fontSize: 13, color: "#FF7B72", fontWeight: 600 }}>
                    {checkoutError}
                  </div>
                )}

                <div className="cp-plan-grid" style={{ display: "grid", gridTemplateColumns: `repeat(${availableTiers.length}, 1fr)`, gap: 14, marginBottom: 24, maxWidth: availableTiers.length === 1 ? 360 : availableTiers.length === 2 ? 640 : "100%" }}>
                  {availableTiers.map(tier => (
                    <PlanCard key={tier} tier={tier} f={f} onSubscribe={handleSubscribe} checkoutTier={checkoutTier} user={user} slug={slug} />
                  ))}
                </div>

                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                  {hasPaid
                    ? <><svg width="13" height="13" viewBox="0 0 24 24" fill="none"><rect x="2" y="5" width="20" height="14" rx="2" stroke="rgba(255,255,255,0.18)" strokeWidth="1.5"/><path d="M2 10h20" stroke="rgba(255,255,255,0.18)" strokeWidth="1.5"/></svg><span style={{ fontSize: 11, color: D.faint }}>Secure checkout powered by Stripe · Cancel anytime</span></>
                    : <span style={{ fontSize: 11, color: D.faint }}>Free access · No credit card required</span>
                  }
                </div>
              </>
            )}
          </div>
        </section>

        {/* ── DROP IN: one-time purchasable items ── */}
        {(pricedVideos.length > 0 || pricedWorkouts.length > 0) && (
          <section style={{ background: D.bgSection, borderTop: `3px solid ${D.red}` }} className="cp-section">
            {/* Red tension stripe */}
            <div style={{ width: "100%", height: 1, background: `linear-gradient(90deg, ${D.red} 0%, transparent 60%)`, opacity: 0.35 }} />
            <div style={{ padding: "72px 56px 88px", maxWidth: 1140, margin: "0 auto" }}>

              {/* Counter-statement + headline */}
              <div style={{ marginBottom: 44 }}>
                <p style={{ fontSize: 10, fontWeight: 900, letterSpacing: "0.28em", textTransform: "uppercase", color: "rgba(255,255,255,0.2)", marginBottom: 10 }}>
                  One Shot. No Excuses.
                </p>
                <h2 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontStyle: "italic", fontSize: "clamp(3rem, 7vw, 6rem)", lineHeight: 0.85, letterSpacing: "-0.03em", textTransform: "uppercase", color: D.text, marginBottom: 16 }}>
                  Drop In.
                </h2>
                <p style={{ fontSize: 13, color: D.dim, maxWidth: 340, lineHeight: 1.6 }}>
                  No commitment. One session. Yours forever.
                </p>
              </div>

              {buyError && (
                <div style={{ marginBottom: 20, padding: "11px 16px", background: "rgba(218,54,51,0.1)", border: `0.5px solid rgba(218,54,51,0.28)`, borderRadius: 2, fontSize: 13, color: "#FF7B72", fontWeight: 600 }}>
                  {buyError}
                </div>
              )}

              <div className="cp-plan-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 14 }}>
                {pricedVideos.map(v => (
                  <PricedItemCard key={v.id} item={v} itemType="video" onBuy={handleBuyItem} buyingItem={buyingItem} user={user} clientTier={clientTier} />
                ))}
                {pricedWorkouts.map(w => (
                  <PricedItemCard key={w.id} item={w} itemType="workout" onBuy={handleBuyItem} buyingItem={buyingItem} user={user} clientTier={clientTier} />
                ))}
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 24 }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><rect x="2" y="5" width="20" height="14" rx="2" stroke="rgba(255,255,255,0.18)" strokeWidth="1.5"/><path d="M2 10h20" stroke="rgba(255,255,255,0.18)" strokeWidth="1.5"/></svg>
                <span style={{ fontSize: 11, color: "rgba(255,255,255,0.18)", letterSpacing: "0.04em" }}>Secured by Stripe · Own it permanently</span>
              </div>
            </div>
          </section>
        )}

        {/* ── FOOTER ── */}
        <footer style={{ borderTop: `0.5px solid ${D.border}`, padding: "22px 56px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
          <a href="/" className="cp-nav-a" style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: 12, letterSpacing: "0.16em", textTransform: "uppercase", color: "rgba(255,255,255,0.15)", textDecoration: "none" }}>CheckPeak</a>
          <span style={{ fontSize: 10, color: "rgba(255,255,255,0.12)", letterSpacing: "0.06em" }}>Commercial Platform · {new Date().getFullYear()}</span>
        </footer>
      </div>
    </>
  );
}