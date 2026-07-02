// pages/org/film/[id].js  -  Film Intelligence tape room
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/router";
import { useAuthContext } from "@/hooks/useAuth";
import { Toaster, toast } from "react-hot-toast";
import {
  ArrowLeft, BarChart2, CheckCircle2, AlertCircle, Loader2,
  Film, UserCheck, Users, RefreshCw, Play, TrendingUp,
  Shield, Share2, Volume2, VolumeX, Activity, Zap, Lock,
  X, Tag, Sparkles, Brain, ArrowRight, ListVideo, Plus,
  Trash2, ChevronRight, ChevronUp, ChevronDown, SkipForward, SkipBack, Bookmark,
  ArrowLeftRight, Send, Clock, CheckCircle, Pencil, Check,
  Video, Layers, SwitchCamera,
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
function formatDueDate(dueDateStr) {
  if (!dueDateStr) return null;
  const due   = new Date(dueDateStr + "T00:00:00");
  const today = new Date(); today.setHours(0,0,0,0);
  const diff  = Math.round((due - today) / 86400000);
  if (diff < 0)  return { label: "Overdue",      overdue: true,  soon: false };
  if (diff === 0) return { label: "Due today",    overdue: false, soon: true  };
  if (diff === 1) return { label: "Due tomorrow", overdue: false, soon: true  };
  if (diff <= 6)  return { label: `Due ${due.toLocaleDateString("en-US", { weekday: "short" })}`, overdue: false, soon: true };
  return { label: `Due ${due.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`, overdue: false, soon: false };
}

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
  if (s === "td")                          return "#16a34a";
  if (s === "success")                     return DS.safe;
  if (s === "failure" || s === "turnover") return DS.warn;
  if (s === "penalty")                     return DS.caution;
  return DS.dimText;
}
function resultBg(r) {
  const s = String(r || "").toLowerCase();
  if (s === "td" || s === "success")       return DS.safeBg;
  if (s === "failure" || s === "turnover") return DS.warnBg;
  if (s === "penalty")                     return DS.cautionBg;
  return DS.pageBg;
}

const ORD = ["1st","2nd","3rd","4th"];
function downLabel(down, distance) {
  if (!down) return null;
  return `${ORD[(down - 1) % 4] ?? `${down}th`} & ${distance ?? "–"}`;
}
const TYPE_SHORT = { run:"RUN", pass:"PASS", punt:"PUNT", kickoff:"KICK", field_goal:"FG", extra_point:"XP" };
const TYPE_COLOR = { run:"#1e3a5f", pass:"#2563eb", punt:"#475569", kickoff:"#475569", field_goal:"#b45309", extra_point:"#475569" };
const TYPE_BG    = { run:"#eef3f9", pass:"#eff6ff", punt:"#f1f5f9", kickoff:"#f1f5f9", field_goal:"#fef3c7", extra_point:"#f1f5f9" };
function typeShort(t)  { return TYPE_SHORT[t]  ?? String(t || "").toUpperCase(); }
function typeColor(t)  { return TYPE_COLOR[t]  ?? DS.dimText; }
function typeBg(t)     { return TYPE_BG[t]     ?? DS.pageBg; }

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
function VideoPlayer({ playbackId, s3Url, clipUrl, playNumber, onTimeUpdate, onDurationChange, videoRef, onS3Error }) {
  const fullFilmSrc = s3Url || null;
  const hasVideo = playbackId || fullFilmSrc || clipUrl;
  const [s3Expired, setS3Expired] = useState(false);

  // Reset expired state whenever a fresh URL is provided
  useEffect(() => { setS3Expired(false); }, [s3Url]);

  if (!hasVideo) {
    return (
      <div className="video-wrap" style={{
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
      <div className="video-wrap" style={{ borderRadius: 10, overflow: "hidden", aspectRatio: "16/9", background: "#000" }}>
        <MuxPlayer
          ref={videoRef}
          playbackId={playbackId}
          streamType="on-demand"
          style={{ width: "100%", height: "100%" }}
          onTimeUpdate={e => { onTimeUpdate?.(e.target.currentTime); }}
          onLoadedMetadata={e => onDurationChange?.(e.target.duration)}
          accentColor="#4FABFF"
        />
      </div>
    );
  }

  const src = fullFilmSrc || clipUrl;
  const isS3 = src === fullFilmSrc && !!fullFilmSrc;

  if (isS3 && s3Expired) {
    return (
      <div className="video-wrap" style={{
        background: "#0a0c12", borderRadius: 10, aspectRatio: "16/9",
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14,
      }}>
        <RefreshCw size={32} color="rgba(255,255,255,0.2)" />
        <p style={{ margin: 0, fontSize: 13, color: "rgba(255,255,255,0.5)", fontWeight: 600 }}>Video link expired</p>
        <button
          onClick={() => { setS3Expired(false); onS3Error?.(); }}
          style={{ padding: "8px 20px", background: "#4FABFF", border: "none", borderRadius: 8, fontSize: 12, fontWeight: 700, color: "#fff", cursor: "pointer" }}>
          Refresh video
        </button>
      </div>
    );
  }

  return (
    <div className="video-wrap" style={{ position: "relative", background: "#000", borderRadius: 10, overflow: "hidden", aspectRatio: "16/9" }}>
      <video
        ref={videoRef}
        src={src}
        style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }}
        controls
        preload="metadata"
        onTimeUpdate={e => onTimeUpdate?.(e.target.currentTime)}
        onLoadedMetadata={e => onDurationChange?.(e.target.duration)}
        onError={() => {
          if (isS3) {
            setS3Expired(true);
            onS3Error?.();
          }
        }}
      />
    </div>
  );
}

// ── Play Timeline ──────────────────────────────────────────────────────────────
function PlayTimeline({ plays, duration, currentTime, snapTime, onSeek }) {
  if (!duration) return null;
  const pct = t => Math.min(100, Math.max(0, (t / duration) * 100));
  const blockColor = r => {
    const s = String(r || "").toLowerCase();
    if (s === "td")       return "#16a34a";
    if (s === "success")  return "#22c55e";
    if (s === "turnover") return "#dc2626";
    if (s === "failure")  return "#ef4444";
    if (s === "penalty")  return "#f59e0b";
    return "#4FABFF";
  };
  return (
    <div style={{ position: "relative", height: 32, background: "#0d1117", borderRadius: 6, cursor: "pointer", overflow: "hidden", userSelect: "none", flexShrink: 0 }}
      onClick={e => {
        const rect = e.currentTarget.getBoundingClientRect();
        onSeek?.(((e.clientX - rect.left) / rect.width) * duration);
      }}
      title="Click to seek"
    >
      {plays.map(p => {
        if (p.start_time_secs == null) return null;
        const l = pct(p.start_time_secs);
        const w = p.end_time_secs != null ? Math.max(0.4, pct(p.end_time_secs) - l) : 0.4;
        return (
          <div key={p.id} title={`Play ${p.play_number}${p.down ? ` · ${p.down}&${p.distance}` : ""}${p.play_type ? ` · ${cap(p.play_type)}` : ""}`}
            style={{ position: "absolute", top: 6, bottom: 6, left: `${l}%`, width: `${w}%`, minWidth: 3, background: blockColor(p.result), borderRadius: 2, opacity: 0.85 }} />
        );
      })}
      {snapTime != null && (
        <div style={{ position: "absolute", top: 0, bottom: 0, left: `${pct(snapTime)}%`, width: 2, background: "#4FABFF" }} />
      )}
      <div style={{ position: "absolute", top: 0, bottom: 0, left: `${pct(currentTime)}%`, width: 2, background: "rgba(255,255,255,0.7)" }} />
      <div style={{ position: "absolute", bottom: 3, left: 6, fontSize: 9, color: "rgba(255,255,255,0.35)", fontWeight: 600, pointerEvents: "none" }}>{fmtTime(currentTime)}</div>
      <div style={{ position: "absolute", bottom: 3, right: 6, fontSize: 9, color: "rgba(255,255,255,0.35)", fontWeight: 600, pointerEvents: "none" }}>{fmtTime(duration)}</div>
    </div>
  );
}

// ── Workflow Banner ───────────────────────────────────────────────────────────
function WorkflowBanner({ plays, isMobile }) {
  const playCount = plays.length;

  if (isMobile) {
    if (playCount > 0) return null;
    return (
      <div style={{ background: DS.cardBg, border: `1px solid ${DS.border}`, borderRadius: 10, padding: "9px 14px", marginBottom: 10 }}>
        <p style={{ margin: 0, fontSize: 12, color: DS.labelText }}>
          <strong style={{ color: DS.bodyText }}>Tap S</strong> to snap · <strong style={{ color: DS.bodyText }}>W</strong> to end · <strong style={{ color: DS.bodyText }}>↵</strong> to save
        </p>
      </div>
    );
  }

  if (playCount > 0) return null;

  const steps = [
    { n: 1, label: "Upload",    done: true },
    { n: 2, label: "Tag Plays", done: false },
  ];

  return (
    <div style={{ background: DS.cardBg, border: `1px solid ${DS.border}`, borderRadius: 12, padding: "14px 18px", marginBottom: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 0, marginBottom: 12 }}>
        {steps.map((s, i) => (
          <div key={s.n} style={{ display: "flex", alignItems: "center", flex: i < steps.length - 1 ? 1 : "none" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{
                width: 24, height: 24, borderRadius: "50%", flexShrink: 0,
                background: s.done ? DS.brand : DS.pageBg,
                border: `2px solid ${s.done ? DS.brand : DS.brand}`,
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                {s.done
                  ? <CheckCircle2 size={12} color="#fff" strokeWidth={3} />
                  : <span style={{ fontSize: 10, fontWeight: 800, color: DS.brand }}>{s.n}</span>}
              </div>
              <span style={{ fontSize: 12, fontWeight: s.done ? 500 : 700, color: s.done ? DS.brand : DS.bodyText, whiteSpace: "nowrap" }}>
                {s.label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div style={{ flex: 1, height: 2, background: s.done ? DS.brand : DS.border, margin: "0 10px", minWidth: 20, opacity: s.done ? 1 : 0.4 }} />
            )}
          </div>
        ))}
      </div>
      <p style={{ margin: 0, fontSize: 12, color: DS.labelText }}>
        Press <strong>S</strong> to mark snap · <strong>W</strong> to mark end · <strong>↵</strong> to save
      </p>
    </div>
  );
}

// ── Tag Bar ────────────────────────────────────────────────────────────────────
const SPORT_CONFIGS = {
  football: {
    label: "Football",
    useDownDistance: true,
    playTypes: [
      { id: "run",         label: "RUN",  key: "R" },
      { id: "pass",        label: "PASS", key: "P" },
      { id: "punt",        label: "PUNT", key: "U" },
      { id: "kickoff",     label: "KICK" },
      { id: "field_goal",  label: "FG" },
      { id: "extra_point", label: "XP" },
    ],
    showFormation: true, formationLabel: "Formation",
    formations: ["shotgun","under_center","pistol","wildcat","i_formation","singleback"],
    showHashYardLine: true, showPersonnel: true,
    personnelOptions: ["10","11","12","21","22"],
    showDirection: true,
    results: [
      { id: "success",  label: "SUC",  color: "#22c55e" },
      { id: "failure",  label: "FAIL", color: "rgba(255,255,255,0.5)" },
      { id: "td",       label: "TD",   color: "#22c55e" },
      { id: "turnover", label: "TO",   color: "#ef4444" },
      { id: "penalty",  label: "PEN",  color: "#f59e0b" },
    ],
    showYards: true, yardsLabel: "YDS",
  },
  basketball: {
    label: "Basketball",
    periodLabel: "Quarter", periods: ["1","2","3","4","OT"],
    playTypes: [
      { id: "3pt",        label: "3PT" },
      { id: "2pt",        label: "2PT" },
      { id: "layup",      label: "LAYUP" },
      { id: "dunk",       label: "DUNK" },
      { id: "free_throw", label: "FT" },
      { id: "turnover",   label: "TO" },
      { id: "steal",      label: "STL" },
      { id: "block",      label: "BLK" },
    ],
    showFormation: true, formationLabel: "Zone",
    formations: ["paint","mid_range","three_point","transition","post","perimeter"],
    showHashYardLine: false, showPersonnel: false, showDirection: true,
    results: [
      { id: "made",    label: "MADE",  color: "#22c55e" },
      { id: "missed",  label: "MISS",  color: "#ef4444" },
      { id: "blocked", label: "BLKD",  color: "#f59e0b" },
      { id: "foul",    label: "FOUL",  color: "#f59e0b" },
      { id: "and_one", label: "+1",    color: "#22c55e" },
    ],
    showYards: false,
  },
  soccer: {
    label: "Soccer",
    periodLabel: "Half", periods: ["1st","2nd","ET1","ET2","PKS"],
    playTypes: [
      { id: "shot",      label: "SHOT" },
      { id: "corner",    label: "CRN" },
      { id: "free_kick", label: "FK" },
      { id: "penalty",   label: "PEN" },
      { id: "header",    label: "HEAD" },
      { id: "cross",     label: "CROSS" },
      { id: "through",   label: "THRU" },
    ],
    showFormation: true, formationLabel: "Zone",
    formations: ["attack_third","mid_third","defensive_third","right_flank","left_flank","central"],
    showHashYardLine: false, showPersonnel: false, showDirection: true,
    results: [
      { id: "goal",    label: "GOAL",  color: "#22c55e" },
      { id: "save",    label: "SAVE",  color: "#3b82f6" },
      { id: "miss",    label: "MISS",  color: "#ef4444" },
      { id: "foul",    label: "FOUL",  color: "#f59e0b" },
      { id: "offside", label: "OFF",   color: "#f59e0b" },
      { id: "blocked", label: "BLKD",  color: "#64748b" },
    ],
    showYards: false,
  },
  baseball: {
    label: "Baseball",
    periodLabel: "Inning", periods: ["1","2","3","4","5","6","7","8","9"],
    showDistanceInput: true, distanceLabel: "Outs", distancePlaceholder: "0",
    playTypes: [
      { id: "fastball",  label: "FB" },
      { id: "curveball", label: "CB" },
      { id: "slider",    label: "SL" },
      { id: "changeup",  label: "CH" },
      { id: "cutter",    label: "CUT" },
      { id: "sinker",    label: "SNK" },
      { id: "splitter",  label: "SPL" },
    ],
    showFormation: false, showHashYardLine: false, showPersonnel: false, showDirection: false,
    results: [
      { id: "hit",       label: "HIT",  color: "#22c55e" },
      { id: "out",       label: "OUT",  color: "#ef4444" },
      { id: "walk",      label: "WALK", color: "#3b82f6" },
      { id: "strikeout", label: "K",    color: "#ef4444" },
      { id: "homerun",   label: "HR",   color: "#f59e0b" },
      { id: "error",     label: "ERR",  color: "#f59e0b" },
    ],
    showYards: false,
  },
  lacrosse: {
    label: "Lacrosse",
    periodLabel: "Period", periods: ["1","2","3","4","OT"],
    playTypes: [
      { id: "shot",         label: "SHOT" },
      { id: "clear",        label: "CLEAR" },
      { id: "ride",         label: "RIDE" },
      { id: "face_off",     label: "F/O" },
      { id: "ground_ball",  label: "GB" },
      { id: "man_up",       label: "MAN+" },
    ],
    showFormation: true, formationLabel: "Zone",
    formations: ["attack","midfield","defense","crease","alley"],
    showHashYardLine: false, showPersonnel: false, showDirection: true,
    results: [
      { id: "goal",     label: "GOAL",  color: "#22c55e" },
      { id: "save",     label: "SAVE",  color: "#3b82f6" },
      { id: "turnover", label: "TO",    color: "#ef4444" },
      { id: "penalty",  label: "PEN",   color: "#f59e0b" },
      { id: "success",  label: "SUC",   color: "#22c55e" },
    ],
    showYards: false,
  },
  softball: {
    label: "Softball",
    periodLabel: "Inning", periods: ["1","2","3","4","5","6","7"],
    showDistanceInput: true, distanceLabel: "Outs", distancePlaceholder: "0",
    playTypes: [
      { id: "fastpitch", label: "FP" },
      { id: "changeup",  label: "CH" },
      { id: "drop",      label: "DROP" },
      { id: "rise",      label: "RISE" },
      { id: "curve",     label: "CRV" },
      { id: "screw",     label: "SCR" },
    ],
    showFormation: false, showHashYardLine: false, showPersonnel: false, showDirection: false,
    results: [
      { id: "hit",       label: "HIT",  color: "#22c55e" },
      { id: "out",       label: "OUT",  color: "#ef4444" },
      { id: "walk",      label: "WALK", color: "#3b82f6" },
      { id: "strikeout", label: "K",    color: "#ef4444" },
      { id: "homerun",   label: "HR",   color: "#f59e0b" },
    ],
    showYards: false,
  },
  volleyball: {
    label: "Volleyball",
    periodLabel: "Set", periods: ["1","2","3","4","5"],
    playTypes: [
      { id: "serve",    label: "SERVE" },
      { id: "spike",    label: "SPIKE" },
      { id: "block",    label: "BLOCK" },
      { id: "dig",      label: "DIG" },
      { id: "set_play", label: "SET" },
      { id: "tip",      label: "TIP" },
    ],
    showFormation: true, formationLabel: "Rotation",
    formations: ["S1","S2","S3","S4","S5","S6"],
    showHashYardLine: false, showPersonnel: false, showDirection: true,
    results: [
      { id: "point", label: "POINT", color: "#22c55e" },
      { id: "error", label: "ERROR", color: "#ef4444" },
      { id: "out",   label: "OUT",   color: "#ef4444" },
      { id: "rally", label: "RALLY", color: "#64748b" },
    ],
    showYards: false,
  },
  track: {
    label: "Track & Field",
    periodLabel: "Heat", periods: ["Prelim","Semi","Final"],
    playTypes: [
      { id: "sprint",   label: "SPRINT" },
      { id: "middle",   label: "MID" },
      { id: "distance", label: "DIST" },
      { id: "hurdles",  label: "HRDS" },
      { id: "relay",    label: "RELAY" },
      { id: "jump",     label: "JUMP" },
      { id: "throw",    label: "THROW" },
    ],
    showFormation: false, showHashYardLine: false, showPersonnel: false, showDirection: false,
    results: [
      { id: "pr",          label: "PR",   color: "#f59e0b" },
      { id: "season_best", label: "SB",   color: "#22c55e" },
      { id: "qualify",     label: "QUAL", color: "#3b82f6" },
      { id: "dnf",         label: "DNF",  color: "#ef4444" },
      { id: "win",         label: "WIN",  color: "#22c55e" },
    ],
    showYards: true, yardsLabel: "MARK",
  },
  wrestling: {
    label: "Wrestling",
    periodLabel: "Period", periods: ["1","2","3","OT"],
    playTypes: [
      { id: "takedown",  label: "TKDN" },
      { id: "escape",    label: "ESC" },
      { id: "reversal",  label: "REV" },
      { id: "near_fall", label: "NF" },
      { id: "pin",       label: "PIN" },
      { id: "stalling",  label: "STALL" },
    ],
    showFormation: true, formationLabel: "Situation",
    formations: ["neutral","top","bottom"],
    showHashYardLine: false, showPersonnel: false, showDirection: false,
    results: [
      { id: "scored",   label: "SCORED",  color: "#22c55e" },
      { id: "stopped",  label: "STOPPED", color: "#ef4444" },
      { id: "penalty",  label: "PEN",     color: "#f59e0b" },
      { id: "decision", label: "DEC",     color: "#64748b" },
    ],
    showYards: true, yardsLabel: "PTS",
  },
  other: {
    label: "Other",
    periodLabel: "Period", periods: ["1","2","3","4","OT"],
    playTypes: [
      { id: "offense",  label: "OFF" },
      { id: "defense",  label: "DEF" },
      { id: "special",  label: "SPEC" },
      { id: "set_play", label: "SET" },
    ],
    showFormation: false, showHashYardLine: false, showPersonnel: false, showDirection: true,
    results: [
      { id: "success", label: "SUCCESS", color: "#22c55e" },
      { id: "failure", label: "FAIL",    color: "#ef4444" },
      { id: "penalty", label: "PEN",     color: "#f59e0b" },
    ],
    showYards: true, yardsLabel: "PTS",
  },
};

const SPEEDS = [0.5, 1, 1.5, 2];

function Combobox({ value, onChange, options, placeholder, mob, inputStyle }) {
  const [open,  setOpen]  = useState(false);
  const [query, setQuery] = useState(value || "");
  const [rect,  setRect]  = useState(null);
  const inputRef          = useRef(null);

  useEffect(() => { setQuery(value || ""); }, [value]);

  useEffect(() => {
    if (open && inputRef.current) setRect(inputRef.current.getBoundingClientRect());
  }, [open]);

  const filtered = query
    ? options.filter(o => o.toLowerCase().includes(query.toLowerCase()))
    : options;

  const commit = (val) => {
    const v = String(val).trim();
    onChange(v);
    setQuery(v);
    setOpen(false);
  };

  const showDrop = open && rect && (filtered.length > 0 || (query.trim() && !options.find(o => o.toLowerCase() === query.toLowerCase())));

  const dropEl = showDrop ? (
    <div style={{
      position: "fixed", top: rect.bottom + 4, left: rect.left, width: rect.width,
      background: "#1a2235", border: "1px solid rgba(255,255,255,0.15)",
      borderRadius: 8, zIndex: 9999, maxHeight: 180, overflowY: "auto",
      boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
    }}>
      {filtered.map(o => (
        <div key={o} onMouseDown={() => commit(o)}
          style={{ padding: mob ? "10px 14px" : "8px 12px", cursor: "pointer", fontSize: mob ? 13 : 12, color: "#e2e8f0", borderBottom: "1px solid rgba(255,255,255,0.04)", userSelect: "none" }}
          onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.07)"}
          onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
          {cap(o)}
        </div>
      ))}
      {query.trim() && !options.find(o => o.toLowerCase() === query.trim().toLowerCase()) && (
        <div onMouseDown={() => commit(query)}
          style={{ padding: mob ? "10px 14px" : "8px 12px", cursor: "pointer", fontSize: mob ? 13 : 12, color: "#4FABFF", fontWeight: 700, userSelect: "none" }}
          onMouseEnter={e => e.currentTarget.style.background = "rgba(79,171,255,0.08)"}
          onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
          + Add "{query.trim()}"
        </div>
      )}
    </div>
  ) : null;

  return (
    <div style={{ position: "relative", flex: 1, minWidth: 0 }}>
      <input ref={inputRef} value={query} placeholder={placeholder}
        onChange={e => { setQuery(e.target.value); setOpen(true); }}
        onFocus={() => { setOpen(true); if (inputRef.current) setRect(inputRef.current.getBoundingClientRect()); }}
        onBlur={() => setTimeout(() => setOpen(false), 160)}
        onKeyDown={e => {
          if (e.key === "Enter") { e.preventDefault(); commit(query); }
          if (e.key === "Escape") setOpen(false);
        }}
        style={{ width: "100%", boxSizing: "border-box", ...(inputStyle || {}) }}
      />
      {dropEl && typeof document !== "undefined" && createPortal(dropEl, document.fullscreenElement ?? document.body)}
    </div>
  );
}

function TagBar({ filmId, snapTime, whistleTime, onMarkSnap, onMarkWhistle, onClear, plays, onSaved, onSkip, onUndo, videoRef, speed, onSetSpeed, editingPlay, onCancelEdit, sport: sportProp }) {
  const nextNum = plays.length + 1;
  const [activeSport, setActiveSport] = useState(() => {
    const raw = (sportProp || "football").toLowerCase().trim();
    return SPORT_CONFIGS[raw] ? raw : "football";
  });
  const cfg = SPORT_CONFIGS[activeSport] || SPORT_CONFIGS.football;
  const isFootball = activeSport === "football";

  const [form, setForm] = useState({
    down: "", distance: "", playType: "", formation: "", result: "",
    yardsGained: "", playDirection: "", hash: "", yardLine: "",
    personnel: "", labels: "", notes: "",
  });
  const [saving,   setSaving]   = useState(false);
  const [error,    setError]    = useState("");
  const [showMore, setShowMore] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // ── Persisted custom data (localStorage per sport) ──
  const [customPlayTypes,  setCustomPlayTypes]  = useState([]);
  const [customFormations, setCustomFormations] = useState([]);
  const [presets,          setPresets]          = useState([]);
  const [showNewType,      setShowNewType]      = useState(false);
  const [newTypeVal,       setNewTypeVal]       = useState("");
  const [presetInputOpen,  setPresetInputOpen]  = useState(false);
  const [presetInputVal,   setPresetInputVal]   = useState("");

  useEffect(() => {
    try {
      setCustomPlayTypes(JSON.parse(localStorage.getItem(`cp_types_${activeSport}`)  || "[]"));
      setCustomFormations(JSON.parse(localStorage.getItem(`cp_fmtns_${activeSport}`) || "[]"));
      setPresets(JSON.parse(localStorage.getItem(`cp_presets_${activeSport}`)        || "[]"));
    } catch {}
    setShowNewType(false); setNewTypeVal(""); setPresetInputOpen(false); setPresetInputVal("");
  }, [activeSport]);

  function addCustomType(label) {
    const l = label.trim(); if (!l) return;
    const id = l.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");
    if (cfg.playTypes.find(t => t.id === id) || customPlayTypes.find(t => t.id === id)) {
      set("playType", id);
    } else {
      const next = [...customPlayTypes, { id, label: l.toUpperCase() }];
      setCustomPlayTypes(next);
      try { localStorage.setItem(`cp_types_${activeSport}`, JSON.stringify(next)); } catch {}
      set("playType", id);
    }
    setShowNewType(false); setNewTypeVal("");
  }

  function removeCustomType(id) {
    const next = customPlayTypes.filter(t => t.id !== id);
    setCustomPlayTypes(next);
    try { localStorage.setItem(`cp_types_${activeSport}`, JSON.stringify(next)); } catch {}
    if (form.playType === id) set("playType", "");
  }

  function onFormationChange(val) {
    set("formation", val);
    if (!val) return;
    const allOpts = [...(cfg.formations || []), ...customFormations];
    if (!allOpts.find(o => o.toLowerCase() === val.toLowerCase())) {
      const next = [...customFormations, val.toLowerCase()];
      setCustomFormations(next);
      try { localStorage.setItem(`cp_fmtns_${activeSport}`, JSON.stringify(next)); } catch {}
    }
  }

  function savePreset(name) {
    const n = name.trim(); if (!n) return;
    const snap = { ...form };
    // Presets capture play context, not game situation
    delete snap.down; delete snap.distance; delete snap.yardsGained; delete snap.labels; delete snap.notes;
    const next = [{ name: n, form: snap }, ...presets].slice(0, 8);
    setPresets(next);
    try { localStorage.setItem(`cp_presets_${activeSport}`, JSON.stringify(next)); } catch {}
    setPresetInputOpen(false); setPresetInputVal("");
  }

  function applyPreset(preset) {
    formHistoryRef.current.push({ ...form });
    setForm(p => ({ ...p, ...preset.form }));
  }

  function deletePreset(i) {
    const next = presets.filter((_, idx) => idx !== i);
    setPresets(next);
    try { localStorage.setItem(`cp_presets_${activeSport}`, JSON.stringify(next)); } catch {}
  }

  const formHasData = Object.entries(form).some(([k, v]) =>
    !["down","distance","labels","notes"].includes(k) && v && v !== ""
  );

  // Reset sport-specific fields when sport changes
  useEffect(() => {
    setForm(p => ({ ...p, playType: "", formation: "", result: "", personnel: "", hash: "", yardLine: "", playDirection: "" }));
  }, [activeSport]);

  // Populate form when entering edit mode
  useEffect(() => {
    if (!editingPlay) return;
    formHistoryRef.current = [];
    setForm({
      down:          String(editingPlay.down ?? ""),
      distance:      String(editingPlay.distance ?? ""),
      playType:      editingPlay.play_type ?? "",
      formation:     editingPlay.formation ?? "",
      result:        editingPlay.result ?? "",
      yardsGained:   String(editingPlay.yards_gained ?? ""),
      playDirection: editingPlay.play_direction ?? "",
      hash:          editingPlay.hash ?? "",
      yardLine:      String(editingPlay.yard_line ?? ""),
      personnel:     editingPlay.personnel ?? "",
      labels:        (editingPlay.labels ?? []).join(", "),
      notes:         editingPlay.notes ?? "",
    });
    setShowMore(true);
  }, [editingPlay?.id]);

  const formHistoryRef = useRef([]);
  const set = (k, v) => {
    setForm(p => {
      formHistoryRef.current.push(p);
      return { ...p, [k]: v };
    });
  };
  function undoFormField() {
    const prev = formHistoryRef.current.pop();
    if (prev) setForm(prev);
  }
  const actionsRef = useRef({});
  actionsRef.current = { onMarkSnap, onMarkWhistle, onSkip, videoRef, undoFormField };

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 700);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  useEffect(() => {
    function onKey(e) {
      const tag = e.target.tagName;
      if (tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA") return;
      const a = actionsRef.current;
      if (e.key === "s" || e.key === "S") { e.preventDefault(); a.onMarkSnap?.(); }
      if (e.key === "w" || e.key === "W") { e.preventDefault(); a.onMarkWhistle?.(); }
      if (e.key === "Enter")              { e.preventDefault(); actionsRef.current.savePlay?.(); }
      if (e.key === "n" || e.key === "N") { e.preventDefault(); a.onSkip?.(); }
      if (e.key === "z" || e.key === "Z") { e.preventDefault(); a.undoFormField?.(); }
      if (e.key === "[") { e.preventDefault(); if (a.videoRef?.current) a.videoRef.current.currentTime = Math.max(0, a.videoRef.current.currentTime - 5); }
      if (e.key === "]") { e.preventDefault(); if (a.videoRef?.current) a.videoRef.current.currentTime += 5; }
      if (activeSport === "football") {
        if (e.key === "r" || e.key === "R") { e.preventDefault(); setForm(p => ({ ...p, playType: p.playType === "run"  ? "" : "run"  })); }
        if (e.key === "p" || e.key === "P") { e.preventDefault(); setForm(p => ({ ...p, playType: p.playType === "pass" ? "" : "pass" })); }
        if (e.key === "u" || e.key === "U") { e.preventDefault(); setForm(p => ({ ...p, playType: p.playType === "punt" ? "" : "punt" })); }
        if (e.key === "g" || e.key === "G") { e.preventDefault(); setForm(p => ({ ...p, result: p.result === "success" ? "" : "success" })); }
        if (e.key === "f" || e.key === "F") { e.preventDefault(); setForm(p => ({ ...p, result: p.result === "failure" ? "" : "failure" })); }
        if (e.key === "1") { e.preventDefault(); setForm(p => ({ ...p, down: p.down === "1" ? "" : "1" })); }
        if (e.key === "2") { e.preventDefault(); setForm(p => ({ ...p, down: p.down === "2" ? "" : "2" })); }
        if (e.key === "3") { e.preventDefault(); setForm(p => ({ ...p, down: p.down === "3" ? "" : "3" })); }
        if (e.key === "4") { e.preventDefault(); setForm(p => ({ ...p, down: p.down === "4" ? "" : "4" })); }
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [activeSport]);

  function advanceDown(f) {
    const yards = Number(f.yardsGained), dist = Number(f.distance), down = Number(f.down);
    const newYL = f.yardLine && !isNaN(yards)
      ? String(Math.min(99, Math.max(1, Number(f.yardLine) + yards)))
      : f.yardLine;
    const keep = { personnel: f.personnel, hash: f.hash, yardLine: newYL, formation: f.formation };
    if (!isNaN(yards) && !isNaN(dist) && yards >= dist) {
      setForm(p => ({ ...p, ...keep, down: "1", distance: "10", yardsGained: "", result: "", playType: "", playDirection: "", labels: "" }));
    } else if (down > 0 && down < 4) {
      const nd = !isNaN(yards) ? Math.max(1, dist - yards) : dist;
      setForm(p => ({ ...p, ...keep, down: String(down + 1), distance: String(nd), yardsGained: "", result: "", playType: "", playDirection: "", labels: "" }));
    } else {
      setForm(p => ({ ...p, ...keep, down: "1", distance: "10", yardsGained: "", result: "", playType: "", playDirection: "", labels: "" }));
    }
  }

  function advancePeriod(f) {
    setForm(p => ({ ...p, playType: "", result: "", yardsGained: "", playDirection: "", labels: "" }));
  }

  async function savePlay() {
    const isEdit = !!editingPlay;
    if (!isEdit && snapTime == null) { setError("Mark the start first — press S"); return; }
    setSaving(true); setError("");
    try {
      const body = {
        filmId,
        ...(isEdit ? { playId: editingPlay.id } : { playNumber: nextNum }),
        startTimeSecs: snapTime ?? editingPlay?.start_time_secs,
        endTimeSecs:   whistleTime ?? editingPlay?.end_time_secs ?? undefined,
        down:          form.down          ? Number(form.down)        : undefined,
        distance:      form.distance      ? Number(form.distance)    : undefined,
        yardsGained:   form.yardsGained   ? Number(form.yardsGained) : undefined,
        playType:      form.playType      || undefined,
        formation:     form.formation     || undefined,
        result:        form.result        || undefined,
        playDirection: form.playDirection || undefined,
        hash:          form.hash          || undefined,
        yardLine:      form.yardLine      ? Number(form.yardLine)    : undefined,
        personnel:     form.personnel     || undefined,
        labels:        form.labels ? form.labels.split(",").map(s => s.trim()).filter(Boolean) : undefined,
        notes:         form.notes?.trim() || undefined,
      };
      const r = await fetch("/api/film/plays", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const d = await r.json();
      if (!r.ok) { setError(d.error ?? "Save failed"); setSaving(false); return; }
      if (isEdit) {
        onCancelEdit?.();
      } else {
        if (isFootball) advanceDown({ ...form }); else advancePeriod({ ...form });
        if (videoRef?.current) {
          videoRef.current.currentTime = (whistleTime ?? snapTime) + 8;
          videoRef.current.play?.().catch(() => {});
        }
      }
      formHistoryRef.current = [];
      onSaved?.(); onClear?.();
    } catch { setError("Network error"); }
    setSaving(false);
  }

  actionsRef.current.savePlay = savePlay;

  function copyPrevPlay() {
    const prev = plays[plays.length - 1];
    if (!prev) return;
    setForm(f => ({
      ...f,
      formation: prev.formation || f.formation,
      personnel: prev.personnel || f.personnel,
      hash:      prev.hash      || f.hash,
      down:      prev.down      ? String(prev.down)     : f.down,
      distance:  prev.distance  ? String(prev.distance) : f.distance,
    }));
  }

  const clipSecs = snapTime != null && whistleTime != null ? (whistleTime - snapTime).toFixed(1) : null;
  const snapSet  = snapTime != null;
  const endSet   = whistleTime != null;
  const mob      = isMobile;

  const selStyle = {
    border: "1px solid rgba(255,255,255,0.18)", borderRadius: 7,
    padding: mob ? "8px 10px" : "6px 10px", fontSize: mob ? 14 : 12,
    color: "#e2e8f0", background: "#1e293b", outline: "none", cursor: "pointer",
  };
  const optStyle = { background: "#1e293b", color: "#e2e8f0" };

  const markBtn = (active, colors) => ({
    display: "inline-flex", alignItems: "center", gap: 6,
    padding: mob ? "10px 12px" : "9px 14px",
    flex: 1, borderRadius: 8, cursor: "pointer", fontWeight: 800,
    fontSize: mob ? 13 : 12, color: "#fff",
    background: active ? colors.bg  : "rgba(255,255,255,0.07)",
    border: `1.5px solid ${active ? colors.bd : "rgba(255,255,255,0.14)"}`,
  });

  const typeActive = (id) => form.playType === id;

  return (
    <div style={{ background: "#0d1117", borderRadius: 12, padding: mob ? "10px 12px" : "12px 16px", display: "flex", flexDirection: "column", gap: mob ? 8 : 10, width: "100%", boxSizing: "border-box" }}>

      {/* ── Row 0: Sport badge + Timing on one line ── */}
      <div style={{ display: "flex", alignItems: "center", gap: mob ? 6 : 8 }}>
        {/* Sport badge — styled select, not a full row */}
        <div style={{ position: "relative", flexShrink: 0 }}>
          <select value={activeSport} onChange={e => setActiveSport(e.target.value)}
            style={{ appearance: "none", WebkitAppearance: "none", MozAppearance: "none", background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.11)", borderRadius: 20, paddingLeft: 10, paddingRight: 20, paddingTop: mob ? 5 : 4, paddingBottom: mob ? 5 : 4, fontSize: mob ? 11 : 10, color: "rgba(255,255,255,0.45)", fontWeight: 700, cursor: "pointer", outline: "none", letterSpacing: "0.01em" }}>
            {Object.entries(SPORT_CONFIGS).map(([k, v]) => (
              <option key={k} value={k} style={optStyle}>{v.label}</option>
            ))}
          </select>
          <span style={{ position: "absolute", right: 6, top: "50%", transform: "translateY(-50%)", fontSize: 7, color: "rgba(255,255,255,0.25)", pointerEvents: "none", lineHeight: 1 }}>▾</span>
        </div>

        {/* Snap button */}
        <button onClick={onMarkSnap} style={markBtn(snapSet, { bg:"#1d4ed8", bd:"#3b82f6" })}>
          <span style={{ fontSize: 9, fontWeight: 900, background: snapSet ? "#60a5fa" : "rgba(255,255,255,0.18)", borderRadius: 3, padding: "1px 5px", color: "#0d1117", flexShrink: 0 }}>S</span>
          <span>{snapSet ? fmtTime(snapTime) : (isFootball ? "Snap" : "Start")}</span>
          {snapSet && <CheckCircle2 size={12} style={{ marginLeft: "auto", opacity: 0.8 }} />}
        </button>

        <span style={{ color: "rgba(255,255,255,0.18)", fontSize: 15, flexShrink: 0, lineHeight: 1 }}>→</span>

        {/* Whistle button */}
        <button onClick={onMarkWhistle} style={markBtn(endSet, { bg:"#15803d", bd:"#22c55e" })}>
          <span style={{ fontSize: 9, fontWeight: 900, background: endSet ? "#4ade80" : "rgba(255,255,255,0.18)", borderRadius: 3, padding: "1px 5px", color: "#0d1117", flexShrink: 0 }}>W</span>
          <span>{endSet ? fmtTime(whistleTime) : "End"}</span>
          {endSet && <CheckCircle2 size={12} style={{ marginLeft: "auto", opacity: 0.8 }} />}
        </button>

        {clipSecs && (
          <span style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", fontWeight: 700, flexShrink: 0 }}>{clipSecs}s</span>
        )}

        {/* Copy prev play — fills formation/personnel/down from last tagged play */}
        {plays.length > 0 && !editingPlay && (
          <button onClick={copyPrevPlay} title="Copy formation, personnel, down from last play"
            style={{ marginLeft: "auto", flexShrink: 0, background: "none", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6, padding: mob ? "5px 9px" : "4px 8px", cursor: "pointer", color: "rgba(255,255,255,0.35)", fontSize: 10, fontWeight: 700, display: "flex", alignItems: "center", gap: 4, whiteSpace: "nowrap" }}>
            ↺ Copy prev
          </button>
        )}
      </div>

      {/* ── Keyboard hints strip — always visible on desktop ── */}
      {!mob && (
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", borderTop: "1px solid rgba(255,255,255,0.04)", paddingTop: 6 }}>
          {(isFootball
            ? [["S","snap"],["W","end"],["R","run"],["P","pass"],["G","good"],["F","fail"],["1–4","down"],["↵","save"],["N","skip"],["[ ]","±5s"]]
            : [["S","start"],["W","end"],["↵","save"],["N","skip"],["Z","undo"],["[ ]","±5s"]]
          ).map(([k, l]) => (
            <span key={k} style={{ fontSize: 9, color: "rgba(255,255,255,0.22)", display: "flex", alignItems: "center", gap: 3 }}>
              <span style={{ background: "rgba(255,255,255,0.1)", borderRadius: 3, padding: "1px 5px", fontWeight: 800, fontFamily: "monospace", color: "rgba(255,255,255,0.5)" }}>{k}</span>
              {l}
            </span>
          ))}
          {plays.length > 0 && (
            <span style={{ marginLeft: "auto", fontSize: 9, color: "rgba(255,255,255,0.18)", fontWeight: 700 }}>
              #{plays.length + 1} next
            </span>
          )}
        </div>
      )}

      {/* ── Quick Presets bar (hidden when empty + form clear) ── */}
      {(presets.length > 0 || formHasData) && !editingPlay && (
        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
          {presets.length > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: mob ? 5 : 5, overflowX: "auto", paddingBottom: 1 }}>
              <span style={{ fontSize: 9, color: "rgba(255,255,255,0.2)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", flexShrink: 0 }}>Quick</span>
              {presets.map((p, i) => (
                <div key={i} style={{ position: "relative", flexShrink: 0 }}>
                  <button onClick={() => applyPreset(p)}
                    style={{ paddingLeft: 10, paddingRight: 22, paddingTop: mob ? 5 : 4, paddingBottom: mob ? 5 : 4, borderRadius: 20, border: "1px solid rgba(79,171,255,0.28)", background: "rgba(79,171,255,0.07)", color: "#4FABFF", fontSize: mob ? 11 : 10, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap", maxWidth: 130, overflow: "hidden", textOverflow: "ellipsis", display: "block" }}>
                    {p.name}
                  </button>
                  <button onClick={() => deletePreset(i)}
                    style={{ position: "absolute", top: "50%", right: 7, transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "rgba(79,171,255,0.3)", fontSize: 8, fontWeight: 900, padding: 0, lineHeight: 1 }}>✕</button>
                </div>
              ))}
            </div>
          )}
          {presetInputOpen ? (
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <input autoFocus value={presetInputVal} onChange={e => setPresetInputVal(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); savePreset(presetInputVal); } if (e.key === "Escape") { setPresetInputOpen(false); setPresetInputVal(""); } }}
                placeholder="Name this preset…"
                style={{ flex: 1, padding: mob ? "7px 11px" : "5px 10px", borderRadius: 7, border: "1.5px solid rgba(79,171,255,0.4)", background: "#1e293b", color: "#e2e8f0", fontSize: mob ? 13 : 11, outline: "none" }} />
              <button onClick={() => savePreset(presetInputVal)}
                style={{ padding: mob ? "7px 14px" : "5px 12px", borderRadius: 7, border: "none", background: "#4FABFF", color: "#0d1117", fontSize: mob ? 12 : 11, fontWeight: 800, cursor: "pointer", flexShrink: 0 }}>Save</button>
              <button onClick={() => { setPresetInputOpen(false); setPresetInputVal(""); }}
                style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.3)", fontSize: 14, padding: "0 2px", lineHeight: 1 }}>✕</button>
            </div>
          ) : formHasData && presets.length < 8 && (
            <button onClick={() => setPresetInputOpen(true)}
              style={{ alignSelf: "flex-start", background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.18)", fontSize: mob ? 11 : 10, fontWeight: 700, padding: 0, display: "flex", alignItems: "center", gap: 4 }}>
              <span style={{ fontSize: 12, lineHeight: 1 }}>⊕</span> Save as preset
            </button>
          )}
        </div>
      )}

      {/* ── Edit mode banner ── */}
      {editingPlay && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "rgba(37,99,235,0.15)", border: "1px solid rgba(96,165,250,0.3)", borderRadius: 7, padding: "7px 12px" }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: "#60a5fa", display: "inline-flex", alignItems: "center", gap: 5 }}>
            <Pencil size={11} color="#60a5fa" /> Editing Play #{editingPlay.play_number}
          </span>
          <button onClick={() => { onCancelEdit?.(); onClear?.(); }}
            style={{ display: "inline-flex", alignItems: "center", gap: 4, background: "none", border: "none", color: "rgba(255,255,255,0.4)", fontSize: 12, cursor: "pointer", padding: "0 2px", fontWeight: 700 }}>
            <X size={11} /> Cancel
          </button>
        </div>
      )}

      {/* ── Play types — WHAT happened ── */}
      <div style={{ display: "flex", gap: 4, flexWrap: "wrap", width: "100%" }}>
        {cfg.playTypes.map(t => (
          <button key={t.id} onClick={() => set("playType", typeActive(t.id) ? "" : t.id)} title={t.key ? `Key: ${t.key}` : undefined}
            style={{ flex: "1 1 auto", padding: mob ? "9px 4px" : "8px 6px", fontSize: mob ? 11 : 10, fontWeight: 800, letterSpacing: "0.04em", borderRadius: 7, cursor: "pointer",
              border: `1.5px solid ${typeActive(t.id) ? typeColor(t.id) : "rgba(255,255,255,0.12)"}`,
              background: typeActive(t.id) ? typeColor(t.id) : "rgba(255,255,255,0.06)",
              color: typeActive(t.id) ? "#fff" : "rgba(255,255,255,0.5)" }}>
            {t.label}
          </button>
        ))}
        {customPlayTypes.map(t => (
          <div key={t.id} style={{ position: "relative", flex: "1 1 auto" }}>
            <button onClick={() => set("playType", typeActive(t.id) ? "" : t.id)}
              style={{ width: "100%", padding: mob ? "9px 18px 9px 4px" : "8px 16px 8px 6px", fontSize: mob ? 11 : 10, fontWeight: 800, letterSpacing: "0.04em", borderRadius: 7, cursor: "pointer",
                border: `1.5px solid ${typeActive(t.id) ? "#4FABFF" : "rgba(79,171,255,0.22)"}`,
                background: typeActive(t.id) ? "rgba(79,171,255,0.18)" : "rgba(79,171,255,0.06)",
                color: typeActive(t.id) ? "#4FABFF" : "rgba(79,171,255,0.6)" }}>
              {t.label}
            </button>
            <button onClick={() => removeCustomType(t.id)}
              style={{ position: "absolute", top: "50%", right: 4, transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "rgba(79,171,255,0.28)", fontSize: 8, fontWeight: 900, padding: 0, lineHeight: 1 }}>✕</button>
          </div>
        ))}
        {showNewType ? (
          <input autoFocus value={newTypeVal} onChange={e => setNewTypeVal(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addCustomType(newTypeVal); } if (e.key === "Escape") { setShowNewType(false); setNewTypeVal(""); } }}
            onBlur={() => setTimeout(() => { setShowNewType(false); setNewTypeVal(""); }, 160)}
            placeholder="Type & Enter…"
            style={{ flex: "1 1 80px", padding: mob ? "8px 8px" : "6px 8px", borderRadius: 7, border: "1.5px solid rgba(79,171,255,0.4)", background: "#1e293b", color: "#e2e8f0", fontSize: mob ? 12 : 11, outline: "none", minWidth: 0 }} />
        ) : (
          <button onClick={() => setShowNewType(true)} title="Add custom play type"
            style={{ padding: mob ? "9px 12px" : "8px 10px", borderRadius: 7, border: "1.5px dashed rgba(255,255,255,0.13)", background: "transparent", color: "rgba(255,255,255,0.2)", fontSize: mob ? 15 : 14, fontWeight: 700, cursor: "pointer", flexShrink: 0, lineHeight: 1 }}>+</button>
        )}
      </div>

      {/* ── Result — HOW it went ── */}
      <div style={{ display: "flex", alignItems: "center", gap: mob ? 4 : 5, flexWrap: mob ? "wrap" : "nowrap" }}>
        {cfg.results.map(r => {
          const active = form.result === r.id;
          return (
            <button key={r.id} onClick={() => set("result", active ? "" : r.id)}
              style={{ flex: mob ? "1 1 auto" : "none", padding: mob ? "8px 4px" : "7px 10px", fontSize: mob ? 11 : 10, fontWeight: 800, borderRadius: 6, cursor: "pointer",
                border: `1.5px solid ${active ? r.color : "rgba(255,255,255,0.11)"}`,
                background: active ? `${r.color}22` : "rgba(255,255,255,0.05)",
                color: active ? r.color : "rgba(255,255,255,0.4)" }}>
              {r.label}
            </button>
          );
        })}
        {cfg.showYards && (
          <>
            <span style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", flexShrink: 0, marginLeft: 2 }}>{cfg.yardsLabel || "YDS"}</span>
            <input type="number" value={form.yardsGained} onChange={e => set("yardsGained", e.target.value)} placeholder="–"
              style={{ width: mob ? 48 : 44, padding: mob ? "8px 6px" : "7px 6px", borderRadius: 6, border: "1.5px solid rgba(255,255,255,0.13)", background: "#1e293b", color: "#e2e8f0", fontSize: mob ? 14 : 12, fontWeight: 700, textAlign: "center", outline: "none" }} />
          </>
        )}
      </div>

      {/* ── Situation — WHEN + context (down/period + formation on one row) ── */}
      <div style={{ display: "flex", flexDirection: mob ? "column" : "row", gap: mob ? 6 : 6, alignItems: mob ? "stretch" : "center" }}>
        {/* Down buttons (football) or period chips (other) */}
        <div style={{ display: "flex", alignItems: "center", gap: mob ? 4 : 5, flexShrink: 0 }}>
          {isFootball ? (
            <>
              {[1,2,3,4].map(n => (
                <button key={n} onClick={() => set("down", form.down === String(n) ? "" : String(n))} title={`Key: ${n}`}
                  style={{ width: mob ? undefined : 30, flex: mob ? 1 : "none", height: mob ? 36 : 30, fontSize: mob ? 14 : 13, fontWeight: 800, borderRadius: 7, cursor: "pointer",
                    border: `1.5px solid ${form.down === String(n) ? "#94a3b8" : "rgba(255,255,255,0.11)"}`,
                    background: form.down === String(n) ? "#334155" : "rgba(255,255,255,0.05)",
                    color: form.down === String(n) ? "#fff" : "rgba(255,255,255,0.45)" }}>
                  {n}
                </button>
              ))}
              <span style={{ color: "rgba(255,255,255,0.25)", fontSize: 12, fontWeight: 700, flexShrink: 0 }}>&</span>
              <input type="number" value={form.distance} onChange={e => set("distance", e.target.value)} placeholder="10"
                style={{ width: mob ? 44 : 42, padding: mob ? "8px 6px" : "5px 6px", borderRadius: 7, border: "1.5px solid rgba(255,255,255,0.13)", background: "#1e293b", color: "#e2e8f0", fontSize: mob ? 13 : 12, fontWeight: 700, textAlign: "center", outline: "none", flexShrink: 0 }} />
            </>
          ) : (
            <>
              <span style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", flexShrink: 0 }}>{cfg.periodLabel}</span>
              {(cfg.periods || []).map(p => {
                const active = form.down === String(p);
                return (
                  <button key={p} onClick={() => set("down", active ? "" : String(p))}
                    style={{ padding: mob ? "7px 8px" : "5px 9px", fontSize: mob ? 11 : 10, fontWeight: 800, borderRadius: 6, cursor: "pointer", flexShrink: 0,
                      border: `1.5px solid ${active ? "#94a3b8" : "rgba(255,255,255,0.11)"}`,
                      background: active ? "#334155" : "rgba(255,255,255,0.05)",
                      color: active ? "#fff" : "rgba(255,255,255,0.45)" }}>
                    {p}
                  </button>
                );
              })}
              {cfg.showDistanceInput && (
                <>
                  <span style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", flexShrink: 0 }}>{cfg.distanceLabel}</span>
                  <input type="number" value={form.distance} onChange={e => set("distance", e.target.value)} placeholder={cfg.distancePlaceholder || "–"}
                    style={{ width: 36, padding: mob ? "7px 4px" : "5px 4px", borderRadius: 6, border: "1px solid rgba(255,255,255,0.13)", background: "#1e293b", color: "#e2e8f0", fontSize: mob ? 12 : 11, fontWeight: 700, textAlign: "center", outline: "none", flexShrink: 0 }} />
                </>
              )}
            </>
          )}
        </div>

        {/* Formation / Zone / Situation — promoted out of Details */}
        {cfg.showFormation && (
          <Combobox
            value={form.formation}
            onChange={onFormationChange}
            options={[...(cfg.formations || []), ...customFormations]}
            placeholder={cfg.formationLabel || "Formation"}
            mob={mob}
            inputStyle={{ border: "1px solid rgba(255,255,255,0.13)", borderRadius: 7, padding: mob ? "9px 10px" : "5px 10px", fontSize: mob ? 12 : 11, color: form.formation ? "#e2e8f0" : "rgba(255,255,255,0.3)", background: "#1e293b", outline: "none", width: "100%" }}
          />
        )}
      </div>

      {/* ── Personnel (football only) ── */}
      {isFootball && (
        <div style={{ display: "flex", alignItems: "center", gap: mob ? 5 : 5 }}>
          <span style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", flexShrink: 0 }}>Pers.</span>
          {(cfg.personnelOptions || []).map(g => {
            const active = form.personnel === g;
            return (
              <button key={g} onClick={() => set("personnel", active ? "" : g)}
                style={{ flex: mob ? 1 : "none", padding: mob ? "8px 4px" : "6px 11px", fontSize: mob ? 12 : 11, fontWeight: 800, borderRadius: 6, cursor: "pointer",
                  border: `1.5px solid ${active ? "#4FABFF" : "rgba(255,255,255,0.11)"}`,
                  background: active ? "rgba(79,171,255,0.14)" : "rgba(255,255,255,0.04)",
                  color: active ? "#4FABFF" : "rgba(255,255,255,0.4)" }}>
                {g}
              </button>
            );
          })}
        </div>
      )}

      {/* ── Save / Skip / Speed / Undo ── */}
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <button onClick={savePlay} disabled={saving || (!editingPlay && !snapSet)}
          style={{ flex: 1, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7, padding: mob ? "11px 10px" : "10px 20px", borderRadius: 9, border: "none", fontWeight: 800, fontSize: mob ? 13 : 13,
            background: (editingPlay || snapSet) ? (editingPlay ? "#1e40af" : DS.brand) : "rgba(255,255,255,0.05)",
            color: (editingPlay || snapSet) ? "#fff" : "rgba(255,255,255,0.18)",
            cursor: saving || (!editingPlay && !snapSet) ? "not-allowed" : "pointer", minWidth: 0 }}>
          {saving ? <Loader2 size={13} style={{ animation: "spin 1s linear infinite", flexShrink: 0 }} /> : <CheckCircle2 size={13} style={{ flexShrink: 0 }} />}
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {saving ? "Saving…" : editingPlay ? `Update #${editingPlay.play_number}` : `Save #${nextNum}`}
          </span>
        </button>
        {!editingPlay && (
          <button onClick={onSkip} style={{ padding: mob ? "11px 10px" : "10px 14px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.38)", fontSize: mob ? 12 : 12, fontWeight: 700, cursor: "pointer", flexShrink: 0 }}>
            Skip
          </button>
        )}
        <div style={{ display: "flex", alignItems: "center", gap: 3, flexShrink: 0 }}>
          {SPEEDS.map(s => (
            <button key={s} onClick={() => { onSetSpeed?.(s); if (videoRef?.current) videoRef.current.playbackRate = s; }}
              style={{ padding: mob ? "7px 7px" : "5px 8px", borderRadius: 6, border: "none", cursor: "pointer", fontSize: mob ? 11 : 10, fontWeight: 800,
                background: speed === s ? "#4FABFF" : "rgba(255,255,255,0.07)",
                color: speed === s ? "#0d1117" : "rgba(255,255,255,0.45)" }}>
              {s}x
            </button>
          ))}
        </div>
        <button onClick={undoFormField} title="Undo last field (Z)"
          style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.35)", fontSize: mob ? 14 : 13, padding: "4px", display: "flex", alignItems: "center", flexShrink: 0 }}>↩</button>
      </div>

      {/* ── Details ▸ — hash, yard line, direction, tags, notes ── */}
      <div style={{ paddingTop: 2, borderTop: "1px solid rgba(255,255,255,0.05)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button onClick={() => setShowMore(m => !m)}
            style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.3)", fontSize: 11, fontWeight: 700, padding: "2px 0", display: "flex", alignItems: "center", gap: 4 }}>
            <span style={{ fontSize: 9 }}>{showMore ? "▾" : "▸"}</span> {showMore ? "Hide details" : "Details"}
          </button>
        </div>

        {showMore && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10, paddingTop: 10 }}>

            {/* Football: Hash + Yard line */}
            {isFootball && (
              <div style={{ display: "flex", alignItems: "center", gap: mob ? 5 : 5 }}>
                <span style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", flexShrink: 0 }}>Hash</span>
                {[{ id:"left_wide", short:"LW" },{ id:"left_hash", short:"LH" },{ id:"middle", short:"MID" },{ id:"right_hash", short:"RH" },{ id:"right_wide", short:"RW" }].map(h => {
                  const active = form.hash === h.id;
                  return (
                    <button key={h.id} onClick={() => set("hash", active ? "" : h.id)}
                      style={{ flex: mob ? 1 : "none", padding: mob ? "7px 2px" : "5px 8px", fontSize: mob ? 11 : 10, fontWeight: 800, borderRadius: 6, cursor: "pointer",
                        border: `1.5px solid ${active ? "#94a3b8" : "rgba(255,255,255,0.09)"}`,
                        background: active ? "#334155" : "rgba(255,255,255,0.03)",
                        color: active ? "#e2e8f0" : "rgba(255,255,255,0.35)" }}>
                      {h.short}
                    </button>
                  );
                })}
                <span style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", fontWeight: 700, flexShrink: 0, marginLeft: 4 }}>YD</span>
                <input type="number" value={form.yardLine} onChange={e => set("yardLine", e.target.value)} placeholder="–"
                  style={{ width: mob ? 44 : 42, padding: mob ? "7px 6px" : "5px 6px", borderRadius: 6, border: "1px solid rgba(255,255,255,0.13)", background: "#1e293b", color: "#e2e8f0", fontSize: mob ? 13 : 12, fontWeight: 700, textAlign: "center", outline: "none" }} />
              </div>
            )}

            {/* Direction */}
            {(isFootball || cfg.showDirection) && (
              <div style={{ display: "flex", alignItems: "center", gap: mob ? 5 : 5 }}>
                <span style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", flexShrink: 0 }}>Dir</span>
                {[{ id:"left", icon:"←", label:"Left" },{ id:"middle", icon:"↑", label:"Middle" },{ id:"right", icon:"→", label:"Right" }].map(d => {
                  const active = form.playDirection === d.id;
                  return (
                    <button key={d.id} onClick={() => set("playDirection", active ? "" : d.id)} title={d.label}
                      style={{ display:"flex", alignItems:"center", justifyContent:"center", width: mob ? 40 : 36, height: mob ? 36 : 30, fontSize: mob ? 15 : 13, fontWeight: 800, borderRadius: 7, cursor: "pointer",
                        border: `1.5px solid ${active ? "#64748b" : "rgba(255,255,255,0.09)"}`,
                        background: active ? "#334155" : "rgba(255,255,255,0.03)",
                        color: active ? "#e2e8f0" : "rgba(255,255,255,0.35)" }}>
                      {d.icon}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Custom labels */}
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", flexShrink: 0 }}>Tags</span>
              <input type="text" value={form.labels} onChange={e => set("labels", e.target.value)}
                placeholder="red_zone, key_play… (comma-separated)"
                style={{ flex: 1, padding: mob ? "9px 12px" : "5px 10px", borderRadius: 7, border: "1px solid rgba(255,255,255,0.13)", background: "#1e293b", color: "#e2e8f0", fontSize: mob ? 13 : 11, outline: "none" }} />
            </div>

            {/* Coach notes */}
            <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
              <span style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", flexShrink: 0, paddingTop: 8 }}>Note</span>
              <textarea value={form.notes} onChange={e => set("notes", e.target.value)} placeholder="Coach note for this play…" rows={2}
                style={{ flex: 1, padding: mob ? "8px 12px" : "5px 10px", borderRadius: 7, border: "1px solid rgba(255,255,255,0.13)", background: "#1e293b", color: "#e2e8f0", fontSize: mob ? 13 : 11, outline: "none", resize: "none", fontFamily: "inherit" }} />
            </div>
          </div>
        )}
      </div>

      {error && <p style={{ margin: 0, fontSize: 12, color: "#f87171" }}>{error}</p>}
    </div>
  );
}

// ── Annotation Modal ──────────────────────────────────────────────────────────
// Coach draws arrows/circles on a play thumbnail, saves as JSON to game_plays.
// Strokes use normalized coords [0-1] so they render correctly on any screen size.
function AnnotationModal({ play, onSave, onClose }) {
  const canvasRef   = useRef(null);
  const [tool,      setTool]      = useState("arrow");   // arrow | circle | line | text
  const [color,     setColor]     = useState("#FF3B30");
  const [strokes,   setStrokes]   = useState(() => play.coach_annotation?.strokes ?? []);
  const [noteText,  setNoteText]  = useState(() => play.coach_annotation?.noteText ?? "");
  const [drawing,   setDrawing]   = useState(false);
  const [current,   setCurrent]   = useState(null);      // in-progress stroke
  const [saving,    setSaving]    = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);

  const thumb = play.mux_playback_id
    ? `https://image.mux.com/${play.mux_playback_id}/thumbnail.jpg?time=${Math.floor(play.start_time_secs ?? 0)}&width=800&fit_mode=preserve`
    : null;

  // Redraw canvas whenever strokes or current stroke changes
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const W = canvas.width, H = canvas.height;
    ctx.clearRect(0, 0, W, H);
    const allStrokes = current ? [...strokes, current] : strokes;
    for (const s of allStrokes) {
      ctx.strokeStyle = s.color;
      ctx.fillStyle   = s.color;
      ctx.lineWidth   = s.tool === "line" ? 4 : 2.5;
      ctx.lineCap     = "round";
      ctx.lineJoin    = "round";
      const pts = s.points.map(([x, y]) => [x * W, y * H]);
      if (!pts.length) continue;

      if (s.tool === "arrow" && pts.length >= 2) {
        const [x1,y1] = pts[0], [x2,y2] = pts[pts.length-1];
        ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.stroke();
        // arrowhead
        const angle = Math.atan2(y2-y1, x2-x1);
        const headLen = 14;
        ctx.beginPath();
        ctx.moveTo(x2, y2);
        ctx.lineTo(x2 - headLen * Math.cos(angle - Math.PI/6), y2 - headLen * Math.sin(angle - Math.PI/6));
        ctx.lineTo(x2 - headLen * Math.cos(angle + Math.PI/6), y2 - headLen * Math.sin(angle + Math.PI/6));
        ctx.closePath(); ctx.fill();

      } else if (s.tool === "circle" && pts.length >= 2) {
        const [x1,y1] = pts[0], [x2,y2] = pts[pts.length-1];
        const rx = Math.abs(x2-x1)/2, ry = Math.abs(y2-y1)/2;
        const cx = (x1+x2)/2, cy = (y1+y2)/2;
        ctx.beginPath(); ctx.ellipse(cx, cy, Math.max(rx,4), Math.max(ry,4), 0, 0, 2*Math.PI);
        ctx.stroke();

      } else if (s.tool === "line") {
        ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
        for (const [px,py] of pts.slice(1)) ctx.lineTo(px, py);
        ctx.stroke();

      } else if (s.tool === "text" && s.text) {
        ctx.font = `bold ${Math.round(H * 0.04)}px system-ui`;
        ctx.fillText(s.text, pts[0][0], pts[0][1]);
      }
    }
  }, [strokes, current]);

  function getPos(e) {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return [(clientX - rect.left) / rect.width, (clientY - rect.top) / rect.height];
  }

  function onPointerDown(e) {
    e.preventDefault();
    const pt = getPos(e);
    if (tool === "text") {
      const text = window.prompt("Enter coaching note:");
      if (text?.trim()) setStrokes(prev => [...prev, { tool: "text", color, text: text.trim(), points: [pt] }]);
      return;
    }
    setDrawing(true);
    setCurrent({ tool, color, points: [pt] });
  }

  function onPointerMove(e) {
    if (!drawing || !current) return;
    e.preventDefault();
    const pt = getPos(e);
    setCurrent(prev => ({ ...prev, points: tool === "line" ? [...prev.points, pt] : [prev.points[0], pt] }));
  }

  function onPointerUp(e) {
    if (!drawing || !current) return;
    setDrawing(false);
    if (current.points.length >= 1) setStrokes(prev => [...prev, current]);
    setCurrent(null);
  }

  async function handleSave() {
    setSaving(true);
    const annotation = (strokes.length > 0 || noteText.trim())
      ? { strokes, noteText: noteText.trim() }
      : null;
    try {
      const r = await fetch("/api/plays/annotate", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playId: play.id, annotation }),
      });
      const d = await r.json();
      if (r.ok) { onSave?.(play.id, d.annotation); onClose(); }
      else toast.error(d.error ?? "Save failed");
    } catch { toast.error("Network error"); }
    setSaving(false);
  }

  const TOOLS = [
    { id: "arrow",  label: "→ Arrow"  },
    { id: "circle", label: "○ Circle" },
    { id: "line",   label: "/ Draw"   },
    { id: "text",   label: "T Text"   },
  ];
  const COLORS = ["#FF3B30","#FF9500","#FFCC00","#34C759","#007AFF","#FFFFFF"];

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 500, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center" }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ background: "#0d1117", borderRadius: 16, overflow: "hidden", width: "min(860px, 96vw)", maxHeight: "96vh", display: "flex", flexDirection: "column" }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 18px", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
          <div>
            <span style={{ fontSize: 14, fontWeight: 800, color: "#e2e8f0" }}>Annotate Play #{play.play_number}</span>
            <span style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", marginLeft: 8 }}>Draw on this frame — athletes will see it in their feed</span>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.4)", cursor: "pointer", display: "flex", alignItems: "center" }}><X size={16} /></button>
        </div>

        {/* Toolbar */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 18px", borderBottom: "1px solid rgba(255,255,255,0.06)", flexWrap: "wrap" }}>
          {TOOLS.map(t => (
            <button key={t.id} onClick={() => setTool(t.id)}
              style={{ padding: "6px 12px", borderRadius: 7, border: `1px solid ${tool === t.id ? "#4FABFF" : "rgba(255,255,255,0.12)"}`, background: tool === t.id ? "rgba(79,171,255,0.15)" : "rgba(255,255,255,0.04)", color: tool === t.id ? "#4FABFF" : "rgba(255,255,255,0.55)", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
              {t.label}
            </button>
          ))}
          <div style={{ width: 1, height: 20, background: "rgba(255,255,255,0.1)", marginLeft: 4 }} />
          {COLORS.map(c => (
            <button key={c} onClick={() => setColor(c)}
              style={{ width: 22, height: 22, borderRadius: "50%", background: c, border: `2.5px solid ${color === c ? "#fff" : "transparent"}`, cursor: "pointer", flexShrink: 0 }} />
          ))}
          <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
            <button onClick={() => setStrokes(prev => prev.slice(0, -1))} disabled={!strokes.length}
              style={{ padding: "6px 12px", borderRadius: 7, border: "1px solid rgba(255,255,255,0.1)", background: "none", color: strokes.length ? "rgba(255,255,255,0.5)" : "rgba(255,255,255,0.15)", fontSize: 11, fontWeight: 700, cursor: strokes.length ? "pointer" : "default" }}>
              ↩ Undo
            </button>
            <button onClick={() => setStrokes([])} disabled={!strokes.length}
              style={{ padding: "6px 12px", borderRadius: 7, border: "1px solid rgba(255,87,87,0.3)", background: strokes.length ? "rgba(255,87,87,0.08)" : "none", color: strokes.length ? "#f87171" : "rgba(255,255,255,0.15)", fontSize: 11, fontWeight: 700, cursor: strokes.length ? "pointer" : "default" }}>
              Clear
            </button>
          </div>
        </div>

        {/* Canvas */}
        <div style={{ position: "relative", flex: 1, minHeight: 0, background: "#000", userSelect: "none" }}>
          {thumb && (
            <img
              src={thumb} alt=""
              onLoad={() => setImgLoaded(true)}
              style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "contain", display: "block" }}
            />
          )}
          <canvas
            ref={canvasRef}
            width={800} height={450}
            onMouseDown={onPointerDown}
            onMouseMove={onPointerMove}
            onMouseUp={onPointerUp}
            onMouseLeave={onPointerUp}
            onTouchStart={onPointerDown}
            onTouchMove={onPointerMove}
            onTouchEnd={onPointerUp}
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", cursor: tool === "text" ? "text" : "crosshair" }}
          />
        </div>

        {/* Note + save */}
        <div style={{ padding: "12px 18px", borderTop: "1px solid rgba(255,255,255,0.08)", display: "flex", gap: 10, alignItems: "center" }}>
          <input
            value={noteText}
            onChange={e => setNoteText(e.target.value)}
            placeholder="Add a coaching note for athletes (optional)…"
            style={{ flex: 1, padding: "9px 13px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.13)", background: "#1e293b", color: "#e2e8f0", fontSize: 13, outline: "none" }}
          />
          {play.coach_annotation && (
            <button onClick={() => { setStrokes([]); setNoteText(""); handleSave(); }}
              style={{ padding: "9px 14px", borderRadius: 8, border: "1px solid rgba(255,87,87,0.3)", background: "none", color: "#f87171", fontSize: 12, fontWeight: 700, cursor: "pointer", flexShrink: 0 }}>
              Remove
            </button>
          )}
          <button onClick={handleSave} disabled={saving}
            style={{ padding: "9px 20px", borderRadius: 8, border: "none", background: "#4FABFF", color: "#0d1117", fontSize: 13, fontWeight: 800, cursor: saving ? "not-allowed" : "pointer", flexShrink: 0 }}>
            {saving ? "Saving…" : "Save Annotation"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Play Sidebar ──────────────────────────────────────────────────────────────
function PlayCommentSection({ playId }) {
  const [comments, setComments] = useState([]);
  const [input,    setInput]    = useState("");
  const [posting,  setPosting]  = useState(false);

  useEffect(() => {
    if (!playId) return;
    fetch(`/api/film/play-comments?playId=${playId}`, { credentials: "include" })
      .then(r => r.json())
      .then(d => { if (d.ok) setComments(d.comments ?? []); })
      .catch(() => {});
  }, [playId]);

  async function post() {
    if (!input.trim() || posting) return;
    setPosting(true);
    try {
      const r = await fetch("/api/film/play-comments", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playId, body: input.trim() }),
      });
      const d = await r.json();
      if (d.ok) { setComments(prev => [...prev, d.comment]); setInput(""); }
    } catch {}
    setPosting(false);
  }

  async function togglePin(c) {
    const pinned = !c.is_pinned;
    setComments(prev =>
      [...prev.map(x => x.id === c.id ? { ...x, is_pinned: pinned } : x)]
        .sort((a, b) => (b.is_pinned ? 1 : 0) - (a.is_pinned ? 1 : 0))
    );
    fetch("/api/film/play-comments", {
      method: "PATCH", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ commentId: c.id, pin: pinned }),
    }).catch(() => {});
  }

  const pinned   = comments.filter(c => c.is_pinned);
  const unpinned = comments.filter(c => !c.is_pinned);

  return (
    <div onClick={e => e.stopPropagation()} style={{ padding: "8px 0 2px", borderTop: `1px solid ${DS.brandBorder}`, marginTop: 6 }}>
      {/* Pinned notes callout */}
      {pinned.map(c => (
        <div key={c.id} style={{
          display: "flex", gap: 8, alignItems: "flex-start",
          background: DS.brandBg, border: `1px solid ${DS.brandBorder}`,
          borderRadius: 8, padding: "7px 9px", marginBottom: 6,
        }}>
          <Bookmark size={10} fill={DS.brand} color={DS.brand} style={{ flexShrink: 0, marginTop: 2 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ margin: 0, fontSize: 10, fontWeight: 800, color: DS.brand }}>{c.user_name}</p>
            <p style={{ margin: "2px 0 0", fontSize: 11, color: DS.bodyText, lineHeight: 1.4 }}>{c.body}</p>
          </div>
          <button onClick={() => togglePin(c)} title="Unpin"
            style={{ background: "none", border: "none", cursor: "pointer", color: DS.dimText, padding: "0 2px", fontSize: 14, lineHeight: 1 }}>×</button>
        </div>
      ))}

      {/* Thread */}
      {unpinned.map(c => (
        <div key={c.id} style={{ display: "flex", gap: 7, alignItems: "flex-start", padding: "5px 0" }}>
          <div style={{ width: 20, height: 20, borderRadius: "50%", background: DS.pageBg, border: `1px solid ${DS.border}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <span style={{ fontSize: 8, fontWeight: 800, color: DS.labelText }}>{(c.user_name || "?")[0].toUpperCase()}</span>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: DS.labelText }}>{c.user_name} </span>
            <span style={{ fontSize: 11, color: DS.bodyText, lineHeight: 1.4 }}>{c.body}</span>
          </div>
          <button onClick={() => togglePin(c)} title="Pin as note"
            style={{ background: "none", border: "none", cursor: "pointer", padding: "2px", color: DS.dimText, flexShrink: 0, display: "flex", alignItems: "center" }}>
            <Bookmark size={10} />
          </button>
        </div>
      ))}

      {comments.length === 0 && (
        <p style={{ fontSize: 10, color: DS.dimText, margin: "2px 0 6px", textAlign: "center" }}>No notes yet</p>
      )}

      {/* Input */}
      <div style={{ display: "flex", gap: 5, marginTop: 6 }}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === "Enter" && !e.shiftKey && post()}
          placeholder="Add a note…"
          style={{
            flex: 1, padding: "5px 8px", borderRadius: 7, fontSize: 11,
            border: `1px solid ${DS.border}`, background: DS.pageBg,
            color: DS.bodyText, outline: "none",
          }}
        />
        <button onClick={post} disabled={!input.trim() || posting}
          style={{
            background: DS.brand, border: "none", borderRadius: 7,
            padding: "5px 9px", cursor: "pointer", color: "#fff",
            fontSize: 11, fontWeight: 700, opacity: !input.trim() || posting ? 0.5 : 1,
          }}>
          {posting ? "…" : "Post"}
        </button>
      </div>
    </div>
  );
}

function PlaySidebar({ plays, selectedId, onSelect, onEdit, onDelete, onMove, onAnnotate, playlists, onAddToPlaylist, onCreateAndAddToPlaylist }) {
  const [openMenuId, setOpenMenuId] = useState(null);
  const anchorRef = useRef(null);
  const [filter, setFilter] = useState("all");

  const types = useMemo(() => {
    const s = new Set(plays.map(p => p.play_type).filter(Boolean));
    return [...Array.from(s)];
  }, [plays]);

  const visible = useMemo(() =>
    filter === "all" ? plays : plays.filter(p => p.play_type === filter),
  [plays, filter]);

  // Mini stats summary
  const runs       = plays.filter(p => p.play_type === "run").length;
  const passes     = plays.filter(p => p.play_type === "pass").length;
  const successes  = plays.filter(p => ["success","td"].includes(p.result)).length;
  const pct        = plays.length ? Math.round((successes / plays.length) * 100) : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>

      {/* Mini stats bar */}
      {plays.length > 0 && (
        <div style={{ display: "flex", gap: 0, marginBottom: 10, background: DS.pageBg, borderRadius: 8, overflow: "hidden", flexShrink: 0 }}>
          {[
            { label: "Runs",    value: runs,    color: TYPE_COLOR.run  },
            { label: "Passes",  value: passes,  color: TYPE_COLOR.pass },
            { label: "Success", value: pct != null ? `${pct}%` : "–", color: DS.safe },
          ].map((s, i) => (
            <div key={s.label} style={{ flex: 1, textAlign: "center", padding: "8px 4px", borderLeft: i > 0 ? `1px solid ${DS.border}` : "none" }}>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 800, color: s.color }}>{s.value}</p>
              <p style={{ margin: 0, fontSize: 9, color: DS.dimText, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Filter pills */}
      {types.length > 0 && (
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap", paddingBottom: 10, marginBottom: 8, borderBottom: `1px solid ${DS.border}`, flexShrink: 0 }}>
          <button onClick={() => setFilter("all")} style={{
            border: "none", borderRadius: 20, padding: "3px 9px",
            fontSize: 9, fontWeight: 800, cursor: "pointer", letterSpacing: "0.05em", textTransform: "uppercase",
            background: filter === "all" ? DS.brand : DS.pageBg,
            color: filter === "all" ? "#fff" : DS.labelText,
          }}>All {plays.length}</button>
          {types.map(t => (
            <button key={t} onClick={() => setFilter(t)} style={{
              border: "none", borderRadius: 20, padding: "3px 9px",
              fontSize: 9, fontWeight: 800, cursor: "pointer", letterSpacing: "0.05em", textTransform: "uppercase",
              background: filter === t ? typeColor(t) : typeBg(t),
              color: filter === t ? "#fff" : typeColor(t),
            }}>
              {typeShort(t)} {plays.filter(p => p.play_type === t).length}
            </button>
          ))}
        </div>
      )}

      {/* Play list */}
      <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 3 }}>
        {visible.map((play, visIdx) => {
          const sel      = play.id === selectedId;
          const dl       = downLabel(play.down, play.distance);
          const dur      = play.start_time_secs != null && play.end_time_secs != null
            ? `${fmtTime(play.start_time_secs)} – ${fmtTime(play.end_time_secs)}`
            : play.start_time_secs != null ? fmtTime(play.start_time_secs)
            : null;
          const isFirst  = visIdx === 0;
          const isLast   = visIdx === visible.length - 1;

          return (
            <div key={play.id} onClick={() => onSelect(play)} style={{
              display: "flex", alignItems: "stretch", cursor: "pointer",
              borderRadius: 9, border: `1px solid ${sel ? DS.brandBorder : DS.border}`,
              background: sel ? DS.brandBg : DS.cardBg,
              overflow: "hidden", transition: "all 0.1s",
              boxShadow: sel ? `0 0 0 2px ${DS.brandBorder}` : "none",
            }}>
              {/* Result color stripe */}
              <div style={{
                width: 4, flexShrink: 0,
                background: play.result ? resultColor(play.result) : (sel ? DS.brand : DS.border),
              }} />

              {/* Content */}
              <div style={{ flex: 1, padding: "8px 10px", minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 3 }}>
                  {/* Play number */}
                  <span style={{ fontSize: 9, fontWeight: 700, color: DS.dimText, minWidth: 18 }}>
                    #{play.play_number}
                  </span>

                  {/* Down & Distance — headline */}
                  {dl ? (
                    <span style={{ fontSize: 12, fontWeight: 800, color: sel ? DS.brand : DS.bodyText }}>
                      {dl}
                    </span>
                  ) : (
                    <span style={{ fontSize: 11, fontWeight: 600, color: DS.dimText }}>No metadata</span>
                  )}

                  {/* Type chip */}
                  {play.play_type && (
                    <span style={{
                      fontSize: 8, fontWeight: 800, padding: "2px 5px", borderRadius: 4,
                      background: sel ? typeColor(play.play_type) : typeBg(play.play_type),
                      color: sel ? "#fff" : typeColor(play.play_type),
                      textTransform: "uppercase", letterSpacing: "0.04em", flexShrink: 0,
                    }}>
                      {typeShort(play.play_type)}
                    </span>
                  )}

                  {/* Yards gained */}
                  {play.yards_gained != null && (
                    <span style={{
                      fontSize: 11, fontWeight: 800, flexShrink: 0,
                      color: Number(play.yards_gained) >= 0 ? DS.safe : DS.warn,
                    }}>
                      {Number(play.yards_gained) > 0 ? "+" : ""}{play.yards_gained}
                    </span>
                  )}

                  {/* AI tracked badge */}
                  {(play.player_tracks ?? []).length > 0 && (
                    <span style={{ fontSize: 7, fontWeight: 800, padding: "1px 5px", borderRadius: 3, background: DS.safeBg, color: DS.safe, textTransform: "uppercase", letterSpacing: "0.05em", flexShrink: 0, border: `1px solid ${DS.safeBorder}` }}>
                      AI ✓
                    </span>
                  )}

                  {/* Action buttons */}
                  <div style={{ marginLeft: "auto", display: "flex", gap: 1, flexShrink: 0, alignItems: "center" }}>
                    <button
                      onClick={e => { e.stopPropagation(); onMove?.(play, "up"); }}
                      disabled={isFirst}
                      style={{ background: "none", border: "none", cursor: isFirst ? "default" : "pointer", padding: "2px 3px", borderRadius: 4, color: isFirst ? "rgba(255,255,255,0.1)" : DS.dimText, lineHeight: 1, display: "flex" }}
                      title="Move up"
                    ><ChevronUp size={11} /></button>
                    <button
                      onClick={e => { e.stopPropagation(); onMove?.(play, "down"); }}
                      disabled={isLast}
                      style={{ background: "none", border: "none", cursor: isLast ? "default" : "pointer", padding: "2px 3px", borderRadius: 4, color: isLast ? "rgba(255,255,255,0.1)" : DS.dimText, lineHeight: 1, display: "flex" }}
                      title="Move down"
                    ><ChevronDown size={11} /></button>
                    <button
                      onClick={e => { e.stopPropagation(); onAnnotate?.(play); }}
                      style={{ background: "none", border: "none", cursor: "pointer", padding: "2px 4px", borderRadius: 4, color: play.coach_annotation ? "#4FABFF" : DS.dimText, lineHeight: 1, display: "flex", alignItems: "center" }}
                      title={play.coach_annotation ? "Edit coaching annotation" : "Add coaching annotation"}
                    ><Pencil size={11} /></button>
                    <button
                      onClick={e => { e.stopPropagation(); onEdit?.(play); }}
                      style={{ background: "none", border: "none", cursor: "pointer", padding: "2px 4px", borderRadius: 4, color: DS.dimText, lineHeight: 1, display: "flex", alignItems: "center" }}
                      title="Edit play"
                    ><Pencil size={11} /></button>
                    <button
                      onClick={e => { e.stopPropagation(); onDelete?.(play); }}
                      style={{ background: "none", border: "none", cursor: "pointer", padding: "2px 3px", borderRadius: 4, color: "#f87171", lineHeight: 1, display: "flex" }}
                      title="Delete play"
                    ><Trash2 size={11} /></button>
                    <button
                      ref={openMenuId === play.id ? anchorRef : null}
                      onClick={e => {
                        e.stopPropagation();
                        anchorRef.current = e.currentTarget;
                        setOpenMenuId(openMenuId === play.id ? null : play.id);
                      }}
                      style={{ background: "none", border: "none", cursor: "pointer", padding: "2px 4px", borderRadius: 4, fontSize: 10, color: openMenuId === play.id ? DS.brand : DS.dimText, lineHeight: 1, display: "flex", alignItems: "center" }}
                      title="Add to playlist"
                    ><Plus size={11} /></button>
                    {openMenuId === play.id && (
                      <AddToPlaylistMenu
                        play={play}
                        playlists={playlists ?? []}
                        onAdd={onAddToPlaylist}
                        onCreateAndAdd={onCreateAndAddToPlaylist}
                        onClose={() => setOpenMenuId(null)}
                        anchorRef={anchorRef}
                      />
                    )}
                  </div>
                </div>

                {/* Row 2: timestamp + location + formation */}
                <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                  {dur && (
                    <span style={{ fontSize: 10, color: DS.dimText, fontVariantNumeric: "tabular-nums" }}>{dur}</span>
                  )}
                  {play.yard_line != null && (
                    <span style={{ fontSize: 9, color: DS.dimText }}>· Yd {play.yard_line}</span>
                  )}
                  {play.hash && (
                    <span style={{ fontSize: 9, color: DS.dimText }}>
                      · { {left_wide:"LW", left_hash:"LH", middle:"Mid", right_hash:"RH", right_wide:"RW"}[play.hash] ?? play.hash }
                    </span>
                  )}
                  {play.formation && (
                    <span style={{ fontSize: 9, color: DS.dimText }}>· {cap(play.formation)}</span>
                  )}
                </div>

                {/* Row 3: personnel chip + direction + labels */}
                {(play.personnel || play.play_direction || (play.labels ?? []).length > 0) && (
                  <div style={{ display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap", marginTop: 3 }}>
                    {play.personnel && (
                      <span style={{ fontSize: 8, fontWeight: 800, padding: "2px 5px", borderRadius: 4, background: DS.brandBg, color: DS.brand, textTransform: "uppercase" }}>
                        {play.personnel} pers
                      </span>
                    )}
                    {play.play_direction && (
                      <span style={{ fontSize: 9 }}>
                        { {left:"←", middle:"↑", right:"→"}[play.play_direction] }
                      </span>
                    )}
                    {(play.labels ?? []).map(l => (
                      <span key={l} style={{ fontSize: 8, fontWeight: 600, padding: "2px 5px", borderRadius: 4, background: "#f1f5f9", color: "#475569" }}>
                        {l}
                      </span>
                    ))}
                  </div>
                )}

                {/* Coach note */}
                {play.notes && (
                  <p style={{ margin: "4px 0 0", fontSize: 10, color: DS.labelText, fontStyle: "italic", lineHeight: 1.35,
                    overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
                    "{play.notes}"
                  </p>
                )}

                {/* Comments — expanded when play is selected */}
                {sel && <PlayCommentSection playId={play.id} />}
              </div>
            </div>
          );
        })}

        {visible.length === 0 && plays.length > 0 && (
          <p style={{ textAlign: "center", color: DS.dimText, fontSize: 12, margin: "20px 0" }}>
            No {filter} plays tagged
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
  const [tracks,        setTracks]        = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [saving,        setSaving]        = useState(null);
  const [chosen,        setChosen]        = useState({});
  const [autoConfirmed, setAutoConfirmed] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`/api/film/unconfirmed?filmId=${filmId}`, { credentials: "include" });
      const d = await r.json();
      const unc = d.unconfirmed ?? [];
      setTracks(unc);
      setAutoConfirmed(d.autoConfirmed ?? 0);
      onCountKnown?.(unc.length);
      if (d.allConfirmed) onAllConfirmed?.();
    } catch {}
    setLoading(false);
  }, [filmId, onAllConfirmed, onCountKnown]);

  useEffect(() => { load(); }, [load]);

  async function confirm(trackId) {
    const track    = tracks.find(t => t.rekognition_track_id === trackId);
    const rosterId = chosen[trackId] ?? (
      track?.jersey_number != null
        ? roster.find(p => p.jersey_number === track.jersey_number)?.id
        : null
    );
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
        <p style={{ margin: "2px 0 0", fontSize: 12, color: DS.labelText }}>
          Full analytics unlocked.{autoConfirmed > 0 ? ` ${autoConfirmed} auto-confirmed by AI.` : ""}
        </p>
      </div>
    </div>
  );

  return (
    <div>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 16 }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: DS.bodyText }}>Confirm Player Identity</h3>
          <p style={{ margin: "4px 0 0", fontSize: 12, color: DS.labelText }}>
            {tracks.length} player{tracks.length !== 1 ? "s" : ""} need review · confirm once to unlock all their plays
            {autoConfirmed > 0 && <span style={{ color: DS.safe, fontWeight: 600 }}> · {autoConfirmed} auto-confirmed ✓</span>}
          </p>
        </div>
        <button onClick={load} style={{ background: "none", border: "none", cursor: "pointer", color: DS.dimText, display: "flex", gap: 4, alignItems: "center", fontSize: 12 }}>
          <RefreshCw size={12} /> Refresh
        </button>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {tracks.map(track => {
          const isHome    = track.team === "home";
          const isAway    = track.team === "away";
          // Filter roster by team — home detections only show your roster, away show opponent side
          const rosterOpts = isAway
            ? []  // no opponent roster yet — handled by "Unknown #X (opponent)" below
            : roster;
          const guess     = track.jersey_number != null ? roster.find(p => p.jersey_number === track.jersey_number) : null;
          const conf      = track.jersey_confidence != null ? Math.round(track.jersey_confidence * 100) : null;
          const selVal    = chosen[track.rekognition_track_id] ?? guess?.id ?? "";
          const canSubmit = !!selVal && !isAway;

          return (
            <div key={track.rekognition_track_id} style={{
              display: "flex", alignItems: "center", gap: 12,
              border: `1px solid ${DS.border}`, borderRadius: 10, padding: "12px 14px", background: DS.cardBg,
            }}>
              {/* Jersey number + confidence */}
              <div style={{
                width: 52, height: 52, borderRadius: 10, flexShrink: 0,
                background: isAway ? "#fef2f2" : DS.brandBg,
                display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
              }}>
                <span style={{ fontWeight: 800, fontSize: 17, color: isAway ? DS.warn : DS.brand, lineHeight: 1 }}>
                  {track.jersey_number != null ? `#${track.jersey_number}` : "?"}
                </span>
                <span style={{ fontSize: 8, color: DS.dimText, marginTop: 2, fontWeight: 600 }}>
                  {isAway ? "OPP" : "HOME"}
                </span>
              </div>

              {/* Context: confidence + play count */}
              <div style={{ display: "flex", flexDirection: "column", gap: 2, flexShrink: 0, minWidth: 72 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: DS.bodyText }}>
                  {track.play_count} play{track.play_count !== 1 ? "s" : ""}
                </span>
                {conf != null && (
                  <span style={{ fontSize: 10, color: conf >= 80 ? DS.safe : conf >= 60 ? DS.caution : DS.warn, fontWeight: 600 }}>
                    {conf}% conf.
                  </span>
                )}
                {guess && !isAway && (
                  <span style={{ fontSize: 10, color: DS.safe, fontWeight: 600 }}>AI: {guess.player_name.split(" ")[0]}</span>
                )}
              </div>

              {/* Roster select — filtered to home/away appropriately */}
              {isAway ? (
                <div style={{ flex: 1, fontSize: 12, color: DS.dimText, fontStyle: "italic" }}>
                  Opponent player — roster import coming soon
                </div>
              ) : (
                <select
                  value={selVal}
                  onChange={e => setChosen(p => ({ ...p, [track.rekognition_track_id]: e.target.value }))}
                  style={{ flex: 1, border: `1px solid ${DS.border}`, borderRadius: 8, padding: "8px 10px", fontSize: 13, color: DS.bodyText, background: DS.pageBg, outline: "none" }}
                >
                  <option value="">— Select player —</option>
                  {rosterOpts.map(p => (
                    <option key={p.id} value={p.id}>
                      #{p.jersey_number} {p.player_name}{p.position ? ` · ${p.position}` : ""}
                    </option>
                  ))}
                </select>
              )}

              {!isAway && (
                <button
                  onClick={() => confirm(track.rekognition_track_id)}
                  disabled={saving === track.rekognition_track_id || !canSubmit}
                  style={{
                    background: canSubmit ? DS.brand : DS.border, color: canSubmit ? "#fff" : DS.dimText,
                    border: "none", borderRadius: 8, padding: "9px 16px", fontWeight: 700, fontSize: 12,
                    cursor: canSubmit && saving !== track.rekognition_track_id ? "pointer" : "not-allowed",
                    flexShrink: 0, opacity: saving === track.rekognition_track_id ? 0.6 : 1,
                    display: "flex", alignItems: "center", gap: 5,
                  }}
                >
                  {saving === track.rekognition_track_id
                    ? <Loader2 size={12} style={{ animation: "spin 1s linear infinite" }} />
                    : <CheckCircle2 size={12} />}
                  Confirm
                </button>
              )}
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

// ── Add-to-Playlist Menu ──────────────────────────────────────────────────────
// Rendered via portal so it escapes the sidebar's overflowY:auto scroll clipping.
function AddToPlaylistMenu({ play, playlists, onAdd, onCreateAndAdd, onClose, anchorRef }) {
  const [creating, setCreating] = useState(false);
  const [newName,  setNewName]  = useState("");
  const [busy,     setBusy]     = useState(false);
  const [coords,   setCoords]   = useState(null);

  // Position the menu below the anchor button using fixed coords
  useEffect(() => {
    if (!anchorRef?.current) return;
    const r = anchorRef.current.getBoundingClientRect();
    const menuW = 220;
    let left = r.right - menuW;
    if (left < 8) left = 8;
    setCoords({ top: r.bottom + 4, left });
  }, [anchorRef]);

  // Close on outside click
  useEffect(() => {
    function handle(e) {
      if (anchorRef?.current?.contains(e.target)) return;
      onClose();
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [onClose, anchorRef]);

  async function handleCreate() {
    const name = newName.trim();
    if (!name) return;
    setBusy(true);
    await onCreateAndAdd(name, play);
    setBusy(false);
    onClose();
  }

  async function handleAdd(list) {
    setBusy(true);
    await onAdd(list.id, play);
    setBusy(false);
    onClose();
  }

  if (!coords) return null;

  const menu = (
    <div
      style={{
        position: "fixed", zIndex: 9999,
        top: coords.top, left: coords.left, width: 220,
        background: DS.cardBg, border: `1px solid ${DS.border}`, borderRadius: 10,
        boxShadow: "0 8px 32px rgba(0,0,0,0.14)",
        padding: "6px 0",
      }}
      onMouseDown={e => e.stopPropagation()}
    >
      {/* Header */}
      <p style={{ margin: "0 0 4px", padding: "2px 12px 6px", fontSize: 9, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.06em", color: DS.dimText, borderBottom: `1px solid ${DS.border}` }}>
        Add to playlist
      </p>

      {/* Existing playlists */}
      {playlists.length === 0 && !creating && (
        <p style={{ margin: 0, padding: "8px 14px", fontSize: 12, color: DS.dimText }}>No playlists yet</p>
      )}
      {playlists.map(list => {
        const already = (list.items ?? []).some(p => p.id === play.id);
        return (
          <button key={list.id}
            onClick={() => !already && handleAdd(list)}
            disabled={already || busy}
            style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              width: "100%", padding: "8px 14px", border: "none",
              background: "none", cursor: already ? "default" : "pointer", textAlign: "left",
            }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: already ? DS.dimText : DS.bodyText }}>{list.name}</span>
            <span style={{ fontSize: 10, color: already ? DS.safe : DS.dimText, fontWeight: 700 }}>
              {already ? "✓ Added" : `${(list.items ?? []).length}`}
            </span>
          </button>
        );
      })}

      {/* New playlist */}
      <div style={{ borderTop: `1px solid ${DS.border}`, marginTop: 2, paddingTop: 2 }}>
        {creating ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 6, padding: "8px 10px" }}>
            <input
              autoFocus
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") handleCreate(); if (e.key === "Escape") setCreating(false); }}
              placeholder="Playlist name…"
              style={{
                width: "100%", boxSizing: "border-box",
                padding: "7px 10px", borderRadius: 7, fontSize: 13,
                border: `1px solid ${DS.border}`, outline: "none",
                background: DS.pageBg, color: DS.bodyText,
              }}
            />
            <div style={{ display: "flex", gap: 6 }}>
              <button onClick={handleCreate} disabled={busy || !newName.trim()}
                style={{
                  flex: 1, background: DS.brand, color: "#fff", border: "none", borderRadius: 7,
                  padding: "8px 0", fontSize: 12, fontWeight: 800, cursor: newName.trim() ? "pointer" : "not-allowed",
                  opacity: newName.trim() ? 1 : 0.5,
                }}>
                {busy ? "Saving…" : "Save"}
              </button>
              <button onClick={() => setCreating(false)}
                style={{
                  background: DS.pageBg, color: DS.labelText, border: `1px solid ${DS.border}`,
                  borderRadius: 7, padding: "8px 12px", fontSize: 12, cursor: "pointer",
                }}>
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button onClick={() => setCreating(true)}
            style={{
              display: "flex", alignItems: "center", gap: 7, width: "100%",
              padding: "9px 14px", border: "none", background: "none",
              cursor: "pointer", color: DS.brand, fontSize: 13, fontWeight: 700,
            }}>
            <Plus size={13} /> New playlist
          </button>
        )}
      </div>
    </div>
  );

  if (typeof document === "undefined") return null;
  return createPortal(menu, document.body);
}

// ── Angle Manager ──────────────────────────────────────────────────────────────
function AngleManager({ primaryFilmId, angles, onRefresh, onClose }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [editId, setEditId] = useState(null);
  const [editLabel, setEditLabel] = useState("");
  const [editOffset, setEditOffset] = useState("0");
  const [busy, setBusy] = useState(false);

  async function searchFilms(q) {
    if (!q.trim()) { setSearchResults([]); return; }
    setSearching(true);
    try {
      const r = await fetch(`/api/film/list?search=${encodeURIComponent(q)}&limit=10`, { credentials: "include" });
      const d = await r.json();
      setSearchResults((d.films ?? []).filter(f => f.id !== primaryFilmId));
    } catch {
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  }

  async function addAngle(angleFilm) {
    setBusy(true);
    await fetch("/api/film/angles", {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "add", primaryFilmId, angleFilmId: angleFilm.id, label: "Angle " + (angles.length + 2), timeOffsetSecs: 0 }),
    });
    setSearchQuery(""); setSearchResults([]);
    await onRefresh();
    setBusy(false);
  }

  async function saveEdit(id) {
    setBusy(true);
    await fetch("/api/film/angles", {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "update", id, label: editLabel, timeOffsetSecs: parseFloat(editOffset) || 0 }),
    });
    setEditId(null);
    await onRefresh();
    setBusy(false);
  }

  async function removeAngle(id) {
    if (!confirm("Remove this angle?")) return;
    setBusy(true);
    await fetch("/api/film/angles", {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete", id }),
    });
    await onRefresh();
    setBusy(false);
  }

  return (
    <div style={{ background: DS.cardBg, border: `1px solid ${DS.border}`, borderRadius: 12, padding: 16, marginBottom: 12 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 14 }}>
        <SwitchCamera size={15} color={DS.brand} style={{ marginTop: 1, flexShrink: 0 }} />
        <div>
          <p style={{ margin: 0, fontWeight: 700, color: DS.bodyText, fontSize: 13 }}>Camera Angles</p>
          <p style={{ margin: "2px 0 0", fontSize: 11, color: DS.dimText }}>
            Link another film as a secondary angle. Use the time offset to align playback — positive means the angle film starts later than the primary.
          </p>
        </div>
      </div>

      {/* Existing angles list */}
      {angles.length === 0 && (
        <div style={{ padding: "12px 14px", background: DS.pageBg, borderRadius: 8, border: `1px dashed ${DS.border}`, marginBottom: 12 }}>
          <p style={{ margin: 0, fontSize: 12, color: DS.dimText, textAlign: "center" }}>No angles linked yet. Search for a film below to add one.</p>
        </div>
      )}
      {angles.map(a => (
        <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, padding: "9px 12px", background: DS.pageBg, borderRadius: 8, border: `1px solid ${DS.border}` }}>
          <Video size={12} color={DS.dimText} style={{ flexShrink: 0 }} />

          {editId === a.id ? (
            <input value={editLabel} onChange={e => setEditLabel(e.target.value)}
              style={{ background: DS.cardBg, border: `1px solid ${DS.border}`, borderRadius: 6, padding: "4px 8px", fontSize: 12, color: DS.bodyText, width: 120 }} />
          ) : (
            <span style={{ flex: 1, fontWeight: 600, fontSize: 12, color: DS.bodyText }}>{a.label}</span>
          )}

          <span style={{ fontSize: 11, color: DS.dimText, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {a.game_films?.title ?? "—"}
          </span>

          {editId === a.id ? (
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 11, color: DS.dimText }}>offset</span>
              <input type="number" step="0.1" value={editOffset} onChange={e => setEditOffset(e.target.value)}
                style={{ background: DS.cardBg, border: `1px solid ${DS.border}`, borderRadius: 6, padding: "4px 6px", fontSize: 11, color: DS.bodyText, width: 60 }} />
              <span style={{ fontSize: 11, color: DS.dimText }}>s</span>
              <button onClick={() => saveEdit(a.id)} disabled={busy}
                style={{ background: DS.brand, color: "#fff", border: "none", borderRadius: 6, padding: "5px 10px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>Save</button>
              <button onClick={() => setEditId(null)}
                style={{ background: "none", border: "none", cursor: "pointer", color: DS.dimText, display: "flex", alignItems: "center" }}>
                <X size={13} />
              </button>
            </div>
          ) : (
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 11, color: DS.dimText }}>
                {a.time_offset_secs !== 0 ? `${a.time_offset_secs > 0 ? "+" : ""}${a.time_offset_secs}s` : "in sync"}
              </span>
              <button onClick={() => { setEditId(a.id); setEditLabel(a.label); setEditOffset(String(a.time_offset_secs ?? 0)); }}
                style={{ background: "none", border: `1px solid ${DS.border}`, borderRadius: 6, padding: "3px 8px", cursor: "pointer", fontSize: 11, color: DS.dimText }}>
                Edit
              </button>
              <button onClick={() => removeAngle(a.id)} disabled={busy}
                style={{ background: DS.warnBg, border: `1px solid ${DS.warn}`, borderRadius: 6, padding: "3px 8px", cursor: "pointer", color: DS.warn, fontSize: 11, display: "flex", alignItems: "center", gap: 4 }}>
                <Trash2 size={11} />
              </button>
            </div>
          )}
        </div>
      ))}

      {/* Search to link a new film */}
      <div style={{ marginTop: angles.length > 0 ? 12 : 0 }}>
        <div style={{ position: "relative" }}>
          <input
            value={searchQuery}
            onChange={e => { setSearchQuery(e.target.value); searchFilms(e.target.value); }}
            placeholder="Search films by title or opponent…"
            style={{ width: "100%", padding: "8px 12px 8px 32px", borderRadius: 8, border: `1px solid ${DS.border}`, background: DS.pageBg, color: DS.bodyText, fontSize: 12, outline: "none", boxSizing: "border-box" }}
          />
          <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", display: "flex", pointerEvents: "none" }}>
            <Film size={12} color={DS.dimText} />
          </span>
        </div>
        {searching && (
          <p style={{ margin: "6px 0 0", fontSize: 11, color: DS.dimText }}>Searching…</p>
        )}
        {searchResults.length > 0 && (
          <div style={{ marginTop: 6, display: "flex", flexDirection: "column", gap: 4 }}>
            {searchResults.map(f => (
              <div key={f.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", background: DS.pageBg, borderRadius: 8, border: `1px solid ${DS.border}` }}>
                <Video size={12} color={DS.dimText} style={{ flexShrink: 0 }} />
                <span style={{ flex: 1, fontSize: 12, color: DS.bodyText, fontWeight: 600 }}>{f.title || "Untitled"}</span>
                {f.opponent && <span style={{ fontSize: 11, color: DS.dimText }}>vs {f.opponent}</span>}
                {f.game_date && <span style={{ fontSize: 11, color: DS.dimText }}>{f.game_date}</span>}
                <button onClick={() => addAngle(f)} disabled={busy}
                  style={{ background: DS.brand, color: "#fff", border: "none", borderRadius: 6, padding: "5px 10px", fontSize: 11, fontWeight: 700, cursor: "pointer", flexShrink: 0 }}>
                  Add
                </button>
              </div>
            ))}
          </div>
        )}
        {!searching && searchQuery.trim() && searchResults.length === 0 && (
          <p style={{ margin: "6px 0 0", fontSize: 11, color: DS.dimText }}>No films found. Try a different title.</p>
        )}
      </div>
    </div>
  );
}

// ── Playlists Tab ─────────────────────────────────────────────────────────────
function PlaylistsTab({ playlists, onPlay, onDelete, onRemovePlay, onRename, onPublish, onUnpublish, filmId, fetchPlaylists, onCreateCrossGame }) {
  const [openId,        setOpenId]        = useState(null);
  const [renaming,      setRenaming]      = useState(null);
  const [newCGName,     setNewCGName]     = useState("");
  const [showNewCG,     setShowNewCG]     = useState(false);
  const [busyCG,        setBusyCG]        = useState(false);
  const [publishingId,  setPublishingId]  = useState(null);
  const [showDuePicker, setShowDuePicker] = useState(null); // listId
  const [dueDate,       setDueDate]       = useState(() => { const d = new Date(); d.setDate(d.getDate() + 7); return d.toISOString().split("T")[0]; });

  async function createCrossGame() {
    const name = newCGName.trim(); if (!name) return;
    setBusyCG(true);
    await onCreateCrossGame(name);
    setNewCGName(""); setShowNewCG(false);
    await fetchPlaylists();
    setBusyCG(false);
  }
  const [renameVal, setRenameVal] = useState("");
  const [busy,      setBusy]      = useState(false);

  const open = playlists.find(l => l.id === openId);

  async function handleDelete(listId) {
    if (!confirm("Delete this playlist?")) return;
    setBusy(true);
    await onDelete(listId);
    if (openId === listId) setOpenId(null);
    await fetchPlaylists();
    setBusy(false);
  }

  async function handleRemove(itemId) {
    setBusy(true);
    await onRemovePlay(itemId);
    await fetchPlaylists();
    setBusy(false);
  }

  async function handleRename(listId) {
    const name = renameVal.trim();
    if (!name) return;
    setBusy(true);
    await onRename(listId, name);
    await fetchPlaylists();
    setRenaming(null);
    setBusy(false);
  }

  async function handlePublishCutup(listId) {
    setPublishingId(listId);
    await onPublish(listId, "cara", dueDate);
    setShowDuePicker(null);
    await fetchPlaylists();
    setPublishingId(null);
  }

  async function handleUnpublishCutup(listId) {
    setPublishingId(listId);
    await onUnpublish(listId);
    await fetchPlaylists();
    setPublishingId(null);
  }

  const filmPlaylists = playlists.filter(l => l.film_id);
  const crossPlaylists = playlists.filter(l => !l.film_id);

  if (playlists.length === 0 && !showNewCG) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ background: DS.cardBg, border: `1px solid ${DS.border}`, borderRadius: 14, padding: 48, textAlign: "center" }}>
          <ListVideo size={36} color={DS.dimText} style={{ opacity: 0.25, marginBottom: 14 }} />
          <p style={{ margin: "0 0 6px", fontSize: 15, fontWeight: 700, color: DS.bodyText }}>No cut-ups yet</p>
          <p style={{ margin: "0 0 20px", fontSize: 13, color: DS.labelText }}>
            Click the <strong>+</strong> button on any play in the sidebar to add it to a film playlist, or create a cross-game cut-up below.
          </p>
          <button onClick={() => setShowNewCG(true)}
            style={{ background: DS.brand, color: "#fff", border: "none", borderRadius: 9, padding: "10px 20px", fontSize: 13, fontWeight: 800, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 }}>
            <Plus size={14} /> New Cross-Game Cut-up
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

      {/* New cross-game playlist form */}
      {!open && (showNewCG ? (
        <div style={{ background: DS.cardBg, border: `1px solid ${DS.border}`, borderRadius: 12, padding: "14px 16px", display: "flex", gap: 10, alignItems: "center" }}>
          <ListVideo size={18} color={DS.brand} style={{ flexShrink: 0 }} />
          <input autoFocus value={newCGName} onChange={e => setNewCGName(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") createCrossGame(); if (e.key === "Escape") setShowNewCG(false); }}
            placeholder="Cross-game cut-up name…"
            style={{ flex: 1, padding: "8px 12px", borderRadius: 8, border: `1px solid ${DS.border}`, fontSize: 13, outline: "none", background: DS.pageBg, color: DS.bodyText }} />
          <button onClick={createCrossGame} disabled={busyCG || !newCGName.trim()}
            style={{ background: DS.brand, color: "#fff", border: "none", borderRadius: 8, padding: "8px 16px", fontSize: 12, fontWeight: 800, cursor: "pointer" }}>
            {busyCG ? "…" : "Create"}
          </button>
          <button onClick={() => setShowNewCG(false)} style={{ background: "none", border: "none", cursor: "pointer", color: DS.dimText, display: "flex", alignItems: "center" }}><X size={15} /></button>
        </div>
      ) : (
        <button onClick={() => setShowNewCG(true)}
          style={{ alignSelf: "flex-start", background: DS.brandBg, color: DS.brand, border: `1px solid ${DS.brandBorder}`, borderRadius: 9, padding: "8px 16px", fontSize: 12, fontWeight: 800, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
          <Plus size={13} /> New Cross-Game Cut-up
        </button>
      ))}

      {/* Playlist list */}
      {!open && playlists.map(list => (
        <div key={list.id} style={{
          background: DS.cardBg, border: `1px solid ${DS.border}`, borderRadius: 12,
          padding: "14px 16px", display: "flex", alignItems: "center", gap: 12,
        }}>
          <div style={{ width: 44, height: 44, borderRadius: 10, background: DS.brandBg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <ListVideo size={20} color={DS.brand} />
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            {renaming === list.id ? (
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input
                  autoFocus value={renameVal} onChange={e => setRenameVal(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") handleRename(list.id); if (e.key === "Escape") setRenaming(null); }}
                  style={{ flex: 1, padding: "5px 8px", borderRadius: 6, border: `1px solid ${DS.border}`, fontSize: 13, outline: "none", background: DS.pageBg, color: DS.bodyText }}
                />
                <button onClick={() => handleRename(list.id)} style={{ background: DS.brand, color: "#fff", border: "none", borderRadius: 6, padding: "5px 10px", fontSize: 11, fontWeight: 800, cursor: "pointer" }}>Save</button>
                <button onClick={() => setRenaming(null)} style={{ background: "none", border: "none", cursor: "pointer", color: DS.dimText, fontSize: 12 }}>✕</button>
              </div>
            ) : (
              <>
                <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 2 }}>
                  <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: DS.bodyText }}>{list.name}</p>
                  {!list.film_id && (
                    <span style={{ fontSize: 9, fontWeight: 800, padding: "2px 6px", borderRadius: 4, background: "#f0fdf4", color: "#16a34a", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                      All Games
                    </span>
                  )}
                </div>
                <p style={{ margin: 0, fontSize: 11, color: DS.dimText }}>
                  {(list.items ?? []).length} play{(list.items ?? []).length !== 1 ? "s" : ""}
                  {list.created_by && ` · by ${list.created_by}`}
                </p>
              </>
            )}
          </div>

          <div style={{ display: "flex", gap: 6, flexShrink: 0, alignItems: "center", flexWrap: "wrap" }}>
            <button onClick={() => onPlay(list)} disabled={!(list.items ?? []).length}
              style={{
                display: "inline-flex", alignItems: "center", gap: 5,
                background: DS.brand, color: "#fff", border: "none", borderRadius: 8,
                padding: "8px 14px", fontSize: 12, fontWeight: 700, cursor: (list.items ?? []).length ? "pointer" : "not-allowed",
                opacity: (list.items ?? []).length ? 1 : 0.4,
              }}>
              <Play size={12} /> Play All
            </button>

            {/* Publish as Required Viewing */}
            {list.is_published ? (
              <button onClick={() => handleUnpublishCutup(list.id)} disabled={publishingId === list.id}
                style={{ display: "inline-flex", alignItems: "center", gap: 5, background: "rgba(255,59,48,0.08)", border: "1.5px solid rgba(255,59,48,0.3)", borderRadius: 8, padding: "8px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer", color: "#FF3B30" }}>
                {publishingId === list.id ? "…" : "● Required"}
              </button>
            ) : showDuePicker === list.id ? (
              <div style={{ display: "flex", gap: 6, alignItems: "center" }} onClick={e => e.stopPropagation()}>
                <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} min={new Date().toISOString().split("T")[0]}
                  style={{ padding: "6px 8px", borderRadius: 8, border: `1px solid ${DS.border}`, fontSize: 12, background: DS.pageBg, color: DS.bodyText, outline: "none" }} />
                <button onClick={() => handlePublishCutup(list.id)} disabled={publishingId === list.id}
                  style={{ background: "#C8102E", color: "#fff", border: "none", borderRadius: 8, padding: "7px 12px", fontSize: 12, fontWeight: 800, cursor: "pointer" }}>
                  {publishingId === list.id ? "…" : "Assign"}
                </button>
                <button onClick={() => setShowDuePicker(null)} style={{ background: "none", border: "none", cursor: "pointer", color: DS.dimText, fontSize: 16 }}>✕</button>
              </div>
            ) : (
              <button onClick={() => setShowDuePicker(list.id)} disabled={!(list.items ?? []).length}
                style={{ display: "inline-flex", alignItems: "center", gap: 5, background: "rgba(200,16,46,0.06)", border: `1px solid rgba(200,16,46,0.25)`, borderRadius: 8, padding: "8px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer", color: "#C8102E", opacity: (list.items ?? []).length ? 1 : 0.4 }}>
                Assign as Required
              </button>
            )}

            <button onClick={() => setOpenId(list.id)}
              style={{ background: DS.pageBg, border: `1px solid ${DS.border}`, borderRadius: 8, padding: "8px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer", color: DS.labelText, display: "flex", alignItems: "center", gap: 4 }}>
              <ChevronRight size={13} /> View
            </button>
            <button onClick={() => { setRenaming(list.id); setRenameVal(list.name); }}
              style={{ background: DS.pageBg, border: `1px solid ${DS.border}`, borderRadius: 8, padding: "8px 10px", cursor: "pointer", color: DS.dimText, display: "flex", alignItems: "center" }}>
              <Pencil size={13} />
            </button>
            <button onClick={() => handleDelete(list.id)} disabled={busy}
              style={{ background: DS.warnBg, border: `1px solid ${DS.warn}`, borderRadius: 8, padding: "8px 10px", cursor: "pointer", color: DS.warn }}>
              <Trash2 size={13} />
            </button>
          </div>
        </div>
      ))}

      {/* Open playlist: play-by-play view */}
      {open && (
        <div style={{ background: DS.cardBg, border: `1px solid ${DS.border}`, borderRadius: 14, overflow: "hidden" }}>
          {/* Header */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 18px", borderBottom: `1px solid ${DS.border}` }}>
            <button onClick={() => setOpenId(null)} style={{ background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 5, color: DS.labelText, fontSize: 12, padding: 0 }}>
              <ArrowLeft size={13} /> Back
            </button>
            <div style={{ width: 1, height: 16, background: DS.border }} />
            <ListVideo size={16} color={DS.brand} />
            <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: DS.bodyText, flex: 1 }}>{open.name}</p>
            <button onClick={() => onPlay(open)} disabled={!open.items?.length}
              style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                background: DS.brand, color: "#fff", border: "none", borderRadius: 8,
                padding: "8px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer",
              }}>
              <Play size={14} /> Play All
            </button>
          </div>

          {/* Play list */}
          <div style={{ display: "flex", flexDirection: "column" }}>
            {(open.items ?? []).length === 0 && (
              <p style={{ margin: 0, padding: 24, textAlign: "center", fontSize: 13, color: DS.dimText }}>No plays yet — add some from the sidebar.</p>
            )}
            {(open.items ?? []).map((play, idx) => {
              const dl  = downLabel(play.down, play.distance);
              const dur = play.start_time_secs != null && play.end_time_secs != null
                ? `${fmtTime(play.start_time_secs)} – ${fmtTime(play.end_time_secs)}`
                : play.start_time_secs != null ? fmtTime(play.start_time_secs) : null;
              return (
                <div key={play._itemId} style={{
                  display: "flex", alignItems: "center", gap: 12, padding: "10px 18px",
                  borderBottom: `1px solid ${DS.border}`,
                }}>
                  <span style={{ width: 22, fontSize: 11, fontWeight: 700, color: DS.dimText, textAlign: "right", flexShrink: 0 }}>{idx + 1}</span>
                  <div style={{ width: 4, height: 36, borderRadius: 2, flexShrink: 0, background: play.result ? resultColor(play.result) : DS.border }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: DS.bodyText }}>
                        {dl ?? `Play #${play.play_number}`}
                      </span>
                      {play.play_type && (
                        <span style={{ fontSize: 9, fontWeight: 800, padding: "2px 5px", borderRadius: 4, background: typeBg(play.play_type), color: typeColor(play.play_type), textTransform: "uppercase" }}>
                          {typeShort(play.play_type)}
                        </span>
                      )}
                      {play.yards_gained != null && (
                        <span style={{ fontSize: 11, fontWeight: 700, color: Number(play.yards_gained) >= 0 ? DS.safe : DS.warn }}>
                          {Number(play.yards_gained) > 0 ? "+" : ""}{play.yards_gained}
                        </span>
                      )}
                    </div>
                    {dur && <p style={{ margin: 0, fontSize: 10, color: DS.dimText }}>{dur}</p>}
                  </div>
                  <button onClick={() => handleRemove(play._itemId)} disabled={busy}
                    style={{ background: "none", border: "none", cursor: "pointer", color: DS.dimText, padding: "4px", borderRadius: 4, display: "flex", alignItems: "center" }}>
                    <X size={14} />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Cut-up Player Overlay ─────────────────────────────────────────────────────
function CutupOverlay({ cutup, onNext, onPrev, onStop, isMobile }) {
  if (!cutup) return null;
  const { name, plays, index } = cutup;
  const current = plays[index];
  const dl = downLabel(current?.down, current?.distance);

  return (
    <div style={{
      position: "absolute", bottom: 0, left: 0, right: 0,
      background: "linear-gradient(transparent, rgba(0,0,0,0.85))",
      padding: isMobile ? "16px 12px 10px" : "24px 20px 14px",
      display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 12,
      pointerEvents: "none",
    }}>
      {/* Left: play info */}
      <div style={{ pointerEvents: "auto" }}>
        <p style={{ margin: "0 0 2px", fontSize: isMobile ? 10 : 11, fontWeight: 700, color: "rgba(255,255,255,0.6)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
          {name} · {index + 1} / {plays.length}
        </p>
        <p style={{ margin: 0, fontSize: isMobile ? 14 : 16, fontWeight: 800, color: "#fff" }}>
          {dl ?? `Play #${current?.play_number}`}
          {current?.play_type && (
            <span style={{ fontSize: 11, fontWeight: 700, marginLeft: 8, background: "rgba(255,255,255,0.15)", borderRadius: 4, padding: "2px 6px" }}>
              {typeShort(current.play_type)}
            </span>
          )}
        </p>
      </div>

      {/* Right: controls */}
      <div style={{ display: "flex", gap: 8, pointerEvents: "auto" }}>
        <button onClick={onPrev} disabled={index === 0}
          style={{ background: "rgba(255,255,255,0.15)", border: "none", borderRadius: 8, padding: "8px 12px", cursor: index > 0 ? "pointer" : "not-allowed", color: "#fff", display: "flex", alignItems: "center", opacity: index === 0 ? 0.4 : 1 }}>
          <SkipBack size={16} />
        </button>
        <button onClick={onNext} disabled={index >= plays.length - 1}
          style={{ background: "rgba(255,255,255,0.15)", border: "none", borderRadius: 8, padding: "8px 12px", cursor: index < plays.length - 1 ? "pointer" : "not-allowed", color: "#fff", display: "flex", alignItems: "center", opacity: index >= plays.length - 1 ? 0.4 : 1 }}>
          <SkipForward size={16} />
        </button>
        <button onClick={onStop}
          style={{ background: "rgba(220,38,38,0.8)", border: "none", borderRadius: 8, padding: "8px 12px", cursor: "pointer", color: "#fff", fontSize: 12, fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 5 }}>
          <X size={12} /> Exit
        </button>
      </div>
    </div>
  );
}

// ── Telestration — canvas only, no toolbar ────────────────────────────────────
const TELE_TOOLS  = [
  { id: "arrow", label: "Arrow",  icon: "↗" },
  { id: "pen",   label: "Pen",    icon: "~" },
  { id: "rect",  label: "Rect",   icon: "□" },
  { id: "circle",label: "Circle", icon: "○" },
  { id: "line",  label: "Line",   icon: "—" },
];
const TELE_COLORS = ["#FF3B30","#FFCC00","#FFFFFF","#34C759","#007AFF","#FF9500"];

function Telestration({ active, strokes, onStrokesChange, tool, color }) {
  const setStrokes = onStrokesChange;
  const canvasRef  = useRef(null);
  const isDown     = useRef(false);
  const livePts    = useRef([]);

  const visible = active || strokes.length > 0;

  useEffect(() => {
    if (!visible || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const fit = () => {
      const parent = canvas.parentElement;
      canvas.width  = parent.offsetWidth;
      canvas.height = parent.offsetHeight;
      redrawAll();
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(canvas.parentElement);
    return () => ro.disconnect();
  }, [visible]);

  useEffect(() => { if (visible) redrawAll(); }, [strokes, visible]);

  function redrawAll(extra) {
    const c = canvasRef.current; if (!c) return;
    const ctx = c.getContext("2d");
    ctx.clearRect(0, 0, c.width, c.height);
    for (const s of strokes) paint(ctx, s, c.width, c.height);
    if (extra) paint(ctx, extra, c.width, c.height);
  }

  function paint(ctx, stroke, W, H) {
    const pts = stroke.points; if (!pts?.length) return;
    ctx.strokeStyle = stroke.color; ctx.fillStyle = stroke.color;
    ctx.lineWidth = stroke.lw; ctx.lineCap = "round"; ctx.lineJoin = "round";
    if (stroke.type === "pen" || stroke.type === "line") {
      ctx.beginPath(); ctx.moveTo(pts[0].x*W, pts[0].y*H);
      for (let i=1; i<pts.length; i++) ctx.lineTo(pts[i].x*W, pts[i].y*H);
      ctx.stroke();
    } else if (stroke.type === "arrow") {
      if (pts.length < 2) return;
      const [p0,p1] = [pts[0], pts[pts.length-1]];
      const x1=p0.x*W, y1=p0.y*H, x2=p1.x*W, y2=p1.y*H;
      const head=Math.max(stroke.lw*5,18), ang=Math.atan2(y2-y1,x2-x1);
      ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x2,y2);
      ctx.lineTo(x2-head*Math.cos(ang-Math.PI/7), y2-head*Math.sin(ang-Math.PI/7));
      ctx.lineTo(x2-head*Math.cos(ang+Math.PI/7), y2-head*Math.sin(ang+Math.PI/7));
      ctx.closePath(); ctx.fill();
    } else if (stroke.type === "rect") {
      if (pts.length < 2) return;
      const [p0,p1] = [pts[0], pts[pts.length-1]];
      ctx.strokeRect(p0.x*W, p0.y*H, (p1.x-p0.x)*W, (p1.y-p0.y)*H);
    } else if (stroke.type === "circle") {
      if (pts.length < 2) return;
      const [p0,p1] = [pts[0], pts[pts.length-1]];
      const cx=((p0.x+p1.x)/2)*W, cy=((p0.y+p1.y)/2)*H;
      const rx=Math.abs(p1.x-p0.x)*W/2, ry=Math.abs(p1.y-p0.y)*H/2;
      if (rx<1||ry<1) return;
      ctx.beginPath(); ctx.ellipse(cx,cy,rx,ry,0,0,Math.PI*2); ctx.stroke();
    }
  }

  function getXY(e) {
    const c=canvasRef.current; const r=c.getBoundingClientRect();
    const src=e.touches?e.touches[0]:e;
    return { x:(src.clientX-r.left)/r.width, y:(src.clientY-r.top)/r.height };
  }
  function handleDown(e) { e.preventDefault(); isDown.current=true; livePts.current=[getXY(e)]; }
  function handleMove(e) {
    e.preventDefault(); if (!isDown.current) return;
    livePts.current.push(getXY(e));
    redrawAll({ type:tool, color, lw:3, points:[...livePts.current] });
  }
  function handleUp(e) {
    e.preventDefault(); if (!isDown.current) return;
    isDown.current=false;
    if (livePts.current.length>0)
      setStrokes(prev=>[...prev,{type:tool,color,lw:3,points:[...livePts.current]}]);
    livePts.current=[];
  }

  if (!visible) return null;
  return (
    <canvas ref={canvasRef}
      onPointerDown={active?handleDown:undefined} onPointerMove={active?handleMove:undefined}
      onPointerUp={active?handleUp:undefined}     onPointerLeave={active?handleUp:undefined}
      style={{
        position:"absolute", top:0, left:0, right:0, bottom:48, zIndex:20,
        pointerEvents:active?"all":"none",
        cursor:active?"crosshair":"default",
        touchAction:active?"none":"auto",
      }}
    />
  );
}

// ── Video Control Bar — one strip, always at the bottom, never moves ──────────
function VideoControlBar({ videoRef, drawMode, onDrawToggle, strokes, onStrokesChange, tool, onToolChange, color, onColorChange, onFullscreenToggle, hideDrawToggle }) {
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    const vid = videoRef?.current; if (!vid) return;
    const onPlay  = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    vid.addEventListener("play",  onPlay);
    vid.addEventListener("pause", onPause);
    setPlaying(!vid.paused);
    return () => { vid.removeEventListener("play",onPlay); vid.removeEventListener("pause",onPause); };
  });

  function togglePlay() {
    const vid = videoRef?.current; if (!vid) return;
    vid.paused ? vid.play().catch(()=>{}) : vid.pause();
  }

  const btn = (style={}) => ({
    background:"rgba(255,255,255,0.08)", border:"none", color:"#fff",
    borderRadius:7, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center",
    ...style,
  });

  return (
    <div style={{
      position:"absolute", bottom:0, left:0, right:0, zIndex:60,
      background:"rgba(8,10,18,0.88)", backdropFilter:"blur(14px)",
      borderTop:"1px solid rgba(255,255,255,0.07)",
    }}>
      {/* Drawing tools row — only when drawing */}
      {drawMode && (
        <div style={{ display:"flex", alignItems:"center", gap:6, padding:"6px 12px", borderBottom:"1px solid rgba(255,255,255,0.07)", flexWrap:"wrap" }}>
          {TELE_TOOLS.map(t => (
            <button key={t.id} onClick={()=>onToolChange(t.id)}
              style={{ ...btn(), width:32, height:32, fontSize:14,
                background: tool===t.id ? "rgba(255,255,255,0.22)" : "rgba(255,255,255,0.06)",
                outline: tool===t.id ? "1px solid rgba(255,255,255,0.45)" : "none",
              }}>{t.icon}</button>
          ))}
          <div style={{width:1,height:22,background:"rgba(255,255,255,0.15)"}} />
          {TELE_COLORS.map(c => (
            <button key={c} onClick={()=>onColorChange(c)}
              style={{ width:20,height:20,border:"none",borderRadius:"50%",background:c,cursor:"pointer",
                outline:color===c?"2px solid #fff":"2px solid transparent", outlineOffset:1 }} />
          ))}
          <div style={{width:1,height:22,background:"rgba(255,255,255,0.15)"}} />
          <button onClick={()=>onStrokesChange(s=>s.slice(0,-1))} disabled={!strokes.length}
            style={{...btn({padding:"4px 9px",fontSize:11,fontWeight:700,opacity:strokes.length?1:0.35})}}>
            ↩ Undo
          </button>
          <button onClick={()=>onStrokesChange([])} disabled={!strokes.length}
            style={{...btn({padding:"4px 9px",fontSize:11,fontWeight:700,opacity:strokes.length?1:0.35,display:"inline-flex",alignItems:"center",gap:4})}}>
            <X size={10} /> Clear
          </button>
        </div>
      )}

      {/* Main controls row — always same layout, never moves */}
      <div style={{ display:"flex", alignItems:"center", padding:"8px 12px", gap:8 }}>
        {/* Play — always far left */}
        <button onClick={togglePlay} style={{...btn({width:36,height:36,display:"inline-flex",alignItems:"center",justifyContent:"center"})}}>
          {playing
            ? <svg width="16" height="16" viewBox="0 0 24 24" fill="white"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>
            : <svg width="16" height="16" viewBox="0 0 24 24" fill="white"><polygon points="5,3 19,12 5,21"/></svg>
          }
        </button>

        <div style={{flex:1}} />

        {/* Draw / Done — hidden in fullscreen; replaced by floating FAB */}
        {!hideDrawToggle && (
          <button onClick={onDrawToggle}
            style={{...btn({padding:"6px 14px",fontSize:12,fontWeight:700,
              background: drawMode ? "#1E3A5F" : "rgba(255,255,255,0.08)",
            })}}>
            {drawMode
              ? <><Check size={12} style={{ marginRight: 4 }} /> Done</>
              : <><Pencil size={12} style={{ marginRight: 4 }} /> Draw</>
            }
          </button>
        )}

        {/* Maximize — always far right */}
        <button onClick={onFullscreenToggle} style={{...btn({width:36,height:36,display:"inline-flex",alignItems:"center",justifyContent:"center"})}}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/>
            <line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/>
          </svg>
        </button>
      </div>
    </div>
  );
}

// ── Share Modal ───────────────────────────────────────────────────────────────
function ShareModal({ film, playlists, onClose }) {
  const [type,       setType]       = useState("film");
  const [playlistId, setPlaylistId] = useState(playlists?.[0]?.id ?? "");
  const [link,       setLink]       = useState("");
  const [copied,     setCopied]     = useState(false);
  const [loading,    setLoading]    = useState(false);
  const [err,        setErr]        = useState("");

  async function generate() {
    setLoading(true); setErr("");
    const body = type === "film"
      ? { filmId: film?.id, type: "film" }
      : { playlistId, type: "cutup" };
    try {
      const r = await fetch("/api/film/share", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const d = await r.json();
      if (d.ok) setLink(`${window.location.origin}/film-share/${d.token}`);
      else setErr(d.error ?? "Failed to generate link");
    } catch { setErr("Network error"); }
    setLoading(false);
  }

  function copy() {
    navigator.clipboard?.writeText(link);
    setCopied(true); setTimeout(() => setCopied(false), 2500);
  }

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(0,0,0,0.55)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ background: DS.cardBg, borderRadius: 18, padding: "24px 24px 22px", maxWidth: 440, width: "100%", boxShadow: "0 24px 60px rgba(0,0,0,0.18)" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Share2 size={18} color={DS.brand} />
            <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: DS.bodyText }}>Share Film</h2>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: DS.dimText, display: "flex", alignItems: "center" }}><X size={16} /></button>
        </div>

        {/* Type selector */}
        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          {[{id:"film",label:"Full Film"},{id:"cutup",label:"Cut-up"}].map(opt => (
            <button key={opt.id} onClick={() => { setType(opt.id); setLink(""); }}
              disabled={opt.id === "cutup" && !playlists?.length}
              style={{
                flex: 1, padding: "9px 0", borderRadius: 9,
                border: `1px solid ${type === opt.id ? DS.brand : DS.border}`,
                background: type === opt.id ? DS.brandBg : "none",
                color: type === opt.id ? DS.brand : DS.labelText,
                fontWeight: 700, fontSize: 13, cursor: "pointer",
                opacity: opt.id === "cutup" && !playlists?.length ? 0.4 : 1,
              }}>
              {opt.label}
            </button>
          ))}
        </div>

        {type === "cutup" && (playlists ?? []).length > 0 && (
          <select value={playlistId} onChange={e => { setPlaylistId(e.target.value); setLink(""); }}
            style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: `1px solid ${DS.border}`, fontSize: 13, marginBottom: 14, color: DS.bodyText, background: DS.pageBg, outline: "none" }}>
            {(playlists ?? []).map(p => (
              <option key={p.id} value={p.id}>{p.name} · {(p.items ?? []).length} plays</option>
            ))}
          </select>
        )}

        {err && <p style={{ margin: "0 0 12px", fontSize: 12, color: DS.warn }}>{err}</p>}

        {!link ? (
          <button onClick={generate} disabled={loading || (type === "cutup" && !playlistId)}
            style={{ width: "100%", padding: "12px 0", borderRadius: 10, background: DS.brand, color: "#fff", border: "none", fontSize: 14, fontWeight: 800, cursor: "pointer" }}>
            {loading ? "Generating…" : "Generate Link"}
          </button>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ display: "flex", gap: 8 }}>
              <input readOnly value={link} onClick={e => e.target.select()}
                style={{ flex: 1, padding: "9px 12px", borderRadius: 8, border: `1px solid ${DS.border}`, fontSize: 12, background: DS.pageBg, color: DS.labelText, outline: "none" }} />
              <button onClick={copy}
                style={{ padding: "9px 16px", borderRadius: 8, background: copied ? DS.safe : DS.brand, color: "#fff", border: "none", fontWeight: 800, cursor: "pointer", fontSize: 12, whiteSpace: "nowrap", transition: "background 0.2s" }}>
                {copied ? "✓ Copied!" : "Copy"}
              </button>
            </div>
            <p style={{ margin: 0, fontSize: 11, color: DS.dimText, textAlign: "center" }}>
              Anyone with this link can view — no login required.
            </p>
            <button onClick={() => setLink("")}
              style={{ background: "none", border: `1px solid ${DS.border}`, borderRadius: 8, padding: "8px 0", color: DS.labelText, fontSize: 12, cursor: "pointer" }}>
              Generate different link
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Exchange Modal ────────────────────────────────────────────────────────────
function ExchangeModal({ film, onClose, onSent }) {
  const [email,       setEmail]       = useState("");
  const [message,     setMessage]     = useState("");
  const [loading,     setLoading]     = useState(false);
  const [err,         setErr]         = useState("");
  const [sent,        setSent]        = useState(null);
  const [library,     setLibrary]     = useState(null);
  const [selectedIds, setSelectedIds] = useState(() => film?.id ? [film.id] : []);
  const [showPicker,  setShowPicker]  = useState(false);
  const [sharePlays,  setSharePlays]  = useState(false);
  const [isMobile,    setIsMobile]    = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 600);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  useEffect(() => {
    fetch("/api/film/list?limit=50", { credentials: "include" })
      .then(r => r.json())
      .then(d => setLibrary(d.ok ? (d.films ?? []) : []))
      .catch(() => setLibrary([]));
  }, []);

  const filmTitle = film?.title || (film?.opponent ? `vs ${film.opponent}` : "Game Film");
  const playCount = film?.play_count ?? 0;

  function toggleId(id) {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }

  async function send() {
    if (!email.includes("@")) { setErr("Enter a valid email address"); return; }
    setLoading(true); setErr("");
    try {
      const r = await fetch("/api/film/exchange", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filmIds: selectedIds, receivingEmail: email.trim().toLowerCase(), message: message.trim(), sharePlays }),
      });
      const d = await r.json();
      if (!d.ok) { setErr(d.error ?? "Failed to send request"); setLoading(false); return; }
      setSent({ inSystem: d.inSystem, receivingOrgName: d.receivingOrgName, count: d.exchangeCount });
      onSent?.();
    } catch { setErr("Network error — please try again"); }
    setLoading(false);
  }

  const otherFilms    = (library ?? []).filter(f => f.id !== film?.id && f.status !== "uploading");
  const extraSelected = selectedIds.filter(id => id !== film?.id);
  const canSend       = !!email && !loading;

  // Mobile: full-screen bottom sheet; desktop: centered card
  const overlay = isMobile
    ? { alignItems: "flex-end", padding: 0 }
    : { alignItems: "center", padding: 16 };
  const card = isMobile
    ? { borderRadius: "20px 20px 0 0", maxWidth: "100%", maxHeight: "94vh" }
    : { borderRadius: 20, maxWidth: 488, maxHeight: "92vh" };

  return (
    <div
      style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(0,0,0,0.55)", display: "flex", justifyContent: "center", ...overlay }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{ background: DS.cardBg, width: "100%", boxShadow: "0 32px 80px rgba(0,0,0,0.25)", display: "flex", flexDirection: "column", ...card }}>

        {/* Drag handle on mobile */}
        {isMobile && (
          <div style={{ width: 36, height: 4, borderRadius: 2, background: DS.border, margin: "12px auto 0", flexShrink: 0 }} />
        )}

        {/* Header */}
        <div style={{ padding: isMobile ? "14px 20px 12px" : "20px 24px 14px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: `1px solid ${DS.border}`, flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <ArrowLeftRight size={16} color={DS.brand} />
            <h2 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: DS.bodyText }}>Exchange Film</h2>
          </div>
          <button
            onClick={onClose}
            style={{ width: 30, height: 30, borderRadius: 15, background: DS.brandBg, border: "none", cursor: "pointer", color: DS.labelText, fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}
          >
            ✕
          </button>
        </div>

        {/* Scrollable body */}
        <div style={{ padding: isMobile ? "16px 20px" : "20px 24px", overflowY: "auto", flex: 1 }}>
          {sent ? (
            /* ── Sent ── */
            <div style={{ textAlign: "center", padding: "24px 0 12px" }}>
              <div style={{
                width: 64, height: 64, borderRadius: 32,
                background: "rgba(52,199,89,0.12)", border: "1.5px solid rgba(52,199,89,0.25)",
                display: "flex", alignItems: "center", justifyContent: "center",
                margin: "0 auto 16px",
                boxShadow: "0 6px 24px rgba(52,199,89,0.15)",
              }}>
                <CheckCircle size={30} color="#34C759" />
              </div>
              <h3 style={{ margin: "0 0 8px", fontSize: 19, fontWeight: 800, color: DS.bodyText }}>
                {sent.count > 1 ? `${sent.count} Films Sent` : "Request Sent"}
              </h3>
              <p style={{ margin: "0 0 10px", fontSize: 14, color: DS.labelText, lineHeight: 1.65 }}>
                {sent.receivingOrgName
                  ? <><strong style={{ color: DS.bodyText }}>{sent.receivingOrgName}</strong> is on CheckPeak and will be notified.</>
                  : <>Email sent to <strong style={{ color: DS.bodyText }}>{email}</strong> with {sent.count > 1 ? `${sent.count} secure film links` : "a link to view your film"}.</>
                }
              </p>
              <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: DS.brandBg, border: `1px solid ${DS.brandBorder}`, borderRadius: 20, padding: "5px 14px", marginBottom: 24 }}>
                <Clock size={11} color={DS.brand} />
                <span style={{ fontSize: 11, color: DS.brand, fontWeight: 700 }}>Pending their response</span>
              </div>
              <div>
                <button
                  onClick={onClose}
                  style={{ background: DS.brand, color: "#fff", border: "none", borderRadius: 11, padding: "12px 36px", fontSize: 14, fontWeight: 800, cursor: "pointer" }}
                >
                  Done
                </button>
              </div>
            </div>
          ) : (
            /* ── Form ── */
            <>
              {/* You're offering */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                  <span style={{ fontSize: 10, fontWeight: 800, color: DS.brand, textTransform: "uppercase", letterSpacing: "0.1em" }}>You're offering</span>
                  {selectedIds.length > 1 && (
                    <span style={{ background: DS.brandBg, color: DS.brand, borderRadius: 10, padding: "2px 9px", fontSize: 11, fontWeight: 700, border: `1px solid ${DS.brandBorder}` }}>
                      {selectedIds.length} films
                    </span>
                  )}
                </div>

                {/* Primary film */}
                <div style={{ background: DS.brandBg, borderRadius: 10, padding: "12px 14px", border: `1px solid ${DS.brandBorder}`, marginBottom: 6 }}>
                  <div style={{ fontSize: 14, fontWeight: 800, color: DS.bodyText }}>{filmTitle}</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 3, flexWrap: "wrap" }}>
                    {film?.game_date && (
                      <span style={{ fontSize: 11, color: DS.labelText }}>
                        {new Date(film.game_date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                      </span>
                    )}
                    {playCount > 0 && <span style={{ fontSize: 11, color: DS.brand, fontWeight: 700 }}>{playCount} plays</span>}
                  </div>
                </div>

                {/* Extra selected films */}
                {extraSelected.map(id => {
                  const f = otherFilms.find(x => x.id === id);
                  if (!f) return null;
                  const ft = f.title || (f.opponent ? `vs ${f.opponent}` : "Game Film");
                  return (
                    <div key={id} style={{ display: "flex", alignItems: "center", gap: 10, background: DS.brandBg, borderRadius: 10, padding: "10px 14px", border: `1px solid ${DS.brandBorder}`, marginBottom: 6 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: DS.bodyText, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{ft}</div>
                        {f.game_date && <div style={{ fontSize: 11, color: DS.labelText, marginTop: 2 }}>{new Date(f.game_date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</div>}
                      </div>
                      {f.play_count > 0 && <span style={{ fontSize: 11, color: DS.brand, fontWeight: 700, flexShrink: 0 }}>{f.play_count} plays</span>}
                      <button
                        onClick={() => toggleId(id)}
                        style={{ width: 28, height: 28, borderRadius: 14, background: DS.border, border: "none", cursor: "pointer", color: DS.labelText, fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}
                      >
                        ✕
                      </button>
                    </div>
                  );
                })}

                {/* Add more */}
                <button
                  onClick={() => setShowPicker(p => !p)}
                  style={{
                    width: "100%", padding: "9px 14px", marginTop: 2, borderRadius: 9,
                    border: `1.5px dashed ${DS.border}`, background: "none", cursor: "pointer",
                    color: DS.labelText, fontSize: 12, fontWeight: 700,
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                    transition: "border-color 0.15s",
                  }}
                >
                  {showPicker ? "▲ Hide library" : "＋ Add more film from library"}
                </button>

                {/* Film picker */}
                {showPicker && (
                  <div style={{ marginTop: 6, border: `1px solid ${DS.border}`, borderRadius: 10, overflow: "hidden", maxHeight: 230, overflowY: "auto" }}>
                    {library === null ? (
                      <div style={{ padding: "18px", fontSize: 12, color: DS.dimText, textAlign: "center" }}>Loading your library…</div>
                    ) : otherFilms.length === 0 ? (
                      <div style={{ padding: "18px", fontSize: 12, color: DS.dimText, textAlign: "center" }}>No other ready films in your library</div>
                    ) : otherFilms.map((f, i) => {
                      const ft      = f.title || (f.opponent ? `vs ${f.opponent}` : "Game Film");
                      const checked = selectedIds.includes(f.id);
                      return (
                        <div
                          key={f.id}
                          onClick={() => toggleId(f.id)}
                          style={{
                            display: "flex", alignItems: "center", gap: 12,
                            padding: isMobile ? "13px 14px" : "10px 14px",
                            cursor: "pointer", borderTop: i > 0 ? `1px solid ${DS.border}` : "none",
                            background: checked ? DS.brandBg : "transparent", transition: "background 0.1s",
                          }}
                        >
                          <div style={{
                            width: 18, height: 18, borderRadius: 5, flexShrink: 0,
                            border: `2px solid ${checked ? DS.brand : DS.border}`,
                            background: checked ? DS.brand : "transparent",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            transition: "all 0.15s",
                          }}>
                            {checked && <span style={{ color: "#fff", fontSize: 10, fontWeight: 900, lineHeight: 1 }}>✓</span>}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: 700, color: DS.bodyText, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{ft}</div>
                            <div style={{ fontSize: 11, color: DS.labelText, marginTop: 1 }}>
                              {f.game_date && new Date(f.game_date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                              {f.play_count > 0 && <span style={{ marginLeft: 8, color: DS.brand, fontWeight: 700 }}>{f.play_count} plays</span>}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Play breakdowns toggle */}
              <div
                style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, padding: "12px 14px", background: "#f8fafc", borderRadius: 10, border: `1px solid ${DS.border}`, marginBottom: 16, cursor: "pointer" }}
                onClick={() => setSharePlays(p => !p)}
              >
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: DS.bodyText }}>Share play breakdowns</div>
                  <div style={{ fontSize: 11, color: DS.labelText, marginTop: 2, lineHeight: 1.4 }}>
                    {sharePlays
                      ? "Opponent sees run/pass splits & tendencies"
                      : "Film only — play analytics stay private"}
                  </div>
                </div>
                <div
                  style={{
                    width: 48, height: 28, borderRadius: 14, border: "none", flexShrink: 0,
                    background: sharePlays ? DS.brand : "#CBD5E1", position: "relative", transition: "background 0.2s",
                  }}
                >
                  <div style={{
                    width: 22, height: 22, borderRadius: 11, background: "#fff",
                    position: "absolute", top: 3, left: sharePlays ? 23 : 3,
                    transition: "left 0.2s", boxShadow: "0 1px 4px rgba(0,0,0,0.18)",
                  }} />
                </div>
              </div>

              {/* Email */}
              <div style={{ marginBottom: 13 }}>
                <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: DS.labelText, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 6 }}>
                  Opposing Coach's Email
                </label>
                <input
                  type="email" value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="coach@school.edu"
                  style={{ width: "100%", boxSizing: "border-box", background: "#f8fafc", border: `1.5px solid ${DS.border}`, borderRadius: 10, padding: "12px 14px", fontSize: 14, color: DS.bodyText, outline: "none", transition: "border-color 0.15s" }}
                  onKeyDown={e => e.key === "Enter" && canSend && send()}
                />
              </div>

              {/* Message */}
              <div style={{ marginBottom: 18 }}>
                <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: DS.labelText, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 6 }}>
                  Message <span style={{ color: DS.dimText, fontWeight: 500, textTransform: "none" }}>(optional)</span>
                </label>
                <textarea
                  value={message} onChange={e => setMessage(e.target.value)}
                  placeholder="Hey Coach — here's our film. Looking forward to the game!"
                  rows={3}
                  style={{ width: "100%", boxSizing: "border-box", background: "#f8fafc", border: `1.5px solid ${DS.border}`, borderRadius: 10, padding: "11px 14px", fontSize: 13, color: DS.bodyText, outline: "none", resize: "vertical", fontFamily: "inherit", lineHeight: 1.5, transition: "border-color 0.15s" }}
                />
              </div>

              {err && (
                <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 9, padding: "9px 12px", marginBottom: 14, fontSize: 13, color: "#EF4444", display: "flex", alignItems: "center", gap: 7 }}>
                  <span style={{ flexShrink: 0 }}>⚠</span>{err}
                </div>
              )}

              <button
                onClick={send} disabled={!canSend}
                style={{ width: "100%", padding: "14px 0", borderRadius: 12, border: "none", cursor: canSend ? "pointer" : "not-allowed", background: email ? DS.brand : DS.border, color: email ? "#fff" : DS.dimText, fontSize: 14, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, opacity: loading ? 0.75 : 1, transition: "all 0.2s", boxShadow: email ? "0 6px 20px rgba(30,58,95,0.2)" : "none" }}>
                {loading ? "Sending…" : <><Send size={14} />{selectedIds.length > 1 ? ` Send ${selectedIds.length} Films` : " Send Exchange Request"}</>}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Tendency Report ───────────────────────────────────────────────────────────
function TendencyReport({ plays, analytics }) {
  const data = useMemo(() => {
    const byType = {}, byDown = {}, byFormation = {}, byPersonnel = {}, byDirection = {}, byHash = {};
    const ZONES = [
      { key:"own_end_zone", label:"Own 1–19",   min:1,  max:19  },
      { key:"own_20",       label:"Own 20–39",  min:20, max:39  },
      { key:"midfield",     label:"Midfield",   min:40, max:59  },
      { key:"opp_40",       label:"Opp 40–20",  min:60, max:79  },
      { key:"red_zone",     label:"Red Zone",   min:80, max:99  },
    ];
    const byZone = Object.fromEntries(ZONES.map(z => [z.key, { ...z, att:0, suc:0, yds:0, run:0, pass:0 }]));

    for (const p of plays) {
      const ok = ["success","td"].includes(String(p.result || "").toLowerCase());
      const yd = p.yards_gained != null ? Number(p.yards_gained) : null;
      const pt = p.play_type || "other";

      if (!byType[pt]) byType[pt] = { att:0, suc:0, yds:0, ydN:0 };
      byType[pt].att++; if (ok) byType[pt].suc++;
      if (yd != null) { byType[pt].yds += yd; byType[pt].ydN++; }

      if (p.down) {
        if (!byDown[p.down]) byDown[p.down] = { att:0, suc:0, run:0, pass:0 };
        byDown[p.down].att++; if (ok) byDown[p.down].suc++;
        if (pt === "run")  byDown[p.down].run++;
        if (pt === "pass") byDown[p.down].pass++;
      }

      if (p.formation) {
        if (!byFormation[p.formation]) byFormation[p.formation] = { att:0, suc:0, yds:0, ydN:0 };
        byFormation[p.formation].att++; if (ok) byFormation[p.formation].suc++;
        if (yd != null) { byFormation[p.formation].yds += yd; byFormation[p.formation].ydN++; }
      }

      if (p.personnel) {
        if (!byPersonnel[p.personnel]) byPersonnel[p.personnel] = { att:0, suc:0, run:0, pass:0 };
        byPersonnel[p.personnel].att++; if (ok) byPersonnel[p.personnel].suc++;
        if (pt === "run")  byPersonnel[p.personnel].run++;
        if (pt === "pass") byPersonnel[p.personnel].pass++;
      }

      if (p.play_direction) {
        if (!byDirection[p.play_direction]) byDirection[p.play_direction] = { att:0, suc:0, yds:0, ydN:0 };
        byDirection[p.play_direction].att++; if (ok) byDirection[p.play_direction].suc++;
        if (yd != null) { byDirection[p.play_direction].yds += yd; byDirection[p.play_direction].ydN++; }
      }

      if (p.hash) {
        if (!byHash[p.hash]) byHash[p.hash] = { att:0, suc:0, run:0, pass:0 };
        byHash[p.hash].att++; if (ok) byHash[p.hash].suc++;
        if (pt === "run")  byHash[p.hash].run++;
        if (pt === "pass") byHash[p.hash].pass++;
      }

      if (p.yard_line != null) {
        const z = ZONES.find(z => p.yard_line >= z.min && p.yard_line <= z.max);
        if (z) {
          byZone[z.key].att++; if (ok) byZone[z.key].suc++;
          if (yd != null) byZone[z.key].yds += yd;
          if (pt === "run")  byZone[z.key].run++;
          if (pt === "pass") byZone[z.key].pass++;
        }
      }
    }
    const zones = ZONES.map(z => byZone[z.key]).filter(z => z.att > 0);
    return { byType, byDown, byFormation, byPersonnel, byDirection, byHash, zones };
  }, [plays]);

  const total = plays.length;

  function Bar({ label, att, suc, avgYd, subLabel }) {
    const pct = att > 0 ? Math.round(suc / att * 100) : 0;
    const col = pct >= 60 ? DS.safe : pct >= 40 ? DS.caution : DS.warn;
    const usePct = att > 0 ? Math.round(att / total * 100) : 0;
    return (
      <div style={{ marginBottom: 13 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4, alignItems: "center" }}>
          <div>
            <span style={{ fontSize: 13, fontWeight: 600, color: DS.bodyText }}>{label}</span>
            {subLabel && <span style={{ fontSize: 10, color: DS.dimText, marginLeft: 6 }}>{subLabel}</span>}
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            {avgYd != null && <span style={{ fontSize: 10, color: DS.dimText }}>{Number(avgYd).toFixed(1)} yd avg</span>}
            <span style={{ fontSize: 10, color: DS.dimText }}>{usePct}% of plays</span>
            <span style={{ fontSize: 13, fontWeight: 800, color: col, minWidth: 36, textAlign: "right" }}>{pct}%</span>
          </div>
        </div>
        <div style={{ height: 7, background: DS.border, borderRadius: 99, overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${pct}%`, background: col, borderRadius: 99, transition: "width 0.6s ease" }} />
        </div>
      </div>
    );
  }

  function SH({ children, sub }) {
    return (
      <div style={{ marginBottom: 14 }}>
        <h3 style={{ margin: 0, fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em", color: DS.labelText }}>{children}</h3>
        {sub && <p style={{ margin: "2px 0 0", fontSize: 10, color: DS.dimText }}>{sub}</p>}
      </div>
    );
  }

  function Insight({ text }) {
    return (
      <div style={{ background: DS.brandBg, border: `1px solid ${DS.brandBorder}`, borderRadius: 8, padding: "8px 12px", marginTop: 10 }}>
        <p style={{ margin: 0, fontSize: 11, color: DS.brand, fontWeight: 600, lineHeight: 1.5, display: "flex", alignItems: "flex-start", gap: 6 }}>
          <Sparkles size={11} style={{ flexShrink: 0, marginTop: 1 }} /> {text}
        </p>
      </div>
    );
  }

  const downSuffix = n => ["st","nd","rd","th"][Math.min(Number(n) - 1, 3)] ?? "th";
  const PERS_LABELS = { "10":"1 RB · 0 TE","11":"1 RB · 1 TE","12":"1 RB · 2 TE","21":"2 RB · 1 TE","22":"2 RB · 2 TE" };
  const HASH_LABELS = { left_wide:"Left Wide", left_hash:"Left Hash", middle:"Middle", right_hash:"Right Hash", right_wide:"Right Wide" };

  // Insight generators
  const typeEntries = Object.entries(data.byType).sort((a,b) => b[1].att - a[1].att);
  const runPct = total > 0 ? Math.round((data.byType.run?.att ?? 0) / total * 100) : null;
  const pass3rd = data.byDown["3"];
  const topHash = Object.entries(data.byHash).sort((a,b) => b[1].att - a[1].att)[0];
  const topDir  = Object.entries(data.byDirection).sort((a,b) => b[1].att - a[1].att)[0];
  const topPers = Object.entries(data.byPersonnel).sort((a,b) => b[1].att - a[1].att)[0];
  const dirEntries = ["left","middle","right"].map(d => [d, data.byDirection[d] ?? {att:0,suc:0,yds:0,ydN:0}]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

      {/* Row 1: Type + Down */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <div style={{ background: DS.cardBg, border: `1px solid ${DS.border}`, borderRadius: 12, padding: "18px 18px" }}>
          <SH sub="success rate per play type">By Play Type</SH>
          {typeEntries.map(([t, d]) => (
            <Bar key={t} label={cap(t)} att={d.att} suc={d.suc} avgYd={d.ydN > 0 ? d.yds / d.ydN : null} />
          ))}
          {runPct != null && runPct >= 60 && (
            <Insight text={`Heavy run team — ${runPct}% runs. Opponents will stack the box. Consider shifting to play-action.`} />
          )}
          {runPct != null && runPct <= 30 && (
            <Insight text={`Pass-heavy offense — ${100-runPct}% passes. Balance the attack to keep defenses honest.`} />
          )}
        </div>

        <div style={{ background: DS.cardBg, border: `1px solid ${DS.border}`, borderRadius: 12, padding: "18px 18px" }}>
          <SH sub="conversion rate by down">By Down</SH>
          {Object.entries(data.byDown).sort((a,b) => Number(a[0]) - Number(b[0])).map(([dn, d]) => {
            const runPctDown = d.att > 0 ? Math.round(d.run / d.att * 100) : 0;
            return (
              <Bar key={dn}
                label={`${dn}${downSuffix(dn)} Down`}
                att={d.att} suc={d.suc}
                subLabel={d.run > 0 || d.pass > 0 ? `${runPctDown}% run` : undefined}
              />
            );
          })}
          {pass3rd && pass3rd.att >= 3 && (
            <Insight text={`${Math.round(pass3rd.pass / pass3rd.att * 100)}% pass on 3rd down (${pass3rd.att} plays). ${Math.round(pass3rd.suc / pass3rd.att * 100)}% conversion rate.`} />
          )}
        </div>
      </div>

      {/* Play Direction (only if tagged) */}
      {dirEntries.some(([,d]) => d.att > 0) && (
        <div style={{ background: DS.cardBg, border: `1px solid ${DS.border}`, borderRadius: 12, padding: "18px 18px" }}>
          <SH sub="where plays are run / thrown">Play Direction</SH>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 12 }}>
            {dirEntries.map(([dir, d]) => {
              const pct    = total > 0 ? Math.round(d.att / total * 100) : 0;
              const sucPct = d.att > 0 ? Math.round(d.suc / d.att * 100) : 0;
              const avg    = d.ydN > 0 ? (d.yds / d.ydN).toFixed(1) : null;
              const col    = sucPct >= 60 ? DS.safe : sucPct >= 40 ? DS.caution : DS.warn;
              const icons  = { left:"←", middle:"↑", right:"→" };
              return (
                <div key={dir} style={{ background: DS.pageBg, border: `1px solid ${DS.border}`, borderRadius: 10, padding: "16px 12px", textAlign: "center" }}>
                  <p style={{ margin: "0 0 4px", fontSize: 22, color: DS.dimText }}>{icons[dir]}</p>
                  <p style={{ margin: "0 0 2px", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: DS.labelText }}>{dir}</p>
                  <p style={{ margin: "0 0 2px", fontSize: 28, fontWeight: 900, color: DS.bodyText, lineHeight: 1.1 }}>{pct}%</p>
                  <p style={{ margin: "0 0 8px", fontSize: 10, color: DS.dimText }}>{d.att} plays</p>
                  <div style={{ height: 4, background: DS.border, borderRadius: 99, overflow: "hidden", marginBottom: 6 }}>
                    <div style={{ height: "100%", width: `${sucPct}%`, background: col, borderRadius: 99 }} />
                  </div>
                  <p style={{ margin: "0 0 2px", fontSize: 12, fontWeight: 800, color: col }}>{sucPct}% success</p>
                  {avg && <p style={{ margin: 0, fontSize: 10, color: DS.dimText }}>{avg} avg yd</p>}
                </div>
              );
            })}
          </div>
          {topDir && data.byDirection[topDir[0]]?.att >= 4 && (
            <Insight text={`${cap(topDir[0])} is your most-used direction (${Math.round(topDir[1].att/total*100)}%). Scouting reports will identify this. Consider mixing in counters and misdirection.`} />
          )}
        </div>
      )}

      {/* Personnel (only if tagged) */}
      {Object.keys(data.byPersonnel).length > 0 && (
        <div style={{ background: DS.cardBg, border: `1px solid ${DS.border}`, borderRadius: 12, padding: "18px 18px" }}>
          <SH sub="offensive personnel groupings">Personnel Groupings</SH>
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 12 }}>
            {Object.entries(data.byPersonnel).sort((a,b) => b[1].att - a[1].att).map(([g, d]) => {
              const pct    = total > 0 ? Math.round(d.att / total * 100) : 0;
              const sucPct = d.att > 0 ? Math.round(d.suc / d.att * 100) : 0;
              const runP   = d.att > 0 ? Math.round(d.run / d.att * 100) : 0;
              const col    = sucPct >= 60 ? DS.safe : sucPct >= 40 ? DS.caution : DS.warn;
              return (
                <div key={g} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ width: 44, height: 44, borderRadius: 10, background: DS.brandBg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <span style={{ fontSize: 17, fontWeight: 900, color: DS.brand }}>{g}</span>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 3 }}>
                      <div>
                        <span style={{ fontSize: 13, fontWeight: 700, color: DS.bodyText }}>{PERS_LABELS[g] ?? `${g} personnel`}</span>
                        <span style={{ fontSize: 10, color: DS.dimText, marginLeft: 8 }}>{runP}% run · {pct}% of plays</span>
                      </div>
                      <span style={{ fontSize: 13, fontWeight: 800, color: col }}>{sucPct}% success</span>
                    </div>
                    <div style={{ height: 5, background: DS.border, borderRadius: 99, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${pct}%`, background: DS.brand, borderRadius: 99 }} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          {topPers && topPers[1].att >= 4 && (
            <Insight text={`${topPers[0]} personnel is your base grouping (${Math.round(topPers[1].att/total*100)}% of plays). Opponents will scheme specifically to stop ${PERS_LABELS[topPers[0]] ?? topPers[0]}.`} />
          )}
        </div>
      )}

      {/* Hash tendency (only if tagged) */}
      {Object.keys(data.byHash).length > 0 && (
        <div style={{ background: DS.cardBg, border: `1px solid ${DS.border}`, borderRadius: 12, padding: "18px 18px" }}>
          <SH sub="success rate by field hash">Hash Tendency</SH>
          <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
            {["left_wide","left_hash","middle","right_hash","right_wide"].filter(h => data.byHash[h]).map(h => {
              const d   = data.byHash[h];
              const pct = total > 0 ? Math.round(d.att / total * 100) : 0;
              const suc = d.att > 0 ? Math.round(d.suc / d.att * 100) : 0;
              const col = suc >= 60 ? DS.safe : suc >= 40 ? DS.caution : DS.warn;
              return (
                <div key={h} style={{ flex: 1, background: DS.pageBg, border: `1px solid ${DS.border}`, borderRadius: 10, padding: "12px 10px", textAlign: "center" }}>
                  <p style={{ margin: "0 0 2px", fontSize: 10, fontWeight: 700, color: DS.labelText }}>{HASH_LABELS[h]}</p>
                  <p style={{ margin: "0 0 2px", fontSize: 22, fontWeight: 900, color: DS.bodyText, lineHeight: 1.1 }}>{pct}%</p>
                  <p style={{ margin: "0 0 6px", fontSize: 9, color: DS.dimText }}>{d.att} plays</p>
                  <p style={{ margin: 0, fontSize: 11, fontWeight: 800, color: col }}>{suc}%</p>
                  <p style={{ margin: 0, fontSize: 9, color: DS.dimText }}>success</p>
                </div>
              );
            })}
          </div>
          {topHash && topHash[1].att >= 4 && (
            <Insight text={`${Math.round(topHash[1].att/total*100)}% of plays from ${HASH_LABELS[topHash[0]] ?? topHash[0]}. Hash position reveals where you prefer to operate — opponents may over-shift.`} />
          )}
        </div>
      )}

      {/* Formation */}
      {Object.keys(data.byFormation).length > 0 && (
        <div style={{ background: DS.cardBg, border: `1px solid ${DS.border}`, borderRadius: 12, padding: "18px 18px" }}>
          <SH sub="success rate and average yards per formation">By Formation</SH>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 24px" }}>
            {Object.entries(data.byFormation).sort((a,b) => b[1].att - a[1].att).map(([f, d]) => (
              <Bar key={f} label={cap(f)} att={d.att} suc={d.suc} avgYd={d.ydN > 0 ? d.yds / d.ydN : null} />
            ))}
          </div>
        </div>
      )}

      {/* Field Zone (only if yard_line is tagged) */}
      {data.zones.length > 0 && (
        <div style={{ background: DS.cardBg, border: `1px solid ${DS.border}`, borderRadius: 12, padding: "18px 18px" }}>
          <SH sub="play calling and efficiency by field position">Field Zone Analysis</SH>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {data.zones.map(z => {
              const suc  = z.att > 0 ? Math.round(z.suc / z.att * 100) : 0;
              const col  = suc >= 60 ? DS.safe : suc >= 40 ? DS.caution : DS.warn;
              const runP = z.att > 0 ? Math.round(z.run / z.att * 100) : 0;
              const avg  = z.att > 0 && (z.yds !== 0) ? (z.yds / z.att).toFixed(1) : null;
              return (
                <div key={z.key} style={{ display: "flex", alignItems: "center", gap: 14, padding: "12px 14px", background: DS.pageBg, border: `1px solid ${DS.border}`, borderRadius: 10 }}>
                  <div style={{ width: 80, flexShrink: 0 }}>
                    <p style={{ margin: "0 0 1px", fontSize: 11, fontWeight: 700, color: DS.bodyText }}>{z.label}</p>
                    <p style={{ margin: 0, fontSize: 9, color: DS.dimText }}>{z.att} plays</p>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", gap: 2, marginBottom: 4 }}>
                      <div style={{ height: 8, width: `${runP}%`, background: TYPE_COLOR.run, borderRadius: "4px 0 0 4px" }} title={`${runP}% run`} />
                      <div style={{ height: 8, width: `${100-runP}%`, background: TYPE_COLOR.pass, borderRadius: "0 4px 4px 0" }} title={`${100-runP}% pass`} />
                    </div>
                    <p style={{ margin: 0, fontSize: 9, color: DS.dimText }}>{runP}% run · {100-runP}% pass{avg ? ` · ${avg} avg yd` : ""}</p>
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <p style={{ margin: "0 0 1px", fontSize: 20, fontWeight: 900, color: col, lineHeight: 1 }}>{suc}%</p>
                    <p style={{ margin: 0, fontSize: 9, color: DS.dimText }}>success</p>
                  </div>
                </div>
              );
            })}
          </div>
          {data.zones.find(z => z.key === "red_zone" && z.att >= 3) && (() => {
            const rz = data.zones.find(z => z.key === "red_zone");
            const rzSuc = Math.round(rz.suc / rz.att * 100);
            return <Insight text={`Red zone efficiency: ${rzSuc}%${rzSuc < 50 ? " — below 50% means scoring drives stall at the 20. Review red zone play calls." : " — strong red zone performance."}`} />;
          })()}
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

// ── Pipeline status bar ───────────────────────────────────────────────────────
function PStep({ done, active, n, label }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
      <div style={{
        width: 22, height: 22, borderRadius: "50%",
        background: done ? DS.safe : active ? DS.brand : DS.border,
        color: (done || active) ? "#fff" : DS.dimText,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 11, fontWeight: 800, flexShrink: 0,
      }}>{done ? "✓" : n}</div>
      <span style={{ fontSize: 12, fontWeight: (done || active) ? 700 : 500, color: done ? DS.safe : active ? DS.brand : DS.dimText }}>
        {label}
      </span>
    </div>
  );
}
function PConn({ active }) {
  return <div style={{ width: 20, height: 2, margin: "0 4px", flexShrink: 0, background: active ? DS.safeBorder : DS.border, borderRadius: 1 }} />;
}
function PipelineStatusBar({ film, plays }) {
  if (film?.status !== "uploading") return null;
  return (
    <div style={{ background: DS.brandBg, borderBottom: `1px solid ${DS.brandBorder}`, padding: "9px 20px" }}>
      <div style={{ maxWidth: 1280, margin: "0 auto", display: "flex", alignItems: "center", gap: 10 }}>
        <Loader2 size={13} color={DS.brand} style={{ animation: "spin 1s linear infinite" }} />
        <span style={{ fontSize: 12, fontWeight: 600, color: DS.brand }}>Uploading video — you can tag plays once it&apos;s ready.</span>
      </div>
    </div>
  );
}

// ── Camera Calibration Wizard ─────────────────────────────────────────────────
// Coaches mark 4 known field points on a video thumbnail.
// Client computes the homography matrix (pixel → yards) and saves it.

const FIELD_Y = [
  { label: "Left sideline",           y: 0     },
  { label: "Left hash (High School)", y: 17.8  },
  { label: "Left hash (College/NFL)", y: 20    },
  { label: "Center of field",         y: 26.65 },
  { label: "Right hash (College/NFL)",y: 33.33 },
  { label: "Right hash (High School)",y: 35.53 },
  { label: "Right sideline",          y: 53.33 },
];
const YARD_LINES = [0,5,10,15,20,25,30,35,40,45,50,55,60,65,70,75,80,85,90,95,100];

const STEP_LABELS = [
  "Click on point 1 in the video frame",
  "Click on point 2 in the video frame",
  "Click on point 3 in the video frame",
  "Click on point 4 in the video frame",
];

function gaussianElimination(A, b) {
  const n = b.length;
  const M = A.map((row, i) => [...row, b[i]]);
  for (let col = 0; col < n; col++) {
    let maxRow = col;
    for (let row = col + 1; row < n; row++) {
      if (Math.abs(M[row][col]) > Math.abs(M[maxRow][col])) maxRow = row;
    }
    [M[col], M[maxRow]] = [M[maxRow], M[col]];
    if (Math.abs(M[col][col]) < 1e-10) return null;
    for (let row = col + 1; row < n; row++) {
      const f = M[row][col] / M[col][col];
      for (let j = col; j <= n; j++) M[row][j] -= f * M[col][j];
    }
  }
  const x = new Array(n).fill(0);
  for (let row = n - 1; row >= 0; row--) {
    x[row] = M[row][n];
    for (let col = row + 1; col < n; col++) x[row] -= M[row][col] * x[col];
    x[row] /= M[row][row];
  }
  return x;
}

function computeHomography(srcPts, dstPts) {
  // srcPts: pixel [x,y], dstPts: field yards [X,Y] — 4 pairs
  const Ab = [];
  const b  = [];
  for (let i = 0; i < 4; i++) {
    const [x, y] = srcPts[i];
    const [X, Y] = dstPts[i];
    Ab.push([x, y, 1, 0, 0, 0, -X*x, -X*y]);
    b.push(X);
    Ab.push([0, 0, 0, x, y, 1, -Y*x, -Y*y]);
    b.push(Y);
  }
  const h = gaussianElimination(Ab, b);
  if (!h) return null;
  return [...h, 1]; // 9 elements, h[8]=1
}

function CalibrationWizard({ filmId, playbackId, durationSecs, onClose, onCalibrated }) {
  const thumbTimestamp    = Math.round(Math.min(durationSecs * 0.25, 30));
  const thumbWidth        = 720;
  const thumbHeight       = Math.round(thumbWidth * 9 / 16); // assume 16:9
  const thumbUrl          = `https://image.mux.com/${playbackId}/thumbnail.jpg?time=${thumbTimestamp}&width=${thumbWidth}`;

  const [step,          setStep]          = useState(0); // 0-3 = placing points, 4 = confirm
  const [srcPoints,     setSrcPoints]     = useState([]);
  const [dstPoints,     setDstPoints]     = useState([]);
  const [draftYardLine, setDraftYardLine] = useState(YARD_LINES[5]); // 25 yd
  const [draftFieldY,   setDraftFieldY]   = useState(FIELD_Y[0].y);
  const [draftPending,  setDraftPending]  = useState(null); // {px, py} waiting for landmark selection
  const [saving,        setSaving]        = useState(false);
  const [err,           setErr]           = useState("");
  const imgRef = useRef(null);

  function handleImgClick(e) {
    if (step >= 4) return;
    const rect = imgRef.current.getBoundingClientRect();
    const px   = (e.clientX - rect.left) / rect.width  * thumbWidth;
    const py   = (e.clientY - rect.top)  / rect.height * thumbHeight;
    setDraftPending({ px, py });
  }

  function confirmPoint() {
    if (!draftPending) return;
    const newSrc = [...srcPoints, [draftPending.px, draftPending.py]];
    const newDst = [...dstPoints, [draftYardLine, draftFieldY]];
    setSrcPoints(newSrc);
    setDstPoints(newDst);
    setDraftPending(null);
    if (newSrc.length === 4) setStep(4);
    else setStep(newSrc.length);
  }

  async function handleSave() {
    setSaving(true); setErr("");
    try {
      const matrix = computeHomography(srcPoints, dstPoints);
      if (!matrix) throw new Error("Could not compute homography — points may be collinear. Try different landmarks.");
      const r = await fetch("/api/film/calibrate", {
        method:      "POST",
        credentials: "include",
        headers:     { "Content-Type": "application/json" },
        body:        JSON.stringify({ filmId, homography: matrix, srcPoints, dstPoints }),
      });
      const d = await r.json();
      if (!r.ok || !d.ok) throw new Error(d.error || "Save failed");
      onCalibrated();
    } catch (e) {
      setErr(e.message || "Failed to save calibration");
    } finally {
      setSaving(false);
    }
  }

  const dotColors = ["#EF4444","#3B82F6","#22C55E","#F59E0B"];

  return (
    <div style={{ border: `1.5px solid ${DS.cautionBorder}`, borderRadius: 14, padding: 20, background: DS.cautionBg, marginTop: 10 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 9, fontWeight: 900, letterSpacing: "0.16em", textTransform: "uppercase", color: DS.caution, marginBottom: 4 }}>Camera Calibration</div>
          <div style={{ fontSize: 16, fontWeight: 800, color: DS.bodyText }}>Fix camera angle for accurate speed data</div>
          <div style={{ fontSize: 12, color: DS.labelText, marginTop: 4, maxWidth: 480, lineHeight: 1.5 }}>
            Click 4 known field landmarks in the image below, then tell us where each one is on the field.
            This one-time step corrects for camera tilt and makes all speed/distance measurements accurate.
          </div>
        </div>
        <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", padding: 4, color: DS.dimText, fontSize: 18, lineHeight: 1 }}>✕</button>
      </div>

      {/* Progress dots */}
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 14 }}>
        {[0,1,2,3].map(i => (
          <div key={i} style={{
            width: 20, height: 20, borderRadius: "50%", border: `2px solid ${dotColors[i]}`,
            background: i < srcPoints.length ? dotColors[i] : (i === srcPoints.length && !draftPending ? "transparent" : (draftPending && i === srcPoints.length ? dotColors[i]+"44" : "transparent")),
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 9, fontWeight: 900, color: i < srcPoints.length ? "#fff" : dotColors[i],
          }}>
            {i < srcPoints.length ? "✓" : i + 1}
          </div>
        ))}
        <span style={{ fontSize: 11, color: DS.labelText, marginLeft: 4 }}>
          {step < 4 ? (draftPending ? "Now set its field coordinates below" : STEP_LABELS[step]) : "All 4 points set — ready to calibrate"}
        </span>
      </div>

      {/* Thumbnail with click overlay */}
      {step < 4 && (
        <div
          ref={imgRef}
          onClick={handleImgClick}
          style={{ position: "relative", cursor: draftPending ? "default" : "crosshair", marginBottom: 14, borderRadius: 10, overflow: "hidden", border: `1.5px solid ${DS.border}` }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={thumbUrl} alt="Film frame" style={{ width: "100%", display: "block" }} />

          {/* Already placed dots */}
          {srcPoints.map(([px, py], i) => {
            const rect = imgRef.current?.getBoundingClientRect();
            if (!rect) return null;
            const displayW = rect?.width || thumbWidth;
            const displayH = rect?.height || thumbHeight;
            const cx = (px / thumbWidth)  * displayW;
            const cy = (py / thumbHeight) * displayH;
            return (
              <div key={i} style={{
                position: "absolute", left: cx - 10, top: cy - 10,
                width: 20, height: 20, borderRadius: "50%",
                background: dotColors[i], border: "2px solid #fff",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 9, fontWeight: 900, color: "#fff", pointerEvents: "none",
              }}>
                {i + 1}
              </div>
            );
          })}

          {/* Instruction overlay */}
          {!draftPending && (
            <div style={{ position: "absolute", top: 10, left: 10, background: "rgba(0,0,0,0.62)", color: "#fff", padding: "4px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700, backdropFilter: "blur(6px)" }}>
              Click point {srcPoints.length + 1} of 4
            </div>
          )}
        </div>
      )}

      {/* Field coordinate picker — shown after clicking a point */}
      {draftPending && (
        <div style={{ background: DS.cardBg, borderRadius: 10, padding: 14, border: `1px solid ${DS.border}`, marginBottom: 14 }}>
          <div style={{ fontWeight: 700, fontSize: 12, color: DS.bodyText, marginBottom: 10 }}>
            What field location did you click? (Point {srcPoints.length + 1})
          </div>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: DS.labelText, display: "block", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.06em" }}>Yard line</label>
              <select value={draftYardLine} onChange={e => setDraftYardLine(Number(e.target.value))}
                style={{ border: `1px solid ${DS.border}`, borderRadius: 8, padding: "7px 10px", fontSize: 13, color: DS.bodyText, background: "#fff" }}>
                {YARD_LINES.map(y => <option key={y} value={y}>{y === 0 ? "Goal line (0)" : y === 100 ? "Opposite goal line (100)" : y > 50 ? `${100-y} yd (opp side)` : `${y} yd`}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: DS.labelText, display: "block", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.06em" }}>Field position</label>
              <select value={draftFieldY} onChange={e => setDraftFieldY(Number(e.target.value))}
                style={{ border: `1px solid ${DS.border}`, borderRadius: 8, padding: "7px 10px", fontSize: 13, color: DS.bodyText, background: "#fff" }}>
                {FIELD_Y.map(f => <option key={f.y} value={f.y}>{f.label}</option>)}
              </select>
            </div>
          </div>
          <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
            <button onClick={confirmPoint}
              style={{ padding: "8px 16px", borderRadius: 8, background: DS.brand, color: "#fff", border: "none", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
              Confirm this point →
            </button>
            <button onClick={() => setDraftPending(null)}
              style={{ padding: "8px 12px", borderRadius: 8, background: "none", color: DS.dimText, border: `1px solid ${DS.border}`, fontWeight: 600, fontSize: 12, cursor: "pointer" }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Confirmation step */}
      {step === 4 && (
        <div>
          <div style={{ background: DS.safeBg, borderRadius: 10, padding: 14, marginBottom: 14, border: `1px solid ${DS.safeBorder}` }}>
            <div style={{ fontWeight: 700, fontSize: 13, color: DS.safe, marginBottom: 8 }}>✓ 4 points collected — review before saving</div>
            <table style={{ fontSize: 12, color: DS.bodyText, borderCollapse: "collapse", width: "100%" }}>
              <thead>
                <tr style={{ color: DS.labelText, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", fontSize: 10 }}>
                  <th style={{ textAlign: "left", paddingBottom: 6 }}>Point</th>
                  <th style={{ textAlign: "left", paddingBottom: 6 }}>Pixel (x, y)</th>
                  <th style={{ textAlign: "left", paddingBottom: 6 }}>Field position</th>
                </tr>
              </thead>
              <tbody>
                {srcPoints.map(([px, py], i) => {
                  const [X, Y] = dstPoints[i];
                  const fieldPos = FIELD_Y.find(f => f.y === Y)?.label || `${Y} yd from left`;
                  return (
                    <tr key={i} style={{ borderTop: `1px solid ${DS.border}` }}>
                      <td style={{ padding: "5px 0", fontWeight: 700, color: dotColors[i] }}>●{i+1}</td>
                      <td style={{ padding: "5px 8px" }}>({Math.round(px)}, {Math.round(py)})</td>
                      <td style={{ padding: "5px 0" }}>{X} yd · {fieldPos}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {err && <div style={{ color: DS.warn, fontSize: 12, fontWeight: 600, marginBottom: 10 }}>⚠ {err}</div>}

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button onClick={handleSave} disabled={saving}
              style={{ padding: "10px 22px", borderRadius: 8, background: saving ? DS.border : DS.safe, color: saving ? DS.dimText : "#fff", border: "none", fontWeight: 800, fontSize: 13, cursor: saving ? "not-allowed" : "pointer", letterSpacing: "0.02em" }}>
              {saving ? "Saving..." : "Save Calibration"}
            </button>
            <button onClick={() => { setSrcPoints([]); setDstPoints([]); setStep(0); setDraftPending(null); }}
              style={{ padding: "10px 16px", borderRadius: 8, background: "none", color: DS.dimText, border: `1px solid ${DS.border}`, fontWeight: 600, fontSize: 12, cursor: "pointer" }}>
              Start over
            </button>
            <button onClick={onClose}
              style={{ padding: "10px 16px", borderRadius: 8, background: "none", color: DS.dimText, border: `1px solid ${DS.border}`, fontWeight: 600, fontSize: 12, cursor: "pointer" }}>
              Cancel
            </button>
          </div>
        </div>
      )}
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
  const [snapTime,     setSnapTime]     = useState(null);
  const [whistleTime,  setWhistleTime]  = useState(null);
  const [filmDuration, setFilmDuration] = useState(null);
  const [speed,        setSpeed]        = useState(1);

  const [tab,          setTab]          = useState("plays");
  const [selPlay,      setSelPlay]      = useState(null);
  const [videoTime,    setVideoTime]    = useState(0);
  const [hlJersey,     setHlJersey]     = useState(null);
  const [unconfCount,    setUnconfCount]    = useState(0);
  const [copied,       setCopied]       = useState(false);
  const [analytics,    setAnalytics]    = useState(null);
  const [isMobile,     setIsMobile]     = useState(false);
  const [editingPlay,  setEditingPlay]  = useState(null);
  const [pageError,    setPageError]    = useState("");
  const [playlists,    setPlaylists]    = useState([]);
  const [cutup,        setCutup]        = useState(null);   // { name, plays:[], index:0 }
  const [addMenuPlay,  setAddMenuPlay]  = useState(null);   // play that has the menu open
  const [drawMode,     setDrawMode]     = useState(false);
  const [showShare,      setShowShare]      = useState(false);
  const [showExchange,   setShowExchange]   = useState(false);
  const [isPublished,      setIsPublished]      = useState(false);
  const [viewingType,      setViewingType]      = useState("vara");
  const [showTypePicker,   setShowTypePicker]   = useState(false);
  const [dueDateStep,      setDueDateStep]      = useState(false);  // second step after picking CARA
  const [draftDueDate,     setDraftDueDate]     = useState("");     // "YYYY-MM-DD"
  const [watchDueDate,     setWatchDueDate]     = useState(null);   // persisted due date
  const [publishLoading,   setPublishLoading]   = useState(false);
  const [watchStats,       setWatchStats]       = useState(null); // { watched_count, watchers }
  const [showWatchers,     setShowWatchers]     = useState(false);
  const [annotatingPlay,   setAnnotatingPlay]   = useState(null);
  const [teamAthletes,   setTeamAthletes]   = useState([]);
  const [seasonStatus,   setSeasonStatus]   = useState(null); // { phase, label, isCara, note, period }
  const [exchanges,    setExchanges]    = useState([]);
  const [isFullscreen,  setIsFullscreen]  = useState(false);
  const [showOverlay,   setShowOverlay]   = useState(true);
  const [teleStrokes,   setTeleStrokes]   = useState([]);
  const [teleTool,      setTeleTool]      = useState("arrow");
  const [teleColor,     setTeleColor]     = useState("#FF3B30");
  const [angles,        setAngles]        = useState([]);        // secondary camera angles
  const [activeAngle,   setActiveAngle]   = useState(null);      // null = primary film
  const [showAngleMgr,  setShowAngleMgr]  = useState(false);
  const [showCalibration, setShowCalibration] = useState(false);
  const [isCalibrated,    setIsCalibrated]    = useState(false);
  const filmLeftRef   = useRef(null);
  const hideTimer     = useRef(null);

  const videoRef   = useRef(null);
  const pollRef    = useRef(null);
  const didAutoSel = useRef(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 700);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const fetchAngles = useCallback(async () => {
    if (!id) return;
    try {
      const r = await fetch(`/api/film/angles?filmId=${id}`, { credentials: "include" });
      const d = await r.json();
      if (r.ok) setAngles(d.angles ?? []);
    } catch {}
  }, [id]);

  const fetchFilm = useCallback(async () => {
    if (!id) return;
    const r = await fetch(`/api/film/status?filmId=${id}`, { credentials: "include" });
    const d = await r.json();
    if (r.ok) {
      setFilm(d);
      setIsPublished(!!d.is_published);
      setViewingType(d.viewing_type ?? "vara");
      setWatchDueDate(d.watch_due_date ?? null);
      // Check calibration status (fire-and-forget)
      fetch(`/api/film/calibrate?filmId=${id}`, { credentials: "include" })
        .then(r2 => r2.json())
        .then(cal => { if (cal.ok) setIsCalibrated(!!cal.calibrated); })
        .catch(() => {});
      if (d.is_published) {
        fetch(`/api/film/watch-stats?filmId=${id}`, { credentials: "include" })
          .then(r => r.json())
          .then(ws => { if (ws.ok) setWatchStats(ws); })
          .catch(() => {});
      }
      // Always fetch team athletes so Views tab can show who hasn't watched
      fetch("/api/org/getAthletes", { credentials: "include" })
        .then(r => r.json())
        .then(d => { if (d.ok) setTeamAthletes(d.athletes ?? []); })
        .catch(() => {});
    }
    return d;
  }, [id]);

  // Called after coach picks CARA or VARA in the picker
  async function handlePublish(type, dueDate) {
    if (publishLoading || !id) return;
    setShowTypePicker(false);
    setDueDateStep(false);
    setIsPublished(true);
    setViewingType(type);
    if (dueDate !== undefined) setWatchDueDate(dueDate || null);
    setPublishLoading(true);
    try {
      const r = await fetch("/api/film/publish", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filmId: id, action: "publish", viewingType: type, watchDueDate: dueDate ?? null }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? "Failed");
      setViewingType(d.viewing_type ?? type);
      setWatchDueDate(d.watch_due_date ?? null);
      toast.success(type === "cara" ? "Shared as Required Viewing ✓" : "Shared as Voluntary Study ✓");
    } catch (e) {
      setIsPublished(false);
      toast.error(e.message || "Could not share film");
    }
    setPublishLoading(false);
  }

  async function handleUnpublish() {
    if (publishLoading || !id) return;
    setIsPublished(false);
    setPublishLoading(true);
    try {
      const r = await fetch("/api/film/publish", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filmId: id, action: "unpublish" }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? "Failed");
      toast.success("Removed from team feed");
    } catch (e) {
      setIsPublished(true);
      toast.error(e.message || "Could not update");
    }
    setPublishLoading(false);
  }

  async function handleSetViewingType(type) {
    if (publishLoading || !id) return;
    const prev = viewingType;
    setViewingType(type);
    try {
      const r = await fetch("/api/film/publish", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filmId: id, action: "setType", viewingType: type }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? "Failed");
      toast.success(type === "cara" ? "Switched to Required Viewing (CARA)" : "Switched to Voluntary Study (VARA)");
    } catch (e) {
      setViewingType(prev);
      toast.error(e.message || "Could not update");
    }
  }

  async function handleSetDueDate(dateStr) {
    const prev = watchDueDate;
    setWatchDueDate(dateStr || null);
    try {
      const r = await fetch("/api/film/publish", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filmId: id, action: "setDueDate", watchDueDate: dateStr || null }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? "Failed");
      setWatchDueDate(d.watch_due_date ?? null);
      toast.success(dateStr ? "Deadline updated" : "Deadline removed");
    } catch (e) {
      setWatchDueDate(prev);
      toast.error(e.message || "Could not update deadline");
    }
  }

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

  const fetchAnalytics = useCallback(async () => {
    if (!id) return;
    try {
      const r = await fetch(`/api/film/analytics?filmId=${id}`, { credentials: "include" });
      const d = await r.json();
      if (d.ok) setAnalytics(d);
    } catch {}
  }, [id]);

  const fetchPlaylists = useCallback(async () => {
    if (!id) return;
    try {
      const r = await fetch(`/api/film/playlists?filmId=${id}`, { credentials: "include" });
      const d = await r.json();
      if (d.ok) setPlaylists(d.playlists ?? []);
    } catch {}
  }, [id]);

  const fetchExchanges = useCallback(async () => {
    if (!id) return;
    try {
      const r = await fetch(`/api/film/exchange?filmId=${id}`, { credentials: "include" });
      const d = await r.json();
      if (d.ok) setExchanges(d.exchanges ?? []);
    } catch {}
  }, [id]);

  const handleAllConfirmed = useCallback(() => {
    setUnconfCount(0);
    fetchPlays();
    fetchAnalytics();
  }, [fetchPlays, fetchAnalytics]);


  // Fetch season status once (for CARA compliance warnings)
  useEffect(() => {
    fetch("/api/org/season-status", { credentials: "include" })
      .then(r => r.json())
      .then(d => { if (d.ok) setSeasonStatus(d); })
      .catch(() => {});
  }, []);

  // Initial load
  useEffect(() => {
    if (!id) return;
    Promise.all([
      fetchFilm(),
      fetchPlays(),
      fetchAnalytics(),
      fetchPlaylists(),
      fetchExchanges(),
      fetchAngles(),
      fetch("/api/film/roster", { credentials: "include" }).then(r => r.json()).then(d => setRoster(d.players ?? [])),
    ]).then(([filmData]) => {
      setLoading(false);
      // Fetch S3 presigned URL if Mux isn't available
      if (!filmData?.muxPlaybackId) fetchVideoUrl();
    });
  }, [id, fetchFilm, fetchPlays, fetchAnalytics, fetchVideoUrl, fetchAngles]);

  // Poll while uploading to catch the transition to ready
  useEffect(() => {
    const uploading = film?.status === "uploading";
    if (uploading && !pollRef.current) {
      pollRef.current = setInterval(async () => {
        const r = await fetch(`/api/film/status?filmId=${id}`, { credentials: "include" });
        const d = await r.json();
        if (r.ok) {
          setFilm(d);
          if (d.status !== "uploading") {
            clearInterval(pollRef.current); pollRef.current = null;
            fetchPlays();
            fetchAnalytics();
            if (!d.muxPlaybackId) fetchVideoUrl();
          }
        }
      }, 5000);
    }
    if (!uploading && pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    return () => { if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; } };
  }, [film?.status, id, fetchPlays, fetchVideoUrl, fetchAnalytics]);

  const selTracks    = useMemo(() => Array.isArray(selPlay?.player_tracks) ? selPlay.player_tracks : [], [selPlay]);
  const isProcessing = film?.status === "uploading";
  const hasAnalysis  = plays.some(p => Array.isArray(p.player_tracks) && p.player_tracks.length > 0);

  async function undoLastPlay() {
    if (!plays.length) return;
    const last = plays[plays.length - 1];
    await fetch("/api/film/plays", {
      method: "DELETE", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ filmId: id, playId: last.id }),
    });
    fetchPlays();
    setSnapTime(null); setWhistleTime(null);
  }

  function shareClip() {
    const url = selPlay?.clip_url || window.location.href;
    navigator.clipboard?.writeText(url).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  }

  function selectPlay(play) {
    setSelPlay(play);
    setVideoTime(0);
    setHlJersey(null);
    if (videoRef.current && play?.start_time_secs != null) {
      videoRef.current.currentTime = play.start_time_secs;
    }
  }

  function startEdit(play) {
    setEditingPlay(play);
    selectPlay(play);
    setSnapTime(play.start_time_secs ?? null);
    setWhistleTime(play.end_time_secs ?? null);
  }

  async function deletePlay(play) {
    if (!window.confirm(`Delete Play #${play.play_number}? This cannot be undone.`)) return;
    await fetch("/api/film/plays", {
      method: "DELETE", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ filmId: id, playId: play.id }),
    });
    fetchPlays();
    fetchAnalytics();
  }

  async function movePlay(play, direction) {
    const sorted = [...plays].sort((a, b) => a.play_number - b.play_number);
    const idx    = sorted.findIndex(p => p.id === play.id);
    const swap   = direction === "up" ? sorted[idx - 1] : sorted[idx + 1];
    if (!swap) return;

    const aNum = play.play_number;
    const bNum = swap.play_number;
    const tmp  = Date.now(); // temp number to avoid unique constraint conflict

    await fetch("/api/film/plays", {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ filmId: id, playId: play.id, newPlayNumber: tmp }),
    });
    await fetch("/api/film/plays", {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ filmId: id, playId: swap.id, newPlayNumber: aNum }),
    });
    await fetch("/api/film/plays", {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ filmId: id, playId: play.id, newPlayNumber: bNum }),
    });
    fetchPlays();
    fetchAnalytics();
  }

  function cancelEdit() {
    setEditingPlay(null);
    setSnapTime(null);
    setWhistleTime(null);
  }

  // ── Playlist helpers ──────────────────────────────────────────────────────
  async function playlistAction(body) {
    await fetch("/api/film/playlists", {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    fetchPlaylists();
  }

  async function addToPlaylist(listId, play) {
    await playlistAction({ action: "add_play", listId, playId: play.id });
  }

  async function createAndAdd(name, play) {
    const r = await fetch("/api/film/playlists", {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "create", filmId: id, name }),
    });
    const d = await r.json();
    if (d.ok) await playlistAction({ action: "add_play", listId: d.list.id, playId: play.id });
  }

  async function createCrossGamePlaylist(name) {
    await fetch("/api/film/playlists", {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "create", crossGame: true, name }),
    });
    fetchPlaylists();
  }

  async function removePlayFromList(itemId) {
    await playlistAction({ action: "remove_play", itemId });
  }

  async function deletePlaylist(listId) {
    await playlistAction({ action: "delete", listId });
  }

  async function renamePlaylist(listId, name) {
    await playlistAction({ action: "rename", listId, name });
  }

  async function publishPlaylist(listId, viewingType, watchDueDate) {
    await playlistAction({ action: "publish", listId, viewingType, watchDueDate });
  }

  async function unpublishPlaylist(listId) {
    await playlistAction({ action: "unpublish", listId });
  }

  // ── Cut-up playback ───────────────────────────────────────────────────────
  function startCutup(list) {
    const plays = (list.items ?? []).filter(p => p.start_time_secs != null).sort((a, b) => a._position - b._position);
    if (!plays.length) return;
    setCutup({ name: list.name, plays, index: 0 });
    if (videoRef.current) {
      videoRef.current.currentTime = plays[0].start_time_secs;
      videoRef.current.play?.().catch(() => {});
    }
    setTab("plays");
  }

  // ── Fullscreen ────────────────────────────────────────────────────────────
  function toggleFullscreen() {
    const el = filmLeftRef.current;
    if (!el) return;
    if (!document.fullscreenElement) {
      (el.requestFullscreen?.() ?? el.webkitRequestFullscreen?.())?.catch?.(() => {});
      setShowOverlay(true);
      clearTimeout(hideTimer.current);
      hideTimer.current = setTimeout(() => setShowOverlay(false), 3000);
    } else {
      document.exitFullscreen?.().catch(() => {});
    }
  }

  function handleFSMouseMove() {
    if (!isFullscreen) return;
    setShowOverlay(true);
    clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setShowOverlay(false), 3000);
  }

  useEffect(() => {
    function onFSChange() {
      const fs = !!document.fullscreenElement;
      setIsFullscreen(fs);
      if (!fs) { setShowOverlay(true); clearTimeout(hideTimer.current); setDrawMode(false); }
    }
    document.addEventListener("fullscreenchange", onFSChange);
    document.addEventListener("webkitfullscreenchange", onFSChange);
    return () => {
      document.removeEventListener("fullscreenchange", onFSChange);
      document.removeEventListener("webkitfullscreenchange", onFSChange);
    };
  }, []);

  function cutupNext() {
    setCutup(c => {
      if (!c || c.index >= c.plays.length - 1) return c;
      const next = c.plays[c.index + 1];
      if (videoRef.current && next.start_time_secs != null) {
        videoRef.current.currentTime = next.start_time_secs;
        videoRef.current.play?.().catch(() => {});
      }
      return { ...c, index: c.index + 1 };
    });
  }

  function cutupPrev() {
    setCutup(c => {
      if (!c || c.index <= 0) return c;
      const prev = c.plays[c.index - 1];
      if (videoRef.current && prev.start_time_secs != null) {
        videoRef.current.currentTime = prev.start_time_secs;
        videoRef.current.play?.().catch(() => {});
      }
      return { ...c, index: c.index - 1 };
    });
  }

  if (loading) return (
    <div style={{ minHeight: "100vh", background: DS.pageBg, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <Loader2 size={28} color={DS.brand} style={{ animation: "spin 1s linear infinite" }} />
    </div>
  );

  const TABS = [
    { key: "plays",     label: "Plays",     Icon: Play,      badge: plays.length > 0 ? plays.length : null },
    { key: "players",   label: "Jersey ID", Icon: UserCheck, badge: unconfCount > 0 ? unconfCount : null, badgeColor: DS.warn },
    { key: "analytics", label: "Analytics", Icon: BarChart2, badge: null },
    { key: "drives",    label: "Drives",    Icon: Activity,  badge: analytics?.drives?.length > 0 ? analytics.drives.length : null },
    { key: "cutups",    label: "Cut-ups",   Icon: ListVideo, badge: playlists.length > 0 ? playlists.length : null },
    { key: "views",     label: "Views",     Icon: Users,     badge: watchStats?.watched_count > 0 ? watchStats.watched_count : null },
  ];

  return (
    <>
      <Toaster position="top-right" toastOptions={{ duration: 4000 }} />
      <style>{`
        @keyframes spin  { from { transform: rotate(0deg);   } to { transform: rotate(360deg); } }
        @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.55; } }
        select option { background: #1e293b; color: #e2e8f0; }
        @media (max-width: 768px) {
          html, body { overflow-x: hidden; }
          .tape-grid { grid-template-columns: 1fr !important; }
          .sidebar-sticky { position: static !important; max-height: none !important; }
          .tagbar-hints { display: none !important; }
          .video-wrap { max-height: 56vw !important; overflow: hidden !important; }
          .video-wrap video, .video-wrap mux-player { max-height: 56vw !important; }
        }

        /* ── Fullscreen mode ── */
        .film-left-col:fullscreen,
        .film-left-col:-webkit-full-screen {
          background: #000; display: flex; flex-direction: column; position: relative;
        }
        .film-left-col:fullscreen .video-wrap,
        .film-left-col:-webkit-full-screen .video-wrap {
          flex: 1; min-height: 0;
          max-height: none !important; aspect-ratio: unset !important; overflow: hidden;
        }
        .film-left-col:fullscreen .video-wrap video,
        .film-left-col:fullscreen .video-wrap mux-player,
        .film-left-col:-webkit-full-screen .video-wrap video,
        .film-left-col:-webkit-full-screen .video-wrap mux-player {
          max-height: none !important; height: 100% !important; object-fit: contain;
        }
        .film-left-col:fullscreen .fs-hide,
        .film-left-col:-webkit-full-screen .fs-hide { display: none !important; }
        .film-left-col:fullscreen .fs-tagbar,
        .film-left-col:-webkit-full-screen .fs-tagbar {
          position: absolute; bottom: 52px; left: 0; right: 0; z-index: 50;
          background: rgba(8,10,18,0.92); backdrop-filter: blur(14px);
          border-top: 1px solid rgba(255,255,255,0.06);
          transition: opacity 0.35s ease, transform 0.35s ease;
        }
        .film-left-col:fullscreen .fs-tagbar.hidden,
        .film-left-col:-webkit-full-screen .fs-tagbar.hidden {
          opacity: 0; transform: translateY(20px); pointer-events: none;
        }
      `}</style>

      <div style={{ minHeight: "100vh", background: DS.pageBg, fontFamily: "system-ui, sans-serif" }}>

        {/* ── Sticky header ── */}
        <div style={{ background: DS.cardBg, borderBottom: `1px solid ${DS.border}`, padding: isMobile ? "10px 12px" : "13px 20px", position: "sticky", top: 0, zIndex: 100 }}>
          <div style={{ maxWidth: 1280, margin: "0 auto", display: "flex", alignItems: "center", gap: isMobile ? 8 : 14 }}>
            <button onClick={() => router.push("/org/film")} style={{ background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 4, color: DS.labelText, fontSize: 13, padding: 0, flexShrink: 0 }}>
              <ArrowLeft size={15} />{!isMobile && " Films"}
            </button>

            {!isMobile && <div style={{ width: 1, height: 18, background: DS.border, flexShrink: 0 }} />}

            <h1 style={{ margin: 0, fontSize: isMobile ? 14 : 16, fontWeight: 800, color: DS.bodyText, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {film?.title || "Loading…"}
            </h1>

            {/* Opponent + status badge: desktop only — shown in metadata bar + workflow banner on mobile */}
            {!isMobile && film?.opponent && <span style={{ fontSize: 12, color: DS.labelText, flexShrink: 0 }}>vs {film.opponent}</span>}

            {!isMobile && film && (
              <span style={{
                fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 20, flexShrink: 0,
                background: plays.length > 0 ? DS.safeBg : DS.brandBg,
                color:      plays.length > 0 ? DS.safe   : DS.brand,
              }}>
                {isProcessing    ? "Uploading…"
                : plays.length > 0 ? `${plays.length} Play${plays.length !== 1 ? "s" : ""}`
                : "Tag Plays"}
              </span>
            )}

            {/* Share clip: desktop only (mobile can long-press video or use share sheet) */}
            {!isMobile && selPlay?.clip_url && (
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

            {/* Share with Team — unified pill + dropdown */}
            {plays.length > 0 && (
              <div style={{ position: "relative", flexShrink: 0 }}>
                {(() => {
                  const dueFmt = formatDueDate(watchDueDate);
                  return isPublished ? (
                    <button
                      onClick={() => { setShowTypePicker(p => !p); setDueDateStep(false); }}
                      disabled={publishLoading}
                      style={{
                        display: "flex", alignItems: "center", gap: 7,
                        background: viewingType === "cara"
                          ? (dueFmt?.overdue ? "rgba(200,16,46,0.1)" : "rgba(255,59,48,0.08)")
                          : DS.safeBg,
                        border: `1.5px solid ${viewingType === "cara"
                          ? (dueFmt?.overdue ? "rgba(200,16,46,0.35)" : "rgba(255,59,48,0.3)")
                          : DS.safeBorder}`,
                        borderRadius: 20, padding: "5px 13px 5px 10px",
                        cursor: "pointer", opacity: publishLoading ? 0.6 : 1,
                      }}
                    >
                      <div style={{ width: 7, height: 7, borderRadius: "50%", flexShrink: 0,
                        background: viewingType === "cara"
                          ? (dueFmt?.overdue ? "#C8102E" : "#FF3B30")
                          : DS.safe }} />
                      <span style={{ fontSize: 12, fontWeight: 700,
                        color: viewingType === "cara"
                          ? (dueFmt?.overdue ? "#C8102E" : "#FF3B30")
                          : DS.safe }}>
                        {viewingType === "cara" ? "Required" : "Voluntary"}
                      </span>
                      {dueFmt ? (
                        <span style={{ fontSize: 11, fontWeight: 600,
                          color: dueFmt.overdue ? "#C8102E" : dueFmt.soon ? DS.warn : DS.dimText }}>
                          · {dueFmt.label}
                        </span>
                      ) : watchStats !== null ? (
                        <span style={{ fontSize: 11, color: DS.dimText }}>
                          · {watchStats.watched_count > 0 ? `${watchStats.watched_count} watched` : "No views"}
                        </span>
                      ) : null}
                      <ChevronDown size={11} color={DS.dimText} style={{ marginLeft: 1 }} />
                    </button>
                  ) : (
                    <button
                      onClick={() => { setShowTypePicker(p => !p); setDueDateStep(false); }}
                      disabled={publishLoading}
                      style={{
                        display: "flex", alignItems: "center", gap: 6,
                        background: DS.cardBg, color: DS.labelText,
                        border: `1.5px solid ${DS.border}`,
                        borderRadius: 8, padding: isMobile ? "7px 10px" : "7px 14px",
                        fontSize: 12, fontWeight: 700,
                        cursor: publishLoading ? "not-allowed" : "pointer",
                        opacity: publishLoading ? 0.7 : 1,
                      }}
                    >
                      {publishLoading
                        ? <Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} />
                        : <><Users size={13} />{!isMobile && " Share with Team"}</>
                      }
                    </button>
                  );
                })()}

                {/* Dropdown panel */}
                {showTypePicker && (
                  <>
                    <div onClick={() => { setShowTypePicker(false); setDueDateStep(false); }} style={{ position: "fixed", inset: 0, zIndex: 199 }} />
                    <div style={{
                      position: "absolute", top: "calc(100% + 8px)", right: 0, zIndex: 200,
                      background: DS.cardBg, border: `1px solid ${DS.border}`,
                      borderRadius: 14, padding: "8px 6px",
                      boxShadow: "0 8px 32px rgba(0,0,0,0.13)", minWidth: 248,
                    }}>
                      {dueDateStep ? (
                        /* ── Step 2: set deadline for new CARA share ── */
                        <>
                          <button onClick={() => setDueDateStep(false)} style={{ display: "flex", alignItems: "center", gap: 5, background: "none", border: "none", cursor: "pointer", color: DS.dimText, fontSize: 12, padding: "4px 10px 8px", width: "100%" }}>
                            <ChevronDown size={12} style={{ transform: "rotate(90deg)" }} /> Back
                          </button>
                          <p style={{ margin: "0 10px 10px", fontSize: 13, fontWeight: 700, color: DS.bodyText }}>When must athletes finish watching?</p>
                          <div style={{ padding: "0 6px 6px" }}>
                            <input
                              type="date"
                              value={draftDueDate}
                              min={new Date().toISOString().split("T")[0]}
                              onChange={e => setDraftDueDate(e.target.value)}
                              style={{
                                width: "100%", padding: "8px 10px", borderRadius: 9,
                                border: `1.5px solid ${DS.border}`, fontSize: 13,
                                background: DS.pageBg, color: DS.bodyText,
                                boxSizing: "border-box", outline: "none",
                              }}
                            />
                            <button
                              onClick={() => handlePublish("cara", draftDueDate || null)}
                              style={{
                                marginTop: 8, width: "100%", padding: "9px", borderRadius: 9,
                                border: "none", background: "#FF3B30", color: "#fff",
                                fontSize: 13, fontWeight: 700, cursor: "pointer",
                              }}
                            >
                              Share as Required Viewing
                            </button>
                            <button
                              onClick={() => handlePublish("cara", null)}
                              style={{ marginTop: 6, width: "100%", padding: "7px", borderRadius: 9, border: "none", background: "transparent", color: DS.dimText, fontSize: 12, cursor: "pointer" }}
                            >
                              Share without a deadline
                            </button>
                          </div>
                        </>
                      ) : (
                        /* ── Step 1: pick type ── */
                        <>
                          {!isPublished && (
                            <p style={{ margin: "2px 10px 10px", fontSize: 11, fontWeight: 600, color: DS.dimText }}>
                              How should athletes view this?
                            </p>
                          )}
                          {isPublished && (
                            <p style={{ margin: "2px 10px 10px", fontSize: 10, fontWeight: 700, color: DS.dimText, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                              Viewing type
                            </p>
                          )}

                          {/* Season compliance warning */}
                          {seasonStatus && !seasonStatus.isCara && seasonStatus.phase !== "unconfigured" && (() => {
                            const isDeadPeriod = seasonStatus.phase === "dead-period";
                            return (
                              <div style={{
                                margin: "0 4px 8px", padding: "9px 11px", borderRadius: 10,
                                background: isDeadPeriod ? "rgba(200,16,46,0.07)" : "rgba(234,179,8,0.09)",
                                border: `1px solid ${isDeadPeriod ? "rgba(200,16,46,0.25)" : "rgba(234,179,8,0.3)"}`,
                              }}>
                                <p style={{ margin: 0, fontSize: 11, fontWeight: 800, color: isDeadPeriod ? "#C8102E" : DS.warn }}>
                                  {isDeadPeriod ? "Dead Period" : seasonStatus.label || "Off-Season"}
                                </p>
                                <p style={{ margin: "3px 0 0", fontSize: 10, color: DS.dimText, lineHeight: 1.5 }}>
                                  {isDeadPeriod
                                    ? "Required Viewing is not permitted during a dead period. Use Voluntary Study instead."
                                    : "You're outside the declared playing season. Required Viewing outside the season may not be NCAA-compliant."}
                                </p>
                              </div>
                            );
                          })()}

                          {[
                            { key: "cara", label: "Required Viewing", sub: "Counts toward 20hr/week limit", dot: "#FF3B30" },
                            { key: "vara", label: "Voluntary Study",  sub: "Athlete-initiated, not countable", dot: DS.safe },
                          ].map(({ key, label, sub, dot }) => {
                            const isActive = isPublished && viewingType === key;
                            return (
                              <button key={key}
                                onClick={() => {
                                  if (isPublished) { handleSetViewingType(key); setShowTypePicker(false); }
                                  else if (key === "cara") {
                                    // two-step: go to deadline picker
                                    const d = new Date(); d.setDate(d.getDate() + 7);
                                    setDraftDueDate(d.toISOString().split("T")[0]);
                                    setDueDateStep(true);
                                  } else {
                                    handlePublish("vara", null);
                                  }
                                }}
                                style={{
                                  width: "100%", display: "flex", alignItems: "center", gap: 10,
                                  padding: "9px 10px", borderRadius: 10, border: "none",
                                  background: isActive ? DS.pageBg : "transparent",
                                  cursor: "pointer", textAlign: "left",
                                }}
                              >
                                <div style={{ width: 8, height: 8, borderRadius: "50%", background: dot, flexShrink: 0 }} />
                                <div style={{ flex: 1 }}>
                                  <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: DS.bodyText }}>{label}</p>
                                  <p style={{ margin: "1px 0 0", fontSize: 10, color: DS.dimText }}>{sub}</p>
                                </div>
                                {isActive && <Check size={13} color={DS.brand} />}
                                {key === "cara" && !isPublished && <ChevronDown size={11} color={DS.dimText} style={{ transform: "rotate(-90deg)" }} />}
                              </button>
                            );
                          })}

                          {/* Due date editor — for already-published CARA films */}
                          {isPublished && viewingType === "cara" && (
                            <>
                              <div style={{ height: 1, background: DS.border, margin: "6px 6px" }} />
                              <div style={{ padding: "6px 10px 4px" }}>
                                <p style={{ margin: "0 0 6px", fontSize: 10, fontWeight: 700, color: DS.dimText, textTransform: "uppercase", letterSpacing: "0.06em" }}>Viewing deadline</p>
                                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                                  <input
                                    type="date"
                                    defaultValue={watchDueDate ?? ""}
                                    min={new Date().toISOString().split("T")[0]}
                                    onBlur={e => { if (e.target.value !== (watchDueDate ?? "")) handleSetDueDate(e.target.value); }}
                                    style={{
                                      flex: 1, padding: "6px 8px", borderRadius: 8,
                                      border: `1px solid ${DS.border}`, fontSize: 12,
                                      background: DS.pageBg, color: DS.bodyText, outline: "none",
                                    }}
                                  />
                                  {watchDueDate && (
                                    <button onClick={() => handleSetDueDate(null)} style={{ background: "none", border: "none", cursor: "pointer", color: DS.dimText, fontSize: 18, lineHeight: 1, padding: "0 2px" }}>×</button>
                                  )}
                                </div>
                              </div>
                            </>
                          )}

                          {isPublished && (
                            <>
                              <div style={{ height: 1, background: DS.border, margin: "8px 6px" }} />
                              <button
                                onClick={() => { handleUnpublish(); setShowTypePicker(false); }}
                                style={{
                                  width: "100%", padding: "8px 10px", borderRadius: 10, border: "none",
                                  background: "transparent", cursor: "pointer", textAlign: "left",
                                  fontSize: 12, fontWeight: 600, color: DS.warn,
                                }}
                              >
                                Remove from team feed
                              </button>
                            </>
                          )}
                        </>
                      )}
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Share film link / cut-up — icon-only on mobile */}
            <button onClick={() => setShowShare(true)}
              style={{
                background: DS.brand, color: "#fff", border: "none",
                borderRadius: 8, padding: isMobile ? "7px 10px" : "7px 14px", fontSize: 12, fontWeight: 700,
                cursor: "pointer", display: "flex", alignItems: "center", gap: 5, flexShrink: 0,
              }}>
              <Share2 size={13} />{!isMobile && " Share Link"}
            </button>

            {/* Exchange film */}
            <button onClick={() => setShowExchange(true)}
              style={{
                background: "none", border: `1.5px solid ${DS.border}`, color: DS.labelText,
                borderRadius: 8, padding: isMobile ? "7px 10px" : "7px 14px", fontSize: 12, fontWeight: 700,
                cursor: "pointer", display: "flex", alignItems: "center", gap: 5, flexShrink: 0,
              }}>
              <ArrowLeftRight size={13} />{!isMobile && " Exchange"}
            </button>
          </div>


          {/* Exchange status pills — show when there are any exchanges */}
          {exchanges.length > 0 && (
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 6 }}>
              {exchanges.map(ex => {
                const isAccepted = ex.status === "accepted";
                const extPlatform = (() => {
                  if (!ex.external_url) return null;
                  const u = ex.external_url.toLowerCase();
                  if (u.includes("hudl.com"))   return "HUDL";
                  if (u.includes("youtube.com") || u.includes("youtu.be")) return "YouTube";
                  if (u.includes("vimeo.com"))  return "Vimeo";
                  return "External";
                })();
                return (
                  <div key={ex.id} style={{
                    display: "inline-flex", alignItems: "center", gap: 5,
                    fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 20,
                    background: isAccepted ? "rgba(52,199,89,0.1)" : "rgba(255,255,255,0.05)",
                    color: isAccepted ? "#34C759" : DS.dimText,
                    border: `1px solid ${isAccepted ? "rgba(52,199,89,0.25)" : DS.border}`,
                  }}>
                    <ArrowLeftRight size={10} />
                    {isAccepted ? "Accepted" : "Pending"}
                    {" · "}{ex.receiving_email}
                    {isAccepted && ex.received_film_id && (
                      <a href={`/org/film/${ex.received_film_id}`}
                        style={{ color: "#34C759", textDecoration: "none", fontWeight: 800, marginLeft: 2 }}>
                        View →
                      </a>
                    )}
                    {isAccepted && ex.external_url && !ex.received_film_id && (
                      <a href={ex.external_url} target="_blank" rel="noopener noreferrer"
                        style={{ color: "#34C759", textDecoration: "none", fontWeight: 800, marginLeft: 2 }}>
                        {extPlatform ? `View on ${extPlatform} →` : "View Link →"}
                      </a>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Share modal */}
        {showShare && (
          <ShareModal film={film} playlists={playlists} onClose={() => setShowShare(false)} />
        )}

        {/* Exchange modal */}
        {showExchange && (
          <ExchangeModal
            film={film}
            onClose={() => setShowExchange(false)}
            onSent={() => { fetchExchanges(); }}
          />
        )}

        {/* ── Pipeline status ── */}
        <PipelineStatusBar film={film} plays={plays} />

        {/* ── Game metadata bar ── */}
        {film && !isProcessing && (film.game_date || film.sport || film.home_team || film.away_team) && (
          <div style={{ background: DS.pageBg, borderBottom: `1px solid ${DS.border}`, padding: isMobile ? "7px 12px" : "8px 20px" }}>
            <div style={{ maxWidth: 1280, margin: "0 auto", display: "flex", gap: isMobile ? 10 : 16, alignItems: "center", flexWrap: "wrap" }}>
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
                <span style={{ fontSize: 12, color: DS.dimText }}>{film.play_count} play{film.play_count !== 1 ? "s" : ""} tagged</span>
              )}
            </div>
          </div>
        )}

        {/* ── Tab bar ── */}
        <div style={{ background: DS.cardBg, borderBottom: `1px solid ${DS.border}`, padding: isMobile ? "0 8px" : "0 20px", overflowX: isMobile ? "auto" : "visible" }}>
          <div style={{ maxWidth: 1280, margin: "0 auto", display: "flex", gap: 0, whiteSpace: "nowrap" }}>
            {TABS.map(t => (
              <button key={t.key} onClick={() => setTab(t.key)} style={{
                background: "none", border: "none", cursor: "pointer",
                display: "inline-flex", alignItems: "center", gap: isMobile ? 4 : 6,
                padding: isMobile ? "10px 10px" : "13px 18px",
                fontSize: isMobile ? 11 : 13, fontWeight: tab === t.key ? 700 : 500,
                color: tab === t.key ? DS.brand : DS.labelText,
                borderBottom: `2px solid ${tab === t.key ? DS.brand : "transparent"}`,
                marginBottom: -1, transition: "all 0.12s", flexShrink: 0,
              }}>
                <t.Icon size={isMobile ? 12 : 13} /> {t.label}
                {t.badge != null && (
                  <span style={{
                    minWidth: 16, height: 16, borderRadius: 99, padding: "0 4px",
                    background: t.badgeColor ?? DS.brand, color: "#fff",
                    fontSize: 9, fontWeight: 800, lineHeight: "16px", textAlign: "center",
                    flexShrink: 0,
                  }}>{t.badge}</span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* ── Content ── */}
        <div style={{ maxWidth: 1280, margin: "0 auto", padding: isMobile ? "10px 8px" : "20px 16px" }}>

          {/* PLAYS TAB */}
          {tab === "plays" && (
            <>
              {/* ── Workflow progress ── */}
              <WorkflowBanner plays={plays} isMobile={isMobile} />

              {/* Page-level error (replaces alert()) */}
              {pageError && (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: DS.warnBg, border: `1px solid ${DS.warn}`, borderRadius: 10, padding: "10px 14px", marginBottom: 10 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: DS.warn }}>{pageError}</span>
                  <button onClick={() => setPageError("")} style={{ background: "none", border: "none", cursor: "pointer", color: DS.warn, fontSize: 16, lineHeight: 1, padding: "0 2px" }}>✕</button>
                </div>
              )}

              {/* Unconfirmed banner */}
              {unconfCount > 0 && (
                <div style={{
                  display: "flex", alignItems: isMobile ? "flex-start" : "center",
                  justifyContent: "space-between", flexWrap: "wrap", gap: 8,
                  background: DS.cautionBg, border: `1px solid ${DS.cautionBorder}`,
                  borderRadius: 10, padding: "11px 16px", marginBottom: 16,
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 0 }}>
                    <Lock size={13} color={DS.caution} style={{ flexShrink: 0 }} />
                    <span style={{ fontSize: isMobile ? 12 : 13, fontWeight: 600, color: DS.caution }}>
                      {unconfCount} player{unconfCount !== 1 ? "s" : ""} unconfirmed — analytics may be incomplete.
                    </span>
                  </div>
                  <button onClick={() => setTab("players")} style={{ background: DS.caution, color: "#fff", border: "none", borderRadius: 6, padding: "6px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer", flexShrink: 0 }}>
                    Confirm Now
                  </button>
                </div>
              )}

              <div className="tape-grid" style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "minmax(0,3fr) minmax(240px,2fr)", gap: isMobile ? 12 : 16, alignItems: "start" }}>
                  {/* Left: video + timeline + tag bar + formation + metrics */}
                  <div
                    ref={filmLeftRef}
                    className="film-left-col"
                    style={{ display: "flex", flexDirection: "column", gap: isMobile ? 8 : 14, minWidth: 0, overflow: "hidden", position: "relative" }}
                    onMouseMove={handleFSMouseMove}
                  >
                    {/* Angle switcher bar */}
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
                      {angles.length > 0 && (
                        <>
                          {/* Primary angle */}
                          <button
                            onClick={() => {
                              setActiveAngle(null);
                              if (videoRef.current) videoRef.current.currentTime = videoTime;
                            }}
                            style={{
                              display: "inline-flex", alignItems: "center", gap: 6,
                              padding: "5px 12px", borderRadius: 20, fontSize: 12, fontWeight: 700, cursor: "pointer",
                              background: activeAngle === null ? DS.brand : DS.pageBg,
                              color:      activeAngle === null ? "#fff" : DS.dimText,
                              border:    `1.5px solid ${activeAngle === null ? DS.brand : DS.border}`,
                            }}>
                            <Video size={12} /> Primary
                          </button>

                          {/* Secondary angle pills */}
                          {angles.map(a => (
                            <button key={a.id}
                              onClick={() => {
                                setActiveAngle(a);
                                // Seek angle video to equivalent time accounting for offset
                                requestAnimationFrame(() => {
                                  if (videoRef.current) {
                                    const target = Math.max(0, videoTime + (a.time_offset_secs ?? 0));
                                    videoRef.current.currentTime = target;
                                  }
                                });
                              }}
                              style={{
                                display: "inline-flex", alignItems: "center", gap: 6,
                                padding: "5px 12px", borderRadius: 20, fontSize: 12, fontWeight: 700, cursor: "pointer",
                                background: activeAngle?.id === a.id ? "#7C3AED" : DS.pageBg,
                                color:      activeAngle?.id === a.id ? "#fff" : DS.dimText,
                                border:    `1.5px solid ${activeAngle?.id === a.id ? "#7C3AED" : DS.border}`,
                              }}>
                              <SwitchCamera size={12} />
                              {a.label}
                              {a.time_offset_secs !== 0 && (
                                <span style={{ fontWeight: 500, opacity: 0.65, fontSize: 11 }}>
                                  {a.time_offset_secs > 0 ? "+" : ""}{a.time_offset_secs}s
                                </span>
                              )}
                            </button>
                          ))}
                        </>
                      )}

                      {/* Manage angles toggle */}
                      <button
                        onClick={() => setShowAngleMgr(s => !s)}
                        style={{
                          display: "inline-flex", alignItems: "center", gap: 5,
                          padding: "5px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600, cursor: "pointer",
                          background: showAngleMgr ? DS.brand : DS.pageBg,
                          color:      showAngleMgr ? "#fff" : DS.dimText,
                          border:    `1px dashed ${DS.border}`,
                        }}>
                        <Layers size={11} />
                        {showAngleMgr ? "Close Angles" : "Manage Angles"}
                      </button>

                      {/* Calibrate camera button */}
                      <button
                        onClick={() => setShowCalibration(true)}
                        title="Calibrate camera angle for accurate speed tracking"
                        style={{
                          display: "inline-flex", alignItems: "center", gap: 5,
                          padding: "5px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600, cursor: "pointer",
                          background: isCalibrated ? DS.safeBg : DS.cautionBg,
                          color:      isCalibrated ? DS.safe    : DS.caution,
                          border:     `1px solid ${isCalibrated ? DS.safeBorder : DS.cautionBorder}`,
                        }}>
                        <Activity size={11} />
                        {isCalibrated ? "Calibrated ✓" : "Calibrate Camera"}
                      </button>
                    </div>

                    {/* Angle manager panel */}
                    {showAngleMgr && (
                      <AngleManager
                        primaryFilmId={id}
                        angles={angles}
                        onRefresh={fetchAngles}
                        onClose={() => setShowAngleMgr(false)}
                      />
                    )}

                    {/* Camera calibration wizard */}
                    {showCalibration && film?.mux_playback_id && (
                      <CalibrationWizard
                        filmId={id}
                        playbackId={film.mux_playback_id}
                        durationSecs={film.duration_secs ?? 0}
                        onClose={() => setShowCalibration(false)}
                        onCalibrated={() => { setIsCalibrated(true); setShowCalibration(false); toast.success("Camera calibrated — speed tracking is now accurate for this film."); }}
                      />
                    )}

                    {/* Video wrapper */}
                    <div style={{ position: "relative" }}>

                      {/* Persistent draw toggle — always visible in fullscreen */}
                      {isFullscreen && (
                        <button
                          onClick={() => setDrawMode(d => !d)}
                          title={drawMode ? "Exit draw mode" : "Draw on frame"}
                          style={{
                            position: "absolute", top: 12, right: 12, zIndex: 70,
                            display: "inline-flex", alignItems: "center", gap: 6,
                            padding: "7px 12px", borderRadius: 20,
                            background: drawMode ? "rgba(37,99,235,0.85)" : "rgba(0,0,0,0.55)",
                            border: `1.5px solid ${drawMode ? "rgba(96,165,250,0.6)" : "rgba(255,255,255,0.18)"}`,
                            backdropFilter: "blur(10px)",
                            color: drawMode ? "#93c5fd" : "rgba(255,255,255,0.8)",
                            cursor: "pointer", fontSize: 12, fontWeight: 700,
                            transition: "all 0.15s ease",
                            boxShadow: drawMode ? "0 0 0 2px rgba(96,165,250,0.25)" : "0 2px 8px rgba(0,0,0,0.4)",
                          }}>
                          {drawMode
                            ? <><Check size={12} /> Done</>
                            : <><Pencil size={12} /> Draw</>
                          }
                        </button>
                      )}

                      <VideoPlayer
                        playbackId={activeAngle ? activeAngle.game_films?.mux_playback_id : film?.muxPlaybackId}
                        s3Url={activeAngle ? null : filmVideoUrl}
                        clipUrl={activeAngle ? null : selPlay?.clip_url}
                        playNumber={selPlay?.play_number}
                        onTimeUpdate={t => {
                          setVideoTime(t);
                          setCutup(c => {
                            if (!c) return c;
                            const cur = c.plays[c.index];
                            if (cur?.end_time_secs != null && t >= cur.end_time_secs - 0.2) {
                              if (c.index < c.plays.length - 1) {
                                const next = c.plays[c.index + 1];
                                if (videoRef.current && next.start_time_secs != null) {
                                  videoRef.current.currentTime = next.start_time_secs;
                                  videoRef.current.play?.().catch(() => {});
                                }
                                return { ...c, index: c.index + 1 };
                              } else {
                                return null;
                              }
                            }
                            return c;
                          });
                        }}
                        onDurationChange={setFilmDuration}
                        videoRef={videoRef}
                        onS3Error={() => {
                          toast.error("Video link expired — fetching a fresh one…", { id: "s3-expire", duration: 5000 });
                          fetchVideoUrl();
                        }}
                      />
                      <CutupOverlay
                        cutup={cutup}
                        onNext={cutupNext}
                        onPrev={cutupPrev}
                        onStop={() => setCutup(null)}
                        isMobile={isMobile}
                      />
                      <Telestration active={drawMode} strokes={teleStrokes} onStrokesChange={setTeleStrokes} tool={teleTool} color={teleColor} />
                      <VideoControlBar
                        videoRef={videoRef}
                        drawMode={drawMode}
                        onDrawToggle={() => setDrawMode(d => !d)}
                        strokes={teleStrokes}
                        onStrokesChange={setTeleStrokes}
                        tool={teleTool}
                        onToolChange={setTeleTool}
                        color={teleColor}
                        onColorChange={setTeleColor}
                        onFullscreenToggle={toggleFullscreen}
                        hideDrawToggle={isFullscreen}
                      />
                    </div>

                    {/* Timeline — hidden in fullscreen */}
                    {!isMobile && (
                      <div className="fs-hide">
                        <PlayTimeline
                          plays={plays}
                          duration={filmDuration}
                          currentTime={videoTime}
                          snapTime={snapTime}
                          onSeek={t => { if (videoRef.current) { videoRef.current.currentTime = t; } }}
                        />
                      </div>
                    )}

                    {/* TagBar — inline normally, overlay in fullscreen */}
                    <div className={`fs-tagbar${isFullscreen && (!showOverlay || drawMode) ? " hidden" : ""}`}>
                      <TagBar
                        filmId={id}
                        snapTime={snapTime}
                        whistleTime={whistleTime}
                        onMarkSnap={() => { if (videoRef.current) { videoRef.current.pause?.(); setSnapTime(videoRef.current.currentTime); setWhistleTime(null); } }}
                        onMarkWhistle={() => { if (videoRef.current) { videoRef.current.pause?.(); setWhistleTime(videoRef.current.currentTime); } }}
                        onClear={() => { setSnapTime(null); setWhistleTime(null); }}
                        plays={plays}
                        onSaved={() => { fetchPlays(); fetchAnalytics(); }}
                        onSkip={() => { setSnapTime(null); setWhistleTime(null); if (videoRef.current) { videoRef.current.currentTime += 10; videoRef.current.play?.().catch(() => {}); } }}
                        onUndo={undoLastPlay}
                        videoRef={videoRef}
                        speed={speed}
                        onSetSpeed={setSpeed}
                        editingPlay={editingPlay}
                        onCancelEdit={cancelEdit}
                        sport={film?.sport}
                      />
                    </div>


                    {!isFullscreen && selTracks.some(t => t.snap_x != null) && (
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

                    {!isFullscreen && <PlayerMetricsRow
                      tracks={selTracks}
                      roster={roster}
                      highlightJersey={hlJersey}
                      onHighlight={j => setHlJersey(h => h === j ? null : j)}
                    />}
                  </div>

                  {/* Right: sticky play sidebar */}
                  <div className="sidebar-sticky" style={{
                    background: DS.cardBg, border: `1px solid ${DS.border}`, borderRadius: 14,
                    padding: 14, position: "sticky", top: 72,
                    maxHeight: "calc(100vh - 90px)",
                    display: "flex", flexDirection: "column",
                  }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10, flexShrink: 0 }}>
                      <p style={{ margin: 0, fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: DS.labelText }}>
                        {plays.length} {plays.length === 1 ? "Play" : "Plays"}
                      </p>
                    </div>

                    {plays.length === 0 && (
                      <div style={{ textAlign: "center", padding: "24px 0", flexShrink: 0 }}>
                        <Film size={28} color={DS.dimText} style={{ opacity: 0.25, marginBottom: 10 }} />
                        <p style={{ margin: "0 0 4px", fontSize: 13, fontWeight: 700, color: DS.bodyText }}>
                          {isProcessing ? "Analyzing film…" : "No plays yet"}
                        </p>
                        <p style={{ margin: 0, fontSize: 12, color: DS.labelText }}>
                          {isProcessing ? "Play detection in progress." : "Press S to mark snap, W to mark end."}
                        </p>
                      </div>
                    )}

                    <PlaySidebar
                      plays={plays}
                      selectedId={selPlay?.id}
                      onSelect={selectPlay}
                      onEdit={startEdit}
                      onDelete={deletePlay}
                      onMove={movePlay}
                      onAnnotate={p => setAnnotatingPlay(p)}
                      playlists={playlists}
                      onAddToPlaylist={addToPlaylist}
                      onCreateAndAddToPlaylist={createAndAdd}
                    />
                  </div>
                </div>
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
                    <TendencyReport plays={plays} analytics={analytics} />
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

          {/* CUT-UPS TAB */}
          {tab === "cutups" && (
            <PlaylistsTab
              playlists={playlists}
              filmId={id}
              onPlay={startCutup}
              onDelete={deletePlaylist}
              onRemovePlay={removePlayFromList}
              onRename={renamePlaylist}
              onPublish={publishPlaylist}
              onUnpublish={unpublishPlaylist}
              fetchPlaylists={fetchPlaylists}
              onCreateCrossGame={createCrossGamePlaylist}
            />
          )}

          {tab === "views" && (() => {
            if (!isPublished) return (
              <div style={{ textAlign: "center", padding: "48px 24px" }}>
                <Users size={32} color={DS.dimText} style={{ opacity: 0.3, marginBottom: 12 }} />
                <p style={{ margin: "0 0 6px", fontSize: 15, fontWeight: 700, color: DS.bodyText }}>Film not shared yet</p>
                <p style={{ margin: 0, fontSize: 13, color: DS.dimText }}>Share with team to start tracking who has watched.</p>
              </div>
            );
            if (watchStats === null) return (
              <div style={{ textAlign: "center", padding: 48 }}>
                <div style={{ width: 20, height: 20, border: `2px solid ${DS.brand}`, borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.7s linear infinite", margin: "0 auto" }} />
              </div>
            );

            const isCara         = viewingType === "cara";
            const watchedIds     = new Set((watchStats.watchers ?? []).map(w => (w.athlete_id || "").toLowerCase()));
            const activeAthletes = teamAthletes.filter(a => a.status !== "inactive");
            const notWatched     = activeAthletes.filter(a => !watchedIds.has((a.email || "").toLowerCase()));
            const watched        = watchStats.watchers ?? [];
            const total          = activeAthletes.length;

            const Avatar = ({ initial, color }) => (
              <div style={{ width: 34, height: 34, borderRadius: "50%", background: color + "22", border: `1px solid ${color}44`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <span style={{ fontSize: 13, fontWeight: 800, color }}>{initial}</span>
              </div>
            );

            const watchedPct  = total > 0 ? Math.round((watched.length / total) * 100) : 0;
            const dueFmt      = formatDueDate(watchDueDate);
            const isPastDue   = isCara && dueFmt?.overdue;

            return (
              <div style={{ display: "flex", flexDirection: "column" }}>
                {/* Hero progress bar */}
                <div style={{ padding: "14px 4px 16px", borderBottom: `1px solid ${DS.border}`, marginBottom: 4 }}>
                  <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 8 }}>
                    <span style={{ fontSize: 22, fontWeight: 800, color: DS.bodyText }}>
                      {watched.length}<span style={{ fontSize: 14, fontWeight: 600, color: DS.dimText }}>/{total}</span>
                    </span>
                    <span style={{ fontSize: 11, fontWeight: 600,
                      color: isPastDue ? "#C8102E" : dueFmt?.soon ? DS.warn : DS.dimText }}>
                      {dueFmt ? dueFmt.label : "athletes watched"}
                    </span>
                  </div>
                  <div style={{ height: 8, borderRadius: 6, background: DS.pageBg, overflow: "hidden" }}>
                    <div style={{
                      height: "100%", borderRadius: 6,
                      width: `${watchedPct}%`,
                      background: watchedPct === 100 ? DS.safe : isPastDue ? "#C8102E" : isCara ? DS.brand : DS.safe,
                      transition: "width 0.6s ease",
                    }} />
                  </div>
                  {!isCara && (
                    <p style={{ margin: "8px 0 0", fontSize: 11, color: DS.dimText, display: "flex", alignItems: "center", gap: 5 }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={DS.dimText} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                        <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
                      </svg>
                      Voluntary Study — athletes view at their own pace
                    </p>
                  )}
                </div>

                {/* Hasn't watched / Past due — CARA only */}
                {isCara && notWatched.length > 0 && (
                  <>
                    <div style={{ padding: "12px 4px 6px", display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.06em",
                        color: isPastDue ? "#C8102E" : DS.warn }}>
                        {isPastDue ? "Past Due" : "Hasn't Watched"}
                      </span>
                      <span style={{ fontSize: 10, color: DS.dimText }}>· {notWatched.length}</span>
                    </div>
                    {notWatched.map((a, i) => (
                      <div key={a.id ?? i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 4px", borderBottom: `1px solid ${DS.border}` }}>
                        <Avatar initial={(a.name || "?")[0].toUpperCase()} color={isPastDue ? "#C8102E" : DS.warn} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: DS.bodyText }}>{a.name || "Athlete"}</p>
                          <p style={{ margin: 0, fontSize: 11, color: isPastDue ? "#C8102E" : DS.dimText, marginTop: 1 }}>
                            {isPastDue ? "Missed the deadline" : "Hasn't opened yet"}
                          </p>
                        </div>
                        <button
                          onClick={() => router.push(`/org/messaging?to=${encodeURIComponent(a.email)}`)}
                          style={{ background: "none", border: `1px solid ${isPastDue ? "rgba(200,16,46,0.3)" : DS.border}`, borderRadius: 7, padding: "4px 10px", fontSize: 11, fontWeight: 600, color: isPastDue ? "#C8102E" : DS.labelText, cursor: "pointer", flexShrink: 0 }}
                        >Remind</button>
                      </div>
                    ))}
                  </>
                )}

                {/* Watched */}
                {watched.length > 0 && (
                  <>
                    <div style={{ padding: isCara ? "14px 4px 6px" : "12px 4px 6px", display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ fontSize: 10, fontWeight: 800, color: DS.safe, textTransform: "uppercase", letterSpacing: "0.06em" }}>Watched</span>
                      <span style={{ fontSize: 10, color: DS.dimText }}>· {watched.length}</span>
                    </div>
                    {watched.map((w, i) => {
                      const pct    = w.total_plays > 0 ? Math.round((w.plays_watched / w.total_plays) * 100) : 0;
                      const allDone = w.total_plays > 0 && w.plays_watched >= w.total_plays;
                      return (
                        <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 4px", borderBottom: `1px solid ${DS.border}` }}>
                          <Avatar initial={(w.athlete_name || "?")[0].toUpperCase()} color={DS.brand} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: DS.bodyText }}>{w.athlete_name || "Athlete"}</p>
                            <p style={{ margin: 0, fontSize: 11, color: DS.dimText, marginTop: 1 }}>
                              {new Date(w.last_watched_at).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                            </p>
                            {w.total_plays > 0 && (
                              <div style={{ marginTop: 5, display: "flex", alignItems: "center", gap: 7 }}>
                                <div style={{ flex: 1, height: 3, borderRadius: 2, background: DS.pageBg, overflow: "hidden" }}>
                                  <div style={{ width: `${pct}%`, height: "100%", borderRadius: 2, background: allDone ? DS.safe : DS.brand }} />
                                </div>
                                <span style={{ fontSize: 10, fontWeight: 800, color: allDone ? DS.safe : DS.labelText, flexShrink: 0 }}>
                                  {w.plays_watched}/{w.total_plays} plays
                                </span>
                              </div>
                            )}
                          </div>
                          <div style={{ width: 8, height: 8, borderRadius: "50%", background: allDone ? DS.safe : DS.brand, flexShrink: 0 }} />
                        </div>
                      );
                    })}
                  </>
                )}

                {watched.length === 0 && notWatched.length === 0 && (
                  <div style={{ textAlign: "center", padding: "40px 24px" }}>
                    <Users size={28} color={DS.dimText} style={{ opacity: 0.3, marginBottom: 10 }} />
                    <p style={{ margin: 0, fontSize: 13, color: DS.dimText }}>No athletes on your roster yet.</p>
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      </div>

      {/* Annotation Modal */}
      {annotatingPlay && (
        <AnnotationModal
          play={annotatingPlay}
          onSave={(playId, newAnnotation) => {
            setPlays(prev => prev.map(p => p.id === playId ? { ...p, coach_annotation: newAnnotation } : p));
            if (selPlay?.id === playId) setSelPlay(prev => ({ ...prev, coach_annotation: newAnnotation }));
          }}
          onClose={() => setAnnotatingPlay(null)}
        />
      )}
    </>
  );
}
