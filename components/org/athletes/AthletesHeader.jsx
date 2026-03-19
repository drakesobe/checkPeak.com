// components/org/athletes/AthletesHeader.jsx
"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard, RefreshCcw, BookmarkPlus,
  X, ChevronDown, Bookmark, Users,
} from "lucide-react";

function cx(...xs) { return xs.filter(Boolean).join(" "); }

const DS = {
  brand:       "#1E3A5F",
  brandBg:     "#EEF3F9",
  brandBorder: "#C0D0E0",
  border:      "#E8ECF0",
  pageBg:      "#F4F7FB",
  cardBg:      "#FFFFFF",
  bodyText:    "#1A2535",
  labelText:   "#5A6A7D",
  dimText:     "#9BA8B4",
};

function NavBtn({ onClick, disabled, children, title = "" }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className="inline-flex items-center gap-1.5 rounded-xl text-xs font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed"
      style={{
        padding:       "7px 11px",
        background:    DS.cardBg,
        border:        `1px solid ${DS.border}`,
        color:         DS.labelText,
        fontFamily:    "inherit",
        whiteSpace:    "nowrap",
      }}
      onMouseEnter={e => { if (!disabled) e.currentTarget.style.background = DS.brandBg; }}
      onMouseLeave={e => { e.currentTarget.style.background = DS.cardBg; }}
    >
      {children}
    </button>
  );
}

export default function AthletesHeader({
  onDashboard,
  onSaveView,
  onRefresh,
  refreshing,
  savedViews = [],
  onApplyView,
  onDeleteView,
}) {
  const [viewsOpen, setViewsOpen] = useState(false);
  const hasSavedViews = Array.isArray(savedViews) && savedViews.length > 0;

  return (
    <div
      className="rounded-2xl overflow-hidden shadow-sm"
      style={{ background: DS.cardBg, border: `1px solid ${DS.border}` }}
    >
      {/* Top brand accent */}
      <div className="h-1 w-full" style={{ background: `linear-gradient(to right, ${DS.brand}, #4A7FA5, transparent)` }} />

      <div className="px-5 py-3.5 flex items-center justify-between gap-4">

        {/* Left: icon + title */}
        <div className="flex items-center gap-3 min-w-0">
          <span
            className="w-9 h-9 rounded-2xl flex items-center justify-center shrink-0"
            style={{ background: DS.brandBg, border: `1px solid ${DS.brandBorder}` }}
          >
            <Users className="w-4 h-4" style={{ color: DS.brand }} />
          </span>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: DS.dimText }}>Org</p>
            <h1 className="text-lg font-extrabold leading-none" style={{ color: DS.bodyText }}>Athletes</h1>
          </div>
        </div>

        {/* Right: nav actions */}
        <div className="flex items-center gap-1.5 shrink-0">

          {hasSavedViews && (
            <div className="relative">
              <NavBtn onClick={() => setViewsOpen(o => !o)} title="Saved views">
                <Bookmark className="w-3.5 h-3.5" style={{ color: DS.brand }} />
                <span className="hidden sm:inline">Views</span>
                <span
                  className="inline-flex items-center justify-center w-4 h-4 rounded-full text-[9px] font-black"
                  style={{ background: DS.brandBg, color: DS.brand }}
                >
                  {savedViews.length}
                </span>
                <ChevronDown
                  className="w-3 h-3 transition-transform"
                  style={{
                    transform: viewsOpen ? "rotate(180deg)" : "rotate(0deg)",
                    color: DS.labelText,
                  }}
                />
              </NavBtn>

              <AnimatePresence>
                {viewsOpen && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setViewsOpen(false)} />
                    <motion.div
                      initial={{ opacity: 0, y: -6, scale: 0.97 }}
                      animate={{ opacity: 1, y: 0,  scale: 1    }}
                      exit={{   opacity: 0, y: -4, scale: 0.97 }}
                      transition={{ duration: 0.15 }}
                      className="absolute right-0 top-full mt-2 z-20 rounded-xl overflow-hidden min-w-[220px] shadow-lg"
                      style={{ background: DS.cardBg, border: `1px solid ${DS.border}` }}
                    >
                      <div className="px-3 py-2 border-b" style={{ borderColor: DS.border }}>
                        <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: DS.dimText }}>
                          Saved views
                        </p>
                      </div>
                      {savedViews.map(v => (
                        <div
                          key={v.id}
                          className="flex items-center justify-between gap-2 px-3 py-2.5 transition-colors"
                          style={{ borderBottom: `1px solid ${DS.border}` }}
                          onMouseEnter={e => { e.currentTarget.style.background = DS.brandBg; }}
                          onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
                        >
                          <button
                            type="button"
                            onClick={() => { onApplyView?.(v); setViewsOpen(false); }}
                            className="flex-1 text-left text-sm font-medium"
                            style={{ color: DS.bodyText, background: "none", border: "none", cursor: "pointer" }}
                            onMouseEnter={e => { e.currentTarget.style.color = DS.brand; }}
                            onMouseLeave={e => { e.currentTarget.style.color = DS.bodyText; }}
                          >
                            {v.name}
                          </button>
                          <button
                            type="button"
                            onClick={() => onDeleteView?.(v.id)}
                            className="shrink-0 opacity-40 hover:opacity-100 transition-opacity"
                            style={{ color: DS.labelText, background: "none", border: "none", cursor: "pointer" }}
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
          )}

          <NavBtn onClick={onSaveView} title="Save current view">
            <BookmarkPlus className="w-3.5 h-3.5" style={{ color: DS.brand }} />
            <span className="hidden sm:inline">Save view</span>
          </NavBtn>

          <NavBtn onClick={onDashboard} title="Back to dashboard">
            <LayoutDashboard className="w-3.5 h-3.5" style={{ color: DS.brand }} />
            <span className="hidden sm:inline">Dashboard</span>
          </NavBtn>

          <NavBtn onClick={onRefresh} disabled={refreshing} title="Refresh">
            <RefreshCcw className={cx("w-3.5 h-3.5", refreshing ? "animate-spin" : "")} style={{ color: DS.brand }} />
          </NavBtn>
        </div>
      </div>
    </div>
  );
}