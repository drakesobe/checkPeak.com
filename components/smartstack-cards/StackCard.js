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

// Map common supplements to icons
const supplementIcons = {
  Caffeine: <FaCoffee />,
  "L-Theanine": <FaLeaf />,
  "B-Vitamins": <FaCapsules />,
  "Creatine Monohydrate": <FaDumbbell />,
  "L-Glutamine": <FaLeaf />,
  BCAAs: <FaDumbbell />,
  "Omega-3": <FaCapsules />,
  "Bacopa Monnieri": <FaLeaf />,
  "Rhodiola Rosea": <FaLeaf />,
  "Beta-Alanine": <FaDumbbell />,
  "L-Citrulline": <FaLeaf />,
  Electrolytes: <FaBolt />,
  "Vitamin C": <FaAppleAlt />,
  Zinc: <FaCapsules />,
  Elderberry: <FaAppleAlt />,
};

function normalizeId(v) {
  if (v == null) return "";
  return String(v);
}

/**
 * Polished auth CTA:
 * - Shows a "toast-like" CTA card inside the StackCard (not a tiny banner)
 * - Tries to open your NavBarLoginModal (global hook or window event)
 * - Falls back to redirect with ?login=1 so it *always* works even if wiring isn't done
 */
function openLogin(reason = "auth_required") {
  try {
    if (typeof window === "undefined") return;

    // 1) Preferred: app-level opener (if you registered it)
    if (typeof window.__openLoginModal === "function") {
      window.__openLoginModal({ reason, tab: "login" });
      return;
    }

    // 2) Event-based (if your navbar listens for it)
    window.dispatchEvent(new CustomEvent("auth:open", { detail: { reason, tab: "login" } }));

    // 3) Fallback: take them to a route that renders your navbar+modal
    // Adjust the fallback path if needed ("/smartstack" etc.)
    window.location.href = `/?login=1&reason=${encodeURIComponent(reason)}`;
  } catch {
    // ultra-safe fallback
    try {
      if (typeof window !== "undefined") window.location.href = "/?login=1";
    } catch {}
  }
}

export default function StackCard({
  stack,
  setModalStack,
  selectedCompareStacks,
  setSelectedCompareStacks,
  savedStacks,
  setSavedStacks,
  userEmail: userEmailProp,
  maxCompare = 3,
  maxSuppPills = 6,
}) {
  const { user } = useAuthContext();

  const userEmail = useMemo(() => {
    const e = userEmailProp || user?.Email || user?.email || "";
    const clean = String(e).trim().toLowerCase();
    return clean.includes("@") ? clean : "";
  }, [userEmailProp, user]);

  const stackId = useMemo(() => normalizeId(stack?.id), [stack?.id]);

  const savedRecord = useMemo(() => {
    const list = Array.isArray(savedStacks) ? savedStacks : [];
    return list.find((s) => normalizeId(s?.StackID || s?.id) === stackId) || null;
  }, [savedStacks, stackId]);

  const isSaved = Boolean(savedRecord);

  const isSelected = useMemo(
    () => selectedCompareStacks.some((s) => normalizeId(s?.id) === stackId),
    [selectedCompareStacks, stackId]
  );

  const [saving, setSaving] = useState(false);
  const [banner, setBanner] = useState("");

  // Polished auth UX
  const [authToastOpen, setAuthToastOpen] = useState(false);
  const [pulse, setPulse] = useState(false);
  const lastAuthToastAtRef = useRef(0);

  const canOpenModal = Boolean(stack?.nutritionLabel);

  const displayedSupps = useMemo(() => {
    const supps = Array.isArray(stack?.supplements) ? stack.supplements : [];
    return Array.from(new Set(supps.map((x) => String(x).trim()).filter(Boolean)));
  }, [stack?.supplements]);

  const suppPreview = displayedSupps.slice(0, maxSuppPills);
  const suppMore = Math.max(0, displayedSupps.length - suppPreview.length);

  const showBanner = (msg) => {
    setBanner(msg);
    window.clearTimeout(showBanner._t);
    showBanner._t = window.setTimeout(() => setBanner(""), 1800);
  };

  const openAuthToast = useCallback((why = "save_stack") => {
    const now = Date.now();
    // debounce so it doesn't spam if user clicks rapidly
    if (now - lastAuthToastAtRef.current < 900) return;
    lastAuthToastAtRef.current = now;

    setAuthToastOpen(true);
    setPulse(true);

    window.clearTimeout(openAuthToast._p);
    openAuthToast._p = window.setTimeout(() => setPulse(false), 650);

    window.clearTimeout(openAuthToast._t);
    openAuthToast._t = window.setTimeout(() => setAuthToastOpen(false), 3200);

    // Optional tiny helper message (kept)
    showBanner("Sign in to save stacks.");
    // Don't auto-open modal here (we keep it user-driven for polish)
    // But you CAN uncomment this if you want immediate modal:
    // openLogin(why);
  }, []);

  useEffect(() => {
    return () => {
      window.clearTimeout(openAuthToast._t);
      window.clearTimeout(openAuthToast._p);
      window.clearTimeout(showBanner._t);
    };
  }, [openAuthToast]);

  const toggleCompare = (e) => {
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
  };

  const toggleSave = async (e) => {
    e.stopPropagation();

    if (!userEmail) {
      // 🔥 polished: show toast + pulse
      openAuthToast("save_stack");
      return;
    }

    if (saving) return;
    setSaving(true);

    const optimisticAdd = () => {
      setSavedStacks((prev) => {
        const list = Array.isArray(prev) ? prev : [];
        const exists = list.some((s) => normalizeId(s?.StackID || s?.id) === stackId);
        if (exists) return list;
        return [...list, { StackID: stackId, recordId: null }];
      });
    };

    const optimisticRemove = () => {
      setSavedStacks((prev) => {
        const list = Array.isArray(prev) ? prev : [];
        return list.filter((s) => normalizeId(s?.StackID || s?.id) !== stackId);
      });
    };

    const wasSaved = isSaved;
    if (!wasSaved) optimisticAdd();
    else optimisticRemove();

    try {
      if (!wasSaved) {
        const res = await fetch("/api/saveStack", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ UserEmail: userEmail, stack }),
        });
        if (!res.ok) throw new Error("Failed to save stack");
        const data = await res.json();

        const normalizedSaved = (data.savedStacks || []).map((s) => ({
          ...s,
          StackID: normalizeId(s.StackID || s.id),
        }));
        setSavedStacks(normalizedSaved);
        showBanner("Saved!");
      } else {
        const recordId = savedRecord?.recordId;
        if (!recordId) {
          // rollback (keep saved)
          optimisticAdd();
          showBanner("Couldn’t unsave (missing record). Refresh and try again.");
          setSaving(false);
          return;
        }

        const res = await fetch("/api/removeSavedStack", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ UserEmail: userEmail, recordId }),
        });
        if (!res.ok) throw new Error("Failed to remove saved stack");
        const data = await res.json();

        const normalizedSaved = (data.savedStacks || []).map((s) => ({
          ...s,
          StackID: normalizeId(s.StackID || s.id),
        }));
        setSavedStacks(normalizedSaved);
        showBanner("Unsaved!");
      }
    } catch (err) {
      console.error(err);

      // rollback optimistic change
      if (!wasSaved) optimisticRemove();
      else optimisticAdd();

      showBanner("Save failed. Try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <motion.div
      className={`relative overflow-hidden rounded-2xl shadow-lg cursor-pointer flex flex-col transition-transform hover:scale-[1.02] hover:shadow-2xl ${
        isSelected ? "ring-4 ring-green-500" : ""
      }`}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.25 }}
      onClick={() => {
        if (canOpenModal) setModalStack(stack);
        else showBanner("No nutrition label available for this stack.");
      }}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          if (canOpenModal) setModalStack(stack);
          else showBanner("No nutrition label available for this stack.");
        }
      }}
      aria-label={`Stack card: ${stack?.name || "Stack"}`}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-gray-900 via-gray-800 to-gray-700" />

      {/* Top controls */}
      <div className="absolute top-3 left-3 right-3 z-20 flex items-center justify-between">
        <motion.button
          onClick={toggleCompare}
          className={`w-8 h-8 rounded-full border-2 flex items-center justify-center transition-colors ${
            isSelected ? "bg-green-500 border-green-600" : "bg-gray-900/80 border-gray-600"
          }`}
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.96 }}
          transition={{ type: "spring", stiffness: 420, damping: 30 }}
          title={isSelected ? "Remove from compare" : `Select for compare (max ${maxCompare})`}
          aria-label={isSelected ? "Remove from compare" : "Select for compare"}
          type="button"
        >
          {isSelected && (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="w-4 h-4 text-white"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={3}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          )}
        </motion.button>

        <div className="relative">
          {/* Shockwave ring (pulse) */}
          <AnimatePresence>
            {pulse ? (
              <motion.div
                key="shock"
                className="absolute inset-0 rounded-full border border-white/30"
                initial={{ scale: 0.7, opacity: 0.7 }}
                animate={{ scale: 1.9, opacity: 0 }}
                exit={{ opacity: 0 }}
                transition={{ type: "tween", duration: 0.55, ease: "easeOut" }}
                aria-hidden="true"
              />
            ) : null}
          </AnimatePresence>

          <motion.button
            onClick={toggleSave}
            className={`relative w-9 h-9 rounded-full border flex items-center justify-center ${
              isSaved ? "border-red-500/60 bg-gray-900/70" : "border-gray-600 bg-gray-900/60"
            } ${saving ? "opacity-60 cursor-not-allowed" : ""}`}
            whileTap={{ scale: 0.92 }}
            animate={
              pulse
                ? {
                    scale: [1, 1.12, 1],
                    rotate: [0, -7, 7, 0],
                  }
                : { scale: 1, rotate: 0 }
            }
            // IMPORTANT: keyframes -> use tween (avoids Motion spring limitation)
            transition={pulse ? { type: "tween", duration: 0.28, ease: "easeOut" } : { type: "spring", stiffness: 520, damping: 18 }}
            title={isSaved ? "Unsave" : "Save"}
            aria-label={isSaved ? "Unsave stack" : "Save stack"}
            type="button"
            disabled={saving}
          >
            <FaHeart size={18} className={isSaved ? "text-red-500" : "text-gray-300"} />
          </motion.button>
        </div>
      </div>

      {/* Image */}
      <div className="relative z-[1]">
        {stack?.imageUrl ? (
          <>
            <img
              src={stack.imageUrl}
              alt={stack?.name || "Stack image"}
              className="w-full h-52 md:h-56 lg:h-60 object-cover"
              loading="lazy"
              onError={(e) => (e.currentTarget.src = "/fallback-image.svg")}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-transparent" />
          </>
        ) : (
          <div className="w-full h-52 md:h-56 lg:h-60 bg-gray-700 flex items-center justify-center text-gray-300 text-sm">
            No Image Available
          </div>
        )}
      </div>

      {/* Content */}
      <div className="relative z-[1] p-5 flex flex-col flex-1">
        <h3 className="text-xl md:text-2xl font-bold text-white leading-tight line-clamp-2">
          {stack?.name || "Untitled Stack"}
        </h3>

        {suppPreview.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-3">
            {suppPreview.map((supp) => (
              <span
                key={supp}
                className="flex items-center gap-1 px-3 py-1 bg-white/10 border border-white/10 rounded-full text-xs md:text-sm text-white font-medium shadow-sm"
                title={supp}
              >
                <span className="opacity-90">{supplementIcons[supp] || <FaCapsules />}</span>
                <span className="truncate max-w-[160px]">{supp}</span>
              </span>
            ))}
            {suppMore > 0 && (
              <span className="px-3 py-1 bg-white/5 border border-white/10 rounded-full text-xs md:text-sm text-white/80 font-semibold">
                +{suppMore} more
              </span>
            )}
          </div>
        )}

        {stack?.valueScore != null && !isNaN(stack.valueScore) && (
          <div className="flex flex-wrap gap-2 mt-3">
            <ValueBadge valueScore={stack.valueScore} category={stack.category} />
          </div>
        )}

        {stack?.notes && (
          <p className="text-gray-200/90 text-sm md:text-base mt-3 line-clamp-4">{stack.notes}</p>
        )}

        {/* Polished inline "auth toast" CTA */}
        <AnimatePresence>
          {authToastOpen ? (
            <motion.div
              key="authToast"
              className="mt-4 overflow-hidden rounded-2xl border border-white/10 bg-black/45 backdrop-blur px-4 py-3 text-white"
              initial={{ opacity: 0, y: 10, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.98 }}
              transition={{ type: "tween", duration: 0.18, ease: "easeOut" }}
              onClick={(e) => e.stopPropagation()}
              role="status"
              aria-live="polite"
            >
              <div className="flex items-start gap-3">
                <div className="shrink-0 w-9 h-9 rounded-xl bg-white/10 border border-white/10 flex items-center justify-center">
                  <FaLock className="text-white/90" />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-extrabold leading-tight">Sign in to save stacks</p>
                      <p className="text-[12px] text-white/80 mt-0.5 leading-snug">
                        Your favorites sync across devices in SmartStack.
                      </p>
                    </div>

                    <button
                      type="button"
                      className="shrink-0 p-2 -m-2 text-white/70 hover:text-white"
                      onClick={() => setAuthToastOpen(false)}
                      aria-label="Dismiss"
                    >
                      <FaTimes />
                    </button>
                  </div>

                  <div className="mt-2 flex flex-wrap gap-2">
                  </div>
                </div>
              </div>

              {/* subtle progress indicator */}
              <motion.div
                className="mt-3 h-1 w-full rounded-full bg-white/10 overflow-hidden"
                aria-hidden="true"
              >
                <motion.div
                  className="h-full rounded-full bg-white/40"
                  initial={{ width: "100%" }}
                  animate={{ width: "0%" }}
                  transition={{ type: "tween", duration: 3.2, ease: "linear" }}
                />
              </motion.div>
            </motion.div>
          ) : null}
        </AnimatePresence>

        <div className="flex gap-2 mt-auto pt-4 flex-wrap">
          {stack?.affiliateLink && (
            <a
              href={stack.affiliateLink}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 bg-[#46769B] hover:bg-[#375b7a] rounded-2xl text-white text-sm md:text-base font-semibold shadow-sm transition-colors"
              onClick={(e) => e.stopPropagation()}
            >
              See Price
            </a>
          )}

          <button
            onClick={(e) => {
              e.stopPropagation();
              if (canOpenModal) setModalStack(stack);
              else showBanner("No nutrition label available.");
            }}
            className={`px-4 py-2 rounded-2xl text-sm md:text-base font-semibold transition-colors ${
              canOpenModal ? "bg-white/10 hover:bg-white/15 text-white" : "bg-white/5 text-white/60 cursor-not-allowed"
            }`}
            type="button"
            disabled={!canOpenModal}
          >
            View Nutrition
          </button>
        </div>

        <p className="mt-2 text-white/65 text-xs md:text-sm">
          {isSelected
            ? `Selected for comparison (${selectedCompareStacks.length}/${maxCompare})`
            : `Click ✓ to select for comparison (up to ${maxCompare})`}
        </p>

        {banner && (
          <div className="mt-3 inline-flex w-fit max-w-full items-center rounded-xl border border-white/10 bg-black/45 px-3 py-1.5 text-xs md:text-sm text-white">
            {banner}
          </div>
        )}
      </div>
    </motion.div>
  );
}
