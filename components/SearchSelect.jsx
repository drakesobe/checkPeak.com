// components/SearchSelect.jsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";

function toStr(v) {
  return v == null ? "" : String(v);
}

export default function SearchSelect({
  label = "",
  options = [],
  value = "",
  onChange,
  onCommit,
  placeholder = "Search or type…",
  allowCustom = true,
  maxResults = 8,
}) {
  const wrapperRef = useRef(null);
  const inputRef = useRef(null);

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(toStr(value));
  const [highlighted, setHighlighted] = useState(0);

  const strOptions = useMemo(() => options.map(toStr), [options]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return strOptions.slice(0, maxResults);
    return strOptions
      .filter((o) => o.toLowerCase().includes(q))
      .slice(0, maxResults);
  }, [query, strOptions, maxResults]);

  // Keep query in sync when value changes externally
  useEffect(() => {
    setQuery(toStr(value));
  }, [value]);

  // Click outside to close
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (!wrapperRef.current?.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const commit = (val) => {
    const v = toStr(val).trim();
    if (!v) return;
    onChange?.(v);
    onCommit?.(v);
    setOpen(false);
  };

  const handleKeyDown = (e) => {
    if (!open) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlighted((h) => Math.min(h + 1, filtered.length));
    }

    if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlighted((h) => Math.max(h - 1, 0));
    }

    if (e.key === "Enter") {
      e.preventDefault();
      if (filtered[highlighted]) {
        commit(filtered[highlighted]);
      } else if (allowCustom && query.trim()) {
        commit(query);
      }
    }

    if (e.key === "Escape") {
      setOpen(false);
    }
  };

  const showCreate =
    allowCustom &&
    query.trim() &&
    !strOptions.includes(query.trim());

  return (
    <div ref={wrapperRef} className="w-full relative">
      {label && (
        <div className="text-xs text-gray-600 mb-1">{label}</div>
      )}

      <input
        ref={inputRef}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setHighlighted(0);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className="w-full px-3 py-2 rounded-lg border border-gray-300 bg-white text-gray-900 outline-none focus:ring-2 focus:ring-[#46769B]/30"
      />

      {open && (filtered.length > 0 || showCreate) && (
        <div className="absolute z-40 mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
          <ul className="max-h-60 overflow-auto text-sm">
            {filtered.map((opt, idx) => (
              <li
                key={`${opt}-${idx}`}
                onMouseDown={() => commit(opt)}
                onMouseEnter={() => setHighlighted(idx)}
                className={`px-3 py-2 cursor-pointer ${
                  idx === highlighted
                    ? "bg-[#46769B]/10 text-gray-900"
                    : "text-gray-700"
                }`}
              >
                {opt}
              </li>
            ))}

            {showCreate && (
              <li
                onMouseDown={() => commit(query)}
                onMouseEnter={() => setHighlighted(filtered.length)}
                className={`px-3 py-2 cursor-pointer border-t text-sm ${
                  highlighted === filtered.length
                    ? "bg-emerald-50 text-emerald-700"
                    : "text-emerald-600"
                }`}
              >
                Create “{query.trim()}”
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
