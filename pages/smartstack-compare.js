// pages/smartstack-compare.js
// Full conversion-optimised landing page
// URL params: ?cat=pre-workout  ?sub=vitamin-d  ?sort=best_value
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
      const total    = document.documentElement.scrollHeight;
      if (!reached && scrolled / total >= threshold) setReached(true);
    };
    window.addEventListener("scroll", check, { passive: true });
    return () => window.removeEventListener("scroll", check);
  }, [reached, threshold]);
  return reached;
}

/* ════════════════════════════════════════════════════════════════════════════
   VALUE SCORING  (mirrors smartstack_page.js)
════════════════════════════════════════════════════════════════════════════ */

function toNum(v) { const n = Number(v); return Number.isFinite(n) ? n : null; }

function getPPS(stack) {
  for (const k of ["pricePerServing","PricePerServing","costPerServing"]) {
    const n = toNum(stack?.[k]); if (n != null && n > 0) return n;
  }
  const price    = ["price","Price"].map(k => toNum(stack?.[k])).find(n => n != null && n > 0);
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
    const mid    = Math.floor(sorted.length / 2);
    stats[cat]   = {
      count:  prices.length,
      median: sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid-1] + sorted[mid]) / 2,
    };
  });
  return stats;
}

function getValueScore(stack, stats) {
  const cat  = String(stack?.category || "").trim();
  const pps  = getPPS(stack);
  const info = stats?.[cat];
  if (!cat || pps == null || pps <= 0 || !info?.median || info.count < 3) return null;
  return info.median / pps;
}

function getValueTier(score) {
  if (score == null) return null;
  if (score >= 1.15)  return "best";
  if (score >= 0.90)  return "good";
  return "decent";
}

const TIER = {
  best:   { label:"Best Value",   bg:"#DCFCE7", text:"#15803D", border:"#BBF7D0", dot:"#16A34A" },
  good:   { label:"Good Value",   bg:"#DBEAFE", text:"#1D4ED8", border:"#BFDBFE", dot:"#2563EB" },
  decent: { label:"Decent Value", bg:"#FEF9C3", text:"#854D0E", border:"#FEF08A", dot:"#CA8A04" },
};

/* ════════════════════════════════════════════════════════════════════════════
   STATIC DATA
════════════════════════════════════════════════════════════════════════════ */

const CAT_CONFIG = [
  { slug:"pre-workout",   label:"Pre-Workout",    emoji:"⚡", cats:["Pre-Workout"],                                      desc:"Energy + focus before training" },
  { slug:"protein",       label:"Protein",         emoji:"💪", cats:["Protein Powder"],                                   desc:"Muscle repair & growth" },
  { slug:"vitamins",      label:"Vitamins",        emoji:"💊", cats:["Vitamins","Vitamin A","Vitamin B","Vitamin C","Vitamin D"], desc:"Daily health support" },
  { slug:"creatine",      label:"Creatine",        emoji:"🔬", cats:["Creatine"],                                         desc:"Strength & power output" },
  { slug:"bcaas",         label:"BCAAs",           emoji:"🌿", cats:["BCAAs"],                                            desc:"Recovery & endurance" },
  { slug:"energy-drinks", label:"Energy Drinks",   emoji:"☕", cats:["Energy Drinks"],                                    desc:"Ready-to-drink caffeine" },
];

const ALL_CATS_FLAT = [
  "All","Pre-Workout","Protein Powder","Vitamins","Vitamin A","Vitamin B","Vitamin C","Vitamin D",
  "Creatine","BCAAs","Energy Drinks","Protein Bars","Ashwagandha","Berberine","Misc",
];

const SORT_OPTIONS = [
  { id:"best_value",  label:"Best Value"   },
  { id:"price_asc",   label:"Price ↑"      },
  { id:"price_desc",  label:"Price ↓"      },
  { id:"rating",      label:"Top Rated"    },
  { id:"popular",     label:"Most Popular" },
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

function slugToCats(slug) {
  if (!slug) return null;
  const found = CAT_CONFIG.find(c => c.slug === slug.toLowerCase());
  return found ? found.cats : null;
}

function slugToLabel(slug) {
  const found = CAT_CONFIG.find(c => c.slug === slug?.toLowerCase());
  return found ? found.label : slug || "";
}

function trackAmazon(stack) {
  try {
    const payload = {
      event_category:  "affiliate",
      supplement_name: stack?.name      || "",
      category:        stack?.category  || "",
      value_tier:      getValueTier(getValueScore(stack, {})) ?? "unknown",
      price_per_serving: getPPS(stack)  ?? "",
    };
    if (typeof window !== "undefined") {
      window.gtag?.("event", "amazon_click", payload);
      window.dataLayer?.push({ event:"amazon_click", ...payload });
    }
  } catch {}
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
    if (sortBy === "price_asc")  { return (getPPS(a) ?? Infinity) - (getPPS(b) ?? Infinity); }
    if (sortBy === "price_desc") { return (getPPS(b) ?? -Infinity) - (getPPS(a) ?? -Infinity); }
    if (sortBy === "rating")     { return (Number(b?.rating)||0) - (Number(a?.rating)||0); }
    if (sortBy === "popular")    { return (Number(b?.boughtLastMonth)||0) - (Number(a?.boughtLastMonth)||0); }
    return (getValueScore(b, stats) ?? -Infinity) - (getValueScore(a, stats) ?? -Infinity);
  });
}

/* ════════════════════════════════════════════════════════════════════════════
   AMAZON BUTTON  (shared component)
════════════════════════════════════════════════════════════════════════════ */

function AmazonBtn({ stack, size = "md", showPrice = false }) {
  const price = showPrice ? priceLabel(stack) : null;
  const pps   = getPPS(stack);
  const ppsStr = pps ? ppsLabel(pps) : null;

  const label = price
    ? `Buy on Amazon - ${price}`
    : ppsStr
    ? `Buy on Amazon - ${ppsStr}/srv`
    : "View on Amazon";

  const pad = size === "lg" ? "12px 20px" : size === "sm" ? "6px 10px" : "9px 14px";
  const fs  = size === "lg" ? 14 : size === "sm" ? 11 : 12;

  if (!stack?.affiliateLink) {
    return (
      <div style={{ padding:pad, borderRadius:9, background:"#F3EFE8", color:"#C4BAB0", fontSize:fs, fontFamily:"'DM Sans',sans-serif", textAlign:"center" }}>
        Unavailable
      </div>
    );
  }

  return (
    <a
      href={stack.affiliateLink} target="_blank" rel="noopener noreferrer"
      onClick={() => trackAmazon(stack)}
      style={{
        display:"flex", alignItems:"center", justifyContent:"center", gap:6,
        padding:pad, borderRadius:9, textDecoration:"none",
        background:"#FF9900", color:"#fff",
        fontFamily:"'DM Sans',sans-serif", fontSize:fs, fontWeight:700,
        letterSpacing:"0.01em", boxShadow:"0 2px 8px rgba(255,153,0,0.3)",
        transition:"background 0.12s, box-shadow 0.12s",
        whiteSpace:"nowrap",
      }}
      onMouseEnter={e => { e.currentTarget.style.background="#E68A00"; e.currentTarget.style.boxShadow="0 4px 16px rgba(255,153,0,0.45)"; }}
      onMouseLeave={e => { e.currentTarget.style.background="#FF9900"; e.currentTarget.style.boxShadow="0 2px 8px rgba(255,153,0,0.3)"; }}
    >
      <svg width={fs-1} height={fs-1} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
      </svg>
      {label}
    </a>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   CATEGORY SELECTOR  (above the fold, replaces the grid)
════════════════════════════════════════════════════════════════════════════ */

function CategorySelector({ onSelect }) {
  return (
    <div>
      <p style={{ fontFamily:"'DM Sans',sans-serif", fontSize:13, color:"#6B6259", marginBottom:16, textAlign:"center" }}>
        What are you shopping for today?
      </p>
      {/* Grid: 2 cols on mobile, 3 on sm, auto-fill on larger */}
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
   BEST SELLER STRIP  (hero card per category)
════════════════════════════════════════════════════════════════════════════ */

function BestSellerStrip({ stack, stats, catLabel }) {
  if (!stack) return null;
  const pps    = getPPS(stack);
  const score  = getValueScore(stack, stats);
  const tier   = getValueTier(score);
  const tm     = tier ? TIER[tier] : null;
  const bought = formatK(stack?.boughtLastMonth);
  const lastChecked = getLastChecked();

  return (
    <div style={{
      background:"#fff", border:"1.5px solid #1A3A5C", borderRadius:16,
      overflow:"hidden", display:"flex", flexDirection:"row", flexWrap:"wrap",
      boxShadow:"0 6px 32px rgba(26,58,92,0.1)", marginBottom:32,
    }}>
      {/* Colour accent bar */}
      <div style={{ width:"100%", height:3, background:"linear-gradient(90deg,#1A3A5C,#4A7FA5,#78B5D4)" }} />

      <div style={{ display:"flex", flexWrap:"wrap", width:"100%", padding:"20px 24px", gap:20, alignItems:"center" }}>
        {/* Image */}
        <div style={{ width:100, height:100, borderRadius:12, background:"#F8F6F2", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, overflow:"hidden" }}>
          {stack.imageUrl
            ? /* eslint-disable-next-line @next/next/no-img-element */
              <img src={stack.imageUrl} alt={stack.name} style={{ width:"100%", height:"100%", objectFit:"contain", padding:8 }} loading="eager" />
            : <span style={{ fontSize:36, opacity:.15 }}>💊</span>
          }
        </div>

        {/* Info */}
        <div style={{ flex:1, minWidth:180 }}>
          <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap", marginBottom:6 }}>
            <span style={{ fontSize:10, fontWeight:800, textTransform:"uppercase", letterSpacing:"0.1em", color:"#1A3A5C", background:"#EEF3F9", padding:"2px 8px", borderRadius:20, border:"1px solid #C0D0E0" }}>
              🏆 Best Seller · {catLabel}
            </span>
            {tm && (
              <span style={{ fontSize:10, fontWeight:700, padding:"2px 8px", borderRadius:20, background:tm.bg, color:tm.text, border:`1px solid ${tm.border}` }}>
                {tm.label}
              </span>
            )}
          </div>

          <p style={{ fontFamily:"'Libre Baskerville',Georgia,serif", fontSize:18, fontWeight:700, color:"#1A1410", margin:"0 0 4px", lineHeight:1.3 }}>
            {stack.name}
          </p>

          <div style={{ display:"flex", flexWrap:"wrap", gap:"4px 16px", fontSize:12, color:"#6B6259", fontFamily:"'DM Sans',sans-serif" }}>
            {pps && (
              <span>
                <strong style={{ fontFamily:"'Libre Baskerville',Georgia,serif", fontSize:16, color:"#1A1410" }}>{ppsLabel(pps)}</strong>
                {" "}per serving
              </span>
            )}
            {stack.rating > 0 && (
              <span>★ {Number(stack.rating).toFixed(1)}{stack.reviewCount > 0 ? ` (${formatK(stack.reviewCount)})` : ""}</span>
            )}
            {bought && <span>🔥 {bought}+ bought last month</span>}
          </div>

          <p style={{ fontSize:10, color:"#B0A89E", fontFamily:"'DM Sans',sans-serif", marginTop:6 }}>
            Amazon price last checked {lastChecked} today
          </p>
        </div>

        {/* CTA */}
        <div style={{ flexShrink:0, minWidth:180 }}>
          <AmazonBtn stack={stack} size="lg" showPrice />
          <p style={{ textAlign:"center", fontSize:10, color:"#B0A89E", fontFamily:"'DM Sans',sans-serif", marginTop:4 }}>
            Opens Amazon. Price may vary.
          </p>
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   VALUE EXPLAINER
════════════════════════════════════════════════════════════════════════════ */

function ValueExplainer() {
  return (
    <div style={{ background:"#F8F6F2", border:"1px solid #E8E3DB", borderRadius:14, padding:"18px 20px" }}>
      <div style={{ display:"flex", alignItems:"flex-start", gap:16, flexWrap:"wrap" }}>
        <div style={{ flex:"1 1 220px" }}>
          <p style={{ fontFamily:"'Libre Baskerville',Georgia,serif", fontSize:14, fontWeight:700, color:"#1A1410", margin:"0 0 4px" }}>
            How Value Scores work
          </p>
          <p style={{ fontFamily:"'DM Sans',sans-serif", fontSize:12, color:"#6B6259", margin:0, lineHeight:1.65 }}>
            We calculate <strong>price-per-serving</strong> for every supplement, then compare it against the median for that category. Rankings are based purely on value - no brand pays for placement.
          </p>
        </div>
        <div style={{ display:"flex", gap:8, flex:"2 1 300px", flexWrap:"wrap" }}>
          {Object.entries(TIER).map(([key, tm]) => (
            <div key={key} style={{ flex:"1 1 140px", display:"flex", gap:8, background:tm.bg, border:`1px solid ${tm.border}`, borderRadius:10, padding:"8px 12px", alignItems:"flex-start" }}>
              <div style={{ width:8, height:8, borderRadius:"50%", background:tm.dot, flexShrink:0, marginTop:4 }} />
              <div>
                <p style={{ fontFamily:"'DM Sans',sans-serif", fontSize:11, fontWeight:800, color:tm.text, margin:"0 0 2px" }}>{tm.label}</p>
                <p style={{ fontFamily:"'DM Sans',sans-serif", fontSize:10, color:tm.text, opacity:0.85, margin:0, lineHeight:1.5 }}>
                  {key === "best" ? "Significantly cheaper than the category median" :
                   key === "good" ? "At or near the median price" :
                   "Slightly above median"}
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
   PRE-LOADED COMPARISON TABLE  (rendered on URL param load)
════════════════════════════════════════════════════════════════════════════ */

function PreloadedCompare({ stacks, stats, catLabel, onAddToCompare, comparingIds }) {
  if (!stacks.length) return null;

  return (
    <div style={{ background:"#fff", border:"1.5px solid #1A3A5C", borderRadius:16, overflow:"hidden", boxShadow:"0 4px 28px rgba(26,58,92,0.1)", marginBottom:32 }}>
      <div style={{ padding:"14px 20px", borderBottom:"1px solid #E8E3DB", background:"linear-gradient(135deg,#1A3A5C,#2A5282)", display:"flex", alignItems:"center", gap:12 }}>
        <p style={{ fontFamily:"'Libre Baskerville',Georgia,serif", fontSize:16, fontWeight:700, color:"#fff", margin:0 }}>
          Top {stacks.length} {catLabel} - Compared
        </p>
        <span style={{ fontSize:11, color:"rgba(255,255,255,0.55)", fontFamily:"'DM Sans',sans-serif" }}>
          Ranked by value · Updated {getLastChecked()}
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
                      // eslint-disable-next-line @next/next/no-img-element
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
   SAFETY CHECK HELPERS  (fetch label → OCR → /api/check)
   Mirrors NutritionModal.jsx and GridCard.jsx pipeline exactly.
════════════════════════════════════════════════════════════════════════════ */

async function fetchLabelAsFile(url) {
  if (!url) throw new Error("No image URL");
  try {
    const r = await fetch(url, { mode:"cors" });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const b = await r.blob();
    return new File([b], `label.${b.type.includes("png")?"png":"jpg"}`, { type:b.type||"image/jpeg" });
  } catch { /* CORS - proxy */ }
  const r = await fetch(`/api/ocr/proxy-image?url=${encodeURIComponent(url)}`);
  if (!r.ok) throw new Error(`Proxy failed (${r.status})`);
  const b = await r.blob();
  return new File([b], `label.${b.type.includes("png")?"png":"jpg"}`, { type:b.type||"image/jpeg" });
}

async function runSafetyCheck(stack, startScan) {
  if (!stack?.nutritionLabel) return null;
  const file = await fetchLabelAsFile(stack.nutritionLabel);
  // startScan is a promise-based wrapper - we wrap in a promise
  return new Promise((resolve, reject) => {
    let resolved = false;
    const onResult = async (text) => {
      if (resolved) return;
      resolved = true;
      const t = String(text || "").trim();
      if (!t) { resolve({ matchedBanned:[], matchedIngredients:[] }); return; }
      try {
        const r    = await fetch("/api/check", {
          method:"POST", headers:{"Content-Type":"application/json"},
          body:JSON.stringify({ ingredientsText:t }), credentials:"include",
        });
        const data = await r.json().catch(()=>({}));
        resolve(r.ok ? data : { matchedBanned:[], matchedIngredients:[] });
      } catch { resolve({ matchedBanned:[], matchedIngredients:[] }); }
    };
    startScan([file]).catch(reject);
    // onResult is called via the hook's onScan callback - handled in ManualCompareTable
  });
}

/* ════════════════════════════════════════════════════════════════════════════
   MANUAL COMPARE TABLE  (user-assembled)
   Auto-runs Safety Check for each product when added to compare.
════════════════════════════════════════════════════════════════════════════ */

function ManualCompareTable({ stacks, stats, onRemove }) {
  const ref = useRef(null);

  // Safety check results and phases per stack id
  // phase: "idle" | "scanning" | "done" | "error" | "no_label"
  const [safetyData, setSafetyData] = useState({}); // { [id]: { phase, result } }

  /* ── Auto-scroll when 2nd product added ── */
  useEffect(() => {
    if (stacks.length === 2 && ref.current) {
      setTimeout(() => ref.current?.scrollIntoView({ behavior:"smooth", block:"start" }), 100);
    }
  }, [stacks.length]);

  /* ── Auto-scan each stack when added ── */
  useEffect(() => {
    stacks.forEach(stack => {
      const id = stack.id;
      // Skip if already scanned or scanning
      if (safetyData[id]) return;

      if (!stack?.nutritionLabel) {
        setSafetyData(prev => ({ ...prev, [id]: { phase:"no_label", result:null } }));
        return;
      }

      // Mark as scanning immediately
      setSafetyData(prev => ({ ...prev, [id]: { phase:"scanning", result:null } }));

      // Run the full pipeline: fetch image → OCR → check
      (async () => {
        try {
          // Step 1: fetch label image
          const file = await fetchLabelAsFile(stack.nutritionLabel);

          // Step 2: OCR via Tesseract (dynamic import to avoid SSR issues)
          const { createWorker } = await import("tesseract.js");
          const worker = await createWorker();
          if (typeof worker.load === "function")         await worker.load();
          if (typeof worker.reinitialize === "function") await worker.reinitialize("eng");
          else if (typeof worker.initialize === "function") await worker.initialize("eng");

          // Resize + grayscale via canvas
          const canvas  = document.createElement("canvas");
          const bitmap  = await createImageBitmap(file);
          const maxDim  = 1800;
          let w = bitmap.width, h = bitmap.height;
          if (w > maxDim || h > maxDim) {
            const s = Math.min(maxDim/w, maxDim/h);
            w = Math.round(w*s); h = Math.round(h*s);
          }
          canvas.width = w; canvas.height = h;
          const ctx = canvas.getContext("2d", { willReadFrequently:true });
          ctx.drawImage(bitmap, 0, 0, w, h);

          // Grayscale + contrast
          const imgData = ctx.getImageData(0, 0, w, h);
          const px = imgData.data;
          let min=255, max=0;
          for (let i=0;i<px.length;i+=4){ const g=0.3*px[i]+0.59*px[i+1]+0.11*px[i+2]; if(g<min)min=g; if(g>max)max=g; }
          const scale = 255/(max-min||1);
          for (let i=0;i<px.length;i+=4){ const g=Math.max(0,Math.min(255,(0.3*px[i]+0.59*px[i+1]+0.11*px[i+2]-min)*scale)); px[i]=px[i+1]=px[i+2]=g; }
          ctx.putImageData(imgData, 0, 0);

          if (typeof worker.setParameters === "function") {
            await worker.setParameters({ tesseract_pageseg_mode:"6" });
          }
          const result  = await worker.recognize(canvas);
          const ocrText = String(result?.data?.text ?? "").trim();
          await worker.terminate().catch(()=>{});

          // Step 3: check against banned/ingredient database
          if (!ocrText) {
            setSafetyData(prev => ({ ...prev, [id]: { phase:"done", result:{ matchedBanned:[], matchedIngredients:[] } } }));
            return;
          }

          const checkRes  = await fetch("/api/check", {
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stacks.map(s=>s.id).join(",")]);

  // Clean up safety data for removed stacks
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

  /* ── Safety check cell renderer ── */
  const renderSafetyCell = (stack) => {
    const sd = safetyData[stack.id];

    if (!sd || sd.phase === "scanning") {
      return (
        <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:4 }}>
          <div style={{
            width:16, height:16, borderRadius:"50%",
            border:"2px solid #C0D0E0", borderTopColor:"#1A3A5C",
            animation:"cmp-spin 0.8s linear infinite",
          }} />
          <span style={{ fontSize:9, color:"#9B8E7E" }}>Checking…</span>
        </div>
      );
    }

    if (sd.phase === "no_label") {
      return <span style={{ fontSize:11, color:"#BDB5A8" }}>No label</span>;
    }

    if (sd.phase === "error") {
      return <span style={{ fontSize:11, color:"#BDB5A8" }}>Unavailable</span>;
    }

    const banned = sd.result?.matchedBanned || [];
    const hasBanned = banned.length > 0;

    return (
      <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:5 }}>
        {/* Verdict pill */}
        <div style={{
          display:"flex", alignItems:"center", gap:5,
          padding:"3px 10px", borderRadius:99,
          background: hasBanned ? "#FFF0F0" : "#DCFCE7",
          border:`1px solid ${hasBanned ? "#FFC8C8" : "#BBF7D0"}`,
        }}>
          <span style={{ fontSize:11 }}>{hasBanned ? "⚠️" : "✅"}</span>
          <span style={{
            fontFamily:"'DM Sans',sans-serif", fontSize:11, fontWeight:800,
            color: hasBanned ? "#C8102E" : "#15803D",
          }}>
            {hasBanned ? `${banned.length} flagged` : "Nothing flagged"}
          </span>
        </div>

        {/* Flagged substance names */}
        {hasBanned && (
          <div style={{ display:"flex", flexDirection:"column", gap:3, width:"100%" }}>
            {banned.slice(0, 4).map((b, i) => {
              const name = b?.fields?.["Substance Name"] || b?.fields?.["Name"] || "Unknown";
              const type = b?.fields?.["Ban Type"] || "";
              return (
                <div key={i} style={{
                  padding:"3px 8px", borderRadius:6,
                  background:"#FFF0F0", border:"1px solid #FFC8C8",
                  textAlign:"left",
                }}>
                  <span style={{ fontFamily:"'DM Sans',sans-serif", fontSize:10, fontWeight:700, color:"#C8102E", display:"block" }}>
                    {name}
                  </span>
                  {type && (
                    <span style={{ fontFamily:"'DM Sans',sans-serif", fontSize:9, color:"#C8102E", opacity:0.7 }}>
                      {type}
                    </span>
                  )}
                </div>
              );
            })}
            {banned.length > 4 && (
              <span style={{ fontSize:9, color:"#9B8E7E", textAlign:"center" }}>
                +{banned.length - 4} more
              </span>
            )}
          </div>
        )}
      </div>
    );
  };

  /* ── Safety winner: product with 0 banned or fewest ── */
  const safetyBestId = (() => {
    const counts = stacks.map(s => {
      const sd = safetyData[s.id];
      if (sd?.phase !== "done") return null;
      return { id:s.id, count:(sd.result?.matchedBanned||[]).length };
    }).filter(Boolean);
    if (counts.length < stacks.length) return null; // not all done yet
    const min = Math.min(...counts.map(c => c.count));
    const winners = counts.filter(c => c.count === min);
    return winners.length === 1 ? winners[0].id : null; // only crown if unambiguous
  })();

  return (
    <div ref={ref} id="compare-result" style={{ background:"#fff", border:"1.5px solid #1A3A5C", borderRadius:16, overflow:"hidden", boxShadow:"0 4px 28px rgba(26,58,92,0.1)", scrollMarginTop:72 }}>
      {/* Header */}
      <div style={{ padding:"14px 20px", borderBottom:"1px solid #E8E3DB", background:"#EEF3F9", display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:8 }}>
        <p style={{ fontFamily:"'Libre Baskerville',Georgia,serif", fontSize:15, fontWeight:700, color:"#1A1410", margin:0 }}>
          Your Comparison
        </p>
        <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
          {stacks.map(s => (
            <div key={s.id} style={{ display:"flex", alignItems:"center", gap:5, background:"#fff", border:"1px solid #C0D0E0", borderRadius:8, padding:"3px 10px" }}>
              <span style={{ fontFamily:"'DM Sans',sans-serif", fontSize:11, fontWeight:600, color:"#1A3A5C", maxWidth:120, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{s.name}</span>
              <button type="button" onClick={() => onRemove(s.id)} style={{ background:"none", border:"none", cursor:"pointer", color:"#9BA8B4", padding:0, fontSize:13, lineHeight:1 }}>✕</button>
            </div>
          ))}
        </div>
      </div>

      {/* Table */}
      <div style={{ overflowX:"auto" }}>
        <table style={{ width:"100%", borderCollapse:"collapse", fontFamily:"'DM Sans',sans-serif", minWidth:400 }}>
          <thead>
            <tr style={{ borderBottom:"1px solid #F0EBE2", background:"#FAFAF8" }}>
              <th style={{ padding:"10px 16px", textAlign:"left", fontSize:10, fontWeight:800, color:"#9B8E7E", textTransform:"uppercase", letterSpacing:"0.08em", width:110 }}>Metric</th>
              {stacks.map(s => (
                <th key={s.id} style={{ padding:"10px 16px", textAlign:"center", minWidth:140, fontSize:11, fontWeight:700, color:"#1A1410" }}>
                  <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:4 }}>
                    {s.imageUrl && /* eslint-disable-next-line @next/next/no-img-element */ <img src={s.imageUrl} alt={s.name} style={{ width:40, height:40, objectFit:"contain", borderRadius:7, background:"#F8F6F2", padding:3 }} />}
                    <span style={{ lineHeight:1.3 }}>{s.name}</span>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[
              {
                label:"Price/Serving",
                render:s=>{const p=getPPS(s);return p?<strong style={{fontFamily:"'Libre Baskerville',serif"}}>{ppsLabel(p)}</strong>:"-";},
                bestOf:ss=>{const ns=ss.map(getPPS).filter(n=>n!=null);return ns.length?Math.min(...ns):null;},
                isBest:(s,b)=>getPPS(s)===b,
              },
              {
                label:"Value Rating",
                render:s=>{const tm=TIER[getValueTier(getValueScore(s,stats))];return tm?<span style={{padding:"2px 8px",borderRadius:20,background:tm.bg,color:tm.text,border:`1px solid ${tm.border}`,fontSize:11,fontWeight:700}}>{tm.label}</span>:"-";},
              },
              {
                label:"Rating",
                render:s=>s?.rating>0?<span>★ <strong>{Number(s.rating).toFixed(1)}</strong></span>:"-",
                bestOf:ss=>{const ns=ss.map(v=>Number(v?.rating)||0).filter(n=>n>0);return ns.length?Math.max(...ns):null;},
                isBest:(s,b)=>Number(s?.rating)===b,
              },
              {
                label:"Popularity",
                render:s=>{const b=formatK(s?.boughtLastMonth);return b?`${b}+ last mo`:"-";},
                bestOf:ss=>{const ns=ss.map(v=>Number(v?.boughtLastMonth)||0).filter(n=>n>0);return ns.length?Math.max(...ns):null;},
                isBest:(s,b)=>Number(s?.boughtLastMonth)===b,
              },
              {
                label:"Buy",
                render:s=><AmazonBtn stack={s} size="sm" showPrice />,
              },
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

            {/* ── SAFETY CHECK ROW ─────────────────────────────────────── */}
            <tr style={{ borderTop:"2px solid #E8E3DB", background:"#FAFAF8" }}>
              <td style={{ padding:"12px 16px", verticalAlign:"top" }}>
                <div style={{ fontSize:10, fontWeight:800, color:"#1A3A5C", textTransform:"uppercase", letterSpacing:"0.06em", whiteSpace:"nowrap", marginBottom:2 }}>
                  Safety Check
                </div>
                <div style={{ fontSize:9, color:"#9B8E7E", fontWeight:400, lineHeight:1.4, maxWidth:90 }}>
                  Banned substance scan
                </div>
              </td>
              {stacks.map(s => {
                const isSafest = safetyBestId === s.id;
                return (
                  <td key={s.id} style={{
                    padding:"12px 16px", textAlign:"center", verticalAlign:"top",
                    background: isSafest ? "#F0FDF4" : "transparent",
                  }}>
                    {renderSafetyCell(s)}
                    {isSafest && (
                      <div style={{ fontSize:9, color:"#16A34A", fontWeight:800, marginTop:4, textTransform:"uppercase", letterSpacing:"0.08em" }}>
                        Safest
                      </div>
                    )}
                  </td>
                );
              })}
            </tr>
          </tbody>
        </table>
      </div>

      {/* Footer note */}
      <div style={{ padding:"10px 20px", borderTop:"1px solid #F0EBE2", background:"#FAFAF8" }}>
        <p style={{ fontFamily:"'DM Sans',sans-serif", fontSize:9, color:"#BDB5A8", margin:0, textAlign:"center" }}>
          Safety Check powered by CheckPeak - matched against our banned substances database. Results are for informational purposes only.
        </p>
      </div>

      <style>{`@keyframes cmp-spin { to { transform:rotate(360deg); } }`}</style>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   COMPARE PANEL  (sticky bottom)
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
   EMAIL CAPTURE STRIP  (appears after 60s or 50% scroll)
════════════════════════════════════════════════════════════════════════════ */

function EmailCaptureStrip({ activeCatLabel }) {
  const [visible,   setVisible]   = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [email,     setEmail]     = useState("");
  const [sent,      setSent]      = useState(false);
  const [saving,    setSaving]    = useState(false);
  const scrolledHalf = useScrollDepth(0.5);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 60000);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (scrolledHalf) setVisible(true);
  }, [scrolledHalf]);

  if (!visible || dismissed) return null;

  const handleSubmit = async e => {
    e?.preventDefault();
    if (!email.includes("@") || saving) return;
    setSaving(true);
    try {
      // Fire analytics
      window.gtag?.("event", "email_capture", { category: activeCatLabel, email });
      window.dataLayer?.push({ event:"email_capture", category: activeCatLabel });
    } catch {}
    try {
      // Save to AthleteScans (Scans table) via API
      await fetch("/api/smartstack/subscribe", {
        method:  "POST",
        headers: { "Content-Type":"application/json" },
        body:    JSON.stringify({ email, category: activeCatLabel || "Supplements" }),
      });
    } catch (err) {
      console.error("[EmailCapture] save failed:", err);
      // Non-fatal - still show success to user
    } finally {
      setSaving(false);
    }
    setSent(true);
    setTimeout(() => setDismissed(true), 3500);
  };

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
   PAGE
════════════════════════════════════════════════════════════════════════════ */

export default function SmartStackComparePage() {
  const router = useRouter();

  const [allStacks, setAllStacks]   = useState([]);
  const [loading,   setLoading]     = useState(true);
  const [loadError, setLoadError]   = useState(null);

  // URL-driven state
  const [activeCatSlug, setActiveCatSlug] = useState(null); // null = show category selector
  const [sortBy,        setSortBy]        = useState("best_value");
  const [searchRaw,     setSearchRaw]     = useState("");
  const [comparing,     setComparing]     = useState([]);
  const [visibleLimit,  setLimit]         = useState(24);

  const searchQuery = useDebounce(searchRaw, 280);

  /* ── Parse URL params on mount ── */
  useEffect(() => {
    if (!router.isReady) return;
    const { cat, sort } = router.query;
    if (cat) setActiveCatSlug(String(cat).toLowerCase());
    if (sort && SORT_OPTIONS.find(o => o.id === sort)) setSortBy(sort);
  }, [router.isReady, router.query]);

  /* ── Load stacks ── */
  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const res  = await fetch("/api/smartstack");
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

  /* ── Stable value rank - computed by value score within each Airtable category,
     independent of display sort order. Survives filter/sort changes.
     Map<stackId, { rank: number, total: number }> ── */
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

  /* ── Category selection ── */
  const handleSelectCat = useCallback((slug) => {
    setActiveCatSlug(slug === "all" ? "all" : slug);
    setLimit(24);
    setSearchRaw("");
    router.replace({ pathname: router.pathname, query: { ...router.query, cat: slug } }, undefined, { shallow:true, scroll:false });
  }, [router]);

  /* ── Derive active category display info ── */
  const activeCatConfig = useMemo(() => {
    if (!activeCatSlug || activeCatSlug === "all") return null;
    return CAT_CONFIG.find(c => c.slug === activeCatSlug) || null;
  }, [activeCatSlug]);

  const activeCatLabel = activeCatConfig?.label || "";

  /* ── Filtered + sorted stacks ── */
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

  const gridStacks  = useMemo(() => filtered.slice(0, visibleLimit), [filtered, visibleLimit]);
  const canLoadMore = visibleLimit < filtered.length;
  const totalCount  = allStacks.length;

  /* ── Best seller (top by boughtLastMonth with image+link) ── */
  const bestSeller = useMemo(() => {
    if (!activeCatConfig) return null;
    const pool = allStacks.filter(s =>
      activeCatConfig.cats.includes(String(s?.category || "").trim()) &&
      s?.imageUrl && s?.affiliateLink
    );
    return pool.sort((a,b) => (Number(b?.boughtLastMonth)||0) - (Number(a?.boughtLastMonth)||0))[0] || null;
  }, [allStacks, activeCatConfig]);

  /* ── Pre-loaded top 3 for comparison table ── */
  const preloadedTop3 = useMemo(() => {
    if (!activeCatConfig) return [];
    const pool = allStacks.filter(s =>
      activeCatConfig.cats.includes(String(s?.category || "").trim()) &&
      s?.imageUrl && s?.affiliateLink
    );
    return sortStacks(pool, "best_value", stats).slice(0, 3);
  }, [allStacks, activeCatConfig, stats]);

  /* ── Compare ── */
  const toggleCompare = useCallback(stack => {
    setComparing(prev => {
      if (prev.find(s => s.id === stack.id)) return prev.filter(s => s.id !== stack.id);
      if (prev.length >= 3) return prev;
      return [...prev, stack];
    });
  }, []);
  const removeFromCompare = useCallback(id => setComparing(prev => prev.filter(s => s.id !== id)), []);
  const clearCompare      = useCallback(() => setComparing([]), []);
  const scrollToManual    = useCallback(() => {
    document.getElementById("compare-result")?.scrollIntoView({ behavior:"smooth", block:"start" });
  }, []);

  /* ── Dynamic page metadata ── */
  const pageTitle = activeCatLabel
    ? `Best ${activeCatLabel} Compared - SmartStack by CheckPeak`
    : "Supplement Comparison - SmartStack by CheckPeak";

  const pageDesc = activeCatLabel
    ? `Compare the best ${activeCatLabel} by price-per-serving, value rating, and customer reviews. Independent rankings. No sponsored placements.`
    : `Compare ${totalCount}+ supplements by price-per-serving and value rating. Find the best pre-workout, protein, and vitamins for your budget.`;

  const isEmailCaptureActive = comparing.length === 0; // don't stack panels

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

        {/* ── NAV ─────────────────────────────────────────────────────── */}
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
          </div>
          <div style={{ display:"flex", gap:8 }}>
            {activeCatLabel && (
              <button type="button" onClick={() => { setActiveCatSlug(null); router.replace({ pathname:router.pathname, query:{} }, undefined, { shallow:true }); }}
                style={{ fontSize:12, fontWeight:600, color:"#6B6259", padding:"6px 12px", background:"none", border:"1px solid #DDD5C8", borderRadius:8, cursor:"pointer" }}>
                ← All Categories
              </button>
            )}
            <a href="/nutrition-label-scanner" style={{ fontSize:12, fontWeight:600, color:"#1A3A5C", textDecoration:"none", padding:"6px 14px", border:"1px solid #C0D0E0", borderRadius:8, background:"#EEF3F9" }}>
              Scan a Label →
            </a>
          </div>
        </nav>

        {/* ── HERO ────────────────────────────────────────────────────── */}
        <div style={{ background:"linear-gradient(160deg,#fff 0%,#F4F0E8 100%)", borderBottom:"1px solid #EAE5DC", padding:"44px 20px 36px" }}>
          <div style={{ maxWidth:860, margin:"0 auto" }}>
            <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:16, flexWrap:"wrap" }}>
              <span style={{ fontSize:10, fontWeight:800, textTransform:"uppercase", letterSpacing:"0.12em", color:"#1A3A5C", background:"#EEF3F9", padding:"3px 10px", borderRadius:20, border:"1px solid #C0D0E0" }}>
                Independent Analysis
              </span>
              {!loading && totalCount > 0 && <span style={{ fontSize:12, color:"#9B8E7E" }}>{totalCount} supplements tracked</span>}
            </div>

            <h1 style={{ fontFamily:"'Libre Baskerville',Georgia,serif", fontSize:"clamp(1.9rem,6vw,3.2rem)", fontWeight:700, color:"#1A1410", lineHeight:1.15, margin:"0 0 16px", letterSpacing:"-0.02em" }}>
              {activeCatLabel
                ? `Best ${activeCatLabel} - compared by real value`
                : "Which supplements are actually worth your money?"
              }
            </h1>

            <p style={{ fontSize:"clamp(14px,2.5vw,17px)", color:"#6B6259", lineHeight:1.7, maxWidth:600, margin:"0 0 20px" }}>
              {activeCatLabel
                ? `We ranked every ${activeCatLabel} by price-per-serving against the category median. No sponsored products. No guesswork.`
                : "We compare pre-workouts, protein powders, vitamins, and more by price-per-serving. No sponsored rankings."
              }
            </p>

            {/* Trust bar */}
            <div style={{ display:"flex", alignItems:"center", gap:6, flexWrap:"wrap", padding:"10px 14px", background:"rgba(255,255,255,0.7)", border:"1px solid #E8E3DB", borderRadius:10, maxWidth:520, backdropFilter:"blur(6px)" }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#1A3A5C" strokeWidth={2} aria-hidden="true"><path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" strokeLinecap="round" strokeLinejoin="round"/></svg>
              <p style={{ fontFamily:"'DM Sans',sans-serif", fontSize:12, color:"#1A1410", margin:0, lineHeight:1.5 }}>
                <strong>Our rankings are calculated from public Amazon pricing data, updated weekly.</strong>
              </p>
            </div>
          </div>
        </div>

        <div style={{ maxWidth:1100, margin:"0 auto", padding:"0 16px" }}>

          {/* ── CATEGORY SELECTOR (no cat selected) ─────────────────── */}
          {!loading && !activeCatSlug && (
            <section style={{ marginTop:36 }}>
              <CategorySelector onSelect={handleSelectCat} />
            </section>
          )}

          {/* ── CATEGORY-SPECIFIC CONTENT ────────────────────────────── */}
          {activeCatSlug && activeCatSlug !== "all" && !loading && (
            <>
              {/* Best Seller */}
              {bestSeller && (
                <section style={{ marginTop:32 }}>
                  <BestSellerStrip stack={bestSeller} stats={stats} catLabel={activeCatLabel} />
                </section>
              )}

              {/* Pre-loaded comparison */}
              {preloadedTop3.length >= 2 && (
                <section style={{ marginTop:0 }}>
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

          {/* ── VALUE EXPLAINER ─────────────────────────────────────── */}
          {!loading && activeCatSlug && (
            <section style={{ marginTop: activeCatSlug !== "all" ? 0 : 36 }}>
              <ValueExplainer />
            </section>
          )}

          {/* ── BROWSE ALL ──────────────────────────────────────────── */}
          {(activeCatSlug) && (
            <section style={{ marginTop:32 }}>
              {/* Header row */}
              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:12, marginBottom:16, flexWrap:"wrap" }}>
                <h2 style={{ fontFamily:"'Libre Baskerville',Georgia,serif", fontSize:19, fontWeight:700, color:"#1A1410", margin:0 }}>
                  {activeCatLabel ? `All ${activeCatLabel}` : "Browse All Supplements"}
                </h2>
                <div style={{ position:"relative", width:"min(100%,240px)" }}>
                  <svg viewBox="0 0 24 24" style={{ position:"absolute", left:10, top:"50%", transform:"translateY(-50%)", width:13, height:13 }} fill="none" stroke="#9B8E7E" strokeWidth={2.5} aria-hidden="true">
                    <circle cx="11" cy="11" r="8"/><path strokeLinecap="round" d="m21 21-4.35-4.35"/>
                  </svg>
                  <input type="text" value={searchRaw} onChange={e => setSearchRaw(e.target.value)}
                    placeholder="Search…"
                    style={{ width:"100%", padding:"7px 10px 7px 30px", border:"1px solid #DDD5C8", borderRadius:8, fontSize:13, fontFamily:"'DM Sans',sans-serif", color:"#1A1410", background:"#fff", outline:"none", boxSizing:"border-box" }}
                    onFocus={e => { e.target.style.borderColor="#1A3A5C"; }}
                    onBlur={e  => { e.target.style.borderColor="#DDD5C8"; }}
                  />
                  {searchRaw && (
                    <button type="button" onClick={() => setSearchRaw("")} style={{ position:"absolute", right:8, top:"50%", transform:"translateY(-50%)", background:"none", border:"none", cursor:"pointer", color:"#9B8E7E", padding:2, lineHeight:1 }}>✕</button>
                  )}
                </div>
              </div>

              {/* Category pills + sort */}
              <div style={{ display:"flex", gap:8, flexWrap:"wrap", alignItems:"center", marginBottom:14 }}>
                <div style={{ display:"flex", gap:5, overflowX:"auto", paddingBottom:2, flex:1, scrollbarWidth:"none", minWidth:0 }}>
                  {CAT_CONFIG.map(c => {
                    const active = activeCatSlug === c.slug;
                    return (
                      <button key={c.slug} type="button" onClick={() => handleSelectCat(c.slug)}
                        style={{ flexShrink:0, padding:"5px 13px", borderRadius:20, background:active?"#1A3A5C":"#fff", border:active?"1px solid #1A3A5C":"1px solid #DDD5C8", color:active?"#fff":"#6B6259", fontSize:11, fontWeight:active?700:500, cursor:"pointer", fontFamily:"'DM Sans',sans-serif", transition:"all 0.12s", whiteSpace:"nowrap" }}
                        onMouseEnter={e => { if (!active) { e.currentTarget.style.borderColor="#1A3A5C"; e.currentTarget.style.color="#1A3A5C"; }}}
                        onMouseLeave={e => { if (!active) { e.currentTarget.style.borderColor="#DDD5C8"; e.currentTarget.style.color="#6B6259"; }}}
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
                    onFocus={e => { e.target.style.borderColor="#1A3A5C"; }}
                    onBlur={e  => { e.target.style.borderColor="#DDD5C8"; }}
                  >
                    {SORT_OPTIONS.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
                  </select>
                </div>
              </div>

              {/* Result count */}
              {!loading && (
                <p style={{ fontSize:12, color:"#9B8E7E", marginBottom:14, fontFamily:"'DM Sans',sans-serif" }}>
                  {filtered.length} supplement{filtered.length !== 1 ? "s" : ""}
                  {activeCatLabel && activeCatSlug !== "all" ? ` in ${activeCatLabel}` : ""}
                  {searchQuery ? ` matching "${searchQuery}"` : ""}
                </p>
              )}

              {/* Skeleton */}
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

              {/* Error */}
              {loadError && (
                <div style={{ padding:20, borderRadius:12, background:"#FFF0F0", border:"1px solid #FFC8C8", color:"#C8102E", fontSize:13, textAlign:"center" }}>{loadError}</div>
              )}

              {/* Grid */}
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

          {/* ── MANUAL COMPARE TABLE ────────────────────────────────── */}
          {comparing.length >= 2 && (
            <section style={{ marginTop:12 }}>
              <ManualCompareTable stacks={comparing} stats={stats} onRemove={removeFromCompare} />
            </section>
          )}

          {/* ── FOOTER CTA ──────────────────────────────────────────── */}
          {activeCatSlug && (
            <section style={{ marginTop:56, padding:"36px 28px", background:"#1A3A5C", borderRadius:16, textAlign:"center", marginBottom:48 }}>
              <p style={{ fontFamily:"'Libre Baskerville',Georgia,serif", fontSize:"clamp(1.1rem,4vw,1.7rem)", fontWeight:700, color:"#fff", margin:"0 0 10px", lineHeight:1.3 }}>
                Serious about your supplements?
              </p>
              <p style={{ fontSize:14, color:"rgba(255,255,255,0.65)", margin:"0 0 24px", lineHeight:1.7, maxWidth:480, marginLeft:"auto", marginRight:"auto" }}>
                CheckPeak helps you track nutrition, manage workouts, and scan supplements for banned substances - all in one place.
              </p>
              <div style={{ display:"flex", gap:12, justifyContent:"center", flexWrap:"wrap" }}>
                <a href="/dashboard" style={{ display:"inline-flex", alignItems:"center", gap:8, padding:"12px 24px", borderRadius:10, background:"#fff", color:"#1A3A5C", fontWeight:700, fontSize:14, textDecoration:"none", fontFamily:"'DM Sans',sans-serif" }}
                  onMouseEnter={e => { e.currentTarget.style.background="#EEF3F9"; }}
                  onMouseLeave={e => { e.currentTarget.style.background="#fff"; }}
                >
                  Get started free →
                </a>
                <a href="/nutrition-label-scanner" style={{ display:"inline-flex", alignItems:"center", gap:8, padding:"12px 24px", borderRadius:10, background:"transparent", color:"rgba(255,255,255,0.8)", fontWeight:600, fontSize:14, textDecoration:"none", fontFamily:"'DM Sans',sans-serif", border:"1px solid rgba(255,255,255,0.25)" }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor="rgba(255,255,255,0.6)"; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor="rgba(255,255,255,0.25)"; }}
                >
                  Scan your supplements
                </a>
              </div>
            </section>
          )}

        </div>

        {/* ── COMPARE PANEL ───────────────────────────────────────────── */}
        <ComparePanel stacks={comparing} onRemove={removeFromCompare} onClear={clearCompare} onScrollToTable={scrollToManual} />

        {/* ── EMAIL CAPTURE STRIP (only when not comparing) ───────────── */}
        {isEmailCaptureActive && activeCatSlug && (
          <EmailCaptureStrip activeCatLabel={activeCatLabel} />
        )}

      </div>
    </>
  );
}