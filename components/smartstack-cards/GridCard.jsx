// components/smartstack-cards/GridCard.jsx
//
//  ┌─────────────────────────────┐
//  │  Product image  (4:3)       │  Clean. 🔥 bought pill only. No badge clutter.
//  ├─────────────────────────────┤
//  │ ● BEST VALUE                │  Tier inline with name. Not a banner.
//  │  Product name               │  2-line max.
//  ├─────────────────────────────┤
//  │  54% below avg              │  THE HERO. Big number. The reason to buy.
//  │  vs. category median        │  Supporting copy, small.
//  │  ★ 4.5  ·  $0.26/srv        │  Proof. Quiet.
//  ├─────────────────────────────┤
//  │  Buy on Amazon — $23.10     │  Orange. Full width. One line.
//  ├─────────────────────────────┤
//  │  [Compare]  [Check Safety]  │  Equal secondaries.
//  └─────────────────────────────┘
"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useOCR } from "@/hooks/useOCR";

/* ─── Tokens ─────────────────────────────────────────────────────────────── */
const C = {
  brand:         "#1A3A5C",
  brandBg:       "#EEF3F9",
  brandBorder:   "#C0D0E0",
  safe:          "#15803D",
  safeBg:        "#DCFCE7",
  safeBorder:    "#BBF7D0",
  caution:       "#854D0E",
  cautionBg:     "#FEF9C3",
  cautionBorder: "#FEF08A",
  banned:        "#C8102E",
  bannedBg:      "#FFF0F0",
  bannedBorder:  "#FFC8C8",
  body:          "#1C1917",
  muted:         "#6B6259",
  dim:           "#A8A29E",
  border:        "#E7E2D9",
  cardBg:        "#FFFFFF",
  surface:       "#F9F7F4",
  amazon:        "#FF9900",
  amazonHover:   "#E68A00",
};

const TIER = {
  best:   { label:"Best Value",   dot:"#16A34A", text:"#15803D" },
  good:   { label:"Good Value",   dot:"#3B82F6", text:"#1D4ED8" },
  decent: { label:"Decent Value", dot:"#D97706", text:"#92400E" },
};

/* ─── Pure helpers ───────────────────────────────────────────────────────── */
function fmtPPS(pps) {
  if (pps == null) return null;
  return `$${pps < 0.10 ? pps.toFixed(3) : pps.toFixed(2)}`;
}

function fmtK(n) {
  const v = Number(n);
  if (!Number.isFinite(v) || v <= 0) return null;
  return v >= 1000 ? `${(v / 1000).toFixed(v % 1000 === 0 ? 0 : 1)}k` : String(Math.round(v));
}

function pctDiff(pps, stats, category) {
  if (pps == null || !stats || !category) return null;
  const info = stats[String(category).trim()];
  if (!info?.median || info.count < 3) return null;
  const diff = (info.median - pps) / info.median;
  if (Math.abs(diff) < 0.02) return null;
  const pct = Math.round(Math.abs(diff) * 100);
  return diff > 0
    ? { pct, dir:"below" }
    : { pct, dir:"above" };
}

/* ─── fetchLabelAsFile ───────────────────────────────────────────────────── */
async function fetchLabelAsFile(url) {
  if (!url) throw new Error("No image URL");
  try {
    const r = await fetch(url, { mode:"cors" });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const b = await r.blob();
    return new File([b], `label.${b.type.includes("png")?"png":"jpg"}`, { type:b.type||"image/jpeg" });
  } catch { /* CORS — proxy */ }
  const r = await fetch(`/api/ocr/proxy-image?url=${encodeURIComponent(url)}`);
  if (!r.ok) throw new Error(`Proxy failed (${r.status})`);
  const b = await r.blob();
  return new File([b], `label.${b.type.includes("png")?"png":"jpg"}`, { type:b.type||"image/jpeg" });
}

/* ─── Scan loading overlay ───────────────────────────────────────────────── */
function ScanOverlay({ label }) {
  return (
    <motion.div
      initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
      transition={{ duration:0.14 }}
      style={{
        position:"absolute", inset:0, zIndex:30,
        background:"rgba(249,247,244,0.95)", backdropFilter:"blur(6px)",
        borderRadius:14,
        display:"flex", flexDirection:"column",
        alignItems:"center", justifyContent:"center", gap:14,
      }}
    >
      <div style={{ position:"relative", width:40, height:40 }}>
        <div style={{ position:"absolute", inset:0, borderRadius:"50%", border:`2px solid ${C.brandBorder}` }} />
        <div style={{
          position:"absolute", inset:0, borderRadius:"50%",
          border:"2px solid transparent", borderTopColor:C.brand,
          animation:"gc-spin 0.8s linear infinite",
        }} />
      </div>
      <div style={{ textAlign:"center", lineHeight:1 }}>
        <p style={{ fontFamily:"'DM Sans',sans-serif", fontSize:11, fontWeight:700, color:C.brand, margin:"0 0 3px" }}>
          {label}
        </p>
        <p style={{ fontFamily:"'DM Sans',sans-serif", fontSize:10, color:C.dim, margin:0 }}>
          CheckPeak Analysis
        </p>
      </div>
      <style>{`@keyframes gc-spin { to { transform:rotate(360deg); } }`}</style>
    </motion.div>
  );
}

/* ─── Scan result panel ──────────────────────────────────────────────────── */
function ScanPanel({ result, onClose }) {
  const banned  = result?.matchedBanned      || [];
  const ings    = result?.matchedIngredients || [];
  const hasBan  = banned.length > 0;
  const hasIngs = ings.length > 0;

  return (
    <motion.div
      initial={{ y:"100%", opacity:0.6 }}
      animate={{ y:0,      opacity:1   }}
      exit={{   y:"100%", opacity:0   }}
      transition={{ type:"spring", stiffness:360, damping:34 }}
      style={{
        position:"absolute", bottom:0, left:0, right:0, zIndex:30,
        background:"#fff",
        borderRadius:"0 0 14px 14px",
        borderTop:`2.5px solid ${hasBan ? C.banned : C.safe}`,
        boxShadow:"0 -6px 28px rgba(0,0,0,0.1)",
        maxHeight:"80%",
        display:"flex", flexDirection:"column",
        overflow:"hidden",
      }}
      onClick={e => e.stopPropagation()}
    >
      <div style={{ display:"flex", justifyContent:"center", paddingTop:8, paddingBottom:4, flexShrink:0 }}>
        <div style={{ width:28, height:3, borderRadius:99, background:C.border }} />
      </div>
      <div style={{ padding:"0 12px 10px", flexShrink:0, display:"flex", alignItems:"center", justifyContent:"space-between" }}>
        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
          <div style={{
            width:30, height:30, borderRadius:8, flexShrink:0, fontSize:15,
            background: hasBan ? C.bannedBg : C.safeBg,
            border:`1px solid ${hasBan ? C.bannedBorder : C.safeBorder}`,
            display:"flex", alignItems:"center", justifyContent:"center",
          }}>
            {hasBan ? "⚠️" : "✅"}
          </div>
          <div>
            <p style={{ fontFamily:"'DM Sans',sans-serif", fontSize:12, fontWeight:800, color:hasBan?C.banned:C.safe, margin:0, lineHeight:1.25 }}>
              {hasBan ? `${banned.length} substance${banned.length>1?"s":""} flagged` : "No banned substances"}
            </p>
            <p style={{ fontFamily:"'DM Sans',sans-serif", fontSize:10, color:C.dim, margin:0 }}>
              {hasIngs ? `${ings.length} ingredient${ings.length>1?"s":""} identified` : "vs. CheckPeak database"}
            </p>
          </div>
        </div>
        <button type="button" onClick={onClose} aria-label="Close"
          style={{ background:"none", border:"none", cursor:"pointer", color:C.dim, padding:4, display:"flex", alignItems:"center", justifyContent:"center" }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" d="M18 6L6 18M6 6l12 12"/>
          </svg>
        </button>
      </div>
      <div style={{ flex:1, overflowY:"auto", padding:"0 12px 16px", display:"flex", flexDirection:"column", gap:10 }}>
        {hasBan && (
          <div>
            <p style={{ fontFamily:"'DM Sans',sans-serif", fontSize:9, fontWeight:800, textTransform:"uppercase", letterSpacing:"0.1em", color:C.banned, margin:"0 0 6px" }}>Flagged</p>
            {banned.map((b, i) => {
              const f    = b?.fields || b || {};
              const name = f["Substance Name"] || f["Name"] || "Unknown";
              const type = f["Ban Type"] || f["Banned By"] || "";
              const note = f["Notes"] || "";
              return (
                <div key={i} style={{ marginBottom:i<banned.length-1?5:0, background:C.bannedBg, borderLeft:`3px solid ${C.banned}`, borderRadius:"0 8px 8px 0", padding:"7px 10px" }}>
                  <p style={{ fontFamily:"'DM Sans',sans-serif", fontSize:12, fontWeight:800, color:C.banned, margin:"0 0 1px" }}>{name}</p>
                  {type && <p style={{ fontFamily:"'DM Sans',sans-serif", fontSize:10, color:C.banned, opacity:0.7, margin:0 }}>{type}</p>}
                  {note && <p style={{ fontFamily:"'DM Sans',sans-serif", fontSize:10, color:C.muted, margin:"3px 0 0", lineHeight:1.5 }}>{String(note).slice(0,120)}{note.length>120?"…":""}</p>}
                </div>
              );
            })}
          </div>
        )}
        {hasIngs && (
          <div>
            <p style={{ fontFamily:"'DM Sans',sans-serif", fontSize:9, fontWeight:800, textTransform:"uppercase", letterSpacing:"0.1em", color:C.brand, margin:"0 0 6px" }}>Ingredients ({ings.length})</p>
            <div style={{ display:"flex", flexWrap:"wrap", gap:"4px 5px" }}>
              {ings.slice(0,16).map((ing, i) => {
                const f    = ing?.fields || ing || {};
                const name = f["Ingredient Name"] || f["Name"] || "?";
                return (
                  <span key={i} style={{ fontFamily:"'DM Sans',sans-serif", fontSize:10, fontWeight:600, lineHeight:1.7, padding:"1px 8px", borderRadius:99, background:C.brandBg, color:C.brand, border:`1px solid ${C.brandBorder}` }}>
                    {name}
                  </span>
                );
              })}
              {ings.length > 16 && <span style={{ fontFamily:"'DM Sans',sans-serif", fontSize:10, color:C.dim, alignSelf:"center" }}>+{ings.length-16}</span>}
            </div>
          </div>
        )}
        {!hasBan && !hasIngs && (
          <p style={{ fontFamily:"'DM Sans',sans-serif", fontSize:11, color:C.dim, textAlign:"center", margin:"12px 0" }}>No matches in our database.</p>
        )}
      </div>
      <div style={{ padding:"7px 12px", borderTop:`1px solid ${C.border}`, flexShrink:0, background:C.surface }}>
        <p style={{ fontFamily:"'DM Sans',sans-serif", fontSize:9, color:C.dim, margin:0, textAlign:"center" }}>
          CheckPeak banned substances + ingredient database
        </p>
      </div>
    </motion.div>
  );
}

/* ─── GridCard ───────────────────────────────────────────────────────────── */
export default function GridCard({
  stack,
  onCompare,
  isComparing,
  valueTier,
  pps,
  stats,
  rank,
  totalInCat,
}) {
  const tm        = valueTier ? TIER[valueTier] : null;
  const hasImg    = Boolean(stack?.imageUrl);
  const rating    = Number(stack?.rating) || 0;
  const hasRating = rating > 0;
  const ppsStr    = fmtPPS(pps);
  const bought    = fmtK(stack?.boughtLastMonth);
  const diff      = pctDiff(pps, stats, stack?.category);

  const fullPrice = (() => {
    const p = Number(stack?.Price || stack?.price);
    return Number.isFinite(p) && p > 0 ? `$${p.toFixed(2)}` : null;
  })();

  /* ── Scan state ── */
  const [phase,      setPhase]      = useState("idle");
  const [scanResult, setScanResult] = useState(null);
  const [scanError,  setScanError]  = useState("");
  const abortRef = useRef(null);

  const canScan   = Boolean(stack?.nutritionLabel);
  const hasBanned = (scanResult?.matchedBanned?.length || 0) > 0;
  const isLoading = ["fetching","ocr","checking"].includes(phase);
  const isDone    = phase === "done";
  const isError   = phase === "error";

  const loadingLabel = { fetching:"Fetching label…", ocr:"Reading text…", checking:"Checking…" }[phase] || "Scanning…";

  const handleOCRResult = useCallback(async (text) => {
    const t = String(text||"").trim();
    if (!t) { setPhase("error"); setScanError("Couldn't read label."); return; }
    setPhase("checking");
    try {
      const r    = await fetch("/api/check", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ ingredientsText:t }), credentials:"include" });
      const data = await r.json().catch(()=>({}));
      if (!r.ok) throw new Error(data?.error||`Check failed (${r.status})`);
      setScanResult(data); setPhase("done");
    } catch(err) { setScanError(err?.message||"Scan failed."); setPhase("error"); }
  }, []);

  const { scanState, startScan } = useOCR({ onScan:handleOCRResult });

  useEffect(() => {
    if (scanState.error && phase==="ocr") { setScanError(scanState.error); setPhase("error"); }
  }, [scanState.error, phase]);

  useEffect(() => {
    if (phase!=="error") return;
    const t = setTimeout(() => { setPhase("idle"); setScanError(""); }, 4000);
    return () => clearTimeout(t);
  }, [phase]);

  const handleScan = useCallback(async (e) => {
    e.stopPropagation();
    if (isDone) { setPhase("idle"); setScanResult(null); return; }
    if (isLoading || !canScan) return;
    abortRef.current?.abort();
    setPhase("fetching"); setScanError(""); setScanResult(null);
    try {
      const file = await fetchLabelAsFile(stack.nutritionLabel);
      setPhase("ocr");
      await startScan([file]);
    } catch(err) { setScanError(err?.message||"Could not load label."); setPhase("error"); }
  }, [isDone, isLoading, canScan, stack, startScan]);

  const closeScan   = useCallback(() => { setPhase("idle"); setScanResult(null); }, []);

  const trackAmazon = useCallback(() => {
    try {
      window.gtag?.("event","amazon_click",{ supplement_name:stack?.name||"", category:stack?.category||"", value_tier:valueTier??"unknown" });
      window.dataLayer?.push({ event:"amazon_click", supplement_name:stack?.name||"" });
    } catch {}
  }, [stack, valueTier]);

  /* ─── render ─────────────────────────────────────────────────────────── */
  return (
    <motion.div
      layout
      style={{
        background:    C.cardBg,
        border:        isComparing ? `2px solid ${C.brand}` : `1px solid ${C.border}`,
        borderRadius:  14,
        overflow:      "hidden",
        display:       "flex",
        flexDirection: "column",
        position:      "relative",
        fontFamily:    "'DM Sans',sans-serif",
        boxShadow:     isComparing
          ? `0 0 0 4px rgba(26,58,92,0.07), 0 4px 20px rgba(26,58,92,0.1)`
          : "0 1px 3px rgba(0,0,0,0.07), 0 4px 14px rgba(0,0,0,0.04)",
      }}
      whileHover={{
        y: isComparing ? 0 : -2,
        boxShadow: isComparing
          ? `0 0 0 4px rgba(26,58,92,0.07), 0 6px 24px rgba(26,58,92,0.12)`
          : "0 2px 8px rgba(0,0,0,0.09), 0 10px 28px rgba(0,0,0,0.06)",
      }}
      transition={{ duration:0.15 }}
    >

      {/* ── HERO IMAGE — one overlay max ────────────────────────────── */}
      <div style={{
        position:"relative", aspectRatio:"4/3", flexShrink:0,
        background: hasImg ? C.surface : "linear-gradient(145deg,#EEF3F9,#E0EAF4)",
        overflow:"hidden",
      }}>
        {hasImg ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={stack.imageUrl} alt={stack?.name||"Supplement"}
            style={{ width:"100%", height:"100%", objectFit:"contain", padding:12 }}
            loading="lazy"
            onError={e => { e.currentTarget.style.display="none"; }}
          />
        ) : (
          <div style={{ width:"100%", height:"100%", display:"flex", alignItems:"center", justifyContent:"center" }}>
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke={C.brandBorder} strokeWidth={1.2}>
              <path d="M9 3H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2V5a2 2 0 00-2-2h-4"/>
              <path d="M9 3a3 3 0 006 0"/><circle cx="12" cy="14" r="3"/>
            </svg>
          </div>
        )}

        {/* Vignette */}
        <div style={{
          position:"absolute", bottom:0, left:0, right:0, height:"40%",
          background:"linear-gradient(to top,rgba(0,0,0,0.2),transparent)",
          pointerEvents:"none",
        }} aria-hidden="true" />

        {/* Bought — the ONE image overlay. Social proof. Nothing else competes. */}
        {bought && (
          <div style={{
            position:"absolute", bottom:8, left:8,
            padding:"3px 9px", borderRadius:99,
            background:"rgba(0,0,0,0.48)", backdropFilter:"blur(6px)",
          }}>
            <span style={{ fontFamily:"'DM Sans',sans-serif", fontSize:9, fontWeight:700, color:"rgba(255,255,255,0.92)" }}>
              🔥 {bought}+ last mo.
            </span>
          </div>
        )}

        {/* Compare check — top-right */}
        <AnimatePresence>
          {isComparing && (
            <motion.div
              initial={{ scale:0, opacity:0 }} animate={{ scale:1, opacity:1 }} exit={{ scale:0, opacity:0 }}
              transition={{ type:"spring", stiffness:420, damping:22 }}
              style={{
                position:"absolute", top:8, right:8,
                width:22, height:22, borderRadius:"50%",
                background:C.brand, border:"2px solid #fff",
                display:"flex", alignItems:"center", justifyContent:"center",
                boxShadow:"0 2px 6px rgba(26,58,92,0.3)",
              }}
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/>
              </svg>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Safety result badge — top-left, post-scan only */}
        <AnimatePresence>
          {isDone && (
            <motion.div
              initial={{ opacity:0, scale:0.85 }} animate={{ opacity:1, scale:1 }} exit={{ opacity:0, scale:0.85 }}
              style={{
                position:"absolute", top:8, left:8,
                padding:"3px 9px", borderRadius:99,
                background: hasBanned ? "rgba(200,16,46,0.85)" : "rgba(21,128,61,0.85)",
                backdropFilter:"blur(4px)",
              }}
            >
              <span style={{ fontSize:9, fontWeight:800, color:"#fff" }}>
                {hasBanned ? `⚠ ${scanResult.matchedBanned.length} flag` : "✓ Clear"}
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── IDENTITY: tier dot + name, no band ───────────────────────── */}
      <div style={{ padding:"10px 12px 0" }}>
        {tm && (
          <div style={{ display:"flex", alignItems:"center", gap:5, marginBottom:4 }}>
            <div style={{ width:6, height:6, borderRadius:"50%", background:tm.dot, flexShrink:0 }} />
            <span style={{
              fontFamily:"'DM Sans',sans-serif", fontSize:9, fontWeight:800,
              textTransform:"uppercase", letterSpacing:"0.07em",
              color:tm.text, lineHeight:1,
            }}>
              {tm.label}
            </span>
          </div>
        )}
        <p style={{
          fontFamily:"'DM Sans',sans-serif", fontSize:12, fontWeight:700,
          color:C.body, lineHeight:1.4, margin:0,
          display:"-webkit-box", WebkitLineClamp:2, WebkitBoxOrient:"vertical", overflow:"hidden",
        }}>
          {stack?.name || "Untitled"}
        </p>
      </div>

      {/* ── HERO STAT: % diff — the reason to buy ────────────────────── */}
      <div style={{ padding:"8px 12px 6px" }}>
        {diff ? (
          <>
            <p style={{
              fontFamily:"'DM Sans',sans-serif",
              fontSize:26, fontWeight:800,
              color: diff.dir === "below" ? C.body : C.muted,
              lineHeight:1, margin:"0 0 3px",
              letterSpacing:"-0.02em",
            }}>
              {diff.pct}%{" "}
              <span style={{ fontSize:14, fontWeight:600, color:C.muted, letterSpacing:0 }}>
                {diff.dir} avg
              </span>
            </p>
            <p style={{ fontFamily:"'DM Sans',sans-serif", fontSize:10, color:C.dim, margin:0, lineHeight:1.4 }}>
              vs. category median · per serving
            </p>
          </>
        ) : (
          <p style={{ fontFamily:"'DM Sans',sans-serif", fontSize:10, color:C.dim, margin:0, lineHeight:1.4, minHeight:38 }}>
            Price comparison unavailable
          </p>
        )}
      </div>

      {/* ── PROOF: rating + pps — supporting, quiet ──────────────────── */}
      <div style={{ padding:"0 12px 10px", display:"flex", alignItems:"center", gap:5 }}>
        {hasRating && (
          <>
            <span style={{ fontSize:11, color:"#F59E0B", flexShrink:0 }}>★</span>
            <span style={{ fontFamily:"'DM Sans',sans-serif", fontSize:11, fontWeight:700, color:C.body, flexShrink:0 }}>
              {rating.toFixed(1)}
            </span>
          </>
        )}
        {hasRating && ppsStr && <span style={{ fontSize:11, color:C.dim, flexShrink:0 }}>·</span>}
        {ppsStr && (
          <>
            <span style={{ fontFamily:"'Libre Baskerville',Georgia,serif", fontSize:12, fontWeight:700, color:C.body, flexShrink:0 }}>
              {ppsStr}
            </span>
            <span style={{ fontFamily:"'DM Sans',sans-serif", fontSize:10, color:C.dim, flexShrink:0 }}>/srv</span>
          </>
        )}
        {!hasRating && !ppsStr && <span style={{ fontSize:10, color:C.dim }}>—</span>}
      </div>

      {/* ── AMAZON CTA — single line ──────────────────────────────────── */}
      <div style={{ padding:"0 12px 7px" }}>
        {stack?.affiliateLink ? (
          <motion.a
            href={stack.affiliateLink} target="_blank" rel="noopener noreferrer"
            onClick={e => { e.stopPropagation(); trackAmazon(); }}
            whileTap={{ scale:0.97 }}
            style={{
              display:"flex", alignItems:"center", justifyContent:"center", gap:5,
              padding:"10px", borderRadius:10, textDecoration:"none",
              background:C.amazon, color:"#fff",
              fontFamily:"'DM Sans',sans-serif",
              fontSize:11, fontWeight:800, lineHeight:1,
              boxShadow:"0 2px 8px rgba(255,153,0,0.32)",
              whiteSpace:"nowrap",
            }}
            onMouseEnter={e => { e.currentTarget.style.background=C.amazonHover; }}
            onMouseLeave={e => { e.currentTarget.style.background=C.amazon; }}
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} style={{ flexShrink:0 }}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/>
            </svg>
            {fullPrice ? `Buy on Amazon — ${fullPrice}` : "View on Amazon"}
          </motion.a>
        ) : (
          <div style={{
            padding:"10px 14px", borderRadius:10, textAlign:"center",
            background:C.surface, border:`1px solid ${C.border}`,
            fontFamily:"'DM Sans',sans-serif", fontSize:11, color:C.dim,
          }}>
            Link unavailable
          </div>
        )}
      </div>

      {/* ── SECONDARIES: Compare + Check Safety ───────────────────────── */}
      <div style={{ padding:"0 12px 12px", display:"flex", gap:7 }}>

        <motion.button
          type="button"
          onClick={e => { e.stopPropagation(); onCompare?.(stack); }}
          whileTap={{ scale:0.96 }}
          aria-pressed={isComparing}
          style={{
            flex:1, display:"flex", alignItems:"center", justifyContent:"center", gap:5,
            padding:"7px 10px", borderRadius:9, cursor:"pointer",
            fontFamily:"'DM Sans',sans-serif", fontSize:10, fontWeight:700,
            background:  isComparing ? C.brandBg : "transparent",
            border:      isComparing ? `1.5px solid ${C.brand}` : `1px solid ${C.border}`,
            color:       isComparing ? C.brand : C.muted,
            transition:"all 0.12s",
          }}
          onMouseEnter={e => { if(!isComparing){ e.currentTarget.style.background=C.brandBg; e.currentTarget.style.borderColor=C.brand; e.currentTarget.style.color=C.brand; }}}
          onMouseLeave={e => { if(!isComparing){ e.currentTarget.style.background="transparent"; e.currentTarget.style.borderColor=C.border; e.currentTarget.style.color=C.muted; }}}
        >
          {isComparing ? (
            <>
              <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/>
              </svg>
              Added
            </>
          ) : (
            <>
              <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" d="M9 3H5a2 2 0 00-2 2v14a2 2 0 002 2h4M15 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4M9 3v18M15 3v18"/>
              </svg>
              Compare
            </>
          )}
        </motion.button>

        {/* "Check Safety" — clear intent, no jargon */}
        {canScan ? (
          <motion.button
            type="button" onClick={handleScan} disabled={isLoading}
            whileTap={{ scale:0.96 }}
            aria-label={isDone ? "View safety results" : "Check safety"}
            style={{
              flex:1, display:"flex", alignItems:"center", justifyContent:"center", gap:5,
              padding:"7px 6px", borderRadius:9,
              cursor:     isLoading ? "wait" : "pointer",
              fontFamily:"'DM Sans',sans-serif", fontSize:10, fontWeight:700,
              opacity:    isLoading ? 0.6 : 1,
              background: isDone  ? (hasBanned ? C.bannedBg : C.safeBg)
                        : isError ? C.bannedBg : "transparent",
              border:     isDone  ? `1.5px solid ${hasBanned ? C.bannedBorder : C.safeBorder}`
                        : isError ? `1.5px solid ${C.bannedBorder}` : `1px solid ${C.border}`,
              color:      isDone  ? (hasBanned ? C.banned : C.safe)
                        : isError ? C.banned : C.muted,
              transition:"all 0.12s",
              whiteSpace:"nowrap",
            }}
            onMouseEnter={e => { if(!isLoading && !isDone && !isError){ e.currentTarget.style.background=C.brandBg; e.currentTarget.style.borderColor=C.brandBorder; e.currentTarget.style.color=C.brand; }}}
            onMouseLeave={e => { if(!isLoading && !isDone && !isError){ e.currentTarget.style.background="transparent"; e.currentTarget.style.borderColor=C.border; e.currentTarget.style.color=C.muted; }}}
          >
            {isLoading ? (
              <span style={{ display:"inline-block", width:10, height:10, borderRadius:"50%", border:"1.5px solid currentColor", borderTopColor:"transparent", animation:"gc-spin 0.65s linear infinite" }} />
            ) : isDone ? (
              hasBanned ? "⚠ Flags" : "✓ Clear"
            ) : isError ? "Retry" : "Check Safety"}
          </motion.button>
        ) : (
          <div style={{
            flex:1, display:"flex", alignItems:"center", justifyContent:"center",
            padding:"7px 10px", borderRadius:9,
            background:"transparent", border:`1px solid ${C.border}`,
            fontFamily:"'DM Sans',sans-serif", fontSize:10, color:C.dim,
          }}>
            No label
          </div>
        )}
      </div>

      {/* ── OVERLAYS ─────────────────────────────────────────────────── */}
      <AnimatePresence>{isLoading && <ScanOverlay label={loadingLabel} />}</AnimatePresence>
      <AnimatePresence>{isDone && scanResult && <ScanPanel result={scanResult} onClose={closeScan} />}</AnimatePresence>

      <style>{`@keyframes gc-spin { to { transform:rotate(360deg); } }`}</style>
    </motion.div>
  );
}