// components/org/athletes/AthletesBulkBar.jsx
"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Copy, Download, ExternalLink, CheckCircle2, XCircle, Star, StarOff, X, Users2 } from "lucide-react";

const DS = {
  brand:       "#1E3A5F",
  brandBg:     "#EEF3F9",
  brandBorder: "#C0D0E0",
  safe:        "#00873E",
  safeBg:      "#F0FBF4",
  safeBorder:  "#A8DFB8",
  caution:     "#B86000",
  banned:      "#C8102E",
  bannedBg:    "#FFF0F0",
  bannedBorder:"#FFC8C8",
  border:      "#E8ECF0",
  cardBg:      "#FFFFFF",
  bodyText:    "#1A2535",
  labelText:   "#5A6A7D",
  dimText:     "#9BA8B4",
};

function BulkBtn({ onClick, disabled, children, variant = "default", title = "" }) {
  const variants = {
    default: { bg: DS.cardBg,   border: DS.border,       color: DS.labelText, hover: DS.brandBg   },
    primary: { bg: DS.brand,    border: DS.brand,         color: "#fff",       hover: "#162d4a"    },
    green:   { bg: DS.safeBg,   border: DS.safeBorder,    color: DS.safe,      hover: "#dcfae6"    },
    danger:  { bg: DS.bannedBg, border: DS.bannedBorder,  color: DS.banned,    hover: "#ffe0e0"    },
  };
  const v = variants[variant] || variants.default;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className="inline-flex items-center gap-1.5 rounded-xl text-xs font-semibold transition-all whitespace-nowrap disabled:opacity-40 disabled:cursor-not-allowed"
      style={{ padding: "7px 12px", background: v.bg, border: `1px solid ${v.border}`, color: v.color }}
      onMouseEnter={e => { if (!disabled) e.currentTarget.style.background = v.hover; }}
      onMouseLeave={e => { e.currentTarget.style.background = v.bg; }}
    >
      {children}
    </button>
  );
}

export default function AthletesBulkBar({
  selectedCount,
  selectedEmailsCount,
  canCopyEmails,
  onCopyEmails,
  onExportSelected,
  onOpenTabs,
  onMarkDone,
  onClearDone,
  onStar,
  onUnstar,
  onClear,
}) {
  return (
    <AnimatePresence>
      {selectedCount > 0 && (
        <motion.div
          className="fixed bottom-0 left-0 right-0 z-30"
          initial={{ y: "100%" }}
          animate={{ y: 0 }}
          exit={{ y: "100%" }}
          transition={{ type: "spring", stiffness: 320, damping: 30 }}
        >
          {/* Top accent */}
          <div className="h-px" style={{ background: `linear-gradient(to right, transparent, ${DS.brand}, transparent)` }} />

          <div
            style={{
              background:     DS.cardBg,
              borderTop:      `1px solid ${DS.border}`,
              boxShadow:      "0 -4px 20px rgba(26,37,53,0.08)",
              paddingBottom:  "max(12px, env(safe-area-inset-bottom))",
            }}
          >
            <div className="max-w-6xl mx-auto px-4 py-3">
              <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">

                {/* Summary */}
                <div className="flex items-center gap-3">
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                    style={{ background: DS.brandBg, border: `1px solid ${DS.brandBorder}` }}
                  >
                    <Users2 className="w-4 h-4" style={{ color: DS.brand }} />
                  </div>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider" style={{ color: DS.labelText }}>
                      Bulk actions
                    </p>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      <span className="text-xs font-bold" style={{ color: DS.brand }}>
                        {selectedCount} selected
                      </span>
                      {selectedEmailsCount > 0 ? (
                        <span className="text-xs" style={{ color: DS.dimText }}>· {selectedEmailsCount} with email</span>
                      ) : (
                        <span className="text-xs font-semibold" style={{ color: DS.caution }}>· no emails</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex flex-wrap gap-1.5">
                  <BulkBtn onClick={onCopyEmails}    disabled={!canCopyEmails} title="Copy selected emails">
                    <Copy className="w-3.5 h-3.5" />
                    Copy emails
                  </BulkBtn>
                  <BulkBtn onClick={onExportSelected} title="Export selected to CSV">
                    <Download className="w-3.5 h-3.5" />
                    Export CSV
                  </BulkBtn>
                  <BulkBtn onClick={onOpenTabs} disabled={!canCopyEmails} variant="primary" title="Open prescriptions (up to 12 tabs)">
                    <ExternalLink className="w-3.5 h-3.5" />
                    Prescriptions
                  </BulkBtn>
                  <BulkBtn onClick={onMarkDone}  variant="green" title="Mark all selected as done">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Done
                  </BulkBtn>
                  <BulkBtn onClick={onClearDone} title="Clear done on selected">
                    <XCircle className="w-3.5 h-3.5" />
                    Undone
                  </BulkBtn>
                  <BulkBtn onClick={onStar}   title="Star selected">
                    <Star className="w-3.5 h-3.5" />
                    Star
                  </BulkBtn>
                  <BulkBtn onClick={onUnstar} title="Unstar selected">
                    <StarOff className="w-3.5 h-3.5" />
                    Unstar
                  </BulkBtn>
                  <BulkBtn onClick={onClear}  variant="danger" title="Clear selection">
                    <X className="w-3.5 h-3.5" />
                    Clear
                  </BulkBtn>
                </div>

              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}