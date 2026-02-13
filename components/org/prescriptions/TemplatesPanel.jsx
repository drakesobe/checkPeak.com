// components/org/prescriptions/TemplatesPanel.jsx
"use client";

import { Trash2 } from "lucide-react";

export default function TemplatesPanel({
  inputBase,
  subtleHint,

  templatesLoading,
  templatesError,
  activeTemplates,

  templateId,
  setTemplateId,
  templateName,
  setTemplateName,
  templateNotes,
  setTemplateNotes,

  onRefreshTemplates,
  onApplyTemplate,
  onOpenDeleteConfirm,
  onSaveAsTemplate,
}) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-gray-900">Plan Templates</p>
          <p className="text-xs text-gray-500 mt-1">
            Templates are saved presets of the builder fields scoped to your org token.
          </p>
        </div>

        <button
          type="button"
          onClick={onRefreshTemplates}
          className="px-3 py-2 rounded-xl border border-gray-200 bg-white text-xs font-semibold hover:bg-gray-50"
          disabled={templatesLoading}
        >
          {templatesLoading ? "Refreshing…" : "Refresh Templates"}
        </button>
      </div>

      {templatesError ? (
        <div className="rounded-xl bg-white border border-red-200 p-3">
          <p className="text-sm text-red-600 font-medium">{templatesError}</p>
        </div>
      ) : null}

      <div className="grid sm:grid-cols-4 gap-3">
        <select
          className="w-full px-4 py-3 rounded-xl border border-gray-300 bg-white text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#46769B]/30 sm:col-span-2"
          value={templateId}
          onChange={(e) => setTemplateId(e.target.value)}
        >
          <option value="">Select a template…</option>
          {activeTemplates.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name || "Template"}
            </option>
          ))}
        </select>

        <button
          type="button"
          onClick={() => onApplyTemplate(templateId)}
          className="px-4 py-3 rounded-xl bg-white border border-gray-200 text-sm font-semibold hover:bg-gray-50"
          disabled={!templateId}
        >
          Apply
        </button>

        <button
          type="button"
          onClick={onOpenDeleteConfirm}
          className={`px-4 py-3 rounded-xl border text-sm font-semibold flex items-center justify-center gap-2 ${
            templateId
              ? "bg-white border-red-200 text-red-700 hover:bg-red-50"
              : "bg-white border-gray-200 text-gray-400 cursor-not-allowed"
          }`}
          disabled={!templateId}
          title={!templateId ? "Select a template first" : "Delete selected template"}
        >
          <Trash2 size={16} />
          Delete
        </button>
      </div>

      <div className="grid sm:grid-cols-3 gap-3">
        <input
          className={inputBase}
          placeholder="Template name (e.g., Offseason Bulk)"
          value={templateName}
          onChange={(e) => setTemplateName(e.target.value)}
        />

        <input
          className={inputBase}
          placeholder="Template notes (optional)"
          value={templateNotes}
          onChange={(e) => setTemplateNotes(e.target.value)}
        />

        <button
          type="button"
          onClick={onSaveAsTemplate}
          className="px-4 py-3 rounded-xl bg-[#46769B] text-white text-sm font-semibold hover:brightness-110 disabled:opacity-70 disabled:cursor-not-allowed"
          disabled={templatesLoading || !templateName.trim()}
        >
          {templatesLoading ? "Saving…" : "Save as Template"}
        </button>
      </div>

      <p className={subtleHint}>
        Pro move: apply a template once, then don’t reset the builder — just Save & Next through the roster.
      </p>
    </div>
  );
}
