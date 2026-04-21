// pages/scans/index.js — CheckPeak Scans Page (redesigned)
// Matches dashboard.js design tokens: #060810, #4FABFF, Barlow Condensed
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { useAuthContext } from "@/hooks/useAuth";
import { trackEvent } from "@/lib/analytics";

// ---------------------------------------------------------------------------
// Design Tokens (mirrors dashboard.js CP object — import from shared file
// once you centralise tokens)
// ---------------------------------------------------------------------------
const CP = {
  black:        "#060810",
  surface:      "#0C1525",
  raised:       "#111E30",
  border:       "rgba(255,255,255,0.08)",
  borderStrong: "rgba(255,255,255,0.15)",
  accent:       "#4FABFF",
  white:        "#FFFFFF",
  ghost:        "rgba(255,255,255,0.55)",
  dim:          "rgba(255,255,255,0.30)",
  faint:        "rgba(255,255,255,0.18)",
  red:          "#D92B3A",
  amber:        "#D4900A",
  green:        "#0D9A55",
  fontBC:       "'Barlow Condensed', 'Arial Narrow', sans-serif",
  fontB:        "'Barlow', Arial, sans-serif",
};

// ---------------------------------------------------------------------------
// Responsive CSS
// ---------------------------------------------------------------------------
const SCANS_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:ital,wght@0,700;0,900;1,900&family=Barlow:wght@400;500;600&display=swap');

  .sc-summary { display: flex; gap: 10px; flex-wrap: wrap; }

  .sc-controls {
    display: grid;
    grid-template-columns: 1fr 200px;
    gap: 10px;
    align-items: end;
  }

  .sc-scan-row {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 16px;
    align-items: center;
  }

  .sc-chips { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 10px; }

  @media (max-width: 639px) {
    .sc-controls {
      grid-template-columns: 1fr;
    }
    .sc-scan-row {
      grid-template-columns: 1fr;
    }
    .sc-summary { gap: 6px; }
  }
`;

// ---------------------------------------------------------------------------
// Shared primitives (same as dashboard.js)
// ---------------------------------------------------------------------------
function Eyebrow({ children, style }) {
  return (
    <p style={{
      fontFamily:    CP.fontBC,
      fontSize:      "10px",
      fontWeight:    700,
      letterSpacing: "0.16em",
      textTransform: "uppercase",
      color:         CP.dim,
      display:       "flex",
      alignItems:    "center",
      gap:           "10px",
      marginBottom:  "6px",
      ...style,
    }}>
      <span style={{ display: "block", width: "20px", height: "0.5px", background: CP.faint, flexShrink: 0 }} />
      {children}
    </p>
  );
}

function CtaButton({ children, onClick, ghost = false, style }) {
  return (
    <button onClick={onClick} style={{
      display:       "inline-flex",
      alignItems:    "center",
      gap:           "6px",
      padding:       "9px 18px",
      fontFamily:    CP.fontBC,
      fontWeight:    900,
      fontSize:      "12px",
      letterSpacing: "0.12em",
      textTransform: "uppercase",
      border:        ghost ? `0.5px solid rgba(79,171,255,0.38)` : "none",
      background:    ghost ? "transparent" : CP.accent,
      color:         ghost ? CP.accent : CP.black,
      cursor:        "pointer",
      ...style,
    }}>
      {children}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Risk helpers
// ---------------------------------------------------------------------------
const getRiskCounts = (scan) => ({
  prohibited: Number(scan?.prohibitedCount || 0),
  limited:    Number(scan?.limitedCount    || 0),
  other:      Number(scan?.otherCount      || 0),
});

const getRiskClass = (scan) => {
  const { prohibited, limited, other } = getRiskCounts(scan);
  if (prohibited > 0) return "Prohibited";
  if (limited    > 0) return "Limited";
  if (other      > 0) return "Other";
  return "Safe";
};

const getRiskScore = (scan) => {
  const { prohibited, limited, other } = getRiskCounts(scan);
  return prohibited * 1000 + limited * 100 + other * 10;
};

// Returns { color, bg, label }
const riskMeta = (scan) => {
  const cls = getRiskClass(scan);
  const { prohibited, limited, other } = getRiskCounts(scan);

  if (cls === "Prohibited") return {
    color:  CP.red,
    bg:     "rgba(217,43,58,0.1)",
    border: "rgba(217,43,58,0.25)",
    label:  `${prohibited} Prohibited${limited ? `, ${limited} Limited` : ""}`,
    topBar: CP.red,
  };
  if (cls === "Limited") return {
    color:  CP.amber,
    bg:     "rgba(212,144,10,0.1)",
    border: "rgba(212,144,10,0.25)",
    label:  `${limited} Limited${other ? `, ${other} Other` : ""}`,
    topBar: CP.amber,
  };
  if (cls === "Other") return {
    color:  CP.accent,
    bg:     "rgba(79,171,255,0.08)",
    border: "rgba(79,171,255,0.2)",
    label:  `${other} Other`,
    topBar: CP.accent,
  };
  return {
    color:  CP.green,
    bg:     "rgba(13,154,85,0.1)",
    border: "rgba(13,154,85,0.22)",
    label:  "Safe",
    topBar: CP.green,
  };
};

// ---------------------------------------------------------------------------
// Scan data helpers
// ---------------------------------------------------------------------------
const getScanName = (scan) =>
  scan?.name || scan?.scanName || scan?.ScanName || "Unnamed Scan";

const parseScanDate = (scan) => {
  const raw = scan?.date || scan?.scanDate || scan?.ScanDate ||
              scan?.CreatedAt || scan?.createdAt || scan?.Created || scan?.created || "";
  const d = raw ? new Date(raw) : null;
  return d && !isNaN(d.getTime()) ? d : null;
};

const formatScanDate = (scan) => {
  const d = parseScanDate(scan);
  if (!d) return "";
  return d.toLocaleString("en-US", {
    month: "short", day: "numeric", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
};

const getStackPreview = (scan) => {
  const raw = scan?.stackPreview || scan?.stackText || scan?.stackDetails ||
              scan?.resultsSummary || "";
  return String(raw || "").replace(/\s+/g, " ").trim();
};

// ---------------------------------------------------------------------------
// Summary stat chip
// ---------------------------------------------------------------------------
function StatChip({ label, value, color, bg, border }) {
  return (
    <div style={{
      display:       "inline-flex",
      alignItems:    "center",
      gap:           "6px",
      padding:       "6px 14px",
      background:    bg,
      border:        `0.5px solid ${border}`,
    }}>
      <span style={{
        fontFamily:    CP.fontBC,
        fontWeight:    900,
        fontStyle:     "italic",
        fontSize:      "18px",
        lineHeight:    1,
        color,
        letterSpacing: "-0.02em",
      }}>
        {value}
      </span>
      <span style={{
        fontFamily:    CP.fontBC,
        fontSize:      "10px",
        fontWeight:    700,
        letterSpacing: "0.12em",
        textTransform: "uppercase",
        color:         CP.dim,
      }}>
        {label}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Filter chip
// ---------------------------------------------------------------------------
function FilterChip({ label, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding:       "6px 16px",
        fontFamily:    CP.fontBC,
        fontSize:      "12px",
        fontWeight:    700,
        letterSpacing: "0.1em",
        textTransform: "uppercase",
        background:    active ? CP.accent : "transparent",
        color:         active ? CP.black  : CP.dim,
        border:        active ? "none" : `0.5px solid ${CP.border}`,
        cursor:        "pointer",
        transition:    "background 0.15s, color 0.15s",
      }}
    >
      {label}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Scan card
// ---------------------------------------------------------------------------
function ScanCard({ scan, onView }) {
  const meta        = riskMeta(scan);
  const name        = getScanName(scan);
  const date        = formatScanDate(scan);
  const preview     = getStackPreview(scan);
  const snippet     = preview.length > 120 ? preview.slice(0, 120) + "…" : preview;
  const { prohibited, limited, other } = getRiskCounts(scan);

  return (
    <div
      onClick={onView}
      style={{
        background:  CP.surface,
        border:      `0.5px solid ${CP.border}`,
        borderLeft:  `2px solid ${meta.topBar}`,
        padding:     "20px 24px",
        cursor:      "pointer",
        transition:  "border-color 0.18s",
      }}
      onMouseEnter={e => e.currentTarget.style.borderColor = meta.topBar}
      onMouseLeave={e => e.currentTarget.style.borderLeftColor = meta.topBar}
    >
      <div className="sc-scan-row">
        {/* Left: info */}
        <div style={{ minWidth: 0 }}>
          {/* Name + date */}
          <div style={{ display: "flex", alignItems: "baseline", gap: "12px", flexWrap: "wrap", marginBottom: "10px" }}>
            <p style={{
              fontFamily:    CP.fontBC,
              fontSize:      "18px",
              fontWeight:    700,
              letterSpacing: "0.04em",
              textTransform: "uppercase",
              color:         CP.white,
              whiteSpace:    "nowrap",
              overflow:      "hidden",
              textOverflow:  "ellipsis",
              maxWidth:      "100%",
            }}>
              {name}
            </p>
            {date && (
              <span style={{
                fontFamily:    CP.fontB,
                fontSize:      "12px",
                color:         CP.dim,
                flexShrink:    0,
              }}>
                {date}
              </span>
            )}
          </div>

          {/* Risk badge + breakdown chips */}
          <div className="sc-chips">
            {/* Primary risk badge */}
            <span style={{
              display:       "inline-block",
              padding:       "5px 12px",
              fontFamily:    CP.fontBC,
              fontSize:      "12px",
              fontWeight:    700,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color:         meta.color,
              background:    meta.bg,
              border:        `0.5px solid ${meta.border}`,
            }}>
              {meta.label}
            </span>

            {/* Breakdown chips — only show non-zero counts */}
            {prohibited > 0 && (
              <span style={{ display: "inline-flex", alignItems: "center", gap: "6px", padding: "5px 12px", fontFamily: CP.fontBC, fontSize: "11px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: CP.red, background: "rgba(217,43,58,0.07)", border: `0.5px solid rgba(217,43,58,0.2)` }}>
                <span style={{ width: "5px", height: "5px", borderRadius: "50%", background: CP.red, flexShrink: 0 }} />
                {prohibited} Prohibited
              </span>
            )}
            {limited > 0 && (
              <span style={{ display: "inline-flex", alignItems: "center", gap: "6px", padding: "5px 12px", fontFamily: CP.fontBC, fontSize: "11px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: CP.amber, background: "rgba(212,144,10,0.07)", border: `0.5px solid rgba(212,144,10,0.2)` }}>
                <span style={{ width: "5px", height: "5px", borderRadius: "50%", background: CP.amber, flexShrink: 0 }} />
                {limited} Limited
              </span>
            )}
            {other > 0 && (
              <span style={{ display: "inline-flex", alignItems: "center", gap: "6px", padding: "5px 12px", fontFamily: CP.fontBC, fontSize: "11px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: CP.accent, background: "rgba(79,171,255,0.07)", border: `0.5px solid rgba(79,171,255,0.2)` }}>
                <span style={{ width: "5px", height: "5px", borderRadius: "50%", background: CP.accent, flexShrink: 0 }} />
                {other} Other
              </span>
            )}
          </div>

          {/* Stack preview */}
          {snippet && (
            <p style={{
              fontFamily:  CP.fontB,
              fontSize:    "13px",
              color:       CP.dim,
              marginTop:   "12px",
              lineHeight:  1.65,
            }}>
              <span style={{ color: CP.ghost, fontWeight: 600 }}>Preview: </span>
              {snippet}
            </p>
          )}
        </div>

        {/* Right: CTA */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end" }}>
          <span style={{
            fontFamily:    CP.fontBC,
            fontSize:      "11px",
            fontWeight:    700,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color:         CP.accent,
            padding:       "7px 14px",
            border:        `0.5px solid rgba(79,171,255,0.3)`,
            whiteSpace:    "nowrap",
          }}>
            View Details →
          </span>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------
function ScanSkeleton() {
  return (
    <div style={{
      background:  CP.surface,
      border:      `0.5px solid ${CP.border}`,
      borderLeft:  `2px solid ${CP.border}`,
      padding:     "16px 20px",
      position:    "relative",
      overflow:    "hidden",
    }}>
      <style>{`@keyframes shimmer{0%{transform:translateX(-100%)}100%{transform:translateX(100%)}}`}</style>
      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(90deg,transparent,rgba(255,255,255,0.03),transparent)", animation: "shimmer 1.6s infinite" }} />
      <div style={{ height: "14px", width: "40%", background: CP.raised, marginBottom: "10px" }} />
      <div style={{ height: "10px", width: "20%", background: CP.raised, marginBottom: "12px" }} />
      <div style={{ display: "flex", gap: "8px" }}>
        <div style={{ height: "22px", width: "80px", background: CP.raised }} />
        <div style={{ height: "22px", width: "80px", background: CP.raised }} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default function ScansPage() {
  const router = useRouter();
  const { user } = useAuthContext();

  const [scans,     setScans]     = useState([]);
  const [loading,   setLoading]   = useState(false);
  const [query,     setQuery]     = useState("");
  const [riskFilter,setRiskFilter]= useState("All");
  const [sortBy,    setSortBy]    = useState("Newest");

  useEffect(() => {
    if (!user) { router.push("/login"); return; }

    try {
      trackEvent("page_view_my_scans", {
        eventType: "page_view",
        userEmail: user.Email || user.email || "",
        path:   typeof window    !== "undefined" ? window.location.pathname : "",
        source: "my_scans_page",
        device: typeof navigator !== "undefined" ? navigator.userAgent    : "",
      });
    } catch {}

    async function fetchScans() {
      try {
        setLoading(true);
        const email = user.Email || user.email;
        if (!email) { setScans([]); return; }
        const res  = await fetch(`/api/getScans?userEmail=${encodeURIComponent(email)}`);
        const data = await res.json().catch(() => ({}));
        setScans(Array.isArray(data?.scans) ? data.scans : []);
      } catch { setScans([]); }
      finally  { setLoading(false); }
    }

    fetchScans();
  }, [user, router]);

  if (!user) return null;

  /* ── Summary stats ── */
  const summary = useMemo(() => {
    let prohibited = 0, limited = 0, other = 0, safe = 0;
    for (const s of scans) {
      const c = getRiskClass(s);
      if (c === "Prohibited") prohibited++;
      else if (c === "Limited") limited++;
      else if (c === "Other")   other++;
      else                      safe++;
    }
    return { total: scans.length, prohibited, limited, other, safe };
  }, [scans]);

  /* ── Filtered + sorted list ── */
  const filteredScans = useMemo(() => {
    const q = String(query || "").trim().toLowerCase();
    let out = scans.slice();

    if (riskFilter !== "All") out = out.filter(s => getRiskClass(s) === riskFilter);
    if (q) out = out.filter(s =>
      getScanName(s).toLowerCase().includes(q) ||
      getStackPreview(s).toLowerCase().includes(q)
    );

    out.sort((a, b) => {
      if (sortBy === "Newest")       return (parseScanDate(b)?.getTime() || 0) - (parseScanDate(a)?.getTime() || 0);
      if (sortBy === "Oldest")       return (parseScanDate(a)?.getTime() || 0) - (parseScanDate(b)?.getTime() || 0);
      if (sortBy === "Highest Risk") return getRiskScore(b) - getRiskScore(a);
      if (sortBy === "Lowest Risk")  return getRiskScore(a) - getRiskScore(b);
      return 0;
    });

    return out;
  }, [scans, query, riskFilter, sortBy]);

  const handleView = async (scan) => {
    try {
      await trackEvent("scan_viewed", {
        eventType: "scan_view",
        userEmail: user.Email || user.email || "",
        source:    "my_scans_page",
        payload:   { scanId: scan.id, scanName: getScanName(scan), ...getRiskCounts(scan) },
      });
    } catch {}
    router.push(`/scans/${scan.id}`);
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <>
      <style>{SCANS_CSS}</style>

      <div style={{ minHeight: "100vh", background: CP.black, color: CP.white, fontFamily: CP.fontB, position: "relative" }}>

        {/* Grain */}
        <div aria-hidden="true" style={{
          position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0, opacity: 0.025,
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 512 512' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
          backgroundRepeat: "repeat", backgroundSize: "256px",
        }} />

        {/* Top accent line */}
        <div aria-hidden="true" style={{ height: "1px", background: `linear-gradient(90deg,transparent,${CP.accent} 30%,${CP.accent} 70%,transparent)`, opacity: 0.25, position: "relative", zIndex: 1 }} />

        <div style={{ maxWidth: "900px", margin: "0 auto", padding: "36px 20px 64px", position: "relative", zIndex: 2 }}>

          {/* ── Page header ── */}
          <div style={{ marginBottom: "28px" }}>
            <Eyebrow>Supplement History</Eyebrow>
            <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: "16px", flexWrap: "wrap" }}>
              <h1 style={{
                fontFamily:    CP.fontBC,
                fontWeight:    900,
                fontStyle:     "italic",
                fontSize:      "clamp(40px, 7vw, 64px)",
                lineHeight:    0.88,
                letterSpacing: "-0.02em",
                textTransform: "uppercase",
                color:         CP.white,
              }}>
                My Scans.
              </h1>
              <Link href="/nutrition-label-scanner" style={{ textDecoration: "none" }}>
                <CtaButton onClick={() => {}}>
                  New Scan
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
                  </svg>
                </CtaButton>
              </Link>
            </div>

            {/* Summary stat chips */}
            <div className="sc-summary" style={{ marginTop: "18px" }}>
              <StatChip label="Total"      value={summary.total}      color={CP.white}  bg="rgba(255,255,255,0.04)" border={CP.border} />
              <StatChip label="Prohibited" value={summary.prohibited} color={CP.red}    bg="rgba(217,43,58,0.08)"   border="rgba(217,43,58,0.2)" />
              <StatChip label="Limited"    value={summary.limited}    color={CP.amber}  bg="rgba(212,144,10,0.08)"  border="rgba(212,144,10,0.2)" />
              <StatChip label="Other"      value={summary.other}      color={CP.accent} bg="rgba(79,171,255,0.08)"  border="rgba(79,171,255,0.2)" />
              <StatChip label="Safe"       value={summary.safe}       color={CP.green}  bg="rgba(13,154,85,0.08)"   border="rgba(13,154,85,0.2)" />
            </div>
          </div>

          {/* ── Controls panel ── */}
          <div style={{
            background:   CP.surface,
            border:       `0.5px solid ${CP.border}`,
            padding:      "20px 22px",
            marginBottom: "12px",
          }}>
            {/* Search + Sort */}
            <div className="sc-controls" style={{ marginBottom: "14px" }}>
              <div>
                <label style={{ fontFamily: CP.fontBC, fontSize: "10px", fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: CP.dim, display: "block", marginBottom: "6px" }}>
                  Search
                </label>
                <input
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder="Search by name or ingredient…"
                  style={{
                    width:       "100%",
                    padding:     "9px 14px",
                    background:  CP.raised,
                    border:      `0.5px solid ${CP.border}`,
                    color:       CP.white,
                    fontFamily:  CP.fontB,
                    fontSize:    "13px",
                    outline:     "none",
                  }}
                  onFocus={e  => e.target.style.borderColor = `rgba(79,171,255,0.4)`}
                  onBlur={e   => e.target.style.borderColor = CP.border}
                />
              </div>

              <div>
                <label style={{ fontFamily: CP.fontBC, fontSize: "10px", fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: CP.dim, display: "block", marginBottom: "6px" }}>
                  Sort
                </label>
                <select
                  value={sortBy}
                  onChange={e => setSortBy(e.target.value)}
                  style={{
                    width:      "100%",
                    padding:    "9px 14px",
                    background: CP.raised,
                    border:     `0.5px solid ${CP.border}`,
                    color:      CP.white,
                    fontFamily: CP.fontBC,
                    fontSize:   "12px",
                    fontWeight: 700,
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    outline:    "none",
                    appearance: "none",
                    cursor:     "pointer",
                  }}
                >
                  <option value="Newest">Newest</option>
                  <option value="Oldest">Oldest</option>
                  <option value="Highest Risk">Highest Risk</option>
                  <option value="Lowest Risk">Lowest Risk</option>
                </select>
              </div>
            </div>

            {/* Filter chips + count */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "10px" }}>
              <div style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
                {["All", "Prohibited", "Limited", "Other", "Safe"].map(label => (
                  <FilterChip
                    key={label}
                    label={label}
                    active={riskFilter === label}
                    onClick={() => setRiskFilter(label)}
                  />
                ))}
              </div>

              <p style={{ fontFamily: CP.fontB, fontSize: "12px", color: CP.dim }}>
                Showing <span style={{ color: CP.ghost, fontWeight: 600 }}>{filteredScans.length}</span> of <span style={{ color: CP.ghost, fontWeight: 600 }}>{scans.length}</span>
              </p>
            </div>
          </div>

          {/* ── Results ── */}
          {loading ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {[1,2,3].map(i => <ScanSkeleton key={i} />)}
            </div>

          ) : filteredScans.length === 0 ? (
            <div style={{
              background:  CP.surface,
              border:      `0.5px solid ${CP.border}`,
              padding:     "48px 24px",
              textAlign:   "center",
            }}>
              <p style={{ fontFamily: CP.fontBC, fontWeight: 900, fontStyle: "italic", fontSize: "28px", textTransform: "uppercase", color: CP.white, marginBottom: "8px" }}>
                {scans.length === 0 ? "No Scans Yet." : "No Matches."}
              </p>
              <p style={{ fontFamily: CP.fontB, fontSize: "13px", color: CP.dim, marginBottom: "24px", lineHeight: 1.6 }}>
                {scans.length === 0
                  ? "Run your first supplement label scan to start building your history."
                  : "Try clearing your search or changing the filter."}
              </p>
              <div style={{ display: "flex", gap: "8px", justifyContent: "center", flexWrap: "wrap" }}>
                {scans.length > 0 && (
                  <CtaButton ghost onClick={() => { setQuery(""); setRiskFilter("All"); setSortBy("Newest"); }}>
                    Clear Filters
                  </CtaButton>
                )}
                <Link href="/nutrition-label-scanner" style={{ textDecoration: "none" }}>
                  <CtaButton onClick={() => {}}>
                    Scan a Label →
                  </CtaButton>
                </Link>
              </div>
            </div>

          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {filteredScans.map(scan => (
                <ScanCard key={scan.id} scan={scan} onView={() => handleView(scan)} />
              ))}
            </div>
          )}

        </div>
      </div>
    </>
  );
}