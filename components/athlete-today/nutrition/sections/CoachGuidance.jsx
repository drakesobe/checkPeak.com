// components/athlete-today/nutrition/sections/CoachGuidance.jsx
"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ChevronDown, ChevronUp,
  NotebookText, Pill, Shield,
} from "lucide-react";
import { safeText } from "../helpers";

const C = {
  brand:       "#1E3A5F",
  brandBg:     "#EEF3F8",
  brandBorder: "#C5D5E8",
};

function SupplementCard({ label, value, affiliateLink, imageUrl, pricePerServing }) {
  const hasProduct = Boolean(affiliateLink || imageUrl);
  const priceLabel = pricePerServing != null
    ? `$${Number(pricePerServing).toFixed(2)} / serving`
    : null;

  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50 overflow-hidden min-w-0">
      {/* If we have a product image, show it as a header strip */}
      {imageUrl && (
        <div className="w-full overflow-hidden bg-white" style={{ height: 80 }}>
          <img
            src={imageUrl}
            alt={value}
            className="w-full h-full object-cover"
            loading="lazy"
            onError={(e) => { e.currentTarget.style.opacity = "0.3"; }}
          />
        </div>
      )}

      <div className="p-3">
        <p className="text-[11px] text-gray-400 font-semibold mb-1 truncate">{label}</p>
        <p className="text-sm font-extrabold text-gray-900 break-words leading-snug">
          {value}
        </p>

        {/* Price + Amazon link */}
        <div className="flex items-center justify-between gap-2 mt-2 flex-wrap">
          {priceLabel && (
            <p className="text-[11px] tabular-nums text-gray-400">{priceLabel}</p>
          )}
          {affiliateLink && (
            <a
              href={affiliateLink}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[11px] font-black uppercase tracking-wide"
              style={{ color: "#1E3A5F" }}
            >
              Buy on Amazon ↗
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Component ── */
export default function CoachGuidance({ coachNotes, supplementItems, supplementNotes }) {
  const [open, setOpen] = useState(false);

  const notes    = safeText(coachNotes);
  const items    = Array.isArray(supplementItems) ? supplementItems : [];
  const suppNote = safeText(supplementNotes);

  const hasNotes = Boolean(notes);
  const hasItems = items.length > 0;
  const hasSupps = hasItems || Boolean(suppNote);

  // Caller is responsible for not rendering this when empty (NutritionCard checks hasGuidance).
  // But we guard here too just in case.
  if (!hasNotes && !hasSupps) return null;

  // Build a short preview line for when collapsed
  const preview = hasNotes
    ? String(notes).trim().split("\n").find(Boolean)?.replace(/\s+/g, " ").slice(0, 80) || ""
    : hasItems
    ? safeText(items[0]?.label) || "Supplement info available."
    : "Supplement notes available.";

  // Count badge content
  const parts = [];
  if (hasNotes)         parts.push("Notes");
  if (hasItems)         parts.push(`${items.length} supp${items.length === 1 ? "" : "s"}`);
  else if (Boolean(suppNote)) parts.push("Supp notes");

  return (
    <div
      className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden"
      style={{ borderTop: `3px solid ${C.brand}` }}
    >
      <div className="p-4">
        {/* Toggle button */}
        <button
          type="button"
          onClick={() => setOpen(v => !v)}
          className="w-full text-left focus:outline-none rounded-xl"
          aria-expanded={open}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3 min-w-0">
              <span
                className="shrink-0 h-8 w-8 rounded-xl flex items-center justify-center"
                style={{ backgroundColor: C.brandBg, border: `1px solid ${C.brandBorder}` }}
              >
                <NotebookText className="w-4 h-4" style={{ color: C.brand }} />
              </span>

              <div className="min-w-0 pt-px">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-extrabold text-gray-900">Coach guidance</p>
                  <span
                    className="inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold leading-none whitespace-nowrap"
                    style={{ borderColor: C.brandBorder, backgroundColor: C.brandBg, color: C.brand }}
                  >
                    {parts.join(" · ")}
                  </span>
                </div>
                {!open && (
                  <p className="text-[11px] text-gray-400 mt-0.5 truncate">{preview}</p>
                )}
              </div>
            </div>

            <span className="shrink-0 h-8 w-8 rounded-xl border border-gray-200 bg-white flex items-center justify-center hover:bg-gray-50 transition">
              {open
                ? <ChevronUp   className="w-4 h-4 text-gray-500" />
                : <ChevronDown className="w-4 h-4 text-gray-500" />}
            </span>
          </div>
        </button>

        {/* Collapsible body */}
        <AnimatePresence initial={false}>
          {open && (
            <motion.div
              key="coach-body"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.18 }}
              className="overflow-hidden"
            >
              <div className="mt-4 space-y-4">
                <div className="h-px w-full bg-gray-100" />

                {/* Coach notes */}
                {hasNotes && (
                  <div>
                    <div className="flex items-center gap-1.5 mb-2">
                      <NotebookText className="w-3.5 h-3.5 text-gray-400" />
                      <p className="text-[11px] font-extrabold uppercase tracking-wide text-gray-500">
                        Notes
                      </p>
                    </div>
                    <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
                      <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap break-words">
                        {notes}
                      </p>
                    </div>
                  </div>
                )}

                {/* Supplements */}
                {hasSupps && (
                  <div>
                    <div className="flex items-center gap-1.5 mb-2">
                      <Pill className="w-3.5 h-3.5 text-gray-400" />
                      <p className="text-[11px] font-extrabold uppercase tracking-wide text-gray-500">
                        Supplements
                      </p>
                    </div>

                    {hasItems ? (
                      <div className="grid sm:grid-cols-2 gap-2">
                        {items.map((it, idx) => (
                          <SupplementCard
                            key={String(it?.k ?? it?.label ?? idx)}
                            label={safeText(it?.label) || "Supplement"}
                            value={safeText(it?.value) || "—"}
                            affiliateLink={it?.affiliateLink || ""}
                            imageUrl={it?.imageUrl || ""}
                            pricePerServing={it?.pricePerServing ?? null}
                          />
                        ))}
                      </div>
                    ) : null}

                    {suppNote && (
                      <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 mt-2">
                        <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap break-words">
                          {suppNote}
                        </p>
                      </div>
                    )}

                    {/* Safety reminder — compact, not a lecture */}
                    <div className="mt-2 rounded-xl border border-gray-200 bg-white px-3 py-2.5 flex items-center gap-2">
                      <Shield className="w-3.5 h-3.5 text-gray-300 shrink-0" />
                      <p className="text-[11px] text-gray-400">
                        Prefer third-party tested products (NSF Certified for Sport).
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}