// components/org/prescriptions/TemplatesPanel.jsx
"use client";

import { Trash2, RefreshCw } from "lucide-react";

const DS = {
  brand: "#1E3A5F", brandLight: "#2A4F7C", brandBg: "#EEF3F9", brandBorder: "#C0D0E0",
  banned: "#C8102E", bannedBg: "#FFF0F0", bannedBorder: "#FFC8C8",
  border: "#E8ECF0", pageBg: "#F4F7FB", cardBg: "#FFFFFF",
  bodyText: "#1A2535", labelText: "#5A6A7D", dimText: "#9BA8B4",
};

function Label({ children }) {
  return (
    <p className="text-xs font-black uppercase tracking-wider mb-1" style={{ color: DS.dimText }}>
      {children}
    </p>
  );
}

export default function TemplatesPanel({
  templatesLoading, templatesError, activeTemplates,
  templateId, setTemplateId, templateName, setTemplateName,
  templateNotes, setTemplateNotes,
  onRefreshTemplates, onApplyTemplate, onOpenDeleteConfirm, onSaveAsTemplate,
}) {
  return (
    <div
      style={{ border: `1px solid ${DS.border}`, borderTop: `3px solid ${DS.brand}`, backgroundColor: DS.cardBg }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3"
        style={{ borderBottom: `1px solid ${DS.border}`, backgroundColor: DS.pageBg }}
      >
        <div>
          <p className="text-sm font-black uppercase tracking-wide" style={{ color: DS.bodyText }}>
            Plan Templates
          </p>
          <p className="text-xs mt-0.5" style={{ color: DS.dimText }}>
            Saved presets scoped to your org token.
          </p>
        </div>
        <button
          type="button"
          onClick={onRefreshTemplates}
          disabled={templatesLoading}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-sm transition-all"
          style={{ border: `1px solid ${DS.border}`, backgroundColor: DS.cardBg, color: DS.labelText }}
          onMouseEnter={(e) => { e.currentTarget.style.borderColor = DS.brandBorder; e.currentTarget.style.color = DS.brand; }}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor = DS.border; e.currentTarget.style.color = DS.labelText; }}
        >
          <RefreshCw className={`h-3.5 w-3.5 ${templatesLoading ? "animate-spin" : ""}`} />
          {templatesLoading ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      <div className="px-4 py-4 space-y-3">
        {templatesError && (
          <div
            className="px-3 py-2 text-xs"
            style={{ backgroundColor: DS.bannedBg, borderLeft: `3px solid ${DS.banned}`, color: DS.banned }}
          >
            {templatesError}
          </div>
        )}

        {/* Apply / Delete row */}
        <div className="flex gap-2">
          <select
            className="flex-1 text-sm px-3 py-2 outline-none rounded-sm"
            style={{ border: `1px solid ${DS.brandBorder}`, backgroundColor: DS.brandBg, color: DS.bodyText }}
            value={templateId}
            onChange={(e) => setTemplateId(e.target.value)}
          >
            <option value="">Select a template…</option>
            {activeTemplates.map((t) => (
              <option key={t.id} value={t.id}>{t.name || "Template"}</option>
            ))}
          </select>

          <button
            type="button"
            onClick={() => onApplyTemplate(templateId)}
            disabled={!templateId}
            className="px-3 py-2 text-xs font-black uppercase tracking-wide rounded-sm transition-all"
            style={{
              backgroundColor: templateId ? DS.brand : DS.pageBg,
              color:           templateId ? "#fff"   : DS.dimText,
              cursor:          templateId ? "pointer" : "not-allowed",
            }}
            onMouseEnter={(e) => { if (templateId) e.currentTarget.style.backgroundColor = DS.brandLight; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = templateId ? DS.brand : DS.pageBg; }}
          >
            Apply
          </button>

          <button
            type="button"
            onClick={onOpenDeleteConfirm}
            disabled={!templateId}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-sm transition-all"
            style={{
              border: `1px solid ${templateId ? DS.bannedBorder : DS.border}`,
              backgroundColor: DS.cardBg,
              color: templateId ? DS.banned : DS.dimText,
              cursor: templateId ? "pointer" : "not-allowed",
            }}
          >
            <Trash2 className="h-3.5 w-3.5" />
            Delete
          </button>
        </div>

        {/* Save new template */}
        <div className="flex gap-2">
          <input
            className="flex-1 text-sm px-3 py-2 outline-none rounded-sm"
            style={{ border: `1px solid ${DS.brandBorder}`, backgroundColor: DS.cardBg, color: DS.bodyText }}
            placeholder="Template name (e.g. Offseason Bulk)"
            value={templateName}
            onChange={(e) => setTemplateName(e.target.value)}
            onFocus={(e) => { e.currentTarget.style.borderColor = DS.brand; }}
            onBlur={(e)  => { e.currentTarget.style.borderColor = DS.brandBorder; }}
          />
          <input
            className="flex-1 text-sm px-3 py-2 outline-none rounded-sm hidden sm:block"
            style={{ border: `1px solid ${DS.brandBorder}`, backgroundColor: DS.cardBg, color: DS.bodyText }}
            placeholder="Notes (optional)"
            value={templateNotes}
            onChange={(e) => setTemplateNotes(e.target.value)}
            onFocus={(e) => { e.currentTarget.style.borderColor = DS.brand; }}
            onBlur={(e)  => { e.currentTarget.style.borderColor = DS.brandBorder; }}
          />
          <button
            type="button"
            onClick={onSaveAsTemplate}
            disabled={templatesLoading || !templateName.trim()}
            className="px-3 py-2 text-xs font-black uppercase tracking-wide rounded-sm transition-all whitespace-nowrap"
            style={{
              backgroundColor: templateName.trim() ? DS.brand : DS.pageBg,
              color:           templateName.trim() ? "#fff"   : DS.dimText,
              cursor:          templateName.trim() ? "pointer" : "not-allowed",
            }}
            onMouseEnter={(e) => { if (templateName.trim()) e.currentTarget.style.backgroundColor = DS.brandLight; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = templateName.trim() ? DS.brand : DS.pageBg; }}
          >
            {templatesLoading ? "Saving…" : "Save Template"}
          </button>
        </div>

        <p className="text-xs" style={{ color: DS.dimText }}>
          Pro: apply a template once, then Save & Next through the roster without resetting the builder.
        </p>
      </div>
    </div>
  );
}