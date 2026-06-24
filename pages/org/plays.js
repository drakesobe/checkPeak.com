// pages/org/plays.js  -  Cross-film play search
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";
import { useAuthContext } from "@/hooks/useAuth";
import { Toaster } from "react-hot-toast";
import {
  ArrowLeft, Search, Play, Filter, ChevronDown, X,
  Film, Tag, Loader2, ArrowRight, Pencil,
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
  bodyText:    "#1A2535",
  labelText:   "#5A6A7D",
  dimText:     "#9BA8B4",
  border:      "#E8ECF0",
};

function cap(s) {
  if (!s) return "";
  return s.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

function fmtDate(d) {
  if (!d) return null;
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function fmtDown(down, distance) {
  if (!down) return null;
  return distance ? `${down}&${distance}` : `${down}`;
}

// ── Play card ─────────────────────────────────────────────────────────────────
function PlayCard({ play, onOpen }) {
  const [hovered, setHovered] = useState(false);
  const thumb = play.mux_playback_id
    ? `https://image.mux.com/${play.mux_playback_id}/thumbnail.jpg?time=${Math.floor(play.start_time_secs ?? 0)}&width=480&fit_mode=preserve`
    : null;

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: DS.cardBg, border: `1px solid ${DS.border}`,
        borderRadius: 14, overflow: "hidden", display: "flex", flexDirection: "column",
        transition: "box-shadow 0.15s, transform 0.15s",
        transform: hovered ? "translateY(-2px)" : "none",
        boxShadow: hovered ? "0 8px 28px rgba(30,58,95,0.12)" : "0 1px 4px rgba(0,0,0,0.04)",
        cursor: "pointer",
      }}
      onClick={onOpen}
    >
      {/* Thumbnail */}
      <div style={{ position: "relative", aspectRatio: "16/9", background: "#0c1628", overflow: "hidden" }}>
        {thumb ? (
          <img src={thumb} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
        ) : (
          <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Play size={24} color="rgba(255,255,255,0.2)" />
          </div>
        )}

        {/* Play number badge */}
        <div style={{
          position: "absolute", bottom: 7, left: 7,
          background: "rgba(0,0,0,0.65)", backdropFilter: "blur(4px)",
          borderRadius: 5, padding: "2px 8px",
        }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: "#fff" }}>Play #{play.play_number}</span>
        </div>

        {/* Annotation badge */}
        {play.coach_annotation && (
          <div style={{
            position: "absolute", top: 7, right: 7,
            background: "rgba(30,58,95,0.85)", backdropFilter: "blur(4px)",
            borderRadius: 5, padding: "2px 8px",
            display: "flex", alignItems: "center", gap: 4,
          }}>
            <Pencil size={9} color="#fff" />
            <span style={{ fontSize: 9, fontWeight: 700, color: "#fff" }}>Coach Note</span>
          </div>
        )}

        {/* Hover play overlay */}
        {hovered && (
          <div style={{
            position: "absolute", inset: 0,
            background: "rgba(30,58,95,0.4)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <div style={{
              width: 44, height: 44, borderRadius: "50%",
              background: "rgba(255,255,255,0.9)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <Play size={18} color={DS.brand} style={{ marginLeft: 2 }} />
            </div>
          </div>
        )}
      </div>

      {/* Info */}
      <div style={{ padding: "12px 14px", flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
        {/* Play type + result row */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          {play.play_type && (
            <span style={{
              fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em",
              background: DS.brandBg, color: DS.brand, borderRadius: 4, padding: "2px 7px",
            }}>{cap(play.play_type)}</span>
          )}
          {play.result && (
            <span style={{
              fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em",
              background: DS.pageBg, color: DS.labelText, borderRadius: 4, padding: "2px 7px",
              border: `1px solid ${DS.border}`,
            }}>{cap(play.result)}</span>
          )}
          {fmtDown(play.down, play.distance) && (
            <span style={{ fontSize: 10, color: DS.dimText, fontWeight: 600 }}>
              {play.down}&#38;{play.distance}
            </span>
          )}
        </div>

        {/* Formation */}
        {play.formation && (
          <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: DS.bodyText }}>{cap(play.formation)}</p>
        )}

        {/* Film title */}
        <p style={{
          margin: 0, fontSize: 11, color: DS.dimText,
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>
          {play.film_title || "Untitled"}{play.opponent ? ` · vs ${play.opponent}` : ""}
          {play.game_date ? ` · ${fmtDate(play.game_date)}` : ""}
        </p>

        {/* Labels */}
        {play.labels?.length > 0 && (
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 2 }}>
            {play.labels.map(l => (
              <span key={l} style={{
                fontSize: 9, fontWeight: 700, textTransform: "uppercase",
                background: "#F0FBF4", color: DS.safe, borderRadius: 3, padding: "1px 5px",
                border: `1px solid ${DS.safeBorder}`,
              }}>{l}</span>
            ))}
          </div>
        )}

        {/* Notes */}
        {play.notes && (
          <p style={{
            margin: "2px 0 0", fontSize: 11, color: DS.labelText, fontStyle: "italic",
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>"{play.notes}"</p>
        )}
      </div>
    </div>
  );
}

// ── Filter pill ───────────────────────────────────────────────────────────────
function FilterPill({ label, value, onChange, options, placeholder }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    function handler(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          display: "flex", alignItems: "center", gap: 5,
          background: value ? DS.brandBg : DS.cardBg,
          border: `1px solid ${value ? DS.brandBorder : DS.border}`,
          borderRadius: 8, padding: "7px 12px",
          fontSize: 12, fontWeight: value ? 700 : 500,
          color: value ? DS.brand : DS.labelText,
          cursor: "pointer", whiteSpace: "nowrap",
        }}
      >
        {label}{value ? `: ${cap(value)}` : ""}
        {value
          ? <X size={11} onClick={e => { e.stopPropagation(); onChange(""); }} />
          : <ChevronDown size={11} />
        }
      </button>
      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 4px)", left: 0, minWidth: 160,
          background: DS.cardBg, border: `1px solid ${DS.border}`,
          borderRadius: 10, boxShadow: "0 8px 24px rgba(0,0,0,0.1)", zIndex: 50,
          maxHeight: 220, overflowY: "auto",
        }}>
          {placeholder && (
            <div
              onClick={() => { onChange(""); setOpen(false); }}
              style={{ padding: "9px 14px", fontSize: 12, color: DS.dimText, cursor: "pointer", borderBottom: `1px solid ${DS.border}` }}
            >
              {placeholder}
            </div>
          )}
          {options.map(o => (
            <div
              key={o.value}
              onClick={() => { onChange(o.value); setOpen(false); }}
              style={{
                padding: "9px 14px", fontSize: 12, fontWeight: value === o.value ? 700 : 400,
                color: value === o.value ? DS.brand : DS.bodyText,
                background: value === o.value ? DS.brandBg : "transparent",
                cursor: "pointer",
              }}
              onMouseEnter={e => { if (value !== o.value) e.currentTarget.style.background = DS.pageBg; }}
              onMouseLeave={e => { if (value !== o.value) e.currentTarget.style.background = "transparent"; }}
            >
              {o.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function PlaysPage() {
  const router   = useRouter();
  const { user } = useAuthContext();

  const [plays,    setPlays]    = useState([]);
  const [loading,  setLoading]  = useState(false);
  const [total,    setTotal]    = useState(0);
  const [offset,   setOffset]   = useState(0);
  const LIMIT = 40;

  // Filters
  const [search,    setSearch]    = useState("");
  const [playType,  setPlayType]  = useState("");
  const [formation, setFormation] = useState("");
  const [result,    setResult]    = useState("");
  const [down,      setDown]      = useState("");
  const [sport,     setSport]     = useState("");

  const searchRef = useRef(null);

  const fetchPlays = useCallback(async (newOffset = 0) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: LIMIT, offset: newOffset });
      if (playType)  params.set("playType",  playType);
      if (formation) params.set("formation", formation);
      if (result)    params.set("result",    result);
      if (down)      params.set("down",      down);
      if (sport)     params.set("sport",     sport);

      const r = await fetch(`/api/plays/search?${params}`, { credentials: "include" });
      const d = await r.json();
      if (d.ok) {
        setPlays(newOffset === 0 ? d.plays : prev => [...prev, ...d.plays]);
        setTotal(d.total ?? 0);
        setOffset(newOffset);
      }
    } catch {}
    setLoading(false);
  }, [playType, formation, result, down, sport]);

  useEffect(() => { fetchPlays(0); }, [fetchPlays]);

  // Client-side text search over loaded plays
  const filtered = search.trim()
    ? plays.filter(p => {
        const q = search.toLowerCase();
        return (
          p.play_type?.toLowerCase().includes(q) ||
          p.formation?.toLowerCase().includes(q) ||
          p.result?.toLowerCase().includes(q) ||
          p.film_title?.toLowerCase().includes(q) ||
          p.opponent?.toLowerCase().includes(q) ||
          p.notes?.toLowerCase().includes(q) ||
          (p.labels || []).some(l => l.toLowerCase().includes(q))
        );
      })
    : plays;

  const hasMore = plays.length < total && !loading;
  const activeFilterCount = [playType, formation, result, down, sport].filter(Boolean).length;

  function openPlay(play) {
    if (play.film_id) {
      router.push(`/org/film/${play.film_id}?seekTo=${Math.floor(play.start_time_secs ?? 0)}`);
    }
  }

  const PLAY_TYPE_OPTIONS = [
    "pass","run","scramble","sack","spike","kneel",
    "kickoff","punt","field_goal","extra_point",
  ].map(v => ({ value: v, label: cap(v) }));

  const RESULT_OPTIONS = [
    "complete","incomplete","touchdown","interception",
    "gain","loss","fumble","penalty","first_down","sack",
  ].map(v => ({ value: v, label: cap(v) }));

  const DOWN_OPTIONS = [1,2,3,4].map(v => ({ value: String(v), label: `${v}${["st","nd","rd","th"][v-1]} Down` }));

  const SPORT_OPTIONS = [
    "football","basketball","soccer","lacrosse","hockey","volleyball","wrestling",
  ].map(v => ({ value: v, label: cap(v) }));

  return (
    <>
      <Toaster position="top-right" toastOptions={{ duration: 3500 }} />
      <style>{`
        @keyframes spin { from { transform:rotate(0deg); } to { transform:rotate(360deg); } }
        * { box-sizing: border-box; }
      `}</style>

      <div style={{ minHeight: "100vh", background: DS.pageBg, fontFamily: "system-ui, sans-serif" }}>

        {/* ── Sticky header ── */}
        <div style={{
          background: DS.cardBg, borderBottom: `1px solid ${DS.border}`,
          padding: "13px 20px", position: "sticky", top: 0, zIndex: 100,
        }}>
          <div style={{ maxWidth: 1200, margin: "0 auto", display: "flex", alignItems: "center", gap: 14 }}>
            <button onClick={() => router.push("/org/film")}
              style={{ background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 4, color: DS.labelText, fontSize: 13, padding: 0, flexShrink: 0 }}>
              <ArrowLeft size={15} /> Films
            </button>
            <div style={{ width: 1, height: 18, background: DS.border, flexShrink: 0 }} />
            <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1 }}>
              <Tag size={16} color={DS.brand} />
              <h1 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: DS.bodyText }}>Play Library</h1>
              {total > 0 && (
                <span style={{ fontSize: 11, color: DS.dimText, fontWeight: 500 }}>{total.toLocaleString()} plays</span>
              )}
            </div>

            {/* Search */}
            <div style={{ position: "relative", width: 240 }}>
              <Search size={12} color={DS.dimText} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} />
              <input
                ref={searchRef}
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search plays, films, notes…"
                style={{
                  width: "100%", padding: "7px 10px 7px 30px",
                  border: `1px solid ${DS.border}`, borderRadius: 8,
                  fontSize: 12, color: DS.bodyText, background: DS.pageBg, outline: "none",
                }}
              />
            </div>
          </div>
        </div>

        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "24px 20px" }}>

          {/* Filter bar */}
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 22 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 5, color: DS.labelText, fontSize: 12, fontWeight: 600, marginRight: 2 }}>
              <Filter size={12} />
              {activeFilterCount > 0 ? `${activeFilterCount} filter${activeFilterCount > 1 ? "s" : ""}` : "Filter"}
            </div>
            <FilterPill label="Play Type"  value={playType}  onChange={setPlayType}  options={PLAY_TYPE_OPTIONS} placeholder="All play types" />
            <FilterPill label="Formation"  value={formation} onChange={setFormation} options={[]} placeholder="Any formation" />
            <FilterPill label="Result"     value={result}    onChange={setResult}    options={RESULT_OPTIONS}    placeholder="Any result" />
            <FilterPill label="Down"       value={down}      onChange={setDown}      options={DOWN_OPTIONS}      placeholder="Any down" />
            <FilterPill label="Sport"      value={sport}     onChange={setSport}     options={SPORT_OPTIONS}     placeholder="All sports" />
            {activeFilterCount > 0 && (
              <button
                onClick={() => { setPlayType(""); setFormation(""); setResult(""); setDown(""); setSport(""); }}
                style={{ background: "none", border: "none", cursor: "pointer", fontSize: 11, color: DS.warn, fontWeight: 600, padding: "4px 2px" }}
              >
                Clear all
              </button>
            )}
          </div>

          {/* Grid */}
          {loading && plays.length === 0 ? (
            <div style={{ textAlign: "center", padding: 80, color: DS.dimText }}>
              <Loader2 size={28} style={{ animation: "spin 1s linear infinite", marginBottom: 12 }} />
              <p style={{ margin: 0, fontSize: 14 }}>Loading plays…</p>
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ textAlign: "center", padding: 80, background: DS.cardBg, borderRadius: 16, border: `1px solid ${DS.border}` }}>
              <Film size={40} color={DS.dimText} style={{ marginBottom: 16, opacity: 0.3 }} />
              <h3 style={{ margin: "0 0 8px", fontSize: 17, fontWeight: 700, color: DS.bodyText }}>No plays found</h3>
              <p style={{ margin: 0, fontSize: 13, color: DS.labelText }}>
                {activeFilterCount > 0 ? "Try adjusting your filters." : "Tag plays in your films to see them here."}
              </p>
            </div>
          ) : (
            <>
              <div style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
                gap: 16,
              }}>
                {filtered.map(play => (
                  <PlayCard key={play.id} play={play} onOpen={() => openPlay(play)} />
                ))}
              </div>

              {/* Load more */}
              {hasMore && (
                <div style={{ textAlign: "center", marginTop: 32 }}>
                  <button
                    onClick={() => fetchPlays(offset + LIMIT)}
                    style={{
                      background: DS.cardBg, border: `1px solid ${DS.border}`,
                      borderRadius: 10, padding: "11px 28px",
                      fontSize: 13, fontWeight: 600, color: DS.bodyText,
                      cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6,
                    }}
                  >
                    {loading ? <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> : <ArrowRight size={14} />}
                    Load more plays
                  </button>
                </div>
              )}

              {loading && plays.length > 0 && (
                <div style={{ textAlign: "center", marginTop: 24 }}>
                  <Loader2 size={20} color={DS.dimText} style={{ animation: "spin 1s linear infinite" }} />
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}
