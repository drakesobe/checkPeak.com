// pages/reel/[token].js
// Public highlight reel viewer. No login required.
// Accessible at /reel/<share_token>
"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/router";
import Head from "next/head";

const DARK = "#05080F";
const CARD = "#0C1220";
const BORDER = "#1E2A3A";
const AMBER = "#F59E0B";
const DIM = "#6B7A8D";
const WHITE = "#F0F4FF";
const MUTED = "#9BA8B4";

function fmtDate(iso) {
  if (!iso) return null;
  try { return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }); }
  catch { return null; }
}

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
        <img src={play.thumb} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
        {isActive && (
          <div style={{
            position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center",
            background: "rgba(0,0,0,0.35)",
          }}>
            <div style={{ width: 22, height: 22, borderRadius: "50%", background: AMBER, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <div style={{ width: 0, height: 0, borderTop: "5px solid transparent", borderBottom: "5px solid transparent", borderLeft: "8px solid #000", marginLeft: 2 }} />
            </div>
          </div>
        )}
      </div>

      {/* Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 3 }}>
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
      </div>
    </button>
  );
}

function MuxPlayer({ play }) {
  const videoRef = useRef(null);

  useEffect(() => {
    if (!videoRef.current || !play) return;
    const start = play.start_time_secs ?? 0;
    const v = videoRef.current;
    v.currentTime = start;
    v.play().catch(() => {});

    function handleTimeUpdate() {
      if (play.end_time_secs && v.currentTime >= play.end_time_secs) {
        v.pause();
        v.currentTime = start;
      }
    }
    v.addEventListener("timeupdate", handleTimeUpdate);
    return () => v.removeEventListener("timeupdate", handleTimeUpdate);
  }, [play?.id]);

  if (!play) return null;

  return (
    <div style={{ position: "relative", width: "100%", paddingTop: "56.25%", background: "#000", borderRadius: 12, overflow: "hidden" }}>
      <video
        ref={videoRef}
        key={play.id}
        src={`https://stream.mux.com/${play.mux_playback_id}.m3u8`}
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "contain" }}
        controls
        playsInline
        autoPlay
        poster={play.thumb}
      />
    </div>
  );
}

export default function ReelPage() {
  const router = useRouter();
  const { token } = router.query;

  const [loading,    setLoading]    = useState(true);
  const [reel,       setReel]       = useState(null);
  const [plays,      setPlays]      = useState([]);
  const [activeIdx,  setActiveIdx]  = useState(0);
  const [notFound,   setNotFound]   = useState(false);

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
        <div style={{ textAlign: "center" }}>
          <div style={{ width: 40, height: 40, border: `3px solid ${BORDER}`, borderTopColor: AMBER, borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto 16px" }} />
          <p style={{ color: DIM, fontSize: 14, margin: 0 }}>Loading reel…</p>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (notFound || !reel) {
    return (
      <div style={{ minHeight: "100vh", background: DARK, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center", padding: 24 }}>
          <p style={{ fontSize: 48, margin: "0 0 16px" }}>🎬</p>
          <h1 style={{ color: WHITE, fontSize: 24, fontWeight: 800, margin: "0 0 8px" }}>Reel not found</h1>
          <p style={{ color: DIM, fontSize: 14 }}>This link may have expired or been removed.</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>{reel.title} — CheckPeak Highlight Reel</title>
        <meta name="description" content={`Watch this highlight reel powered by CheckPeak — ${plays.length} plays`} />
        <meta property="og:title" content={reel.title} />
        <meta property="og:description" content={`${plays.length} highlight plays`} />
        {activePlay?.thumb && <meta property="og:image" content={activePlay.thumb} />}
      </Head>

      <style>{`
        * { box-sizing: border-box; }
        body { margin: 0; background: ${DARK}; font-family: system-ui, -apple-system, sans-serif; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>

      <div style={{ minHeight: "100vh", background: DARK }}>

        {/* Header */}
        <div style={{ background: "rgba(5,8,15,0.95)", backdropFilter: "blur(12px)", borderBottom: `1px solid ${BORDER}`, padding: "16px 24px", display: "flex", alignItems: "center", gap: 14, position: "sticky", top: 0, zIndex: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: 9, background: AMBER, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <span style={{ fontSize: 18 }}>⚡</span>
          </div>
          <div>
            <p style={{ margin: 0, fontSize: 10, fontWeight: 800, color: AMBER, textTransform: "uppercase", letterSpacing: "0.1em" }}>CheckPeak · Highlight Reel</p>
            <h1 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: WHITE }}>{reel.title}</h1>
          </div>
          <div style={{ flex: 1 }} />
          <div style={{ textAlign: "right" }}>
            <p style={{ margin: 0, fontSize: 20, fontWeight: 900, color: WHITE }}>{plays.length}</p>
            <p style={{ margin: 0, fontSize: 10, color: DIM, fontWeight: 600 }}>PLAYS</p>
          </div>
        </div>

        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "24px 20px", display: "grid", gridTemplateColumns: plays.length > 1 ? "1fr 340px" : "1fr", gap: 20, alignItems: "start" }}>

          {/* Player column */}
          <div>
            <MuxPlayer play={activePlay} />

            {activePlay && (
              <div style={{ marginTop: 14, padding: "14px 18px", background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12 }}>
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                  <span style={{ fontSize: 12, fontWeight: 800, color: AMBER }}>Play #{activeIdx + 1}</span>
                  {activePlay.play_type && <span style={{ fontSize: 11, fontWeight: 700, color: MUTED, textTransform: "uppercase" }}>{activePlay.play_type}</span>}
                  {activePlay.result && <span style={{ fontSize: 11, color: DIM }}>{activePlay.result}</span>}
                  {activePlay.formation && <span style={{ fontSize: 11, color: DIM }}>· {activePlay.formation}</span>}
                </div>
                <p style={{ margin: "6px 0 0", fontSize: 14, fontWeight: 700, color: WHITE }}>
                  {activePlay.film_title || (activePlay.opponent ? `vs ${activePlay.opponent}` : "Film")}
                </p>
                {activePlay.game_date && <p style={{ margin: "2px 0 0", fontSize: 12, color: DIM }}>{fmtDate(activePlay.game_date)}</p>}

                {/* Navigation */}
                {plays.length > 1 && (
                  <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
                    <button
                      onClick={() => setActiveIdx(i => Math.max(0, i - 1))}
                      disabled={activeIdx === 0}
                      style={{ flex: 1, padding: "9px 14px", borderRadius: 8, border: `1px solid ${BORDER}`, background: "transparent", color: activeIdx === 0 ? DIM : WHITE, fontSize: 13, fontWeight: 700, cursor: activeIdx === 0 ? "not-allowed" : "pointer" }}
                    >
                      ← Prev
                    </button>
                    <button
                      onClick={() => setActiveIdx(i => Math.min(plays.length - 1, i + 1))}
                      disabled={activeIdx === plays.length - 1}
                      style={{ flex: 1, padding: "9px 14px", borderRadius: 8, border: "none", background: AMBER, color: "#000", fontSize: 13, fontWeight: 800, cursor: activeIdx === plays.length - 1 ? "not-allowed" : "pointer", opacity: activeIdx === plays.length - 1 ? 0.4 : 1 }}
                    >
                      Next →
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Playlist column — only when multiple plays */}
          {plays.length > 1 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <p style={{ margin: "0 0 8px", fontSize: 11, fontWeight: 800, color: DIM, textTransform: "uppercase", letterSpacing: "0.08em" }}>
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
        <div style={{ textAlign: "center", padding: "24px 16px 40px", borderTop: `1px solid ${BORDER}`, marginTop: 20 }}>
          <p style={{ margin: 0, fontSize: 12, color: DIM }}>
            Powered by{" "}
            <a href="https://checkpeak.com" style={{ color: AMBER, textDecoration: "none", fontWeight: 700 }}>CheckPeak</a>
            {" "}· The next generation of sports film
          </p>
        </div>
      </div>
    </>
  );
}
