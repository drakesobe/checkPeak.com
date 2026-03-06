// pages/compliance/ncaa.jsx
import Head from "next/head";
import Link from "next/link";
import { motion } from "framer-motion";
import { FaArrowRight, FaExternalLinkAlt, FaClipboardList, FaShieldAlt } from "react-icons/fa";

import ComplianceSection from "@/components/info/ComplianceSection";

import { ncaaWordingCallouts }                      from "@/lib/compliance/ncaaWording";
import { ncaaResourceBackbone, NCAA_LAST_REVIEWED } from "@/lib/compliance/ncaaSources";

// ─── DS tokens ───────────────────────────────────────────────────────────────
const DS = {
  brand:        "#1E3A5F",
  brandBg:      "#EEF3F9",
  brandBorder:  "#C0D0E0",
  banned:       "#C8102E",
  cardBg:       "#FFFFFF",
  pageBg:       "#F7F9FC",
  border:       "#E8ECF0",
  labelText:    "#6B7A8D",
  bodyText:     "#2D3748",
  dimText:      "#9BA8B4",
};

const FONTS = `
  @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@700;800;900&family=Barlow:wght@400;500;600;700&display=swap');
  .bc { font-family: 'Barlow Condensed', sans-serif; }
  .bw { font-family: 'Barlow', sans-serif; }
`;

const fadeUp = { hidden: { opacity: 0, y: 16 }, visible: { opacity: 1, y: 0 } };
const fadeIn = { hidden: { opacity: 0 },         visible: { opacity: 1 } };

// ─── Quick link pill ─────────────────────────────────────────────────────────
function QuickLink({ href, children }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="bw inline-flex items-center gap-2 px-3 py-1.5 text-xs font-bold transition-all rounded-sm"
      style={{
        backgroundColor: "rgba(255,255,255,0.1)",
        border: "1px solid rgba(255,255,255,0.18)",
        color: "rgba(255,255,255,0.85)",
      }}
      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.18)")}
      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.1)")}
    >
      <FaExternalLinkAlt className="opacity-60 text-[10px]" />
      <span className="whitespace-nowrap">{children}</span>
    </a>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function NcaaCompliancePage() {
  const wording = Array.isArray(ncaaWordingCallouts)   ? ncaaWordingCallouts   : [];
  const sources = Array.isArray(ncaaResourceBackbone)  ? ncaaResourceBackbone  : [];

  return (
    <>
      <Head>
        <title>CheckPeak — NCAA Rules</title>
        <meta
          name="description"
          content="Direct NCAA resources and how CheckPeak stays NCAA-aligned."
        />
      </Head>
      <style dangerouslySetInnerHTML={{ __html: FONTS }} />

      <div className="bw min-h-screen" style={{ backgroundColor: DS.pageBg }}>

        {/* ── HERO ──────────────────────────────────────────────────────── */}
        <section style={{ backgroundColor: DS.brand }}>
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-14 pb-12 sm:pt-20 sm:pb-16">
            <div className="grid lg:grid-cols-12 gap-10 items-start">

              {/* Left — copy */}
              <div className="lg:col-span-7">
                <motion.div initial="hidden" animate="visible" variants={fadeUp} transition={{ duration: 0.5 }}>

                  {/* Eyebrow */}
                  <span
                    className="bw inline-flex items-center px-3 py-1 text-xs font-black uppercase tracking-wider rounded-sm mb-4"
                    style={{
                      backgroundColor: "rgba(255,255,255,0.1)",
                      border: "1px solid rgba(255,255,255,0.18)",
                      color: "rgba(255,255,255,0.75)",
                    }}
                  >
                    Compliance · NCAA Rules
                  </span>

                  <h1
                    className="bc font-black uppercase leading-none mb-4"
                    style={{
                      fontSize: "clamp(1.9rem, 6vw, 3.5rem)",
                      color: "#fff",
                      letterSpacing: "0.01em",
                    }}
                  >
                    NCAA rules{" "}
                    <span style={{ color: "#C8102E" }}>reference</span>
                  </h1>

                  {/* Red rule */}
                  <div
                    className="mb-5"
                    style={{ height: 2, width: "3rem", backgroundColor: DS.banned }}
                  />

                  <p
                    className="bw text-base leading-relaxed max-w-xl mb-6"
                    style={{ color: "rgba(255,255,255,0.78)" }}
                  >
                    Direct NCAA sources + short callouts. Built to support program-first compliance.
                  </p>

                  {/* Pill badges */}
                  <div className="flex flex-wrap gap-2 mb-7">
                    {[
                      { icon: <FaClipboardList />, label: "Actionable insight" },
                      { icon: <FaShieldAlt />,     label: "Defensible compliance" },
                      { icon: <FaExternalLinkAlt />, label: "Official links" },
                    ].map((p) => (
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

                  {/* CTAs */}
                  <div className="flex flex-col sm:flex-row gap-3 mb-6">
                    <a
                      href="#ncaa-compliance"
                      className="bw inline-flex items-center justify-center gap-2 px-6 py-3 rounded-sm text-sm font-bold transition-all"
                      style={{ backgroundColor: "#fff", color: DS.brand }}
                      onMouseEnter={(e) => (e.currentTarget.style.filter = "brightness(0.96)")}
                      onMouseLeave={(e) => (e.currentTarget.style.filter = "none")}
                    >
                      How we stay aligned <FaArrowRight className="opacity-60" />
                    </a>
                    <Link href="/info" legacyBehavior>
                      <a
                        className="bw inline-flex items-center justify-center gap-2 px-6 py-3 rounded-sm text-sm font-bold transition-all"
                        style={{
                          backgroundColor: "rgba(255,255,255,0.1)",
                          border: "1px solid rgba(255,255,255,0.22)",
                          color: "#fff",
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.18)")}
                        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.1)")}
                      >
                        Info Hub <FaArrowRight className="opacity-60" />
                      </a>
                    </Link>
                  </div>

                  {/* Quick links */}
                  <div className="flex flex-wrap gap-2 mb-5">
                    <QuickLink href="https://ncaaorg.s3.amazonaws.com/compliance/d1/D1Comp_TimeDemandsInfo.pdf">
                      CARA / VARA / RARA
                    </QuickLink>
                    <QuickLink href="https://www.ncaa.org/sports/2015/6/10/ncaa-banned-substances.aspx">
                      Banned substances
                    </QuickLink>
                    <QuickLink href="https://www.ncaa.org/news/2020/5/20/di-council-allows-football-basketball-to-have-voluntary-athletics-activities-starting-june-1.aspx">
                      Voluntary guidance
                    </QuickLink>
                  </div>

                  <p
                    className="bw text-xs"
                    style={{ color: "rgba(255,255,255,0.42)" }}
                  >
                    Educational use only. CheckPeak does not replace official rules, team policy, or medical/legal advice.
                  </p>
                </motion.div>
              </div>

              {/* Right — how to use panel */}
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
                    className="bc font-black uppercase text-sm mb-4 tracking-wide"
                    style={{ color: "rgba(255,255,255,0.9)" }}
                  >
                    How to use this page
                  </p>
                  <ul className="space-y-3 mb-5">
                    {[
                      "Start with NCAA sources — links below",
                      "Use callouts to explain the \"why\" to athletes",
                      "If it's unclear: don't hesitate to ask compliance staff",
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

                  <div style={{ borderTop: "1px solid rgba(255,255,255,0.1)", marginBottom: "1rem" }} />

                  <div
                    className="px-3 py-2.5"
                    style={{
                      backgroundColor: "rgba(30,58,95,0.4)",
                      borderLeft: `3px solid ${DS.brandBorder}`,
                    }}
                  >
                    <p
                      className="bw text-xs font-bold mb-1 uppercase tracking-wider"
                      style={{ color: "rgba(255,255,255,0.6)" }}
                    >
                      Reminder
                    </p>
                    <p
                      className="bw text-xs leading-relaxed"
                      style={{ color: "rgba(255,255,255,0.78)" }}
                    >
                      Voluntary rules apply to voluntary activity (VARA). Required or countable activities are separate.
                    </p>
                  </div>
                </motion.div>
              </div>

            </div>
          </div>
        </section>

        {/* ── NCAA COMPLIANCE ───────────────────────────────────────────── */}
        <div
          id="ncaa-compliance"
          style={{ scrollMarginTop: "calc(var(--app-header-h, 64px) + 24px)", paddingTop: "3rem" }}
        >
          <ComplianceSection
            wording={wording}
            ncaaSources={sources}
            lastReviewed={NCAA_LAST_REVIEWED}
          />
        </div>

        {/* ── FOOTER ───────────────────────────────────────────────────── */}
        <footer
          className="py-8 px-4 sm:px-6"
          style={{ backgroundColor: "#0F1E30", borderTop: "1px solid rgba(255,255,255,0.06)" }}
        >
          <div className="max-w-6xl mx-auto text-center">
            <p
              className="bw text-xs uppercase tracking-wide"
              style={{ color: "rgba(255,255,255,0.28)" }}
            >
              © {new Date().getFullYear()} CheckPeak · Educational use only
            </p>
          </div>
        </footer>

      </div>
    </>
  );
}