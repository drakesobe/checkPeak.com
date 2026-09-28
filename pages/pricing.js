// pages/pricing.js
import Head from "next/head";
import { useRef, useState } from "react";
import { motion, useInView } from "framer-motion";
import ComparisonMoment from "@/components/ComparisonMoment";

const ACCENT = "#4FABFF";
const BLACK  = "#060810";
const WHITE  = "#FFFFFF";
const GREEN  = "#3FB950";
const GRAIN_URL = `url("data:image/svg+xml,%3Csvg viewBox='0 0 512 512' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`;

const STYLE = `
  @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:ital,wght@0,400;0,700;0,900;1,900&family=Barlow:wght@400;500;600&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  button { cursor: pointer; }
`;

function Check({ color = ACCENT }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function CopyCode({ code }) {
  const [copied, setCopied] = useState(false);
  function copy() {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    });
  }
  return (
    <button
      onClick={copy}
      title={copied ? "Copied!" : `Copy ${code}`}
      style={{
        display: "inline-flex", alignItems: "center", gap: "0.5rem",
        padding: "0.35rem 0.75rem 0.35rem 0.85rem",
        background: copied ? "rgba(63,185,80,0.08)" : "rgba(79,171,255,0.07)",
        border: `1px solid ${copied ? "rgba(63,185,80,0.35)" : "rgba(79,171,255,0.25)"}`,
        borderRadius: 3, transition: "all 0.18s",
      }}
      onMouseEnter={e => { if (!copied) e.currentTarget.style.background = "rgba(79,171,255,0.14)"; }}
      onMouseLeave={e => { if (!copied) e.currentTarget.style.background = copied ? "rgba(63,185,80,0.08)" : "rgba(79,171,255,0.07)"; }}
    >
      <span style={{
        fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900,
        fontSize: "0.82rem", letterSpacing: "0.14em", textTransform: "uppercase",
        color: copied ? GREEN : ACCENT,
      }}>
        {copied ? "Copied!" : code}
      </span>
      {copied
        ? <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={GREEN} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
        : <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={ACCENT} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.6 }}><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>
      }
    </button>
  );
}

const BILLING = {
  monthly: {
    founder: "$99",
    regular: "$499",
    period:  "/month",
    savings: "−$400",
    code:    "FOUNDING",
    subNote: null,
  },
  annual: {
    founder: "$1,188",
    regular: "$4,188",
    period:  "/year",
    savings: "−$3,000",
    code:    "FOUNDING26",
    subNote: "$99 / mo, billed annually",
  },
};

// Free tier — up to 10 athletes
const STUDIO_FEATURES = [
  "Up to 10 athletes",
  "Training program builder",
  "Nutrition plan & macro targets",
  "Film room with draw tools",
  "Mobile app for athletes",
  "Team messaging",
];

// Paid tier — unlimited, full platform
const PROGRAM_FEATURES = [
  "Unlimited athletes",
  "Training library builder",
  "Nutrition programming & macros",
  "Film room with draw tools",
  "Mobile app for athletes",
  "Streak leaderboards",
  "Analytics dashboard",
  "Team messaging",
  "CARA / VARA compliance calendar",
  "Off-campus accountability tracking",
  "Multi-sport roster management",
  "Film delivery to athlete phones",
  "Multi-coach staff access",
  "Recruiting profile for every athlete",
  "Priority support",
];

export default function PricingPage() {
  const ref    = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-8%" });
  const [billing, setBilling] = useState("monthly");

  const b = BILLING[billing];

  return (
    <>
      <style>{STYLE}</style>
      <Head>
        <title>Pricing | CheckPeak</title>
        <meta name="description" content="CheckPeak is free for studios up to 10 athletes. Full programs start at $99/month — unlimited athletes, film, nutrition, and NCAA compliance included." />
      </Head>

      <main style={{ background: BLACK, color: WHITE, minHeight: "100vh", position: "relative", overflow: "hidden" }}>

        {/* Grain */}
        <div aria-hidden="true" style={{
          position: "fixed", inset: 0, zIndex: 0,
          backgroundImage: GRAIN_URL, backgroundRepeat: "repeat",
          backgroundSize: "256px 256px", opacity: 0.04,
          mixBlendMode: "screen", pointerEvents: "none",
        }} />

        {/* Ambient glow */}
        <div aria-hidden="true" style={{
          position: "fixed", left: "50%", top: "25%",
          transform: "translate(-50%, -50%)",
          width: "80vw", height: "50vw",
          borderRadius: "50%", zIndex: 0, pointerEvents: "none",
          background: "radial-gradient(ellipse, rgba(79,171,255,0.04) 0%, transparent 65%)",
        }} />

        <div ref={ref} style={{ position: "relative", zIndex: 1, padding: "clamp(5rem, 10vw, 8rem) clamp(1.25rem, 7vw, 7rem)" }}>

          {/* ── Page header ── */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.75, ease: [0.16, 1, 0.3, 1] }}
            style={{ textAlign: "center", marginBottom: "clamp(2.5rem, 5vw, 4rem)" }}
          >
            <div style={{ display: "inline-flex", alignItems: "center", gap: "0.6rem", marginBottom: "clamp(0.75rem, 1.5vw, 1.25rem)" }}>
              <div style={{ width: "1.75rem", height: "0.5px", background: ACCENT }} />
              <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "0.68rem", fontWeight: 900, letterSpacing: "0.24em", textTransform: "uppercase", color: ACCENT }}>Pricing</span>
              <div style={{ width: "1.75rem", height: "0.5px", background: ACCENT }} />
            </div>

            <h1 style={{
              fontFamily: "'Barlow Condensed', sans-serif",
              fontWeight: 900, fontStyle: "italic",
              fontSize: "clamp(3.5rem, 10vw, 9rem)",
              lineHeight: 0.88, letterSpacing: "-0.03em",
              textTransform: "uppercase", color: WHITE,
              marginBottom: "clamp(1rem, 2vw, 1.5rem)",
            }}>
              Simple.<br />
              <span style={{ color: ACCENT }}>No games.</span>
            </h1>

            <p style={{
              fontFamily: "'Barlow', sans-serif",
              fontSize: "clamp(0.95rem, 1.2vw, 1.05rem)",
              lineHeight: 1.7, color: "rgba(255,255,255,0.52)",
              maxWidth: "44ch", margin: "0 auto",
            }}>
              Free for small programs. One flat rate when you&apos;re ready to scale.
            </p>
          </motion.div>

          {/* ── Founding Rate Banner ── */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={inView ? { opacity: 1 } : {}}
            transition={{ duration: 0.6, delay: 0.25 }}
            style={{
              maxWidth: 860, margin: "0 auto clamp(2.5rem, 5vw, 4rem)",
              padding: "0.85rem 1.25rem",
              background: "rgba(79,171,255,0.04)",
              border: "0.5px solid rgba(79,171,255,0.18)",
              borderLeft: `3px solid ${ACCENT}`,
              borderRadius: 2,
              display: "flex", alignItems: "center", gap: "1rem",
              flexWrap: "wrap",
            }}
          >
            <span style={{
              fontFamily: "'Barlow Condensed', sans-serif",
              fontSize: "0.62rem", fontWeight: 900,
              letterSpacing: "0.2em", textTransform: "uppercase",
              color: ACCENT, padding: "2px 8px",
              background: "rgba(79,171,255,0.1)",
              border: "0.5px solid rgba(79,171,255,0.25)",
              borderRadius: 2, flexShrink: 0,
            }}>
              Founding Rate
            </span>
            <p style={{
              fontFamily: "'Barlow', sans-serif",
              fontSize: "0.84rem", color: "rgba(255,255,255,0.48)",
              lineHeight: 1.5, flex: 1,
            }}>
              Limited-time pricing for early adopters — no expiry announced. Apply at Stripe checkout.
              <span style={{ margin: "0 0.45rem", color: "rgba(255,255,255,0.2)" }}>·</span>
              <strong style={{ color: "rgba(255,255,255,0.65)", fontWeight: 600 }}>FOUNDING</strong>{" "}saves $400/mo
              <span style={{ margin: "0 0.45rem", color: "rgba(255,255,255,0.2)" }}>·</span>
              <strong style={{ color: "rgba(255,255,255,0.65)", fontWeight: 600 }}>FOUNDING26</strong>{" "}saves $3,000/yr
            </p>
          </motion.div>

          {/* ── Pricing cards ── */}
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
            gap: "clamp(1.25rem, 2.5vw, 2rem)",
            maxWidth: 860,
            margin: "0 auto clamp(3.5rem, 7vw, 6rem)",
            alignItems: "start",
          }}>

            {/* ─── Studio Card (Free) ─── */}
            <motion.div
              initial={{ opacity: 0, y: 28 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.8, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
              style={{
                background: "#0B0F17",
                border: "0.5px solid rgba(255,255,255,0.1)",
                borderTop: "3px solid rgba(255,255,255,0.22)",
                borderRadius: 2,
              }}
            >
              {/* Price header */}
              <div style={{ padding: "clamp(1.75rem, 3.5vw, 2.25rem)", borderBottom: "0.5px solid rgba(255,255,255,0.07)" }}>
                <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: "0.68rem", letterSpacing: "0.2em", textTransform: "uppercase", color: "rgba(255,255,255,0.45)", marginBottom: "1.25rem" }}>
                  Studio
                </p>

                <div style={{ display: "flex", alignItems: "baseline", gap: "0.4rem", marginBottom: "0.5rem" }}>
                  <span style={{
                    fontFamily: "'Barlow Condensed', sans-serif",
                    fontWeight: 900, fontStyle: "italic",
                    fontSize: "clamp(3.5rem, 7vw, 5rem)",
                    lineHeight: 0.9, color: WHITE,
                  }}>
                    Free
                  </span>
                </div>

                <p style={{ fontFamily: "'Barlow', sans-serif", fontSize: "0.82rem", color: "rgba(255,255,255,0.38)", marginBottom: "0rem" }}>
                  Up to 10 athletes — no credit card, no expiry.
                </p>
              </div>

              {/* Description */}
              <div style={{ padding: "1rem clamp(1.75rem, 3.5vw, 2.25rem)", borderBottom: "0.5px solid rgba(255,255,255,0.07)" }}>
                <p style={{ fontFamily: "'Barlow', sans-serif", fontSize: "0.88rem", lineHeight: 1.65, color: "rgba(255,255,255,0.52)" }}>
                  Perfect for small coaching operations getting started. All the core tools — no commitment.
                </p>
              </div>

              {/* Features */}
              <div style={{ padding: "clamp(1.25rem, 2.5vw, 1.75rem) clamp(1.75rem, 3.5vw, 2.25rem)" }}>
                <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: "0.7rem" }}>
                  {STUDIO_FEATURES.map(f => (
                    <li key={f} style={{ display: "flex", alignItems: "flex-start", gap: "0.6rem" }}>
                      <span style={{ flexShrink: 0, marginTop: "1px" }}><Check color="rgba(255,255,255,0.32)" /></span>
                      <span style={{ fontFamily: "'Barlow', sans-serif", fontSize: "0.88rem", color: "rgba(255,255,255,0.68)", lineHeight: 1.5 }}>{f}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* CTA */}
              <div style={{ padding: "0 clamp(1.75rem, 3.5vw, 2.25rem) clamp(1.75rem, 3.5vw, 2.25rem)" }}>
                <a
                  href="/commercial/onboard"
                  style={{
                    display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem",
                    padding: "0.9rem 1.5rem",
                    background: "transparent", color: WHITE,
                    fontFamily: "'Barlow Condensed', sans-serif",
                    fontSize: "0.88rem", fontWeight: 900,
                    letterSpacing: "0.12em", textTransform: "uppercase",
                    border: "1px solid rgba(255,255,255,0.22)", borderRadius: 2,
                    textDecoration: "none", transition: "border-color 0.18s, background 0.18s",
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.6)"; e.currentTarget.style.background = "rgba(255,255,255,0.04)"; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.22)"; e.currentTarget.style.background = "transparent"; }}
                >
                  Get Started Free
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
                  </svg>
                </a>
                <p style={{ textAlign: "center", marginTop: "0.6rem", fontFamily: "'Barlow', sans-serif", fontSize: "0.7rem", color: "rgba(255,255,255,0.25)", letterSpacing: "0.04em" }}>
                  No credit card · No expiry · Upgrade anytime
                </p>
              </div>
            </motion.div>

            {/* ─── Program Card (Paid) ─── */}
            <motion.div
              initial={{ opacity: 0, y: 28 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.8, delay: 0.28, ease: [0.16, 1, 0.3, 1] }}
              style={{
                background: "#0B0F17",
                border: "0.5px solid rgba(255,255,255,0.1)",
                borderTop: `3px solid ${ACCENT}`,
                borderRadius: 2,
              }}
            >
              {/* Price header */}
              <div style={{ padding: "clamp(1.75rem, 3.5vw, 2.25rem)", borderBottom: "0.5px solid rgba(255,255,255,0.07)" }}>

                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.25rem", flexWrap: "wrap", gap: "0.75rem" }}>
                  <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: "0.68rem", letterSpacing: "0.2em", textTransform: "uppercase", color: ACCENT }}>
                    Program
                  </p>

                  {/* Billing toggle */}
                  <div style={{
                    display: "inline-flex",
                    background: "rgba(255,255,255,0.04)",
                    border: "0.5px solid rgba(255,255,255,0.1)",
                    borderRadius: 20, padding: "2px",
                  }}>
                    {["monthly", "annual"].map(v => (
                      <button
                        key={v}
                        onClick={() => setBilling(v)}
                        style={{
                          padding: "4px 13px",
                          background: billing === v ? "rgba(255,255,255,0.1)" : "transparent",
                          border: "none", borderRadius: 18,
                          color: billing === v ? WHITE : "rgba(255,255,255,0.38)",
                          fontFamily: "'Barlow Condensed', sans-serif",
                          fontSize: "0.68rem", fontWeight: 700,
                          letterSpacing: "0.12em", textTransform: "uppercase",
                          transition: "all 0.15s",
                          display: "flex", alignItems: "center", gap: "5px",
                        }}
                      >
                        {v === "monthly" ? "Monthly" : (
                          <>
                            Annual
                            <span style={{
                              fontSize: "0.52rem", fontWeight: 900, letterSpacing: "0.08em",
                              color: billing === "annual" ? GREEN : "rgba(63,185,80,0.7)",
                              transition: "color 0.15s",
                            }}>
                              SAVE MORE
                            </span>
                          </>
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Founder price */}
                <div style={{ display: "flex", alignItems: "baseline", gap: "0.4rem", marginBottom: "0.5rem" }}>
                  <span style={{
                    fontFamily: "'Barlow Condensed', sans-serif",
                    fontWeight: 900, fontStyle: "italic",
                    fontSize: "clamp(3.5rem, 7vw, 5rem)",
                    lineHeight: 0.9, color: WHITE,
                  }}>
                    {b.founder}
                  </span>
                  <span style={{ fontFamily: "'Barlow', sans-serif", fontSize: "0.88rem", color: "rgba(255,255,255,0.38)", paddingBottom: "0.25rem" }}>
                    {b.period}
                  </span>
                </div>

                {/* Savings row */}
                <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginBottom: b.subNote ? "0.4rem" : "1rem", flexWrap: "wrap" }}>
                  <span style={{
                    fontFamily: "'Barlow', sans-serif", fontSize: "0.8rem",
                    color: "rgba(255,255,255,0.28)", textDecoration: "line-through",
                  }}>
                    {b.regular}{b.period}
                  </span>
                  <span style={{
                    fontFamily: "'Barlow Condensed', sans-serif",
                    fontSize: "0.68rem", fontWeight: 900, letterSpacing: "0.08em",
                    color: GREEN, background: "rgba(63,185,80,0.1)",
                    border: "0.5px solid rgba(63,185,80,0.25)",
                    padding: "2px 7px", borderRadius: 3,
                  }}>
                    {b.savings} with code
                  </span>
                </div>

                {b.subNote && (
                  <p style={{ fontFamily: "'Barlow', sans-serif", fontSize: "0.78rem", color: "rgba(255,255,255,0.38)", marginBottom: "1rem" }}>
                    {b.subNote}
                  </p>
                )}

                {/* Copyable code */}
                <div style={{ display: "flex", alignItems: "center", gap: "0.65rem", flexWrap: "wrap" }}>
                  <span style={{ fontFamily: "'Barlow', sans-serif", fontSize: "0.78rem", color: "rgba(255,255,255,0.35)" }}>
                    Checkout code:
                  </span>
                  <CopyCode code={b.code} />
                </div>
              </div>

              {/* Description */}
              <div style={{ padding: "1rem clamp(1.75rem, 3.5vw, 2.25rem)", borderBottom: "0.5px solid rgba(255,255,255,0.07)" }}>
                <p style={{ fontFamily: "'Barlow', sans-serif", fontSize: "0.88rem", lineHeight: 1.65, color: "rgba(255,255,255,0.52)" }}>
                  For coaches and athletic programs that need the full platform — film, nutrition, compliance, and accountability with no roster limits.
                </p>
              </div>

              {/* Features */}
              <div style={{ padding: "clamp(1.25rem, 2.5vw, 1.75rem) clamp(1.75rem, 3.5vw, 2.25rem)" }}>
                <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: "0.7rem" }}>
                  {PROGRAM_FEATURES.map(f => (
                    <li key={f} style={{ display: "flex", alignItems: "flex-start", gap: "0.6rem" }}>
                      <span style={{ flexShrink: 0, marginTop: "1px" }}><Check /></span>
                      <span style={{ fontFamily: "'Barlow', sans-serif", fontSize: "0.88rem", color: "rgba(255,255,255,0.68)", lineHeight: 1.5 }}>{f}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* CTA */}
              <div style={{ padding: "0 clamp(1.75rem, 3.5vw, 2.25rem) clamp(1.75rem, 3.5vw, 2.25rem)" }}>
                <a
                  href="/commercial/onboard"
                  style={{
                    display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem",
                    padding: "0.9rem 1.5rem",
                    background: ACCENT, color: BLACK,
                    fontFamily: "'Barlow Condensed', sans-serif",
                    fontSize: "0.88rem", fontWeight: 900,
                    letterSpacing: "0.12em", textTransform: "uppercase",
                    textDecoration: "none", borderRadius: 2, transition: "filter 0.18s",
                  }}
                  onMouseEnter={e => { e.currentTarget.style.filter = "brightness(1.1)"; }}
                  onMouseLeave={e => { e.currentTarget.style.filter = "none"; }}
                >
                  Get Started
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
                  </svg>
                </a>
                <p style={{ textAlign: "center", marginTop: "0.6rem", fontFamily: "'Barlow', sans-serif", fontSize: "0.7rem", color: "rgba(255,255,255,0.25)", letterSpacing: "0.04em" }}>
                  30-day free trial · No credit card required · Cancel anytime
                </p>
              </div>
            </motion.div>

          </div>

          {/* ── Trust strip ── */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6, delay: 0.5 }}
            style={{
              maxWidth: 700, margin: "0 auto clamp(3.5rem, 7vw, 6rem)",
              padding: "1.5rem 2rem",
              border: "0.5px solid rgba(255,255,255,0.07)",
              borderRadius: 2,
              display: "flex", flexWrap: "wrap", gap: "1.25rem", justifyContent: "center",
            }}
          >
            {[
              "No credit card to start",
              "Cancel anytime",
              "Unlimited athletes",
              "NCAA compliance included",
            ].map(t => (
              <div key={t} style={{ display: "flex", alignItems: "center", gap: "0.45rem" }}>
                <Check />
                <span style={{
                  fontFamily: "'Barlow Condensed', sans-serif", fontSize: "0.78rem",
                  fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase",
                  color: "rgba(255,255,255,0.4)",
                }}>{t}</span>
              </div>
            ))}
          </motion.div>

          {/* ── FAQ ── */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={inView ? { opacity: 1 } : {}}
            transition={{ duration: 0.5, delay: 0.65 }}
            style={{ maxWidth: 560, margin: "0 auto", textAlign: "center" }}
          >
            <p style={{
              fontFamily: "'Barlow', sans-serif",
              fontSize: "0.88rem", lineHeight: 1.8,
              color: "rgba(255,255,255,0.35)",
            }}>
              Questions about which plan fits your program?{" "}
              <a href="mailto:support@checkpeak.com" style={{ color: ACCENT, textDecoration: "none", fontWeight: 600 }}
                onMouseEnter={e => { e.currentTarget.style.opacity = "0.75"; }}
                onMouseLeave={e => { e.currentTarget.style.opacity = "1"; }}
              >
                support@checkpeak.com
              </a>
              {" "}— we read every message.
            </p>
          </motion.div>

        </div>

        <ComparisonMoment />

      </main>
    </>
  );
}
