// /components/org/workouts-calendar/SportsMoreModal.jsx
"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { Search, X } from "lucide-react";
import Modal from "./Modal";
import Button from "./Button";
import Pill from "./Pill";
import { normalizeSport, titleSport } from "@/lib/org/workoutsCalendar/sports";

function classNames(...xs) {
  return xs.filter(Boolean).join(" ");
}

function uniqNorm(list) {
  const out = [];
  const seen = new Set();
  (Array.isArray(list) ? list : []).forEach((v) => {
    const k = normalizeSport(v);
    if (!k) return;
    if (seen.has(k)) return;
    seen.add(k);
    out.push(k);
  });
  return out;
}

function scoreMatch(label, query) {
  const s = String(label || "").toLowerCase();
  if (!query) return 2;
  if (s.startsWith(query)) return 0;
  if (s.includes(query)) return 1;
  return 2;
}

export default function SportsMoreModal({
  open,
  onClose,
  sportsAll,
  selectedSports,
  setSelectedSports,
  maxSelected = 6, // ✅ cap selection to 6 by default
}) {
  const [q, setQ] = useState("");

  // Normalize the incoming list once
  const all = useMemo(() => {
    const src = Array.isArray(sportsAll) ? sportsAll : [];
    const map = new Map(); // k -> { k, label }
    src.forEach((s) => {
      const k = normalizeSport(s);
      if (!k) return;
      if (!map.has(k)) {
        map.set(k, { k, label: titleSport(s) });
      }
    });

    // Keep deterministic order (alpha by label)
    const out = Array.from(map.values());
    out.sort((a, b) => String(a.label).localeCompare(String(b.label)));
    return out;
  }, [sportsAll]);

  // ✅ staging state (draft) so clicks don't immediately mutate the calendar
  const selected = useMemo(() => uniqNorm(selectedSports), [selectedSports]);
  const [draft, setDraft] = useState([]);

  // Reset draft each time modal opens
  useEffect(() => {
    if (open) {
      setQ("");
      setDraft(selected);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const isDirty = useMemo(() => {
    const a = selected.slice().sort().join("|");
    const b = uniqNorm(draft).slice().sort().join("|");
    return a !== b;
  }, [selected, draft]);

  const limitReached = draft.length >= maxSelected;

  const toggleDraft = useCallback(
    (sportOrKey) => {
      const k = normalizeSport(sportOrKey);
      if (!k) return;

      setDraft((prev) => {
        const cur = uniqNorm(prev);
        const has = cur.includes(k);

        if (has) return cur.filter((x) => x !== k);
        if (cur.length >= maxSelected) return cur; // deny add beyond cap

        return [...cur, k];
      });
    },
    [maxSelected]
  );

  const selectAll = useCallback(() => {
    // Respect cap
    const keys = all.map((x) => x.k).slice(0, maxSelected);
    setDraft(keys);
  }, [all, maxSelected]);

  const clearAll = useCallback(() => setDraft([]), []);

  const apply = useCallback(() => {
    setSelectedSports(uniqNorm(draft));
    onClose?.();
  }, [draft, setSelectedSports, onClose]);

  const cancel = useCallback(() => {
    setDraft(selected);
    onClose?.();
  }, [selected, onClose]);

  const filtered = useMemo(() => {
    const query = String(q || "").trim().toLowerCase();
    if (!query) return all;

    const out = all
      .filter((x) => String(x.label || "").toLowerCase().includes(query))
      .slice();

    out.sort((a, b) => {
      const sa = scoreMatch(a.label, query);
      const sb = scoreMatch(b.label, query);
      if (sa !== sb) return sa - sb;
      return String(a.label).localeCompare(String(b.label));
    });

    return out;
  }, [q, all]);

  // If not searching, pin selected to the top (nice UX when list is long)
  const list = useMemo(() => {
    const query = String(q || "").trim();
    if (query) return filtered;

    const selectedSet = new Set(draft);
    const selectedFirst = all.filter((x) => selectedSet.has(x.k));
    const rest = all.filter((x) => !selectedSet.has(x.k));
    return [...selectedFirst, ...rest];
  }, [q, filtered, all, draft]);

  const inputBase =
    "w-full px-4 py-3 rounded-xl border border-gray-300 bg-white text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#46769B]";

  return (
    <Modal
      open={open}
      onClose={cancel}
      title="Sports filter"
      subtitle={`Select up to ${maxSelected} sports to combine them in the calendar.`}
    >
      <div className="space-y-4">
        {/* Search */}
        <div className="relative">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            className={classNames(inputBase, "pl-10")}
            placeholder="Search sports…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>

        {/* Controls */}
        <div className="flex flex-wrap gap-2 items-center">
          <Button
            variant="secondary"
            onClick={draft.length ? clearAll : selectAll}
            className="px-3 py-2 text-xs"
          >
            {draft.length ? "Clear all" : `Select top ${Math.min(maxSelected, all.length)}`}
          </Button>

          <Button
            variant="secondary"
            onClick={() => setDraft(selected)}
            className="px-3 py-2 text-xs"
            disabled={!isDirty}
          >
            Reset
          </Button>

          <Pill>{draft.length || 0} selected</Pill>
          {limitReached ? <Pill tone="warn">Max {maxSelected} sports</Pill> : null}
        </div>

        {/* Selected chips (quick remove) */}
        {draft.length ? (
          <div className="flex flex-wrap gap-2">
            {draft.map((k) => {
              const item = all.find((x) => x.k === k);
              return (
                <button
                  key={k}
                  type="button"
                  onClick={() => toggleDraft(k)}
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-2xl bg-gray-100 border border-gray-200 text-xs font-semibold text-gray-800 hover:bg-gray-50"
                  title="Remove"
                >
                  {item?.label || titleSport(k)}
                  <X className="w-3.5 h-3.5 opacity-70" />
                </button>
              );
            })}
          </div>
        ) : null}

        {/* Sports grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {list.map((it) => {
            const active = draft.includes(it.k);
            const disabled = !active && limitReached;

            return (
              <button
                key={it.k}
                type="button"
                aria-pressed={active}
                aria-disabled={disabled}
                disabled={disabled}
                className={classNames(
                  "px-3 py-2 rounded-2xl border text-sm font-semibold transition",
                  disabled
                    ? "opacity-50 cursor-not-allowed bg-gray-50 text-gray-400 border-gray-200"
                    : active
                    ? "bg-[#46769B] text-white border-[#46769B]"
                    : "bg-white text-gray-800 border-gray-200 hover:bg-gray-50"
                )}
                onClick={() => toggleDraft(it.k)}
                title={disabled ? `Max ${maxSelected} selected` : "Toggle"}
              >
                {it.label}
              </button>
            );
          })}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={cancel}>
            Cancel
          </Button>
          <Button onClick={apply} disabled={!isDirty}>
            Apply
          </Button>
        </div>
      </div>
    </Modal>
  );
}
