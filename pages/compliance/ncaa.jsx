// pages/compliance/ncaa.jsx
import Head from "next/head";
import Link from "next/link";
import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import { FaArrowRight, FaExternalLinkAlt, FaClipboardList, FaShieldAlt } from "react-icons/fa";

import ComplianceSection from "@/components/info/ComplianceSection";

import { ncaaWordingCallouts }                      from "@/lib/compliance/ncaaWording";
import { ncaaResourceBackbone, NCAA_LAST_REVIEWED } from "@/lib/compliance/ncaaSources";

// ── Brand tokens - match index.js exactly ────────────────────────────────────
const ACCENT = "#4FABFF";
const BLACK  = "#060810";
const WHITE  = "#FFFFFF";
const RED    = "#C8102E";

// ── Film grain - same as index ────────────────────────────────────────────────
const GRAIN_URL = `url("data:image/svg+xml,%3Csvg viewBox='0 0 512 512' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`;

const GLOBAL_STYLE = `
  @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:ital,wght@0,400;0,700;0,900;1,700;1,900&family=Barlow:wght@400;500;600;700&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  html { scroll-behavior: smooth; }
`;

// ── Helpers ───────────────────────────────────────────────────────────────────
function useReveal(options = {}) {
  const ref    = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-10%", ...options });
  return { ref, inView };
}

function Grain({ opacity = 0.04 }) {
  return (
    <div
      aria-hidden="true"
      style={{
        position: "absolute", inset: 0, zIndex: 1,
        backgroundImage: GRAIN_URL, backgroundRepeat: "repeat",
        backgroundSize: "256px 256px", opacity,
        mixBlendMode: "screen", pointerEvents: "none",
      }}
    />
  );
}

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

function Eyebrow({ children }) {
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

// ── External quick-link pill ──────────────────────────────────────────────────
function QuickLink({ href, children }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        display: "inline-flex", alignItems: "center", gap: "0.4rem",
        padding: "0.4rem 0.85rem",
        backgroundColor: "rgba(255,255,255,0.05)",
        border: "1px solid rgba(255,255,255,0.12)",
        fontFamily: "'Barlow Condensed', sans-serif", fontSize: "0.75rem",
        fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase",
        color: "rgba(255,255,255,0.6)", textDecoration: "none",
        transition: "border-color 0.2s, color 0.2s",
        whiteSpace: "nowrap",
      }}
      onMouseEnter={e => {
        e.currentTarget.style.borderColor = `${ACCENT}60`;
        e.currentTarget.style.color = ACCENT;
      }}
      onMouseLeave={e => {
        e.currentTarget.style.borderColor = "rgba(255,255,255,0.12)";
        e.currentTarget.style.color = "rgba(255,255,255,0.6)";
      }}
    >
      <FaExternalLinkAlt style={{ fontSize: "0.6rem", opacity: 0.7 }} />
      {children}
    </a>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────
export default function NcaaCompliancePage() {
  const wording = Array.isArray(ncaaWordingCallouts)  ? ncaaWordingCallouts  : [];
  const sources = Array.isArray(ncaaResourceBackbone) ? ncaaResourceBackbone : [];

  const heroReveal = useReveal();

  return (
    <>
      <Head>
        <title>CheckPeak - NCAA Rules</title>
        <meta name="description" content="Direct NCAA resources and how CheckPeak stays NCAA-aligned." />
      </Head>
      <style dangerouslySetInnerHTML={{ __html: GLOBAL_STYLE }} />

      <div style={{ backgroundColor: BLACK, color: WHITE, minHeight: "100vh" }}>

        {/* ══════════════════════════════════════════════════════════════════
            HERO
           ══════════════════════════════════════════════════════════════════ */}
        <section style={{
          position: "relative", overflow: "hidden", backgroundColor: BLACK,
          padding: "clamp(5rem, 10vw, 9rem) clamp(1.25rem, 8vw, 8rem)",
          borderBottom: "0.5px solid rgba(255,255,255,0.08)",
        }}>
          <Grain />
          <AccentLine color={RED} inView={true} />

          {/* Ghost watermark */}
          <div aria-hidden="true" style={{
            position: "absolute", right: "-2vw", top: "50%",
            transform: "translateY(-50%)", zIndex: 1,
            fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900,
            fontStyle: "italic", fontSize: "clamp(0rem, 30vw, 36rem)",
            lineHeight: 0.85, letterSpacing: "-0.04em", textTransform: "uppercase",
            WebkitTextStroke: "1px rgba(255,255,255,0.04)", color: "transparent",
            userSelect: "none", pointerEvents: "none", whiteSpace: "nowrap",
          }}>
            NCAA
          </div>

          {/* Red glow */}
          <div aria-hidden="true" style={{
            position: "absolute", left: "-5%", top: "50%", transform: "translateY(-50%)",
            width: "50vw", height: "50vw", borderRadius: "50%", zIndex: 0,
            background: `radial-gradient(circle, ${RED}07 0%, transparent 65%)`,
            pointerEvents: "none",
          }} />

          <div style={{ position: "relative", zIndex: 2, maxWidth: "72rem", margin: "0 auto" }}>
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 420px), 1fr))",
              gap: "clamp(2rem, 5vw, 5rem)",
              alignItems: "start",
            }}>

              {/* Left - headline + CTAs */}
              <div>
                <Eyebrow>Compliance · NCAA Rules</Eyebrow>

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
                  NCAA rules{" "}
                  <span style={{ color: RED }}>reference.</span>
                </motion.h1>

                <motion.p
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.7, delay: 0.35 }}
                  style={{
                    fontFamily: "'Barlow', sans-serif",
                    fontSize: "clamp(0.95rem, 1.3vw, 1.1rem)",
                    lineHeight: 1.7, color: "rgba(255,255,255,0.55)",
                    maxWidth: "46ch", marginBottom: "clamp(1.75rem, 3.5vw, 2.5rem)",
                  }}
                >
                  Direct NCAA sources + short callouts. Built to support program-first compliance.
                </motion.p>

                {/* Pills */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.6, delay: 0.5 }}
                  style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginBottom: "clamp(1.5rem, 3vw, 2.5rem)" }}
                >
                  {[
                    { icon: <FaClipboardList />, label: "Actionable insight" },
                    { icon: <FaShieldAlt />,     label: "Defensible compliance" },
                    { icon: <FaExternalLinkAlt />, label: "Official links" },
                  ].map(p => (
                    <span key={p.label} style={{
                      display: "inline-flex", alignItems: "center", gap: "0.4rem",
                      padding: "0.35rem 0.75rem",
                      backgroundColor: "rgba(255,255,255,0.05)",
                      border: "1px solid rgba(255,255,255,0.1)",
                      fontFamily: "'Barlow Condensed', sans-serif",
                      fontSize: "0.75rem", fontWeight: 700, letterSpacing: "0.08em",
                      textTransform: "uppercase", color: "rgba(255,255,255,0.55)",
                    }}>
                      {p.icon}{p.label}
                    </span>
                  ))}
                </motion.div>

                {/* CTA buttons */}
                <motion.div
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.6 }}
                  style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem", marginBottom: "clamp(1.5rem, 3vw, 2rem)" }}
                >
                  <a
                    href="#ncaa-compliance"
                    style={{
                      display: "inline-flex", alignItems: "center", gap: "0.5rem",
                      padding: "0.9rem 1.75rem",
                      backgroundColor: ACCENT, color: BLACK,
                      fontFamily: "'Barlow Condensed', sans-serif", fontSize: "0.88rem",
                      fontWeight: 900, letterSpacing: "0.12em", textTransform: "uppercase",
                      border: "none", textDecoration: "none", transition: "filter 0.2s",
                    }}
                    onMouseEnter={e => { e.currentTarget.style.filter = "brightness(1.12)"; }}
                    onMouseLeave={e => { e.currentTarget.style.filter = "none"; }}
                  >
                    How we stay aligned
                    <FaArrowRight style={{ opacity: 0.7 }} />
                  </a>

                  <Link href="/info">
                    <span style={{
                      display: "inline-flex", alignItems: "center", gap: "0.5rem",
                      padding: "0.9rem 1.75rem", cursor: "pointer",
                      backgroundColor: "rgba(255,255,255,0.05)",
                      border: "1px solid rgba(255,255,255,0.15)",
                      color: "rgba(255,255,255,0.75)",
                      fontFamily: "'Barlow Condensed', sans-serif", fontSize: "0.88rem",
                      fontWeight: 900, letterSpacing: "0.12em", textTransform: "uppercase",
                      textDecoration: "none", transition: "filter 0.2s",
                    }}
                    onMouseEnter={e => { e.currentTarget.style.filter = "brightness(1.2)"; }}
                    onMouseLeave={e => { e.currentTarget.style.filter = "none"; }}
                    >
                      Info Hub
                      <FaArrowRight style={{ opacity: 0.7 }} />
                    </span>
                  </Link>
                </motion.div>

                {/* Quick external links */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.5, delay: 0.75 }}
                  style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginBottom: "1.25rem" }}
                >
                  <QuickLink href="https://ncaaorg.s3.amazonaws.com/compliance/d1/D1Comp_TimeDemandsInfo.pdf">
                    CARA / VARA / RARA
                  </QuickLink>
                  <QuickLink href="https://www.ncaa.org/sports/2015/6/10/ncaa-banned-substances.aspx">
                    Banned substances
                  </QuickLink>
                  <QuickLink href="https://www.ncaa.org/news/2020/5/20/di-council-allows-football-basketball-to-have-voluntary-athletics-activities-starting-june-1.aspx">
                    Voluntary guidance
                  </QuickLink>
                </motion.div>

                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.5, delay: 0.85 }}
                  style={{
                    fontFamily: "'Barlow', sans-serif", fontSize: "0.75rem",
                    color: "rgba(255,255,255,0.25)",
                  }}
                >
                  Educational use only. CheckPeak does not replace official rules, team policy, or medical/legal advice.
                </motion.p>
              </div>

              {/* Right - how to use card */}
              <motion.div
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, delay: 0.3 }}
                style={{
                  backgroundColor: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  borderTop: `3px solid ${RED}`,
                  padding: "clamp(1.25rem, 3vw, 2rem)",
                }}
              >
                <p style={{
                  fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900,
                  fontSize: "0.82rem", letterSpacing: "0.14em", textTransform: "uppercase",
                  color: "rgba(255,255,255,0.55)", marginBottom: "1rem",
                }}>
                  How to use this page
                </p>

                <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: "0.85rem", marginBottom: "1.25rem" }}>
                  {[
                    "Start with NCAA sources - links below",
                    "Use callouts to explain the \"why\" to athletes",
                    "If it's unclear: don't hesitate to ask compliance staff",
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
                        lineHeight: 1.6, color: "rgba(255,255,255,0.6)",
                      }}>
                        {item}
                      </span>
                    </li>
                  ))}
                </ul>

                <div style={{ height: "0.5px", background: "rgba(255,255,255,0.08)", marginBottom: "1rem" }} />

                <div style={{
                  padding: "0.75rem 1rem",
                  backgroundColor: "rgba(200,16,46,0.1)",
                  borderLeft: `3px solid ${RED}50`,
                }}>
                  <p style={{
                    fontFamily: "'Barlow Condensed', sans-serif", fontSize: "0.72rem",
                    fontWeight: 900, letterSpacing: "0.1em", textTransform: "uppercase",
                    color: "rgba(255,255,255,0.45)", marginBottom: "0.35rem",
                  }}>
                    Reminder
                  </p>
                  <p style={{
                    fontFamily: "'Barlow', sans-serif", fontSize: "0.85rem",
                    lineHeight: 1.6, color: "rgba(255,255,255,0.6)",
                  }}>
                    Voluntary rules apply to voluntary activity (VARA). Required or countable activities are separate.
                  </p>
                </div>
              </motion.div>

            </div>
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════════════════
            NCAA COMPLIANCE SECTION
           ══════════════════════════════════════════════════════════════════ */}
        <div
          id="ncaa-compliance"
          style={{
            backgroundColor: BLACK,
            scrollMarginTop: "calc(var(--app-header-h, 64px) + 24px)",
            position: "relative",
          }}
        >
          <Grain opacity={0.03} />
          <div style={{ position: "relative", zIndex: 2 }}>
            <ComplianceSection
              wording={wording}
              ncaaSources={sources}
              lastReviewed={NCAA_LAST_REVIEWED}
            />
          </div>
        </div>

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
            © {new Date().getFullYear()} CheckPeak · Educational use only
          </p>
        </footer>

      </div>
    </>
  );
}