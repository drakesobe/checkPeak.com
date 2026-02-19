// components/org/dashboard/TemplatesPanel.jsx
"use client";

import { RefreshCcw, ArrowRight } from "lucide-react";
import { Button } from "@/components/org/dashboard/DashboardUI";

export default function TemplatesPanel({ templates, onRefresh, onUseTemplate }) {
  return (
    <section className="lg:col-span-4 bg-white rounded-2xl shadow-md border border-blue-100 p-5 sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-lg font-extrabold">Templates</h2>
          <p className="text-sm text-gray-600 mt-1">One click to preload a plan (then tweak).</p>
        </div>
        <Button variant="secondary" className="px-3 py-2 text-xs shrink-0" onClick={onRefresh}>
          <RefreshCcw className="w-4 h-4" />
          Refresh
        </Button>
      </div>

      <div className="mt-4 space-y-3">
        {templates?.length ? (
          templates.slice(0, 4).map((t) => (
            <div key={t.id} className="rounded-2xl border border-gray-200 p-4">
              <p className="text-sm font-extrabold text-gray-900 break-words">{t.name}</p>
              <p className="text-[11px] text-gray-500 mt-1 break-words">{t.description}</p>
              <div className="mt-3">
                <Button
                  variant="secondary"
                  className="px-3 py-2 text-xs w-full sm:w-auto"
                  onClick={() => onUseTemplate(t.id)}
                >
                  Use template
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))
        ) : (
          <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
            <p className="text-sm font-extrabold text-gray-900">No templates loaded</p>
            <p className="text-[11px] text-gray-500 mt-1">Make sure /api/org/getPlanTemplates is added.</p>
          </div>
        )}

        <p className="text-[11px] text-gray-500">Pro move: from roster → “Build” can pass template too.</p>
      </div>
    </section>
  );
}
