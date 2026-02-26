// pages/compliance/ncaa.jsx
"use client";

import Head from "next/head";
import Link from "next/link";
import { motion } from "framer-motion";
import { FaArrowRight, FaExternalLinkAlt, FaClipboardList, FaShieldAlt } from "react-icons/fa";

import ComplianceSection from "@/components/info/ComplianceSection";

import { ncaaWordingCallouts } from "@/lib/compliance/ncaaWording";
import { ncaaResourceBackbone, NCAA_LAST_REVIEWED } from "@/lib/compliance/ncaaSources";

const fadeUp = { hidden: { opacity: 0, y: 14 }, visible: { opacity: 1, y: 0 } };
const fadeIn = { hidden: { opacity: 0 }, visible: { opacity: 1 } };

function Pill({ icon, children }) {
  return (
    <div className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold bg-white/15 border-white/20 text-white">
      <span className="opacity-95">{icon}</span>
      <span className="whitespace-nowrap">{children}</span>
    </div>
  );
}

function anchorStyle() {
  return { scrollMarginTop: "calc(var(--app-header-h, 64px) + 24px)" };
}

function TopLink({ href, children }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-semibold text-white/95 hover:bg-white/15 transition"
    >
      <FaExternalLinkAlt className="text-white/70" />
      <span className="whitespace-nowrap">{children}</span>
    </a>
  );
}

export default function NcaaCompliancePage() {
  const wording = Array.isArray(ncaaWordingCallouts) ? ncaaWordingCallouts : [];
  const sources = Array.isArray(ncaaResourceBackbone) ? ncaaResourceBackbone : [];

  return (
    <>
      <Head>
        <title>CheckPeak — NCAA Rules</title>
        <meta
          name="description"
          content="Direct NCAA resources and how CheckPeak stays NCAA-aligned."
        />
      </Head>

      <div className="min-h-screen bg-slate-50 text-gray-900 font-sans">
        {/* HERO (same structure as /info.js, less words) */}
        <section className="relative overflow-hidden bg-[#46769B] text-white">
          <div className="absolute inset-0 opacity-[0.14] pointer-events-none">
            <div className="absolute -top-24 -left-24 w-72 h-72 rounded-full bg-white blur-3xl" />
            <div className="absolute -bottom-28 -right-28 w-80 h-80 rounded-full bg-white blur-3xl" />
          </div>

          <div className="px-4 sm:px-6 md:px-10 pt-12 pb-10 sm:pt-16 sm:pb-14">
            <div className="max-w-6xl mx-auto">
              <div className="grid lg:grid-cols-12 gap-8 items-center">
                {/* Left */}
                <div className="lg:col-span-7">
                  <motion.div initial="hidden" animate="visible" variants={fadeUp} transition={{ duration: 0.5 }}>
                    <p className="text-xs font-extrabold tracking-widest text-slate-100/90 uppercase">
                      COMPLIANCE • NCAA RULES
                    </p>

                    <h1 className="mt-2 text-3xl sm:text-4xl md:text-5xl font-extrabold leading-tight">
                      NCAA rules reference
                    </h1>

                    <p className="mt-4 text-base sm:text-lg text-slate-100 leading-relaxed max-w-2xl">
                      Direct NCAA sources + short callouts. Built to support program-first compliance.
                    </p>

                    <div className="mt-5 flex flex-wrap gap-2">
                      <Pill icon={<FaClipboardList />}>Actionable insight</Pill>
                      <Pill icon={<FaShieldAlt />}>Defensible compliance</Pill>
                      <Pill icon={<FaExternalLinkAlt />}>Official links</Pill>
                    </div>

                    <div className="mt-7 flex flex-col sm:flex-row gap-3 sm:gap-4">
                      <a
                        href="#ncaa-compliance"
                        className="w-full sm:w-auto px-5 py-3 sm:px-6 sm:py-3.5 bg-white text-[#46769B] font-extrabold rounded-2xl shadow-sm hover:shadow-md transition transform hover:-translate-y-0.5 inline-flex items-center justify-center gap-2 text-sm sm:text-base"
                      >
                        How we stay aligned <FaArrowRight className="opacity-70" />
                      </a>

                      <Link href="/info" legacyBehavior>
                        <a className="w-full sm:w-auto px-5 py-3 sm:px-6 sm:py-3.5 bg-white/10 border border-white/20 text-white font-extrabold rounded-2xl shadow-sm hover:shadow-md transition transform hover:-translate-y-0.5 inline-flex items-center justify-center gap-2 text-sm sm:text-base">
                          Info Hub <FaArrowRight className="opacity-80" />
                        </a>
                      </Link>
                    </div>

                    <div className="mt-5 flex flex-wrap gap-3">
                      <TopLink href="https://ncaaorg.s3.amazonaws.com/compliance/d1/D1Comp_TimeDemandsInfo.pdf">
                        CARA / VARA / RARA
                      </TopLink>
                      <TopLink href="https://www.ncaa.org/sports/2015/6/10/ncaa-banned-substances.aspx">
                        Banned substances
                      </TopLink>
                      <TopLink href="https://www.ncaa.org/news/2020/5/20/di-council-allows-football-basketball-to-have-voluntary-athletics-activities-starting-june-1.aspx">
                        Voluntary guidance
                      </TopLink>
                    </div>

                    <p className="mt-4 text-[11px] sm:text-xs text-slate-100/90 max-w-3xl leading-relaxed">
                      Educational use only. CheckPeak does not replace official rules, team policy, or medical/legal advice.
                    </p>
                  </motion.div>
                </div>

                {/* Right mini panel (like info page) */}
                <div className="lg:col-span-5">
                  <motion.div
                    initial="hidden"
                    animate="visible"
                    variants={fadeIn}
                    transition={{ duration: 0.5, delay: 0.1 }}
                    className="rounded-3xl bg-white/10 border border-white/15 p-5 sm:p-6 shadow-sm"
                  >
                    <p className="text-sm font-extrabold">How to use this page</p>
                    <ul className="mt-3 space-y-2 text-sm text-slate-100">
                      <li className="flex items-start gap-2">
                        <span className="mt-1 w-1.5 h-1.5 rounded-full bg-white/80" />
                        Start with NCAA sources (links below)
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="mt-1 w-1.5 h-1.5 rounded-full bg-white/80" />
                        Use callouts to explain the “why”
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="mt-1 w-1.5 h-1.5 rounded-full bg-white/80" />
                        If it’s unclear: don't hesitate to ask
                      </li>
                    </ul>

                    <div className="mt-5 rounded-2xl bg-black/15 border border-white/10 p-4">
                      <p className="text-xs font-extrabold text-slate-100">Reminder</p>
                      <p className="mt-1 text-xs text-slate-100/90 leading-relaxed">
                        Voluntary rules apply to voluntary activity (VARA). Required or countable activities are seperate.
                      </p>
                    </div>
                  </motion.div>
                </div>
              </div>
            </div>
          </div>

          <div className="h-8 bg-slate-50 rounded-t-[40px]" />
        </section>

        {/* NCAA COMPLIANCE */}
        <div id="ncaa-compliance" style={anchorStyle()}>
          <ComplianceSection wording={wording} ncaaSources={sources} lastReviewed={NCAA_LAST_REVIEWED} />
        </div>

        {/* FOOTER */}
        <footer className="bg-slate-100/90 border-t border-slate-200 py-10 px-4 sm:px-6 mt-10 rounded-t-3xl">
          <div className="max-w-6xl mx-auto text-center">
            <p className="text-xs text-slate-500">
              © {new Date().getFullYear()} CheckPeak • Educational use only
            </p>
          </div>
        </footer>
      </div>
    </>
  );
}