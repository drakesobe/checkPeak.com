// pages/info.js
import Head from "next/head";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  FaBullseye,
  FaSearch,
  FaSyncAlt,
  FaExclamationTriangle,
  FaLightbulb,
  FaBookOpen,
  FaHandsHelping,
  FaCamera,
  FaShieldAlt,
  FaCheckCircle,
  FaClipboardCheck,
  FaArrowRight,
  FaExternalLinkAlt,
} from "react-icons/fa";

function classNames(...xs) {
  return xs.filter(Boolean).join(" ");
}

const fadeUp = {
  hidden: { opacity: 0, y: 14 },
  visible: { opacity: 1, y: 0 },
};

const fadeIn = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
};

function SectionHeader({ kicker, title, subtitle }) {
  return (
    <div className="text-center max-w-3xl mx-auto">
      {kicker ? (
        <p className="text-xs font-extrabold tracking-widest text-[#46769B] uppercase">
          {kicker}
        </p>
      ) : null}
      <h2 className="mt-2 text-2xl sm:text-3xl font-extrabold text-slate-900">
        {title}
      </h2>
      {subtitle ? (
        <p className="mt-2 text-sm sm:text-base text-slate-600 leading-relaxed">
          {subtitle}
        </p>
      ) : null}
    </div>
  );
}

function Pill({ icon, children, tone = "default" }) {
  const styles =
    tone === "good"
      ? "bg-emerald-50 border-emerald-200 text-emerald-900"
      : tone === "warn"
      ? "bg-amber-50 border-amber-200 text-amber-950"
      : tone === "bad"
      ? "bg-rose-50 border-rose-200 text-rose-900"
      : "bg-white/15 border-white/20 text-white";

  return (
    <div
      className={classNames(
        "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold",
        styles
      )}
    >
      <span className="opacity-95">{icon}</span>
      <span className="whitespace-nowrap">{children}</span>
    </div>
  );
}

function InfoCard({ icon, title, text }) {
  return (
    <motion.article
      className="rounded-2xl border border-slate-200 bg-white shadow-sm p-5 sm:p-6 hover:shadow-md transition-transform hover:-translate-y-0.5"
      variants={fadeUp}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.45 }}
    >
      <div className="flex items-start gap-4">
        <div className="shrink-0 rounded-2xl bg-slate-50 border border-slate-200 p-3">
          {icon}
        </div>
        <div className="min-w-0">
          <h3 className="text-base sm:text-lg font-extrabold text-slate-900">
            {title}
          </h3>
          <p className="mt-1.5 text-sm sm:text-[15px] text-slate-700 leading-relaxed">
            {text}
          </p>
        </div>
      </div>
    </motion.article>
  );
}

function ResourceLink({ name, desc, href }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="group rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-sm hover:shadow-md transition-transform hover:-translate-y-0.5"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-extrabold text-slate-900">{name}</p>
            <FaExternalLinkAlt className="text-slate-400 group-hover:text-slate-600 text-xs" />
          </div>
          <p className="mt-1 text-xs sm:text-sm text-slate-600 leading-relaxed">
            {desc}
          </p>
        </div>
      </div>
    </a>
  );
}

export default function InfoPage() {
  const steps = [
    {
      label: "Scan or Search",
      description:
        "Upload a label photo or search ingredients/substances by name. PEAK reviews text and runs a fast match against our large, certified databases.",
      outcome: "You get a quick “first pass” risk screen.",
      icon: <FaCamera className="w-4 h-4 text-[#46769B]" />,
    },
    {
      label: "Review Highlights",
      description:
        "We surface potential banned or at-risk ingredients and show helpful context (synonyms, notes, and why it matters).",
      outcome: "You see what to double-check in seconds.",
      icon: <FaClipboardCheck className="w-4 h-4 text-[#46769B]" />,
    },
    {
      label: "Confirm With Staff",
      description:
        "Bring your results to your athletic trainer, team doc, or compliance staff - especially if you’re frequently tested or under a league policy.",
      outcome: "PEAK supports the decision, it doesn’t replace it.",
      icon: <FaShieldAlt className="w-4 h-4 text-[#46769B]" />,
    },
  ];

  return (
    <>
      <Head>
        <title>PEAK — About & How It Works</title>
        <meta
          name="description"
          content="PEAK helps athletes and organizations identify banned substances in supplements by scanning nutrition labels or searching substances. Always double-check with your professional staff."
        />
      </Head>

      <div className="min-h-screen bg-slate-50 text-gray-900 font-sans">
        {/* Hero */}
        <section className="relative overflow-hidden bg-[#46769B] text-white">
          <div className="absolute inset-0 opacity-[0.14] pointer-events-none">
            <div className="absolute -top-24 -left-24 w-72 h-72 rounded-full bg-white blur-3xl" />
            <div className="absolute -bottom-28 -right-28 w-80 h-80 rounded-full bg-white blur-3xl" />
          </div>

          <div className="px-4 sm:px-6 md:px-10 pt-14 pb-12 sm:pt-16 sm:pb-14">
            <div className="max-w-6xl mx-auto">
              <div className="grid lg:grid-cols-12 gap-8 items-center">
                <div className="lg:col-span-7">
                  <motion.div
                    initial="hidden"
                    animate="visible"
                    variants={fadeUp}
                    transition={{ duration: 0.5 }}
                  >
                    <p className="text-xs font-extrabold tracking-widest text-slate-100/90 uppercase">
                      PEAK • Supplement Safety Scanner
                    </p>
                    <h1 className="mt-2 text-3xl sm:text-4xl md:text-5xl font-extrabold leading-tight">
                      Navigate supplements with confidence.
                    </h1>
                    <p className="mt-4 text-base sm:text-lg text-slate-100 leading-relaxed max-w-2xl">
                      Scan labels or search ingredients to spot potential banned substances faster.
                      Use PEAK as a first pass - then confirm with your team or medical staff.
                    </p>

                    <div className="mt-5 flex flex-wrap gap-2">
                      <Pill icon={<FaCheckCircle />} tone="default">
                        Fast OCR + database match
                      </Pill>
                      <Pill icon={<FaShieldAlt />} tone="default">
                        Built for athletes & teams
                      </Pill>
                      <Pill icon={<FaExclamationTriangle />} tone="default">
                        Not medical/legal advice
                      </Pill>
                    </div>

                    <div className="mt-7 flex flex-col sm:flex-row gap-3 sm:gap-4">
                      <Link href="/ocr" legacyBehavior>
                        <a className="px-5 py-3 sm:px-6 sm:py-3.5 bg-white text-[#46769B] font-extrabold rounded-2xl shadow-sm hover:shadow-md transition transform hover:-translate-y-0.5 flex items-center justify-center gap-2 text-sm sm:text-base">
                          <FaCamera className="w-5 h-5" />
                          Scan a Label
                          <FaArrowRight className="opacity-70" />
                        </a>
                      </Link>

                      <Link href="/search" legacyBehavior>
                        <a className="px-5 py-3 sm:px-6 sm:py-3.5 bg-slate-100/90 text-[#1E293B] font-extrabold rounded-2xl shadow-sm hover:shadow-md transition transform hover:-translate-y-0.5 flex items-center justify-center gap-2 text-sm sm:text-base">
                          <FaSearch className="w-5 h-5" />
                          Search Substances
                        </a>
                      </Link>
                    </div>

                    <p className="mt-4 text-xs sm:text-sm text-slate-100/90">
                      PEAK does not replace official rules or medical advice. Always follow your organization&apos;s policies.
                    </p>
                  </motion.div>
                </div>

                {/* Right-side “mini panel” */}
                <div className="lg:col-span-5">
                  <motion.div
                    initial="hidden"
                    animate="visible"
                    variants={fadeIn}
                    transition={{ duration: 0.5, delay: 0.1 }}
                    className="rounded-3xl bg-white/10 border border-white/15 p-5 sm:p-6 shadow-sm"
                  >
                    <p className="text-sm font-extrabold">What PEAK is best at</p>
                    <ul className="mt-3 space-y-2 text-sm text-slate-100">
                      <li className="flex items-start gap-2">
                        <span className="mt-1 w-1.5 h-1.5 rounded-full bg-white/80" />
                        Quickly spotting **known** banned / risky terms on real labels
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="mt-1 w-1.5 h-1.5 rounded-full bg-white/80" />
                        Helping you ask smarter questions before you buy/use
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="mt-1 w-1.5 h-1.5 rounded-full bg-white/80" />
                        Keeping a repeatable “scan → review → confirm” workflow
                      </li>
                    </ul>

                    <div className="mt-5 rounded-2xl bg-black/15 border border-white/10 p-4">
                      <p className="text-xs font-extrabold text-slate-100">
                        Reminder
                      </p>
                      <p className="mt-1 text-xs text-slate-100/90 leading-relaxed">
                        Some products are contaminated or mislabeled. A “clean” scan isn’t a guarantee - always confirm with your staff.
                      </p>
                    </div>
                  </motion.div>
                </div>
              </div>
            </div>
          </div>

          {/* soft bottom curve */}
          <div className="h-8 bg-slate-50 rounded-t-[40px]" />
        </section>

        {/* How it works */}
        <section className="max-w-6xl mx-auto px-4 sm:px-6 py-10 sm:py-12">
          <SectionHeader
            kicker="How it works"
            title="How PEAK fits into your routine"
            subtitle="A simple workflow you can repeat every time you’re considering a new supplement."
          />

          <div className="mt-8 grid gap-4 sm:gap-5 md:grid-cols-3">
            {steps.map((step, index) => (
              <motion.article
                key={step.label}
                className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm hover:shadow-md transition-transform hover:-translate-y-0.5"
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, amount: 0.2 }}
                variants={fadeUp}
                transition={{ duration: 0.45, delay: index * 0.06 }}
              >
                <div className="flex items-start gap-3">
                  <div className="h-10 w-10 rounded-2xl bg-[#46769B]/10 border border-[#46769B]/15 flex items-center justify-center">
                    {step.icon}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-extrabold tracking-widest text-slate-500 uppercase">
                      Step {index + 1}
                    </p>
                    <h3 className="text-base sm:text-lg font-extrabold text-slate-900">
                      {step.label}
                    </h3>
                  </div>
                </div>

                <p className="mt-3 text-sm text-slate-700 leading-relaxed">
                  {step.description}
                </p>

                <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                  <p className="text-xs font-semibold text-slate-700">
                    Outcome:
                    <span className="font-normal"> {step.outcome}</span>
                  </p>
                </div>
              </motion.article>
            ))}
          </div>
        </section>

        {/* Core content cards grouped */}
        <section className="max-w-6xl mx-auto px-4 sm:px-6 pb-10">
          <div className="grid gap-6 lg:grid-cols-12 items-start">
            <div className="lg:col-span-7 space-y-6">
              <InfoCard
                icon={<FaBullseye className="text-[#46769B] w-7 h-7" />}
                title="Our mission"
                text="PEAK helps athletes and supplement users quickly identify banned substances or risky ingredients from nutrition labels using searchable databases - so you can make smarter decisions faster."
              />
              <InfoCard
                icon={<FaSyncAlt className="text-[#46769B] w-7 h-7" />}
                title="Updates & accuracy"
                text="Banned substance rules and interpretations evolve. PEAK is designed to reflect updates in our system so your checks align with the most current data available inside PEAK."
              />
              <InfoCard
                icon={<FaHandsHelping className="text-[#46769B] w-7 h-7" />}
                title="Best practices"
                text="Make label checks a habit before you buy or consume. Keep screenshots/logs of products you use, and review your stack with your medical or performance staff regularly."
              />
            </div>

            <div className="lg:col-span-5 space-y-6">
              <div className="rounded-3xl border border-rose-200 bg-rose-50 p-5 sm:p-6 shadow-sm">
                <div className="flex items-start gap-3">
                  <div className="shrink-0 rounded-2xl bg-white border border-rose-200 p-3">
                    <FaExclamationTriangle className="text-[#D62828] w-6 h-6" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-extrabold text-rose-900">
                      Disclaimer
                    </p>
                    <p className="mt-1 text-sm text-rose-900/90 leading-relaxed">
                      PEAK is informational support and does not replace medical advice, team policy,
                      or official anti-doping guidance. Always confirm with qualified professionals,
                      especially if you are tested or subject to league rules.
                    </p>
                  </div>
                </div>

                <div className="mt-4 rounded-2xl bg-white/70 border border-rose-200 p-4">
                  <p className="text-xs font-extrabold text-rose-900">
                    Important safety reminder
                  </p>
                  <p className="mt-1 text-xs text-rose-900/90 leading-relaxed">
                    Any substance chemically/pharmacologically related to banned classes—even if not explicitly listed—may be prohibited.
                    Many supplements can be contaminated with unlabeled banned substances. Always verify with your team/medical staff.
                  </p>
                </div>
              </div>

              <InfoCard
                icon={<FaLightbulb className="text-[#46769B] w-7 h-7" />}
                title="Important guidance"
                text="Treat near-matches and suspicious names seriously - especially stimulants, prohormones, SARMs, and “proprietary blends.” When in doubt, don’t guess - confirm."
              />
            </div>
          </div>
        </section>

        {/* Resources */}
        <section className="max-w-6xl mx-auto px-4 sm:px-6 pb-12">
          <SectionHeader
            kicker="Reference backbone"
            title="Trusted resources"
            subtitle="Use PEAK alongside official organizations and governing bodies. These sources are your reference backbone."
          />

          <div className="mt-8 grid gap-4 md:grid-cols-2">
            <ResourceLink
              name="WADA (World Anti-Doping Agency)"
              desc="The global authority for the World Anti-Doping Code and Prohibited List."
              href="https://www.wada-ama.org/"
            />
            <ResourceLink
              name="USADA (U.S. Anti-Doping Agency)"
              desc="U.S. education and athlete resources, including prohibited list guidance."
              href="https://www.usada.org/"
            />
            <ResourceLink
              name="NCAA Sport Science Institute"
              desc="College athlete supplement and banned substance education resources."
              href="https://www.ncaa.org/sports/2015/6/10/ncaa-drug-testing-program.aspx"
            />
            <ResourceLink
              name="NSF Certified for Sport"
              desc="Third-party testing program for supplement certification."
              href="https://www.nsfsport.com/certified-for-sport/"
            />
          </div>

          <div className="mt-6 rounded-3xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm">
            <div className="flex items-start gap-3">
              <div className="shrink-0 rounded-2xl bg-slate-50 border border-slate-200 p-3">
                <FaBookOpen className="text-[#46769B] w-6 h-6" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-extrabold text-slate-900">
                  How to use resources with PEAK
                </p>
                <p className="mt-1 text-sm text-slate-700 leading-relaxed">
                  PEAK helps you spot problems quickly on real-world labels. For final decisions, cross-reference with official rules
                  and your team’s compliance process - especially if you’re tested.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* CTA band */}
        <section className="px-4 sm:px-6 pb-12">
          <div className="max-w-6xl mx-auto rounded-3xl bg-white border border-slate-200 shadow-sm p-5 sm:p-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div className="min-w-0">
                <p className="text-xs font-extrabold tracking-widest text-[#46769B] uppercase">
                  Ready?
                </p>
                <h3 className="mt-1 text-lg sm:text-xl font-extrabold text-slate-900">
                  Run your next label through PEAK in seconds.
                </h3>
                <p className="mt-1 text-sm text-slate-600">
                  Scan a label or search substances—then confirm with your staff.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <Link href="/ocr" legacyBehavior>
                  <a className="px-5 py-3 bg-[#46769B] text-white font-extrabold rounded-2xl shadow-sm hover:shadow-md transition flex items-center justify-center gap-2">
                    <FaCamera />
                    Scan a Label
                  </a>
                </Link>

                <Link href="/search" legacyBehavior>
                  <a className="px-5 py-3 bg-slate-100 text-slate-900 font-extrabold rounded-2xl border border-slate-200 hover:bg-slate-50 transition flex items-center justify-center gap-2">
                    <FaSearch />
                    Search Substances
                  </a>
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* Footer / final safety note */}
        <footer className="bg-slate-100/90 border-t border-slate-200 py-10 px-4 sm:px-6 rounded-t-3xl">
          <div className="max-w-6xl mx-auto">
            <div className="text-center">
              <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900">
                Stay safe and informed.
              </h2>
              <p className="mt-3 max-w-4xl mx-auto text-sm sm:text-base text-slate-800 leading-relaxed">
                PEAK is designed to make it easier to spot potential issues. It cannot guarantee complete safety or compliance
                across all leagues, teams, and governing bodies. Use it as a tool in your process - not the final decision-maker.
              </p>
            </div>

            <div className="mt-6 max-w-4xl mx-auto rounded-3xl bg-white/80 border border-rose-100 p-5 shadow-sm">
              <p className="text-xs sm:text-sm text-rose-700 font-extrabold">
                Important safety reminder
              </p>
              <p className="mt-2 text-xs sm:text-sm text-slate-800 leading-relaxed">
                Any substance that is chemically or pharmacologically related to banned drug classes - even if not explicitly listed - should be treated as prohibited.
                Many supplements may be contaminated with banned substances not shown on the label. Always verify with your team staff,
                medical professional, or appropriate governing body before use.
              </p>
            </div>

            <div className="mt-6 text-center text-xs text-slate-500">
              © {new Date().getFullYear()} PEAK • Educational use only
            </div>
          </div>
        </footer>
      </div>
    </>
  );
}
