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
  FaBolt,
} from "react-icons/fa";

export const infoHero = {
  kicker: "CheckPeak · Built for the Offseason",
  title: "No one's watching. That's the point.",
  subtitle:
    "Your coach can't follow you home. Your teammates aren't watching. But the offseason keeps score regardless - and it comes to collect in August.",
  pills: [
    { tone: "default", icon: <FaDumbbell />, label: "Athlete-owned progress" },
    { tone: "default", icon: <FaCamera />, label: "Scan labels / search ingredients" },
    { tone: "default", icon: <FaExclamationTriangle />, label: "Not medical/legal advice" },
  ],
  primaryCta: { href: "/nutrition-label-scanner", label: "Scan a Label", icon: <FaCamera className="w-5 h-5" /> },
  secondaryCta: { href: "/search", label: "Search Ingredients", icon: <FaClipboardCheck className="w-5 h-5" /> },
  microDisclaimer:
    "Built for collegiate athletes. Always confirm with your compliance and medical staff before consuming any product.",
};

export const howItWorksSteps = [
  {
    label: "Get your program",
    description:
      "Your coach builds and delivers your personalized offseason program directly in the CheckPeak app. No locating a PDF. No chasing group chats. Workouts, nutrition, classroom attendance, all in one place.",
    outcome:
      "Clear plan. No excuses. No confusion about what you're supposed to be doing.",
    icon: <FaDumbbell className="w-4 h-4 text-[#46769B]" />,
  },
  {
    label: "Own your progress",
    description:
      "Log your lifts. Stack your days. Take your place on the global leaderboard. Somewhere there's an anonymous athlete ahead of you. You don't know them. They don't know you. But the offseason doesn't care either way - it shows up in August and collects exactly what you put in. Nothing more. Nothing less.",
    outcome:
      "Accountability that builds intrinsic motivation. When August arrives, the only thing that needs to show up is your team. ",
    icon: <FaBolt className="w-4 h-4 text-[#46769B]" />,
  },
  {
    label: "Screen everything",
    description:
      "Before any supplement touches your body, run it through CheckPeak. 900+ substances tracked. A fast first-pass screen between you and a decision that ends careers.",
    outcome:
      "Fast risk awareness. Always confirm with your compliance and medical staff for final clearance.",
    icon: <FaShieldAlt className="w-4 h-4 text-[#46769B]" />,
  },
];

export const productPillars = [
  {
    icon: <FaDumbbell className="text-[#46769B] w-7 h-7" />,
    title: "Programming",
    text:
      "Your offseason program - delivered directly to every athlete's device. No group chats. No PDFs buried in email. Each athlete gets their personalized plan, embedded video demonstrations for every movement, and a mobile experience that actually gets opened. You build it once. They execute it all summer. What they do with it shows up in August.",
  },
  {
    icon: <FaUtensils className="text-[#46769B] w-7 h-7" />,
    title: "Nutrition",
    text:
      "Set macro targets and hydration goals for each athlete before they leave campus. CheckPeak puts those numbers in front of them every single day of the offseason. Protein. Carbs. Water. The basics that get ignored the second no one is watching. Athletes track against their own targets - building the habits that determine what they walk back into fall camp as.",
  },
  {
    icon: <FaShieldAlt className="text-[#46769B] w-7 h-7" />,
    title: "Supplement Screening",
    text:
      "Before any product goes in their body, athletes can run it through CheckPeak. We screen against 900+ tracked substances across four data providers - ingredients, labels, and known contamination risks. Fast. Accessible. A first-pass screen that catches the obvious risks before they become your program's problem. Always confirm with your athletics health and compliance staff. But start here.",
  },
];

export const positioningCards = [
  {
    icon: <FaCheckCircle className="w-5 h-5" />,
    title: "NCAA Compliant By Design",
    text:
      "We are the only platform built from the ground up around NCAA compliance. Every feature exists within the rules. Every workout labeled. Every data decision made with Bylaw 17 in mind. Coaches get programming tools. Athletes get everything else.",
  },
  {
    icon: <FaBolt className="w-5 h-5" />,
    title: "Athlete-Owned Progress",
    text:
      "Your progress belongs to you. Streaks, personal records, lift logs - all of it lives in your dashboard. No staff visibility during the offseason. Just you and the standard you set for yourself.",
  },
  {
    icon: <FaShieldAlt className="w-5 h-5" />,
    title: "The Supplement Problem, Solved",
    text:
      "Every year athletes lose eligibility to contaminated supplements they didn't know were contaminated. CheckPeak gives athletes a fast, accessible first-pass screen. Not a guarantee - a fighting chance.",
  },
  {
    icon: <FaDumbbell className="w-5 h-5" />,
    title: "Built for When Coaches Can't Be There",
    text:
      "The offseason is the hardest part. No structure. No one watching. No accountability but your own. CheckPeak was built specifically for this window - the months that define what August looks like.",
  },
];

export const safetyNotes = [
  {
    title: "Not a substitute for professional guidance",
    body:
      "CheckPeak is an educational tool designed to support athlete awareness. Supplement screening results are a first-pass reference only and do not constitute medical or legal advice. Always consult your athletic trainer, team physician, and compliance office before consuming any supplement or product.",
  },
];