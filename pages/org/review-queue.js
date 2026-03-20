// pages/org/review-queue.js
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/router";
import { useAuthContext } from "@/hooks/useAuth";
import { useReviewQueue } from "@/hooks/org/useReviewQueue";
import { useReviewQueueFilters } from "@/hooks/org/useReviewQueueFilters";
import { useBillingGate } from "@/hooks/org/useBillingGate";

import BillingGateScreen    from "@/components/org/reviewQueue/BillingGateScreen";
import BillingLoadingScreen from "@/components/org/reviewQueue/BillingLoadingScreen";
import ReviewQueueLightbox  from "@/components/org/reviewQueue/ReviewQueueLightbox";

import { safeJson, getRole } from "@/components/org/reviewQueue/reviewQueue.helpers";

import {
  AlertTriangle, ArrowLeft, Calendar, CheckCircle2,
  CheckSquare, ChevronLeft, ChevronRight, Clock,
  Download, ExternalLink, HelpCircle, Image as ImageIcon,
  MessageSquare, Paperclip, RefreshCcw, Search,
  Square, ThumbsUp, X, Zap, Dumbbell,
} from "lucide-react";

const DS = {
  pageBg:        "#F4F7FB",
  cardBg:        "#FFFFFF",
  cardHover:     "#F8FAFD",
  brand:         "#1E3A5F",
  brandLight:    "#2A4F7C",
  brandBg:       "#EEF3F9",
  brandBorder:   "#C0D0E0",
  banned:        "#C8102E",
  bannedBg:      "#FFF0F0",
  bannedBorder:  "#FFC8C8",
  caution:       "#B86000",
  cautionBg:     "#FFFBF0",
  cautionBorder: "#FFD580",
  safe:          "#00873E",
  safeBg:        "#F0FBF4",
  safeBorder:    "#A8DFB8",
  bodyText:      "#1A2535",
  labelText:     "#5A6A7D",
  dimText:       "#9BA8B4",
  border:        "#E8ECF0",
};

function cx(...xs) { return xs.filter(Boolean).join(" "); }
function normLower(v) { return String(v || "").trim().toLowerCase(); }

function reviewMeta(status) {
  const s = normLower(status);
  if (s === "approved")   return { color: DS.safe,    label: "Approved",   Icon: CheckCircle2 };
  if (s === "needs_info") return { color: DS.caution,  label: "Needs Info", Icon: HelpCircle   };
  return                         { color: DS.brand,    label: "Pending",    Icon: Clock        };
}

function extractUrl(att) {
  if (!att) return "";
  if (typeof att === "string") return att;
  return String(att?.url || att?.URL || att?.src || att?.downloadURL || att?.thumbnails?.large?.url || "");
}
function isImgUrl(url = "") {
  const u = url.toLowerCase();
  return u.includes(".png") || u.includes(".jpg") || u.includes(".jpeg") || u.includes(".webp") || u.includes("image");
}
function isPdfUrl(url = "") { return url.toLowerCase().includes(".pdf"); }

async function postReview(id, status, coachNotes = "") {
  return fetch("/api/org/reviewQueue/reviewQueueUpdate", {
    method: "POST", credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, status, coachNotes }),
  });
}

function StatusBadge({ status, size = "sm" }) {
  const { color, label, Icon } = reviewMeta(status);
  const pad = size === "xs" ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-0.5 text-[11px]";
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-sm font-bold whitespace-nowrap ${pad}`}
      style={{ backgroundColor: color + "18", border: `1px solid ${color}44`, color }}
    >
      <Icon className={size === "xs" ? "w-2.5 h-2.5" : "w-3 h-3"} />
      {label}
    </span>
  );
}

function TopBar({ orgName, loading, onBack, onRefresh, onExport, disableExport }) {
  return (
    <div
      className="flex items-center justify-between px-4 py-2.5 gap-4"
      style={{ backgroundColor: DS.brand }}
    >
      <div className="flex items-center gap-3 min-w-0">
        <button
          type="button" onClick={onBack}
          className="flex items-center gap-1.5 text-xs font-bold transition shrink-0"
          style={{ color: "rgba(255,255,255,0.55)" }}
          onMouseEnter={e => { e.currentTarget.style.color = "#fff"; }}
          onMouseLeave={e => { e.currentTarget.style.color = "rgba(255,255,255,0.55)"; }}
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Dashboard
        </button>
        <div className="w-px h-4 shrink-0" style={{ backgroundColor: "rgba(255,255,255,0.15)" }} />
        <span
          className="font-black uppercase tracking-wider text-xs"
          style={{ color: "rgba(255,255,255,0.9)", fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: "0.06em" }}
        >
          Review Queue
        </span>
        {orgName && (
          <span className="text-xs truncate hidden sm:inline" style={{ color: "rgba(255,255,255,0.35)" }}>
            · {orgName}
          </span>
        )}
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        <button
          type="button" onClick={onExport} disabled={disableExport}
          className="text-xs font-bold px-2.5 py-1.5 rounded-sm transition-all disabled:opacity-30"
          style={{ color: "rgba(255,255,255,0.5)", border: "1px solid rgba(255,255,255,0.1)" }}
          onMouseEnter={e => { e.currentTarget.style.color = "#fff"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.35)"; }}
          onMouseLeave={e => { e.currentTarget.style.color = "rgba(255,255,255,0.5)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)"; }}
        >
          <Download className="w-3.5 h-3.5 inline mr-1" />Export
        </button>
        <button
          type="button" onClick={onRefresh} disabled={loading}
          className="inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1.5 rounded-sm transition-all"
          style={{
            backgroundColor: loading ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.12)",
            color: loading ? "rgba(255,255,255,0.3)" : "#fff",
          }}
        >
          <RefreshCcw className={cx("w-3.5 h-3.5", loading && "animate-spin")} />
          <span className="hidden sm:inline">{loading ? "Loading…" : "Refresh"}</span>
        </button>
      </div>
    </div>
  );
}

const FILTER_TABS = [
  { id: "pending",    label: "Pending",    countKey: "pending",   color: DS.brand    },
  { id: "needs_info", label: "Needs Info", countKey: "needsInfo", color: DS.caution  },
  { id: "approved",   label: "Approved",   countKey: "approved",  color: DS.safe     },
  { id: "all",        label: "All",        countKey: "total",     color: DS.labelText },
];

function FilterBar({
  counts, search, setSearch,
  filterMode, setFilterMode,
  sortMode, setSortMode,
  dateFrom, setDateFrom,
  dateTo, setDateTo,
}) {
  const [showDates, setShowDates] = useState(false);
  const hasDate = Boolean(dateFrom || dateTo);

  return (
    <div
      className="px-4 sm:px-5 py-2.5 border-b space-y-2"
      style={{ backgroundColor: DS.cardBg, borderColor: DS.border }}
    >
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1">
          {FILTER_TABS.map(({ id, label, countKey, color }) => {
            const active = filterMode === id;
            const count  = counts?.[countKey] ?? 0;
            return (
              <button
                key={id} type="button"
                onClick={() => setFilterMode(id)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-sm text-xs font-bold transition"
                style={{
                  backgroundColor: active ? color + "15" : "transparent",
                  border: `1px solid ${active ? color + "55" : DS.border}`,
                  color: active ? color : DS.labelText,
                }}
              >
                {label}
                <span
                  className="px-1.5 py-0.5 rounded-sm text-[10px] font-black tabular-nums"
                  style={{
                    backgroundColor: active ? color + "20" : DS.pageBg,
                    color: active ? color : DS.dimText,
                  }}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
        <div className="flex-1" />
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: DS.dimText }} />
          <input
            className="pl-8 pr-7 py-1.5 rounded-sm text-xs outline-none transition w-44 sm:w-56"
            style={{ backgroundColor: DS.brandBg, border: `1px solid ${DS.brandBorder}`, color: DS.bodyText }}
            placeholder="Search athlete, title…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            onFocus={e => { e.target.style.borderColor = DS.brand; }}
            onBlur={e  => { e.target.style.borderColor = DS.brandBorder; }}
          />
          {search && (
            <button type="button" onClick={() => setSearch("")}
              className="absolute right-2 top-1/2 -translate-y-1/2"
              style={{ color: DS.dimText }}
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={() => setSortMode(s => s === "newest" ? "oldest" : "newest")}
          className="text-xs font-bold px-2.5 py-1.5 rounded-sm border transition"
          style={{ borderColor: DS.border, color: DS.labelText, backgroundColor: "transparent" }}
        >
          {sortMode === "newest" ? "Newest" : "Oldest"}
        </button>
        <button
          type="button" onClick={() => setShowDates(v => !v)}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-sm border text-xs font-bold transition"
          style={{
            borderColor: hasDate ? DS.brand + "55" : DS.border,
            color: hasDate ? DS.brand : DS.labelText,
            backgroundColor: hasDate ? DS.brandBg : "transparent",
          }}
        >
          <Calendar className="w-3 h-3" />
          {hasDate ? "Dates ✓" : "Dates"}
        </button>
      </div>
      {showDates && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px]" style={{ color: DS.dimText }}>From</span>
          <input type="date" value={dateFrom || ""}
            onChange={e => setDateFrom(e.target.value)}
            className="px-2 py-1 rounded-sm text-xs outline-none border"
            style={{ backgroundColor: DS.brandBg, borderColor: DS.brandBorder, color: DS.bodyText }}
          />
          <span className="text-[11px]" style={{ color: DS.dimText }}>to</span>
          <input type="date" value={dateTo || ""}
            onChange={e => setDateTo(e.target.value)}
            className="px-2 py-1 rounded-sm text-xs outline-none border"
            style={{ backgroundColor: DS.brandBg, borderColor: DS.brandBorder, color: DS.bodyText }}
          />
          {hasDate && (
            <button type="button" onClick={() => { setDateFrom(""); setDateTo(""); }}
              className="flex items-center gap-1 text-xs font-bold"
              style={{ color: DS.brand }}
            >
              <X className="w-3 h-3" /> Clear
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function ListHeader({ total, selected, onSelectAll, onClear, onBulkApprove, onBulkNeedsInfo, bulkSaving }) {
  const hasSel = selected.size > 0;
  return (
    <div
      className="flex items-center gap-2 px-4 py-2 border-b"
      style={{ backgroundColor: DS.pageBg, borderColor: DS.border }}
    >
      {hasSel ? (
        <>
          <button type="button" onClick={onClear} style={{ color: DS.dimText }}>
            <X className="w-3.5 h-3.5" />
          </button>
          <span className="text-xs font-black flex-1" style={{ color: DS.brand }}>
            {selected.size} selected
          </span>
          <button
            type="button" onClick={onBulkNeedsInfo} disabled={bulkSaving}
            className="px-2.5 py-1 rounded-sm text-[11px] font-black border transition"
            style={{ borderColor: DS.cautionBorder, color: DS.caution, backgroundColor: DS.cautionBg }}
          >
            Needs Info
          </button>
          <button
            type="button" onClick={onBulkApprove} disabled={bulkSaving}
            className="px-2.5 py-1 rounded-sm text-[11px] font-black transition"
            style={{ backgroundColor: DS.brand, color: "#fff" }}
          >
            {bulkSaving ? "…" : "Approve"}
          </button>
        </>
      ) : (
        <>
          <span className="text-[11px] flex-1" style={{ color: DS.dimText }}>
            {total} item{total !== 1 ? "s" : ""}
          </span>
          {total > 0 && (
            <button type="button" onClick={onSelectAll}
              className="text-[11px] font-bold transition"
              style={{ color: DS.labelText }}
              onMouseEnter={e => { e.currentTarget.style.color = DS.brand; }}
              onMouseLeave={e => { e.currentTarget.style.color = DS.labelText; }}
            >
              Select all
            </button>
          )}
        </>
      )}
    </div>
  );
}

function ListRow({ item, isActive, isSelected, onSelect, onActivate }) {
  const { color } = reviewMeta(item?.reviewStatus);
  const hasAttachments = (item?.attachments?.length || 0) > 0;

  return (
    <div
      role="button" tabIndex={0}
      onClick={() => onActivate(item)}
      onKeyDown={e => { if (e.key === "Enter" || e.key === " ") onActivate(item); }}
      className="flex items-start gap-2.5 px-4 py-3 cursor-pointer border-b outline-none transition-colors"
      style={{
        borderColor: DS.border,
        backgroundColor: isActive ? DS.brandBg : DS.cardBg,
        borderLeft: `3px solid ${isActive ? DS.brand : "transparent"}`,
      }}
      onMouseEnter={e => { if (!isActive) e.currentTarget.style.backgroundColor = DS.cardHover; }}
      onMouseLeave={e => { e.currentTarget.style.backgroundColor = isActive ? DS.brandBg : DS.cardBg; }}
    >
      <button
        type="button"
        onClick={e => { e.stopPropagation(); onSelect(item.id); }}
        className="shrink-0 mt-0.5 transition"
        style={{ color: isSelected ? DS.brand : DS.dimText }}
      >
        {isSelected ? <CheckSquare className="w-3.5 h-3.5" /> : <Square className="w-3.5 h-3.5" />}
      </button>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-xs font-black truncate" style={{ color: DS.bodyText }}>
              {item?.athleteName || "—"}
            </p>
            {/* ── CHANGE 1: show exerciseName in list row ── */}
            <p className="text-[11px] truncate mt-0.5" style={{ color: DS.labelText }}>
              {item?.exerciseName || item?.title || "Workout Completion"}
            </p>
          </div>
          <StatusBadge status={item?.reviewStatus} size="xs" />
        </div>
        <div className="flex items-center gap-2 mt-1.5">
          {item?.date && (
            <span className="text-[10px]" style={{ color: DS.dimText }}>{item.date}</span>
          )}
          {hasAttachments && (
            <span className="flex items-center gap-0.5 text-[10px]" style={{ color: DS.labelText }}>
              <Paperclip className="w-2.5 h-2.5" /> {item.attachments.length}
            </span>
          )}
          {item?.coachNotes && (
            <span style={{ color: DS.labelText }}>
              <MessageSquare className="w-2.5 h-2.5" />
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function ListEmpty({ filterMode }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
      <CheckCircle2 className="w-8 h-8 mb-3" style={{ color: DS.brandBorder }} />
      <p className="text-sm font-black" style={{ color: DS.labelText, fontFamily: "'Barlow Condensed', sans-serif" }}>
        {filterMode === "pending" ? "No pending items" : "Nothing here"}
      </p>
      <p className="text-xs mt-1" style={{ color: DS.dimText }}>
        {filterMode === "pending" ? "You're all caught up." : "Try a different filter."}
      </p>
    </div>
  );
}

function DetailEmpty() {
  return (
    <div className="flex flex-col items-center justify-center h-full py-20 px-8 text-center">
      <div
        className="w-14 h-14 rounded-sm flex items-center justify-center mb-4"
        style={{ backgroundColor: DS.brandBg, border: `1px solid ${DS.brandBorder}` }}
      >
        <Zap className="w-6 h-6" style={{ color: DS.brandBorder }} />
      </div>
      <p
        className="text-base font-black uppercase tracking-wide"
        style={{ color: DS.labelText, fontFamily: "'Barlow Condensed', sans-serif" }}
      >
        Select an item to review
      </p>
      <p className="text-xs mt-2 max-w-[200px] leading-relaxed" style={{ color: DS.dimText }}>
        Click a row or use{" "}
        <kbd className="px-1 py-0.5 rounded-sm text-[10px]" style={{ backgroundColor: DS.pageBg, border: `1px solid ${DS.border}`, color: DS.labelText }}>J</kbd>
        {" "}/{" "}
        <kbd className="px-1 py-0.5 rounded-sm text-[10px]" style={{ backgroundColor: DS.pageBg, border: `1px solid ${DS.border}`, color: DS.labelText }}>K</kbd>
        {" "}to navigate
      </p>
    </div>
  );
}

function KbdHint({ kbd, label }) {
  return (
    <span className="inline-flex items-center gap-1 text-[10px]" style={{ color: DS.dimText }}>
      <kbd className="px-1 py-0.5 rounded-sm font-mono" style={{ backgroundColor: DS.pageBg, border: `1px solid ${DS.border}`, color: DS.labelText }}>
        {kbd}
      </kbd>
      {label}
    </span>
  );
}

function DetailPanel({
  item, saving, saveErr,
  onApprove, onNeedsInfo,
  onOpenLightbox, fmtDate,
  onSaveNote, currentIndex, total,
  onPrev, onNext,
}) {
  const [note,       setNote]       = useState("");
  const [selIdx,     setSelIdx]     = useState(0);
  const [noteSaving, setNoteSaving] = useState(false);

  useEffect(() => {
    if (!item) return;
    setNote(String(item?.coachNotes || item?.reviewNote || item?.ReviewNote || "").trim());
    setSelIdx(0);
  }, [item?.id]);

  const attachments = useMemo(() => Array.isArray(item?.attachments) ? item.attachments : [], [item]);
  const safeIdx  = Math.min(selIdx, Math.max(0, attachments.length - 1));
  const selAtt   = attachments[safeIdx];
  const selUrl   = extractUrl(selAtt);
  const selName  = String(selAtt?.filename || selAtt?.name || `Upload ${safeIdx + 1}`);
  const canNeedsInfo = String(note || "").trim().length >= 3;

  const handleSaveNote = async () => {
    if (!item?.id) return;
    setNoteSaving(true);
    await onSaveNote?.(item.id, note);
    setNoteSaving(false);
  };

  if (!item) return <DetailEmpty />;

  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* Detail header */}
      <div
        className="flex items-center gap-3 px-5 py-3 border-b shrink-0"
        style={{ backgroundColor: DS.cardBg, borderColor: DS.border }}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p
              className="text-sm font-black truncate"
              style={{ color: DS.bodyText, fontFamily: "'Barlow Condensed', sans-serif", fontSize: "1rem" }}
            >
              {item?.athleteName || "Athlete"}
            </p>
            <StatusBadge status={item?.reviewStatus} />
          </div>
          <p className="text-xs truncate mt-0.5" style={{ color: DS.labelText }}>
            {item?.exerciseName || item?.title || "Workout Completion"}
            {item?.date ? ` · ${fmtDate?.(item.date) || item.date}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button" onClick={onPrev} disabled={currentIndex <= 0}
            className="w-7 h-7 rounded-sm flex items-center justify-center border transition disabled:opacity-30"
            style={{ borderColor: DS.border, color: DS.labelText, backgroundColor: DS.pageBg }}
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
          <span className="text-[11px] px-1 tabular-nums" style={{ color: DS.dimText }}>
            {currentIndex + 1}/{total}
          </span>
          <button
            type="button" onClick={onNext} disabled={currentIndex >= total - 1}
            className="w-7 h-7 rounded-sm flex items-center justify-center border transition disabled:opacity-30"
            style={{ borderColor: DS.border, color: DS.labelText, backgroundColor: DS.pageBg }}
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto" style={{ backgroundColor: DS.pageBg }}>
        <div className="p-5 space-y-4">

          {saveErr && (
            <div
              className="px-3 py-2 rounded-sm text-xs font-bold"
              style={{ backgroundColor: DS.bannedBg, borderLeft: `3px solid ${DS.banned}`, color: DS.banned }}
            >
              {saveErr}
            </div>
          )}

          {/* Athlete email */}
          {item?.athleteEmail && (
            <p className="text-xs" style={{ color: DS.labelText }}>{item.athleteEmail}</p>
          )}

          {/* ── CHANGE 2: Exercise name badge ── */}
          {item?.exerciseName && (
            <div
              className="flex items-center gap-2 px-3 py-2.5 rounded-sm"
              style={{ backgroundColor: DS.brandBg, border: `1px solid ${DS.brandBorder}` }}
            >
              <Dumbbell className="w-3.5 h-3.5 shrink-0" style={{ color: DS.brand }} />
              <span
                className="text-[10px] font-black uppercase tracking-wider shrink-0"
                style={{ color: DS.brand }}
              >
                Exercise
              </span>
              <span className="text-xs font-bold truncate" style={{ color: DS.bodyText }}>
                {item.exerciseName}
              </span>
            </div>
          )}

          {/* Attachment summary */}
          {item?.attachmentSummary && (
            <p className="text-xs leading-relaxed" style={{ color: DS.labelText }}>{item.attachmentSummary}</p>
          )}

          {/* Uploads */}
          {attachments.length > 0 && (
            <div
              className="rounded-sm overflow-hidden"
              style={{ backgroundColor: DS.cardBg, border: `1px solid ${DS.border}` }}
            >
              <div
                className="flex items-center gap-2 px-4 py-2 border-b"
                style={{ borderColor: DS.border, backgroundColor: DS.pageBg }}
              >
                <ImageIcon className="w-3.5 h-3.5" style={{ color: DS.labelText }} />
                <span className="text-[10px] font-black uppercase tracking-wider" style={{ color: DS.labelText }}>
                  Uploads ({attachments.length})
                </span>
              </div>

              {attachments.length > 1 && (
                <div className="flex gap-2 p-3 border-b overflow-x-auto" style={{ borderColor: DS.border }}>
                  {attachments.map((att, i) => {
                    const url  = extractUrl(att);
                    const isSel = i === safeIdx;
                    return (
                      <button
                        key={i} type="button" onClick={() => setSelIdx(i)}
                        className="shrink-0 w-14 h-14 rounded-sm overflow-hidden border transition"
                        style={{
                          borderColor: isSel ? DS.brand : DS.border,
                          boxShadow: isSel ? `0 0 0 2px ${DS.brand}30` : "none",
                        }}
                      >
                        {url
                          ? <img src={url} alt="" className="w-full h-full object-cover" loading="lazy" />
                          : (
                            <div className="w-full h-full flex items-center justify-center" style={{ backgroundColor: DS.pageBg }}>
                              <ImageIcon className="w-4 h-4" style={{ color: DS.dimText }} />
                            </div>
                          )
                        }
                      </button>
                    );
                  })}
                </div>
              )}

              <div
                className="flex items-center justify-between gap-2 px-3 py-2 border-b"
                style={{ borderColor: DS.border }}
              >
                <span className="text-[11px] truncate max-w-[140px]" style={{ color: DS.labelText }}>
                  {selName}
                  {attachments.length > 1 && (
                    <span style={{ color: DS.dimText }}> · {safeIdx + 1}/{attachments.length}</span>
                  )}
                </span>
                <div className="flex items-center gap-1.5">
                  {attachments.length > 1 && (
                    <>
                      <button type="button"
                        onClick={() => setSelIdx(i => i <= 0 ? attachments.length - 1 : i - 1)}
                        className="w-7 h-7 rounded-sm flex items-center justify-center border transition"
                        style={{ borderColor: DS.border, color: DS.labelText }}
                      >
                        <ChevronLeft className="w-3.5 h-3.5" />
                      </button>
                      <button type="button"
                        onClick={() => setSelIdx(i => i >= attachments.length - 1 ? 0 : i + 1)}
                        className="w-7 h-7 rounded-sm flex items-center justify-center border transition"
                        style={{ borderColor: DS.border, color: DS.labelText }}
                      >
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </>
                  )}
                  {selUrl && (
                    <>
                      <a
                        href={selUrl} target="_blank" rel="noreferrer"
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-sm border text-[11px] font-bold transition"
                        style={{ borderColor: DS.border, color: DS.labelText, backgroundColor: DS.pageBg }}
                      >
                        <ExternalLink className="w-3 h-3" /> Open
                      </a>
                      <button
                        type="button" onClick={() => onOpenLightbox?.(selUrl)}
                        className="px-2 py-1 rounded-sm text-[11px] font-black transition"
                        style={{ backgroundColor: DS.brand, color: "#fff" }}
                      >
                        Fullscreen
                      </button>
                    </>
                  )}
                </div>
              </div>

              <div className="p-3">
                {selUrl ? (
                  isPdfUrl(selUrl) ? (
                    <iframe src={selUrl} title={selName} className="w-full rounded-sm" style={{ height: 280 }} />
                  ) : isImgUrl(selUrl) ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={selUrl} alt={selName}
                      className="w-full rounded-sm object-contain cursor-zoom-in"
                      style={{ maxHeight: 280, backgroundColor: DS.pageBg, border: `1px solid ${DS.border}` }}
                      onClick={() => onOpenLightbox?.(selUrl)}
                      loading="lazy"
                    />
                  ) : (
                    <p className="py-8 text-center text-xs" style={{ color: DS.dimText }}>
                      Preview —{" "}
                      <a href={selUrl} target="_blank" rel="noreferrer" className="font-bold underline" style={{ color: DS.brand }}>Open</a>
                    </p>
                  )
                ) : (
                  <div className="py-10 flex flex-col items-center gap-2">
                    <ImageIcon className="w-6 h-6" style={{ color: DS.dimText }} />
                    <p className="text-xs" style={{ color: DS.dimText }}>No preview</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Coach note */}
          <div
            className="rounded-sm overflow-hidden"
            style={{ backgroundColor: DS.cardBg, border: `1px solid ${DS.border}` }}
          >
            <div
              className="px-4 py-2 border-b"
              style={{ borderColor: DS.border, backgroundColor: DS.pageBg }}
            >
              <p className="text-[10px] font-black uppercase tracking-wider" style={{ color: DS.labelText }}>
                Message to athlete
                <span className="normal-case font-normal ml-1" style={{ color: DS.dimText }}>
                  — required for Needs Info
                </span>
              </p>
            </div>
            <div className="p-3">
              <textarea
                className="w-full rounded-sm px-3 py-2.5 text-xs outline-none transition resize-none"
                style={{
                  backgroundColor: DS.pageBg,
                  border: `1px solid ${DS.brandBorder}`,
                  color: DS.bodyText,
                  minHeight: 80,
                }}
                onFocus={e => { e.target.style.borderColor = DS.brand; e.target.style.boxShadow = `0 0 0 2px ${DS.brand}15`; }}
                onBlur={e  => { e.target.style.borderColor = DS.brandBorder; e.target.style.boxShadow = "none"; }}
                placeholder='"Please resubmit with a clearer photo showing weight × reps."'
                value={note}
                onChange={e => setNote(e.target.value)}
              />
              {note !== (item?.coachNotes || "") && (
                <button
                  type="button" onClick={handleSaveNote} disabled={noteSaving}
                  className="mt-1.5 text-[11px] font-black transition"
                  style={{ color: DS.brand }}
                >
                  {noteSaving ? "Saving…" : "Save note"}
                </button>
              )}
            </div>
          </div>

        </div>
      </div>

      {/* Sticky action footer */}
      <div
        className="shrink-0 px-5 py-4 border-t space-y-3"
        style={{ backgroundColor: DS.cardBg, borderColor: DS.border }}
      >
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => onNeedsInfo?.(note)}
            disabled={saving || !item?.id || !canNeedsInfo}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-sm text-sm font-black uppercase tracking-wide border transition disabled:opacity-40"
            style={{ borderColor: DS.cautionBorder, color: DS.caution, backgroundColor: DS.cautionBg }}
            title={!canNeedsInfo ? "Add a message first" : ""}
          >
            <HelpCircle className="w-4 h-4" /> Needs Info
          </button>
          <button
            type="button"
            onClick={() => onApprove?.()}
            disabled={saving || !item?.id}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-sm text-sm font-black uppercase tracking-wide transition disabled:opacity-40"
            style={{ backgroundColor: DS.brand, color: "#fff" }}
          >
            <ThumbsUp className="w-4 h-4" />
            {saving ? "Saving…" : "Approve"}
          </button>
        </div>
        <div className="flex items-center justify-center gap-4 flex-wrap">
          <KbdHint kbd="J" label="next" />
          <KbdHint kbd="K" label="prev" />
          <KbdHint kbd="A" label="approve" />
          <KbdHint kbd="N" label="focus note" />
          <KbdHint kbd="Esc" label="deselect" />
        </div>
      </div>
    </div>
  );
}

function MobileSheet({ item, open, onClose, saving, saveErr, onApprove, onNeedsInfo, onOpenLightbox, fmtDate, onSaveNote, currentIndex, total, onPrev, onNext }) {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  if (!open || !item) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      <button type="button" onClick={onClose} className="absolute inset-0" style={{ backgroundColor: "rgba(0,0,0,0.5)" }} />
      <div
        className="relative flex flex-col rounded-t-2xl overflow-hidden"
        style={{ backgroundColor: DS.pageBg, border: `1px solid ${DS.border}`, maxHeight: "92vh" }}
      >
        <div className="flex justify-center pt-2.5 pb-1 shrink-0">
          <div className="w-8 h-1 rounded-full" style={{ backgroundColor: DS.border }} />
        </div>
        <div className="overflow-y-auto flex-1">
          <DetailPanel
            item={item} saving={saving} saveErr={saveErr}
            onApprove={onApprove} onNeedsInfo={onNeedsInfo}
            onOpenLightbox={onOpenLightbox} fmtDate={fmtDate}
            onSaveNote={onSaveNote}
            currentIndex={currentIndex} total={total}
            onPrev={onPrev} onNext={onNext}
          />
        </div>
      </div>
    </div>
  );
}

export default function ReviewQueuePage() {
  const router = useRouter();
  const { user, logout } = useAuthContext();
  const { loading, error, items, setItems, refreshQueue, counts, fmtDate } = useReviewQueue();

  const role      = useMemo(() => getRole(user), [user]);
  const isOrgSide = role === "organization" || role === "admin" || role === "trainer";

  const orgName = useMemo(() => {
    const g = user?.OrgName || user?.["Organization Name"] || user?.OrganizationName ||
              user?.organizationName || user?.Organization ||
              (role === "organization" ? (user?.Name || user?.name) : "") || "";
    return String(g || "");
  }, [user, role]);

  useEffect(() => {
    if (!user)              { router.push("/");          return; }
    if (role && !isOrgSide) { router.push("/dashboard"); return; }
  }, [user, role, isOrgSide, router]);

  const { billingLoading, billingErr, billing, isPaidOk } = useBillingGate({ user, role, isOrgSide });

  const { search, setSearch, filterMode, setFilterMode, sortMode, setSortMode, filtered } =
    useReviewQueueFilters(items);

  const [dateFrom, setDateFrom] = useState("");
  const [dateTo,   setDateTo]   = useState("");

  const displayItems = useMemo(() => {
    if (!dateFrom && !dateTo) return filtered;
    return filtered.filter(it => {
      const d = it?.createdAt || it?.date;
      if (!d) return true;
      const t = new Date(d).getTime();
      if (dateFrom && t < new Date(dateFrom).getTime()) return false;
      if (dateTo   && t > new Date(dateTo + "T23:59:59").getTime()) return false;
      return true;
    });
  }, [filtered, dateFrom, dateTo]);

  const [activeId, setActiveId] = useState(null);

  const activeIndex = useMemo(
    () => displayItems.findIndex(it => it.id === activeId),
    [displayItems, activeId]
  );
  const activeItem = useMemo(
    () => displayItems.find(it => it.id === activeId) ?? null,
    [displayItems, activeId]
  );

  const isMobile = () => typeof window !== "undefined" && window.innerWidth < 768;

  const activateItem  = useCallback((item) => { setActiveId(item?.id ?? null); if (isMobile()) setMobileSheetOpen(true); }, []);
  const activateIndex = useCallback((idx) => {
    const it = displayItems[idx];
    if (it) { setActiveId(it.id); if (isMobile()) setMobileSheetOpen(true); }
  }, [displayItems]);

  const goPrev = useCallback(() => { if (activeIndex > 0) activateIndex(activeIndex - 1); }, [activeIndex, activateIndex]);
  const goNext = useCallback(() => { if (activeIndex < displayItems.length - 1) activateIndex(activeIndex + 1); }, [activeIndex, displayItems.length, activateIndex]);

  const [mobileSheetOpen, setMobileSheetOpen] = useState(false);
  const [selected,   setSelected]   = useState(new Set());
  const [bulkSaving, setBulkSaving] = useState(false);

  const toggleSelect  = useCallback(id => {
    setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }, []);
  const selectAll     = useCallback(() => setSelected(new Set(displayItems.map(it => it.id).filter(Boolean))), [displayItems]);
  const clearSelected = useCallback(() => setSelected(new Set()), []);

  const [saving,  setSaving]  = useState(false);
  const [saveErr, setSaveErr] = useState("");

  const didLoadRef = useRef(false);
  useEffect(() => {
    if (!user || !isOrgSide || billingLoading || !isPaidOk) return;
    if (didLoadRef.current) return;
    didLoadRef.current = true;
    refreshQueue();
  }, [user, isOrgSide, billingLoading, isPaidOk, refreshQueue]);

  useEffect(() => {
    const handler = e => {
      const tag = document.activeElement?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select") return;
      if (e.key === "j" || e.key === "J") { e.preventDefault(); goNext(); }
      if (e.key === "k" || e.key === "K") { e.preventDefault(); goPrev(); }
      if ((e.key === "a" || e.key === "A") && activeItem && !saving) { e.preventDefault(); handleApprove(); }
      if ((e.key === "n" || e.key === "N") && activeItem) { document.querySelector("textarea")?.focus(); }
      if (e.key === "Escape") { setActiveId(null); setMobileSheetOpen(false); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [goNext, goPrev, activeItem, saving]);

  const applyUpdate = useCallback((id, reviewStatus, coachNotes = "") => {
    setItems(prev => {
      const list = Array.isArray(prev) ? [...prev] : [];
      const idx  = list.findIndex(x => String(x?.id) === id);
      if (idx >= 0) list[idx] = { ...list[idx], reviewStatus, coachNotes: coachNotes || list[idx]?.coachNotes || "" };
      return list;
    });
  }, [setItems]);

  const handleApprove = useCallback(async () => {
    if (!activeItem?.id) return;
    setSaveErr(""); setSaving(true);
    try {
      const res  = await postReview(activeItem.id, "approved");
      const data = await safeJson(res);
      if (!res.ok) throw new Error(data?.error || "Failed");
      applyUpdate(activeItem.id, "approved");
      goNext();
    } catch (e) { setSaveErr(e?.message || "Failed."); }
    finally { setSaving(false); }
  }, [activeItem, applyUpdate, goNext]);

  const handleNeedsInfo = useCallback(async (note) => {
    if (!activeItem?.id) return;
    setSaveErr(""); setSaving(true);
    try {
      const res  = await postReview(activeItem.id, "needs_info", note);
      const data = await safeJson(res);
      if (!res.ok) throw new Error(data?.error || "Failed");
      applyUpdate(activeItem.id, "needs_info", note);
      goNext();
    } catch (e) { setSaveErr(e?.message || "Failed."); }
    finally { setSaving(false); }
  }, [activeItem, applyUpdate, goNext]);

  const handleSaveNote = useCallback(async (id, note) => {
    try {
      const res  = await postReview(id, undefined, note);
      const data = await safeJson(res);
      if (!res.ok) throw new Error(data?.error || "Failed");
      setItems(prev => {
        const list = Array.isArray(prev) ? [...prev] : [];
        const idx  = list.findIndex(x => String(x?.id) === id);
        if (idx >= 0) list[idx] = { ...list[idx], coachNotes: note };
        return list;
      });
    } catch { /* silent */ }
  }, [setItems]);

  const bulkUpdate = useCallback(async (status) => {
    if (!selected.size) return;
    setBulkSaving(true);
    const ids = Array.from(selected);
    try {
      await Promise.all(ids.map(id => postReview(id, status)));
      setItems(prev => {
        const list = Array.isArray(prev) ? [...prev] : [];
        return list.map(x => ids.includes(String(x?.id)) ? { ...x, reviewStatus: status } : x);
      });
      clearSelected();
    } catch { /* silent */ }
    finally { setBulkSaving(false); }
  }, [selected, setItems, clearSelected]);

  const exportCSV = useCallback(() => {
    const rows = [["Athlete", "Email", "Exercise", "Title", "Date", "Review Status", "Coach Notes"]];
    (Array.isArray(items) ? items : []).forEach(it => {
      rows.push([
        it?.athleteName  || "",
        it?.athleteEmail || "",
        it?.exerciseName || "",
        it?.title        || "",
        it?.date         || "",
        it?.reviewStatus || "",
        it?.coachNotes   || "",
      ]);
    });
    const csv  = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url  = URL.createObjectURL(blob);
    const a    = Object.assign(document.createElement("a"), { href: url, download: "review_queue.csv" });
    document.body.appendChild(a); a.click();
    setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 200);
  }, [items]);

  const [lightboxUrl, setLightboxUrl] = useState("");

  const onLogout = useCallback(async () => {
    try { await logout?.(); } finally { router.push("/"); }
  }, [logout, router]);

  if (billingLoading) return <BillingLoadingScreen />;
  if (billingErr || !isPaidOk) {
    return (
      <BillingGateScreen
        role={role} billing={billing} error={billingErr}
        onLogout={onLogout} onGoAccount={() => router.push("/account")}
      />
    );
  }

  return (
    <div className="flex flex-col min-h-screen" style={{ backgroundColor: DS.pageBg, color: DS.bodyText }}>

      <TopBar
        orgName={orgName} loading={loading}
        onBack={() => router.push("/org/dashboard")}
        onRefresh={refreshQueue}
        onExport={exportCSV}
        disableExport={!items?.length}
      />

      <FilterBar
        counts={counts} search={search} setSearch={setSearch}
        filterMode={filterMode} setFilterMode={setFilterMode}
        sortMode={sortMode} setSortMode={setSortMode}
        dateFrom={dateFrom} setDateFrom={setDateFrom}
        dateTo={dateTo} setDateTo={setDateTo}
      />

      {error && (
        <div
          className="px-5 py-2 text-xs font-bold"
          style={{ backgroundColor: DS.bannedBg, borderBottom: `2px solid ${DS.banned}`, color: DS.banned }}
        >
          {error}
        </div>
      )}

      <div className="flex flex-1 overflow-hidden" style={{ height: "calc(100vh - 91px)" }}>

        <div
          className="flex flex-col w-full md:w-80 lg:w-96 shrink-0 border-r overflow-hidden"
          style={{ borderColor: DS.border, backgroundColor: DS.cardBg }}
        >
          <ListHeader
            total={displayItems.length}
            selected={selected}
            onSelectAll={selectAll}
            onClear={clearSelected}
            onBulkApprove={() => bulkUpdate("approved")}
            onBulkNeedsInfo={() => bulkUpdate("needs_info")}
            bulkSaving={bulkSaving}
          />
          <div className="flex-1 overflow-y-auto">
            {loading && !displayItems.length ? (
              <div className="space-y-0">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="animate-pulse px-4 py-3 border-b" style={{ borderColor: DS.border }}>
                    <div className="h-3 rounded-sm mb-2" style={{ backgroundColor: DS.pageBg, width: "60%" }} />
                    <div className="h-2 rounded-sm" style={{ backgroundColor: DS.pageBg, width: "40%" }} />
                  </div>
                ))}
              </div>
            ) : displayItems.length === 0 ? (
              <ListEmpty filterMode={filterMode} />
            ) : (
              displayItems.map((it, i) => (
                <ListRow
                  key={it.id || i}
                  item={it}
                  isActive={it.id === activeId}
                  isSelected={selected.has(it.id)}
                  onSelect={toggleSelect}
                  onActivate={activateItem}
                />
              ))
            )}
          </div>
        </div>

        <div
          className="hidden md:flex flex-col flex-1 overflow-hidden"
          style={{ backgroundColor: DS.pageBg }}
        >
          <DetailPanel
            item={activeItem}
            saving={saving} saveErr={saveErr}
            onApprove={handleApprove} onNeedsInfo={handleNeedsInfo}
            onOpenLightbox={setLightboxUrl} fmtDate={fmtDate}
            onSaveNote={handleSaveNote}
            currentIndex={activeIndex} total={displayItems.length}
            onPrev={goPrev} onNext={goNext}
          />
        </div>

      </div>

      <MobileSheet
        item={activeItem} open={mobileSheetOpen}
        onClose={() => setMobileSheetOpen(false)}
        saving={saving} saveErr={saveErr}
        onApprove={handleApprove} onNeedsInfo={handleNeedsInfo}
        onOpenLightbox={setLightboxUrl} fmtDate={fmtDate}
        onSaveNote={handleSaveNote}
        currentIndex={activeIndex} total={displayItems.length}
        onPrev={goPrev} onNext={goNext}
      />

      <ReviewQueueLightbox url={lightboxUrl} onClose={() => setLightboxUrl("")} />
    </div>
  );
}