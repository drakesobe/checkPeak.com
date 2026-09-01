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

// ARENA_STYLE injected alongside GLOBAL_STYLE in <style> tags

// ---------------------------------------------------------------------------
// Grain overlay - SVG noise, same technique as A24/Nike editorial pages
// ---------------------------------------------------------------------------
const GRAIN_URL = `url("data:image/svg+xml,%3Csvg viewBox='0 0 512 512' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`;

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

// ---------------------------------------------------------------------------
// Trainer showcase grid styles (added to GLOBAL_STYLE via injection)
// ---------------------------------------------------------------------------
const ARENA_STYLE = `
  .trainer-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: clamp(1rem, 2vw, 1.5rem);
  }
  @media (max-width: 860px) { .trainer-grid { grid-template-columns: 1fr 1fr; } }
  @media (max-width: 520px) { .trainer-grid { grid-template-columns: 1fr; } }
  .hero-dual-cta { display: flex; flex-wrap: wrap; justify-content: center; gap: 1rem; }
`;

// Get Started — low-friction signup for individual coaches & trainers
function GetStartedButton({ source, size = "md" }) {
  const lg = size === "lg";
  return (
    <button
      type="button"
      onClick={() => {
        track("cta_get_started", { source });
        openAuthModal({ tab: "signup" });
      }}
      style={{
        display: "inline-flex", alignItems: "center",
        gap: lg ? "0.85rem" : "0.65rem",
        padding: lg ? "1.1rem 2.5rem" : "0.9rem 2rem",
        background: ACCENT, color: BLACK,
        fontFamily: "'Barlow Condensed', sans-serif",
        fontSize: lg ? "1.05rem" : "0.92rem", fontWeight: 900,
        letterSpacing: "0.12em", textTransform: "uppercase",
        border: "none", transition: "filter 0.2s", cursor: "pointer",
      }}
      onMouseEnter={e => { e.currentTarget.style.filter = "brightness(1.15)"; }}
      onMouseLeave={e => { e.currentTarget.style.filter = "none"; }}
    >
      GET STARTED
      <svg width={lg ? 18 : 15} height={lg ? 18 : 15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
      </svg>
    </button>
  );
}

// For Athletic Programs / ADs — higher-touch walkthrough booking
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

// ---------------------------------------------------------------------------
// TRAINER SHOWCASE - Who's in The Arena
// ---------------------------------------------------------------------------
const ARENA_TRAINERS = [
  {
    initials: "JC", name: "Joe Coy", specialty: "Strength & Conditioning Coach",
    bio: "UK-based coach specialising in athlete testing, performance profiling, and evidence-based training. Founder of ATHLETE35.",
    tags: ["Athlete Testing", "Performance Profiling", "Evidence-Based"],
    tiers: [{ label: "Basic", price: 24.99 }, { label: "Premium", price: 54.99 }, { label: "Ultra", price: 149.99 }],
    accent: ACCENT, slug: "joe-coy-6leb",
  },
  {
    initials: "HT", name: "Hunter Tuck", specialty: "Massage Therapist & Personal Trainer",
    bio: "12 years as a Massage Therapist, 5 as a Personal Trainer and Corrective Exercise Specialist. Focused on overcoming pain and movement dysfunction.",
    tags: ["Corrective Exercise", "Recovery", "Pain Relief"],
    tiers: [{ label: "Basic", price: 25 }, { label: "Premium", price: 65 }, { label: "Ultra", price: 150 }],
    accent: "#3FB950", slug: "hunter-tuck-snaa",
  },
];

function TrainerShowcase() {
  const ref    = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-10%" });

  return (
    <section id="arena-trainers" style={{
      width: "100%", background: BLACK,
      padding: "clamp(5rem, 10vw, 9rem) clamp(1.25rem, 7vw, 7rem)",
      borderTop: "0.5px solid rgba(255,255,255,0.08)",
      position: "relative", overflow: "hidden",
    }}>
      <div aria-hidden="true" style={{ position: "absolute", inset: 0, backgroundImage: GRAIN_URL, backgroundRepeat: "repeat", backgroundSize: "256px 256px", opacity: 0.04, mixBlendMode: "screen", pointerEvents: "none" }} />

      <div ref={ref} style={{ position: "relative", zIndex: 1 }}>
        {/* Eyebrow */}
        <motion.div initial={{ opacity: 0, x: -12 }} animate={inView ? { opacity: 1, x: 0 } : {}} transition={{ duration: 0.5 }}
          style={{ display: "flex", alignItems: "center", gap: "0.85rem", marginBottom: "clamp(1.25rem, 2.5vw, 2rem)" }}
        >
          <motion.div initial={{ scaleX: 0 }} animate={inView ? { scaleX: 1 } : {}} transition={{ duration: 0.8 }}
            style={{ width: "clamp(1.5rem, 4vw, 3rem)", height: "0.5px", background: ACCENT, transformOrigin: "left" }}
          />
          <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "0.72rem", fontWeight: 900, letterSpacing: "0.2em", textTransform: "uppercase", color: ACCENT }}>
            The Arena
          </span>
        </motion.div>

        <motion.h2 initial={{ opacity: 0, y: 32 }} animate={inView ? { opacity: 1, y: 0 } : {}} transition={{ duration: 0.9, delay: 0.08, ease: [0.16, 1, 0.3, 1] }}
          style={{
            fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontStyle: "italic",
            fontSize: "clamp(2.5rem, 7vw, 7rem)", lineHeight: 0.88, letterSpacing: "-0.025em",
            textTransform: "uppercase", color: WHITE, marginBottom: "clamp(3rem, 6vw, 5rem)",
          }}
        >
          Train with<br />
          <span style={{ color: ACCENT }}>coaches.</span>
        </motion.h2>

        <div className="trainer-grid">
          {/* Real trainer cards */}
          {ARENA_TRAINERS.map((t, i) => (
            <motion.div key={t.slug}
              initial={{ opacity: 0, y: 32 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.7, delay: 0.18 + i * 0.1, ease: [0.16, 1, 0.3, 1] }}
              style={{ background: "#0B0F17", border: "0.5px solid rgba(255,255,255,0.1)", borderTop: `3px solid ${t.accent}`, borderRadius: 2, overflow: "hidden" }}
            >
              <div style={{ padding: "clamp(1.25rem, 2.5vw, 1.75rem)", borderBottom: "0.5px solid rgba(255,255,255,0.07)" }}>
                <div style={{ width: 44, height: 44, borderRadius: "50%", background: `${t.accent}1A`, border: `1.5px solid ${t.accent}44`, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "0.85rem" }}>
                  <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: "0.95rem", color: t.accent }}>{t.initials}</span>
                </div>
                <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: "clamp(1.3rem, 2.2vw, 1.65rem)", lineHeight: 1, color: WHITE, marginBottom: "0.3rem" }}>{t.name}</p>
                <p style={{ fontFamily: "'Barlow', sans-serif", fontSize: "0.88rem", color: "rgba(255,255,255,0.65)", marginBottom: "0.75rem" }}>{t.specialty}</p>
                <p style={{ fontFamily: "'Barlow', sans-serif", fontSize: "0.88rem", lineHeight: 1.7, color: "rgba(255,255,255,0.68)", marginBottom: "0.9rem" }}>{t.bio}</p>
                <div style={{ display: "flex", gap: "0.35rem", flexWrap: "wrap" }}>
                  {t.tags.map(tag => (
                    <span key={tag} style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "0.72rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", padding: "2px 8px", border: "0.5px solid rgba(255,255,255,0.2)", color: "rgba(255,255,255,0.55)" }}>{tag}</span>
                  ))}
                </div>
              </div>
              {/* Pricing tiers */}
              <div style={{ display: "flex", borderBottom: "0.5px solid rgba(255,255,255,0.07)" }}>
                {t.tiers.map(({ label, price }, idx) => (
                  <div key={label} style={{ flex: 1, padding: "0.75rem 0.5rem", textAlign: "center", borderLeft: idx > 0 ? "0.5px solid rgba(255,255,255,0.07)" : "none" }}>
                    <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontStyle: "italic", fontSize: "1rem", color: idx === 0 ? "rgba(255,255,255,0.6)" : idx === 1 ? t.accent : WHITE, lineHeight: 1, marginBottom: "0.15rem" }}>${price}</p>
                    <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "0.68rem", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(255,255,255,0.45)" }}>{label}</p>
                  </div>
                ))}
              </div>
              <div style={{ padding: "0.85rem 1rem" }}>
                <a href={`/trainer/${t.slug}`}
                  onClick={() => track("trainer_card_view", { trainer: t.slug })}
                  style={{ width: "100%", padding: "0.65rem 1rem", background: "transparent", border: `0.5px solid ${t.accent}44`, fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: "0.75rem", letterSpacing: "0.12em", textTransform: "uppercase", color: t.accent, display: "flex", alignItems: "center", justifyContent: "center", gap: "0.45rem", transition: "background 0.18s, border-color 0.18s", textDecoration: "none" }}
                  onMouseEnter={e => { e.currentTarget.style.background = `${t.accent}0F`; e.currentTarget.style.borderColor = t.accent; }}
                  onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.borderColor = `${t.accent}44`; }}
                >
                  View Program
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
                  </svg>
                </a>
              </div>
            </motion.div>
          ))}

          {/* Trainer recruitment card */}
          <motion.div
            initial={{ opacity: 0, y: 32 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.7, delay: 0.38, ease: [0.16, 1, 0.3, 1] }}
            style={{ background: "transparent", border: "1px dashed rgba(255,255,255,0.12)", borderRadius: 2, overflow: "hidden", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "clamp(2rem, 4vw, 3rem) 1.5rem", textAlign: "center", minHeight: "260px" }}
          >
            <div style={{ width: 44, height: 44, borderRadius: "50%", border: "1.5px dashed rgba(255,255,255,0.2)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "1.25rem" }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
            </div>
            <div style={{ marginBottom: "0.75rem" }}>
              <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "0.6rem", fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", padding: "2px 8px", border: "0.5px solid rgba(79,171,255,0.35)", color: ACCENT, background: "rgba(79,171,255,0.06)" }}>
                Applications open
              </span>
            </div>
            <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: "1.1rem", color: WHITE, letterSpacing: "-0.01em", marginBottom: "0.5rem" }}>
              8 of 10 spots filled.
            </p>
            <p style={{ fontFamily: "'Barlow', sans-serif", fontSize: "0.88rem", color: "rgba(255,255,255,0.58)", lineHeight: 1.65, marginBottom: "1.5rem", maxWidth: "22ch" }}>
              Partner spots in The Arena are limited. Apply to launch your library and earn recurring revenue.
            </p>
            <a href="/commercial/onboard"
              onClick={() => track("trainer_recruitment_cta")}
              style={{ display: "inline-flex", alignItems: "center", gap: "0.45rem", fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: "0.75rem", letterSpacing: "0.12em", textTransform: "uppercase", color: ACCENT, textDecoration: "none", border: `0.5px solid ${ACCENT}55`, padding: "0.6rem 1rem", transition: "color 0.18s, border-color 0.18s, background 0.18s" }}
              onMouseEnter={e => { e.currentTarget.style.background = `${ACCENT}12`; e.currentTarget.style.borderColor = ACCENT; }}
              onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.borderColor = `${ACCENT}55`; }}
            >
              Apply for a Spot
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
              </svg>
            </a>
          </motion.div>
        </div>

        <motion.p initial={{ opacity: 0 }} animate={inView ? { opacity: 1 } : {}} transition={{ duration: 0.5, delay: 0.7 }}
          style={{ textAlign: "center", marginTop: "clamp(2rem, 4vw, 3.5rem)", fontFamily: "'Barlow', sans-serif", fontSize: "0.88rem", color: "rgba(255,255,255,0.48)", letterSpacing: "0.05em" }}
        >
          More trainers joining The Arena every month.
        </motion.p>
      </div>
    </section>
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
            /* Mobile: true center - no horizontal shift */
            object-position: center center;
          }
          /* Desktop only: nudge right slightly to favour the subject */
          @media (min-width: 768px) {
            .hero-video { object-position: 55% center; }
          }
        `}</style>
        <video autoPlay muted loop playsInline preload="none"
          className="hero-video"
          poster="/images/athlete-barbell-squat-rack-offseason-training.jpg"
        >
          <source src="/video/hero-loop.mp4" type="video/mp4" />
        </video>
        <div style={{ position: "absolute", inset: 0, background: "rgba(6,8,16,0.62)" }} />
        <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse 80% 80% at 50% 50%, transparent 30%, rgba(6,8,16,0.5) 100%)" }} />
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: "35%", background: `linear-gradient(to bottom, transparent, ${BLACK})` }} />
      </motion.div>

      {/* Nav */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.7, delay: 0.6 }}
        className="hero-nav"
        style={{ position: "absolute", top: "clamp(1.25rem, 3vw, 2rem)", right: "clamp(1.25rem, 4vw, 2.5rem)", zIndex: 10, gap: "1.75rem" }}
      >
        {[
          { label: "The Arena",        href: null,       action: () => { track("nav_click", { label: "The Arena" });        document.getElementById("arena-trainers")?.scrollIntoView({ behavior: "smooth" }); } },
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

      {/* Center headline */}
      <motion.div style={{ opacity, position: "relative", zIndex: 10, textAlign: "center", padding: "0 clamp(1.25rem, 5vw, 3rem)" }}>

        {/* CheckPeak brand chip */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.2 }}
          style={{ display: "inline-flex", alignItems: "center", gap: "0.6rem", marginBottom: "clamp(0.5rem, 1vw, 0.85rem)" }}
        >
          <div style={{ width: "1.75rem", height: "0.5px", background: ACCENT }} />
          <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "0.68rem", fontWeight: 900, letterSpacing: "0.24em", textTransform: "uppercase", color: ACCENT }}>CheckPeak</span>
          <div style={{ width: "1.75rem", height: "0.5px", background: ACCENT }} />
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 32 }} animate={{ opacity: 1, y: 0 }}
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
      </motion.div>

      {/* Scroll indicator */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.4, duration: 0.8 }}
        style={{ position: "absolute", bottom: "clamp(1.25rem, 3vw, 2rem)", left: "50%", transform: "translateX(-50%)", zIndex: 10, display: "flex", flexDirection: "column", alignItems: "center", gap: "0.5rem" }}
      >
        {/* FIX: opacity 0.25 → 0.45, size 0.58rem → 0.72rem */}
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

/* ══════════════════════════════════════════════════════════════════════════
   2. DECLARATIONS
   Three full-viewport beats with ghost images, grain, and structure.

   FIX: Vertical padding reduced from clamp(6rem, 12vw, 10rem)
        to clamp(3.5rem, 8vw, 8rem) - content was cut off on phones.
   FIX: Beat 2 (3 lines) gets its own smaller font clamp so three stacked
        lines don't overflow a 390px viewport.
   FIX: Footnote opacity 0.42 → 0.6, size min 0.82rem → 0.95rem.
   FIX: Section counter opacity 0.2 → 0.35, size 0.58rem → 0.72rem.
   FIX: Watermark hidden on mobile - it clips and looks broken on phones.
══════════════════════════════════════════════════════════════════════════ */
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

        {/* Footnote - FIX: opacity 0.42→0.6, size min 0.82rem→0.95rem */}
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
    lines:      [{ text: "Built around" }, { text: "the rules.", accent: true }],
    footnote:   "Bylaw 16. Bylaw 17. VARA. CARA. Most platforms ignore them and hope nobody checks. We built CheckPeak around them from day one - because a compliance violation isn't a bug. It's a career. Every feature exists inside the line. Not despite it.",
    isClimax:   false,
    threeLines: false,
    watermark:  "COMPLIANT",
  },
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
          {/* Eyebrow - FIX: opacity 0.22→0.42, size 0.58→0.75rem */}
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

          {/* Context - FIX: opacity 0.4→0.62, size min 0.82→0.95rem */}
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
              {/* FIX: label opacity 0.35→0.58, size 0.65→0.75rem */}
              <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "0.75rem", fontWeight: 900, letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(255,255,255,0.58)", marginBottom: "0.2rem" }}>{label}</p>
              {/* FIX: sub opacity 0.22→0.45, size 0.7→0.8rem */}
              <p style={{ fontFamily: "'Barlow', sans-serif", fontSize: "0.88rem", color: "rgba(255,255,255,0.62)", lineHeight: 1.6, maxWidth: "18ch" }}>{sub}</p>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

// Colours used in ComplianceMoment product mock
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

function _ProductMoment_REMOVED() {
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
      /* No hard border - gradient overlay on the section itself
         handles the transition from the section above            */
      position:   "relative",
    }}>

      {/* Top gradient - softens the edge from the section above.
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

      {/* Interface mock - wrapped in browser chrome so the light UI
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
          /* Layered shadow - close dark + wide diffuse blue glow */
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
            window" - bridging the dark editorial page and the
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

          {/* Right side - tabs hint */}
          <div style={{ display: "flex", gap: 6, flexShrink: 0, opacity: 0.3 }}>
            {[1, 2, 3].map(i => (
              <div key={i} style={{ width: 14, height: 2, borderRadius: 1, background: "rgba(255,255,255,0.6)" }} />
            ))}
          </div>
        </div>

        {/* ── NAV BAR - matches NavBar component exactly ── */}
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

            {/* ── SUMMARY HERO - matches SummaryHero component ── */}
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

            {/* ── READINESS STRIP - matches ReadinessStrip component ── */}
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

            {/* ── QUEUE CARDS - first two athletes needing action ── */}
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

            {/* ── ROSTER STRIP - condensed athlete list ── */}
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
   COMPLIANCE MOMENT v2 - fixes:
   1. Modal no longer clips - container has explicit minHeight, ghost grid
      is decorative strips only (not height-determining cells).
   2. Connector pill is centered and properly sized, not full-width.
   3. Warning icon is ⚠ character, not the word "warning".
   4. "the line." accent period is blue like the rest of the word.
══════════════════════════════════════════════════════════════════════════ */

function ComplianceMoment() {
  const ref    = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-10%" });

  const periods = [
    { name: "Fall Season",      dates: "Sep 1 – Nov 30",  tone: "safe",    vara: null             },
    { name: "Winter Break",     dates: "Dec 15 – Jan 5",  tone: "banned",  vara: "VARA Required"  },
    { name: "Spring Preseason", dates: "Jan 20 – Feb 28", tone: "brand",   vara: null             },
    { name: "Out of Season",    dates: "Mar 1 – Aug 15",  tone: "caution", vara: "VARA Preferred" },
  ];

  const toneColor = {
    brand:   { bg: "rgba(0,112,204,0.09)",  border: "rgba(0,112,204,0.25)",  text: "#0070CC", dot: "#0070CC" },
    safe:    { bg: "rgba(10,138,74,0.09)",  border: "rgba(10,138,74,0.25)",  text: "#0A8A4A", dot: "#0A8A4A" },
    caution: { bg: "rgba(196,122,0,0.09)",  border: "rgba(196,122,0,0.25)",  text: "#C47A00", dot: "#C47A00" },
    banned:  { bg: "rgba(217,43,58,0.11)",  border: "rgba(217,43,58,0.38)",  text: "#D92B3A", dot: "#D92B3A" },
  };

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
      {/* Film grain */}
      <div aria-hidden="true" style={{
        position: "absolute", inset: 0, zIndex: 1,
        backgroundImage: GRAIN_URL, backgroundRepeat: "repeat",
        backgroundSize: "256px 256px", opacity: 0.04,
        mixBlendMode: "screen", pointerEvents: "none",
      }} />

      {/* Accent glow */}
      <div aria-hidden="true" style={{
        position: "absolute", left: "-8%", top: "50%",
        transform: "translateY(-50%)", width: "45vw", height: "45vw",
        borderRadius: "50%", zIndex: 0, pointerEvents: "none",
        background: "radial-gradient(circle, rgba(79,171,255,0.04) 0%, transparent 65%)",
      }} />

      {/* Two-column layout */}
      <div style={{
        position:   "relative", zIndex: 2,
        display:    "flex",
        gap:        "clamp(3rem, 6vw, 6rem)",
        alignItems: "flex-start",
        flexWrap:   "wrap",
      }}>

        {/* ── LEFT: editorial declaration ── */}
        <div style={{ flex: "0 0 clamp(240px, 28%, 320px)", minWidth: 0 }}>

          {/* Eyebrow */}
          <motion.div
            initial={{ opacity: 0, x: -12 }} animate={inView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.5 }}
            style={{ display: "flex", alignItems: "center", gap: "0.85rem", marginBottom: "clamp(1.5rem, 3vw, 2.25rem)" }}
          >
            <motion.div
              initial={{ scaleX: 0 }} animate={inView ? { scaleX: 1 } : {}}
              transition={{ duration: 0.8, delay: 0.05 }}
              style={{ width: "clamp(1.5rem, 4vw, 3rem)", height: "0.5px", background: "rgba(255,255,255,0.22)", transformOrigin: "left" }}
            />
            <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "0.75rem", fontWeight: 900, letterSpacing: "0.2em", textTransform: "uppercase", color: "rgba(255,255,255,0.58)" }}>
              Built around the rules
            </span>
          </motion.div>

          {/* Headline - 4 lines, last line in ACCENT */}
          {[
            { text: "You set",    accent: false },
            { text: "the dates.", accent: false },
            { text: "We hold",    accent: false },
            { text: "the line.",  accent: true  },
          ].map(({ text, accent }, i) => (
            <motion.p key={i}
              initial={{ opacity: 0, y: 40, skewY: 2 }}
              animate={inView ? { opacity: 1, y: 0, skewY: 0 } : {}}
              transition={{ duration: 0.9, delay: i * 0.1, ease: [0.16, 1, 0.3, 1] }}
              style={{
                fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontStyle: "italic",
                fontSize:   "clamp(2.8rem, 6vw, 6rem)", lineHeight: 0.88, letterSpacing: "-0.03em",
                textTransform: "uppercase", color: accent ? ACCENT : WHITE, display: "block",
                textShadow: "0 2px 60px rgba(0,0,0,0.8)",
              }}
            >{text}</motion.p>
          ))}

          {/* Body copy */}
          <motion.div
            initial={{ opacity: 0, y: 16 }} animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.7, delay: 0.55 }}
            style={{ marginTop: "clamp(2rem, 4vw, 3rem)", paddingLeft: "1.25rem", borderLeft: "1.5px solid rgba(255,255,255,0.18)", maxWidth: "36ch" }}
          >
            <p style={{ fontFamily: "'Barlow', sans-serif", fontSize: "clamp(1rem, 1.3vw, 1.1rem)", fontWeight: 400, lineHeight: 1.8, color: "rgba(255,255,255,0.72)" }}>
              Configure your season once. Add break periods, preseason,
              out-of-season, and more. Every workout scheduled on a restricted
              date triggers an automatic compliance warning before it&apos;s ever saved.
            </p>
          </motion.div>

          {/* In-app note */}
          <motion.p
            initial={{ opacity: 0 }} animate={inView ? { opacity: 1 } : {}}
            transition={{ duration: 0.6, delay: 0.8 }}
            style={{ marginTop: "clamp(1.5rem, 3vw, 2.25rem)", fontFamily: "'Barlow Condensed', sans-serif", fontSize: "0.85rem", fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(255,255,255,0.52)", lineHeight: 1.6 }}
          >
            Full CARA / VARA reference available in-app at any time.
          </motion.p>
        </div>

        {/* ── RIGHT: product mock ── */}
        <motion.div
          initial={{ opacity: 0, y: 48, rotateX: 4 }}
          animate={inView ? { opacity: 1, y: 0, rotateX: 0 } : {}}
          transition={{ duration: 1.2, delay: 0.18, ease: [0.16, 1, 0.3, 1] }}
          style={{
            flex: "1 1 420px", minWidth: 0,
            borderRadius: "10px", overflow: "hidden",
            boxShadow: "0 2px 0 rgba(255,255,255,0.06), 0 24px 80px rgba(0,0,0,0.75), 0 8px 32px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.08)",
            transform: "perspective(1400px) rotateX(1.5deg)", transformOrigin: "center top",
            fontFamily: "'Barlow Condensed', sans-serif",
          }}
        >

          {/* Browser chrome */}
          <div style={{ background: "#16202E", borderBottom: "1px solid rgba(255,255,255,0.08)", padding: "0 16px", height: 44, display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
            <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
              {["#FF5F57","#FFBD2E","#28C840"].map((c,i) => (
                <div key={i} style={{ width: 12, height: 12, borderRadius: "50%", background: c, opacity: 0.85 }} />
              ))}
            </div>
            <div style={{ flex: 1, maxWidth: 380, margin: "0 auto", background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 5, height: 26, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "0 10px" }}>
              <svg width="9" height="10" viewBox="0 0 12 14" fill="none" style={{ flexShrink: 0, opacity: 0.45 }}>
                <rect x="1" y="6" width="10" height="8" rx="1.5" fill="rgba(255,255,255,0.8)" />
                <path d="M3.5 6V4a2.5 2.5 0 015 0v2" stroke="rgba(255,255,255,0.8)" strokeWidth="1.5" fill="none" strokeLinecap="round" />
              </svg>
              <span style={{ fontFamily: "'Barlow', sans-serif", fontSize: "0.68rem", color: "rgba(255,255,255,0.45)", letterSpacing: "0.01em", whiteSpace: "nowrap" }}>
                checkpeak.com<span style={{ opacity: 0.5 }}>/org/workouts-calendar</span>
              </span>
            </div>
          </div>

          {/* App NavBar */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 20px", height: 48, background: UI.surface, borderBottom: `1px solid ${UI.rim}`, flexShrink: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: 15, letterSpacing: "0.12em", color: UI.brand, textTransform: "uppercase" }}>PEAK</span>
              <div style={{ width: 1, height: 20, background: UI.rim }} />
              <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 600, fontSize: 13, letterSpacing: "0.08em", color: UI.ghost, textTransform: "uppercase" }}>Workouts Calendar</span>
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              {[
                { label: "Season Dates", active: true  },
                { label: "Compliance",   active: false },
                { label: "+ Create",     primary: true },
              ].map(({ label, active, primary }) => (
                <div key={label} style={{ padding: "5px 10px", borderRadius: 3, background: primary ? UI.brand : active ? UI.raised : "transparent", border: primary ? "none" : active ? `1px solid ${UI.wire}` : `1px solid ${UI.rim}`, fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 11, letterSpacing: "0.06em", textTransform: "uppercase", color: primary ? "#fff" : active ? UI.ink : UI.ghost }}>
                  {label}
                </div>
              ))}
            </div>
          </div>

          {/* ── Calendar area with modal overlay ──
              FIX: explicit minHeight so the modal is never clipped.
              Ghost grid is purely decorative horizontal strips -
              not height-determining cells.
          ── */}
          <div style={{
            position:  "relative",
            /* Tall enough to show the full modal without clipping */
            minHeight: 520,
            background: UI.void,
            overflow:  "hidden",
          }}>

            {/* Ghost calendar strips (decorative, low opacity) */}
            <div aria-hidden="true" style={{ position: "absolute", inset: 0, padding: "14px 20px 0", opacity: 0.13, pointerEvents: "none" }}>
              {/* Day-of-week header row */}
              <div style={{ display: "flex", gap: 3, marginBottom: 6 }}>
                {["S","M","T","W","T","F","S"].map((d,i) => (
                  <div key={i} style={{ flex: 1, textAlign: "center", fontFamily: "'Barlow Condensed', sans-serif", fontSize: 9, fontWeight: 900, color: UI.ghost }}>{d}</div>
                ))}
              </div>
              {/* Four week rows as solid strips */}
              {[0,1,2,3].map(r => (
                <div key={r} style={{ display: "flex", gap: 3, marginBottom: 3 }}>
                  {[0,1,2,3,4,5,6].map(c => (
                    <div key={c} style={{ flex: 1, height: 32, background: UI.surface, border: `1px solid ${UI.rim}`, borderRadius: 2 }} />
                  ))}
                </div>
              ))}
            </div>

            {/* Modal backdrop */}
            <div style={{ position: "absolute", inset: 0, background: "rgba(13,27,42,0.52)", display: "flex", alignItems: "flex-start", justifyContent: "center", paddingTop: 16, paddingBottom: 16 }}>

              {/* ── Season Calendar Setup Modal ── */}
              <motion.div
                initial={{ opacity: 0, y: 14, scale: 0.97 }}
                animate={inView ? { opacity: 1, y: 0, scale: 1 } : {}}
                transition={{ duration: 0.55, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
                style={{ width: "100%", maxWidth: 520, background: UI.surface, border: `1px solid ${UI.rim}`, borderTop: `3px solid ${UI.brand}`, borderRadius: 4, overflow: "hidden", boxShadow: "0 8px 40px rgba(0,0,0,0.22)" }}
              >
                {/* Header */}
                <div style={{ padding: "11px 18px", background: UI.raised, borderBottom: `1px solid ${UI.rim}`, display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={UI.brand} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="4" width="18" height="18" rx="2"/>
                        <line x1="16" y1="2" x2="16" y2="6"/>
                        <line x1="8" y1="2" x2="8" y2="6"/>
                        <line x1="3" y1="10" x2="21" y2="10"/>
                      </svg>
                      <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: 13, letterSpacing: "0.1em", textTransform: "uppercase", color: UI.ink }}>Season Calendar Setup</span>
                    </div>
                    <p style={{ fontFamily: "'Barlow', sans-serif", fontSize: 11, color: UI.ghost, margin: 0 }}>Shared across all coaches in your org - synced to Airtable.</p>
                  </div>
                  <div style={{ width: 26, height: 26, border: `1px solid ${UI.rim}`, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 3, color: UI.ghost, fontSize: 14, flexShrink: 0, lineHeight: 1 }}>×</div>
                </div>

                {/* Info banner */}
                <div style={{ padding: "8px 18px", background: "rgba(0,112,204,0.06)", borderBottom: "1px solid rgba(0,112,204,0.18)", display: "flex", gap: 8, alignItems: "flex-start" }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={UI.brand} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 2 }}>
                    <circle cx="12" cy="12" r="10"/>
                    <line x1="12" y1="16" x2="12" y2="12"/>
                    <line x1="12" y1="8" x2="12.01" y2="8"/>
                  </svg>
                  <p style={{ fontFamily: "'Barlow', sans-serif", fontSize: 11, lineHeight: 1.55, color: UI.brand, margin: 0 }}>
                    When creating a workout on a <strong>break or vacation date</strong>, CheckPeak flags it with a red warning and prompts you to switch to <strong>Voluntary Activity (VARA)</strong>. <strong>Out of season</strong> dates show amber.
                  </p>
                </div>

                {/* Summary tags + period rows */}
                <div style={{ padding: "11px 18px", display: "flex", flexDirection: "column", gap: 6 }}>
                  {/* Tags */}
                  <div style={{ display: "flex", gap: 6, marginBottom: 3 }}>
                    {[
                      { label: "4 periods",       bg: UI.raised,               border: UI.rim,                color: UI.ghost  },
                      { label: "1 VARA-required", bg: "rgba(217,43,58,0.07)",  border: "rgba(217,43,58,0.2)", color: "#D92B3A" },
                      { label: "1 out-of-season", bg: "rgba(196,122,0,0.07)", border: "rgba(196,122,0,0.2)", color: "#C47A00" },
                    ].map(({ label, bg, border, color }) => (
                      <span key={label} style={{ fontFamily: "'Barlow', sans-serif", fontSize: 11, fontWeight: 700, padding: "3px 9px", background: bg, border: `1px solid ${border}`, color }}>{label}</span>
                    ))}
                  </div>

                  {/* Periods */}
                  {periods.map((p, i) => {
                    const t = toneColor[p.tone];
                    const isWinter = p.tone === "banned";
                    return (
                      <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 11px", background: t.bg, border: `1px solid ${isWinter ? t.border : "rgba(0,0,0,0.05)"}`, borderLeft: `3px solid ${t.dot}`, outline: isWinter ? `1.5px solid ${t.dot}` : "none", outlineOffset: "-1.5px", position: "relative" }}>
                        <div style={{ width: 7, height: 7, borderRadius: "50%", background: t.dot, flexShrink: 0 }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: 12, color: isWinter ? t.text : UI.ink, textTransform: "uppercase", letterSpacing: "0.04em" }}>{p.name}</span>
                          <span style={{ fontFamily: "'Barlow', sans-serif", fontSize: 10, color: UI.ghost, marginLeft: 8 }}>{p.dates}</span>
                        </div>
                        {p.vara && (
                          <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: 9, letterSpacing: "0.08em", textTransform: "uppercase", padding: "2px 6px", background: t.bg, border: `1px solid ${t.border}`, color: t.text, flexShrink: 0 }}>{p.vara}</span>
                        )}
                        <div style={{ width: 22, height: 22, border: `1px solid ${UI.rim}`, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 3, color: UI.ghost, fontSize: 12, flexShrink: 0 }}>×</div>
                      </div>
                    );
                  })}

                  {/* Add period */}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 5, padding: "8px", border: `2px dashed ${UI.rim}`, fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", color: UI.ghost }}>
                    + Add Period
                  </div>
                </div>

                {/* Footer */}
                <div style={{ padding: "10px 18px", borderTop: `1px solid ${UI.rim}`, background: UI.raised, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <p style={{ fontFamily: "'Barlow', sans-serif", fontSize: 11, color: UI.ghost, margin: 0 }}>Shared across all coaches in your org.</p>
                  <div style={{ display: "flex", gap: 8 }}>
                    <div style={{ padding: "6px 14px", border: `1px solid ${UI.rim}`, background: UI.surface, borderRadius: 3, fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", color: UI.ghost }}>Cancel</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 16px", background: UI.brand, borderRadius: 3, fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", color: "#fff" }}>
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/>
                        <polyline points="17 21 17 13 7 13 7 21"/>
                        <polyline points="7 3 7 8 15 8"/>
                      </svg>
                      Save Calendar
                    </div>
                  </div>
                </div>
              </motion.div>
            </div>
          </div>

          {/* ── Connector - FIX: centered pill, not full-width ── */}
          <div style={{ background: UI.void, padding: "12px 0", display: "flex", flexDirection: "column", alignItems: "center", borderTop: `1px solid ${UI.rim}` }}>
            <div style={{ width: 1, height: 14, borderLeft: "1.5px dashed rgba(217,43,58,0.35)" }} />
            <motion.div
              initial={{ opacity: 0, scale: 0.92 }} animate={inView ? { opacity: 1, scale: 1 } : {}}
              transition={{ duration: 0.5, delay: 0.65 }}
              style={{
                /* FIX: inline-flex keeps pill width to its content */
                display: "inline-flex", alignItems: "center",
                padding: "4px 16px",
                background: "rgba(217,43,58,0.07)",
                border: "1px solid rgba(217,43,58,0.22)",
                borderRadius: 20,
                fontFamily: "'Barlow Condensed', sans-serif",
                fontWeight: 900, fontSize: 11,
                letterSpacing: "0.08em", textTransform: "uppercase",
                color: "#D92B3A", whiteSpace: "nowrap",
              }}
            >
              Dec 20 falls in Winter Break - warning fires
            </motion.div>
            <div style={{ width: 1, height: 14, borderLeft: "1.5px dashed rgba(217,43,58,0.35)" }} />
          </div>

          {/* ── VARA warning fires ── */}
          <motion.div
            initial={{ opacity: 0, y: 10 }} animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.55, delay: 0.78 }}
            style={{ padding: "14px 20px", background: "rgba(217,43,58,0.05)", borderTop: "1px solid rgba(217,43,58,0.18)" }}
          >
            {/* Step label */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <div style={{ width: 18, height: 18, borderRadius: "50%", background: "#D92B3A", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <span style={{ fontFamily: "monospace", fontSize: 10, fontWeight: 700, color: "#fff", lineHeight: 1 }}>!</span>
              </div>
              <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase", color: "#D92B3A", opacity: 0.82 }}>
                Fires automatically - before the workout is saved
              </span>
            </div>

            {/* Warning card */}
            <div style={{ padding: "13px 15px", background: "rgba(217,43,58,0.07)", border: "1px solid rgba(217,43,58,0.25)", borderLeft: "4px solid #D92B3A", borderRadius: 3 }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                {/* FIX: ⚠ character in a circle, not the word "warning" */}
                <div style={{ width: 28, height: 28, borderRadius: "50%", background: "rgba(217,43,58,0.14)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1, fontSize: 14, lineHeight: 1 }}>
                  ⚠
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: 12, letterSpacing: "0.08em", textTransform: "uppercase", color: "#D92B3A", marginBottom: 5 }}>
                    VARA Required - Break Period
                  </p>
                  <p style={{ fontFamily: "'Barlow', sans-serif", fontSize: 12, lineHeight: 1.65, color: "#D92B3A", opacity: 0.88, marginBottom: 12 }}>
                    <strong>Winter Break (Dec 15 – Jan 5):</strong> Coach-directed workouts are NOT permitted. All activities must be Voluntary (VARA) - athlete-initiated, no coach presence.
                  </p>
                  <div style={{ display: "flex", gap: 8 }}>
                    <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 14px", background: "#D92B3A", borderRadius: 3, fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", color: "#fff" }}>
                      Set as Voluntary Activity (VARA)
                    </div>
                    <div style={{ padding: "7px 12px", background: "transparent", border: `1px solid ${UI.rim}`, borderRadius: 3, fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 11, letterSpacing: "0.06em", textTransform: "uppercase", color: UI.ghost }}>
                      Cancel
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>

        </motion.div>{/* /product mock */}
      </div>{/* /two-column */}

      {/* Caption */}
      <motion.p
        initial={{ opacity: 0 }} animate={inView ? { opacity: 1 } : {}}
        transition={{ duration: 0.6, delay: 1.0 }}
        style={{ position: "relative", zIndex: 2, textAlign: "center", marginTop: "clamp(2rem, 4vw, 3.5rem)", fontFamily: "'Barlow', sans-serif", fontSize: "0.95rem", color: "rgba(255,255,255,0.62)", letterSpacing: "0.05em", lineHeight: 1.75 }}
      >
        Set your season once. CheckPeak flags every restricted date before it becomes a violation.
        <br />
        <a
          href="/compliance/ncaa"
          style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: "0.88rem", letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(255,255,255,0.52)", textDecoration: "none", transition: "color 0.18s" }}
          onMouseEnter={e => { e.currentTarget.style.color = ACCENT; }}
          onMouseLeave={e => { e.currentTarget.style.color = "rgba(255,255,255,0.3)"; }}
        >
          Read our full NCAA Compliance reference →
        </a>
      </motion.p>
    </section>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   SOCIAL PROOF - Editorial quote section
══════════════════════════════════════════════════════════════════════════ */
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
      text: "Pushing film directly to their phone — and seeing who watched it — changed how we run film study completely.",
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
          Names withheld by request · Pilot program participants
        </motion.p>
      </div>
    </section>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   6. FINAL CTA
   FIX: Eyebrow opacity 0.22→0.5, size 0.62rem→0.82rem - it's real content
   FIX: Sub-label "30 days free" opacity 0.22→0.5, size 0.65→0.8rem
   FIX: Athlete link opacity 0.35→0.55, size 0.58→0.78rem - functional link
   FIX: Disclaimer opacity 0.12→0.22, size 0.55→0.65rem - legal minimum
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
        {/* Eyebrow - FIX: opacity 0.22→0.5, size 0.62→0.82rem */}
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
          <p style={{ fontFamily: "'Barlow', sans-serif", fontSize: "0.85rem", letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(255,255,255,0.65)" }}>
            30 days free · No credit card · Unlimited athletes
          </p>
        </motion.div>
      </div>

      {/* Bottom-left: Arena link */}
      <div style={{ position: "absolute", bottom: "clamp(1.25rem, 2.5vw, 2rem)", left: "clamp(1.25rem, 4vw, 2.5rem)", zIndex: 1 }}>
        <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "0.82rem", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(255,255,255,0.58)", lineHeight: 1.6 }}>
          Athlete?&nbsp;
          <a href="/trainers" onClick={() => track("footer_arena_link")}
            style={{ color: "rgba(255,255,255,0.78)", fontFamily: "'Barlow Condensed', sans-serif", fontSize: "0.82rem", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", textDecoration: "none", transition: "color 0.18s" }}
            onMouseEnter={e => { e.currentTarget.style.color = ACCENT; }}
            onMouseLeave={e => { e.currentTarget.style.color = "rgba(255,255,255,0.78)"; }}
          >
            Browse The Arena →
          </a>
        </p>
      </div>

      {/* Bottom-right legal - FIX: opacity 0.12→0.25, size 0.55→0.68rem */}
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
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
            style={{
              width: "100%", height: "100%",
              display: "block", objectFit: "cover",
            }}
            poster="/images/promo-poster.jpg"
          >
            <source src="/video/app-promo.mp4" type="video/mp4" />
          </video>

          {!playing && (
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

// ---------------------------------------------------------------------------
// PAGE
// ---------------------------------------------------------------------------
export default function HomePage() {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ?? "https://checkpeak.com";
  const ogDesc  = "Program-wide athlete accountability. Film, nutrition, workouts, attendance, and check-ins — all in one platform.";

  return (
    <>
      <style>{GLOBAL_STYLE + ARENA_STYLE}</style>
      <Head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:ital,wght@0,400;0,700;0,900;1,900&family=Barlow:wght@400;500;600&display=swap" />
        <title>CheckPeak - The Arena & Collegiate Performance Platform</title>
        <meta name="description" content="CheckPeak: browse elite trainer programs in The Arena, or give your college program full off-campus accountability. Built for athletes and the staffs who coach them." />
        <meta property="og:title"        content="CheckPeak — Program-Wide Athlete Accountability" />
        <meta property="og:description"  content={ogDesc} />
        <meta property="og:type"         content="website" />
        <meta property="og:url"          content={siteUrl} />
        <meta property="og:image"        content={`${siteUrl}/api/og-image?q=${encodeURIComponent(ogDesc)}`} />
        <meta property="og:image:width"  content="1200" />
        <meta property="og:image:height" content="630" />
        <meta name="twitter:card"        content="summary_large_image" />
        <meta name="twitter:site"        content="@checkPeak_" />
        <meta name="twitter:title"       content="CheckPeak — Program-Wide Athlete Accountability" />
        <meta name="twitter:description" content={ogDesc} />
        <meta name="twitter:image"       content={`${siteUrl}/api/og-image?q=${encodeURIComponent(ogDesc)}`} />
      </Head>

      <Cursor />

      <main style={{ background: BLACK, color: WHITE }}>
        <Hero />

        {/* Triptych: visual proof immediately after hero - image before copy */}
        <TriptychSection />

        {/* THE ARENA - trainer marketplace */}
        <TrainerShowcase />

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

        {/* Promo Video */}
        <PromoVideo />

        {/* Beat 4: "Built around the rules." */}
        <DeclarationBeat index={3} lines={BEATS[3].lines} footnote={BEATS[3].footnote}
          isClimax={false} threeLines={false} watermark={BEATS[3].watermark} total={4} />

        <ComplianceMoment />

        <ProofMoment />
        <SocialProof />
        <FinalCta />
      </main>
    </>
  );
}