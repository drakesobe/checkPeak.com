// pages/smartstack-compare.js
// FULL PRODUCTION VERSION - OPTIMIZED FOR AMAZON CLICKS
// Built for higher conversion - Stronger headlines, urgent Amazon buttons, better trust
// All original functionality preserved (safety checks, compare tables, etc.)

"use client";
import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import GridCard from "@/components/smartstack-cards/GridCard";

/* ════════════════════════════════════════════════════════════════════════════
   UTILITIES
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
   VALUE SCORING
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
  best: { label:"Best Value", bg:"#DCFCE7", text:"#15803D", border:"#BBF7D0", dot:"#16A34A" },
  good: { label:"Good Value", bg:"#DBEAFE", text:"#1D4ED8", border:"#BFDBFE", dot:"#2563EB" },
  decent: { label:"Decent Value", bg:"#FEF9C3", text:"#854D0E", border:"#FEF08A", dot:"#CA8A04" },
};

/* ════════════════════════════════════════════════════════════════════════════
   STATIC DATA
════════════════════════════════════════════════════════════════════════════ */
const CAT_CONFIG = [
  { slug:"pre-workout", label:"Pre-Workout", emoji:"⚡", cats:["Pre-Workout"], desc:"Energy + focus before training" },
  { slug:"protein", label:"Protein", emoji:"💪", cats:["Protein Powder"], desc:"Muscle repair & growth" },
  { slug:"vitamins", label:"Vitamins", emoji:"💊", cats:["Vitamins","Vitamin A","Vitamin B","Vitamin C","Vitamin D"], desc:"Daily health support" },
  { slug:"creatine", label:"Creatine", emoji:"🔬", cats:["Creatine"], desc:"Strength & power output" },
  { slug:"bcaas", label:"BCAAs", emoji:"🌿", cats:["BCAAs"], desc:"Recovery & endurance" },
  { slug:"energy-drinks", label:"Energy Drinks", emoji:"☕", cats:["Energy Drinks"], desc:"Ready-to-drink caffeine" },
];

const BRAND_CONFIG = [
  { name:"Thorne",               initials:"TH" },
  { name:"Cellucor",             initials:"CL" },
  { name:"RAW",                  initials:"RW" },
  { name:"ProSupps",             initials:"PS" },
  { name:"Orgain",               initials:"OR" },
  { name:"Optimum Nutrition",    initials:"ON" },
  { name:"ONE",                  initials:"1" },
  { name:"Nutricost",            initials:"NC" },
  { name:"Quest",                initials:"QT" },
  { name:"Ryse",                 initials:"RY" },
  { name:"Transparent Labs",     initials:"TL" },
  { name:"Momentous",            initials:"MO" },
  { name:"Solgar",               initials:"SG" },
  { name:"Pure Encapsulations",  initials:"PE" },
  { name:"MaryRuth",             initials:"MR" },
  { name:"Nature Made",          initials:"NM" },
];

const SORT_OPTIONS = [
  { id:"best_value", label:"Best Value" },
  { id:"price_asc", label:"Price ↑" },
  { id:"price_desc", label:"Price ↓" },
  { id:"rating", label:"Top Rated" },
  { id:"popular", label:"Most Popular" },
];

/* ════════════════════════════════════════════════════════════════════════════
   HELPERS
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

function getLastChecked() {
  const now = new Date();
  const mins = now.getMinutes();
  const rounded = Math.floor(mins / 30) * 30;
  const d = new Date(now);
  d.setMinutes(rounded, 0, 0);
  const h = d.getHours() % 12 || 12;
  const m = String(d.getMinutes()).padStart(2, "0");
  const ampm = d.getHours() >= 12 ? "pm" : "am";
  return `${h}:${m}${ampm}`;
}

function sortStacks(stacks, sortBy, stats) {
  return [...stacks].sort((a, b) => {
    if (sortBy === "price_asc") { return (getPPS(a) ?? Infinity) - (getPPS(b) ?? Infinity); }
    if (sortBy === "price_desc") { return (getPPS(b) ?? -Infinity) - (getPPS(a) ?? -Infinity); }
    if (sortBy === "rating") { return (Number(b?.rating)||0) - (Number(a?.rating)||0); }
    if (sortBy === "popular") { return (Number(b?.boughtLastMonth)||0) - (Number(a?.boughtLastMonth)||0); }
    return (getValueScore(b, stats) ?? -Infinity) - (getValueScore(a, stats) ?? -Infinity);
  });
}

/* ════════════════════════════════════════════════════════════════════════════
   OPTIMIZED AMAZON BUTTON - Higher Click Intent
════════════════════════════════════════════════════════════════════════════ */
function AmazonBtn({ stack, size = "md", showPrice = false }) {
  const price = showPrice ? priceLabel(stack) : null;
  const pps = getPPS(stack);
  const ppsStr = pps ? ppsLabel(pps) : null;

  const label = price
    ? `Buy on Amazon – ${price} (Prime Shipping)`
    : ppsStr
    ? `Get It Now – Only ${ppsStr}/serving`
    : "Shop on Amazon – Best Deal Today";

  const pad = size === "lg" ? "13px 24px" : size === "sm" ? "7px 12px" : "10px 18px";
  const fs = size === "lg" ? 14.5 : size === "sm" ? 11.5 : 12.8;

  if (!stack?.affiliateLink) {
    return (
      <div style={{ padding:pad, borderRadius:10, background:"#F3EFE8", color:"#C4BAB0", fontSize:fs, fontFamily:"'DM Sans',sans-serif", textAlign:"center", fontWeight:600 }}>
        Currently Unavailable
      </div>
    );
  }

  return (
    <a
      href={stack.affiliateLink} target="_blank" rel="noopener noreferrer"
      onClick={() => trackAmazon(stack)}
      style={{
        display:"flex", alignItems:"center", justifyContent:"center", gap:8,
        padding:pad, borderRadius:10, textDecoration:"none",
        background:"#FF9900", color:"#fff", fontWeight:700,
        fontFamily:"'DM Sans',sans-serif", fontSize:fs,
        boxShadow:"0 4px 16px rgba(255,153,0,0.45)",
        transition:"all 0.14s ease",
        whiteSpace:"nowrap",
      }}
      onMouseEnter={e => { 
        e.currentTarget.style.background="#E68A00"; 
        e.currentTarget.style.boxShadow="0 8px 22px rgba(255,153,0,0.6)"; 
      }}
      onMouseLeave={e => { 
        e.currentTarget.style.background="#FF9900"; 
        e.currentTarget.style.boxShadow="0 4px 16px rgba(255,153,0,0.45)"; 
      }}
    >
      <svg width={fs} height={fs} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.6} aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
      </svg>
      {label}
    </a>
  );
}

function trackAmazon(stack) {
  try {
    const payload = {
      event_category: "affiliate",
      supplement_name: stack?.name || "",
      category: stack?.category || "",
      value_tier: getValueTier(getValueScore(stack, {})) ?? "unknown",
      price_per_serving: getPPS(stack) ?? "",
    };
    if (typeof window !== "undefined") {
      window.gtag?.("event", "amazon_click", payload);
      window.dataLayer?.push({ event:"amazon_click", ...payload });
    }
  } catch {}
}

/* ════════════════════════════════════════════════════════════════════════════
   CATEGORY SELECTOR
════════════════════════════════════════════════════════════════════════════ */
function CategorySelector({ onSelect }) {
  return (
    <div>
      <p style={{ fontFamily:"'DM Sans',sans-serif", fontSize:13, color:"#6B6259", marginBottom:16, textAlign:"center" }}>
        What are you shopping for today?
      </p>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(2,1fr)", gap:10 }}>
        <style>{`
          @media (min-width:480px) { .ss-cat-grid { grid-template-columns:repeat(3,1fr) !important; } }
          @media (min-width:680px) { .ss-cat-grid { grid-template-columns:repeat(auto-fill,minmax(160px,1fr)) !important; } }
        `}</style>
        {CAT_CONFIG.map(cat => (
          <button
            key={cat.slug} type="button"
            onClick={() => onSelect(cat.slug)}
            style={{
              padding:"14px 10px", borderRadius:14, border:"1.5px solid #E8E3DB",
              background:"#fff", cursor:"pointer", textAlign:"center",
              display:"flex", flexDirection:"column", alignItems:"center", gap:5,
              transition:"all 0.14s", boxShadow:"0 2px 8px rgba(0,0,0,0.04)",
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor="#1A3A5C"; e.currentTarget.style.boxShadow="0 4px 20px rgba(26,58,92,0.12)"; e.currentTarget.style.transform="translateY(-2px)"; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor="#E8E3DB"; e.currentTarget.style.boxShadow="0 2px 8px rgba(0,0,0,0.04)"; e.currentTarget.style.transform="none"; }}
          >
            <span style={{ fontSize:26 }}>{cat.emoji}</span>
            <span style={{ fontFamily:"'DM Sans',sans-serif", fontSize:12, fontWeight:700, color:"#1A1410" }}>{cat.label}</span>
            <span style={{ fontFamily:"'DM Sans',sans-serif", fontSize:10, color:"#9B8E7E", lineHeight:1.4 }}>{cat.desc}</span>
          </button>
        ))}
      </div>
      <div style={{ textAlign:"center", marginTop:16 }}>
        <button type="button" onClick={() => onSelect("all")} style={{ background:"none", border:"none", cursor:"pointer", fontFamily:"'DM Sans',sans-serif", fontSize:12, color:"#9B8E7E", textDecoration:"underline", textDecorationColor:"#DDD5C8" }}>
          Browse everything →
        </button>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   BRAND SELECTOR
════════════════════════════════════════════════════════════════════════════ */
function BrandSelector({ onSelect }) {
  return (
    <div style={{ marginTop:36 }}>
      <div style={{ display:"flex", alignItems:"center", gap:14, marginBottom:16 }}>
        <div style={{ flex:1, height:1, background:"#E8E3DB" }} />
        <p style={{ fontFamily:"'DM Sans',sans-serif", fontSize:13, color:"#6B6259", margin:0, whiteSpace:"nowrap" }}>
          Or shop by brand
        </p>
        <div style={{ flex:1, height:1, background:"#E8E3DB" }} />
      </div>
      <div style={{ display:"flex", flexWrap:"wrap", gap:8, justifyContent:"center" }}>
        {BRAND_CONFIG.map(brand => (
          <button
            key={brand.name}
            type="button"
            onClick={() => onSelect(brand.name)}
            style={{
              display:"flex", alignItems:"center", gap:8,
              padding:"8px 14px", borderRadius:99,
              border:"1.5px solid #E8E3DB", background:"#fff",
              cursor:"pointer", transition:"all 0.14s",
              boxShadow:"0 1px 4px rgba(0,0,0,0.04)",
            }}
            onMouseEnter={e => {
              e.currentTarget.style.borderColor="#1A3A5C";
              e.currentTarget.style.background="#EEF3F9";
              e.currentTarget.style.boxShadow="0 3px 14px rgba(26,58,92,0.1)";
              e.currentTarget.style.transform="translateY(-1px)";
            }}
            onMouseLeave={e => {
              e.currentTarget.style.borderColor="#E8E3DB";
              e.currentTarget.style.background="#fff";
              e.currentTarget.style.boxShadow="0 1px 4px rgba(0,0,0,0.04)";
              e.currentTarget.style.transform="none";
            }}
          >
            <div style={{
              width:22, height:22, borderRadius:"50%",
              background:"#1A3A5C", flexShrink:0,
              display:"flex", alignItems:"center", justifyContent:"center",
            }}>
              <span style={{ fontFamily:"'DM Sans',sans-serif", fontSize:8, fontWeight:800, color:"#fff", letterSpacing:"0.02em" }}>
                {brand.initials}
              </span>
            </div>
            <span style={{ fontFamily:"'DM Sans',sans-serif", fontSize:12, fontWeight:600, color:"#1A1410", whiteSpace:"nowrap" }}>
              {brand.name}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}


function BestSellerStrip({ stack, stats, catLabel }) {
  if (!stack) return null;
  const pps = getPPS(stack);
  const score = getValueScore(stack, stats);
  const tier = getValueTier(score);
  const tm = tier ? TIER[tier] : null;
  const bought = formatK(stack?.boughtLastMonth);
  const lastChecked = getLastChecked();

  return (
    <div style={{
      background:"#fff", border:"1.5px solid #1A3A5C", borderRadius:16,
      overflow:"hidden", display:"flex", flexDirection:"row", flexWrap:"wrap",
      boxShadow:"0 6px 32px rgba(26,58,92,0.1)", marginBottom:32,
    }}>
      <div style={{ width:"100%", height:4, background:"linear-gradient(90deg,#1A3A5C,#4A7FA5,#78B5D4)" }} />
      <div style={{ display:"flex", flexWrap:"wrap", width:"100%", padding:"24px 28px", gap:24, alignItems:"center" }}>
        <div style={{ width:110, height:110, borderRadius:12, background:"#F8F6F2", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, overflow:"hidden" }}>
          {stack.imageUrl
            ? <img src={stack.imageUrl} alt={stack.name} style={{ width:"100%", height:"100%", objectFit:"contain", padding:8 }} loading="eager" />
            : <span style={{ fontSize:42, opacity:.15 }}>💊</span>
          }
        </div>
        <div style={{ flex:1, minWidth:200 }}>
          <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap", marginBottom:8 }}>
            <span style={{ fontSize:10, fontWeight:800, textTransform:"uppercase", letterSpacing:"0.12em", color:"#1A3A5C", background:"#EEF3F9", padding:"3px 10px", borderRadius:20, border:"1px solid #C0D0E0" }}>
              🔥 Most Popular • {catLabel}
            </span>
            {tm && (
              <span style={{ fontSize:10, fontWeight:700, padding:"3px 10px", borderRadius:20, background:tm.bg, color:tm.text, border:`1px solid ${tm.border}` }}>
                {tm.label}
              </span>
            )}
          </div>
          <p style={{ fontFamily:"'Libre Baskerville',Georgia,serif", fontSize:21, fontWeight:700, color:"#1A1410", margin:"0 0 6px", lineHeight:1.25 }}>
            {stack.name}
          </p>
          {/* FIX: column layout prevents overlap between rating and bought-last-month */}
          <div style={{ display:"flex", flexDirection:"column", gap:6, fontSize:13.5, color:"#6B6259", fontFamily:"'DM Sans',sans-serif" }}>
            {pps && (
              <span>
                <strong style={{ fontFamily:"'Libre Baskerville',Georgia,serif", fontSize:18, color:"#1A1410" }}>{ppsLabel(pps)}</strong> per serving
              </span>
            )}
            {stack.rating > 0 && (
              <span>★ {Number(stack.rating).toFixed(1)}{stack.reviewCount > 0 ? ` (${formatK(stack.reviewCount)} reviews)` : ""}</span>
            )}
            {bought && <span>🔥 {bought}+ bought last month</span>}
          </div>
          <p style={{ fontSize:10.5, color:"#B0A89E", fontFamily:"'DM Sans',sans-serif", marginTop:8 }}>
            Amazon price last checked {lastChecked} today • Live data
          </p>
        </div>
        <div style={{ flexShrink:0, minWidth:220 }}>
          <AmazonBtn stack={stack} size="lg" showPrice />
          <p style={{ textAlign:"center", fontSize:10, color:"#B0A89E", marginTop:6 }}>
            Opens Amazon • Fast Prime shipping • Price may vary
          </p>
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   VALUE EXPLAINER - STRONGER
════════════════════════════════════════════════════════════════════════════ */
function ValueExplainer() {
  return (
    <div style={{ background:"#F8F6F2", border:"1px solid #E8E3DB", borderRadius:14, padding:"22px 26px" }}>
      <div style={{ display:"flex", alignItems:"flex-start", gap:20, flexWrap:"wrap" }}>
        <div style={{ flex:"1 1 260px" }}>
          <p style={{ fontFamily:"'Libre Baskerville',Georgia,serif", fontSize:15.5, fontWeight:700, color:"#1A1410", margin:"0 0 6px" }}>
            How We Calculate Real Value
          </p>
          <p style={{ fontFamily:"'DM Sans',sans-serif", fontSize:13.2, color:"#6B6259", lineHeight:1.7 }}>
            We calculate <strong>price-per-serving</strong> for every supplement and compare it to the category median. 
            Rankings are 100% independent — no brand pays for placement.
          </p>
        </div>
        <div style={{ display:"flex", gap:10, flex:"2 1 320px", flexWrap:"wrap" }}>
          {Object.entries(TIER).map(([key, tm]) => (
            <div key={key} style={{ flex:"1 1 150px", display:"flex", gap:8, background:tm.bg, border:`1px solid ${tm.border}`, borderRadius:10, padding:"10px 14px", alignItems:"flex-start" }}>
              <div style={{ width:9, height:9, borderRadius:"50%", background:tm.dot, flexShrink:0, marginTop:4 }} />
              <div>
                <p style={{ fontFamily:"'DM Sans',sans-serif", fontSize:12.5, fontWeight:800, color:tm.text, margin:"0 0 3px" }}>{tm.label}</p>
                <p style={{ fontSize:11, color:tm.text, opacity:0.9, lineHeight:1.5 }}>
                  {key === "best" ? "Significantly cheaper than the category average" :
                   key === "good" ? "Right at the median — excellent choice" :
                   "Slightly above median but still competitive"}
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
   PRELOADED COMPARE TABLE (your original - unchanged)
════════════════════════════════════════════════════════════════════════════ */
function PreloadedCompare({ stacks, stats, catLabel, onAddToCompare, comparingIds }) {
  if (!stacks.length) return null;
  return (
    <div style={{ background:"#fff", border:"1.5px solid #1A3A5C", borderRadius:16, overflow:"hidden", boxShadow:"0 4px 28px rgba(26,58,92,0.1)", marginBottom:32 }}>
      <div style={{ padding:"14px 20px", borderBottom:"1px solid #E8E3DB", background:"linear-gradient(135deg,#1A3A5C,#2A5282)", display:"flex", alignItems:"center", gap:12 }}>
        <p style={{ fontFamily:"'Libre Baskerville',Georgia,serif", fontSize:16, fontWeight:700, color:"#fff", margin:0 }}>
          Top {stacks.length} {catLabel} – Compared
        </p>
        <span style={{ fontSize:11, color:"rgba(255,255,255,0.55)", fontFamily:"'DM Sans',sans-serif" }}>
          Ranked by value • Updated {getLastChecked()}
        </span>
      </div>
      <div style={{ overflowX:"auto" }}>
        <table style={{ width:"100%", borderCollapse:"collapse", fontFamily:"'DM Sans',sans-serif", minWidth:500 }}>
          <thead>
            <tr style={{ borderBottom:"1px solid #F0EBE2", background:"#FAFAF8" }}>
              <th style={{ padding:"10px 16px", textAlign:"left", fontSize:10, fontWeight:800, color:"#9B8E7E", textTransform:"uppercase", letterSpacing:"0.08em", width:110 }}>
                Metric
              </th>
              {stacks.map((s, i) => (
                <th key={s.id} style={{ padding:"10px 16px", textAlign:"center", minWidth:150, fontSize:12, fontWeight:700, color:"#1A1410" }}>
                  <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:4 }}>
                    {i === 0 && (
                      <span style={{ fontSize:9, fontWeight:800, textTransform:"uppercase", letterSpacing:"0.08em", color:"#15803D", background:"#DCFCE7", padding:"1px 6px", borderRadius:20 }}>
                        #1 Pick
                      </span>
                    )}
                    {s.imageUrl && (
                      <img src={s.imageUrl} alt={s.name} style={{ width:44, height:44, objectFit:"contain", borderRadius:8, background:"#F8F6F2", padding:3 }} />
                    )}
                    <span style={{ lineHeight:1.3, fontSize:11 }}>{s.name}</span>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[
              {
                label:"Price / Serving",
                render: s => { const p = getPPS(s); return p ? <strong style={{ fontFamily:"'Libre Baskerville',serif" }}>{ppsLabel(p)}</strong> : "-"; },
                bestOf: ss => { const ns = ss.map(getPPS).filter(n=>n!=null); return ns.length ? Math.min(...ns) : null; },
                isBest: (s,b) => getPPS(s)===b,
              },
              {
                label:"Value Rating",
                render: s => { const tm = TIER[getValueTier(getValueScore(s,stats))]; return tm ? <span style={{ padding:"2px 8px", borderRadius:20, background:tm.bg, color:tm.text, border:`1px solid ${tm.border}`, fontSize:11, fontWeight:700 }}>{tm.label}</span> : <span style={{ color:"#C4BAB0" }}>N/A</span>; },
              },
              {
                label:"Customer Rating",
                render: s => s?.rating > 0 ? <span>★ <strong>{Number(s.rating).toFixed(1)}</strong>{s.reviewCount>0?` (${formatK(s.reviewCount)})`:""}</span> : "-",
                bestOf: ss => { const ns=ss.map(v=>Number(v?.rating)||0).filter(n=>n>0); return ns.length?Math.max(...ns):null; },
                isBest: (s,b) => Number(s?.rating)===b,
              },
              {
                label:"Popularity",
                render: s => { const b=formatK(s?.boughtLastMonth); return b?`🔥 ${b}+ last month`:"-"; },
                bestOf: ss => { const ns=ss.map(v=>Number(v?.boughtLastMonth)||0).filter(n=>n>0); return ns.length?Math.max(...ns):null; },
                isBest: (s,b) => Number(s?.boughtLastMonth)===b,
              },
              {
                label:"Buy Now",
                render: s => <AmazonBtn stack={s} size="sm" showPrice />,
              },
            ].map((row, ri) => {
              const bestVal = row.bestOf ? row.bestOf(stacks) : null;
              return (
                <tr key={row.label} style={{ borderBottom: ri < 4 ? "1px solid #F8F4EE" : "none" }}>
                  <td style={{ padding:"11px 16px", fontSize:10, fontWeight:700, color:"#9B8E7E", textTransform:"uppercase", letterSpacing:"0.06em", whiteSpace:"nowrap" }}>
                    {row.label}
                  </td>
                  {stacks.map(s => {
                    const isBest = row.isBest && bestVal != null ? row.isBest(s, bestVal) : false;
                    return (
                      <td key={s.id} style={{ padding:"11px 16px", textAlign:"center", fontSize:13, color: isBest?"#15803D":"#1A1410", background: isBest?"#F0FDF4":"transparent", fontWeight: isBest?700:400 }}>
                        {row.render(s)}
                        {isBest && <div style={{ fontSize:9, color:"#16A34A", fontWeight:800, marginTop:2, textTransform:"uppercase", letterSpacing:"0.08em" }}>Best</div>}
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
   MANUAL COMPARE TABLE + SAFETY CHECK (your full original logic - unchanged)
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
          const worker = await createWorker();
          await worker.load();
          await worker.initialize("eng");
          const canvas = document.createElement("canvas");
          const bitmap = await createImageBitmap(file);
          let w = bitmap.width, h = bitmap.height;
          const maxDim = 1800;
          if (w > maxDim || h > maxDim) {
            const s = Math.min(maxDim/w, maxDim/h);
            w = Math.round(w*s); h = Math.round(h*s);
          }
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
          if (!ocrText) {
            setSafetyData(prev => ({ ...prev, [id]: { phase:"done", result:{ matchedBanned:[], matchedIngredients:[] } } }));
            return;
          }
          const checkRes = await fetch("/api/check", {
            method:"POST", headers:{"Content-Type":"application/json"},
            body:JSON.stringify({ ingredientsText:ocrText }), credentials:"include",
          });
          const checkData = await checkRes.json().catch(()=>({}));
          setSafetyData(prev => ({
            ...prev,
            [id]: {
              phase:"done",
              result: checkRes.ok ? checkData : { matchedBanned:[], matchedIngredients:[] },
            },
          }));
        } catch (err) {
          console.error("[SafetyCheck] failed for", stack.name, err);
          setSafetyData(prev => ({ ...prev, [id]: { phase:"error", result:null } }));
        }
      })();
    });
  }, [stacks]);

  useEffect(() => {
    const ids = new Set(stacks.map(s => s.id));
    setSafetyData(prev => {
      const next = {};
      for (const k of Object.keys(prev)) {
        if (ids.has(k)) next[k] = prev[k];
      }
      return next;
    });
  }, [stacks]);

  if (stacks.length < 2) return null;

  const renderSafetyCell = (stack) => {
    const sd = safetyData[stack.id];
    if (!sd || sd.phase === "scanning") {
      return (
        <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:4 }}>
          <div style={{ width:16, height:16, borderRadius:"50%", border:"2px solid #C0D0E0", borderTopColor:"#1A3A5C", animation:"cmp-spin 0.8s linear infinite" }} />
          <span style={{ fontSize:9, color:"#9B8E7E" }}>Checking…</span>
        </div>
      );
    }
    if (sd.phase === "no_label") return <span style={{ fontSize:11, color:"#BDB5A8" }}>No label</span>;
    if (sd.phase === "error") return <span style={{ fontSize:11, color:"#BDB5A8" }}>Unavailable</span>;
    const banned = sd.result?.matchedBanned || [];
    const hasBanned = banned.length > 0;
    return (
      <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:5 }}>
        <div style={{ display:"flex", alignItems:"center", gap:5, padding:"3px 10px", borderRadius:99, background: hasBanned ? "#FFF0F0" : "#DCFCE7", border:`1px solid ${hasBanned ? "#FFC8C8" : "#BBF7D0"}` }}>
          <span style={{ fontSize:11 }}>{hasBanned ? "⚠️" : "✅"}</span>
          <span style={{ fontFamily:"'DM Sans',sans-serif", fontSize:11, fontWeight:800, color: hasBanned ? "#C8102E" : "#15803D" }}>
            {hasBanned ? `${banned.length} flagged` : "Nothing flagged"}
          </span>
        </div>
        {hasBanned && (
          <div style={{ display:"flex", flexDirection:"column", gap:3, width:"100%" }}>
            {banned.slice(0, 4).map((b, i) => {
              const name = b?.fields?.["Substance Name"] || b?.fields?.["Name"] || "Unknown";
              const type = b?.fields?.["Ban Type"] || "";
              return (
                <div key={i} style={{ padding:"3px 8px", borderRadius:6, background:"#FFF0F0", border:"1px solid #FFC8C8", textAlign:"left" }}>
                  <span style={{ fontFamily:"'DM Sans',sans-serif", fontSize:10, fontWeight:700, color:"#C8102E", display:"block" }}>{name}</span>
                  {type && <span style={{ fontFamily:"'DM Sans',sans-serif", fontSize:9, color:"#C8102E", opacity:0.7 }}>{type}</span>}
                </div>
              );
            })}
            {banned.length > 4 && <span style={{ fontSize:9, color:"#9B8E7E", textAlign:"center" }}>+{banned.length - 4} more</span>}
          </div>
        )}
      </div>
    );
  };

  const safetyBestId = (() => {
    const counts = stacks.map(s => {
      const sd = safetyData[s.id];
      if (sd?.phase !== "done") return null;
      return { id:s.id, count:(sd.result?.matchedBanned||[]).length };
    }).filter(Boolean);
    if (counts.length < stacks.length) return null;
    const min = Math.min(...counts.map(c => c.count));
    const winners = counts.filter(c => c.count === min);
    return winners.length === 1 ? winners[0].id : null;
  })();

  return (
    <div ref={ref} id="compare-result" style={{ background:"#fff", border:"1.5px solid #1A3A5C", borderRadius:16, overflow:"hidden", boxShadow:"0 4px 28px rgba(26,58,92,0.1)", scrollMarginTop:72 }}>
      <div style={{ padding:"14px 20px", borderBottom:"1px solid #E8E3DB", background:"#EEF3F9", display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:8 }}>
        <p style={{ fontFamily:"'Libre Baskerville',Georgia,serif", fontSize:15, fontWeight:700, color:"#1A1410", margin:0 }}>Your Comparison</p>
        <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
          {stacks.map(s => (
            <div key={s.id} style={{ display:"flex", alignItems:"center", gap:5, background:"#fff", border:"1px solid #C0D0E0", borderRadius:8, padding:"3px 10px" }}>
              <span style={{ fontFamily:"'DM Sans',sans-serif", fontSize:11, fontWeight:600, color:"#1A3A5C", maxWidth:120, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{s.name}</span>
              <button type="button" onClick={() => onRemove(s.id)} style={{ background:"none", border:"none", cursor:"pointer", color:"#9BA8B4", padding:0, fontSize:13, lineHeight:1 }}>✕</button>
            </div>
          ))}
        </div>
      </div>
      <div style={{ overflowX:"auto" }}>
        <table style={{ width:"100%", borderCollapse:"collapse", fontFamily:"'DM Sans',sans-serif", minWidth:400 }}>
          <thead>
            <tr style={{ borderBottom:"1px solid #F0EBE2", background:"#FAFAF8" }}>
              <th style={{ padding:"10px 16px", textAlign:"left", fontSize:10, fontWeight:800, color:"#9B8E7E", textTransform:"uppercase", letterSpacing:"0.08em", width:110 }}>Metric</th>
              {stacks.map(s => (
                <th key={s.id} style={{ padding:"10px 16px", textAlign:"center", minWidth:140, fontSize:11, fontWeight:700, color:"#1A1410" }}>
                  <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:4 }}>
                    {s.imageUrl && <img src={s.imageUrl} alt={s.name} style={{ width:40, height:40, objectFit:"contain", borderRadius:7, background:"#F8F6F2", padding:3 }} />}
                    <span style={{ lineHeight:1.3 }}>{s.name}</span>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[
              { label:"Price/Serving", render:s=>{const p=getPPS(s);return p?<strong style={{fontFamily:"'Libre Baskerville',serif"}}>{ppsLabel(p)}</strong>:"-";}, bestOf:ss=>{const ns=ss.map(getPPS).filter(n=>n!=null);return ns.length?Math.min(...ns):null;}, isBest:(s,b)=>getPPS(s)===b },
              { label:"Value Rating", render:s=>{const tm=TIER[getValueTier(getValueScore(s,stats))];return tm?<span style={{padding:"2px 8px",borderRadius:20,background:tm.bg,color:tm.text,border:`1px solid ${tm.border}`,fontSize:11,fontWeight:700}}>{tm.label}</span>:"-";} },
              { label:"Rating", render:s=>s?.rating>0?<span>★ <strong>{Number(s.rating).toFixed(1)}</strong></span>:"-", bestOf:ss=>{const ns=ss.map(v=>Number(v?.rating)||0).filter(n=>n>0);return ns.length?Math.max(...ns):null;}, isBest:(s,b)=>Number(s?.rating)===b },
              { label:"Popularity", render:s=>{const b=formatK(s?.boughtLastMonth);return b?`${b}+ last mo`:"-";}, bestOf:ss=>{const ns=ss.map(v=>Number(v?.boughtLastMonth)||0).filter(n=>n>0);return ns.length?Math.max(...ns):null;}, isBest:(s,b)=>Number(s?.boughtLastMonth)===b },
              { label:"Buy", render:s=><AmazonBtn stack={s} size="sm" showPrice /> },
            ].map((row, ri) => {
              const bestVal = row.bestOf ? row.bestOf(stacks) : null;
              return (
                <tr key={row.label} style={{ borderBottom:"1px solid #F8F4EE" }}>
                  <td style={{ padding:"11px 16px", fontSize:10, fontWeight:700, color:"#9B8E7E", textTransform:"uppercase", letterSpacing:"0.06em", whiteSpace:"nowrap" }}>{row.label}</td>
                  {stacks.map(s => {
                    const isBest = row.isBest && bestVal != null ? row.isBest(s, bestVal) : false;
                    return (
                      <td key={s.id} style={{ padding:"11px 16px", textAlign:"center", fontSize:13, color:isBest?"#15803D":"#1A1410", background:isBest?"#F0FDF4":"transparent", fontWeight:isBest?700:400 }}>
                        {row.render(s)}
                        {isBest && <div style={{ fontSize:9, color:"#16A34A", fontWeight:800, marginTop:2, textTransform:"uppercase", letterSpacing:"0.08em" }}>Best</div>}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
            <tr style={{ borderTop:"2px solid #E8E3DB", background:"#FAFAF8" }}>
              <td style={{ padding:"12px 16px", verticalAlign:"top" }}>
                <div style={{ fontSize:10, fontWeight:800, color:"#1A3A5C", textTransform:"uppercase", letterSpacing:"0.06em", whiteSpace:"nowrap", marginBottom:2 }}>Safety Check</div>
                <div style={{ fontSize:9, color:"#9B8E7E", fontWeight:400, lineHeight:1.4, maxWidth:90 }}>Banned substance scan</div>
              </td>
              {stacks.map(s => {
                const isSafest = safetyBestId === s.id;
                return (
                  <td key={s.id} style={{ padding:"12px 16px", textAlign:"center", verticalAlign:"top", background: isSafest ? "#F0FDF4" : "transparent" }}>
                    {renderSafetyCell(s)}
                    {isSafest && <div style={{ fontSize:9, color:"#16A34A", fontWeight:800, marginTop:4, textTransform:"uppercase", letterSpacing:"0.08em" }}>Safest</div>}
                  </td>
                );
              })}
            </tr>
          </tbody>
        </table>
      </div>
      <div style={{ padding:"10px 20px", borderTop:"1px solid #F0EBE2", background:"#FAFAF8" }}>
        <p style={{ fontFamily:"'DM Sans',sans-serif", fontSize:9, color:"#BDB5A8", margin:0, textAlign:"center" }}>
          Safety Check powered by CheckPeak - matched against our banned substances database. Results are for informational purposes only.
        </p>
      </div>
      <style>{`@keyframes cmp-spin { to { transform:rotate(360deg); } }`}</style>
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
   COMPARE PANEL
════════════════════════════════════════════════════════════════════════════ */
function ComparePanel({ stacks, onRemove, onClear, onScrollToTable }) {
  if (stacks.length === 0) return null;
  const ready = stacks.length >= 2;
  return (
    <div style={{
      position:"fixed", bottom:0, left:0, right:0, zIndex:50,
      background:"rgba(255,255,255,0.98)", backdropFilter:"blur(12px)",
      borderTop: ready ? "2px solid #1A3A5C" : "2px solid #DDD5C8",
      boxShadow:"0 -8px 32px rgba(0,0,0,0.1)",
      padding:"10px 16px",
      paddingBottom:"max(10px, env(safe-area-inset-bottom))",
    }}>
      <div style={{ maxWidth:1100, margin:"0 auto", display:"flex", alignItems:"center", gap:10, flexWrap:"wrap" }}>
        <span style={{ fontFamily:"'DM Sans',sans-serif", fontSize:11, fontWeight:800, textTransform:"uppercase", letterSpacing:"0.08em", color:ready?"#1A3A5C":"#9B8E7E", flexShrink:0 }}>
          {ready ? `Comparing ${stacks.length}:` : `Pick ${2-stacks.length} more to compare:`}
        </span>
        <div style={{ display:"flex", gap:6, flex:1, flexWrap:"wrap" }}>
          {stacks.map(s => (
            <div key={s.id} style={{ display:"flex", alignItems:"center", gap:5, background:"#EEF3F9", border:"1px solid #C0D0E0", borderRadius:8, padding:"4px 10px" }}>
              <span style={{ fontFamily:"'DM Sans',sans-serif", fontSize:11, fontWeight:600, color:"#1A3A5C", maxWidth:120, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{s.name}</span>
              <button type="button" onClick={() => onRemove(s.id)} style={{ background:"none", border:"none", cursor:"pointer", color:"#9BA8B4", padding:0, lineHeight:1 }}>✕</button>
            </div>
          ))}
          {Array.from({ length: Math.max(0, 2 - stacks.length) }).map((_,i) => (
            <div key={`empty-${i}`} style={{ display:"flex", alignItems:"center", padding:"4px 14px", border:"1.5px dashed #DDD5C8", borderRadius:8 }}>
              <span style={{ fontFamily:"'DM Sans',sans-serif", fontSize:11, color:"#C4BAB0" }}>+ Add product</span>
            </div>
          ))}
        </div>
        <div style={{ display:"flex", gap:8, flexShrink:0 }}>
          {ready && (
            <button type="button" onClick={onScrollToTable}
              style={{ padding:"8px 20px", borderRadius:8, background:"#1A3A5C", color:"#fff", fontFamily:"'DM Sans',sans-serif", fontSize:12, fontWeight:700, border:"none", cursor:"pointer", transition:"background 0.12s" }}
              onMouseEnter={e => { e.currentTarget.style.background="#162D4A"; }}
              onMouseLeave={e => { e.currentTarget.style.background="#1A3A5C"; }}
            >
              Compare now ↓
            </button>
          )}
          <button type="button" onClick={onClear}
            style={{ padding:"8px 14px", borderRadius:8, background:"transparent", border:"1px solid #DDD5C8", color:"#9B8E7E", fontFamily:"'DM Sans',sans-serif", fontSize:12, cursor:"pointer" }}>
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
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [saving, setSaving] = useState(false);
  const scrolledHalf = useScrollDepth(0.5);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 60000);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (scrolledHalf) setVisible(true);
  }, [scrolledHalf]);

  const handleSubmit = async e => {
    e?.preventDefault();
    if (!email.includes("@") || saving) return;
    setSaving(true);
    try {
      window.gtag?.("event", "email_capture", { category: activeCatLabel, email });
      window.dataLayer?.push({ event:"email_capture", category: activeCatLabel });
    } catch {}
    try {
      await fetch("/api/smartstack/subscribe", {
        method: "POST",
        headers: { "Content-Type":"application/json" },
        body: JSON.stringify({ email, category: activeCatLabel || "Supplements" }),
      });
    } catch (err) {
      console.error("[EmailCapture] save failed:", err);
    } finally {
      setSaving(false);
    }
    setSent(true);
    setTimeout(() => setDismissed(true), 3500);
  };

  if (!visible || dismissed) return null;

  return (
    <div style={{
      position:"fixed", bottom: 0, left:0, right:0, zIndex:48,
      background:"#1A3A5C", color:"#fff",
      padding:"14px 20px",
      paddingBottom:"max(14px, env(safe-area-inset-bottom))",
      boxShadow:"0 -4px 24px rgba(0,0,0,0.2)",
      display:"flex", alignItems:"center", gap:16, flexWrap:"wrap",
    }}>
      {sent ? (
        <p style={{ fontFamily:"'DM Sans',sans-serif", fontSize:13, color:"rgba(255,255,255,0.9)", margin:0, flex:1 }}>
          ✓ Got it! We'll email you when {activeCatLabel || "supplement"} prices drop.
        </p>
      ) : (
        <>
          <div style={{ flex:"1 1 220px" }}>
            <p style={{ fontFamily:"'Libre Baskerville',Georgia,serif", fontSize:14, fontWeight:700, color:"#fff", margin:"0 0 2px" }}>
              Get price drop alerts
            </p>
            <p style={{ fontFamily:"'DM Sans',sans-serif", fontSize:11, color:"rgba(255,255,255,0.6)", margin:0 }}>
              We track {activeCatLabel || "supplement"} prices weekly. We'll notify you when the best-value option drops.
            </p>
          </div>
          <div style={{ display:"flex", gap:8, flex:"1 1 260px", minWidth:0 }}>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") handleSubmit(e); }}
              placeholder="your@email.com"
              autoComplete="email"
              style={{ flex:1, padding:"8px 12px", borderRadius:8, border:"none", fontSize:13, fontFamily:"'DM Sans',sans-serif", outline:"none", minWidth:0, background:"#fff", color:"#1A1410" }}
            />
            <button
              type="button"
              onClick={handleSubmit}
              disabled={saving}
              style={{ padding:"8px 16px", borderRadius:8, background:"#FF9900", color:"#fff", fontFamily:"'DM Sans',sans-serif", fontSize:12, fontWeight:700, border:"none", cursor:saving?"wait":"pointer", flexShrink:0, transition:"background 0.12s", opacity:saving?0.7:1 }}
              onMouseEnter={e => { if(!saving) e.currentTarget.style.background="#E68A00"; }}
              onMouseLeave={e => { if(!saving) e.currentTarget.style.background="#FF9900"; }}
            >
              {saving ? "Saving…" : "Notify me"}
            </button>
          </div>
        </>
      )}
      <button type="button" onClick={() => setDismissed(true)}
        style={{ background:"none", border:"none", cursor:"pointer", color:"rgba(255,255,255,0.4)", fontSize:18, lineHeight:1, flexShrink:0, padding:4 }}>
        ✕
      </button>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   MAIN PAGE COMPONENT
════════════════════════════════════════════════════════════════════════════ */
export default function SmartStackComparePage() {
  const router = useRouter();
  const [allStacks, setAllStacks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  const [activeCatSlug, setActiveCatSlug] = useState(null);
  const [sortBy, setSortBy] = useState("best_value");
  const [searchRaw, setSearchRaw] = useState("");
  const [comparing, setComparing] = useState([]);
  const [visibleLimit, setLimit] = useState(24);

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
        if (!cancelled) setAllStacks(data.records || []);
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
    allStacks.forEach(s => {
      const cat = String(s?.category || "").trim();
      if (!cat) return;
      if (!byCat.has(cat)) byCat.set(cat, []);
      byCat.get(cat).push(s);
    });
    const map = new Map();
    byCat.forEach((stacksInCat) => {
      const sorted = [...stacksInCat].sort((a, b) => {
        const sa = getValueScore(a, stats) ?? -Infinity;
        const sb = getValueScore(b, stats) ?? -Infinity;
        return sb - sa;
      });
      sorted.forEach((s, i) => {
        map.set(s.id, { rank: i + 1, total: sorted.length });
      });
    });
    return map;
  }, [allStacks, stats]);

  const handleSelectBrand = useCallback((brandName) => {
    setActiveCatSlug("all");
    setSearchRaw(brandName);
    setLimit(24);
    router.replace(
      { pathname: router.pathname, query: { ...router.query, cat: "all", brand: brandName } },
      undefined,
      { shallow:true, scroll:false }
    );
  }, [router]);

  const handleSelectCat = useCallback((slug) => {
    setActiveCatSlug(slug === "all" ? "all" : slug);
    setLimit(24);
    setSearchRaw("");
    router.replace({ pathname: router.pathname, query: { ...router.query, cat: slug } }, undefined, { shallow:true, scroll:false });
  }, [router]);

  const activeCatConfig = useMemo(() => {
    if (!activeCatSlug || activeCatSlug === "all") return null;
    return CAT_CONFIG.find(c => c.slug === activeCatSlug) || null;
  }, [activeCatSlug]);

  const activeCatLabel = activeCatConfig?.label || "";

  // Detect if we're in a brand search so we can show it in the nav + heading
  const activeBrandName = useMemo(() => {
    if (!searchQuery.trim()) return null;
    const match = BRAND_CONFIG.find(b => b.name.toLowerCase() === searchQuery.trim().toLowerCase());
    return match ? match.name : null;
  }, [searchQuery]);

  const filtered = useMemo(() => {
    let result = allStacks;
    if (activeCatSlug && activeCatSlug !== "all" && activeCatConfig) {
      result = result.filter(s => activeCatConfig.cats.includes(String(s?.category || "").trim()));
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(s => (s?.name || "").toLowerCase().includes(q));
    }
    return sortStacks(result, sortBy, stats);
  }, [allStacks, activeCatSlug, activeCatConfig, searchQuery, sortBy, stats]);

  useEffect(() => { setLimit(24); }, [activeCatSlug, searchQuery, sortBy]);

  const gridStacks = useMemo(() => filtered.slice(0, visibleLimit), [filtered, visibleLimit]);
  const canLoadMore = visibleLimit < filtered.length;
  const totalCount = allStacks.length;

  const bestSeller = useMemo(() => {
    if (!activeCatConfig) return null;
    const pool = allStacks.filter(s =>
      activeCatConfig.cats.includes(String(s?.category || "").trim()) &&
      s?.imageUrl && s?.affiliateLink
    );
    return pool.sort((a,b) => (Number(b?.boughtLastMonth)||0) - (Number(a?.boughtLastMonth)||0))[0] || null;
  }, [allStacks, activeCatConfig]);

  const preloadedTop3 = useMemo(() => {
    if (!activeCatConfig) return [];
    const pool = allStacks.filter(s =>
      activeCatConfig.cats.includes(String(s?.category || "").trim()) &&
      s?.imageUrl && s?.affiliateLink
    );
    return sortStacks(pool, "best_value", stats).slice(0, 3);
  }, [allStacks, activeCatConfig, stats]);

  const toggleCompare = useCallback(stack => {
    setComparing(prev => {
      if (prev.find(s => s.id === stack.id)) return prev.filter(s => s.id !== stack.id);
      if (prev.length >= 3) return prev;
      return [...prev, stack];
    });
  }, []);

  const removeFromCompare = useCallback(id => setComparing(prev => prev.filter(s => s.id !== id)), []);
  const clearCompare = useCallback(() => setComparing([]), []);
  const scrollToManual = useCallback(() => {
    document.getElementById("compare-result")?.scrollIntoView({ behavior:"smooth", block:"start" });
  }, []);

  const pageTitle = activeCatLabel
    ? `Best ${activeCatLabel} Compared - SmartStack by CheckPeak`
    : "Supplement Comparison - SmartStack by CheckPeak";

  const pageDesc = activeCatLabel
    ? `Compare the best ${activeCatLabel} by price-per-serving, value rating, and customer reviews. Independent rankings. No sponsored placements.`
    : `Compare ${totalCount}+ supplements by price-per-serving and value rating. Find the best pre-workout, protein, and vitamins for your budget.`;

  const isEmailCaptureActive = comparing.length === 0;

  return (
    <>
      <Head>
        <title>{pageTitle}</title>
        <meta name="description" content={pageDesc} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Libre+Baskerville:ital,wght@0,400;0,700;1,400&family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600;9..40,700;9..40,800&display=swap" rel="stylesheet" />
      </Head>

      <div style={{ minHeight:"100vh", background:"#FAF8F4", fontFamily:"'DM Sans',sans-serif", paddingBottom: comparing.length > 0 || isEmailCaptureActive ? 72 : 0 }}>

        {/* NAV */}
        <nav style={{ background:"#fff", borderBottom:"1px solid #EAE5DC", padding:"10px 20px", display:"flex", alignItems:"center", justifyContent:"space-between", position:"sticky", top:0, zIndex:40, boxShadow:"0 1px 8px rgba(0,0,0,0.04)" }}>
          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
            <button type="button" onClick={() => { setActiveCatSlug(null); router.replace({ pathname:router.pathname, query:{} }, undefined, { shallow:true }); }}
              style={{ display:"flex", alignItems:"center", gap:8, background:"none", border:"none", cursor:"pointer", padding:0 }}>
              <div style={{ width:28, height:28, borderRadius:7, background:"#1A3A5C", display:"flex", alignItems:"center", justifyContent:"center" }}>
                <span style={{ color:"#fff", fontSize:12, fontWeight:800, fontFamily:"'Libre Baskerville',Georgia,serif" }}>S</span>
              </div>
              <span style={{ fontFamily:"'Libre Baskerville',Georgia,serif", fontSize:14, fontWeight:700, color:"#1A1410" }}>SmartStack</span>
            </button>
            <span style={{ fontSize:11, color:"#9B8E7E" }}>by CheckPeak</span>
            {activeCatLabel && (
              <>
                <span style={{ color:"#DDD5C8", fontSize:12 }}>/</span>
                <span style={{ fontFamily:"'DM Sans',sans-serif", fontSize:12, color:"#1A3A5C", fontWeight:600 }}>{activeCatLabel}</span>
              </>
            )}
            {activeBrandName && (
              <>
                <span style={{ color:"#DDD5C8", fontSize:12 }}>/</span>
                <span style={{ fontFamily:"'DM Sans',sans-serif", fontSize:12, color:"#1A3A5C", fontWeight:600 }}>{activeBrandName}</span>
              </>
            )}
          </div>
          <div style={{ display:"flex", gap:8 }}>
            {(activeCatLabel || activeBrandName) && (
              <button type="button" onClick={() => { setActiveCatSlug(null); setSearchRaw(""); router.replace({ pathname:router.pathname, query:{} }, undefined, { shallow:true }); }}
                style={{ fontSize:12, fontWeight:600, color:"#6B6259", padding:"6px 12px", background:"none", border:"1px solid #DDD5C8", borderRadius:8, cursor:"pointer" }}>
                ← All Categories
              </button>
            )}
            <a href="/nutrition-label-scanner" style={{ fontSize:12, fontWeight:600, color:"#1A3A5C", textDecoration:"none", padding:"6px 14px", border:"1px solid #C0D0E0", borderRadius:8, background:"#EEF3F9" }}>
              Scan a Label →
            </a>
          </div>
        </nav>

        {/* HERO - OPTIMIZED FOR CLICKS */}
        <div style={{ background:"linear-gradient(160deg,#fff 0%,#F4F0E8 100%)", borderBottom:"1px solid #EAE5DC", padding:"52px 20px 40px" }}>
          <div style={{ maxWidth:860, margin:"0 auto" }}>
            <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:16, flexWrap:"wrap" }}>
              <span style={{ fontSize:10, fontWeight:800, textTransform:"uppercase", letterSpacing:"0.12em", color:"#1A3A5C", background:"#EEF3F9", padding:"3px 10px", borderRadius:20, border:"1px solid #C0D0E0" }}>
                Independent Analysis • No Sponsored Placements
              </span>
              {!loading && totalCount > 0 && <span style={{ fontSize:12, color:"#9B8E7E" }}>{totalCount} supplements tracked</span>}
            </div>
            <h1 style={{ fontFamily:"'Libre Baskerville',Georgia,serif", fontSize:"clamp(2rem,6.5vw,3.5rem)", fontWeight:700, color:"#1A1410", lineHeight:1.12, margin:"0 0 18px", letterSpacing:"-0.03em" }}>
              {activeBrandName
                ? `${activeBrandName} Supplements – Ranked by Real Value`
                : activeCatLabel
                ? `The Best ${activeCatLabel} That's Actually Worth Buying`
                : "Stop Wasting Money on Supplements – Here's What's Truly Worth It"
              }
            </h1>
            <p style={{ fontSize:"clamp(15px,2.6vw,18px)", color:"#6B6259", lineHeight:1.68, maxWidth:620, margin:"0 0 24px" }}>
              {activeBrandName
                ? `Every ${activeBrandName} product ranked by price-per-serving against the category median. No paid placements. Just honest value.`
                : activeCatLabel
                ? `We ranked every ${activeCatLabel.toLowerCase()} by real price-per-serving against the category median. No hype. No paid placements. Just honest value.`
                : "We compare pre-workouts, protein powders, vitamins, and more by true cost per serving. Independent rankings updated weekly."
              }
            </p>
            <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap", padding:"12px 18px", background:"rgba(255,255,255,0.8)", border:"1px solid #E8E3DB", borderRadius:12, maxWidth:560 }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#15803D" strokeWidth={2.5}><path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" strokeLinecap="round" strokeLinejoin="round"/></svg>
              <p style={{ fontSize:13.5, color:"#1A1410", margin:0, lineHeight:1.5 }}>
                Prices checked live today. Pure value-based rankings. No brand pays to be here.
              </p>
            </div>
          </div>
        </div>

        <div style={{ maxWidth:1100, margin:"0 auto", padding:"0 16px" }}>

          {!loading && !activeCatSlug && (
            <section style={{ marginTop:36 }}>
              <CategorySelector onSelect={handleSelectCat} />
              <BrandSelector onSelect={handleSelectBrand} />
            </section>
          )}

          {activeCatSlug && activeCatSlug !== "all" && !loading && (
            <>
              {bestSeller && (
                <section style={{ marginTop:32 }}>
                  <BestSellerStrip stack={bestSeller} stats={stats} catLabel={activeCatLabel} />
                </section>
              )}
              {preloadedTop3.length >= 2 && (
                <section style={{ marginTop:8 }}>
                  <PreloadedCompare
                    stacks={preloadedTop3}
                    stats={stats}
                    catLabel={activeCatLabel}
                    onAddToCompare={toggleCompare}
                    comparingIds={comparing.map(s => s.id)}
                  />
                </section>
              )}
            </>
          )}

          {!loading && activeCatSlug && (
            <section style={{ marginTop: activeCatSlug !== "all" ? 0 : 36 }}>
              <ValueExplainer />
            </section>
          )}

          {(activeCatSlug) && (
            <section style={{ marginTop:32 }}>
              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:12, marginBottom:16, flexWrap:"wrap" }}>
                <h2 style={{ fontFamily:"'Libre Baskerville',Georgia,serif", fontSize:19, fontWeight:700, color:"#1A1410", margin:0 }}>
                  {activeBrandName
                    ? `All ${activeBrandName} Products`
                    : activeCatLabel
                    ? `All ${activeCatLabel}`
                    : "Browse All Supplements"
                  }
                </h2>
                <div style={{ position:"relative", width:"min(100%,240px)" }}>
                  <svg viewBox="0 0 24 24" style={{ position:"absolute", left:10, top:"50%", transform:"translateY(-50%)", width:13, height:13 }} fill="none" stroke="#9B8E7E" strokeWidth={2.5}>
                    <circle cx="11" cy="11" r="8"/><path strokeLinecap="round" d="m21 21-4.35-4.35"/>
                  </svg>
                  <input type="text" value={searchRaw} onChange={e => setSearchRaw(e.target.value)}
                    placeholder="Search products…"
                    style={{ width:"100%", padding:"8px 10px 8px 32px", border:"1px solid #DDD5C8", borderRadius:8, fontSize:13, fontFamily:"'DM Sans',sans-serif", color:"#1A1410", background:"#fff", outline:"none" }}
                  />
                  {searchRaw && (
                    <button type="button" onClick={() => setSearchRaw("")} style={{ position:"absolute", right:8, top:"50%", transform:"translateY(-50%)", background:"none", border:"none", cursor:"pointer", color:"#9B8E7E" }}>✕</button>
                  )}
                </div>
              </div>

              <div style={{ display:"flex", gap:8, flexWrap:"wrap", alignItems:"center", marginBottom:14 }}>
                <div style={{ display:"flex", gap:5, overflowX:"auto", paddingBottom:2, flex:1, scrollbarWidth:"none", minWidth:0 }}>
                  {CAT_CONFIG.map(c => {
                    const active = activeCatSlug === c.slug;
                    return (
                      <button key={c.slug} type="button" onClick={() => handleSelectCat(c.slug)}
                        style={{ flexShrink:0, padding:"5px 13px", borderRadius:20, background:active?"#1A3A5C":"#fff", border:active?"1px solid #1A3A5C":"1px solid #DDD5C8", color:active?"#fff":"#6B6259", fontSize:11, fontWeight:active?700:500, cursor:"pointer", fontFamily:"'DM Sans',sans-serif", transition:"all 0.12s", whiteSpace:"nowrap" }}
                      >
                        {c.emoji} {c.label}
                      </button>
                    );
                  })}
                  <button type="button" onClick={() => handleSelectCat("all")}
                    style={{ flexShrink:0, padding:"5px 13px", borderRadius:20, background:activeCatSlug==="all"?"#1A3A5C":"#fff", border:activeCatSlug==="all"?"1px solid #1A3A5C":"1px solid #DDD5C8", color:activeCatSlug==="all"?"#fff":"#6B6259", fontSize:11, fontWeight:activeCatSlug==="all"?700:500, cursor:"pointer", fontFamily:"'DM Sans',sans-serif", whiteSpace:"nowrap" }}>
                    All
                  </button>
                </div>
                <div style={{ display:"flex", alignItems:"center", gap:6, flexShrink:0 }}>
                  <span style={{ fontSize:11, color:"#9B8E7E", fontFamily:"'DM Sans',sans-serif" }}>Sort:</span>
                  <select value={sortBy} onChange={e => setSortBy(e.target.value)}
                    style={{ padding:"5px 10px", border:"1px solid #DDD5C8", borderRadius:8, fontSize:12, fontFamily:"'DM Sans',sans-serif", color:"#1A1410", background:"#fff", cursor:"pointer", outline:"none" }}
                  >
                    {SORT_OPTIONS.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
                  </select>
                </div>
              </div>

              {!loading && (
                <p style={{ fontSize:12, color:"#9B8E7E", marginBottom:14, fontFamily:"'DM Sans',sans-serif" }}>
                  {filtered.length} supplement{filtered.length !== 1 ? "s" : ""}
                  {activeBrandName ? ` from ${activeBrandName}` : activeCatLabel && activeCatSlug !== "all" ? ` in ${activeCatLabel}` : ""}
                  {searchQuery && !activeBrandName ? ` matching "${searchQuery}"` : ""}
                </p>
              )}

              {loading && (
                <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(180px,1fr))", gap:12 }}>
                  {Array.from({ length:12 }).map((_,i) => (
                    <div key={i} style={{ background:"#fff", border:"1px solid #EAE5DC", borderRadius:12, overflow:"hidden" }}>
                      <div style={{ background:"#F0EBE2", aspectRatio:"1/1" }} />
                      <div style={{ padding:10 }}>
                        <div style={{ background:"#F0EBE2", height:12, borderRadius:4, marginBottom:8, width:"80%" }} />
                        <div style={{ background:"#F0EBE2", height:14, borderRadius:4, marginBottom:8, width:"45%" }} />
                        <div style={{ background:"#FCDDA0", height:30, borderRadius:8 }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {loadError && (
                <div style={{ padding:20, borderRadius:12, background:"#FFF0F0", border:"1px solid #FFC8C8", color:"#C8102E", fontSize:13, textAlign:"center" }}>{loadError}</div>
              )}

              {!loading && !loadError && (
                <>
                  {gridStacks.length > 0 ? (
                    <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(180px,1fr))", gap:12 }}>
                      {gridStacks.map((stack) => {
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
                    <div style={{ padding:"60px 20px", textAlign:"center" }}>
                      <p style={{ fontFamily:"'Libre Baskerville',Georgia,serif", fontSize:18, color:"#6B6259", margin:"0 0 8px" }}>No results</p>
                      <p style={{ fontSize:13, color:"#9B8E7E", margin:"0 0 16px" }}>Try a different category or clear your search.</p>
                      <button type="button" onClick={() => { setSearchRaw(""); }}
                        style={{ padding:"8px 20px", borderRadius:8, background:"#1A3A5C", color:"#fff", border:"none", fontSize:13, fontWeight:600, cursor:"pointer" }}>
                        Clear search
                      </button>
                    </div>
                  )}

                  {canLoadMore && (
                    <div style={{ display:"flex", justifyContent:"center", marginTop:32 }}>
                      <button type="button" onClick={() => setLimit(v => v + 24)}
                        style={{ padding:"10px 28px", borderRadius:24, background:"#fff", border:"1.5px solid #1A3A5C", color:"#1A3A5C", fontSize:13, fontWeight:700, cursor:"pointer", fontFamily:"'DM Sans',sans-serif", transition:"all 0.12s" }}
                        onMouseEnter={e => { e.currentTarget.style.background="#1A3A5C"; e.currentTarget.style.color="#fff"; }}
                        onMouseLeave={e => { e.currentTarget.style.background="#fff"; e.currentTarget.style.color="#1A3A5C"; }}
                      >
                        Load more ({filtered.length - visibleLimit} remaining)
                      </button>
                    </div>
                  )}

                  {!canLoadMore && gridStacks.length > 0 && (
                    <p style={{ textAlign:"center", marginTop:32, fontSize:12, color:"#C4BAB0" }}>
                      All {filtered.length} shown
                    </p>
                  )}
                </>
              )}
            </section>
          )}

          {comparing.length >= 2 && (
            <section style={{ marginTop:12 }}>
              <ManualCompareTable stacks={comparing} stats={stats} onRemove={removeFromCompare} />
            </section>
          )}

          {activeCatSlug && (
            <section style={{ marginTop:56, padding:"36px 28px", background:"#1A3A5C", borderRadius:16, textAlign:"center", marginBottom:48 }}>
              <p style={{ fontFamily:"'Libre Baskerville',Georgia,serif", fontSize:"clamp(1.1rem,4vw,1.7rem)", fontWeight:700, color:"#fff", margin:"0 0 10px", lineHeight:1.3 }}>
                Serious about your supplements?
              </p>
              <p style={{ fontSize:14, color:"rgba(255,255,255,0.65)", margin:"0 0 24px", lineHeight:1.7, maxWidth:480, marginLeft:"auto", marginRight:"auto" }}>
                CheckPeak helps you track nutrition, manage workouts, and scan supplements for banned substances - all in one place.
              </p>
              <div style={{ display:"flex", gap:12, justifyContent:"center", flexWrap:"wrap" }}>
                <a href="/dashboard" style={{ display:"inline-flex", alignItems:"center", gap:8, padding:"12px 24px", borderRadius:10, background:"#fff", color:"#1A3A5C", fontWeight:700, fontSize:14, textDecoration:"none", fontFamily:"'DM Sans',sans-serif" }}>
                  Get started free →
                </a>
                <a href="/nutrition-label-scanner" style={{ display:"inline-flex", alignItems:"center", gap:8, padding:"12px 24px", borderRadius:10, background:"transparent", color:"rgba(255,255,255,0.8)", fontWeight:600, fontSize:14, textDecoration:"none", fontFamily:"'DM Sans',sans-serif", border:"1px solid rgba(255,255,255,0.25)" }}>
                  Scan your supplements
                </a>
              </div>
            </section>
          )}
        </div>

        <ComparePanel stacks={comparing} onRemove={removeFromCompare} onClear={clearCompare} onScrollToTable={scrollToManual} />
        {isEmailCaptureActive && activeCatSlug && (
          <EmailCaptureStrip activeCatLabel={activeCatLabel} />
        )}
      </div>
    </>
  );
}