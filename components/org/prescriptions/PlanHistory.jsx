// components/org/prescriptions/PlanHistory.jsx
"use client";

import { useMemo, useState, useCallback } from "react";
import { formatDateTime } from "@/lib/org/prescriptions/prescriptions-utils";
import { RefreshCcw, ChevronDown, Copy, Check, Search, FileText, User } from "lucide-react";

const DS = {
  brand: "#1E3A5F", brandLight: "#2A4F7C", brandBg: "#EEF3F9", brandBorder: "#C0D0E0",
  safe: "#00873E", safeBg: "#F0FBF4", safeBorder: "#A8DFB8",
  caution: "#B86000", cautionBg: "#FFFBF0", cautionBorder: "#FFD580",
  border: "#E8ECF0", pageBg: "#F4F7FB", cardBg: "#FFFFFF",
  bodyText: "#1A2535", labelText: "#5A6A7D", dimText: "#9BA8B4",
};

function safeText(v) { return String(v ?? "").trim(); }

function truncateMiddle(str, left = 6, right = 4) {
  const s = safeText(str);
  if (!s || s.length <= left + right + 3) return s;
  return `${s.slice(0, left)}…${s.slice(-right)}`;
}

function snippet(text, max = 220) {
  const s = safeText(text).replace(/\s+/g, " ");
  if (!s) return "";
  return s.length <= max ? s : s.slice(0, max).trim() + "…";
}

function extractTitleHint(p) {
  const t = safeText(p?.title);
  if (t) return t;
  const created = safeText(p?.createdAt) ? formatDateTime(p.createdAt) : "";
  return created ? `Plan · ${created}` : "Plan";
}

/* ── Macro grid for expanded view ── */
function MacroRow({ label, value, unit }) {
  if (!safeText(value)) return null;
  return (
    <div className="flex items-center justify-between py-1.5" style={{ borderBottom: `1px solid ${DS.border}` }}>
      <span className="text-xs" style={{ color: DS.labelText }}>{label}</span>
      <span className="text-xs font-bold tabular-nums" style={{ color: DS.bodyText }}>
        {value}{unit && <span className="font-normal ml-0.5" style={{ color: DS.dimText }}>{unit}</span>}
      </span>
    </div>
  );
}

/* ── Pill chip ── */
function Chip({ label, color = "brand" }) {
  if (!safeText(label)) return null;
  const colors = {
    brand:   { bg: DS.brandBg,   text: DS.brand,   border: DS.brandBorder },
    safe:    { bg: DS.safeBg,    text: DS.safe,     border: DS.safeBorder  },
    caution: { bg: DS.cautionBg, text: DS.caution,  border: DS.cautionBorder },
  };
  const c = colors[color] || colors.brand;
  return (
    <span
      className="inline-block text-xs font-bold px-2 py-0.5 rounded-sm"
      style={{ backgroundColor: c.bg, color: c.text, border: `1px solid ${c.border}` }}
    >
      {label}
    </span>
  );
}

/* ── Supplement line ── */
function SuppLine({ label, value }) {
  if (!safeText(value)) return null;
  return (
    <div className="flex gap-2 text-xs py-1" style={{ borderBottom: `1px solid ${DS.border}` }}>
      <span className="shrink-0 w-28" style={{ color: DS.labelText }}>{label}</span>
      <span className="flex-1 font-medium" style={{ color: DS.bodyText }}>{value}</span>
    </div>
  );
}

/* ── Full expanded plan detail ── */
function PlanDetail({ p }) {
  const raw = p?._raw || {};
  const pj  = raw?.planJson && typeof raw.planJson === "object" ? raw.planJson : {};

  const phase  = safeText(raw.phase  || pj?.phase  || "");
  const status = safeText(raw.status || pj?.meta?.status || "");

  const cal  = safeText(raw.dailyCalories  || pj?.daily?.calories  || "");
  const pro  = safeText(raw.dailyProtein   || pj?.daily?.protein   || "");
  const carb = safeText(raw.dailyCarbs     || pj?.daily?.carbs     || "");
  const fat  = safeText(raw.dailyFat       || pj?.daily?.fat       || "");
  const hyd  = safeText(raw.dailyHydration || pj?.daily?.hydrationOz || pj?.hydrationOz || "");

  const hasMacros = cal || pro || carb || fat || hyd;

  const supp = pj?.supplements && typeof pj.supplements === "object" ? pj.supplements : {};
  const suppLines = [
    { label: "Protein",      value: safeText(supp.proteinRecommendation      || "") },
    { label: "Creatine",     value: safeText(supp.creatineRecommendation     || "") },
    { label: "BCAA / EAA",   value: safeText(supp.bcaaRecommendation         || "") },
    { label: "Electrolytes", value: safeText(supp.electrolytesRecommendation || "") },
    { label: "Pre-Workout",  value: safeText(supp.preWorkoutRecommendation   || "") },
    { label: "Protein Bar",  value: safeText(supp.proteinBarRecommendation   || "") },
  ].filter(s => s.value);

  const notesMacros = safeText(pj?.notes?.macros      || pj?.notesMacros      || "");
  const notesSupp   = safeText(pj?.notes?.supplements || pj?.notesSupplements || "");
  const freeform    = safeText(raw.prescription || pj?.freeformNotes || "");

  const effDate = safeText(pj?.meta?.effectiveDate || raw.effectiveDate || "");

  const hasAnything = phase || hasMacros || suppLines.length || notesMacros || notesSupp || freeform;

  if (!hasAnything) {
    return (
      <p className="text-xs py-2" style={{ color: DS.dimText }}>
        No plan details stored for this record.
      </p>
    );
  }

  return (
    <div className="space-y-3 mt-3">

      {/* Phase + Status + Effective date */}
      {(phase || status || effDate) && (
        <div className="flex flex-wrap items-center gap-2">
          {phase  && <Chip label={phase} color="brand" />}
          {status && status !== "active" && <Chip label={status} color={status === "archived" ? "caution" : "safe"} />}
          {effDate && (
            <span className="text-xs" style={{ color: DS.dimText }}>
              Effective {effDate}
            </span>
          )}
        </div>
      )}

      {/* Macros */}
      {hasMacros && (
        <div>
          <p className="text-xs font-black uppercase tracking-widest mb-1.5" style={{ color: DS.dimText }}>
            Daily Targets
          </p>
          <div style={{ border: `1px solid ${DS.border}`, padding: "0.5rem 0.75rem", backgroundColor: DS.pageBg }}>
            <MacroRow label="Calories"  value={cal}  unit="kcal" />
            <MacroRow label="Protein"   value={pro}  unit="g" />
            <MacroRow label="Carbs"     value={carb} unit="g" />
            <MacroRow label="Fat"       value={fat}  unit="g" />
            <MacroRow label="Hydration" value={hyd}  unit="oz" />
          </div>
        </div>
      )}

      {/* Supplements */}
      {suppLines.length > 0 && (
        <div>
          <p className="text-xs font-black uppercase tracking-widest mb-1.5" style={{ color: DS.dimText }}>
            Supplements
          </p>
          <div style={{ border: `1px solid ${DS.border}`, padding: "0.5rem 0.75rem", backgroundColor: DS.pageBg }}>
            {suppLines.map(s => <SuppLine key={s.label} label={s.label} value={s.value} />)}
          </div>
        </div>
      )}

      {/* Macro notes */}
      {notesMacros && (
        <div>
          <p className="text-xs font-black uppercase tracking-widest mb-1" style={{ color: DS.dimText }}>Macro Notes</p>
          <p className="text-xs leading-relaxed" style={{ color: DS.bodyText }}>{notesMacros}</p>
        </div>
      )}

      {/* Supplement notes */}
      {notesSupp && (
        <div>
          <p className="text-xs font-black uppercase tracking-widest mb-1" style={{ color: DS.dimText }}>Supplement Notes</p>
          <p className="text-xs leading-relaxed" style={{ color: DS.bodyText }}>{notesSupp}</p>
        </div>
      )}

      {/* Freeform / prescription */}
      {freeform && (
        <div>
          <p className="text-xs font-black uppercase tracking-widest mb-1" style={{ color: DS.dimText }}>Additional Notes</p>
          <pre
            className="whitespace-pre-wrap text-xs leading-relaxed overflow-auto"
            style={{
              backgroundColor: DS.pageBg,
              border: `1px solid ${DS.border}`,
              padding: "0.625rem 0.75rem",
              maxHeight: 280,
              color: DS.bodyText,
              fontFamily: "inherit",
            }}
          >
            {freeform}
          </pre>
        </div>
      )}
    </div>
  );
}

export default function PlanHistory({
  prescriptions = [],
  selectedAthleteToken,
  selectedAthleteEmail,
  selectedAthleteName,
  onSearch,
  onLoadMore,
  hasMore = false,
  onCopyNotesToBuilder,
  loading = false,
}) {
  const token     = safeText(selectedAthleteToken);
  const canSearch = Boolean(token) && typeof onSearch === "function";

  const [query,    setQuery]    = useState("");
  const [expanded, setExpanded] = useState(() => new Set());
  const [copiedId, setCopiedId] = useState("");

  const athleteLine = useMemo(() => ({
    name:  safeText(selectedAthleteName),
    email: safeText(selectedAthleteEmail),
    tok:   safeText(token),
  }), [selectedAthleteName, selectedAthleteEmail, token]);

  const rows = useMemo(() => {
    const list = Array.isArray(prescriptions) ? prescriptions : [];
    const q = safeText(query).toLowerCase();
    if (!q) return list;
    return list.filter((p) =>
      safeText(p?.title).toLowerCase().includes(q) ||
      safeText(p?.createdBy).toLowerCase().includes(q) ||
      safeText(p?.prescription).toLowerCase().includes(q)
    );
  }, [prescriptions, query]);

  const toggleExpanded = useCallback((id) => {
    if (!id) return;
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  const copyText = useCallback(async (text) => {
    const v = safeText(text);
    if (!v) return false;
    try { await navigator.clipboard.writeText(v); return true; }
    catch { return false; }
  }, []);

  const onCopyNotes = useCallback(async (p) => {
    if (typeof onCopyNotesToBuilder === "function") onCopyNotesToBuilder(p);
    const ok = await copyText(p?.prescription || "");
    if (ok) {
      const id = safeText(p?.id) || `${safeText(p?.createdAt)}-${safeText(p?.title)}`;
      setCopiedId(id);
      setTimeout(() => setCopiedId(""), 1400);
    }
  }, [onCopyNotesToBuilder, copyText]);

  return (
    <div style={{ border: `1px solid ${DS.border}`, borderTop: `3px solid ${DS.brand}`, backgroundColor: DS.cardBg }}>

      {/* Header */}
      <div
        className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 px-4 py-3"
        style={{ borderBottom: `1px solid ${DS.border}`, backgroundColor: DS.pageBg }}
      >
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4" style={{ color: DS.labelText }} />
            <p className="text-sm font-black uppercase tracking-wide" style={{ color: DS.bodyText }}>
              Plan History
            </p>
          </div>

          {(athleteLine.name || athleteLine.email || athleteLine.tok) && (
            <p className="text-xs mt-1 flex flex-wrap items-center gap-x-2" style={{ color: DS.dimText }}>
              {athleteLine.name && (
                <span className="inline-flex items-center gap-1 font-bold" style={{ color: DS.labelText }}>
                  <User className="h-3 w-3" />{athleteLine.name}
                </span>
              )}
              {athleteLine.email && <span>{athleteLine.email}</span>}
              {athleteLine.tok   && <span>· {truncateMiddle(athleteLine.tok, 8, 6)}</span>}
            </p>
          )}
        </div>

        <div className="flex gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => onSearch?.()}
            disabled={!canSearch || loading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-sm transition-all"
            style={{
              border: `1px solid ${DS.border}`,
              backgroundColor: DS.cardBg,
              color: canSearch && !loading ? DS.labelText : DS.dimText,
              cursor: canSearch && !loading ? "pointer" : "not-allowed",
            }}
            onMouseEnter={(e) => { if (canSearch && !loading) { e.currentTarget.style.borderColor = DS.brandBorder; e.currentTarget.style.color = DS.brand; } }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = DS.border; e.currentTarget.style.color = canSearch && !loading ? DS.labelText : DS.dimText; }}
          >
            <RefreshCcw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            {loading ? "Refreshing…" : "Refresh"}
          </button>

          <button
            type="button"
            onClick={() => onLoadMore?.()}
            disabled={!hasMore || loading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-sm transition-all"
            style={{
              border: `1px solid ${DS.border}`,
              backgroundColor: DS.cardBg,
              color: hasMore && !loading ? DS.labelText : DS.dimText,
              cursor: hasMore && !loading ? "pointer" : "not-allowed",
            }}
            onMouseEnter={(e) => { if (hasMore && !loading) { e.currentTarget.style.borderColor = DS.brandBorder; e.currentTarget.style.color = DS.brand; } }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = DS.border; e.currentTarget.style.color = hasMore && !loading ? DS.labelText : DS.dimText; }}
          >
            <ChevronDown className="h-3.5 w-3.5" />
            Load more
          </button>
        </div>
      </div>

      {/* Token missing */}
      {!token && (
        <div
          className="mx-4 mt-4 px-3 py-2.5 text-xs"
          style={{ backgroundColor: DS.cautionBg, borderLeft: `3px solid ${DS.caution}`, color: DS.caution }}
        >
          <span className="font-bold">Missing athlete token</span> — fix the roster record to load history.
        </div>
      )}

      {/* Search */}
      {token && (
        <div className="px-4 pt-3 pb-2 flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5" style={{ color: DS.dimText }} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search title, coach, or notes…"
              disabled={loading}
              className="w-full pl-8 pr-3 py-2 text-sm outline-none rounded-sm"
              style={{ border: `1px solid ${DS.brandBorder}`, backgroundColor: DS.brandBg, color: DS.bodyText }}
              onFocus={(e) => { e.currentTarget.style.borderColor = DS.brand; }}
              onBlur={(e)  => { e.currentTarget.style.borderColor = DS.brandBorder; }}
            />
          </div>
          <span className="text-xs shrink-0" style={{ color: DS.dimText }}>
            {rows.length}/{(Array.isArray(prescriptions) ? prescriptions.length : 0)}
          </span>
        </div>
      )}

      {/* Empty state */}
      {token && !loading && (Array.isArray(prescriptions) ? prescriptions.length : 0) === 0 && (
        <div className="mx-4 my-3 px-3 py-2.5" style={{ border: `1px solid ${DS.border}`, backgroundColor: DS.pageBg }}>
          <p className="text-sm font-bold" style={{ color: DS.bodyText }}>No plans saved yet</p>
          <p className="text-xs mt-0.5" style={{ color: DS.dimText }}>
            Save a plan from the builder above, then click Refresh to see it here.
          </p>
        </div>
      )}

      {/* Plan list */}
      <div className="px-4 pb-4 mt-2 space-y-2">
        {rows.map((p) => {
          const id     = safeText(p?.id) || `${safeText(p?.createdAt)}-${safeText(p?.title)}`;
          const isOpen = expanded.has(id);
          const text   = safeText(p?.prescription);
          const by     = safeText(p?.createdBy);

          /* Macro summary line for collapsed state */
          const raw = p?._raw || {};
          const cal = safeText(raw.dailyCalories || "");
          const pro = safeText(raw.dailyProtein  || "");
          const carb = safeText(raw.dailyCarbs   || "");
          const fat  = safeText(raw.dailyFat     || "");
          const macroLine = [
            cal  && `${Number(cal).toLocaleString()} cal`,
            pro  && `P ${pro}g`,
            carb && `C ${carb}g`,
            fat  && `F ${fat}g`,
          ].filter(Boolean).join(" · ");

          return (
            <div
              key={id}
              style={{ border: `1px solid ${DS.border}`, backgroundColor: DS.cardBg }}
            >
              <div className="flex items-start justify-between gap-3 p-3">
                <button
                  type="button"
                  onClick={() => toggleExpanded(id)}
                  className="min-w-0 text-left flex-1"
                >
                  <p className="text-sm font-bold truncate" style={{ color: DS.bodyText }}>
                    {extractTitleHint(p)}
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: DS.dimText }}>
                    {p?.createdAt ? formatDateTime(p.createdAt) : "-"}
                    {by && ` · ${by}`}
                  </p>
                  {!isOpen && macroLine && (
                    <p className="mt-1 text-xs font-medium" style={{ color: DS.labelText }}>
                      {macroLine}
                    </p>
                  )}
                  {!isOpen && !macroLine && text && (
                    <p className="mt-1.5 text-xs leading-relaxed" style={{ color: DS.labelText }}>
                      {snippet(text, 180)}
                    </p>
                  )}
                </button>

                <div className="shrink-0 flex gap-1.5">
                  <button
                    type="button"
                    onClick={() => onCopyNotes(p)}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-bold rounded-sm transition-all"
                    style={{ border: `1px solid ${DS.border}`, backgroundColor: DS.cardBg, color: DS.labelText }}
                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = DS.safeBorder; e.currentTarget.style.color = DS.safe; }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = DS.border; e.currentTarget.style.color = DS.labelText; }}
                  >
                    {copiedId === id
                      ? <><Check className="h-3.5 w-3.5" style={{ color: DS.safe }} />Copied</>
                      : <><Copy className="h-3.5 w-3.5" />Copy</>
                    }
                  </button>

                  <button
                    type="button"
                    onClick={() => toggleExpanded(id)}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-bold rounded-sm transition-all"
                    style={{ border: `1px solid ${DS.border}`, backgroundColor: DS.cardBg, color: DS.labelText }}
                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = DS.brandBorder; e.currentTarget.style.color = DS.brand; }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = DS.border; e.currentTarget.style.color = DS.labelText; }}
                  >
                    <ChevronDown
                      className="h-3.5 w-3.5 transition-transform"
                      style={{ transform: isOpen ? "rotate(180deg)" : "none" }}
                    />
                    {isOpen ? "Hide" : "View"}
                  </button>
                </div>
              </div>

              {isOpen && (
                <div className="px-3 pb-3" style={{ borderTop: `1px solid ${DS.border}` }}>
                  <PlanDetail p={p} />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {token && (Array.isArray(prescriptions) ? prescriptions.length : 0) > 0 && (
        <div className="px-4 pb-3 text-xs" style={{ color: DS.dimText }}>
          {hasMore ? "Showing latest plans — Load more for older ones." : "End of history."}
        </div>
      )}
    </div>
  );
}
