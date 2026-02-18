// components/org/reviewQueue/table/MobileList.jsx
"use client";

import { useMemo } from "react";
import {
  ArrowRight,
  ChevronDown,
  ChevronRight,
  Image as ImageIcon,
  Mail,
  Calendar,
  Clock,
} from "lucide-react";

import { Button, Pill, dailyWorkoutTone, reviewTone, classNames } from "@/components/org/reviewQueue/ui";
import AckPill from "@/components/org/reviewQueue/table/AckPill";
import { buildRowVM } from "@/components/org/reviewQueue/table/helpers";

function StatLine({ icon: Icon, label, value }) {
  return (
    <div className="flex items-center gap-2 text-[12px] text-gray-700">
      {Icon ? <Icon className="w-4 h-4 text-gray-400" /> : null}
      <span className="text-gray-500">{label}:</span>
      <span className="font-semibold text-gray-900">{value}</span>
    </div>
  );
}

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

export default function MobileList({
  items,
  expanded,
  toggleExpanded,
  onReview,
  norm,
  fmtDate,
}) {
  const vms = useMemo(() => {
    const src = Array.isArray(items) ? items : [];
    return src.map((it) => buildRowVM(it, norm, fmtDate));
  }, [items, norm, fmtDate]);

  if (vms.length === 0) {
    return (
      <div className="py-8 text-center text-gray-500">
        No items found.
        <div className="text-[11px] text-gray-400 mt-1">Try refreshing or switching filters.</div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {vms.map((vm) => {
        const isExpanded = Boolean(expanded?.[vm.id]);

        return (
          <div
            key={vm.id || vm.title}
            className={classNames("rounded-2xl border shadow-sm bg-white", vm.rowAccent)}
          >
            {/* Card header */}
            <button
              type="button"
              onClick={() => toggleExpanded(vm.id)}
              className="w-full text-left p-4"
              disabled={!vm.id}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-extrabold text-gray-900 truncate">{vm.title}</div>
                  <div className="text-[11px] text-gray-500 mt-1">{vm.attachmentSummary}</div>
                </div>

                <div className="shrink-0 pt-0.5">
                  {isExpanded ? (
                    <ChevronDown className="w-5 h-5 text-gray-400" />
                  ) : (
                    <ChevronRight className="w-5 h-5 text-gray-400" />
                  )}
                </div>
              </div>

              {/* Athlete + Status */}
              <div className="mt-3 grid grid-cols-2 gap-2">
                <div className="rounded-xl border border-gray-200 bg-gray-50 p-2">
                  <div className="text-[10px] font-semibold text-gray-500">Athlete</div>
                  <div className="text-[12px] font-semibold text-gray-900 truncate mt-0.5">{vm.athleteName}</div>
                  <div className="text-[11px] text-gray-600 truncate mt-0.5">{vm.athleteEmail || "—"}</div>
                </div>

                <div className="rounded-xl border border-gray-200 bg-gray-50 p-2">
                  <div className="text-[10px] font-semibold text-gray-500">Review</div>
                  <div className="mt-1 flex flex-wrap gap-2">
                    <Pill tone={reviewTone(vm.rev)}>{vm.rev.replaceAll("_", " ")}</Pill>
                    {vm.showAck ? <AckPill ack={vm.ack} /> : null}
                  </div>
                </div>
              </div>
            </button>

            {/* Bottom stats + actions */}
            <div className="px-4 pb-4">
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-xl border border-gray-200 bg-white p-3">
                  <StatLine icon={Calendar} label="Date" value={vm.date || "—"} />
                  <div className="mt-2">
                    <Pill tone={dailyWorkoutTone(vm.dwStatus)}>{vm.dwStatus || "—"}</Pill>
                  </div>
                </div>

                <div className="rounded-xl border border-gray-200 bg-white p-3">
                  <StatLine icon={ImageIcon} label="Uploads" value={String(vm.uploads)} />
                  <div className="mt-2 text-[11px] text-gray-500 flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-gray-400" />
                    Created: <span className="font-semibold text-gray-700">{vm.createdAt}</span>
                  </div>
                </div>
              </div>

              <div className="mt-3">
                <Button
                  variant={vm.rev === "pending" ? "primary" : "secondary"}
                  className="w-full px-3 py-2 text-xs justify-center"
                  onClick={() => onReview(vm.raw)}
                  disabled={!vm.id}
                >
                  Review <ArrowRight className="w-4 h-4" />
                </Button>
              </div>

              {isExpanded ? (
                <div className="mt-3 rounded-2xl border border-gray-200 bg-gray-50 p-3 space-y-2">
                  <div className="text-[11px] font-semibold text-gray-600">Details</div>

                  {vm.showAck ? (
                    <div className="text-[12px] text-gray-700">
                      Athlete acknowledged: <span className="font-extrabold">{vm.ack ? "Yes" : "No"}</span>
                      {vm.ack && vm.ackAt ? (
                        <>
                          {" "}
                          • <span className="text-gray-500">at</span>{" "}
                          <span className="font-semibold">{vm.ackAt}</span>
                        </>
                      ) : null}
                    </div>
                  ) : null}

                  {vm.raw?.attachmentSummary ? (
                    <div className="text-[12px] text-gray-600 leading-relaxed">{String(vm.raw.attachmentSummary)}</div>
                  ) : null}

                  <div className="pt-1">
                    <EmailAthleteLink athleteEmail={vm.athleteEmail} athleteName={vm.athleteName} date={vm.date} />
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}
