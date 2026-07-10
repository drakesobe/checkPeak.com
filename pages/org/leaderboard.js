// pages/org/leaderboard.js
// Org leaderboard — top performers by stat across all athletes this season.

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/router";
import { useAuthContext } from "@/hooks/useAuth";
import {
  Trophy, ChevronLeft, Shield, TrendingUp, BarChart2, Users, ChevronDown,
} from "lucide-react";
import { SPORT_LABELS, ALL_SPORTS } from "@/lib/sportStats";

const DS = {
  bg:       "#F4F7FB",
  surface:  "#FFFFFF",
  card:     "#FFFFFF",
  border:   "#E2E8F0",
  border2:  "#D1DAE8",
  brand:    "#1E3A5F",
  brandBg:  "#EEF3F9",
  accent:   "#2563EB",
  accentBg: "#EFF6FF",
  bodyText: "#1A2540",
  dim:      "#4B5E7A",
  muted:    "#8195B0",
  labelText:"#6B7FA0",
  safe:     "#00873E",
  safeBg:   "#F0FBF4",
  gold:     "#B45309",
  goldBg:   "#FEF3C7",
  line:     "#E8EDF4",
};

const CURRENT_YEAR = new Date().getFullYear();

const RANK_COLORS = ["#B45309", "#64748B", "#92400E"];
const RANK_BG     = ["#FEF3C7", "#F1F5F9", "#FDF4EC"];

const FOOTBALL_BOARDS = [
  { key: "pass_yds",  label: "Pass Yards",   group: "qb" },
  { key: "pass_td",   label: "Pass TDs",     group: "qb" },
  { key: "rush_yds",  label: "Rush Yards",   group: "skill" },
  { key: "rush_td",   label: "Rush TDs",     group: "skill" },
  { key: "rec_yds",   label: "Rec Yards",    group: "skill" },
  { key: "rec",       label: "Receptions",   group: "skill" },
  { key: "tackles",   label: "Tackles",      group: "defense" },
  { key: "sacks",     label: "Sacks",        group: "defense" },
];

export default function Leaderboard() {
  const router       = useRouter();
  const { user, isOrg, authReady } = useAuthContext();

  const [sport,    setSport]    = useState("football");
  const [season,   setSeason]   = useState(CURRENT_YEAR);
  const [boards,   setBoards]   = useState([]);
  const [loading,  setLoading]  = useState(false);
  const [showSport,setShowSport]= useState(false);

  const load = useCallback(async () => {
    if (!sport) return;
    setLoading(true);
    try {
      const r = await fetch(`/api/org/leaderboard?sport=${sport}&season=${season}`, { credentials: "include" });
      const d = await r.json();
      if (d.ok) setBoards(d.boards || []);
    } catch {}
    setLoading(false);
  }, [sport, season]);

  useEffect(() => { if (authReady && isOrg) load(); }, [load, authReady, isOrg]);

  if (!authReady) return null;
  if (!isOrg) return <div style={{ padding: 32, color: DS.muted }}>Not authorized.</div>;

  return (
    <div style={{ minHeight: "100vh", background: DS.bg }}>
      {/* Header */}
      <div style={{ background: DS.surface, borderBottom: `1px solid ${DS.border}`, position: "sticky", top: 0, zIndex: 20 }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "14px 20px", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <button onClick={() => router.back()} style={{ background: "none", border: "none", cursor: "pointer", display: "flex", padding: 4 }}>
            <ChevronLeft size={20} color={DS.muted} />
          </button>
          <Trophy size={18} color={DS.gold} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: DS.bodyText }}>Leaderboard</div>
            <div style={{ fontSize: 11, color: DS.dim }}>{SPORT_LABELS[sport] || sport} · {season} Season</div>
          </div>
          {/* Season */}
          <div style={{ display: "flex", gap: 6 }}>
            {[CURRENT_YEAR, CURRENT_YEAR - 1, CURRENT_YEAR - 2].map(y => (
              <button key={y} onClick={() => setSeason(y)} style={{
                padding: "5px 12px", borderRadius: 7, border: `1px solid ${season === y ? DS.accent : DS.border}`,
                background: season === y ? DS.accentBg : DS.surface,
                color: season === y ? DS.accent : DS.dim,
                fontSize: 12, fontWeight: 700, cursor: "pointer",
              }}>{y}</button>
            ))}
          </div>
          {/* Sport picker */}
          <div style={{ position: "relative" }}>
            <button onClick={() => setShowSport(s => !s)} style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 12px", borderRadius: 8, border: `1px solid ${DS.border}`, background: DS.surface, color: DS.bodyText, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
              {SPORT_LABELS[sport] || sport} <ChevronDown size={13} />
            </button>
            {showSport && (
              <div style={{ position: "absolute", right: 0, top: "calc(100% + 4px)", background: DS.surface, border: `1px solid ${DS.border}`, borderRadius: 10, zIndex: 100, minWidth: 160, boxShadow: "0 8px 24px rgba(0,0,0,0.1)", overflow: "hidden" }}>
                {ALL_SPORTS.map(s => (
                  <button key={s} onClick={() => { setSport(s); setShowSport(false); }} style={{ display: "block", width: "100%", padding: "10px 14px", background: sport === s ? DS.brandBg : "none", border: "none", textAlign: "left", fontSize: 13, fontWeight: sport === s ? 700 : 500, color: sport === s ? DS.brand : DS.dim, cursor: "pointer" }}>
                    {SPORT_LABELS[s]}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "24px 20px" }}>
        {loading ? (
          <div style={{ display: "flex", justifyContent: "center", padding: 80 }}>
            <div style={{ width: 28, height: 28, border: `2px solid ${DS.border}`, borderTopColor: DS.brand, borderRadius: "50%", animation: "spin 0.9s linear infinite" }} />
            <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
          </div>
        ) : boards.length === 0 ? (
          <div style={{ textAlign: "center", padding: "80px 20px", background: DS.surface, border: `1px solid ${DS.border}`, borderRadius: 16 }}>
            <BarChart2 size={36} color={DS.muted} style={{ opacity: 0.3, marginBottom: 16 }} />
            <div style={{ fontSize: 16, fontWeight: 700, color: DS.bodyText, marginBottom: 8 }}>No stats yet for {season}</div>
            <div style={{ fontSize: 13, color: DS.dim }}>Log game stats from film to populate the leaderboard.</div>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16 }}>
            {boards.map(board => (
              <div key={board.statKey} style={{ background: DS.surface, border: `1px solid ${DS.border}`, borderRadius: 14, overflow: "hidden" }}>
                {/* Board header */}
                <div style={{ padding: "14px 18px 12px", borderBottom: `1px solid ${DS.line}`, display: "flex", alignItems: "center", gap: 8 }}>
                  <TrendingUp size={14} color={DS.brand} />
                  <span style={{ fontSize: 13, fontWeight: 800, color: DS.bodyText }}>{board.label}</span>
                  <span style={{ marginLeft: "auto", fontSize: 11, fontWeight: 700, color: DS.labelText, letterSpacing: "0.05em" }}>{season}</span>
                </div>
                {/* Rows */}
                <div>
                  {board.entries.map((e, i) => (
                    <div key={e.athleteToken} style={{ display: "flex", alignItems: "center", gap: 12, padding: "13px 18px", borderBottom: i < board.entries.length - 1 ? `1px solid ${DS.line}` : "none", background: i === 0 ? DS.goldBg : "none" }}>
                      {/* Rank */}
                      <div style={{ width: 28, height: 28, borderRadius: 7, background: i < 3 ? RANK_BG[i] : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        <span style={{ fontSize: 13, fontWeight: 900, color: i < 3 ? RANK_COLORS[i] : DS.dim }}>
                          {i + 1}
                        </span>
                      </div>
                      {/* Avatar initials */}
                      <div style={{ width: 34, height: 34, borderRadius: "50%", background: DS.brandBg, border: `1px solid ${DS.border}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        <span style={{ fontSize: 12, fontWeight: 800, color: DS.brand }}>
                          {(e.name || "?").split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase()}
                        </span>
                      </div>
                      {/* Name + games */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: DS.bodyText, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.name}</div>
                        <div style={{ fontSize: 11, color: DS.dim, marginTop: 2 }}>{e.gp} {e.gp === 1 ? "game" : "games"}</div>
                      </div>
                      {/* Value */}
                      <div style={{ textAlign: "right", flexShrink: 0 }}>
                        <div style={{ fontSize: 22, fontWeight: 900, color: i === 0 ? DS.gold : DS.bodyText, letterSpacing: "-0.04em", lineHeight: 1 }}>{e.value}</div>
                        {e.verified && (
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 4, marginTop: 5 }}>
                            <Shield size={10} color={DS.safe} strokeWidth={2.5} />
                            <span style={{ fontSize: 10, fontWeight: 700, color: DS.safe, letterSpacing: "0.04em" }}>VERIFIED</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
