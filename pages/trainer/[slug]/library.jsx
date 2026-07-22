// pages/trainer/[slug]/library.jsx
// Client video + workout library. Dark "film room" aesthetic.
// Two tabs: Videos (with completion tracking) and Workouts.
// Workouts: "View Workout →" opens viewer modal → "Add to Today →" → success state.
//
// One-Time: clients can reach this page with NO subscription if they've bought
// individual items. Access per item = (tier rank high enough) OR (item is purchased).
// Locked items that have a price show a "Buy for $X" button.
"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
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
  green:     "#3FB950",
};

const TIER = {
  Basic:   { color: "#3FB950", bg: "rgba(63,185,80,0.12)",   rank: 1 },
  Premium: { color: "#F0883E", bg: "rgba(240,136,62,0.12)",  rank: 2 },
  Ultra:   { color: "#79B8FF", bg: "rgba(121,184,255,0.12)", rank: 3 },
};

const TIER_NEXT = { Basic: "Premium", Premium: "Ultra" };

const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:ital,wght@0,700;0,900;1,700;1,900&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  @keyframes spin    { to { transform: rotate(360deg); } }
  @keyframes fadeIn  { from { opacity: 0; } to { opacity: 1; } }
  @keyframes slideUp { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes scaleIn { from { opacity: 0; transform: scale(0.96); } to { opacity: 1; transform: scale(1); } }
  @keyframes checkPop { 0% { transform: scale(0.5); opacity: 0; } 60% { transform: scale(1.15); } 100% { transform: scale(1); opacity: 1; } }

  .lib-card { transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease; cursor: pointer; }
  .lib-card:hover { transform: translateY(-3px) scale(1.01); box-shadow: 0 20px 52px rgba(0,0,0,0.6); border-color: rgba(255,255,255,0.15) !important; }
  .lib-card .play-btn { opacity: 0; transition: opacity 0.18s; }
  .lib-card:hover .play-btn { opacity: 1; }
  .lib-card-locked { cursor: default; opacity: 0.55; }
  .lib-card-locked:hover { transform: none !important; box-shadow: none !important; border-color: rgba(255,255,255,0.07) !important; }

  .workout-card { transition: border-color 0.16s; cursor: pointer; }
  .workout-card:hover { border-color: rgba(255,255,255,0.14) !important; }
  .workout-card-locked { cursor: default; opacity: 0.5; }
  .workout-card-locked:hover { border-color: rgba(255,255,255,0.07) !important; }

  .filter-btn { transition: background 0.14s, border-color 0.14s, color 0.14s; cursor: pointer; }
  .filter-btn:hover { border-color: rgba(255,255,255,0.22) !important; }
  .nav-link { transition: color 0.14s; }
  .nav-link:hover { color: rgba(255,255,255,0.9) !important; }
  .modal-anim { animation: scaleIn 0.2s ease both; }
  .check-badge { animation: checkPop 0.3s ease both; }
  .buy-btn { transition: opacity 0.14s; }
  .buy-btn:hover { opacity: 0.85; }

  @media (max-width: 768px) {
    .lib-grid { grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)) !important; }
    .lib-header-row { flex-direction: column; align-items: flex-start !important; gap: 10px !important; }
  }
`;

// ─── Utilities ────────────────────────────────────────────────────────────────

// Access = tier rank is high enough OR this specific item has been purchased.
// "One-Time" tier items are purchase-only — no subscription tier unlocks them.
function canAccess(clientTier, contentTier, itemId, purchasedIds = []) {
  if (itemId && purchasedIds.includes(itemId)) return true;
  if (contentTier === "One-Time") return false;
  return (TIER[clientTier]?.rank ?? 0) >= (TIER[contentTier]?.rank ?? 1);
}

function parseTags(raw) {
  try { return typeof raw === "string" ? JSON.parse(raw) : (raw ?? {}); }
  catch { return {}; }
}

// Flatten the tag object into one list of individual tag strings.
// Multi-select categories store arrays - e.g. { muscleGroup: ["Chest","Back"] } -
// so flatten one level so each tag becomes its own filter, not a lumped "Chest,Back".
function tagList(raw) {
  return Object.values(parseTags(raw))
    .flatMap(v => Array.isArray(v) ? v : [v])
    .filter(Boolean);
}

function formatCatName(key) {
  return key.replace(/([A-Z])/g, " $1").replace(/^./, c => c.toUpperCase()).trim();
}

function tagsByCategory(raw) {
  const obj = parseTags(raw);
  if (Array.isArray(obj)) return obj.filter(Boolean).length ? [{ cat: "", tags: obj.filter(Boolean) }] : [];
  return Object.entries(obj)
    .map(([cat, val]) => ({ cat, tags: Array.isArray(val) ? val.filter(Boolean) : val ? [String(val)] : [] }))
    .filter(e => e.tags.length > 0);
}

// exercises field comes back as a JS array (Supabase JSONB) or a JSON string
// (legacy data). Handle both so JSON.parse on an already-parsed array doesn't silently return [].
function parseExercises(raw) {
  if (Array.isArray(raw)) return raw;
  try { return JSON.parse(raw || "[]"); } catch { return []; }
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

function VideoCard({ video, clientTier, purchasedIds, onPlay, onBuy, isCompleted, onTagClick }) {
  const f          = video.fields ?? {};
  const accessible = canAccess(clientTier, f.tier, video.id, purchasedIds);
  const price      = Number(f.price) > 0 ? Number(f.price) : null;
  const thumb = videoThumb(f, 560, 315);
  const tags       = tagList(f.tags).slice(0, 2);
  const tierCfg    = TIER[f.tier];
  const dur        = fmtDuration(f.duration);

  return (
    <div
      className={`lib-card${accessible ? "" : " lib-card-locked"}`}
      style={{ background: D.bgCard, border: `0.5px solid ${isCompleted ? "rgba(63,185,80,0.3)" : D.border}`, borderRadius: 3, overflow: "hidden", display: "flex", flexDirection: "column", position: "relative" }}
      onClick={() => accessible && onPlay(video.id)}
    >
      <div style={{ position: "relative", paddingBottom: "56.25%", background: "#0A0C10", flexShrink: 0 }}>
        {thumb
          ? <img src={thumb} alt={f.title} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
          : <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}><svg width="28" height="28" viewBox="0 0 24 24" fill="none"><polygon points="5,3 19,12 5,21" fill="rgba(255,255,255,0.08)" /></svg></div>
        }
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(0,0,0,0.75) 0%, transparent 55%)" }} />
        {accessible && (
          <div className="play-btn" style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.18)" }}>
            <div style={{ width: 44, height: 44, borderRadius: "50%", background: "rgba(255,255,255,0.1)", backdropFilter: "blur(6px)", border: "1px solid rgba(255,255,255,0.18)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><polygon points="5,3 19,12 5,21" fill="rgba(255,255,255,0.92)" /></svg>
            </div>
          </div>
        )}
        {!accessible && (
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 8, background: "rgba(0,0,0,0.42)" }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><rect x="5" y="11" width="14" height="10" rx="2" stroke="rgba(255,255,255,0.3)" strokeWidth="1.5"/><path d="M8 11V7a4 4 0 018 0v4" stroke="rgba(255,255,255,0.3)" strokeWidth="1.5" strokeLinecap="round"/></svg>
            {price != null ? (
              <button
                type="button"
                className="buy-btn"
                onClick={e => { e.stopPropagation(); onBuy("video", video.id); }}
                style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: "#fff", background: D.red, border: "none", padding: "7px 14px", cursor: "pointer", fontFamily: "inherit", borderRadius: 2 }}>
                Buy for ${price}
              </button>
            ) : (
              <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: "0.14em", textTransform: "uppercase", color: TIER[TIER_NEXT[clientTier] ?? "Basic"]?.color ?? "rgba(255,255,255,0.4)", background: "rgba(0,0,0,0.65)", padding: "3px 10px", backdropFilter: "blur(4px)" }}>{TIER_NEXT[clientTier] ?? "Basic"} plan required</span>
            )}
          </div>
        )}
        {isCompleted && (
          <div className="check-badge" style={{ position: "absolute", top: 10, right: 10, width: 26, height: 26, borderRadius: "50%", background: D.green, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 0 0 3px rgba(63,185,80,0.2)" }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
          </div>
        )}
        {dur && <span style={{ position: "absolute", bottom: 8, right: 8, fontSize: 10, fontWeight: 700, color: "#fff", background: "rgba(0,0,0,0.65)", padding: "2px 7px", letterSpacing: "0.04em" }}>{dur}</span>}
        {tierCfg && <span style={{ position: "absolute", top: 8, left: 8, fontSize: 8, fontWeight: 900, letterSpacing: "0.16em", textTransform: "uppercase", color: tierCfg.color, background: "rgba(0,0,0,0.7)", padding: "3px 8px", backdropFilter: "blur(4px)" }}>{f.tier}</span>}
      </div>
      <div style={{ padding: "12px 14px 14px", flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
        <p style={{ fontSize: 13, fontWeight: 700, color: accessible ? D.text : D.faint, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", letterSpacing: "-0.01em" }}>{f.title || "Untitled"}</p>
        {tags.length > 0 && (
          <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
            {tags.map(tag => (
              <span
                key={tag}
                onClick={e => { e.stopPropagation(); onTagClick?.(tag); }}
                style={{ fontSize: 10, fontWeight: 600, color: D.faint, background: D.whisper, padding: "2px 8px", letterSpacing: "0.04em", cursor: "pointer" }}
                title={`Search "${tag}"`}
              >
                {tag}
              </span>
            ))}
          </div>
        )}
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

// ─── Workout card ─────────────────────────────────────────────────────────────

const ONE_TIME_CFG = { color: "#DA3633", bg: "rgba(218,54,51,0.12)" };

function WorkoutCard({ workout, clientTier, purchasedIds, onOpen, onBuy }) {
  const f          = workout.fields ?? {};
  const accessible = canAccess(clientTier, f.tier, workout.id, purchasedIds);
  const price      = Number(f.price) > 0 ? Number(f.price) : null;
  const isOneTime  = f.tier === "One-Time";
  const tierCfg    = isOneTime ? ONE_TIME_CFG : TIER[f.tier];

  const exercises     = parseExercises(f.exercises);
  const exerciseCount = exercises.filter(ex => String(ex.ExerciseName || "").trim()).length;
  const groups        = [...new Set(exercises.map(ex => ex.groupId).filter(Boolean))];
  const hasGroups     = groups.length > 0;

  return (
    <div
      className={`workout-card${accessible ? "" : " workout-card-locked"}`}
      style={{ background: D.bgCard, border: `0.5px solid ${D.border}`, borderRadius: 3, overflow: "hidden", position: "relative" }}
      onClick={() => accessible && onOpen(workout.id)}
    >
      {tierCfg && <div style={{ height: 2, background: tierCfg.color }} />}

      <div style={{ padding: "16px" }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10, marginBottom: 12 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: accessible ? D.text : D.faint, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", letterSpacing: "-0.01em", marginBottom: 4 }}>
              {f.title || "Untitled"}
            </p>
            {f.description && (
              <p style={{ fontSize: 11, color: D.faint, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.description}</p>
            )}
          </div>
        </div>

        <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 14 }}>
          {tierCfg && (
            <span style={{ fontSize: 9, fontWeight: 900, letterSpacing: "0.14em", textTransform: "uppercase", color: tierCfg.color, background: tierCfg.bg, padding: "3px 8px" }}>
              {isOneTime ? "One-Time Purchase" : f.tier}
            </span>
          )}
          <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: D.faint, background: D.whisper, padding: "3px 8px" }}>
            {exerciseCount} exercise{exerciseCount !== 1 ? "s" : ""}
          </span>
          {hasGroups && (
            <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#9B7AFF", background: "rgba(124,58,237,0.12)", padding: "3px 8px" }}>
              Supersets
            </span>
          )}
        </div>

        {accessible ? (
          <div style={{ padding: "10px 14px", background: D.bgSection, border: `0.5px solid ${D.border}`, color: D.text, fontSize: 10, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", textAlign: "center", cursor: "pointer" }}>
            View Workout →
          </div>
        ) : price != null ? (
          <button
            type="button"
            className="buy-btn"
            onClick={e => { e.stopPropagation(); onBuy("workout", workout.id); }}
            style={{ width: "100%", padding: "10px 14px", background: D.red, border: "none", color: "#fff", fontSize: 10, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", textAlign: "center", cursor: "pointer", fontFamily: "inherit", borderRadius: 2 }}>
            Buy for ${price}
          </button>
        ) : (
          <div style={{ padding: "10px 14px", background: "rgba(255,255,255,0.06)", color: D.faint, fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", textAlign: "center", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><rect x="5" y="11" width="14" height="10" rx="2" stroke="rgba(255,255,255,0.3)" strokeWidth="1.5"/><path d="M8 11V7a4 4 0 018 0v4" stroke="rgba(255,255,255,0.3)" strokeWidth="1.5" strokeLinecap="round"/></svg>
            {isOneTime ? "Purchase to access" : `${TIER_NEXT[clientTier] ?? "Basic"} plan required`}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Video player modal ───────────────────────────────────────────────────────

function PlayerModal({ video, onClose, onCompleted }) {
  const f = video?.fields ?? {};

  useEffect(() => {
    const fn = e => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, [onClose]);

  function handleEnded() {
    logCompletion(video.id);
    onCompleted(video.id);
  }

  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.94)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px 16px", animation: "fadeIn 0.18s ease" }}>
      <div className="modal-anim" style={{ width: "100%", maxWidth: 960, overflow: "hidden", borderRadius: 3, border: `0.5px solid ${D.borderMid}`, boxShadow: "0 40px 100px rgba(0,0,0,0.8)" }}>
        {f.sourceType === "embed" ? (
          <div style={{ position: "relative", paddingBottom: "56.25%", background: "#000" }}>
            <iframe src={buildEmbedSrc(f.embedUrl)} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", border: "none" }} allow="autoplay; fullscreen; picture-in-picture" allowFullScreen />
          </div>
        ) : (
          <MuxPlayer playbackId={f.muxPlaybackId} metadata={{ video_title: f.title }} onEnded={handleEnded} autoPlay style={{ width: "100%", aspectRatio: "16/9", display: "block" }} />
        )}
        <div style={{ background: "#0A0C10", borderTop: `0.5px solid ${D.border}`, padding: "12px 18px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
          <p style={{ fontSize: 14, fontWeight: 700, color: D.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", letterSpacing: "-0.01em" }}>{f.title}</p>
          <button onClick={onClose} style={{ background: D.whisper, border: `0.5px solid ${D.border}`, color: D.dim, width: 32, height: 32, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 2, flexShrink: 0, fontSize: 16 }}>✕</button>
        </div>
      </div>
    </div>
  );
}

// ─── Workout viewer modal ─────────────────────────────────────────────────────
// Shows the full workout with exercise list.
// Footer: "Add to Today →" → calls API → success state with "Go to Today →" link.

function WorkoutViewer({ workout, clientTier, onClose }) {
  const f = workout?.fields ?? {};

  const [addingToToday, setAddingToToday] = useState(false);
  const [addedToToday,  setAddedToToday]  = useState(false);
  const [addError,      setAddError]      = useState("");

  const exercises  = parseExercises(f.exercises);
  const meaningful = exercises.filter(ex => String(ex.ExerciseName || "").trim());

  useEffect(() => {
    const fn = e => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, [onClose]);

  // Build group colour map for supersets/circuits
  const groupMap = {};
  meaningful.forEach(ex => {
    if (ex.groupId) {
      if (!groupMap[ex.groupId]) groupMap[ex.groupId] = [];
      groupMap[ex.groupId].push(ex);
    }
  });

  const GROUP_COLORS = ["#7C3AED", "#0891B2", "#D97706", "#059669", "#DC2626"];
  let groupIdx = 0;
  const groupColors = {};
  Object.keys(groupMap).forEach(gid => {
    groupColors[gid] = GROUP_COLORS[groupIdx % GROUP_COLORS.length];
    groupIdx++;
  });

  async function addToToday() {
    setAddingToToday(true);
    setAddError("");
    try {
      const res = await fetch("/api/commercial/add-workout-to-today", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workoutId: workout.id }),
      });
      if (res.ok) {
        setAddedToToday(true);
      } else {
        const data = await res.json().catch(() => ({}));
        setAddError(data.error || "Something went wrong.");
      }
    } catch {
      setAddError("Connection error. Try again.");
    } finally {
      setAddingToToday(false);
    }
  }

  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.92)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px 16px", animation: "fadeIn 0.18s ease", overflowY: "auto" }}>
      <div className="modal-anim" style={{ width: "100%", maxWidth: 640, overflow: "hidden", borderRadius: 3, border: `0.5px solid ${D.borderMid}`, boxShadow: "0 40px 100px rgba(0,0,0,0.8)", background: D.bgSection, display: "flex", flexDirection: "column", maxHeight: "90vh" }}>

        {/* Header */}
        <div style={{ padding: "20px 24px 16px", borderBottom: `0.5px solid ${D.border}`, flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <div style={{ width: 18, height: 2, background: D.red }} />
                <span style={{ fontSize: 9, fontWeight: 900, letterSpacing: "0.22em", textTransform: "uppercase", color: D.red }}>Workout</span>
                {TIER[f.tier] && (
                  <span style={{ fontSize: 9, fontWeight: 900, letterSpacing: "0.14em", textTransform: "uppercase", color: TIER[f.tier].color, background: TIER[f.tier].bg, padding: "3px 8px" }}>
                    {f.tier}
                  </span>
                )}
              </div>
              <h2 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontStyle: "italic", fontSize: "clamp(1.4rem, 3vw, 2rem)", lineHeight: 0.9, letterSpacing: "-0.02em", textTransform: "uppercase", color: D.text, marginBottom: f.description ? 8 : 0 }}>
                {f.title}
              </h2>
              {f.description && <p style={{ fontSize: 13, color: D.faint, lineHeight: 1.6 }}>{f.description}</p>}
            </div>
            <button onClick={onClose} style={{ background: D.whisper, border: `0.5px solid ${D.border}`, color: D.dim, width: 32, height: 32, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 2, flexShrink: 0, fontSize: 16 }}>✕</button>
          </div>

          {/* Exercise count summary */}
          {meaningful.length > 0 && (
            <div style={{ marginTop: 14, display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 11, color: D.faint }}>{meaningful.length} exercise{meaningful.length !== 1 ? "s" : ""}</span>
              {Object.keys(groupColors).length > 0 && (
                <span style={{ fontSize: 11, color: "#9B7AFF" }}>· includes supersets</span>
              )}
            </div>
          )}
        </div>

        {/* Exercise list */}
        <div style={{ flex: 1, overflowY: "auto", padding: "16px 24px" }}>
          {meaningful.length === 0 ? (
            <p style={{ fontSize: 13, color: D.faint, textAlign: "center", padding: "32px 0" }}>No exercises in this workout yet.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {meaningful.map((ex, i) => {
                const isGrouped = Boolean(ex.groupId);
                const gColor    = isGrouped ? groupColors[ex.groupId] : null;
                const isFirst   = isGrouped && meaningful[i - 1]?.groupId !== ex.groupId;
                const isLast    = isGrouped && meaningful[i + 1]?.groupId !== ex.groupId;

                return (
                  <div key={i}>
                    {/* Group header */}
                    {isGrouped && isFirst && (
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, paddingLeft: 4 }}>
                        <span style={{ fontSize: 9, fontWeight: 900, letterSpacing: "0.14em", textTransform: "uppercase", color: gColor }}>
                          {groupMap[ex.groupId].length >= 3 ? "Circuit" : "Superset"} · back to back · rest after
                        </span>
                      </div>
                    )}

                    <div style={{
                      padding:      "12px 14px",
                      background:   D.bgCard,
                      border:       `0.5px solid ${isGrouped ? `${gColor}30` : D.border}`,
                      borderLeft:   isGrouped ? `3px solid ${gColor}` : undefined,
                      borderRadius: isGrouped && !isFirst && !isLast ? 0
                                  : isGrouped && isFirst && !isLast  ? "3px 3px 0 0"
                                  : isGrouped && !isFirst && isLast  ? "0 0 3px 3px"
                                  : 3,
                    }}>
                      <p style={{ fontSize: 13, fontWeight: 700, color: D.text, letterSpacing: "-0.01em", marginBottom: 6 }}>
                        {ex.ExerciseName}
                      </p>

                      {/* Sets/reps/weight row */}
                      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: ex.Instructions ? 6 : 0 }}>
                        {[
                          ex.Sets   && `${ex.Sets} sets`,
                          ex.Reps   && `${ex.Reps} reps`,
                          ex.Weight && ex.Weight,
                          ex.Rest   && `${ex.Rest} rest`,
                        ].filter(Boolean).map((val, vi) => (
                          <span key={vi} style={{ fontSize: 11, color: D.faint, fontWeight: 600 }}>{val}</span>
                        ))}
                      </div>

                      {ex.Instructions && (
                        <p style={{ fontSize: 11, color: D.faint, lineHeight: 1.55, fontStyle: "italic" }}>
                          {ex.Instructions}
                        </p>
                      )}

                      {ex.VideoURL && (
                        <a href={ex.VideoURL} target="_blank" rel="noopener"
                          style={{ display: "inline-flex", alignItems: "center", gap: 4, marginTop: 6, fontSize: 10, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: D.red, textDecoration: "none" }}
                          onClick={e => e.stopPropagation()}>
                          Watch demo →
                        </a>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer - Add to Today flow */}
        <div style={{ padding: "16px 24px", borderTop: `0.5px solid ${D.border}`, flexShrink: 0 }}>

          {/* Error */}
          {addError && (
            <p style={{ fontSize: 12, color: D.red, fontWeight: 600, textAlign: "center", marginBottom: 10 }}>
              {addError}
            </p>
          )}

          {addedToToday ? (
            /* Success state */
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, padding: "13px", background: "rgba(63,185,80,0.08)", border: `0.5px solid rgba(63,185,80,0.25)` }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={D.green} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
                <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: D.green }}>
                  Added to Today!
                </span>
              </div>
              <a
                href="/athlete/today"
                style={{ display: "block", padding: "13px", background: D.red, color: "#fff", textDecoration: "none", fontSize: 11, fontWeight: 800, letterSpacing: "0.14em", textTransform: "uppercase", textAlign: "center" }}
              >
                Go to Today →
              </a>
            </div>
          ) : (
            /* Add to Today button */
            <button
              onClick={addToToday}
              disabled={addingToToday}
              style={{
                width:         "100%",
                padding:       "13px",
                background:    addingToToday ? "rgba(218,54,51,0.4)" : D.red,
                border:        "none",
                color:         "#fff",
                fontSize:      11,
                fontWeight:    800,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                cursor:        addingToToday ? "not-allowed" : "pointer",
                fontFamily:    "inherit",
                display:       "flex",
                alignItems:    "center",
                justifyContent:"center",
                gap:           8,
              }}
            >
              {addingToToday ? (
                <>
                  <span style={{ width: 12, height: 12, border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin 0.7s linear infinite", display: "inline-block" }} />
                  Adding…
                </>
              ) : "Add to Today →"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Upgrade prompt ───────────────────────────────────────────────────────────

function UpgradePrompt({ lockedCount, nextTier, clientTier, trainerName, slug }) {
  if (lockedCount === 0) return null;
  const targetTier = nextTier ?? "Basic";
  const cfg        = TIER[targetTier];
  const isNewSub   = !clientTier;

  return (
    <div style={{ marginTop: 48, borderTop: `0.5px solid ${D.border}`, paddingTop: 48 }}>
      <div style={{ maxWidth: 560, margin: "0 auto", textAlign: "center" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, marginBottom: 16 }}>
          <div style={{ width: 20, height: "0.5px", background: cfg.color }} />
          <span style={{ fontSize: 9, fontWeight: 900, letterSpacing: "0.2em", textTransform: "uppercase", color: cfg.color }}>
            {isNewSub ? `Subscribe · ${targetTier}` : `Upgrade to ${targetTier}`}
          </span>
          <div style={{ width: 20, height: "0.5px", background: cfg.color }} />
        </div>
        <h3 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontStyle: "italic", fontSize: "clamp(1.8rem, 5vw, 3rem)", lineHeight: 0.9, letterSpacing: "-0.02em", textTransform: "uppercase", color: D.text, marginBottom: 12 }}>
          {lockedCount} More<br />{lockedCount === 1 ? "Item" : "Items"} Waiting.
        </h3>
        <p style={{ fontSize: 13, color: D.dim, lineHeight: 1.65, marginBottom: 28 }}>
          {isNewSub
            ? `Subscribe to ${targetTier} to unlock the full ${trainerName} program.`
            : `Unlock the full ${trainerName} program.`}
        </p>
        <a href={`/trainer/${slug}`} style={{ display: "inline-block", padding: "13px 36px", background: cfg.color, color: "#fff", textDecoration: "none", fontSize: 11, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", borderRadius: 2 }}>
          {isNewSub ? `Subscribe to ${targetTier} →` : "Upgrade Plan →"}
        </a>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ClientLibrary() {
  const router           = useRouter();
  const { slug }         = router.query;
  const { user, authReady } = useAuthContext();

  const [trainer,    setTrainer]    = useState(null);
  const [videos,     setVideos]     = useState([]);
  const [workouts,   setWorkouts]   = useState([]);
  const [clientTier, setClientTier] = useState(null);
  const [purchasedIds, setPurchasedIds] = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [libraryTab, setLibraryTab] = useState("videos");

  // Video state
  const [playingId,      setPlayingId]      = useState(null);
  const [videoSearch,  setVideoSearch]  = useState("");
  const [completedIds, setCompletedIds] = useState(new Set());

  // Workout state
  const [openWorkoutId, setOpenWorkoutId] = useState(null);
  const [workoutSearch, setWorkoutSearch] = useState("");

  useEffect(() => {
    if (!authReady) return;
    if (!user) { router.push(`/login?next=/trainer/${slug}/library`); return; }
    if (!slug) return;

    Promise.all([
      fetch(`/api/commercial/trainer-public?slug=${slug}`).then(r => r.json()),
      fetch(`/api/commercial/client-access?slug=${slug}`, { credentials: "include" }).then(r => r.json()),
      fetch(`/api/commercial/completions?slug=${slug}`, { credentials: "include" }).then(r => r.ok ? r.json() : { completedVideoIds: [] }),
    ]).then(([trainerData, accessData, completionData]) => {
      if (!trainerData.trainer) { router.push("/"); return; }
      // Allow in if the client has a subscription tier OR has bought at least one item.
      if (!accessData.tier && !(accessData.purchasedIds?.length)) { router.push(`/trainer/${slug}`); return; }
      setTrainer(trainerData.trainer);
      setVideos(accessData.videos ?? []);
      setWorkouts(accessData.workouts ?? []);
      setClientTier(accessData.tier);
      setPurchasedIds(accessData.purchasedIds ?? []);
      setCompletedIds(new Set(completionData.completedVideoIds ?? []));
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [user, authReady, slug, router]);

  const handleVideoCompleted = useCallback((id) => {
    setCompletedIds(prev => new Set([...prev, id]));
  }, []);

  // Start a one-time checkout for a single video or workout.
  const handleBuy = useCallback(async (itemType, itemId) => {
    try {
      const res  = await fetch("/api/commercial/purchase-checkout", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, itemType, itemId }),
      });
      const data = await res.json();
      if (res.ok && data.url) window.location.href = data.url;
      else alert(data.error || "Could not start checkout.");
    } catch {
      alert("Connection error.");
    }
  }, [slug]);


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

  // Need a trainer to render. clientTier may be null if access is purchase-only.
  if (!trainer) return null;

  const tf       = trainer.fields ?? {};
  const tierCfg  = TIER[clientTier];
  const nextTier = TIER_NEXT[clientTier] ?? (clientTier ? null : "Basic");

  // Video derived
  const accessibleVideos = videos.filter(v => canAccess(clientTier, v.fields?.tier, v.id, purchasedIds));
  const lockedVideos     = videos.filter(v => !canAccess(clientTier, v.fields?.tier, v.id, purchasedIds));
  const filteredVideos   = accessibleVideos.filter(v => {
    const q = videoSearch.trim().toLowerCase();
    if (!q) return true;
    const titleMatch = String(v.fields?.title || "").toLowerCase().includes(q);
    const tagMatch   = tagList(v.fields?.tags).some(t => t.toLowerCase().includes(q));
    return titleMatch || tagMatch;
  });
  const videoCompletedCount = accessibleVideos.filter(v => completedIds.has(v.id)).length;
  const videoProgressPct    = accessibleVideos.length > 0 ? Math.round((videoCompletedCount / accessibleVideos.length) * 100) : 0;
  const playingVid          = playingId ? videos.find(v => v.id === playingId) : null;

  // Workout derived
  const accessibleWorkouts = workouts.filter(w => canAccess(clientTier, w.fields?.tier, w.id, purchasedIds));
  const lockedWorkouts     = workouts.filter(w => !canAccess(clientTier, w.fields?.tier, w.id, purchasedIds));
  const filteredWorkouts   = accessibleWorkouts.filter(w => {
    const q = workoutSearch.trim().toLowerCase();
    if (!q) return true;
    return String(w.fields?.title || "").toLowerCase().includes(q);
  });
  const openWorkout        = openWorkoutId ? workouts.find(w => w.id === openWorkoutId) : null;

  return (
    <>
      <Head><title>{tf.name} · Program Library · CheckPeak</title></Head>

      <div style={{ minHeight: "100vh", background: D.bg, color: D.text, fontFamily: "system-ui, -apple-system, sans-serif" }}>

        {/* NAV */}
        <nav style={{ position: "sticky", top: 0, zIndex: 100, background: "rgba(7,8,8,0.92)", backdropFilter: "blur(12px)", borderBottom: `0.5px solid ${D.border}`, padding: "0 40px", height: 56, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16, minWidth: 0 }}>
            <a href="/" className="nav-link" style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: 14, letterSpacing: "0.12em", textTransform: "uppercase", color: D.faint, textDecoration: "none" }}>CheckPeak</a>
            <div style={{ width: "0.5px", height: 14, background: D.border, flexShrink: 0 }} />
            <a href={`/trainer/${slug}`} className="nav-link" style={{ fontSize: 13, fontWeight: 600, color: D.dim, textDecoration: "none", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{tf.name}</a>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
            {tierCfg
              ? <span style={{ fontSize: 9, fontWeight: 900, letterSpacing: "0.18em", textTransform: "uppercase", color: tierCfg.color, background: tierCfg.bg, padding: "5px 12px", border: `0.5px solid ${tierCfg.color}22` }}>{clientTier}</span>
              : <span style={{ fontSize: 9, fontWeight: 900, letterSpacing: "0.18em", textTransform: "uppercase", color: D.faint, background: D.whisper, padding: "5px 12px", border: `0.5px solid ${D.border}` }}>One-Time Access</span>
            }
            <a href={`/trainer/${slug}`} className="nav-link" style={{ fontSize: 11, color: D.faint, textDecoration: "none", letterSpacing: "0.04em", fontWeight: 600 }}>← Profile</a>
          </div>
        </nav>

        {/* HEADER */}
        <div style={{ background: D.bgSection, borderBottom: `0.5px solid ${D.border}`, padding: "32px 40px 24px", animation: "slideUp 0.4s ease both" }}>
          <div style={{ maxWidth: 1100, margin: "0 auto" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
              <div style={{ width: 22, height: 2, background: D.red }} />
              <span style={{ fontSize: 9, fontWeight: 900, letterSpacing: "0.22em", textTransform: "uppercase", color: D.red }}>The Program</span>
            </div>

            <div className="lib-header-row" style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16, marginBottom: 16 }}>
              <div>
                <h1 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontStyle: "italic", fontSize: "clamp(2rem, 5vw, 3.5rem)", lineHeight: 0.9, letterSpacing: "-0.025em", textTransform: "uppercase", color: D.text, marginBottom: 6 }}>{tf.name}</h1>
                <p style={{ fontSize: 12, color: D.faint }}>
                  {accessibleVideos.length} video{accessibleVideos.length !== 1 ? "s" : ""} · {accessibleWorkouts.length} workout{accessibleWorkouts.length !== 1 ? "s" : ""} · {clientTier ? `${clientTier} plan` : "one-time access"}
                </p>
              </div>
              <div style={{ textAlign: "right", flexShrink: 0 }}>
                <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontStyle: "italic", fontSize: "2rem", lineHeight: 1, letterSpacing: "-0.02em", color: videoCompletedCount === accessibleVideos.length && accessibleVideos.length > 0 ? D.green : (tierCfg?.color ?? D.red) }}>
                  {videoCompletedCount}/{accessibleVideos.length}
                </div>
                <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", color: D.faint }}>Videos done</div>
              </div>
            </div>

            {/* Progress bar */}
            {accessibleVideos.length > 0 && (
              <div style={{ position: "relative", width: "100%", height: 2, background: "rgba(255,255,255,0.06)", borderRadius: 1, overflow: "hidden", marginBottom: 16 }}>
                <div style={{ position: "absolute", top: 0, left: 0, height: "100%", width: `${videoProgressPct}%`, background: videoCompletedCount === accessibleVideos.length ? D.green : (tierCfg?.color ?? D.red), borderRadius: 1, transition: "width 1s ease" }} />
              </div>
            )}

            {/* Tab toggle */}
            <div style={{ display: "flex", gap: 2 }}>
              {[
                { key: "videos",   label: `Videos (${accessibleVideos.length})`    },
                { key: "workouts", label: `Workouts (${accessibleWorkouts.length})` },
              ].map(({ key, label }) => (
                <button key={key} className="filter-btn" onClick={() => setLibraryTab(key)}
                  style={{ padding: "8px 18px", background: libraryTab === key ? (tierCfg?.bg ?? D.whisper) : "transparent", border: `0.5px solid ${libraryTab === key ? (tierCfg?.color ?? D.red) + "55" : D.border}`, color: libraryTab === key ? (tierCfg?.color ?? D.text) : D.faint, fontSize: 11, fontWeight: libraryTab === key ? 800 : 600, letterSpacing: "0.06em", fontFamily: "inherit", borderRadius: 2 }}>
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* CONTENT */}
        <div style={{ padding: "32px 40px 64px", maxWidth: 1100, margin: "0 auto" }}>

          {/* ── VIDEOS ── */}
          {libraryTab === "videos" && (
            <>
              {/* Search */}
              <div style={{ position: "relative", marginBottom: 20 }}>
                <svg style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={D.faint} strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
                <input
                  type="text"
                  placeholder="Search by title or tag…"
                  value={videoSearch}
                  onChange={e => setVideoSearch(e.target.value)}
                  style={{ width: "100%", padding: "9px 36px 9px 36px", background: D.bgSection, border: `0.5px solid ${D.border}`, borderRadius: 3, color: D.text, fontSize: 13, fontFamily: "inherit", outline: "none" }}
                  onFocus={e => { e.currentTarget.style.borderColor = tierCfg?.color ?? D.red; }}
                  onBlur={e  => { e.currentTarget.style.borderColor = D.border; }}
                />
                {videoSearch && (
                  <button onClick={() => setVideoSearch("")} style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: D.faint, cursor: "pointer", fontSize: 18, lineHeight: 1, padding: 0 }}>×</button>
                )}
              </div>

              {videos.length === 0 ? (
                <div style={{ textAlign: "center", padding: "100px 0" }}>
                  <h3 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontStyle: "italic", fontSize: "clamp(1.8rem, 5vw, 3rem)", lineHeight: 0.9, letterSpacing: "-0.02em", textTransform: "uppercase", color: D.text, marginBottom: 12 }}>The Program<br />Is Loading Up.</h3>
                  <p style={{ fontSize: 13, color: D.faint }}>Check back soon.</p>
                </div>
              ) : filteredVideos.length === 0 ? (
                <div style={{ textAlign: "center", padding: "60px 0" }}>
                  <p style={{ fontSize: 13, color: D.faint, marginBottom: 14 }}>No videos match "{videoSearch}".</p>
                  <button onClick={() => setVideoSearch("")} style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: D.red, background: "none", border: "none", cursor: "pointer", fontFamily: "inherit" }}>Clear search →</button>
                </div>
              ) : (
                <>
                  {videoSearch && (
                    <p style={{ fontSize: 11, color: D.faint, marginBottom: 14, letterSpacing: "0.04em" }}>
                      {filteredVideos.length} result{filteredVideos.length !== 1 ? "s" : ""}
                    </p>
                  )}
                  <div className="lib-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 12, animation: "slideUp 0.45s ease 0.1s both" }}>
                    {filteredVideos.map(v => (
                      <VideoCard key={v.id} video={v} clientTier={clientTier} purchasedIds={purchasedIds} onPlay={setPlayingId} onBuy={handleBuy} isCompleted={completedIds.has(v.id)}
                        onTagClick={tag => setVideoSearch(tag)}
                      />
                    ))}
                    {!videoSearch && lockedVideos.map(v => <VideoCard key={v.id} video={v} clientTier={clientTier} purchasedIds={purchasedIds} onPlay={setPlayingId} onBuy={handleBuy} isCompleted={false} />)}
                  </div>
                </>
              )}
            </>
          )}

          {/* ── WORKOUTS ── */}
          {libraryTab === "workouts" && (
            <>
              {/* Search */}
              <div style={{ position: "relative", marginBottom: 20 }}>
                <svg style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={D.faint} strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
                <input
                  type="text"
                  placeholder="Search workouts…"
                  value={workoutSearch}
                  onChange={e => setWorkoutSearch(e.target.value)}
                  style={{ width: "100%", padding: "9px 36px 9px 36px", background: D.bgSection, border: `0.5px solid ${D.border}`, borderRadius: 3, color: D.text, fontSize: 13, fontFamily: "inherit", outline: "none" }}
                  onFocus={e => { e.currentTarget.style.borderColor = tierCfg?.color ?? D.red; }}
                  onBlur={e  => { e.currentTarget.style.borderColor = D.border; }}
                />
                {workoutSearch && (
                  <button onClick={() => setWorkoutSearch("")} style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: D.faint, cursor: "pointer", fontSize: 18, lineHeight: 1, padding: 0 }}>×</button>
                )}
              </div>

              {workouts.length === 0 ? (
                <div style={{ textAlign: "center", padding: "80px 0" }}>
                  <h3 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontStyle: "italic", fontSize: "clamp(1.6rem, 4vw, 2.5rem)", lineHeight: 0.9, letterSpacing: "-0.02em", textTransform: "uppercase", color: D.text, marginBottom: 12 }}>No Workouts Yet.</h3>
                  <p style={{ fontSize: 13, color: D.faint }}>Your coach hasn't published any workouts yet. Check back soon.</p>
                </div>
              ) : filteredWorkouts.length === 0 ? (
                <div style={{ textAlign: "center", padding: "60px 0" }}>
                  <p style={{ fontSize: 13, color: D.faint, marginBottom: 14 }}>No workouts match "{workoutSearch}".</p>
                  <button onClick={() => setWorkoutSearch("")} style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: D.red, background: "none", border: "none", cursor: "pointer", fontFamily: "inherit" }}>Clear search →</button>
                </div>
              ) : (
                <>
                  {workoutSearch && (
                    <p style={{ fontSize: 11, color: D.faint, marginBottom: 14, letterSpacing: "0.04em" }}>
                      {filteredWorkouts.length} result{filteredWorkouts.length !== 1 ? "s" : ""}
                    </p>
                  )}
                  <div className="lib-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 12, animation: "slideUp 0.45s ease 0.1s both" }}>
                    {filteredWorkouts.map(w => <WorkoutCard key={w.id} workout={w} clientTier={clientTier} purchasedIds={purchasedIds} onOpen={setOpenWorkoutId} onBuy={handleBuy} />)}
                    {!workoutSearch && lockedWorkouts.map(w => <WorkoutCard key={w.id} workout={w} clientTier={clientTier} purchasedIds={purchasedIds} onOpen={setOpenWorkoutId} onBuy={handleBuy} />)}
                  </div>
                </>
              )}
            </>
          )}

          {/* Upgrade prompt */}
          {(lockedVideos.length > 0 || lockedWorkouts.length > 0) && (
            <UpgradePrompt
              lockedCount={lockedVideos.length + lockedWorkouts.length}
              nextTier={nextTier}
              clientTier={clientTier}
              trainerName={tf.name?.split(" ")[0] || "this trainer"}
              slug={slug}
            />
          )}
        </div>

        {/* Modals */}
        {playingVid && (
          <PlayerModal
            video={playingVid}
            onClose={() => setPlayingId(null)}
            onCompleted={handleVideoCompleted}
          />
        )}
        {openWorkout && (
          <WorkoutViewer
            workout={openWorkout}
            clientTier={clientTier}
            onClose={() => setOpenWorkoutId(null)}
          />
        )}
      </div>

      <style>{CSS}</style>
    </>
  );
}