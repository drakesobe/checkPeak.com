// pages/index.js
"use client";

import Head from "next/head";
import HeroSection from "@/components/HeroSection";
import { useState, useCallback, useRef, useEffect } from "react";
import Link from "next/link";
import { motion, useInView, useScroll, useTransform } from "framer-motion";
import { ArrowRight, ChevronDown, ChevronUp, CheckCircle } from "lucide-react";

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
// Color system — two-world palette: Dark Power / White Clarity
// ---------------------------------------------------------------------------
const DARK = {
  bg:       "#080E1A",       // near-black with blue undertone
  surface:  "#0F1824",       // card surface on dark
  border:   "rgba(255,255,255,0.08)",
  text:     "#FFFFFF",
  body:     "rgba(255,255,255,0.82)",
  dim:      "rgba(255,255,255,0.45)",
  accent:   "#4FABFF",       // electric blue — brighter than brand
  accentDim:"rgba(79,171,255,0.15)",
};
const LIGHT = {
  bg:       "#F2F6FB",
  surface:  "#FFFFFF",
  border:   "#D4DDE8",
  text:     "#060D18",
  body:     "#334155",
  dim:      "#7A90A8",
  accent:   "#1A3A5C",
  good:     "#00873E",
};

// ---------------------------------------------------------------------------
// Animated counter
// ---------------------------------------------------------------------------
function Counter({ to, suffix = "", prefix = "" }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true });
  const [val, setVal] = useState(0);

  useEffect(() => {
    if (!inView) return;
    let start = 0;
    const step = Math.ceil(to / 50);
    const id = setInterval(() => {
      start += step;
      if (start >= to) { setVal(to); clearInterval(id); }
      else setVal(start);
    }, 24);
    return () => clearInterval(id);
  }, [inView, to]);

  return <span ref={ref}>{prefix}{val}{suffix}</span>;
}

// ---------------------------------------------------------------------------
// Scroll-triggered reveal
// ---------------------------------------------------------------------------
function Reveal({ children, delay = 0, y = 24, className = "" }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });
  return (
    <motion.div
      ref={ref}
      className={className}
      initial={{ opacity: 0, y }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.65, delay, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Primary CTA — athletic hover effect
// ---------------------------------------------------------------------------
function Cta({ source, children, dark = false, size = "md", roleOverride, onClick, className = "" }) {
  const lg = size === "lg";
  return (
    <button
      type="button"
      onClick={() => {
        track("cta_auth_open", { source });
        openAuthModal({ role: roleOverride || "organization" });
        onClick?.();
      }}
      className={[
        "group relative inline-flex items-center justify-center gap-3 font-black uppercase tracking-widest overflow-hidden transition-all duration-300",
        lg ? "px-10 py-5 text-base" : "px-7 py-4 text-sm",
        dark
          ? "bg-[#4FABFF] text-[#080E1A] hover:bg-white"
          : "bg-[#060D18] text-white hover:bg-[#1A3A5C]",
        className,
      ].join(" ")}
    >
      {/* Slide-in sheen on hover */}
      <span className="absolute inset-0 translate-x-[-101%] group-hover:translate-x-0 transition-transform duration-500 ease-out"
        style={{ background: dark ? "rgba(255,255,255,0.15)" : "rgba(79,171,255,0.1)" }}
      />
      <span className="relative flex items-center gap-3">{children}</span>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Section eyebrow
// ---------------------------------------------------------------------------
function Eyebrow({ children, dark = false }) {
  return (
    <p className="text-xs font-black uppercase tracking-[0.3em] mb-5"
      style={{
        color: dark ? DARK.accent : LIGHT.dim,
        fontFamily: "'Barlow Condensed', sans-serif",
        letterSpacing: "0.3em",
      }}
    >
      {children}
    </p>
  );
}

// ---------------------------------------------------------------------------
// Diagonal section divider via clip-path
// ---------------------------------------------------------------------------
function DiagDivider({ fromDark = true }) {
  return (
    <div
      className="h-16 -mt-1"
      style={{
        backgroundColor: fromDark ? LIGHT.bg : DARK.bg,
        clipPath: fromDark ? "polygon(0 100%, 100% 0, 100% 100%)" : "polygon(0 0, 100% 100%, 0 100%)",
      }}
    />
  );
}

// ---------------------------------------------------------------------------
// Checkmark list item
// ---------------------------------------------------------------------------
function Check({ children, dark = false }) {
  return (
    <li className="flex items-start gap-3 text-base leading-relaxed"
      style={{ color: dark ? DARK.body : LIGHT.body }}
    >
      <CheckCircle className="w-5 h-5 shrink-0 mt-0.5"
        style={{ color: dark ? DARK.accent : LIGHT.good }}
      />
      <span>{children}</span>
    </li>
  );
}

// ---------------------------------------------------------------------------
// Page data
// ---------------------------------------------------------------------------
const STATS = [
  { n: 52,   suffix: "",  label: "WEEKS OF COVERAGE",     sub: "Offseason. In-season. Rehab." },
  { n: 900,  suffix: "+", label: "SUBSTANCES FLAGGED",    sub: "Banned compounds + aliases."  },
  { n: 30,   suffix: "s", label: "TO CHECK IN",           sub: "One tap. Done."               },
];

const STEPS = [
  {
    n: "01", title: "SET THE PLAN",
    body: "Build workout templates and nutrition targets with how-to video links, macro targets by meal, and your own rules for when photo proof is required.",
  },
  {
    n: "02", title: "ATHLETES CHECK IN",
    body: "One tap to log a workout or meal. Photo evidence only when your program demands it. No calorie counting. No excuses.",
  },
  {
    n: "03", title: "STAFF REVIEWS",
    body: "A clean queue: approve, request info, or leave notes. Consistent outcomes with attached timestamps — follow-ups always have context.",
  },
  {
    n: "04", title: "WEEKLY VISIBILITY",
    body: "A weekly snapshot by athlete and team. Catch drift before camp. Identify who's staying competitive and who needs early intervention.",
  },
];

const MODULES = [
  {
    label: "ACCOUNTABILITY",
    title: "WORKOUT\nCHECK-INS",
    body: "Assign templates. Collect photo check-ins. Review in a clean queue. Stop offseason regression and start getting consistent progression.",
    points: ["Templates with video links and clear expectations", "Photo proof only when you require it", "Weekly view — catch who's drifting before camp opens"],
  },
  {
    label: "NUTRITION",
    title: "MEAL-BASED\nTARGETS",
    body: "Macro targets by meal, built for dining halls. Hydration goals. Athletes log in seconds - no food journals, no weighing chicken.",
    points: ["Targets by meal, not just daily totals", "Dining hall and real-world guidance", "Hydration tracking alongside food - in one place"],
  },
  {
    label: "SCREENING",
    title: "SUPPLEMENT\nSCANNING",
    body: "One bad supplement ends careers. Scan labels at home, flag banned compounds and their aliases before anything gets taken.",
    points: ["Catches banned compounds and known aliases", "Saved scan history - no second-guessing", "Free to use, no account required"],
  },
];

const SCAN_LINKS = [
  { href: "/nutrition-label-scanner",      label: "Nutrition Label"   },
  { href: "/supplement-label-scanner",     label: "Supplement Label"  },
  { href: "/banned-substance-checker",     label: "Banned Substance"  },
  { href: "/pre-workout-label-scanner",    label: "Pre-Workout"       },
  { href: "/protein-powder-label-scanner", label: "Protein Powder"    },
];

// ---------------------------------------------------------------------------
// PAGE
// ---------------------------------------------------------------------------
export default function HomePage() {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ?? "https://checkpeak.com";
  const ogText  = "CheckPeak — No Excuses. No Drift. No Guessing.";

  const [disclaimerOpen, setDisclaimerOpen] = useState(false);
  const [email,   setEmail]   = useState("");
  const [role,    setRole]    = useState("Coach / Staff");
  const [org,     setOrg]     = useState("");
  const [loading, setLoading] = useState(false);
  const [err,     setErr]     = useState("");
  const [ok,      setOk]      = useState(false);

  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();
    setErr(""); setOk(false);
    const clean = email.trim();
    if (!clean || !clean.includes("@")) { setErr("Please enter a valid email."); return; }
    setLoading(true);
    try {
      track("email_capture_submit", { source: "home", role });
      const res = await fetch("/api/waitlist", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: clean, role, organization: org || null, source: "home_founding_teams" }),
      });
      if (!res.ok) throw new Error("Unable to save. Please try again.");
      setOk(true); setEmail(""); setOrg(""); setRole("Coach / Staff");
    } catch (error) {
      setErr(error?.message || "Something went wrong.");
    } finally { setLoading(false); }
  }, [email, role, org]);

  return (
    <>
      <Head>
        <title>CheckPeak — Workouts + Nutrition + Supplement Screening</title>
        <meta name="description" content="CheckPeak keeps athletes accountable away from campus. Workout check-ins, nutrition targets, supplement screening. Built for programs." />
        <meta property="og:title"       content="CheckPeak — No Excuses. No Drift. No Guessing." />
        <meta property="og:description" content="The platform that keeps athletes sharp wherever they are." />
        <meta property="og:type"        content="website" />
        <meta property="og:url"         content={siteUrl} />
        <meta property="og:image"       content={`${siteUrl}/api/og-image?q=${encodeURIComponent(ogText)}`} />
        <meta name="twitter:card"       content="summary_large_image" />
        <meta name="twitter:site"       content="@checkPeak_" />
        <meta name="twitter:title"      content="CheckPeak — No Excuses. No Drift. No Guessing." />
        <meta name="twitter:image"      content={`${siteUrl}/api/og-image?q=${encodeURIComponent(ogText)}`} />
      </Head>

      <div className="min-h-screen" style={{ backgroundColor: DARK.bg, color: DARK.text }}>

        {/* ═══════════════════════════════════════════════════════
            HERO  — untouched
        ═══════════════════════════════════════════════════════ */}
        <HeroSection />

        {/* ═══════════════════════════════════════════════════════
            STAT STRIP  — dark, full-bleed, three weapons
        ═══════════════════════════════════════════════════════ */}
        <section style={{ backgroundColor: DARK.bg }}>
          <div className="max-w-7xl mx-auto px-6 sm:px-12">
            <div className="grid sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x"
              style={{ borderTop: `1px solid ${DARK.border}`, borderBottom: `1px solid ${DARK.border}`, borderColor: DARK.border }}
            >
              {STATS.map(({ n, suffix, label, sub }, i) => (
                <Reveal key={label} delay={i * 0.1}>
                  <div className="px-6 py-10 sm:px-8 sm:py-14 text-center sm:text-left">
                    <div
                      className="font-black leading-none mb-3"
                      style={{
                        fontFamily: "'Barlow Condensed', sans-serif",
                        fontSize: "clamp(3.25rem, 8vw, 6.5rem)",
                        color: DARK.accent,
                        letterSpacing: "-0.02em",
                      }}
                    >
                      <Counter to={n} suffix={suffix} />
                    </div>
                    <p className="text-sm font-black tracking-widest mb-1.5"
                      style={{ color: DARK.text, fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: "0.15em" }}
                    >
                      {label}
                    </p>
                    <p className="text-base" style={{ color: DARK.dim }}>{sub}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════
            MANIFESTO STATEMENT  — full-bleed dark, massive type
        ═══════════════════════════════════════════════════════ */}
        <section
          className="py-16 sm:py-28 overflow-hidden"
          style={{ backgroundColor: "#060D18" }}
        >
          <Reveal y={32}>
            <div className="max-w-7xl mx-auto px-6 sm:px-12">
              {/* Ghost watermark number */}
              <div className="relative">
                <p
                  className="absolute -top-6 -left-4 font-black select-none pointer-events-none"
                  style={{
                    fontFamily: "'Barlow Condensed', sans-serif",
                    fontSize: "clamp(8rem, 25vw, 22rem)",
                    color: "rgba(255,255,255,0.02)",
                    lineHeight: 1,
                    letterSpacing: "-0.04em",
                  }}
                >
                  OFF
                </p>
                <p
                  className="text-xs font-black uppercase tracking-[0.3em] mb-8"
                  style={{ color: DARK.accent }}
                >
                  The reality
                </p>
                <h2
                  className="font-black leading-[0.9] relative z-10"
                  style={{
                    fontFamily: "'Barlow Condensed', sans-serif",
                    fontSize: "clamp(2.5rem, 9vw, 8rem)",
                    letterSpacing: "-0.02em",
                    maxWidth: "14ch",
                  }}
                >
                  OFFSEASON IS WHERE{" "}
                  <span style={{ color: DARK.accent }}>CHAMPIONSHIPS</span>{" "}
                  ARE WON OR LOST.
                </h2>
                {/* Three-line typographic statement — poster logic, not prose */}
                <div className="mt-10 sm:mt-16 space-y-3">
                  <Reveal delay={0.1} y={16}>
                    <p
                      className="font-black leading-none"
                      style={{
                        fontFamily: "'Barlow Condensed', sans-serif",
                        fontSize: "clamp(1.25rem, 3.5vw, 2.75rem)",
                        color: "rgba(255,255,255,0.35)",
                        letterSpacing: "-0.01em",
                      }}
                    >
                      Most programs run on guesswork
                    </p>
                  </Reveal>
                  <Reveal delay={0.18} y={16}>
                    <p
                      className="font-black leading-none"
                      style={{
                        fontFamily: "'Barlow Condensed', sans-serif",
                        fontSize: "clamp(2rem, 6vw, 5rem)",
                        color: DARK.text,
                        letterSpacing: "-0.02em",
                      }}
                    >
                      and prayers.
                    </p>
                  </Reveal>
                  <Reveal delay={0.28} y={16}>
                    <div className="pt-3 sm:pt-4 flex flex-col sm:flex-row sm:gap-6 gap-1">
                      {["Stop guessing.", "Start knowing.", "Zero excuses."].map((phrase, i) => (
                        <p
                          key={phrase}
                          className="font-black leading-none"
                          style={{
                            fontFamily: "'Barlow Condensed', sans-serif",
                            fontSize: "clamp(1.1rem, 2.5vw, 2rem)",
                            color: i === 0 ? DARK.accent : DARK.dim,
                            letterSpacing: "0em",
                          }}
                        >
                          {phrase}
                        </p>
                      ))}
                    </div>
                  </Reveal>
                </div>
                <div className="mt-10">
                  <Cta source="manifesto" dark size="lg">
                    Start your pilot <ArrowRight className="w-5 h-5" />
                  </Cta>
                </div>
              </div>
            </div>
          </Reveal>
        </section>

        {/* ═══════════════════════════════════════════════════════
            HOW IT WORKS  — light section, editorial numbered list
        ═══════════════════════════════════════════════════════ */}
        <section id="how-it-works" style={{ backgroundColor: LIGHT.bg }}>
          {/* Diagonal top edge */}
          <div className="h-10 sm:h-20 -mt-1" style={{
            backgroundColor: LIGHT.bg,
            clipPath: "polygon(0 100%, 100% 0, 100% 100%, 0 100%)",
            marginTop: "-1px",
          }} />

          <div className="max-w-7xl mx-auto px-6 sm:px-12 pb-16 sm:pb-28">
            <Reveal>
              <Eyebrow>The system</Eyebrow>
              <h2
                className="font-black leading-none mb-10 sm:mb-20"
                style={{
                  fontFamily: "'Barlow Condensed', sans-serif",
                  fontSize: "clamp(2.5rem, 7vw, 6rem)",
                  color: LIGHT.text,
                  letterSpacing: "-0.02em",
                }}
              >
                FOUR STEPS.<br />
                <span style={{ color: LIGHT.accent }}>ONE SYSTEM.</span>
              </h2>
            </Reveal>

            {/* Full-width alternating strips — Nike editorial logic */}
            <div>
              {STEPS.map(({ n, title, body }, i) => {
                const flip = i % 2 !== 0;
                return (
                  <Reveal key={n} delay={i * 0.06} y={20}>
                    <div
                      className="group border-t"
                      style={{ borderColor: LIGHT.border }}
                    >
                      {/* ── Mobile: number left, title+body right ── */}
                      <div className="flex sm:hidden items-start gap-5 py-7 px-1">
                        <span
                          className="font-black leading-none shrink-0 pt-1"
                          style={{
                            fontFamily: "'Barlow Condensed', sans-serif",
                            fontSize: "2rem",
                            color: LIGHT.border,
                            letterSpacing: "-0.04em",
                            minWidth: "2.5rem",
                          }}
                        >
                          {n}
                        </span>
                        <div>
                          <h3
                            className="font-black leading-none mb-3"
                            style={{
                              fontFamily: "'Barlow Condensed', sans-serif",
                              fontSize: "clamp(1.5rem, 5vw, 2rem)",
                              color: LIGHT.text,
                              letterSpacing: "-0.02em",
                            }}
                          >
                            {title}
                          </h3>
                          <p className="text-base leading-relaxed" style={{ color: LIGHT.body }}>
                            {body}
                          </p>
                        </div>
                      </div>

                      {/* ── Desktop: alternating full-width strips ── */}
                      <div
                        className={[
                          "hidden sm:flex sm:items-center gap-0",
                          flip ? "sm:flex-row-reverse" : "",
                        ].join(" ")}
                      >
                        {/* Step number column */}
                        <div
                          className={[
                            "flex-shrink-0 flex items-center justify-center",
                            "w-48 min-h-[180px]",
                            flip ? "border-l" : "border-r",
                          ].join(" ")}
                          style={{ borderColor: LIGHT.border }}
                        >
                          <span
                            className="font-black leading-none transition-colors duration-500 group-hover:text-[#1A3A5C]"
                            style={{
                              fontFamily: "'Barlow Condensed', sans-serif",
                              fontSize: "clamp(4rem, 6vw, 6.5rem)",
                              color: LIGHT.border,
                              letterSpacing: "-0.04em",
                            }}
                          >
                            {n}
                          </span>
                        </div>

                        {/* Title + body */}
                        <div className="flex-1 flex items-center gap-12 px-12 min-h-[180px]">
                          <h3
                            className="font-black leading-none flex-shrink-0"
                            style={{
                              fontFamily: "'Barlow Condensed', sans-serif",
                              fontSize: "clamp(1.75rem, 3vw, 3rem)",
                              color: LIGHT.text,
                              letterSpacing: "-0.02em",
                              width: "220px",
                            }}
                          >
                            {title}
                          </h3>
                          <p
                            className="text-base lg:text-lg leading-relaxed"
                            style={{ color: LIGHT.body, maxWidth: "38ch" }}
                          >
                            {body}
                          </p>
                        </div>
                      </div>
                    </div>
                  </Reveal>
                );
              })}
              <div className="border-t" style={{ borderColor: LIGHT.border }} />
            </div>

            <Reveal delay={0.2}>
              <div className="mt-16 flex justify-start">
                <Cta source="how_it_works" size="lg">
                  Get started free <ArrowRight className="w-5 h-5" />
                </Cta>
              </div>
            </Reveal>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════
            THREE MODULES  — alternating dark/light strips
        ═══════════════════════════════════════════════════════ */}
        {MODULES.map(({ label, title, body, points }, i) => {
          const isDark = i % 2 === 0;
          const bg     = isDark ? DARK.bg     : LIGHT.bg;
          const surf   = isDark ? DARK.surface : LIGHT.surface;
          const h2col  = isDark ? DARK.text    : LIGHT.text;
          const accent = isDark ? DARK.accent  : LIGHT.accent;
          const bodCol = isDark ? DARK.body    : LIGHT.body;
          const border = isDark ? DARK.border  : LIGHT.border;

          return (
            <section key={label} style={{ backgroundColor: bg }}>
              {/* Top diagonal */}
              {i === 0 && (
                <div className="h-10 sm:h-20 -mt-1" style={{
                  backgroundColor: bg,
                  clipPath: "polygon(0 0, 100% 100%, 0 100%)",
                  marginTop: "-1px",
                }} />
              )}

              <div className="max-w-7xl mx-auto px-6 sm:px-12 py-16 sm:py-28">
                <Reveal>
                  <div className="grid lg:grid-cols-2 gap-10 lg:gap-20 items-center">

                    {/* Left — headline */}
                    <div className={i % 2 !== 0 ? "lg:order-2" : ""}>
                      <p className="text-xs font-black tracking-[0.3em] mb-6"
                        style={{ color: accent, fontFamily: "'Barlow Condensed', sans-serif" }}
                      >
                        {label}
                      </p>
                      <h2
                        className="font-black leading-none mb-8 whitespace-pre-line"
                        style={{
                          fontFamily: "'Barlow Condensed', sans-serif",
                          fontSize: "clamp(2.25rem, 6vw, 5.5rem)",
                          color: h2col,
                          letterSpacing: "-0.02em",
                        }}
                      >
                        {title}
                      </h2>
                      <p className="text-base sm:text-xl leading-relaxed mb-8 sm:mb-10" style={{ color: bodCol }}>
                        {body}
                      </p>
                      <Cta source={`module_${i}`} dark={isDark} size="md">
                        Learn more <ArrowRight className="w-4 h-4" />
                      </Cta>
                    </div>

                    {/* Right — feature card */}
                    <div className={i % 2 !== 0 ? "lg:order-1" : ""}>
                      <div
                        className="rounded-sm p-8 sm:p-10"
                        style={{
                          backgroundColor: surf,
                          border: `1px solid ${isDark ? "rgba(255,255,255,0.1)" : LIGHT.border}`,
                          boxShadow: isDark
                            ? "none"
                            : "0 2px 24px rgba(6,13,24,0.07), 0 1px 4px rgba(6,13,24,0.04)",
                        }}
                      >
                        {/* Module number watermark */}
                        <div className="flex items-start justify-between mb-8">
                          <p
                            className="font-black leading-none"
                            style={{
                              fontFamily: "'Barlow Condensed', sans-serif",
                              fontSize: "5rem",
                              color: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.04)",
                              letterSpacing: "-0.04em",
                              lineHeight: 1,
                            }}
                          >
                            0{i + 1}
                          </p>
                          <div
                            className="w-12 h-12 rounded-sm flex items-center justify-center text-2xl font-black"
                            style={{
                              backgroundColor: accent + (isDark ? "18" : "10"),
                              border: `1px solid ${accent + (isDark ? "30" : "25")}`,
                              color: accent,
                              fontFamily: "'Barlow Condensed', sans-serif",
                            }}
                          >
                            {["✓", "◎", "⬡"][i]}
                          </div>
                        </div>

                        <p
                          className="text-xs font-black uppercase tracking-widest mb-5"
                          style={{ color: isDark ? DARK.dim : LIGHT.dim }}
                        >
                          What it does
                        </p>
                        <ul className="space-y-4">
                          {points.map(pt => (
                            <Check key={pt} dark={isDark}>{pt}</Check>
                          ))}
                        </ul>
                      </div>
                    </div>

                  </div>
                </Reveal>
              </div>
            </section>
          );
        })}

        {/* ═══════════════════════════════════════════════════════
            PRICING  — dark, bold, no-nonsense
        ═══════════════════════════════════════════════════════ */}
        <section id="pricing" style={{ backgroundColor: "#060D18" }}>
          <div className="max-w-7xl mx-auto px-6 sm:px-12 py-16 sm:py-28">
            <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-start">

              {/* Left — the offer */}
              <Reveal>
                <Eyebrow dark>Founding 26 teams</Eyebrow>
                <h2
                  className="font-black leading-none mb-8"
                  style={{
                    fontFamily: "'Barlow Condensed', sans-serif",
                    fontSize: "clamp(2.25rem, 6vw, 5.5rem)",
                    color: DARK.text,
                    letterSpacing: "-0.02em",
                  }}
                >
                  LOCK IN<br />
                  <span style={{ color: DARK.accent }}>BEFORE CAMP.</span>
                </h2>
                <p className="text-base sm:text-xl leading-relaxed mb-10 sm:mb-12" style={{ color: DARK.body }}>
                  Start with one team. Expand as you go. Flat all-in pricing — no per-athlete add-ons, no surprise upcharges.
                </p>

                {/* Price block */}
                <div
                  className="inline-flex flex-col p-8 rounded-sm mb-10"
                  style={{ border: `1px solid ${DARK.border}`, backgroundColor: DARK.surface }}
                >
                  <div className="flex items-end gap-3 mb-2">
                    <span
                      className="font-black leading-none"
                      style={{
                        fontFamily: "'Barlow Condensed', sans-serif",
                        fontSize: "clamp(3rem, 8vw, 6rem)",
                        color: DARK.accent,
                        letterSpacing: "-0.03em",
                      }}
                    >
                      $2,988
                    </span>
                    <span className="text-xl mb-3" style={{ color: DARK.dim }}>/year</span>
                  </div>
                  <p className="text-base" style={{ color: DARK.dim }}>
                    Rate locked 3 years · Code:{" "}
                    <span className="font-black" style={{ color: DARK.text }}>Founding26</span>
                  </p>
                </div>

                <ul className="space-y-4 mb-12">
                  {[
                    "30-day pilot - onboard athletes and dial in your templates",
                    "Unlimited athletes at one flat rate",
                    "Staff roles: Admin / Trainer / Coach",
                    "No hidden per-athlete or per-team upcharges",
                  ].map(item => <Check key={item} dark>{item}</Check>)}
                </ul>

                <div className="flex flex-wrap gap-4">
                  <Cta source="pricing_main" dark size="lg">
                    Start your 30-day pilot <ArrowRight className="w-5 h-5" />
                  </Cta>
                </div>
                <p className="mt-4 text-base" style={{ color: DARK.dim }}>
                  *No credit card required to start.
                </p>
              </Reveal>

              {/* Right — 30-day timeline */}
              <Reveal delay={0.15}>
                <p className="text-xs font-black uppercase tracking-[0.3em] mb-8"
                  style={{ color: DARK.dim, fontFamily: "'Barlow Condensed', sans-serif" }}
                >
                  Your first 30 days
                </p>
                <div className="space-y-0">
                  {[
                    {
                      week: "01", title: "SETUP",
                      items: ["Invite athletes, connect to your org", "Configure staff roles and permissions", "Build your first workout template"],
                    },
                    {
                      week: "02–03", title: "RHYTHM",
                      items: ["Athletes submit first check-ins", "Staff reviews in the queue with feedback", "Nutrition targets go live"],
                    },
                    {
                      week: "04", title: "RESULTS",
                      items: ["Weekly snapshot by athlete and team", "Identify who's staying sharp", "Repeatable process locked in for the season"],
                    },
                  ].map(({ week, title, items }, i) => (
                    <div
                      key={week}
                      className="py-8 border-t"
                      style={{ borderColor: DARK.border }}
                    >
                      <div className="flex items-baseline gap-5 mb-5">
                        <span
                          className="font-black leading-none"
                          style={{
                            fontFamily: "'Barlow Condensed', sans-serif",
                            fontSize: "2.5rem",
                            color: "rgba(79,171,255,0.2)",
                            letterSpacing: "-0.02em",
                            minWidth: "2.5rem",
                          }}
                        >
                          {week}
                        </span>
                        <span
                          className="font-black text-2xl"
                          style={{ fontFamily: "'Barlow Condensed', sans-serif", color: DARK.text }}
                        >
                          {title}
                        </span>
                      </div>
                      <ul className="space-y-3 pl-1">
                        {items.map(it => <Check key={it} dark>{it}</Check>)}
                      </ul>
                    </div>
                  ))}
                  <div className="border-t" style={{ borderColor: DARK.border }} />
                </div>
              </Reveal>
            </div>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════
            SCAN STRIP  — light, horizontal
        ═══════════════════════════════════════════════════════ */}
        <section style={{ backgroundColor: LIGHT.bg }}>
          <div className="h-16" style={{
            backgroundColor: LIGHT.bg,
            clipPath: "polygon(0 100%, 100% 0, 100% 100%, 0 100%)",
            marginTop: "-1px",
          }} />
          <div className="max-w-7xl mx-auto px-6 sm:px-12 py-14 sm:py-20">
            <Reveal>
              <div className="flex flex-col lg:flex-row lg:items-end gap-12">
                <div className="flex-1">
                  <Eyebrow>Free supplement tool</Eyebrow>
                  <h2
                    className="font-black leading-none"
                    style={{
                      fontFamily: "'Barlow Condensed', sans-serif",
                      fontSize: "clamp(2.5rem, 5vw, 4.5rem)",
                      color: LIGHT.text,
                      letterSpacing: "-0.02em",
                    }}
                  >
                    SCAN A LABEL.<br />
                    <span style={{ color: LIGHT.accent }}>RIGHT NOW.</span>
                  </h2>
                  <p className="text-lg mt-5 leading-relaxed max-w-md" style={{ color: LIGHT.body }}>
                    Flag banned compounds before they become a career problem. No account needed.
                  </p>
                </div>
                <div className="flex flex-wrap gap-3">
                  {SCAN_LINKS.map(({ href, label }) => (
                    <Link
                      key={href}
                      href={href}
                      onClick={() => track("internal_link", { source: "scan_strip", target: href })}
                      className="inline-flex items-center gap-2 px-5 py-3.5 text-sm font-bold transition hover:shadow-md"
                      style={{
                        backgroundColor: LIGHT.surface,
                        border: `1px solid ${LIGHT.border}`,
                        color: LIGHT.body,
                      }}
                    >
                      {label} <ArrowRight className="w-4 h-4" />
                    </Link>
                  ))}
                </div>
              </div>
            </Reveal>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════
            FINAL CTA  — full-bleed dark, electric
        ═══════════════════════════════════════════════════════ */}
        <section
          className="relative overflow-hidden"
          style={{ backgroundColor: DARK.bg }}
        >
          {/* Top diagonal */}
          <div className="h-20" style={{
            backgroundColor: DARK.bg,
            clipPath: "polygon(0 0, 100% 100%, 0 100%)",
            marginTop: "-1px",
          }} />

          {/* Background accent glow */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background: `radial-gradient(ellipse 70% 60% at 50% 100%, rgba(79,171,255,0.08) 0%, transparent 70%)`,
            }}
          />

          {/* Ghost text watermark */}
          <div
            className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden select-none"
            aria-hidden
          >
            <p
              className="font-black text-center leading-none"
              style={{
                fontFamily: "'Barlow Condensed', sans-serif",
                fontSize: "clamp(12rem, 35vw, 30rem)",
                color: "rgba(255,255,255,0.02)",
                letterSpacing: "-0.05em",
                whiteSpace: "nowrap",
              }}
            >
              WIN
            </p>
          </div>

          <Reveal>
            <div className="relative z-10 max-w-4xl mx-auto px-6 sm:px-12 py-20 sm:py-32 text-center">
              <p className="text-xs font-black uppercase tracking-[0.3em] mb-6 sm:mb-8"
                style={{ color: DARK.accent, fontFamily: "'Barlow Condensed', sans-serif" }}
              >
                Join the program
              </p>
              <h2
                className="font-black leading-[0.9] mb-8 sm:mb-10"
                style={{
                  fontFamily: "'Barlow Condensed', sans-serif",
                  fontSize: "clamp(3.5rem, 12vw, 10rem)",
                  letterSpacing: "-0.03em",
                }}
              >
                STOP<br />
                <span style={{ color: DARK.accent }}>CHASING.</span><br />
                START<br />
                TRACKING.
              </h2>
              <p
                className="text-base sm:text-xl leading-relaxed mb-10 sm:mb-12 max-w-md mx-auto"
                style={{ color: DARK.body }}
              >
                30 days free. Onboard your athletes and dial in your templates. No card required.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
                <Cta source="final_cta" dark size="lg" className="w-full sm:w-auto justify-center">
                  Get started free <ArrowRight className="w-5 h-5" />
                </Cta>
                <button
                  type="button"
                  onClick={() => {
                    track("cta_auth_open", { source: "final_cta_athlete", role: "athlete" });
                    openAuthModal({ role: "athlete" });
                  }}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-3 px-10 py-5 text-base font-black uppercase tracking-widest border transition hover:border-white"
                  style={{ borderColor: DARK.border, color: "rgba(255,255,255,0.65)" }}
                >
                  I&apos;m an athlete
                </button>
              </div>
            </div>
          </Reveal>
        </section>

        {/* ═══════════════════════════════════════════════════════
            DISCLAIMER  — minimal dark footer strip
        ═══════════════════════════════════════════════════════ */}
        <section style={{ backgroundColor: "#040912", borderTop: `1px solid ${DARK.border}` }}>
          <div className="max-w-4xl mx-auto px-6 sm:px-12 py-8">
            <button
              type="button"
              onClick={() => setDisclaimerOpen(v => !v)}
              className="w-full flex items-center justify-between gap-4 text-left py-2 group"
              aria-expanded={disclaimerOpen}
            >
              <span className="text-sm font-bold" style={{ color: "rgba(255,255,255,0.4)" }}>
                ⚠ Supplement screening limitations — important notice
              </span>
              {disclaimerOpen
                ? <ChevronUp   className="w-4 h-4 shrink-0 opacity-40" />
                : <ChevronDown className="w-4 h-4 shrink-0 opacity-40" />
              }
            </button>
            {disclaimerOpen && (
              <p className="text-base leading-relaxed pb-6 mt-3" style={{ color: "rgba(255,255,255,0.45)" }}>
                CheckPeak provides screening guidance for potentially banned or high-risk substances using databases and label analysis. It is{" "}
                <strong style={{ color: "rgba(255,255,255,0.7)" }}>not 100% comprehensive</strong>{" "}
                and results do not replace official rulings or medical advice. Always verify with your governing body, certified authority, athletic trainer, or medical professional before consuming any product. Use saved scans as a starting point — final decisions should follow your program&apos;s compliance process.
              </p>
            )}
          </div>
        </section>

      </div>
    </>
  );
}