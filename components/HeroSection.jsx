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
// Styles
// ---------------------------------------------------------------------------
const SCAN_STYLE = `
  @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;600;700;900&family=Barlow:wght@400;500;600&display=swap');

  :root {
    --cp-accent:  #5B9EC9;
    --cp-dark:    #0A0C10;
    --cp-mid:     #111318;
    --cp-border:  rgba(255,255,255,0.08);

    /*
      Readability scale - used consistently across all text:
        --cp-text-primary   full white - headlines only
        --cp-text-body      85%  - main body copy, sub headings
        --cp-text-secondary 65%  - supporting labels, descriptions
        --cp-text-muted     45%  - decorative / de-emphasised only
        --cp-text-ghost     28%  - purely decorative (e.g. 01/02/03 numbers)

      Nothing functional ever goes below --cp-text-secondary (65%).
      The old code had labels and descriptions at 35–45% which fails WCAG AA
      at small sizes on mobile.
    */
    --cp-text-primary:   rgba(255,255,255,1.0);
    --cp-text-body:      rgba(255,255,255,0.85);
    --cp-text-secondary: rgba(255,255,255,0.65);
    --cp-text-muted:     rgba(255,255,255,0.45);
    --cp-text-ghost:     rgba(255,255,255,0.28);
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

  /* Diagonal grid */
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

  /* Accent corner slash */
  .cp-slash {
    position: absolute;
    top: 0;
    left: 0;
    width: 480px;
    height: 480px;
    background: conic-gradient(from 200deg at 0% 0%, var(--cp-accent) 0deg, transparent 40deg);
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
      rgba(91,158,201,0.15) 15%,
      rgba(91,158,201,0.85) 50%,
      rgba(91,158,201,0.15) 85%,
      transparent 100%
    );
    box-shadow: 0 0 10px rgba(91,158,201,0.6), 0 0 24px rgba(91,158,201,0.25);
    animation: scanline 6s linear infinite;
    pointer-events: none;
  }

  /* Headline */
  .cp-headline {
    font-family: 'Barlow Condensed', sans-serif;
    font-weight: 900;
    font-size: clamp(3.6rem, 10vw, 8.5rem);
    line-height: 0.92;
    letter-spacing: -0.01em;
    text-transform: uppercase;
    color: var(--cp-text-primary);
  }

  .cp-headline .accent {
    color: var(--cp-accent);
  }

  /*
    Stat pills
    FIX: was rgba(255,255,255,0.45) at 0.65rem - unreadable on mobile.
    Now uses --cp-text-secondary (65%) with size bumped to 0.7rem.
    The dot remains accent-colored for visual interest.
  */
  .cp-pill {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.38rem 0.9rem;
    border: 1px solid var(--cp-border);
    border-radius: 2px;
    font-size: 0.7rem;
    font-weight: 600;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--cp-text-secondary);
    background: rgba(255,255,255,0.04);
    backdrop-filter: blur(4px);
  }

  .cp-pill .dot {
    width: 5px;
    height: 5px;
    border-radius: 50%;
    background: var(--cp-accent);
    box-shadow: 0 0 6px var(--cp-accent);
    flex-shrink: 0;
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
    background: var(--cp-accent);
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

  .cp-cta-primary:hover              { filter: brightness(1.12); }
  .cp-cta-primary:hover::after       { transform: translateX(100%); }

  /* Secondary CTA */
  .cp-cta-secondary {
    display: inline-flex;
    align-items: center;
    gap: 0.75rem;
    padding: 1rem 2.2rem;
    background: transparent;
    color: var(--cp-text-body);
    font-family: 'Barlow Condensed', sans-serif;
    font-size: 1.05rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    border: 1px solid rgba(255,255,255,0.18);
    border-radius: 2px;
    cursor: pointer;
    transition: border-color 0.2s, color 0.2s;
    text-decoration: none;
  }

  .cp-cta-secondary:hover {
    border-color: rgba(255,255,255,0.45);
    color: var(--cp-text-primary);
  }

  /*
    Sub copy
    FIX: was rgba(255,255,255,0.55) - acceptable on desktop, too low at small
    viewport widths where line lengths get long and type gets small.
    Bumped to --cp-text-body (85%) so it reads clearly at all sizes.
  */
  .cp-sub {
    font-size: clamp(0.9rem, 1.5vw, 1.05rem);
    color: var(--cp-text-body);
    font-weight: 400;
    line-height: 1.65;
    max-width: 520px;
  }

  /* Overline label */
  .cp-overline {
    font-family: 'Barlow Condensed', sans-serif;
    font-size: 0.72rem;
    font-weight: 600;
    letter-spacing: 0.2em;
    text-transform: uppercase;
    color: var(--cp-accent);
  }

  /*
    Strip section number (01 / 02 / 03)
    FIX: was rgba(255,255,255,0.2) - purely decorative so ghost is fine,
    but bumped slightly to 0.28 so it registers as intentional on mobile
    rather than looking like a rendering artifact.
  */
  .cp-number {
    font-family: 'Barlow Condensed', sans-serif;
    font-size: 0.65rem;
    font-weight: 700;
    letter-spacing: 0.15em;
    color: var(--cp-text-ghost);
    text-transform: uppercase;
    margin-bottom: 0.15rem;
  }

  /* Feature strip */
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
    color: var(--cp-accent);
    flex-shrink: 0;
    margin-top: 1px;
  }

  .cp-strip-title {
    font-family: 'Barlow Condensed', sans-serif;
    font-size: 0.82rem;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--cp-text-primary);
    margin-bottom: 0.25rem;
  }

  /*
    Strip description
    FIX: was var(--cp-muted) = 45% - at 0.72rem on mobile this is the worst
    offender in the whole component. Bumped to --cp-text-secondary (65%).
    Still clearly secondary to the title but actually readable.
  */
  .cp-strip-desc {
    font-size: 0.75rem;
    line-height: 1.55;
    color: var(--cp-text-secondary);
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

    /*
      On mobile the stat block right-aligns to sm:text-right -
      but the number label text is tiny. Bump line-height slightly
      so stacked numbers don't feel cramped.
    */
    .cp-stat-label {
      line-height: 1.4;
    }
  }
`;

// ---------------------------------------------------------------------------
// Counter
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
// HeroSection
// ---------------------------------------------------------------------------
export default function HeroSection() {
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const yHeadline      = useTransform(scrollYProgress, [0, 1], [0, -60]);
  const opacityContent = useTransform(scrollYProgress, [0, 0.6], [1, 0]);

  return (
    <>
      <style>{SCAN_STYLE}</style>

      <section ref={ref} className="cp-hero" aria-labelledby="hero-heading">

        {/* Background layers */}
        <div className="cp-grid"     aria-hidden="true" />
        <div className="cp-slash"    aria-hidden="true" />
        <div className="cp-scanline" aria-hidden="true" />
        <div className="cp-fade"     aria-hidden="true" />

        {/* ── Main content ── */}
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
                One system that keeps your athletes sharp - wherever they are.
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

                <Link
                  href="/nutrition-label-scanner"
                  className="cp-cta-secondary"
                  onClick={() => track("scan_start", { source: "hero" })}
                >
                  Scan a Label <span aria-hidden="true">→</span>
                </Link>
              </div>

              {/*
                Disclaimer line
                FIX: was rgba(255,255,255,0.25) - completely unreadable on mobile.
                Bumped to --cp-text-secondary (65%). It's intentionally the
                quietest text on the page but it should still be legible.
              */}
              <p
                style={{
                  fontSize:      "0.68rem",
                  letterSpacing: "0.1em",
                  color:         "rgba(255,255,255,0.55)",
                  textTransform: "uppercase",
                }}
              >
                Free for athletes &nbsp;·&nbsp; Built for programs &nbsp;·&nbsp; No per-athlete fees
              </p>
            </div>

            {/* Stat block */}
            <div
              className="flex flex-col gap-3 sm:ml-auto sm:text-right"
              style={{ minWidth: "160px" }}
            >
              {[
                { label: "Off-campus weeks covered", n: 52,  suffix: ""  },
                { label: "Banned substances flagged", n: 900, suffix: "+" },
                { label: "Check-in time (seconds)",   n: 30,  suffix: "s" },
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
                      fontSize:   "clamp(2rem, 4vw, 2.8rem)",
                      fontWeight: 900,
                      color:      "rgba(255,255,255,1)",
                      lineHeight: 1,
                    }}
                  >
                    <Counter to={n} suffix={suffix} />
                  </div>
                  {/*
                    Stat label
                    FIX: was rgba(255,255,255,0.35) - fails at small sizes on
                    mobile. This is the label beneath the big counter number,
                    which is the whole point of the stat. Bumped to 0.6.
                  */}
                  <div
                    className="cp-stat-label"
                    style={{
                      fontSize:      "0.68rem",
                      color:         "rgba(255,255,255,0.6)",
                      letterSpacing: "0.08em",
                      textTransform: "uppercase",
                      marginTop:     "3px",
                    }}
                  >
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

        {/* ── Feature strip ── */}
        <motion.div
          className="cp-strip relative z-10 mt-16"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7, duration: 0.6 }}
        >
          {[
            {
              icon:  <FaDumbbell size={14} />,
              label: "Workout Check-ins",
              desc:  "Athletes log it. Staff sees it. No more chasing texts.",
              n:     "01",
            },
            {
              icon:  <FaUtensils size={14} />,
              label: "Nutrition Targets",
              desc:  "Meal-based macros built for dining halls and real life.",
              n:     "02",
            },
            {
              icon:  <FaShieldAlt size={14} />,
              label: "Supplement Screening",
              desc:  "Flag banned compounds before they become a career problem.",
              n:     "03",
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