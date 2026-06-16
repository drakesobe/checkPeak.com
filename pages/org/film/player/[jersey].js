// pages/org/film/player/[jersey].js  —  Cross-game player deep dive
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { useAuthContext } from "@/hooks/useAuth";
import {
  ArrowLeft, Activity, Shield, TrendingUp, Zap,
  Film, Loader2, Users,
} from "lucide-react";

const DS = {
  pageBg:      "#F4F7FB",
  cardBg:      "#FFFFFF",
  brand:       "#1E3A5F",
  brandBg:     "#EEF3F9",
  brandBorder: "#C0D0E0",
  safe:        "#00873E",
  safeBg:      "#F0FBF4",
  safeBorder:  "#A8DFB8",
  caution:     "#B86000",
  cautionBg:   "#FFFBF0",
  warn:        "#C8102E",
  bodyText:    "#1A2535",
  labelText:   "#5A6A7D",
  dimText:     "#9BA8B4",
  border:      "#E8ECF0",
};

const TEAM_COLORS = {
  home:    { fill: "#1E3A5F", text: "#fff" },
  away:    { fill: "#9B1C1C", text: "#fff" },
  default: { fill: "#374151", text: "#fff" },
};

function fmtSpd(v) { return v != null ? `${Number(v).toFixed(1)} mph` : "–"; }
function fmtMs(v)  { return v != null ? `${v} ms` : "–"; }
function fmtAcc(v) { return v != null ? `${Number(v).toFixed(2)} m/s²` : "–"; }
function fmtPct(v) { return v != null ? `${v}%` : "–"; }

// Mini spark bar (speed visualizer using canvas alternative)
function SpeedBar({ value, max, color }) {
  const pct = max > 0 ? Math.min((value ?? 0) / max * 100, 100) : 0;
  return (
    <div style={{ height: 6, background: DS.border, borderRadius: 99, overflow: "hidden", flex: 1 }}>
      <div style={{ height: "100%", width: `${pct}%`, background: color ?? DS.brand, borderRadius: 99, transition: "width 0.5s ease" }} />
    </div>
  );
}

// Per-film performance card
function FilmPerformanceCard({ film, jersey, onClick }) {
  const col = TEAM_COLORS[film.team] ?? TEAM_COLORS.default;
  const sRate = film.plays > 0 ? Math.round(film.successes / film.plays * 100) : null;

  return (
    <div onClick={onClick} style={{
      border: `1px solid ${DS.border}`, borderRadius: 12, padding: "14px 16px",
      cursor: onClick ? "pointer" : "default", background: DS.cardBg,
      transition: "all 0.13s",
    }}
      onMouseEnter={e => { if (onClick) { e.currentTarget.style.borderColor = DS.brandBorder; e.currentTarget.style.boxShadow = "0 2px 12px rgba(30,58,95,0.07)"; } }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = DS.border; e.currentTarget.style.boxShadow = "none"; }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
        <Film size={15} color={DS.brand} />
        <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: DS.bodyText, flex: 1 }}>{film.title}</p>
        {sRate != null && (
          <span style={{
            fontSize: 11, fontWeight: 800, padding: "2px 8px", borderRadius: 12,
            color: sRate >= 60 ? DS.safe : sRate >= 40 ? DS.caution : DS.warn,
            background: sRate >= 60 ? DS.safeBg : sRate >= 40 ? DS.cautionBg : "#FFF0F0",
          }}>
            {sRate}% success
          </span>
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        {[
          { label: "Max Speed",  value: fmtSpd(film.maxSpeed),  hl: film.maxSpeed > 18 ? DS.safe : undefined },
          { label: "Avg Speed",  value: fmtSpd(film.avgSpeed),  hl: undefined },
          { label: "1st Step",   value: fmtMs(film.bestStep),   hl: film.bestStep != null && film.bestStep < 200 ? DS.safe : undefined },
          { label: "Peak Accel", value: fmtAcc(film.bestAccel), hl: undefined },
        ].map(s => (
          <div key={s.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 11, color: DS.dimText }}>{s.label}</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: s.hl ?? DS.bodyText }}>{s.value}</span>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px solid ${DS.border}`, display: "flex", gap: 12 }}>
        <span style={{ fontSize: 11, color: DS.dimText }}>{film.plays} plays tracked</span>
        {film.gameDate && <span style={{ fontSize: 11, color: DS.dimText }}>{new Date(film.gameDate).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span>}
      </div>
    </div>
  );
}

// Speed trend chart (simple SVG line)
function SpeedTrend({ filmStats }) {
  if (filmStats.length < 2) return null;

  const vals = filmStats.map(f => f.maxSpeed ?? 0);
  const minV = Math.min(...vals) * 0.9;
  const maxV = Math.max(...vals) * 1.05;

  const W = 400, H = 80, PAD = 16;
  const drawW = W - PAD * 2;
  const drawH = H - PAD;

  function px(i, v) {
    const x = PAD + (i / (vals.length - 1)) * drawW;
    const y = H - PAD - ((v - minV) / (maxV - minV || 1)) * drawH;
    return { x, y };
  }

  const pts = vals.map((v, i) => px(i, v));
  const pathD = pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");

  return (
    <div style={{ background: DS.cardBg, border: `1px solid ${DS.border}`, borderRadius: 12, padding: "16px 18px" }}>
      <p style={{ margin: "0 0 12px", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: DS.labelText }}>
        Top Speed Trend (mph)
      </p>
      <svg width="100%" viewBox={`0 0 ${W} ${H}`}>
        {/* Grid lines */}
        {[0.25, 0.5, 0.75, 1].map(t => {
          const y = H - PAD - t * drawH;
          const v = (minV + t * (maxV - minV)).toFixed(1);
          return (
            <g key={t}>
              <line x1={PAD} y1={y} x2={W - PAD} y2={y} stroke={DS.border} strokeWidth={1} />
              <text x={PAD - 2} y={y + 3} textAnchor="end" fontSize={8} fill={DS.dimText} fontFamily="system-ui">{v}</text>
            </g>
          );
        })}

        {/* Area fill */}
        <path
          d={`${pathD} L ${pts[pts.length - 1].x} ${H} L ${pts[0].x} ${H} Z`}
          fill={`${DS.brand}14`}
        />

        {/* Line */}
        <path d={pathD} fill="none" stroke={DS.brand} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />

        {/* Dots + labels */}
        {pts.map((p, i) => (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r={4} fill={DS.brand} stroke="#fff" strokeWidth={1.5} />
            <text x={p.x} y={H - 2} textAnchor="middle" fontSize={8} fill={DS.dimText} fontFamily="system-ui">
              {filmStats[i].gameDate
                ? new Date(filmStats[i].gameDate).toLocaleDateString(undefined, { month: "numeric", day: "numeric" })
                : `G${i + 1}`}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function PlayerDeepDivePage() {
  const router    = useRouter();
  const { jersey } = router.query;
  const { user }  = useAuthContext();

  const [allStats,  setAllStats]  = useState(null);
  const [filmStats, setFilmStats] = useState([]); // per-film breakdowns
  const [roster,    setRoster]    = useState([]);
  const [loading,   setLoading]   = useState(true);

  useEffect(() => {
    if (!jersey) return;
    const jerseyNum = Number(jersey);
    if (isNaN(jerseyNum)) return;

    Promise.all([
      // All-time aggregate for this jersey
      fetch(`/api/film/player-stats`, { credentials: "include" })
        .then(r => r.json())
        .then(d => {
          const p = (d.players ?? []).find(x => x.jersey === jerseyNum);
          setAllStats(p ?? null);
        }),

      // Per-film breakdown: fetch all films, then for each get player stats
      fetch("/api/film/list", { credentials: "include" })
        .then(r => r.json())
        .then(async d => {
          const films = (d.films ?? []).filter(f => f.status === "ready");
          const perFilm = await Promise.all(films.map(async film => {
            const r = await fetch(`/api/film/player-stats?filmId=${film.id}`, { credentials: "include" });
            const pd = await r.json();
            const p = (pd.players ?? []).find(x => x.jersey === jerseyNum);
            if (!p) return null;
            return {
              filmId:    film.id,
              title:     film.title,
              gameDate:  film.game_date,
              opponent:  film.opponent,
              ...p,
            };
          }));
          setFilmStats(perFilm.filter(Boolean).sort((a, b) => new Date(a.gameDate ?? 0) - new Date(b.gameDate ?? 0)));
        }),

      fetch("/api/film/roster", { credentials: "include" })
        .then(r => r.json())
        .then(d => setRoster(d.players ?? [])),
    ]).finally(() => setLoading(false));
  }, [jersey]);

  const rosterPlayer = roster.find(p => p.jersey_number === Number(jersey));
  const col = TEAM_COLORS[allStats?.team] ?? TEAM_COLORS.default;

  const summaryStats = useMemo(() => {
    if (!allStats) return [];
    return [
      { label: "Top Speed",     value: fmtSpd(allStats.maxSpeed),     sub: "career best",    Icon: TrendingUp, hl: allStats.maxSpeed > 18 ? DS.safe : undefined },
      { label: "Avg Speed",     value: fmtSpd(allStats.avgSpeed),     sub: "per play avg",   Icon: Activity },
      { label: "Best 1st Step", value: fmtMs(allStats.bestFirstStep), sub: "reaction time",  Icon: Zap, hl: allStats.bestFirstStep != null && allStats.bestFirstStep < 200 ? DS.safe : undefined },
      { label: "Success Rate",  value: fmtPct(allStats.successRate),  sub: `${allStats.successes}/${allStats.plays} plays`, Icon: Shield, hl: (allStats.successRate ?? 0) >= 60 ? DS.safe : undefined },
    ];
  }, [allStats]);

  if (loading) return (
    <div style={{ minHeight: "100vh", background: DS.pageBg, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <Loader2 size={28} color={DS.brand} style={{ animation: "spin 1s linear infinite" }} />
    </div>
  );

  if (!allStats && !loading) return (
    <div style={{ minHeight: "100vh", background: DS.pageBg, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12 }}>
      <Users size={36} color={DS.dimText} style={{ opacity: 0.3 }} />
      <p style={{ color: DS.labelText, fontSize: 14 }}>No data found for #{jersey}</p>
      <button onClick={() => router.push("/org/film")} style={{ background: "none", border: "none", cursor: "pointer", color: DS.brand, fontSize: 13, fontWeight: 600 }}>
        ← Back to Films
      </button>
    </div>
  );

  return (
    <>
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>

      <div style={{ minHeight: "100vh", background: DS.pageBg, fontFamily: "system-ui, sans-serif" }}>
        {/* Header */}
        <div style={{ background: DS.cardBg, borderBottom: `1px solid ${DS.border}`, padding: "14px 20px", position: "sticky", top: 0, zIndex: 50 }}>
          <div style={{ maxWidth: 900, margin: "0 auto", display: "flex", alignItems: "center", gap: 14 }}>
            <button onClick={() => router.back()} style={{ background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 5, color: DS.labelText, fontSize: 13, padding: 0 }}>
              <ArrowLeft size={15} /> Back
            </button>
            <div style={{ width: 1, height: 18, background: DS.border }} />
            <div style={{ width: 40, height: 40, borderRadius: 10, background: col.fill, color: col.text, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 15 }}>
              {jersey}
            </div>
            <div>
              <h1 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: DS.bodyText }}>
                {rosterPlayer ? rosterPlayer.player_name : `#${jersey}`}
              </h1>
              <p style={{ margin: 0, fontSize: 12, color: DS.labelText }}>
                {rosterPlayer?.position ? `${rosterPlayer.position} · ` : ""}
                {allStats?.filmCount ?? 0} film{(allStats?.filmCount ?? 0) !== 1 ? "s" : ""} · {allStats?.plays ?? 0} plays tracked
              </p>
            </div>
          </div>
        </div>

        <div style={{ maxWidth: 900, margin: "0 auto", padding: "24px 16px", display: "flex", flexDirection: "column", gap: 20 }}>

          {/* Summary cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 10 }}>
            {summaryStats.map(s => (
              <div key={s.label} style={{ background: DS.cardBg, border: `1px solid ${DS.border}`, borderRadius: 12, padding: "16px 16px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                  <s.Icon size={13} color={DS.brand} />
                  <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: DS.labelText }}>{s.label}</span>
                </div>
                <p style={{ margin: 0, fontSize: 28, fontWeight: 800, color: s.hl ?? DS.bodyText, lineHeight: 1.1 }}>{s.value}</p>
                <p style={{ margin: "4px 0 0", fontSize: 11, color: DS.dimText }}>{s.sub}</p>
              </div>
            ))}
          </div>

          {/* Speed trend */}
          {filmStats.length >= 2 && <SpeedTrend filmStats={filmStats} />}

          {/* Per-film breakdown */}
          {filmStats.length > 0 && (
            <div>
              <h2 style={{ margin: "0 0 12px", fontSize: 16, fontWeight: 700, color: DS.bodyText }}>
                Performance by Game
              </h2>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px,1fr))", gap: 10 }}>
                {filmStats.map(f => (
                  <FilmPerformanceCard
                    key={f.filmId}
                    film={f}
                    jersey={jersey}
                    onClick={() => router.push(`/org/film/${f.filmId}`)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* All-time speed leaderboard vs teammates */}
          <AllSpeedComparison jersey={Number(jersey)} rosterPlayer={rosterPlayer} />
        </div>
      </div>
    </>
  );
}

// ── All-time speed comparison vs teammates ────────────────────────────────────
function AllSpeedComparison({ jersey, rosterPlayer }) {
  const [allPlayers, setAllPlayers] = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [roster,     setRoster]     = useState([]);

  useEffect(() => {
    Promise.all([
      fetch("/api/film/player-stats", { credentials: "include" }).then(r => r.json()).then(d => setAllPlayers(d.players ?? [])),
      fetch("/api/film/roster", { credentials: "include" }).then(r => r.json()).then(d => setRoster(d.players ?? [])),
    ]).finally(() => setLoading(false));
  }, []);

  if (loading) return null;

  const home = allPlayers.filter(p => p.team !== "away" && p.maxSpeed != null)
                         .sort((a, b) => (b.maxSpeed ?? 0) - (a.maxSpeed ?? 0))
                         .slice(0, 10);

  if (!home.length) return null;

  const maxSpd = home[0]?.maxSpeed ?? 1;

  return (
    <div style={{ background: DS.cardBg, border: `1px solid ${DS.border}`, borderRadius: 12, padding: "18px 20px" }}>
      <h3 style={{ margin: "0 0 16px", fontSize: 14, fontWeight: 700, color: DS.bodyText }}>Speed Leaderboard</h3>
      <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
        {home.map((p, i) => {
          const rp    = roster.find(r => r.jersey_number === p.jersey);
          const name  = rp ? rp.player_name : `#${p.jersey}`;
          const isMe  = p.jersey === jersey;
          const color = isMe ? DS.brand : DS.dimText;
          const barColor = isMe ? DS.brand : DS.brandBorder;

          return (
            <div key={p.jersey} style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ width: 18, fontSize: 11, fontWeight: 700, color: i < 3 ? DS.brand : DS.dimText, textAlign: "right" }}>
                {i + 1}
              </span>
              <div style={{
                width: 28, height: 28, borderRadius: 7,
                background: isMe ? DS.brand : DS.pageBg,
                color: isMe ? "#fff" : DS.labelText,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 10, fontWeight: 800, flexShrink: 0,
              }}>
                {p.jersey}
              </div>
              <span style={{ width: 130, fontSize: 13, fontWeight: isMe ? 700 : 500, color: isMe ? DS.bodyText : DS.labelText, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {name}
              </span>
              <SpeedBar value={p.maxSpeed} max={maxSpd} color={barColor} />
              <span style={{ width: 52, fontSize: 12, fontWeight: 700, color, textAlign: "right", flexShrink: 0 }}>
                {fmtSpd(p.maxSpeed)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
