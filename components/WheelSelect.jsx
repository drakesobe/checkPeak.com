// components/WheelSelect.jsx
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
  onChange,
  onCommit, // optional: fires when the wheel commits final selection
  allowCustom = true,
  typeToJump = true,
  placeholder = "Type or scroll…",
  height = 260,
  itemHeight = 44,
  scrollEndMs = 120,

  // optional: display formatting for options
  formatOption, // (optString) => string
  // optional: how we match typed input
  caseSensitive = false,
}) {
  const listRef = useRef(null);
  const modalRef = useRef(null);

  // UI state
  const [open, setOpen] = useState(false);

  // typed buffer for type-to-jump
  const [typed, setTyped] = useState("");
  const typedTimerRef = useRef(null);

  // While scrolling, we preview selection here
  const [activeIndex, setActiveIndex] = useState(0);

  // Debounce scroll end
  const scrollEndTimerRef = useRef(null);

  // options as strings
  const strOptions = useMemo(() => options.map(toStr), [options]);

  // padding spacer to center the active row
  const pad = useMemo(() => {
    return Math.max(0, Math.floor(height / 2) - Math.floor(itemHeight / 2));
  }, [height, itemHeight]);

  const displayValue = useMemo(() => toStr(value).trim(), [value]);

  const selectedIndex = useMemo(() => {
    if (!displayValue) return -1;
    return strOptions.findIndex((o) => o === displayValue);
  }, [displayValue, strOptions]);

  const format = useCallback(
    (opt) => {
      const s = toStr(opt);
      return typeof formatOption === "function" ? formatOption(s) : s;
    },
    [formatOption]
  );

  const scrollToIndex = useCallback(
    (idx, behavior = "smooth") => {
      const el = listRef.current;
      if (!el) return;

      const i = clamp(idx, 0, strOptions.length - 1);
      const top = pad + i * itemHeight;

      el.scrollTo({ top, behavior });
    },
    [itemHeight, pad, strOptions.length]
  );

  const computeIndexFromScrollTop = useCallback(
    (scrollTop) => {
      const raw = (scrollTop - pad) / itemHeight;
      return clamp(Math.round(raw), 0, strOptions.length - 1);
    },
    [itemHeight, pad, strOptions.length]
  );

  const commitIndex = useCallback(
    (idx) => {
      const i = clamp(idx, 0, strOptions.length - 1);
      const v = strOptions[i];

      // Always snap the wheel to exact center for the committed value
      scrollToIndex(i, "smooth");

      if (!v) return;

      const current = toStr(value).trim();
      if (v !== current) {
        onChange?.(v);
      }

      onCommit?.(v, i);
    },
    [onChange, onCommit, scrollToIndex, strOptions, value]
  );

  // Open: lock background scroll, focus, align
  useEffect(() => {
    if (!open) return;

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    // focus for type-to-jump immediately
    setTimeout(() => modalRef.current?.focus?.(), 0);

    // establish initial wheel position
    const initial = selectedIndex >= 0 ? selectedIndex : 0;
    setActiveIndex(initial);

    // avoid animation on open
    setTimeout(() => scrollToIndex(initial, "auto"), 0);

    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [open, selectedIndex, scrollToIndex]);

  // Cleanup timers
  useEffect(() => {
    return () => {
      if (typedTimerRef.current) clearTimeout(typedTimerRef.current);
      if (scrollEndTimerRef.current) clearTimeout(scrollEndTimerRef.current);
    };
  }, []);

  const close = () => setOpen(false);

  // When the user hits Done:
  // - If value matches an option, snap+commit that option
  // - Otherwise, allow custom value and close
  const handleDone = () => {
    const v = toStr(value).trim();

    // If they are scrolling and activeIndex is pointing somewhere, commit it
    // This ensures Done always produces a deterministic selection.
    if (strOptions.length && activeIndex >= 0) {
      const centered = strOptions[activeIndex];
      // If user typed something custom, only auto-commit wheel if value is empty
      if (!v || v === centered) {
        commitIndex(activeIndex);
        close();
        return;
      }
    }

    // custom entry path
    if (allowCustom && v) {
      onCommit?.(v, -1);
      close();
      return;
    }

    // if custom not allowed, only close if it matches
    const idx = strOptions.indexOf(v);
    if (idx >= 0) {
      commitIndex(idx);
      close();
    }
  };

  const handleCancel = () => {
    // optional: revert typed state
    setTyped("");
    close();
  };

  // Type-to-jump logic
  const handleKeyDown = (e) => {
    if (!typeToJump) return;

    if (e.key === "Escape") {
      e.preventDefault();
      handleCancel();
      return;
    }

    // Backspace edits typed buffer and re-jumps
    if (e.key === "Backspace") {
      e.preventDefault();
      setTyped((prev) => prev.slice(0, -1));
      return;
    }

    if (!isPrintableKey(e.key)) return;

    const next = (typed + e.key).slice(0, 16);
    setTyped(next);

    if (typedTimerRef.current) clearTimeout(typedTimerRef.current);
    typedTimerRef.current = setTimeout(() => setTyped(""), 900);

    const needle = caseSensitive ? next : next.toLowerCase();

    // 1) startsWith match
    let idx = -1;
    for (let i = 0; i < strOptions.length; i++) {
      const hay = caseSensitive ? strOptions[i] : strOptions[i].toLowerCase();
      if (hay.startsWith(needle)) {
        idx = i;
        break;
      }
    }

    // 2) includes match
    if (idx < 0) {
      for (let i = 0; i < strOptions.length; i++) {
        const hay = caseSensitive ? strOptions[i] : strOptions[i].toLowerCase();
        if (hay.includes(needle)) {
          idx = i;
          break;
        }
      }
    }

    // 3) numeric nearest (if typed looks numeric)
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

      // Debounced commit after key-jump to keep selection stable
      if (scrollEndTimerRef.current) clearTimeout(scrollEndTimerRef.current);
      scrollEndTimerRef.current = setTimeout(() => {
        commitIndex(idx);
      }, scrollEndMs);
    }
  };

  // Scroll preview + commit on scroll end
  const handleScroll = () => {
    const el = listRef.current;
    if (!el) return;

    const idx = computeIndexFromScrollTop(el.scrollTop);
    setActiveIndex(idx);

    if (scrollEndTimerRef.current) clearTimeout(scrollEndTimerRef.current);
    scrollEndTimerRef.current = setTimeout(() => {
      commitIndex(idx);
    }, scrollEndMs);
  };

  // Tap option: immediate commit
  const pick = (idx) => {
    setActiveIndex(idx);
    commitIndex(idx);
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
                value={toStr(value)}
                onChange={(e) => onChange?.(e.target.value)}
                placeholder="Type any value…"
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
                      Tip: scroll, or type to jump.{" "}
                      {allowCustom ? "Custom values allowed." : "Custom values disabled."}
                    </>
                  )}
                </div>

                {displayValue && (
                  <button
                    type="button"
                    onClick={() => onChange?.("")}
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

              {/* Soft fades at top/bottom (wheel depth) */}
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

                  // Wheel depth: subtle fade/scale
                  const opacity = clamp(1 - dist * 0.18, 0.25, 1);
                  const scale = clamp(1 - dist * 0.035, 0.90, 1);

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
                        color: active ? "#111827" : "#6B7280", // gray-900 / gray-500
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
              Selected:{" "}
              <span className="font-semibold text-gray-900">
                {format(strOptions[activeIndex] ?? "")}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
