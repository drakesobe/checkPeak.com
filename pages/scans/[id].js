// pages/scans/[id].js — CheckPeak Scan Detail Page
// Dark editorial wrapper + reuses existing ScanSummaryCard component
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { useAuthContext } from "@/hooks/useAuth";
import { trackEvent } from "@/lib/analytics";
import ScanSummaryCard from "@/components/ScanSummaryCard";
import { DS, FONT_STYLE, BAN_TYPE_CONFIG, INGREDIENT_COLOR } from "@/components/scanResultsTokens";

// ---------------------------------------------------------------------------
// Design Tokens (same as dashboard/scans-index)
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

const DETAIL_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:ital,wght@0,700;0,900;1,900&family=Barlow:wght@400;500;600&display=swap');

  .sd-substances {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 10px;
  }

  @media (max-width: 639px) {
    .sd-substances { grid-template-columns: 1fr; }
  }
`;

// ---------------------------------------------------------------------------
// Grain overlay
// ---------------------------------------------------------------------------
const GRAIN = `url("data:image/svg+xml,%3Csvg viewBox='0 0 512 512' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`;

// ---------------------------------------------------------------------------
// Data helpers (mirrors scans/index.js)
// ---------------------------------------------------------------------------
const getScanName = (s) => s?.name || s?.scanName || s?.ScanName || "Unnamed Scan";

const parseScanDate = (s) => {
  const raw = s?.date || s?.scanDate || s?.ScanDate ||
              s?.CreatedAt || s?.createdAt || s?.Created || s?.created || "";
  const d = raw ? new Date(raw) : null;
  return d && !isNaN(d.getTime()) ? d : null;
};

const formatScanDate = (s) => {
  const d = parseScanDate(s);
  if (!d) return "";
  return d.toLocaleString("en-US", {
    weekday: "short", month: "short", day: "numeric",
    year: "numeric", hour: "2-digit", minute: "2-digit",
  });
};

// Pull the substances array from wherever the API puts it
const getSubstances = (scan) =>
  scan?.substances || scan?.flaggedSubstances || scan?.ingredients || scan?.results || [];

// ---------------------------------------------------------------------------
// Substance card (dark-themed, mirrors DS token colours for ban type)
// ---------------------------------------------------------------------------
function SubstanceRow({ substance, index }) {
  const [open, setOpen] = useState(false);

  const banType  = substance?.banType  || substance?.BanType  || substance?.type || "";
  const name     = substance?.name     || substance?.Name     || substance?.ingredient || `Substance ${index + 1}`;
  const notes    = substance?.notes    || substance?.Notes    || substance?.description || "";
  const wada     = substance?.wada     || substance?.wadaCode || "";
  const isIngredient = !banType || banType.toLowerCase() === "ingredient";

  // Map ban type → accent color using BAN_TYPE_CONFIG from tokens
  const cfg = BAN_TYPE_CONFIG.find(b =>
    b.label.toLowerCase() === banType.toLowerCase()
  );

  const accentColor = isIngredient
    ? INGREDIENT_COLOR
    : cfg?.color || CP.red;

  const accentBg     = isIngredient ? "rgba(109,63,187,0.08)"  : "rgba(217,43,58,0.08)";
  const accentBorder = isIngredient ? "rgba(109,63,187,0.2)"   : "rgba(217,43,58,0.2)";

  const badgeLabel = isIngredient ? "Ingredient" : (banType || "Flagged");

  return (
    <div style={{
      background:  CP.surface,
      border:      `0.5px solid ${CP.border}`,
      borderLeft:  `2px solid ${accentColor}`,
      overflow:    "hidden",
    }}>
      {/* Main row */}
      <div
        onClick={() => notes || wada ? setOpen(o => !o) : null}
        style={{
          padding:  "14px 18px",
          cursor:   notes || wada ? "pointer" : "default",
          display:  "flex",
          alignItems: "flex-start",
          gap:      "12px",
          justifyContent: "space-between",
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{
            fontFamily:    CP.fontBC,
            fontSize:      "15px",
            fontWeight:    700,
            letterSpacing: "0.04em",
            textTransform: "uppercase",
            color:         CP.white,
            marginBottom:  "6px",
            lineHeight:    1.3,
          }}>
            {name}
          </p>

          <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
            <span style={{
              display:       "inline-block",
              padding:       "3px 10px",
              fontFamily:    CP.fontBC,
              fontSize:      "11px",
              fontWeight:    700,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color:         accentColor,
              background:    accentBg,
              border:        `0.5px solid ${accentBorder}`,
            }}>
              {badgeLabel}
            </span>
            {wada && (
              <span style={{
                fontFamily:    CP.fontB,
                fontSize:      "11px",
                color:         CP.dim,
              }}>
                WADA: {wada}
              </span>
            )}
          </div>
        </div>

        {(notes || wada) && (
          <span style={{
            fontFamily:    CP.fontBC,
            fontSize:      "11px",
            fontWeight:    700,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color:         CP.dim,
            flexShrink:    0,
            marginTop:     "2px",
          }}>
            {open ? "Less ▲" : "More ▼"}
          </span>
        )}
      </div>

      {/* Expandable notes */}
      {open && notes && (
        <div style={{
          borderTop:  `0.5px solid ${CP.border}`,
          padding:    "12px 18px 14px",
          background: CP.raised,
        }}>
          <p style={{
            fontFamily:    CP.fontB,
            fontSize:      "13px",
            color:         CP.ghost,
            lineHeight:    1.7,
          }}>
            {notes}
          </p>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------
function Skeleton({ height = "120px" }) {
  return (
    <div style={{ height, background: CP.surface, border: `0.5px solid ${CP.border}`, position: "relative", overflow: "hidden" }}>
      <style>{`@keyframes shimmer{0%{transform:translateX(-100%)}100%{transform:translateX(100%)}}`}</style>
      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(90deg,transparent,rgba(255,255,255,0.03),transparent)", animation: "shimmer 1.6s infinite" }} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default function ScanDetailPage() {
  const router       = useRouter();
  const { id }       = router.query;
  const { user }     = useAuthContext();
  const [scan,    setScan]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  useEffect(() => {
    if (!user) { router.push("/login"); return; }
    if (!id)   return;

    async function fetchScan() {
      try {
        setLoading(true);
        setError(null);

        const email = user.Email || user.email || "";

        // Try a dedicated single-scan endpoint first, fall back to filtering the list
        let found = null;

        const singleRes = await fetch(
          `/api/getScan?id=${encodeURIComponent(id)}&userEmail=${encodeURIComponent(email)}`
        ).catch(() => null);

        if (singleRes?.ok) {
          const data = await singleRes.json().catch(() => ({}));
          found = data?.scan || data || null;
        }

        // Fallback: pull full list and find by id
        if (!found) {
          const listRes = await fetch(
            `/api/getScans?userEmail=${encodeURIComponent(email)}`
          );
          const listData = await listRes.json().catch(() => ({}));
          const scans = Array.isArray(listData?.scans) ? listData.scans : [];
          found = scans.find(s => String(s.id) === String(id)) || null;
        }

        if (!found) { setError("Scan not found."); return; }

        setScan(found);

        try {
          trackEvent("scan_viewed", {
            eventType: "scan_view",
            userEmail: email,
            source:    "scan_detail_page",
            payload:   { scanId: id, scanName: getScanName(found) },
          });
        } catch {}

      } catch (err) {
        console.error("Failed to fetch scan:", err);
        setError("Something went wrong loading this scan.");
      } finally {
        setLoading(false);
      }
    }

    fetchScan();
  }, [user, id, router]);

  if (!user) return null;

  // Derived data
  const name         = scan ? getScanName(scan) : "";
  const dateStr      = scan ? formatScanDate(scan) : "";
  const prohibited   = Number(scan?.prohibitedCount || 0);
  const limited      = Number(scan?.limitedCount    || 0);
  const other        = Number(scan?.otherCount      || 0);
  const bannedCount  = prohibited;
  const ingredientCount = (scan ? getSubstances(scan).filter(s => {
    const bt = s?.banType || s?.BanType || s?.type || "";
    return !bt || bt.toLowerCase() === "ingredient";
  }).length : 0);
  const substances   = scan ? getSubstances(scan) : [];
  const flagged      = substances.filter(s => {
    const bt = s?.banType || s?.BanType || s?.type || "";
    return bt && bt.toLowerCase() !== "ingredient";
  });
  const ingredients  = substances.filter(s => {
    const bt = s?.banType || s?.BanType || s?.type || "";
    return !bt || bt.toLowerCase() === "ingredient";
  });

  const scanMethod   = scan?.scanMethod || scan?.method || "ocr";
  const scanMeta     = scan?.scanMeta   || scan?.meta   || null;

  return (
    <>
      <style>{DETAIL_CSS}</style>
      <style>{FONT_STYLE}</style>

      <div style={{ minHeight: "100vh", background: CP.black, color: CP.white, fontFamily: CP.fontB, position: "relative" }}>

        {/* Grain */}
        <div aria-hidden="true" style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0, opacity: 0.025, backgroundImage: GRAIN, backgroundRepeat: "repeat", backgroundSize: "256px" }} />

        {/* Top accent line */}
        <div aria-hidden="true" style={{ height: "1px", background: `linear-gradient(90deg,transparent,${CP.accent} 30%,${CP.accent} 70%,transparent)`, opacity: 0.25, position: "relative", zIndex: 1 }} />

        <div style={{ maxWidth: "860px", margin: "0 auto", padding: "32px 20px 72px", position: "relative", zIndex: 2 }}>

          {/* ── Back link ── */}
          <button
            onClick={() => router.push("/scans")}
            style={{
              display:       "inline-flex",
              alignItems:    "center",
              gap:           "8px",
              fontFamily:    CP.fontBC,
              fontSize:      "11px",
              fontWeight:    700,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color:         CP.dim,
              background:    "none",
              border:        "none",
              cursor:        "pointer",
              marginBottom:  "28px",
              padding:       0,
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>
            </svg>
            All Scans
          </button>

          {/* ── Loading ── */}
          {loading && (
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <Skeleton height="80px"  />
              <Skeleton height="180px" />
              <Skeleton height="120px" />
            </div>
          )}

          {/* ── Error ── */}
          {!loading && error && (
            <div style={{ background: CP.surface, border: `0.5px solid ${CP.border}`, borderLeft: `2px solid ${CP.red}`, padding: "32px 24px", textAlign: "center" }}>
              <p style={{ fontFamily: CP.fontBC, fontWeight: 900, fontStyle: "italic", fontSize: "28px", textTransform: "uppercase", color: CP.white, marginBottom: "8px" }}>
                {error}
              </p>
              <button
                onClick={() => router.push("/scans")}
                style={{ fontFamily: CP.fontBC, fontSize: "12px", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", background: CP.accent, color: CP.black, border: "none", padding: "9px 20px", cursor: "pointer", marginTop: "8px" }}
              >
                Back to Scans →
              </button>
            </div>
          )}

          {/* ── Scan detail ── */}
          {!loading && scan && (
            <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>

              {/* Page heading */}
              <div>
                <p style={{ fontFamily: CP.fontBC, fontSize: "10px", fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", color: CP.dim, display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px" }}>
                  <span style={{ display: "block", width: "20px", height: "0.5px", background: CP.faint }} />
                  Scan Detail
                </p>
                <h1 style={{
                  fontFamily:    CP.fontBC,
                  fontWeight:    900,
                  fontStyle:     "italic",
                  fontSize:      "clamp(32px, 6vw, 54px)",
                  lineHeight:    0.9,
                  letterSpacing: "-0.02em",
                  textTransform: "uppercase",
                  color:         CP.white,
                  wordBreak:     "break-word",
                  marginBottom:  "10px",
                }}>
                  {name}
                </h1>
                {dateStr && (
                  <p style={{ fontFamily: CP.fontB, fontSize: "13px", color: CP.dim, lineHeight: 1.5 }}>
                    Scanned {dateStr}
                  </p>
                )}
              </div>

              {/* ── ScanSummaryCard — reuses existing component with its own light tokens ── */}
              <ScanSummaryCard
                bannedCount={bannedCount}
                ingredientCount={ingredientCount}
                scanMethod={scanMethod}
                scanMeta={scanMeta}
                scanMetaList={scan?.scanMetaList || null}
              />

              {/* ── Flagged substances ── */}
              {flagged.length > 0 && (
                <section>
                  <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: "12px" }}>
                    <p style={{ fontFamily: CP.fontBC, fontSize: "10px", fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", color: "rgba(217,43,58,0.65)", display: "flex", alignItems: "center", gap: "10px" }}>
                      <span style={{ display: "block", width: "20px", height: "0.5px", background: "rgba(217,43,58,0.3)" }} />
                      Flagged · {flagged.length}
                    </p>
                  </div>
                  <div className="sd-substances">
                    {flagged.map((s, i) => (
                      <SubstanceRow key={s.id || i} substance={s} index={i} />
                    ))}
                  </div>
                </section>
              )}

              {/* ── All ingredients ── */}
              {ingredients.length > 0 && (
                <section>
                  <p style={{ fontFamily: CP.fontBC, fontSize: "10px", fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", color: CP.dim, display: "flex", alignItems: "center", gap: "10px", marginBottom: "12px" }}>
                    <span style={{ display: "block", width: "20px", height: "0.5px", background: CP.faint }} />
                    All Ingredients · {ingredients.length}
                  </p>
                  <div className="sd-substances">
                    {ingredients.map((s, i) => (
                      <SubstanceRow key={s.id || i} substance={s} index={i} />
                    ))}
                  </div>
                </section>
              )}

              {/* ── Stack preview / raw text ── */}
              {(scan?.stackPreview || scan?.stackText || scan?.stackDetails || scan?.resultsSummary) && (
                <section style={{ background: CP.surface, border: `0.5px solid ${CP.border}`, padding: "18px 22px" }}>
                  <p style={{ fontFamily: CP.fontBC, fontSize: "10px", fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", color: CP.dim, marginBottom: "10px" }}>
                    Stack Preview
                  </p>
                  <p style={{ fontFamily: CP.fontB, fontSize: "13px", color: CP.ghost, lineHeight: 1.75 }}>
                    {scan.stackPreview || scan.stackText || scan.stackDetails || scan.resultsSummary}
                  </p>
                </section>
              )}

              {/* ── Bottom action ── */}
              <div style={{ display: "flex", gap: "10px", paddingTop: "4px" }}>
                <button
                  onClick={() => router.push("/scans")}
                  style={{ fontFamily: CP.fontBC, fontSize: "12px", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", background: "transparent", color: CP.dim, border: `0.5px solid ${CP.border}`, padding: "9px 20px", cursor: "pointer" }}
                >
                  ← Back to Scans
                </button>
                <button
                  onClick={() => router.push("/nutrition-label-scanner")}
                  style={{ fontFamily: CP.fontBC, fontSize: "12px", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", background: CP.accent, color: CP.black, border: "none", padding: "9px 20px", cursor: "pointer" }}
                >
                  Scan Another Label →
                </button>
              </div>

            </div>
          )}

        </div>
      </div>
    </>
  );
}