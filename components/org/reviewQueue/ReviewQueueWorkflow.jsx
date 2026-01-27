// components/org/reviewQueue/ReviewQueueWorkflow.jsx
"use client";

import { AlertTriangle, CheckCircle2, HelpCircle, RefreshCcw } from "lucide-react";
import { Button } from "@/components/org/reviewQueue/ui";

export default function ReviewQueueWorkflow({ onRefresh, loading }) {
  return (
    <section className="lg:col-span-4 bg-white rounded-2xl shadow-md border border-blue-100 p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-extrabold">Workflow</h2>
          <p className="text-sm text-gray-600 mt-1">Process uploads fast.</p>
        </div>
        <Button variant="secondary" className="px-3 py-2 text-xs" onClick={onRefresh} disabled={loading}>
          <RefreshCcw className="w-4 h-4" /> Refresh
        </Button>
      </div>

      <div className="mt-4 space-y-3">
        <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
          <p className="text-sm font-extrabold text-gray-900">Order of operations</p>
          <ul className="mt-2 space-y-2 text-[12px] text-gray-700">
            <li className="flex gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5" />
              Review <span className="font-semibold">Pending</span> first
            </li>
            <li className="flex gap-2">
              <HelpCircle className="w-4 h-4 text-amber-600 mt-0.5" />
              Mark <span className="font-semibold">Needs info</span> if upload is unclear
            </li>
            <li className="flex gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5" />
              Approve when confirmed
            </li>
          </ul>
        </div>

        <div className="rounded-2xl border border-gray-200 p-4">
          <p className="text-sm font-extrabold text-gray-900">Important</p>
          <p className="text-[12px] text-gray-600 mt-1">
            If uploads are stored on <span className="font-semibold">WorkoutItems</span>, this page needs a join.
            The API debug we added will confirm where the upload lives.
          </p>
        </div>
      </div>
    </section>
  );
}
