// components/org/reviewQueue/ReviewQueueTable.jsx
"use client";

import { Fragment, useMemo, useState } from "react";
import {
  ArrowRight,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  FileText,
  Image as ImageIcon,
  Mail,
  User,
  CheckCircle2,
  Clock,
} from "lucide-react";

import {
  Button,
  Pill,
  dailyWorkoutTone,
  reviewTone,
  classNames,
} from "@/components/org/reviewQueue/ui";

/* ---------------- helpers ---------------- */

function safeCount(v) {
  return Array.isArray(v) ? v.length : 0;
}

// Basic safe normalize if caller didn't pass one
function fallbackNormalizeText(v) {
  return String(v ?? "").trim();
}

// ✅ Prefer API-provided athleteName / athleteEmail (from lookup), then fallback
function resolveAthleteName(it, normalizeText) {
  const direct = normalizeText(it?.athleteName) || normalizeText(it?.AthleteName);
  if (direct) return direct;

  if (Array.isArray(it?.athlete) && it.athlete.length > 0) {
    const first = it.athlete[0];
    if (typeof first === "string") return normalizeText(first);
    if (first?.name) return normalizeText(first.name);
    if (first?.fields?.Name) return normalizeText(first.fields.Name);
  }

  if (Array.isArray(it?.createdBy) && it.createdBy.length > 0) {
    const first = it.createdBy[0];
    if (typeof first === "string") return normalizeText(first);
    if (first?.name) return normalizeText(first.name);
  }

  if (it?.athleteEmail) return normalizeText(String(it.athleteEmail).split("@")[0]);

  return "Athlete";
}

function resolveAthleteEmail(it, normalizeText) {
  const direct = normalizeText(it?.athleteEmail) || normalizeText(it?.AthleteEmail);
  if (direct) return direct;

  if (Array.isArray(it?.createdBy) && it.createdBy.length > 0) {
    const first = it.createdBy[0];
    if (typeof first === "string") return "";
    if (first?.email) return normalizeText(first.email);
  }

  return "";
}

// Normalize the “completion status” (WorkoutCompletions.Status) if available
function normLower(v) {
  return String(v ?? "").trim().toLowerCase();
}

/**
 * Which rows should show “Acknowledged / Not acknowledged”?
 *
 * Your current bucket mapping is:
 * - WorkoutCompletions.Status = rejected  -> reviewStatus = needs_info
 * - WorkoutCompletions.Status = completed -> reviewStatus = approved
 * - WorkoutCompletions.Status = pending_review -> reviewStatus = pending
 *
 * So acknowledgement UI should appear when either:
 * - reviewStatus === "needs_info" OR
 * - completion status is explicitly "rejected" (future-proof)
 */
function shouldShowAck({ reviewStatus, completionStatus }) {
  const rev = normLower(reviewStatus);
  const st = normLower(completionStatus);
  return rev === "needs_info" || st === "rejected";
}

// Small visual badge for acknowledgement state
function AckPill({ ack }) {
  if (ack) {
    return (
      <Pill tone="ok">
        <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
        Acknowledged
      </Pill>
    );
  }
  return (
    <Pill tone="warn">
      <Clock className="w-3.5 h-3.5 mr-1.5" />
      Not acknowledged
    </Pill>
  );
}

export default function ReviewQueueTable({
  items,
  expanded,
  toggleExpanded,
  openModal,
  fmtDate,
  normalizeText,
}) {
  const norm = normalizeText || fallbackNormalizeText;

  // “Unresolved only” should hide approved; keep pending + needs_info visible
  const [onlyUnresolved, setOnlyUnresolved] = useState(false);

  const list = useMemo(() => {
    const src = Array.isArray(items) ? items : [];
    if (!onlyUnresolved) return src;
    return src.filter((it) => normLower(it?.reviewStatus) !== "approved");
  }, [items, onlyUnresolved]);

  return (
    <div className="mt-5 overflow-x-auto">
      {/* Top controls */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Pill tone="neutral">
            <ClipboardList className="w-3.5 h-3.5 mr-1.5" />
            Showing <span className="ml-1 font-extrabold">{list.length}</span>
          </Pill>

          <button
            type="button"
            onClick={() => setOnlyUnresolved((p) => !p)}
            className={classNames(
              "rounded-xl border px-3 py-1.5 text-[11px] font-semibold transition",
              onlyUnresolved
                ? "bg-gray-900 text-white border-gray-900"
                : "bg-white text-gray-800 border-gray-200 hover:bg-gray-50"
            )}
          >
            {onlyUnresolved ? "Unresolved only" : "Show unresolved"}
          </button>
        </div>

        <div className="text-[11px] text-gray-500">
          Tip: click the row to expand. “Review” opens the full viewer.
        </div>
      </div>

      <table className="min-w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-gray-500 border-b">
            <th className="py-3 pr-4">Item</th>
            <th className="py-3 pr-4">Athlete</th>
            <th className="py-3 pr-4">Date</th>
            <th className="py-3 pr-4">Uploads</th>
            <th className="py-3 pr-4">Daily</th>
            <th className="py-3 pr-4">Review</th>
            <th className="py-3 pr-4">Created</th>
            <th className="py-3 pr-2 text-right">Actions</th>
          </tr>
        </thead>

        <tbody>
          {list.length === 0 && (
            <tr>
              <td colSpan={8} className="py-6 text-center text-gray-500">
                No items found.
                <div className="text-[11px] text-gray-400 mt-1">
                  If the table looks empty unexpectedly, confirm the API is returning items and that your org filter matches.
                </div>
              </td>
            </tr>
          )}

          {list.map((it) => {
            const id = String(it?.id || "");
            const isExpanded = !!expanded?.[id];

            // What the UI shows
            const title = norm(it?.title) || "Workout Completion";
            const date = norm(it?.date);
            const dwStatus = norm(it?.status); // if your API sends this; otherwise can be blank
            const rev = normLower(it?.reviewStatus) || "pending";

            const athleteName = resolveAthleteName(it, norm);
            const athleteEmail = resolveAthleteEmail(it, norm);

            const uploads = safeCount(it?.attachments);

            // ✅ NEW: athlete acknowledged fields (from hook normalization)
            const ack = Boolean(it?.athleteAcknowledged);
            const ackAt = norm(it?.athleteAcknowledgedAt || "");

            // Completion status (WorkoutCompletions.Status) if included by API
            const completionStatus = normLower(it?.status || it?.completionStatus || it?.Status);

            const showAck = shouldShowAck({
              reviewStatus: rev,
              completionStatus,
            });

            // Light row accent based on queue bucket
            const rowAccent =
              rev === "pending"
                ? "bg-amber-50/40"
                : rev === "needs_info"
                ? "bg-amber-50/20"
                : "";

            return (
              <Fragment key={id || title}>
                <tr className={classNames("border-b", rowAccent)}>
                  {/* Item */}
                  <td className="py-3 pr-4">
                    <button
                      type="button"
                      onClick={() => toggleExpanded(id)}
                      className="text-left w-full"
                      title={isExpanded ? "Collapse" : "Expand"}
                      disabled={!id}
                    >
                      <div className="flex items-center gap-2">
                        {isExpanded ? (
                          <ChevronDown className="w-4 h-4 text-gray-400" />
                        ) : (
                          <ChevronRight className="w-4 h-4 text-gray-400" />
                        )}

                        <div className="min-w-0">
                          <div className="font-semibold text-gray-900 truncate">{title}</div>

                          <div className="text-[11px] text-gray-500 mt-0.5 truncate">
                            {it?.attachmentSummary
                              ? String(it.attachmentSummary)
                              : uploads
                              ? "Uploads attached"
                              : "No upload summary"}
                          </div>
                        </div>
                      </div>
                    </button>
                  </td>

                  {/* Athlete */}
                  <td className="py-3 pr-4">
                    <div className="min-w-0">
                      <div className="font-semibold text-gray-900 truncate">{athleteName}</div>
                      {athleteEmail ? (
                        <div className="text-[11px] text-gray-600 truncate flex items-center gap-1">
                          <Mail className="w-3.5 h-3.5 text-gray-400" />
                          {athleteEmail}
                        </div>
                      ) : (
                        <div className="text-[11px] text-gray-400">—</div>
                      )}
                    </div>
                  </td>

                  {/* Date */}
                  <td className="py-3 pr-4">
                    <div className="text-gray-700 font-medium">{date || "—"}</div>
                  </td>

                  {/* Uploads count */}
                  <td className="py-3 pr-4">
                    <Pill tone={uploads > 0 ? "neutral" : "warn"}>
                      <ImageIcon className="w-3.5 h-3.5 mr-1.5 text-gray-400" />
                      {uploads}
                    </Pill>
                  </td>

                  {/* Daily status (if you have it) */}
                  <td className="py-3 pr-4">
                    <Pill tone={dailyWorkoutTone(dwStatus)}>{dwStatus || "—"}</Pill>
                  </td>

                  {/* Review column: queue bucket + acknowledgement */}
                  <td className="py-3 pr-4">
                    <div className="flex flex-col gap-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Pill tone={reviewTone(rev)}>{rev.replaceAll("_", " ")}</Pill>

                        {showAck ? <AckPill ack={ack} /> : null}
                      </div>

                      {showAck && ack && ackAt ? (
                        <div className="text-[11px] text-gray-500">
                          {fmtDate ? fmtDate(ackAt) : ackAt}
                        </div>
                      ) : null}
                    </div>
                  </td>

                  {/* Created */}
                  <td className="py-3 pr-4">
                    <div className="text-gray-700 font-medium">
                      {it?.createdAt ? (fmtDate ? fmtDate(it.createdAt) : it.createdAt) : "—"}
                    </div>
                  </td>

                  {/* Actions */}
                  <td className="py-3 pr-2">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant={rev === "pending" ? "primary" : "secondary"}
                        className="px-3 py-2 text-xs"
                        onClick={() => openModal(it)}
                        disabled={!id}
                      >
                        Review <ArrowRight className="w-4 h-4" />
                      </Button>
                    </div>
                  </td>
                </tr>

                {/* Expanded row */}
                {isExpanded ? (
                  <tr className="border-b bg-gray-50">
                    <td colSpan={8} className="py-4 px-4">
                      <div className="grid md:grid-cols-4 gap-4">
                        {/* Summary */}
                        <div className="rounded-2xl border border-gray-200 bg-white p-4 md:col-span-2">
                          <p className="text-xs text-gray-500 flex items-center gap-2">
                            <FileText className="w-4 h-4 text-gray-400" />
                            Summary
                          </p>

                          <p className="text-sm font-extrabold text-gray-900 mt-1">{title}</p>

                          <div className="mt-2 space-y-1">
                            <p className="text-[11px] text-gray-600">
                              Date: <span className="font-semibold text-gray-800">{date || "—"}</span>
                            </p>

                            <p className="text-[11px] text-gray-600">
                              Uploads: <span className="font-semibold text-gray-800">{uploads}</span>
                            </p>

                            <p className="text-[11px] text-gray-600">
                              Review bucket: <span className="font-semibold text-gray-800">{rev.replaceAll("_", " ")}</span>
                            </p>

                            {it?.attachmentSummary ? (
                              <p className="text-[11px] text-gray-500 mt-2">
                                {String(it.attachmentSummary)}
                              </p>
                            ) : null}
                          </div>
                        </div>

                        {/* Links / status */}
                        <div className="rounded-2xl border border-gray-200 bg-white p-4">
                          <p className="text-xs text-gray-500 flex items-center gap-2">
                            <ClipboardList className="w-4 h-4 text-gray-400" />
                            Status
                          </p>

                          <div className="mt-2 space-y-2">
                            <div className="flex flex-wrap gap-2">
                              <Pill tone={reviewTone(rev)}>{rev.replaceAll("_", " ")}</Pill>
                              {showAck ? <AckPill ack={ack} /> : null}
                            </div>

                            {showAck ? (
                              <>
                                <p className="text-[12px] text-gray-700">
                                  Athlete acknowledged:{" "}
                                  <span className="font-extrabold">{ack ? "Yes" : "No"}</span>
                                </p>

                                <p className="text-[12px] text-gray-700">
                                  Acknowledged at:{" "}
                                  <span className="font-extrabold">
                                    {ack && ackAt ? (fmtDate ? fmtDate(ackAt) : ackAt) : "—"}
                                  </span>
                                </p>

                                {!ack ? (
                                  <p className="text-[11px] text-gray-500 leading-snug">
                                    This helps you confirm they saw the message without needing a back-and-forth.
                                  </p>
                                ) : null}
                              </>
                            ) : (
                              <p className="text-[11px] text-gray-500 leading-snug">
                                Acknowledgement tracking is shown when the item requires athlete attention.
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Athlete card */}
                        <div className="rounded-2xl border border-gray-200 bg-white p-4">
                          <p className="text-xs text-gray-500 flex items-center gap-2">
                            <User className="w-4 h-4 text-gray-400" />
                            Athlete
                          </p>

                          <p className="text-sm font-extrabold text-gray-900 mt-1">{athleteName}</p>
                          <p className="text-[12px] text-gray-600 mt-1 truncate">{athleteEmail || "—"}</p>

                          {athleteEmail ? (
                            <div className="mt-3">
                              <a
                                className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold hover:bg-gray-50"
                                href={`mailto:${athleteEmail}?subject=${encodeURIComponent(
                                  "Workout upload needs attention"
                                )}&body=${encodeURIComponent(
                                  `Hey ${athleteName},\n\nYour coach left a note about your workout upload on ${
                                    date || "that day"
                                  }.\n\nPlease open your workout, review the note, and acknowledge it in the app.\n\nThanks!`
                                )}`}
                              >
                                <Mail className="w-4 h-4 text-gray-500" />
                                Email athlete
                              </a>
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </td>
                  </tr>
                ) : null}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
