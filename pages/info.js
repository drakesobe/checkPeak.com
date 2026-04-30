// pages/info.js
import Head from "next/head";
import Link from "next/link";
import Image from "next/image";
import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import {
  FaArrowRight, FaCamera, FaSearch, FaShieldAlt,
  FaExclamationTriangle,
} from "react-icons/fa";

import ComplianceSection from "@/components/info/ComplianceSection";
import ResourceLink      from "@/components/info/ResourceLink";

import {
  infoHero,
  howItWorksSteps,
  productPillars,
  positioningCards,
  safetyNotes,
} from "@/lib/info/infoContent";
import { ncaaWordingCallouts }                      from "@/lib/compliance/ncaaWording";
import { ncaaResourceBackbone, NCAA_LAST_REVIEWED } from "@/lib/compliance/ncaaSources";

// ── Brand tokens — match index.js exactly ────────────────────────────────────
const ACCENT = "#4FABFF";
const BLACK  = "#060810";
const WHITE  = "#FFFFFF";
const RED    = "#C8102E";
const AMBER  = "#F5A623";

// ── Film grain — same as index ────────────────────────────────────────────────
const GRAIN_URL = `url("data:image/svg+xml,%3Csvg viewBox='0 0 512 512' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`;

const GLOBAL_STYLE = `
  @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:ital,wght@0,400;0,700;0,900;1,700;1,900&family=Barlow:wght@400;500;600;700&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  html { scroll-behavior: smooth; }
`;

// ── Animation helpers ─────────────────────────────────────────────────────────
const fadeUp  = { hidden: { opacity: 0, y: 32 }, visible: { opacity: 1, y: 0 } };
const fadeIn  = { hidden: { opacity: 0 },         visible: { opacity: 1 } };

function useReveal(options = {}) {
  const ref    = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-10%", ...options });
  return { ref, inView };
}

// ── Shared grain overlay ──────────────────────────────────────────────────────
function Grain({ opacity = 0.04 }) {
  return (
    <div
      aria-hidden="true"
      style={{
        position: "absolute", inset: 0, zIndex: 1,
        backgroundImage: GRAIN_URL, backgroundRepeat: "repeat",
        backgroundSize: "256px 256px", opacity, mixBlendMode: "screen",
        pointerEvents: "none",
      }}
    />
  );
}

// ── Left accent line (matches index DeclarationBeat) ──────────────────────────
function AccentLine({ color = "rgba(255,255,255,0.18)", inView }) {
  return (
    <motion.div
      aria-hidden="true"
      initial={{ scaleY: 0 }}
      animate={inView ? { scaleY: 1 } : {}}
      transition={{ duration: 1.2, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
      style={{
        position: "absolute", left: 0, top: "15%", bottom: "15%", width: 2,
        background: `linear-gradient(to bottom, transparent, ${color}, transparent)`,
        zIndex: 2, transformOrigin: "top",
      }}
    />
  );
}

// ── Section eyebrow ───────────────────────────────────────────────────────────
function Eyebrow({ children, color = ACCENT }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "0.85rem", marginBottom: "clamp(1rem, 2vw, 1.5rem)" }}>
      <div style={{ width: "clamp(1.5rem, 3vw, 2.5rem)", height: "0.5px", background: "rgba(255,255,255,0.22)" }} />
      <span style={{
        fontFamily: "'Barlow Condensed', sans-serif", fontSize: "0.75rem",
        fontWeight: 900, letterSpacing: "0.2em", textTransform: "uppercase",
        color: "rgba(255,255,255,0.45)",
      }}>
        {children}
      </span>
    </div>
  );
}

// ── Big section headline — index style ───────────────────────────────────────
function SectionHeadline({ children, accent, sub }) {
  const { ref, inView } = useReveal();
  return (
    <div ref={ref}>
      <motion.h2
        initial={{ opacity: 0, y: 32 }}
        animate={inView ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
        style={{
          fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900,
          fontStyle: "italic", fontSize: "clamp(2.5rem, 7vw, 6rem)",
          lineHeight: 0.9, letterSpacing: "-0.02em", textTransform: "uppercase",
          color: WHITE, marginBottom: sub ? "clamp(1rem, 2vw, 1.75rem)" : 0,
        }}
      >
        {children}{" "}
        {accent && <span style={{ color: ACCENT }}>{accent}</span>}
      </motion.h2>
      {sub && (
        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.7, delay: 0.15 }}
          style={{
            fontFamily: "'Barlow', sans-serif", fontSize: "clamp(0.95rem, 1.2vw, 1.05rem)",
            lineHeight: 1.7, color: "rgba(255,255,255,0.55)", maxWidth: "52ch",
          }}
        >
          {sub}
        </motion.p>
      )}
    </div>
  );
}

// ── Dark card ─────────────────────────────────────────────────────────────────
function DarkCard({ icon, title, text, accentColor = ACCENT, index = 0 }) {
  const { ref, inView } = useReveal();
  return (
    <motion.article
      ref={ref}
      initial={{ opacity: 0, y: 24 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.6, delay: index * 0.08 }}
      style={{
        position: "relative", overflow: "hidden",
        backgroundColor: "rgba(255,255,255,0.03)",
        border: "1px solid rgba(255,255,255,0.08)",
        borderTop: `3px solid ${accentColor}`,
        padding: "clamp(1.25rem, 3vw, 2rem)",
      }}
    >
      {/* Ghost number */}
      <div aria-hidden="true" style={{
        position: "absolute", top: -8, right: -4,
        fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900,
        fontSize: "6rem", lineHeight: 1, color: accentColor, opacity: 0.06,
        userSelect: "none", pointerEvents: "none",
      }}>
        {index + 1}
      </div>

      <div style={{
        display: "flex", alignItems: "center", justifyContent: "center",
        width: 36, height: 36, marginBottom: "1rem",
        backgroundColor: `${accentColor}15`,
        border: `1px solid ${accentColor}30`,
        color: accentColor, fontSize: "1rem",
      }}>
        {icon}
      </div>
      <h3 style={{
        fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900,
        fontSize: "1.1rem", letterSpacing: "0.04em", textTransform: "uppercase",
        color: WHITE, marginBottom: "0.5rem",
      }}>
        {title}
      </h3>
      <p style={{
        fontFamily: "'Barlow', sans-serif", fontSize: "0.9rem",
        lineHeight: 1.65, color: "rgba(255,255,255,0.5)",
      }}>
        {text}
      </p>
    </motion.article>
  );
}

// ── Step card — matches DeclarationBeat numerals ──────────────────────────────
const STEP_COLORS = [ACCENT, "#7C6EF5", "#46cc8a", RED];

function StepCard({ step, index }) {
  const { ref, inView } = useReveal();
  const color = STEP_COLORS[index % STEP_COLORS.length];
  return (
    <motion.article
      ref={ref}
      initial={{ opacity: 0, y: 24 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.6, delay: index * 0.09 }}
      style={{
        position: "relative", overflow: "hidden",
        backgroundColor: "rgba(255,255,255,0.03)",
        border: "1px solid rgba(255,255,255,0.08)",
        borderTop: `3px solid ${color}`,
        padding: "clamp(1.25rem, 3vw, 2rem)",
        display: "flex", flexDirection: "column",
      }}
    >
      {/* Ghost numeral */}
      <div aria-hidden="true" style={{
        position: "absolute", top: -16, right: -8,
        fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900,
        fontStyle: "italic", fontSize: "9rem", lineHeight: 1,
        color, opacity: 0.06, userSelect: "none", pointerEvents: "none",
      }}>
        {index + 1}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1rem" }}>
        <span style={{
          fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900,
          fontSize: "0.7rem", letterSpacing: "0.2em", textTransform: "uppercase",
          color, display: "flex", alignItems: "center", justifyContent: "center",
          width: 28, height: 28, border: `1px solid ${color}50`,
          backgroundColor: `${color}15`, flexShrink: 0,
        }}>
          {index + 1}
        </span>
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "center",
          width: 28, height: 28, color: "rgba(255,255,255,0.4)", fontSize: "0.85rem",
        }}>
          {step.icon}
        </div>
      </div>

      <h3 style={{
        fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900,
        fontStyle: "italic", fontSize: "1.2rem", letterSpacing: "0.02em",
        textTransform: "uppercase", color: WHITE, marginBottom: "0.5rem",
      }}>
        {step.label}
      </h3>

      <p style={{
        fontFamily: "'Barlow', sans-serif", fontSize: "0.88rem",
        lineHeight: 1.65, color: "rgba(255,255,255,0.5)", flex: 1,
        marginBottom: "1rem",
      }}>
        {step.description}
      </p>

      <div style={{
        padding: "0.6rem 0.9rem",
        backgroundColor: `${color}10`,
        borderLeft: `2px solid ${color}`,
      }}>
        <p style={{ fontFamily: "'Barlow', sans-serif", fontSize: "0.82rem", color }}>
          <span style={{ fontWeight: 700 }}>Outcome: </span>
          {step.outcome}
        </p>
      </div>
    </motion.article>
  );
}

// ── Stat tile — index proof-moment style ──────────────────────────────────────
function StatTile({ value, label, index }) {
  const { ref, inView } = useReveal();
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 24 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.7, delay: index * 0.1 }}
      style={{ textAlign: "center", padding: "clamp(1.5rem, 3vw, 2.5rem) clamp(1rem, 2vw, 1.5rem)" }}
    >
      <p style={{
        fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900,
        fontStyle: "italic", fontSize: "clamp(2.5rem, 6vw, 4.5rem)",
        lineHeight: 0.85, letterSpacing: "-0.03em", color: WHITE,
        textShadow: `0 0 40px ${ACCENT}25`,
      }}>
        {value}
      </p>
      <p style={{
        fontFamily: "'Barlow Condensed', sans-serif", fontSize: "0.72rem",
        fontWeight: 900, letterSpacing: "0.2em", textTransform: "uppercase",
        color: "rgba(255,255,255,0.38)", marginTop: "0.6rem",
      }}>
        {label}
      </p>
    </motion.div>
  );
}

// ── CTA button ────────────────────────────────────────────────────────────────
function CtaButton({ href, icon, children, primary = false }) {
  return (
    <Link href={href}>
      <span
        style={{
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          gap: "0.5rem", padding: "0.9rem 1.75rem", cursor: "pointer",
          fontFamily: "'Barlow Condensed', sans-serif", fontSize: "0.88rem",
          fontWeight: 900, letterSpacing: "0.12em", textTransform: "uppercase",
          transition: "filter 0.2s",
          ...(primary
            ? { backgroundColor: ACCENT, color: BLACK, border: "none" }
            : { backgroundColor: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.75)", border: "1px solid rgba(255,255,255,0.15)" }
          ),
        }}
        onMouseEnter={e => { e.currentTarget.style.filter = "brightness(1.12)"; }}
        onMouseLeave={e => { e.currentTarget.style.filter = "none"; }}
      >
        {icon}
        {children}
        {primary && <FaArrowRight style={{ opacity: 0.6 }} />}
      </span>
    </Link>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PAGE
// ─────────────────────────────────────────────────────────────────────────────
export default function InfoPage() {
  const heroPills    = Array.isArray(infoHero?.pills) ? infoHero.pills : [];
  const primaryCta   = infoHero?.primaryCta   || { href: "/nutrition-label-scanner", label: "Scan a Label" };
  const secondaryCta = infoHero?.secondaryCta || { href: "/search", label: "Search Ingredients" };
  const safety       = Array.isArray(safetyNotes) && safetyNotes.length > 0 ? safetyNotes[0] : null;

  const steps   = Array.isArray(howItWorksSteps)  ? howItWorksSteps  : [];
  const pillars = Array.isArray(productPillars)   ? productPillars   : [];
  const cards   = Array.isArray(positioningCards) ? positioningCards : [];

  const heroReveal = useReveal();

  return (
    <>
      <Head>
        <title>CheckPeak — Info &amp; NCAA Compliance</title>
        <meta name="description" content="CheckPeak supports workout + nutrition accountability and supplement risk awareness, with direct NCAA resource links." />
      </Head>
      <style dangerouslySetInnerHTML={{ __html: GLOBAL_STYLE }} />

      <div style={{ backgroundColor: BLACK, color: WHITE, minHeight: "100vh" }}>

        {/* ══════════════════════════════════════════════════════════════════
            1. HERO
           ══════════════════════════════════════════════════════════════════ */}
        <section style={{
          position: "relative", overflow: "hidden",
          backgroundColor: BLACK,
          padding: "clamp(5rem, 10vw, 9rem) clamp(1.25rem, 8vw, 8rem)",
          borderBottom: "0.5px solid rgba(255,255,255,0.08)",
        }}>
          <Grain />
          <AccentLine color={ACCENT} inView={true} />

          {/* Ghost watermark */}
          <div aria-hidden="true" style={{
            position: "absolute", right: "-2vw", top: "50%",
            transform: "translateY(-50%)", zIndex: 1,
            fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900,
            fontStyle: "italic", fontSize: "clamp(0rem, 28vw, 32rem)",
            lineHeight: 0.85, letterSpacing: "-0.04em", textTransform: "uppercase",
            WebkitTextStroke: "1px rgba(255,255,255,0.04)", color: "transparent",
            userSelect: "none", pointerEvents: "none", whiteSpace: "nowrap",
          }}>
            INFO
          </div>

          {/* Blue glow */}
          <div aria-hidden="true" style={{
            position: "absolute", left: "-5%", top: "50%", transform: "translateY(-50%)",
            width: "50vw", height: "50vw", borderRadius: "50%", zIndex: 0,
            background: `radial-gradient(circle, ${ACCENT}08 0%, transparent 65%)`,
            pointerEvents: "none",
          }} />

          <div style={{ position: "relative", zIndex: 2, maxWidth: "72rem", margin: "0 auto" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "3rem", alignItems: "start" }}>

              {/* Left: headline */}
              <div style={{ maxWidth: "56rem" }}>
                <Eyebrow>{infoHero?.kicker || "CheckPeak · Athlete Tools + Team Workflows"}</Eyebrow>

                <motion.h1
                  ref={heroReveal.ref}
                  initial={{ opacity: 0, y: 48, skewY: 2 }}
                  animate={{ opacity: 1, y: 0, skewY: 0 }}
                  transition={{ duration: 0.9, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
                  style={{
                    fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900,
                    fontStyle: "italic", fontSize: "clamp(3rem, 9vw, 9rem)",
                    lineHeight: 0.88, letterSpacing: "-0.03em", textTransform: "uppercase",
                    color: WHITE, marginBottom: "clamp(1.5rem, 3vw, 2.5rem)",
                    textShadow: "0 2px 60px rgba(0,0,0,0.8)",
                  }}
                >
                  Accountability<br />
                  builds{" "}
                  <span style={{ color: ACCENT }}>confidence.</span>
                </motion.h1>

                <motion.p
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.7, delay: 0.4 }}
                  style={{
                    fontFamily: "'Barlow', sans-serif",
                    fontSize: "clamp(0.95rem, 1.3vw, 1.1rem)",
                    lineHeight: 1.7, color: "rgba(255,255,255,0.55)",
                    maxWidth: "48ch", marginBottom: "clamp(2rem, 4vw, 3rem)",
                  }}
                >
                  {infoHero?.subtitle ||
                    "CheckPeak keeps athletes and staff aligned away from campus with clear plans, quick check-ins, and staff visibility."}
                </motion.p>

                {heroPills.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.6, delay: 0.55 }}
                    style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginBottom: "clamp(1.5rem, 3vw, 2.5rem)" }}
                  >
                    {heroPills.map(p => (
                      <span key={p.label} style={{
                        display: "inline-flex", alignItems: "center", gap: "0.4rem",
                        padding: "0.35rem 0.75rem",
                        backgroundColor: "rgba(255,255,255,0.06)",
                        border: "1px solid rgba(255,255,255,0.12)",
                        fontFamily: "'Barlow Condensed', sans-serif",
                        fontSize: "0.75rem", fontWeight: 700, letterSpacing: "0.08em",
                        textTransform: "uppercase", color: "rgba(255,255,255,0.65)",
                      }}>
                        {p.icon}{p.label}
                      </span>
                    ))}
                  </motion.div>
                )}

                <motion.div
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.65 }}
                  style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem", marginBottom: "2rem" }}
                >
                  <CtaButton href={primaryCta.href} icon={<FaCamera />} primary>
                    {primaryCta.label}
                  </CtaButton>
                  <CtaButton href={secondaryCta.href} icon={<FaSearch />}>
                    {secondaryCta.label}
                  </CtaButton>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.5, delay: 0.8 }}
                  style={{ display: "flex", flexWrap: "wrap", gap: "1.5rem" }}
                >
                  {[
                    { href: "#how-it-works",   label: "→ How it works" },
                    { href: "#ncaa-compliance", label: "→ NCAA compliance" },
                  ].map(l => (
                    <a key={l.href} href={l.href} style={{
                      fontFamily: "'Barlow Condensed', sans-serif", fontSize: "0.78rem",
                      fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase",
                      color: "rgba(255,255,255,0.35)", textDecoration: "none",
                      transition: "color 0.18s",
                    }}
                    onMouseEnter={e => { e.currentTarget.style.color = ACCENT; }}
                    onMouseLeave={e => { e.currentTarget.style.color = "rgba(255,255,255,0.35)"; }}
                    >
                      {l.label}
                    </a>
                  ))}
                </motion.div>

                {infoHero?.microDisclaimer && (
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.5, delay: 0.9 }}
                    style={{
                      fontFamily: "'Barlow', sans-serif", fontSize: "0.78rem",
                      color: "rgba(255,255,255,0.28)", marginTop: "1.25rem",
                    }}
                  >
                    {infoHero.microDisclaimer}
                  </motion.p>
                )}
              </div>

              {/* What we do best — right card */}
              <motion.div
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, delay: 0.35 }}
                style={{
                  backgroundColor: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  borderTop: `3px solid ${RED}`,
                  padding: "clamp(1.25rem, 3vw, 2rem)",
                  maxWidth: "42rem",
                }}
              >
                <p style={{
                  fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900,
                  fontSize: "0.82rem", letterSpacing: "0.14em", textTransform: "uppercase",
                  color: "rgba(255,255,255,0.55)", marginBottom: "1rem",
                }}>
                  What CheckPeak does best
                </p>
                <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: "0.85rem", marginBottom: "1.25rem" }}>
                  {[
                    "Off-season accountability with consistent check-ins",
                    "Evidence-based workout completions + staff review workflows",
                    "Supplement screening as a fast first pass",
                  ].map((item, i) => (
                    <li key={i} style={{ display: "flex", alignItems: "flex-start", gap: "0.75rem" }}>
                      <span style={{
                        fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900,
                        fontSize: "0.68rem", flexShrink: 0,
                        width: 22, height: 22, display: "flex", alignItems: "center", justifyContent: "center",
                        backgroundColor: RED, color: WHITE, marginTop: "0.1rem",
                      }}>
                        {i + 1}
                      </span>
                      <span style={{
                        fontFamily: "'Barlow', sans-serif", fontSize: "0.88rem",
                        lineHeight: 1.6, color: "rgba(255,255,255,0.65)",
                      }}>
                        {item}
                      </span>
                    </li>
                  ))}
                </ul>

                <div style={{ height: "0.5px", background: "rgba(255,255,255,0.08)", marginBottom: "1rem" }} />

                <div style={{
                  padding: "0.75rem 1rem",
                  backgroundColor: `${RED}18`,
                  borderLeft: `3px solid ${RED}`,
                }}>
                  <p style={{ fontFamily: "'Barlow', sans-serif", fontSize: "0.82rem", fontWeight: 600, color: "rgba(255,255,255,0.7)" }}>
                    Always confirm with your compliance and medical staff before consuming any product.
                  </p>
                </div>
              </motion.div>

            </div>
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════════════════
            2. RISK CALLOUT
           ══════════════════════════════════════════════════════════════════ */}
        {(() => {
          const { ref, inView } = useReveal();
          return (
            <section ref={ref} style={{
              position: "relative", overflow: "hidden",
              backgroundColor: "#080C14",
              padding: "clamp(3.5rem, 7vw, 6rem) clamp(1.25rem, 8vw, 8rem)",
              borderTop: "0.5px solid rgba(255,255,255,0.06)",
              borderBottom: "0.5px solid rgba(255,255,255,0.06)",
            }}>
              <Grain opacity={0.03} />

              <div style={{ position: "relative", zIndex: 2, maxWidth: "72rem", margin: "0 auto", display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "2rem" }}>
                <div style={{ flex: "1 1 400px" }}>
                  <motion.h2
                    initial={{ opacity: 0, y: 32 }}
                    animate={inView ? { opacity: 1, y: 0 } : {}}
                    transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
                    style={{
                      fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900,
                      fontStyle: "italic", fontSize: "clamp(2rem, 6vw, 5rem)",
                      lineHeight: 0.9, letterSpacing: "-0.025em", textTransform: "uppercase",
                      color: WHITE, marginBottom: "1rem",
                    }}
                  >
                    One substance.{" "}
                    One test.{" "}
                    <span style={{ color: RED }}>Career over.</span>
                  </motion.h2>
                  <motion.p
                    initial={{ opacity: 0, y: 16 }}
                    animate={inView ? { opacity: 1, y: 0 } : {}}
                    transition={{ duration: 0.7, delay: 0.2 }}
                    style={{
                      fontFamily: "'Barlow', sans-serif", fontSize: "clamp(0.9rem, 1.2vw, 1rem)",
                      lineHeight: 1.7, color: "rgba(255,255,255,0.55)", maxWidth: "50ch",
                    }}
                  >
                    Supplements are contaminated, mislabeled, and relabeled every year.
                    The NCAA doesn't care about intent — a positive test is a positive test.
                    CheckPeak gives athletes a fast first-pass screen before anything goes in their body.
                  </motion.p>
                </div>

                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={inView ? { opacity: 1, x: 0 } : {}}
                  transition={{ duration: 0.6, delay: 0.3 }}
                >
                  <Link href="/nutrition-label-scanner">
                    <span style={{
                      display: "inline-flex", alignItems: "center", gap: "0.6rem",
                      padding: "0.9rem 1.75rem", cursor: "pointer",
                      backgroundColor: RED, color: WHITE,
                      fontFamily: "'Barlow Condensed', sans-serif", fontSize: "0.88rem",
                      fontWeight: 900, letterSpacing: "0.12em", textTransform: "uppercase",
                      border: "none", transition: "filter 0.2s",
                    }}
                    onMouseEnter={e => { e.currentTarget.style.filter = "brightness(1.12)"; }}
                    onMouseLeave={e => { e.currentTarget.style.filter = "none"; }}
                    >
                      <FaCamera />
                      Scan a label now
                      <FaArrowRight style={{ opacity: 0.7 }} />
                    </span>
                  </Link>
                </motion.div>
              </div>
            </section>
          );
        })()}

        {/* ══════════════════════════════════════════════════════════════════
            3. WHAT YOU GET
           ══════════════════════════════════════════════════════════════════ */}
        {(() => {
          const { ref, inView } = useReveal();
          return (
            <section ref={ref} style={{
              position: "relative", overflow: "hidden", backgroundColor: BLACK,
              padding: "clamp(4rem, 8vw, 8rem) clamp(1.25rem, 8vw, 8rem)",
              borderBottom: "0.5px solid rgba(255,255,255,0.08)",
            }}>
              <Grain />
              <AccentLine inView={inView} />

              <div style={{ position: "relative", zIndex: 2, maxWidth: "72rem", margin: "0 auto" }}>
                <Eyebrow>What you get</Eyebrow>
                <SectionHeadline accent="one place." sub="Workout accountability, nutrition targets, and supplement screening — one repeatable workflow.">
                  Three tools.
                </SectionHeadline>

                <div style={{
                  display: "grid", gap: "1px",
                  gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
                  backgroundColor: "rgba(255,255,255,0.06)",
                  marginTop: "clamp(2rem, 4vw, 3.5rem)",
                }}>
                  {pillars.map((p, i) => (
                    <DarkCard key={p.title} icon={p.icon} title={p.title} text={p.text} accentColor={STEP_COLORS[i % STEP_COLORS.length]} index={i} />
                  ))}
                </div>
              </div>
            </section>
          );
        })()}

        {/* ══════════════════════════════════════════════════════════════════
            4. HOW IT WORKS
           ══════════════════════════════════════════════════════════════════ */}
        {(() => {
          const { ref, inView } = useReveal();
          return (
            <section
              id="how-it-works"
              ref={ref}
              style={{
                position: "relative", overflow: "hidden", backgroundColor: "#060C16",
                padding: "clamp(4rem, 8vw, 8rem) clamp(1.25rem, 8vw, 8rem)",
                borderBottom: "0.5px solid rgba(255,255,255,0.08)",
                scrollMarginTop: "calc(var(--app-header-h, 64px) + 24px)",
              }}
            >
              <Grain />
              <AccentLine color={ACCENT} inView={inView} />

              <div style={{ position: "relative", zIndex: 2, maxWidth: "72rem", margin: "0 auto" }}>
                <Eyebrow>The workflow</Eyebrow>
                <SectionHeadline accent="Clear feedback." sub="Easy for athletes to use, quick for staff to review. Everything stays organized by athlete, team, and date.">
                  Simple check-ins.
                </SectionHeadline>

                <div style={{
                  display: "grid", gap: "1px",
                  gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
                  backgroundColor: "rgba(255,255,255,0.06)",
                  marginTop: "clamp(2rem, 4vw, 3.5rem)",
                }}>
                  {steps.map((step, i) => (
                    <StepCard key={step.label || i} step={step} index={i} />
                  ))}
                </div>

                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem", marginTop: "2.5rem", justifyContent: "center" }}>
                  <CtaButton href="/nutrition-label-scanner" icon={<FaCamera />} primary>
                    Run a supplement scan
                  </CtaButton>
                  <CtaButton href="/search" icon={<FaSearch />}>
                    Search ingredients
                  </CtaButton>
                </div>
              </div>
            </section>
          );
        })()}

        {/* ══════════════════════════════════════════════════════════════════
            5. STATS SCOREBOARD
           ══════════════════════════════════════════════════════════════════ */}
        {(() => {
          const { ref, inView } = useReveal();
          return (
            <section ref={ref} style={{
              position: "relative", overflow: "hidden", backgroundColor: BLACK,
              padding: "clamp(4rem, 8vw, 7rem) clamp(1.25rem, 8vw, 8rem)",
              borderBottom: "0.5px solid rgba(255,255,255,0.08)",
            }}>
              <Grain />

              {/* Blue glow center */}
              <div aria-hidden="true" style={{
                position: "absolute", left: "50%", top: "50%",
                transform: "translate(-50%, -50%)",
                width: "60vw", height: "60vw", borderRadius: "50%",
                background: `radial-gradient(circle, ${ACCENT}07 0%, transparent 65%)`,
                zIndex: 0, pointerEvents: "none",
              }} />

              <div style={{ position: "relative", zIndex: 2, maxWidth: "72rem", margin: "0 auto", textAlign: "center" }}>
                <Eyebrow>By the numbers</Eyebrow>
                <motion.h2
                  initial={{ opacity: 0, y: 24 }}
                  animate={inView ? { opacity: 1, y: 0 } : {}}
                  transition={{ duration: 0.7 }}
                  style={{
                    fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900,
                    fontStyle: "italic", fontSize: "clamp(1.8rem, 4vw, 3.5rem)",
                    letterSpacing: "-0.02em", textTransform: "uppercase",
                    color: WHITE, marginBottom: "clamp(2rem, 4vw, 3.5rem)",
                  }}
                >
                  The database behind every scan
                </motion.h2>

                <div style={{
                  display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
                  gap: "1px", backgroundColor: "rgba(255,255,255,0.08)",
                  border: "1px solid rgba(255,255,255,0.08)",
                }}>
                  {[
                    { value: "900+",       label: "Substances tracked" },
                    { value: "1000+",      label: "Ingredients mapped" },
                    { value: "4",          label: "Data providers" },
                    { value: "Collegiate", label: "Program focus" },
                  ].map((s, i) => (
                    <div key={s.label} style={{ backgroundColor: BLACK }}>
                      <StatTile value={s.value} label={s.label} index={i} />
                    </div>
                  ))}
                </div>

                <p style={{
                  fontFamily: "'Barlow Condensed', sans-serif", fontSize: "0.7rem",
                  fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase",
                  color: "rgba(255,255,255,0.2)", marginTop: "1.25rem",
                }}>
                  Data synced from Airtable at build time · Updated quarterly
                </p>
              </div>
            </section>
          );
        })()}

        {/* ══════════════════════════════════════════════════════════════════
            6. WHY TEAMS USE CHECKPEAK
           ══════════════════════════════════════════════════════════════════ */}
        {cards.length > 0 && (() => {
          const { ref, inView } = useReveal();
          return (
            <section ref={ref} style={{
              position: "relative", overflow: "hidden", backgroundColor: "#060C16",
              padding: "clamp(4rem, 8vw, 8rem) clamp(1.25rem, 8vw, 8rem)",
              borderBottom: "0.5px solid rgba(255,255,255,0.08)",
            }}>
              <Grain />
              <AccentLine color={AMBER} inView={inView} />

              <div style={{ position: "relative", zIndex: 2, maxWidth: "72rem", margin: "0 auto" }}>
                <Eyebrow>Why teams use CheckPeak</Eyebrow>
                <SectionHeadline
                  accent="plans drift."
                  sub="Offseason, breaks, travel, and rehab are where routines get messy. CheckPeak keeps it simple: athletes check in, staff responds, everyone stays aligned."
                >
                  Away-from-campus is where
                </SectionHeadline>

                <div style={{
                  display: "grid", gap: "1px",
                  gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
                  backgroundColor: "rgba(255,255,255,0.06)",
                  marginTop: "clamp(2rem, 4vw, 3.5rem)",
                }}>
                  {cards.map((c, i) => (
                    <DarkCard key={c.title} icon={c.icon} title={c.title} text={c.text} accentColor={AMBER} index={i} />
                  ))}
                </div>
              </div>
            </section>
          );
        })()}

        {/* ══════════════════════════════════════════════════════════════════
            7. NCAA COMPLIANCE
           ══════════════════════════════════════════════════════════════════ */}
        <div
          id="ncaa-compliance"
          style={{
            backgroundColor: BLACK,
            scrollMarginTop: "calc(var(--app-header-h, 64px) + 24px)",
          }}
        >
          {/* Wrap ComplianceSection to force dark bg */}
          <div style={{ position: "relative" }}>
            <Grain />
            <ComplianceSection
              wording={Array.isArray(ncaaWordingCallouts)    ? ncaaWordingCallouts    : []}
              ncaaSources={Array.isArray(ncaaResourceBackbone) ? ncaaResourceBackbone : []}
              lastReviewed={NCAA_LAST_REVIEWED}
            />
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════════════════
            8. TRUSTED RESOURCES
           ══════════════════════════════════════════════════════════════════ */}
        {(() => {
          const { ref, inView } = useReveal();
          return (
            <section ref={ref} style={{
              position: "relative", overflow: "hidden", backgroundColor: "#060C16",
              padding: "clamp(4rem, 8vw, 7rem) clamp(1.25rem, 8vw, 8rem)",
              borderTop: "0.5px solid rgba(255,255,255,0.08)",
              borderBottom: "0.5px solid rgba(255,255,255,0.08)",
            }}>
              <Grain />
              <AccentLine inView={inView} />

              <div style={{ position: "relative", zIndex: 2, maxWidth: "72rem", margin: "0 auto" }}>
                <Eyebrow>Trusted resources</Eyebrow>
                <SectionHeadline
                  accent="official bodies."
                  sub="For final decisions, cross-reference official rules and your program's compliance process."
                >
                  Use CheckPeak alongside
                </SectionHeadline>

                <div style={{
                  display: "grid", gap: "1px",
                  gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
                  backgroundColor: "rgba(255,255,255,0.06)",
                  marginTop: "clamp(2rem, 4vw, 3.5rem)",
                }}>
                  {[
                    { name: "WADA — World Anti-Doping Agency", desc: "Global authority for the World Anti-Doping Code and Prohibited List.", href: "https://www.wada-ama.org/" },
                    { name: "USADA — U.S. Anti-Doping Agency", desc: "U.S. education resources and prohibited list guidance.", href: "https://www.usada.org/" },
                    { name: "NSF Certified for Sport",         desc: "Third-party testing program for supplement certification.", href: "https://www.nsfsport.com/certified-for-sport/" },
                    { name: "Informed Sport",                  desc: "Global supplement testing and certification program.", href: "https://sport.wetestyoutrust.com/" },
                  ].map((r, i) => (
                    <motion.a
                      key={r.href}
                      href={r.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      initial={{ opacity: 0, y: 16 }}
                      animate={inView ? { opacity: 1, y: 0 } : {}}
                      transition={{ duration: 0.5, delay: i * 0.07 }}
                      style={{
                        display: "block", padding: "clamp(1.25rem, 2.5vw, 1.75rem)",
                        backgroundColor: BLACK, textDecoration: "none",
                        borderLeft: `3px solid ${ACCENT}40`,
                        transition: "border-color 0.2s, background-color 0.2s",
                      }}
                      onMouseEnter={e => {
                        e.currentTarget.style.borderLeftColor = ACCENT;
                        e.currentTarget.style.backgroundColor = "rgba(79,171,255,0.04)";
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.borderLeftColor = `${ACCENT}40`;
                        e.currentTarget.style.backgroundColor = BLACK;
                      }}
                    >
                      <p style={{
                        fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900,
                        fontSize: "0.95rem", letterSpacing: "0.04em", textTransform: "uppercase",
                        color: WHITE, marginBottom: "0.4rem",
                      }}>
                        {r.name}
                      </p>
                      <p style={{
                        fontFamily: "'Barlow', sans-serif", fontSize: "0.85rem",
                        lineHeight: 1.6, color: "rgba(255,255,255,0.42)",
                      }}>
                        {r.desc}
                      </p>
                      <p style={{
                        fontFamily: "'Barlow Condensed', sans-serif", fontSize: "0.72rem",
                        fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase",
                        color: ACCENT, marginTop: "0.75rem", opacity: 0.7,
                      }}>
                        Visit →
                      </p>
                    </motion.a>
                  ))}
                </div>
              </div>
            </section>
          );
        })()}

        {/* ══════════════════════════════════════════════════════════════════
            9. DISCLAIMER
           ══════════════════════════════════════════════════════════════════ */}
        {safety && (() => {
          const { ref, inView } = useReveal();
          return (
            <section ref={ref} style={{
              backgroundColor: BLACK,
              padding: "clamp(2.5rem, 5vw, 4rem) clamp(1.25rem, 8vw, 8rem)",
            }}>
              <div style={{ maxWidth: "72rem", margin: "0 auto" }}>
                <motion.div
                  initial={{ opacity: 0, y: 16 }}
                  animate={inView ? { opacity: 1, y: 0 } : {}}
                  transition={{ duration: 0.5 }}
                  style={{
                    display: "flex", gap: "1rem",
                    padding: "clamp(1rem, 2vw, 1.5rem)",
                    backgroundColor: `${RED}12`,
                    border: `1px solid ${RED}30`,
                    borderLeft: `4px solid ${RED}`,
                  }}
                >
                  <FaExclamationTriangle style={{ color: RED, flexShrink: 0, marginTop: "0.15rem", fontSize: "1rem" }} />
                  <div>
                    <p style={{
                      fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900,
                      fontSize: "0.82rem", letterSpacing: "0.14em", textTransform: "uppercase",
                      color: RED, marginBottom: "0.4rem",
                    }}>
                      {safety.title}
                    </p>
                    <p style={{ fontFamily: "'Barlow', sans-serif", fontSize: "0.88rem", lineHeight: 1.65, color: "rgba(255,255,255,0.55)" }}>
                      {safety.body}
                    </p>
                    {infoHero?.legalNote && (
                      <p style={{ fontFamily: "'Barlow', sans-serif", fontSize: "0.78rem", color: "rgba(255,255,255,0.32)", marginTop: "0.5rem" }}>
                        {infoHero.legalNote}
                      </p>
                    )}
                  </div>
                </motion.div>
              </div>
            </section>
          );
        })()}

        {/* ══════════════════════════════════════════════════════════════════
            10. CTA CLOSER
           ══════════════════════════════════════════════════════════════════ */}
        {(() => {
          const { ref, inView } = useReveal();
          return (
            <section ref={ref} style={{
              position: "relative", overflow: "hidden", backgroundColor: "#060C16",
              padding: "clamp(5rem, 10vw, 9rem) clamp(1.25rem, 8vw, 8rem)",
              borderTop: "0.5px solid rgba(255,255,255,0.08)",
            }}>
              <Grain />

              {/* Ghost watermark */}
              <div aria-hidden="true" style={{
                position: "absolute", inset: 0, display: "flex",
                alignItems: "center", justifyContent: "center",
                overflow: "hidden", pointerEvents: "none",
              }}>
                <p style={{
                  fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900,
                  fontStyle: "italic", fontSize: "clamp(10rem, 35vw, 45rem)",
                  lineHeight: 1, letterSpacing: "-0.04em",
                  color: "rgba(255,255,255,0.018)", whiteSpace: "nowrap", userSelect: "none",
                }}>
                  SCAN
                </p>
              </div>

              <div style={{ position: "relative", zIndex: 2, maxWidth: "72rem", margin: "0 auto", display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "3rem" }}>
                <div style={{ flex: "1 1 400px" }}>
                  <div style={{ width: "2.5rem", height: 3, backgroundColor: RED, marginBottom: "1rem" }} />
                  <motion.h2
                    initial={{ opacity: 0, y: 32 }}
                    animate={inView ? { opacity: 1, y: 0 } : {}}
                    transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
                    style={{
                      fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900,
                      fontStyle: "italic", fontSize: "clamp(2.5rem, 6vw, 5.5rem)",
                      lineHeight: 0.9, letterSpacing: "-0.025em", textTransform: "uppercase",
                      color: WHITE, marginBottom: "1rem",
                    }}
                  >
                    Run your next label through{" "}
                    <span style={{ color: ACCENT }}>CheckPeak</span>{" "}
                    in seconds.
                  </motion.h2>
                  <p style={{ fontFamily: "'Barlow', sans-serif", fontSize: "0.9rem", color: "rgba(255,255,255,0.4)" }}>
                    Scan a label or search ingredients — then confirm with staff when uncertain.
                  </p>
                </div>

                <motion.div
                  initial={{ opacity: 0, x: 24 }}
                  animate={inView ? { opacity: 1, x: 0 } : {}}
                  transition={{ duration: 0.6, delay: 0.25 }}
                  style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}
                >
                  <CtaButton href="/nutrition-label-scanner" icon={<FaCamera />} primary>
                    Scan a Label
                  </CtaButton>
                  <CtaButton href="/search" icon={<FaSearch />}>
                    Search Ingredients
                  </CtaButton>
                </motion.div>
              </div>
            </section>
          );
        })()}

        {/* ══════════════════════════════════════════════════════════════════
            FOOTER
           ══════════════════════════════════════════════════════════════════ */}
        <footer style={{
          backgroundColor: "#040608",
          borderTop: "1px solid rgba(255,255,255,0.06)",
          padding: "2rem clamp(1.25rem, 4vw, 2.5rem)",
          textAlign: "center",
        }}>
          <p style={{
            fontFamily: "'Barlow Condensed', sans-serif", fontSize: "0.72rem",
            fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase",
            color: "rgba(255,255,255,0.18)",
          }}>
            © {new Date().getFullYear()} CheckPeak · Educational use only · Always defer to your compliance office and health care staff.
          </p>
        </footer>

      </div>
    </>
  );
}