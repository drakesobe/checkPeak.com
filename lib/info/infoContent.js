// lib/info/infoContent.js

import {
  FaCamera,
  FaClipboardCheck,
  FaShieldAlt,
  FaDumbbell,
  FaUtensils,
  FaUsers,
  FaCheckCircle,
  FaExclamationTriangle,
} from "react-icons/fa";

export const infoHero = {
  kicker: "CHECKPEAK • Athlete Accountability + Supplement Risk",
  title: "Train with confidence — on campus and off.",
  subtitle:
    "Nutrition check-ins, workout accountability, and supplement risk scanning — designed to support your program’s standards without replacing compliance staff.",
  pills: [
    { tone: "default", icon: <FaCheckCircle />, label: "Nutrition + Workout accountability" },
    { tone: "default", icon: <FaCamera />, label: "Scan labels / search ingredients" },
    { tone: "default", icon: <FaExclamationTriangle />, label: "Not medical/legal advice" },
  ],
  primaryCta: { href: "/nutrition-label-scanner", label: "Scan a Label", icon: <FaCamera className="w-5 h-5" /> },
  secondaryCta: { href: "/search", label: "Search Ingredients", icon: <FaClipboardCheck className="w-5 h-5" /> },
};

export const howItWorksSteps = [
  {
    label: "Athletes check in (Nutrition + Workouts)",
    description:
      "Athletes submit nutrition check-ins and workout completions — including notes and evidence when required.",
    outcome: "Coaches see what’s happening, even in the off-season.",
    icon: <FaDumbbell className="w-4 h-4 text-[#46769B]" />,
  },
  {
    label: "Staff review & follow up",
    description:
      "Organizations use the Review Queue to approve, request info, or coach behavior. Everything stays documented.",
    outcome: "Accountability becomes consistent — not random.",
    icon: <FaUsers className="w-4 h-4 text-[#46769B]" />,
  },
  {
    label: "Scan supplements / reduce eligibility risk",
    description:
      "Scan labels or search substances for a fast risk screen — then confirm with your athletics health care and compliance staff.",
    outcome: "Better questions, fewer surprises.",
    icon: <FaShieldAlt className="w-4 h-4 text-[#46769B]" />,
  },
];

export const productPillars = [
  {
    icon: <FaUtensils className="text-[#46769B] w-7 h-7" />,
    title: "Nutrition check-ins",
    text:
      "Structured check-ins make it easy to track adherence, habits, and consistency — especially in the off-season.",
  },
  {
    icon: <FaDumbbell className="text-[#46769B] w-7 h-7" />,
    title: "Workout accountability",
    text:
      "Evidence-based completions and review workflows help staff verify training and build better standards.",
  },
  {
    icon: <FaShieldAlt className="text-[#46769B] w-7 h-7" />,
    title: "Supplement risk awareness",
    text:
      "Fast label scans and ingredient search help athletes avoid obvious risk — while reinforcing staff confirmation and official rules.",
  },
];