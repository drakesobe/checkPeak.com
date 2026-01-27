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

// ✅ Now prefers API-provided athleteName (from DailyWorkouts.AthleteName lookup)
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

export default function ReviewQueueTable({
  items,
  expanded,
  toggleExpanded,
  openModal,
  fmtDate,
  normalizeText,
}) {
  const [onlyUnresolved, setOnlyUnresolved] = useState(false);

  const list = useMemo(() => {
    if (!onlyUnresolved) return items || [];
    return (items || []).filter((it) => String(it?.reviewStatus || "").toLowerCase() !== "approved");
  }, [items, onlyUnresolved]);

  return (
    <div className="mt-5 overflow-x-auto">
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
          Tip: expand rows to see athlete + uploads quickly
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
                  If uploads live on WorkoutItems, this table stays empty until joined.
                </div>
              </td>
            </tr>
          )}

          {list.map((it) => {
            const id = String(it?.id || "");
            const isExpanded = !!expanded[id];

            const title = normalizeText(it?.title) || "Daily Workout";
            const date = normalizeText(it?.date);
            const dwStatus = normalizeText(it?.status);
            const rev = normalizeText(it?.reviewStatus) || "pending";

            const athleteName = resolveAthleteName(it, normalizeText);
            const athleteEmail = resolveAthleteEmail(it, normalizeText);

            const uploads = safeCount(it?.attachments);

            const rowAccent =
              rev === "pending"
                ? "bg-amber-50/40"
                : rev === "needs_info"
                ? "bg-amber-50/20"
                : "";

            return (
              <Fragment key={id}>
                <tr className={classNames("border-b", rowAccent)}>
                  <td className="py-3 pr-4">
                    <button
                      type="button"
                      onClick={() => toggleExpanded(id)}
                      className="text-left w-full"
                      title="Expand"
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
                            {it?.attachmentSummary || "Uploads attached"}
                          </div>
                        </div>
                      </div>
                    </button>
                  </td>

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

                  <td className="py-3 pr-4">
                    <div className="text-gray-700 font-medium">{date || "—"}</div>
                  </td>

                  <td className="py-3 pr-4">
                    <Pill tone={uploads > 0 ? "neutral" : "warn"}>
                      <ImageIcon className="w-3.5 h-3.5 mr-1.5 text-gray-400" />
                      {uploads}
                    </Pill>
                  </td>

                  <td className="py-3 pr-4">
                    <Pill tone={dailyWorkoutTone(dwStatus)}>{dwStatus || "—"}</Pill>
                  </td>

                  <td className="py-3 pr-4">
                    <Pill tone={reviewTone(rev)}>{rev.replaceAll("_", " ")}</Pill>
                  </td>

                  <td className="py-3 pr-4">
                    <div className="text-gray-700 font-medium">
                      {it?.createdAt ? fmtDate(it.createdAt) : "—"}
                    </div>
                  </td>

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

                {isExpanded ? (
                  <tr className="border-b bg-gray-50">
                    <td colSpan={8} className="py-4 px-4">
                      <div className="grid md:grid-cols-4 gap-4">
                        <div className="rounded-2xl border border-gray-200 bg-white p-4 md:col-span-2">
                          <p className="text-xs text-gray-500 flex items-center gap-2">
                            <FileText className="w-4 h-4 text-gray-400" />
                            Summary
                          </p>
                          <p className="text-sm font-extrabold text-gray-900 mt-1">{title}</p>
                          <p className="text-[11px] text-gray-500 mt-2">{it?.attachmentSummary || "—"}</p>
                        </div>

                        <div className="rounded-2xl border border-gray-200 bg-white p-4">
                          <p className="text-xs text-gray-500 flex items-center gap-2">
                            <ClipboardList className="w-4 h-4 text-gray-400" />
                            Linked items
                          </p>
                          <p className="text-[12px] text-gray-700 mt-2">
                            Uploads: <span className="font-extrabold">{uploads}</span>
                          </p>
                          <p className="text-[12px] text-gray-700 mt-1">
                            Review: <span className="font-extrabold">{rev.replaceAll("_", " ")}</span>
                          </p>
                        </div>

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
                                  "Workout upload needs clarification"
                                )}&body=${encodeURIComponent(
                                  `Hey ${athleteName},\n\nQuick question about your workout upload on ${date || "this date"}.\n\nCan you clarify what this upload is showing?\n\nThanks!`
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
