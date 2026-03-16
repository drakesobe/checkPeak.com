// components/smartstack-cards/StackCard.jsx
"use client";

import { useMemo, useRef, useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FaHeart, FaLock, FaSignInAlt, FaTimes, FaCapsules } from "react-icons/fa";
import ValueBadge from "./ValueBadge";
import { useAuthContext } from "@/hooks/useAuth";

/* ─────────────────────────────────────────────────────────────────────────── */
/* Helpers                                                                     */
/* ─────────────────────────────────────────────────────────────────────────── */

function normalizeId(v) { return v == null ? "" : String(v); }

function openLogin(reason = "auth_required") {
  if (typeof window === "undefined") return;
  try {
    if (typeof window.__openLoginModal === "function") { window.__openLoginModal({ reason, tab: "login" }); return; }
    window.dispatchEvent(new CustomEvent("auth:open", { detail: { reason, tab: "login" } }));
  } catch { window.location.href = `/?login=1&reason=${encodeURIComponent(reason)}`; }
}

function getPPS(stack) {
  for (const c of [stack?.pricePerServing, stack?.PricePerServing, stack?.costPerServing]) {
    const n = Number(c);
    if (Number.isFinite(n) && n > 0) return n;
  }
  const price    = [stack?.price,    stack?.Price].map(Number).find(n => Number.isFinite(n) && n > 0);
  const servings = [stack?.servings, stack?.Servings].map(Number).find(n => Number.isFinite(n) && n > 0);
  if (price && servings) return price / servings;
  return null;
}

function formatK(n) {
  if (!Number.isFinite(n) || n <= 0) return null;
  if (n >= 1000) { const k = n / 1000; return `${k % 1 === 0 ? Math.round(k) : k.toFixed(1)}k`; }
  return String(Math.round(n));
}

/* ─────────────────────────────────────────────────────────────────────────── */
/* Sub-components                                                              */
/* ─────────────────────────────────────────────────────────────────────────── */

function CompareButton({ isSelected, onClick }) {
  return (
    <motion.button
      type="button" onClick={onClick}
      className="flex items-center gap-1 rounded-lg px-2 py-1"
      style={{
        background:     isSelected ? "#5B9EC9" : "rgba(10,12,16,0.75)",
        border:         isSelected ? "1px solid rgba(91,158,201,0.7)" : "1px solid rgba(255,255,255,0.14)",
        backdropFilter: "blur(8px)",
        boxShadow:      isSelected ? "0 0 12px rgba(91,158,201,0.4)" : "none",
      }}
      whileTap={{ scale: 0.92 }}
      aria-label={isSelected ? "Remove from compare" : "Add to compare"}
      aria-pressed={isSelected}
    >
      {isSelected ? (
        <svg viewBox="0 0 24 24" className="w-2.5 h-2.5 text-white shrink-0" fill="none" stroke="currentColor" strokeWidth={3}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" className="w-2.5 h-2.5 shrink-0" fill="none" stroke="rgba(255,255,255,0.65)" strokeWidth={2}>
          <path strokeLinecap="round" d="M9 3H5a2 2 0 00-2 2v14a2 2 0 002 2h4M15 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4M9 3v18M15 3v18" />
        </svg>
      )}
      <span className="text-[10px] font-bold uppercase tracking-wide"
        style={{ fontFamily: "'Barlow Condensed', sans-serif", color: isSelected ? "#fff" : "rgba(255,255,255,0.7)" }}>
        {isSelected ? "Added" : "Compare"}
      </span>
    </motion.button>
  );
}

function SaveButton({ isSaved, saving, pulse, onClick }) {
  return (
    <div className="relative">
      <AnimatePresence>
        {pulse && (
          <motion.div className="absolute inset-0 rounded-full border border-white/20"
            initial={{ scale: 0.7, opacity: 0.6 }} animate={{ scale: 2.2, opacity: 0 }} exit={{ opacity: 0 }}
            transition={{ type: "tween", duration: 0.5, ease: "easeOut" }} aria-hidden="true" />
        )}
      </AnimatePresence>
      <motion.button type="button" onClick={onClick}
        className="relative w-7 h-7 rounded-full flex items-center justify-center"
        style={{
          background:     isSaved ? "rgba(239,68,68,0.22)" : "rgba(10,12,16,0.75)",
          border:         isSaved ? "1px solid rgba(239,68,68,0.5)" : "1px solid rgba(255,255,255,0.14)",
          backdropFilter: "blur(8px)",
          opacity:        saving ? 0.5 : 1,
          cursor:         saving ? "not-allowed" : "pointer",
        }}
        whileTap={{ scale: 0.9 }}
        animate={pulse ? { scale: [1, 1.15, 1], rotate: [0, -8, 8, 0] } : { scale: 1, rotate: 0 }}
        transition={pulse ? { duration: 0.28 } : { type: "spring", stiffness: 520, damping: 18 }}
        aria-label={isSaved ? "Unsave" : "Save"} aria-pressed={isSaved} disabled={saving}
      >
        <FaHeart size={11} style={{ color: isSaved ? "#ef4444" : "rgba(255,255,255,0.45)" }} />
      </motion.button>
    </div>
  );
}

/* Rating + social proof — overlaid at bottom of image */
function RatingOverlay({ rating, reviewCount, boughtLastMonth }) {
  const r      = Number(rating);
  const count  = formatK(reviewCount);
  const bought = formatK(boughtLastMonth);
  const hasRating = Number.isFinite(r) && r > 0;
  const hasBought = bought != null;
  if (!hasRating && !hasBought) return null;

  return (
    <div
      className="absolute bottom-0 left-0 right-0 flex items-end justify-between px-2.5 pb-2 pt-6"
      style={{ background: "linear-gradient(to top, rgba(10,12,16,0.88) 0%, rgba(10,12,16,0) 100%)" }}
      aria-hidden="true"
    >
      {hasRating ? (
        <div className="flex items-center gap-1">
          <span style={{ color: "#FBBF24", fontSize: 11 }}>★</span>
          <span className="font-bold tabular-nums"
            style={{ color: "#fff", fontSize: 12, fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: "0.02em" }}>
            {r.toFixed(1)}
          </span>
          {count && (
            <span style={{ color: "rgba(255,255,255,0.38)", fontSize: 10, fontFamily: "'Barlow Condensed', sans-serif" }}>
              ({count})
            </span>
          )}
        </div>
      ) : <span />}
      {hasBought && (
        <span style={{ color: "rgba(255,255,255,0.42)", fontSize: 10, fontFamily: "'Barlow Condensed', sans-serif" }}>
          {bought}+ last month
        </span>
      )}
    </div>
  );
}

/* Auth toast */
function AuthToast({ onClose }) {
  return (
    <motion.div
      className="overflow-hidden rounded-xl"
      style={{ background: "rgba(10,12,16,0.96)", border: "1px solid rgba(255,255,255,0.09)", backdropFilter: "blur(10px)" }}
      initial={{ opacity: 0, y: 8, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0 }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="px-3 py-2.5 flex items-start gap-2.5">
        <div className="shrink-0 w-7 h-7 rounded-lg flex items-center justify-center mt-0.5"
          style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.09)" }}>
          <FaLock size={10} style={{ color: "rgba(255,255,255,0.6)" }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-xs font-bold text-white leading-tight">Sign in to save stacks</p>
              <p className="text-[11px] mt-0.5" style={{ color: "rgba(255,255,255,0.42)" }}>Your picks sync across devices.</p>
            </div>
            <button type="button" onClick={onClose} style={{ color: "rgba(255,255,255,0.28)" }} aria-label="Dismiss">
              <FaTimes size={10} />
            </button>
          </div>
          <div className="mt-2 flex gap-1.5">
            <button type="button" className="flex-1 rounded-lg py-1.5 text-[11px] font-semibold text-white text-center"
              style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.09)" }}
              onClick={() => openLogin("save_stack")}>
              <FaSignInAlt size={9} className="inline mr-1" aria-hidden="true" />Sign in
            </button>
            <button type="button" className="flex-1 rounded-lg py-1.5 text-[11px] font-semibold text-white text-center"
              style={{ background: "#5B9EC9" }}
              onClick={() => openLogin("save_stack")}>
              Register
            </button>
          </div>
        </div>
      </div>
      <motion.div className="h-0.5 w-full overflow-hidden" style={{ background: "rgba(255,255,255,0.05)" }}>
        <motion.div className="h-full" style={{ background: "#5B9EC9" }}
          initial={{ width: "100%" }} animate={{ width: "0%" }}
          transition={{ type: "tween", duration: 3.2, ease: "linear" }} />
      </motion.div>
    </motion.div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────── */
/* StackCard                                                                   */
/* ─────────────────────────────────────────────────────────────────────────── */
export default function StackCard({
  stack,
  setModalStack,
  selectedCompareStacks,
  setSelectedCompareStacks,
  savedStacks,
  setSavedStacks,
  userEmail: userEmailProp,
  maxCompare = 3,
  compact    = false,
  index      = 0,
}) {
  const { user } = useAuthContext();

  const userEmail = useMemo(() => {
    const raw = userEmailProp || user?.Email || user?.email || "";
    const clean = String(raw).trim().toLowerCase();
    return clean.includes("@") ? clean : "";
  }, [userEmailProp, user]);

  const stackId     = useMemo(() => normalizeId(stack?.id), [stack?.id]);
  const savedRecord = useMemo(() => {
    const list = Array.isArray(savedStacks) ? savedStacks : [];
    return list.find((s) => normalizeId(s?.StackID || s?.id) === stackId) ?? null;
  }, [savedStacks, stackId]);

  const isSaved      = Boolean(savedRecord);
  const isSelected   = useMemo(() => selectedCompareStacks.some((s) => normalizeId(s?.id) === stackId), [selectedCompareStacks, stackId]);
  const canOpenModal = Boolean(stack?.nutritionLabel);
  const pps          = useMemo(() => getPPS(stack), [stack]);

  const [saving,        setSaving]        = useState(false);
  const [banner,        setBanner]        = useState("");
  const [authToastOpen, setAuthToastOpen] = useState(false);
  const [pulse,         setPulse]         = useState(false);

  const bannerTimer   = useRef(null);
  const authTimer     = useRef(null);
  const pulseTimer    = useRef(null);
  const lastAuthToast = useRef(0);

  useEffect(() => () => { clearTimeout(bannerTimer.current); clearTimeout(authTimer.current); clearTimeout(pulseTimer.current); }, []);

  const showBanner = useCallback((msg) => {
    setBanner(msg);
    clearTimeout(bannerTimer.current);
    bannerTimer.current = setTimeout(() => setBanner(""), 1800);
  }, []);

  const openAuthToast = useCallback(() => {
    const now = Date.now();
    if (now - lastAuthToast.current < 900) return;
    lastAuthToast.current = now;
    setAuthToastOpen(true);
    setPulse(true);
    clearTimeout(pulseTimer.current);
    pulseTimer.current = setTimeout(() => setPulse(false), 650);
    clearTimeout(authTimer.current);
    authTimer.current = setTimeout(() => setAuthToastOpen(false), 3200);
    showBanner("Sign in to save stacks.");
  }, [showBanner]);

  const toggleCompare = useCallback((e) => {
    e.stopPropagation();
    setSelectedCompareStacks((prev) => {
      const exists = prev.some((s) => normalizeId(s?.id) === stackId);
      if (exists) return prev.filter((s) => normalizeId(s?.id) !== stackId);
      if (prev.length >= maxCompare) { showBanner(`Max ${maxCompare} to compare.`); return prev; }
      return [...prev, stack];
    });
  }, [stackId, maxCompare, stack, setSelectedCompareStacks, showBanner]);

  const toggleSave = useCallback(async (e) => {
    e.stopPropagation();
    if (!userEmail) { openAuthToast(); return; }
    if (saving) return;
    setSaving(true);
    const add    = () => setSavedStacks((p) => { const l = Array.isArray(p) ? p : []; return l.some((s) => normalizeId(s?.StackID || s?.id) === stackId) ? l : [...l, { StackID: stackId, recordId: null }]; });
    const remove = () => setSavedStacks((p) => (Array.isArray(p) ? p : []).filter((s) => normalizeId(s?.StackID || s?.id) !== stackId));
    const was = isSaved;
    was ? remove() : add();
    try {
      if (!was) {
        const res  = await fetch("/api/saveStack", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ UserEmail: userEmail, stack }) });
        if (!res.ok) throw new Error();
        const data = await res.json();
        setSavedStacks((data.savedStacks || []).map((s) => ({ ...s, StackID: normalizeId(s.StackID || s.id) })));
        showBanner("Saved!");
      } else {
        if (!savedRecord?.recordId) { add(); showBanner("Couldn't unsave. Try again."); setSaving(false); return; }
        const res  = await fetch("/api/removeSavedStack", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ UserEmail: userEmail, recordId: savedRecord.recordId }) });
        if (!res.ok) throw new Error();
        const data = await res.json();
        setSavedStacks((data.savedStacks || []).map((s) => ({ ...s, StackID: normalizeId(s.StackID || s.id) })));
        showBanner("Unsaved!");
      }
    } catch { was ? add() : remove(); showBanner("Save failed. Try again."); }
    finally { setSaving(false); }
  }, [userEmail, saving, isSaved, stackId, stack, savedRecord, setSavedStacks, openAuthToast, showBanner]);

  const activate        = useCallback(() => { canOpenModal ? setModalStack(stack) : showBanner("No label available."); }, [canOpenModal, stack, setModalStack, showBanner]);
  const handleKeyDown   = useCallback((e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); activate(); } }, [activate]);
  const handleScanLabel = useCallback((e) => { e.stopPropagation(); canOpenModal ? setModalStack(stack) : showBanner("No label."); }, [canOpenModal, stack, setModalStack, showBanner]);
  const handleAmazon    = (e) => { e.stopPropagation(); if (typeof window.gtag === "function") window.gtag("event", "conversion", { send_to: "AW-17990566633/eJHlCOT724YcEOmFyYJD" }); };

  /* ─────────────────────────────────────────────────────────────────────── */
  /* Image section                                                            */
  /* ─────────────────────────────────────────────────────────────────────── */
  const imageSection = (
    <div className="relative w-full overflow-hidden shrink-0"
      style={{ aspectRatio: compact ? "1/1" : "4/3" }}>
      {stack?.imageUrl ? (
        <>
          <img src={stack.imageUrl} alt={stack?.name || "Product"} className="w-full h-full object-cover" loading="lazy"
            onError={(e) => { e.currentTarget.src = "/fallback-image.svg"; }} />
          <div className="absolute inset-0 pointer-events-none" aria-hidden="true"
            style={{ background: "linear-gradient(to bottom, rgba(0,0,0,0.22) 0%, rgba(0,0,0,0) 38%, rgba(10,12,16,0.78) 100%)" }} />
        </>
      ) : (
        <div className="w-full h-full flex items-center justify-center"
          style={{ background: "linear-gradient(145deg, #131820 0%, #0d1117 100%)" }}>
          <FaCapsules size={compact ? 22 : 30} style={{ color: "rgba(255,255,255,0.1)" }} aria-hidden="true" />
        </div>
      )}

      {/* Top: save heart only — compare moves to body button stack */}
      <div className="absolute top-2 right-2">
        <SaveButton isSaved={isSaved} saving={saving} pulse={pulse} onClick={toggleSave} />
      </div>

      {/* Bottom: category chip (left) + scan label chip (right, if available) */}
      <div className="absolute bottom-2.5 left-2.5 right-2.5 flex items-end justify-between">
        {stack?.category && (
          <span className="text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded"
            style={{ background: "rgba(10,12,16,0.72)", border: "1px solid rgba(255,255,255,0.09)", backdropFilter: "blur(6px)", color: "rgba(255,255,255,0.45)", fontFamily: "'Barlow Condensed', sans-serif" }}>
            {stack.category}
          </span>
        )}
        {canOpenModal && (
          <button type="button" onClick={handleScanLabel}
            style={{ fontSize: 9, fontWeight: 700, fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(91,158,201,0.85)", background: "rgba(10,12,16,0.72)", border: "1px solid rgba(91,158,201,0.22)", backdropFilter: "blur(6px)", padding: "3px 8px", borderRadius: 6, cursor: "pointer" }}>
            Scan Label
          </button>
        )}
      </div>
    </div>
  );

  /* ─────────────────────────────────────────────────────────────────────── */
  /* Body section                                                             */
  /* ─────────────────────────────────────────────────────────────────────── */
  const bodySection = (
    <div className="flex flex-col flex-1 px-3 pt-2.5 pb-3 gap-2">

      {/* Product name — 2-line reserved */}
      <h3 className="font-bold text-white leading-snug"
        style={{
          fontFamily:      "'Barlow Condensed', sans-serif",
          fontSize:        compact ? "clamp(0.78rem, 2.8vw, 0.9rem)" : "clamp(0.88rem, 1.5vw, 1rem)",
          letterSpacing:   "0.01em",
          minHeight:       "2.5em",
          display:         "-webkit-box",
          WebkitLineClamp: 2,
          WebkitBoxOrient: "vertical",
          overflow:        "hidden",
        }}>
        {stack?.name || "Untitled"}
      </h3>

      {/* Rating + bought — body row, only when data exists */}
      {(stack?.rating || stack?.boughtLastMonth) && (() => {
        const r      = Number(stack?.rating);
        const hasR   = Number.isFinite(r) && r > 0;
        const count  = formatK(stack?.reviewCount);
        const bought = formatK(stack?.boughtLastMonth);
        return (
          <div className="flex flex-col gap-0.5">
            {hasR && (
              <div className="flex items-center gap-1">
                <span style={{ color: "#FBBF24", fontSize: 11 }}>★</span>
                <span style={{ color: "rgba(255,255,255,0.8)", fontSize: 12, fontWeight: 700, fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: "0.02em" }}>
                  {r.toFixed(1)}
                </span>
                {count && (
                  <span style={{ color: "rgba(255,255,255,0.32)", fontSize: 10, fontFamily: "'Barlow Condensed', sans-serif" }}>
                    ({count})
                  </span>
                )}
              </div>
            )}
            {bought && (
              <span style={{ color: "rgba(255,255,255,0.32)", fontSize: 10, fontFamily: "'Barlow Condensed', sans-serif" }}>
                {bought}+ bought last month
              </span>
            )}
          </div>
        );
      })()}

      {/* Price + Value badge — side by side, no duplication */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        {pps != null ? (
          <p className="font-black tabular-nums leading-none"
            style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: compact ? "1.15rem" : "1.25rem", color: "#fff", letterSpacing: "-0.01em" }}>
            ${pps.toFixed(2)}
            <span className="font-semibold ml-0.5" style={{ fontSize: compact ? "0.62rem" : "0.68rem", color: "rgba(255,255,255,0.38)", letterSpacing: "0.02em" }}>
              /srv
            </span>
          </p>
        ) : (
          <span style={{ color: "rgba(255,255,255,0.22)", fontSize: 11 }}>Price N/A</span>
        )}
        {/* ValueBadge shows tier label only — price already shown above */}
        <ValueBadge
          valueScore={stack?.valueScore}
          valueLabel={stack?.valueLabel}
        />
      </div>

      {/* Auth toast */}
      <AnimatePresence>
        {authToastOpen && <AuthToast onClose={() => setAuthToastOpen(false)} />}
      </AnimatePresence>

      {/* CTAs — stacked, full width */}
      <div className="mt-auto flex flex-col gap-1.5 pt-0.5">

        {/* Compare — primary page feature, shows selected state clearly */}
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); toggleCompare(e); }}
          className="w-full flex items-center justify-center gap-1.5 rounded-xl font-bold transition-all"
          style={{
            padding:       compact ? "8px 12px" : "9px 14px",
            background:    isSelected ? "#5B9EC9"                    : "rgba(91,158,201,0.08)",
            border:        isSelected ? "1px solid rgba(91,158,201,0.8)" : "1px solid rgba(91,158,201,0.22)",
            color:         isSelected ? "#fff"                       : "rgba(91,158,201,0.75)",
            fontSize:      compact ? 11 : 12,
            fontFamily:    "'Barlow Condensed', sans-serif",
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            boxShadow:     isSelected ? "0 0 14px rgba(91,158,201,0.35)" : "none",
            transition:    "all 0.15s ease",
          }}
          onMouseEnter={(e) => {
            if (isSelected) return;
            e.currentTarget.style.background  = "rgba(91,158,201,0.14)";
            e.currentTarget.style.borderColor = "rgba(91,158,201,0.38)";
            e.currentTarget.style.color       = "#5B9EC9";
          }}
          onMouseLeave={(e) => {
            if (isSelected) return;
            e.currentTarget.style.background  = "rgba(91,158,201,0.08)";
            e.currentTarget.style.borderColor = "rgba(91,158,201,0.22)";
            e.currentTarget.style.color       = "rgba(91,158,201,0.75)";
          }}
          aria-pressed={isSelected}
        >
          {isSelected ? (
            <>
              <svg viewBox="0 0 24 24" style={{ width: compact ? 11 : 12, height: compact ? 11 : 12, flexShrink: 0 }} fill="none" stroke="currentColor" strokeWidth={3} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              Comparing
            </>
          ) : (
            <>
              <svg viewBox="0 0 24 24" style={{ width: compact ? 13 : 14, height: compact ? 13 : 14, flexShrink: 0 }} fill="none" aria-hidden="true">
                <rect x="1" y="5" width="6" height="14" rx="1.5" stroke="currentColor" strokeWidth={1.6} fill="none"/>
                <rect x="17" y="5" width="6" height="14" rx="1.5" stroke="currentColor" strokeWidth={1.6} fill="none"/>
                <path d="M9.5 12 L14.5 12" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round"/>
                <path d="M11.5 9.5 L9.5 12 L11.5 14.5" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" fill="none"/>
                <path d="M12.5 9.5 L14.5 12 L12.5 14.5" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" fill="none"/>
              </svg>
              Compare
            </>
          )}
        </button>

        {/* Amazon */}
        {stack?.affiliateLink ? (
          <a href={stack.affiliateLink} target="_blank" rel="noopener noreferrer"
            className="w-full flex items-center justify-center gap-1.5 rounded-xl font-bold transition-all"
            style={{
              padding:        compact ? "8px 12px" : "9px 14px",
              background:     "rgba(255,255,255,0.06)",
              border:         "1px solid rgba(255,255,255,0.12)",
              color:          "rgba(255,255,255,0.7)",
              fontSize:       compact ? 11 : 12,
              fontFamily:     "'Barlow Condensed', sans-serif",
              letterSpacing:  "0.06em",
              textTransform:  "uppercase",
              textDecoration: "none",
              transition:     "all 0.15s ease",
            }}
            onClick={handleAmazon}
            onMouseEnter={(e) => {
              e.currentTarget.style.background  = "rgba(255,255,255,0.1)";
              e.currentTarget.style.borderColor = "rgba(255,255,255,0.22)";
              e.currentTarget.style.color       = "rgba(255,255,255,0.92)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background  = "rgba(255,255,255,0.06)";
              e.currentTarget.style.borderColor = "rgba(255,255,255,0.12)";
              e.currentTarget.style.color       = "rgba(255,255,255,0.7)";
            }}
            onTouchStart={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.1)"; }}
            onTouchEnd={(e)   => { e.currentTarget.style.background = "rgba(255,255,255,0.06)"; }}
          >
            <svg viewBox="0 0 24 24" style={{ width: compact ? 11 : 12, height: compact ? 11 : 12, flexShrink: 0 }} fill="none" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
            View on Amazon
          </a>
        ) : (
          <div className="w-full rounded-xl py-2 text-center text-[11px]"
            style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.18)" }}>
            Link unavailable
          </div>
        )}
      </div>

      {/* Banner */}
      <AnimatePresence>
        {banner && (
          <motion.p key={banner} initial={{ opacity: 0, y: 3 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.14 }} className="text-[10px] text-center rounded-lg px-2 py-1 mt-0.5"
            style={{ background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.45)" }}
            role="status" aria-live="polite">
            {banner}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );

  /* ─────────────────────────────────────────────────────────────────────── */
  /* Render                                                                   */
  /* ─────────────────────────────────────────────────────────────────────── */
  return (
    <motion.div
      className="relative overflow-hidden flex flex-col cursor-pointer"
      style={{
        background:   "#0D1117",
        border:       isSelected ? "1px solid rgba(91,158,201,0.6)" : "1px solid rgba(255,255,255,0.07)",
        borderRadius: compact ? "14px" : "16px",
        boxShadow:    isSelected ? "0 0 0 2px rgba(91,158,201,0.18), 0 6px 24px rgba(0,0,0,0.5)" : "0 2px 12px rgba(0,0,0,0.4)",
        fontFamily:   "'Barlow', sans-serif",
      }}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      whileHover={!compact ? {
        scale:       1.015,
        boxShadow:   isSelected ? "0 0 0 2px rgba(91,158,201,0.28), 0 16px 40px rgba(0,0,0,0.6)" : "0 12px 36px rgba(0,0,0,0.6)",
        borderColor: isSelected ? "rgba(91,158,201,0.75)" : "rgba(255,255,255,0.12)",
      } : {}}
      whileTap={{ scale: 0.985 }}
      transition={{ duration: compact ? 0.18 : 0.22, delay: Math.min(index * 0.03, 0.25) }}
      onClick={activate}
      role="button"
      tabIndex={0}
      onKeyDown={handleKeyDown}
      aria-label={`${stack?.name || "Stack"}${pps != null ? ` — $${pps.toFixed(2)} per serving` : ""}`}
      aria-pressed={isSelected}
    >
      {imageSection}
      {bodySection}
    </motion.div>
  );
}