// components/org/reviewQueue/table/RowMain.jsx
"use client";

import {
  ArrowRight,
  ChevronDown,
  ChevronRight,
  Image as ImageIcon,
  Mail,
} from "lucide-react";

import {
  Button,
  Pill,
  dailyWorkoutTone,
  reviewTone,
  classNames,
} from "@/components/org/reviewQueue/ui";

import AckPill from "./AckPill";

function ItemCell({ vm, isExpanded, onToggle }) {
  return (
    <td className="py-3 pr-4">
      <button
        type="button"
        onClick={onToggle}
        className="text-left w-full"
        title={isExpanded ? "Collapse" : "Expand"}
        disabled={!vm.id}
      >
        <div className="flex items-center gap-2">
          {isExpanded ? (
            <ChevronDown className="w-4 h-4 text-gray-400" />
          ) : (
            <ChevronRight className="w-4 h-4 text-gray-400" />
          )}

          <div className="min-w-0">
            <div className="font-semibold text-gray-900 truncate">{vm.title}</div>
            <div className="text-[11px] text-gray-500 mt-0.5 truncate">{vm.attachmentSummary}</div>
          </div>
        </div>
      </button>
    </td>
  );
}

function AthleteCell({ vm }) {
  return (
    <td className="py-3 pr-4">
      <div className="min-w-0">
        <div className="font-semibold text-gray-900 truncate">{vm.athleteName}</div>
        {vm.athleteEmail ? (
          <div className="text-[11px] text-gray-600 truncate flex items-center gap-1">
            <Mail className="w-3.5 h-3.5 text-gray-400" />
            {vm.athleteEmail}
          </div>
        ) : (
          <div className="text-[11px] text-gray-400">—</div>
        )}
      </div>
    </td>
  );
}

function UploadsCell({ vm }) {
  return (
    <td className="py-3 pr-4">
      <Pill tone={vm.uploads > 0 ? "neutral" : "warn"}>
        <ImageIcon className="w-3.5 h-3.5 mr-1.5 text-gray-400" />
        {vm.uploads}
      </Pill>
    </td>
  );
}

function ReviewCell({ vm }) {
  return (
    <td className="py-3 pr-4">
      <div className="flex flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <Pill tone={reviewTone(vm.rev)}>{vm.rev.replaceAll("_", " ")}</Pill>
          {vm.showAck ? <AckPill ack={vm.ack} /> : null}
        </div>

        {vm.showAck && vm.ack && vm.ackAt ? <div className="text-[11px] text-gray-500">{vm.ackAt}</div> : null}
      </div>
    </td>
  );
}

function ActionsCell({ vm, onReview }) {
  return (
    <td className="py-3 pr-2">
      <div className="flex justify-end gap-2">
        <Button
          variant={vm.rev === "pending" ? "primary" : "secondary"}
          className="px-3 py-2 text-xs"
          onClick={onReview}
          disabled={!vm.id}
        >
          Review <ArrowRight className="w-4 h-4" />
        </Button>
      </div>
    </td>
  );
}

export default function RowMain({ vm, isExpanded, onToggle, onReview }) {
  return (
    <tr className={classNames("border-b", vm.rowAccent)}>
      <ItemCell vm={vm} isExpanded={isExpanded} onToggle={onToggle} />
      <AthleteCell vm={vm} />

      <td className="py-3 pr-4">
        <div className="text-gray-700 font-medium">{vm.date || "—"}</div>
      </td>

      <UploadsCell vm={vm} />

      <td className="py-3 pr-4">
        <Pill tone={dailyWorkoutTone(vm.dwStatus)}>{vm.dwStatus || "—"}</Pill>
      </td>

      <ReviewCell vm={vm} />

      <td className="py-3 pr-4">
        <div className="text-gray-700 font-medium">{vm.createdAt}</div>
      </td>

      <ActionsCell vm={vm} onReview={onReview} />
    </tr>
  );
}
