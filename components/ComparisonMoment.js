"use client";

import { useRef, useState, useEffect } from "react";
import { motion, useInView } from "framer-motion";
import { GRAIN_URL } from "@/lib/grain";

const ACCENT = "#4FABFF";
const BLACK  = "#060810";
const WHITE  = "#FFFFFF";

const FR = {
  bg:      "#0A0E16",
  surface: "#111827",
  raised:  "#1C2333",
  rim:     "rgba(255,255,255,0.09)",
  wire:    "rgba(255,255,255,0.15)",
  ghost:   "rgba(255,255,255,0.38)",
  green:   "#3FB950",
  amber:   "#E3A21A",
  red:     "#F85149",
};


// y = full, $ = paid add-on / higher tier, p = partial, x = not available
const rows = [
  { feature: "Film, workouts & nutrition — one platform",                         cp: "y", hudl: "x",  tw: "x"  },
  { feature: "See who watched the film — and who didn't",                         cp: "y", hudl: "p",  tw: "x"  },
  { feature: "Photo / video proof workouts were done",                            cp: "y", hudl: "x",  tw: "p"  },
  { feature: "Daily athlete check-ins — wellness & readiness in one tap",         cp: "y", hudl: "x",  tw: "p"  },
  { feature: "Nutrition plan adherence — macro targets at a glance",              cp: "y", hudl: "x",  tw: "$"  },
  { feature: "Supplement scanner — catch banned ingredients before they take it", cp: "y", hudl: "x",  tw: "x"  },
  { feature: "CARA / VARA compliance — your designated compliance calendar",      cp: "y", hudl: "x",  tw: "$"  },
  { feature: "Parent portal — families in the loop",                              cp: "y", hudl: "p",  tw: "p"  },
  { feature: "Recruiting profile for every athlete",                              cp: "y", hudl: "$",  tw: "x"  },
  { feature: "Unlimited roster — no per-seat fees",                               cp: "y", hudl: "$",  tw: "$"  },
];

const platforms = [
  { key: "cp",   name: "CheckPeak", highlight: true  },
  { key: "hudl", name: "Hudl",      highlight: false },
  { key: "tw",   name: "TeamWorks", highlight: false },
];

const Status = ({ val, highlight, size = 16, compact = false }) => {
  if (val === "y") return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke={highlight ? ACCENT : "rgba(255,255,255,0.35)"}
      strokeWidth={highlight ? "2.5" : "2"}
      strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
  if (val === "$") return (
    <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: compact ? size - 3 : size - 4, letterSpacing: "0.06em", color: FR.amber, textAlign: "center", lineHeight: 1.3 }}>
      {compact ? "+$" : "+ Add-on"}
    </span>
  );
  if (val === "p") return (
    <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: compact ? size - 3 : size - 5, letterSpacing: "0.06em", textTransform: "uppercase", color: FR.amber }}>
      {compact ? "~" : "Partial"}
    </span>
  );
  if (val === "x") return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke={FR.red} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
  return <span style={{ color: "rgba(255,255,255,0.2)", fontSize: size + 2, lineHeight: 1 }}>—</span>;
};

export default function ComparisonMoment() {
  const ref    = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-10%" });
  const [w, setW] = useState(0);

  useEffect(() => {
    const upd = () => setW(window.innerWidth);
    upd();
    window.addEventListener("resize", upd);
    return () => window.removeEventListener("resize", upd);
  }, []);

  const mobile = w > 0 && w < 680;

  const Grain = () => (
    <div aria-hidden="true" style={{ position: "absolute", inset: 0, zIndex: 1, backgroundImage: GRAIN_URL, backgroundRepeat: "repeat", backgroundSize: "256px 256px", opacity: 0.04, mixBlendMode: "screen", pointerEvents: "none" }} />
  );
  const Glow = () => (
    <div aria-hidden="true" style={{ position: "absolute", left: "-6%", top: "50%", transform: "translateY(-50%)", width: "40vw", height: "40vw", borderRadius: "50%", zIndex: 0, pointerEvents: "none", background: "radial-gradient(circle, rgba(79,171,255,0.04) 0%, transparent 65%)" }} />
  );

  // ── MOBILE LAYOUT (<680px) ──
  if (mobile) return (
    <section ref={ref} style={{ width: "100%", background: BLACK, padding: "clamp(3rem, 8vw, 4.5rem) clamp(1rem, 5vw, 1.5rem)", overflow: "hidden", position: "relative", borderTop: "0.5px solid rgba(255,255,255,0.08)" }}>
      <Grain /><Glow />
      <div style={{ position: "relative", zIndex: 2 }}>

        {/* Header */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={inView ? { opacity: 1, y: 0 } : {}} transition={{ duration: 0.7 }} style={{ marginBottom: "2rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1rem" }}>
            <div style={{ width: "1.75rem", height: "0.5px", background: "rgba(255,255,255,0.22)" }} />
            <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "0.72rem", fontWeight: 900, letterSpacing: "0.2em", textTransform: "uppercase", color: "rgba(255,255,255,0.5)" }}>Why CheckPeak</span>
          </div>
          <p style={{ fontFamily: "'Barlow', sans-serif", fontSize: "clamp(0.95rem, 4.2vw, 1.05rem)", lineHeight: 1.7, color: "rgba(255,255,255,0.68)" }}>
            Hudl does film. TeamWorks does scheduling. Neither one tracks nutrition, proves workouts were done, or keeps your compliance calendar clean.
          </p>
        </motion.div>

        {/* Table */}
        <div style={{ border: "0.5px solid rgba(255,255,255,0.1)", overflow: "hidden", boxShadow: "0 16px 48px rgba(0,0,0,0.4)" }}>

          {/* Column headers */}
          <div style={{ display: "grid", gridTemplateColumns: "3fr 1fr 1fr 1fr", background: FR.raised, borderBottom: `1px solid ${FR.rim}` }}>
            <div style={{ padding: "11px 14px" }} />
            {platforms.map(({ name, highlight }) => (
              <div key={name} style={{ padding: "11px 6px", textAlign: "center", background: highlight ? "rgba(79,171,255,0.1)" : "transparent", borderLeft: highlight ? "1px solid rgba(79,171,255,0.2)" : `1px solid ${FR.rim}` }}>
                <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", color: highlight ? ACCENT : "rgba(255,255,255,0.4)" }}>
                  {name === "TeamWorks" ? "TW" : name}
                </span>
              </div>
            ))}
          </div>

          {/* Feature rows */}
          {rows.map(({ feature, cp, hudl, tw }, i) => (
            <motion.div key={i}
              initial={{ opacity: 0 }} animate={inView ? { opacity: 1 } : {}}
              transition={{ duration: 0.35, delay: 0.2 + i * 0.05 }}
              style={{ display: "grid", gridTemplateColumns: "3fr 1fr 1fr 1fr", borderTop: `1px solid ${FR.rim}`, background: i % 2 === 0 ? FR.surface : FR.bg }}
            >
              <div style={{ padding: "11px 10px 11px 13px", fontFamily: "'Barlow', sans-serif", fontSize: 13, fontWeight: 500, color: "rgba(255,255,255,0.88)", lineHeight: 1.4 }}>
                {feature}
              </div>
              {[{ val: cp, hl: true }, { val: hudl, hl: false }, { val: tw, hl: false }].map(({ val, hl }, j) => (
                <div key={j} style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "11px 4px", background: hl ? "rgba(79,171,255,0.07)" : "transparent", borderLeft: hl ? "1px solid rgba(79,171,255,0.15)" : `1px solid ${FR.rim}` }}>
                  <Status val={val} highlight={hl} size={17} compact />
                </div>
              ))}
            </motion.div>
          ))}

          {/* Pricing row */}
          <div style={{ display: "grid", gridTemplateColumns: "3fr 1fr 1fr 1fr", borderTop: "1px solid rgba(79,171,255,0.2)", background: "rgba(79,171,255,0.04)" }}>
            <div style={{ padding: "14px 14px" }}>
              <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: 13, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.55)" }}>Pricing</span>
            </div>
            {[
              { label: "Flat rate", sub: "all in",    highlight: true  },
              { label: "Base +",    sub: "add-ons",   highlight: false },
              { label: "Quote",     sub: "per seat",  highlight: false },
            ].map(({ label, sub, highlight }, i) => (
              <div key={i} style={{ padding: "12px 6px", textAlign: "center", background: highlight ? "rgba(79,171,255,0.09)" : "transparent", borderLeft: highlight ? "1px solid rgba(79,171,255,0.2)" : `1px solid ${FR.rim}` }}>
                <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: 13, letterSpacing: "0.06em", textTransform: "uppercase", color: highlight ? ACCENT : FR.amber }}>{label}</div>
                <div style={{ fontFamily: "'Barlow', sans-serif", fontSize: 11, color: "rgba(255,255,255,0.6)", marginTop: 3 }}>{sub}</div>
              </div>
            ))}
          </div>

          {/* Legend */}
          <div style={{ padding: "9px 14px", background: FR.raised, borderTop: `1px solid ${FR.rim}`, display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
            {[
              { color: ACCENT,   label: "Included",             icon: null  },
              { color: FR.amber, label: "+$ add-on  ~ partial",  icon: null },
              { color: FR.red,   label: "Not available",         icon: "x"   },
            ].map(({ color, label, icon }) => (
              <div key={label} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                {icon === "x" ? (
                  <svg width={8} height={8} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round">
                    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                ) : (
                  <div style={{ width: 6, height: 6, borderRadius: "50%", background: color, flexShrink: 0 }} />
                )}
                <span style={{ fontFamily: "'Barlow', sans-serif", fontSize: 11, color: "rgba(255,255,255,0.38)" }}>{label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Value callout — mobile stacked */}
        <motion.div
          initial={{ opacity: 0, y: 16 }} animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.7, delay: 0.8 }}
          style={{ position: "relative", marginTop: "clamp(1.75rem, 5vw, 2.5rem)", border: "0.5px solid rgba(79,171,255,0.18)", background: "rgba(79,171,255,0.03)", padding: "clamp(1.25rem, 5vw, 1.75rem)" }}
        >
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "1.5px", background: `linear-gradient(to right, ${ACCENT}55, ${ACCENT}22, transparent)` }} />
          <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontStyle: "italic", fontSize: "clamp(1.4rem, 6vw, 1.9rem)", lineHeight: 1, letterSpacing: "-0.02em", textTransform: "uppercase", color: WHITE, marginBottom: "0.65rem" }}>
            Everything above.<br /><span style={{ color: ACCENT }}>One price. No add-ons.</span>
          </p>
          <p style={{ fontFamily: "'Barlow', sans-serif", fontSize: "clamp(0.9rem, 3.8vw, 1rem)", lineHeight: 1.72, color: "rgba(255,255,255,0.62)", marginBottom: "1.25rem" }}>
            Every feature competitors charge extra for is included from day one. Price doesn&apos;t change as your roster grows.
          </p>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "1rem" }}>
            <div>
              <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: "0.7rem", letterSpacing: "0.18em", textTransform: "uppercase", color: "rgba(255,255,255,0.4)", marginBottom: "0.15rem" }}>Starting from</div>
              <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: "clamp(2.4rem, 10vw, 3rem)", lineHeight: 0.9, letterSpacing: "-0.03em", color: ACCENT }}>
                $99<span style={{ fontSize: "0.45em", opacity: 0.7 }}>/mo</span>
              </div>
            </div>
            <a href="/pricing" style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem", padding: "0.8rem 1.75rem", background: ACCENT, color: BLACK, fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: "0.88rem", letterSpacing: "0.12em", textTransform: "uppercase", textDecoration: "none" }}>
              See pricing
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></svg>
            </a>
          </div>
        </motion.div>

      </div>
    </section>
  );

  // ── DESKTOP LAYOUT (≥680px) ──
  return (
    <section
      ref={ref}
      style={{
        width:      "100%",
        background: BLACK,
        padding:    "clamp(5rem, 10vw, 9rem) clamp(1.25rem, 7vw, 7rem)",
        overflow:   "hidden",
        position:   "relative",
        borderTop:  "0.5px solid rgba(255,255,255,0.08)",
      }}
    >
      <Grain /><Glow />

      {/* Two-column layout */}
      <div style={{
        position:   "relative", zIndex: 2,
        display:    "flex",
        gap:        "clamp(3rem, 6vw, 6rem)",
        alignItems: "flex-start",
        flexWrap:   "wrap",
      }}>

        {/* ── LEFT: context ── */}
        <div style={{ flex: "0 0 clamp(220px, 23%, 280px)", minWidth: 0 }}>

          {/* Eyebrow */}
          <motion.div
            initial={{ opacity: 0, x: -12 }} animate={inView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.5 }}
            style={{ display: "flex", alignItems: "center", gap: "0.85rem", marginBottom: "clamp(1.5rem, 3vw, 2rem)" }}
          >
            <motion.div
              initial={{ scaleX: 0 }} animate={inView ? { scaleX: 1 } : {}}
              transition={{ duration: 0.8, delay: 0.05 }}
              style={{ width: "clamp(1.5rem, 4vw, 3rem)", height: "0.5px", background: "rgba(255,255,255,0.22)", transformOrigin: "left" }}
            />
            <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "0.75rem", fontWeight: 900, letterSpacing: "0.2em", textTransform: "uppercase", color: "rgba(255,255,255,0.58)" }}>
              Why CheckPeak
            </span>
          </motion.div>

          {/* Body copy */}
          <motion.div
            initial={{ opacity: 0, y: 16 }} animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.7, delay: 0.3 }}
            style={{ paddingLeft: "1.25rem", borderLeft: "1.5px solid rgba(255,255,255,0.18)", maxWidth: "34ch" }}
          >
            <p style={{ fontFamily: "'Barlow', sans-serif", fontSize: "clamp(1rem, 1.2vw, 1.08rem)", fontWeight: 400, lineHeight: 1.8, color: "rgba(255,255,255,0.72)" }}>
              You know Hudl for film. TeamWorks for scheduling. But neither one
              proves your athletes watched the tape, tracks what they&apos;re eating,
              or keeps your compliance calendar clean.
            </p>
          </motion.div>

          {/* Unique-only callout */}
          <motion.div
            initial={{ opacity: 0 }} animate={inView ? { opacity: 1 } : {}}
            transition={{ duration: 0.6, delay: 0.45 }}
            style={{ marginTop: "clamp(1.5rem, 3vw, 2rem)", display: "flex", flexDirection: "column", gap: "0.65rem" }}
          >
            {[
              "Watch receipts — not the honor system",
              "Nutrition & supplement safety — nobody else has it",
              "Offseason accountability your AD will notice",
            ].map((line, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                <div style={{ width: 5, height: 5, borderRadius: "50%", background: ACCENT, flexShrink: 0 }} />
                <span style={{ fontFamily: "'Barlow', sans-serif", fontSize: "0.85rem", color: "rgba(255,255,255,0.58)", lineHeight: 1.45 }}>{line}</span>
              </div>
            ))}
          </motion.div>
        </div>

        {/* ── RIGHT: comparison table ── */}
        <motion.div
          initial={{ opacity: 0, y: 32 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 1.0, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
          style={{ flex: "1 1 420px", minWidth: 0, overflowX: "auto" }}
        >
          <div style={{
            minWidth: 420,
            border: "0.5px solid rgba(255,255,255,0.1)",
            overflow: "hidden",
            boxShadow: "0 24px 80px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.06)",
          }}>

            {/* Table header row */}
            <div style={{ display: "grid", gridTemplateColumns: "2.5fr 1fr 1fr 1fr", background: FR.raised, borderBottom: `1px solid ${FR.rim}` }}>
              <div style={{ padding: "13px 18px" }} />
              {platforms.map(({ name, highlight }) => (
                <div key={name} style={{ padding: "13px 12px", textAlign: "center", background: highlight ? "rgba(79,171,255,0.08)" : "transparent", borderLeft: highlight ? "1px solid rgba(79,171,255,0.18)" : `1px solid ${FR.rim}` }}>
                  <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: 13, letterSpacing: "0.12em", textTransform: "uppercase", color: highlight ? ACCENT : "rgba(255,255,255,0.45)" }}>
                    {name}
                  </span>
                </div>
              ))}
            </div>

            {/* Feature rows */}
            {rows.map(({ feature, cp, hudl, tw }, i) => (
              <motion.div key={i}
                initial={{ opacity: 0, x: 12 }} animate={inView ? { opacity: 1, x: 0 } : {}}
                transition={{ duration: 0.4, delay: 0.35 + i * 0.06 }}
                style={{ display: "grid", gridTemplateColumns: "2.5fr 1fr 1fr 1fr", borderTop: `1px solid ${FR.rim}`, background: i % 2 === 0 ? FR.surface : FR.bg }}
              >
                <div style={{ padding: "14px 18px", fontFamily: "'Barlow', sans-serif", fontSize: 14, fontWeight: 500, color: "rgba(255,255,255,0.84)", lineHeight: 1.45 }}>
                  {feature}
                </div>
                {[{ val: cp, hl: true }, { val: hudl, hl: false }, { val: tw, hl: false }].map(({ val, hl }, j) => (
                  <div key={j} style={{ padding: "14px 12px", display: "flex", alignItems: "center", justifyContent: "center", background: hl ? "rgba(79,171,255,0.05)" : "transparent", borderLeft: hl ? "1px solid rgba(79,171,255,0.12)" : `1px solid ${FR.rim}` }}>
                    <Status val={val} highlight={hl} size={16} />
                  </div>
                ))}
              </motion.div>
            ))}

            {/* Pricing row */}
            <div style={{ display: "grid", gridTemplateColumns: "2.5fr 1fr 1fr 1fr", borderTop: `1px solid rgba(79,171,255,0.2)`, background: "rgba(79,171,255,0.04)" }}>
              <div style={{ padding: "15px 18px" }}>
                <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: 13, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.55)" }}>
                  Pricing model
                </span>
              </div>
              {[
                { label: "One flat rate",     sub: "all features included", highlight: true  },
                { label: "Base + add-ons",    sub: "cost adds up fast",     highlight: false },
                { label: "Enterprise quote",  sub: "per-seat pricing",      highlight: false },
              ].map(({ label, sub, highlight }, i) => (
                <div key={i} style={{
                  padding: "13px 12px", textAlign: "center",
                  background: highlight ? "rgba(79,171,255,0.08)" : "transparent",
                  borderLeft: highlight ? "1px solid rgba(79,171,255,0.2)" : `1px solid ${FR.rim}`,
                }}>
                  <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: 13, letterSpacing: "0.06em", textTransform: "uppercase", color: highlight ? ACCENT : FR.amber, marginBottom: 3 }}>
                    {label}
                  </div>
                  <div style={{ fontFamily: "'Barlow', sans-serif", fontSize: 11, color: "rgba(255,255,255,0.6)" }}>
                    {sub}
                  </div>
                </div>
              ))}
            </div>

            {/* Legend */}
            <div style={{ padding: "10px 18px", background: FR.raised, borderTop: `1px solid ${FR.rim}`, display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap" }}>
              {[
                { color: ACCENT,   label: "Included",                icon: null },
                { color: FR.amber, label: "+ Add-on / higher tier",  icon: null },
                { color: FR.red,   label: "Not available",            icon: "x"  },
              ].map(({ color, label, icon }) => (
                <div key={label} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  {icon === "x" ? (
                    <svg width={9} height={9} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round">
                      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  ) : (
                    <div style={{ width: 7, height: 7, borderRadius: "50%", background: color, flexShrink: 0 }} />
                  )}
                  <span style={{ fontFamily: "'Barlow', sans-serif", fontSize: 12, color: "rgba(255,255,255,0.4)" }}>{label}</span>
                </div>
              ))}
            </div>
          </div>
        </motion.div>

      </div>{/* /two-column */}

      {/* ── Value callout ── */}
      <motion.div
        initial={{ opacity: 0, y: 20 }} animate={inView ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.7, delay: 1.0 }}
        style={{
          position:   "relative", zIndex: 2,
          marginTop:  "clamp(2.5rem, 5vw, 4rem)",
          border:     "0.5px solid rgba(79,171,255,0.18)",
          background: "rgba(79,171,255,0.03)",
          padding:    "clamp(1.5rem, 4vw, 2.25rem) clamp(1.5rem, 5vw, 3rem)",
          display:    "flex", flexWrap: "wrap",
          gap:        "clamp(1.5rem, 4vw, 3rem)",
          alignItems: "center", justifyContent: "space-between",
        }}
      >
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "1.5px", background: `linear-gradient(to right, ${ACCENT}55, ${ACCENT}22, transparent)` }} />

        {/* Left: copy */}
        <div style={{ flex: "1 1 280px", minWidth: 0 }}>
          <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontStyle: "italic", fontSize: "clamp(1.4rem, 3vw, 2.2rem)", lineHeight: 0.95, letterSpacing: "-0.02em", textTransform: "uppercase", color: WHITE, marginBottom: "0.75rem" }}>
            Everything above.<br />
            <span style={{ color: ACCENT }}>One price. No add-ons.</span>
          </p>
          <p style={{ fontFamily: "'Barlow', sans-serif", fontSize: "clamp(0.88rem, 1.1vw, 0.95rem)", lineHeight: 1.75, color: "rgba(255,255,255,0.6)", maxWidth: "52ch", margin: 0 }}>
            Every feature your competitors charge extra for, CheckPeak includes from day one.
            Unlimited athletes, unlimited seasons — price doesn&apos;t change as your roster grows.
          </p>
        </div>

        {/* Right: price badge + CTA */}
        <div style={{ flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "0.75rem" }}>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontStyle: "italic", fontSize: "clamp(0.7rem, 1vw, 0.78rem)", letterSpacing: "0.18em", textTransform: "uppercase", color: "rgba(255,255,255,0.4)", marginBottom: "0.2rem" }}>
              Starting from
            </div>
            <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: "clamp(2.4rem, 5vw, 3.5rem)", lineHeight: 0.9, letterSpacing: "-0.03em", color: ACCENT }}>
              $99<span style={{ fontSize: "0.45em", opacity: 0.7 }}>/mo</span>
            </div>
            <div style={{ fontFamily: "'Barlow', sans-serif", fontSize: "0.78rem", color: "rgba(255,255,255,0.38)", marginTop: "0.3rem" }}>
              Film · Nutrition · Compliance · Recruiting · All included
            </div>
          </div>
          <a
            href="/pricing"
            style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem", padding: "0.65rem 1.5rem", background: ACCENT, color: BLACK, fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: "0.82rem", letterSpacing: "0.12em", textTransform: "uppercase", textDecoration: "none", transition: "filter 0.18s" }}
            onMouseEnter={e => { e.currentTarget.style.filter = "brightness(1.1)"; }}
            onMouseLeave={e => { e.currentTarget.style.filter = "none"; }}
          >
            See pricing
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
            </svg>
          </a>
        </div>
      </motion.div>

    </section>
  );
}
