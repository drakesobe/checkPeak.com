// pages/info.js
import Head from "next/head";
import Link from "next/link";
import { motion } from "framer-motion";
import { FaArrowRight, FaCamera, FaSearch } from "react-icons/fa";

import SectionHeader from "@/components/info/SectionHeader";
import InfoCard from "@/components/info/InfoCard";
import ResourceLink from "@/components/info/ResourceLink";
import ComplianceSection from "@/components/info/ComplianceSection";

import * as InfoContent from "@/lib/info/infoContent";
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

export default function InfoPage() {
  // ✅ Safe destructuring with defaults (prevents runtime crashes)
  const infoHero = InfoContent?.infoHero || {};
  const howItWorksSteps = Array.isArray(InfoContent?.howItWorksSteps) ? InfoContent.howItWorksSteps : [];
  const productPillars = Array.isArray(InfoContent?.productPillars) ? InfoContent.productPillars : [];
  const positioningCards = Array.isArray(InfoContent?.positioningCards) ? InfoContent.positioningCards : [];
  const safetyNotes = Array.isArray(InfoContent?.safetyNotes) ? InfoContent.safetyNotes : [];

  const heroPills = Array.isArray(infoHero?.pills) ? infoHero.pills : [];
  const primaryCta = infoHero?.primaryCta || { href: "/nutrition-label-scanner", label: "Scan a Label" };
  const secondaryCta = infoHero?.secondaryCta || { href: "/search", label: "Search Ingredients" };

  const safety = safetyNotes[0] || null;

  return (
    <>
      <Head>
        <title>CheckPeak — Info & NCAA Compliance</title>
        <meta
          name="description"
          content="CheckPeak supports workout + nutrition accountability and supplement risk awareness, with direct NCAA resource links."
        />
      </Head>

      <div className="min-h-screen bg-slate-50 text-gray-900 font-sans">
        {/* HERO */}
        <section className="relative overflow-hidden bg-[#46769B] text-white">
          <div className="absolute inset-0 opacity-[0.14] pointer-events-none">
            <div className="absolute -top-24 -left-24 w-72 h-72 rounded-full bg-white blur-3xl" />
            <div className="absolute -bottom-28 -right-28 w-80 h-80 rounded-full bg-white blur-3xl" />
          </div>

          <div className="px-4 sm:px-6 md:px-10 pt-12 pb-10 sm:pt-16 sm:pb-14">
            <div className="max-w-6xl mx-auto">
              <div className="grid lg:grid-cols-12 gap-8 items-center">
                <div className="lg:col-span-7">
                  <motion.div initial="hidden" animate="visible" variants={fadeUp} transition={{ duration: 0.5 }}>
                    <p className="text-xs font-extrabold tracking-widest text-slate-100/90 uppercase">
                      {infoHero?.kicker || "CHECKPEAK • Athlete Tools + Team Workflows"}
                    </p>

                    <h1 className="mt-2 text-3xl sm:text-4xl md:text-5xl font-extrabold leading-tight">
                      {infoHero?.title || "Accountability builds confidence — even off campus."}
                    </h1>

                    <p className="mt-4 text-base sm:text-lg text-slate-100 leading-relaxed max-w-2xl">
                      {infoHero?.subtitle ||
                        "CheckPeak keeps athletes and staff aligned away from campus with clear plans, quick check-ins, and staff visibility."}
                    </p>

                    {heroPills.length ? (
                      <div className="mt-5 flex flex-wrap gap-2">
                        {heroPills.map((p) => (
                          <Pill key={p.label} icon={p.icon}>
                            {p.label}
                          </Pill>
                        ))}
                      </div>
                    ) : null}

                    <div className="mt-7 flex flex-col sm:flex-row gap-3 sm:gap-4">
                      <Link href={primaryCta.href} legacyBehavior>
                        <a className="w-full sm:w-auto px-5 py-3 sm:px-6 sm:py-3.5 bg-white text-[#46769B] font-extrabold rounded-2xl shadow-sm hover:shadow-md transition transform hover:-translate-y-0.5 flex items-center justify-center gap-2 text-sm sm:text-base">
                          <FaCamera className="w-5 h-5" />
                          {primaryCta.label}
                          <FaArrowRight className="opacity-70" />
                        </a>
                      </Link>

                      <Link href={secondaryCta.href} legacyBehavior>
                        <a className="w-full sm:w-auto px-5 py-3 sm:px-6 sm:py-3.5 bg-slate-100/90 text-[#1E293B] font-extrabold rounded-2xl shadow-sm hover:shadow-md transition transform hover:-translate-y-0.5 flex items-center justify-center gap-2 text-sm sm:text-base">
                          <FaSearch className="w-5 h-5" />
                          {secondaryCta.label}
                        </a>
                      </Link>
                    </div>

                    <div className="mt-5 flex flex-wrap gap-3">
                      <a href="#how-it-works" className="text-sm font-extrabold text-white/95 hover:underline">
                        → How it works
                      </a>
                      <a href="#ncaa-compliance" className="text-sm font-extrabold text-white/95 hover:underline">
                        → NCAA compliance
                      </a>
                    </div>

                    {infoHero?.microDisclaimer ? (
                      <p className="mt-4 text-xs sm:text-sm text-slate-100/90">{infoHero.microDisclaimer}</p>
                    ) : null}
                  </motion.div>
                </div>

                {/* Right-side mini panel */}
                <div className="lg:col-span-5">
                  <motion.div
                    initial="hidden"
                    animate="visible"
                    variants={fadeIn}
                    transition={{ duration: 0.5, delay: 0.1 }}
                    className="rounded-3xl bg-white/10 border border-white/15 p-5 sm:p-6 shadow-sm"
                  >
                    <p className="text-sm font-extrabold">What CheckPeak is best at</p>
                    <ul className="mt-3 space-y-2 text-sm text-slate-100">
                      <li className="flex items-start gap-2">
                        <span className="mt-1 w-1.5 h-1.5 rounded-full bg-white/80" />
                        Off-season accountability with consistent check-ins
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="mt-1 w-1.5 h-1.5 rounded-full bg-white/80" />
                        Evidence-based workout completions + staff review workflows
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="mt-1 w-1.5 h-1.5 rounded-full bg-white/80" />
                        Supplement screening as a fast first pass
                      </li>
                    </ul>

                    <div className="mt-5 rounded-2xl bg-black/15 border border-white/10 p-4">
                      <p className="text-xs font-extrabold text-slate-100">Reminder</p>
                      <p className="mt-1 text-xs text-slate-100/90 leading-relaxed">
                        Always approve with your compliance and medical staff.
                      </p>
                    </div>
                  </motion.div>
                </div>
              </div>
            </div>
          </div>

          <div className="h-8 bg-slate-50 rounded-t-[40px]" />
        </section>

        {/* WHY / POSITIONING */}
        {positioningCards.length ? (
          <section className="max-w-6xl mx-auto px-4 sm:px-6 py-10 sm:py-12">
            <SectionHeader
              kicker="Why teams use CheckPeak"
              title="Away-from-campus is where plans drift"
              subtitle="Offseason, breaks, travel, and rehab are where routines get messy. CheckPeak keeps it simple: athletes check in, staff responds with quick feedback, and everyone stays aligned."
            />

            <div className="mt-8 grid gap-4 md:grid-cols-3">
              {positioningCards.map((c) => (
                <InfoCard key={c.title} icon={c.icon} title={c.title} text={c.text} />
              ))}
            </div>
          </section>
        ) : null}

        {/* HOW IT WORKS */}
        <section id="how-it-works" style={anchorStyle()} className="max-w-6xl mx-auto px-4 sm:px-6 pb-10 sm:pb-12">
          <SectionHeader
            kicker="The workflow"
            title="Simple check-ins. Clear feedback."
            subtitle="Easy for athletes to use, quick for staff to review. Everything stays organized by athlete, team, and date."
          />

          <div className="mt-8 grid gap-4 sm:gap-5 md:grid-cols-2 lg:grid-cols-3">
            {howItWorksSteps.map((step, index) => (
              <motion.article
              key={step.label || index}
              className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm hover:shadow-md transition-transform hover:-translate-y-0.5 h-full flex flex-col"
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, amount: 0.2 }}
              variants={fadeUp}
              transition={{ duration: 0.45, delay: index * 0.05 }}
            >
              {/* Top row */}
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-2xl bg-[#46769B]/10 border border-[#46769B]/15 flex items-center justify-center shrink-0">
                  {step.icon}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-extrabold tracking-widest text-slate-500 uppercase">
                    Step {index + 1}
                  </p>
                  <h3 className="text-base sm:text-lg font-extrabold text-slate-900 leading-snug">
                    {step.label}
                  </h3>
                </div>
              </div>

              {/* Body (clamped for uniformity) */}
              <p
                className="mt-3 text-sm text-slate-700 leading-relaxed"
                style={{
                  display: "-webkit-box",
                  WebkitBoxOrient: "vertical",
                  WebkitLineClamp: 4,
                  overflow: "hidden",
                }}
                title={step.description}
              >
                {step.description}
              </p>

              {/* Spacer pushes Outcome to bottom */}
              <div className="flex-1" />

              {/* Outcome pinned to bottom */}
              <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                <p className="text-xs font-semibold text-slate-700">
                  Outcome:<span className="font-normal"> {step.outcome}</span>
                </p>
              </div>
            </motion.article>
            ))}
          </div>

          <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/nutrition-label-scanner" legacyBehavior>
              <a className="text-sm font-extrabold text-[#46769B] hover:underline underline-offset-4 flex items-center justify-center gap-2">
                <FaCamera /> Run a supplement scan →
              </a>
            </Link>
            <Link href="/search" legacyBehavior>
              <a className="text-sm font-extrabold text-[#46769B] hover:underline underline-offset-4 flex items-center justify-center gap-2">
                <FaSearch /> Search ingredients →
              </a>
            </Link>
          </div>
        </section>

        {/* WHAT WE DO */}
        <section className="max-w-6xl mx-auto px-4 sm:px-6 pb-12">
          <SectionHeader
            kicker="What you get"
            title="Three tools. One place."
            subtitle="Workout accountability, nutrition targets, and supplement screening — organized into one repeatable workflow."
          />

          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {productPillars.map((p) => (
              <InfoCard key={p.title} icon={p.icon} title={p.title} text={p.text} />
            ))}
          </div>

          {safety ? (
            <div className="mt-8 rounded-3xl border border-rose-200 bg-rose-50 p-5 sm:p-6 shadow-sm">
              <p className="text-sm font-extrabold text-rose-900">{safety.title}</p>
              <p className="mt-1 text-sm text-rose-900/90 leading-relaxed">{safety.body}</p>
              {infoHero?.legalNote ? <p className="mt-3 text-xs text-rose-900/70">{infoHero.legalNote}</p> : null}
            </div>
          ) : null}
        </section>

        {/* NCAA COMPLIANCE */}
        <div id="ncaa-compliance" style={anchorStyle()}>
          <ComplianceSection
            wording={Array.isArray(ncaaWordingCallouts) ? ncaaWordingCallouts : []}
            ncaaSources={Array.isArray(ncaaResourceBackbone) ? ncaaResourceBackbone : []}
            lastReviewed={NCAA_LAST_REVIEWED}
          />
        </div>

        {/* OPTIONAL: other resources */}
        <section className="max-w-6xl mx-auto px-4 sm:px-6 pb-12">
          <SectionHeader
            kicker="Trusted resources"
            title="Use CheckPeak alongside official bodies"
            subtitle="CheckPeak helps you spot issues quickly. For final decisions, cross-reference official rules and your program’s compliance process."
          />
          <div className="mt-8 grid gap-4 md:grid-cols-2">
            <ResourceLink
              name="WADA (World Anti-Doping Agency)"
              desc="Global authority for the World Anti-Doping Code and Prohibited List."
              href="https://www.wada-ama.org/"
            />
            <ResourceLink
              name="USADA (U.S. Anti-Doping Agency)"
              desc="U.S. education resources and prohibited list guidance."
              href="https://www.usada.org/"
            />
            <ResourceLink
              name="NSF Certified for Sport"
              desc="Third-party testing program for supplement certification."
              href="https://www.nsfsport.com/certified-for-sport/"
            />
            <ResourceLink
              name="Informed Sport"
              desc="Global supplement testing and certification program."
              href="https://sport.wetestyoutrust.com/"
            />
          </div>
        </section>

        {/* CTA */}
        <section className="px-4 sm:px-6 pb-12">
          <div className="max-w-6xl mx-auto rounded-3xl bg-white border border-slate-200 shadow-sm p-5 sm:p-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div className="min-w-0">
                <p className="text-xs font-extrabold tracking-widest text-[#46769B] uppercase">Ready?</p>
                <h3 className="mt-1 text-lg sm:text-xl font-extrabold text-slate-900">
                  Run your next label through CheckPeak in seconds.
                </h3>
                <p className="mt-1 text-sm text-slate-600">
                  Scan a label or search ingredients — then confirm with staff when uncertain.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <Link href="/nutrition-label-scanner" legacyBehavior>
                  <a className="px-5 py-3 bg-[#46769B] text-white font-extrabold rounded-2xl shadow-sm hover:shadow-md transition flex items-center justify-center gap-2">
                    <FaCamera />
                    Scan a Label
                  </a>
                </Link>

                <Link href="/search" legacyBehavior>
                  <a className="px-5 py-3 bg-slate-100 text-slate-900 font-extrabold rounded-2xl border border-slate-200 hover:bg-slate-50 transition flex items-center justify-center gap-2">
                    <FaSearch />
                    Search Ingredients
                  </a>
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* FOOTER */}
        <footer className="bg-slate-100/90 border-t border-slate-200 py-10 px-4 sm:px-6 rounded-t-3xl">
          <div className="max-w-6xl mx-auto text-center">
            <p className="text-xs text-slate-500">
              © {new Date().getFullYear()} CheckPeak • Educational use only • Always defer to your compliance office and health care staff.
            </p>
          </div>
        </footer>
      </div>
    </>
  );
}