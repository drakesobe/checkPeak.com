// components/org/athletes/AthletesHeader.jsx
"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { RefreshCcw, X, ChevronDown, Bookmark, Upload } from "lucide-react";
import { PageHeader, APP } from "@/components/app/ui";

function SavedViews({ savedViews, onApplyView, onDeleteView }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ position: "relative" }}>
      <button type="button" className="app-btn app-btn--secondary" onClick={() => setOpen((o) => !o)} aria-expanded={open} style={{ height: 32, fontSize: 13 }}>
        <Bookmark size={15} aria-hidden="true" />
        Saved views
        <span className="app-btn-count">{savedViews.length}</span>
        <ChevronDown size={14} aria-hidden="true" style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform 0.15s" }} />
      </button>
      <AnimatePresence>
        {open && (
          <>
            <div style={{ position: "fixed", inset: 0, zIndex: 10 }} onClick={() => setOpen(false)} />
            <motion.div
              initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.14 }}
              className="app-menu"
              style={{ left: 0, right: "auto", zIndex: 20, minWidth: 240 }}
            >
              {savedViews.map((v) => (
                <div key={v.id} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <button type="button" onClick={() => { onApplyView?.(v); setOpen(false); }}>{v.name}</button>
                  <button type="button" onClick={() => onDeleteView?.(v.id)} aria-label={`Delete saved view ${v.name}`} style={{ width: 36, flex: "0 0 36px", justifyContent: "center", color: APP.muted }}>
                    <X size={15} aria-hidden="true" />
                  </button>
                </div>
              ))}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function AthletesHeader({
  onRefresh,
  refreshing,
  savedViews = [],
  onApplyView,
  onDeleteView,
  onImport,
  athleteCount,
}) {
  const hasSavedViews = Array.isArray(savedViews) && savedViews.length > 0;
  const subtitle = refreshing && !athleteCount
    ? "Loading roster…"
    : `${athleteCount || 0} athlete${athleteCount === 1 ? "" : "s"} on your roster`;

  return (
    <PageHeader
      title="Athletes"
      subtitle={subtitle}
      primaryAction={onImport ? { label: "Upload roster", icon: Upload, onClick: onImport } : null}
      secondaryActions={[
        { label: refreshing ? "Refreshing…" : "Refresh", icon: RefreshCcw, onClick: onRefresh, disabled: refreshing },
      ]}
      toolbar={hasSavedViews ? <SavedViews savedViews={savedViews} onApplyView={onApplyView} onDeleteView={onDeleteView} /> : null}
    />
  );
}
