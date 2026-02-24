// components/org/athletes/AthleteDrawer.jsx
"use client";

import { useEffect } from "react";
import {
  X,
  Mail,
  Clipboard,
  Star,
  CheckCircle2,
  ListChecks,
  ExternalLink,
} from "lucide-react";
import { formatDateTime, cleanString, statusPillClass } from "@/lib/org/athletes/utils";

function cx(...xs) {
  return xs.filter(Boolean).join(" ");
}

function clampPct(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function TinyChip({ children, tone = "soft", className = "" }) {
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
        toneCls,
        className
      )}
    >
      {children}
    </span>
  );
}

/**
 * AthleteDrawer (no Next Up)
 * ✅ Fits screen (100vh), only content scrolls
 * ✅ Sticky header inside panel
 * ✅ Header padding respects sticky NavBar via --app-header-h (set by NavBar ResizeObserver)
 * ✅ Clicks inside panel don't bubble to overlay
 * ✅ Background scroll locked while open
 */
export default function AthleteDrawer({
  open,
  athlete,
  onClose,
  batchProgress,
  isDone,
  isStarred,
  onOpenPrescriptions,
  onCopyEmail,
  onToggleDoneAuto,
  onToggleStar,
  noteDirty,
  noteValue,
  onNoteChange,
}) {
  // lock background scroll while open (drawer still scrolls)
  useEffect(() => {
    if (!open) return;
    const prev = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.documentElement.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  const athleteId = String(athlete?.id || "");
  const hasEmail = !!athlete?.email;

  const done = athleteId ? !!isDone?.(athleteId) : false;
  const starred = athleteId ? !!isStarred?.(athleteId) : false;

  const doneN = Number(batchProgress?.done || 0);
  const totalN = Number(batchProgress?.total || 0);
  const pct = clampPct(batchProgress?.pct);

  const progressTone = pct >= 100 ? "ok" : pct >= 50 ? "blue" : "soft";

  // nav-aware padding (NavBar sets --app-header-h)
  const topPad = "calc(env(safe-area-inset-top, 0px) + var(--app-header-h, 0px))";

  const handleClose = (e) => {
    e?.stopPropagation?.();
    onClose?.();
  };

  return (
    <div className="fixed inset-0 z-40">
      {/* Overlay */}
      <div className="absolute inset-0 bg-black/25 backdrop-blur-[1px]" onClick={onClose} />

      {/* Panel (full height) */}
      <div
        className="absolute right-0 top-0 h-screen w-full sm:w-[520px] bg-white border-l border-gray-200 shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Accent */}
        <div className="h-1 w-full bg-gradient-to-r from-[#46769B] via-blue-400 to-emerald-400 opacity-50" />

        {/* Sticky header INSIDE panel */}
        <div className="sticky top-0 z-10 bg-white/95 backdrop-blur border-b border-gray-200">
          {/* Nav-aware padding */}
          <div style={{ paddingTop: topPad }}>
            <div className="p-4 sm:p-5 flex items-start justify-between gap-3">
              <div className="min-w-0">
                {/* Icon + Title */}
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center justify-center h-9 w-9 rounded-2xl border border-blue-100 bg-blue-50">
                    <ListChecks className="w-4.5 h-4.5 text-[#46769B]" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold text-gray-500">Quick View</p>
                    <h3 className="text-lg font-extrabold text-gray-900 truncate">
                      {athlete?.name || "Athlete"}
                    </h3>
                  </div>
                </div>

                {/* Meta row */}
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1 text-xs text-gray-600 truncate max-w-[280px]">
                    <Mail className="w-3.5 h-3.5 text-gray-400" />
                    <span className="truncate">{athlete?.email || "Missing email"}</span>
                  </span>

                  <span className="text-[11px] text-gray-500">
                    Created:{" "}
                    <span className="font-semibold text-gray-700">
                      {formatDateTime(athlete?.createdAt)}
                    </span>
                  </span>

                  <TinyChip tone={progressTone}>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    {totalN ? `${doneN}/${totalN}` : "0/0"} ({pct}%)
                  </TinyChip>

                  <TinyChip tone={hasEmail ? "ok" : "warn"}>
                    <span
                      className={cx(
                        "inline-block h-2 w-2 rounded-full",
                        hasEmail ? "bg-emerald-500" : "bg-amber-500"
                      )}
                    />
                    {hasEmail ? "Ready" : "Incomplete"}
                  </TinyChip>

                  {starred ? <TinyChip tone="warn">★ Priority</TinyChip> : null}
                </div>
              </div>

              {/* Close */}
              <button
                type="button"
                className="inline-flex items-center justify-center h-10 w-10 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 transition"
                onClick={handleClose}
                title="Close"
              >
                <X className="w-4.5 h-4.5" />
              </button>
            </div>

            {/* Mobile: primary actions below header */}
            <div className="sm:hidden px-4 pb-4">
              <div className="grid grid-cols-2 gap-2">
                <button
                  className="px-4 py-3 rounded-xl bg-gray-900 text-white text-sm font-semibold hover:opacity-90 disabled:opacity-50 inline-flex items-center justify-center gap-2"
                  disabled={!hasEmail}
                  onClick={() => onOpenPrescriptions?.(athlete?.email)}
                  title="Open prescriptions"
                >
                  <ExternalLink className="w-4 h-4" />
                  Prescriptions
                </button>

                <button
                  className="px-4 py-3 rounded-xl border border-gray-200 bg-white text-sm font-semibold hover:bg-gray-50 disabled:opacity-50 inline-flex items-center justify-center gap-2"
                  disabled={!hasEmail}
                  onClick={() => onCopyEmail?.(athlete?.email)}
                  title="Copy email"
                >
                  <Clipboard className="w-4 h-4" />
                  Copy
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Scroll area (only this scrolls) */}
        <div className="overflow-y-auto h-[calc(100vh-1px)]">
          <div className="p-4 sm:p-5 space-y-4">
            {/* Status + batch */}
            <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs text-gray-500">Status</p>

                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span className={`text-xs px-2 py-1 rounded-lg border ${statusPillClass(athlete || {})}`}>
                      {hasEmail ? "Ready" : "Incomplete"}
                    </span>

                    <span
                      className={cx(
                        "text-xs px-2 py-1 rounded-lg border inline-flex items-center gap-1",
                        done
                          ? "bg-emerald-600 text-white border-emerald-600"
                          : "bg-white text-gray-700 border-gray-200"
                      )}
                    >
                      <CheckCircle2 className={cx("w-3.5 h-3.5", done ? "text-white" : "text-gray-400")} />
                      {done ? "Done" : "Not done"}
                    </span>

                    <span
                      className={cx(
                        "text-xs px-2 py-1 rounded-lg border inline-flex items-center gap-1",
                        starred
                          ? "bg-yellow-400 text-gray-900 border-yellow-300"
                          : "bg-white text-gray-700 border-gray-200"
                      )}
                    >
                      <Star className={cx("w-3.5 h-3.5", starred ? "text-gray-900" : "text-gray-400")} />
                      {starred ? "Starred" : "Not starred"}
                    </span>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <p className="text-xs text-gray-500">Batch</p>
                  <p className="text-sm font-extrabold text-gray-900 mt-1">
                    {doneN}/{totalN} ({pct}%)
                  </p>
                </div>
              </div>

              <div
                className="mt-3 h-2.5 w-full rounded-full bg-gray-100 border border-gray-200 overflow-hidden"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={pct}
                aria-label="Batch progress"
              >
                <div className="h-full bg-[#46769B] rounded-full transition-all" style={{ width: `${pct}%` }} />
              </div>
            </div>

            {/* Desktop quick actions */}
            <div className="hidden sm:grid grid-cols-2 gap-2">
              <button
                className="px-4 py-3 rounded-xl bg-gray-900 text-white text-sm font-semibold hover:opacity-90 disabled:opacity-50 inline-flex items-center justify-center gap-2"
                disabled={!hasEmail}
                onClick={() => onOpenPrescriptions?.(athlete?.email)}
              >
                <ExternalLink className="w-4 h-4" />
                Prescriptions
              </button>

              <button
                className="px-4 py-3 rounded-xl border border-gray-200 bg-white text-sm font-semibold hover:bg-gray-50 disabled:opacity-50 inline-flex items-center justify-center gap-2"
                disabled={!hasEmail}
                onClick={() => onCopyEmail?.(athlete?.email)}
              >
                <Clipboard className="w-4 h-4" />
                Copy Email
              </button>
            </div>

            {/* Primary toggles */}
            <div className="grid grid-cols-2 gap-2">
              <button
                className={cx(
                  "px-4 py-3 rounded-xl text-sm font-semibold border transition",
                  done
                    ? "bg-emerald-600 text-white border-emerald-600"
                    : "bg-white text-gray-900 border-gray-200 hover:bg-gray-50"
                )}
                onClick={() => athleteId && onToggleDoneAuto?.(athleteId)}
                title="Toggle done (auto-advance when marking done)"
              >
                {done ? "✓ Done (auto)" : "Mark Done (auto)"}
              </button>

              <button
                className={cx(
                  "px-4 py-3 rounded-xl text-sm font-semibold border transition",
                  starred
                    ? "bg-yellow-400 text-gray-900 border-yellow-300"
                    : "bg-white text-gray-900 border-gray-200 hover:bg-gray-50"
                )}
                onClick={() => athleteId && onToggleStar?.(athleteId)}
                title="Toggle star"
              >
                {starred ? "★ Starred" : "Star"}
              </button>
            </div>

            {/* Coach note */}
            <div className="rounded-2xl border border-gray-200 bg-white p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-extrabold text-gray-900">Coach Note</p>
                <span className="text-[11px] text-gray-500">{noteDirty ? "Saving…" : "Saved"}</span>
              </div>

              <p className="text-xs text-gray-500 mt-1">Local-only note for speed. Included in exports.</p>

              <textarea
                className="mt-3 w-full px-4 py-3 rounded-xl border border-gray-300 bg-white text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#46769B]/30 min-h-[120px]"
                value={cleanString(noteValue || "")}
                onChange={(e) => onNoteChange?.(e.target.value)}
                placeholder="Ex: Needs email confirmed • Parent contact • Follow up Monday"
              />
            </div>

            {/* Shortcuts */}
            <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
              <p className="text-sm font-extrabold text-gray-900">Shortcuts</p>
              <p className="text-xs text-gray-600 mt-2 leading-relaxed">
                <span className="font-semibold">/</span> search •{" "}
                <span className="font-semibold">j/k</span> move •{" "}
                <span className="font-semibold">x</span> select •{" "}
                <span className="font-semibold">o</span> open •{" "}
                <span className="font-semibold">d</span> done •{" "}
                <span className="font-semibold">s</span> star
              </p>
            </div>

            {/* Bottom safe-area breathing room */}
            <div style={{ height: "calc(16px + env(safe-area-inset-bottom, 0px))" }} />
          </div>
        </div>
      </div>
    </div>
  );
}