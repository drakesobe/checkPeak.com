"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import Link from "next/link";
import { FaShieldAlt, FaDumbbell, FaUtensils } from "react-icons/fa";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function track(action, params = {}) {
  if (typeof window !== "undefined" && typeof window.gtag === "function") {
    window.gtag("event", action, params);
  }
}

function openAuthModal(opts = {}) {
  const { tab = "signup", role = "organization" } = opts;
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("auth:open", { detail: { tab, role } }));
  if (typeof window.__openLoginModal === "function") {
    window.__openLoginModal({ tab, role });
  }
}

// ---------------------------------------------------------------------------
// Animated diagonal scan line — pure CSS via inline keyframes
// ---------------------------------------------------------------------------
const SCAN_STYLE = `
  @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;600;700;900&family=Barlow:wght@400;500;600&display=swap');

  :root {
    --cp-red:    #5B9EC9;
    --cp-dark:   #0A0C10;
    --cp-mid:    #111318;
    --cp-border: rgba(255,255,255,0.07);
    --cp-muted:  rgba(255,255,255,0.45);
  }

  .cp-hero {
    font-family: 'Barlow', sans-serif;
    background: var(--cp-dark);
    position: relative;
    overflow: hidden;
    min-height: 100svh;
    display: flex;
    flex-direction: column;
    justify-content: center;
  }

  /* Diagonal grid lines — no JS needed */
  .cp-grid {
    position: absolute;
    inset: 0;
    background-image:
      repeating-linear-gradient(
        -55deg,
        transparent,
        transparent 80px,
        rgba(255,255,255,0.025) 80px,
        rgba(255,255,255,0.025) 81px
      );
    pointer-events: none;
  }

  /* Red accent corner slash */
  .cp-slash {
    position: absolute;
    top: 0;
    left: 0;
    width: 480px;
    height: 480px;
    background: conic-gradient(from 200deg at 0% 0%, var(--cp-red) 0deg, transparent 40deg);
    opacity: 0.18;
    pointer-events: none;
    filter: blur(1px);
  }

  /* Bottom gradient fade */
  .cp-fade {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    height: 220px;
    background: linear-gradient(to bottom, transparent, var(--cp-dark));
    pointer-events: none;
  }

  /* Scan line sweep */
  @keyframes scanline {
    0%   { transform: translateY(-100%); opacity: 0; }
    10%  { opacity: 1; }
    90%  { opacity: 1; }
    100% { transform: translateY(200vh); opacity: 0; }
  }

  .cp-scanline {
    position: absolute;
    left: 0;
    right: 0;
    height: 2px;
    background: linear-gradient(
      to right,
      transparent 0%,
      rgba(91, 158, 201, 0.15) 15%,
      rgba(91, 158, 201, 0.85) 50%,
      rgba(91, 158, 201, 0.15) 85%,
      transparent 100%
    );
    box-shadow: 0 0 10px rgba(91, 158, 201, 0.6), 0 0 24px rgba(91, 158, 201, 0.25);
    animation: scanline 6s linear infinite;
    pointer-events: none;
  }

  /* Headline font */
  .cp-headline {
    font-family: 'Barlow Condensed', sans-serif;
    font-weight: 900;
    font-size: clamp(3.6rem, 10vw, 8.5rem);
    line-height: 0.92;
    letter-spacing: -0.01em;
    text-transform: uppercase;
    color: #fff;
  }

  .cp-headline .accent {
    color: var(--cp-red);
  }

  /* Stat pills */
  .cp-pill {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.35rem 0.85rem;
    border: 1px solid var(--cp-border);
    border-radius: 2px;
    font-size: 0.65rem;
    font-weight: 600;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--cp-muted);
    background: rgba(255,255,255,0.03);
    backdrop-filter: blur(4px);
  }

  .cp-pill .dot {
    width: 5px;
    height: 5px;
    border-radius: 50%;
    background: var(--cp-red);
    box-shadow: 0 0 6px var(--cp-red);
    animation: pulse-dot 2s ease-in-out infinite;
  }

  @keyframes pulse-dot {
    0%, 100% { opacity: 1; }
    50%       { opacity: 0.3; }
  }

  /* Primary CTA */
  .cp-cta-primary {
    display: inline-flex;
    align-items: center;
    gap: 0.75rem;
    padding: 1rem 2.2rem;
    background: var(--cp-red);
    color: #fff;
    font-family: 'Barlow Condensed', sans-serif;
    font-size: 1.05rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    border: none;
    border-radius: 2px;
    cursor: pointer;
    position: relative;
    overflow: hidden;
    transition: filter 0.2s;
  }

  .cp-cta-primary::after {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(120deg, transparent 30%, rgba(255,255,255,0.15) 50%, transparent 70%);
    transform: translateX(-100%);
    transition: transform 0.4s;
  }

  .cp-cta-primary:hover { filter: brightness(1.12); }
  .cp-cta-primary:hover::after { transform: translateX(100%); }

  /* Secondary CTA */
  .cp-cta-secondary {
    display: inline-flex;
    align-items: center;
    gap: 0.75rem;
    padding: 1rem 2.2rem;
    background: transparent;
    color: rgba(255,255,255,0.75);
    font-family: 'Barlow Condensed', sans-serif;
    font-size: 1.05rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    border: 1px solid rgba(255,255,255,0.15);
    border-radius: 2px;
    cursor: pointer;
    transition: border-color 0.2s, color 0.2s;
    text-decoration: none;
  }

  .cp-cta-secondary:hover {
    border-color: rgba(255,255,255,0.4);
    color: #fff;
  }

  /* Feature strip at bottom */
  .cp-strip {
    border-top: 1px solid var(--cp-border);
    display: grid;
    grid-template-columns: repeat(3, 1fr);
  }

  .cp-strip-item {
    padding: 1.4rem 1.8rem;
    border-right: 1px solid var(--cp-border);
    display: flex;
    align-items: flex-start;
    gap: 0.9rem;
  }

  .cp-strip-item:last-child { border-right: none; }

  .cp-strip-icon {
    width: 36px;
    height: 36px;
    border: 1px solid var(--cp-border);
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 2px;
    color: var(--cp-red);
    flex-shrink: 0;
    margin-top: 1px;
  }

  .cp-strip-title {
    font-family: 'Barlow Condensed', sans-serif;
    font-size: 0.8rem;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: #fff;
    margin-bottom: 0.2rem;
  }

  .cp-strip-desc {
    font-size: 0.72rem;
    line-height: 1.5;
    color: var(--cp-muted);
  }

  /* Sub copy */
  .cp-sub {
    font-size: clamp(0.9rem, 1.5vw, 1.05rem);
    color: rgba(255,255,255,0.55);
    font-weight: 400;
    line-height: 1.6;
    max-width: 520px;
  }

  /* Overline label */
  .cp-overline {
    font-family: 'Barlow Condensed', sans-serif;
    font-size: 0.7rem;
    font-weight: 600;
    letter-spacing: 0.2em;
    text-transform: uppercase;
    color: var(--cp-red);
  }

  /* Number accent */
  .cp-number {
    font-family: 'Barlow Condensed', sans-serif;
    font-size: 0.65rem;
    font-weight: 700;
    letter-spacing: 0.15em;
    color: rgba(255,255,255,0.2);
    text-transform: uppercase;
  }

  /* Responsive strip */
  @media (max-width: 768px) {
    .cp-strip {
      grid-template-columns: 1fr;
    }
    .cp-strip-item {
      border-right: none;
      border-bottom: 1px solid var(--cp-border);
    }
    .cp-strip-item:last-child {
      border-bottom: none;
    }
    .cp-headline {
      font-size: clamp(3rem, 14vw, 5rem);
    }
  }
`;

// ---------------------------------------------------------------------------
// Animated counter (runs once on mount)
// ---------------------------------------------------------------------------
function Counter({ to, suffix = "" }) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    let start = 0;
    const step = Math.ceil(to / 40);
    const id = setInterval(() => {
      start += step;
      if (start >= to) { setVal(to); clearInterval(id); }
      else setVal(start);
    }, 30);
    return () => clearInterval(id);
  }, [to]);
  return <>{val}{suffix}</>;
}

// ---------------------------------------------------------------------------
// Hero Section
// ---------------------------------------------------------------------------
export default function HeroSection() {
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const yHeadline = useTransform(scrollYProgress, [0, 1], [0, -60]);
  const opacityContent = useTransform(scrollYProgress, [0, 0.6], [1, 0]);

  return (
    <>
      <style>{SCAN_STYLE}</style>

      <section ref={ref} className="cp-hero" aria-labelledby="hero-heading">

        {/* Background layers */}
        <div className="cp-grid" aria-hidden="true" />
        <div className="cp-slash" aria-hidden="true" />
        <div className="cp-scanline" aria-hidden="true" />
        <div className="cp-fade" aria-hidden="true" />

        {/* ── MAIN CONTENT ── */}
        <motion.div
          style={{ opacity: opacityContent }}
          className="relative z-10 max-w-6xl mx-auto px-6 sm:px-10 pt-24 pb-0 w-full"
        >
          {/* Overline */}
          <motion.p
            className="cp-overline mb-5"
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5 }}
          >
            Athlete Performance Platform
          </motion.p>

          {/* Headline */}
          <motion.h1
            id="hero-heading"
            className="cp-headline"
            style={{ y: yHeadline }}
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.65, ease: [0.16, 1, 0.3, 1] }}
          >
            No excuses.<br />
            <span className="accent">No drift.</span><br />
            No guessing.
          </motion.h1>

          {/* Sub copy + CTAs */}
          <motion.div
            className="mt-8 flex flex-col sm:flex-row gap-10 items-start"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25, duration: 0.6 }}
          >
            <div className="flex flex-col gap-6 max-w-lg">
              <p className="cp-sub">
                Workout check-ins. Nutrition targets. Supplement screening.
                One system that keeps your athletes sharp — wherever they are.
              </p>

              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  className="cp-cta-primary"
                  onClick={() => {
                    track("cta_auth_open", { source: "hero", tab: "signup", role: "organization" });
                    openAuthModal();
                  }}
                  aria-label="Get started with CheckPeak"
                >
                  Get Started <span aria-hidden="true">→</span>
                </button>

                <Link href="/nutrition-label-scanner" className="cp-cta-secondary" onClick={() => track("scan_start", { source: "hero" })}>
                  Scan a Label <span aria-hidden="true">→</span>
                </Link>
              </div>

              <p style={{ fontSize: "0.65rem", letterSpacing: "0.1em", color: "rgba(255,255,255,0.25)", textTransform: "uppercase" }}>
                Free for athletes &nbsp;·&nbsp; Built for programs &nbsp;·&nbsp; No per-athlete fees
              </p>
            </div>

            {/* Live-ish stat block */}
            <div
              className="flex flex-col gap-3 sm:ml-auto sm:text-right"
              style={{ minWidth: "160px" }}
            >
              {[
                { label: "Off-campus weeks covered", n: 52, suffix: "" },
                { label: "Banned substances flagged", n: 300, suffix: "+" },
                { label: "Check-in time (seconds)", n: 30, suffix: "s" },
              ].map(({ label, n, suffix }, i) => (
                <motion.div
                  key={label}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.4 + i * 0.1, duration: 0.5 }}
                >
                  <div
                    style={{
                      fontFamily: "'Barlow Condensed', sans-serif",
                      fontSize: "clamp(2rem, 4vw, 2.8rem)",
                      fontWeight: 900,
                      color: "#fff",
                      lineHeight: 1,
                    }}
                  >
                    <Counter to={n} suffix={suffix} />
                  </div>
                  <div style={{ fontSize: "0.65rem", color: "rgba(255,255,255,0.35)", letterSpacing: "0.08em", textTransform: "uppercase", marginTop: "2px" }}>
                    {label}
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* Status pills */}
          <motion.div
            className="mt-10 flex flex-wrap gap-2"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.55, duration: 0.5 }}
          >
            {[
              "Workout accountability",
              "Meal-based nutrition",
              "Label screening",
              "Staff review queue",
              "Weekly summaries",
            ].map((label) => (
              <span key={label} className="cp-pill">
                <span className="dot" aria-hidden="true" />
                {label}
              </span>
            ))}
          </motion.div>
        </motion.div>

        {/* ── BOTTOM FEATURE STRIP ── */}
        <motion.div
          className="cp-strip relative z-10 mt-16"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7, duration: 0.6 }}
        >
          {[
            {
              icon: <FaDumbbell size={14} />,
              label: "Workout Check-ins",
              desc: "Athletes log it. Staff sees it. No more chasing texts.",
              n: "01",
            },
            {
              icon: <FaUtensils size={14} />,
              label: "Nutrition Targets",
              desc: "Meal-based macros built for dining halls and real life.",
              n: "02",
            },
            {
              icon: <FaShieldAlt size={14} />,
              label: "Supplement Screening",
              desc: "Flag banned compounds before they become a career problem.",
              n: "03",
            },
          ].map(({ icon, label, desc, n }) => (
            <div key={label} className="cp-strip-item">
              <div className="cp-strip-icon" aria-hidden="true">{icon}</div>
              <div>
                <p className="cp-number">{n}</p>
                <p className="cp-strip-title">{label}</p>
                <p className="cp-strip-desc">{desc}</p>
              </div>
            </div>
          ))}
        </motion.div>

      </section>
    </>
  );
}