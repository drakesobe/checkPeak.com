// components/scanner/ScanVerdict.jsx
// Verdict-first scan results: answer, why, then the full ingredient list.
"use client";

import { useMemo, useState } from "react";
import SubstanceCard from "@/components/SubstanceCard";
import { DS } from "@/components/scanResultsTokens";

const F = { cond: "'Barlow Condensed', sans-serif", body: "'Barlow', sans-serif" };

const STATUS_STYLE = {
  flagged:  { color: DS.banned,    bg: DS.bannedBg,  border: DS.bannedBorder,  icon: "✕", label: "Flagged" },
  review:   { color: DS.caution,   bg: DS.cautionBg, border: DS.cautionBorder, icon: "!", label: "Review"  },
  no_match: { color: "#475569",    bg: "#F8FAFC",    border: DS.border,        icon: "–", label: "No match" },
};

const CERT_SITES = {
  "NSF Certified for Sport":  "nsfsport.com",
  "Informed Sport":           "sport.wetestyoutrust.com",
  "Informed Choice":          "choice.wetestyoutrust.com",
  "BSCG Certified Drug Free": "bscg.org",
};

function normalizeBanType(s) {
  const v = String(s || "").trim().toLowerCase();
  if (v === "prohibited") return "Prohibited";
  if (v === "limited to out of competition" || v === "limited out of competition") return "Limited to Out of Competition";
  if (v === "particular sports") return "Particular Sports";
  return s || null;
}

const toCardRecord = (r) => ({
  id: r.id,
  matchedTerms: r.matchedTerms || [],
  fields: { ...r.fields, "Ban Type": normalizeBanType(r.fields?.["Ban Type"]) },
});

function SectionHeading({ children, count }) {
  return (
    <h3 style={{ fontFamily: F.cond, fontWeight: 900, fontSize: 15, letterSpacing: "0.1em", textTransform: "uppercase", color: DS.bodyText, margin: 0, display: "flex", alignItems: "baseline", gap: 8 }}>
      {children}
      {count != null && <span style={{ fontFamily: F.body, fontWeight: 600, fontSize: 13, letterSpacing: 0, color: DS.labelText }}>{count}</span>}
    </h3>
  );
}

function Disclosure({ title, count, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section style={{ border: `1px solid ${DS.border}`, background: DS.cardBg }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "14px 16px", background: "none", border: "none", cursor: "pointer", textAlign: "left" }}
      >
        <SectionHeading count={count}>{title}</SectionHeading>
        <span aria-hidden="true" style={{ fontFamily: F.body, fontSize: 18, color: DS.labelText, transform: open ? "rotate(90deg)" : "none", transition: "transform 0.15s" }}>›</span>
      </button>
      {open && <div style={{ padding: "0 16px 16px" }}>{children}</div>}
    </section>
  );
}

function IngredientRow({ ing }) {
  const flagged = ing.flag;
  const hard = flagged?.severity === "hard";
  const color = flagged ? (hard ? DS.banned : DS.caution) : DS.bodyText;
  return (
    <li style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, padding: "9px 0", borderTop: `1px solid ${DS.border}` }}>
      <span style={{ minWidth: 0 }}>
        <span style={{ fontFamily: F.body, fontSize: 15, fontWeight: flagged ? 700 : 500, color }}>{ing.name}</span>
        {ing.blend && <span style={{ fontFamily: F.body, fontSize: 12, color: DS.dimText, marginLeft: 8 }}>in {ing.blend}</span>}
        {flagged && (
          <span style={{ display: "block", fontFamily: F.body, fontSize: 13, color, marginTop: 2 }}>
            {hard ? "Banned" : "Restricted"}: listed as {flagged.substance}
            {flagged.bannedBy ? ` (${flagged.bannedBy})` : ""}
          </span>
        )}
      </span>
      <span style={{ fontFamily: F.body, fontSize: 13, color: DS.labelText, whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>{ing.amount || ""}</span>
    </li>
  );
}

export default function ScanVerdict({ result, locked = false, gate = null, onReset }) {
  const [openCards, setOpenCards] = useState({});
  const style = STATUS_STYLE[result?.verdict?.status] || STATUS_STYLE.no_match;
  const verdict = result.verdict;

  const ocrText  = result.ingredientsText || "";
  const ocrIndex = useMemo(() => {
    const raw = ocrText.toLowerCase();
    return { raw, compact: raw.replace(/[^a-z0-9]/g, "") };
  }, [ocrText]);

  const banned      = (result.matchedBanned || []).map(toCardRecord);
  const infoCards   = (result.matchedIngredients || []).map(toCardRecord);
  const ingredients = result.ingredients || [];
  const hiddenBlends = (result.blends || []).filter((b) => b.amounts_disclosed === false);
  const certs = verdict?.certifications || [];

  const toggle = (key) => setOpenCards((s) => ({ ...s, [key]: !s[key] }));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

      {/* Verdict */}
      <section
        aria-live="polite"
        style={{ background: style.bg, border: `1px solid ${style.border}`, borderLeft: `5px solid ${style.color}`, padding: "clamp(16px, 4vw, 22px)" }}
      >
        {result.productName && (
          <p style={{ fontFamily: F.cond, fontWeight: 700, fontSize: 13, letterSpacing: "0.12em", textTransform: "uppercase", color: DS.labelText, margin: "0 0 8px" }}>
            {result.productName}
          </p>
        )}
        <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
          <span aria-hidden="true" style={{ flexShrink: 0, width: 38, height: 38, display: "grid", placeItems: "center", background: style.color, color: "#fff", fontFamily: F.cond, fontWeight: 900, fontSize: 22, lineHeight: 1 }}>
            {style.icon}
          </span>
          <div style={{ minWidth: 0 }}>
            <p style={{ fontFamily: F.cond, fontWeight: 700, fontSize: 12, letterSpacing: "0.16em", textTransform: "uppercase", color: style.color, margin: "0 0 2px" }}>{style.label}</p>
            <h2 style={{ fontFamily: F.cond, fontWeight: 900, fontStyle: "italic", fontSize: "clamp(1.5rem, 5vw, 2rem)", lineHeight: 1, letterSpacing: "-0.01em", textTransform: "uppercase", color: DS.bodyText, margin: 0, textWrap: "balance" }}>
              {verdict.headline}
            </h2>
            <p style={{ fontFamily: F.body, fontSize: 15, lineHeight: 1.6, color: DS.bodyText, margin: "10px 0 0", maxWidth: "62ch" }}>
              {verdict.detail}
            </p>
          </div>
        </div>

        {certs.length > 0 && (
          <p style={{ fontFamily: F.body, fontSize: 14, lineHeight: 1.5, color: DS.bodyText, margin: "14px 0 0", padding: "10px 12px", background: DS.cardBg, border: `1px solid ${DS.border}` }}>
            <strong>{certs[0]}</strong> seal on the label. Search for this exact product at {CERT_SITES[certs[0]] || "the certifier's website"} to confirm it's current.
          </p>
        )}

        {verdict.notes?.map((n) => (
          <p key={n} style={{ fontFamily: F.body, fontSize: 13, lineHeight: 1.5, color: DS.labelText, margin: "10px 0 0" }}>{n}</p>
        ))}
      </section>

      {gate}

      {/* Details are blurred for anonymous visitors until they unlock; the verdict above never is. */}
      <div
        aria-hidden={locked || undefined}
        style={{ display: "flex", flexDirection: "column", gap: 14, filter: locked ? "blur(5px)" : "none", pointerEvents: locked ? "none" : "auto", userSelect: locked ? "none" : "auto" }}
      >
        {banned.length > 0 && (
          <section style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <SectionHeading count={banned.length}>Why it was flagged</SectionHeading>
            {banned.map((rec, i) => (
              <SubstanceCard
                key={rec.id}
                rec={rec}
                index={i}
                variant="banned"
                ocrText={ocrText}
                ocrIndex={ocrIndex}
                isExpanded={openCards[`b:${rec.id}`] ?? i === 0}
                onToggle={() => toggle(`b:${rec.id}`)}
              />
            ))}
          </section>
        )}

        {hiddenBlends.length > 0 && (
          <section style={{ padding: "14px 16px", border: `1px solid ${DS.cautionBorder}`, background: DS.cautionBg }}>
            <SectionHeading>Undisclosed blend amounts</SectionHeading>
            <p style={{ fontFamily: F.body, fontSize: 14, lineHeight: 1.55, color: DS.cautionText, margin: "6px 0 0" }}>
              {hiddenBlends.map((b) => `${b.name}${b.total_amount ? ` (${b.total_amount} total)` : ""}`).join(", ")} {hiddenBlends.length === 1 ? "lists" : "list"} ingredients without individual amounts.
            </p>
          </section>
        )}

        {ingredients.length > 0 && (
          <Disclosure title="Every ingredient on the label" count={ingredients.length}>
            <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
              {ingredients.map((ing, i) => <IngredientRow key={`${ing.name}-${i}`} ing={ing} />)}
            </ul>
            {result.excludedMentions?.length > 0 && (
              <p style={{ fontFamily: F.body, fontSize: 13, lineHeight: 1.5, color: DS.labelText, margin: "12px 0 0" }}>
                Mentioned only in marketing claims, so not counted as ingredients: {result.excludedMentions.join(", ")}.
              </p>
            )}
          </Disclosure>
        )}

        {!ingredients.length && ocrText && (
          <Disclosure title="Ingredient list from the product database">
            <p style={{ fontFamily: F.body, fontSize: 14, lineHeight: 1.6, color: DS.bodyText, margin: 0 }}>{ocrText}</p>
          </Disclosure>
        )}

        {infoCards.length > 0 && (
          <Disclosure title="What these ingredients do" count={infoCards.length}>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {infoCards.map((rec, i) => (
                <SubstanceCard
                  key={rec.id}
                  rec={rec}
                  index={i}
                  variant="ingredient"
                  ocrText={ocrText}
                  ocrIndex={ocrIndex}
                  isExpanded={!!openCards[`i:${rec.id}`]}
                  onToggle={() => toggle(`i:${rec.id}`)}
                />
              ))}
            </div>
          </Disclosure>
        )}

        <p style={{ fontFamily: F.body, fontSize: 12, lineHeight: 1.6, color: DS.labelText, margin: 0 }}>
          <strong>Screening tool only.</strong> CheckPeak checks ingredients against banned-substance lists. It can't detect contamination or substances missing from the label, and it doesn't replace a ruling from your compliance office or governing body.
        </p>
      </div>

      {onReset && (
        <button
          type="button"
          onClick={onReset}
          style={{ alignSelf: "flex-start", minHeight: 46, padding: "0 20px", fontFamily: F.cond, fontSize: 14, fontWeight: 900, letterSpacing: "0.08em", textTransform: "uppercase", background: DS.cardBg, color: DS.bodyText, border: `1px solid ${DS.border}`, cursor: "pointer" }}
        >
          Check another product
        </button>
      )}
    </div>
  );
}
