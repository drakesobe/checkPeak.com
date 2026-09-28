// pages/index.js
"use client";

import Head from "next/head";
import Image from "next/image";
import TriptychSection from "@/components/TriptychSection";
import ComparisonMoment from "@/components/ComparisonMoment";
import { useRef, useState, useEffect } from "react";
import { motion, useInView } from "framer-motion";
import { GRAIN_URL } from "@/lib/grain";

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
// FIX: cursor:none scoped to (pointer:fine) only - desktop mice.
//      Mobile touch devices keep their default tap indicator.
// FIX: Added .sm-show rule so product mock nav tabs appear on wider screens.
// ---------------------------------------------------------------------------
const GLOBAL_STYLE = `
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  html { scroll-behavior: smooth; }

  /* Cursor - desktop pointer devices only, never mobile */
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

  /* Declaration beats - full viewport on desktop, compact on mobile */
  .declaration-beat { min-height: 100svh; }
  @media (max-width: 767px) {
    .declaration-beat {
      min-height: 0;
      padding-top: 4rem;
      padding-bottom: 4rem;
    }
  }

  /* Product mock nav tabs - shown on wider screens */
  .sm-show { display: none; }
  @media (min-width: 640px) {
    .sm-show { display: block; }
  }

  /* Proof stats right column - desktop only */
  .proof-stats-col { display: none !important; }
  @media (min-width: 900px) {
    .proof-stats-col { display: flex !important; }
  }

  /* Hero nav - hide on small screens to avoid crowding wordmark */
  .hero-nav { display: none; }
  @media (min-width: 540px) {
    .hero-nav { display: flex; }
  }
`;

// ---------------------------------------------------------------------------
// Grain overlay - SVG noise, same technique as A24/Nike editorial pages
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Custom cursor - desktop only
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
// FIX: min font-size lifted to 1rem on lg, 0.92rem on md - readable on all screens
// ---------------------------------------------------------------------------
function PilotButton({ source, size = "md" }) {
  const lg = size === "lg";
  return (
    <button
      type="button"
      onClick={() => { track("cta_pilot_request", { source }); window.location.href = "/book"; }}
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
      BOOK A WALKTHROUGH
      <svg width={lg ? 18 : 15} height={lg ? 18 : 15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <line x1="5" y1="12" x2="19" y2="12"/>
        <polyline points="12 5 19 12 12 19"/>
      </svg>
    </button>
  );
}


// For Athletic Programs / ADs - higher-touch walkthrough booking
function OrgButton({ source }) {
  return (
    <a
      href="/book"
      onClick={() => track("cta_for_orgs", { source })}
      style={{
        display: "inline-flex", alignItems: "center", gap: "0.65rem",
        padding: "1.1rem 2.5rem",
        background: "transparent", color: WHITE,
        fontFamily: "'Barlow Condensed', sans-serif",
        fontSize: "1.05rem", fontWeight: 900,
        letterSpacing: "0.12em", textTransform: "uppercase",
        border: "1px solid rgba(255,255,255,0.22)",
        textDecoration: "none",
        transition: "border-color 0.2s",
      }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.6)"; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.22)"; }}
    >
      BOOK A WALKTHROUGH
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
      </svg>
    </a>
  );
}



/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   1. HERO
   FIX: Nav hidden on < 540px to avoid crowding wordmark
   FIX: Disclaimer opacity 0.35 â†’ 0.55 and size 0.68rem â†’ 0.78rem
   FIX: "Scroll" label opacity 0.25 â†’ 0.45, size 0.58rem â†’ 0.72rem
   FIX: Scroll opacity parallax starts fading later [0, 0.6] not [0, 0.5]
        so content is fully readable while still in viewport
â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
function Hero() {
  const ref        = useRef(null);
  const bgRef      = useRef(null);
  const contentRef = useRef(null);
  const [showVideo, setShowVideo] = useState(false);

  useEffect(() => {
    if (window.matchMedia("(min-width: 768px)").matches) setShowVideo(true);
  }, []);

  // Passive scroll listener - no forced layout reflow on mount
  useEffect(() => {
    const section = ref.current;
    const bg      = bgRef.current;
    const content = contentRef.current;
    if (!section) return;

    let raf = null;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        const h    = section.offsetHeight || 1;
        const frac = Math.max(0, Math.min(1, window.scrollY / h));
        if (bg)      bg.style.transform  = `translateY(${(frac * 20).toFixed(2)}%)`;
        if (content) content.style.opacity = Math.max(0, 1 - frac / 0.6).toFixed(3);
        raf = null;
      });
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

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
      {/* Background - plain div; no willChange so the browser doesn't eagerly promote a large compositor layer */}
      <div ref={bgRef} style={{ position: "absolute", top: "-10%", left: 0, right: 0, bottom: "-10%" }} aria-hidden="true">
        <style>{`
          .hero-video {
            position: absolute; inset: 0;
            width: 100%; height: 100%;
            object-fit: cover;
            object-position: 55% center;
          }
        `}</style>
        {/* LCP image: Next.js injects <link rel="preload" fetchpriority="high"> in <head> */}
        <Image
          src="/images/athlete-barbell-squat-rack-offseason-training.jpg"
          alt=""
          fill
          priority
          sizes="100vw"
          style={{ objectFit: "cover", objectPosition: "center" }}
        />
        {/* Desktop only: video is never added to the DOM on mobile */}
        {showVideo && (
          <video autoPlay muted loop playsInline preload="none" className="hero-video">
            <source src="/video/hero-loop.mp4" type="video/mp4" />
          </video>
        )}
        <div style={{ position: "absolute", inset: 0, background: "rgba(6,8,16,0.62)" }} />
        <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse 80% 80% at 50% 50%, transparent 30%, rgba(6,8,16,0.5) 100%)" }} />
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: "35%", background: `linear-gradient(to bottom, transparent, ${BLACK})` }} />
      </div>

      {/* Nav */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.7, delay: 0.6 }}
        className="hero-nav"
        style={{ position: "absolute", top: "clamp(1.25rem, 3vw, 2rem)", right: "clamp(1.25rem, 4vw, 2.5rem)", zIndex: 10, gap: "1.75rem" }}
      >
        {[
          { label: "For universities", href: null,       action: () => { track("nav_click", { label: "For universities" });  document.getElementById("for-organizations")?.scrollIntoView({ behavior: "smooth" }); } },
          { label: "Pricing",          href: "/pricing", action: () => track("nav_click", { label: "Pricing" }) },
        ].map(({ label, href, action }) =>
          href ? (
            <a key={label} href={href} onClick={action}
              style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "0.78rem", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(255,255,255,0.6)", textDecoration: "none", padding: 0, transition: "color 0.18s" }}
              onMouseEnter={e => { e.currentTarget.style.color = WHITE; }}
              onMouseLeave={e => { e.currentTarget.style.color = "rgba(255,255,255,0.6)"; }}
            >{label}</a>
          ) : (
            <button key={label} type="button" onClick={action}
              style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "0.78rem", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(255,255,255,0.6)", background: "none", border: "none", padding: 0, transition: "color 0.18s" }}
              onMouseEnter={e => { e.currentTarget.style.color = WHITE; }}
              onMouseLeave={e => { e.currentTarget.style.color = "rgba(255,255,255,0.6)"; }}
            >{label}</button>
          )
        )}
      </motion.div>

      {/* Center headline - plain div so opacity is driven by scroll handler, not MotionValue */}
      <div ref={contentRef} style={{ opacity: 1, position: "relative", zIndex: 10, textAlign: "center", padding: "0 clamp(1.25rem, 5vw, 3rem)" }}>

        {/* CheckPeak brand chip */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.2 }}
          style={{ display: "inline-flex", alignItems: "center", gap: "0.6rem", marginBottom: "clamp(0.5rem, 1vw, 0.85rem)" }}
        >
          <div style={{ width: "1.75rem", height: "0.5px", background: ACCENT }} />
          <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "0.68rem", fontWeight: 900, letterSpacing: "0.24em", textTransform: "uppercase", color: ACCENT }}>CheckPeak</span>
          <div style={{ width: "1.75rem", height: "0.5px", background: ACCENT }} />
        </motion.div>

        <motion.h1
          initial={{ y: 32 }} animate={{ y: 0 }}
          transition={{ duration: 0.9, delay: 0.32, ease: [0.16, 1, 0.3, 1] }}
          style={{
            fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontStyle: "italic",
            fontSize: "clamp(5rem, 18vw, 18rem)", lineHeight: 0.83, letterSpacing: "-0.03em",
            textTransform: "uppercase", color: WHITE,
            marginBottom: "clamp(0.5rem, 1vw, 0.85rem)",
            textShadow: "0 2px 60px rgba(0,0,0,0.6)",
          }}
        >
          Stop Guessing.
        </motion.h1>

        <motion.p initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.58 }}
          style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontStyle: "italic", fontSize: "clamp(0.95rem, 2.2vw, 1.6rem)", letterSpacing: "0.04em", textTransform: "uppercase", color: "rgba(255,255,255,0.68)", marginBottom: "clamp(2rem, 4vw, 3.5rem)" }}
        >
          Film. Nutrition. Accountability.
        </motion.p>

        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.76 }}
          style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "1.1rem" }}
        >
          <OrgButton source="hero" />
          <button
            type="button"
            onClick={() => { track("cta_login_hero"); openAuthModal({ tab: "login" }); }}
            style={{
              background: "none", border: "none", cursor: "pointer", padding: 0,
              fontFamily: "'Barlow', sans-serif", fontSize: "0.85rem",
              color: "rgba(255,255,255,0.45)", transition: "color 0.18s",
            }}
            onMouseEnter={e => { e.currentTarget.style.color = "rgba(255,255,255,0.8)"; }}
            onMouseLeave={e => { e.currentTarget.style.color = "rgba(255,255,255,0.45)"; }}
          >
            Already have an account? <span style={{ textDecoration: "underline" }}>Log in</span>
          </button>
        </motion.div>
      </div>

      {/* Scroll indicator */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.4, duration: 0.8 }}
        style={{ position: "absolute", bottom: "clamp(1.25rem, 3vw, 2rem)", left: "50%", transform: "translateX(-50%)", zIndex: 10, display: "flex", flexDirection: "column", alignItems: "center", gap: "0.5rem" }}
      >
        {/* FIX: opacity 0.25 â†’ 0.45, size 0.58rem â†’ 0.72rem */}
        <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "0.75rem", fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase", color: "rgba(255,255,255,0.62)" }}>
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

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   2. DECLARATIONS
   Three full-viewport beats with ghost images, grain, and structure.

   FIX: Vertical padding reduced from clamp(6rem, 12vw, 10rem)
        to clamp(3.5rem, 8vw, 8rem) - content was cut off on phones.
   FIX: Beat 2 (3 lines) gets its own smaller font clamp so three stacked
        lines don't overflow a 390px viewport.
   FIX: Footnote opacity 0.42 â†’ 0.6, size min 0.82rem â†’ 0.95rem.
   FIX: Section counter opacity 0.2 â†’ 0.35, size 0.58rem â†’ 0.72rem.
   FIX: Watermark hidden on mobile - it clips and looks broken on phones.
â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
const BEAT_IMAGES = [
  "/images/athlete-barbell-squat-rack-offseason-training.jpg",
  "/images/athlete-barbell-squat-mirror-gym-intensity.jpg",
  "/images/college-athlete-barbell-squat-training-gym.jpg",
];
const BEAT_WATERMARKS = ["OFFSEASON", "PROGRAMS", "KNOW"];

function DeclarationBeat({ lines, footnote, isClimax = false, index, bgImage, watermark, threeLines = false, total = 3, sectionLabel = null }) {
  const ref    = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-10%" });

  /*
    Font size strategy:
    - Normal 2-line beat: clamp(4rem, 13vw, 15rem)
    - 3-line beat: clamp(3rem, 10vw, 12rem) - smaller min so all 3 lines
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

      {/* Ghost watermark - hidden on mobile via inline media query trick:
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

        {/* Section counter + optional product label */}
        <motion.div initial={{ opacity: 0, x: -8 }} animate={inView ? { opacity: 1, x: 0 } : {}} transition={{ duration: 0.5 }}
          style={{ marginBottom: "clamp(1.5rem, 3.5vw, 2.5rem)" }}
        >
          {sectionLabel && (
            <motion.div initial={{ opacity: 0, x: -12 }} animate={inView ? { opacity: 1, x: 0 } : {}} transition={{ duration: 0.5 }}
              style={{ display: "flex", alignItems: "center", gap: "0.85rem", marginBottom: "0.75rem" }}
            >
              <motion.div initial={{ scaleX: 0 }} animate={inView ? { scaleX: 1 } : {}} transition={{ duration: 0.8 }}
                style={{ width: "clamp(1.5rem, 4vw, 3rem)", height: "0.5px", background: ACCENT, transformOrigin: "left" }}
              />
              <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "0.72rem", fontWeight: 900, letterSpacing: "0.2em", textTransform: "uppercase", color: ACCENT }}>
                {sectionLabel}
              </span>
            </motion.div>
          )}
          <div style={{ display: "flex", alignItems: "center", gap: "0.85rem" }}>
            <motion.div initial={{ scaleX: 0 }} animate={inView ? { scaleX: 1 } : {}} transition={{ duration: 0.8, delay: 0.05 }}
              style={{ width: "clamp(1.5rem, 4vw, 3rem)", height: "0.5px", background: "rgba(255,255,255,0.25)", transformOrigin: "left" }}
            />
            <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "0.75rem", fontWeight: 900, letterSpacing: "0.2em", textTransform: "uppercase", color: "rgba(255,255,255,0.55)" }}>
              {String(index + 1).padStart(2, "0")} / {String(total).padStart(2, "0")}
            </span>
          </div>
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

        {/* Footnote - FIX: opacity 0.42â†’0.6, size min 0.82remâ†’0.95rem */}
        {footnote && (
          <motion.div
            initial={{ opacity: 0, y: 16 }} animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.7, delay: lines.length * 0.13 + 0.35 }}
            style={{ marginTop: "clamp(2rem, 4vw, 3.5rem)", paddingLeft: "1.25rem", borderLeft: "1.5px solid rgba(255,255,255,0.18)", maxWidth: "44ch" }}
          >
            <p style={{ fontFamily: "'Barlow', sans-serif", fontSize: "clamp(1rem, 1.3vw, 1.1rem)", fontWeight: 400, lineHeight: 1.8, color: "rgba(255,255,255,0.72)" }}>
              {footnote}
            </p>
          </motion.div>
        )}
      </div>

      {/* Brand mark bottom-right - decorative only, stays dim */}
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
  {
    lines:      [{ text: "The offseason" }, { text: "doesn't lie." }],
    footnote:   "You send athletes home and hope. Hope they stay sharp. Hope nobody takes something stupid. Hope camp isn't the first time you find out who put the work in.",
    isClimax:   false,
    threeLines: false,
  },
  {
    lines:      [{ text: "Your athletes" }, { text: "know it." }],
    footnote:   null,
    isClimax:   false,
    threeLines: false,
  },
  {
    lines:      [{ text: "Now" }, { text: "you will.", accent: true }],
    footnote:   null,
    isClimax:   true,
    threeLines: false,
  },
  {
    lines:      [{ text: "Built" }, { text: "different.", accent: true }],
    footnote:   "Other platforms do one thing well. CheckPeak puts game film, nutrition tracking, workout discipline, and NCAA compliance in a single platform - with features nobody else has built.",
    isClimax:   false,
    threeLines: false,
    watermark:  "EDGE",
  },
];

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   4. PROOF MOMENT
   FIX: Grid collapses to single column on mobile via flexbox + media query
   FIX: Eyebrow opacity 0.22â†’0.42, size 0.58remâ†’0.75rem
   FIX: Context text opacity 0.4â†’0.62, size min 0.82remâ†’0.95rem
   FIX: Supporting stat labels opacity 0.35â†’0.55
   FIX: Supporting stat sub-text opacity 0.22â†’0.45
   FIX: The 94% number uses clamp with reasonable mobile min (6rem)
â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
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
          {/* Eyebrow - FIX: opacity 0.22â†’0.42, size 0.58â†’0.75rem */}
          <motion.div initial={{ opacity: 0, x: -12 }} animate={inView ? { opacity: 1, x: 0 } : {}} transition={{ duration: 0.5 }}
            style={{ display: "flex", alignItems: "center", gap: "0.85rem", marginBottom: "clamp(1.25rem, 2.5vw, 2rem)" }}
          >
            <div style={{ width: "clamp(1.5rem, 3vw, 2.5rem)", height: "0.5px", background: "rgba(255,255,255,0.22)" }} />
            <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "0.78rem", fontWeight: 900, letterSpacing: "0.2em", textTransform: "uppercase", color: "rgba(255,255,255,0.62)" }}>
              Pilot program data
            </span>
          </motion.div>

          {/* Top rule */}
          <motion.div initial={{ scaleX: 0 }} animate={inView ? { scaleX: 1 } : {}} transition={{ duration: 0.9, delay: 0.08 }}
            style={{ height: "0.5px", background: "rgba(255,255,255,0.12)", marginBottom: "clamp(0.75rem, 1.5vw, 1.25rem)", transformOrigin: "left" }}
          />

          {/* The number - FIX: min 6rem so it's always visible on mobile */}
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

          {/* Context - FIX: opacity 0.4â†’0.62, size min 0.82â†’0.95rem */}
          <motion.div initial={{ opacity: 0, y: 16 }} animate={inView ? { opacity: 1, y: 0 } : {}} transition={{ duration: 0.7, delay: 0.55 }}
            style={{ paddingLeft: "1.1rem", borderLeft: "1.5px solid rgba(255,255,255,0.15)", maxWidth: "40ch" }}
          >
            <p style={{ fontFamily: "'Barlow', sans-serif", fontSize: "clamp(1rem, 1.3vw, 1.1rem)", fontWeight: 400, lineHeight: 1.8, color: "rgba(255,255,255,0.72)" }}>
              of compliance issues caught in pilot programs were invisible to staff the previous offseason. Not hidden. Just unseen.
            </p>
          </motion.div>
        </div>

        {/* Right: supporting stats - desktop only via .proof-stats-col */}
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
              {/* FIX: label opacity 0.35â†’0.58, size 0.65â†’0.75rem */}
              <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "0.75rem", fontWeight: 900, letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(255,255,255,0.58)", marginBottom: "0.2rem" }}>{label}</p>
              {/* FIX: sub opacity 0.22â†’0.45, size 0.7â†’0.8rem */}
              <p style={{ fontFamily: "'Barlow', sans-serif", fontSize: "0.88rem", color: "rgba(255,255,255,0.62)", lineHeight: 1.6, maxWidth: "18ch" }}>{sub}</p>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   SOCIAL PROOF - Editorial quote section
â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
function SocialProof() {
  const ref    = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-10%" });

  const quotes = [
    {
      text: "We spent all spring building accountability. Then they'd leave campus and it'd disappear. Now that standard travels with them.",
      credit: "Head S&C Coach",
      program: "Division II Football",
      accent: ACCENT,
    },
    {
      text: "We cut three separate subscriptions and replaced them all with one platform. It's the first tool my athletes actually open every day.",
      credit: "Athletic Director",
      program: "NAIA Athletic Program",
      accent: "#3FB950",
    },
    {
      text: "Pushing film directly to their phone - and seeing who watched it - changed how we run film study completely.",
      credit: "Head Coach",
      program: "Division III Basketball",
      accent: "#A78BFA",
    },
  ];

  return (
    <section
      ref={ref}
      style={{
        width:     "100%",
        background: BLACK,
        padding:   "clamp(5rem, 10vw, 9rem) clamp(1.25rem, 7vw, 7rem)",
        borderTop: "0.5px solid rgba(255,255,255,0.08)",
        position:  "relative",
        overflow:  "hidden",
      }}
    >
      <div aria-hidden="true" style={{
        position: "absolute", inset: 0, zIndex: 1,
        backgroundImage: GRAIN_URL, backgroundRepeat: "repeat",
        backgroundSize: "256px 256px", opacity: 0.04,
        mixBlendMode: "screen", pointerEvents: "none",
      }} />

      <div style={{ position: "relative", zIndex: 2 }}>
        <motion.div
          initial={{ opacity: 0, x: -12 }} animate={inView ? { opacity: 1, x: 0 } : {}}
          transition={{ duration: 0.5 }}
          style={{ display: "flex", alignItems: "center", gap: "0.85rem", marginBottom: "clamp(3rem, 6vw, 5rem)" }}
        >
          <motion.div
            initial={{ scaleX: 0 }} animate={inView ? { scaleX: 1 } : {}}
            transition={{ duration: 0.8 }}
            style={{ width: "clamp(1.5rem, 4vw, 3rem)", height: "0.5px", background: "rgba(255,255,255,0.22)", transformOrigin: "left" }}
          />
          <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "0.75rem", fontWeight: 900, letterSpacing: "0.2em", textTransform: "uppercase", color: "rgba(255,255,255,0.58)" }}>
            What coaches are saying
          </span>
        </motion.div>

        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: "clamp(1.25rem, 2.5vw, 2rem)",
        }}>
          {quotes.map((q, i) => (
            <motion.div key={i}
              initial={{ opacity: 0, y: 32 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.8, delay: i * 0.12, ease: [0.16, 1, 0.3, 1] }}
              style={{
                padding: "clamp(1.5rem, 3vw, 2rem)",
                background: "#0B0F17",
                border: "0.5px solid rgba(255,255,255,0.08)",
                borderTop: `3px solid ${q.accent}`,
                borderRadius: 2,
              }}
            >
              <div style={{
                fontFamily: "'Barlow Condensed', sans-serif",
                fontWeight: 900, fontSize: "2.5rem",
                color: q.accent, lineHeight: 0.8,
                marginBottom: "0.65rem", opacity: 0.55,
              }}>&ldquo;</div>

              <p style={{
                fontFamily: "'Barlow Condensed', sans-serif",
                fontWeight: 700, fontStyle: "italic",
                fontSize: "clamp(1.05rem, 1.8vw, 1.3rem)",
                lineHeight: 1.45, color: WHITE,
                marginBottom: "1.5rem", letterSpacing: "-0.01em",
              }}>
                {q.text}
              </p>

              <div style={{ borderTop: "0.5px solid rgba(255,255,255,0.08)", paddingTop: "1rem" }}>
                <p style={{
                  fontFamily: "'Barlow Condensed', sans-serif",
                  fontWeight: 900, fontSize: "0.68rem",
                  letterSpacing: "0.14em", textTransform: "uppercase",
                  color: q.accent, marginBottom: "0.2rem",
                }}>{q.credit}</p>
                <p style={{
                  fontFamily: "'Barlow', sans-serif",
                  fontSize: "0.82rem", color: "rgba(255,255,255,0.58)",
                }}>{q.program}</p>
              </div>
            </motion.div>
          ))}
        </div>

        <motion.p
          initial={{ opacity: 0 }} animate={inView ? { opacity: 1 } : {}}
          transition={{ duration: 0.6, delay: 0.7 }}
          style={{
            textAlign: "center",
            marginTop: "clamp(2.5rem, 5vw, 4rem)",
            fontFamily: "'Barlow Condensed', sans-serif",
            fontWeight: 700, fontSize: "0.7rem",
            letterSpacing: "0.18em", textTransform: "uppercase",
            color: "rgba(255,255,255,0.40)",
          }}
        >
          Names withheld by request Â· Pilot program participants
        </motion.p>
      </div>
    </section>
  );
}

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   6. FINAL CTA
   FIX: Eyebrow opacity 0.22â†’0.5, size 0.62remâ†’0.82rem - it's real content
   FIX: Sub-label "30 days free" opacity 0.22â†’0.5, size 0.65â†’0.8rem
   FIX: Athlete link opacity 0.35â†’0.55, size 0.58â†’0.78rem - functional link
   FIX: Disclaimer opacity 0.12â†’0.22, size 0.55â†’0.65rem - legal minimum
   FIX: Bottom absolute elements get padding to avoid overlap on short phones
â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
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
        {/* Eyebrow - FIX: opacity 0.22â†’0.5, size 0.62â†’0.82rem */}
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
          {/* FIX: opacity 0.22â†’0.5, size 0.65â†’0.8rem */}
          <p style={{ fontFamily: "'Barlow', sans-serif", fontSize: "0.85rem", letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(255,255,255,0.65)" }}>
            30 days free Â· No credit card Â· Unlimited athletes
          </p>
        </motion.div>
      </div>

      {/* Bottom-right legal - FIX: opacity 0.12â†’0.25, size 0.55â†’0.68rem */}
      <div style={{ position: "absolute", bottom: "clamp(1.25rem, 2.5vw, 2rem)", right: "clamp(1.25rem, 4vw, 2.5rem)", zIndex: 1 }}>
        <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "0.72rem", letterSpacing: "0.08em", color: "rgba(255,255,255,0.42)", textAlign: "right", lineHeight: 1.6, maxWidth: "26ch" }}>
          Screening does not replace governing body verification.
        </p>
      </div>
    </section>
  );
}

function PromoVideo() {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-10%" });
  const [playing, setPlaying] = useState(false);
  const videoRef = useRef(null);

  const handlePlay = () => {
    if (videoRef.current) {
      videoRef.current.play();
      setPlaying(true);
    }
  };

  return (
    <section
      ref={ref}
      style={{
        width: "100%",
        background: BLACK,
        padding: "clamp(5rem, 10vw, 9rem) clamp(1.25rem, 7vw, 7rem)",
        borderTop: "0.5px solid rgba(255,255,255,0.08)",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Film grain */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute", inset: 0, zIndex: 1,
          backgroundImage: GRAIN_URL, backgroundRepeat: "repeat",
          backgroundSize: "256px 256px", opacity: 0.04,
          mixBlendMode: "screen", pointerEvents: "none",
        }}
      />

      {/* Ambient glow */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute", left: "50%", top: "50%",
          transform: "translate(-50%, -50%)",
          width: "70vw", height: "40vw",
          borderRadius: "50%", zIndex: 0, pointerEvents: "none",
          background: "radial-gradient(ellipse, rgba(79,171,255,0.07) 0%, transparent 70%)",
        }}
      />

      {/* Content */}
      <div style={{ position: "relative", zIndex: 2 }}>

        {/* Eyebrow */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={inView ? { opacity: 1 } : {}}
          transition={{ duration: 0.5 }}
          style={{
            display: "flex", alignItems: "center",
            gap: "0.85rem", justifyContent: "center",
            marginBottom: "clamp(1.5rem, 3vw, 2.5rem)",
          }}
        >
          <motion.div
            initial={{ scaleX: 0 }}
            animate={inView ? { scaleX: 1 } : {}}
            transition={{ duration: 0.8 }}
            style={{
              width: "clamp(1.5rem, 4vw, 3rem)", height: "0.5px",
              background: "rgba(255,255,255,0.22)", transformOrigin: "left",
            }}
          />
          <span
            style={{
              fontFamily: "'Barlow Condensed', sans-serif",
              fontSize: "0.75rem", fontWeight: 900,
              letterSpacing: "0.2em", textTransform: "uppercase",
              color: "rgba(255,255,255,0.58)",
            }}
          >
            The proof
          </span>
          <motion.div
            initial={{ scaleX: 0 }}
            animate={inView ? { scaleX: 1 } : {}}
            transition={{ duration: 0.8 }}
            style={{
              width: "clamp(1.5rem, 4vw, 3rem)", height: "0.5px",
              background: "rgba(255,255,255,0.22)", transformOrigin: "right",
            }}
          />
        </motion.div>

        {/* Headline */}
        <motion.div
          initial={{ opacity: 0, y: 32 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.9, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
          style={{ textAlign: "center", marginBottom: "clamp(2.5rem, 5vw, 4rem)" }}
        >
          <p
            style={{
              fontFamily: "'Barlow Condensed', sans-serif",
              fontWeight: 900, fontStyle: "italic",
              fontSize: "clamp(2.5rem, 7vw, 7rem)",
              lineHeight: 0.88, letterSpacing: "-0.03em",
              textTransform: "uppercase", color: WHITE,
            }}
          >
            This is what{" "}
            <span style={{ color: ACCENT }}>ready</span>
            {" "}looks like.
          </p>
        </motion.div>

        {/* Video wrapper */}
        <motion.div
          initial={{ opacity: 0, y: 48 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 1.2, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
          style={{
            maxWidth: 960, margin: "0 auto",
            borderRadius: 12, overflow: "hidden",
            position: "relative", aspectRatio: "16/9",
            transform: "perspective(1400px) rotateX(1deg)",
            transformOrigin: "center top",
            boxShadow: [
              "0 2px 0 rgba(255,255,255,0.07)",
              "0 32px 100px rgba(0,0,0,0.85)",
              "0 12px 40px rgba(0,0,0,0.6)",
              "0 0 0 1px rgba(255,255,255,0.08)",
              "0 0 80px rgba(79,171,255,0.08)",
            ].join(", "),
          }}
        >
          <video
            ref={videoRef}
            controls={playing}
            playsInline
            preload="none"
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
            style={{
              width: "100%", height: "100%",
              display: "block", objectFit: "cover",
            }}
          >
            <source src="/video/app-promo.mp4" type="video/mp4" />
            <track kind="captions" src="/video/app-promo.vtt" srcLang="en" label="English" default />
          </video>

          {!playing && (
            <>
              {/* Lazy-loaded poster image - sibling of overlay so it's visible behind it */}
              <Image
                src="/images/promo-poster.jpg"
                alt=""
                fill
                sizes="(max-width: 767px) 100vw, 60vw"
                style={{ objectFit: "cover" }}
              />
              <div
                onClick={handlePlay}
                style={{
                  position: "absolute", inset: 0,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  background: "rgba(6,8,16,0.35)",
                  cursor: "none",
                }}
              >
              <motion.div
                whileHover={{ scale: 1.08 }}
                whileTap={{ scale: 0.96 }}
                style={{
                  width: "clamp(56px, 8vw, 80px)",
                  height: "clamp(56px, 8vw, 80px)",
                  borderRadius: "50%",
                  background: ACCENT,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  boxShadow: "0 0 0 12px rgba(79,171,255,0.15), 0 8px 32px rgba(0,0,0,0.5)",
                }}
              >
                <svg
                  width="28" height="28" viewBox="0 0 24 24"
                  fill="#060810" stroke="none"
                  style={{ marginLeft: "3px" }}
                >
                  <polygon points="5 3 19 12 5 21 5 3" />
                </svg>
              </motion.div>
              </div>
            </>
          )}
        </motion.div>

        {/* Caption */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={inView ? { opacity: 1 } : {}}
          transition={{ duration: 0.6, delay: 0.9 }}
          style={{
            textAlign: "center",
            marginTop: "clamp(1.5rem, 3vw, 2.5rem)",
            fontFamily: "'Barlow Condensed', sans-serif",
            fontWeight: 700, fontSize: "0.88rem",
            letterSpacing: "0.18em", textTransform: "uppercase",
            color: "rgba(255,255,255,0.55)",
          }}
        >
          No excuses.&nbsp;&nbsp;No surprises.&nbsp;&nbsp;No shortcuts.
        </motion.p>

        {/* Dual CTA */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 1.1 }}
          style={{
            display: "flex", alignItems: "center", justifyContent: "center",
            gap: "clamp(1rem, 3vw, 2.5rem)",
            marginTop: "clamp(1.5rem, 3vw, 2.5rem)",
            flexWrap: "wrap",
          }}
        >
          <PilotButton source="promo_video" size="md" />

          <div style={{ width: "1px", height: "32px", background: "rgba(255,255,255,0.12)" }} />

           <a
            href="https://apps.apple.com/us/app/checkpeak/id6769081617"
            onClick={() => track("promo_video_athlete_download")}
            style={{
              display: "inline-flex", alignItems: "center", gap: "0.65rem",
              fontFamily: "'Barlow Condensed', sans-serif",
              fontSize: "0.92rem", fontWeight: 900,
              letterSpacing: "0.12em", textTransform: "uppercase",
              color: "rgba(255,255,255,0.62)",
              textDecoration: "none", transition: "color 0.18s",
            }}
            onMouseEnter={e => { e.currentTarget.style.color = WHITE; }}
            onMouseLeave={e => { e.currentTarget.style.color = "rgba(255,255,255,0.62)"; }}
          >
            <svg
              width="15" height="15" viewBox="0 0 24 24"
              fill="none" stroke="currentColor"
              strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
            >
              <path d="M12 2a7 7 0 0 1 7 7c0 5-7 13-7 13S5 14 5 9a7 7 0 0 1 7-7z" />
              <circle cx="12" cy="9" r="2.5" />
            </svg>
            Athlete? Download the app
          </a>
        </motion.div>

      </div>
    </section>
  );
}

const STRUCTURED_DATA = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": "https://checkpeak.com/#organization",
      name: "CheckPeak",
      url: "https://checkpeak.com",
      logo: "https://checkpeak.com/favicon-512x512.png",
      email: "support@checkpeak.com",
      sameAs: ["https://x.com/checkPeak_", "https://apps.apple.com/us/app/checkpeak/id6769081617"],
    },
    {
      "@type": "SoftwareApplication",
      name: "CheckPeak",
      applicationCategory: "SportsApplication",
      operatingSystem: "Web, iOS",
      description: "Program-wide athlete accountability for collegiate strength programs: film, nutrition, workouts, check-ins, and NCAA compliance in one platform.",
      publisher: { "@id": "https://checkpeak.com/#organization" },
      offers: [
        { "@type": "Offer", name: "Starter", price: "0", priceCurrency: "USD", description: "Free for up to 10 athletes" },
        { "@type": "Offer", name: "Program", price: "99", priceCurrency: "USD", description: "Unlimited athletes, billed monthly" },
      ],
    },
  ],
};

// ---------------------------------------------------------------------------
// PAGE
// ---------------------------------------------------------------------------
export default function HomePage() {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ?? "https://checkpeak.com";
  const ogDesc  = "Program-wide athlete accountability. Film, nutrition, workouts, attendance, and check-ins - all in one platform.";

  return (
    <>
      <style>{GLOBAL_STYLE}</style>
      <Head>
        <title>CheckPeak - Collegiate Athlete Accountability Platform</title>
        <meta name="description" content="CheckPeak gives collegiate strength programs full off-campus accountability - film, nutrition, workouts, and NCAA compliance in one platform." />
        <meta property="og:title"        content="CheckPeak - Program-Wide Athlete Accountability" />
        <meta property="og:description"  content={ogDesc} />
        <meta property="og:type"         content="website" />
        <meta property="og:url"          content={siteUrl} />
        <meta property="og:image"        content={`${siteUrl}/api/og-image?q=${encodeURIComponent(ogDesc)}`} />
        <meta property="og:image:width"  content="1200" />
        <meta property="og:image:height" content="630" />
        <meta name="twitter:card"        content="summary_large_image" />
        <meta name="twitter:site"        content="@checkPeak_" />
        <meta name="twitter:title"       content="CheckPeak - Program-Wide Athlete Accountability" />
        <meta name="twitter:description" content={ogDesc} />
        <meta name="twitter:image"       content={`${siteUrl}/api/og-image?q=${encodeURIComponent(ogDesc)}`} />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(STRUCTURED_DATA) }}
        />
      </Head>

      <Cursor />

      <main style={{ background: BLACK, color: WHITE }}>
        <Hero />

        {/* Triptych: visual proof immediately after hero - image before copy */}
        <TriptychSection />

        {/* Beat 1: "The offseason doesn't lie." - first beat signals the org product */}
        <DeclarationBeat index={0} lines={BEATS[0].lines} footnote={BEATS[0].footnote}
          isClimax={false} threeLines={false} bgImage={BEAT_IMAGES[0]} watermark={BEAT_WATERMARKS[0]} total={4}
          sectionLabel="For collegiate programs" />

        {/* Beat 2: "Your athletes know it." */}
        <DeclarationBeat index={1} lines={BEATS[1].lines} footnote={BEATS[1].footnote}
          isClimax={false} threeLines={false} bgImage={BEAT_IMAGES[1]} watermark={BEAT_WATERMARKS[1]} total={4} />

        {/* Beat 3: "Now you will." */}
        <DeclarationBeat index={2} lines={BEATS[2].lines} footnote={BEATS[2].footnote}
          isClimax={true} threeLines={false} bgImage={BEAT_IMAGES[2]} watermark={BEAT_WATERMARKS[2]} total={4} />

        {/* Beat 4: "Built around the rules." */}
        <DeclarationBeat index={3} lines={BEATS[3].lines} footnote={BEATS[3].footnote}
          isClimax={false} threeLines={false} watermark={BEATS[3].watermark} total={4} />

        <ComparisonMoment />

        <ProofMoment />
        <SocialProof />

        {/* Proof video + CTA - closes the argument after testimonials */}
        <PromoVideo />

        <FinalCta />
      </main>
    </>
  );
}
