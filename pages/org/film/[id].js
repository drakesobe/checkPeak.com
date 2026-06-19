// pages/org/film/[id].js  -  Film Intelligence tape room
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/router";
import { useAuthContext } from "@/hooks/useAuth";
import {
  ArrowLeft, BarChart2, CheckCircle2, AlertCircle, Loader2,
  Film, UserCheck, Users, RefreshCw, Play, TrendingUp,
  Shield, Share2, Volume2, VolumeX, Activity, Zap, Lock,
} from "lucide-react";
import MuxPlayer from "@mux/mux-player-react";

// ── Design tokens ─────────────────────────────────────────────────────────────
const DS = {
  pageBg:       "#F4F7FB",
  cardBg:       "#FFFFFF",
  brand:        "#1E3A5F",
  brandBg:      "#EEF3F9",
  brandBorder:  "#C0D0E0",
  safe:         "#00873E",
  safeBg:       "#F0FBF4",
  safeBorder:   "#A8DFB8",
  caution:      "#B86000",
  cautionBg:    "#FFFBF0",
  cautionBorder:"#FFD580",
  warn:         "#C8102E",
  warnBg:       "#FFF0F0",
  bodyText:     "#1A2535",
  labelText:    "#5A6A7D",
  dimText:      "#9BA8B4",
  border:       "#E8ECF0",
  fieldGreen:   "#2d6a4f",
  fieldStripe:  "rgba(0,0,0,0.04)",
  fieldLine:    "rgba(255,255,255,0.15)",
};

const TEAM_COLORS = {
  home:    { fill: "#1E3A5F", text: "#fff", route: "#60A5FA" },
  away:    { fill: "#9B1C1C", text: "#fff", route: "#FCA5A5" },
  default: { fill: "#374151", text: "#fff", route: "#D1D5DB" },
};
function teamColors(team) {
  return TEAM_COLORS[team] ?? TEAM_COLORS.default;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function cap(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, " ") : ""; }
function fmtSpd(v) { return v != null ? `${Number(v).toFixed(1)} mph` : "–"; }
function fmtAcc(v) { return v != null ? `${Number(v).toFixed(2)} m/s²` : "–"; }
function fmtMs(v)  { return v != null ? `${v} ms` : "–"; }
function fmtYd(v)  {
  if (v == null) return "–";
  const n = Number(v);
  return (n >= 0 ? "+" : "") + n + " yd";
}
function fmtTime(s) {
  if (s == null) return "–";
  const m = Math.floor(s / 60), sec = Math.floor(s % 60);
  return `${m}:${String(sec).padStart(2, "0")}`;
}
function resultColor(r) {
  const s = String(r || "").toLowerCase();
  if (s === "success" || s === "td")       return DS.safe;
  if (s === "failure" || s === "turnover") return DS.warn;
  return DS.caution;
}
function resultBg(r) {
  const s = String(r || "").toLowerCase();
  if (s === "success" || s === "td")       return DS.safeBg;
  if (s === "failure" || s === "turnover") return DS.warnBg;
  return DS.cautionBg;
}

function interpolatePos(routeJson, t) {
  if (!Array.isArray(routeJson) || routeJson.length === 0) return null;
  const pts = routeJson.filter(p => p?.t != null && p?.x != null && p?.y != null);
  if (!pts.length) return null;
  if (t <= pts[0].t) return { x: pts[0].x, y: pts[0].y };
  const last = pts[pts.length - 1];
  if (t >= last.t) return { x: last.x, y: last.y };
  for (let i = 0; i < pts.length - 1; i++) {
    if (t >= pts[i].t && t < pts[i + 1].t) {
      const a = (t - pts[i].t) / (pts[i + 1].t - pts[i].t);
      return { x: pts[i].x + a * (pts[i + 1].x - pts[i].x), y: pts[i].y + a * (pts[i + 1].y - pts[i].y) };
    }
  }
  return null;
}

// ── Formation Diagram ─────────────────────────────────────────────────────────
function FormationDiagram({ tracks = [], roster = [], currentTime = 0, onPlayerClick, highlightJersey }) {
  const FIELD_W = 53.33;
  const DOT_R   = 13;
  const PAD     = 10; // yards padding around players

  const snapYs = tracks.map(t => t.snap_y).filter(v => v != null);
  const minSnap = snapYs.length ? Math.min(...snapYs) : 42;
  const maxSnap = snapYs.length ? Math.max(...snapYs) : 58;
  const viewH   = Math.max(maxSnap - minSnap + PAD * 2, 28);
  const minY    = ((minSnap + maxSnap) / 2) - viewH / 2;

  const SVG_W = 640, SVG_H = 300;
  const sx = SVG_W / FIELD_W;
  const sy = SVG_H / viewH;

  function toSvg(x, y) {
    return { cx: x * sx, cy: SVG_H - (y - minY) * sy };
  }

  // Deduplicate by track ID or jersey+team
  const playerMap = new Map();
  for (const t of tracks) {
    const key = t.rekognition_track_id ?? `${t.jersey_number}-${t.team}`;
    if (!playerMap.has(key)) playerMap.set(key, t);
  }
  const players = Array.from(playerMap.values());

  // Yard lines to draw
  const yLines = [];
  for (let y = Math.ceil(minY / 5) * 5; y <= minY + viewH; y += 5) {
    if (y >= 0 && y <= 100) {
      yLines.push({ y, svgY: SVG_H - (y - minY) * sy, major: y % 10 === 0 });
    }
  }

  const losY = SVG_H - (((minSnap + maxSnap) / 2) - minY) * sy;

  return (
    <div style={{ background: DS.fieldGreen, borderRadius: 10, overflow: "hidden", position: "relative", userSelect: "none" }}>
      <svg width="100%" viewBox={`0 0 ${SVG_W} ${SVG_H}`} style={{ display: "block" }}>
        {/* Background stripes */}
        {yLines.filter(l => l.major).map((l, i) => (
          <rect key={i} x={0} y={SVG_H - (l.y + 10 - minY) * sy} width={SVG_W} height={10 * sy}
            fill={i % 2 === 0 ? DS.fieldStripe : "transparent"} />
        ))}

        {/* Yard lines */}
        {yLines.map(l => (
          <line key={l.y} x1={0} y1={l.svgY} x2={SVG_W} y2={l.svgY}
            stroke={l.major ? "rgba(255,255,255,0.28)" : DS.fieldLine}
            strokeWidth={l.major ? 1.5 : 0.7} />
        ))}

        {/* Yard numbers */}
        {yLines.filter(l => l.major && l.y >= 10 && l.y <= 90).map(l => {
          const n = l.y > 50 ? 100 - l.y : l.y;
          return (
            <g key={l.y}>
              <text x={16} y={l.svgY - 5} fill="rgba(255,255,255,0.35)" fontSize={10} fontWeight={700} fontFamily="system-ui">{n}</text>
              <text x={SVG_W - 16} y={l.svgY - 5} textAnchor="end" fill="rgba(255,255,255,0.35)" fontSize={10} fontWeight={700} fontFamily="system-ui">{n}</text>
            </g>
          );
        })}

        {/* Hash marks */}
        {yLines.map(l => (
          <g key={`h-${l.y}`}>
            <line x1={SVG_W / 3 - 5} y1={l.svgY} x2={SVG_W / 3 + 5} y2={l.svgY} stroke="rgba(255,255,255,0.22)" strokeWidth={1} />
            <line x1={SVG_W * 2 / 3 - 5} y1={l.svgY} x2={SVG_W * 2 / 3 + 5} y2={l.svgY} stroke="rgba(255,255,255,0.22)" strokeWidth={1} />
          </g>
        ))}

        {/* Line of scrimmage */}
        <line x1={0} y1={losY} x2={SVG_W} y2={losY} stroke="rgba(255,215,0,0.8)" strokeWidth={2.5} strokeDasharray="14 7" />
        <text x={SVG_W - 8} y={losY - 6} textAnchor="end" fill="rgba(255,215,0,0.9)" fontSize={9} fontWeight={800} fontFamily="system-ui">LOS</text>

        {/* Past routes */}
        {players.map((t, i) => {
          if (!Array.isArray(t.route_json)) return null;
          const pts = t.route_json.filter(p => p?.t != null && p?.x != null && p?.y != null);
          const past = currentTime > 0 ? pts.filter(p => p.t <= currentTime) : pts;
          if (past.length < 2) return null;
          const d = past.map(p => { const { cx, cy } = toSvg(p.x, p.y); return `${cx},${cy}`; }).join(" ");
          return (
            <polyline key={`pr-${i}`} points={d} fill="none"
              stroke={teamColors(t.team).route} strokeWidth={2.5} opacity={0.8}
              strokeLinecap="round" strokeLinejoin="round" />
          );
        })}

        {/* Future routes (dashed) */}
        {currentTime > 0 && players.map((t, i) => {
          if (!Array.isArray(t.route_json)) return null;
          const pts = t.route_json.filter(p => p?.t != null && p?.x != null && p?.y != null);
          const future = pts.filter(p => p.t >= currentTime);
          if (future.length < 2) return null;
          const d = future.map(p => { const { cx, cy } = toSvg(p.x, p.y); return `${cx},${cy}`; }).join(" ");
          return (
            <polyline key={`fr-${i}`} points={d} fill="none"
              stroke={teamColors(t.team).route} strokeWidth={1.5} opacity={0.3}
              strokeDasharray="5 5" />
          );
        })}

        {/* Player dots */}
        {players.map((t, i) => {
          const curPos = currentTime > 0 && t.route_json ? interpolatePos(t.route_json, currentTime) : null;
          const fx = curPos?.x ?? t.snap_x;
          const fy = curPos?.y ?? t.snap_y;
          if (fx == null || fy == null) return null;

          const { cx, cy } = toSvg(fx, fy);
          const col = teamColors(t.team);
          const lbl = t.jersey_number != null ? String(t.jersey_number) : "?";
          const rp  = roster.find(r => r.jersey_number === t.jersey_number);
          const hl  = highlightJersey != null && t.jersey_number === highlightJersey;
          const tipText = rp ? `#${lbl} ${rp.player_name}${rp.position ? ` · ${rp.position}` : ""}` : `#${lbl}`;

          return (
            <g key={`dot-${i}`} onClick={() => onPlayerClick?.(hl ? null : t.jersey_number)} style={{ cursor: "pointer" }}>
              {hl && <circle cx={cx} cy={cy} r={DOT_R + 6} fill="none" stroke="#FFD700" strokeWidth={3} opacity={0.95} />}
              <circle cx={cx} cy={cy} r={DOT_R} fill={col.fill} stroke="#fff" strokeWidth={2} />
              <text x={cx} y={cy + 4} textAnchor="middle" fill={col.text}
                fontSize={lbl.length > 2 ? 7 : 9} fontWeight={800} fontFamily="system-ui">
                {lbl}
              </text>
              <title>{tipText}</title>
            </g>
          );
        })}
      </svg>

      {/* Legend */}
      <div style={{ position: "absolute", bottom: 8, right: 10, display: "flex", gap: 10 }}>
        {[["home", "Home"], ["away", "Away"]].map(([key, label]) => (
          <div key={key} style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <div style={{ width: 10, height: 10, borderRadius: "50%", background: TEAM_COLORS[key].fill, border: "1.5px solid #fff" }} />
            <span style={{ fontSize: 9, fontWeight: 700, color: "rgba(255,255,255,0.65)", textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Video Player ──────────────────────────────────────────────────────────────
// Priority: Mux (full film, seekable) → S3 presigned URL (full film fallback) → clip_url (individual play clip)
function VideoPlayer({ playbackId, s3Url, clipUrl, playNumber, onTimeUpdate, videoRef }) {
  const fullFilmSrc = s3Url || null;
  const hasVideo = playbackId || fullFilmSrc || clipUrl;

  if (!hasVideo) {
    return (
      <div style={{
        background: "#0a0c12", borderRadius: 10,
        aspectRatio: "16/9", display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center", gap: 10,
      }}>
        <Film size={40} color="rgba(255,255,255,0.1)" />
        <p style={{ margin: 0, fontSize: 12, color: "rgba(255,255,255,0.28)", fontWeight: 600 }}>
          {playNumber ? `Play #${playNumber} - video preparing` : "Video will appear here once ready"}
        </p>
      </div>
    );
  }

  if (playbackId) {
    return (
      <div style={{ borderRadius: 10, overflow: "hidden", aspectRatio: "16/9", background: "#000" }}>
        <MuxPlayer
          ref={videoRef}
          playbackId={playbackId}
          streamType="on-demand"
          style={{ width: "100%", height: "100%" }}
          onTimeUpdate={e => onTimeUpdate?.(e.target.currentTime)}
          accentColor="#4FABFF"
        />
      </div>
    );
  }

  // S3 presigned URL (full film) or individual play clip
  const src = fullFilmSrc || clipUrl;
  return (
    <div style={{ position: "relative", background: "#000", borderRadius: 10, overflow: "hidden", aspectRatio: "16/9" }}>
      <video
        ref={videoRef}
        src={src}
        style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }}
        controls
        preload="metadata"
        onTimeUpdate={e => onTimeUpdate?.(e.target.currentTime)}
      />
    </div>
  );
}

// ── Play Sidebar ──────────────────────────────────────────────────────────────
function PlaySidebar({ plays, selectedId, onSelect }) {
  const [filter, setFilter] = useState("all");

  const types = useMemo(() => {
    const s = new Set(plays.map(p => p.play_type).filter(Boolean));
    return ["all", ...Array.from(s)];
  }, [plays]);

  const visible = useMemo(() =>
    filter === "all" ? plays : plays.filter(p => p.play_type === filter),
  [plays, filter]);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
      {/* Filter chips */}
      <div style={{ display: "flex", gap: 5, flexWrap: "wrap", paddingBottom: 10, borderBottom: `1px solid ${DS.border}`, marginBottom: 10 }}>
        {types.map(t => (
          <button key={t} onClick={() => setFilter(t)} style={{
            border: "none", borderRadius: 20, padding: "4px 10px",
            fontSize: 10, fontWeight: 700, cursor: "pointer", letterSpacing: "0.04em",
            textTransform: "uppercase",
            background: filter === t ? DS.brand : DS.pageBg,
            color:      filter === t ? "#fff"    : DS.labelText,
          }}>
            {t === "all" ? `All (${plays.length})` : cap(t)}
          </button>
        ))}
      </div>

      {/* List */}
      <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 3 }}>
        {visible.map(play => {
          const sel = play.id === selectedId;
          return (
            <div key={play.id} onClick={() => onSelect(play)} style={{
              display: "flex", alignItems: "center", gap: 10,
              padding: "9px 10px", borderRadius: 8, cursor: "pointer",
              background: sel ? DS.brandBg : "transparent",
              border: `1px solid ${sel ? DS.brandBorder : "transparent"}`,
              transition: "all 0.1s",
            }}>
              <span style={{
                width: 26, height: 26, borderRadius: 6, flexShrink: 0,
                background: sel ? DS.brand : DS.pageBg,
                color: sel ? "#fff" : DS.labelText,
                fontWeight: 800, fontSize: 11,
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                {play.play_number}
              </span>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 1 }}>
                  {play.down && play.distance && (
                    <span style={{ fontSize: 11, fontWeight: 700, color: DS.bodyText }}>
                      {play.down}&amp;{play.distance}
                    </span>
                  )}
                  {play.play_type && (
                    <span style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", color: DS.dimText }}>
                      {play.play_type}
                    </span>
                  )}
                </div>
                <span style={{ fontSize: 10, color: DS.dimText }}>{fmtTime(play.start_time_secs)}</span>
              </div>

              {play.result && (
                <span style={{
                  fontSize: 9, fontWeight: 700, padding: "2px 6px", borderRadius: 10, flexShrink: 0,
                  color: resultColor(play.result), background: resultBg(play.result),
                  textTransform: "uppercase",
                }}>
                  {play.yards_gained != null ? fmtYd(play.yards_gained) : cap(play.result)}
                </span>
              )}
            </div>
          );
        })}

        {visible.length === 0 && (
          <p style={{ textAlign: "center", color: DS.dimText, fontSize: 12, margin: "24px 0" }}>
            No {filter !== "all" ? filter : ""} plays
          </p>
        )}
      </div>
    </div>
  );
}

// ── Player Metrics Row ────────────────────────────────────────────────────────
function PlayerMetricsRow({ tracks = [], roster, highlightJersey, onHighlight }) {
  if (!tracks.length) return null;

  const sorted = [...tracks].sort((a, b) => {
    if (a.team !== b.team) return a.team === "home" ? -1 : 1;
    return (a.jersey_number ?? 99) - (b.jersey_number ?? 99);
  });

  return (
    <div style={{ paddingTop: 14, borderTop: `1px solid ${DS.border}` }}>
      <p style={{ margin: "0 0 10px", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: DS.labelText }}>
        Player Metrics - click to highlight on field
      </p>
      <div style={{ display: "flex", gap: 10, overflowX: "auto", paddingBottom: 4 }}>
        {sorted.map((t, i) => {
          const rp  = roster.find(r => r.jersey_number === t.jersey_number);
          const col = teamColors(t.team);
          const hl  = highlightJersey === t.jersey_number;
          const stats = [
            { k: "Top Spd",   v: fmtSpd(t.max_speed_mph) },
            { k: "Avg Spd",   v: fmtSpd(t.avg_speed_mph) },
            { k: "1st Step",  v: fmtMs(t.first_step_ms) },
            { k: "Pk Accel",  v: fmtAcc(t.accel_peak_ms2) },
          ].filter(s => s.v !== "–");

          return (
            <div key={i} onClick={() => onHighlight(hl ? null : t.jersey_number)} style={{
              flexShrink: 0, minWidth: 148,
              border: `2px solid ${hl ? col.fill : DS.border}`,
              borderRadius: 10, padding: "10px 12px", cursor: "pointer",
              background: hl ? `${col.fill}12` : DS.pageBg,
              transition: "all 0.15s",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <div style={{
                  width: 28, height: 28, borderRadius: 7,
                  background: col.fill, color: col.text,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 11, fontWeight: 800, flexShrink: 0,
                }}>
                  {t.jersey_number ?? "?"}
                </div>
                <div style={{ minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: DS.bodyText, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 90 }}>
                    {rp ? rp.player_name : `#${t.jersey_number ?? "?"}`}
                  </p>
                  {rp?.position && <p style={{ margin: 0, fontSize: 9, color: DS.dimText }}>{rp.position}</p>}
                </div>
              </div>
              {stats.map(s => (
                <div key={s.k} style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                  <span style={{ fontSize: 10, color: DS.dimText }}>{s.k}</span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: DS.bodyText }}>{s.v}</span>
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Jersey Confirm Panel ──────────────────────────────────────────────────────
function JerseyConfirmPanel({ filmId, roster, onAllConfirmed, onCountKnown }) {
  const [tracks, setTracks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(null);
  const [chosen,  setChosen]  = useState({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`/api/film/unconfirmed?filmId=${filmId}`, { credentials: "include" });
      const d = await r.json();
      const unc = d.unconfirmed ?? [];
      setTracks(unc);
      onCountKnown?.(unc.length);
      if (d.allConfirmed) onAllConfirmed?.();
    } catch {}
    setLoading(false);
  }, [filmId, onAllConfirmed, onCountKnown]);

  useEffect(() => { load(); }, [load]);

  async function confirm(trackId) {
    const rosterId = chosen[trackId];
    if (!rosterId) return;
    setSaving(trackId);
    try {
      const r = await fetch("/api/film/confirm-jersey", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filmId, trackId, rosterId }),
      });
      if (r.ok) {
        const next = tracks.filter(t => t.rekognition_track_id !== trackId);
        setTracks(next);
        onCountKnown?.(next.length);
        if (next.length === 0) onAllConfirmed?.();
      }
    } catch {}
    setSaving(null);
  }

  if (loading) return (
    <div style={{ textAlign: "center", padding: 40 }}>
      <Loader2 size={22} color={DS.brand} style={{ animation: "spin 1s linear infinite" }} />
    </div>
  );

  if (tracks.length === 0) return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, background: DS.safeBg, border: `1px solid ${DS.safeBorder}`, borderRadius: 12, padding: "16px 18px" }}>
      <CheckCircle2 size={20} color={DS.safe} />
      <div>
        <p style={{ margin: 0, fontWeight: 700, fontSize: 14, color: DS.safe }}>All players confirmed</p>
        <p style={{ margin: "2px 0 0", fontSize: 12, color: DS.labelText }}>Full analytics are unlocked.</p>
      </div>
    </div>
  );

  return (
    <div>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 16 }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: DS.bodyText }}>Confirm Player Identity</h3>
          <p style={{ margin: "4px 0 0", fontSize: 12, color: DS.labelText }}>
            {tracks.length} player{tracks.length !== 1 ? "s" : ""} detected by AI - match to roster to unlock analytics.
          </p>
        </div>
        <button onClick={load} style={{ background: "none", border: "none", cursor: "pointer", color: DS.dimText, display: "flex", gap: 4, alignItems: "center", fontSize: 12 }}>
          <RefreshCw size={12} /> Refresh
        </button>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {tracks.map(track => {
          const guess = track.jersey_number != null ? roster.find(p => p.jersey_number === track.jersey_number) : null;
          const conf  = track.jersey_confidence != null ? Math.round(track.jersey_confidence * 100) : null;

          return (
            <div key={track.rekognition_track_id} style={{
              display: "flex", alignItems: "center", gap: 12,
              border: `1px solid ${DS.border}`, borderRadius: 10, padding: "12px 14px", background: DS.cardBg,
            }}>
              <div style={{
                width: 48, height: 48, borderRadius: 10, background: DS.brandBg, flexShrink: 0,
                display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
              }}>
                <span style={{ fontWeight: 800, fontSize: 16, color: DS.brand, lineHeight: 1 }}>
                  {track.jersey_number != null ? `#${track.jersey_number}` : "?"}
                </span>
                {conf != null && <span style={{ fontSize: 9, color: DS.dimText, marginTop: 2 }}>{conf}% conf.</span>}
              </div>

              {guess && (
                <p style={{ margin: 0, fontSize: 12, color: DS.labelText, flexShrink: 0 }}>
                  <span style={{ color: DS.safe, fontWeight: 600 }}>AI: </span>{guess.player_name}
                </p>
              )}

              <select
                value={chosen[track.rekognition_track_id] ?? (guess?.id ?? "")}
                onChange={e => setChosen(p => ({ ...p, [track.rekognition_track_id]: e.target.value }))}
                style={{ flex: 1, border: `1px solid ${DS.border}`, borderRadius: 8, padding: "8px 10px", fontSize: 13, color: DS.bodyText, background: DS.pageBg, outline: "none" }}
              >
                <option value="">- Select player -</option>
                {roster.map(p => (
                  <option key={p.id} value={p.id}>
                    #{p.jersey_number} {p.player_name}{p.position ? ` (${p.position})` : ""}
                  </option>
                ))}
              </select>

              <button
                onClick={() => confirm(track.rekognition_track_id)}
                disabled={saving === track.rekognition_track_id || !(chosen[track.rekognition_track_id] ?? guess?.id)}
                style={{
                  background: DS.brand, color: "#fff", border: "none", borderRadius: 8,
                  padding: "9px 16px", fontWeight: 700, fontSize: 12, cursor: "pointer",
                  flexShrink: 0, opacity: saving === track.rekognition_track_id ? 0.6 : 1,
                  display: "flex", alignItems: "center", gap: 5,
                }}
              >
                {saving === track.rekognition_track_id
                  ? <Loader2 size={12} style={{ animation: "spin 1s linear infinite" }} />
                  : <CheckCircle2 size={12} />
                }
                Confirm
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Player Stats Grid ─────────────────────────────────────────────────────────
function PlayerStatsGrid({ plays, roster, onPlayerClick }) {
  const agg = useMemo(() => {
    const map = new Map();
    for (const play of plays) {
      for (const t of play.player_tracks ?? []) {
        const key = t.jersey_number ?? "unk";
        if (!map.has(key)) map.set(key, { jersey: t.jersey_number, team: t.team, plays: 0, maxSpd: null, sumAvgSpd: 0, spdN: 0, bestStep: null, bestAccel: null });
        const a = map.get(key);
        a.plays++;
        if (t.max_speed_mph != null) { a.maxSpd = a.maxSpd == null ? t.max_speed_mph : Math.max(a.maxSpd, t.max_speed_mph); }
        if (t.avg_speed_mph != null) { a.sumAvgSpd += t.avg_speed_mph; a.spdN++; }
        if (t.first_step_ms != null) { a.bestStep = a.bestStep == null ? t.first_step_ms : Math.min(a.bestStep, t.first_step_ms); }
        if (t.accel_peak_ms2 != null) { a.bestAccel = a.bestAccel == null ? t.accel_peak_ms2 : Math.max(a.bestAccel, t.accel_peak_ms2); }
      }
    }
    return Array.from(map.values()).sort((a, b) => (b.maxSpd ?? 0) - (a.maxSpd ?? 0));
  }, [plays]);

  if (!agg.length) return (
    <div style={{ background: DS.cardBg, border: `1px solid ${DS.border}`, borderRadius: 12, padding: 32, textAlign: "center" }}>
      <Users size={28} color={DS.dimText} style={{ opacity: 0.35, marginBottom: 10 }} />
      <p style={{ margin: 0, fontSize: 13, color: DS.labelText }}>Confirm players to see individual stats.</p>
    </div>
  );

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(195px, 1fr))", gap: 10 }}>
      {agg.map(p => {
        const rp    = roster.find(r => r.jersey_number === p.jersey);
        const col   = teamColors(p.team);
        const avgSpd = p.spdN > 0 ? p.sumAvgSpd / p.spdN : null;

        return (
          <div key={p.jersey ?? "unk"} onClick={() => p.jersey != null && onPlayerClick?.(p.jersey)} style={{ background: DS.cardBg, border: `1px solid ${DS.border}`, borderRadius: 12, padding: "14px 14px", cursor: p.jersey != null ? "pointer" : "default", transition: "all 0.13s" }}
            onMouseEnter={e => { if (p.jersey != null) { e.currentTarget.style.borderColor = DS.brandBorder; e.currentTarget.style.boxShadow = "0 2px 10px rgba(30,58,95,0.08)"; }}}
            onMouseLeave={e => { e.currentTarget.style.borderColor = DS.border; e.currentTarget.style.boxShadow = "none"; }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <div style={{ width: 34, height: 34, borderRadius: 8, background: col.fill, color: col.text, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 800, flexShrink: 0 }}>
                {p.jersey ?? "?"}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: DS.bodyText, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {rp ? rp.player_name : `#${p.jersey ?? "?"}`}
                </p>
                <div style={{ display: "flex", gap: 5, alignItems: "center", marginTop: 1 }}>
                  <span style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: col.fill, background: `${col.fill}18`, borderRadius: 3, padding: "1px 5px" }}>
                    {p.team === "home" ? "Home" : p.team === "away" ? "Away" : ""}
                  </span>
                  <p style={{ margin: 0, fontSize: 10, color: DS.dimText }}>{p.plays} play{p.plays !== 1 ? "s" : ""}</p>
                </div>
              </div>
            </div>
            {[
              ["Top Speed",   fmtSpd(p.maxSpd),   p.maxSpd > 18 ? DS.safe : null],
              ["Avg Speed",   fmtSpd(avgSpd),      null],
              ["Best 1st Step", fmtMs(p.bestStep), p.bestStep != null && p.bestStep < 200 ? DS.safe : null],
              ["Peak Accel",  fmtAcc(p.bestAccel), null],
            ].map(([lbl, val, hl]) => val !== "–" && (
              <div key={lbl} style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                <span style={{ fontSize: 10, color: DS.dimText }}>{lbl}</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: hl ?? DS.bodyText }}>{val}</span>
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}

// ── Tendency Report ───────────────────────────────────────────────────────────
function TendencyReport({ plays }) {
  const data = useMemo(() => {
    const byType = {}, byDown = {}, byFormation = {};
    let rzAtt = 0, rzSuc = 0;

    for (const p of plays) {
      const ok  = ["success", "td"].includes(String(p.result || "").toLowerCase());
      const pt  = p.play_type || "other";
      const yd  = p.yards_gained != null ? Number(p.yards_gained) : null;

      if (!byType[pt]) byType[pt] = { att: 0, suc: 0, yds: 0, ydN: 0 };
      byType[pt].att++; if (ok) byType[pt].suc++; if (yd != null) { byType[pt].yds += yd; byType[pt].ydN++; }

      if (p.down) {
        if (!byDown[p.down]) byDown[p.down] = { att: 0, suc: 0 };
        byDown[p.down].att++; if (ok) byDown[p.down].suc++;
      }

      if (p.formation) {
        if (!byFormation[p.formation]) byFormation[p.formation] = { att: 0, suc: 0 };
        byFormation[p.formation].att++; if (ok) byFormation[p.formation].suc++;
      }

      const inRZ = (p.player_tracks ?? []).some(t => t.snap_y != null && t.snap_y >= 80);
      if (inRZ) { rzAtt++; if (ok) rzSuc++; }
    }
    return { byType, byDown, byFormation, rzAtt, rzSuc };
  }, [plays]);

  function Bar({ label, att, suc, avgYd }) {
    const pct = att > 0 ? Math.round(suc / att * 100) : 0;
    const col = pct >= 60 ? DS.safe : pct >= 40 ? DS.caution : DS.warn;
    return (
      <div style={{ marginBottom: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4, alignItems: "center" }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: DS.bodyText }}>{label}</span>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            {avgYd != null && <span style={{ fontSize: 11, color: DS.dimText }}>{avgYd.toFixed(1)} avg yd</span>}
            <span style={{ fontSize: 13, fontWeight: 800, color: col }}>{pct}%</span>
            <span style={{ fontSize: 10, color: DS.dimText }}>{att} plays</span>
          </div>
        </div>
        <div style={{ height: 7, background: DS.border, borderRadius: 99, overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${pct}%`, background: col, borderRadius: 99, transition: "width 0.6s ease" }} />
        </div>
      </div>
    );
  }

  const SH = ({ children }) => (
    <h3 style={{ margin: "0 0 14px", fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em", color: DS.labelText }}>
      {children}
    </h3>
  );

  const downSuffix = n => ["st","nd","rd","th"][Math.min(Number(n) - 1, 3)] ?? "th";

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
      {/* Play type */}
      <div style={{ background: DS.cardBg, border: `1px solid ${DS.border}`, borderRadius: 12, padding: "18px 18px" }}>
        <SH>By Play Type</SH>
        {Object.entries(data.byType).sort((a, b) => b[1].att - a[1].att).map(([t, d]) => (
          <Bar key={t} label={cap(t)} att={d.att} suc={d.suc} avgYd={d.ydN > 0 ? d.yds / d.ydN : null} />
        ))}
      </div>

      {/* By down */}
      <div style={{ background: DS.cardBg, border: `1px solid ${DS.border}`, borderRadius: 12, padding: "18px 18px" }}>
        <SH>By Down</SH>
        {Object.entries(data.byDown).sort((a, b) => Number(a[0]) - Number(b[0])).map(([dn, d]) => (
          <Bar key={dn} label={`${dn}${downSuffix(dn)} Down`} att={d.att} suc={d.suc} />
        ))}
        {data.rzAtt > 0 && (
          <div style={{ marginTop: 16, paddingTop: 16, borderTop: `1px solid ${DS.border}` }}>
            <SH>Red Zone</SH>
            <Bar label="Inside 20" att={data.rzAtt} suc={data.rzSuc} />
          </div>
        )}
      </div>

      {/* By formation */}
      {Object.keys(data.byFormation).length > 0 && (
        <div style={{ background: DS.cardBg, border: `1px solid ${DS.border}`, borderRadius: 12, padding: "18px 18px", gridColumn: "1 / -1" }}>
          <SH>By Formation</SH>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 24px" }}>
            {Object.entries(data.byFormation).sort((a, b) => b[1].att - a[1].att).map(([f, d]) => (
              <Bar key={f} label={cap(f)} att={d.att} suc={d.suc} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Analytics Summary Cards ───────────────────────────────────────────────────
function AnalyticsSummaryCards({ plays, roster }) {
  const stats = useMemo(() => {
    const total = plays.length;
    const suc   = plays.filter(p => ["success","td"].includes(String(p.result||"").toLowerCase())).length;
    const pct   = total > 0 ? Math.round(suc / total * 100) : 0;
    const pass  = plays.filter(p => p.play_type === "pass").length;
    const run   = plays.filter(p => p.play_type === "run").length;
    const yPlays = plays.filter(p => p.yards_gained != null);
    const avgYd  = yPlays.length ? (yPlays.reduce((s, p) => s + Number(p.yards_gained), 0) / yPlays.length).toFixed(1) : null;

    let topSpd = null, topSpdName = null;
    for (const pl of plays) {
      for (const t of pl.player_tracks ?? []) {
        if (t.max_speed_mph != null && (topSpd == null || t.max_speed_mph > topSpd)) {
          topSpd = t.max_speed_mph;
          const rp = roster.find(r => r.jersey_number === t.jersey_number);
          topSpdName = rp ? rp.player_name : (t.jersey_number != null ? `#${t.jersey_number}` : null);
        }
      }
    }

    return [
      { label: "Success Rate", value: `${pct}%`,  sub: `${suc}/${total} plays`, Icon: TrendingUp, hl: pct >= 60 ? DS.safe : undefined },
      { label: "Avg Yards",    value: avgYd ? `${avgYd} yd` : "–", sub: "per play", Icon: Activity },
      { label: "Pass / Run",   value: `${pass} / ${run}`, sub: "total plays", Icon: Zap },
      { label: "Top Speed",    value: topSpd ? `${Number(topSpd).toFixed(1)} mph` : "–", sub: topSpdName || "any player", Icon: Shield },
    ];
  }, [plays, roster]);

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 10 }}>
      {stats.map(s => (
        <div key={s.label} style={{ background: DS.cardBg, border: `1px solid ${DS.border}`, borderRadius: 12, padding: "16px 16px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
            <s.Icon size={13} color={DS.brand} />
            <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: DS.labelText }}>{s.label}</span>
          </div>
          <p style={{ margin: 0, fontSize: 26, fontWeight: 800, color: s.hl ?? DS.bodyText, lineHeight: 1.1 }}>{s.value}</p>
          <p style={{ margin: "4px 0 0", fontSize: 11, color: DS.dimText }}>{s.sub}</p>
        </div>
      ))}
    </div>
  );
}

// ── Lineup Insights ───────────────────────────────────────────────────────────
function LineupInsights({ filmId, roster }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/film/lineup-analytics?filmId=${filmId}`, { credentials: "include" })
      .then(r => r.ok ? r.json() : { lineups: [] })
      .then(d => { setRows(d.lineups ?? []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [filmId]);

  if (loading) return <div style={{ textAlign: "center", padding: 24 }}><Loader2 size={18} color={DS.dimText} style={{ animation: "spin 1s linear infinite" }} /></div>;

  if (!rows.length) return (
    <div style={{ background: DS.cardBg, border: `1px solid ${DS.border}`, borderRadius: 12, padding: "18px 18px" }}>
      <p style={{ margin: 0, fontSize: 13, color: DS.dimText }}>Lineup analytics populate after all players are confirmed and the ECS worker runs aggregations.</p>
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {rows.map(row => {
        const pct = row.attempts > 0 ? Math.round(row.successes / row.attempts * 100) : 0;
        const col = pct >= 60 ? DS.safe : pct >= 40 ? DS.caution : DS.warn;
        const names = (row.jersey_numbers ?? []).map(n => {
          const rp = roster.find(r => r.jersey_number === n);
          return rp ? `#${n} ${rp.player_name.split(" ")[0]}` : `#${n}`;
        });
        return (
          <div key={row.id} style={{ background: DS.cardBg, border: `1px solid ${DS.border}`, borderRadius: 10, padding: "12px 16px", display: "flex", gap: 14, alignItems: "center" }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ margin: "0 0 3px", fontSize: 13, fontWeight: 700, color: DS.bodyText }}>
                {names.slice(0, 4).join(", ")}{names.length > 4 ? ` +${names.length - 4}` : ""}
              </p>
              <p style={{ margin: 0, fontSize: 11, color: DS.dimText }}>
                {cap(row.play_type ?? "")}{row.formation ? ` · ${cap(row.formation)}` : ""} · {row.attempts} plays
                {row.avg_yards != null ? ` · ${Number(row.avg_yards).toFixed(1)} avg yd` : ""}
              </p>
            </div>
            <div style={{ textAlign: "right", flexShrink: 0 }}>
              <p style={{ margin: 0, fontSize: 24, fontWeight: 800, color: col, lineHeight: 1.1 }}>{pct}%</p>
              <p style={{ margin: 0, fontSize: 10, color: DS.dimText }}>success</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── EPA Panel ─────────────────────────────────────────────────────────────────
function EPABar({ label, avg, plays, successRate }) {
  const pos = avg >= 0;
  const w   = Math.min(50, Math.abs(avg) * 20);
  const col = pos ? DS.safe : DS.warn;
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: DS.bodyText }}>{label}</span>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          {successRate != null && <span style={{ fontSize: 10, color: DS.dimText }}>{successRate}% success</span>}
          <span style={{ fontSize: 13, fontWeight: 800, color: col }}>{avg >= 0 ? "+" : ""}{avg}</span>
          <span style={{ fontSize: 10, color: DS.dimText }}>{plays}p</span>
        </div>
      </div>
      <div style={{ position: "relative", height: 6, background: DS.border, borderRadius: 99 }}>
        <div style={{ position: "absolute", top: 0, bottom: 0, left: pos ? "50%" : `${50 - w}%`, width: `${w}%`, background: col, borderRadius: 99 }} />
        <div style={{ position: "absolute", top: "-1px", bottom: "-1px", left: "calc(50% - 1px)", width: 2, background: DS.labelText, borderRadius: 1, opacity: 0.3 }} />
      </div>
    </div>
  );
}

function EPAPanel({ epa, totalPlays }) {
  if (!epa) return (
    <div style={{ background: DS.cardBg, border: `1px solid ${DS.border}`, borderRadius: 12, padding: 20 }}>
      <p style={{ margin: 0, fontSize: 13, color: DS.dimText }}>EPA data loading…</p>
    </div>
  );
  const overallCol   = (epa.overall ?? 0) >= 0 ? DS.safe : DS.warn;
  const downSuffix   = n => ["st","nd","rd","th"][Math.min(Number(n)-1,3)] ?? "th";
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
      {/* Header */}
      <div style={{ background: DS.cardBg, border: `1px solid ${DS.border}`, borderRadius: 12, padding: "20px 22px", gridColumn: "1 / -1", display: "flex", alignItems: "center", gap: 24 }}>
        <div style={{ flexShrink: 0 }}>
          <p style={{ margin: "0 0 4px", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: DS.labelText }}>Overall EPA / Play</p>
          <p style={{ margin: 0, fontSize: 48, fontWeight: 900, color: overallCol, lineHeight: 1 }}>{(epa.overall ?? 0) >= 0 ? "+" : ""}{epa.overall}</p>
          <p style={{ margin: "4px 0 0", fontSize: 11, color: DS.dimText }}>{totalPlays} plays · +0.2 or better is elite</p>
        </div>
        <p style={{ margin: 0, fontSize: 12, color: DS.labelText, lineHeight: 1.6, flex: 1 }}>
          Expected Points Added measures each play's impact on scoring probability. Positive = you moved closer to points. Negative = you surrendered value. League average hovers near 0.
        </p>
      </div>
      {/* By play type */}
      <div style={{ background: DS.cardBg, border: `1px solid ${DS.border}`, borderRadius: 12, padding: "18px 18px" }}>
        <h3 style={{ margin: "0 0 14px", fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em", color: DS.labelText }}>By Play Type</h3>
        {Object.entries(epa.byPlayType ?? {}).sort((a,b) => b[1].plays - a[1].plays).map(([t, d]) => (
          <EPABar key={t} label={cap(t)} avg={d.avg} plays={d.plays} successRate={d.successRate} />
        ))}
      </div>
      {/* By formation */}
      <div style={{ background: DS.cardBg, border: `1px solid ${DS.border}`, borderRadius: 12, padding: "18px 18px" }}>
        <h3 style={{ margin: "0 0 14px", fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em", color: DS.labelText }}>By Formation</h3>
        {Object.entries(epa.byFormation ?? {}).sort((a,b) => b[1].plays - a[1].plays).map(([f, d]) => (
          <EPABar key={f} label={cap(f)} avg={d.avg} plays={d.plays} successRate={d.successRate} />
        ))}
      </div>
      {/* By down */}
      {Object.keys(epa.byDown ?? {}).length > 0 && (
        <div style={{ background: DS.cardBg, border: `1px solid ${DS.border}`, borderRadius: 12, padding: "18px 18px", gridColumn: "1 / -1" }}>
          <h3 style={{ margin: "0 0 14px", fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em", color: DS.labelText }}>By Down</h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 28px" }}>
            {Object.entries(epa.byDown).sort((a,b) => Number(a[0]) - Number(b[0])).map(([d, v]) => (
              <EPABar key={d} label={`${d}${downSuffix(d)} Down`} avg={v.avg} plays={v.plays} successRate={v.successRate} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Direction Heat Map ────────────────────────────────────────────────────────
function DirectionHeatMap({ direction }) {
  if (!direction) return null;
  const total = direction.reduce((s, d) => s + d.plays, 0);
  if (!total) return <p style={{ color: DS.dimText, fontSize: 13 }}>No run plays with direction data.</p>;
  const ARROWS = { left: "◀", middle: "▲", right: "▶" };
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
      {["left","middle","right"].map(dir => {
        const d   = direction.find(x => x.direction === dir) ?? { plays: 0, successRate: 0, avgYards: 0 };
        const pct = total > 0 ? Math.round(d.plays / total * 100) : 0;
        const col = d.successRate >= 60 ? DS.safe : d.successRate >= 40 ? DS.caution : DS.warn;
        return (
          <div key={dir} style={{ background: DS.cardBg, border: `1px solid ${DS.border}`, borderRadius: 12, padding: "20px 14px", textAlign: "center" }}>
            <p style={{ margin: "0 0 6px", fontSize: 22, color: DS.labelText }}>{ARROWS[dir]}</p>
            <p style={{ margin: "0 0 2px", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: DS.labelText }}>{dir}</p>
            <p style={{ margin: "0 0 4px", fontSize: 34, fontWeight: 900, color: DS.bodyText, lineHeight: 1 }}>{pct}%</p>
            <p style={{ margin: "0 0 10px", fontSize: 11, color: DS.dimText }}>{d.plays} carries</p>
            <div style={{ height: 5, background: DS.border, borderRadius: 99, overflow: "hidden", marginBottom: 6 }}>
              <div style={{ height: "100%", width: `${d.successRate}%`, background: col, borderRadius: 99 }} />
            </div>
            <p style={{ margin: "0 0 2px", fontSize: 12, fontWeight: 800, color: col }}>{d.successRate}% success</p>
            <p style={{ margin: 0, fontSize: 11, color: DS.dimText }}>{d.avgYards > 0 ? "+" : ""}{d.avgYards} avg yd</p>
          </div>
        );
      })}
    </div>
  );
}

// ── Analytics Meta Row (tempo · motion · pressure · personnel) ────────────────
function AnalyticsMetaRow({ analytics }) {
  if (!analytics) return null;
  const { tempo, motionRate, motionCount, pressureRate, pressureCount, passPlays, personnel, totalPlays } = analytics;
  const PERS = { "10":"1RB 0TE","11":"1RB 1TE","12":"1RB 2TE","20":"2RB 0TE","21":"2RB 1TE","22":"2RB 2TE" };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10 }}>
        {[
          { label: "Avg Play Pace",    value: tempo?.avgSecs ? `${tempo.avgSecs}s` : "–",  sub: tempo?.fastestSecs ? `fastest ${tempo.fastestSecs}s` : "between snaps", col: null },
          { label: "Pre-Snap Motion",  value: `${motionRate ?? 0}%`,                         sub: `${motionCount ?? 0} of ${totalPlays} plays`,             col: (motionRate ?? 0) >= 40 ? DS.safe : null },
          { label: "Pass Pressure",    value: passPlays > 0 ? `${pressureRate}%` : "–",     sub: passPlays > 0 ? `${pressureCount} of ${passPlays} passes` : "no pass data", col: (pressureRate ?? 0) >= 50 ? DS.warn : (pressureRate ?? 0) <= 25 ? DS.safe : null },
        ].map(c => (
          <div key={c.label} style={{ background: DS.cardBg, border: `1px solid ${DS.border}`, borderRadius: 12, padding: "16px 16px" }}>
            <p style={{ margin: "0 0 6px", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: DS.labelText }}>{c.label}</p>
            <p style={{ margin: "0 0 2px", fontSize: 28, fontWeight: 800, color: c.col ?? DS.bodyText, lineHeight: 1.1 }}>{c.value}</p>
            <p style={{ margin: 0, fontSize: 10, color: DS.dimText }}>{c.sub}</p>
          </div>
        ))}
      </div>

      {personnel?.length > 0 && (
        <div style={{ background: DS.cardBg, border: `1px solid ${DS.border}`, borderRadius: 12, padding: "18px 18px" }}>
          <h3 style={{ margin: "0 0 14px", fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em", color: DS.labelText }}>Personnel Groupings</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {personnel.map(p => {
              const col = p.successRate >= 60 ? DS.safe : p.successRate >= 40 ? DS.caution : DS.warn;
              return (
                <div key={p.grouping} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 9, background: DS.brandBg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <span style={{ fontSize: 15, fontWeight: 900, color: DS.brand }}>{p.grouping}</span>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 3 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: DS.bodyText }}>{PERS[p.grouping] ?? `${p.grouping} personnel`}</span>
                      <span style={{ fontSize: 11, color: DS.labelText }}>{p.pct}% of plays · <span style={{ fontWeight: 700, color: col }}>{p.successRate}% success</span></span>
                    </div>
                    <div style={{ height: 5, background: DS.border, borderRadius: 99, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${p.pct}%`, background: DS.brand, borderRadius: 99 }} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Drive Log ─────────────────────────────────────────────────────────────────
function DriveLog({ drives }) {
  if (!drives?.length) return (
    <div style={{ background: DS.cardBg, border: `1px solid ${DS.border}`, borderRadius: 14, padding: 44, textAlign: "center" }}>
      <Activity size={32} color={DS.dimText} style={{ opacity: 0.25, marginBottom: 12 }} />
      <p style={{ margin: 0, fontSize: 13, color: DS.labelText }}>Drive data will appear once plays are processed.</p>
    </div>
  );

  const scoring   = drives.filter(d => d.result === "Touchdown").length;
  const turnovers = drives.filter(d => d.result.startsWith("Turnover")).length;
  const avgYards  = +(drives.reduce((s,d) => s + d.yards, 0) / drives.length).toFixed(1);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* Summary strip */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10 }}>
        {[
          { label: "Total Drives", value: drives.length,   col: null },
          { label: "Touchdowns",   value: scoring,          col: scoring   > 0 ? DS.safe : null },
          { label: "Turnovers",    value: turnovers,        col: turnovers > 0 ? DS.warn : null },
          { label: "Avg Yards",    value: `${avgYards} yd`, col: null },
        ].map(s => (
          <div key={s.label} style={{ background: DS.cardBg, border: `1px solid ${DS.border}`, borderRadius: 10, padding: "14px 14px", textAlign: "center" }}>
            <p style={{ margin: "0 0 2px", fontSize: 24, fontWeight: 800, color: s.col ?? DS.bodyText }}>{s.value}</p>
            <p style={{ margin: 0, fontSize: 10, color: DS.dimText }}>{s.label}</p>
          </div>
        ))}
      </div>

      {/* Drive list */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {drives.map(drive => {
          const isScore = drive.result === "Touchdown";
          const isTurn  = drive.result.startsWith("Turnover");
          const rCol    = isScore ? DS.safe : isTurn ? DS.warn : DS.dimText;
          const rBg     = isScore ? DS.safeBg : isTurn ? DS.warnBg : DS.pageBg;
          return (
            <div key={drive.number} style={{ background: DS.cardBg, border: `1px solid ${DS.border}`, borderRadius: 12, padding: "14px 16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: drive.playList?.length ? 10 : 0 }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: DS.brandBg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 800, color: DS.brand, flexShrink: 0 }}>
                  {drive.number}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: DS.bodyText }}>{drive.plays} play{drive.plays !== 1 ? "s" : ""}</span>
                    <span style={{ fontSize: 11, color: DS.labelText }}>·</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: DS.bodyText }}>{drive.yards > 0 ? "+" : ""}{drive.yards} yd</span>
                    <span style={{ fontSize: 11, color: DS.labelText }}>·</span>
                    <span style={{ fontSize: 12, fontWeight: 600, color: drive.epa >= 0 ? DS.safe : DS.warn }}>EPA {drive.epa >= 0 ? "+" : ""}{drive.epa}</span>
                  </div>
                </div>
                <span style={{ fontSize: 11, fontWeight: 700, background: rBg, color: rCol, borderRadius: 20, padding: "3px 10px", flexShrink: 0 }}>{drive.result}</span>
              </div>
              {drive.playList?.length > 0 && (
                <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                  {drive.playList.map((p, idx) => {
                    const ok = ["td","success"].includes(p.result ?? "");
                    return (
                      <span key={idx} title={`Play #${p.playNumber}: ${p.playType} - ${p.result}`} style={{
                        fontSize: 10, borderRadius: 4, padding: "2px 6px", color: DS.labelText,
                        background: p.result === "td" ? DS.safeBg : ok ? "#f0fdf4" : p.result === "failure" ? "#fef2f2" : DS.pageBg,
                        border: `1px solid ${p.result === "td" ? DS.safeBorder : ok ? "#86efac" : p.result === "failure" ? "#fca5a5" : DS.border}`,
                      }}>
                        {p.down}&{p.distance} {(p.playType??"").charAt(0).toUpperCase()}{p.yardsGained != null ? ` ${Number(p.yardsGained) > 0 ? "+" : ""}${Number(p.yardsGained).toFixed(0)}` : ""}
                      </span>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function FilmDetailPage() {
  const router   = useRouter();
  const { id }   = router.query;
  const { user } = useAuthContext();

  const [film,         setFilm]         = useState(null);
  const [filmVideoUrl, setFilmVideoUrl] = useState(null);
  const [plays,        setPlays]        = useState([]);
  const [roster,       setRoster]       = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [tab,          setTab]          = useState("plays");
  const [selPlay,      setSelPlay]      = useState(null);
  const [videoTime,    setVideoTime]    = useState(0);
  const [hlJersey,     setHlJersey]     = useState(null);
  const [unconfCount,  setUnconfCount]  = useState(0);
  const [copied,       setCopied]       = useState(false);
  const [analytics,    setAnalytics]    = useState(null);

  const videoRef   = useRef(null);
  const pollRef    = useRef(null);
  const didAutoSel = useRef(false);

  const fetchFilm = useCallback(async () => {
    if (!id) return;
    const r = await fetch(`/api/film/status?filmId=${id}`, { credentials: "include" });
    const d = await r.json();
    if (r.ok) setFilm(d);
    return d;
  }, [id]);

  const fetchVideoUrl = useCallback(async () => {
    if (!id) return;
    try {
      const r = await fetch(`/api/film/video-url?filmId=${id}`, { credentials: "include" });
      const d = await r.json();
      if (r.ok && d.videoUrl) setFilmVideoUrl(d.videoUrl);
    } catch {}
  }, [id]);

  const fetchPlays = useCallback(async () => {
    if (!id) return;
    const r = await fetch(`/api/film/plays?filmId=${id}`, { credentials: "include" });
    const d = await r.json();
    if (d.plays) {
      setPlays(d.plays);
      if (!didAutoSel.current && d.plays.length) {
        setSelPlay(d.plays[0]);
        didAutoSel.current = true;
      }
    }
  }, [id]);

  const handleAllConfirmed = useCallback(() => {
    setUnconfCount(0);
    fetchPlays();
  }, [fetchPlays]);

  const fetchAnalytics = useCallback(async () => {
    if (!id) return;
    try {
      const r = await fetch(`/api/film/analytics?filmId=${id}`, { credentials: "include" });
      const d = await r.json();
      if (d.ok) setAnalytics(d);
    } catch {}
  }, [id]);

  // Initial load
  useEffect(() => {
    if (!id) return;
    Promise.all([
      fetchFilm(),
      fetchPlays(),
      fetchAnalytics(),
      fetch("/api/film/roster", { credentials: "include" }).then(r => r.json()).then(d => setRoster(d.players ?? [])),
    ]).then(([filmData]) => {
      setLoading(false);
      // Fetch S3 presigned URL if Mux isn't available
      if (!filmData?.muxPlaybackId) fetchVideoUrl();
    });
  }, [id, fetchFilm, fetchPlays, fetchAnalytics, fetchVideoUrl]);

  // Polling while processing
  useEffect(() => {
    const processing = film && ["uploading","transcoding","analyzing","tagging"].includes(film.status);
    if (processing && !pollRef.current) {
      pollRef.current = setInterval(async () => {
        const r = await fetch(`/api/film/status?filmId=${id}`, { credentials: "include" });
        const d = await r.json();
        if (r.ok) {
          setFilm(d);
          if (!["uploading","transcoding","analyzing","tagging"].includes(d.status)) {
            clearInterval(pollRef.current); pollRef.current = null;
            fetchPlays();
            if (!d.muxPlaybackId) fetchVideoUrl();
          }
        }
      }, 5000);
    }
    if (!processing && pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    return () => { if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; } };
  }, [film?.status, id, fetchPlays]);

  const selTracks = useMemo(() => Array.isArray(selPlay?.player_tracks) ? selPlay.player_tracks : [], [selPlay]);
  const isProcessing = film && ["uploading","transcoding","analyzing","tagging"].includes(film.status);

  function shareClip() {
    const url = selPlay?.clip_url || window.location.href;
    navigator.clipboard?.writeText(url).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  }

  function selectPlay(play) {
    setSelPlay(play);
    setVideoTime(0);
    setHlJersey(null);
    // Seek to the play's start time in the full-film player
    if (videoRef.current && play?.start_time_secs != null) {
      videoRef.current.currentTime = play.start_time_secs;
    }
  }

  if (loading) return (
    <div style={{ minHeight: "100vh", background: DS.pageBg, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <Loader2 size={28} color={DS.brand} style={{ animation: "spin 1s linear infinite" }} />
    </div>
  );

  const TABS = [
    { key: "plays",     label: "Plays",     Icon: Play,     badge: plays.length > 0 ? plays.length : null },
    { key: "players",   label: "Players",   Icon: Users,    badge: unconfCount > 0 ? unconfCount : null, badgeColor: DS.warn },
    { key: "analytics", label: "Analytics", Icon: BarChart2, badge: null },
    { key: "drives",    label: "Drives",    Icon: Activity,  badge: analytics?.drives?.length > 0 ? analytics.drives.length : null },
  ];

  return (
    <>
      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @media (max-width: 768px) {
          .tape-grid { grid-template-columns: 1fr !important; }
          .sidebar-sticky { position: static !important; max-height: none !important; }
        }
      `}</style>

      <div style={{ minHeight: "100vh", background: DS.pageBg, fontFamily: "system-ui, sans-serif" }}>

        {/* ── Sticky header ── */}
        <div style={{ background: DS.cardBg, borderBottom: `1px solid ${DS.border}`, padding: "13px 20px", position: "sticky", top: 0, zIndex: 100 }}>
          <div style={{ maxWidth: 1280, margin: "0 auto", display: "flex", alignItems: "center", gap: 14 }}>
            <button onClick={() => router.push("/org/film")} style={{ background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 5, color: DS.labelText, fontSize: 13, padding: 0, flexShrink: 0 }}>
              <ArrowLeft size={15} /> Films
            </button>

            <div style={{ width: 1, height: 18, background: DS.border, flexShrink: 0 }} />

            <h1 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: DS.bodyText, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {film?.title || "Loading…"}
            </h1>

            {film?.opponent && <span style={{ fontSize: 12, color: DS.labelText, flexShrink: 0 }}>vs {film.opponent}</span>}

            {film?.status && (
              <span style={{
                fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 20, flexShrink: 0,
                background: film.status === "ready" ? DS.safeBg : isProcessing ? DS.brandBg : DS.pageBg,
                color:      film.status === "ready" ? DS.safe   : isProcessing ? DS.brand  : DS.dimText,
              }}>
                {film.status === "ready" ? "Ready" : isProcessing ? `${cap(film.status)}…` : film.status}
              </span>
            )}

            {selPlay?.clip_url && (
              <button onClick={shareClip} style={{
                background: copied ? DS.safeBg : DS.pageBg,
                border: `1px solid ${copied ? DS.safeBorder : DS.border}`,
                borderRadius: 8, padding: "6px 12px",
                display: "flex", alignItems: "center", gap: 5,
                fontSize: 12, fontWeight: 600, color: copied ? DS.safe : DS.labelText, cursor: "pointer",
              }}>
                <Share2 size={12} /> {copied ? "Copied!" : "Share Clip"}
              </button>
            )}
          </div>
        </div>

        {/* ── Processing banner ── */}
        {isProcessing && (
          <div style={{ background: DS.brandBg, borderBottom: `1px solid ${DS.brandBorder}`, padding: "9px 20px" }}>
            <div style={{ maxWidth: 1280, margin: "0 auto", display: "flex", alignItems: "center", gap: 12 }}>
              <Loader2 size={14} color={DS.brand} style={{ animation: "spin 1s linear infinite", flexShrink: 0 }} />
              <span style={{ fontSize: 12, fontWeight: 600, color: DS.brand }}>
                {film.status === "uploading"   ? "Uploading to cloud…" :
                 film.status === "transcoding" ? "Transcoding video…" :
                 film.status === "analyzing"   ? "AI analyzing player movement…" :
                 "Auto-tagging plays…"}
                {(film.progressPct ?? 0) > 0 ? ` · ${film.progressPct}%` : ""}
              </span>
              {(film.progressPct ?? 0) > 0 && (
                <div style={{ flex: 1, maxWidth: 180, height: 4, background: DS.brandBorder, borderRadius: 99, overflow: "hidden" }}>
                  <div style={{ height: "100%", background: DS.brand, width: `${film.progressPct}%`, borderRadius: 99, transition: "width 0.5s" }} />
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Game metadata bar ── */}
        {film && !isProcessing && (film.game_date || film.sport || film.home_team || film.away_team) && (
          <div style={{ background: DS.pageBg, borderBottom: `1px solid ${DS.border}`, padding: "8px 20px" }}>
            <div style={{ maxWidth: 1280, margin: "0 auto", display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
              {film.sport && (
                <span style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.07em", color: DS.brand, background: DS.brandBg, borderRadius: 5, padding: "2px 8px" }}>
                  {film.sport}
                </span>
              )}
              {film.game_date && (
                <span style={{ fontSize: 12, color: DS.labelText }}>
                  {new Date(film.game_date).toLocaleDateString(undefined, { weekday: "short", month: "long", day: "numeric", year: "numeric" })}
                </span>
              )}
              {(film.home_team || film.away_team) && (
                <span style={{ fontSize: 12, color: DS.labelText }}>
                  <span style={{ fontWeight: 600, color: DS.bodyText }}>{film.home_team || "Home"}</span>
                  <span style={{ color: DS.dimText }}> vs </span>
                  <span style={{ fontWeight: 600, color: DS.bodyText }}>{film.away_team || film.opponent || "Away"}</span>
                </span>
              )}
              {film.play_count > 0 && (
                <span style={{ fontSize: 12, color: DS.dimText }}>{film.play_count} plays analyzed</span>
              )}
            </div>
          </div>
        )}

        {/* ── Tab bar ── */}
        <div style={{ background: DS.cardBg, borderBottom: `1px solid ${DS.border}`, padding: "0 20px" }}>
          <div style={{ maxWidth: 1280, margin: "0 auto", display: "flex", gap: 0 }}>
            {TABS.map(t => (
              <button key={t.key} onClick={() => setTab(t.key)} style={{
                background: "none", border: "none", cursor: "pointer",
                display: "flex", alignItems: "center", gap: 6, padding: "13px 18px",
                fontSize: 13, fontWeight: tab === t.key ? 700 : 500,
                color: tab === t.key ? DS.brand : DS.labelText,
                borderBottom: `2px solid ${tab === t.key ? DS.brand : "transparent"}`,
                marginBottom: -1, transition: "all 0.12s",
              }}>
                <t.Icon size={13} /> {t.label}
                {t.badge != null && (
                  <span style={{
                    minWidth: 18, height: 18, borderRadius: 99, padding: "0 5px",
                    background: t.badgeColor ?? DS.brand, color: "#fff",
                    fontSize: 10, fontWeight: 800, lineHeight: "18px", textAlign: "center",
                    flexShrink: 0,
                  }}>{t.badge}</span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* ── Content ── */}
        <div style={{ maxWidth: 1280, margin: "0 auto", padding: "20px 16px" }}>

          {/* PLAYS TAB */}
          {tab === "plays" && (
            <>
              {/* Unconfirmed banner */}
              {unconfCount > 0 && (
                <div style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  background: DS.cautionBg, border: `1px solid ${DS.cautionBorder}`,
                  borderRadius: 10, padding: "11px 16px", marginBottom: 16,
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <Lock size={13} color={DS.caution} />
                    <span style={{ fontSize: 13, fontWeight: 600, color: DS.caution }}>
                      {unconfCount} player{unconfCount !== 1 ? "s" : ""} unconfirmed - analytics may be incomplete.
                    </span>
                  </div>
                  <button onClick={() => setTab("players")} style={{ background: DS.caution, color: "#fff", border: "none", borderRadius: 6, padding: "6px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                    Confirm Now
                  </button>
                </div>
              )}

              {plays.length === 0 ? (
                <div style={{ background: DS.cardBg, border: `1px solid ${DS.border}`, borderRadius: 14, padding: 52, textAlign: "center" }}>
                  <Film size={40} color={DS.dimText} style={{ opacity: 0.25, marginBottom: 14 }} />
                  <h3 style={{ margin: "0 0 6px", fontSize: 17, fontWeight: 700, color: DS.bodyText }}>
                    {isProcessing ? "Analyzing film…" : "No plays yet"}
                  </h3>
                  <p style={{ margin: 0, fontSize: 13, color: DS.labelText }}>
                    {isProcessing ? "Play detection will appear here once AI analysis completes." : "No plays have been tagged for this film."}
                  </p>
                </div>
              ) : (
                <div className="tape-grid" style={{ display: "grid", gridTemplateColumns: "minmax(0,3fr) minmax(240px,2fr)", gap: 16, alignItems: "start" }}>
                  {/* Left: video + formation + metrics */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                    <VideoPlayer
                      playbackId={film?.muxPlaybackId}
                      s3Url={filmVideoUrl}
                      clipUrl={selPlay?.clip_url}
                      playNumber={selPlay?.play_number}
                      onTimeUpdate={setVideoTime}
                      videoRef={videoRef}
                    />

                    {selTracks.some(t => t.snap_x != null) && (
                      <div>
                        <p style={{ margin: "0 0 8px", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: DS.labelText }}>
                          Formation at Snap · Play #{selPlay?.play_number}
                          {selPlay?.formation ? ` · ${cap(selPlay.formation)}` : ""}
                          {selPlay?.down && selPlay?.distance ? ` · ${selPlay.down}&${selPlay.distance}` : ""}
                        </p>
                        <FormationDiagram
                          tracks={selTracks}
                          roster={roster}
                          currentTime={videoTime}
                          onPlayerClick={j => setHlJersey(h => h === j ? null : j)}
                          highlightJersey={hlJersey}
                        />
                      </div>
                    )}

                    <PlayerMetricsRow
                      tracks={selTracks}
                      roster={roster}
                      highlightJersey={hlJersey}
                      onHighlight={j => setHlJersey(h => h === j ? null : j)}
                    />
                  </div>

                  {/* Right: sticky play sidebar */}
                  <div className="sidebar-sticky" style={{
                    background: DS.cardBg, border: `1px solid ${DS.border}`, borderRadius: 14,
                    padding: 14, position: "sticky", top: 72,
                    maxHeight: "calc(100vh - 90px)",
                    display: "flex", flexDirection: "column",
                  }}>
                    <p style={{ margin: "0 0 10px", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: DS.labelText }}>
                      {plays.length} Plays
                    </p>
                    <PlaySidebar plays={plays} selectedId={selPlay?.id} onSelect={selectPlay} />
                  </div>
                </div>
              )}
            </>
          )}

          {/* PLAYERS TAB */}
          {tab === "players" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div style={{ background: DS.cardBg, border: `1px solid ${DS.border}`, borderRadius: 14, padding: "20px 20px" }}>
                <JerseyConfirmPanel
                  filmId={id}
                  roster={roster}
                  onAllConfirmed={handleAllConfirmed}
                  onCountKnown={setUnconfCount}
                />
              </div>

              {plays.length > 0 && (
                <div>
                  <h2 style={{ margin: "0 0 12px", fontSize: 16, fontWeight: 700, color: DS.bodyText }}>Performance This Film</h2>
                  <PlayerStatsGrid plays={plays} roster={roster} onPlayerClick={j => router.push(`/org/film/player/${j}`)} />
                </div>
              )}
            </div>
          )}

          {/* ANALYTICS TAB */}
          {tab === "analytics" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              {plays.length === 0 ? (
                <div style={{ background: DS.cardBg, border: `1px solid ${DS.border}`, borderRadius: 14, padding: 44, textAlign: "center" }}>
                  <BarChart2 size={32} color={DS.dimText} style={{ opacity: 0.25, marginBottom: 12 }} />
                  <p style={{ margin: 0, fontSize: 13, color: DS.labelText }}>Analytics available once plays are processed.</p>
                </div>
              ) : (
                <>
                  <AnalyticsSummaryCards plays={plays} roster={roster} />

                  <div style={{ borderTop: `1px solid ${DS.border}`, paddingTop: 20 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
                      <TrendingUp size={15} color={DS.brand} />
                      <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: DS.bodyText }}>Expected Points Added</h2>
                    </div>
                    <EPAPanel epa={analytics?.epa} totalPlays={analytics?.totalPlays ?? plays.length} />
                  </div>

                  <div style={{ borderTop: `1px solid ${DS.border}`, paddingTop: 20 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
                      <Zap size={15} color={DS.brand} />
                      <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: DS.bodyText }}>Play Tendencies</h2>
                    </div>
                    <TendencyReport plays={plays} />
                  </div>

                  <div style={{ borderTop: `1px solid ${DS.border}`, paddingTop: 20 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
                      <Activity size={15} color={DS.brand} />
                      <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: DS.bodyText }}>Run Direction</h2>
                    </div>
                    <DirectionHeatMap direction={analytics?.direction} />
                  </div>

                  <div style={{ borderTop: `1px solid ${DS.border}`, paddingTop: 20 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
                      <Shield size={15} color={DS.brand} />
                      <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: DS.bodyText }}>Pace, Motion & Personnel</h2>
                    </div>
                    <AnalyticsMetaRow analytics={analytics} />
                  </div>

                  <div style={{ borderTop: `1px solid ${DS.border}`, paddingTop: 20 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
                      <UserCheck size={15} color={DS.brand} />
                      <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: DS.bodyText }}>Lineup Insights</h2>
                    </div>
                    <LineupInsights filmId={id} roster={roster} />
                  </div>
                </>
              )}
            </div>
          )}

          {/* DRIVES TAB */}
          {tab === "drives" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <DriveLog drives={analytics?.drives} />
            </div>
          )}
        </div>
      </div>
    </>
  );
}
