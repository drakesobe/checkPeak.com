// pages/trainer/[slug]/library.jsx
// Client video library — CheckPeak Commercial.
// Dark "film room" aesthetic: organized, focused, premium.
// Consistent with the trainer profile page design language.
"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/router";
import { useAuthContext } from "@/hooks/useAuth";
import Head from "next/head";
import MuxPlayer from "@mux/mux-player-react";

// ─── Design tokens ────────────────────────────────────────────────────────────
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
  Basic:   { color: "#3FB950", bg: "rgba(63,185,80,0.12)",   rank: 1 },
  Premium: { color: "#F0883E", bg: "rgba(240,136,62,0.12)",  rank: 2 },
  Ultra:   { color: "#79B8FF", bg: "rgba(121,184,255,0.12)", rank: 3 },
};

const TIER_NEXT = { Basic: "Premium", Premium: "Ultra" };

// ─── Global CSS ───────────────────────────────────────────────────────────────
const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:ital,wght@0,700;0,900;1,700;1,900&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  @keyframes spin    { to { transform: rotate(360deg); } }
  @keyframes fadeIn  { from { opacity: 0; } to { opacity: 1; } }
  @keyframes slideUp { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes scaleIn { from { opacity: 0; transform: scale(0.96); } to { opacity: 1; transform: scale(1); } }

  .lib-card {
    transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease;
    cursor: pointer;
  }
  .lib-card:hover {
    transform: translateY(-3px) scale(1.01);
    box-shadow: 0 20px 52px rgba(0,0,0,0.6);
    border-color: rgba(255,255,255,0.15) !important;
  }
  .lib-card .play-btn  { opacity: 0; transition: opacity 0.18s; }
  .lib-card:hover .play-btn { opacity: 1; }

  .lib-card-locked {
    cursor: default;
    opacity: 0.55;
  }
  .lib-card-locked:hover {
    transform: none !important;
    box-shadow: none !important;
    border-color: rgba(255,255,255,0.07) !important;
  }

  .filter-btn { transition: background 0.14s, border-color 0.14s, color 0.14s; cursor: pointer; }
  .filter-btn:hover { border-color: rgba(255,255,255,0.22) !important; color: rgba(255,255,255,0.8) !important; }

  .nav-link { transition: color 0.14s; }
  .nav-link:hover { color: rgba(255,255,255,0.9) !important; }

  .modal-anim { animation: scaleIn 0.2s ease both; }

  @media (max-width: 768px) {
    .lib-grid { grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)) !important; }
    .lib-header-row { flex-direction: column; align-items: flex-start !important; gap: 10px !important; }
  }
`;

// ─── Utilities ────────────────────────────────────────────────────────────────
function canAccess(clientTier, videoTier) {
  return (TIER[clientTier]?.rank ?? 0) >= (TIER[videoTier]?.rank ?? 1);
}

function parseTags(raw) {
  try { return typeof raw === "string" ? JSON.parse(raw) : (raw ?? {}); }
  catch { return {}; }
}

function fmtDuration(secs) {
  if (!secs) return null;
  const m = Math.floor(secs / 60), s = secs % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function buildEmbedSrc(url = "") {
  const yt = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&?/]+)/);
  if (yt) return `https://www.youtube.com/embed/${yt[1]}?autoplay=1&rel=0&modestbranding=1`;
  const vm = url.match(/vimeo\.com\/(\d+)/);
  if (vm) return `https://player.vimeo.com/video/${vm[1]}?autoplay=1&dnt=1`;
  return url;
}

async function logCompletion(videoId) {
  try {
    await fetch("/api/commercial/completion", {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ videoId, completedAt: new Date().toISOString() }),
    });
  } catch {}
}

// ─── Video card ───────────────────────────────────────────────────────────────
function VideoCard({ video, clientTier, onPlay }) {
  const f         = video.fields ?? {};
  const accessible = canAccess(clientTier, f.tier);
  const thumb      = f.muxPlaybackId
    ? `https://image.mux.com/${f.muxPlaybackId}/thumbnail.jpg?width=560&height=315&fit_mode=smartcrop`
    : null;
  const tags       = Object.values(parseTags(f.tags)).filter(Boolean).slice(0, 2);
  const tierCfg    = TIER[f.tier];
  const dur        = fmtDuration(f.duration);

  return (
    <div
      className={`lib-card${accessible ? "" : " lib-card-locked"}`}
      style={{
        background:   D.bgCard,
        border:       `0.5px solid ${D.border}`,
        borderRadius: 3,
        overflow:     "hidden",
        display:      "flex",
        flexDirection:"column",
      }}
      onClick={() => accessible && onPlay(video.id)}
    >
      {/* Thumbnail */}
      <div style={{ position: "relative", paddingBottom: "56.25%", background: "#0A0C10", flexShrink: 0 }}>
        {thumb
          ? <img src={thumb} alt={f.title} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
          : (
            <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                <polygon points="5,3 19,12 5,21" fill="rgba(255,255,255,0.08)" />
              </svg>
            </div>
          )
        }

        {/* Bottom gradient */}
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(0,0,0,0.75) 0%, transparent 55%)" }} />

        {/* Hover play button */}
        {accessible && (
          <div className="play-btn" style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.18)" }}>
            <div style={{ width: 44, height: 44, borderRadius: "50%", background: "rgba(255,255,255,0.1)", backdropFilter: "blur(6px)", border: "1px solid rgba(255,255,255,0.18)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <polygon points="5,3 19,12 5,21" fill="rgba(255,255,255,0.92)" />
              </svg>
            </div>
          </div>
        )}

        {/* Lock badge */}
        {!accessible && (
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 8, background: "rgba(0,0,0,0.32)" }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <rect x="5" y="11" width="14" height="10" rx="2" stroke="rgba(255,255,255,0.3)" strokeWidth="1.5"/>
              <path d="M8 11V7a4 4 0 018 0v4" stroke="rgba(255,255,255,0.3)" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            {TIER_NEXT[clientTier] && (
              <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: "0.14em", textTransform: "uppercase", color: TIER[TIER_NEXT[clientTier]]?.color ?? "rgba(255,255,255,0.4)", background: "rgba(0,0,0,0.65)", padding: "3px 10px", backdropFilter: "blur(4px)" }}>
                {TIER_NEXT[clientTier]} only
              </span>
            )}
          </div>
        )}

        {/* Duration */}
        {dur && (
          <span style={{ position: "absolute", bottom: 8, right: 8, fontSize: 10, fontWeight: 700, color: "#fff", background: "rgba(0,0,0,0.65)", padding: "2px 7px", letterSpacing: "0.04em" }}>
            {dur}
          </span>
        )}

        {/* Tier badge */}
        {tierCfg && (
          <span style={{ position: "absolute", top: 8, left: 8, fontSize: 8, fontWeight: 900, letterSpacing: "0.16em", textTransform: "uppercase", color: tierCfg.color, background: "rgba(0,0,0,0.7)", padding: "3px 8px", backdropFilter: "blur(4px)" }}>
            {f.tier}
          </span>
        )}
      </div>

      {/* Info */}
      <div style={{ padding: "12px 14px 14px", flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
        <p style={{ fontSize: 13, fontWeight: 700, color: accessible ? D.text : D.faint, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", letterSpacing: "-0.01em" }}>
          {f.title || "Untitled"}
        </p>
        {tags.length > 0 && (
          <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
            {tags.map(tag => (
              <span key={tag} style={{ fontSize: 10, fontWeight: 600, color: D.faint, background: D.whisper, padding: "2px 8px", letterSpacing: "0.04em" }}>
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Player modal ─────────────────────────────────────────────────────────────
function PlayerModal({ video, onClose }) {
  const f = video?.fields ?? {};

  useEffect(() => {
    const fn = e => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, [onClose]);

  return (
    <div
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.94)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px 16px", animation: "fadeIn 0.18s ease" }}
    >
      <div className="modal-anim" style={{ width: "100%", maxWidth: 960, overflow: "hidden", borderRadius: 3, border: `0.5px solid ${D.borderMid}`, boxShadow: "0 40px 100px rgba(0,0,0,0.8)" }}>

        {/* Video */}
        {f.sourceType === "embed" ? (
          <div style={{ position: "relative", paddingBottom: "56.25%", background: "#000" }}>
            <iframe
              src={buildEmbedSrc(f.embedUrl)}
              style={{ position: "absolute", inset: 0, width: "100%", height: "100%", border: "none" }}
              allow="autoplay; fullscreen; picture-in-picture"
              allowFullScreen
            />
          </div>
        ) : (
          <MuxPlayer
            playbackId={f.muxPlaybackId}
            metadata={{ video_title: f.title }}
            onEnded={() => logCompletion(video.id)}
            autoPlay
            style={{ width: "100%", aspectRatio: "16/9", display: "block" }}
          />
        )}

        {/* Footer bar */}
        <div style={{ background: "#0A0C10", borderTop: `0.5px solid ${D.border}`, padding: "12px 18px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
          <div style={{ minWidth: 0 }}>
            <p style={{ fontSize: 14, fontWeight: 700, color: D.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", letterSpacing: "-0.01em" }}>
              {f.title}
            </p>
            {fmtDuration(f.duration) && (
              <p style={{ fontSize: 11, color: D.faint, marginTop: 2 }}>{fmtDuration(f.duration)}</p>
            )}
          </div>
          <button
            onClick={onClose}
            style={{ background: D.whisper, border: `0.5px solid ${D.border}`, color: D.dim, width: 32, height: 32, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 2, flexShrink: 0, fontSize: 16 }}
          >
            ✕
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Upgrade prompt ───────────────────────────────────────────────────────────
function UpgradePrompt({ lockedCount, nextTier, trainerName, slug }) {
  if (!nextTier || lockedCount === 0) return null;
  const cfg = TIER[nextTier];

  return (
    <div style={{ marginTop: 48, borderTop: `0.5px solid ${D.border}`, paddingTop: 48 }}>
      <div style={{ maxWidth: 560, margin: "0 auto", textAlign: "center" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, marginBottom: 16 }}>
          <div style={{ width: 20, height: "0.5px", background: cfg.color }} />
          <span style={{ fontSize: 9, fontWeight: 900, letterSpacing: "0.2em", textTransform: "uppercase", color: cfg.color }}>
            Upgrade to {nextTier}
          </span>
          <div style={{ width: 20, height: "0.5px", background: cfg.color }} />
        </div>
        <h3 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontStyle: "italic", fontSize: "clamp(1.8rem, 5vw, 3rem)", lineHeight: 0.9, letterSpacing: "-0.02em", textTransform: "uppercase", color: D.text, marginBottom: 12 }}>
          {lockedCount} More {lockedCount === 1 ? "Workout" : "Workouts"}<br />Waiting.
        </h3>
        <p style={{ fontSize: 13, color: D.dim, lineHeight: 1.65, marginBottom: 28 }}>
          Unlock the full {trainerName} program with a {nextTier} subscription.
        </p>
        <a
          href={`/trainer/${slug}`}
          style={{ display: "inline-block", padding: "13px 36px", background: cfg.color, color: "#fff", textDecoration: "none", fontSize: 11, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", borderRadius: 2 }}
        >
          Upgrade Plan →
        </a>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function ClientLibrary() {
  const router       = useRouter();
  const { slug }     = router.query;
  const { user, authReady } = useAuthContext();

  const [trainer,    setTrainer]    = useState(null);
  const [videos,     setVideos]     = useState([]);
  const [clientTier, setClientTier] = useState(null);
  const [loading,    setLoading]    = useState(true);
  const [playing,    setPlaying]    = useState(null);
  const [filter,     setFilter]     = useState("all");

  useEffect(() => {
    if (!authReady) return;
    if (!user) { router.push(`/login?next=/trainer/${slug}/library`); return; }
    if (!slug) return;

    Promise.all([
      fetch(`/api/commercial/trainer-public?slug=${slug}`).then(r => r.json()),
      fetch(`/api/commercial/client-access?slug=${slug}`, { credentials: "include" }).then(r => r.json()),
    ]).then(([trainerData, accessData]) => {
      if (!trainerData.trainer) { router.push("/"); return; }
      if (!accessData.tier)     { router.push(`/trainer/${slug}`); return; }
      setTrainer(trainerData.trainer);
      setVideos(accessData.videos ?? []);
      setClientTier(accessData.tier);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [user, authReady, slug, router]);

  const handlePlay  = useCallback(id => setPlaying(id), []);
  const handleClose = useCallback(() => setPlaying(null), []);

  // ── Loading ──────────────────────────────────────────────────────────────────
  if (!authReady || loading) {
    return (
      <div style={{ minHeight: "100vh", background: D.bg, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "system-ui, sans-serif" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 14, height: 14, border: "2px solid rgba(255,255,255,0.1)", borderTopColor: D.red, borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
          <span style={{ fontSize: 11, color: D.faint, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase" }}>Loading</span>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (!trainer || !clientTier) return null;

  // ── Derived state ────────────────────────────────────────────────────────────
  const tf         = trainer.fields ?? {};
  const allTags    = [...new Set(videos.flatMap(v => Object.values(parseTags(v.fields?.tags))).filter(Boolean))];
  const accessible = videos.filter(v => canAccess(clientTier, v.fields?.tier));
  const locked     = videos.filter(v => !canAccess(clientTier, v.fields?.tier));
  const filtered   = accessible.filter(v => filter === "all" || Object.values(parseTags(v.fields?.tags)).includes(filter));
  const playingVid = playing ? videos.find(v => v.id === playing) : null;
  const tierCfg    = TIER[clientTier];
  const nextTier   = TIER_NEXT[clientTier] ?? null;

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <>
      <Head>
        <title>{tf.name} · Program Library · CheckPeak</title>
      </Head>

      <div style={{ minHeight: "100vh", background: D.bg, color: D.text, fontFamily: "system-ui, -apple-system, sans-serif" }}>

        {/* ── NAV ── */}
        <nav style={{ position: "sticky", top: 0, zIndex: 100, background: "rgba(7,8,8,0.92)", backdropFilter: "blur(12px)", borderBottom: `0.5px solid ${D.border}`, padding: "0 40px", height: 56, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>

          <div style={{ display: "flex", alignItems: "center", gap: 16, minWidth: 0 }}>
            <a href="/" style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: 14, letterSpacing: "0.12em", textTransform: "uppercase", color: D.faint, textDecoration: "none" }} className="nav-link">
              CheckPeak
            </a>
            <div style={{ width: "0.5px", height: 14, background: D.border, flexShrink: 0 }} />
            <a href={`/trainer/${slug}`} style={{ fontSize: 13, fontWeight: 600, color: D.dim, textDecoration: "none", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} className="nav-link">
              {tf.name}
            </a>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
            {tierCfg && (
              <span style={{ fontSize: 9, fontWeight: 900, letterSpacing: "0.18em", textTransform: "uppercase", color: tierCfg.color, background: tierCfg.bg, padding: "5px 12px", border: `0.5px solid ${tierCfg.color}22` }}>
                {clientTier}
              </span>
            )}
            <a
              href={`/trainer/${slug}`}
              className="nav-link"
              style={{ fontSize: 11, color: D.faint, textDecoration: "none", letterSpacing: "0.04em", fontWeight: 600 }}
            >
              ← Profile
            </a>
          </div>
        </nav>

        {/* ── HEADER ── */}
        <div style={{ background: D.bgSection, borderBottom: `0.5px solid ${D.border}`, padding: "36px 40px 32px", animation: "slideUp 0.4s ease both" }}>
          <div style={{ maxWidth: 1100, margin: "0 auto" }}>

            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
              <div style={{ width: 22, height: 2, background: D.red }} />
              <span style={{ fontSize: 9, fontWeight: 900, letterSpacing: "0.22em", textTransform: "uppercase", color: D.red }}>
                The Program
              </span>
            </div>

            <div className="lib-header-row" style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16 }}>
              <div>
                <h1 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontStyle: "italic", fontSize: "clamp(2rem, 5vw, 3.5rem)", lineHeight: 0.9, letterSpacing: "-0.025em", textTransform: "uppercase", color: D.text, marginBottom: 8 }}>
                  {tf.name}
                </h1>
                <p style={{ fontSize: 12, color: D.faint }}>
                  {accessible.length} video{accessible.length !== 1 ? "s" : ""} on your {clientTier} plan
                  {locked.length > 0 && (
                    <span style={{ color: TIER[nextTier]?.color ?? D.faint }}>
                      {" "}· {locked.length} more with {nextTier ?? "an upgrade"}
                    </span>
                  )}
                </p>
              </div>

              {/* Progress ring placeholder — total accessible */}
              <div style={{ textAlign: "right", flexShrink: 0 }}>
                <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontStyle: "italic", fontSize: "2rem", lineHeight: 1, letterSpacing: "-0.02em", color: tierCfg?.color }}>
                  {accessible.length}
                </div>
                <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", color: D.faint }}>
                  Available
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── FILTER ROW ── */}
        {allTags.length > 0 && (
          <div style={{ borderBottom: `0.5px solid ${D.border}`, padding: "0 40px", overflowX: "auto" }}>
            <div style={{ maxWidth: 1100, margin: "0 auto", display: "flex", gap: 2, padding: "10px 0" }}>
              {["all", ...allTags].map(tag => {
                const isActive = filter === tag;
                return (
                  <button
                    key={tag}
                    className="filter-btn"
                    onClick={() => setFilter(tag)}
                    style={{
                      padding:       "7px 16px",
                      background:    isActive ? tierCfg?.bg ?? D.whisper : "transparent",
                      border:        `0.5px solid ${isActive ? (tierCfg?.color ?? D.red) + "55" : D.border}`,
                      color:         isActive ? tierCfg?.color ?? D.text : D.faint,
                      fontSize:      11,
                      fontWeight:    isActive ? 800 : 600,
                      letterSpacing: "0.06em",
                      cursor:        "pointer",
                      whiteSpace:    "nowrap",
                      fontFamily:    "inherit",
                      borderRadius:  2,
                    }}
                  >
                    {tag === "all" ? "All" : tag}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* ── VIDEO GRID ── */}
        <div style={{ padding: "36px 40px 64px", maxWidth: 1100, margin: "0 auto" }}>

          {/* ── Empty: no videos at all ── */}
{videos.length === 0 ? (
  <div style={{ textAlign: "center", padding: "100px 0", animation: "slideUp 0.4s ease both" }}>
    <div style={{ marginBottom: 28, display: "flex", justifyContent: "center" }}>
      <div style={{ width: 56, height: 56, border: `0.5px solid ${D.borderMid}`, borderRadius: 3, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
          <rect x="2" y="5" width="20" height="14" rx="2" stroke="rgba(255,255,255,0.18)" strokeWidth="1.5"/>
          <polygon points="10,9 10,15 15,12" fill="rgba(255,255,255,0.18)"/>
        </svg>
      </div>
    </div>
    <h3 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontStyle: "italic", fontSize: "clamp(1.8rem, 5vw, 3rem)", lineHeight: 0.9, letterSpacing: "-0.02em", textTransform: "uppercase", color: D.text, marginBottom: 12 }}>
      The Program<br />Is Loading Up.
    </h3>
    <p style={{ fontSize: 13, color: D.faint, lineHeight: 1.65, marginBottom: 28, maxWidth: 320, margin: "0 auto 28px" }}>
      {tf.name?.split(" ")[0] || "Your coach"} is building out the library. Check back soon.
    </p>
    <a href={`/trainer/${slug}`} style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", color: D.red, textDecoration: "none" }}>
      ← Back to Profile
    </a>
  </div>

) : accessible.length === 0 ? (
  /* ── Empty: all content locked above tier ── */
  <div style={{ textAlign: "center", padding: "100px 0", animation: "slideUp 0.4s ease both" }}>
    <div style={{ marginBottom: 20, display: "flex", justifyContent: "center" }}>
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
        <rect x="5" y="11" width="14" height="10" rx="2" stroke="rgba(255,255,255,0.18)" strokeWidth="1.5"/>
        <path d="M8 11V7a4 4 0 018 0v4" stroke="rgba(255,255,255,0.18)" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    </div>
    <h3 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontStyle: "italic", fontSize: "clamp(1.8rem, 5vw, 3rem)", lineHeight: 0.9, letterSpacing: "-0.02em", textTransform: "uppercase", color: D.text, marginBottom: 12 }}>
      Upgrade to<br />Unlock Content.
    </h3>
    <p style={{ fontSize: 13, color: D.faint, lineHeight: 1.65, maxWidth: 320, margin: "0 auto 28px" }}>
      All {videos.length} video{videos.length !== 1 ? "s" : ""} in this program require a higher tier.
    </p>
    <a href={`/trainer/${slug}`} style={{ display: "inline-block", padding: "12px 32px", background: TIER[nextTier]?.color ?? D.red, color: "#fff", textDecoration: "none", fontSize: 11, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", borderRadius: 2 }}>
      Upgrade Plan →
    </a>
  </div>

) : filtered.length === 0 && filter !== "all" ? (
  /* ── Empty: filter has no results ── */
  <div style={{ textAlign: "center", padding: "80px 0" }}>
    <p style={{ fontSize: 13, color: D.faint, marginBottom: 14 }}>No videos match this filter.</p>
    <button onClick={() => setFilter("all")} style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: D.red, background: "none", border: "none", cursor: "pointer", fontFamily: "inherit" }}>
      Show all →
    </button>
  </div>

) : (
  /* ── Grid ── */
  <div className="lib-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 12, animation: "slideUp 0.45s ease 0.1s both" }}>
    {filtered.map(v => (
      <VideoCard key={v.id} video={v} clientTier={clientTier} onPlay={handlePlay} />
    ))}
    {filter === "all" && locked.map(v => (
      <VideoCard key={v.id} video={v} clientTier={clientTier} onPlay={handlePlay} />
    ))}
  </div>
)}

{/* Upgrade prompt */}
{videos.length > 0 && filter === "all" && (
  <UpgradePrompt
    lockedCount={locked.length}
    nextTier={nextTier}
    trainerName={tf.name?.split(" ")[0] || "this trainer"}
    slug={slug}
  />
)}

       {/* ── PLAYER MODAL ── */}
        {playingVid && <PlayerModal video={playingVid} onClose={handleClose} />}

      </div>{/* closes grid container */}

      </div>{/* closes outer minHeight wrapper */}

      <style>{CSS}</style>
    </>
  );
}