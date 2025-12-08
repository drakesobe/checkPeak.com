// pages/scans/[id].js
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { useAuthContext } from "@/hooks/useAuth";
import { trackEvent } from "@/lib/analytics";
import {
  ArrowLeft,
  Share2,
  Trash2,
  RefreshCw,
  AlertTriangle,
  Shield,
  Link2,
  X,
  Pencil,
  Check,
} from "lucide-react";

/* -------------------------------------------------------------------------------------------------
   Helpers: counts & risk
-------------------------------------------------------------------------------------------------- */

function getCounts(scan) {
  if (!scan) {
    return {
      prohibitedCount: 0,
      limitedCount: 0,
      otherCount: 0,
    };
  }

  const fallbackProhibited = scan.prohibitedCount ?? 0;
  const fallbackLimited = scan.limitedCount ?? 0;
  const fallbackOther = scan.otherCount ?? 0;

  const bannedMatches = Array.isArray(scan.matchedBanned)
    ? scan.matchedBanned
    : [];
  const ingredientMatchCount = Array.isArray(scan.matchedIngredients)
    ? scan.matchedIngredients.length
    : 0;

  if (!bannedMatches.length && !ingredientMatchCount) {
    return {
      prohibitedCount: fallbackProhibited,
      limitedCount: fallbackLimited,
      otherCount: fallbackOther,
    };
  }

  let prohibited = 0;
  let limited = 0;
  let other = 0;

  for (const b of bannedMatches) {
    const rawBanType = (b?.fields?.["Ban Type"] || "")
      .toString()
      .trim()
      .toLowerCase();

    if (!rawBanType) {
      other += 1;
      continue;
    }

    if (
      rawBanType.includes("prohibited") ||
      rawBanType.includes("in-competition") ||
      rawBanType.includes("in competition") ||
      rawBanType.includes("banned")
    ) {
      prohibited += 1;
    } else if (
      rawBanType.includes("limited") ||
      rawBanType.includes("out of competition") ||
      rawBanType.includes("out-of-competition") ||
      rawBanType.includes("threshold")
    ) {
      limited += 1;
    } else {
      other += 1;
    }
  }

  // "Other Flags" includes other banned + ALL ingredient matches
  const totalOther = other + ingredientMatchCount;

  if (!prohibited && !limited && !totalOther) {
    return {
      prohibitedCount: fallbackProhibited,
      limitedCount: fallbackLimited,
      otherCount: fallbackOther,
    };
  }

  return {
    prohibitedCount: prohibited,
    limitedCount: limited,
    otherCount: totalOther,
  };
}

function computeRisk(scan) {
  const { prohibitedCount, limitedCount } = getCounts(scan);

  if (prohibitedCount > 0) {
    return {
      label: "High Risk",
      detail: `${prohibitedCount} prohibited substance${
        prohibitedCount > 1 ? "s" : ""
      } found`,
      badgeClass: "bg-red-100 text-red-800 border-red-200",
      ringClass: "ring-red-200",
      iconColor: "text-red-600",
      gradient: "from-red-50 via-rose-50 to-amber-50",
    };
  }

  if (limitedCount > 0) {
    return {
      label: "Moderate Risk",
      detail: `${limitedCount} limited / threshold substance${
        limitedCount > 1 ? "s" : ""
      }`,
      badgeClass: "bg-amber-100 text-amber-800 border-amber-200",
      ringClass: "ring-amber-200",
      iconColor: "text-amber-500",
      gradient: "from-amber-50 via-yellow-50 to-emerald-50",
    };
  }

  return {
    label: "Low Risk",
    detail: "No prohibited or limited substances detected",
    badgeClass: "bg-emerald-100 text-emerald-800 border-emerald-200",
    ringClass: "ring-emerald-200",
    iconColor: "text-emerald-500",
    gradient: "from-emerald-50 via-blue-50 to-slate-50",
  };
}

/* -------------------------------------------------------------------------------------------------
   Page component
-------------------------------------------------------------------------------------------------- */

export default function ScanDetailPage() {
  const router = useRouter();
  const { user } = useAuthContext();

  const [activeTab, setActiveTab] = useState("My Scans");
  const [scan, setScan] = useState(null);

  const [loading, setLoading] = useState(true);
  const [loadingError, setLoadingError] = useState("");
  const [actionError, setActionError] = useState("");

  const [reanalyzing, setReanalyzing] = useState(false);

  const [shareEnabled, setShareEnabled] = useState(false);
  const [shareUrl, setShareUrl] = useState("");
  const [shareSaving, setShareSaving] = useState(false);

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [isRenaming, setIsRenaming] = useState(false);
  const [pendingName, setPendingName] = useState("");
  const [renameSaving, setRenameSaving] = useState(false);

  const scanId = router.query?.id;

  /* ---------- load scan detail ---------- */
  useEffect(() => {
    if (!router.isReady) return;

    if (!user) {
      router.push("/login");
      return;
    }

    if (!scanId) return;

    async function loadScan() {
      try {
        setLoading(true);
        setLoadingError("");
        setActionError("");

        const res = await fetch(`/api/getScanDetail?scanId=${scanId}`);
        if (!res.ok) {
          const text = await res.text().catch(() => "");
          throw new Error(
            text || `Failed to load scan detail (status ${res.status})`
          );
        }

        const data = await res.json();
        const s = data.scan || data || null;
        if (!s) throw new Error("Scan not found.");

        setScan(s);

        const shareFlag = Boolean(s.shareEnabled);
        setShareEnabled(shareFlag);

        if (shareFlag && s.shareToken && typeof window !== "undefined") {
          setShareUrl(`${window.location.origin}/share/${s.shareToken}`);
        } else {
          setShareUrl("");
        }

        // init rename draft
        setPendingName(s.name || s.ScanName || "Unnamed Scan");

        try {
          trackEvent("scan_detail_view", {
            eventType: "scan_detail_view",
            userEmail: user.Email || user.email || "",
            scanId: s.id,
            path: typeof window !== "undefined" ? window.location.pathname : "",
            device:
              typeof navigator !== "undefined" ? navigator.userAgent : "",
          });
        } catch (err) {
          console.error("scan_detail_view tracking failed:", err);
        }
      } catch (err) {
        console.error("Failed to load scan detail:", err);
        setLoadingError(err.message || "Failed to load scan details.");
      } finally {
        setLoading(false);
      }
    }

    loadScan();
  }, [router.isReady, scanId, user, router]);

  /* keep rename draft in sync if scan changes */
  useEffect(() => {
    if (scan) {
      setPendingName(scan.name || scan.ScanName || "Unnamed Scan");
    }
  }, [scan]);

  if (!user) return null;

  const counts = useMemo(() => getCounts(scan), [scan]);
  const risk = useMemo(() => computeRisk(scan), [scan, counts]);

  const formattedDate = useMemo(() => {
    if (!scan?.date) return "";
    try {
      return new Date(scan.date).toLocaleString();
    } catch {
      return scan.date;
    }
  }, [scan]);

  const bannedRecords = Array.isArray(scan?.matchedBanned)
    ? scan.matchedBanned
    : [];
  const ingredientRecords = Array.isArray(scan?.matchedIngredients)
    ? scan.matchedIngredients
    : [];

  /* -------------------------------------------------------------------------------------------------
     Actions
  -------------------------------------------------------------------------------------------------- */

  const handleReanalyze = async () => {
    if (!scan || !scan.id) return;
    setReanalyzing(true);
    setActionError("");

    try {
      const res = await fetch("/api/reanalyzeScan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scanId: scan.id }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Failed to re-analyze scan.");
      }

      const updated = data.scan || data;
      setScan((prev) => ({ ...(prev || {}), ...(updated || {}) }));

      try {
        trackEvent("scan_reanalyzed", {
          eventType: "scan_reanalyzed",
          userEmail: user.Email || user.email || "",
          scanId: scan.id,
        });
      } catch (err) {
        console.error("scan_reanalyzed tracking failed:", err);
      }
    } catch (err) {
      console.error("Re-analyze error:", err);
      setActionError(err.message || "Re-analyze failed. Try again.");
    } finally {
      setReanalyzing(false);
    }
  };

  const handleToggleShare = async () => {
    if (!scan || !scan.id) return;

    const nextEnabled = !shareEnabled;
    setShareSaving(true);
    setActionError("");

    try {
      const payload = {
        scanId: scan.id,
        enable: nextEnabled,
      };

      const res = await fetch("/api/shareScan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Failed to update share settings.");
      }

      const newEnabled = Boolean(
        data.shareEnabled !== undefined ? data.shareEnabled : nextEnabled
      );
      const token =
        data.shareToken || data.token || scan.shareToken || undefined;

      setShareEnabled(newEnabled);
      setScan((prev) =>
        prev
          ? {
              ...prev,
              shareEnabled: newEnabled,
              shareToken: token,
            }
          : prev
      );

      if (newEnabled && token && typeof window !== "undefined") {
        setShareUrl(`${window.location.origin}/share/${token}`);
      } else {
        setShareUrl("");
      }

      try {
        trackEvent("scan_share_toggle", {
          eventType: "scan_share_toggle",
          userEmail: user.Email || user.email || "",
          scanId: scan.id,
          enabled: newEnabled,
        });
      } catch (err) {
        console.error("scan_share_toggle tracking failed:", err);
      }
    } catch (err) {
      console.error("Share toggle error:", err);
      setActionError(err.message || "Failed to update share settings.");
    } finally {
      setShareSaving(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!scan || !scan.id) return;
    setDeleting(true);
    setActionError("");

    try {
      const res = await fetch("/api/deleteScan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scanId: scan.id }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Failed to delete scan.");
      }

      try {
        trackEvent("scan_deleted", {
          eventType: "scan_deleted",
          userEmail: user.Email || user.email || "",
          scanId: scan.id,
        });
      } catch (err) {
        console.error("scan_deleted tracking failed:", err);
      }

      router.push("/scans");
    } catch (err) {
      console.error("Delete error:", err);
      setActionError(err.message || "Failed to delete scan.");
    } finally {
      setDeleting(false);
      setShowDeleteModal(false);
    }
  };

  const startRename = () => {
    setIsRenaming(true);
    setActionError("");
    setPendingName(scan?.name || scan?.ScanName || "Unnamed Scan");
  };

  const cancelRename = () => {
    setIsRenaming(false);
    setPendingName(scan?.name || scan?.ScanName || "Unnamed Scan");
  };

  const handleSaveRename = async () => {
    if (!scan || !scan.id) return;
    const trimmed = String(pendingName || "").trim();
    if (!trimmed) return;

    setRenameSaving(true);
    setActionError("");

    try {
      const res = await fetch("/api/renameScan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scanId: scan.id, newName: trimmed }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Failed to rename scan.");
      }

      const updated = data.scan || data;
      const updatedName =
        updated.name || updated.ScanName || trimmed;

      setScan((prev) =>
        prev ? { ...prev, name: updatedName } : prev
      );
      setPendingName(updatedName);
      setIsRenaming(false);

      try {
        trackEvent("scan_renamed", {
          eventType: "scan_renamed",
          userEmail: user.Email || user.email || "",
          scanId: scan.id,
          newName: updatedName,
        });
      } catch (err) {
        console.error("scan_renamed tracking failed:", err);
      }
    } catch (err) {
      console.error("Rename error:", err);
      setActionError(err.message || "Failed to rename scan.");
    } finally {
      setRenameSaving(false);
    }
  };

  /* -------------------------------------------------------------------------------------------------
     UI
  -------------------------------------------------------------------------------------------------- */

  return (
    <div
      className={`min-h-screen bg-gradient-to-b ${risk.gradient} font-sans`}
    >

      <main className="max-w-6xl mx-auto px-4 sm:px-5 lg:px-6 py-6 sm:py-8 lg:py-10 space-y-6">
        {/* Back link row */}
        <div className="flex items-center justify-between gap-3 mb-1">
          <button
            onClick={() => router.push("/scans")}
            className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 hover:underline"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to My Scans
          </button>
        </div>

        {/* Loading state */}
        {loading && (
          <section className="mt-3 border border-gray-200 bg-white rounded-3xl shadow-sm p-5 sm:p-6 space-y-4">
            <div className="flex flex-col gap-2">
              <div className="h-5 w-40 bg-gray-100 rounded-lg animate-pulse" />
              <div className="h-4 w-64 bg-gray-100 rounded-lg animate-pulse" />
            </div>
            <div className="h-24 w-full bg-gray-100 rounded-2xl animate-pulse" />
          </section>
        )}

        {/* Error state */}
        {!loading && loadingError && (
          <section className="mt-3 border border-red-200 bg-red-50 rounded-3xl shadow-sm p-5 sm:p-6 flex flex-col gap-3">
            <div className="flex items-center gap-2 text-red-700">
              <AlertTriangle className="w-5 h-5" />
              <p className="font-semibold">Something went wrong.</p>
            </div>
            <p className="text-sm text-red-700">{loadingError}</p>
          </section>
        )}

        {/* Not found */}
        {!loading && !loadingError && !scan && (
          <section className="mt-3 border border-gray-200 bg-white rounded-3xl shadow-sm p-5 sm:p-6">
            <p className="text-gray-700 font-medium">
              Scan not found or no longer available.
            </p>
          </section>
        )}

        {/* Main content */}
        {!loading && !loadingError && scan && (
          <>
            {/* HEADER CARD */}
            <section className="border border-gray-200 bg-white rounded-3xl shadow-sm p-5 sm:p-6 lg:p-7 space-y-5">
              <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4 lg:gap-6">
                {/* LEFT: risk & metadata */}
                <div className="flex-1 space-y-3">
                  {/* Risk tag */}
                  <div className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-slate-50 px-3 py-1 text-xs font-semibold">
                    <Shield className={`w-4 h-4 ${risk.iconColor}`} />
                    <span className={risk.badgeClass.replace("border-", "")}>
                      {risk.label}
                    </span>
                  </div>

                  {/* Name / rename */}
                  <div className="flex flex-col gap-2">
                    {isRenaming ? (
                      <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                        <input
                          type="text"
                          value={pendingName}
                          onChange={(e) => setPendingName(e.target.value)}
                          disabled={renameSaving}
                          className="w-full sm:w-80 border border-gray-300 rounded-xl px-3 py-2 text-base sm:text-lg font-semibold text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#46769B] bg-white"
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={handleSaveRename}
                            disabled={renameSaving}
                            className="inline-flex items-center gap-1 px-3 py-2 rounded-xl text-xs sm:text-sm font-semibold bg-[#46769B] text-white hover:bg-[#365b7a] disabled:opacity-60"
                          >
                            <Check className="w-4 h-4" />
                            {renameSaving ? "Saving…" : "Save"}
                          </button>
                          <button
                            onClick={cancelRename}
                            disabled={renameSaving}
                            className="inline-flex items-center gap-1 px-3 py-2 rounded-xl text-xs sm:text-sm font-semibold border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-60"
                          >
                            <X className="w-4 h-4" />
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 flex-wrap">
                        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
                          {scan.name || scan.ScanName || "Unnamed Scan"}
                        </h1>
                        <button
                          onClick={startRename}
                          className="inline-flex items-center gap-1 text-xs sm:text-sm text-gray-500 hover:text-gray-800 hover:bg-gray-100 px-2 py-1 rounded-full"
                        >
                          <Pencil className="w-3 h-3" />
                          Rename
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Meta pills */}
                  <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm text-gray-600">
                    {formattedDate && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-gray-100">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        {formattedDate}
                      </span>
                    )}
                    {scan.userEmail && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-gray-100">
                        👤 {scan.userEmail}
                      </span>
                    )}
                    {scan.source && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-gray-100">
                        🧾 {scan.source}
                      </span>
                    )}
                  </div>
                </div>

                {/* RIGHT: share + actions */}
                <div className="w-full lg:w-auto flex flex-col items-stretch sm:items-end gap-4">
                  {/* Share toggle row */}
                  <div className="flex items-center justify-between sm:justify-end gap-3">
                    <div className="flex flex-col">
                      <div className="flex items-center gap-1 text-sm font-medium text-gray-800">
                        <Share2 className="w-4 h-4 text-gray-500" />
                        <span>Shareable Link</span>
                      </div>
                      <span className="text-xs text-gray-500">
                        Let others view this scan in read-only mode.
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={handleToggleShare}
                      disabled={shareSaving}
                      className={`relative inline-flex h-7 w-14 items-center rounded-full border transition ${
                        shareEnabled
                          ? "bg-emerald-500 border-emerald-500"
                          : "bg-gray-200 border-gray-300"
                      } ${shareSaving ? "opacity-70 cursor-wait" : ""}`}
                      aria-pressed={shareEnabled}
                      aria-label="Toggle shareable link"
                    >
                      <span
                        className={`inline-flex h-5 w-5 transform rounded-full bg-white shadow-sm transition ${
                          shareEnabled ? "translate-x-7" : "translate-x-1"
                        }`}
                      />
                    </button>
                  </div>

                  {/* Share URL */}
                  {shareEnabled && shareUrl && (
                    <div className="flex flex-col items-start sm:items-end gap-1 w-full">
                      <div className="flex items-center gap-2 text-xs text-gray-600">
                        <Link2 className="w-3 h-3" />
                        <span className="font-medium">Share link enabled</span>
                      </div>
                      <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                        <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-700 break-all max-w-full sm:max-w-sm">
                          {shareUrl}
                        </div>
                        <button
                          onClick={() => {
                            if (!shareUrl) return;
                            navigator.clipboard
                              .writeText(shareUrl)
                              .catch(() => {});
                          }}
                          className="px-3 py-2 rounded-xl text-xs font-semibold bg-gray-900 text-white hover:bg-black"
                        >
                          Copy
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Main actions */}
                  <div className="flex flex-wrap gap-2 justify-start sm:justify-end">
                    <button
                      onClick={handleReanalyze}
                      disabled={reanalyzing}
                      className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold border shadow-sm ${
                        reanalyzing
                          ? "bg-gray-100 text-gray-500 border-gray-200 cursor-wait"
                          : "bg-white text-gray-800 border-gray-200 hover:bg-gray-50"
                      }`}
                    >
                      <RefreshCw
                        className={`w-4 h-4 ${
                          reanalyzing ? "animate-spin" : ""
                        }`}
                      />
                      {reanalyzing ? "Re-analyzing…" : "Re-analyze Scan"}
                    </button>

                    <button
                      onClick={() => setShowDeleteModal(true)}
                      className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold border border-red-200 text-red-700 bg-red-50 hover:bg-red-100"
                    >
                      <Trash2 className="w-4 h-4" />
                      Delete Scan
                    </button>
                  </div>
                </div>
              </div>

              {/* Risk tiles row */}
              <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Risk card */}
                <div
                  className={`rounded-2xl border ${risk.ringClass} bg-white px-4 py-3 flex items-center gap-3`}
                >
                  <div className={`p-2 rounded-xl ${risk.badgeClass} border`}>
                    <Shield className={`w-5 h-5 ${risk.iconColor}`} />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">
                      Risk Level
                    </span>
                    <span className="text-sm font-bold text-gray-900">
                      {risk.label}
                    </span>
                    <span className="text-xs text-gray-600">
                      {risk.detail}
                    </span>
                  </div>
                </div>

                {/* Prohibited */}
                <div className="rounded-2xl border border-gray-200 bg-slate-50 px-4 py-3 flex items-center justify-between">
                  <div className="flex flex-col">
                    <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">
                      Prohibited
                    </span>
                    <span className="text-2xl font-bold text-gray-900">
                      {counts.prohibitedCount || 0}
                    </span>
                  </div>
                  <div className="h-8 w-8 rounded-full bg-red-100 flex items-center justify-center">
                    <span className="text-xs font-semibold text-red-700">
                      🚫
                    </span>
                  </div>
                </div>

                {/* Other flags */}
                <div className="rounded-2xl border border-gray-200 bg-slate-50 px-4 py-3 flex items-center justify-between">
                  <div className="flex flex-col">
                    <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">
                      Other Flags
                    </span>
                    <span className="text-2xl font-bold text-gray-900">
                      {counts.otherCount || 0}
                    </span>
                    <span className="text-[11px] text-gray-600">
                      Includes other banned + all matched ingredients
                    </span>
                  </div>
                  <div className="h-8 w-8 rounded-full bg-purple-100 flex items-center justify-center">
                    <span className="text-xs font-semibold text-purple-700">
                      ⚠️
                    </span>
                  </div>
                </div>
              </div>

              {actionError && (
                <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <p>{actionError}</p>
                </div>
              )}
            </section>

            {/* MAIN GRID */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mt-5">
              {/* LEFT: banned + ingredients */}
              <div className="lg:col-span-2 space-y-5">
                {/* Banned table */}
                <section className="border border-gray-200 bg-white rounded-3xl shadow-sm p-5 sm:p-6 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <div>
                      <h2 className="text-lg font-semibold text-gray-900">
                        Banned Substances
                      </h2>
                      <p className="text-xs text-gray-600">
                        Matched against your banned-substances Airtable base.
                      </p>
                    </div>
                    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs bg-gray-100 text-gray-700">
                      {bannedRecords.length} match
                      {bannedRecords.length === 1 ? "" : "es"}
                    </span>
                  </div>

                  {bannedRecords.length === 0 ? (
                    <p className="text-sm text-gray-500 italic mt-1">
                      No banned substances matched for this scan.
                    </p>
                  ) : (
                    <div className="mt-3 overflow-x-auto rounded-2xl border border-gray-200">
                      <table className="min-w-full text-xs sm:text-sm">
                        <thead className="bg-slate-900 text-white">
                          <tr>
                            {[
                              "Substance",
                              "Ban Type",
                              "Banned By",
                              "Notes",
                              "Matched Terms",
                            ].map((h) => (
                              <th
                                key={h}
                                className="px-3 sm:px-4 py-2 text-left font-semibold whitespace-nowrap"
                              >
                                {h}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {bannedRecords.map((b) => (
                            <tr
                              key={b.id}
                              className="border-t border-gray-100 hover:bg-slate-50"
                            >
                              <td className="px-3 sm:px-4 py-2 align-top">
                                <div className="font-semibold text-gray-900">
                                  {b.fields?.["Substance Name"] ||
                                    b.fields?.Name ||
                                    "Unknown"}
                                </div>
                                {b.fields?.Synonyms && (
                                  <div className="text-xs text-gray-500 mt-0.5">
                                    {String(b.fields.Synonyms).slice(0, 120)}
                                    {String(b.fields.Synonyms).length > 120
                                      ? "…"
                                      : ""}
                                  </div>
                                )}
                              </td>
                              <td className="px-3 sm:px-4 py-2 align-top">
                                <span className="inline-flex items-center px-2 py-1 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-800">
                                  {b.fields?.["Ban Type"] || "—"}
                                </span>
                              </td>
                              <td className="px-3 sm:px-4 py-2 align-top text-xs text-gray-700">
                                {b.fields?.["Banned By"] || "—"}
                              </td>
                              <td className="px-3 sm:px-4 py-2 align-top text-xs text-gray-700">
                                {b.fields?.Notes
                                  ? String(b.fields.Notes).slice(0, 160) +
                                    (String(b.fields.Notes).length > 160
                                      ? "…"
                                      : "")
                                  : "—"}
                              </td>
                              <td className="px-3 sm:px-4 py-2 align-top text-xs text-gray-700">
                                {Array.isArray(b.matchedTerms) &&
                                b.matchedTerms.length
                                  ? b.matchedTerms.join(", ")
                                  : "—"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </section>

                {/* Ingredients table */}
                <section className="border border-gray-200 bg-white rounded-3xl shadow-sm p-5 sm:p-6 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <div>
                      <h2 className="text-lg font-semibold text-gray-900">
                        Matched Ingredients
                      </h2>
                      <p className="text-xs text-gray-600">
                        Pulled from your primary ingredient / SmartStack
                        database.
                      </p>
                    </div>
                    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs bg-purple-50 text-purple-700 border border-purple-100">
                      {ingredientRecords.length} ingredient
                      {ingredientRecords.length === 1 ? "" : "s"}
                    </span>
                  </div>

                  {ingredientRecords.length === 0 ? (
                    <p className="text-sm text-gray-500 italic mt-1">
                      No ingredients from your database matched for this scan
                      yet.
                    </p>
                  ) : (
                    <div className="mt-3 overflow-x-auto rounded-2xl border border-gray-200">
                      <table className="min-w-full text-xs sm:text-sm">
                        <thead className="bg-slate-800 text-white">
                          <tr>
                            {[
                              "Ingredient",
                              "Benefits",
                              "Weaknesses",
                              "Antagonisms",
                              "Matched Terms",
                            ].map((h) => (
                              <th
                                key={h}
                                className="px-3 sm:px-4 py-2 text-left font-semibold whitespace-nowrap"
                              >
                                {h}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {ingredientRecords.map((ing) => (
                            <tr
                              key={ing.id}
                              className="border-t border-gray-100 hover:bg-slate-50"
                            >
                              <td className="px-3 sm:px-4 py-2 align-top">
                                <div className="font-semibold text-gray-900">
                                  {ing.fields?.["Name"] ||
                                    ing.fields?.["Ingredient Name"] ||
                                    "Unknown"}
                                </div>
                                {ing.fields?.["Synonyms (Extended)"] && (
                                  <div className="text-xs text-gray-500 mt-0.5">
                                    {String(
                                      ing.fields["Synonyms (Extended)"]
                                    ).slice(0, 120)}
                                    {String(
                                      ing.fields["Synonyms (Extended)"]
                                    ).length > 120
                                      ? "…"
                                      : ""}
                                  </div>
                                )}
                              </td>
                              <td className="px-3 sm:px-4 py-2 align-top text-xs text-gray-700">
                                {ing.fields?.Benefits
                                  ? String(ing.fields.Benefits).slice(0, 160) +
                                    (String(ing.fields.Benefits).length > 160
                                      ? "…"
                                      : "")
                                  : "—"}
                              </td>
                              <td className="px-3 sm:px-4 py-2 align-top text-xs text-gray-700">
                                {ing.fields?.Weaknesses
                                  ? String(ing.fields.Weaknesses).slice(0, 160) +
                                    (String(ing.fields.Weaknesses).length > 160
                                      ? "…"
                                      : "")
                                  : "—"}
                              </td>
                              <td className="px-3 sm:px-4 py-2 align-top text-xs text-gray-700">
                                {ing.fields?.["Nutrient Antagonism"]
                                  ? String(
                                      ing.fields["Nutrient Antagonism"]
                                    ).slice(0, 160) +
                                    (String(
                                      ing.fields["Nutrient Antagonism"]
                                    ).length > 160
                                      ? "…"
                                      : "")
                                  : "—"}
                              </td>
                              <td className="px-3 sm:px-4 py-2 align-top text-xs text-gray-700">
                                {Array.isArray(ing.matchedTerms) &&
                                ing.matchedTerms.length
                                  ? ing.matchedTerms.join(", ")
                                  : "—"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </section>
              </div>

              {/* RIGHT: raw text + summary */}
              <div className="space-y-5">
                {/* Raw ingredients */}
                <section className="border border-gray-200 bg-white rounded-3xl shadow-sm p-5 sm:p-6 space-y-3">
                  <h2 className="text-sm font-semibold text-gray-900">
                    Raw Ingredients Text
                  </h2>
                  <p className="text-xs text-gray-600">
                    This is the label or ingredient text used to match against
                    your banned and ingredient databases.
                  </p>

                  <div className="mt-2">
                    {scan.stackDetails || scan.ingredientsText ? (
                      <pre className="max-h-72 overflow-y-auto bg-gray-50 border border-gray-200 rounded-2xl p-3 text-xs text-gray-800 whitespace-pre-wrap">
                        {scan.stackDetails || scan.ingredientsText}
                      </pre>
                    ) : (
                      <p className="text-xs text-gray-500 italic">
                        No raw ingredient text was stored with this scan.
                      </p>
                    )}
                  </div>
                </section>

                {/* Summary */}
                {scan.resultsSummary && (
                  <section className="border border-gray-200 bg-white rounded-3xl shadow-sm p-5 sm:p-6 space-y-2">
                    <h2 className="text-sm font-semibold text-gray-900">
                      Results Summary
                    </h2>
                    <p className="text-xs text-gray-600">
                      Compact overview of this scan’s banned-substance result.
                    </p>
                    <div className="mt-2 px-3 py-2 bg-slate-50 border border-slate-100 rounded-2xl text-xs text-gray-800">
                      {scan.resultsSummary}
                    </div>
                  </section>
                )}
              </div>
            </div>
          </>
        )}
      </main>

      {/* Delete confirmation modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-full bg-red-50 border border-red-100">
                  <Trash2 className="w-5 h-5 text-red-600" />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-gray-900">
                    Delete this scan?
                  </h2>
                  <p className="text-xs text-gray-600">
                    This will permanently remove this scan from your account,
                    including all matches and history.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowDeleteModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {actionError && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <p>{actionError}</p>
              </div>
            )}

            <div className="flex flex-col sm:flex-row sm:justify-end gap-2 pt-2">
              <button
                onClick={() => setShowDeleteModal(false)}
                disabled={deleting}
                className="px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold border border-gray-200 bg-white text-gray-800 hover:bg-gray-50 disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                disabled={deleting}
                className="px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold bg-red-600 text-white hover:bg-red-700 disabled:opacity-70 flex items-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                {deleting ? "Deleting…" : "Delete Scan"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
