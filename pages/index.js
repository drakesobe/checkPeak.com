// pages/index.js
"use client";

import Head from "next/head";
import Image from "next/image";
import TriptychSection from "@/components/TriptychSection";
import { useRef, useState, useEffect } from "react";
import { motion, useInView, useScroll, useTransform } from "framer-motion";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const ACCENT = "#4FABFF";
const BLACK  = "#060810";
const WHITE  = "#FFFFFF";

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
// Global styles
// FIX: cursor:none scoped to (pointer:fine) only — desktop mice.
//      Mobile touch devices keep their default tap indicator.
// FIX: Added .sm-show rule so product mock nav tabs appear on wider screens.
// ---------------------------------------------------------------------------
const GLOBAL_STYLE = `
  @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:ital,wght@0,400;0,700;0,900;1,900&family=Barlow:wght@400;500;600&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  html { scroll-behavior: smooth; }

  /* Cursor — desktop pointer devices only, never mobile */
  @media (pointer: fine) {
    body, a, button { cursor: none; }
  }

  #cp-cursor {
    display: none;
  }

  @media (pointer: fine) {
    #cp-cursor {
      display: block;
      position: fixed;
      top: 0; left: 0;
      width: 10px; height: 10px;
      background: ${WHITE};
      border-radius: 50%;
      pointer-events: none;
      z-index: 9999;
      transform: translate(-50%, -50%);
      transition: width 0.22s, height 0.22s;
      mix-blend-mode: difference;
    }
    #cp-cursor.hovering {
      width: 44px;
      height: 44px;
    }
  }

  /* Declaration beats — full viewport on desktop, compact on mobile */
  .declaration-beat { min-height: 100svh; }
  @media (max-width: 767px) {
    .declaration-beat {
      min-height: 0;
      padding-top: 4rem;
      padding-bottom: 4rem;
    }
  }

  /* Product mock nav tabs — shown on wider screens */
  .sm-show { display: none; }
  @media (min-width: 640px) {
    .sm-show { display: block; }
  }

  /* Proof stats right column — desktop only */
  .proof-stats-col { display: none !important; }
  @media (min-width: 900px) {
    .proof-stats-col { display: flex !important; }
  }

  /* Hero nav — hide on small screens to avoid crowding wordmark */
  .hero-nav { display: none; }
  @media (min-width: 540px) {
    .hero-nav { display: flex; }
  }
`;

// ---------------------------------------------------------------------------
// Grain overlay — SVG noise, same technique as A24/Nike editorial pages
// ---------------------------------------------------------------------------
const GRAIN_URL = `url("data:image/svg+xml,%3Csvg viewBox='0 0 512 512' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`;

// ---------------------------------------------------------------------------
// Custom cursor — desktop only
// ---------------------------------------------------------------------------
function Cursor() {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const move = (e) => { el.style.left = e.clientX + "px"; el.style.top = e.clientY + "px"; };
    const addH = () => el.classList.add("hovering");
    const rmH  = () => el.classList.remove("hovering");
    window.addEventListener("mousemove", move);
    const targets = document.querySelectorAll("a, button");
    targets.forEach(t => { t.addEventListener("mouseenter", addH); t.addEventListener("mouseleave", rmH); });
    return () => {
      window.removeEventListener("mousemove", move);
      targets.forEach(t => { t.removeEventListener("mouseenter", addH); t.removeEventListener("mouseleave", rmH); });
    };
  }, []);
  return <div id="cp-cursor" ref={ref} aria-hidden="true" />;
}

// ---------------------------------------------------------------------------
// CTA button
// FIX: min font-size lifted to 1rem on lg, 0.92rem on md — readable on all screens
// ---------------------------------------------------------------------------
function PilotButton({ source, size = "md" }) {
  const lg = size === "lg";
  return (
    <button
      type="button"
      onClick={() => { track("cta_pilot_request", { source }); openAuthModal(); }}
      style={{
        display:       "inline-flex",
        alignItems:    "center",
        gap:           lg ? "0.85rem" : "0.65rem",
        padding:       lg ? "1.1rem 2.5rem" : "0.9rem 2rem",
        background:    ACCENT,
        color:         BLACK,
        fontFamily:    "'Barlow Condensed', sans-serif",
        fontSize:      lg ? "1.05rem" : "0.92rem",
        fontWeight:    900,
        letterSpacing: "0.12em",
        textTransform: "uppercase",
        border:        "none",
        transition:    "filter 0.2s",
      }}
      onMouseEnter={e => { e.currentTarget.style.filter = "brightness(1.15)"; }}
      onMouseLeave={e => { e.currentTarget.style.filter = "none"; }}
    >
      START YOUR PILOT
      <svg width={lg ? 18 : 15} height={lg ? 18 : 15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <line x1="5" y1="12" x2="19" y2="12"/>
        <polyline points="12 5 19 12 12 19"/>
      </svg>
    </button>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   1. HERO
   FIX: Nav hidden on < 540px to avoid crowding wordmark
   FIX: Disclaimer opacity 0.35 → 0.55 and size 0.68rem → 0.78rem
   FIX: "Scroll" label opacity 0.25 → 0.45, size 0.58rem → 0.72rem
   FIX: Scroll opacity parallax starts fading later [0, 0.6] not [0, 0.5]
        so content is fully readable while still in viewport
══════════════════════════════════════════════════════════════════════════ */
function Hero() {
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const bgY     = useTransform(scrollYProgress, [0, 1], ["0%", "20%"]);
  const opacity = useTransform(scrollYProgress, [0, 0.6], [1, 0]);

  return (
    <section ref={ref} style={{
      position:       "relative",
      width:          "100%",
      height:         "100svh",
      minHeight:      "580px",
      overflow:       "hidden",
      background:     BLACK,
      display:        "flex",
      alignItems:     "center",
      justifyContent: "center",
    }}>
      {/* Background */}
      <motion.div style={{ position: "absolute", top: "-10%", left: 0, right: 0, bottom: "-10%", y: bgY }} aria-hidden="true">
        <style>{`
          .hero-video {
            width: 100%; height: 100%;
            object-fit: cover;
            /* Mobile: true center — no horizontal shift */
            object-position: center center;
          }
          /* Desktop only: nudge right slightly to favour the subject */
          @media (min-width: 768px) {
            .hero-video { object-position: 55% center; }
          }
        `}</style>
        <video autoPlay muted loop playsInline
          className="hero-video"
          poster="/images/athlete-barbell-squat-rack-offseason-training.jpg"
        >
          <source src="/video/hero-loop.mp4" type="video/mp4" />
        </video>
        <div style={{ position: "absolute", inset: 0, background: "rgba(6,8,16,0.62)" }} />
        <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse 80% 80% at 50% 50%, transparent 30%, rgba(6,8,16,0.5) 100%)" }} />
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: "35%", background: `linear-gradient(to bottom, transparent, ${BLACK})` }} />
      </motion.div>

      {/* Wordmark top-left */}
      <motion.div initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.7, delay: 0.2 }}
        style={{ position: "absolute", top: "clamp(1.25rem, 3vw, 2rem)", left: "clamp(1.25rem, 4vw, 2.5rem)", zIndex: 10 }}
      >
        <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "clamp(1rem, 2vw, 1.35rem)", fontWeight: 900, letterSpacing: "0.18em", textTransform: "uppercase", color: WHITE }}>
          Check<span style={{ color: ACCENT }}>Peak</span>
        </p>
      </motion.div>

      {/* Nav — hidden on mobile via .hero-nav */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.7, delay: 0.6 }}
        className="hero-nav"
        style={{ position: "absolute", top: "clamp(1.25rem, 3vw, 2rem)", right: "clamp(1.25rem, 4vw, 2.5rem)", zIndex: 10, gap: "1.75rem" }}
      >
        {[
          {
            label: "How it works",
            action: () => {
              track("nav_click", { label: "How it works" });
              document.getElementById("how-it-works")?.scrollIntoView({ behavior: "smooth" });
            },
          },
          {
            label: "For athletes",
            action: () => {
              track("nav_click", { label: "For athletes" });
              window.location.href = "/nutrition-label-scanner";
            },
          },
        ].map(({ label, action }) => (
          <button key={label} type="button" onClick={action}
            style={{
              fontFamily: "'Barlow Condensed', sans-serif",
              fontSize:   "0.78rem",   // FIX: was 0.7rem
              fontWeight: 700,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color:      "rgba(255,255,255,0.6)",  // FIX: was 0.5
              background: "none", border: "none", padding: 0, transition: "color 0.18s",
            }}
            onMouseEnter={e => { e.currentTarget.style.color = WHITE; }}
            onMouseLeave={e => { e.currentTarget.style.color = "rgba(255,255,255,0.6)"; }}
          >{label}</button>
        ))}
      </motion.div>

      {/* Center headline */}
      <motion.div style={{ opacity, position: "relative", zIndex: 10, textAlign: "center", padding: "0 clamp(1.25rem, 5vw, 3rem)" }}>
        <motion.h1
          initial={{ opacity: 0, y: 32 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, delay: 0.35, ease: [0.16, 1, 0.3, 1] }}
          style={{
            fontFamily:    "'Barlow Condensed', sans-serif",
            fontWeight:    900,
            fontStyle:     "italic",
            fontSize:      "clamp(2.5rem, 8vw, 8rem)",
            lineHeight:    0.9,
            letterSpacing: "-0.02em",
            textTransform: "uppercase",
            color:         WHITE,
            marginBottom:  "clamp(1.75rem, 4vw, 3.5rem)",
            textShadow:    "0 2px 40px rgba(0,0,0,0.6)",
          }}
        >
          Stop guessing<br />
          <span style={{ color: ACCENT }}></span>
        </motion.h1>

        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.7 }}>
          <PilotButton source="hero" size="lg" />
        </motion.div>

        {/* FIX: opacity 0.35 → 0.6, size 0.68rem → 0.78rem */}
        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.6, delay: 1.1 }}
          style={{ marginTop: "1.1rem", fontFamily: "'Barlow', sans-serif", fontSize: "0.78rem", letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.6)" }}
        >
          30 days free · No card required
        </motion.p>
      </motion.div>

      {/* Scroll indicator */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.4, duration: 0.8 }}
        style={{ position: "absolute", bottom: "clamp(1.25rem, 3vw, 2rem)", left: "50%", transform: "translateX(-50%)", zIndex: 10, display: "flex", flexDirection: "column", alignItems: "center", gap: "0.5rem" }}
      >
        {/* FIX: opacity 0.25 → 0.45, size 0.58rem → 0.72rem */}
        <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "0.72rem", fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase", color: "rgba(255,255,255,0.45)" }}>
          Scroll
        </p>
        <div style={{ width: "1px", height: "36px", background: "rgba(255,255,255,0.2)", position: "relative", overflow: "hidden" }}>
          <motion.div style={{ position: "absolute", top: 0, left: 0, width: "100%", background: "rgba(255,255,255,0.7)" }}
            animate={{ height: ["0%", "100%"] }}
            transition={{ duration: 1.2, repeat: Infinity, ease: "linear", repeatDelay: 0.3 }}
          />
        </div>
      </motion.div>
    </section>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   2. DECLARATIONS
   Three full-viewport beats with ghost images, grain, and structure.

   FIX: Vertical padding reduced from clamp(6rem, 12vw, 10rem)
        to clamp(3.5rem, 8vw, 8rem) — content was cut off on phones.
   FIX: Beat 2 (3 lines) gets its own smaller font clamp so three stacked
        lines don't overflow a 390px viewport.
   FIX: Footnote opacity 0.42 → 0.6, size min 0.82rem → 0.95rem.
   FIX: Section counter opacity 0.2 → 0.35, size 0.58rem → 0.72rem.
   FIX: Watermark hidden on mobile — it clips and looks broken on phones.
══════════════════════════════════════════════════════════════════════════ */
const BEAT_IMAGES = [
  "/images/athlete-barbell-squat-rack-offseason-training.jpg",
  "/images/athlete-barbell-squat-mirror-gym-intensity.jpg",
  "/images/college-athlete-barbell-squat-training-gym.jpg",
];
const BEAT_WATERMARKS = ["OFFSEASON", "PROGRAMS", "KNOW"];

function DeclarationBeat({ lines, footnote, isClimax = false, index, bgImage, watermark, threeLines = false }) {
  const ref    = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-10%" });

  /*
    Font size strategy:
    - Normal 2-line beat: clamp(4rem, 13vw, 15rem)
    - 3-line beat: clamp(3rem, 10vw, 12rem) — smaller min so all 3 lines
      fit on a 390px phone without overflowing
    - Climax ("You / will."): clamp(6rem, 22vw, 20rem)
  */
  const fontSize = isClimax
    ? "clamp(6rem, 22vw, 20rem)"
    : threeLines
      ? "clamp(3rem, 10vw, 12rem)"
      : "clamp(4rem, 13vw, 15rem)";

  return (
    <section ref={ref} className="declaration-beat" style={{
      width:          "100%",
      minHeight:      "100svh",
      background:     BLACK,
      display:        "flex",
      flexDirection:  "column",
      alignItems:     "flex-start",
      justifyContent: "center",
      padding:        `clamp(3.5rem, 8vw, 8rem) clamp(1.25rem, 8vw, 8rem)`,
      position:       "relative",
      overflow:       "hidden",
      borderTop:      "0.5px solid rgba(255,255,255,0.08)",
    }}>
      {/* Ghost photograph */}
      {bgImage && (
        <div aria-hidden="true" style={{ position: "absolute", inset: 0, zIndex: 0 }}>
          <Image src={bgImage} alt="" fill quality={40} style={{
            objectFit:      "cover",
            objectPosition: isClimax ? "center 25%" : "60% center",
            opacity:        isClimax ? 0.08 : 0.06,
            filter:         "blur(4px) brightness(0.45) grayscale(0.3)",
          }} />
          <div style={{
            position: "absolute", inset: 0,
            background: `linear-gradient(to right, ${BLACK} 0%, rgba(6,8,16,0.75) 55%, rgba(6,8,16,0.5) 100%),
                         linear-gradient(to bottom, ${BLACK} 0%, transparent 18%, transparent 82%, ${BLACK} 100%)`,
          }} />
        </div>
      )}

      {/* Film grain */}
      <div aria-hidden="true" style={{
        position: "absolute", inset: 0, zIndex: 1,
        backgroundImage: GRAIN_URL, backgroundRepeat: "repeat", backgroundSize: "256px 256px",
        opacity: 0.04, mixBlendMode: "screen", pointerEvents: "none",
      }} />

      {/* Left accent line */}
      <motion.div aria-hidden="true"
        initial={{ scaleY: 0 }} animate={inView ? { scaleY: 1 } : {}}
        transition={{ duration: 1.2, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
        style={{
          position: "absolute", left: 0, top: "15%", bottom: "15%", width: "2px",
          background: isClimax
            ? `linear-gradient(to bottom, transparent, ${ACCENT}, transparent)`
            : `linear-gradient(to bottom, transparent, rgba(255,255,255,0.18), transparent)`,
          zIndex: 2, transformOrigin: "top",
        }}
      />

      {/* Ghost watermark — hidden on mobile via inline media query trick:
          we use a max font-size that collapses on small screens */}
      {watermark && (
        <div aria-hidden="true" style={{
          position:         "absolute",
          right:            "-2vw",
          top:              "50%",
          transform:        "translateY(-50%)",
          zIndex:           1,
          fontFamily:       "'Barlow Condensed', sans-serif",
          fontWeight:       900,
          fontStyle:        "italic",
          // FIX: min 0 so it collapses to nothing on very small screens
          fontSize:         "clamp(0rem, 30vw, 36rem)",
          lineHeight:       0.85,
          letterSpacing:    "-0.04em",
          textTransform:    "uppercase",
          WebkitTextStroke: "1px rgba(255,255,255,0.04)",
          color:            "transparent",
          userSelect:       "none",
          pointerEvents:    "none",
          whiteSpace:       "nowrap",
        }}>
          {watermark}
        </div>
      )}

      {/* Content */}
      <div style={{ position: "relative", zIndex: 3, width: "100%" }}>

        {/* Section counter */}
        <motion.div initial={{ opacity: 0, x: -8 }} animate={inView ? { opacity: 1, x: 0 } : {}} transition={{ duration: 0.5 }}
          style={{ display: "flex", alignItems: "center", gap: "0.85rem", marginBottom: "clamp(1.5rem, 3.5vw, 2.5rem)" }}
        >
          <motion.div initial={{ scaleX: 0 }} animate={inView ? { scaleX: 1 } : {}} transition={{ duration: 0.8, delay: 0.05 }}
            style={{ width: "clamp(1.5rem, 4vw, 3rem)", height: "0.5px", background: "rgba(255,255,255,0.25)", transformOrigin: "left" }}
          />
          {/* FIX: opacity 0.2→0.38, size 0.58rem→0.72rem */}
          <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "0.72rem", fontWeight: 900, letterSpacing: "0.2em", textTransform: "uppercase", color: "rgba(255,255,255,0.38)" }}>
            {String(index + 1).padStart(2, "0")} / 03
          </span>
        </motion.div>

        {/* Declaration lines */}
        <div>
          {lines.map((line, li) => (
            <motion.p key={li}
              initial={{ opacity: 0, y: 48, skewY: 2 }}
              animate={inView ? { opacity: 1, y: 0, skewY: 0 } : {}}
              transition={{ duration: 0.9, delay: li * 0.13, ease: [0.16, 1, 0.3, 1] }}
              style={{
                fontFamily:    "'Barlow Condensed', sans-serif",
                fontWeight:    900,
                fontStyle:     "italic",
                fontSize,
                lineHeight:    0.88,
                letterSpacing: "-0.03em",
                textTransform: "uppercase",
                color:         line.accent ? ACCENT : WHITE,
                display:       "block",
                textShadow:    "0 2px 60px rgba(0,0,0,0.8)",
              }}
            >
              {line.text}
            </motion.p>
          ))}
        </div>

        {/* Footnote — FIX: opacity 0.42→0.6, size min 0.82rem→0.95rem */}
        {footnote && (
          <motion.div
            initial={{ opacity: 0, y: 16 }} animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.7, delay: lines.length * 0.13 + 0.35 }}
            style={{ marginTop: "clamp(2rem, 4vw, 3.5rem)", paddingLeft: "1.25rem", borderLeft: "1.5px solid rgba(255,255,255,0.18)", maxWidth: "44ch" }}
          >
            <p style={{ fontFamily: "'Barlow', sans-serif", fontSize: "clamp(0.95rem, 1.2vw, 1.05rem)", fontWeight: 400, lineHeight: 1.7, color: "rgba(255,255,255,0.62)" }}>
              {footnote}
            </p>
          </motion.div>
        )}
      </div>

      {/* Brand mark bottom-right — decorative only, stays dim */}
      <div aria-hidden="true" style={{
        position: "absolute", bottom: "clamp(1rem, 2vw, 1.5rem)", right: "clamp(1rem, 3vw, 2rem)", zIndex: 3,
        fontFamily: "'Barlow Condensed', sans-serif", fontSize: "0.62rem", fontWeight: 900,
        letterSpacing: "0.18em", textTransform: "uppercase", color: "rgba(255,255,255,0.1)",
      }}>
        CheckPeak
      </div>
    </section>
  );
}

// Beats are now rendered individually in the page so other sections
// can be interleaved between them. TriptychSection sits after beat 1.
const BEATS = [
  { lines: [{ text: "The offseason" }, { text: "doesn't lie." }], footnote: "You send athletes home and hope. Hope they stay sharp. Hope nobody takes something stupid. Hope camp isn't the first time you find out who put the work in.", isClimax: false, threeLines: false },
  { lines: [{ text: "Your athletes" }, { text: "know it." }], footnote: null, isClimax: false, threeLines: false },
  { lines: [{ text: "Now" }, { text: "you will.", accent: true }], footnote: null, isClimax: true, threeLines: false },
];

/* ══════════════════════════════════════════════════════════════════════════
   4. PROOF MOMENT
   FIX: Grid collapses to single column on mobile via flexbox + media query
   FIX: Eyebrow opacity 0.22→0.42, size 0.58rem→0.75rem
   FIX: Context text opacity 0.4→0.62, size min 0.82rem→0.95rem
   FIX: Supporting stat labels opacity 0.35→0.55
   FIX: Supporting stat sub-text opacity 0.22→0.45
   FIX: The 94% number uses clamp with reasonable mobile min (6rem)
══════════════════════════════════════════════════════════════════════════ */
function ProofMoment() {
  const ref    = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-10%" });

  const [val, setVal] = useState(0);
  useEffect(() => {
    if (!inView) return;
    let start = 0;
    const id = setInterval(() => {
      start += 2;
      if (start >= 94) { setVal(94); clearInterval(id); }
      else setVal(start);
    }, 18);
    return () => clearInterval(id);
  }, [inView]);

  const supportingStats = [
    { n: "52",   label: "Weeks",     sub: "of year-round coverage"       },
    { n: "30s",  label: "Check-in",  sub: "one tap, athletes stay moving" },
    { n: "900+", label: "Compounds", sub: "flagged in our database"       },
  ];

  return (
    <section ref={ref} style={{
      width:      "100%",
      minHeight:  "100svh",
      background: BLACK,
      display:    "flex",
      alignItems: "center",
      justifyContent: "center",
      padding:    "clamp(4rem, 8vw, 8rem) clamp(1.25rem, 7vw, 7rem)",
      position:   "relative",
      overflow:   "hidden",
      borderTop:  "0.5px solid rgba(255,255,255,0.08)",
    }}>
      {/* Ghost sled image
          RENAME: /public/images/athlete-sled-turf-offseason-training.jpg
          (the Grok-generated sled image from earlier in the project)
          Until then, falls back to the rack shot which already exists. */}
      <div aria-hidden="true" style={{ position: "absolute", inset: 0, zIndex: 0 }}>
        <Image
          src="/images/athlete-sled-turf-offseason-training.jpg"
          alt=""
          fill
          quality={40}
          style={{
            objectFit: "cover", objectPosition: "center 35%",
            opacity: 0.09, filter: "blur(6px) brightness(0.45) saturate(0.6)",
          }}
          onError={(e) => { e.currentTarget.src = "/images/athlete-barbell-squat-rack-offseason-training.jpg"; }}
        />
        <div style={{
          position: "absolute", inset: 0,
          background: `radial-gradient(ellipse 70% 60% at 35% 55%, rgba(6,8,16,0.3) 0%, rgba(6,8,16,0.85) 70%),
                       linear-gradient(to right, ${BLACK} 0%, rgba(6,8,16,0.7) 45%, rgba(6,8,16,0.55) 100%),
                       linear-gradient(to bottom, ${BLACK} 0%, transparent 15%, transparent 85%, ${BLACK} 100%)`,
        }} />
      </div>

      {/* Film grain */}
      <div aria-hidden="true" style={{
        position: "absolute", inset: 0, zIndex: 1,
        backgroundImage: GRAIN_URL, backgroundRepeat: "repeat", backgroundSize: "256px 256px",
        opacity: 0.04, mixBlendMode: "screen", pointerEvents: "none",
      }} />

      {/* Blue glow */}
      <div aria-hidden="true" style={{
        position: "absolute", left: "5%", top: "50%", transform: "translateY(-50%)",
        width: "55vw", height: "55vw", borderRadius: "50%",
        background: "radial-gradient(circle, rgba(79,171,255,0.05) 0%, transparent 65%)",
        zIndex: 1, pointerEvents: "none",
      }} />

      {/*
        FIX: Layout uses flexbox on mobile (column) and grid on desktop.
        The grid was rendering even with the right column display:none,
        causing the 1fr column to be constrained by the invisible auto column.
        Using .proof-stats-col class (defined in GLOBAL_STYLE) to show/hide.
      */}
      <div style={{
        position: "relative", zIndex: 2, width: "100%",
        display:  "flex",
        gap:      "clamp(2rem, 5vw, 5rem)",
        alignItems: "center",
        flexWrap: "wrap",
      }}>
        {/* Left: dominant stat */}
        <div style={{ flex: "1 1 300px", minWidth: 0 }}>
          {/* Eyebrow — FIX: opacity 0.22→0.42, size 0.58→0.75rem */}
          <motion.div initial={{ opacity: 0, x: -12 }} animate={inView ? { opacity: 1, x: 0 } : {}} transition={{ duration: 0.5 }}
            style={{ display: "flex", alignItems: "center", gap: "0.85rem", marginBottom: "clamp(1.25rem, 2.5vw, 2rem)" }}
          >
            <div style={{ width: "clamp(1.5rem, 3vw, 2.5rem)", height: "0.5px", background: "rgba(255,255,255,0.22)" }} />
            <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "0.75rem", fontWeight: 900, letterSpacing: "0.2em", textTransform: "uppercase", color: "rgba(255,255,255,0.45)" }}>
              Pilot program data
            </span>
          </motion.div>

          {/* Top rule */}
          <motion.div initial={{ scaleX: 0 }} animate={inView ? { scaleX: 1 } : {}} transition={{ duration: 0.9, delay: 0.08 }}
            style={{ height: "0.5px", background: "rgba(255,255,255,0.12)", marginBottom: "clamp(0.75rem, 1.5vw, 1.25rem)", transformOrigin: "left" }}
          />

          {/* The number — FIX: min 6rem so it's always visible on mobile */}
          <motion.p
            initial={{ opacity: 0, y: 48 }} animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 1.1, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
            aria-label="94 percent"
            style={{
              fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontStyle: "italic",
              fontSize:   "clamp(6rem, 22vw, 22rem)",
              lineHeight: 0.82, letterSpacing: "-0.035em", color: WHITE, display: "block",
              textShadow: "0 0 80px rgba(200,160,80,0.08), 0 2px 40px rgba(0,0,0,0.6)",
            }}
          >
            {val}%
          </motion.p>

          {/* Bottom rule */}
          <motion.div initial={{ scaleX: 0 }} animate={inView ? { scaleX: 1 } : {}} transition={{ duration: 0.9, delay: 0.4 }}
            style={{ height: "0.5px", background: "rgba(255,255,255,0.12)", margin: "clamp(0.75rem, 1.5vw, 1.25rem) 0", transformOrigin: "left" }}
          />

          {/* Context — FIX: opacity 0.4→0.62, size min 0.82→0.95rem */}
          <motion.div initial={{ opacity: 0, y: 16 }} animate={inView ? { opacity: 1, y: 0 } : {}} transition={{ duration: 0.7, delay: 0.55 }}
            style={{ paddingLeft: "1.1rem", borderLeft: "1.5px solid rgba(255,255,255,0.15)", maxWidth: "40ch" }}
          >
            <p style={{ fontFamily: "'Barlow', sans-serif", fontSize: "clamp(0.95rem, 1.2vw, 1.05rem)", fontWeight: 400, lineHeight: 1.7, color: "rgba(255,255,255,0.62)" }}>
              of compliance issues caught in pilot programs were invisible to staff the previous offseason. Not hidden. Just unseen.
            </p>
          </motion.div>
        </div>

        {/* Right: supporting stats — desktop only via .proof-stats-col */}
        <motion.div initial={{ opacity: 0, x: 20 }} animate={inView ? { opacity: 1, x: 0 } : {}} transition={{ duration: 0.8, delay: 0.5 }}
          className="proof-stats-col"
          style={{ flexDirection: "column", gap: 0, flexShrink: 0, borderLeft: "0.5px solid rgba(255,255,255,0.1)" }}
        >
          {supportingStats.map(({ n, label, sub }, i) => (
            <div key={label} style={{
              padding:      "clamp(1.25rem, 2.5vw, 2rem) clamp(1.25rem, 2.5vw, 2.25rem)",
              borderBottom: i < supportingStats.length - 1 ? "0.5px solid rgba(255,255,255,0.08)" : "none",
            }}>
              <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontStyle: "italic", fontSize: "clamp(2rem, 4vw, 3.5rem)", lineHeight: 0.9, letterSpacing: "-0.025em", color: WHITE, marginBottom: "0.45rem" }}>{n}</p>
              {/* FIX: label opacity 0.35→0.58, size 0.65→0.75rem */}
              <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "0.75rem", fontWeight: 900, letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(255,255,255,0.58)", marginBottom: "0.2rem" }}>{label}</p>
              {/* FIX: sub opacity 0.22→0.45, size 0.7→0.8rem */}
              <p style={{ fontFamily: "'Barlow', sans-serif", fontSize: "0.8rem", color: "rgba(255,255,255,0.45)", lineHeight: 1.5, maxWidth: "18ch" }}>{sub}</p>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   5. PRODUCT MOMENT — rebuilt to match the actual Nutrition Queue page
   The real UI is a LIGHT interface — white/near-white backgrounds,
   dark ink text, brand blue #0070CC. Completely different from the dark
   mock we had before. This version faithfully replicates:
     • The sticky NavBar with PEAK wordmark + mode toggles
     • The SummaryHero ("4 athletes need your attention")
     • The ReadinessStrip with progress bar + supporting stats
     • Two QueueCards showing real athlete states
   The light UI creates a striking contrast moment in the dark page —
   feels like a literal window into the product.
══════════════════════════════════════════════════════════════════════════ */

// Colours lifted directly from the Nutrition page CSS vars
const UI = {
  void:    "#F7F9FC",   // page background
  surface: "#FFFFFF",   // card backgrounds
  raised:  "#F2F5F9",   // secondary panels
  panel:   "#EBF0F7",   // tertiary
  rim:     "#DDE4EE",   // borders
  wire:    "#C8D3E3",   // stronger border
  ghost:   "#6B7E99",   // secondary text
  chalk:   "#2D3E56",   // primary dark text
  ink:     "#0D1B2A",   // headline text
  brand:   "#0070CC",   // brand blue
  red:     "#D92B3A",
  amber:   "#C47A00",
  green:   "#0A8A4A",
};

function ProductMoment() {
  const ref    = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-10%" });

  // Faithful mock data matching the Nutrition page structure
  const actionCount = 4;
  const totalCount  = 12;
  const readyCount  = 8;
  const readinessPct = Math.round((readyCount / totalCount) * 100);

  const queueAthletes = [
    {
      name:    "Marcus Williams",
      pos:     "OT",
      team:    "Offense",
      subGroup:"noPlan",
      label:   "No Plan Assigned",
      desc:    "This athlete has no nutrition targets. Assign a plan to enable check-ins.",
      action:  "Assign Plan",
      lastSeen: 6,
    },
    {
      name:    "Jaylen Brooks",
      pos:     "QB",
      team:    "Offense",
      subGroup:"noCheckin",
      label:   "Missed Weekly Check-In",
      desc:    "Has a plan but hasn't logged this week.",
      action:  "Send Reminder",
      lastSeen: 5,
    },
  ];

  const rosterRows = [
    { name: "Darius Thompson", pos: "RB", adh: 88,  sub: "onTrack"      },
    { name: "Malik Johnson",   pos: "S",  adh: 94,  sub: "onTrack"      },
    { name: "Caleb Rhodes",    pos: "WR", adh: 52,  sub: "lowAdherence" },
    { name: "Isaiah Grant",    pos: "CB", adh: 61,  sub: "lowAdherence" },
    { name: "Trevon Mills",    pos: "LB", adh: null, sub: "noCheckin"   },
  ];

  const subColor = (sub) => sub === "onTrack" ? UI.green : sub === "lowAdherence" ? UI.amber : sub === "noCheckin" ? UI.amber : UI.red;
  const subLabel = (sub) => sub === "onTrack" ? "On Track" : sub === "lowAdherence" ? "Low Adherence" : sub === "noCheckin" ? "No Check-In" : "No Plan";

  return (
    <section id="how-it-works" style={{
      width:      "100%",
      background: BLACK,
      /* Extra top padding gives breathing room so the browser window
         doesn't feel crammed against the proof section above it */
      padding:    "clamp(5rem, 10vw, 9rem) 0 clamp(5rem, 10vw, 9rem)",
      overflow:   "hidden",
      /* No hard border — gradient overlay on the section itself
         handles the transition from the section above            */
      position:   "relative",
    }}>

      {/* Top gradient — softens the edge from the section above.
          The previous section already fades to BLACK at its base,
          so this just confirms continuity rather than hard-cutting. */}
      <div aria-hidden="true" style={{
        position:   "absolute",
        top:        0, left: 0, right: 0,
        height:     "12rem",
        background: `linear-gradient(to bottom, rgba(6,8,16,0.6) 0%, transparent 100%)`,
        pointerEvents: "none",
        zIndex:     1,
      }} />

      {/* Content sits above gradient */}
      <div style={{ position: "relative", zIndex: 2 }}>

      {/* Section label */}
      <motion.p
        ref={ref}
        initial={{ opacity: 0, y: 12 }} animate={inView ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.6 }}
        style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "0.8rem", fontWeight: 900, letterSpacing: "0.2em", textTransform: "uppercase", color: "rgba(255,255,255,0.45)", textAlign: "center", marginBottom: "clamp(2rem, 4vw, 3.5rem)" }}
      >
        What your staff sees every morning
      </motion.p>

      {/* Interface mock — wrapped in browser chrome so the light UI
          reads as a product window floating in the dark page,
          not a jarring cut to a different colour scheme          */}
      <motion.div
        initial={{ opacity: 0, y: 48, rotateX: 5 }}
        animate={inView ? { opacity: 1, y: 0, rotateX: 0 } : {}}
        transition={{ duration: 1.2, delay: 0.12, ease: [0.16, 1, 0.3, 1] }}
        style={{
          /* More horizontal margin on desktop so it reads as
             a contained window, not an edge-to-edge page section */
          margin:          "0 clamp(0.75rem, 6vw, 6rem)",
          borderRadius:    "10px",
          overflow:        "hidden",
          /* Layered shadow — close dark + wide diffuse blue glow */
          boxShadow:       `
            0 2px 0 rgba(255,255,255,0.06),
            0 24px 80px rgba(0,0,0,0.75),
            0 8px 32px rgba(0,0,0,0.5),
            0 0 0 1px rgba(255,255,255,0.08)
          `,
          transform:       "perspective(1400px) rotateX(1.5deg)",
          transformOrigin: "center top",
          fontFamily:      "'Barlow Condensed', sans-serif",
        }}
      >

        {/* ── BROWSER CHROME ──
            A dark titlebar with traffic dots + URL bar.
            This single element tells the viewer "this is a product
            window" — bridging the dark editorial page and the
            light interface below without a hard cut.              */}
        <div style={{
          background:    "#16202E",
          borderBottom:  "1px solid rgba(255,255,255,0.08)",
          padding:       "0 16px",
          height:        44,
          display:       "flex",
          alignItems:    "center",
          gap:           12,
          flexShrink:    0,
        }}>
          {/* Traffic light dots */}
          <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
            {["#FF5F57", "#FFBD2E", "#28C840"].map((c, i) => (
              <div key={i} style={{ width: 12, height: 12, borderRadius: "50%", background: c, opacity: 0.85 }} />
            ))}
          </div>

          {/* URL bar */}
          <div style={{
            flex:          1,
            maxWidth:      360,
            margin:        "0 auto",
            background:    "rgba(255,255,255,0.07)",
            border:        "1px solid rgba(255,255,255,0.1)",
            borderRadius:  5,
            height:        26,
            display:       "flex",
            alignItems:    "center",
            justifyContent:"center",
            gap:           6,
            padding:       "0 10px",
          }}>
            {/* Lock icon */}
            <svg width="9" height="10" viewBox="0 0 12 14" fill="none" style={{ flexShrink: 0, opacity: 0.45 }}>
              <rect x="1" y="6" width="10" height="8" rx="1.5" fill="rgba(255,255,255,0.8)"/>
              <path d="M3.5 6V4a2.5 2.5 0 015 0v2" stroke="rgba(255,255,255,0.8)" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
            </svg>
            <span style={{
              fontFamily:    "'Barlow', sans-serif",
              fontSize:      "0.68rem",
              color:         "rgba(255,255,255,0.45)",
              letterSpacing: "0.01em",
              whiteSpace:    "nowrap",
            }}>
              checkpeak.com<span style={{ opacity: 0.5 }}>/org/nutrition</span>
            </span>
          </div>

          {/* Right side — tabs hint */}
          <div style={{ display: "flex", gap: 6, flexShrink: 0, opacity: 0.3 }}>
            {[1, 2, 3].map(i => (
              <div key={i} style={{ width: 14, height: 2, borderRadius: 1, background: "rgba(255,255,255,0.6)" }} />
            ))}
          </div>
        </div>

        {/* ── NAV BAR — matches NavBar component exactly ── */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "0 20px", height: 48,
          background: UI.surface,
          borderBottom: `1px solid ${UI.rim}`,
        }}>
          {/* Left: wordmark + page label */}
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: 15, letterSpacing: "0.12em", color: UI.brand, textTransform: "uppercase" }}>
              PEAK
            </span>
            <div style={{ width: 1, height: 20, background: UI.rim }} />
            <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 600, fontSize: 13, letterSpacing: "0.08em", color: UI.ghost, textTransform: "uppercase" }}>
              Nutrition Queue
            </span>
          </div>

          {/* Center: mode toggle */}
          <div style={{ display: "flex", alignItems: "center", background: UI.surface, border: `1px solid ${UI.rim}`, borderRadius: 4, padding: 3, gap: 2 }}>
            {[{ label: "Queue", active: true, count: actionCount }, { label: "Actions", active: false }, { label: "Roster", active: false }].map(({ label, active, count }) => (
              <div key={label} style={{
                fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 12,
                letterSpacing: "0.06em", textTransform: "uppercase",
                padding: "5px 12px", borderRadius: 3,
                background: active ? UI.brand : "transparent",
                color: active ? "#fff" : UI.ghost,
                display: "flex", alignItems: "center", gap: 5,
              }}>
                {label}
                {count > 0 && (
                  <span style={{ background: active ? "rgba(0,0,0,0.25)" : UI.red, color: active ? "rgba(0,0,0,0.7)" : "#fff", borderRadius: 10, padding: "0 5px", fontSize: 10 }}>
                    {count}
                  </span>
                )}
              </div>
            ))}
          </div>

          {/* Right: nav links */}
          <div style={{ display: "flex", gap: 4 }}>
            {["Dashboard", "Plans"].map(label => (
              <div key={label} style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 600, fontSize: 12, letterSpacing: "0.06em", textTransform: "uppercase", padding: "6px 12px", color: UI.ghost }}>
                {label}
              </div>
            ))}
          </div>
        </div>

        {/* ── MAIN CONTENT AREA ── */}
        <div style={{ background: UI.void, padding: "20px" }}>
          <div style={{ maxWidth: 680, margin: "0 auto", display: "flex", flexDirection: "column", gap: 12 }}>

            {/* ── SUMMARY HERO — matches SummaryHero component ── */}
            <motion.div
              initial={{ opacity: 0, y: 12 }} animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.55, delay: 0.2 }}
              style={{
                padding: "24px 24px 20px",
                background: UI.surface,
                border: `1px solid ${UI.rim}`,
                borderTop: `3px solid ${UI.red}`,
                borderRadius: 4,
                position: "relative",
                overflow: "hidden",
              }}
            >
              {/* Ghost number decoration */}
              <div style={{
                position: "absolute", top: -16, right: -12,
                fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900,
                fontSize: 140, lineHeight: 1,
                color: UI.red, opacity: 0.05,
                userSelect: "none", pointerEvents: "none",
              }}>
                {actionCount}
              </div>

              <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase", color: UI.ghost, marginBottom: 6 }}>
                MORNING BRIEF · {new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" })}
              </div>

              <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: "clamp(1.4rem, 3.5vw, 2.2rem)", lineHeight: 1.05, color: UI.ink, marginBottom: 6 }}>
                <span style={{ color: UI.red }}>{actionCount} athletes</span> need your attention.
              </div>

              <div style={{ fontSize: 14, color: UI.ghost, fontFamily: "'Barlow', sans-serif", marginBottom: 20, lineHeight: 1.5 }}>
                2 without a plan · 2 missed their check-in
              </div>

              <div style={{ display: "inline-flex", alignItems: "center", gap: 10, padding: "11px 24px", background: UI.brand, borderRadius: 3, cursor: "default" }}>
                <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: 14, letterSpacing: "0.08em", textTransform: "uppercase", color: "#fff" }}>
                  Work the Queue
                </span>
                <span style={{ fontFamily: "monospace", fontSize: 12, opacity: 0.6, color: "#fff" }}>→</span>
              </div>
            </motion.div>

            {/* ── READINESS STRIP — matches ReadinessStrip component ── */}
            <motion.div
              initial={{ opacity: 0, y: 12 }} animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.55, delay: 0.28 }}
              style={{
                display: "grid", gridTemplateColumns: "1fr auto",
                gap: 20, alignItems: "center",
                padding: "16px 20px",
                background: UI.surface,
                border: `1px solid ${UI.rim}`,
                borderLeft: `3px solid ${UI.amber}`,
                borderRadius: 4,
              }}
            >
              <div>
                <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 8 }}>
                  <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: "clamp(2rem, 5vw, 3rem)", lineHeight: 1, color: UI.amber, letterSpacing: "-0.02em" }}>
                    {readinessPct}%
                  </span>
                  <div>
                    <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 13, letterSpacing: "0.08em", textTransform: "uppercase", color: UI.chalk }}>
                      Program Readiness
                    </div>
                    <div style={{ fontSize: 12, color: UI.ghost, fontFamily: "'Barlow', sans-serif" }}>
                      {readyCount} of {totalCount} athletes on track this week
                    </div>
                  </div>
                </div>
                {/* Progress bar */}
                <div style={{ height: 4, background: UI.rim, borderRadius: 4, overflow: "hidden" }}>
                  <motion.div
                    initial={{ width: 0 }}
                    animate={inView ? { width: `${readinessPct}%` } : {}}
                    transition={{ duration: 1, delay: 0.5, ease: [0.16, 1, 0.3, 1] }}
                    style={{ height: "100%", background: UI.amber, borderRadius: 4 }}
                  />
                </div>
              </div>

              {/* Supporting stats */}
              <div style={{ display: "flex", gap: 20, flexShrink: 0 }}>
                {[
                  { label: "Need Action", value: actionCount,   color: UI.red   },
                  { label: "Avg Adherence", value: "74%",       color: UI.amber },
                ].map(({ label, value, color }) => (
                  <div key={label} style={{ textAlign: "right" }}>
                    <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: 20, color, lineHeight: 1.1 }}>
                      {value}
                    </div>
                    <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 600, fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase", color: UI.ghost, marginTop: 2 }}>
                      {label}
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* ── QUEUE CARDS — first two athletes needing action ── */}
            {queueAthletes.map(({ name, pos, team, subGroup, label, desc, action, lastSeen }, qi) => {
              const cardColor = subGroup === "noPlan" ? UI.red : UI.amber;
              const tagBg     = subGroup === "noPlan" ? "rgba(217,43,58,0.07)" : "rgba(196,122,0,0.07)";
              const tagBorder = subGroup === "noPlan" ? "rgba(217,43,58,0.22)" : "rgba(196,122,0,0.22)";
              return (
                <motion.div key={name}
                  initial={{ opacity: 0, y: 12 }} animate={inView ? { opacity: 1, y: 0 } : {}}
                  transition={{ duration: 0.55, delay: 0.36 + qi * 0.1 }}
                  style={{
                    background: UI.surface,
                    border: `1px solid ${UI.rim}`,
                    borderTop: `3px solid ${cardColor}`,
                    borderRadius: 4,
                    overflow: "hidden",
                  }}
                >
                  {/* Progress indicator: 1 of 4, 2 of 4 */}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 24px 0" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontFamily: "monospace", fontSize: 11, color: UI.ghost }}>{qi + 1} / {actionCount}</span>
                      <div style={{ width: 60, height: 2, background: UI.rim, borderRadius: 1, overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${((qi + 1) / actionCount) * 100}%`, background: UI.brand }} />
                      </div>
                    </div>
                    <span style={{ fontFamily: "monospace", fontSize: 10, color: UI.ghost }}>{actionCount - qi - 1} remaining</span>
                  </div>

                  <div style={{ padding: "16px 24px 0" }}>
                    {/* Tag */}
                    <div style={{ marginBottom: 8 }}>
                      <span style={{ display: "inline-flex", alignItems: "center", padding: "2px 8px", borderRadius: 2, border: `1px solid ${tagBorder}`, background: tagBg, fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 11, letterSpacing: "0.06em", textTransform: "uppercase", color: cardColor, lineHeight: 1.6 }}>
                        {label}
                      </span>
                    </div>
                    {/* Name */}
                    <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: "clamp(1.4rem, 3vw, 2rem)", color: UI.ink, lineHeight: 1.05, marginBottom: 8 }}>
                      {name}
                    </div>
                    {/* Position tags + last seen */}
                    <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
                      {[pos, team].map(t => (
                        <span key={t} style={{ display: "inline-flex", padding: "2px 7px", borderRadius: 2, border: `1px solid ${UI.wire}`, fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 11, letterSpacing: "0.06em", textTransform: "uppercase", color: UI.ghost }}>
                          {t}
                        </span>
                      ))}
                      <span style={{ fontSize: 12, color: UI.ghost, fontFamily: "'Barlow', sans-serif" }}>· Last active {lastSeen}d ago</span>
                    </div>

                    <div style={{ height: 1, background: UI.rim, marginLeft: -24, marginRight: -24 }} />

                    {/* Description */}
                    <p style={{ fontSize: 13, color: UI.chalk, lineHeight: 1.6, fontFamily: "'Barlow', sans-serif", padding: "12px 0" }}>
                      {desc}
                    </p>

                    <div style={{ height: 1, background: UI.rim, marginLeft: -24, marginRight: -24 }} />
                  </div>

                  {/* Actions */}
                  <div style={{ padding: "14px 24px", display: "flex", gap: 10 }}>
                    <div style={{
                      flex: 1, padding: "11px 16px",
                      background: cardColor, borderRadius: 3,
                      fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: 13,
                      letterSpacing: "0.08em", textTransform: "uppercase", color: "#fff",
                      textAlign: "center",
                    }}>
                      {action}
                    </div>
                    <div style={{
                      padding: "11px 14px",
                      background: "transparent", border: `1px solid ${UI.rim}`, borderRadius: 3,
                      fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 12,
                      letterSpacing: "0.06em", textTransform: "uppercase", color: UI.ghost,
                    }}>
                      Skip →
                    </div>
                  </div>
                </motion.div>
              );
            })}

            {/* ── ROSTER STRIP — condensed athlete list ── */}
            <motion.div
              initial={{ opacity: 0, y: 12 }} animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.55, delay: 0.55 }}
              style={{ background: UI.surface, border: `1px solid ${UI.rim}`, borderRadius: 4, overflow: "hidden" }}
            >
              <div style={{ padding: "8px 16px", background: UI.raised, borderBottom: `1px solid ${UI.rim}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", color: UI.ghost }}>
                  Full Roster
                </span>
                <span style={{ fontFamily: "monospace", fontSize: 11, color: UI.ghost }}>{totalCount} athletes</span>
              </div>
              {rosterRows.map(({ name, pos, adh, sub }, i) => (
                <div key={name} style={{
                  display: "grid", gridTemplateColumns: "1fr 80px 70px",
                  alignItems: "center", gap: 0,
                  padding: "9px 16px",
                  borderBottom: i < rosterRows.length - 1 ? `1px solid ${UI.rim}` : "none",
                  background: i % 2 === 0 ? UI.surface : UI.raised,
                }}>
                  {/* Name + pos */}
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ width: 3, height: 28, borderRadius: 2, background: subColor(sub), flexShrink: 0 }} />
                    <div>
                      <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 13, color: UI.ink }}>{name}</div>
                      <div style={{ fontFamily: "'Barlow', sans-serif", fontSize: 11, color: UI.ghost }}>{pos} · {subLabel(sub)}</div>
                    </div>
                  </div>
                  {/* Adherence bar */}
                  <div>
                    {adh != null ? (
                      <>
                        <div style={{ fontFamily: "monospace", fontSize: 11, color: subColor(sub), textAlign: "right", marginBottom: 3 }}>{adh}%</div>
                        <div style={{ height: 3, background: UI.rim, borderRadius: 3 }}>
                          <div style={{ height: "100%", width: `${adh}%`, background: subColor(sub), borderRadius: 3 }} />
                        </div>
                      </>
                    ) : (
                      <span style={{ fontFamily: "monospace", fontSize: 11, color: UI.ghost }}>Pending</span>
                    )}
                  </div>
                  {/* Action */}
                  <div style={{ textAlign: "right" }}>
                    {sub === "onTrack" && <span style={{ fontFamily: "monospace", fontSize: 11, color: UI.green }}>✓</span>}
                    {sub !== "onTrack" && (
                      <div style={{ display: "inline-block", padding: "4px 8px", background: subColor(sub) === UI.red ? "rgba(217,43,58,0.08)" : "rgba(196,122,0,0.08)", border: `1px solid ${subColor(sub) === UI.red ? "rgba(217,43,58,0.2)" : "rgba(196,122,0,0.2)"}`, borderRadius: 3, fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 10, letterSpacing: "0.06em", textTransform: "uppercase", color: subColor(sub) }}>
                        {sub === "noCheckin" ? "Remind" : "Review"}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </motion.div>

          </div>
        </div>
      </motion.div>

      {/* Caption below */}
      <motion.p
        initial={{ opacity: 0 }} animate={inView ? { opacity: 1 } : {}} transition={{ duration: 0.6, delay: 0.9 }}
        style={{ textAlign: "center", marginTop: "clamp(1.5rem, 3vw, 2.5rem)", fontFamily: "'Barlow', sans-serif", fontSize: "0.8rem", color: "rgba(255,255,255,0.42)", letterSpacing: "0.05em" }}
      >
        Actual staff dashboard. Every submission timestamped and reviewed.
      </motion.p>

      </div>{/* /zIndex wrapper */}
    </section>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   6. FINAL CTA
   FIX: Eyebrow opacity 0.22→0.5, size 0.62rem→0.82rem — it's real content
   FIX: Sub-label "30 days free" opacity 0.22→0.5, size 0.65→0.8rem
   FIX: Athlete link opacity 0.35→0.55, size 0.58→0.78rem — functional link
   FIX: Disclaimer opacity 0.12→0.22, size 0.55→0.65rem — legal minimum
   FIX: Bottom absolute elements get padding to avoid overlap on short phones
══════════════════════════════════════════════════════════════════════════ */
function FinalCta() {
  const ref    = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-15%" });

  return (
    <section ref={ref} style={{
      width:          "100%",
      minHeight:      "100svh",
      background:     BLACK,
      display:        "flex",
      flexDirection:  "column",
      alignItems:     "center",
      justifyContent: "center",
      // FIX: bottom padding ensures content clears the absolute bottom links
      padding:        "clamp(5rem, 8vw, 8rem) clamp(1.25rem, 6vw, 6rem) clamp(6rem, 10vw, 8rem)",
      position:       "relative",
      overflow:       "hidden",
      borderTop:      "0.5px solid rgba(255,255,255,0.08)",
    }}>
      {/* Radial glow */}
      <div aria-hidden="true" style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse 60% 50% at 50% 60%, rgba(79,171,255,0.06) 0%, transparent 70%)", pointerEvents: "none" }} />

      {/* Ghost watermark */}
      <div aria-hidden="true" style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", pointerEvents: "none" }}>
        <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontStyle: "italic", fontSize: "clamp(12rem, 40vw, 50rem)", lineHeight: 1, letterSpacing: "-0.04em", color: "rgba(255,255,255,0.018)", whiteSpace: "nowrap", userSelect: "none" }}>
          WIN
        </p>
      </div>

      {/* Content */}
      <div style={{ position: "relative", zIndex: 1, textAlign: "center" }}>
        {/* Eyebrow — FIX: opacity 0.22→0.5, size 0.62→0.82rem */}
        <motion.p initial={{ opacity: 0, y: 8 }} animate={inView ? { opacity: 1, y: 0 } : {}} transition={{ duration: 0.5 }}
          style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "0.82rem", fontWeight: 900, letterSpacing: "0.2em", textTransform: "uppercase", color: "rgba(255,255,255,0.5)", marginBottom: "clamp(1.25rem, 2.5vw, 2rem)" }}
        >
          For strength staffs managing athletes off-campus
        </motion.p>

        <motion.h2 initial={{ opacity: 0, y: 32 }} animate={inView ? { opacity: 1, y: 0 } : {}} transition={{ duration: 0.9, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
          style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontStyle: "italic", fontSize: "clamp(4rem, 14vw, 14rem)", lineHeight: 0.88, letterSpacing: "-0.025em", textTransform: "uppercase", color: WHITE, marginBottom: "clamp(2rem, 4vw, 4rem)" }}
        >
          Stop<br />guessing.
        </motion.h2>

        <motion.div initial={{ opacity: 0, y: 16 }} animate={inView ? { opacity: 1, y: 0 } : {}} transition={{ duration: 0.7, delay: 0.4 }}
          style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.85rem" }}
        >
          <PilotButton source="final_cta" size="lg" />
          {/* FIX: opacity 0.22→0.5, size 0.65→0.8rem */}
          <p style={{ fontFamily: "'Barlow', sans-serif", fontSize: "0.8rem", letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(255,255,255,0.5)" }}>
            30 days free · No credit card · Unlimited athletes
          </p>
        </motion.div>
      </div>

      {/* Bottom-left athlete link — FIX: opacity bump so it's actually usable */}
      <div style={{ position: "absolute", bottom: "clamp(1.25rem, 2.5vw, 2rem)", left: "clamp(1.25rem, 4vw, 2.5rem)", zIndex: 1 }}>
        {/* FIX: size 0.58→0.78rem, opacity chain bumped */}
        <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "0.78rem", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(255,255,255,0.35)", lineHeight: 1.6 }}>
          Athlete?&nbsp;
          <a href="/nutrition-label-scanner" onClick={() => track("footer_athlete_link")}
            style={{ color: "rgba(255,255,255,0.58)", textDecoration: "none", transition: "color 0.18s" }}
            onMouseEnter={e => { e.currentTarget.style.color = ACCENT; }}
            onMouseLeave={e => { e.currentTarget.style.color = "rgba(255,255,255,0.58)"; }}
          >
            Free supplement tools →
          </a>
        </p>
      </div>

      {/* Bottom-right legal — FIX: opacity 0.12→0.25, size 0.55→0.68rem */}
      <div style={{ position: "absolute", bottom: "clamp(1.25rem, 2.5vw, 2rem)", right: "clamp(1.25rem, 4vw, 2.5rem)", zIndex: 1 }}>
        <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "0.68rem", letterSpacing: "0.08em", color: "rgba(255,255,255,0.25)", textAlign: "right", lineHeight: 1.6, maxWidth: "26ch" }}>
          Screening does not replace governing body verification.
        </p>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// PAGE
// ---------------------------------------------------------------------------
export default function HomePage() {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ?? "https://checkpeak.com";
  const ogDesc  = "When athletes leave campus, you still know. Off-campus accountability for college programs.";

  return (
    <>
      <style>{GLOBAL_STYLE}</style>
      <Head>
        <title>CheckPeak — When athletes leave campus, you still know.</title>
        <meta name="description" content="CheckPeak helps strength staffs verify off-campus workout completion, monitor nutrition, and catch supplement risk. Built for college programs." />
        <meta property="og:title"       content="CheckPeak — When athletes leave campus, you still know." />
        <meta property="og:description" content={ogDesc} />
        <meta property="og:type"        content="website" />
        <meta property="og:url"         content={siteUrl} />
        <meta property="og:image"       content={`${siteUrl}/api/og-image?q=${encodeURIComponent(ogDesc)}`} />
        <meta name="twitter:card"       content="summary_large_image" />
        <meta name="twitter:site"       content="@checkPeak_" />
        <meta name="twitter:title"      content="CheckPeak — When athletes leave campus, you still know." />
        <meta name="twitter:image"      content={`${siteUrl}/api/og-image?q=${encodeURIComponent(ogDesc)}`} />
      </Head>

      <Cursor />

      <main style={{ background: BLACK, color: WHITE }}>
        <Hero />

        {/* Triptych immediately after hero — visual proof before any copy.
            The claim lands, then three panels of real athletes answer it.
            Words come after the image, not before. */}
        <TriptychSection />

        {/* Beat 1: "The offseason doesn't lie." */}
        <DeclarationBeat index={0} lines={BEATS[0].lines} footnote={BEATS[0].footnote}
          isClimax={false} threeLines={false} bgImage={BEAT_IMAGES[0]} watermark={BEAT_WATERMARKS[0]} />

        {/* Beat 2: "Your athletes know it." */}
        <DeclarationBeat index={1} lines={BEATS[1].lines} footnote={BEATS[1].footnote}
          isClimax={false} threeLines={false} bgImage={BEAT_IMAGES[1]} watermark={BEAT_WATERMARKS[1]} />

        {/* Beat 3: "Now you will." */}
        <DeclarationBeat index={2} lines={BEATS[2].lines} footnote={BEATS[2].footnote}
          isClimax={true} threeLines={false} bgImage={BEAT_IMAGES[2]} watermark={BEAT_WATERMARKS[2]} />

        <ProofMoment />
        <ProductMoment />
        <FinalCta />
      </main>
    </>
  );
}