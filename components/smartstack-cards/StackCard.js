// components/smartstack-cards/StackCard.jsx
"use client";

import { useMemo, useRef, useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FaDumbbell,
  FaBolt,
  FaLeaf,
  FaCoffee,
  FaAppleAlt,
  FaCapsules,
  FaHeart,
  FaLock,
  FaSignInAlt,
  FaTimes,
} from "react-icons/fa";
import ValueBadge from "./ValueBadge";
import { useAuthContext } from "@/hooks/useAuth";

/* -------------------------------------------------------------------------- */
/* Static data — outside component so it's never recreated                    */
/* -------------------------------------------------------------------------- */

const SUPPLEMENT_ICONS = {
  "Caffeine":              <FaCoffee />,
  "L-Theanine":            <FaLeaf />,
  "B-Vitamins":            <FaCapsules />,
  "Creatine Monohydrate":  <FaDumbbell />,
  "L-Glutamine":           <FaLeaf />,
  "BCAAs":                 <FaDumbbell />,
  "Omega-3":               <FaCapsules />,
  "Bacopa Monnieri":       <FaLeaf />,
  "Rhodiola Rosea":        <FaLeaf />,
  "Beta-Alanine":          <FaDumbbell />,
  "L-Citrulline":          <FaDumbbell />,
  "Electrolytes":          <FaBolt />,
  "Vitamin C":             <FaAppleAlt />,
  "Zinc":                  <FaCapsules />,
  "Elderberry":            <FaAppleAlt />,
};

/* -------------------------------------------------------------------------- */
/* Helpers                                                                     */
/* -------------------------------------------------------------------------- */

function normalizeId(v) {
  if (v == null) return "";
  return String(v);
}

/**
 * Opens the login modal via three progressively degraded methods:
 * 1. window.__openLoginModal (app-level registered opener)
 * 2. CustomEvent "auth:open" (navbar listener)
 * 3. Hard redirect fallback
 */
function openLogin(reason = "auth_required") {
  if (typeof window === "undefined") return;
  try {
    if (typeof window.__openLoginModal === "function") {
      window.__openLoginModal({ reason, tab: "login" });
      return;
    }
    window.dispatchEvent(
      new CustomEvent("auth:open", { detail: { reason, tab: "login" } })
    );
  } catch {
    // Last-resort fallback — avoids a blank screen if both above fail
    window.location.href = `/?login=1&reason=${encodeURIComponent(reason)}`;
  }
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
  maxSuppPills = 6,
}) {
  const { user } = useAuthContext();

  /* ── Derived identity ─────────────────────────────────────────────────── */

  const userEmail = useMemo(() => {
    const raw   = userEmailProp || user?.Email || user?.email || "";
    const clean = String(raw).trim().toLowerCase();
    return clean.includes("@") ? clean : "";
  }, [userEmailProp, user]);

  const stackId = useMemo(() => normalizeId(stack?.id), [stack?.id]);

  const savedRecord = useMemo(() => {
    const list = Array.isArray(savedStacks) ? savedStacks : [];
    return (
      list.find((s) => normalizeId(s?.StackID || s?.id) === stackId) ?? null
    );
  }, [savedStacks, stackId]);

  const isSaved = Boolean(savedRecord);

  const isSelected = useMemo(
    () => selectedCompareStacks.some((s) => normalizeId(s?.id) === stackId),
    [selectedCompareStacks, stackId]
  );

  const canOpenModal = Boolean(stack?.nutritionLabel);

  /* ── Supplement pills ─────────────────────────────────────────────────── */

  const { suppPreview, suppMore } = useMemo(() => {
    const all = Array.isArray(stack?.supplements) ? stack.supplements : [];
    const deduped = Array.from(
      new Set(all.map((x) => String(x).trim()).filter(Boolean))
    );
    return {
      suppPreview: deduped.slice(0, maxSuppPills),
      suppMore:    Math.max(0, deduped.length - maxSuppPills),
    };
  }, [stack?.supplements, maxSuppPills]);

  /* ── Component state ──────────────────────────────────────────────────── */

  const [saving,        setSaving]        = useState(false);
  const [banner,        setBanner]        = useState("");
  const [authToastOpen, setAuthToastOpen] = useState(false);
  const [pulse,         setPulse]         = useState(false);

  /* ── Timer refs — correct pattern instead of properties on functions ──── */

  const bannerTimerRef        = useRef(null);
  const authToastTimerRef     = useRef(null);
  const pulseTimerRef         = useRef(null);
  const lastAuthToastAtRef    = useRef(0);

  // Clear all timers on unmount to prevent state updates on unmounted component
  useEffect(() => {
    return () => {
      clearTimeout(bannerTimerRef.current);
      clearTimeout(authToastTimerRef.current);
      clearTimeout(pulseTimerRef.current);
    };
  }, []);

  /* ── Banner helper ────────────────────────────────────────────────────── */

  const showBanner = useCallback((msg) => {
    setBanner(msg);
    clearTimeout(bannerTimerRef.current);
    bannerTimerRef.current = setTimeout(() => setBanner(""), 1800);
  }, []);

  /* ── Auth toast ───────────────────────────────────────────────────────── */

  const openAuthToast = useCallback(() => {
    const now = Date.now();
    // Debounce rapid clicks
    if (now - lastAuthToastAtRef.current < 900) return;
    lastAuthToastAtRef.current = now;

    setAuthToastOpen(true);
    setPulse(true);

    clearTimeout(pulseTimerRef.current);
    pulseTimerRef.current = setTimeout(() => setPulse(false), 650);

    clearTimeout(authToastTimerRef.current);
    authToastTimerRef.current = setTimeout(() => setAuthToastOpen(false), 3200);

    showBanner("Sign in to save stacks.");
  }, [showBanner]);

  /* ── Compare toggle ───────────────────────────────────────────────────── */

  const toggleCompare = useCallback(
    (e) => {
      e.stopPropagation();
      setSelectedCompareStacks((prev) => {
        const exists = prev.some((s) => normalizeId(s?.id) === stackId);
        if (exists) return prev.filter((s) => normalizeId(s?.id) !== stackId);
        if (prev.length >= maxCompare) {
          showBanner(`Max ${maxCompare} stacks to compare.`);
          return prev;
        }
        return [...prev, stack];
      });
    },
    [stackId, maxCompare, stack, setSelectedCompareStacks, showBanner]
  );

  /* ── Save / unsave toggle ─────────────────────────────────────────────── */

  const toggleSave = useCallback(
    async (e) => {
      e.stopPropagation();

      if (!userEmail) {
        openAuthToast();
        return;
      }

      if (saving) return;
      setSaving(true);

      // Optimistic helpers
      const optimisticAdd = () => {
        setSavedStacks((prev) => {
          const list   = Array.isArray(prev) ? prev : [];
          const exists = list.some(
            (s) => normalizeId(s?.StackID || s?.id) === stackId
          );
          return exists ? list : [...list, { StackID: stackId, recordId: null }];
        });
      };

      const optimisticRemove = () => {
        setSavedStacks((prev) => {
          const list = Array.isArray(prev) ? prev : [];
          return list.filter(
            (s) => normalizeId(s?.StackID || s?.id) !== stackId
          );
        });
      };

      const wasSaved = isSaved;
      if (!wasSaved) optimisticAdd();
      else           optimisticRemove();

      try {
        if (!wasSaved) {
          // ── Save ──
          const res = await fetch("/api/saveStack", {
            method:  "POST",
            headers: { "Content-Type": "application/json" },
            body:    JSON.stringify({ UserEmail: userEmail, stack }),
          });
          if (!res.ok) throw new Error("Failed to save stack");

          const data = await res.json();
          setSavedStacks(
            (data.savedStacks || []).map((s) => ({
              ...s,
              StackID: normalizeId(s.StackID || s.id),
            }))
          );
          showBanner("Saved!");
        } else {
          // ── Unsave ──
          const recordId = savedRecord?.recordId;
          if (!recordId) {
            // Can't unsave without a recordId — roll back and inform user
            optimisticAdd();
            showBanner("Couldn't unsave (missing record). Refresh and try again.");
            setSaving(false);
            return;
          }

          const res = await fetch("/api/removeSavedStack", {
            method:  "DELETE",
            headers: { "Content-Type": "application/json" },
            body:    JSON.stringify({ UserEmail: userEmail, recordId }),
          });
          if (!res.ok) throw new Error("Failed to remove saved stack");

          const data = await res.json();
          setSavedStacks(
            (data.savedStacks || []).map((s) => ({
              ...s,
              StackID: normalizeId(s.StackID || s.id),
            }))
          );
          showBanner("Unsaved!");
        }
      } catch (err) {
        console.error("[StackCard] toggleSave error:", err);
        // Roll back optimistic update
        if (!wasSaved) optimisticRemove();
        else           optimisticAdd();
        showBanner("Save failed. Try again.");
      } finally {
        setSaving(false);
      }
    },
    [
      userEmail,
      saving,
      isSaved,
      stackId,
      stack,
      savedRecord,
      setSavedStacks,
      openAuthToast,
      showBanner,
    ]
  );

  /* ── Card click / keyboard handler ───────────────────────────────────── */

  const handleCardActivate = useCallback(() => {
    if (canOpenModal) setModalStack(stack);
    else showBanner("No nutrition label available for this stack.");
  }, [canOpenModal, stack, setModalStack, showBanner]);

  const handleCardKeyDown = useCallback(
    (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        handleCardActivate();
      }
    },
    [handleCardActivate]
  );

  /* ── View Nutrition button handler ───────────────────────────────────── */

  const handleViewNutrition = useCallback(
    (e) => {
      e.stopPropagation();
      if (canOpenModal) setModalStack(stack);
      else showBanner("No nutrition label available.");
    },
    [canOpenModal, stack, setModalStack, showBanner]
  );

  /* ------------------------------------------------------------------------ */
  /* Render                                                                    */
  /* ------------------------------------------------------------------------ */
  return (
    <motion.div
      className={[
        "relative overflow-hidden rounded-2xl shadow-md cursor-pointer flex flex-col",
        isSelected ? "ring-4 ring-green-500" : "",
      ].join(" ")}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      // FIX: hover scale moved to whileHover to avoid stacking context issues
      // that caused absolute-positioned controls to slip behind adjacent cards
      whileHover={{ scale: 1.01, boxShadow: "0 20px 40px rgba(0,0,0,0.35)" }}
      transition={{ duration: 0.25 }}
      onClick={handleCardActivate}
      role="button"
      tabIndex={0}
      onKeyDown={handleCardKeyDown}
      aria-label={`Stack card: ${stack?.name || "Stack"}`}
    >
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-gray-900 via-gray-800 to-gray-700" />

      {/* ── Top controls ── */}
      <div className="absolute top-3 left-3 right-3 z-20 flex items-center justify-between">

        {/* Compare toggle */}
        <motion.button
          type="button"
          onClick={toggleCompare}
          className={[
            "w-8 h-8 rounded-full border-2 flex items-center justify-center transition-colors",
            isSelected
              ? "bg-green-500 border-green-600"
              : "bg-gray-900/80 border-gray-600",
          ].join(" ")}
          whileHover={{ scale: 1.06 }}
          whileTap={{ scale: 0.96 }}
          transition={{ type: "spring", stiffness: 420, damping: 30 }}
          title={isSelected ? "Remove from compare" : `Select for compare (max ${maxCompare})`}
          aria-label={isSelected ? "Remove from compare" : "Select for compare"}
          aria-pressed={isSelected}
        >
          {isSelected && (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="w-4 h-4 text-white"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={3}
              aria-hidden="true"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          )}
        </motion.button>

        {/* Save / unsave */}
        <div className="relative">
          {/* Shockwave ring */}
          <AnimatePresence>
            {pulse && (
              <motion.div
                key="shock"
                aria-hidden="true"
                className="absolute inset-0 rounded-full border border-white/30"
                initial={{ scale: 0.7, opacity: 0.7 }}
                animate={{ scale: 1.9, opacity: 0 }}
                exit={{ opacity: 0 }}
                transition={{ type: "tween", duration: 0.55, ease: "easeOut" }}
              />
            )}
          </AnimatePresence>

          <motion.button
            type="button"
            onClick={toggleSave}
            className={[
              "relative w-9 h-9 rounded-full border flex items-center justify-center",
              isSaved
                ? "border-red-500/60 bg-gray-900/70"
                : "border-gray-600 bg-gray-900/60",
              saving ? "opacity-60 cursor-not-allowed" : "",
            ].join(" ")}
            whileTap={{ scale: 0.92 }}
            animate={
              pulse
                ? { scale: [1, 1.12, 1], rotate: [0, -7, 7, 0] }
                : { scale: 1, rotate: 0 }
            }
            transition={
              pulse
                ? { type: "tween", duration: 0.28, ease: "easeOut" }
                : { type: "spring", stiffness: 520, damping: 18 }
            }
            title={isSaved ? "Unsave" : "Save"}
            aria-label={isSaved ? "Unsave stack" : "Save stack"}
            aria-pressed={isSaved}
            disabled={saving}
          >
            <FaHeart
              size={18}
              className={isSaved ? "text-red-500" : "text-gray-300"}
            />
          </motion.button>
        </div>
      </div>

      {/* ── Product image ── */}
      <div className="relative z-[1] w-full aspect-[4/3] overflow-hidden">
        {stack?.imageUrl ? (
          <>
            <img
              src={stack.imageUrl}
              alt={stack?.name || "Stack image"}
              className="h-full w-full object-cover"
              loading="lazy"
              onError={(e) => { e.currentTarget.src = "/fallback-image.svg"; }}
            />
            <div
              aria-hidden="true"
              className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-transparent"
            />
          </>
        ) : (
          <div className="h-full w-full bg-gray-700 flex items-center justify-center text-gray-300 text-sm">
            No Image Available
          </div>
        )}
      </div>

      {/* ── Content ── */}
      <div className="relative z-[1] px-4 py-4 sm:p-5 flex flex-col flex-1">

        {/* Product name */}
        <h3 className="text-lg md:text-xl xl:text-lg font-bold text-white leading-tight line-clamp-2">
          {stack?.name || "Untitled Stack"}
        </h3>

        {/* Supplement pills */}
        {suppPreview.length > 0 && (
          <div className="mt-2.5 sm:mt-3 max-h-[64px] overflow-hidden">
            <div className="flex flex-wrap gap-1.5 sm:gap-2">
              {suppPreview.map((supp) => (
                <span
                  key={supp}
                  className="flex items-center gap-1 px-2.5 py-1 sm:px-3 sm:py-1 bg-white/10 border border-white/10 rounded-full text-[11px] sm:text-xs text-white font-medium shadow-sm"
                  title={supp}
                >
                  <span className="opacity-90" aria-hidden="true">
                    {SUPPLEMENT_ICONS[supp] ?? <FaCapsules />}
                  </span>
                  <span className="truncate max-w-[120px] sm:max-w-[140px]">
                    {supp}
                  </span>
                </span>
              ))}

              {suppMore > 0 && (
                <span className="px-2.5 py-1 sm:px-3 sm:py-1 bg-white/5 border border-white/10 rounded-full text-[11px] sm:text-xs text-white/80 font-semibold">
                  +{suppMore} more
                </span>
              )}
            </div>
          </div>
        )}

        {/* Value badge */}
        {stack?.valueScore != null && !isNaN(stack.valueScore) && (
          <div className="flex flex-wrap gap-2 mt-2.5 sm:mt-3">
            <ValueBadge valueScore={stack.valueScore} category={stack.category} />
          </div>
        )}

        {/* Notes */}
        {stack?.notes && (
          <p className="text-gray-200/90 text-sm mt-2.5 sm:mt-3 line-clamp-2">
            {stack.notes}
          </p>
        )}

        {/* Auth toast — inline CTA when unauthenticated user tries to save */}
        <AnimatePresence>
          {authToastOpen && (
            <motion.div
              key="authToast"
              className="mt-3 sm:mt-4 overflow-hidden rounded-2xl border border-white/10 bg-black/45 backdrop-blur px-4 py-3 text-white"
              initial={{ opacity: 0, y: 10, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.98 }}
              transition={{ type: "tween", duration: 0.18, ease: "easeOut" }}
              onClick={(e) => e.stopPropagation()}
              role="status"
              aria-live="polite"
            >
              <div className="flex items-start gap-3">
                {/* Lock icon */}
                <div
                  aria-hidden="true"
                  className="shrink-0 w-9 h-9 rounded-xl bg-white/10 border border-white/10 flex items-center justify-center"
                >
                  <FaLock className="text-white/90" />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-extrabold leading-tight">
                        Sign in to save stacks
                      </p>
                      <p className="text-[12px] text-white/80 mt-0.5 leading-snug">
                        Your favorites sync across devices in SmartStack.
                      </p>
                    </div>

                    <button
                      type="button"
                      className="shrink-0 p-2 -m-2 text-white/70 hover:text-white transition-colors"
                      onClick={() => setAuthToastOpen(false)}
                      aria-label="Dismiss sign-in prompt"
                    >
                      <FaTimes />
                    </button>
                  </div>

                  {/* Auth action buttons */}
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="inline-flex items-center gap-2 rounded-xl bg-white/10 hover:bg-white/15 border border-white/10 px-3 py-2 text-xs font-semibold transition-colors"
                      onClick={() => openLogin("save_stack")}
                    >
                      <FaSignInAlt aria-hidden="true" />
                      Sign in
                    </button>

                    <button
                      type="button"
                      className="inline-flex items-center gap-2 rounded-xl bg-[#46769B] hover:bg-[#375b7a] px-3 py-2 text-xs font-semibold text-white transition-colors"
                      onClick={() => openLogin("save_stack")}
                    >
                      Create account
                    </button>
                  </div>
                </div>
              </div>

              {/* Auto-dismiss progress bar */}
              <motion.div
                aria-hidden="true"
                className="mt-3 h-1 w-full rounded-full bg-white/10 overflow-hidden"
              >
                <motion.div
                  className="h-full rounded-full bg-white/40"
                  initial={{ width: "100%" }}
                  animate={{ width: "0%" }}
                  transition={{ type: "tween", duration: 3.2, ease: "linear" }}
                />
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Action buttons ── */}
        <div className="mt-auto pt-3 sm:pt-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            {stack?.affiliateLink && (
              <a
                href={stack.affiliateLink}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full sm:w-auto px-4 py-2 bg-[#46769B] hover:bg-[#375b7a] rounded-2xl text-white text-sm font-semibold shadow-sm transition-colors text-center"
                onClick={(e) => e.stopPropagation()}
              >
                View on Amazon
              </a>
            )}

            <button
              type="button"
              onClick={handleViewNutrition}
              disabled={!canOpenModal}
              className={[
                "w-full sm:w-auto px-4 py-2 rounded-2xl text-sm font-semibold transition-colors text-center",
                canOpenModal
                  ? "bg-white/10 hover:bg-white/15 text-white"
                  : "bg-white/5 text-white/60 cursor-not-allowed",
              ].join(" ")}
            >
              View Nutrition
            </button>
          </div>

          {/* Compare status hint */}
          <p className="mt-2 text-white/55 text-[11px] sm:text-xs">
            {isSelected
              ? `Selected for comparison (${selectedCompareStacks.length}/${maxCompare})`
              : `Click ✓ to compare (up to ${maxCompare})`}
          </p>

          {/* Banner message — aria-live so screen readers announce it */}
          <AnimatePresence>
            {banner && (
              <motion.div
                key={banner}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="mt-2 inline-flex w-fit max-w-full items-center rounded-xl border border-white/10 bg-black/45 px-3 py-1.5 text-[11px] sm:text-xs text-white"
                role="status"
                aria-live="polite"
              >
                {banner}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
}