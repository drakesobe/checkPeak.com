// pages/info.js
import Head from "next/head";
import Link from "next/link";
import { useEffect, useState, useRef } from "react";
import NavBar from "../components/NavBar";
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
import { motion } from "framer-motion";

export default function InfoPage() {
  const [activeStep, setActiveStep] = useState(0);
  const stepRefs = useRef([]);

  // Cards content (reflects all copy updates so far)
  const cards = [
    {
      title: "Our Mission",
      text:
        "PEAK helps athletes and supplement users quickly identify banned substances in nutrition labels using OCR and searchable databases. Our goal is to keep you informed and safe while performing at your best.",
      icon: <FaBullseye className="text-[#46769B] w-10 h-10" />,
    },
    {
      title: "How It Works",
      text:
        "Upload a nutrition label to scan ingredients, or use the search functionality to look up substances. Our system highlights banned ingredients based on up-to-date data from trusted sources.",
      icon: <FaSearch className="text-[#46769B] w-10 h-10" />,
    },
    {
      title: "Updates & Accuracy",
      text:
        "Banned substances and regulations can change periodically throughout the year. PEAK automatically reflects the latest updates from our database.",
      icon: <FaSyncAlt className="text-[#46769B] w-10 h-10" />,
    },
    {
      title: "Disclaimer",
      text:
        "PEAK is for informational purposes only. Always consult a qualified professional before consuming supplements, especially if you are competing or subject to regulated substance policies.",
      icon: <FaExclamationTriangle className="text-[#46769B] w-10 h-10" />,
    },
    {
      title: "Important Notes & Guidance",
      text:
        "Any substance that is chemically or pharmacologically related to banned drug classes, even if not explicitly listed, should be treated as prohibited. Many nutritional or dietary supplements are contaminated with banned substances not listed on the label. It is the user’s responsibility to check with the appropriate athletics or professional staff before consuming any substance.",
      icon: <FaLightbulb className="text-[#46769B] w-10 h-10" />,
    },
    {
      title: "Best Practices",
      text:
        "Always check ingredient labels, cross-reference with reliable databases, and consult a professional before consuming any supplement. Keep a personal log of scanned supplements for reference.",
      icon: <FaHandsHelping className="text-[#46769B] w-10 h-10" />,
    },
    {
      title: "Resources & Links",
      text:
        "We provide links to trusted databases and organizations that track banned substances. Use them as a reference to make informed decisions.",
      icon: <FaBookOpen className="text-[#46769B] w-10 h-10" />,
    },
  ];

  // Steps: combined Scan & Search as Step 1
  const steps = [
    {
      label: "Scan or Search",
      color: "#46769B",
      description:
        "Take a photo or upload a nutrition label — or search a substance directly.",
    },
    {
      label: "Check Highlights",
      color: "#F77F00",
      description: "Review highlighted ingredients that may be unsafe.",
    },
    {
      label: "Confirm Safety",
      color: "#D62828",
      description:
        "Double-check with a professional before consuming any supplement.",
    },
  ];

  // Scroll handler to update active step
  useEffect(() => {
    const handleScroll = () => {
      const cardOffsets = stepRefs.current.map((ref) => ref?.offsetTop || 0);
      const scrollPos = window.scrollY + window.innerHeight / 3;

      const current = cardOffsets.findIndex((offset, idx) => {
        const nextOffset = cardOffsets[idx + 1] || Infinity;
        return scrollPos >= offset && scrollPos < nextOffset;
      });

      if (current !== -1 && current !== activeStep) setActiveStep(current);
    };

    window.addEventListener("scroll", handleScroll);
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, [activeStep]);

  const cardVariants = {
    hidden: { opacity: 0, y: 24 },
    visible: { opacity: 1, y: 0 },
  };
  const stepVariants = {
    hidden: { opacity: 0, y: -10, scale: 0.95 },
    visible: { opacity: 1, y: 0, scale: 1 },
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

      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-blue-50 text-gray-900 font-sans">
        <NavBar />

        {/* Hero */}
        <section className="relative bg-[#46769B] text-white py-16 px-6 md:px-12 text-center rounded-b-3xl shadow-md">
          <h1 className="text-4xl md:text-5xl font-bold mb-4 leading-tight">
            Navigate Supplements with Confidence
          </h1>
          <p className="max-w-2xl mx-auto text-lg md:text-xl mb-8">
            PEAK helps athletes and organizations identify banned substances
            quickly and reliably. Always double-check with your professional
            staff for final approval before use.
          </p>

          <div className="flex flex-col md:flex-row justify-center gap-4">
            {/* Scan Button */}
            <Link href="/ocr" legacyBehavior>
              <a className="px-6 py-3 bg-white text-[#46769B] font-semibold rounded-2xl shadow hover:shadow-lg transition transform hover:scale-105 flex items-center gap-3">
                <FaCamera className="w-5 h-5" /> Scan a Label
              </a>
            </Link>

            {/* ✅ Updated Search Button to go to /search */}
            <Link href="/search" legacyBehavior>
              <a className="px-6 py-3 bg-[#f1f5f9] text-[#46769B] font-semibold rounded-2xl shadow hover:shadow-lg transition transform hover:scale-105 flex items-center gap-3">
                <FaSearch className="w-5 h-5" /> Search Substances
              </a>
            </Link>
          </div>
        </section>

        {/* How it Works */}
        <section className="max-w-6xl mx-auto px-4 py-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-8 text-center">
            How It Works
          </h2>

          <div className="flex flex-col md:flex-row justify-between items-center gap-6 md:gap-0 relative">
            {steps.map((step, index) => (
              <div
                key={step.label}
                className="flex-1 flex flex-col items-center relative z-10 group"
              >
                <motion.div
                  className="w-14 h-14 rounded-full flex items-center justify-center text-white font-bold text-lg shadow-lg"
                  style={{
                    background: `linear-gradient(135deg, ${step.color} 0%, ${step.color}55 100%)`,
                    boxShadow:
                      activeStep >= index
                        ? `0 0 20px ${step.color}77`
                        : "0 0 6px #00000022",
                    transform: activeStep >= index ? "scale(1.18)" : "scale(1)",
                    transition: "all 0.28s ease",
                  }}
                  initial="hidden"
                  whileInView="visible"
                  viewport={{ once: true }}
                  variants={stepVariants}
                  transition={{ duration: 0.45, delay: index * 0.06 }}
                >
                  {index + 1}
                </motion.div>

                <p className="mt-2 text-center font-medium">{step.label}</p>

                <span className="absolute -top-16 w-48 bg-white text-gray-800 p-2 rounded shadow-lg text-sm opacity-0 group-hover:opacity-100 transition-opacity z-50">
                  {step.description}
                </span>

                {index < steps.length - 1 && (
                  <motion.div
                    className="hidden md:block absolute top-6 right-[-50%] h-2 w-[100%] rounded-full"
                    style={{
                      background:
                        "linear-gradient(90deg, #46769B, #1D2433, #F77F00, #D62828)",
                    }}
                    initial={{ scaleX: 0 }}
                    animate={{ scaleX: activeStep > index ? 1 : 0 }}
                    transition={{ duration: 0.6, ease: "easeInOut" }}
                  />
                )}
              </div>
            ))}
          </div>
        </section>

        {/* Cards */}
        <main className="max-w-7xl mx-auto px-4 py-12 grid gap-8 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-2">
          {cards.map((card, idx) => (
            <motion.article
              key={card.title}
              ref={(el) => (stepRefs.current[idx] = el)}
              className="flex flex-col md:flex-row bg-white border border-blue-100 rounded-xl shadow-md p-6 hover:shadow-lg transition transform hover:-translate-y-1"
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, amount: 0.18 }}
              variants={cardVariants}
              transition={{ duration: 0.6, delay: idx * 0.06 }}
            >
              <div className="flex-shrink-0 mb-4 md:mb-0 md:mr-4 flex items-center justify-center">
                {card.icon}
              </div>

              <div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  {card.title}
                </h3>
                <p className="text-gray-700 leading-relaxed">{card.text}</p>
              </div>
            </motion.article>
          ))}
        </main>

        {/* Footer / safety notice */}
        <section className="bg-gray-100 py-12 px-6 md:px-12 text-center rounded-t-3xl">
          <h2 className="text-2xl font-bold mb-4">Stay Safe and Informed</h2>
          <p className="max-w-3xl mx-auto text-gray-800 text-lg leading-relaxed mb-6">
            PEAK is designed to help you make informed decisions about
            supplements, but it cannot guarantee complete safety. Always consult
            qualified professionals before consuming any substance.
          </p>

          <p className="max-w-3xl mx-auto text-gray-700 text-sm leading-relaxed">
            Note: any substance that is chemically or pharmacologically related
            to banned drug classes — even if not explicitly listed — should be
            treated as prohibited. Also, many nutritional supplements may be
            contaminated with banned substances not shown on a label. Verify
            with your team staff or medical professional before use.
          </p>
        </section>
      </div>
    </>
  );
}
