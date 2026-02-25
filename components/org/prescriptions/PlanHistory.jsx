// components/org/prescriptions/PlanHistory.jsx
"use client";

import { useMemo, useState, useCallback } from "react";
import { formatDateTime } from "@/lib/org/prescriptions/prescriptions-utils";
import { RefreshCcw, ChevronDown, Copy, Check, Search, FileText, User } from "lucide-react";

function cx(...xs) {
  return xs.filter(Boolean).join(" ");
}

function safeText(v) {
  return String(v ?? "").trim();
}

function truncateMiddle(str, left = 6, right = 4) {
  const s = safeText(str);
  if (!s) return "";
  if (s.length <= left + right + 3) return s;
  return `${s.slice(0, left)}…${s.slice(-right)}`;
}

function extractTitleHint(p) {
  const t = safeText(p?.title);
  if (t) return t;
  const created = safeText(p?.createdAt) ? formatDateTime(p.createdAt) : "";
  return created ? `Plan • ${created}` : "Plan";
}

function snippet(text, max = 220) {
  const s = safeText(text).replace(/\s+/g, " ");
  if (!s) return "";
  if (s.length <= max) return s;
  return s.slice(0, max).trim() + "…";
}

export default function PlanHistory({
  prescriptions = [],
  selectedAthleteToken,
  selectedAthleteEmail,
  selectedAthleteName,

  // actions
  onSearch,
  onLoadMore,

  // paging
  hasMore = false,

  subtleHint,
  onCopyNotesToBuilder,

  loading = false,
}) {
  const token = safeText(selectedAthleteToken);
  const canSearch = Boolean(token) && typeof onSearch === "function";
  const canLoadMore = Boolean(token) && Boolean(hasMore) && typeof onLoadMore === "function";

  // UI state
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState(() => new Set()); // planId set
  const [copiedId, setCopiedId] = useState("");

  const athleteLine = useMemo(() => {
    const name = safeText(selectedAthleteName);
    const email = safeText(selectedAthleteEmail);
    const tok = safeText(token);
    return { name, email, tok };
  }, [selectedAthleteName, selectedAthleteEmail, token]);

  const rows = useMemo(() => {
    const list = Array.isArray(prescriptions) ? prescriptions : [];
    const q = safeText(query).toLowerCase();
    if (!q) return list;

    return list.filter((p) => {
      const title = safeText(p?.title).toLowerCase();
      const by = safeText(p?.createdBy).toLowerCase();
      const body = safeText(p?.prescription).toLowerCase();
      return title.includes(q) || by.includes(q) || body.includes(q);
    });
  }, [prescriptions, query]);

  const toggleExpanded = useCallback((id) => {
    if (!id) return;
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const copyText = useCallback(async (text) => {
    const v = safeText(text);
    if (!v) return false;

    try {
      await navigator.clipboard.writeText(v);
      return true;
    } catch {
      // fallback
      try {
        const ta = document.createElement("textarea");
        ta.value = v;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        const ok = document.execCommand("copy");
        document.body.removeChild(ta);
        return ok;
      } catch {
        return false;
      }
    }
  }, []);

  const onCopyNotes = useCallback(
    async (p) => {
      if (typeof onCopyNotesToBuilder === "function") {
        onCopyNotesToBuilder(p);
      }
      // Also copy to clipboard (nice QoL)
      const ok = await copyText(p?.prescription || "");
      if (ok) {
        const id = safeText(p?.id) || `${safeText(p?.createdAt)}-${safeText(p?.title)}`;
        setCopiedId(id);
        setTimeout(() => setCopiedId(""), 1400);
      }
    },
    [onCopyNotesToBuilder, copyText]
  );

  return (
    <div className="bg-white rounded-2xl shadow-md border border-blue-100 p-6 space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-lg font-bold flex items-center gap-2">
            <FileText className="w-5 h-5 text-gray-400" />
            Plan History
          </h3>
          <p className="text-sm text-gray-600 mt-1">View past nutrition plans for this athlete.</p>

          {athleteLine.name || athleteLine.email || athleteLine.tok ? (
            <p className="text-[11px] text-gray-500 mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
              {athleteLine.name ? (
                <span className="font-semibold inline-flex items-center gap-1">
                  <User className="w-3.5 h-3.5 text-gray-400" />
                  {athleteLine.name}
                </span>
              ) : null}

              {athleteLine.email ? <span>{athleteLine.email}</span> : null}

              {athleteLine.tok ? (
                <span className="text-gray-400">• {truncateMiddle(athleteLine.tok, 8, 6)}</span>
              ) : null}
            </p>
          ) : null}
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => onSearch?.()}
            className={cx(
              "px-4 py-2 rounded-xl text-sm font-semibold border inline-flex items-center gap-2",
              canSearch && !loading
                ? "border-gray-200 bg-white hover:bg-gray-50"
                : "border-gray-200 bg-white text-gray-400 cursor-not-allowed"
            )}
            disabled={!canSearch || loading}
            title={!token ? "Missing AthleteToken for this athlete" : "Refresh the latest plans"}
          >
            <RefreshCcw className={cx("w-4 h-4", loading ? "animate-spin" : "")} />
            {loading ? "Refreshing…" : "Refresh"}
          </button>

          <button
            type="button"
            onClick={() => onLoadMore?.()}
            className={cx(
              "px-4 py-2 rounded-xl text-sm font-semibold border inline-flex items-center gap-2",
              canLoadMore && !loading
                ? "border-gray-200 bg-white hover:bg-gray-50"
                : "border-gray-200 bg-white text-gray-400 cursor-not-allowed"
            )}
            disabled={!canLoadMore || loading}
            title={!hasMore ? "No more plans" : "Load older plans"}
          >
            <ChevronDown className="w-4 h-4" />
            {loading ? "…" : "Load more"}
          </button>
        </div>
      </div>

      {/* Token missing */}
      {!token && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm text-amber-800 font-semibold">Missing athlete token</p>
          <p className="text-xs text-amber-700 mt-1">
            This athlete is missing AthleteToken. Fix the roster record to load token-based history.
          </p>
        </div>
      )}

      {/* Search bar */}
      {token ? (
        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search title, coach, or plan notes…"
              className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-gray-200 bg-white text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#46769B]/20"
              disabled={loading}
            />
          </div>

          <div className="text-[11px] text-gray-500 shrink-0">
            {rows.length}/{(Array.isArray(prescriptions) ? prescriptions.length : 0)} shown
          </div>
        </div>
      ) : null}

      {/* Empty */}
      {token && !loading && (Array.isArray(prescriptions) ? prescriptions.length : 0) === 0 && (
        <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
          <p className="text-sm text-gray-700 font-medium">No plans found for this athlete yet.</p>
          <p className="text-[11px] text-gray-500 mt-1">
            Click “Refresh” to re-check the latest plans from NutritionPlans.
          </p>
        </div>
      )}

      {/* List */}
      <div className="space-y-3">
        {(rows || []).map((p) => {
          const id = safeText(p?.id) || `${safeText(p?.createdAt)}-${safeText(p?.title)}`;
          const isOpen = expanded.has(id);

          const created = p?.createdAt ? formatDateTime(p.createdAt) : "—";
          const by = safeText(p?.createdBy);
          const text = safeText(p?.prescription);

          return (
            <div
              key={id}
              className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm hover:border-gray-300 transition"
            >
              <div className="flex items-start justify-between gap-3">
                <button
                  type="button"
                  onClick={() => toggleExpanded(id)}
                  className="min-w-0 text-left"
                  title={isOpen ? "Collapse" : "Expand"}
                >
                  <p className="text-sm font-bold text-gray-900 truncate">{extractTitleHint(p)}</p>
                  <p className="text-[11px] text-gray-500 mt-1">
                    Created: {created}
                    {by ? ` • By: ${by}` : ""}
                    {text ? ` • ${isOpen ? "Full notes" : "Preview"}` : ""}
                  </p>

                  {!isOpen && text ? (
                    <p className="mt-2 text-[12px] text-gray-700">
                      {snippet(text, 220)}
                    </p>
                  ) : null}
                </button>

                <div className="shrink-0 flex flex-col sm:flex-row gap-2">
                  <button
                    type="button"
                    onClick={() => onCopyNotes(p)}
                    className="px-3 py-2 rounded-xl border border-gray-200 bg-white text-xs font-semibold hover:bg-gray-50 inline-flex items-center gap-2"
                    title="Copy notes to builder + clipboard"
                  >
                    {copiedId === id ? (
                      <>
                        <Check className="w-4 h-4 text-emerald-600" />
                        Copied
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4" />
                        Copy to Builder
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => toggleExpanded(id)}
                    className="px-3 py-2 rounded-xl border border-gray-200 bg-white text-xs font-semibold hover:bg-gray-50 inline-flex items-center gap-2"
                  >
                    <ChevronDown className={cx("w-4 h-4 transition", isOpen ? "rotate-180" : "")} />
                    {isOpen ? "Hide" : "View"}
                  </button>
                </div>
              </div>

              {isOpen ? (
                <div className="mt-3">
                  <pre className="whitespace-pre-wrap text-sm text-gray-800 bg-gray-50 border border-gray-200 rounded-xl p-3 max-h-[420px] overflow-auto">
                    {text || ""}
                  </pre>
                </div>
              ) : null}

              {subtleHint ? (
                <p className={subtleHint}>
                  Tip: Copy a past plan’s notes into the builder, then adjust macros/supps.
                </p>
              ) : null}
            </div>
          );
        })}
      </div>

      {token && (Array.isArray(prescriptions) ? prescriptions.length : 0) > 0 ? (
        <div className="text-[11px] text-gray-500">
          {hasMore ? "Showing latest plans. Click “Load more” for older ones." : "End of history."}
        </div>
      ) : null}
    </div>
  );
}