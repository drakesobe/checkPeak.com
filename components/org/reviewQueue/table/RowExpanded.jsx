// components/org/reviewQueue/table/RowExpanded.jsx
"use client";

import { ClipboardList, FileText, Mail, User } from "lucide-react";
import { Pill, reviewTone } from "@/components/org/reviewQueue/ui";
import AckPill from "./AckPill";

function EmailAthleteLink({ athleteEmail, athleteName, date }) {
  if (!athleteEmail) return null;

  const href = `mailto:${athleteEmail}?subject=${encodeURIComponent(
    "Workout upload needs attention"
  )}&body=${encodeURIComponent(
    `Hey ${athleteName},\n\nYour coach left a note about your workout upload on ${
      date || "that day"
    }.\n\nPlease open your workout, review the note, and acknowledge it in the app.\n\nThanks!`
  )}`;

  return (
    <a
      className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold hover:bg-gray-50"
      href={href}
    >
      <Mail className="w-4 h-4 text-gray-500" />
      Email athlete
    </a>
  );
}

export default function RowExpanded({ vm }) {
  return (
    <tr className="border-b bg-gray-50">
      <td colSpan={8} className="py-4 px-4">
        <div className="grid md:grid-cols-4 gap-4">
          {/* Summary */}
          <div className="rounded-2xl border border-gray-200 bg-white p-4 md:col-span-2">
            <p className="text-xs text-gray-500 flex items-center gap-2">
              <FileText className="w-4 h-4 text-gray-400" />
              Summary
            </p>

            <p className="text-sm font-extrabold text-gray-900 mt-1">{vm.title}</p>

            <div className="mt-2 space-y-1">
              <p className="text-[11px] text-gray-600">
                Date: <span className="font-semibold text-gray-800">{vm.date || "—"}</span>
              </p>

              <p className="text-[11px] text-gray-600">
                Uploads: <span className="font-semibold text-gray-800">{vm.uploads}</span>
              </p>

              <p className="text-[11px] text-gray-600">
                Review bucket:{" "}
                <span className="font-semibold text-gray-800">{vm.rev.replaceAll("_", " ")}</span>
              </p>

              {vm.raw?.attachmentSummary ? (
                <p className="text-[11px] text-gray-500 mt-2">{String(vm.raw.attachmentSummary)}</p>
              ) : null}
            </div>
          </div>

          {/* Status */}
          <div className="rounded-2xl border border-gray-200 bg-white p-4">
            <p className="text-xs text-gray-500 flex items-center gap-2">
              <ClipboardList className="w-4 h-4 text-gray-400" />
              Status
            </p>

            <div className="mt-2 space-y-2">
              <div className="flex flex-wrap gap-2">
                <Pill tone={reviewTone(vm.rev)}>{vm.rev.replaceAll("_", " ")}</Pill>
                {vm.showAck ? <AckPill ack={vm.ack} /> : null}
              </div>

              {vm.showAck ? (
                <>
                  <p className="text-[12px] text-gray-700">
                    Athlete acknowledged: <span className="font-extrabold">{vm.ack ? "Yes" : "No"}</span>
                  </p>

                  <p className="text-[12px] text-gray-700">
                    Acknowledged at:{" "}
                    <span className="font-extrabold">{vm.ack && vm.ackAt ? vm.ackAt : "—"}</span>
                  </p>

                  {!vm.ack ? (
                    <p className="text-[11px] text-gray-500 leading-snug">
                      This confirms they saw the message without back-and-forth.
                    </p>
                  ) : null}
                </>
              ) : (
                <p className="text-[11px] text-gray-500 leading-snug">
                  Acknowledgement tracking shows when the item requires athlete attention.
                </p>
              )}
            </div>
          </div>

          {/* Athlete */}
          <div className="rounded-2xl border border-gray-200 bg-white p-4">
            <p className="text-xs text-gray-500 flex items-center gap-2">
              <User className="w-4 h-4 text-gray-400" />
              Athlete
            </p>

            <p className="text-sm font-extrabold text-gray-900 mt-1">{vm.athleteName}</p>
            <p className="text-[12px] text-gray-600 mt-1 truncate">{vm.athleteEmail || "—"}</p>

            <div className="mt-3">
              <EmailAthleteLink athleteEmail={vm.athleteEmail} athleteName={vm.athleteName} date={vm.date} />
            </div>
          </div>
        </div>
      </td>
    </tr>
  );
}
