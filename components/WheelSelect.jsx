"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function toStr(v) {
  return v == null ? "" : String(v);
}

function isPrintableKey(key) {
  return typeof key === "string" && key.length === 1;
}

export default function WheelSelect({
  label = "",
  options = [],
  value = "",
  onChange, // still supported (for live typing outside modal if you want)
  onCommit, // recommended: final commit point
  allowCustom = true,
  typeToJump = true,
  placeholder = "Type or scroll…",
  height = 260,
  itemHeight = 44,
  scrollEndMs = 140,

  formatOption, // (optString) => string
  caseSensitive = false,
}) {
  const listRef = useRef(null);
  const modalRef = useRef(null);

  const [open, setOpen] = useState(false);

  // Draft value inside modal (prevents wheel commits overriding typed values)
  const [draftValue, setDraftValue] = useState("");

  // typed buffer for type-to-jump
  const [typed, setTyped] = useState("");
  const typedTimerRef = useRef(null);

  // active row while scrolling
  const [activeIndex, setActiveIndex] = useState(0);

  const scrollEndTimerRef = useRef(null);

  const strOptions = useMemo(() => options.map(toStr), [options]);

  const pad = useMemo(() => {
    return Math.max(0, Math.floor(height / 2) - Math.floor(itemHeight / 2));
  }, [height, itemHeight]);

  const displayValue = useMemo(() => toStr(value).trim(), [value]);

  const format = useCallback(
    (opt) => {
      const s = toStr(opt);
      return typeof formatOption === "function" ? formatOption(s) : s;
    },
    [formatOption]
  );

  const findIndexOfValue = useCallback(
    (v) => {
      const dv = toStr(v).trim();
      if (!dv) return -1;
      return strOptions.findIndex((o) => o === dv);
    },
    [strOptions]
  );

  const scrollToIndex = useCallback(
    (idx, behavior = "smooth") => {
      const el = listRef.current;
      if (!el) return;
      if (!strOptions.length) return;

      const i = clamp(idx, 0, strOptions.length - 1);
      const top = pad + i * itemHeight;
      el.scrollTo({ top, behavior });
    },
    [itemHeight, pad, strOptions.length]
  );

  const computeIndexFromScrollTop = useCallback(
    (scrollTop) => {
      if (!strOptions.length) return 0;
      const raw = (scrollTop - pad) / itemHeight;
      return clamp(Math.round(raw), 0, strOptions.length - 1);
    },
    [itemHeight, pad, strOptions.length]
  );

  const close = () => setOpen(false);

  // Open behavior: lock scroll, initialize draft, align wheel to current value
  useEffect(() => {
    if (!open) return;

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    // init draft from committed value
    setDraftValue(displayValue);

    // focus for type-to-jump
    setTimeout(() => modalRef.current?.focus?.(), 0);

    // align wheel
    const idx = findIndexOfValue(displayValue);
    const initial = idx >= 0 ? idx : 0;
    setActiveIndex(initial);
    setTimeout(() => scrollToIndex(initial, "auto"), 0);

    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [open, displayValue, findIndexOfValue, scrollToIndex]);

  // Cleanup timers
  useEffect(() => {
    return () => {
      if (typedTimerRef.current) clearTimeout(typedTimerRef.current);
      if (scrollEndTimerRef.current) clearTimeout(scrollEndTimerRef.current);
    };
  }, []);

  // Cancel: revert draft
  const handleCancel = () => {
    setTyped("");
    setDraftValue(displayValue);
    close();
  };

  // Commit helper (single source of truth)
  const commitValue = useCallback(
    (v, idx) => {
      const final = toStr(v).trim();
      if (!final) return;

      // Only notify change if different
      if (final !== displayValue) {
        onChange?.(final);
      }
      onCommit?.(final, typeof idx === "number" ? idx : -1);
    },
    [displayValue, onChange, onCommit]
  );

  // Tap option commits immediately (best UX)
  const pick = (idx) => {
    if (!strOptions.length) return;
    const i = clamp(idx, 0, strOptions.length - 1);
    setActiveIndex(i);
    const v = strOptions[i];
    setDraftValue(v);
    scrollToIndex(i, "smooth");
    commitValue(v, i);
    close();
  };

  // Done behavior:
  // - If draft matches an option -> commit that option
  // - If draft empty -> commit active wheel option
  // - Else if allowCustom -> commit custom
  const handleDone = () => {
    if (!strOptions.length) {
      const dv = toStr(draftValue).trim();
      if (allowCustom && dv) {
        commitValue(dv, -1);
      }
      close();
      return;
    }

    const dv = toStr(draftValue).trim();
    const idx = findIndexOfValue(dv);

    if (idx >= 0) {
      // typed matches an option exactly
      commitValue(strOptions[idx], idx);
      close();
      return;
    }

    if (!dv) {
      // empty draft: commit wheel selection
      const v = strOptions[activeIndex] || "";
      if (v) commitValue(v, activeIndex);
      close();
      return;
    }

    // custom
    if (allowCustom) {
      commitValue(dv, -1);
      close();
      return;
    }

    // custom not allowed: do nothing (stay open)
  };

  // Type-to-jump: moves wheel, does NOT overwrite draft unless it’s empty
  const handleKeyDown = (e) => {
    if (!typeToJump) return;

    if (e.key === "Escape") {
      e.preventDefault();
      handleCancel();
      return;
    }

    if (e.key === "Enter") {
      e.preventDefault();
      handleDone();
      return;
    }

    // Backspace edits typed buffer only (not the input)
    if (e.key === "Backspace") {
      // Let input handle backspace normally when focused
      if (document.activeElement?.tagName === "INPUT") return;
      e.preventDefault();
      setTyped((prev) => prev.slice(0, -1));
      return;
    }

    if (!isPrintableKey(e.key)) return;
    // Avoid hijacking keystrokes when typing in the input
    if (document.activeElement?.tagName === "INPUT") return;

    const next = (typed + e.key).slice(0, 16);
    setTyped(next);

    if (typedTimerRef.current) clearTimeout(typedTimerRef.current);
    typedTimerRef.current = setTimeout(() => setTyped(""), 900);

    const needle = caseSensitive ? next : next.toLowerCase();

    let idx = -1;

    // startsWith
    for (let i = 0; i < strOptions.length; i++) {
      const hay = caseSensitive ? strOptions[i] : strOptions[i].toLowerCase();
      if (hay.startsWith(needle)) {
        idx = i;
        break;
      }
    }

    // includes
    if (idx < 0) {
      for (let i = 0; i < strOptions.length; i++) {
        const hay = caseSensitive ? strOptions[i] : strOptions[i].toLowerCase();
        if (hay.includes(needle)) {
          idx = i;
          break;
        }
      }
    }

    // numeric nearest
    if (idx < 0 && /^[0-9.]+$/.test(next)) {
      const target = Number(next);
      let bestIdx = -1;
      let bestDiff = Infinity;
      for (let i = 0; i < strOptions.length; i++) {
        const n = Number(strOptions[i]);
        if (!Number.isFinite(n)) continue;
        const diff = Math.abs(n - target);
        if (diff < bestDiff) {
          bestDiff = diff;
          bestIdx = i;
        }
      }
      idx = bestIdx;
    }

    if (idx >= 0) {
      setActiveIndex(idx);
      scrollToIndex(idx, "smooth");

      // If they haven't typed anything into the input (draft is empty), preview the wheel value
      setDraftValue((prev) => (toStr(prev).trim() ? prev : strOptions[idx]));

      // debounce scroll settle to snap only (no commit)
      if (scrollEndTimerRef.current) clearTimeout(scrollEndTimerRef.current);
      scrollEndTimerRef.current = setTimeout(() => {
        scrollToIndex(idx, "smooth");
      }, scrollEndMs);
    }
  };

  // Scroll preview only (no commit!)
  const handleScroll = () => {
    const el = listRef.current;
    if (!el) return;
    const idx = computeIndexFromScrollTop(el.scrollTop);
    setActiveIndex(idx);

    if (scrollEndTimerRef.current) clearTimeout(scrollEndTimerRef.current);
    scrollEndTimerRef.current = setTimeout(() => {
      scrollToIndex(idx, "smooth");
      // Optional: if draft empty, keep preview synced
      setDraftValue((prev) => (toStr(prev).trim() ? prev : strOptions[idx]));
    }, scrollEndMs);
  };

  return (
    <div className="w-full">
      {label ? <div className="text-xs text-gray-600 mb-1">{label}</div> : null}

      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full text-left px-3 py-2 rounded-lg border border-gray-300 bg-white text-gray-900 hover:bg-gray-50 transition"
      >
        {displayValue ? (
          <span>{displayValue}</span>
        ) : (
          <span className="text-gray-400">{placeholder}</span>
        )}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-3">
          <div
            ref={modalRef}
            tabIndex={0}
            onKeyDown={handleKeyDown}
            className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-gray-200 outline-none overflow-hidden"
            role="dialog"
            aria-modal="true"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
              <div className="font-semibold text-gray-900">{label || "Select"}</div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleCancel}
                  className="px-3 py-1.5 rounded-lg border border-gray-300 text-sm text-gray-800 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDone}
                  className="px-3 py-1.5 rounded-lg bg-[#46769B] text-white text-sm hover:brightness-110"
                >
                  Done
                </button>
              </div>
            </div>

            {/* Input */}
            <div className="px-4 py-3 border-b border-gray-200">
              <input
                value={draftValue}
                onChange={(e) => {
                  const next = e.target.value;
                  setDraftValue(next);
                  // optional live update outside the modal:
                  // onChange?.(next);
                  // keep wheel aligned if typed matches an option
                  const idx = findIndexOfValue(next);
                  if (idx >= 0) {
                    setActiveIndex(idx);
                    scrollToIndex(idx, "smooth");
                  }
                }}
                placeholder={allowCustom ? "Type any value…" : "Type to search…"}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 outline-none focus:ring-2 focus:ring-[#46769B]/30"
              />

              <div className="flex items-center justify-between mt-2">
                <div className="text-xs text-gray-500">
                  {typed ? (
                    <>
                      Jump:{" "}
                      <span className="font-medium text-gray-700">{typed}</span>
                    </>
                  ) : (
                    <>
                      Tip: scroll, tap, or type to jump.{" "}
                      {allowCustom ? "Custom values allowed." : "Custom values disabled."}
                    </>
                  )}
                </div>

                {draftValue && (
                  <button
                    type="button"
                    onClick={() => setDraftValue("")}
                    className="text-xs text-gray-500 hover:text-gray-700"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>

            {/* Wheel */}
            <div className="relative">
              {/* Center highlight band */}
              <div
                className="absolute left-0 right-0 pointer-events-none"
                style={{
                  top: pad,
                  height: itemHeight,
                  borderTop: "1px solid rgba(70,118,155,0.30)",
                  borderBottom: "1px solid rgba(70,118,155,0.30)",
                  background: "rgba(70,118,155,0.08)",
                }}
              />

              {/* Soft fades */}
              <div
                className="absolute left-0 right-0 top-0 pointer-events-none"
                style={{
                  height: pad,
                  background:
                    "linear-gradient(to bottom, rgba(255,255,255,1), rgba(255,255,255,0))",
                }}
              />
              <div
                className="absolute left-0 right-0 bottom-0 pointer-events-none"
                style={{
                  height: pad,
                  background:
                    "linear-gradient(to top, rgba(255,255,255,1), rgba(255,255,255,0))",
                }}
              />

              <div
                ref={listRef}
                onScroll={handleScroll}
                className="overflow-y-auto"
                style={{
                  height,
                  WebkitOverflowScrolling: "touch",
                  overscrollBehavior: "contain",
                  scrollSnapType: "y mandatory",
                  scrollPaddingTop: pad,
                  scrollPaddingBottom: pad,
                }}
              >
                <div style={{ height: pad }} />
                {strOptions.map((opt, idx) => {
                  const active = idx === activeIndex;
                  const dist = Math.abs(idx - activeIndex);

                  const opacity = clamp(1 - dist * 0.18, 0.25, 1);
                  const scale = clamp(1 - dist * 0.035, 0.9, 1);

                  return (
                    <button
                      key={`${opt}-${idx}`}
                      type="button"
                      onClick={() => pick(idx)}
                      className="w-full text-center transition"
                      style={{
                        height: itemHeight,
                        scrollSnapAlign: "center",
                        opacity,
                        transform: `scale(${scale})`,
                        color: active ? "#111827" : "#6B7280",
                        fontWeight: active ? 700 : 500,
                      }}
                    >
                      {format(opt)}
                    </button>
                  );
                })}
                <div style={{ height: pad }} />
              </div>
            </div>

            {/* Footer */}
            <div className="px-4 py-3 text-xs text-gray-600 border-t border-gray-200">
              Wheel:{" "}
              <span className="font-semibold text-gray-900">
                {format(strOptions[activeIndex] ?? "")}
              </span>
              {draftValue ? (
                <>
                  {" "}
                  · Draft:{" "}
                  <span className="font-semibold text-gray-900">
                    {toStr(draftValue).trim()}
                  </span>
                </>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
