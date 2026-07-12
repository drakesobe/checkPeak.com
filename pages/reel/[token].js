// pages/reel/[token].js
// Public highlight reel viewer. No login required.
// Accessible at /reel/<share_token>

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/router";
import Head from "next/head";
import MuxPlayer from "@mux/mux-player-react";

const DARK   = "#05080F";
const CARD   = "#0C1220";
const BORDER = "#1E2A3A";
const AMBER  = "#F59E0B";
const DIM    = "#6B7A8D";
const WHITE  = "#F0F4FF";
const MUTED  = "#9BA8B4";

// ── SVG Icons ─────────────────────────────────────────────────────────────────
function IconFilm({ size = 18, color = DIM }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="2" width="20" height="20" rx="2" />
      <line x1="7"  y1="2"  x2="7"  y2="22" />
      <line x1="17" y1="2"  x2="17" y2="22" />
      <line x1="2"  y1="12" x2="22" y2="12" />
      <line x1="2"  y1="7"  x2="7"  y2="7"  />
      <line x1="17" y1="7"  x2="22" y2="7"  />
      <line x1="2"  y1="17" x2="7"  y2="17" />
      <line x1="17" y1="17" x2="22" y2="17" />
    </svg>
  );
}

function IconPlay({ size = 10, color = "#000" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <polygon points="5,3 19,12 5,21" />
    </svg>
  );
}

function IconChevronLeft({ size = 16, color = WHITE }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15 18 9 12 15 6" />
    </svg>
  );
}

function IconChevronRight({ size = 16, color = WHITE }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

function IconBolt({ size = 18, color = "#000" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtDate(iso) {
  if (!iso) return null;
  try { return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }); }
  catch { return null; }
}

// ── PlayCard ──────────────────────────────────────────────────────────────────
function PlayCard({ play, index, isActive, onClick }) {
  return (
    <button
      onClick={() => onClick(index)}
      style={{
        display: "flex", alignItems: "center", gap: 14,
        background: isActive ? "#1A2535" : "transparent",
        border: `1px solid ${isActive ? "#2E4060" : BORDER}`,
        borderRadius: 12, padding: "12px 14px", width: "100%",
        cursor: "pointer", textAlign: "left", transition: "all 0.15s",
      }}
    >
      {/* Thumbnail */}
      <div style={{ width: 88, height: 54, borderRadius: 8, overflow: "hidden", flexShrink: 0, background: "#111827", position: "relative" }}>
        {play.thumb ? (
          <img src={play.thumb} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
        ) : (
          <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <IconFilm size={20} color={DIM} />
          </div>
        )}
        {isActive && (
          <div style={{
            position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center",
            background: "rgba(0,0,0,0.4)",
          }}>
            <div style={{ width: 26, height: 26, borderRadius: "50%", background: AMBER, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <IconPlay size={10} color="#000" />
            </div>
          </div>
        )}
      </div>

      {/* Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 4 }}>
          <span style={{ fontSize: 10, fontWeight: 800, color: AMBER, background: "rgba(245,158,11,0.12)", borderRadius: 4, padding: "1px 6px" }}>
            #{index + 1}
          </span>
          {play.play_type && (
            <span style={{ fontSize: 10, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: "0.06em" }}>{play.play_type}</span>
          )}
          {play.result && (
            <span style={{ fontSize: 10, color: DIM }}>{play.result}</span>
          )}
        </div>
        <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: isActive ? WHITE : "#CBD5E0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {play.film_title || (play.opponent ? `vs ${play.opponent}` : "Film")}
        </p>
        {play.game_date && (
          <p style={{ margin: "2px 0 0", fontSize: 11, color: DIM }}>{fmtDate(play.game_date)}</p>
        )}
        {play.highlight && (
          <p style={{ margin: "4px 0 0", fontSize: 11, color: AMBER, fontWeight: 700, fontStyle: "italic", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            "{play.highlight}"
          </p>
        )}
      </div>
    </button>
  );
}

// ── Mux video player with clip enforcement + athlete edits ────────────────────
function ClipPlayer({ play }) {
  const playerRef = useRef(null);
  const ed        = play?.editData ?? null;
  const startTime = (play?.start_time_secs ?? 0) + (ed?.startTrim ?? 0);
  const endTime   = play?.end_time_secs != null ? play.end_time_secs - (ed?.endTrim ?? 0) : null;
  const startRef  = useRef(startTime);
  const endRef    = useRef(endTime);

  useEffect(() => {
    if (!play) return;
    startRef.current = (play.start_time_secs ?? 0) + (play.editData?.startTrim ?? 0);
    endRef.current   = play.end_time_secs != null ? play.end_time_secs - (play.editData?.endTrim ?? 0) : null;
  }, [play?.id]);

  if (!play) return null;

  const hasCircle = ed?.circleX != null && ed?.circleY != null;

  return (
    <div style={{ position: "relative", width: "100%", paddingTop: "56.25%", background: "#000", borderRadius: 12, overflow: "hidden" }}>
      <style>{`
        @keyframes cp-pulse {
          0%,100% { transform: translate(-50%,-50%) scale(1);   opacity: 0.9; }
          50%      { transform: translate(-50%,-50%) scale(1.18); opacity: 0.5; }
        }
      `}</style>
      <div style={{ position: "absolute", inset: 0 }}>
        <MuxPlayer
          ref={playerRef}
          key={play.id}
          playbackId={play.mux_playback_id}
          streamType="on-demand"
          startTime={startTime}
          style={{ width: "100%", height: "100%" }}
          accentColor={AMBER}
          onTimeUpdate={e => {
            const end = endRef.current;
            if (end != null && e.target.currentTime >= end) {
              e.target.pause();
              e.target.currentTime = startRef.current;
            }
          }}
        />
        {hasCircle && (
          <div
            style={{
              position: "absolute",
              left:   `${ed.circleX * 100}%`,
              top:    `${ed.circleY * 100}%`,
              width: 56, height: 56,
              borderRadius: "50%",
              border: `3px solid ${AMBER}`,
              boxShadow: `0 0 0 2px rgba(245,158,11,0.25), 0 0 16px rgba(245,158,11,0.4)`,
              background: "rgba(245,158,11,0.12)",
              pointerEvents: "none",
              animation: "cp-pulse 1.6s ease-in-out infinite",
              transform: "translate(-50%, -50%)",
            }}
          />
        )}
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function ReelPage() {
  const router = useRouter();
  const { token } = router.query;

  const [loading,   setLoading]   = useState(true);
  const [reel,      setReel]      = useState(null);
  const [plays,     setPlays]     = useState([]);
  const [activeIdx, setActiveIdx] = useState(0);
  const [notFound,  setNotFound]  = useState(false);

  useEffect(() => {
    if (!token) return;
    fetch(`/api/reel/${token}`)
      .then(r => r.json())
      .then(d => {
        if (!d.ok) { setNotFound(true); return; }
        setReel(d.reel);
        setPlays(d.plays ?? []);
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [token]);

  const activePlay = plays[activeIdx] ?? null;

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: DARK, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } } * { box-sizing: border-box; } body { margin: 0; }`}</style>
        <div style={{ textAlign: "center" }}>
          <div style={{ width: 36, height: 36, border: `3px solid ${BORDER}`, borderTopColor: AMBER, borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto 14px" }} />
          <p style={{ color: DIM, fontSize: 13, margin: 0 }}>Loading reel…</p>
        </div>
      </div>
    );
  }

  if (notFound || !reel) {
    return (
      <div style={{ minHeight: "100vh", background: DARK, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <style>{`* { box-sizing: border-box; } body { margin: 0; }`}</style>
        <div style={{ textAlign: "center", padding: 24 }}>
          <div style={{ width: 64, height: 64, borderRadius: 16, background: "#111827", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px" }}>
            <IconFilm size={28} color={DIM} />
          </div>
          <h1 style={{ color: WHITE, fontSize: 22, fontWeight: 800, margin: "0 0 8px" }}>Reel not found</h1>
          <p style={{ color: DIM, fontSize: 14, margin: 0 }}>This link may have expired or been removed by the athlete.</p>
        </div>
      </div>
    );
  }

  const hasList = plays.length > 1;

  return (
    <>
      <Head>
        <title>{reel.title} — CheckPeak Highlight Reel</title>
        <meta name="description" content={`Watch this highlight reel on CheckPeak — ${plays.length} plays`} />
        <meta property="og:title" content={reel.title} />
        <meta property="og:description" content={`${plays.length} highlight plays`} />
        {activePlay?.thumb && <meta property="og:image" content={activePlay.thumb} />}
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <style>{`
        * { box-sizing: border-box; }
        body { margin: 0; background: ${DARK}; font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: ${WHITE}; }
        button { font-family: inherit; }
        @keyframes spin { to { transform: rotate(360deg); } }
        mux-player { display: block; }
      `}</style>

      <div style={{ minHeight: "100vh", background: DARK }}>

        {/* Sticky header */}
        <div style={{
          background: "rgba(5,8,15,0.92)", backdropFilter: "blur(14px)",
          borderBottom: `1px solid ${BORDER}`, padding: "14px 24px",
          display: "flex", alignItems: "center", gap: 14,
          position: "sticky", top: 0, zIndex: 20,
        }}>
          <div style={{ width: 34, height: 34, borderRadius: 8, background: AMBER, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <IconBolt size={16} color="#000" />
          </div>
          <div>
            <p style={{ margin: 0, fontSize: 9, fontWeight: 800, color: AMBER, textTransform: "uppercase", letterSpacing: "0.12em" }}>CheckPeak · Highlight Reel</p>
            <h1 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: WHITE, lineHeight: 1.25 }}>{reel.title}</h1>
          </div>
          <div style={{ flex: 1 }} />
          <div style={{ textAlign: "right" }}>
            <p style={{ margin: 0, fontSize: 22, fontWeight: 900, color: WHITE, lineHeight: 1 }}>{plays.length}</p>
            <p style={{ margin: "2px 0 0", fontSize: 9, color: DIM, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em" }}>plays</p>
          </div>
        </div>

        {/* Main content grid */}
        <div style={{
          maxWidth: 1120, margin: "0 auto", padding: "28px 20px 48px",
          display: "grid",
          gridTemplateColumns: hasList ? "1fr 340px" : "min(680px,100%)",
          justifyContent: hasList ? undefined : "center",
          gap: 24, alignItems: "start",
        }}>

          {/* Player + info column */}
          <div>
            <ClipPlayer play={activePlay} />

            {activePlay && (
              <div style={{ marginTop: 14, padding: "16px 20px", background: CARD, border: `1px solid ${BORDER}`, borderRadius: 14 }}>
                {/* Meta tags row */}
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 8 }}>
                  <span style={{ fontSize: 11, fontWeight: 800, color: AMBER, background: "rgba(245,158,11,0.1)", borderRadius: 5, padding: "2px 8px" }}>
                    Play #{activeIdx + 1}
                  </span>
                  {activePlay.play_type && (
                    <span style={{ fontSize: 10, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                      {activePlay.play_type}
                    </span>
                  )}
                  {activePlay.result && (
                    <span style={{ fontSize: 11, color: DIM }}>{activePlay.result}</span>
                  )}
                  {activePlay.formation && (
                    <span style={{ fontSize: 11, color: DIM }}>· {activePlay.formation}</span>
                  )}
                </div>
                <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: WHITE }}>
                  {activePlay.film_title || (activePlay.opponent ? `vs ${activePlay.opponent}` : "Film")}
                </p>
                {activePlay.game_date && (
                  <p style={{ margin: "3px 0 0", fontSize: 12, color: DIM }}>{fmtDate(activePlay.game_date)}</p>
                )}

                {activePlay.highlight && (
                  <div style={{ marginTop: 12, padding: "9px 12px", background: "rgba(245,158,11,0.08)", borderRadius: 10, borderLeft: `3px solid ${AMBER}` }}>
                    <p style={{ margin: "0 0 2px", fontSize: 10, fontWeight: 800, color: AMBER, textTransform: "uppercase", letterSpacing: "0.08em" }}>Athlete Note</p>
                    <p style={{ margin: 0, fontSize: 13, color: WHITE, fontStyle: "italic" }}>"{activePlay.highlight}"</p>
                  </div>
                )}

                {/* Prev / Next navigation */}
                {plays.length > 1 && (
                  <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
                    <button
                      onClick={() => setActiveIdx(i => Math.max(0, i - 1))}
                      disabled={activeIdx === 0}
                      style={{
                        flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                        padding: "10px 14px", borderRadius: 10,
                        border: `1px solid ${BORDER}`, background: "transparent",
                        color: activeIdx === 0 ? DIM : WHITE, fontSize: 13, fontWeight: 700,
                        cursor: activeIdx === 0 ? "not-allowed" : "pointer", opacity: activeIdx === 0 ? 0.45 : 1,
                      }}
                    >
                      <IconChevronLeft size={14} color={activeIdx === 0 ? DIM : WHITE} />
                      Previous
                    </button>
                    <button
                      onClick={() => setActiveIdx(i => Math.min(plays.length - 1, i + 1))}
                      disabled={activeIdx === plays.length - 1}
                      style={{
                        flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                        padding: "10px 14px", borderRadius: 10,
                        border: "none", background: AMBER,
                        color: "#000", fontSize: 13, fontWeight: 800,
                        cursor: activeIdx === plays.length - 1 ? "not-allowed" : "pointer",
                        opacity: activeIdx === plays.length - 1 ? 0.4 : 1,
                      }}
                    >
                      Next
                      <IconChevronRight size={14} color="#000" />
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Playlist sidebar — only when more than one play */}
          {hasList && (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <p style={{ margin: "0 0 10px", fontSize: 10, fontWeight: 800, color: DIM, textTransform: "uppercase", letterSpacing: "0.1em" }}>
                All Plays · {plays.length}
              </p>
              {plays.map((p, i) => (
                <PlayCard
                  key={p.id}
                  play={p}
                  index={i}
                  isActive={i === activeIdx}
                  onClick={setActiveIdx}
                />
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ textAlign: "center", padding: "20px 16px 36px", borderTop: `1px solid ${BORDER}` }}>
          <p style={{ margin: 0, fontSize: 12, color: DIM }}>
            Powered by{" "}
            <a href="https://checkpeak.com" style={{ color: AMBER, textDecoration: "none", fontWeight: 700 }}>
              CheckPeak
            </a>
            {" "}· The next generation of sports film
          </p>
        </div>
      </div>
    </>
  );
}
