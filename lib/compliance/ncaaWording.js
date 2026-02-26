// lib/compliance/ncaaWording.js

export const ncaaWordingCallouts = [
  /* ---------------------------
     Voluntary vs required (key to “monitoring” boundaries)
  --------------------------- */
  {
    key: "voluntary-initiated",
    title: "Voluntary activity must be athlete-initiated",
    quote: "Must be initiated by the student-athlete.",
    href: "https://ncaaorg.s3.amazonaws.com/compliance/d1/D1Comp_TimeDemandsInfo.pdf",
    whyItMatters: [
      "Programs can label items as optional, and athletes aren’t penalized for opting out of voluntary activity.",
      "This is the key guardrail for responsible compliance.",
    ],
    tags: ["Voluntary", "Non-coercion"],
  },
  {
    key: "voluntary-not-required-to-attend",
    title: "Voluntary means attendance can’t be required",
    quote: "Student-athletes may not be required to attend.",
    href: "https://ncaaorg.s3.amazonaws.com/compliance/d1/D1Comp_TimeDemandsInfo.pdf",
    whyItMatters: [
      "CheckPeak is designed for alignment, not punishment. Programs control what is required; optional check-ins should remain optional.",
    ],
    tags: ["Voluntary", "Offseason"],
  },
  {
    key: "voluntary-no-reward-punishment",
    title: "Voluntary means no reward or punishment",
    quote: "Student-athletes may not be rewarded or punished for participating.",
    href: "https://ncaaorg.s3.amazonaws.com/compliance/d1/D1Comp_TimeDemandsInfo.pdf",
    whyItMatters: [
      "We avoid building “gotcha” surveillance.",
      "CheckPeak focuses on clear expectations, documented check-ins, and staff feedback - not coercive incentives.",
    ],
    tags: ["Voluntary", "Non-surveillance"],
  },

  // ✅ FIXED: use verbatim NCAA wording (not a paraphrase)
  {
    key: "voluntary-not-reported",
    title: "To be voluntary, activity can’t be reported back to coaches",
    quote:
      "Voluntary on-campus athletic activity must be initiated by the student-athlete…",
    href: "https://www.ncaa.org/news/2020/5/20/di-council-allows-football-basketball-to-have-voluntary-athletics-activities-starting-june-1.aspx",
    whyItMatters: [
      "This applies to activities treated as voluntary (VARA) - not required/countable activities.",
      "CheckPeak supports both: programs can mark required or optional so voluntary stays voluntary.",
    ],
    tags: ["Voluntary", "Visibility controls"],
  },

  // ✅ NEW #1: safety exception nuance (prevents overclaiming)
  {
    key: "voluntary-safety-exception",
    title: "Coach presence can be allowed only for safety (not coaching)",
    quote:
      "In sports with a safety exception, a coach may be present for voluntary activities to provide safety instruction",
    href: "https://ncaaorg.s3.amazonaws.com/compliance/d1/D1Comp_TimeDemandsInfo.pdf",
    whyItMatters: [
      "This matters for how teams structure optional sessions.",
      "CheckPeak is designed to document expectations clearly so optional stays optional.",
    ],
    tags: ["Voluntary", "Safety exception"],
  },

  // ✅ NEW #2: RARA clarity (helps explain required-but-not-counted situations)
  {
    key: "rara-basics",
    title: "RARA has special rules (where applicable)",
    quote:
      "RARA is applicable to autonomy schools and schools that opt into autonomy legislation…",
    href: "https://ncaaorg.s3.amazonaws.com/compliance/d1/D1Comp_TimeDemandsInfo.pdf",
    whyItMatters: [
      "CheckPeak supports program-controlled labeling (required vs optional) and keeps documentation consistent with how your compliance office structures time demands.",
    ],
    tags: ["RARA", "Required"],
  },

  /* ---------------------------
     Offseason time demands (monitoring concerns)
  --------------------------- */
  {
    key: "out-of-season-time-limits",
    title: "Outside the playing season: time limits still apply",
    quote: "Weekly max: 8 hours. Minimum weekly days off: Two.",
    href: "https://ncaaorg.s3.amazonaws.com/compliance/d1/D1Comp_TimeDemandsInfo.pdf",
    whyItMatters: [
      "CheckPeak supports offseason consistency without creating extra required activity. Programs define requirements; the workflow stays transparent, trackable, and most importantly compliant.",
    ],
    tags: ["Offseason", "Time demands"],
  },
  {
    key: "skill-instruction-limits",
    title: "Out-of-season skill instruction is limited",
    quote: "Sports other than football: Max 4 of 8 hours can be skill instruction.",
    href: "https://ncaaorg.s3.amazonaws.com/compliance/d1/D1Comp_TimeDemandsInfo.pdf",
    whyItMatters: [
      "CheckPeak’s workout check-ins can be configured around program-defined requirements (e.g., S&C) without implying athletes are required to do more than permitted.",
    ],
    tags: ["Offseason", "Skill instruction"],
  },
  {
    key: "football-offseason-limits",
    title: "Football out-of-season hour types are restricted",
    quote:
      "Football: Hours may only include strength and conditioning, film review and walkthroughs…",
    href: "https://ncaaorg.s3.amazonaws.com/compliance/d1/D1Comp_TimeDemandsInfo.pdf",
    whyItMatters: [
      "CheckPeak’s workout check-ins can be configured around program-defined requirements (e.g., S&C) without implying athletes are required to do more than permitted.",
    ],
    tags: ["Football", "Offseason"],
  },

  /* ---------------------------
     Supplements / drug testing stance
  --------------------------- */
  {
    key: "no-approved-supplements",
    title: "Are there “NCAA-approved” supplements",
    quote: "There are no NCAA-approved nutritional or dietary supplements.",
    href: "https://www.ncaa.org/sports/2015/6/10/ncaa-banned-substances.aspx",
    whyItMatters: [
      "CheckPeak doesn’t endorse products. We surface risk within a product and route athletes back to staff and official sources.",
    ],
    tags: ["Supplements", "Positioning"],
  },
  {
    key: "supplements-not-well-regulated",
    title: "Supplements are not well regulated and can lead to a positive test",
    quote:
      "Nutritional/dietary supplements… are not well regulated and may cause a positive drug test.",
    href: "https://www.ncaa.org/sports/2015/6/10/ncaa-banned-substances.aspx",
    whyItMatters: [
      "CheckPeak treats screening as a first pass and reinforces staff confirmation. We encourage athletes to understand what’s in their supplements and route questions to staff.",
    ],
    tags: ["Risk", "Drug testing"],
  },
  {
    key: "contamination-warning",
    title: "Contamination risk is explicitly warned by the NCAA",
    quote:
      "Many nutritional/dietary supplements are contaminated with banned drugs not listed on the label.",
    href: "https://www.ncaa.org/sports/2015/6/10/ncaa-banned-substances.aspx",
    whyItMatters: [
      "A “clean” scan isn’t a guarantee.",
      "Supplements can be cross-contaminated or mislabeled — leading to a positive drug test. Always confirm with staff.",
    ],
    tags: ["Risk", "Reality check"],
  },
  {
    key: "banned-by-class",
    title: "Banned substances are organized by class",
    quote: "The NCAA bans drugs by class.",
    href: "https://www.ncaa.org/sports/2015/6/10/ncaa-banned-substances.aspx",
    whyItMatters: [
      "CheckPeak flags class-level risk and aliases so staff can review faster.",
    ],
    tags: ["Banned substances", "Screening"],
  },

  /* ---------------------------
     Responsible monitoring / performance technology
  --------------------------- */
  {
    key: "performance-technology-guidance",
    title: "Responsible monitoring requires a written plan",
    quote:
      "Schools should establish a written plan that addresses the responsible use of performance technologies…",
    href: "https://www.ncaa.org/news/2025/12/11/media-center-performance-technology-guidance-approved-by-csmas.aspx",
    whyItMatters: [
      "CheckPeak supports this approach: clear settings, clear access, documentation, and program-owned policy — without “always-on” surveillance.",
      "Evidence requirements are set by the program.",
    ],
    tags: ["Monitoring", "Policy"],
  },
  {
    key: "performance-tech-data-protection",
    title: "Data protection is part of responsible monitoring",
    quote:
      "…how the school will manage and protect student-athlete performance technology data.",
    href: "https://www.ncaa.org/news/2025/12/11/media-center-performance-technology-guidance-approved-by-csmas.aspx",
    whyItMatters: [
      "This aligns with how we position privacy: programs decide what’s needed, athletes share only what’s required, and staff access should be explicit.",
    ],
    tags: ["Data protection", "Privacy"],
  },
];