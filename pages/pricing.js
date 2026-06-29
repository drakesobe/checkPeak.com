// pages/pricing.js
import Head from "next/head";
import { useRef } from "react";
import { motion, useInView } from "framer-motion";

const ACCENT = "#4FABFF";
const BLACK  = "#060810";
const WHITE  = "#FFFFFF";
const GRAIN_URL = `url("data:image/svg+xml,%3Csvg viewBox='0 0 512 512' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`;

const STYLE = `
  @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:ital,wght@0,400;0,700;0,900;1,900&family=Barlow:wght@400;500;600&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
`;

function Check() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={ACCENT} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

const STUDIO_FEATURES = [
  "Unlimited athletes",
  "Training library builder",
  "Nutrition programming & macros",
  "Film room with draw tools",
  "Mobile app for athletes",
  "Streak leaderboards",
  "Analytics dashboard",
  "Team messaging",
  "The Arena marketplace listing",
];

const PROGRAM_FEATURES = [
  "Everything in Studio",
  "CARA / VARA compliance monitoring",
  "Off-campus accountability tracking",
  "Multi-sport roster management",
  "Custom season & break calendar",
  "Film delivery to athlete phones",
  "Multi-coach staff access",
  "Airtable sync",
  "Dedicated onboarding call",
  "Priority support",
];

export default function PricingPage() {
  const ref    = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-10%" });

  return (
    <>
      <style>{STYLE}</style>
      <Head>
        <title>Pricing | CheckPeak</title>
        <meta name="description" content="Simple pricing for coaches and athletic programs. Studio starts at $99/month. Programs contact us for full org tools." />
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
          position: "fixed", left: "50%", top: "30%",
          transform: "translate(-50%, -50%)",
          width: "80vw", height: "50vw",
          borderRadius: "50%", zIndex: 0, pointerEvents: "none",
          background: "radial-gradient(ellipse, rgba(79,171,255,0.05) 0%, transparent 65%)",
        }} />

        <div ref={ref} style={{ position: "relative", zIndex: 1, padding: "clamp(5rem, 10vw, 8rem) clamp(1.25rem, 7vw, 7rem)" }}>

          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 24 }} animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            style={{ textAlign: "center", marginBottom: "clamp(4rem, 8vw, 7rem)" }}
          >
            <div style={{ display: "inline-flex", alignItems: "center", gap: "0.6rem", marginBottom: "clamp(1rem, 2vw, 1.5rem)" }}>
              <div style={{ width: "1.75rem", height: "0.5px", background: ACCENT }} />
              <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "0.68rem", fontWeight: 900, letterSpacing: "0.24em", textTransform: "uppercase", color: ACCENT }}>Pricing</span>
              <div style={{ width: "1.75rem", height: "0.5px", background: ACCENT }} />
            </div>

            <h1 style={{
              fontFamily: "'Barlow Condensed', sans-serif",
              fontWeight: 900, fontStyle: "italic",
              fontSize: "clamp(3.5rem, 10vw, 10rem)",
              lineHeight: 0.88, letterSpacing: "-0.03em",
              textTransform: "uppercase", color: WHITE,
              marginBottom: "clamp(1.25rem, 2.5vw, 2rem)",
            }}>
              Simple.<br />
              <span style={{ color: ACCENT }}>No games.</span>
            </h1>

            <p style={{
              fontFamily: "'Barlow', sans-serif",
              fontSize: "clamp(0.95rem, 1.2vw, 1.1rem)",
              lineHeight: 1.7, color: "rgba(255,255,255,0.5)",
              maxWidth: "46ch", margin: "0 auto",
            }}>
              One platform for every coach, trainer, and athletic program.
              Pick the tier that fits how you work.
            </p>
          </motion.div>

          {/* Pricing cards */}
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
            gap: "clamp(1.5rem, 3vw, 2.5rem)",
            maxWidth: 900,
            margin: "0 auto clamp(4rem, 8vw, 7rem)",
          }}>

            {/* Studio */}
            <motion.div
              initial={{ opacity: 0, y: 32 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.8, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
              style={{
                background: "#0B0F17",
                border: "0.5px solid rgba(255,255,255,0.1)",
                borderTop: `3px solid ${ACCENT}`,
                borderRadius: 2,
                overflow: "hidden",
                display: "flex",
                flexDirection: "column",
              }}
            >
              <div style={{ padding: "clamp(1.75rem, 3.5vw, 2.5rem)", borderBottom: "0.5px solid rgba(255,255,255,0.07)" }}>
                <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: "0.68rem", letterSpacing: "0.2em", textTransform: "uppercase", color: ACCENT, marginBottom: "0.6rem" }}>
                  Studio
                </p>
                <div style={{ display: "flex", alignItems: "baseline", gap: "0.35rem", marginBottom: "0.75rem" }}>
                  <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontStyle: "italic", fontSize: "clamp(3rem, 6vw, 4.5rem)", lineHeight: 1, color: WHITE }}>$99</span>
                  <span style={{ fontFamily: "'Barlow', sans-serif", fontSize: "0.9rem", color: "rgba(255,255,255,0.4)" }}>/month</span>
                </div>
                <p style={{ fontFamily: "'Barlow', sans-serif", fontSize: "0.88rem", lineHeight: 1.65, color: "rgba(255,255,255,0.5)" }}>
                  For solo coaches, gym trainers, and online businesses building a recurring revenue library.
                </p>
              </div>

              <div style={{ padding: "clamp(1.5rem, 3vw, 2rem)", flex: 1 }}>
                <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                  {STUDIO_FEATURES.map(f => (
                    <li key={f} style={{ display: "flex", alignItems: "flex-start", gap: "0.65rem" }}>
                      <span style={{ flexShrink: 0, marginTop: "1px" }}><Check /></span>
                      <span style={{ fontFamily: "'Barlow', sans-serif", fontSize: "0.9rem", color: "rgba(255,255,255,0.72)", lineHeight: 1.5 }}>{f}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div style={{ padding: "clamp(1.25rem, 2.5vw, 1.75rem)" }}>
                <a
                  href="/commercial/onboard"
                  style={{
                    display: "flex", alignItems: "center", justifyContent: "center", gap: "0.55rem",
                    padding: "0.9rem 1.5rem",
                    background: ACCENT, color: BLACK,
                    fontFamily: "'Barlow Condensed', sans-serif",
                    fontSize: "0.88rem", fontWeight: 900,
                    letterSpacing: "0.12em", textTransform: "uppercase",
                    textDecoration: "none", transition: "filter 0.2s",
                  }}
                  onMouseEnter={e => { e.currentTarget.style.filter = "brightness(1.12)"; }}
                  onMouseLeave={e => { e.currentTarget.style.filter = "none"; }}
                >
                  GET STARTED
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
                  </svg>
                </a>
                <p style={{ textAlign: "center", marginTop: "0.65rem", fontFamily: "'Barlow', sans-serif", fontSize: "0.72rem", color: "rgba(255,255,255,0.28)", letterSpacing: "0.04em" }}>
                  No contracts · Cancel anytime
                </p>
              </div>
            </motion.div>

            {/* Program */}
            <motion.div
              initial={{ opacity: 0, y: 32 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.8, delay: 0.22, ease: [0.16, 1, 0.3, 1] }}
              style={{
                background: "#0B0F17",
                border: "1px solid rgba(255,255,255,0.16)",
                borderTop: "3px solid rgba(255,255,255,0.35)",
                borderRadius: 2,
                overflow: "hidden",
                display: "flex",
                flexDirection: "column",
                position: "relative",
              }}
            >
              {/* "For universities" badge */}
              <div style={{ position: "absolute", top: "clamp(1.75rem, 3.5vw, 2.5rem)", right: "clamp(1.75rem, 3.5vw, 2.5rem)" }}>
                <span style={{
                  fontFamily: "'Barlow Condensed', sans-serif",
                  fontSize: "0.6rem", fontWeight: 700,
                  letterSpacing: "0.14em", textTransform: "uppercase",
                  padding: "2px 8px",
                  border: "0.5px solid rgba(255,255,255,0.2)",
                  color: "rgba(255,255,255,0.5)",
                }}>
                  Universities &amp; programs
                </span>
              </div>

              <div style={{ padding: "clamp(1.75rem, 3.5vw, 2.5rem)", borderBottom: "0.5px solid rgba(255,255,255,0.07)" }}>
                <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: "0.68rem", letterSpacing: "0.2em", textTransform: "uppercase", color: "rgba(255,255,255,0.5)", marginBottom: "0.6rem" }}>
                  Program
                </p>
                <div style={{ display: "flex", alignItems: "baseline", gap: "0.35rem", marginBottom: "0.75rem" }}>
                  <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontStyle: "italic", fontSize: "clamp(2rem, 4vw, 3rem)", lineHeight: 1, color: WHITE }}>Let&apos;s talk.</span>
                </div>
                <p style={{ fontFamily: "'Barlow', sans-serif", fontSize: "0.88rem", lineHeight: 1.65, color: "rgba(255,255,255,0.5)" }}>
                  For collegiate programs and athletic departments that need full compliance monitoring, off-campus accountability, and multi-coach staff tools.
                </p>
              </div>

              <div style={{ padding: "clamp(1.5rem, 3vw, 2rem)", flex: 1 }}>
                <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                  {PROGRAM_FEATURES.map(f => (
                    <li key={f} style={{ display: "flex", alignItems: "flex-start", gap: "0.65rem" }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.45)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: "1px" }}>
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                      <span style={{ fontFamily: "'Barlow', sans-serif", fontSize: "0.9rem", color: "rgba(255,255,255,0.72)", lineHeight: 1.5 }}>{f}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div style={{ padding: "clamp(1.25rem, 2.5vw, 1.75rem)" }}>
                <button
                  type="button"
                  onClick={() => {
                    if (typeof window !== "undefined" && typeof window.__openLoginModal === "function") {
                      window.__openLoginModal({ tab: "signup", role: "organization" });
                    }
                  }}
                  style={{
                    width: "100%",
                    display: "flex", alignItems: "center", justifyContent: "center", gap: "0.55rem",
                    padding: "0.9rem 1.5rem",
                    background: "transparent", color: WHITE,
                    fontFamily: "'Barlow Condensed', sans-serif",
                    fontSize: "0.88rem", fontWeight: 900,
                    letterSpacing: "0.12em", textTransform: "uppercase",
                    border: "1px solid rgba(255,255,255,0.25)",
                    transition: "border-color 0.2s",
                    cursor: "pointer",
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.7)"; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.25)"; }}
                >
                  BOOK A WALKTHROUGH
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
                  </svg>
                </button>
                <p style={{ textAlign: "center", marginTop: "0.65rem", fontFamily: "'Barlow', sans-serif", fontSize: "0.72rem", color: "rgba(255,255,255,0.28)", letterSpacing: "0.04em" }}>
                  Dedicated onboarding · Compliance-ready from day one
                </p>
              </div>
            </motion.div>
          </div>

          {/* Bottom trust strip */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.7, delay: 0.5 }}
            style={{
              maxWidth: 700, margin: "0 auto",
              padding: "2rem",
              border: "0.5px solid rgba(255,255,255,0.07)",
              borderRadius: 2,
              display: "flex",
              flexWrap: "wrap",
              gap: "1.5rem",
              justifyContent: "center",
            }}
          >
            {[
              "No credit card required to start",
              "Cancel anytime",
              "Unlimited athletes on all plans",
              "NCAA compliance reference included",
            ].map(t => (
              <div key={t} style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <Check />
                <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "0.82rem", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "rgba(255,255,255,0.45)" }}>{t}</span>
              </div>
            ))}
          </motion.div>

          {/* FAQ strip */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={inView ? { opacity: 1 } : {}}
            transition={{ duration: 0.6, delay: 0.7 }}
            style={{ maxWidth: 640, margin: "clamp(4rem, 8vw, 7rem) auto 0", textAlign: "center" }}
          >
            <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: "0.68rem", letterSpacing: "0.2em", textTransform: "uppercase", color: "rgba(255,255,255,0.28)", marginBottom: "1.5rem" }}>
              Questions?
            </p>
            <p style={{ fontFamily: "'Barlow', sans-serif", fontSize: "0.9rem", lineHeight: 1.75, color: "rgba(255,255,255,0.4)" }}>
              Reach us at{" "}
              <a href="mailto:support@checkpeak.com" style={{ color: ACCENT, textDecoration: "none", fontWeight: 600, transition: "opacity 0.18s" }}
                onMouseEnter={e => { e.currentTarget.style.opacity = "0.75"; }}
                onMouseLeave={e => { e.currentTarget.style.opacity = "1"; }}
              >
                support@checkpeak.com
              </a>
              {" "}— we read every message.
            </p>
          </motion.div>

        </div>
      </main>
    </>
  );
}
