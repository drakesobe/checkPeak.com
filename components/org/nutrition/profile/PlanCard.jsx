"use client";

import { useMemo, useState } from "react";
import { fmtDateTime } from "./utils";
import { EmptyState } from "./ui";

function cx(...xs) {
  return xs.filter(Boolean).join(" ");
}

function safeText(v) {
  const s = String(v ?? "").trim();
  return s.length ? s : "";
}

export function PlanCard({ plan, onEditPlan }) {
  const createdAt = plan?.createdAt || "";
  const createdBy = safeText(plan?.createdBy);
  const prescription = safeText(plan?.prescription);

  const hasPlan = Boolean(createdAt || prescription);

  const metaLine = useMemo(() => {
    if (!hasPlan) return "No plan found for this athlete.";
    const pieces = [];
    if (createdAt) pieces.push(`Created ${fmtDateTime(createdAt)} ET`);
    if (createdBy) pieces.push(`by ${createdBy}`);
    return pieces.join(" • ") || "Plan is active.";
  }, [hasPlan, createdAt, createdBy]);

  const [expanded, setExpanded] = useState(false);
  const canExpand = prescription.length > 550;

  async function onCopy() {
    if (!prescription) return;
    try {
      await navigator.clipboard.writeText(prescription);
      // optional: hook into your toast system if you have one
    } catch {
      // ignore silently (some browsers block clipboard)
    }
  }

  return (
    <section className="bg-white rounded-2xl shadow-md border border-blue-100 p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-lg font-extrabold text-gray-900">Current Nutrition Plan</h2>
          <p className="text-sm text-gray-500 mt-1 break-words">{metaLine}</p>
        </div>

        <span
          className={cx(
            "shrink-0 text-[11px] px-2 py-1 rounded-lg border font-semibold",
            hasPlan
              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
              : "bg-red-50 text-red-700 border-red-200"
          )}
          aria-label={hasPlan ? "Plan active" : "Plan missing"}
        >
          {hasPlan ? "Active" : "Missing"}
        </span>
      </div>

      {hasPlan ? (
        <div className="mt-4">
          <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
            {prescription ? (
              <>
                <pre
                  className={cx(
                    "whitespace-pre-wrap text-sm leading-relaxed text-gray-900",
                    !expanded && canExpand && "max-h-56 overflow-hidden"
                  )}
                >
                  {prescription}
                </pre>

                {!expanded && canExpand ? (
                  <div className="mt-3">
                    <button
                      type="button"
                      onClick={() => setExpanded(true)}
                      className="text-xs font-semibold text-[#46769B] hover:underline focus:outline-none focus:ring-2 focus:ring-[#46769B]/30 rounded"
                    >
                      Show full plan
                    </button>
                  </div>
                ) : null}

                {expanded && canExpand ? (
                  <div className="mt-3">
                    <button
                      type="button"
                      onClick={() => setExpanded(false)}
                      className="text-xs font-semibold text-[#46769B] hover:underline focus:outline-none focus:ring-2 focus:ring-[#46769B]/30 rounded"
                    >
                      Collapse
                    </button>
                  </div>
                ) : null}
              </>
            ) : (
              <div className="text-sm text-gray-700">
                This plan is marked active, but no prescription text was found.
              </div>
            )}
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              onClick={onEditPlan}
              className="px-4 py-2 rounded-xl bg-[#46769B] text-white text-sm font-semibold hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-[#46769B]/35"
              type="button"
            >
              {hasPlan ? "Update Plan →" : "Create Plan →"}
            </button>

            <button
              onClick={onCopy}
              disabled={!prescription}
              className={cx(
                "px-4 py-2 rounded-xl text-sm font-semibold border",
                prescription
                  ? "bg-white text-gray-900 border-gray-200 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-200"
                  : "bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed"
              )}
              type="button"
              title={prescription ? "Copy plan text" : "Nothing to copy"}
            >
              Copy
            </button>

            {canExpand ? (
              <button
                onClick={() => setExpanded((v) => !v)}
                className="px-4 py-2 rounded-xl text-sm font-semibold border bg-white text-gray-900 border-gray-200 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-200"
                type="button"
              >
                {expanded ? "Collapse" : "Expand"}
              </button>
            ) : null}
          </div>
        </div>
      ) : (
        <EmptyState
          title="No plan yet"
          body="Create something realistic and trackable: a few staple meals, clear targets, and adherence-friendly choices."
          cta="Create Plan →"
          onCta={onEditPlan}
        />
      )}
    </section>
  );
}
