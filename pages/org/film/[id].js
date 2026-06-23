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
  ArrowLeftRight, Send, Clock, CheckCircle,
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
function VideoPlayer({ playbackId, s3Url, clipUrl, playNumber, onTimeUpdate, onDurationChange, videoRef }) {
  const fullFilmSrc = s3Url || null;
  const hasVideo = playbackId || fullFilmSrc || clipUrl;

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
const PLAY_TYPES = [
  { id: "run",         label: "RUN",  key: "R" },
  { id: "pass",        label: "PASS", key: "P" },
  { id: "punt",        label: "PUNT", key: "U" },
  { id: "kickoff",     label: "KICK", key: null },
  { id: "field_goal",  label: "FG",   key: null },
  { id: "extra_point", label: "XP",   key: null },
];
const FORMATIONS = ["shotgun","under_center","pistol","wildcat","i_formation","singleback"];
const RESULTS    = ["success","failure","td","turnover","penalty"];
const SPEEDS     = [0.5, 1, 1.5, 2];

function TagBar({ filmId, snapTime, whistleTime, onMarkSnap, onMarkWhistle, onClear, plays, onSaved, onSkip, onUndo, videoRef, speed, onSetSpeed, editingPlay, onCancelEdit }) {
  const nextNum = plays.length + 1;
  const [form,     setForm]     = useState({ down: "1", distance: "10", playType: "", formation: "", result: "", yardsGained: "", playDirection: "", hash: "", yardLine: "", personnel: "", labels: "", notes: "" });
  const [saving,   setSaving]   = useState(false);
  const [error,    setError]    = useState("");
  const [showMore, setShowMore] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

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
    setShowMore(true); // open details so coach can see all fields
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
      if (e.key === "r" || e.key === "R") { e.preventDefault(); setForm(p => ({ ...p, playType: p.playType === "run"  ? "" : "run"  })); }
      if (e.key === "p" || e.key === "P") { e.preventDefault(); setForm(p => ({ ...p, playType: p.playType === "pass" ? "" : "pass" })); }
      if (e.key === "u" || e.key === "U") { e.preventDefault(); setForm(p => ({ ...p, playType: p.playType === "punt" ? "" : "punt" })); }
      if (e.key === "g" || e.key === "G") { e.preventDefault(); setForm(p => ({ ...p, result: p.result === "success" ? "" : "success" })); }
      if (e.key === "f" || e.key === "F") { e.preventDefault(); setForm(p => ({ ...p, result: p.result === "failure" ? "" : "failure" })); }
      if (e.key === "1") { e.preventDefault(); setForm(p => ({ ...p, down: p.down === "1" ? "" : "1" })); }
      if (e.key === "2") { e.preventDefault(); setForm(p => ({ ...p, down: p.down === "2" ? "" : "2" })); }
      if (e.key === "3") { e.preventDefault(); setForm(p => ({ ...p, down: p.down === "3" ? "" : "3" })); }
      if (e.key === "4") { e.preventDefault(); setForm(p => ({ ...p, down: p.down === "4" ? "" : "4" })); }
      if (e.key === "[") { e.preventDefault(); if (a.videoRef?.current) a.videoRef.current.currentTime = Math.max(0, a.videoRef.current.currentTime - 5); }
      if (e.key === "]") { e.preventDefault(); if (a.videoRef?.current) a.videoRef.current.currentTime += 5; }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  function advanceDown(f) {
    const yards = Number(f.yardsGained), dist = Number(f.distance), down = Number(f.down);
    // Auto-advance yard_line based on yards gained (ball moves down the field)
    const newYL = f.yardLine && !isNaN(yards)
      ? String(Math.min(99, Math.max(1, Number(f.yardLine) + yards)))
      : f.yardLine;
    // Reset: play-specific fields. Keep: personnel, hash, yardLine (auto-advanced), formation
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

  async function savePlay() {
    const isEdit = !!editingPlay;
    if (!isEdit && snapTime == null) { setError("Mark the snap first — press S"); return; }
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
        advanceDown({ ...form });
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

  const clipSecs = snapTime != null && whistleTime != null ? (whistleTime - snapTime).toFixed(1) : null;
  const snapSet  = snapTime != null;
  const endSet   = whistleTime != null;
  const mob      = isMobile;

  // Solid dark background required for selects — transparent breaks option readability across browsers
  const selStyle = {
    border: "1px solid rgba(255,255,255,0.18)",
    borderRadius: 7,
    padding: mob ? "8px 10px" : "6px 10px",
    fontSize: mob ? 14 : 12,
    color: "#e2e8f0",
    background: "#1e293b",
    outline: "none",
    cursor: "pointer",
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
  const downActive = (n)  => form.down === String(n);

  return (
    <div style={{ background: "#0d1117", borderRadius: 12, padding: mob ? "10px 12px" : "12px 16px", display: "flex", flexDirection: "column", gap: mob ? 8 : 10, width: "100%", boxSizing: "border-box" }}>

      {/* ── Edit Mode Banner ── */}
      {editingPlay && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "rgba(37,99,235,0.15)", border: "1px solid rgba(96,165,250,0.3)", borderRadius: 7, padding: "7px 12px" }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: "#60a5fa" }}>✏ Editing Play #{editingPlay.play_number}</span>
          <button onClick={() => { onCancelEdit?.(); onClear?.(); }}
            style={{ background: "none", border: "none", color: "rgba(255,255,255,0.4)", fontSize: 12, cursor: "pointer", padding: "0 2px", fontWeight: 700 }}>
            ✕ Cancel
          </button>
        </div>
      )}

      {/* ── Row 1: Snap / End ── */}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <button onClick={onMarkSnap} style={markBtn(snapSet, { bg:"#1d4ed8", bd:"#3b82f6" })}>
          <span style={{ fontSize: 9, fontWeight: 900, background: snapSet ? "#60a5fa" : "rgba(255,255,255,0.18)", borderRadius: 3, padding: "1px 5px", color: "#0d1117", flexShrink: 0 }}>S</span>
          <span>{snapSet ? fmtTime(snapTime) : "Snap"}</span>
          {snapSet && <CheckCircle2 size={12} style={{ marginLeft: "auto", opacity: 0.8 }} />}
        </button>

        <span style={{ color: "rgba(255,255,255,0.2)", fontSize: 18, flexShrink: 0, lineHeight: 1 }}>→</span>

        <button onClick={onMarkWhistle} style={markBtn(endSet, { bg:"#15803d", bd:"#22c55e" })}>
          <span style={{ fontSize: 9, fontWeight: 900, background: endSet ? "#4ade80" : "rgba(255,255,255,0.18)", borderRadius: 3, padding: "1px 5px", color: "#0d1117", flexShrink: 0 }}>W</span>
          <span>{endSet ? fmtTime(whistleTime) : "End"}</span>
          {endSet && <CheckCircle2 size={12} style={{ marginLeft: "auto", opacity: 0.8 }} />}
        </button>

        {clipSecs && (
          <span style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", fontWeight: 700, background: "rgba(255,255,255,0.06)", borderRadius: 5, padding: "4px 9px", flexShrink: 0 }}>
            {clipSecs}s
          </span>
        )}
      </div>

      {/* ── Row 2a: Play Type buttons ── */}
      <div style={{ display: "grid", gridTemplateColumns: `repeat(${PLAY_TYPES.length}, 1fr)`, gap: 4, width: "100%" }}>
        {PLAY_TYPES.map(t => (
          <button key={t.id}
            onClick={() => set("playType", typeActive(t.id) ? "" : t.id)}
            title={t.key ? `Key: ${t.key}` : undefined}
            style={{
              padding: mob ? "9px 4px" : "7px 11px",
              fontSize: mob ? 11 : 11, fontWeight: 800, letterSpacing: "0.05em",
              borderRadius: 7, cursor: "pointer",
              border: `1.5px solid ${typeActive(t.id) ? typeColor(t.id) : "rgba(255,255,255,0.12)"}`,
              background: typeActive(t.id) ? typeColor(t.id) : "rgba(255,255,255,0.06)",
              color: typeActive(t.id) ? "#fff" : "rgba(255,255,255,0.5)",
            }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Row 2b (mobile) / Row 2 cont (desktop): Down + Distance + Direction ── */}
      <div style={{ display: "flex", alignItems: "center", gap: mob ? 5 : 8 }}>
        {/* Down buttons */}
        {[1,2,3,4].map(n => (
          <button key={n}
            onClick={() => set("down", downActive(n) ? "" : String(n))}
            title={`Key: ${n}`}
            style={{
              flex: mob ? 1 : "none",
              width:  mob ? undefined : 32, height: mob ? 36 : 32,
              fontSize: mob ? 15 : 13, fontWeight: 800, borderRadius: 7, cursor: "pointer",
              border: `1.5px solid ${downActive(n) ? "#94a3b8" : "rgba(255,255,255,0.12)"}`,
              background: downActive(n) ? "#334155" : "rgba(255,255,255,0.06)",
              color: downActive(n) ? "#fff" : "rgba(255,255,255,0.5)",
            }}>
            {n}
          </button>
        ))}

        <span style={{ color: "rgba(255,255,255,0.3)", fontSize: 13, fontWeight: 700, flexShrink: 0 }}>&</span>

        <input
          type="number" value={form.distance}
          onChange={e => set("distance", e.target.value)}
          placeholder="10"
          style={{
            width: mob ? 42 : 44, padding: mob ? "8px 4px" : "6px 6px",
            borderRadius: 7, border: "1.5px solid rgba(255,255,255,0.14)",
            background: "#1e293b", color: "#e2e8f0",
            fontSize: mob ? 14 : 13, fontWeight: 700, textAlign: "center", outline: "none",
          }}
        />

        <div style={{ flex: 1 }} />

        {/* Play Direction */}
        {[
          { id:"left",   icon:"←", label:"L" },
          { id:"middle", icon:"↑", label:"M" },
          { id:"right",  icon:"→", label:"R" },
        ].map(d => {
          const active = form.playDirection === d.id;
          return (
            <button key={d.id}
              onClick={() => set("playDirection", active ? "" : d.id)}
              style={{
                display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                width: mob ? 36 : 32, height: mob ? 36 : 32,
                fontSize: mob ? 14 : 11, fontWeight: 800, borderRadius: 7, cursor: "pointer",
                border: `1.5px solid ${active ? "#64748b" : "rgba(255,255,255,0.1)"}`,
                background: active ? "#334155" : "rgba(255,255,255,0.05)",
                color: active ? "#e2e8f0" : "rgba(255,255,255,0.4)",
                gap: 1, lineHeight: 1,
              }}>
              <span style={{ fontSize: mob ? 12 : 9 }}>{d.icon}</span>
              <span style={{ fontSize: mob ? 9 : 7, letterSpacing: "0.04em" }}>{d.label}</span>
            </button>
          );
        })}
      </div>

      {/* ── Row 2c: Result + Yards ── */}
      <div style={{ display: "flex", alignItems: "center", gap: mob ? 5 : 6 }}>
        {[
          { id: "success",  label: mob ? "SUC" : "Success",  title: "Success"   },
          { id: "failure",  label: mob ? "FAIL" : "Failure", title: "Failure"   },
          { id: "td",       label: "TD",                     title: "Touchdown" },
          { id: "turnover", label: "TO",                     title: "Turnover"  },
          { id: "penalty",  label: "PEN",                    title: "Penalty"   },
        ].map(r => {
          const active = form.result === r.id;
          const color  = r.id === "success" || r.id === "td" ? "#22c55e"
                       : r.id === "turnover" ? "#ef4444"
                       : r.id === "penalty"  ? "#f59e0b"
                       : "rgba(255,255,255,0.5)";
          return (
            <button key={r.id} onClick={() => set("result", active ? "" : r.id)} title={r.title}
              style={{
                flex: mob ? 1 : "none",
                padding: mob ? "8px 4px" : "6px 12px", fontSize: mob ? 12 : 11, fontWeight: 800,
                borderRadius: 6, cursor: "pointer",
                border: `1.5px solid ${active ? color : "rgba(255,255,255,0.12)"}`,
                background: active ? `${color}22` : "rgba(255,255,255,0.05)",
                color: active ? color : "rgba(255,255,255,0.45)",
              }}>
              {r.label}
            </button>
          );
        })}
        <span style={{ fontSize: 9, color: "rgba(255,255,255,0.35)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", flexShrink: 0, marginLeft: 2 }}>YDS</span>
        <input type="number" value={form.yardsGained} onChange={e => set("yardsGained", e.target.value)}
          placeholder="–"
          style={{ width: mob ? 48 : 44, padding: mob ? "8px 6px" : "6px 6px", borderRadius: 6, border: "1.5px solid rgba(255,255,255,0.14)", background: "#1e293b", color: "#e2e8f0", fontSize: mob ? 14 : 12, fontWeight: 700, textAlign: "center", outline: "none" }} />
      </div>

      {/* ── Row 2d: Personnel ── */}
      <div style={{ display: "flex", alignItems: "center", gap: mob ? 5 : 6 }}>
        <span style={{ fontSize: 9, color: "rgba(255,255,255,0.35)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", flexShrink: 0 }}>PERS</span>
        {["10","11","12","21","22"].map(g => {
          const active = form.personnel === g;
          return (
            <button key={g} onClick={() => set("personnel", active ? "" : g)}
              style={{
                flex: mob ? 1 : "none",
                padding: mob ? "8px 4px" : "6px 12px", fontSize: mob ? 12 : 11, fontWeight: 800,
                borderRadius: 6, cursor: "pointer",
                border: `1.5px solid ${active ? DS.brand : "rgba(255,255,255,0.12)"}`,
                background: active ? DS.brandBg : "rgba(255,255,255,0.05)",
                color: active ? DS.brand : "rgba(255,255,255,0.45)",
              }}>
              {g}
            </button>
          );
        })}
      </div>

      {/* ── Row 3: Save · Skip · Speed · Undo ── */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "nowrap" }}>
        <button onClick={savePlay} disabled={saving || (!editingPlay && !snapSet)}
          style={{
            flex: 1, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7,
            padding: mob ? "10px 10px" : "10px 20px",
            borderRadius: 9, border: "none", fontWeight: 800, fontSize: mob ? 13 : 13,
            background: (editingPlay || snapSet) ? (editingPlay ? "#1e40af" : DS.brand) : "rgba(255,255,255,0.06)",
            color: (editingPlay || snapSet) ? "#fff" : "rgba(255,255,255,0.2)",
            cursor: saving || (!editingPlay && !snapSet) ? "not-allowed" : "pointer",
            minWidth: 0,
          }}>
          {saving
            ? <Loader2 size={13} style={{ animation: "spin 1s linear infinite", flexShrink: 0 }} />
            : <CheckCircle2 size={13} style={{ flexShrink: 0 }} />}
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {saving ? "Saving…" : editingPlay ? `Update #${editingPlay.play_number}` : `Save #${nextNum}`}
          </span>
        </button>

        {!editingPlay && (
          <button onClick={onSkip} style={{
            padding: mob ? "10px 10px" : "10px 14px",
            borderRadius: 8, border: "1px solid rgba(255,255,255,0.12)",
            background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.45)",
            fontSize: mob ? 12 : 12, fontWeight: 700, cursor: "pointer", flexShrink: 0,
          }}>
            Skip
          </button>
        )}

        {/* Speed buttons — always visible, compact on mobile */}
        <div style={{ display: "flex", alignItems: "center", gap: 3, flexShrink: 0 }}>
          {SPEEDS.map(s => (
            <button key={s}
              onClick={() => { onSetSpeed?.(s); if (videoRef?.current) videoRef.current.playbackRate = s; }}
              style={{
                padding: mob ? "7px 7px" : "5px 8px",
                borderRadius: 6, border: "none", cursor: "pointer",
                fontSize: mob ? 11 : 10, fontWeight: 800,
                background: speed === s ? "#4FABFF" : "rgba(255,255,255,0.08)",
                color:      speed === s ? "#0d1117" : "rgba(255,255,255,0.5)",
              }}>
              {s}x
            </button>
          ))}
        </div>

        <button onClick={undoFormField} title="Undo last field (Z)"
          style={{
            background: "none", border: "none", cursor: "pointer",
            color: "rgba(255,255,255,0.4)",
            fontSize: mob ? 12 : 11, fontWeight: 700, padding: "4px 4px",
            display: "flex", alignItems: "center", gap: 2, flexShrink: 0,
          }}>
          ↩
        </button>
      </div>

      {/* ── Row 4: Details expansion (Formation / Result / Yards) ── */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", paddingTop: 2, borderTop: "1px solid rgba(255,255,255,0.06)" }}>
        <button onClick={() => setShowMore(m => !m)}
          style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.35)", fontSize: 11, fontWeight: 700, padding: "2px 0", display: "flex", alignItems: "center", gap: 4 }}>
          <span style={{ fontSize: 9 }}>{showMore ? "▾" : "▸"}</span> {showMore ? "Hide" : "Details"}
        </button>

        {showMore && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10, width: "100%", paddingTop: 4 }}>

            {/* Row A2: Hash + Yard line (always one row — 5 buttons + YD input) */}
            <div style={{ display: "flex", alignItems: "center", gap: mob ? 5 : 6 }}>
              <span style={{ fontSize: 9, color: "rgba(255,255,255,0.35)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", flexShrink: 0 }}>HASH</span>
              {[
                { id:"left_wide",  short:"LW" },
                { id:"left_hash",  short:"LH" },
                { id:"middle",     short:"MID" },
                { id:"right_hash", short:"RH" },
                { id:"right_wide", short:"RW" },
              ].map(h => {
                const active = form.hash === h.id;
                return (
                  <button key={h.id} onClick={() => set("hash", active ? "" : h.id)}
                    style={{
                      flex: mob ? 1 : "none",
                      padding: mob ? "7px 2px" : "5px 8px", fontSize: mob ? 11 : 10, fontWeight: 800,
                      borderRadius: 6, cursor: "pointer",
                      border: `1.5px solid ${active ? "#94a3b8" : "rgba(255,255,255,0.1)"}`,
                      background: active ? "#334155" : "rgba(255,255,255,0.04)",
                      color: active ? "#e2e8f0" : "rgba(255,255,255,0.4)",
                    }}>
                    {h.short}
                  </button>
                );
              })}
              <span style={{ fontSize: 9, color: "rgba(255,255,255,0.35)", fontWeight: 700, flexShrink: 0, marginLeft: 4 }}>YD</span>
              <input type="number" value={form.yardLine} onChange={e => set("yardLine", e.target.value)}
                placeholder="–"
                style={{ width: mob ? 44 : 42, padding: mob ? "7px 6px" : "5px 6px", borderRadius: 6, border: "1px solid rgba(255,255,255,0.14)", background: "#1e293b", color: "#e2e8f0", fontSize: mob ? 13 : 12, fontWeight: 700, textAlign: "center", outline: "none" }}
              />
            </div>

            {/* Row B: Formation */}
            <div style={{ display: "flex", alignItems: "center", gap: mob ? 8 : 6, flexWrap: "wrap" }}>
              <select value={form.formation} onChange={e => set("formation", e.target.value)} style={selStyle}>
                <option value="" style={optStyle}>Formation</option>
                {FORMATIONS.map(f => <option key={f} value={f} style={optStyle}>{cap(f)}</option>)}
              </select>
            </div>

            {/* Row C: Custom labels */}
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 9, color: "rgba(255,255,255,0.35)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", flexShrink: 0 }}>TAGS</span>
              <input type="text" value={form.labels} onChange={e => set("labels", e.target.value)}
                placeholder="red_zone, 3rd_down, blitz… (comma-separated)"
                style={{ flex: 1, padding: mob ? "9px 12px" : "5px 10px", borderRadius: 7, border: "1px solid rgba(255,255,255,0.14)", background: "#1e293b", color: "#e2e8f0", fontSize: mob ? 13 : 11, outline: "none" }} />
            </div>

            {/* Row D: Coach notes */}
            <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
              <span style={{ fontSize: 9, color: "rgba(255,255,255,0.35)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", flexShrink: 0, paddingTop: 8 }}>NOTE</span>
              <textarea value={form.notes} onChange={e => set("notes", e.target.value)}
                placeholder="Coach note for this play…"
                rows={2}
                style={{ flex: 1, padding: mob ? "8px 12px" : "5px 10px", borderRadius: 7, border: "1px solid rgba(255,255,255,0.14)", background: "#1e293b", color: "#e2e8f0", fontSize: mob ? 13 : 11, outline: "none", resize: "none", fontFamily: "inherit" }} />
            </div>
          </div>
        )}

        {/* Keyboard hints — desktop only, when details are collapsed */}
        {!mob && !showMore && (
          <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
            {[["S","snap"],["W","end"],["R","run"],["P","pass"],["1–4","dn"],["↵","save"],["N","skip"],["Z","undo"],["G","success"],["F","fail"]].map(([k,l]) => (
              <span key={k} style={{ fontSize: 9, color: "rgba(255,255,255,0.2)" }}>
                <span style={{ background: "rgba(255,255,255,0.1)", borderRadius: 3, padding: "1px 4px", fontWeight: 800, marginRight: 2 }}>{k}</span>{l}
              </span>
            ))}
          </div>
        )}
      </div>

      {error && <p style={{ margin: 0, fontSize: 12, color: "#f87171" }}>{error}</p>}
    </div>
  );
}

// ── Play Sidebar ──────────────────────────────────────────────────────────────
function PlaySidebar({ plays, selectedId, onSelect, onEdit, onDelete, onMove, playlists, onAddToPlaylist, onCreateAndAddToPlaylist }) {
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
                      onClick={e => { e.stopPropagation(); onEdit?.(play); }}
                      style={{ background: "none", border: "none", cursor: "pointer", padding: "2px 4px", borderRadius: 4, fontSize: 10, color: DS.dimText, lineHeight: 1 }}
                      title="Edit play"
                    >✏</button>
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

// ── Playlists Tab ─────────────────────────────────────────────────────────────
function PlaylistsTab({ playlists, onPlay, onDelete, onRemovePlay, onRename, filmId, fetchPlaylists, onCreateCrossGame }) {
  const [openId,      setOpenId]      = useState(null);
  const [renaming,    setRenaming]    = useState(null);
  const [newCGName,   setNewCGName]   = useState("");
  const [showNewCG,   setShowNewCG]   = useState(false);
  const [busyCG,      setBusyCG]      = useState(false);

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
          <button onClick={() => setShowNewCG(false)} style={{ background: "none", border: "none", cursor: "pointer", color: DS.dimText, fontSize: 18 }}>✕</button>
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

          <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
            <button onClick={() => onPlay(list)} disabled={!(list.items ?? []).length}
              style={{
                display: "inline-flex", alignItems: "center", gap: 5,
                background: DS.brand, color: "#fff", border: "none", borderRadius: 8,
                padding: "8px 14px", fontSize: 12, fontWeight: 700, cursor: (list.items ?? []).length ? "pointer" : "not-allowed",
                opacity: (list.items ?? []).length ? 1 : 0.4,
              }}>
              <Play size={12} /> Play All
            </button>
            <button onClick={() => setOpenId(list.id)}
              style={{ background: DS.pageBg, border: `1px solid ${DS.border}`, borderRadius: 8, padding: "8px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer", color: DS.labelText, display: "flex", alignItems: "center", gap: 4 }}>
              <ChevronRight size={13} /> View
            </button>
            <button onClick={() => { setRenaming(list.id); setRenameVal(list.name); }}
              style={{ background: DS.pageBg, border: `1px solid ${DS.border}`, borderRadius: 8, padding: "8px 10px", cursor: "pointer", color: DS.dimText }}>
              ✏
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
          style={{ background: "rgba(220,38,38,0.8)", border: "none", borderRadius: 8, padding: "8px 12px", cursor: "pointer", color: "#fff", fontSize: 12, fontWeight: 700 }}>
          ✕ Exit
        </button>
      </div>
    </div>
  );
}

// ── Telestration — canvas only, no toolbar ────────────────────────────────────
const TELE_TOOLS  = [
  { id: "arrow", label: "Arrow",  icon: "↗" },
  { id: "pen",   label: "Pen",    icon: "✏" },
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
function VideoControlBar({ videoRef, drawMode, onDrawToggle, strokes, onStrokesChange, tool, onToolChange, color, onColorChange, onFullscreenToggle }) {
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
            style={{...btn({padding:"4px 9px",fontSize:11,fontWeight:700,opacity:strokes.length?1:0.35})}}>
            ✕ Clear
          </button>
        </div>
      )}

      {/* Main controls row — always same layout, never moves */}
      <div style={{ display:"flex", alignItems:"center", padding:"8px 12px", gap:8 }}>
        {/* Play — always far left */}
        <button onClick={togglePlay} style={{...btn({width:36,height:36,fontSize:18})}}>
          {playing ? "⏸" : "▶"}
        </button>

        <div style={{flex:1}} />

        {/* Draw / Done — always same spot, second from right */}
        <button onClick={onDrawToggle}
          style={{...btn({padding:"6px 14px",fontSize:12,fontWeight:700,
            background: drawMode ? "#1E3A5F" : "rgba(255,255,255,0.08)",
          })}}>
          {drawMode ? "✓ Done" : "✏ Draw"}
        </button>

        {/* Maximize — always far right */}
        <button onClick={onFullscreenToggle} style={{...btn({width:36,height:36,fontSize:16})}}>⛶</button>
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
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: DS.dimText, fontSize: 20, lineHeight: 1 }}>✕</button>
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
  const [email,   setEmail]   = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [err,     setErr]     = useState("");
  const [sent,    setSent]    = useState(null); // { inSystem, receivingOrgName }

  const filmTitle = film?.title || (film?.opponent ? `vs ${film.opponent}` : "Game Film");
  const playCount = film?.play_count ?? 0;

  async function send() {
    if (!email.includes("@")) { setErr("Enter a valid email address"); return; }
    setLoading(true); setErr("");
    try {
      const r = await fetch("/api/film/exchange", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filmId: film?.id, receivingEmail: email.trim().toLowerCase(), message: message.trim() }),
      });
      const d = await r.json();
      if (!d.ok) { setErr(d.error ?? "Failed to send request"); setLoading(false); return; }
      setSent({ inSystem: d.inSystem, receivingOrgName: d.receivingOrgName });
      onSent?.();
    } catch { setErr("Network error — please try again"); }
    setLoading(false);
  }

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ background: DS.cardBg, borderRadius: 20, padding: "26px 26px 22px", maxWidth: 460, width: "100%", boxShadow: "0 32px 80px rgba(0,0,0,0.25)" }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 22 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <ArrowLeftRight size={18} color={DS.brand} />
            <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: DS.bodyText }}>Exchange Film</h2>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: DS.dimText, fontSize: 20, lineHeight: 1 }}>✕</button>
        </div>

        {sent ? (
          /* ── Sent confirmation ── */
          <div style={{ textAlign: "center", padding: "16px 0 8px" }}>
            <div style={{ width: 56, height: 56, borderRadius: 28, background: "rgba(52,199,89,0.12)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
              <CheckCircle size={28} color="#34C759" />
            </div>
            <h3 style={{ margin: "0 0 8px", fontSize: 18, fontWeight: 800, color: DS.bodyText }}>Request Sent</h3>
            <p style={{ margin: "0 0 20px", fontSize: 14, color: DS.labelText, lineHeight: 1.6 }}>
              {sent.receivingOrgName
                ? <><strong style={{ color: DS.bodyText }}>{sent.receivingOrgName}</strong> is already on CheckPeak and will be notified.</>
                : <>An email has been sent to <strong style={{ color: DS.bodyText }}>{email}</strong> with a link to view your film and upload theirs.</>
              }
            </p>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "rgba(255,255,255,0.06)", borderRadius: 20, padding: "5px 14px" }}>
              <Clock size={12} color={DS.dimText} />
              <span style={{ fontSize: 12, color: DS.dimText, fontWeight: 600 }}>Pending response</span>
            </div>
            <div style={{ marginTop: 22 }}>
              <button onClick={onClose} style={{ background: DS.brand, color: "#fff", border: "none", borderRadius: 10, padding: "11px 32px", fontSize: 13, fontWeight: 800, cursor: "pointer" }}>
                Done
              </button>
            </div>
          </div>
        ) : (
          /* ── Form ── */
          <>
            {/* You're offering */}
            <div style={{ background: DS.sectionBg ?? "rgba(255,255,255,0.04)", borderRadius: 12, padding: "14px 16px", marginBottom: 20, border: `1px solid ${DS.border}` }}>
              <div style={{ fontSize: 10, fontWeight: 800, color: DS.brand, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8 }}>You're offering</div>
              <div style={{ fontSize: 15, fontWeight: 800, color: DS.bodyText, marginBottom: 2 }}>{filmTitle}</div>
              {film?.game_date && (
                <div style={{ fontSize: 12, color: DS.labelText, marginBottom: 8 }}>
                  {new Date(film.game_date).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
                </div>
              )}
              {playCount > 0 && (
                <div style={{ display: "inline-flex", alignItems: "center", gap: 5, background: DS.brandBg, borderRadius: 8, padding: "3px 9px" }}>
                  <Tag size={11} color={DS.brand} />
                  <span style={{ fontSize: 11, fontWeight: 700, color: DS.brand }}>{playCount} plays tagged</span>
                </div>
              )}
            </div>

            {/* Opposing coach email */}
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: DS.labelText, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 6 }}>
                Opposing Coach's Email
              </label>
              <input
                type="email" value={email} onChange={e => setEmail(e.target.value)}
                placeholder="coach@school.edu"
                style={{ width: "100%", boxSizing: "border-box", background: DS.inputBg ?? "#f8fafc", border: `1.5px solid ${DS.border}`, borderRadius: 10, padding: "11px 14px", fontSize: 14, color: DS.bodyText, outline: "none" }}
                onKeyDown={e => e.key === "Enter" && send()}
              />
            </div>

            {/* Optional message */}
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: DS.labelText, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 6 }}>
                Message <span style={{ color: DS.dimText, fontWeight: 500, textTransform: "none" }}>(optional)</span>
              </label>
              <textarea
                value={message} onChange={e => setMessage(e.target.value)}
                placeholder={`Hey Coach — here's our film from last week. Looking forward to the game!`}
                rows={3}
                style={{ width: "100%", boxSizing: "border-box", background: DS.inputBg ?? "#f8fafc", border: `1.5px solid ${DS.border}`, borderRadius: 10, padding: "11px 14px", fontSize: 13, color: DS.bodyText, outline: "none", resize: "vertical", fontFamily: "inherit", lineHeight: 1.5 }}
              />
            </div>

            {err && <p style={{ margin: "0 0 14px", fontSize: 13, color: "#EF4444", fontWeight: 600 }}>{err}</p>}

            <button
              onClick={send} disabled={loading || !email}
              style={{ width: "100%", padding: "13px 0", borderRadius: 12, border: "none", cursor: loading || !email ? "not-allowed" : "pointer", background: email ? DS.brand : "rgba(255,255,255,0.1)", color: email ? "#fff" : DS.dimText, fontSize: 14, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, opacity: loading ? 0.7 : 1 }}>
              {loading ? "Sending…" : <><Send size={14} /> Send Exchange Request</>}
            </button>
          </>
        )}
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
        <p style={{ margin: 0, fontSize: 11, color: DS.brand, fontWeight: 600, lineHeight: 1.5 }}>💡 {text}</p>
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
  const [showShare,    setShowShare]    = useState(false);
  const [showExchange, setShowExchange] = useState(false);
  const [exchanges,    setExchanges]    = useState([]);
  const [isFullscreen,  setIsFullscreen]  = useState(false);
  const [showOverlay,   setShowOverlay]   = useState(true);
  const [teleStrokes,   setTeleStrokes]   = useState([]);
  const [teleTool,      setTeleTool]      = useState("arrow");
  const [teleColor,     setTeleColor]     = useState("#FF3B30");
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


  // Initial load
  useEffect(() => {
    if (!id) return;
    Promise.all([
      fetchFilm(),
      fetchPlays(),
      fetchAnalytics(),
      fetchPlaylists(),
      fetchExchanges(),
      fetch("/api/film/roster", { credentials: "include" }).then(r => r.json()).then(d => setRoster(d.players ?? [])),
    ]).then(([filmData]) => {
      setLoading(false);
      // Fetch S3 presigned URL if Mux isn't available
      if (!filmData?.muxPlaybackId) fetchVideoUrl();
    });
  }, [id, fetchFilm, fetchPlays, fetchAnalytics, fetchVideoUrl]);

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

            {/* Share film / cut-up link — icon-only on mobile */}
            <button onClick={() => setShowShare(true)}
              style={{
                background: DS.brand, color: "#fff", border: "none",
                borderRadius: 8, padding: isMobile ? "7px 10px" : "7px 14px", fontSize: 12, fontWeight: 700,
                cursor: "pointer", display: "flex", alignItems: "center", gap: 5, flexShrink: 0,
              }}>
              <Share2 size={13} />{!isMobile && " Share"}
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
                return (
                  <div key={ex.id} style={{
                    display: "inline-flex", alignItems: "center", gap: 5,
                    fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 20,
                    background: isAccepted ? "rgba(52,199,89,0.1)" : "rgba(255,255,255,0.05)",
                    color: isAccepted ? "#34C759" : DS.dimText,
                    border: `1px solid ${isAccepted ? "rgba(52,199,89,0.25)" : DS.border}`,
                  }}>
                    <ArrowLeftRight size={10} />
                    {isAccepted ? "Exchange Accepted" : "Exchange Pending"}
                    {" · "}{ex.receiving_email}
                    {isAccepted && ex.received_film_id && (
                      <a href={`/org/film/${ex.received_film_id}`}
                        style={{ color: "#34C759", textDecoration: "none", fontWeight: 800, marginLeft: 2 }}>
                        View →
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
                <span style={{ fontSize: 12, color: DS.dimText }}>{film.play_count} plays analyzed</span>
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
                    {/* Video wrapper */}
                    <div style={{ position: "relative" }}>
                      <VideoPlayer
                        playbackId={film?.muxPlaybackId}
                        s3Url={filmVideoUrl}
                        clipUrl={selPlay?.clip_url}
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
              fetchPlaylists={fetchPlaylists}
              onCreateCrossGame={createCrossGamePlaylist}
            />
          )}
        </div>
      </div>
    </>
  );
}
