"use client";

import { useMemo, useState, useEffect } from "react";
import { motion, AnimatePresence, useAnimation } from "framer-motion";
import { CheckCircle2, Circle, ArrowRight, Undo2 } from "lucide-react";
import { cx } from "../helpers"; // adjust if needed

/**
 * SwipeCompleteRow (Polished + snaps back to origin)
 * - Drag right to confirm
 * - Always returns to original spacing (x=0)
 * - Stronger completed state
 * - Micro-interactions
 *
 * Props:
 *  - title, subtitle, done, onToggle, icon, disabled
 *  - tone (optional): "meal" | "water" | "base"
 */
export default function SwipeCompleteRow({
  title,
  subtitle,
  done,
  onToggle,
  icon,
  disabled = false,
  tone = "base",
}) {
  const controls = useAnimation();

  const [armed, setArmed] = useState(false);
  const [dragX, setDragX] = useState(0);

  const threshold = 92;

  // Ensure we always visually reset if the parent flips done state
  useEffect(() => {
    controls.start({ x: 0, transition: { type: "spring", stiffness: 520, damping: 42 } });
    setDragX(0);
    setArmed(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done]);

  const toneStyles = useMemo(() => {
    if (tone === "water") {
      return {
        ring: done ? "ring-blue-200/70" : "ring-gray-200/60",
        tint: done ? "bg-blue-50" : "bg-white",
        border: done ? "border-blue-200" : "border-gray-200",
        chip: done ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-800 border-gray-200",
        iconWrap: done ? "bg-blue-100 border-blue-200" : "bg-gray-50 border-gray-200",
        glow: done ? "shadow-[0_10px_30px_-12px_rgba(37,99,235,.45)]" : "shadow-sm",
        hint: "text-blue-700",
        bar: "bg-blue-500",
      };
    }
    if (tone === "meal") {
      return {
        ring: done ? "ring-emerald-200/70" : "ring-gray-200/60",
        tint: done ? "bg-emerald-50" : "bg-white",
        border: done ? "border-emerald-200" : "border-gray-200",
        chip: done ? "bg-emerald-600 text-white border-emerald-600" : "bg-white text-gray-800 border-gray-200",
        iconWrap: done ? "bg-emerald-100 border-emerald-200" : "bg-gray-50 border-gray-200",
        glow: done ? "shadow-[0_10px_30px_-12px_rgba(5,150,105,.45)]" : "shadow-sm",
        hint: "text-emerald-700",
        bar: "bg-emerald-500",
      };
    }
    return {
      ring: done ? "ring-[#46769B]/25" : "ring-gray-200/60",
      tint: done ? "bg-gray-50" : "bg-white",
      border: "border-gray-200",
      chip: done ? "bg-gray-900 text-white border-gray-900" : "bg-white text-gray-800 border-gray-200",
      iconWrap: done ? "bg-gray-100 border-gray-200" : "bg-gray-50 border-gray-200",
      glow: done ? "shadow-md" : "shadow-sm",
      hint: "text-[#46769B]",
      bar: "bg-[#46769B]",
    };
  }, [tone, done]);

  const showHint = !done && !disabled;

  const resetPosition = () => {
    controls.start({ x: 0, transition: { type: "spring", stiffness: 520, damping: 42 } });
    setDragX(0);
    setArmed(false);
  };

  return (
    <div
      className={cx(
        "relative rounded-2xl border overflow-hidden",
        toneStyles.border,
        toneStyles.tint,
        toneStyles.glow,
        disabled && "opacity-70"
      )}
    >
      {/* soft ring */}
      <div className={cx("absolute inset-0 ring-1", toneStyles.ring)} />

      {/* completion sheen */}
      <AnimatePresence>
        {done ? (
          <motion.div
            key="sheen"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="pointer-events-none absolute inset-0"
          >
            <div className="absolute -top-24 -right-24 h-48 w-48 rounded-full bg-white/40 blur-2xl" />
          </motion.div>
        ) : null}
      </AnimatePresence>

      {/* swipe hint track */}
      <div className="absolute inset-y-0 right-0 w-28 pointer-events-none">
        <AnimatePresence initial={false}>
          {showHint ? (
            <motion.div
              key="hintTrack"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className={cx("h-full flex items-center justify-center", armed ? "bg-black/5" : "bg-transparent")}
            >
              <motion.div
                animate={{ x: [0, 6, 0] }}
                transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
                className={cx("inline-flex items-center gap-2 text-[11px] font-semibold", toneStyles.hint)}
              >
                <span>Swipe</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </motion.div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>

      {/* draggable content */}
      <motion.div
        animate={controls}
        drag={disabled ? false : "x"}
        dragConstraints={{ left: 0, right: 120 }}
        dragElastic={0.08}
        dragMomentum={false}
        dragSnapToOrigin
        onDrag={(e, info) => {
          if (disabled) return;
          setDragX(info.offset.x);
          setArmed(info.offset.x > threshold * 0.8);
        }}
        onDragEnd={(e, info) => {
          if (disabled) return;

          const shouldComplete = info.offset.x > threshold;

          // Always snap back visually
          resetPosition();

          // Then trigger the toggle
          if (shouldComplete) onToggle?.();
        }}
        whileHover={disabled ? undefined : { scale: 1.005 }}
        whileTap={disabled ? undefined : { scale: 0.995 }}
        className="relative p-4"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <div
                className={cx(
                  "h-10 w-10 rounded-2xl border flex items-center justify-center shrink-0 transition",
                  toneStyles.iconWrap
                )}
              >
                <motion.div
                  initial={false}
                  animate={done ? { rotate: [0, -6, 0], scale: [1, 1.06, 1] } : { rotate: 0, scale: 1 }}
                  transition={{ duration: 0.35 }}
                >
                  {icon}
                </motion.div>
              </div>

              <div className="min-w-0">
                <p className="text-sm font-extrabold text-gray-900 truncate">{title}</p>
                {subtitle ? <p className="text-[12px] text-gray-600 mt-0.5 break-words">{subtitle}</p> : null}
              </div>
            </div>

            <div className="mt-3 flex items-center gap-2">
              <span
                className={cx(
                  "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold",
                  done ? "bg-white/60 border-white/40 text-gray-800" : "bg-gray-50 border-gray-200 text-gray-700"
                )}
              >
                {done ? (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Completed
                  </>
                ) : (
                  <>
                    <Circle className="w-3.5 h-3.5" />
                    Not done yet
                  </>
                )}
              </span>

              {showHint ? (
                <span className="text-[11px] text-gray-500">
                  {armed ? <span className={cx("font-semibold", toneStyles.hint)}>Release to complete</span> : "Swipe or tap Done"}
                </span>
              ) : (
                <span className="text-[11px] text-gray-500">{disabled ? "Unavailable" : "Nice."}</span>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              if (disabled) return;
              // ensure reset even on button press (keeps spacing perfect)
              resetPosition();
              onToggle?.();
            }}
            disabled={disabled}
            aria-pressed={done}
            className={cx(
              "shrink-0 rounded-full px-3 py-2 text-[12px] font-extrabold border transition",
              "inline-flex items-center gap-2",
              toneStyles.chip,
              disabled && "cursor-not-allowed opacity-70"
            )}
            title={done ? "Mark as not done" : "Mark as done"}
          >
            {done ? (
              <>
                <Undo2 className="w-4 h-4" />
                Undo
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" />
                Done
              </>
            )}
          </button>
        </div>

        {/* subtle progress fill based on drag */}
        {showHint ? (
          <div className="mt-3">
            <div className="h-1.5 w-full rounded-full bg-gray-100 border border-gray-200 overflow-hidden">
              <motion.div
                className={cx("h-full rounded-full", toneStyles.bar)}
                animate={{ width: `${Math.max(0, Math.min(100, (dragX / threshold) * 100))}%` }}
                transition={{ duration: 0.1 }}
              />
            </div>
          </div>
        ) : null}
      </motion.div>
    </div>
  );
}
