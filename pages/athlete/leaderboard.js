// pages/athlete/leaderboard.js
// Athlete-facing team leaderboard — see where you rank among teammates.

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/router";
import { useAuthContext } from "@/hooks/useAuth";
import { Trophy, ChevronLeft, Shield, TrendingUp, BarChart2, ChevronDown } from "lucide-react";
import { SPORT_LABELS, ALL_SPORTS } from "@/lib/sportStats";

// Dark athlete palette (matches stats.jsx)
const C = {
  bg:      "#0A0A0F",
  surface: "#0E0E16",
  card:    "#131320",
  card2:   "#181828",
  line:    "#1C1C2E",
  line2:   "#242438",
  white:   "#EEEEFF",
  dim:     "rgba(238,238,255,0.65)",
  muted:   "rgba(238,238,255,0.38)",
  faint:   "rgba(238,238,255,0.06)",
  accent:  "#4FABFF",
  green:   "#00C851",
  gold:    "#FFD700",
  goldBg:  "rgba(255,215,0,0.08)",
  meBg:    "rgba(79,171,255,0.10)",
  meBdr:   "rgba(79,171,255,0.28)",
};

const CURRENT_YEAR = new Date().getFullYear();

// Rank label colors — gold / silver / bronze on dark
const RANK_COLOR = ["#FFD700", "#A8B4C0", "#CD853F"];
const RANK_BG    = ["rgba(255,215,0,0.12)", "rgba(168,180,192,0.10)", "rgba(205,133,63,0.10)"];

export default function AthleteLeaderboard() {
  const router  = useRouter();
  const { user, authReady } = useAuthContext();

  const [sport,      setSport]      = useState("football");
  const [season,     setSeason]     = useState(CURRENT_YEAR);
  const [boards,     setBoards]     = useState([]);
  const [myToken,    setMyToken]    = useState("");
  const [loading,    setLoading]    = useState(false);
  const [showSport,  setShowSport]  = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`/api/athlete/leaderboard?sport=${sport}&season=${season}`, { credentials: "include" });
      const d = await r.json();
      if (d.ok) { setBoards(d.boards || []); setMyToken(d.myToken || ""); }
    } catch {}
    setLoading(false);
  }, [sport, season]);

  useEffect(() => { if (authReady) load(); }, [load, authReady]);

  if (!authReady) return null;

  return (
    <div style={{ minHeight: "100vh", background: C.bg, paddingBottom: 48 }}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg) } }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(12px) } to { opacity: 1; transform: none } }
      `}</style>

      {/* ── Header ── */}
      <div style={{ position: "sticky", top: 0, zIndex: 20, background: C.surface, borderBottom: `1px solid ${C.line}` }}>
        {/* Row 1: back + title + sport picker */}
        <div style={{ maxWidth: 720, margin: "0 auto", padding: "14px 20px 10px", display: "flex", alignItems: "center", gap: 12 }}>
          <button onClick={() => router.back()} style={{ background: "none", border: "none", cursor: "pointer", padding: 4, display: "flex", flexShrink: 0 }}>
            <ChevronLeft size={20} color={C.dim} />
          </button>
          <Trophy size={17} color={C.gold} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: C.white, lineHeight: 1.2 }}>Team Leaderboard</div>
            <div style={{ fontSize: 11, color: C.dim, marginTop: 2 }}>{SPORT_LABELS[sport] || sport} · {season} Season</div>
          </div>

          {/* Sport picker */}
          <div style={{ position: "relative", flexShrink: 0 }}>
            <button onClick={() => setShowSport(s => !s)} style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 12px", borderRadius: 8, border: `1px solid ${C.line2}`, background: C.card, color: C.white, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
              {SPORT_LABELS[sport] || sport} <ChevronDown size={12} color={C.dim} />
            </button>
            {showSport && (
              <div style={{ position: "absolute", right: 0, top: "calc(100% + 5px)", background: C.card2, border: `1px solid ${C.line2}`, borderRadius: 10, zIndex: 50, minWidth: 160, overflow: "hidden", boxShadow: "0 12px 32px rgba(0,0,0,0.5)" }}>
                {ALL_SPORTS.map(s => (
                  <button key={s} onClick={() => { setSport(s); setShowSport(false); }} style={{ display: "block", width: "100%", padding: "10px 14px", background: sport === s ? C.faint : "transparent", border: "none", textAlign: "left", fontSize: 13, fontWeight: sport === s ? 800 : 500, color: sport === s ? C.accent : C.dim, cursor: "pointer" }}>
                    {SPORT_LABELS[s]}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Row 2: season pills */}
        <div style={{ maxWidth: 720, margin: "0 auto", padding: "0 20px 12px", display: "flex", gap: 6 }}>
          {[CURRENT_YEAR, CURRENT_YEAR - 1, CURRENT_YEAR - 2].map(y => (
            <button key={y} onClick={() => setSeason(y)} style={{
              padding: "5px 12px", borderRadius: 7,
              background: season === y ? C.accent + "22" : "transparent",
              border: `1px solid ${season === y ? C.accent + "55" : C.line2}`,
              color: season === y ? C.accent : C.dim,
              fontSize: 12, fontWeight: 800, cursor: "pointer",
            }}>{y}</button>
          ))}
        </div>
      </div>

      <div style={{ maxWidth: 720, margin: "0 auto", padding: "24px 20px" }}>
        {loading ? (
          <div style={{ display: "flex", justifyContent: "center", alignItems: "center", padding: 80 }}>
            <div style={{ width: 28, height: 28, border: `2px solid ${C.line2}`, borderTopColor: C.accent, borderRadius: "50%", animation: "spin 0.9s linear infinite" }} />
          </div>
        ) : boards.length === 0 ? (
          <div style={{ textAlign: "center", padding: "72px 20px", background: C.card, borderRadius: 18, border: `1px solid ${C.line}` }}>
            <BarChart2 size={36} color={C.muted} style={{ marginBottom: 14, opacity: 0.3 }} />
            <div style={{ fontSize: 16, fontWeight: 700, color: C.white, marginBottom: 8 }}>No team stats yet</div>
            <div style={{ fontSize: 13, color: C.dim }}>Stats logged by coaches will show up here.</div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 16, animation: "fadeUp 0.3s ease" }}>
            {boards.map(board => (
              <div key={board.statKey} style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 16, overflow: "hidden" }}>
                {/* Board header */}
                <div style={{ padding: "14px 18px 12px", borderBottom: `1px solid ${C.line}`, display: "flex", alignItems: "center", gap: 10 }}>
                  <TrendingUp size={13} color={C.accent} />
                  <span style={{ fontSize: 13, fontWeight: 800, color: C.white, letterSpacing: "0.01em" }}>{board.label}</span>
                  <span style={{ marginLeft: "auto", fontSize: 11, fontWeight: 700, color: C.dim, letterSpacing: "0.06em" }}>{season} SEASON</span>
                </div>

                {/* Entries */}
                <div>
                  {board.entries.map((e, i) => {
                    const isMe   = e.athleteToken === myToken;
                    const isGold = i === 0;
                    return (
                      <div key={e.athleteToken} style={{
                        display: "flex", alignItems: "center", gap: 12,
                        padding: "13px 18px",
                        borderBottom: i < board.entries.length - 1 ? `1px solid ${C.line}` : "none",
                        background: isMe ? C.meBg : isGold ? C.goldBg : "transparent",
                      }}>
                        {/* Rank badge */}
                        <div style={{ width: 30, height: 30, borderRadius: 7, background: i < 3 ? RANK_BG[i] : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                          <span style={{ fontSize: 13, fontWeight: 900, color: i < 3 ? RANK_COLOR[i] : C.dim }}>
                            {i + 1}
                          </span>
                        </div>

                        {/* Avatar */}
                        <div style={{ width: 36, height: 36, borderRadius: "50%", background: isMe ? C.accent + "22" : C.card2, border: `1.5px solid ${isMe ? C.meBdr : C.line2}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                          <span style={{ fontSize: 12, fontWeight: 900, color: isMe ? C.accent : C.dim }}>
                            {(e.name || "?").split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase()}
                          </span>
                        </div>

                        {/* Name + meta row */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 14, fontWeight: isMe ? 900 : 700, color: isMe ? C.accent : C.white, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {e.name}
                          </div>
                          <div style={{ fontSize: 11, color: C.dim, marginTop: 2, display: "flex", alignItems: "center", gap: 8 }}>
                            <span>{e.gp} {e.gp === 1 ? "game" : "games"}</span>
                            {isMe && (
                              <span style={{ fontWeight: 800, color: C.accent, fontSize: 10, letterSpacing: "0.08em" }}>YOU</span>
                            )}
                          </div>
                        </div>

                        {/* Stat value */}
                        <div style={{ textAlign: "right", flexShrink: 0 }}>
                          <div style={{ fontSize: 24, fontWeight: 900, color: isGold ? C.gold : isMe ? C.accent : C.white, letterSpacing: "-0.04em", lineHeight: 1 }}>
                            {e.value}
                          </div>
                          {e.verified && (
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 4, marginTop: 5 }}>
                              <Shield size={10} color={C.green} strokeWidth={2.5} />
                              <span style={{ fontSize: 10, fontWeight: 800, color: C.green, letterSpacing: "0.05em" }}>VERIFIED</span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
