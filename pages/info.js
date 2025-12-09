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
} from "react-icons/fa";

export default function InfoPage() {
  // Cards content
  const cards = [
    {
      title: "Our Mission",
      text:
        "PEAK helps athletes and supplement users quickly identify banned substances in nutrition labels using OCR and searchable ingredient databases. Our goal is to keep you informed and safer while performing at your best.",
      icon: <FaBullseye className="text-[#46769B] w-8 h-8" />,
    },
    {
      title: "How It Works",
      text:
        "Upload or snap a photo of a nutrition label, or search substances directly by name. PEAK parses the label, cross-checks ingredients against our banned-substance data, and surfaces anything that may be risky.",
      icon: <FaSearch className="text-[#46769B] w-8 h-8" />,
    },
    {
      title: "Updates & Accuracy",
      text:
        "Banned substance lists and rules can evolve throughout the year. PEAK is built to reflect updates from our underlying database so your checks are aligned with the most current information available in our system.",
      icon: <FaSyncAlt className="text-[#46769B] w-8 h-8" />,
    },
    {
      title: "Disclaimer",
      text:
        "PEAK is for informational use only and does not replace medical advice, team policy, or official anti-doping guidance. Always consult a qualified professional or team representative before consuming supplements, especially if you are tested or subject to specific regulations.",
      icon: <FaExclamationTriangle className="text-[#D62828] w-8 h-8" />,
    },
    {
      title: "Important Notes & Guidance",
      text:
        "Any substance that is chemically or pharmacologically related to banned drug classes — even if it is not explicitly listed — should be treated as prohibited. Many supplements are contaminated with unlabeled banned substances. It is your responsibility to confirm with your athletics or professional staff before use.",
      icon: <FaLightbulb className="text-[#46769B] w-8 h-8" />,
    },
    {
      title: "Best Practices",
      text:
        "Make checking labels a habit before you buy or consume. Cross-reference ingredients with PEAK and official organizations, keep screenshots or logs of products you use, and talk through your stack with your medical or performance staff regularly.",
      icon: <FaHandsHelping className="text-[#46769B] w-8 h-8" />,
    },
    {
      title: "Resources & Links",
      text:
        "Use PEAK alongside trusted organizations and governing bodies that maintain official banned lists. Treat these sources as your reference backbone, and use PEAK as a fast way to spot potential issues on real-world labels.",
      icon: <FaBookOpen className="text-[#46769B] w-8 h-8" />,
    },
  ];

  const steps = [
    {
      label: "Scan or Search",
      description:
        "Take a photo or upload a nutrition label, or search a specific substance by name. PEAK will detect ingredients and match them against our database.",
    },
    {
      label: "Review Highlights",
      description:
        "PEAK flags banned and at-risk ingredients, then breaks them down into simple sections so you can understand what they do and why they might be a problem.",
    },
    {
      label: "Confirm Safety",
      description:
        "Bring your findings to your athletic trainer, team doctor, or other qualified professional to get a final decision before using any supplement.",
    },
  ];

  const fadeUp = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 },
  };

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
        <section className="relative bg-[#46769B] text-white px-4 sm:px-6 md:px-10 pt-14 pb-12 sm:pt-16 sm:pb-14 rounded-b-3xl shadow-sm">
          <div className="max-w-5xl mx-auto text-center">
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-4 leading-tight">
              Navigate Supplements with Confidence
            </h1>
            <p className="max-w-2xl mx-auto text-base sm:text-lg md:text-xl mb-8 text-slate-100">
              Scan labels or search ingredients to spot banned substances
              faster. Use PEAK as a first pass, then confirm everything with
              your professional or team staff.
            </p>

            <div className="flex flex-col sm:flex-row justify-center gap-3 sm:gap-4">
              {/* Scan Button */}
              <Link href="/ocr" legacyBehavior>
                <a className="px-5 py-3 sm:px-6 sm:py-3.5 bg-white text-[#46769B] font-semibold rounded-2xl shadow-sm hover:shadow-md transition transform hover:-translate-y-0.5 flex items-center justify-center gap-2 text-sm sm:text-base">
                  <FaCamera className="w-5 h-5" />
                  Scan a Label
                </a>
              </Link>

              {/* Search Button */}
              <Link href="/search" legacyBehavior>
                <a className="px-5 py-3 sm:px-6 sm:py-3.5 bg-slate-100/90 text-[#1E293B] font-semibold rounded-2xl shadow-sm hover:shadow-md transition transform hover:-translate-y-0.5 flex items-center justify-center gap-2 text-sm sm:text-base">
                  <FaSearch className="w-5 h-5" />
                  Search Substances
                </a>
              </Link>
            </div>

            <p className="mt-4 text-xs sm:text-sm text-slate-200/90">
              PEAK does not replace official rules or medical advice. Always
              follow your organization&apos;s policies.
            </p>
          </div>
        </section>

        {/* How It Works (3 separate cards, scan-style) */}
        <section className="max-w-5xl mx-auto px-4 sm:px-6 py-10 sm:py-12">
          <div className="text-center mb-6 sm:mb-8">
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900">
              How PEAK Fits Into Your Routine
            </h2>
            <p className="mt-2 text-sm sm:text-base text-slate-600 max-w-2xl mx-auto">
              Think of PEAK as your quick pre-check. These three steps keep your
              supplement process simple and repeatable.
            </p>
          </div>

          <div className="grid gap-4 sm:gap-5 md:grid-cols-3">
            {steps.map((step, index) => (
              <motion.article
                key={step.label}
                className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-sm hover:shadow-md transition-transform hover:-translate-y-0.5 flex flex-col"
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, amount: 0.2 }}
                variants={fadeUp}
                transition={{ duration: 0.45, delay: index * 0.06 }}
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className="h-9 w-9 sm:h-10 sm:w-10 rounded-full bg-[#46769B]/10 flex items-center justify-center text-xs sm:text-sm font-semibold text-[#46769B]">
                    {index + 1}
                  </div>
                  <h3 className="text-sm sm:text-base font-semibold text-slate-900">
                    {step.label}
                  </h3>
                </div>
                <p className="text-xs sm:text-sm text-slate-700 leading-relaxed">
                  {step.description}
                </p>
              </motion.article>
            ))}
          </div>
        </section>

        {/* Info Cards */}
        <main className="max-w-6xl mx-auto px-4 sm:px-6 pb-12 grid gap-6 sm:gap-7 md:grid-cols-2">
          {cards.map((card, idx) => (
            <motion.article
              key={card.title}
              className="flex flex-col sm:flex-row bg-white border border-slate-200 rounded-2xl shadow-sm p-5 sm:p-6 hover:shadow-md transition-transform hover:-translate-y-0.5"
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, amount: 0.22 }}
              variants={fadeUp}
              transition={{ duration: 0.5, delay: idx * 0.05 }}
            >
              <div className="flex-shrink-0 mb-3 sm:mb-0 sm:mr-4 flex items-start sm:items-center justify-start">
                <div className="inline-flex items-center justify-center rounded-2xl bg-slate-50 border border-slate-200 p-3">
                  {card.icon}
                </div>
              </div>

              <div>
                <h3 className="text-lg sm:text-xl font-semibold text-slate-900 mb-1.5">
                  {card.title}
                </h3>
                <p className="text-sm sm:text-[15px] text-slate-700 leading-relaxed">
                  {card.text}
                </p>
              </div>
            </motion.article>
          ))}
        </main>

        {/* Footer / safety notice */}
        <section className="bg-slate-100/90 border-t border-slate-200 py-10 px-4 sm:px-6 md:px-10 rounded-t-3xl">
          <div className="max-w-5xl mx-auto text-center">
            <h2 className="text-xl sm:text-2xl font-bold text-slate-900 mb-3">
              Stay Safe and Informed
            </h2>
            <p className="max-w-3xl mx-auto text-sm sm:text-base text-slate-800 leading-relaxed mb-4">
              PEAK is designed to make it easier to spot potential issues in
              your supplements. It cannot guarantee complete safety or
              compliance with all leagues, teams, or governing bodies. Use it as
              a tool in your process, not the final decision-maker.
            </p>

            <div className="max-w-3xl mx-auto text-left sm:text-center bg-white/80 border border-rose-100 rounded-2xl px-4 sm:px-5 py-4 shadow-sm">
              <p className="text-xs sm:text-sm text-rose-700 font-semibold mb-1">
                Important Safety Reminder
              </p>
              <p className="text-xs sm:text-sm text-slate-800 leading-relaxed">
                Any substance that is chemically or pharmacologically related to
                banned drug classes — even if not explicitly listed — should be
                treated as prohibited. Many nutritional supplements may be
                contaminated with banned substances not shown on the label.
                Always verify with your team staff, medical professional, or
                appropriate governing body before use.
              </p>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
