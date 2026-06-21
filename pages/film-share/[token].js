// pages/film-share/[token].js  –  Public read-only film / cut-up viewer
// No authentication required.

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";
import Head from "next/head";
import {
  Play, SkipBack, SkipForward, ListVideo, Film,
  ChevronDown, ChevronUp, Clock,
} from "lucide-react";

const DS = {
  pageBg:   "#0a0c12",
  cardBg:   "#13151f",
  brand:    "#4FABFF",
  border:   "rgba(255,255,255,0.08)",
  bodyText: "#f0f2f6",
  labelText:"#9ba8b4",
  dimText:  "#5a6a7d",
  safe:     "#34C759",
  warn:     "#FF3B30",
};

function fmtTime(s) {
  if (s == null) return "–";
  const m = Math.floor(s / 60), sec = Math.floor(s % 60);
  return `${m}:${String(sec).padStart(2, "0")}`;
}
function downLabel(down, dist) {
  if (!down) return null;
  return dist ? `${down} & ${dist}` : `${down}th`;
}

export default function FilmSharePage() {
  const router      = useRouter();
  const { token }   = router.query;
  const videoRef    = useRef(null);

  const [data,   setData]   = useState(null);
  const [error,  setError]  = useState("");
  const [cutup,  setCutup]  = useState(null); // { plays, index }
  const [selIdx, setSelIdx] = useState(0);

  useEffect(() => {
    if (!token) return;
    fetch(`/api/film/share?token=${token}`)
      .then(r => r.json())
      .then(d => {
        if (!d.ok) { setError(d.error ?? "Link not found"); return; }
        setData(d);
        if (d.type === "cutup" && d.playlist?.items?.length) {
          setCutup({ plays: d.playlist.items, index: 0 });
        }
      })
      .catch(() => setError("Failed to load"));
  }, [token]);

  // Seek video when cutup index changes
  useEffect(() => {
    if (!cutup || !videoRef.current) return;
    const play = cutup.plays[cutup.index];
    if (play?.start_time_secs != null) {
      videoRef.current.currentTime = play.start_time_secs;
      videoRef.current.play().catch(() => {});
    }
  }, [cutup?.index]);

  // Auto-advance cut-up
  function handleTimeUpdate() {
    if (!cutup || !videoRef.current) return;
    const cur = cutup.plays[cutup.index];
    if (cur?.end_time_secs != null && videoRef.current.currentTime >= cur.end_time_secs - 0.2) {
      if (cutup.index < cutup.plays.length - 1) {
        setCutup(c => ({ ...c, index: c.index + 1 }));
      }
    }
  }

  const videoUrl = data?.videoUrl;
  const muxId    = data?.film?.mux_playback_id;
  const title    = data?.title ?? "Film";
  const plays    = data?.type === "film" ? (data.plays ?? []) : (data?.playlist?.items ?? []);
  const [panelOpen, setPanelOpen] = useState(true);

  if (error) {
    return (
      <div style={{ minHeight: "100vh", background: DS.pageBg, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center" }}>
          <p style={{ fontSize: 48, margin: "0 0 12px" }}>🔒</p>
          <h2 style={{ color: DS.bodyText, fontWeight: 800, marginBottom: 8 }}>Link not found</h2>
          <p style={{ color: DS.labelText }}>{error}</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div style={{ minHeight: "100vh", background: DS.pageBg, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ width: 36, height: 36, border: "3px solid rgba(79,171,255,0.2)", borderTopColor: DS.brand, borderRadius: "50%", animation: "spin 1s linear infinite" }} />
      </div>
    );
  }

  function seekTo(play) {
    if (!videoRef.current || play?.start_time_secs == null) return;
    videoRef.current.currentTime = play.start_time_secs;
    videoRef.current.play().catch(() => {});
    if (cutup) setCutup(c => ({ ...c, index: cutup.plays.findIndex(p => p.id === play.id) }));
    else setSelIdx(plays.indexOf(play));
  }

  const currentPlay = cutup ? cutup.plays[cutup.index] : plays[selIdx];

  return (
    <>
      <Head>
        <title>{title} · CheckPeak Film</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: ${DS.pageBg}; color: ${DS.bodyText}; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
        @keyframes spin { to { transform: rotate(360deg); } }
        .play-card:hover { background: rgba(79,171,255,0.08) !important; }
      `}</style>

      {/* Header */}
      <div style={{ background: DS.cardBg, borderBottom: `1px solid ${DS.border}`, padding: "12px 20px", display: "flex", alignItems: "center", gap: 12 }}>
        {data.type === "cutup" ? <ListVideo size={20} color={DS.brand} /> : <Film size={20} color={DS.brand} />}
        <div>
          <h1 style={{ fontSize: 16, fontWeight: 800, color: DS.bodyText, lineHeight: 1.2 }}>{title}</h1>
          <p style={{ fontSize: 11, color: DS.labelText, marginTop: 2 }}>
            {plays.length} {data.type === "cutup" ? "plays in cut-up" : "tagged plays"} · Shared via CheckPeak
          </p>
        </div>
        {data.type === "cutup" && cutup && (
          <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
            <button
              onClick={() => setCutup(c => { const i = Math.max(0, c.index-1); seekTo(c.plays[i]); return { ...c, index: i }; })}
              disabled={cutup.index === 0}
              style={{ background: "rgba(255,255,255,0.08)", border: "none", color: DS.bodyText, borderRadius: 8, padding: "7px 12px", cursor: "pointer", display: "flex", alignItems: "center", opacity: cutup.index === 0 ? 0.4 : 1 }}>
              <SkipBack size={16} />
            </button>
            <span style={{ fontSize: 12, color: DS.labelText, alignSelf: "center", minWidth: 48, textAlign: "center" }}>
              {cutup.index + 1} / {cutup.plays.length}
            </span>
            <button
              onClick={() => setCutup(c => { const i = Math.min(c.plays.length-1, c.index+1); seekTo(c.plays[i]); return { ...c, index: i }; })}
              disabled={cutup.index >= cutup.plays.length - 1}
              style={{ background: "rgba(255,255,255,0.08)", border: "none", color: DS.bodyText, borderRadius: 8, padding: "7px 12px", cursor: "pointer", display: "flex", alignItems: "center", opacity: cutup.index >= cutup.plays.length - 1 ? 0.4 : 1 }}>
              <SkipForward size={16} />
            </button>
          </div>
        )}
      </div>

      {/* Main layout */}
      <div style={{ display: "flex", flexDirection: "column", maxWidth: 1100, margin: "0 auto", padding: 16, gap: 16 }}>

        {/* Video */}
        <div style={{ background: "#000", borderRadius: 12, overflow: "hidden", aspectRatio: "16/9", position: "relative" }}>
          {muxId ? (
            <iframe
              src={`https://stream.mux.com/${muxId}.m3u8`}
              style={{ width: "100%", height: "100%", border: "none" }}
              allow="autoplay; fullscreen"
              allowFullScreen
            />
          ) : videoUrl ? (
            <video
              ref={videoRef}
              src={videoUrl}
              controls
              style={{ width: "100%", height: "100%" }}
              onTimeUpdate={handleTimeUpdate}
            />
          ) : (
            <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 12 }}>
              <Film size={48} color={DS.dimText} style={{ opacity: 0.3 }} />
              <p style={{ color: DS.dimText, fontSize: 14 }}>No video available</p>
            </div>
          )}
        </div>

        {/* Play info bar (current play) */}
        {currentPlay && (
          <div style={{ background: DS.cardBg, border: `1px solid ${DS.border}`, borderRadius: 10, padding: "10px 16px", display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
            {downLabel(currentPlay.down, currentPlay.distance) && (
              <span style={{ fontSize: 14, fontWeight: 800, color: DS.bodyText }}>{downLabel(currentPlay.down, currentPlay.distance)}</span>
            )}
            {currentPlay.play_type && (
              <span style={{ fontSize: 11, fontWeight: 800, background: "rgba(79,171,255,0.12)", color: DS.brand, padding: "3px 8px", borderRadius: 5, textTransform: "uppercase" }}>
                {currentPlay.play_type}
              </span>
            )}
            {currentPlay.yards_gained != null && (
              <span style={{ fontSize: 13, fontWeight: 700, color: Number(currentPlay.yards_gained) >= 0 ? DS.safe : DS.warn }}>
                {Number(currentPlay.yards_gained) > 0 ? "+" : ""}{currentPlay.yards_gained} yds
              </span>
            )}
            {currentPlay.formation && (
              <span style={{ fontSize: 12, color: DS.labelText }}>{currentPlay.formation}</span>
            )}
            {currentPlay.notes && (
              <span style={{ fontSize: 12, color: DS.labelText, fontStyle: "italic", flex: 1 }}>"{currentPlay.notes}"</span>
            )}
            {currentPlay.start_time_secs != null && (
              <span style={{ fontSize: 11, color: DS.dimText, marginLeft: "auto", display: "flex", alignItems: "center", gap: 4 }}>
                <Clock size={11} /> {fmtTime(currentPlay.start_time_secs)}
              </span>
            )}
          </div>
        )}

        {/* Play list panel */}
        {plays.length > 0 && (
          <div style={{ background: DS.cardBg, border: `1px solid ${DS.border}`, borderRadius: 12, overflow: "hidden" }}>
            <button
              onClick={() => setPanelOpen(o => !o)}
              style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", background: "none", border: "none", cursor: "pointer", color: DS.bodyText }}>
              <span style={{ fontSize: 13, fontWeight: 700 }}>{data.type === "cutup" ? "Playlist" : "Plays"} ({plays.length})</span>
              {panelOpen ? <ChevronUp size={16} color={DS.labelText} /> : <ChevronDown size={16} color={DS.labelText} />}
            </button>

            {panelOpen && (
              <div style={{ maxHeight: 320, overflowY: "auto" }}>
                {plays.map((play, idx) => {
                  const isActive = currentPlay?.id === play.id;
                  const dl = downLabel(play.down, play.distance);
                  return (
                    <div
                      key={play.id ?? idx}
                      className="play-card"
                      onClick={() => { seekTo(play); if (!cutup) setSelIdx(idx); }}
                      style={{
                        display: "flex", alignItems: "center", gap: 12, padding: "9px 16px",
                        borderTop: `1px solid ${DS.border}`, cursor: "pointer",
                        background: isActive ? "rgba(79,171,255,0.1)" : "transparent",
                      }}>
                      <span style={{ width: 20, fontSize: 10, fontWeight: 700, color: DS.dimText, textAlign: "right", flexShrink: 0 }}>
                        {idx + 1}
                      </span>
                      {isActive && <div style={{ width: 3, height: 30, background: DS.brand, borderRadius: 2, flexShrink: 0 }} />}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: isActive ? DS.brand : DS.bodyText }}>
                          {dl ?? `Play #${play.play_number}`}
                          {play.play_type && (
                            <span style={{ fontSize: 10, fontWeight: 700, marginLeft: 8, color: DS.labelText, textTransform: "uppercase" }}>
                              {play.play_type}
                            </span>
                          )}
                        </p>
                        {play.notes && (
                          <p style={{ margin: "1px 0 0", fontSize: 11, color: DS.dimText, fontStyle: "italic", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {play.notes}
                          </p>
                        )}
                      </div>
                      {play.yards_gained != null && (
                        <span style={{ fontSize: 12, fontWeight: 700, color: Number(play.yards_gained) >= 0 ? DS.safe : DS.warn, flexShrink: 0 }}>
                          {Number(play.yards_gained) > 0 ? "+" : ""}{play.yards_gained}
                        </span>
                      )}
                      {play.start_time_secs != null && (
                        <span style={{ fontSize: 10, color: DS.dimText, flexShrink: 0 }}>{fmtTime(play.start_time_secs)}</span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        <p style={{ textAlign: "center", fontSize: 11, color: DS.dimText, paddingBottom: 24 }}>
          Powered by <strong style={{ color: DS.labelText }}>CheckPeak</strong> · Film Intelligence Platform
        </p>
      </div>
    </>
  );
}
