// pages/info.js
import Head from "next/head";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  FaArrowRight, FaCamera, FaSearch, FaShieldAlt,
  FaExclamationTriangle,
} from "react-icons/fa";

import SectionHeader     from "@/components/info/SectionHeader";
import InfoCard          from "@/components/info/InfoCard";
import ResourceLink      from "@/components/info/ResourceLink";
import ComplianceSection from "@/components/info/ComplianceSection";

import * as InfoContent from "@/lib/info/infoContent";
import { ncaaWordingCallouts }                      from "@/lib/compliance/ncaaWording";
import { ncaaResourceBackbone, NCAA_LAST_REVIEWED } from "@/lib/compliance/ncaaSources";

// ─── DS tokens ───────────────────────────────────────────────────────────────
const DS = {
  brand:         "#1E3A5F",
  brandBg:       "#EEF3F9",
  brandBorder:   "#C0D0E0",
  banned:        "#C8102E",
  bannedBg:      "#FFF0F0",
  bannedBorder:  "#FFC8C8",
  caution:       "#E87722",
  cautionBg:     "#FFFBF0",
  cautionBorder: "#FFE0A8",
  cautionText:   "#7A4A0A",
  cardBg:        "#FFFFFF",
  pageBg:        "#F7F9FC",
  border:        "#E8ECF0",
  labelText:     "#6B7A8D",
  bodyText:      "#2D3748",
  dimText:       "#9BA8B4",
};

// ─── Global font injection ────────────────────────────────────────────────────
const FONTS = `
  @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:ital,wght@0,700;0,800;0,900;1,700&family=Barlow:wght@400;500;600;700&display=swap');
  .bc { font-family: 'Barlow Condensed', sans-serif; }
  .bw { font-family: 'Barlow', sans-serif; }
`;

// ─── Step progression colors ─────────────────────────────────────────────────
const STEP_COLORS = ["#4A7FA5", "#2E6491", "#1E4F7A", "#1E3A5F"];

// ─── Animation presets ───────────────────────────────────────────────────────
const fadeUp   = { hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 } };
const fadeIn   = { hidden: { opacity: 0 },         visible: { opacity: 1 } };
const stagger  = (i) => ({ duration: 0.45, delay: i * 0.07 });

// ─── Eyebrow label ───────────────────────────────────────────────────────────
function Eyebrow({ children, light = false }) {
  return (
    <span
      className="bw inline-flex items-center px-3 py-1 text-xs font-black uppercase tracking-[0.14em] rounded-sm mb-4"
      style={{
        backgroundColor: light ? "rgba(255,255,255,0.1)"  : DS.brandBg,
        border:          light ? "1px solid rgba(255,255,255,0.18)" : `1px solid ${DS.brandBorder}`,
        color:           light ? "rgba(255,255,255,0.75)" : DS.brand,
      }}
    >
      {children}
    </span>
  );
}

// ─── Stat block (scoreboard) ─────────────────────────────────────────────────
function Stat({ value, label, index }) {
  return (
    <motion.div
      className="text-center px-6 py-2"
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true }}
      variants={fadeUp}
      transition={stagger(index)}
    >
      <p
        className="bc font-black leading-none"
        style={{ fontSize: "clamp(2rem, 5vw, 3.5rem)", color: "#fff" }}
      >
        {value}
      </p>
      <p
        className="bw text-xs font-bold uppercase tracking-wider mt-2"
        style={{ color: "rgba(255,255,255,0.5)" }}
      >
        {label}
      </p>
    </motion.div>
  );
}

// ─── Playbook step card ───────────────────────────────────────────────────────
function StepCard({ step, index }) {
  const stepColor = STEP_COLORS[index] || STEP_COLORS[STEP_COLORS.length - 1];
  return (
    <motion.article
      className="relative overflow-hidden flex flex-col"
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.15 }}
      variants={fadeUp}
      transition={stagger(index)}
      style={{
        backgroundColor: DS.cardBg,
        border: `1px solid ${DS.border}`,
        borderTop: `4px solid ${stepColor}`,
      }}
    >
      {/* Watermark step number */}
      <span
        className="bc absolute top-2 right-3 font-black select-none pointer-events-none"
        style={{
          fontSize: "5rem",
          lineHeight: 1,
          color: `${stepColor}22`,
          userSelect: "none",
        }}
        aria-hidden
      >
        {index + 1}
      </span>

      <div className="relative p-5 sm:p-6 flex flex-col flex-1">
        {/* Step badge + icon */}
        <div className="flex items-center gap-3 mb-4">
          <span
            className="bc inline-flex items-center justify-center w-7 h-7 font-black text-xs shrink-0"
            style={{
              backgroundColor: stepColor,
              color: "#fff",
            }}
          >
            {index + 1}
          </span>
          <div
            className="flex items-center justify-center w-8 h-8 shrink-0"
            style={{ backgroundColor: DS.brandBg, border: `1px solid ${DS.brandBorder}` }}
          >
            {step.icon}
          </div>
        </div>

        {/* Title */}
        <h3
          className="bc font-black uppercase leading-tight mb-2"
          style={{
            fontSize: "1.05rem",
            color: DS.bodyText,
            letterSpacing: "0.04em",
          }}
        >
          {step.label}
        </h3>

        {/* Body */}
        <p
          className="bw text-sm leading-relaxed flex-1"
          style={{ color: DS.labelText }}
        >
          {step.description}
        </p>

        {/* Outcome */}
        <div
          className="mt-4 px-3 py-2"
          style={{
            backgroundColor: DS.brandBg,
            borderLeft: `3px solid ${stepColor}`,
          }}
        >
          <p className="bw text-xs sm:text-sm" style={{ color: stepColor }}>
            <span className="font-bold">Outcome: </span>
            <span>{step.outcome}</span>
          </p>
        </div>
      </div>
    </motion.article>
  );
}

// ─── CTA button ──────────────────────────────────────────────────────────────
function CtaButton({ href, icon, children, primary = false }) {
  return (
    <Link href={href} legacyBehavior>
      <a
        className="bw inline-flex items-center justify-center gap-2 px-6 py-3 text-sm font-bold transition-all rounded-sm"
        style={
          primary
            ? { backgroundColor: "#fff", color: DS.brand }
            : {
                backgroundColor: "rgba(255,255,255,0.1)",
                border: "1px solid rgba(255,255,255,0.22)",
                color: "#fff",
              }
        }
        onMouseEnter={(e) => {
          e.currentTarget.style.filter = primary ? "brightness(0.95)" : "none";
          if (!primary) e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.18)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.filter = "none";
          if (!primary) e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.1)";
        }}
      >
        {icon}
        {children}
        {primary && <FaArrowRight className="opacity-50" />}
      </a>
    </Link>
  );
}

// ─── Divider ─────────────────────────────────────────────────────────────────
function Divider() {
  return (
    <div
      className="max-w-6xl mx-auto px-4 sm:px-6"
      style={{ borderTop: `1px solid ${DS.border}` }}
    />
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function InfoPage() {
  const infoHero         = InfoContent?.infoHero          || {};
  const howItWorksSteps  = Array.isArray(InfoContent?.howItWorksSteps)  ? InfoContent.howItWorksSteps  : [];
  const productPillars   = Array.isArray(InfoContent?.productPillars)   ? InfoContent.productPillars   : [];
  const positioningCards = Array.isArray(InfoContent?.positioningCards) ? InfoContent.positioningCards : [];
  const safetyNotes      = Array.isArray(InfoContent?.safetyNotes)      ? InfoContent.safetyNotes      : [];
  const heroPills        = Array.isArray(infoHero?.pills) ? infoHero.pills : [];
  const primaryCta       = infoHero?.primaryCta   || { href: "/nutrition-label-scanner", label: "Scan a Label" };
  const secondaryCta     = infoHero?.secondaryCta || { href: "/search", label: "Search Ingredients" };
  const safety           = safetyNotes[0] || null;

  return (
    <>
      <Head>
        <title>CheckPeak — Info &amp; NCAA Compliance</title>
        <meta
          name="description"
          content="CheckPeak supports workout + nutrition accountability and supplement risk awareness, with direct NCAA resource links."
        />
      </Head>
      <style dangerouslySetInnerHTML={{ __html: FONTS }} />

      <div className="bw min-h-screen" style={{ backgroundColor: DS.pageBg }}>

        {/* ══════════════════════════════════════════════════════════════════
            1. HERO — dark navy, massive editorial type
           ══════════════════════════════════════════════════════════════════ */}
        <section style={{ backgroundColor: DS.brand }}>
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-14 pb-12 sm:pt-20 sm:pb-16">
            <div className="grid lg:grid-cols-12 gap-10 items-start">

              {/* Left — headline block */}
              <div className="lg:col-span-7">
                <motion.div initial="hidden" animate="visible" variants={fadeUp} transition={{ duration: 0.5 }}>
                  <Eyebrow light>
                    {infoHero?.kicker || "CheckPeak · Athlete Tools + Team Workflows"}
                  </Eyebrow>

                  {/* Main headline — massive condensed */}
                  <h1
                    className="bc font-black leading-none mb-5"
                    style={{
                      fontSize: "clamp(1.9rem, 6vw, 3.5rem)",
                      color: "#fff",
                      letterSpacing: "0.01em",
                      textTransform: "uppercase",
                    }}
                  >
                    Accountability builds{" "}
                    <span style={{ color: DS.caution }}>confidence</span>
                    {" "}—{" "}
                    <br className="hidden sm:block" />
                    even off campus.
                  </h1>

                  {/* Thin rule */}
                  <div
                    className="mb-5"
                    style={{ height: 2, width: "3rem", backgroundColor: DS.banned }}
                  />

                  <p
                    className="bw text-base leading-relaxed max-w-xl mb-7"
                    style={{ color: "rgba(255,255,255,0.78)" }}
                  >
                    {infoHero?.subtitle ||
                      "CheckPeak keeps athletes and staff aligned away from campus with clear plans, quick check-ins, and staff visibility."}
                  </p>

                  {/* Pill badges */}
                  {heroPills.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-7">
                      {heroPills.map((p) => (
                        <span
                          key={p.label}
                          className="bw inline-flex items-center gap-1.5 px-3 py-1 text-xs font-bold rounded-sm"
                          style={{
                            backgroundColor: "rgba(255,255,255,0.1)",
                            border: "1px solid rgba(255,255,255,0.18)",
                            color: "rgba(255,255,255,0.85)",
                          }}
                        >
                          {p.icon}
                          {p.label}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* CTAs */}
                  <div className="flex flex-col sm:flex-row gap-3 mb-6">
                    <CtaButton href={primaryCta.href} icon={<FaCamera />} primary>
                      {primaryCta.label}
                    </CtaButton>
                    <CtaButton href={secondaryCta.href} icon={<FaSearch />}>
                      {secondaryCta.label}
                    </CtaButton>
                  </div>

                  {/* Anchor nav */}
                  <div className="flex flex-wrap gap-5">
                    {[
                      { href: "#how-it-works",   label: "→ How it works" },
                      { href: "#ncaa-compliance", label: "→ NCAA compliance" },
                    ].map((l) => (
                      <a
                        key={l.href}
                        href={l.href}
                        className="bw text-xs font-bold uppercase tracking-wider hover:underline"
                        style={{ color: "rgba(255,255,255,0.55)" }}
                      >
                        {l.label}
                      </a>
                    ))}
                  </div>

                  {infoHero?.microDisclaimer && (
                    <p
                      className="bw text-xs sm:text-sm mt-5"
                      style={{ color: "rgba(255,255,255,0.42)" }}
                    >
                      {infoHero.microDisclaimer}
                    </p>
                  )}
                </motion.div>
              </div>

              {/* Right — what we're best at */}
              <div className="lg:col-span-5">
                <motion.div
                  initial="hidden"
                  animate="visible"
                  variants={fadeIn}
                  transition={{ duration: 0.5, delay: 0.15 }}
                  style={{
                    border: "1px solid rgba(255,255,255,0.12)",
                    borderTop: `4px solid ${DS.banned}`,
                    backgroundColor: "rgba(255,255,255,0.04)",
                  }}
                  className="p-5 sm:p-6"
                >
                  <p
                    className="bc font-black uppercase text-sm sm:text-base mb-4 tracking-wide"
                    style={{ color: "rgba(255,255,255,0.9)" }}
                  >
                    What CheckPeak does best
                  </p>
                  <ul className="space-y-3 mb-5">
                    {[
                      "Off-season accountability with consistent check-ins",
                      "Evidence-based workout completions + staff review workflows",
                      "Supplement screening as a fast first pass",
                    ].map((item, i) => (
                      <li key={i} className="flex items-start gap-3">
                        <span
                          className="bc shrink-0 font-black text-xs mt-0.5 w-5 h-5 flex items-center justify-center"
                          style={{ backgroundColor: DS.banned, color: "#fff" }}
                        >
                          {i + 1}
                        </span>
                        <span
                          className="bw text-sm leading-relaxed"
                          style={{ color: "rgba(255,255,255,0.75)" }}
                        >
                          {item}
                        </span>
                      </li>
                    ))}
                  </ul>

                  {/* Divider */}
                  <div style={{ borderTop: "1px solid rgba(255,255,255,0.1)", marginBottom: "1rem" }} />

                  {/* Mini reminder */}
                  <div
                    className="px-3 py-2.5"
                    style={{ backgroundColor: "rgba(200,16,46,0.18)", borderLeft: `3px solid ${DS.banned}` }}
                  >
                    <p className="bw text-xs font-semibold" style={{ color: "rgba(255,255,255,0.85)" }}>
                      Always confirm with your compliance and medical staff before consuming any product.
                    </p>
                  </div>
                </motion.div>
              </div>

            </div>
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════════════════
            2. RISK CALLOUT — full red band, emotional hook
           ══════════════════════════════════════════════════════════════════ */}
        <section style={{ backgroundColor: "#0F1E30" }}>
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-12">
            <motion.div
              className="grid md:grid-cols-12 gap-6 items-center"
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, amount: 0.3 }}
              variants={fadeUp}
              transition={{ duration: 0.5 }}
            >
              {/* Big statement */}
              <div className="md:col-span-8">
                <h2
                  className="bc font-black uppercase leading-none"
                  style={{
                    fontSize: "clamp(1.6rem, 5vw, 3rem)",
                    color: "#fff",
                    letterSpacing: "0.02em",
                  }}
                >
                  One substance.{" "}
                  One test.{" "}
                  <span style={{ color: "#C8102E" }}>Career over.</span>
                </h2>
                <p
                  className="bw text-sm sm:text-base leading-relaxed mt-4 max-w-2xl"
                  style={{ color: "rgba(255,255,255,0.8)" }}
                >
                  Supplements are contaminated, mislabeled, and relabeled every year.
                  The NCAA doesn't care about intent — a positive test is a positive test.
                  CheckPeak gives athletes a fast first-pass screen before anything goes in their body.
                </p>
              </div>

              {/* Scan CTA */}
              <div className="md:col-span-4 flex justify-start md:justify-end">
                <Link href="/nutrition-label-scanner" legacyBehavior>
                  <a
                    className="bw inline-flex items-center gap-2 px-6 py-3.5 font-bold text-sm rounded-sm transition-all"
                    style={{ backgroundColor: "#fff", color: "#0F1E30" }}
                    onMouseEnter={(e) => (e.currentTarget.style.filter = "brightness(0.96)")}
                    onMouseLeave={(e) => (e.currentTarget.style.filter = "none")}
                  >
                    <FaCamera />
                    Scan a label now
                    <FaArrowRight className="opacity-60" />
                  </a>
                </Link>
              </div>
            </motion.div>
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════════════════
            3. WHAT YOU GET — three pillars
           ══════════════════════════════════════════════════════════════════ */}
        <section className="max-w-6xl mx-auto px-4 sm:px-6 py-14 sm:py-16">
          <SectionHeader
            kicker="What you get"
            title="Three tools."
            titleAccent="One place."
            subtitle="Workout accountability, nutrition targets, and supplement screening — one repeatable workflow."
          />
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {productPillars.map((p) => (
              <InfoCard key={p.title} icon={p.icon} title={p.title} text={p.text} />
            ))}
          </div>


        </section>

        {/* ══════════════════════════════════════════════════════════════════
            4. HOW IT WORKS — white, playbook steps
           ══════════════════════════════════════════════════════════════════ */}
        <section
          id="how-it-works"
          className="max-w-6xl mx-auto px-4 sm:px-6 py-14 sm:py-16"
          style={{ scrollMarginTop: "calc(var(--app-header-h, 64px) + 24px)" }}
        >
          <SectionHeader
            kicker="The workflow"
            title="Simple check-ins."
            titleAccent="Clear feedback."
            subtitle="Easy for athletes to use, quick for staff to review. Everything stays organized by athlete, team, and date."
          />

          <div className="mt-8 grid gap-4 sm:gap-5 md:grid-cols-2 lg:grid-cols-3">
            {howItWorksSteps.map((step, index) => (
              <StepCard key={step.label || index} step={step} index={index} />
            ))}
          </div>

          <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
            {[
              { href: "/nutrition-label-scanner", icon: <FaCamera />, label: "Run a supplement scan" },
              { href: "/search",                  icon: <FaSearch />, label: "Search ingredients" },
            ].map((l) => (
              <Link key={l.href} href={l.href} legacyBehavior>
                <a
                  className="bw inline-flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-bold transition-all rounded-sm"
                  style={{
                    backgroundColor: DS.brandBg,
                    color: DS.brand,
                    border: `1px solid ${DS.brandBorder}`,
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#D8E6F3")}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = DS.brandBg)}
                >
                  {l.icon}
                  {l.label} →
                </a>
              </Link>
            ))}
          </div>
        </section>

        <Divider />

        {/* ══════════════════════════════════════════════════════════════════
            5. SCOREBOARD — dark navy, ESPN-style stats
           ══════════════════════════════════════════════════════════════════ */}
        <section style={{ backgroundColor: DS.brand }}>
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-14 sm:py-16">
            <div className="text-center mb-10">
              <Eyebrow light>By the numbers</Eyebrow>
              <h2
                className="bc font-black uppercase"
                style={{
                  fontSize: "clamp(1.4rem, 3.5vw, 2.25rem)",
                  color: "#fff",
                  letterSpacing: "0.02em",
                }}
              >
                The database behind every scan
              </h2>
            </div>

            {/* Stats grid */}
            <div
              className="grid grid-cols-2 md:grid-cols-4 gap-0"
              style={{ border: "1px solid rgba(255,255,255,0.1)" }}
            >
              {[
                { value: "900+",  label: "Substances tracked" },
                { value: "1000+",  label: "Ingredients mapped" },
                { value: "4",     label: "Data providers" },
                { value: "D2",    label: "Program focus" },
              ].map((s, i) => (
                <div
                  key={s.label}
                  className="py-8 px-4"
                  style={{
                    borderRight: i < 3 ? "1px solid rgba(255,255,255,0.08)" : "none",
                    textAlign: "center",
                  }}
                >
                  <Stat value={s.value} label={s.label} index={i} />
                </div>
              ))}
            </div>

            {/* Sub-note */}
            <p
              className="bw text-xs text-center mt-5 uppercase tracking-wide"
              style={{ color: "rgba(255,255,255,0.35)" }}
            >
              Data synced from Airtable at build time · Updated quarterly
            </p>
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════════════════
            6. POSITIONING — white, editorial cards
           ══════════════════════════════════════════════════════════════════ */}
        {positioningCards.length > 0 && (
          <section
            className="max-w-6xl mx-auto px-4 sm:px-6 py-14 sm:py-16"
          >
            <SectionHeader
              kicker="Why teams use CheckPeak"
              title="Away-from-campus is where"
              titleAccent="plans drift"
              subtitle="Offseason, breaks, travel, and rehab are where routines get messy. CheckPeak keeps it simple: athletes check in, staff responds, everyone stays aligned."
            />
            <div className="mt-8 grid gap-4 md:grid-cols-3">
              {positioningCards.map((c) => (
                <InfoCard key={c.title} icon={c.icon} title={c.title} text={c.text} />
              ))}
            </div>
          </section>
        )}

        <Divider />

        {/* ══════════════════════════════════════════════════════════════════
            7. NCAA COMPLIANCE
           ══════════════════════════════════════════════════════════════════ */}
        <div style={{ backgroundColor: DS.pageBg, paddingTop: "2rem" }}>
          <ComplianceSection
            wording={Array.isArray(ncaaWordingCallouts)   ? ncaaWordingCallouts   : []}
            ncaaSources={Array.isArray(ncaaResourceBackbone) ? ncaaResourceBackbone : []}
            lastReviewed={NCAA_LAST_REVIEWED}
          />
        </div>

        {/* ══════════════════════════════════════════════════════════════════
            8. TRUSTED RESOURCES
           ══════════════════════════════════════════════════════════════════ */}
        <section
          className="max-w-6xl mx-auto px-4 sm:px-6 pb-16"
          style={{ backgroundColor: DS.pageBg }}
        >
          <SectionHeader
            kicker="Trusted resources"
            title="Use CheckPeak alongside"
            titleAccent="official bodies"
            subtitle="For final decisions, cross-reference official rules and your program's compliance process."
          />
          <div className="mt-8 grid gap-3 md:grid-cols-2">
            {[
              { name: "WADA — World Anti-Doping Agency",  desc: "Global authority for the World Anti-Doping Code and Prohibited List.",   href: "https://www.wada-ama.org/" },
              { name: "USADA — U.S. Anti-Doping Agency",  desc: "U.S. education resources and prohibited list guidance.",                  href: "https://www.usada.org/" },
              { name: "NSF Certified for Sport",          desc: "Third-party testing program for supplement certification.",               href: "https://www.nsfsport.com/certified-for-sport/" },
              { name: "Informed Sport",                   desc: "Global supplement testing and certification program.",                    href: "https://sport.wetestyoutrust.com/" },
            ].map((r) => (
              <ResourceLink key={r.href} name={r.name} desc={r.desc} href={r.href} />
            ))}
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════════════════
            DISCLAIMER — safety notice + legal note
           ══════════════════════════════════════════════════════════════════ */}
        <section className="max-w-6xl mx-auto px-4 sm:px-6 pb-10">
          {safety && (
            <motion.div
              className="px-5 py-4 flex gap-3"
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={fadeUp}
              transition={{ duration: 0.4 }}
              style={{
                backgroundColor: DS.bannedBg,
                border: `1px solid ${DS.bannedBorder}`,
                borderLeft: `4px solid ${DS.banned}`,
              }}
            >
              <FaExclamationTriangle
                className="shrink-0 mt-0.5"
                style={{ color: DS.banned }}
              />
              <div>
                <p
                  className="bc font-black uppercase text-sm tracking-wider mb-1"
                  style={{ color: DS.banned }}
                >
                  {safety.title}
                </p>
                <p className="bw text-sm leading-relaxed" style={{ color: "#7A1A1A" }}>
                  {safety.body}
                </p>
                {infoHero?.legalNote && (
                  <p className="bw text-xs mt-2" style={{ color: "#9B3333" }}>
                    {infoHero.legalNote}
                  </p>
                )}
              </div>
            </motion.div>
          )}
        </section>

        {/* ══════════════════════════════════════════════════════════════════
            9. CTA CLOSER — dark navy banner
           ══════════════════════════════════════════════════════════════════ */}
        <section style={{ backgroundColor: DS.brand }}>
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-14 sm:py-16">
            <motion.div
              className="grid md:grid-cols-12 gap-8 items-center"
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, amount: 0.3 }}
              variants={fadeUp}
              transition={{ duration: 0.5 }}
            >
              <div className="md:col-span-8">
                {/* Red rule */}
                <div style={{ height: 3, width: "2.5rem", backgroundColor: DS.banned, marginBottom: "1rem" }} />
                <h2
                  className="bc font-black uppercase leading-none mb-4"
                  style={{
                    fontSize: "clamp(1.6rem, 4.5vw, 3rem)",
                    color: "#fff",
                    letterSpacing: "0.02em",
                  }}
                >
                  Run your next label through{" "}
                  <span style={{ color: DS.caution }}>CheckPeak</span>{" "}
                  in seconds.
                </h2>
                <p className="bw text-sm" style={{ color: "rgba(255,255,255,0.6)" }}>
                  Scan a label or search ingredients — then confirm with staff when uncertain.
                </p>
              </div>
              <div className="md:col-span-4 flex flex-col sm:flex-row md:flex-col gap-3 md:items-end">
                <CtaButton href="/nutrition-label-scanner" icon={<FaCamera />} primary>
                  Scan a Label
                </CtaButton>
                <CtaButton href="/search" icon={<FaSearch />}>
                  Search Ingredients
                </CtaButton>
              </div>
            </motion.div>
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════════════════
            FOOTER
           ══════════════════════════════════════════════════════════════════ */}
        <footer
          className="py-8 px-4 sm:px-6"
          style={{ backgroundColor: "#0F1E30", borderTop: "1px solid rgba(255,255,255,0.06)" }}
        >
          <div className="max-w-6xl mx-auto text-center">
            <p
              className="bw text-xs uppercase tracking-wide"
              style={{ color: "rgba(255,255,255,0.28)" }}
            >
              © {new Date().getFullYear()} CheckPeak · Educational use only · Always defer to your compliance office and health care staff.
            </p>
          </div>
        </footer>

      </div>
    </>
  );
}