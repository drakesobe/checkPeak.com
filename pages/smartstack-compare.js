// pages/smartstack-compare.js
// Clinical precision light theme - CheckPeak brand typography, pharmaceutical data aesthetic

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import GridCard from "@/components/smartstack-cards/GridCard";

/* ════════════════════════════════════════════════════════════════════════════
   BRAND TOKENS
════════════════════════════════════════════════════════════════════════════ */
const C = {
  // Page surfaces
  pageBg:    "#F4F7FB",
  surface:   "#FFFFFF",
  raised:    "#F1F5F9",
  panel:     "#EBF0F7",

  // Borders
  border:    "#E2E8F0",
  borderMd:  "#CBD5E1",
  borderStr: "#94A3B8",

  // Text
  ink:       "#0D1B2A",
  body:      "#334155",
  secondary: "#64748B",
  muted:     "#94A3B8",
  ghost:     "#CBD5E1",

  // CheckPeak accent
  accent:    "#4FABFF",
  accentDk:  "#0284C7",
  accentBg:  "rgba(79,171,255,0.07)",
  accentBdr: "rgba(79,171,255,0.18)",

  // Semantic
  green:     "#059669",
  greenBg:   "#ECFDF5",
  greenBdr:  "#A7F3D0",
  amber:     "#B45309",
  amberBg:   "#FFFBEB",
  amberBdr:  "#FDE68A",
  red:       "#DC2626",
  redBg:     "#FEF2F2",
  redBdr:    "#FECACA",

  // Amazon - never change
  amazon:    "#FF9900",
};

const F = {
  cond: "'Barlow Condensed', sans-serif",
  body: "'Barlow', sans-serif",
};

/* ════════════════════════════════════════════════════════════════════════════
   UTILITIES (unchanged logic)
════════════════════════════════════════════════════════════════════════════ */
function useDebounce(value, delay) {
  const [dv, setDv] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDv(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return dv;
}

function useScrollDepth(threshold = 0.5) {
  const [reached, setReached] = useState(false);
  useEffect(() => {
    const check = () => {
      const scrolled = window.scrollY + window.innerHeight;
      const total = document.documentElement.scrollHeight;
      if (!reached && scrolled / total >= threshold) setReached(true);
    };
    window.addEventListener("scroll", check, { passive: true });
    return () => window.removeEventListener("scroll", check);
  }, [reached, threshold]);
  return reached;
}

/* ════════════════════════════════════════════════════════════════════════════
   VALUE SCORING (unchanged)
════════════════════════════════════════════════════════════════════════════ */
function toNum(v) { const n = Number(v); return Number.isFinite(n) ? n : null; }

function getPPS(stack) {
  for (const k of ["pricePerServing","PricePerServing","costPerServing"]) {
    const n = toNum(stack?.[k]); if (n != null && n > 0) return n;
  }
  const price = ["price","Price"].map(k => toNum(stack?.[k])).find(n => n != null && n > 0);
  const servings = ["servings","Servings"].map(k => toNum(stack?.[k])).find(n => n != null && n > 0);
  if (price && servings) return price / servings;
  return null;
}

function buildBucketStats(stacks) {
  const grouped = new Map();
  stacks.forEach(s => {
    const cat = String(s?.category || "").trim();
    const pps = getPPS(s);
    if (!cat || pps == null || pps <= 0) return;
    if (!grouped.has(cat)) grouped.set(cat, []);
    grouped.get(cat).push(pps);
  });
  const stats = {};
  grouped.forEach((prices, cat) => {
    const sorted = [...prices].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    stats[cat] = {
      count: prices.length,
      median: sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid-1] + sorted[mid]) / 2,
    };
  });
  return stats;
}

function getValueScore(stack, stats) {
  const cat = String(stack?.category || "").trim();
  const pps = getPPS(stack);
  const info = stats?.[cat];
  if (!cat || pps == null || pps <= 0 || !info?.median || info.count < 3) return null;
  return info.median / pps;
}

function getValueTier(score) {
  if (score == null) return null;
  if (score >= 1.15) return "best";
  if (score >= 0.90) return "good";
  return "decent";
}

const TIER = {
  best:   { label:"Best Value",   bg:C.greenBg, text:C.green,  border:C.greenBdr, dot:C.green  },
  good:   { label:"Good Value",   bg:C.accentBg, text:C.accentDk, border:C.accentBdr, dot:C.accent },
  decent: { label:"Decent Value", bg:C.amberBg, text:C.amber,  border:C.amberBdr, dot:C.amber  },
};

/* ════════════════════════════════════════════════════════════════════════════
   STATIC DATA (unchanged)
════════════════════════════════════════════════════════════════════════════ */
const CAT_CONFIG = [
  { slug:"pre-workout",   label:"Pre-Workout",    emoji:"⚡", cats:["Pre-Workout"],           desc:"Energy + focus before training" },
  { slug:"protein",       label:"Protein",         emoji:"💪", cats:["Protein Powder"],        desc:"Muscle repair & growth" },
  { slug:"vitamins",      label:"Vitamins",        emoji:"💊", cats:["Vitamins","Vitamin A","Vitamin B","Vitamin C","Vitamin D"], desc:"Daily health support" },
  { slug:"creatine",      label:"Creatine",        emoji:"🔬", cats:["Creatine"],              desc:"Strength & power output" },
  { slug:"bcaas",         label:"BCAAs",           emoji:"🌿", cats:["BCAAs"],                 desc:"Recovery & endurance" },
  { slug:"energy-drinks", label:"Energy Drinks",   emoji:"☕", cats:["Energy Drinks"],         desc:"Ready-to-drink caffeine" },
  { slug:"energy-gel",    label:"Energy Gel",      emoji:"🍯", cats:["Energy Gel"],            desc:"Fast-acting carb boost" },
];

const BRAND_CONFIG = [
  { name:"Thorne",              initials:"TH" },
  { name:"Cellucor",            initials:"CL" },
  { name:"RAW",                 initials:"RW" },
  { name:"ProSupps",            initials:"PS" },
  { name:"Orgain",              initials:"OR" },
  { name:"Optimum Nutrition",   initials:"ON" },
  { name:"ONE",                 initials:"1"  },
  { name:"Nutricost",           initials:"NC" },
  { name:"Quest",               initials:"QT" },
  { name:"Ryse",                initials:"RY" },
  { name:"Transparent Labs",    initials:"TL" },
  { name:"Momentous",           initials:"MO" },
  { name:"Solgar",              initials:"SG" },
  { name:"Pure Encapsulations", initials:"PE" },
  { name:"MaryRuth",            initials:"MR" },
  { name:"Nature Made",         initials:"NM" },
  { name:"Stinger",             initials:"ST" },
];

const SORT_OPTIONS = [
  { id:"best_value", label:"Best Value"   },
  { id:"price_asc",  label:"Price ↑"      },
  { id:"price_desc", label:"Price ↓"      },
  { id:"rating",     label:"Top Rated"    },
  { id:"popular",    label:"Most Popular" },
];

const SEO_BY_CAT = {
  "pre-workout":    { title: "Best Pre-Workout 2025 – Ranked by Price Per Serving | SmartStack",       desc: "We ranked every pre-workout supplement by true cost per serving vs. the category median. No sponsored picks. Find the best value pre-workout on Amazon today." },
  "protein":        { title: "Best Protein Powder 2025 – Cheapest Per Serving Ranked | SmartStack",    desc: "Compare protein powders by real price-per-serving. Optimum Nutrition, Transparent Labs, Nutricost and more - independently ranked. No paid placements." },
  "creatine":       { title: "Best Creatine 2025 – Ranked by Price Per Serving | SmartStack",          desc: "Find the cheapest creatine monohydrate per serving. Every product ranked against the category median. Independent analysis, no brand deals." },
  "vitamins":       { title: "Best Vitamins 2025 – Ranked by Real Value | SmartStack",                 desc: "Compare vitamins and supplements by price-per-serving. Thorne, Nature Made, Solgar and more - independently ranked by value, not sponsorship." },
  "bcaas":          { title: "Best BCAAs 2025 – Cheapest Per Serving Ranked | SmartStack",             desc: "Every BCAA supplement ranked by price-per-serving vs. category median. Find the best value BCAAs for recovery and endurance. No paid placements." },
  "energy-drinks":  { title: "Best Energy Drinks 2025 – Ranked by Value | SmartStack",                 desc: "Compare ready-to-drink energy drinks by real cost per serving. Independent rankings. No sponsored placements. Find the best deal on Amazon today." },
  "energy-gel":     { title: "Best Energy Gels 2025 – Ranked by Value | SmartStack",                   desc: "Compare energy gels by real cost per serving. Find the best value running and endurance gels ranked independently. No sponsored placements." },
};

/* ════════════════════════════════════════════════════════════════════════════
   HELPERS (unchanged)
════════════════════════════════════════════════════════════════════════════ */
function ppsLabel(pps) {
  if (pps == null) return null;
  return `$${pps < 0.10 ? pps.toFixed(3) : pps.toFixed(2)}`;
}
function priceLabel(stack) {
  const p = toNum(stack?.Price) || toNum(stack?.price);
  return p ? `$${p.toFixed(2)}` : null;
}
function formatK(n) {
  const num = Number(n);
  if (!Number.isFinite(num) || num <= 0) return null;
  return num >= 1000 ? `${(num/1000).toFixed(num%1000===0?0:1)}k` : String(Math.round(num));
}
function formatFetchTime(date) {
  if (!date) return "today";
  const h = date.getHours() % 12 || 12;
  const m = String(date.getMinutes()).padStart(2, "0");
  const ampm = date.getHours() >= 12 ? "pm" : "am";
  return `${h}:${m}${ampm}`;
}
function sortStacks(stacks, sortBy, stats) {
  return [...stacks].sort((a, b) => {
    if (sortBy === "price_asc")  return (getPPS(a) ?? Infinity)  - (getPPS(b) ?? Infinity);
    if (sortBy === "price_desc") return (getPPS(b) ?? -Infinity) - (getPPS(a) ?? -Infinity);
    if (sortBy === "rating")     return (Number(b?.rating)||0)   - (Number(a?.rating)||0);
    if (sortBy === "popular")    return (Number(b?.boughtLastMonth)||0) - (Number(a?.boughtLastMonth)||0);
    return (getValueScore(b, stats) ?? -Infinity) - (getValueScore(a, stats) ?? -Infinity);
  });
}

/* ════════════════════════════════════════════════════════════════════════════
   AMAZON BUTTON - conversion-critical, keep orange
════════════════════════════════════════════════════════════════════════════ */
function AmazonBtn({ stack, size = "md", showPrice = false, tier = null }) {
  const price  = showPrice ? priceLabel(stack) : null;
  const pps    = getPPS(stack);
  const ppsStr = pps ? ppsLabel(pps) : null;
  const label  = price
    ? `Buy on Amazon – ${price} (Prime Shipping)`
    : ppsStr
    ? `Get It Now – Only ${ppsStr}/serving`
    : "Shop on Amazon – Best Deal Today";
  const pad = size === "lg" ? "13px 24px" : size === "sm" ? "7px 12px" : "10px 18px";
  const fs  = size === "lg" ? 14.5 : size === "sm" ? 11.5 : 12.8;

  if (!stack?.affiliateLink) {
    return (
      <div style={{ padding:pad, background:C.raised, color:C.muted, fontSize:fs, fontFamily:F.body, textAlign:"center", fontWeight:600 }}>
        Currently Unavailable
      </div>
    );
  }
  return (
    <a
      href={stack.affiliateLink} target="_blank" rel="noopener noreferrer"
      onClick={() => trackAmazon(stack, tier)}
      style={{
        display:"flex", alignItems:"center", justifyContent:"center", gap:8,
        padding:pad, textDecoration:"none",
        background:C.amazon, color:"#fff", fontWeight:700,
        fontFamily:F.body, fontSize:fs,
        boxShadow:`0 4px 16px rgba(255,153,0,0.35)`,
        transition:"all 0.14s ease", whiteSpace:"nowrap",
      }}
      onMouseEnter={e => { e.currentTarget.style.background="#E68A00"; e.currentTarget.style.boxShadow="0 8px 22px rgba(255,153,0,0.5)"; }}
      onMouseLeave={e => { e.currentTarget.style.background=C.amazon; e.currentTarget.style.boxShadow="0 4px 16px rgba(255,153,0,0.35)"; }}
    >
      <svg width={fs} height={fs} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.6} aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
      </svg>
      {label}
    </a>
  );
}

function trackAmazon(stack, tier) {
  try {
    const payload = { event_category:"affiliate", supplement_name:stack?.name||"", category:stack?.category||"", value_tier:tier??"unknown", price_per_serving:getPPS(stack)??"" };
    if (typeof window !== "undefined") {
      window.gtag?.("event", "amazon_click", payload);
      window.dataLayer?.push({ event:"amazon_click", ...payload });
    }
  } catch {}
}

/* ════════════════════════════════════════════════════════════════════════════
   CATEGORY SELECTOR - clinical grid
════════════════════════════════════════════════════════════════════════════ */
function CategorySelector({ onSelect }) {
  return (
    <div>
      <p style={{ fontFamily:F.cond, fontSize:12, fontWeight:700, letterSpacing:"0.12em", textTransform:"uppercase", color:C.secondary, marginBottom:16, textAlign:"center" }}>
        Select a category to begin analysis
      </p>
      <div className="ss-cat-grid" style={{ display:"grid", gridTemplateColumns:"repeat(2,1fr)", gap:1, background:C.border }}>
        {CAT_CONFIG.map(cat => (
          <button
            key={cat.slug} type="button"
            onClick={() => onSelect(cat.slug)}
            style={{
              padding:"20px 16px", background:C.surface, cursor:"pointer",
              textAlign:"left", display:"flex", flexDirection:"column", gap:4,
              transition:"background 0.12s", border:"none",
            }}
            onMouseEnter={e => { e.currentTarget.style.background=C.accentBg; }}
            onMouseLeave={e => { e.currentTarget.style.background=C.surface; }}
          >
            <span style={{ fontSize:22, display:"block", marginBottom:2 }}>{cat.emoji}</span>
            <span style={{ fontFamily:F.cond, fontSize:14, fontWeight:900, letterSpacing:"0.04em", textTransform:"uppercase", color:C.ink, display:"block" }}>
              {cat.label}
            </span>
            <span style={{ fontFamily:F.body, fontSize:11, color:C.secondary, lineHeight:1.4 }}>{cat.desc}</span>
          </button>
        ))}
      </div>
      <div style={{ textAlign:"center", marginTop:16 }}>
        <button type="button" onClick={() => onSelect("all")} style={{
          background:"none", border:"none", cursor:"pointer",
          fontFamily:F.cond, fontSize:12, fontWeight:700, letterSpacing:"0.1em",
          textTransform:"uppercase", color:C.accent, textDecoration:"none",
        }}>
          Browse all categories →
        </button>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   BRAND SELECTOR - clean pills
════════════════════════════════════════════════════════════════════════════ */
function BrandSelector({ onSelect }) {
  return (
    <div style={{ marginTop:36 }}>
      <div style={{ display:"flex", alignItems:"center", gap:14, marginBottom:16 }}>
        <div style={{ flex:1, height:1, background:C.border }} />
        <p style={{ fontFamily:F.cond, fontSize:11, fontWeight:700, letterSpacing:"0.14em", textTransform:"uppercase", color:C.muted, margin:0, whiteSpace:"nowrap" }}>
          Filter by brand
        </p>
        <div style={{ flex:1, height:1, background:C.border }} />
      </div>
      <div style={{ display:"flex", flexWrap:"wrap", gap:6, justifyContent:"center" }}>
        {BRAND_CONFIG.map(brand => (
          <button
            key={brand.name} type="button"
            onClick={() => onSelect(brand.name)}
            style={{
              display:"flex", alignItems:"center", gap:7,
              padding:"6px 14px",
              border:`1px solid ${C.border}`, background:C.surface,
              cursor:"pointer", transition:"all 0.12s",
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor=C.accent; e.currentTarget.style.background=C.accentBg; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor=C.border; e.currentTarget.style.background=C.surface; }}
          >
            <div style={{
              width:20, height:20, background:C.accent, flexShrink:0,
              display:"flex", alignItems:"center", justifyContent:"center",
            }}>
              <span style={{ fontFamily:F.cond, fontSize:8, fontWeight:900, color:"#fff", letterSpacing:"0.02em" }}>
                {brand.initials}
              </span>
            </div>
            <span style={{ fontFamily:F.body, fontSize:12, fontWeight:600, color:C.ink, whiteSpace:"nowrap" }}>
              {brand.name}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   BEST SELLER STRIP - clinical data card
════════════════════════════════════════════════════════════════════════════ */
function BestSellerStrip({ stack, stats, catLabel, fetchedAt }) {
  if (!stack) return null;
  const pps     = getPPS(stack);
  const score   = getValueScore(stack, stats);
  const tier    = getValueTier(score);
  const tm      = tier ? TIER[tier] : null;
  const bought  = formatK(stack?.boughtLastMonth);
  const fetchStr = formatFetchTime(fetchedAt);

  return (
    <div style={{
      background:C.surface,
      border:`1px solid ${C.border}`,
      borderTop:`3px solid ${C.accent}`,
      overflow:"hidden", marginBottom:24,
      boxShadow:`0 4px 24px rgba(79,171,255,0.08)`,
    }}>
      {/* Header bar */}
      <div style={{
        padding:"8px 20px",
        background:C.raised,
        borderBottom:`1px solid ${C.border}`,
        display:"flex", alignItems:"center", gap:10, flexWrap:"wrap",
      }}>
        <span style={{ fontFamily:F.cond, fontSize:11, fontWeight:900, letterSpacing:"0.14em", textTransform:"uppercase", color:C.accent }}>
          🔥 Most Popular · {catLabel}
        </span>
        {tm && (
          <span style={{ fontFamily:F.cond, fontSize:10, fontWeight:700, letterSpacing:"0.08em", textTransform:"uppercase", padding:"2px 8px", background:tm.bg, color:tm.text, border:`1px solid ${tm.border}` }}>
            {tm.label}
          </span>
        )}
        <span style={{ fontFamily:F.body, fontSize:11, color:C.secondary, marginLeft:"auto" }}>
          Updated {fetchStr}
        </span>
      </div>

      {/* Body */}
      <div style={{ display:"flex", flexWrap:"wrap", padding:"24px", gap:24, alignItems:"center" }}>
        {/* Product image */}
        <div style={{ width:100, height:100, background:C.raised, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, overflow:"hidden", border:`1px solid ${C.border}` }}>
          {stack.imageUrl
            ? <img src={stack.imageUrl} alt={stack.name} style={{ width:"100%", height:"100%", objectFit:"contain", padding:8 }} loading="eager" />
            : <span style={{ fontSize:36, opacity:.2 }}>💊</span>
          }
        </div>

        {/* Data */}
        <div style={{ flex:1, minWidth:200 }}>
          <h3 style={{ fontFamily:F.cond, fontWeight:900, fontStyle:"italic", fontSize:"clamp(1.2rem,3vw,1.75rem)", letterSpacing:"-0.01em", textTransform:"uppercase", color:C.ink, margin:"0 0 8px", lineHeight:1 }}>
            {stack.name}
          </h3>

          {/* Data row */}
          <div style={{ display:"flex", flexWrap:"wrap", gap:"1.5rem", alignItems:"baseline", marginBottom:8 }}>
            {pps && (
              <div>
                <span style={{ fontFamily:F.cond, fontWeight:900, fontStyle:"italic", fontSize:"1.6rem", color:C.accent, letterSpacing:"-0.02em" }}>
                  {ppsLabel(pps)}
                </span>
                <span style={{ fontFamily:F.cond, fontSize:11, fontWeight:700, letterSpacing:"0.1em", textTransform:"uppercase", color:C.muted, marginLeft:5 }}>
                  / serving
                </span>
              </div>
            )}
            {stack.rating > 0 && (
              <span style={{ fontFamily:F.body, fontSize:13, color:C.body }}>
                ★ <strong>{Number(stack.rating).toFixed(1)}</strong>
                {stack.reviewCount > 0 ? ` (${formatK(stack.reviewCount)} reviews)` : ""}
              </span>
            )}
            {bought && (
              <span style={{ fontFamily:F.body, fontSize:13, color:C.body }}>
                🔥 {bought}+ last month
              </span>
            )}
          </div>

          <p style={{ fontFamily:F.body, fontSize:11, color:C.muted, margin:0 }}>
            Prices verified by CheckPeak · Updated {fetchStr} today
          </p>
        </div>

        {/* CTA */}
        <div style={{ flexShrink:0, minWidth:220 }}>
          <AmazonBtn stack={stack} size="lg" showPrice tier={tier} />
          <p style={{ textAlign:"center", fontSize:10, color:C.muted, marginTop:6, fontFamily:F.body }}>
            Opens Amazon · Fast Prime shipping · Price may vary
          </p>
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   VALUE EXPLAINER - clinical tier legend
════════════════════════════════════════════════════════════════════════════ */
function ValueExplainer() {
  return (
    <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderLeft:`3px solid ${C.borderStr}`, padding:"20px 24px" }}>
      <div style={{ display:"flex", alignItems:"flex-start", gap:24, flexWrap:"wrap" }}>
        <div style={{ flex:"1 1 240px" }}>
          <p style={{ fontFamily:F.cond, fontSize:14, fontWeight:900, letterSpacing:"0.06em", textTransform:"uppercase", color:C.ink, margin:"0 0 6px" }}>
            How We Calculate Value
          </p>
          <p style={{ fontFamily:F.body, fontSize:13, color:C.secondary, lineHeight:1.65, margin:0 }}>
            We calculate <strong>price-per-serving</strong> for every supplement and compare it to the category median. Rankings are 100% independent - no brand pays for placement.
          </p>
        </div>
        <div style={{ display:"flex", gap:8, flex:"2 1 300px", flexWrap:"wrap" }}>
          {Object.entries(TIER).map(([key, tm]) => (
            <div key={key} style={{
              flex:"1 1 130px", display:"flex", gap:8,
              background:tm.bg, border:`1px solid ${tm.border}`,
              padding:"10px 14px", alignItems:"flex-start",
            }}>
              <div style={{ width:8, height:8, background:tm.dot, flexShrink:0, marginTop:4 }} />
              <div>
                <p style={{ fontFamily:F.cond, fontSize:12, fontWeight:900, letterSpacing:"0.06em", textTransform:"uppercase", color:tm.text, margin:"0 0 2px" }}>{tm.label}</p>
                <p style={{ fontFamily:F.body, fontSize:11, color:tm.text, opacity:.85, lineHeight:1.5, margin:0 }}>
                  {key === "best"   ? "Significantly cheaper than category average" :
                   key === "good"   ? "Near category average - solid pick" :
                   "Slightly above average, still worth considering"}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   PRELOADED COMPARE TABLE - clinical data table
════════════════════════════════════════════════════════════════════════════ */
function PreloadedCompare({ stacks, stats, catLabel, fetchedAt }) {
  if (!stacks.length) return null;
  const fetchStr = formatFetchTime(fetchedAt);

  return (
    <div style={{
      background:C.surface, border:`1px solid ${C.border}`,
      borderTop:`3px solid ${C.accent}`,
      overflow:"hidden", marginBottom:24,
      boxShadow:`0 4px 24px rgba(79,171,255,0.08)`,
    }}>
      {/* Header */}
      <div style={{ padding:"12px 20px", borderBottom:`1px solid ${C.border}`, background:C.accentBg, display:"flex", alignItems:"center", gap:12, flexWrap:"wrap" }}>
        <p style={{ fontFamily:F.cond, fontSize:14, fontWeight:900, letterSpacing:"0.06em", textTransform:"uppercase", color:C.ink, margin:0 }}>
          Top {stacks.length} {catLabel} - Head to Head
        </p>
        <span style={{ fontFamily:F.body, fontSize:11, color:C.secondary, marginLeft:"auto" }}>
          Ranked by value · Updated {fetchStr}
        </span>
      </div>

      <div style={{ overflowX:"auto" }}>
        <table style={{ width:"100%", borderCollapse:"collapse", fontFamily:F.body, minWidth:500 }}>
          <thead>
            <tr style={{ borderBottom:`1px solid ${C.border}`, background:C.raised }}>
              <th style={{ padding:"10px 16px", textAlign:"left", fontFamily:F.cond, fontSize:10, fontWeight:900, letterSpacing:"0.14em", textTransform:"uppercase", color:C.secondary, width:110 }}>
                Metric
              </th>
              {stacks.map((s, i) => (
                <th key={s.id} style={{ padding:"10px 16px", textAlign:"center", minWidth:150 }}>
                  <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:4 }}>
                    {i === 0 && (
                      <span style={{ fontFamily:F.cond, fontSize:9, fontWeight:900, letterSpacing:"0.1em", textTransform:"uppercase", color:C.green, background:C.greenBg, padding:"1px 8px", border:`1px solid ${C.greenBdr}` }}>
                        #1 Pick
                      </span>
                    )}
                    {s.imageUrl && <img src={s.imageUrl} alt={s.name} style={{ width:44, height:44, objectFit:"contain", background:C.raised, padding:3, border:`1px solid ${C.border}` }} />}
                    <span style={{ fontFamily:F.cond, fontSize:12, fontWeight:700, letterSpacing:"0.02em", color:C.ink, textTransform:"uppercase", lineHeight:1.2 }}>{s.name}</span>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[
              {
                label:"Price / Serving",
                render: s => { const p = getPPS(s); return p ? <strong style={{ fontFamily:F.cond, fontSize:15, fontStyle:"italic" }}>{ppsLabel(p)}</strong> : "-"; },
                bestOf: ss => { const ns = ss.map(getPPS).filter(n=>n!=null); return ns.length ? Math.min(...ns) : null; },
                isBest: (s,b) => getPPS(s) === b,
              },
              {
                label:"Value Rating",
                render: s => { const tm = TIER[getValueTier(getValueScore(s,stats))]; return tm ? <span style={{ fontFamily:F.cond, fontSize:11, fontWeight:700, letterSpacing:"0.06em", textTransform:"uppercase", padding:"2px 8px", background:tm.bg, color:tm.text, border:`1px solid ${tm.border}` }}>{tm.label}</span> : <span style={{ color:C.ghost }}>N/A</span>; },
              },
              {
                label:"Customer Rating",
                render: s => s?.rating > 0 ? <span>★ <strong>{Number(s.rating).toFixed(1)}</strong>{s.reviewCount>0?` (${formatK(s.reviewCount)})`:""}</span> : "-",
                bestOf: ss => { const ns=ss.map(v=>Number(v?.rating)||0).filter(n=>n>0); return ns.length?Math.max(...ns):null; },
                isBest: (s,b) => Number(s?.rating) === b,
              },
              {
                label:"Popularity",
                render: s => { const b=formatK(s?.boughtLastMonth); return b?`🔥 ${b}+ last month`:"-"; },
                bestOf: ss => { const ns=ss.map(v=>Number(v?.boughtLastMonth)||0).filter(n=>n>0); return ns.length?Math.max(...ns):null; },
                isBest: (s,b) => Number(s?.boughtLastMonth) === b,
              },
              {
                label:"Buy Now",
                render: s => <AmazonBtn stack={s} size="sm" showPrice tier={getValueTier(getValueScore(s, stats))} />,
              },
            ].map((row, ri) => {
              const bestVal = row.bestOf ? row.bestOf(stacks) : null;
              return (
                <tr key={row.label} style={{ borderBottom: ri < 4 ? `1px solid ${C.raised}` : "none" }}>
                  <td style={{ padding:"11px 16px", fontFamily:F.cond, fontSize:10, fontWeight:900, letterSpacing:"0.12em", textTransform:"uppercase", color:C.secondary, whiteSpace:"nowrap" }}>
                    {row.label}
                  </td>
                  {stacks.map(s => {
                    const isBest = row.isBest && bestVal != null ? row.isBest(s, bestVal) : false;
                    return (
                      <td key={s.id} style={{ padding:"11px 16px", textAlign:"center", fontSize:13, color:isBest?C.green:C.ink, background:isBest?C.greenBg:"transparent", fontWeight:isBest?700:400 }}>
                        {row.render(s)}
                        {isBest && <div style={{ fontFamily:F.cond, fontSize:9, fontWeight:900, letterSpacing:"0.1em", textTransform:"uppercase", color:C.green, marginTop:2 }}>Best</div>}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   MANUAL COMPARE TABLE + SAFETY CHECK (logic unchanged, restyled)
════════════════════════════════════════════════════════════════════════════ */
function ManualCompareTable({ stacks, stats, onRemove }) {
  const ref = useRef(null);
  const [safetyData, setSafetyData] = useState({});

  useEffect(() => {
    if (stacks.length === 2 && ref.current) {
      setTimeout(() => ref.current?.scrollIntoView({ behavior:"smooth", block:"start" }), 100);
    }
  }, [stacks.length]);

  useEffect(() => {
    stacks.forEach(stack => {
      const id = stack.id;
      if (safetyData[id]) return;
      if (!stack?.nutritionLabel) {
        setSafetyData(prev => ({ ...prev, [id]: { phase:"no_label", result:null } }));
        return;
      }
      setSafetyData(prev => ({ ...prev, [id]: { phase:"scanning", result:null } }));
      (async () => {
        try {
          const file = await fetchLabelAsFile(stack.nutritionLabel);
          const { createWorker } = await import("tesseract.js");
          const worker = await createWorker("eng");
          const canvas = document.createElement("canvas");
          const bitmap = await createImageBitmap(file);
          let w = bitmap.width, h = bitmap.height;
          const maxDim = 1800;
          if (w > maxDim || h > maxDim) { const s = Math.min(maxDim/w, maxDim/h); w = Math.round(w*s); h = Math.round(h*s); }
          canvas.width = w; canvas.height = h;
          const ctx = canvas.getContext("2d", { willReadFrequently:true });
          ctx.drawImage(bitmap, 0, 0, w, h);
          const imgData = ctx.getImageData(0, 0, w, h);
          const px = imgData.data;
          let min=255, max=0;
          for (let i=0;i<px.length;i+=4){ const g=0.3*px[i]+0.59*px[i+1]+0.11*px[i+2]; if(g<min)min=g; if(g>max)max=g; }
          const scale = 255/(max-min||1);
          for (let i=0;i<px.length;i+=4){ const g=Math.max(0,Math.min(255,(0.3*px[i]+0.59*px[i+1]+0.11*px[i+2]-min)*scale)); px[i]=px[i+1]=px[i+2]=g; }
          ctx.putImageData(imgData, 0, 0);
          const result = await worker.recognize(canvas);
          const ocrText = String(result?.data?.text ?? "").trim();
          await worker.terminate();
          if (!ocrText) { setSafetyData(prev => ({ ...prev, [id]: { phase:"done", result:{ matchedBanned:[], matchedIngredients:[] } } })); return; }
          const checkRes = await fetch("/api/check", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ ingredientsText:ocrText }), credentials:"include" });
          const checkData = await checkRes.json().catch(()=>({}));
          setSafetyData(prev => ({ ...prev, [id]: { phase:"done", result: checkRes.ok ? checkData : { matchedBanned:[], matchedIngredients:[] } } }));
        } catch (err) {
          console.error("[SafetyCheck] failed for", stack.name, err);
          setSafetyData(prev => ({ ...prev, [id]: { phase:"error", result:null } }));
        }
      })();
    });
  }, [stacks]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const ids = new Set(stacks.map(s => s.id));
    setSafetyData(prev => { const next = {}; for (const k of Object.keys(prev)) { if (ids.has(k)) next[k] = prev[k]; } return next; });
  }, [stacks]);

  if (stacks.length < 2) return null;

  const renderSafetyCell = (stack) => {
    const sd = safetyData[stack.id];
    if (!sd || sd.phase === "scanning") {
      return (
        <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:4 }}>
          <div style={{ width:16, height:16, border:`2px solid ${C.border}`, borderTopColor:C.accent, animation:"cmp-spin 0.8s linear infinite", borderRadius:"50%" }} />
          <span style={{ fontFamily:F.body, fontSize:9, color:C.secondary }}>Scanning…</span>
        </div>
      );
    }
    if (sd.phase === "no_label") return <span style={{ fontFamily:F.body, fontSize:11, color:C.muted }}>No label</span>;
    if (sd.phase === "error") return <span style={{ fontFamily:F.body, fontSize:11, color:C.muted }}>Unavailable</span>;
    const banned = sd.result?.matchedBanned || [];
    const hasBanned = banned.length > 0;
    return (
      <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:5 }}>
        <div style={{ display:"flex", alignItems:"center", gap:5, padding:"3px 10px", background:hasBanned?C.redBg:C.greenBg, border:`1px solid ${hasBanned?C.redBdr:C.greenBdr}` }}>
          <span style={{ fontSize:11 }}>{hasBanned ? "⚠️" : "✅"}</span>
          <span style={{ fontFamily:F.cond, fontSize:11, fontWeight:900, letterSpacing:"0.06em", textTransform:"uppercase", color:hasBanned?C.red:C.green }}>
            {hasBanned ? `${banned.length} flagged` : "Clear"}
          </span>
        </div>
        {hasBanned && (
          <div style={{ display:"flex", flexDirection:"column", gap:3, width:"100%" }}>
            {banned.slice(0, 4).map((b, i) => {
              const name = b?.fields?.["Substance Name"] || b?.fields?.["Name"] || "Unknown";
              const type = b?.fields?.["Ban Type"] || "";
              return (
                <div key={i} style={{ padding:"3px 8px", background:C.redBg, border:`1px solid ${C.redBdr}`, textAlign:"left" }}>
                  <span style={{ fontFamily:F.cond, fontSize:10, fontWeight:700, letterSpacing:"0.04em", textTransform:"uppercase", color:C.red, display:"block" }}>{name}</span>
                  {type && <span style={{ fontFamily:F.body, fontSize:9, color:C.red, opacity:.7 }}>{type}</span>}
                </div>
              );
            })}
            {banned.length > 4 && <span style={{ fontFamily:F.body, fontSize:9, color:C.secondary, textAlign:"center" }}>+{banned.length - 4} more</span>}
          </div>
        )}
      </div>
    );
  };

  const safetyBestId = (() => {
    const counts = stacks.map(s => { const sd = safetyData[s.id]; if (sd?.phase !== "done") return null; return { id:s.id, count:(sd.result?.matchedBanned||[]).length }; }).filter(Boolean);
    if (counts.length < stacks.length) return null;
    const min = Math.min(...counts.map(c => c.count));
    const winners = counts.filter(c => c.count === min);
    return winners.length === 1 ? winners[0].id : null;
  })();

  return (
    <div ref={ref} id="compare-result" style={{ background:C.surface, border:`1px solid ${C.border}`, borderTop:`3px solid ${C.accent}`, overflow:"hidden", boxShadow:`0 4px 24px rgba(79,171,255,0.08)`, scrollMarginTop:72 }}>
      {/* Header */}
      <div style={{ padding:"12px 20px", borderBottom:`1px solid ${C.border}`, background:C.accentBg, display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:8 }}>
        <p style={{ fontFamily:F.cond, fontSize:14, fontWeight:900, letterSpacing:"0.06em", textTransform:"uppercase", color:C.ink, margin:0 }}>
          Your Comparison
        </p>
        <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
          {stacks.map(s => (
            <div key={s.id} style={{ display:"flex", alignItems:"center", gap:5, background:C.surface, border:`1px solid ${C.accentBdr}`, padding:"3px 10px" }}>
              <span style={{ fontFamily:F.cond, fontSize:11, fontWeight:700, letterSpacing:"0.04em", textTransform:"uppercase", color:C.ink, maxWidth:120, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{s.name}</span>
              <button type="button" onClick={() => onRemove(s.id)} style={{ background:"none", border:"none", cursor:"pointer", color:C.muted, padding:0, fontSize:13, lineHeight:1 }}>✕</button>
            </div>
          ))}
        </div>
      </div>

      <div style={{ overflowX:"auto" }}>
        <table style={{ width:"100%", borderCollapse:"collapse", fontFamily:F.body, minWidth:400 }}>
          <thead>
            <tr style={{ borderBottom:`1px solid ${C.border}`, background:C.raised }}>
              <th style={{ padding:"10px 16px", textAlign:"left", fontFamily:F.cond, fontSize:10, fontWeight:900, letterSpacing:"0.14em", textTransform:"uppercase", color:C.secondary, width:110 }}>Metric</th>
              {stacks.map(s => (
                <th key={s.id} style={{ padding:"10px 16px", textAlign:"center", minWidth:140 }}>
                  <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:4 }}>
                    {s.imageUrl && <img src={s.imageUrl} alt={s.name} style={{ width:40, height:40, objectFit:"contain", background:C.raised, padding:3, border:`1px solid ${C.border}` }} />}
                    <span style={{ fontFamily:F.cond, fontSize:11, fontWeight:700, letterSpacing:"0.04em", textTransform:"uppercase", color:C.ink, lineHeight:1.2 }}>{s.name}</span>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[
              { label:"Price/Serving",  render:s=>{const p=getPPS(s);return p?<strong style={{fontFamily:F.cond,fontSize:15,fontStyle:"italic"}}>{ppsLabel(p)}</strong>:"-";}, bestOf:ss=>{const ns=ss.map(getPPS).filter(n=>n!=null);return ns.length?Math.min(...ns):null;}, isBest:(s,b)=>getPPS(s)===b },
              { label:"Value Rating",   render:s=>{const tm=TIER[getValueTier(getValueScore(s,stats))];return tm?<span style={{fontFamily:F.cond,fontSize:11,fontWeight:900,letterSpacing:"0.06em",textTransform:"uppercase",padding:"2px 8px",background:tm.bg,color:tm.text,border:`1px solid ${tm.border}`}}>{tm.label}</span>:"-";} },
              { label:"Rating",         render:s=>s?.rating>0?<span>★ <strong>{Number(s.rating).toFixed(1)}</strong></span>:"-", bestOf:ss=>{const ns=ss.map(v=>Number(v?.rating)||0).filter(n=>n>0);return ns.length?Math.max(...ns):null;}, isBest:(s,b)=>Number(s?.rating)===b },
              { label:"Popularity",     render:s=>{const b=formatK(s?.boughtLastMonth);return b?`${b}+ last mo`:"-";}, bestOf:ss=>{const ns=ss.map(v=>Number(v?.boughtLastMonth)||0).filter(n=>n>0);return ns.length?Math.max(...ns):null;}, isBest:(s,b)=>Number(s?.boughtLastMonth)===b },
              { label:"Buy",            render:s=><AmazonBtn stack={s} size="sm" showPrice tier={getValueTier(getValueScore(s, stats))} /> },
            ].map((row) => {
              const bestVal = row.bestOf ? row.bestOf(stacks) : null;
              return (
                <tr key={row.label} style={{ borderBottom:`1px solid ${C.raised}` }}>
                  <td style={{ padding:"11px 16px", fontFamily:F.cond, fontSize:10, fontWeight:900, letterSpacing:"0.12em", textTransform:"uppercase", color:C.secondary, whiteSpace:"nowrap" }}>{row.label}</td>
                  {stacks.map(s => {
                    const isBest = row.isBest && bestVal != null ? row.isBest(s, bestVal) : false;
                    return (
                      <td key={s.id} style={{ padding:"11px 16px", textAlign:"center", fontSize:13, color:isBest?C.green:C.ink, background:isBest?C.greenBg:"transparent", fontWeight:isBest?700:400 }}>
                        {row.render(s)}
                        {isBest && <div style={{ fontFamily:F.cond, fontSize:9, fontWeight:900, letterSpacing:"0.1em", textTransform:"uppercase", color:C.green, marginTop:2 }}>Best</div>}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
            {/* Safety row */}
            <tr style={{ borderTop:`2px solid ${C.border}`, background:C.raised }}>
              <td style={{ padding:"12px 16px", verticalAlign:"top" }}>
                <div style={{ fontFamily:F.cond, fontSize:10, fontWeight:900, letterSpacing:"0.12em", textTransform:"uppercase", color:C.accent, marginBottom:2 }}>Safety Check</div>
                <div style={{ fontFamily:F.body, fontSize:9, color:C.secondary, lineHeight:1.4, maxWidth:90 }}>Banned substance scan</div>
              </td>
              {stacks.map(s => {
                const isSafest = safetyBestId === s.id;
                return (
                  <td key={s.id} style={{ padding:"12px 16px", textAlign:"center", verticalAlign:"top", background:isSafest?C.greenBg:"transparent" }}>
                    {renderSafetyCell(s)}
                    {isSafest && <div style={{ fontFamily:F.cond, fontSize:9, fontWeight:900, letterSpacing:"0.1em", textTransform:"uppercase", color:C.green, marginTop:4 }}>Safest</div>}
                  </td>
                );
              })}
            </tr>
          </tbody>
        </table>
      </div>
      <div style={{ padding:"8px 20px", borderTop:`1px solid ${C.border}`, background:C.raised }}>
        <p style={{ fontFamily:F.body, fontSize:9, color:C.muted, margin:0, textAlign:"center" }}>
          Safety Check powered by CheckPeak - matched against our banned substances database. Results are for informational purposes only.
        </p>
      </div>
    </div>
  );
}

async function fetchLabelAsFile(url) {
  if (!url) throw new Error("No image URL");
  try {
    const r = await fetch(url, { mode:"cors" });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const b = await r.blob();
    return new File([b], `label.${b.type.includes("png")?"png":"jpg"}`, { type:b.type||"image/jpeg" });
  } catch {}
  const r = await fetch(`/api/ocr/proxy-image?url=${encodeURIComponent(url)}`);
  if (!r.ok) throw new Error(`Proxy failed (${r.status})`);
  const b = await r.blob();
  return new File([b], `label.${b.type.includes("png")?"png":"jpg"}`, { type:b.type||"image/jpeg" });
}

/* ════════════════════════════════════════════════════════════════════════════
   COMPARE PANEL - sticky bottom
════════════════════════════════════════════════════════════════════════════ */
function ComparePanel({ stacks, onRemove, onClear, onScrollToTable }) {
  if (stacks.length === 0) return null;
  const ready = stacks.length >= 2;
  return (
    <div style={{
      position:"fixed", bottom:0, left:0, right:0, zIndex:50,
      background:"rgba(255,255,255,0.97)", backdropFilter:"blur(12px)",
      borderTop: ready ? `2px solid ${C.accent}` : `2px solid ${C.border}`,
      boxShadow:"0 -4px 24px rgba(0,0,0,0.08)",
      padding:"10px 16px",
      paddingBottom:"max(10px, env(safe-area-inset-bottom))",
    }}>
      <div style={{ maxWidth:1100, margin:"0 auto", display:"flex", alignItems:"center", gap:10, flexWrap:"wrap" }}>
        <span style={{ fontFamily:F.cond, fontSize:11, fontWeight:900, letterSpacing:"0.12em", textTransform:"uppercase", color:ready?C.accent:C.secondary, flexShrink:0 }}>
          {ready ? `Comparing ${stacks.length}:` : `Select ${2-stacks.length} more:`}
        </span>
        <div style={{ display:"flex", gap:6, flex:1, flexWrap:"wrap" }}>
          {stacks.map(s => (
            <div key={s.id} style={{ display:"flex", alignItems:"center", gap:5, background:C.accentBg, border:`1px solid ${C.accentBdr}`, padding:"4px 10px" }}>
              <span style={{ fontFamily:F.cond, fontSize:11, fontWeight:700, letterSpacing:"0.04em", textTransform:"uppercase", color:C.accent, maxWidth:120, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{s.name}</span>
              <button type="button" onClick={() => onRemove(s.id)} style={{ background:"none", border:"none", cursor:"pointer", color:C.muted, padding:0, lineHeight:1 }}>✕</button>
            </div>
          ))}
          {Array.from({ length: Math.max(0, 2 - stacks.length) }).map((_,i) => (
            <div key={`empty-${i}`} style={{ display:"flex", alignItems:"center", padding:"4px 14px", border:`1.5px dashed ${C.border}` }}>
              <span style={{ fontFamily:F.body, fontSize:11, color:C.ghost }}>+ Add product</span>
            </div>
          ))}
        </div>
        <div style={{ display:"flex", gap:8, flexShrink:0 }}>
          {ready && (
            <button type="button" onClick={onScrollToTable}
              style={{ padding:"8px 20px", background:C.accent, color:"#fff", fontFamily:F.cond, fontSize:12, fontWeight:900, letterSpacing:"0.08em", textTransform:"uppercase", border:"none", cursor:"pointer", transition:"filter 0.12s" }}
              onMouseEnter={e => { e.currentTarget.style.filter="brightness(1.1)"; }}
              onMouseLeave={e => { e.currentTarget.style.filter="none"; }}
            >
              Compare now ↓
            </button>
          )}
          <button type="button" onClick={onClear}
            style={{ padding:"8px 14px", background:"transparent", border:`1px solid ${C.border}`, color:C.secondary, fontFamily:F.body, fontSize:12, cursor:"pointer" }}>
            Clear
          </button>
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   EMAIL CAPTURE STRIP
════════════════════════════════════════════════════════════════════════════ */
function EmailCaptureStrip({ activeCatLabel }) {
  const [visible,   setVisible]   = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [email,     setEmail]     = useState("");
  const [sent,      setSent]      = useState(false);
  const [saving,    setSaving]    = useState(false);
  const scrolledHalf = useScrollDepth(0.5);

  useEffect(() => { const t = setTimeout(() => setVisible(true), 60000); return () => clearTimeout(t); }, []);
  useEffect(() => { if (scrolledHalf) setVisible(true); }, [scrolledHalf]);

  const handleSubmit = async e => {
    e?.preventDefault();
    if (!email.includes("@") || saving) return;
    setSaving(true);
    try { window.gtag?.("event", "email_capture", { category: activeCatLabel }); window.dataLayer?.push({ event:"email_capture", category: activeCatLabel }); } catch {}
    try { await fetch("/api/smartstack/subscribe", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ email, category: activeCatLabel || "Supplements" }) }); } catch {}
    setSaving(false);
    setSent(true);
    setTimeout(() => setDismissed(true), 3500);
  };

  if (!visible || dismissed) return null;
  return (
    <div style={{
      position:"fixed", bottom:0, left:0, right:0, zIndex:48,
      background:C.ink, color:"#fff",
      padding:"14px 20px",
      paddingBottom:"max(14px, env(safe-area-inset-bottom))",
      boxShadow:"0 -4px 24px rgba(0,0,0,0.2)",
      display:"flex", alignItems:"center", gap:16, flexWrap:"wrap",
    }}>
      {sent ? (
        <p style={{ fontFamily:F.body, fontSize:13, color:"rgba(255,255,255,0.85)", margin:0, flex:1 }}>
          ✓ Got it! We'll alert you when {activeCatLabel || "supplement"} prices drop.
        </p>
      ) : (
        <>
          <div style={{ flex:"1 1 220px" }}>
            <p style={{ fontFamily:F.cond, fontSize:14, fontWeight:900, letterSpacing:"0.06em", textTransform:"uppercase", color:"#fff", margin:"0 0 2px" }}>
              Price drop alerts
            </p>
            <p style={{ fontFamily:F.body, fontSize:11, color:"rgba(255,255,255,0.55)", margin:0 }}>
              We'll notify you when the best-value {activeCatLabel || "supplement"} option drops.
            </p>
          </div>
          <div style={{ display:"flex", gap:8, flex:"1 1 260px", minWidth:0 }}>
            <input
              type="email" value={email} onChange={e => setEmail(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") handleSubmit(e); }}
              placeholder="your@email.com" autoComplete="email"
              style={{ flex:1, padding:"8px 12px", border:"none", fontSize:13, fontFamily:F.body, outline:"none", minWidth:0, background:"#fff", color:C.ink }}
            />
            <button type="button" onClick={handleSubmit} disabled={saving}
              style={{ padding:"8px 16px", background:C.amazon, color:"#fff", fontFamily:F.cond, fontSize:12, fontWeight:900, letterSpacing:"0.08em", textTransform:"uppercase", border:"none", cursor:saving?"wait":"pointer", flexShrink:0, transition:"filter 0.12s", opacity:saving?0.7:1 }}
              onMouseEnter={e => { if(!saving) e.currentTarget.style.filter="brightness(1.1)"; }}
              onMouseLeave={e => { if(!saving) e.currentTarget.style.filter="none"; }}
            >
              {saving ? "Saving…" : "Notify me"}
            </button>
          </div>
        </>
      )}
      <button type="button" onClick={() => setDismissed(true)} style={{ background:"none", border:"none", cursor:"pointer", color:"rgba(255,255,255,0.35)", fontSize:18, lineHeight:1, flexShrink:0, padding:4 }}>✕</button>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   MAIN PAGE
════════════════════════════════════════════════════════════════════════════ */
export default function SmartStackComparePage() {
  const router = useRouter();
  const [allStacks,    setAllStacks]    = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [loadError,    setLoadError]    = useState(null);
  const [dataFetchedAt,setDataFetchedAt]= useState(null);
  const [activeCatSlug,setActiveCatSlug]= useState(null);
  const [sortBy,       setSortBy]       = useState("best_value");
  const [searchRaw,    setSearchRaw]    = useState("");
  const [comparing,    setComparing]    = useState([]);
  const [visibleLimit, setLimit]        = useState(24);

  const searchQuery = useDebounce(searchRaw, 280);

  useEffect(() => {
    if (!router.isReady) return;
    const { cat, sort, brand } = router.query;
    if (cat) setActiveCatSlug(String(cat).toLowerCase());
    if (sort && SORT_OPTIONS.find(o => o.id === sort)) setSortBy(sort);
    if (brand) setSearchRaw(String(brand));
  }, [router.isReady, router.query]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const res = await fetch("/api/smartstack");
        if (!res.ok) throw new Error(`Server error ${res.status}`);
        const data = await res.json();
        if (!cancelled) { setAllStacks(data.records || []); setDataFetchedAt(new Date()); }
      } catch(err) {
        if (!cancelled) setLoadError("Failed to load. Please refresh.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  const stats = useMemo(() => buildBucketStats(allStacks), [allStacks]);

  const valueRankMap = useMemo(() => {
    const byCat = new Map();
    allStacks.forEach(s => { const cat = String(s?.category||"").trim(); if (!cat) return; if (!byCat.has(cat)) byCat.set(cat,[]); byCat.get(cat).push(s); });
    const map = new Map();
    byCat.forEach((stacksInCat) => {
      const sorted = [...stacksInCat].sort((a,b) => (getValueScore(b,stats)??-Infinity)-(getValueScore(a,stats)??-Infinity));
      sorted.forEach((s,i) => { map.set(s.id, { rank:i+1, total:sorted.length }); });
    });
    return map;
  }, [allStacks, stats]);

  const handleSelectBrand = useCallback((brandName) => {
    setActiveCatSlug("all"); setSearchRaw(brandName); setLimit(24);
    router.replace({ pathname:router.pathname, query:{ ...router.query, cat:"all", brand:brandName } }, undefined, { shallow:true, scroll:false });
  }, [router]);

  const handleSelectCat = useCallback((slug) => {
    setActiveCatSlug(slug === "all" ? "all" : slug); setLimit(24); setSearchRaw("");
    router.replace({ pathname:router.pathname, query:{ ...router.query, cat:slug } }, undefined, { shallow:true, scroll:false });
  }, [router]);

  const activeCatConfig  = useMemo(() => { if (!activeCatSlug || activeCatSlug === "all") return null; return CAT_CONFIG.find(c => c.slug === activeCatSlug) || null; }, [activeCatSlug]);
  const activeCatLabel   = activeCatConfig?.label || "";
  const activeBrandName  = useMemo(() => { if (!searchQuery.trim()) return null; const match = BRAND_CONFIG.find(b => b.name.toLowerCase() === searchQuery.trim().toLowerCase()); return match ? match.name : null; }, [searchQuery]);

  const filtered = useMemo(() => {
    let result = allStacks;
    if (activeCatSlug && activeCatSlug !== "all" && activeCatConfig) result = result.filter(s => activeCatConfig.cats.includes(String(s?.category||"").trim()));
    if (searchQuery.trim()) { const q = searchQuery.toLowerCase(); result = result.filter(s => (s?.name||"").toLowerCase().includes(q)); }
    return sortStacks(result, sortBy, stats);
  }, [allStacks, activeCatSlug, activeCatConfig, searchQuery, sortBy, stats]);

  useEffect(() => { setLimit(24); }, [activeCatSlug, searchQuery, sortBy]);

  const gridStacks  = useMemo(() => filtered.slice(0, visibleLimit), [filtered, visibleLimit]);
  const canLoadMore = visibleLimit < filtered.length;
  const totalCount  = allStacks.length;

  const bestSeller = useMemo(() => {
    if (!activeCatConfig) return null;
    const pool = allStacks.filter(s => activeCatConfig.cats.includes(String(s?.category||"").trim()) && s?.imageUrl && s?.affiliateLink);
    return pool.sort((a,b) => (Number(b?.boughtLastMonth)||0)-(Number(a?.boughtLastMonth)||0))[0] || null;
  }, [allStacks, activeCatConfig]);

  const preloadedTop3 = useMemo(() => {
    if (!activeCatConfig) return [];
    const pool = allStacks.filter(s => activeCatConfig.cats.includes(String(s?.category||"").trim()) && s?.imageUrl && s?.affiliateLink);
    return sortStacks(pool, "best_value", stats).slice(0, 3);
  }, [allStacks, activeCatConfig, stats]);

  const toggleCompare    = useCallback(stack => { setComparing(prev => { if (prev.find(s=>s.id===stack.id)) return prev.filter(s=>s.id!==stack.id); if (prev.length>=3) return prev; return [...prev,stack]; }); }, []);
  const removeFromCompare = useCallback(id => setComparing(prev => prev.filter(s => s.id !== id)), []);
  const clearCompare     = useCallback(() => setComparing([]), []);
  const scrollToManual   = useCallback(() => { document.getElementById("compare-result")?.scrollIntoView({ behavior:"smooth", block:"start" }); }, []);

  const catSeo    = activeCatSlug ? SEO_BY_CAT[activeCatSlug] : null;
  const pageTitle = activeBrandName ? `${activeBrandName} Supplements Ranked by Value | SmartStack` : catSeo ? catSeo.title : `Best Supplements 2025 – Ranked by Price Per Serving | SmartStack`;
  const pageDesc  = activeBrandName ? `Every ${activeBrandName} supplement ranked by price-per-serving against the category median. Independent analysis. No paid placements.` : catSeo ? catSeo.desc : `Compare ${totalCount}+ supplements by true price-per-serving. Pre-workout, protein, creatine, vitamins and more - independently ranked. No brand pays to be here.`;
  const pageUrl   = `https://checkpeak.com/smartstack-compare${activeCatSlug ? `?cat=${activeCatSlug}` : ""}`;
  const isEmailCaptureActive = comparing.length === 0;

  return (
    <>
      <Head>
        <title>{pageTitle}</title>
        <meta name="description" content={pageDesc} />
        <link rel="canonical" href={pageUrl} />
        <meta property="og:title" content={pageTitle} />
        <meta property="og:description" content={pageDesc} />
        <meta property="og:url" content={pageUrl} />
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="SmartStack by CheckPeak" />
        <meta name="twitter:card" content="summary" />
        <meta name="twitter:title" content={pageTitle} />
        <meta name="twitter:description" content={pageDesc} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:ital,wght@0,400;0,700;0,900;1,700;1,900&family=Barlow:wght@400;500;600;700&display=swap" rel="stylesheet" />
        <style>{`
          @keyframes cmp-spin { to { transform:rotate(360deg); } }
          @media (min-width:480px) { .ss-cat-grid { grid-template-columns:repeat(3,1fr) !important; } }
          @media (min-width:680px) { .ss-cat-grid { grid-template-columns:repeat(auto-fill,minmax(160px,1fr)) !important; } }
        `}</style>
      </Head>

      <div style={{ minHeight:"100vh", background:C.pageBg, fontFamily:F.body, paddingBottom: comparing.length > 0 || isEmailCaptureActive ? 72 : 0 }}>

        {/* ── NAV ─────────────────────────────────────────────────────── */}
      <nav style={{ background:C.surface, borderBottom:`1px solid ${C.border}`, padding:"0 12px 0 16px", display:"flex", alignItems:"center", justifyContent:"space-between", position:"sticky", top:0, zIndex:40, height:56, boxShadow:"0 1px 8px rgba(0,0,0,0.04)" }}>

        {/* Add this style block inside nav */}
        <style>{`
          .ss-by     { display: none; }
          .ss-crumb  { display: none; }
          .ss-back   { display: none; }
          .ss-scan-full { display: none; }
          .ss-scan-short { display: flex; }
          @media (min-width: 480px) {
            .ss-crumb  { display: flex; align-items: center; gap: 8px; }
            .ss-back   { display: flex; }
            .ss-scan-full  { display: flex; }
            .ss-scan-short { display: none; }
          }
          @media (min-width: 680px) {
            .ss-by { display: inline; }
          }
        `}</style>

        <div style={{ display:"flex", alignItems:"center", gap:8, minWidth:0, overflow:"hidden" }}>
          <button type="button" onClick={() => { setActiveCatSlug(null); router.replace({ pathname:router.pathname, query:{} }, undefined, { shallow:true }); }}
            style={{ display:"flex", alignItems:"center", gap:8, background:"none", border:"none", cursor:"pointer", padding:0, flexShrink:0 }}>
            <div style={{ width:30, height:30, background:C.accent, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
              <span style={{ fontFamily:F.cond, fontSize:14, fontWeight:900, color:"#fff" }}>S</span>
            </div>
            <span style={{ fontFamily:F.cond, fontSize:16, fontWeight:900, letterSpacing:"0.1em", textTransform:"uppercase", color:C.ink }}>SmartStack</span>
          </button>

          {/* Hide "by CheckPeak" below 680px */}
          <span className="ss-by" style={{ fontFamily:F.body, fontSize:11, color:C.muted }}>by CheckPeak</span>

          {/* Hide breadcrumb below 480px */}
          {activeCatLabel && (
            <span className="ss-crumb">
              <span style={{ color:C.ghost, fontSize:14 }}>/</span>
              <span style={{ fontFamily:F.cond, fontSize:13, fontWeight:700, letterSpacing:"0.06em", textTransform:"uppercase", color:C.secondary }}>{activeCatLabel}</span>
            </span>
          )}
          {activeBrandName && (
            <span className="ss-crumb">
              <span style={{ color:C.ghost, fontSize:14 }}>/</span>
              <span style={{ fontFamily:F.cond, fontSize:13, fontWeight:700, letterSpacing:"0.06em", textTransform:"uppercase", color:C.secondary }}>{activeBrandName}</span>
            </span>
          )}
        </div>

        <div style={{ display:"flex", gap:6, alignItems:"center", flexShrink:0 }}>
          {/* ← All Categories: hidden below 480px */}
          {(activeCatLabel || activeBrandName) && (
            <button className="ss-back" type="button"
              onClick={() => { setActiveCatSlug(null); setSearchRaw(""); router.replace({ pathname:router.pathname, query:{} }, undefined, { shallow:true }); }}
              style={{ fontFamily:F.cond, fontSize:11, fontWeight:700, letterSpacing:"0.1em", textTransform:"uppercase", color:C.secondary, padding:"6px 10px", background:"none", border:`1px solid ${C.border}`, cursor:"pointer" }}>
              ← All
            </button>
          )}

          {/* Full label ≥480px */}
          <a className="ss-scan-full" href="/nutrition-label-scanner"
            style={{ alignItems:"center", gap:6, fontFamily:F.cond, fontSize:11, fontWeight:900, letterSpacing:"0.1em", textTransform:"uppercase", color:"#fff", textDecoration:"none", padding:"7px 16px", background:C.accent }}>
            Scan a Label →
          </a>

          {/* Icon-only <480px */}
          <a className="ss-scan-short" href="/nutrition-label-scanner"
            style={{ alignItems:"center", justifyContent:"center", width:36, height:36, background:C.accent, flexShrink:0 }}
            aria-label="Scan a label">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 7V5a2 2 0 012-2h2M17 3h2a2 2 0 012 2v2M21 17v2a2 2 0 01-2 2h-2M7 21H5a2 2 0 01-2-2v-2"/>
              <rect x="7" y="7" width="10" height="10" rx="1"/>
            </svg>
          </a>
        </div>
      </nav>

        {/* ── HERO ────────────────────────────────────────────────────── */}
        <div style={{
          background:`linear-gradient(160deg, ${C.surface} 0%, #EBF4FF 100%)`,
          borderBottom:`1px solid ${C.border}`,
          padding:"clamp(2.5rem, 6vw, 5rem) clamp(1rem, 4vw, 2rem)",
        }}>
          <div style={{ maxWidth:900, margin:"0 auto" }}>
            {/* Eyebrow */}
            <div style={{ display:"flex", alignItems:"center", gap:"0.75rem", marginBottom:"1rem", flexWrap:"wrap" }}>
              <span style={{
                fontFamily:F.cond, fontSize:10, fontWeight:900, letterSpacing:"0.16em",
                textTransform:"uppercase", color:C.accent,
                background:C.accentBg, padding:"3px 12px", border:`1px solid ${C.accentBdr}`,
              }}>
                Independent Analysis · No Sponsored Placements
              </span>
              {!loading && totalCount > 0 && (
                <span style={{ fontFamily:F.cond, fontSize:11, fontWeight:700, letterSpacing:"0.08em", textTransform:"uppercase", color:C.secondary }}>
                  {totalCount} supplements tracked
                </span>
              )}
            </div>

            {/* Headline */}
            <h1 style={{
              fontFamily:F.cond, fontWeight:900, fontStyle:"italic",
              fontSize:"clamp(2.2rem, 7vw, 5rem)",
              lineHeight:0.9, letterSpacing:"-0.02em", textTransform:"uppercase",
              color:C.ink, margin:"0 0 clamp(1rem,2.5vw,1.75rem)",
            }}>
              {activeBrandName
                ? <>{activeBrandName} - <span style={{ color:C.accent }}>ranked by real value</span></>
                : activeCatLabel
                ? <>Best {activeCatLabel} - <span style={{ color:C.accent }}>ranked by cost per serving</span></>
                : <>Stop wasting money.<br /><span style={{ color:C.accent }}>Here's what's actually worth it.</span></>
              }
            </h1>

            <p style={{ fontFamily:F.body, fontSize:"clamp(0.9rem, 2vw, 1.05rem)", color:C.secondary, lineHeight:1.7, maxWidth:"52ch", margin:"0 0 clamp(1.25rem,3vw,2rem)" }}>
              {activeBrandName
                ? `Every ${activeBrandName} product ranked by price-per-serving against the category median. No paid placements. Just data.`
                : activeCatLabel
                ? `We ranked every ${activeCatLabel.toLowerCase()} by real price-per-serving against the category median. No hype. No paid placements.`
                : `We compare pre-workouts, protein powders, vitamins, and more by true cost per serving. Independent rankings updated weekly.`
              }
            </p>

            {/* Trust signal */}
            <div style={{
              display:"inline-flex", alignItems:"center", gap:10,
              padding:"10px 16px", background:C.surface,
              border:`1px solid ${C.border}`, borderLeft:`3px solid ${C.green}`,
              maxWidth:520,
            }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.green} strokeWidth={2.5}><path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" strokeLinecap="round" strokeLinejoin="round"/></svg>
              <p style={{ fontFamily:F.body, fontSize:13, color:C.body, margin:0, lineHeight:1.4 }}>
                Prices checked daily. Pure value-based rankings. No brand pays to be here.
              </p>
            </div>
          </div>
        </div>

        {/* ── MAIN CONTENT ────────────────────────────────────────────── */}
        <div style={{ maxWidth:1100, margin:"0 auto", padding:"0 16px" }}>

          {/* Category + Brand selector (no active cat) */}
          {!loading && !activeCatSlug && (
            <section style={{ marginTop:36 }}>
              <CategorySelector onSelect={handleSelectCat} />
              <BrandSelector onSelect={handleSelectBrand} />
            </section>
          )}

          {/* Best seller + pre-compare */}
          {activeCatSlug && activeCatSlug !== "all" && !loading && (
            <>
              {bestSeller && (
                <section style={{ marginTop:32 }}>
                  <BestSellerStrip stack={bestSeller} stats={stats} catLabel={activeCatLabel} fetchedAt={dataFetchedAt} />
                </section>
              )}
              {preloadedTop3.length >= 2 && (
                <section style={{ marginTop:8 }}>
                  <PreloadedCompare stacks={preloadedTop3} stats={stats} catLabel={activeCatLabel} fetchedAt={dataFetchedAt} onAddToCompare={toggleCompare} comparingIds={comparing.map(s => s.id)} />
                </section>
              )}
            </>
          )}

          {!loading && activeCatSlug && (
            <section style={{ marginTop: activeCatSlug !== "all" ? 0 : 36 }}>
              <ValueExplainer />
            </section>
          )}

          {/* Grid + filters */}
          {activeCatSlug && (
            <section style={{ marginTop:32 }}>
              {/* Section header + search */}
              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:12, marginBottom:16, flexWrap:"wrap" }}>
                <h2 style={{ fontFamily:F.cond, fontSize:"clamp(1.1rem,3vw,1.5rem)", fontWeight:900, fontStyle:"italic", letterSpacing:"0.02em", textTransform:"uppercase", color:C.ink, margin:0 }}>
                  {activeBrandName ? `All ${activeBrandName} Products` : activeCatLabel ? `All ${activeCatLabel}` : "Browse All Supplements"}
                </h2>
                <div style={{ position:"relative", width:"min(100%,240px)" }}>
                  <svg viewBox="0 0 24 24" style={{ position:"absolute", left:10, top:"50%", transform:"translateY(-50%)", width:13, height:13 }} fill="none" stroke={C.secondary} strokeWidth={2.5}>
                    <circle cx="11" cy="11" r="8"/><path strokeLinecap="round" d="m21 21-4.35-4.35"/>
                  </svg>
                  <input type="text" value={searchRaw} onChange={e => setSearchRaw(e.target.value)}
                    placeholder="Search products…"
                    style={{ width:"100%", padding:"8px 10px 8px 32px", border:`1px solid ${C.border}`, fontSize:13, fontFamily:F.body, color:C.ink, background:C.surface, outline:"none" }}
                  />
                  {searchRaw && <button type="button" onClick={() => setSearchRaw("")} style={{ position:"absolute", right:8, top:"50%", transform:"translateY(-50%)", background:"none", border:"none", cursor:"pointer", color:C.secondary }}>✕</button>}
                </div>
              </div>

              {/* Category chips + sort */}
              <div style={{ display:"flex", gap:8, flexWrap:"wrap", alignItems:"center", marginBottom:14 }}>
                <div style={{ display:"flex", gap:4, overflowX:"auto", paddingBottom:2, flex:1, scrollbarWidth:"none", minWidth:0 }}>
                  {CAT_CONFIG.map(c => {
                    const active = activeCatSlug === c.slug;
                    return (
                      <button key={c.slug} type="button" onClick={() => handleSelectCat(c.slug)}
                        style={{ flexShrink:0, padding:"5px 13px", background:active?C.accent:C.surface, border:`1px solid ${active?C.accent:C.border}`, color:active?"#fff":C.secondary, fontFamily:F.cond, fontSize:11, fontWeight:900, letterSpacing:"0.08em", textTransform:"uppercase", cursor:"pointer", transition:"all 0.12s", whiteSpace:"nowrap" }}
                      >
                        {c.emoji} {c.label}
                      </button>
                    );
                  })}
                  <button type="button" onClick={() => handleSelectCat("all")}
                    style={{ flexShrink:0, padding:"5px 13px", background:activeCatSlug==="all"?C.accent:C.surface, border:`1px solid ${activeCatSlug==="all"?C.accent:C.border}`, color:activeCatSlug==="all"?"#fff":C.secondary, fontFamily:F.cond, fontSize:11, fontWeight:900, letterSpacing:"0.08em", textTransform:"uppercase", cursor:"pointer", whiteSpace:"nowrap" }}>
                    All
                  </button>
                </div>
                <div style={{ display:"flex", alignItems:"center", gap:6, flexShrink:0 }}>
                  <span style={{ fontFamily:F.cond, fontSize:11, fontWeight:700, letterSpacing:"0.1em", textTransform:"uppercase", color:C.secondary }}>Sort:</span>
                  <select value={sortBy} onChange={e => setSortBy(e.target.value)}
                    style={{ padding:"5px 10px", border:`1px solid ${C.border}`, fontSize:12, fontFamily:F.body, color:C.ink, background:C.surface, cursor:"pointer", outline:"none" }}
                  >
                    {SORT_OPTIONS.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
                  </select>
                </div>
              </div>

              {!loading && (
                <p style={{ fontFamily:F.cond, fontSize:11, fontWeight:700, letterSpacing:"0.1em", textTransform:"uppercase", color:C.secondary, marginBottom:14 }}>
                  {filtered.length} result{filtered.length !== 1 ? "s" : ""}
                  {activeBrandName ? ` · ${activeBrandName}` : activeCatLabel && activeCatSlug !== "all" ? ` · ${activeCatLabel}` : ""}
                  {searchQuery && !activeBrandName ? ` matching "${searchQuery}"` : ""}
                </p>
              )}

              {/* Loading skeleton */}
              {loading && (
                <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(180px,1fr))", gap:1, background:C.border }}>
                  {Array.from({ length:12 }).map((_,i) => (
                    <div key={i} style={{ background:C.surface }}>
                      <div style={{ background:C.raised, aspectRatio:"1/1" }} />
                      <div style={{ padding:10 }}>
                        <div style={{ background:C.raised, height:12, marginBottom:8, width:"80%" }} />
                        <div style={{ background:C.raised, height:14, marginBottom:8, width:"45%" }} />
                        <div style={{ background:"#FDE68A", height:30 }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {loadError && (
                <div style={{ padding:20, background:C.redBg, border:`1px solid ${C.redBdr}`, color:C.red, fontSize:13, textAlign:"center", fontFamily:F.body }}>
                  {loadError}
                </div>
              )}

              {!loading && !loadError && (
                <>
                  {gridStacks.length > 0 ? (
                    <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(180px,1fr))", gap:1, background:C.border }}>
                      {gridStacks.map(stack => {
                        const rankInfo = valueRankMap.get(stack.id);
                        return (
                          <GridCard
                            key={stack.id}
                            stack={stack}
                            stats={stats}
                            onCompare={toggleCompare}
                            isComparing={Boolean(comparing.find(s => s.id === stack.id))}
                            valueTier={getValueTier(getValueScore(stack, stats))}
                            pps={getPPS(stack)}
                            rank={rankInfo?.rank ?? null}
                            totalInCat={rankInfo?.total ?? null}
                          />
                        );
                      })}
                    </div>
                  ) : (
                    <div style={{ padding:"60px 20px", textAlign:"center", background:C.surface, border:`1px solid ${C.border}` }}>
                      <p style={{ fontFamily:F.cond, fontSize:18, fontStyle:"italic", textTransform:"uppercase", color:C.secondary, margin:"0 0 8px" }}>No results</p>
                      <p style={{ fontFamily:F.body, fontSize:13, color:C.muted, margin:"0 0 16px" }}>Try a different category or clear your search.</p>
                      <button type="button" onClick={() => setSearchRaw("")}
                        style={{ padding:"8px 20px", background:C.accent, color:"#fff", border:"none", fontFamily:F.cond, fontSize:12, fontWeight:900, letterSpacing:"0.1em", textTransform:"uppercase", cursor:"pointer" }}>
                        Clear search
                      </button>
                    </div>
                  )}

                  {canLoadMore && (
                    <div style={{ display:"flex", justifyContent:"center", marginTop:32 }}>
                      <button type="button" onClick={() => setLimit(v => v + 24)}
                        style={{ padding:"10px 28px", background:C.surface, border:`1.5px solid ${C.accent}`, color:C.accent, fontFamily:F.cond, fontSize:12, fontWeight:900, letterSpacing:"0.1em", textTransform:"uppercase", cursor:"pointer", transition:"all 0.12s" }}
                        onMouseEnter={e => { e.currentTarget.style.background=C.accent; e.currentTarget.style.color="#fff"; }}
                        onMouseLeave={e => { e.currentTarget.style.background=C.surface; e.currentTarget.style.color=C.accent; }}
                      >
                        Load more ({filtered.length - visibleLimit} remaining)
                      </button>
                    </div>
                  )}

                  {!canLoadMore && gridStacks.length > 0 && (
                    <p style={{ textAlign:"center", marginTop:32, fontFamily:F.cond, fontSize:11, fontWeight:700, letterSpacing:"0.12em", textTransform:"uppercase", color:C.ghost }}>
                      All {filtered.length} shown
                    </p>
                  )}
                </>
              )}
            </section>
          )}

          {/* Manual compare result */}
          {comparing.length >= 2 && (
            <section style={{ marginTop:12 }}>
              <ManualCompareTable stacks={comparing} stats={stats} onRemove={removeFromCompare} />
            </section>
          )}

          {/* CTA closer */}
          {activeCatSlug && (
            <section style={{ marginTop:56, marginBottom:48, padding:"clamp(2rem,4vw,3rem)", background:C.ink, textAlign:"center" }}>
              <p style={{ fontFamily:F.cond, fontWeight:900, fontStyle:"italic", fontSize:"clamp(1.2rem,4vw,2rem)", letterSpacing:"-0.01em", textTransform:"uppercase", color:"#fff", margin:"0 0 0.75rem" }}>
                Serious about your supplements?
              </p>
              <p style={{ fontFamily:F.body, fontSize:14, color:"rgba(255,255,255,0.55)", margin:"0 0 1.5rem", lineHeight:1.7, maxWidth:480, marginLeft:"auto", marginRight:"auto" }}>
                CheckPeak helps you track nutrition, manage workouts, and scan supplements for banned substances - all in one place.
              </p>
              <div style={{ display:"flex", gap:12, justifyContent:"center", flexWrap:"wrap" }}>
                <a href="/dashboard" style={{ display:"inline-flex", alignItems:"center", gap:8, padding:"12px 24px", background:C.accent, color:"#fff", fontFamily:F.cond, fontSize:13, fontWeight:900, letterSpacing:"0.1em", textTransform:"uppercase", textDecoration:"none", transition:"filter 0.2s" }}
                  onMouseEnter={e => { e.currentTarget.style.filter="brightness(1.1)"; }}
                  onMouseLeave={e => { e.currentTarget.style.filter="none"; }}
                >
                  Get started free →
                </a>
                <a href="/nutrition-label-scanner" style={{ display:"inline-flex", alignItems:"center", gap:8, padding:"12px 24px", background:"transparent", color:"rgba(255,255,255,0.65)", fontFamily:F.cond, fontSize:13, fontWeight:700, letterSpacing:"0.1em", textTransform:"uppercase", textDecoration:"none", border:`1px solid rgba(255,255,255,0.2)` }}>
                  Scan your supplements
                </a>
              </div>
            </section>
          )}

        </div>

        <ComparePanel stacks={comparing} onRemove={removeFromCompare} onClear={clearCompare} onScrollToTable={scrollToManual} />
        {isEmailCaptureActive && activeCatSlug && <EmailCaptureStrip activeCatLabel={activeCatLabel} />}
      </div>
    </>
  );
}