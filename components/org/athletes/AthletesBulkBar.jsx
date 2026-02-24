// components/org/athletes/AthletesBulkBar.jsx
"use client";

import { Copy, Download, ExternalLink, CheckCircle2, XCircle, Star, StarOff, X, Users2 } from "lucide-react";

function cx(...xs) {
  return xs.filter(Boolean).join(" ");
}

function ActionButton({ onClick, disabled, tone = "ghost", title = "", children }) {
  const base = cx(
    "inline-flex items-center justify-center gap-2 rounded-xl",
    "px-3 py-2 text-xs sm:text-sm font-semibold whitespace-nowrap",
    "transition focus:outline-none focus:ring-2 focus:ring-[#46769B]/25",
    disabled ? "opacity-50 cursor-not-allowed" : ""
  );

  const toneCls =
    tone === "primary"
      ? "bg-[#46769B] text-white border border-[#46769B] hover:brightness-105 active:brightness-95"
      : tone === "danger"
      ? "bg-white text-red-700 border border-red-200 hover:bg-red-50"
      : tone === "soft"
      ? "bg-white text-gray-800 border border-blue-200 hover:bg-blue-50"
      : "bg-white text-gray-800 border border-gray-200 hover:bg-gray-50";

  return (
    <button type="button" onClick={onClick} disabled={disabled} title={title} className={cx(base, toneCls)}>
      {children}
    </button>
  );
}

function TinyChip({ children, tone = "soft" }) {
  const toneCls =
    tone === "ok"
      ? "bg-emerald-50 text-emerald-900 border-emerald-200"
      : tone === "blue"
      ? "bg-blue-50 text-blue-900 border-blue-200"
      : tone === "warn"
      ? "bg-amber-50 text-amber-900 border-amber-200"
      : "bg-gray-100 text-gray-700 border-gray-200";

  return (
    <span
      className={cx(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5",
        "text-[11px] font-semibold leading-none whitespace-nowrap",
        toneCls
      )}
    >
      {children}
    </span>
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
  if (selectedCount <= 0) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-30">
      {/* top border + subtle brand accent */}
      <div className="h-1 w-full bg-gradient-to-r from-[#46769B] via-blue-400 to-emerald-400 opacity-40" />

      <div className="border-t border-gray-200 bg-white/90 backdrop-blur">
        <div className="max-w-6xl mx-auto px-4 py-3">
          <div className="flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between">
            {/* Left summary */}
            <div className="flex flex-wrap items-center gap-2 min-w-0">
              <span className="inline-flex items-center justify-center h-9 w-9 rounded-2xl border border-blue-100 bg-blue-50">
                <Users2 className="w-4.5 h-4.5 text-[#46769B]" />
              </span>

              <div className="min-w-0">
                <p className="text-xs font-semibold text-gray-700 leading-tight">
                  Bulk actions
                </p>
                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                  <TinyChip tone="blue">Selected {selectedCount}</TinyChip>
                  {selectedEmailsCount > 0 ? (
                    <TinyChip tone="soft">Emails {selectedEmailsCount}</TinyChip>
                  ) : (
                    <TinyChip tone="warn">No emails selected</TinyChip>
                  )}
                  <TinyChip tone="soft">Tip: use x to select</TinyChip>
                </div>
              </div>
            </div>

            {/* Right actions */}
            <div className="flex flex-wrap gap-2">
              <ActionButton onClick={onCopyEmails} disabled={!canCopyEmails} title="Copy selected emails" tone="ghost">
                <Copy className="w-4 h-4" />
                Copy Emails
              </ActionButton>

              <ActionButton onClick={onExportSelected} title="Export selected rows to CSV" tone="soft">
                <Download className="w-4 h-4" />
                Export CSV
              </ActionButton>

              <ActionButton
                onClick={onOpenTabs}
                disabled={!canCopyEmails}
                title="Opens up to 12 tabs"
                tone="primary"
              >
                <ExternalLink className="w-4 h-4" />
                Open Prescriptions
              </ActionButton>

              <ActionButton onClick={onMarkDone} title="Mark selected as done" tone="ghost">
                <CheckCircle2 className="w-4 h-4" />
                Mark Done
              </ActionButton>

              <ActionButton onClick={onClearDone} title="Clear done on selected" tone="ghost">
                <XCircle className="w-4 h-4" />
                Clear Done
              </ActionButton>

              <ActionButton onClick={onStar} title="Star selected" tone="ghost">
                <Star className="w-4 h-4" />
                Star
              </ActionButton>

              <ActionButton onClick={onUnstar} title="Unstar selected" tone="ghost">
                <StarOff className="w-4 h-4" />
                Unstar
              </ActionButton>

              <ActionButton onClick={onClear} title="Clear selection" tone="danger">
                <X className="w-4 h-4" />
                Clear
              </ActionButton>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}