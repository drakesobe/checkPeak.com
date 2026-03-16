// components/smartstack-cards/StackCard.jsx
"use client";

import { useMemo, useRef, useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FaDumbbell, FaBolt, FaLeaf, FaCoffee, FaAppleAlt,
  FaCapsules, FaHeart, FaLock, FaSignInAlt, FaTimes,
} from "react-icons/fa";
import ValueBadge from "./ValueBadge";
import { useAuthContext } from "@/hooks/useAuth";

/* -------------------------------------------------------------------------- */
/* Static data                                                                 */
/* -------------------------------------------------------------------------- */
const SUPPLEMENT_ICONS = {
  "Caffeine":             <FaCoffee />,
  "L-Theanine":           <FaLeaf />,
  "B-Vitamins":           <FaCapsules />,
  "Creatine Monohydrate": <FaDumbbell />,
  "L-Glutamine":          <FaLeaf />,
  "BCAAs":                <FaDumbbell />,
  "Omega-3":              <FaCapsules />,
  "Bacopa Monnieri":      <FaLeaf />,
  "Rhodiola Rosea":       <FaLeaf />,
  "Beta-Alanine":         <FaDumbbell />,
  "L-Citrulline":         <FaDumbbell />,
  "Electrolytes":         <FaBolt />,
  "Vitamin C":            <FaAppleAlt />,
  "Zinc":                 <FaCapsules />,
  "Elderberry":           <FaAppleAlt />,
};

/* -------------------------------------------------------------------------- */
/* Helpers                                                                     */
/* -------------------------------------------------------------------------- */
function normalizeId(v) {
  if (v == null) return "";
  return String(v);
}

function openLogin(reason = "auth_required") {
  if (typeof window === "undefined") return;
  try {
    if (typeof window.__openLoginModal === "function") {
      window.__openLoginModal({ reason, tab: "login" });
      return;
    }
    window.dispatchEvent(new CustomEvent("auth:open", { detail: { reason, tab: "login" } }));
  } catch {
    window.location.href = `/?login=1&reason=${encodeURIComponent(reason)}`;
  }
}

function formatPricePerServing(stack) {
  const directCandidates = [
    stack?.pricePerServing, stack?.PricePerServing,
    stack?.costPerServing,  stack?.CostPerServing,
    stack?.valueBasis,      stack?.ValueBasis,
  ];
  for (const c of directCandidates) {
    const n = Number(c);
    if (Number.isFinite(n) && n > 0) return `$${n.toFixed(2)}/serving`;
  }
  const priceCandidates    = [stack?.price, stack?.Price, stack?.amazonPrice, stack?.AmazonPrice, stack?.salePrice, stack?.SalePrice];
  const servingsCandidates = [stack?.servings, stack?.Servings, stack?.servingsPerContainer, stack?.ServingsPerContainer];
  let price = null, servings = null;
  for (const c of priceCandidates)    { const n = Number(c); if (Number.isFinite(n) && n > 0) { price    = n; break; } }
  for (const c of servingsCandidates) { const n = Number(c); if (Number.isFinite(n) && n > 0) { servings = n; break; } }
  if (price && servings) return `$${(price / servings).toFixed(2)}/serving`;
  return null;
}

// Format review count: 8615 → "8.6k", 847 → "847", 124300 → "124k"
function formatReviewCount(n) {
  if (!Number.isFinite(n) || n <= 0) return null;
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k`;
  return String(Math.round(n));
}

/* -------------------------------------------------------------------------- */
/* RatingRow — ★ 4.4  (8.6k reviews)                                         */
/* -------------------------------------------------------------------------- */
function RatingRow({ rating, reviewCount, compact = false }) {
  if (!rating) return null;
  const r     = Number(rating);
  const count = formatReviewCount(reviewCount);

  if (!Number.isFinite(r) || r <= 0) return null;

  return (
    <div className="flex items-center gap-1.5">
      <span style={{ color: "#FBBF24", fontSize: compact ? 10 : 11 }} aria-hidden="true">★</span>
      <span
        className="font-bold tabular-nums"
        style={{
          color:      "rgba(255,255,255,0.75)",
          fontSize:   compact ? 11 : 12,
          fontFamily: "'Barlow Condensed', sans-serif",
          letterSpacing: "0.02em",
        }}
      >
        {r.toFixed(1)}
      </span>
      {count && (
        <span
          style={{
            color:    "rgba(255,255,255,0.35)",
            fontSize: compact ? 10 : 11,
            fontFamily: "'Barlow Condensed', sans-serif",
          }}
        >
          ({count})
        </span>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* AmazonButton — consistent across compact + full                            */
/* -------------------------------------------------------------------------- */
function AmazonButton({ href, compact = false }) {
  if (!href) return null;

  const handleClick = (e) => {
    e.stopPropagation();
    if (typeof window.gtag === "function") {
      window.gtag("event", "conversion", { send_to: "AW-17990566633/eJHlCOT724YcEOmFyYJD" });
    }
  };

  if (compact) {
    // Full-width button on mobile — same treatment as Scan Label
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="w-full py-1.5 rounded-lg text-[11px] font-semibold text-center transition-all block"
        style={{
          background: "rgba(255,255,255,0.05)",
          border:     "1px solid rgba(255,255,255,0.10)",
          color:      "rgba(255,255,255,0.55)",
          fontFamily: "'Barlow Condensed', sans-serif",
        }}
        onClick={handleClick}
        onTouchStart={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.09)"; }}
        onTouchEnd={(e)   => { e.currentTarget.style.background = "rgba(255,255,255,0.05)"; }}
      >
        View on Amazon ↗
      </a>
    );
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="w-full py-2 rounded-xl text-xs font-semibold text-center transition-all block"
      style={{
        background: "rgba(255,255,255,0.04)",
        border:     "1px solid rgba(255,255,255,0.08)",
        color:      "rgba(255,255,255,0.55)",
        fontFamily: "'Barlow Condensed', sans-serif",
      }}
      onClick={handleClick}
      onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.07)"; e.currentTarget.style.color = "rgba(255,255,255,0.85)"; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.04)"; e.currentTarget.style.color = "rgba(255,255,255,0.55)"; }}
    >
      View on Amazon
    </a>
  );
}

/* -------------------------------------------------------------------------- */
/* StackCard                                                                   */
/* -------------------------------------------------------------------------- */
export default function StackCard({
  stack,
  setModalStack,
  selectedCompareStacks,
  setSelectedCompareStacks,
  savedStacks,
  setSavedStacks,
  userEmail: userEmailProp,
  maxCompare   = 3,
  maxSuppPills = 5,
  compact      = false,
  index        = 0,
}) {
  const { user } = useAuthContext();

  const userEmail = useMemo(() => {
    const raw   = userEmailProp || user?.Email || user?.email || "";
    const clean = String(raw).trim().toLowerCase();
    return clean.includes("@") ? clean : "";
  }, [userEmailProp, user]);

  const stackId = useMemo(() => normalizeId(stack?.id), [stack?.id]);

  const savedRecord = useMemo(() => {
    const list = Array.isArray(savedStacks) ? savedStacks : [];
    return list.find((s) => normalizeId(s?.StackID || s?.id) === stackId) ?? null;
  }, [savedStacks, stackId]);

  const isSaved    = Boolean(savedRecord);
  const isSelected = useMemo(
    () => selectedCompareStacks.some((s) => normalizeId(s?.id) === stackId),
    [selectedCompareStacks, stackId]
  );

  const canOpenModal = Boolean(stack?.nutritionLabel);
  const priceLabel   = useMemo(() => formatPricePerServing(stack), [stack]);

  const { suppPreview, suppMore } = useMemo(() => {
    const all     = Array.isArray(stack?.supplements) ? stack.supplements : [];
    const deduped = Array.from(new Set(all.map((x) => String(x).trim()).filter(Boolean)));
    return { suppPreview: deduped.slice(0, maxSuppPills), suppMore: Math.max(0, deduped.length - maxSuppPills) };
  }, [stack?.supplements, maxSuppPills]);

  const [saving,        setSaving]        = useState(false);
  const [banner,        setBanner]        = useState("");
  const [authToastOpen, setAuthToastOpen] = useState(false);
  const [pulse,         setPulse]         = useState(false);

  const bannerTimerRef    = useRef(null);
  const authToastTimerRef = useRef(null);
  const pulseTimerRef     = useRef(null);
  const lastAuthToastRef  = useRef(0);

  useEffect(() => () => {
    clearTimeout(bannerTimerRef.current);
    clearTimeout(authToastTimerRef.current);
    clearTimeout(pulseTimerRef.current);
  }, []);

  const showBanner = useCallback((msg) => {
    setBanner(msg);
    clearTimeout(bannerTimerRef.current);
    bannerTimerRef.current = setTimeout(() => setBanner(""), 1800);
  }, []);

  const openAuthToast = useCallback(() => {
    const now = Date.now();
    if (now - lastAuthToastRef.current < 900) return;
    lastAuthToastRef.current = now;
    setAuthToastOpen(true);
    setPulse(true);
    clearTimeout(pulseTimerRef.current);
    pulseTimerRef.current = setTimeout(() => setPulse(false), 650);
    clearTimeout(authToastTimerRef.current);
    authToastTimerRef.current = setTimeout(() => setAuthToastOpen(false), 3200);
    showBanner("Sign in to save stacks.");
  }, [showBanner]);

  const toggleCompare = useCallback((e) => {
    e.stopPropagation();
    setSelectedCompareStacks((prev) => {
      const exists = prev.some((s) => normalizeId(s?.id) === stackId);
      if (exists) return prev.filter((s) => normalizeId(s?.id) !== stackId);
      if (prev.length >= maxCompare) { showBanner(`Max ${maxCompare} stacks to compare.`); return prev; }
      return [...prev, stack];
    });
  }, [stackId, maxCompare, stack, setSelectedCompareStacks, showBanner]);

  const toggleSave = useCallback(async (e) => {
    e.stopPropagation();
    if (!userEmail) { openAuthToast(); return; }
    if (saving) return;
    setSaving(true);

    const optimisticAdd    = () => setSavedStacks((prev) => { const list = Array.isArray(prev) ? prev : []; const exists = list.some((s) => normalizeId(s?.StackID || s?.id) === stackId); return exists ? list : [...list, { StackID: stackId, recordId: null }]; });
    const optimisticRemove = () => setSavedStacks((prev) => { const list = Array.isArray(prev) ? prev : []; return list.filter((s) => normalizeId(s?.StackID || s?.id) !== stackId); });

    const wasSaved = isSaved;
    if (!wasSaved) optimisticAdd(); else optimisticRemove();

    try {
      if (!wasSaved) {
        const res  = await fetch("/api/saveStack", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ UserEmail: userEmail, stack }) });
        if (!res.ok) throw new Error("Failed to save stack");
        const data = await res.json();
        setSavedStacks((data.savedStacks || []).map((s) => ({ ...s, StackID: normalizeId(s.StackID || s.id) })));
        showBanner("Saved!");
      } else {
        const recordId = savedRecord?.recordId;
        if (!recordId) { optimisticAdd(); showBanner("Couldn't unsave. Refresh and try again."); setSaving(false); return; }
        const res  = await fetch("/api/removeSavedStack", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ UserEmail: userEmail, recordId }) });
        if (!res.ok) throw new Error("Failed to remove saved stack");
        const data = await res.json();
        setSavedStacks((data.savedStacks || []).map((s) => ({ ...s, StackID: normalizeId(s.StackID || s.id) })));
        showBanner("Unsaved!");
      }
    } catch (err) {
      console.error("[StackCard] toggleSave error:", err);
      if (!wasSaved) optimisticRemove(); else optimisticAdd();
      showBanner("Save failed. Try again.");
    } finally {
      setSaving(false);
    }
  }, [userEmail, saving, isSaved, stackId, stack, savedRecord, setSavedStacks, openAuthToast, showBanner]);

  const handleCardActivate = useCallback(() => {
    if (canOpenModal) setModalStack(stack);
    else showBanner("No nutrition label available.");
  }, [canOpenModal, stack, setModalStack, showBanner]);

  const handleCardKeyDown = useCallback((e) => {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handleCardActivate(); }
  }, [handleCardActivate]);

  const handleViewNutrition = useCallback((e) => {
    e.stopPropagation();
    if (canOpenModal) setModalStack(stack);
    else showBanner("No nutrition label available.");
  }, [canOpenModal, stack, setModalStack, showBanner]);

  /* -------------------------------------------------------------------------- */
  /* Compact card (mobile)                                                      */
  /* -------------------------------------------------------------------------- */
  if (compact) {
    return (
      <motion.div
        className="relative overflow-hidden flex flex-col cursor-pointer"
        style={{
          background:   "#0D1117",
          border:       isSelected ? "1px solid rgba(91,158,201,0.55)" : "1px solid rgba(255,255,255,0.07)",
          borderRadius: "14px",
          boxShadow:    isSelected ? "0 0 0 2px rgba(91,158,201,0.18), 0 4px 16px rgba(0,0,0,0.4)" : "0 2px 10px rgba(0,0,0,0.3)",
          fontFamily:   "'Barlow', sans-serif",
        }}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0 }}
        whileTap={{ scale: 0.985 }}
        transition={{ duration: 0.18, delay: Math.min(index * 0.04, 0.32) }}
        onClick={handleCardActivate}
        role="button" tabIndex={0} onKeyDown={handleCardKeyDown}
        aria-label={`Stack card: ${stack?.name || "Stack"}`}
        aria-pressed={isSelected}
      >
        {/* Image */}
        <div className="relative w-full overflow-hidden" style={{ aspectRatio: "3/2" }}>
          {stack?.imageUrl ? (
            <>
              <img src={stack.imageUrl} alt={stack?.name || "Stack image"} className="h-full w-full object-cover" loading="lazy" onError={(e) => { e.currentTarget.src = "/fallback-image.svg"; }} />
              <div aria-hidden="true" className="absolute inset-0" style={{ background: "linear-gradient(to bottom, rgba(0,0,0,0.3) 0%, rgba(0,0,0,0) 45%, rgba(13,17,23,0.85) 100%)" }} />
            </>
          ) : (
            <div className="h-full w-full flex items-center justify-center" style={{ background: "rgba(255,255,255,0.02)" }}>
              <FaCapsules size={20} style={{ color: "rgba(255,255,255,0.12)" }} aria-hidden="true" />
            </div>
          )}

          {/* Overlay controls */}
          <div className="absolute top-2 left-2 right-2 flex items-center justify-between">
            <motion.button type="button" onClick={toggleCompare}
              className="flex items-center gap-1 rounded-lg px-2 py-1 transition-all"
              style={{ background: isSelected ? "#5B9EC9" : "rgba(13,17,23,0.75)", border: isSelected ? "1px solid rgba(91,158,201,0.6)" : "1px solid rgba(255,255,255,0.18)", backdropFilter: "blur(6px)", boxShadow: isSelected ? "0 0 10px rgba(91,158,201,0.35)" : "none" }}
              whileTap={{ scale: 0.92 }} aria-label={isSelected ? "Remove from compare" : "Add to compare"} aria-pressed={isSelected}
            >
              {isSelected ? (
                <svg viewBox="0 0 24 24" className="w-2.5 h-2.5 text-white shrink-0" fill="none" stroke="currentColor" strokeWidth={3} aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
              ) : (
                <svg viewBox="0 0 24 24" className="w-2.5 h-2.5 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} style={{ color: "rgba(255,255,255,0.7)" }} aria-hidden="true"><path strokeLinecap="round" d="M9 3H5a2 2 0 00-2 2v14a2 2 0 002 2h4M15 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4M9 3v18M15 3v18" /></svg>
              )}
              <span className="text-[10px] font-bold uppercase tracking-wide" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: isSelected ? "#fff" : "rgba(255,255,255,0.8)" }}>
                {isSelected ? "Added" : "Compare"}
              </span>
            </motion.button>

            <motion.button type="button" onClick={toggleSave}
              className="w-7 h-7 rounded-full flex items-center justify-center"
              style={{ background: isSaved ? "rgba(239,68,68,0.2)" : "rgba(13,17,23,0.72)", border: isSaved ? "1px solid rgba(239,68,68,0.45)" : "1px solid rgba(255,255,255,0.15)", backdropFilter: "blur(6px)", opacity: saving ? 0.5 : 1 }}
              whileTap={{ scale: 0.92 }}
              animate={pulse ? { scale: [1, 1.15, 1], rotate: [0, -8, 8, 0] } : { scale: 1 }}
              transition={pulse ? { duration: 0.28 } : { type: "spring", stiffness: 520, damping: 18 }}
              aria-label={isSaved ? "Unsave stack" : "Save stack"} aria-pressed={isSaved} disabled={saving}
            >
              <FaHeart size={11} style={{ color: isSaved ? "#ef4444" : "rgba(255,255,255,0.5)" }} />
            </motion.button>
          </div>

          {stack?.category && (
            <div className="absolute bottom-2 left-2 rounded-md px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-widest"
              style={{ background: "rgba(13,17,23,0.78)", border: "1px solid rgba(255,255,255,0.08)", backdropFilter: "blur(4px)", color: "rgba(255,255,255,0.45)", fontFamily: "'Barlow Condensed', sans-serif" }}>
              {stack.category}
            </div>
          )}
        </div>

        {/* Card body */}
        <div className="flex flex-col px-2.5 pt-2 pb-3 gap-2">
          <h3 className="font-bold text-white leading-snug line-clamp-2"
            style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "clamp(0.78rem, 2.5vw, 0.9rem)", letterSpacing: "0.015em", minHeight: "2.4em" }}>
            {stack?.name || "Untitled Stack"}
          </h3>

          {/* Rating — only shown if present */}
          <RatingRow rating={stack?.rating} reviewCount={stack?.reviewCount} compact />

          {/* Value badge carries the price context */}
          <ValueBadge
            valueScore={stack?.valueScore}
            valueLabel={stack?.valueLabel}
            pricePerServing={stack?.pricePerServing}
          />

          {/* Auth toast */}
          <AnimatePresence>
            {authToastOpen && (
              <motion.div key="authToast" className="overflow-hidden rounded-xl border"
                style={{ background: "rgba(13,17,23,0.95)", border: "1px solid rgba(255,255,255,0.1)" }}
                initial={{ opacity: 0, y: 6, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0 }}
                onClick={(e) => e.stopPropagation()}>
                <div className="px-2.5 py-2 flex items-center gap-2">
                  <FaLock size={9} style={{ color: "rgba(255,255,255,0.5)" }} />
                  <p className="text-[11px] text-white font-semibold flex-1">Sign in to save</p>
                  <button type="button" onClick={() => setAuthToastOpen(false)} style={{ color: "rgba(255,255,255,0.3)" }} aria-label="Dismiss"><FaTimes size={9} /></button>
                </div>
                <div className="px-2.5 pb-2 flex gap-1.5">
                  <button type="button" className="flex-1 rounded-lg py-1.5 text-[11px] font-semibold text-white text-center" style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.1)" }} onClick={() => openLogin("save_stack")}>Sign in</button>
                  <button type="button" className="flex-1 rounded-lg py-1.5 text-[11px] font-semibold text-white text-center" style={{ background: "#5B9EC9" }} onClick={() => openLogin("save_stack")}>Register</button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Scan label CTA */}
          <button type="button" onClick={handleViewNutrition} disabled={!canOpenModal}
            className="w-full py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wide transition-all mt-auto"
            style={{ background: canOpenModal ? "rgba(91,158,201,0.14)" : "rgba(255,255,255,0.03)", border: canOpenModal ? "1px solid rgba(91,158,201,0.3)" : "1px solid rgba(255,255,255,0.05)", color: canOpenModal ? "#5B9EC9" : "rgba(255,255,255,0.2)", cursor: canOpenModal ? "pointer" : "not-allowed", fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: "0.06em" }}>
            {canOpenModal ? "Scan Label" : "No label"}
          </button>

          {/* Amazon — full-width button, not tiny text */}
          <AmazonButton href={stack?.affiliateLink} compact />

          {/* Banner */}
          <AnimatePresence>
            {banner && (
              <motion.p key={banner} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.12 }}
                className="text-[10px] text-center" style={{ color: "rgba(255,255,255,0.5)" }} role="status" aria-live="polite">
                {banner}
              </motion.p>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    );
  }

  /* -------------------------------------------------------------------------- */
  /* Full card (tablet / desktop)                                               */
  /* -------------------------------------------------------------------------- */
  return (
    <motion.div
      className="relative overflow-hidden flex flex-col cursor-pointer"
      style={{
        background:   "#0D1117",
        border:       isSelected ? "1px solid rgba(91,158,201,0.55)" : "1px solid rgba(255,255,255,0.07)",
        borderRadius: "16px",
        boxShadow:    isSelected ? "0 0 0 3px rgba(91,158,201,0.2), 0 8px 32px rgba(0,0,0,0.4)" : "0 4px 16px rgba(0,0,0,0.3)",
        fontFamily:   "'Barlow', sans-serif",
      }}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      whileHover={{ scale: 1.015, boxShadow: isSelected ? "0 0 0 3px rgba(91,158,201,0.3), 0 16px 40px rgba(0,0,0,0.5)" : "0 12px 36px rgba(0,0,0,0.5)", borderColor: isSelected ? "rgba(91,158,201,0.7)" : "rgba(255,255,255,0.13)" }}
      transition={{ duration: 0.22, delay: Math.min(index * 0.035, 0.28) }}
      onClick={handleCardActivate}
      role="button" tabIndex={0} onKeyDown={handleCardKeyDown}
      aria-label={`Stack card: ${stack?.name || "Stack"}`}
      aria-pressed={isSelected}
    >
      {/* Image */}
      <div className="relative w-full overflow-hidden" style={{ aspectRatio: "4/3" }}>
        {stack?.imageUrl ? (
          <>
            <img src={stack.imageUrl} alt={stack?.name || "Stack image"} className="h-full w-full object-cover transition-transform duration-500" style={{ transformOrigin: "center" }} loading="lazy" onError={(e) => { e.currentTarget.src = "/fallback-image.svg"; }} />
            <div aria-hidden="true" className="absolute inset-0" style={{ background: "linear-gradient(to bottom, rgba(0,0,0,0.35) 0%, rgba(0,0,0,0) 40%, rgba(13,17,23,0.8) 100%)" }} />
          </>
        ) : (
          <div className="h-full w-full flex flex-col items-center justify-center gap-2" style={{ background: "rgba(255,255,255,0.02)" }}>
            <FaCapsules size={28} style={{ color: "rgba(255,255,255,0.15)" }} aria-hidden="true" />
            <p className="text-[11px] uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.2)" }}>No image</p>
          </div>
        )}

        {stack?.category && (
          <div className="absolute bottom-2.5 left-2.5 rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest"
            style={{ background: "rgba(13,17,23,0.78)", border: "1px solid rgba(255,255,255,0.1)", backdropFilter: "blur(6px)", color: "rgba(255,255,255,0.55)", fontFamily: "'Barlow Condensed', sans-serif" }}
            aria-label={`Category: ${stack.category}`}>
            {stack.category}
          </div>
        )}

        {/* Overlay controls */}
        <div className="absolute top-2.5 left-2.5 right-2.5 flex items-center justify-between">
          <motion.button type="button" onClick={toggleCompare}
            className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 transition-all"
            style={{ background: isSelected ? "#5B9EC9" : "rgba(13,17,23,0.72)", border: isSelected ? "1px solid rgba(91,158,201,0.6)" : "1px solid rgba(255,255,255,0.2)", backdropFilter: "blur(6px)", boxShadow: isSelected ? "0 0 12px rgba(91,158,201,0.4)" : "none" }}
            whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.94 }}
            aria-label={isSelected ? "Remove from compare" : "Add to compare"} aria-pressed={isSelected}>
            {isSelected ? (
              <svg viewBox="0 0 24 24" className="w-3 h-3 text-white shrink-0" fill="none" stroke="currentColor" strokeWidth={3} aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
            ) : (
              <svg viewBox="0 0 24 24" className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} style={{ color: "rgba(255,255,255,0.7)" }} aria-hidden="true"><path strokeLinecap="round" d="M9 3H5a2 2 0 00-2 2v14a2 2 0 002 2h4M15 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4M9 3v18M15 3v18" /></svg>
            )}
            <span className="text-[11px] font-bold uppercase tracking-wide" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: isSelected ? "#fff" : "rgba(255,255,255,0.8)" }}>
              {isSelected ? "Comparing" : "Compare"}
            </span>
          </motion.button>

          <div className="relative">
            <AnimatePresence>
              {pulse && (
                <motion.div key="shock" aria-hidden="true" className="absolute inset-0 rounded-full border border-white/30"
                  initial={{ scale: 0.7, opacity: 0.7 }} animate={{ scale: 2.0, opacity: 0 }} exit={{ opacity: 0 }}
                  transition={{ type: "tween", duration: 0.55, ease: "easeOut" }} />
              )}
            </AnimatePresence>
            <motion.button type="button" onClick={toggleSave}
              className="relative w-8 h-8 rounded-full flex items-center justify-center"
              style={{ background: isSaved ? "rgba(239,68,68,0.2)" : "rgba(13,17,23,0.72)", border: isSaved ? "1px solid rgba(239,68,68,0.45)" : "1px solid rgba(255,255,255,0.15)", backdropFilter: "blur(6px)", opacity: saving ? 0.5 : 1, cursor: saving ? "not-allowed" : "pointer" }}
              whileTap={{ scale: 0.92 }}
              animate={pulse ? { scale: [1, 1.12, 1], rotate: [0, -7, 7, 0] } : { scale: 1, rotate: 0 }}
              transition={pulse ? { type: "tween", duration: 0.28 } : { type: "spring", stiffness: 520, damping: 18 }}
              aria-label={isSaved ? "Unsave stack" : "Save stack"} aria-pressed={isSaved} disabled={saving}>
              <FaHeart size={13} style={{ color: isSaved ? "#ef4444" : "rgba(255,255,255,0.5)" }} />
            </motion.button>
          </div>
        </div>
      </div>

      {/* Card body */}
      <div className="flex flex-col flex-1 px-3.5 pt-3 pb-3.5 gap-2">
        <div>
          <h3 className="text-base font-bold text-white leading-snug line-clamp-2"
            style={{ fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: "0.02em", fontSize: "clamp(0.9rem, 1.5vw, 1.05rem)", minHeight: "2.4em" }}>
            {stack?.name || "Untitled Stack"}
          </h3>

          {/* Rating sits under name, only when present */}
          <div className="mt-1">
            <RatingRow rating={stack?.rating} reviewCount={stack?.reviewCount} />
          </div>
        </div>

        {/* Supplement pills */}
        {suppPreview.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {suppPreview.map((supp) => (
              <span key={supp} className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium rounded-md"
                style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.65)" }} title={supp}>
                <span className="shrink-0" style={{ fontSize: 9, color: "rgba(255,255,255,0.4)" }} aria-hidden="true">{SUPPLEMENT_ICONS[supp] ?? <FaCapsules />}</span>
                <span className="truncate max-w-[90px]">{supp}</span>
              </span>
            ))}
            {suppMore > 0 && (
              <span className="inline-flex items-center px-2 py-0.5 text-[10px] font-bold rounded-md" style={{ background: "rgba(91,158,201,0.08)", border: "1px solid rgba(91,158,201,0.18)", color: "rgba(91,158,201,0.8)" }}>
                +{suppMore}
              </span>
            )}
          </div>
        )}

        <ValueBadge
            valueScore={stack?.valueScore}
            valueLabel={stack?.valueLabel}
            pricePerServing={stack?.pricePerServing}
          />

        {stack?.notes && (
          <p className="text-[11px] leading-relaxed line-clamp-2" style={{ color: "rgba(255,255,255,0.45)", fontStyle: "italic" }}>
            {stack.notes}
          </p>
        )}

        {/* Auth toast */}
        <AnimatePresence>
          {authToastOpen && (
            <motion.div key="authToast" className="overflow-hidden rounded-xl border"
              style={{ background: "rgba(13,17,23,0.92)", border: "1px solid rgba(255,255,255,0.1)", backdropFilter: "blur(8px)" }}
              initial={{ opacity: 0, y: 8, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 6, scale: 0.98 }} transition={{ type: "tween", duration: 0.18, ease: "easeOut" }}
              onClick={(e) => e.stopPropagation()} role="status" aria-live="polite">
              <div className="px-3 py-2.5 flex items-start gap-2.5">
                <div className="shrink-0 w-7 h-7 rounded-lg flex items-center justify-center mt-0.5" style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.1)" }} aria-hidden="true">
                  <FaLock size={11} style={{ color: "rgba(255,255,255,0.7)" }} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-xs font-bold text-white leading-tight">Sign in to save stacks</p>
                      <p className="text-[11px] mt-0.5 leading-snug" style={{ color: "rgba(255,255,255,0.5)" }}>Your picks sync across devices.</p>
                    </div>
                    <button type="button" onClick={() => setAuthToastOpen(false)} className="shrink-0 -mt-0.5" style={{ color: "rgba(255,255,255,0.35)" }} aria-label="Dismiss"><FaTimes size={10} /></button>
                  </div>
                  <div className="mt-2 flex gap-1.5">
                    <button type="button" className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold text-white transition-all" style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.1)" }} onClick={() => openLogin("save_stack")}><FaSignInAlt size={9} aria-hidden="true" />Sign in</button>
                    <button type="button" className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold text-white transition-all" style={{ background: "#5B9EC9", border: "1px solid rgba(91,158,201,0.5)" }} onClick={() => openLogin("save_stack")}>Create account</button>
                  </div>
                </div>
              </div>
              <motion.div aria-hidden="true" className="h-0.5 w-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
                <motion.div className="h-full" style={{ background: "#5B9EC9" }} initial={{ width: "100%" }} animate={{ width: "0%" }} transition={{ type: "tween", duration: 3.2, ease: "linear" }} />
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Action buttons */}
        <div className="mt-auto pt-1 flex flex-col gap-1.5">
          <button type="button" onClick={handleViewNutrition} disabled={!canOpenModal}
            className="w-full py-2 rounded-xl text-xs font-bold uppercase tracking-wide transition-all"
            style={{ background: canOpenModal ? "rgba(91,158,201,0.15)" : "rgba(255,255,255,0.04)", border: canOpenModal ? "1px solid rgba(91,158,201,0.3)" : "1px solid rgba(255,255,255,0.06)", color: canOpenModal ? "#5B9EC9" : "rgba(255,255,255,0.25)", cursor: canOpenModal ? "pointer" : "not-allowed", fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: "0.08em" }}
            onMouseEnter={(e) => { if (!canOpenModal) return; e.currentTarget.style.background = "rgba(91,158,201,0.22)"; e.currentTarget.style.borderColor = "rgba(91,158,201,0.5)"; }}
            onMouseLeave={(e) => { if (!canOpenModal) return; e.currentTarget.style.background = "rgba(91,158,201,0.15)"; e.currentTarget.style.borderColor = "rgba(91,158,201,0.3)"; }}>
            {canOpenModal ? "Scan Label" : "No label available"}
          </button>

          <AmazonButton href={stack?.affiliateLink} />
        </div>

        {/* Banner */}
        <AnimatePresence>
          {banner && (
            <motion.p key={banner} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}
              className="text-[10px] text-center rounded-lg px-2 py-1.5"
              style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.6)" }}
              role="status" aria-live="polite">
              {banner}
            </motion.p>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}