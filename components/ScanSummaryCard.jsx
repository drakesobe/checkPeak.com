// components/ScanSummaryCard.jsx
"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

/**
 * ScanSummaryCard
 *
 * Displays:
 *   - Risk headline (calm, not alarming)
 *   - Three stat chips: total / banned / ingredients
 *   - Quality chip + scan meta pills
 *   - Guidance text for low-quality scans
 *   - Optional multi-scan detail drawer
 *
 * Tone: "clear but calm" — banned results are visible and actionable
 * without triggering panic. An athlete finding 1 banned substance needs
 * to understand it, not be alarmed by it.
 */

import { DS, FONT_STYLE } from "./scanResultsTokens";

// ---------------------------------------------------------------------------
// Sub-pieces
// ---------------------------------------------------------------------------

function StatChip({ label, value, tone = "neutral" }) {
  const styles = {
    neutral: { bg: DS.pageBg,   border: DS.border,       text: DS.bodyText,  label: DS.labelText  },
    banned:  { bg: DS.bannedBg, border: DS.bannedBorder, text: DS.banned,    label: DS.banned     },
    safe:    { bg: DS.safeBg,   border: DS.safeBorder,   text: DS.safe,      label: DS.safe       },
  };
  const s = styles[tone] ?? styles.neutral;

  return (
    <div
      className="flex flex-col items-center justify-center rounded-2xl px-4 py-3 min-w-[80px]"
      style={{ backgroundColor: s.bg, border: `1.5px solid ${s.border}` }}
    >
      <p
        className="sr-body text-[22px] font-bold leading-none"
        style={{ color: s.text, fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: "0.02em" }}
      >
        {value}
      </p>
      <p className="sr-body text-[10px] font-semibold uppercase tracking-widest mt-1" style={{ color: s.label }}>
        {label}
      </p>
    </div>
  );
}

function QualityChip({ quality }) {
  if (!quality) return null;
  const tone = quality.tone ?? "warn";
  const styles = {
    good: { bg: DS.safeBg,    border: DS.safeBorder,    text: DS.safe    },
    warn: { bg: DS.cautionBg, border: DS.cautionBorder, text: DS.caution },
    bad:  { bg: DS.bannedBg,  border: DS.bannedBorder,  text: DS.banned  },
  };
  const s = styles[tone] ?? styles.warn;

  return (
    <span
      className="sr-body inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold"
      style={{ backgroundColor: s.bg, border: `1px solid ${s.border}`, color: s.text }}
    >
      {quality.label}
      {typeof quality.score === "number" && (
        <span className="opacity-60 font-medium">{Math.round(quality.score)}</span>
      )}
    </span>
  );
}

function MetaPill({ children, tone = "neutral" }) {
  const styles = {
    neutral: { bg: DS.pageBg,   border: DS.border,        text: DS.labelText },
    blue:    { bg: DS.brandBg,  border: DS.brandBorder,   text: DS.brand     },
    good:    { bg: DS.safeBg,   border: DS.safeBorder,    text: DS.safe      },
    warn:    { bg: DS.cautionBg,border: DS.cautionBorder, text: DS.caution   },
    bad:     { bg: DS.bannedBg, border: DS.bannedBorder,  text: DS.banned    },
  };
  const s = styles[tone] ?? styles.neutral;

  return (
    <span
      className="sr-body inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium"
      style={{ backgroundColor: s.bg, border: `1px solid ${s.border}`, color: s.text }}
    >
      {children}
    </span>
  );
}

function fmtFileName(name = "") {
  if (!name) return "";
  return name.length <= 28 ? name : name.slice(0, 16) + "…" + name.slice(-8);
}

// ---------------------------------------------------------------------------
// ScanSummaryCard
// ---------------------------------------------------------------------------

export default function ScanSummaryCard({
  bannedCount     = 0,
  ingredientCount = 0,
  scanMethod      = "ocr",
  scanMeta        = null,
  scanMetaList    = null,
}) {
  const [detailsOpen, setDetailsOpen] = useState(false);

  const totalMatches = bannedCount + ingredientCount;

  // Headline — calm, factual
  const headline =
    bannedCount === 0
      ? "No banned substances detected"
      : bannedCount === 1
      ? "1 banned substance detected"
      : `${bannedCount} banned substances detected`;

  const subtext =
    bannedCount === 0
      ? "All detected substances checked out. Review the ingredient cards below for usage notes."
      : "Review the flagged substances below. Always confirm with your program's compliance officer before making decisions.";

  const summaryTone = bannedCount === 0 ? "safe" : "banned";

  // Meta pills
  const metaPills = [];
  metaPills.push(
    <MetaPill key="method" tone="blue">
      {scanMethod === "barcode" ? "Barcode lookup" : "Label OCR"}
    </MetaPill>
  );
  if (scanMeta?.cropped === true)  metaPills.push(<MetaPill key="cropped" tone="good">Cropped</MetaPill>);
  if (scanMeta?.cropped === false && scanMethod === "ocr")
    metaPills.push(<MetaPill key="notcropped" tone="warn">Not cropped</MetaPill>);
  if (scanMeta?.psmUsed   != null && scanMethod === "ocr")
    metaPills.push(<MetaPill key="psm">PSM {scanMeta.psmUsed}</MetaPill>);
  if (scanMeta?.preprocess && scanMethod === "ocr")
    metaPills.push(<MetaPill key="prep">Pre: {scanMeta.preprocess}</MetaPill>);
  const fn = fmtFileName(scanMeta?.fileName);
  if (fn) metaPills.push(<MetaPill key="file">File: {fn}</MetaPill>);
  if (scanMeta?.athleteName)
    metaPills.push(<MetaPill key="athlete">Athlete: {scanMeta.athleteName}</MetaPill>);
  if (scanMeta?.index != null && scanMeta?.total != null)
    metaPills.push(<MetaPill key="idx">Label {+scanMeta.index + 1}/{scanMeta.total}</MetaPill>);

  // Guidance text for low-quality scans
  const guidanceTone = scanMeta?.quality?.tone;
  const guidance =
    guidanceTone === "bad"  ? "Scan clarity was low. Try retaking with better lighting and crop tighter to the ingredients panel." :
    guidanceTone === "warn" ? "Scan is okay. If any ingredients seem missing, try a tighter crop." :
    scanMethod === "barcode" ? "If the barcode lookup missed ingredients, try scanning the label directly." :
    null;

  return (
    <div
      className="sr-body rounded-2xl overflow-hidden"
      style={{
        backgroundColor: DS.cardBg,
        border: `1.5px solid ${DS.border}`,
        boxShadow: "0 1px 8px rgba(0,0,0,0.05)",
      }}
    >
      {/* Top accent strip — subtle color signal */}
      <div
        style={{
          height: 4,
          backgroundColor: bannedCount === 0 ? DS.safe : DS.banned,
          opacity: bannedCount === 0 ? 0.6 : 0.8,
        }}
      />

      <div className="px-5 py-5 space-y-4">
        {/* Headline row */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="space-y-1.5 flex-1">
            <p
              className="sr-body text-[11px] font-bold uppercase tracking-widest"
              style={{ color: DS.brandLight }}
            >
              Scan summary
            </p>
            <h2
              className="sr-display"
              style={{
                fontSize: "clamp(1.1rem, 3vw, 1.4rem)",
                fontWeight: 800,
                color: DS.bodyText,
                lineHeight: 1.2,
              }}
            >
              {headline}
            </h2>
            <p className="sr-body text-sm leading-relaxed" style={{ color: DS.labelText }}>
              {subtext}
            </p>
          </div>

          {/* Stat chips */}
          <div className="flex gap-2.5 shrink-0">
            <StatChip label="Total"       value={totalMatches}   tone="neutral"            />
            <StatChip label="Banned"      value={bannedCount}    tone={bannedCount > 0 ? "banned" : "neutral"} />
            <StatChip label="Ingredients" value={ingredientCount} tone="neutral"            />
          </div>
        </div>

        {/* Quality + meta pills */}
        {(scanMeta?.quality || metaPills.length > 0) && (
          <div className="flex flex-wrap items-center gap-2">
            {scanMeta?.quality && <QualityChip quality={scanMeta.quality} />}
            {metaPills}
          </div>
        )}

        {/* Guidance */}
        {guidance && (
          <div
            className="sr-body rounded-xl px-4 py-3 text-xs leading-relaxed"
            style={{
              backgroundColor: DS.cautionBg,
              border: `1px solid ${DS.cautionBorder}`,
              color: DS.cautionText,
            }}
          >
            {guidance}
          </div>
        )}

        {/* Multi-scan detail drawer */}
        {Array.isArray(scanMetaList) && scanMetaList.length > 1 && (
          <div style={{ borderTop: `1px solid ${DS.border}`, paddingTop: 12 }}>
            <button
              type="button"
              onClick={() => setDetailsOpen((s) => !s)}
              className="sr-body inline-flex items-center gap-2 text-xs font-bold transition"
              style={{ color: DS.brand }}
            >
              {detailsOpen ? "Hide scan details" : `Show scan details (${scanMetaList.length})`}
              <span style={{ color: DS.dimText }}>{detailsOpen ? "▲" : "▼"}</span>
            </button>

            <AnimatePresence initial={false}>
              {detailsOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="pt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                    {scanMetaList.map((item, i) => {
                      const m    = item?.meta ?? {};
                      const q    = m?.quality;
                      const tone = q?.tone ?? "warn";
                      const styles = {
                        good: { bg: DS.safeBg,    border: DS.safeBorder    },
                        warn: { bg: DS.cautionBg, border: DS.cautionBorder },
                        bad:  { bg: DS.bannedBg,  border: DS.bannedBorder  },
                      };
                      const s = styles[tone] ?? styles.warn;
                      return (
                        <div
                          key={i}
                          className="rounded-xl px-3 py-2"
                          style={{ backgroundColor: s.bg, border: `1px solid ${s.border}` }}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <p className="sr-body text-[11px] font-semibold truncate" style={{ color: DS.bodyText }}>
                              {fmtFileName(m.fileName) || `Label ${i + 1}`}
                            </p>
                            {q?.label && (
                              <span className="sr-body text-[10px] font-semibold" style={{ color: DS.labelText }}>
                                {q.label}
                              </span>
                            )}
                          </div>
                          <p className="sr-body text-[10px] mt-1" style={{ color: DS.labelText }}>
                            {m.cropped ? "Cropped" : "Not cropped"}
                            {m.psmUsed   != null ? ` · PSM ${m.psmUsed}`     : ""}
                            {m.preprocess        ? ` · Pre: ${m.preprocess}` : ""}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
}