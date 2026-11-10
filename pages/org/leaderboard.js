// pages/org/leaderboard.js
// Coach team leaderboard — per-stat boards built by lib/teamBoards.js via /api/org/leaderboard.
//
//   • Summary tiles: athletes with stats, games logged, coach-verified share, most boards led.
//   • Verified only: rank only coach-logged games.
//   • Total / Per game: per-game re-ranks counting stats (rates + season bests unchanged).
//   • Spotlight: search an athlete → highlighted on every board, even outside the top 5.
//   • Boards: medal ranks, self-reported tags, rate qualifiers, inline "Show all",
//     names link to the athlete's stats page. Export the current view as CSV.

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/router";
import { useAuthContext } from "@/hooks/useAuth";
import {
  Trophy, ChevronLeft, Shield, BarChart2, ChevronDown, Download, Search, X, Users, Activity, Award,
} from "lucide-react";
import { SPORT_LABELS, ALL_SPORTS } from "@/lib/sportStats";

const DS = {
  bg:        "#F4F7FB",
  surface:   "#FFFFFF",
  border:    "#E2E8F0",
  line:      "#EEF2F7",
  brand:     "#1E3A5F",
  brandBg:   "#EEF3F9",
  accent:    "#2563EB",
  accentBg:  "#EFF6FF",
  bodyText:  "#1A2540",
  dim:       "#4B5E7A",
  muted:     "#8195B0",
  safe:      "#00873E",
  safeBg:    "#F0FBF4",
  spot:      "#FFFBEB",
  spotLine:  "#FCD34D",
};

const MEDAL    = ["#B45309", "#64748B", "#9A5B2E"];
const MEDAL_BG = ["#FEF3C7", "#F1F5F9", "#FBEFE6"];
const EVENT_SPORTS = new Set(["track", "swimming"]);
const SPORT_KEY = "cp:org:leaderboardSport";
const CURRENT_YEAR = new Date().getFullYear();
const COLLAPSED = 5;

// ── Helpers ───────────────────────────────────────────────────────────────────

function initials(name) {
  return (name || "?").split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase();
}

function fmtNum(n) {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

/** Re-rank counting boards per game. Ties share a rank. */
function perGameView(b) {
  if (b.kind !== "total") return b;
  const entries = b.entries
    .map(e => {
      const v = e.gp ? Math.round((Number(e.value) / e.gp) * 10) / 10 : 0;
      return { ...e, value: v, display: v.toFixed(1) };
    })
    .sort((x, y) => y.value - x.value || String(x.name).localeCompare(String(y.name)));
  let prev = null, prevRank = 0;
  entries.forEach((e, i) => { if (e.value !== prev) { prevRank = i + 1; prev = e.value; } e.rank = prevRank; });
  return { ...b, entries };
}

function kindLabel(b, perGame) {
  if (b.kind === "rate") return b.qualifier || "Season rate";
  if (b.kind === "best") return "Season best";
  return perGame ? "Per game" : "Season total";
}

function downloadCsv(filename, rows) {
  const esc = v => {
    const s = String(v ?? "");
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = rows.map(r => r.map(esc).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ── Small components ──────────────────────────────────────────────────────────

function Segmented({ options, value, onChange }) {
  return (
    <div style={{ display: "inline-flex", padding: 3, borderRadius: 10, background: DS.line, gap: 2 }}>
      {options.map(o => {
        const active = o.value === value;
        return (
          <button
            key={String(o.value)}
            onClick={() => onChange(o.value)}
            style={{
              padding: "6px 12px", borderRadius: 8, border: "none", cursor: "pointer",
              background: active ? DS.surface : "transparent",
              boxShadow: active ? "0 1px 2px rgba(16,24,40,0.08)" : "none",
              color: active ? DS.bodyText : DS.dim, fontSize: 12, fontWeight: 700,
            }}
          >{o.label}</button>
        );
      })}
    </div>
  );
}

function Toggle({ checked, onChange, label }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      role="switch"
      aria-checked={checked}
      style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "none", border: "none", cursor: "pointer", padding: 0 }}
    >
      <span style={{
        width: 34, height: 20, borderRadius: 10, position: "relative", transition: "background 0.15s",
        background: checked ? DS.safe : "#CBD5E1",
      }}>
        <span style={{
          position: "absolute", top: 2, left: checked ? 16 : 2, width: 16, height: 16, borderRadius: 8,
          background: "#fff", boxShadow: "0 1px 2px rgba(0,0,0,0.2)", transition: "left 0.15s",
        }} />
      </span>
      <span style={{ fontSize: 12, fontWeight: 700, color: checked ? DS.safe : DS.dim }}>{label}</span>
    </button>
  );
}

function Tile({ icon, label, value, sub }) {
  return (
    <div style={{ background: DS.surface, border: `1px solid ${DS.border}`, borderRadius: 14, padding: "14px 16px", minWidth: 0 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, color: DS.muted, fontSize: 12, fontWeight: 600 }}>
        {icon}{label}
      </div>
      <div style={{ fontSize: 24, fontWeight: 900, color: DS.bodyText, letterSpacing: "-0.03em", marginTop: 6, lineHeight: 1.1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {value}
      </div>
      {sub && <div style={{ fontSize: 12, color: DS.dim, marginTop: 3 }}>{sub}</div>}
    </div>
  );
}

function EntryRow({ e, last, spotlight, sport, onOpen }) {
  const top = e.rank <= 3;
  const clickable = !!e.email;
  return (
    <div
      onClick={clickable ? () => onOpen(e) : undefined}
      style={{
        display: "flex", alignItems: "center", gap: 12, padding: "11px 18px",
        borderBottom: last ? "none" : `1px solid ${DS.line}`,
        background: spotlight ? DS.spot : "transparent",
        boxShadow: spotlight ? `inset 3px 0 0 ${DS.spotLine}` : "none",
        cursor: clickable ? "pointer" : "default",
      }}
      title={clickable ? `View ${e.name}'s ${SPORT_LABELS[sport] || sport} stats` : undefined}
    >
      <div style={{ width: 28, height: 28, borderRadius: 7, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: top ? MEDAL_BG[e.rank - 1] : DS.line }}>
        <span style={{ fontSize: 12, fontWeight: 900, color: top ? MEDAL[e.rank - 1] : DS.dim }}>{e.rank}</span>
      </div>
      <div style={{ width: 32, height: 32, borderRadius: "50%", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: DS.brandBg }}>
        <span style={{ fontSize: 11, fontWeight: 800, color: DS.brand }}>{initials(e.name)}</span>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: DS.bodyText, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {e.name}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 2, fontSize: 11, color: DS.muted }}>
          <span>{e.gp} {e.gp === 1 ? "game" : "games"}</span>
          {e.verified
            ? <span style={{ display: "inline-flex", alignItems: "center", gap: 3, color: DS.safe, fontWeight: 700 }}><Shield size={10} strokeWidth={2.5} />Verified</span>
            : <span style={{ color: DS.muted }}>Self-reported</span>}
        </div>
      </div>
      <div style={{ fontSize: 20, fontWeight: 900, letterSpacing: "-0.03em", color: e.rank === 1 ? MEDAL[0] : DS.bodyText, flexShrink: 0 }}>
        {e.display ?? e.value}
      </div>
    </div>
  );
}

function BoardCard({ b, perGame, spotTokens, sport, onOpen }) {
  const [open, setOpen] = useState(false);
  const head = open ? b.entries : b.entries.slice(0, COLLAPSED);
  const extra = open ? [] : b.entries.slice(COLLAPSED).filter(e => spotTokens.has(e.athleteToken));

  return (
    <div style={{ background: DS.surface, border: `1px solid ${DS.border}`, borderRadius: 14, overflow: "hidden", display: "flex", flexDirection: "column" }}>
      <div style={{ padding: "14px 18px 12px", borderBottom: `1px solid ${DS.line}`, display: "flex", alignItems: "flex-start", gap: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          {b.group && <div style={{ fontSize: 11, fontWeight: 700, color: DS.muted, marginBottom: 2 }}>{b.group}</div>}
          <div style={{ fontSize: 15, fontWeight: 800, color: DS.bodyText, letterSpacing: "-0.01em" }}>{b.label}</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: DS.dim }}>{kindLabel(b, perGame)}</div>
          {b.better === "low" && <div style={{ fontSize: 11, color: DS.muted, marginTop: 1 }}>Lower is better</div>}
        </div>
      </div>

      <div style={{ flex: 1 }}>
        {head.map((e, i) => (
          <EntryRow key={e.athleteToken} e={e} sport={sport} onOpen={onOpen}
            spotlight={spotTokens.has(e.athleteToken)}
            last={i === head.length - 1 && extra.length === 0} />
        ))}
        {extra.length > 0 && (
          <>
            <div style={{ textAlign: "center", fontSize: 11, color: DS.muted, letterSpacing: 3, padding: "2px 0", borderBottom: `1px solid ${DS.line}` }}>···</div>
            {extra.map((e, i) => (
              <EntryRow key={e.athleteToken} e={e} sport={sport} onOpen={onOpen} spotlight last={i === extra.length - 1} />
            ))}
          </>
        )}
      </div>

      {b.entries.length > COLLAPSED && (
        <button
          onClick={() => setOpen(o => !o)}
          style={{ padding: "11px 0", background: "none", border: "none", borderTop: `1px solid ${DS.line}`, cursor: "pointer", fontSize: 12, fontWeight: 700, color: DS.accent }}
        >
          {open ? "Show less" : `Show all ${b.total ?? b.entries.length}`}
        </button>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function Leaderboard() {
  const router = useRouter();
  const { isOrg, authReady } = useAuthContext();

  const [sport,        setSport]        = useState("football");
  const [season,       setSeason]       = useState(CURRENT_YEAR);
  const [perGame,      setPerGame]      = useState(false);
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [query,        setQuery]        = useState("");
  const [showSport,    setShowSport]    = useState(false);
  const [data,         setData]         = useState({ boards: [], summary: null });
  const [loading,      setLoading]      = useState(false);
  const [failed,       setFailed]       = useState(false);

  // Remember the coach's sport between visits.
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(SPORT_KEY);
      if (saved && SPORT_LABELS[saved]) setSport(saved);
    } catch {}
  }, []);
  const pickSport = s => {
    setSport(s); setShowSport(false);
    try { window.localStorage.setItem(SPORT_KEY, s); } catch {}
  };

  const load = useCallback(async () => {
    setLoading(true); setFailed(false);
    try {
      const qs = new URLSearchParams({ sport, season: String(season), limit: "200" });
      if (verifiedOnly) qs.set("verifiedOnly", "1");
      const r = await fetch(`/api/org/leaderboard?${qs}`, { credentials: "include" });
      const d = await r.json();
      if (!r.ok || !d.ok) throw new Error(d.error || "Failed");
      setData({ boards: d.boards || [], summary: d.summary || null });
    } catch {
      setFailed(true);
      setData({ boards: [], summary: null });
    }
    setLoading(false);
  }, [sport, season, verifiedOnly]);

  useEffect(() => { if (authReady && isOrg) load(); }, [load, authReady, isOrg]);

  const hasCounting = data.boards.some(b => b.kind === "total" || b.kind == null);
  const boards = useMemo(
    () => (perGame ? data.boards.map(perGameView) : data.boards),
    [data.boards, perGame],
  );

  // Spotlight: athletes whose name matches the search.
  const spotTokens = useMemo(() => {
    const q = query.trim().toLowerCase();
    const set = new Set();
    if (q.length < 2) return set;
    for (const b of boards) for (const e of b.entries) {
      if (String(e.name).toLowerCase().includes(q)) set.add(e.athleteToken);
    }
    return set;
  }, [boards, query]);

  // Most boards led (rank 1, ties included).
  const topLeader = useMemo(() => {
    const counts = {};
    for (const b of boards) for (const e of b.entries) {
      if (e.rank !== 1) break;
      counts[e.athleteToken] = counts[e.athleteToken] || { name: e.name, n: 0 };
      counts[e.athleteToken].n++;
    }
    return Object.values(counts).sort((a, b) => b.n - a.n)[0] || null;
  }, [boards]);

  // Group consecutive boards (baseball: Hitter / Pitcher).
  const groups = useMemo(() => {
    const out = [];
    for (const b of boards) {
      const last = out[out.length - 1];
      if (last && last.name === (b.group || null)) last.boards.push(b);
      else out.push({ name: b.group || null, boards: [b] });
    }
    return out;
  }, [boards]);

  const openAthlete = e => {
    if (!e.email) return;
    router.push({ pathname: "/org/athlete-stats", query: { email: e.email, name: e.name, sport } });
  };

  const exportCsv = () => {
    const rows = [["Board", "Group", "View", "Rank", "Athlete", "Value", "Games", "Verified"]];
    for (const b of boards) for (const e of b.entries) {
      rows.push([b.label, b.group || "", kindLabel(b, perGame), e.rank, e.name, e.display ?? e.value, e.gp, e.verified ? "Yes" : "No"]);
    }
    downloadCsv(`${sport}-${season}-leaderboard${verifiedOnly ? "-verified" : ""}${perGame ? "-per-game" : ""}.csv`, rows);
  };

  if (!authReady) return null;
  if (!isOrg) return <div style={{ padding: 32, color: DS.muted }}>Not authorized.</div>;

  const s = data.summary;
  const spotCount = spotTokens.size;

  return (
    <div style={{ minHeight: "100vh", background: DS.bg }}>
      {/* Header */}
      <div style={{ background: DS.surface, borderBottom: `1px solid ${DS.border}`, position: "sticky", top: 0, zIndex: 20 }}>
        <div style={{ maxWidth: 1180, margin: "0 auto", padding: "14px 20px", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <button onClick={() => router.back()} aria-label="Back" style={{ background: "none", border: "none", cursor: "pointer", display: "flex", padding: 4 }}>
            <ChevronLeft size={20} color={DS.muted} />
          </button>
          <div style={{ width: 34, height: 34, borderRadius: 10, background: MEDAL_BG[0], display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Trophy size={17} color={MEDAL[0]} />
          </div>
          <div style={{ flex: 1, minWidth: 160 }}>
            <div style={{ fontSize: 17, fontWeight: 800, color: DS.bodyText, letterSpacing: "-0.01em" }}>Team leaderboard</div>
            <div style={{ fontSize: 12, color: DS.dim }}>{SPORT_LABELS[sport] || sport} · {season} season</div>
          </div>

          <Segmented
            value={season}
            onChange={setSeason}
            options={[CURRENT_YEAR, CURRENT_YEAR - 1, CURRENT_YEAR - 2].map(y => ({ value: y, label: String(y) }))}
          />

          <div style={{ position: "relative" }}>
            <button onClick={() => setShowSport(v => !v)} style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 12px", borderRadius: 9, border: `1px solid ${DS.border}`, background: DS.surface, color: DS.bodyText, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
              {SPORT_LABELS[sport] || sport} <ChevronDown size={13} />
            </button>
            {showSport && (
              <div style={{ position: "absolute", right: 0, top: "calc(100% + 6px)", background: DS.surface, border: `1px solid ${DS.border}`, borderRadius: 12, zIndex: 100, minWidth: 180, boxShadow: "0 12px 32px rgba(16,24,40,0.12)", overflow: "hidden" }}>
                {ALL_SPORTS.map(k => (
                  <button key={k} onClick={() => pickSport(k)} style={{ display: "block", width: "100%", padding: "10px 14px", background: sport === k ? DS.brandBg : "none", border: "none", textAlign: "left", fontSize: 13, fontWeight: sport === k ? 700 : 500, color: sport === k ? DS.brand : DS.dim, cursor: "pointer" }}>
                    {SPORT_LABELS[k]}
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            onClick={exportCsv}
            disabled={!boards.length}
            style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 12px", borderRadius: 9, border: `1px solid ${DS.border}`, background: DS.surface, color: boards.length ? DS.bodyText : DS.muted, fontSize: 13, fontWeight: 700, cursor: boards.length ? "pointer" : "default" }}
          >
            <Download size={14} /> Export
          </button>
        </div>
      </div>

      <div style={{ maxWidth: 1180, margin: "0 auto", padding: "20px 20px 48px" }} onClick={() => showSport && setShowSport(false)}>
        {/* Summary */}
        {s && s.gamesLogged > 0 && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12, marginBottom: 18 }}>
            <Tile icon={<Users size={13} />} label="Athletes with stats" value={s.athletesWithStats} sub={`of ${s.rosterSize} on the roster`} />
            <Tile icon={<Activity size={13} />} label="Games logged" value={s.gamesLogged} sub={`${s.coachLogged} by coaches`} />
            <Tile icon={<Shield size={13} />} label="Coach-verified" value={`${s.verifiedPct}%`} sub={s.verifiedPct < 50 ? "Most stats are self-reported" : "Of all logged games"} />
            <Tile icon={<Award size={13} />} label="Most boards led" value={topLeader ? topLeader.name : "—"} sub={topLeader ? `#1 on ${topLeader.n} ${topLeader.n === 1 ? "board" : "boards"}` : undefined} />
          </div>
        )}

        {/* Toolbar */}
        {(boards.length > 0 || verifiedOnly) && !loading && (
          <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap", marginBottom: 16 }}>
            {hasCounting && (
              <Segmented value={perGame} onChange={setPerGame} options={[{ value: false, label: "Total" }, { value: true, label: "Per game" }]} />
            )}
            <Toggle checked={verifiedOnly} onChange={setVerifiedOnly} label="Verified only" />
            <div style={{ flex: 1 }} />
            <div style={{ position: "relative", width: 260, maxWidth: "100%" }}>
              <Search size={14} color={DS.muted} style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)" }} />
              <input
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Spotlight an athlete"
                style={{ width: "100%", boxSizing: "border-box", padding: "8px 30px 8px 32px", borderRadius: 9, border: `1px solid ${query ? DS.spotLine : DS.border}`, background: DS.surface, fontSize: 13, color: DS.bodyText, outline: "none" }}
              />
              {query && (
                <button onClick={() => setQuery("")} aria-label="Clear" style={{ position: "absolute", right: 6, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", display: "flex", padding: 4 }}>
                  <X size={13} color={DS.muted} />
                </button>
              )}
            </div>
          </div>
        )}
        {query.trim().length >= 2 && !loading && (
          <div style={{ fontSize: 12, color: DS.dim, marginTop: -8, marginBottom: 14 }}>
            {spotCount === 0 ? `No athlete on these boards matches "${query.trim()}".` : `Highlighting ${spotCount} ${spotCount === 1 ? "athlete" : "athletes"} on every board.`}
          </div>
        )}

        {/* Content */}
        {loading ? (
          <div style={{ display: "flex", justifyContent: "center", padding: 80 }}>
            <div style={{ width: 28, height: 28, border: `2px solid ${DS.border}`, borderTopColor: DS.brand, borderRadius: "50%", animation: "spin 0.9s linear infinite" }} />
            <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
          </div>
        ) : failed ? (
          <div style={{ textAlign: "center", padding: "60px 20px", background: DS.surface, border: `1px solid ${DS.border}`, borderRadius: 16 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: DS.bodyText, marginBottom: 12 }}>Couldn't load the leaderboard</div>
            <button onClick={load} style={{ padding: "8px 16px", borderRadius: 9, border: `1px solid ${DS.accent}`, background: DS.accentBg, color: DS.accent, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Try again</button>
          </div>
        ) : boards.length === 0 ? (
          <div style={{ textAlign: "center", padding: "72px 20px", background: DS.surface, border: `1px solid ${DS.border}`, borderRadius: 16 }}>
            <BarChart2 size={36} color={DS.muted} style={{ opacity: 0.35, marginBottom: 16 }} />
            <div style={{ fontSize: 16, fontWeight: 700, color: DS.bodyText, marginBottom: 8 }}>
              {EVENT_SPORTS.has(sport)
                ? "Event leaderboards are coming"
                : verifiedOnly && s?.gamesLogged
                  ? "No coach-verified games yet"
                  : `No ${SPORT_LABELS[sport] || sport} stats for ${season}`}
            </div>
            <div style={{ fontSize: 13, color: DS.dim, maxWidth: 420, margin: "0 auto", lineHeight: 1.5 }}>
              {EVENT_SPORTS.has(sport)
                ? "Team rankings for meet events aren't available yet. Athletes' marks still save to their stats."
                : verifiedOnly && s?.gamesLogged
                  ? `${s.gamesLogged} self-reported ${s.gamesLogged === 1 ? "game is" : "games are"} hidden. Log stats from film to verify them.`
                  : "Log game stats from film, or have athletes log their games, to populate the leaderboard."}
            </div>
          </div>
        ) : (
          groups.map(g => (
            <div key={g.name || "_"} style={{ marginBottom: 20 }}>
              {g.name && <div style={{ fontSize: 13, fontWeight: 800, color: DS.dim, margin: "4px 2px 10px" }}>{g.name}</div>}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 16, alignItems: "start" }}>
                {g.boards.map(b => (
                  <BoardCard key={b.statKey} b={b} perGame={perGame} spotTokens={spotTokens} sport={sport} onOpen={openAthlete} />
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
