"use client";

import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import Modal from "./Modal";
import Button from "./Button";
import Pill from "./Pill";
import { normalizeSport, titleSport } from "@/lib/org/workoutsCalendar/sports";

function classNames(...xs) {
  return xs.filter(Boolean).join(" ");
}

export default function SportsMoreModal({ open, onClose, sportsAll, selectedSports, setSelectedSports }) {
  const [q, setQ] = useState("");
  const all = Array.isArray(sportsAll) ? sportsAll : [];
  const selected = Array.isArray(selectedSports) ? selectedSports : [];

  useEffect(() => {
    if (open) setQ("");
  }, [open]);

  const list = useMemo(() => {
    const query = String(q || "").trim().toLowerCase();
    if (!query) return all;
    return all.filter((s) => String(s).toLowerCase().includes(query));
  }, [q, all]);

  const toggle = (s) => {
    const k = normalizeSport(s);
    setSelectedSports((prev) => {
      const cur = Array.isArray(prev) ? prev : [];
      if (cur.includes(k)) return cur.filter((x) => x !== k);
      return [...cur, k];
    });
  };

  const allSelected = selected.length === all.length && all.length > 0;
  const selectAll = () => setSelectedSports(all.map((s) => normalizeSport(s)));
  const clearAll = () => setSelectedSports([]);

  const inputBase =
    "w-full px-4 py-3 rounded-xl border border-gray-300 bg-white text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#46769B]";

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Sports filter"
      subtitle="Select multiple sports to combine them in the calendar."
    >
      <div className="space-y-4">
        <div className="relative">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            className={classNames(inputBase, "pl-10")}
            placeholder="Search sports…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>

        <div className="flex flex-wrap gap-2 items-center">
          <Button
            variant="secondary"
            onClick={allSelected ? clearAll : selectAll}
            className="px-3 py-2 text-xs"
          >
            {allSelected ? "Clear all" : "Select all"}
          </Button>
          <Pill>{selected.length || 0} selected</Pill>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {list.map((s) => {
            const k = normalizeSport(s);
            const active = selected.includes(k);
            return (
              <button
                key={s}
                type="button"
                className={classNames(
                  "px-3 py-2 rounded-2xl border text-sm font-semibold transition",
                  active
                    ? "bg-[#46769B] text-white border-[#46769B]"
                    : "bg-white text-gray-800 border-gray-200 hover:bg-gray-50"
                )}
                onClick={() => toggle(s)}
              >
                {titleSport(s)}
              </button>
            );
          })}
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose}>
            Done
          </Button>
        </div>
      </div>
    </Modal>
  );
}
