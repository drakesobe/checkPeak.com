// components/org/workoutsCalendar/ComplianceDrawer.jsx
"use client";

import { useEffect } from "react";
import { X, ExternalLink, ShieldCheck, AlertTriangle, Info } from "lucide-react";
import { DS } from "@/components/org/dashboard/DashboardUI";

// ─── NCAA rule data ───────────────────────────────────────────────────────────

const CARA_RULES = [
  {
    season: "Playing Season",
    weeklyMax: "20 hrs / week",
    dailyMax: "4 hrs / day",
    restRequired: "1 day off per week (required)",
    notes: "Weeks with competition count competition + travel as CARA. Coach-required activities only.",
    tone: "warn",
  },
  {
    season: "Out of Season",
    weeklyMax: "8 hrs / week",
    dailyMax: "No daily cap",
    restRequired: "2 consecutive days off per week",
    notes: "Only required activities count. Voluntary work (VARA) does not count toward the 8-hr limit.",
    tone: "neutral",
  },
  {
    season: "Championship Segment",
    weeklyMax: "20 hrs / week",
    dailyMax: "4 hrs / day",
    restRequired: "1 day off per week",
    notes: "Same limits as playing season. Includes all competition and practice.",
    tone: "warn",
  },
];

const VARA_RULES = [
  "Athletes must have genuine free choice — no coach may require, pressure, or imply attendance.",
  "No coach may be present during VARA activities.",
  "Athletes may not be penalized for non-participation.",
  "VARA does NOT count toward CARA hour limits.",
  "Staff may only observe and provide safety supervision — no instruction.",
  "VARA activities must be initiated and controlled by athletes.",
];

const REQUIRED_REST = [
  {
    period: "In-Season",
    rule: "1 day off per week — must be a calendar day with no countable activities.",
    severity: "bad",
  },
  {
    period: "Out-of-Season",
    rule: "2 consecutive days off per week minimum.",
    severity: "warn",
  },
  {
    period: "Between Seasons",
    rule: "14 consecutive days off per academic year required.",
    severity: "warn",
  },
  {
    period: "Post-Season",
    rule: "At least 2 weeks off following the final competition of the year.",
    severity: "neutral",
  },
];

const COUNTABLE_ACTIVITIES = [
  { label: "Countable (CARA)", items: ["Practice", "Competition", "Required weight training", "Required conditioning", "Film review required by coach", "Walk-throughs with coach present"] },
  { label: "Not Countable", items: ["Voluntary VARA activities (no coach)", "Training initiated solely by athlete", "Study hall / academics", "Medical treatment / rehab", "Travel between classes"] },
];

const SOURCES = [
  { label: "NCAA Bylaw 17 — Practice Limitations", href: "https://ncaaorg.s3.amazonaws.com/compliance/rrs/2020/presentations/Division_III/Division_III_Bylaw_17.pdf" },
  { label: "CARA / VARA / RARA Definitions (PDF)", href: "https://ncaaorg.s3.amazonaws.com/compliance/d1/D1Comp_TimeDemandsInfo.pdf" },
  { label: "NCAA Voluntary Activity Guidelines", href: "https://www.ncaa.org/news/2020/5/20/di-council-allows-football-basketball-to-have-voluntary-athletics-activities-starting-june-1.aspx" },
  { label: "Banned Substances List", href: "https://www.ncaa.org/sports/2015/6/10/ncaa-banned-substances.aspx" },
];

// ─── Sub-components ───────────────────────────────────────────────────────────

const TONE = {
  bad:     { bg: DS.bannedBg,  border: DS.bannedBorder,  text: DS.banned,  dot: DS.banned  },
  warn:    { bg: DS.cautionBg, border: DS.cautionBorder, text: DS.caution, dot: DS.caution },
  neutral: { bg: DS.pageBg,    border: DS.border,        text: DS.bodyText,dot: DS.dimText },
  good:    { bg: DS.safeBg,    border: DS.safeBorder,    text: DS.safe,    dot: DS.safe    },
};

function RuleCard({ tone = "neutral", children }) {
  const t = TONE[tone] || TONE.neutral;
  return (
    <div style={{
      background: t.bg,
      border: `1px solid ${t.border}`,
      borderLeft: `3px solid ${t.dot}`,
      padding: "12px 14px",
    }}>
      {children}
    </div>
  );
}

function SectionLabel({ children }) {
  return (
    <p style={{
      fontFamily: "'Barlow Condensed', sans-serif",
      fontWeight: 900, fontSize: 10,
      letterSpacing: "0.18em", textTransform: "uppercase",
      color: DS.dimText, marginBottom: 10,
    }}>
      {children}
    </p>
  );
}

function Rule({ text, tone = "neutral" }) {
  const t = TONE[tone] || TONE.neutral;
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
      <div style={{ width: 6, height: 6, borderRadius: "50%", background: t.dot, flexShrink: 0, marginTop: 5 }} />
      <p style={{ fontFamily: "'Barlow', sans-serif", fontSize: 12, lineHeight: 1.6, color: DS.bodyText }}>
        {text}
      </p>
    </div>
  );
}

// ─── Main drawer ─────────────────────────────────────────────────────────────

export default function ComplianceDrawer({ open, onClose }) {
  // Scroll lock — don't lock body since DaySheet may also be open
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === "Escape") onClose?.(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <>
      {/* Backdrop — semi-transparent, low-z so calendar is still visible behind */}
      {open && (
        <div
          style={{
            position: "fixed", inset: 0, zIndex: 9000,
            background: "rgba(13,27,42,0.35)",
            backdropFilter: "blur(2px)",
          }}
          onClick={onClose}
        />
      )}

      {/* Drawer panel */}
      <div
        role="complementary"
        aria-label="NCAA Compliance Reference"
        style={{
          position: "fixed",
          top: 0, right: 0, bottom: 0,
          width: "clamp(320px, 38vw, 480px)",
          zIndex: 9001,
          background: DS.cardBg,
          borderLeft: `1px solid ${DS.border}`,
          borderTop: `3px solid ${DS.brand}`,
          display: "flex",
          flexDirection: "column",
          transform: open ? "translateX(0)" : "translateX(100%)",
          transition: "transform 0.25s cubic-bezier(0.16,1,0.3,1)",
          boxShadow: open ? "-8px 0 40px rgba(0,0,0,0.12)" : "none",
          overflow: "hidden",
          pointerEvents: open ? "auto" : "none",
        }}
        onClick={(e) => e.stopPropagation()}
      >

        {/* ── Header ── */}
        <div style={{
          padding: "14px 18px",
          borderBottom: `1px solid ${DS.border}`,
          background: DS.pageBg,
          display: "flex", alignItems: "flex-start",
          justifyContent: "space-between", gap: 12, flexShrink: 0,
        }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
              <ShieldCheck style={{ width: 14, height: 14, color: DS.brand, flexShrink: 0 }} />
              <p style={{
                fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900,
                fontSize: 13, letterSpacing: "0.08em", textTransform: "uppercase",
                color: DS.bodyText, margin: 0,
              }}>
                NCAA Compliance Reference
              </p>
            </div>
            <p style={{ fontFamily: "'Barlow', sans-serif", fontSize: 11, color: DS.dimText, margin: 0 }}>
              Quick reference — always verify with your compliance officer.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: 6, border: `1px solid ${DS.border}`,
              background: DS.cardBg, cursor: "pointer", flexShrink: 0,
            }}
            onMouseEnter={e => { e.currentTarget.style.background = DS.pageBg; }}
            onMouseLeave={e => { e.currentTarget.style.background = DS.cardBg; }}
            aria-label="Close compliance drawer"
          >
            <X style={{ width: 15, height: 15, color: DS.dimText }} />
          </button>
        </div>

        {/* ── Disclaimer banner ── */}
        <div style={{
          padding: "10px 18px",
          background: DS.cautionBg,
          borderBottom: `1px solid ${DS.cautionBorder}`,
          display: "flex", gap: 8, alignItems: "flex-start", flexShrink: 0,
        }}>
          <AlertTriangle style={{ width: 13, height: 13, color: DS.caution, flexShrink: 0, marginTop: 2 }} />
          <p style={{ fontFamily: "'Barlow', sans-serif", fontSize: 11, lineHeight: 1.5, color: DS.caution, margin: 0 }}>
            <strong>Educational only.</strong> Rules vary by division, sport, and season.
            Always confirm with your compliance office before scheduling.
          </p>
        </div>

        {/* ── Scrollable body ── */}
        <div style={{ flex: 1, overflowY: "auto", padding: "18px", display: "flex", flexDirection: "column", gap: 22 }}>

          {/* 1. CARA Hour Limits */}
          <section>
            <SectionLabel>CARA Hour Limits — Division I</SectionLabel>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {CARA_RULES.map((r) => (
                <RuleCard key={r.season} tone={r.tone}>
                  <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8, marginBottom: 6 }}>
                    <p style={{
                      fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900,
                      fontSize: 12, letterSpacing: "0.06em", textTransform: "uppercase",
                      color: DS.bodyText, margin: 0,
                    }}>
                      {r.season}
                    </p>
                    <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                      <span style={{
                        fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900,
                        fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase",
                        padding: "2px 7px",
                        background: TONE[r.tone]?.bg,
                        border: `1px solid ${TONE[r.tone]?.border}`,
                        color: TONE[r.tone]?.text,
                      }}>
                        {r.weeklyMax}
                      </span>
                    </div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                    <p style={{ fontFamily: "'Barlow', sans-serif", fontSize: 11, color: DS.secondary, margin: 0 }}>
                      <strong>Daily max:</strong> {r.dailyMax}
                    </p>
                    <p style={{ fontFamily: "'Barlow', sans-serif", fontSize: 11, color: DS.secondary, margin: 0 }}>
                      <strong>Rest:</strong> {r.restRequired}
                    </p>
                    <p style={{ fontFamily: "'Barlow', sans-serif", fontSize: 11, lineHeight: 1.5, color: DS.dimText, marginTop: 4 }}>
                      {r.notes}
                    </p>
                  </div>
                </RuleCard>
              ))}
            </div>
          </section>

          {/* 2. Required Rest Days */}
          <section>
            <SectionLabel>Required Rest Days</SectionLabel>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {REQUIRED_REST.map((r) => (
                <RuleCard key={r.period} tone={r.severity}>
                  <p style={{
                    fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900,
                    fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase",
                    color: TONE[r.severity]?.text, margin: "0 0 4px",
                  }}>
                    {r.period}
                  </p>
                  <p style={{ fontFamily: "'Barlow', sans-serif", fontSize: 12, lineHeight: 1.55, color: DS.bodyText, margin: 0 }}>
                    {r.rule}
                  </p>
                </RuleCard>
              ))}
            </div>
          </section>

          {/* 3. VARA Rules */}
          <section>
            <SectionLabel>Voluntary Activity (VARA)</SectionLabel>
            <RuleCard tone="neutral">
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {VARA_RULES.map((rule, i) => (
                  <Rule key={i} text={rule} tone="neutral" />
                ))}
              </div>
            </RuleCard>
            <div style={{
              marginTop: 8, padding: "10px 12px",
              background: DS.accentBg || DS.brandBg,
              border: `1px solid ${DS.accentBdr || DS.brandBorder}`,
              display: "flex", gap: 8, alignItems: "flex-start",
            }}>
              <Info style={{ width: 12, height: 12, color: DS.brand, flexShrink: 0, marginTop: 2 }} />
              <p style={{ fontFamily: "'Barlow', sans-serif", fontSize: 11, lineHeight: 1.5, color: DS.brand, margin: 0 }}>
                In CheckPeak, mark items as <strong>Voluntary Activity (VARA)</strong> in the Evidence Required field to flag them correctly.
              </p>
            </div>
          </section>

          {/* 4. Countable vs Not Countable */}
          <section>
            <SectionLabel>What Counts as CARA?</SectionLabel>
            <div style={{ display: "flex", flexDirection: "column", gap: 1, background: DS.border }}>
              {COUNTABLE_ACTIVITIES.map(({ label, items }) => {
                const isCountable = label.includes("Countable (");
                return (
                  <div key={label} style={{
                    background: DS.cardBg,
                    padding: "12px 14px",
                  }}>
                    <p style={{
                      fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900,
                      fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase",
                      color: isCountable ? DS.banned : DS.safe, margin: "0 0 8px",
                    }}>
                      {label}
                    </p>
                    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                      {items.map((item, i) => (
                        <Rule key={i} text={item} tone={isCountable ? "bad" : "good"} />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* 5. Official Sources */}
          <section>
            <SectionLabel>Official NCAA Sources</SectionLabel>
            <div style={{ display: "flex", flexDirection: "column", gap: 1, background: DS.border }}>
              {SOURCES.map(({ label, href }) => (
                <a
                  key={href}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10,
                    padding: "11px 14px", background: DS.cardBg, textDecoration: "none",
                    transition: "background 0.12s",
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = DS.pageBg; }}
                  onMouseLeave={e => { e.currentTarget.style.background = DS.cardBg; }}
                >
                  <p style={{
                    fontFamily: "'Barlow', sans-serif", fontSize: 12, fontWeight: 600,
                    color: DS.brand, margin: 0, lineHeight: 1.4,
                  }}>
                    {label}
                  </p>
                  <ExternalLink style={{ width: 12, height: 12, color: DS.dimText, flexShrink: 0 }} />
                </a>
              ))}
            </div>
          </section>

          {/* Bottom disclaimer */}
          <p style={{
            fontFamily: "'Barlow', sans-serif", fontSize: 10,
            color: DS.dimText, lineHeight: 1.6,
            borderTop: `1px solid ${DS.border}`, paddingTop: 14,
          }}>
            NCAA rules are updated annually. Division II and III rules differ. Always verify
            current bylaws at ncaa.org and consult your compliance officer before scheduling
            any countable activities.
          </p>
        </div>
      </div>
    </>
  );
}