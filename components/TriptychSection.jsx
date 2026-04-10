"use client";

/*
  TriptychSection.jsx  v2
  ─────────────────────────────────────────────────────────────────────────
  Three-panel editorial image section. Adidas Spezial reference.

  Key design decisions (v2):
  • ONE word "CHECKPEAK" stamped on panels 1 & 3 — repetition = brand hammer
  • Middle panel is pure image — no text, breathing room. Loud / quiet / loud.
  • Type is italic + white — bigger, more kinetic, max contrast on any image
  • Blue accent reserved only for the label chip and CTA hover
  • Proportions: 1.1fr 0.8fr 1.1fr — tighter middle feels more editorial
  • Hairline 0.5px dividers — barely there, just enough structure
  ─────────────────────────────────────────────────────────────────────────
*/

import Image from "next/image";
import { useRef } from "react";
import { motion, useInView } from "framer-motion";
import { ArrowRight } from "lucide-react";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function track(action, params = {}) {
  if (typeof window !== "undefined" && typeof window.gtag === "function") {
    window.gtag("event", action, params);
  }
}

function openAuthModal({ tab = "signup", role = "organization" } = {}) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("auth:open", { detail: { tab, role } }));
  if (typeof window.__openLoginModal === "function") {
    window.__openLoginModal({ tab, role });
  }
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------
const STYLE = `
  @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:ital,wght@0,900;1,900&family=Barlow:wght@600&display=swap');

  .cp-triptych-wrap {
    background: #080E1A;
    border-top:    0.5px solid rgba(255,255,255,0.1);
    border-bottom: 0.5px solid rgba(255,255,255,0.1);
    overflow: hidden;
  }

  .cp-triptych {
    display: grid;
    grid-template-columns: 1.1fr 0.8fr 1.1fr;
    width: 100%;
    height: 88svh;
    min-height: 520px;
    max-height: 860px;
  }

  @media (max-width: 767px) {
    .cp-triptych {
      grid-template-columns: 1fr 1fr;
      grid-template-rows: 58svh 38svh;
      height: auto;
      max-height: none;
    }
    .cp-panel-left  { grid-column: 1 / -1; grid-row: 1; }
    .cp-panel-mid   { grid-column: 1;      grid-row: 2; }
    .cp-panel-right { grid-column: 2;      grid-row: 2; }
  }

  .cp-panel {
    position: relative;
    overflow: hidden;
  }

  .cp-panel-mid,
  .cp-panel-right {
    border-left: 0.5px solid rgba(255,255,255,0.12);
  }

  @media (max-width: 767px) {
    .cp-panel-mid   { border-left: none; border-top: 0.5px solid rgba(255,255,255,0.12); }
    .cp-panel-right { border-left: 0.5px solid rgba(255,255,255,0.12); border-top: 0.5px solid rgba(255,255,255,0.12); }
  }

  .cp-panel-img {
    transition: transform 0.9s cubic-bezier(0.16, 1, 0.3, 1);
    will-change: transform;
  }
  .cp-panel:hover .cp-panel-img {
    transform: scale(1.035);
  }

  /*
    THE STAMP
    Italic = kinetic, forward motion. White = max contrast on any bg.
    Size goes up to 12vw — big enough to feel like it's fighting the image.
    Two panels, same word, same position. Repetition is the brand strategy.
  */
  .cp-stamp {
    font-family: 'Barlow Condensed', sans-serif;
    font-weight: 900;
    font-style: italic;
    font-size: clamp(4rem, 12vw, 10.5rem);
    line-height: 0.85;
    letter-spacing: -0.025em;
    text-transform: uppercase;
    color: #ffffff;
    position: absolute;
    top:  clamp(1.5rem, 3.5vw, 2.75rem);
    left: clamp(1.5rem, 3.5vw, 2.75rem);
    z-index: 10;
    pointer-events: none;
    text-shadow:
      0 1px 8px  rgba(0,0,0,0.75),
      0 4px 32px rgba(0,0,0,0.4);
  }

  @media (max-width: 767px) {
    .cp-panel-left .cp-stamp {
      font-size: clamp(3.5rem, 14vw, 6rem);
    }
    .cp-panel-right .cp-stamp {
      font-size: clamp(1.4rem, 5.5vw, 2.5rem);
      top:  0.9rem;
      left: 0.9rem;
    }
  }

  .cp-info {
    position: absolute;
    bottom: clamp(1.75rem, 3.5vw, 2.75rem);
    left:   clamp(1.5rem,  3.5vw, 2.75rem);
    z-index: 10;
  }

  .cp-info-label {
    display: inline-block;
    font-family: 'Barlow Condensed', sans-serif;
    font-size: 0.62rem;
    font-weight: 900;
    letter-spacing: 0.22em;
    text-transform: uppercase;
    color: #fff;
    background: #4FABFF;
    padding: 0.2rem 0.55rem;
    margin-bottom: 0.65rem;
  }

  .cp-info-tagline {
    font-family: 'Barlow', sans-serif;
    font-size: clamp(0.75rem, 1.1vw, 0.88rem);
    font-weight: 600;
    color: rgba(255,255,255,0.82);
    margin-bottom: 1.1rem;
    line-height: 1.5;
    max-width: 24ch;
  }

  .cp-cta {
    display: inline-flex;
    align-items: center;
    gap: 0.6rem;
    padding: 0.7rem 1.5rem;
    background: #ffffff;
    color: #080E1A;
    font-family: 'Barlow Condensed', sans-serif;
    font-size: 0.85rem;
    font-weight: 900;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    border: none;
    cursor: pointer;
    transition: background 0.2s, color 0.2s;
  }
  .cp-cta:hover {
    background: #4FABFF;
    color: #ffffff;
  }

  .cp-panel-label {
    position: absolute;
    bottom: clamp(1.75rem, 3.5vw, 2.75rem);
    right:  clamp(1.5rem,  3.5vw, 2.75rem);
    z-index: 10;
    font-family: 'Barlow Condensed', sans-serif;
    font-size: 0.6rem;
    font-weight: 900;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: rgba(255,255,255,0.42);
    text-align: right;
    line-height: 1.8;
  }

  @media (max-width: 767px) {
    .cp-panel-label { display: none; }
  }

  /* Overlay gradients */
  .cp-ov-left {
    position: absolute; inset: 0; z-index: 2;
    background:
      linear-gradient(to bottom, rgba(8,14,26,0.65) 0%, rgba(8,14,26,0.0) 35%),
      linear-gradient(to top,    rgba(8,14,26,0.8)  0%, rgba(8,14,26,0.0) 45%),
      linear-gradient(to right,  rgba(8,14,26,0.45) 0%, transparent       60%);
  }

  .cp-ov-mid {
    position: absolute; inset: 0; z-index: 2;
    background:
      linear-gradient(to bottom, rgba(8,14,26,0.5)  0%, transparent       22%),
      linear-gradient(to top,    rgba(8,14,26,0.65) 0%, transparent       40%),
      linear-gradient(to right,  rgba(8,14,26,0.4)  0%, transparent       30%),
      linear-gradient(to left,   rgba(8,14,26,0.4)  0%, transparent       30%);
  }

  .cp-ov-right {
    position: absolute; inset: 0; z-index: 2;
    background:
      linear-gradient(to bottom, rgba(8,14,26,0.65) 0%, rgba(8,14,26,0.0) 35%),
      linear-gradient(to top,    rgba(8,14,26,0.8)  0%, rgba(8,14,26,0.0) 45%),
      linear-gradient(to left,   rgba(8,14,26,0.3)  0%, transparent       50%);
  }
`;

// ---------------------------------------------------------------------------
// Panel
// ---------------------------------------------------------------------------
function Panel({ src, alt, imgPosition = "center", overlayClass, className = "", delay = 0, children }) {
  const ref    = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });

  return (
    <motion.div
      ref={ref}
      className={`cp-panel ${className}`}
      initial={{ opacity: 0 }}
      animate={inView ? { opacity: 1 } : {}}
      transition={{ duration: 1.1, delay, ease: [0.16, 1, 0.3, 1] }}
    >
      <Image
        src={src}
        alt={alt}
        fill
        quality={88}
        className="cp-panel-img"
        style={{ objectFit: "cover", objectPosition: imgPosition }}
      />
      <div className={overlayClass} aria-hidden="true" />
      {children}
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// TriptychSection
// ---------------------------------------------------------------------------
export default function TriptychSection() {
  return (
    <>
      <style>{STYLE}</style>

      <section className="cp-triptych-wrap" aria-label="CheckPeak athlete training">
        <div className="cp-triptych">

          {/* ── PANEL 1: rack / back shot ── */}
          <Panel
            src="/images/athlete-barbell-squat-rack-offseason-training.jpg"
            alt="Athlete performing barbell back squat in a dark gym"
            imgPosition="55% top"
            overlayClass="cp-ov-left"
            className="cp-panel-left"
            delay={0}
          >
            <p className="cp-stamp" aria-hidden="true">CHECK<br />PEAK</p>

            <div className="cp-info">
              <span className="cp-info-label">Athlete Platform</span>
              <p className="cp-info-tagline">
                From the offseason<br />to the opening whistle.
              </p>
              <button
                type="button"
                className="cp-cta"
                onClick={() => {
                  track("triptych_cta", { source: "panel_1" });
                  openAuthModal({ tab: "signup", role: "organization" });
                }}
              >
                Start your pilot <ArrowRight size={13} />
              </button>
            </div>
          </Panel>

          {/* ── PANEL 2: mirror / side — PURE IMAGE, no text ── */}
          <Panel
            src="/images/athlete-barbell-squat-mirror-gym-intensity.jpg"
            alt=""
            imgPosition="40% center"
            overlayClass="cp-ov-mid"
            className="cp-panel-mid"
            delay={0.12}
          />

          {/* ── PANEL 3: front-facing — stamp repeated, quiet label ── */}
          <Panel
            src="/images/college-athlete-barbell-squat-training-gym.jpg"
            alt="Athlete ready in the gym"
            imgPosition="center 25%"
            overlayClass="cp-ov-right"
            className="cp-panel-right"
            delay={0.22}
          >
            <p className="cp-stamp" aria-hidden="true">CHECK<br />PEAK</p>

            <p className="cp-panel-label">
              Workout check-ins<br />
              Nutrition targets<br />
              Supplement screening
            </p>
          </Panel>

        </div>
      </section>
    </>
  );
}