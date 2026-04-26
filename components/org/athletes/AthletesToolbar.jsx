// components/org/athletes/AthletesToolbar.jsx
"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search, X, Download, ChevronLeft, ChevronRight,
  SlidersHorizontal, ChevronDown,
} from "lucide-react";

const DS = {
  brand:       "#1E3A5F",
  brandBg:     "#EEF3F9",
  brandBorder: "#C0D0E0",
  banned:      "#C8102E",
  bannedBg:    "#FFF0F0",
  bannedBorder:"#FFC8C8",
  border:      "#E8ECF0",
  cardBg:      "#FFFFFF",
  bodyText:    "#1A2535",
  labelText:   "#5A6A7D",
  dimText:     "#9BA8B4",
};

function FilterPill({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-full text-xs font-semibold transition-all whitespace-nowrap"
      style={{
        padding:    "5px 12px",
        background:  active ? DS.brand  : DS.cardBg,
        border:      active ? `1px solid ${DS.brand}` : `1px solid ${DS.border}`,
        color:       active ? "#fff"    : DS.labelText,
      }}
      onMouseEnter={e => { if (!active) e.currentTarget.style.background = DS.brandBg; }}
      onMouseLeave={e => { if (!active) e.currentTarget.style.background = DS.cardBg; }}
    >
      {children}
    </button>
  );
}

function SmallBtn({ onClick, disabled, children, title = "" }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className="inline-flex items-center gap-1.5 rounded-lg text-xs font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
      style={{
        padding:    "6px 10px",
        background: DS.cardBg,
        border:     `1px solid ${DS.border}`,
        color:      DS.labelText,
      }}
      onMouseEnter={e => { if (!disabled) e.currentTarget.style.background = DS.brandBg; }}
      onMouseLeave={e => { e.currentTarget.style.background = DS.cardBg; }}
    >
      {children}
    </button>
  );
}

const inputStyle = {
  background:   DS.cardBg,
  border:       `1px solid ${DS.border}`,
  borderRadius: 12,
  color:        DS.bodyText,
  fontSize:     13,
  outline:      "none",
  transition:   "border-color 0.15s ease",
};

const selectStyle = {
  ...inputStyle,
  padding:    "8px 12px",
  cursor:     "pointer",
  appearance: "none",
  minWidth:   110,
};

export default function AthletesToolbar({
  error,
  query,
  setQuery,
  sortKey,
  setSortKey,
  sortDir,
  toggleSortDir,
  pageSize,
  setPageSize,
  onReset,
  filter,
  setFilter,
  stats,
  pagedCount,
  filteredCount,
  selectedCount,
  safePage,
  totalPages,
  onPrevPage,
  onNextPage,
  searchRef,
  onSelectPage,
  onClearSelection,
  onExportFiltered,
}) {
  const [secondaryOpen, setSecondaryOpen] = useState(false);
  const s = stats || {};

  const hasActiveFilters = filter !== "all" || query.length > 0;
  const activeCount = (filter !== "all" ? 1 : 0) + (query ? 1 : 0);

  const filters = [
    { key: "all",        label: "All",        count: s.total        ?? 0 },
    { key: "ready",      label: "Ready",      count: s.ready        ?? 0 },
    { key: "incomplete", label: "Incomplete", count: s.incomplete   ?? 0 },
    { key: "done",       label: "Done",       count: s.doneCount    ?? 0 },
    { key: "starred",    label: "Starred",    count: s.starredCount ?? 0 },
  ];

  return (
    <div
      className="rounded-2xl overflow-hidden shadow-sm"
      style={{ background: DS.cardBg, border: `1px solid ${DS.border}` }}
    >
      <div className="px-4 pt-4 pb-3.5 space-y-3">

        {/* Error */}
        {error && (
          <div
            className="rounded-xl px-4 py-3 text-sm"
            style={{ background: "#FFF0F0", border: `1px solid ${DS.bannedBorder}`, color: DS.banned }}
          >
            {error}
          </div>
        )}

        {/* Search */}
        <div className="relative">
          <input
            ref={searchRef}
            style={{ ...inputStyle, padding: "10px 14px 10px 38px", width: "100%" }}
            placeholder="Search name, email, sport, team…"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onFocus={e => { e.currentTarget.style.border = `1px solid ${DS.brand}`; }}
            onBlur={e  => { e.currentTarget.style.border = `1px solid ${DS.border}`; }}
          />
          <Search
            className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none"
            style={{ color: DS.dimText }}
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 rounded-full opacity-60 hover:opacity-100 transition-opacity"
              style={{ color: DS.labelText, background: "none", border: "none", cursor: "pointer" }}
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Filter pills + More toggle */}
        <div className="flex items-center gap-2">
          <div className="flex-1 flex items-center gap-1.5 overflow-x-auto scrollbar-none">
            {filters.map(f => (
              <FilterPill
                key={f.key}
                active={filter === f.key}
                onClick={() => setFilter(f.key)}
              >
                {f.label}
                <span
                  className="ml-1 tabular-nums text-[10px]"
                  style={{ color: filter === f.key ? "rgba(255,255,255,0.7)" : DS.dimText }}
                >
                  {f.count}
                </span>
              </FilterPill>
            ))}

            {hasActiveFilters && (
              <button
                type="button"
                onClick={onReset}
                className="rounded-full text-[10px] font-bold transition-all whitespace-nowrap inline-flex items-center gap-1"
                style={{
                  padding:    "5px 10px",
                  background: "#FFF0F0",
                  border:     `1px solid ${DS.bannedBorder}`,
                  color:      DS.banned,
                }}
                onMouseEnter={e => { e.currentTarget.style.background = "#FFE0E0"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "#FFF0F0"; }}
              >
                <X className="w-2.5 h-2.5" />
                Reset
              </button>
            )}
          </div>

          {/* More toggle */}
          <button
            type="button"
            onClick={() => setSecondaryOpen(o => !o)}
            className="shrink-0 inline-flex items-center gap-1 rounded-xl text-xs font-semibold transition-all"
            style={{
              padding:    "6px 10px",
              background:  secondaryOpen ? DS.brandBg : DS.cardBg,
              border:      secondaryOpen ? `1px solid ${DS.brandBorder}` : `1px solid ${DS.border}`,
              color:       secondaryOpen ? DS.brand   : DS.labelText,
            }}
            onMouseEnter={e => { if (!secondaryOpen) e.currentTarget.style.background = DS.brandBg; }}
            onMouseLeave={e => { if (!secondaryOpen) e.currentTarget.style.background = DS.cardBg; }}
          >
            <SlidersHorizontal className="w-3 h-3" />
            <span className="hidden sm:inline">More</span>
            <ChevronDown
              className="w-3 h-3 transition-transform"
              style={{ transform: secondaryOpen ? "rotate(180deg)" : "rotate(0deg)" }}
            />
            {activeCount > 0 && (
              <span
                className="w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-black"
                style={{ background: DS.brandBg, color: DS.brand }}
              >
                {activeCount}
              </span>
            )}
          </button>
        </div>

        {/* Secondary row — collapsible */}
        <AnimatePresence initial={false}>
          {secondaryOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="overflow-hidden"
            >
              <div
                className="pt-3 space-y-2.5"
                style={{ borderTop: `1px solid ${DS.border}` }}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    style={{ ...selectStyle, padding: "7px 12px" }}
                    value={sortKey}
                    onChange={e => setSortKey(e.target.value)}
                    onFocus={e => { e.currentTarget.style.border = `1px solid ${DS.brand}`; }}
                    onBlur={e  => { e.currentTarget.style.border = `1px solid ${DS.border}`; }}
                  >
                    <option value="createdAt">Sort: Created</option>
                    <option value="name">Sort: Name</option>
                    <option value="email">Sort: Email</option>
                  </select>

                  <button
                    type="button"
                    onClick={toggleSortDir}
                    className="rounded-xl text-sm font-bold transition-all"
                    style={{
                      padding:    "7px 12px",
                      background: DS.cardBg,
                      border:     `1px solid ${DS.border}`,
                      color:      DS.labelText,
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = DS.brandBg; }}
                    onMouseLeave={e => { e.currentTarget.style.background = DS.cardBg; }}
                  >
                    {sortDir === "asc" ? "↑" : "↓"}
                  </button>

                  <select
                    style={{ ...selectStyle, padding: "7px 12px" }}
                    value={pageSize}
                    onChange={e => setPageSize(Number(e.target.value) || 50)}
                  >
                    <option value={10}>10/page</option>
                    <option value={25}>25/page</option>
                    <option value={50}>50/page</option>
                    <option value={100}>100/page</option>
                  </select>

                  <div className="hidden sm:block self-stretch w-px" style={{ background: DS.border }} aria-hidden="true" />

                  <SmallBtn onClick={onSelectPage}      title="Select all rows on this page">Select page</SmallBtn>
                  <SmallBtn onClick={onClearSelection}  disabled={selectedCount === 0}       title="Clear selection">Clear selection</SmallBtn>
                  <SmallBtn onClick={onExportFiltered}  title="Export filtered list to CSV">
                    <Download className="w-3 h-3" />
                    Export CSV
                  </SmallBtn>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Status + pagination */}
        <div className="flex items-center justify-between gap-3 pt-0.5" style={{ borderTop: `1px solid ${DS.border}` }}>
          <p className="text-xs pt-2.5" style={{ color: DS.dimText }}>
            <span style={{ color: DS.bodyText, fontWeight: 600 }}>{pagedCount}</span>
            {" "}of{" "}
            <span style={{ color: DS.bodyText, fontWeight: 600 }}>{filteredCount}</span>
            {" "}showing
            {selectedCount > 0 && (
              <> ·{" "}
                <span style={{ color: DS.brand, fontWeight: 600 }}>{selectedCount} selected</span>
              </>
            )}
          </p>

          <div className="flex items-center gap-1.5 pt-2.5">
            <button
              type="button"
              onClick={onPrevPage}
              disabled={safePage <= 1}
              className="w-7 h-7 rounded-lg flex items-center justify-center transition-all disabled:opacity-30"
              style={{ background: DS.cardBg, border: `1px solid ${DS.border}`, color: DS.labelText }}
              onMouseEnter={e => { e.currentTarget.style.background = DS.brandBg; }}
              onMouseLeave={e => { e.currentTarget.style.background = DS.cardBg; }}
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>

            <span className="text-xs font-semibold tabular-nums" style={{ color: DS.labelText, minWidth: 40, textAlign: "center" }}>
              {safePage} / {totalPages}
            </span>

            <button
              type="button"
              onClick={onNextPage}
              disabled={safePage >= totalPages}
              className="w-7 h-7 rounded-lg flex items-center justify-center transition-all disabled:opacity-30"
              style={{ background: DS.cardBg, border: `1px solid ${DS.border}`, color: DS.labelText }}
              onMouseEnter={e => { e.currentTarget.style.background = DS.brandBg; }}
              onMouseLeave={e => { e.currentTarget.style.background = DS.cardBg; }}
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}