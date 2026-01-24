// pages/org/review-queue.js
"use client";

import { useEffect, useMemo, useState, useCallback, Fragment } from "react";
import { useRouter } from "next/navigation";
import { useAuthContext } from "@/hooks/useAuth";
import {
  RefreshCcw,
  LogOut,
  Search,
  Filter,
  ClipboardList,
  AlertTriangle,
  CheckCircle2,
  X,
  ArrowRight,
  ShieldCheck,
  Sparkles,
  ChevronRight,
  ChevronDown,
  User,
  FileText,
  HelpCircle,
  ThumbsUp,
  Image as ImageIcon,
} from "lucide-react";

/**
 * Review Queue (DailyWorkouts-backed)
 * ✅ Uses cookie session (credentials: include)
 * ✅ Matches /org/dashboard styling
 *
 * ✅ Correct endpoints (the ones you actually have wired today):
 *   GET  /api/org/reviewQueue/list
 *   POST /api/org/reviewQueue/updateStatus
 *
 * Expected API shape (flexible; we normalize):
 * {
 *   items: [{
 *     id,
 *     title,
 *     date,
 *     status,             // DailyWorkouts Status: assigned/completed/draft
 *     reviewStatus,       // ReviewStatus: pending/needs_info/approved
 *     attachmentSummary,
 *     attachments: [{ url, filename, thumbnails? }],
 *     athleteName, athleteEmail,
 *     createdAt,
 *     coachNotes?
 *   }]
 * }
 */

async function safeJson(res) {
  try {
    return await res.json();
  } catch {
    return {};
  }
}

function classNames(...xs) {
  return xs.filter(Boolean).join(" ");
}

function safeDate(value) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function fmtDate(value) {
  const d = safeDate(value);
  if (!d) return value ? String(value) : "";
  return d.toLocaleString();
}

function normalizeText(v) {
  return String(v ?? "").trim();
}

function Pill({ children, tone = "neutral" }) {
  const toneCls =
    tone === "warn"
      ? "bg-amber-50 text-amber-800 border-amber-200"
      : tone === "bad"
      ? "bg-red-50 text-red-800 border-red-200"
      : tone === "good"
      ? "bg-emerald-50 text-emerald-800 border-emerald-200"
      : "bg-gray-100 text-gray-700 border-gray-200";

  return (
    <span
      className={classNames(
        "inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold border",
        toneCls
      )}
    >
      {children}
    </span>
  );
}

function Button({
  children,
  onClick,
  variant = "primary",
  disabled = false,
  className = "",
  title = "",
  type = "button",
}) {
  const base =
    "inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition";
  const styles =
    variant === "primary"
      ? "bg-[#46769B] text-white hover:brightness-110"
      : variant === "dark"
      ? "bg-gray-900 text-white hover:opacity-90"
      : "bg-white text-gray-800 border border-gray-200 hover:bg-gray-50";

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={classNames(
        base,
        styles,
        disabled ? "opacity-70 cursor-not-allowed" : "",
        className
      )}
      type={type}
    >
      {children}
    </button>
  );
}

function Modal({ open, title, children, onClose }) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[9999]">
      <div
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
        role="button"
        tabIndex={0}
      />
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div className="w-full max-w-3xl bg-white rounded-2xl shadow-xl border border-gray-200">
          <div className="p-5 border-b flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-lg font-extrabold text-gray-900 truncate">{title}</p>
              <p className="text-[12px] text-gray-500 mt-1">
                Review uploads and confirm today’s workout.
              </p>
            </div>
            <button
              className="p-2 rounded-xl border border-gray-200 hover:bg-gray-50"
              onClick={onClose}
              type="button"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="p-5">{children}</div>
        </div>
      </div>
    </div>
  );
}

function reviewTone(reviewStatus) {
  const s = String(reviewStatus || "").toLowerCase();
  if (s === "pending") return "warn";
  if (s === "needs_info") return "warn";
  if (s === "approved") return "good";
  return "neutral";
}

function dailyWorkoutTone(status) {
  const s = String(status || "").toLowerCase();
  if (s === "completed") return "good";
  if (s === "assigned") return "warn";
  if (s === "draft") return "neutral";
  return "neutral";
}

function extractAttachmentUrl(att) {
  if (!att) return "";
  if (att?.thumbnails?.large?.url) return att.thumbnails.large.url;
  if (att?.thumbnails?.full?.url) return att.thumbnails.full.url;
  if (att?.url) return att.url;
  return "";
}

/**
 * Normalize any backend item into the UI shape we expect.
 * This lets you evolve the API without breaking the page.
 */
function normalizeQueueItem(raw = {}) {
  const id = normalizeText(raw?.id || raw?.recordId || raw?._id);

  const title =
    normalizeText(raw?.title || raw?.Title || raw?.name || raw?.Name) || "Daily Workout";

  const date = normalizeText(raw?.date || raw?.Date);

  const status = normalizeText(raw?.status || raw?.Status); // assigned/completed/draft

  // reviewStatus might come as reviewStatus or ReviewStatus
  const reviewStatus =
    normalizeText(raw?.reviewStatus || raw?.ReviewStatus || raw?.review_state) || "pending";

  const attachmentSummary = normalizeText(
    raw?.attachmentSummary || raw?.["Attachment Summary"] || raw?.AttachmentSummary
  );

  const attachments = Array.isArray(raw?.attachments)
    ? raw.attachments
    : Array.isArray(raw?.Attachments)
    ? raw.Attachments
    : [];

  const athleteName = normalizeText(raw?.athleteName || raw?.AthleteName || raw?.Athlete);
  const athleteEmail = normalizeText(raw?.athleteEmail || raw?.AthleteEmail || raw?.Email);

  const createdAt = raw?.createdAt || raw?.CreatedAt || raw?.createdTime || raw?.CreatedTime || "";

  const coachNotes = normalizeText(raw?.coachNotes || raw?.CoachNotes || raw?.notes || raw?.Notes);

  return {
    id,
    title,
    date,
    status,
    reviewStatus,
    attachmentSummary,
    attachments,
    athleteName,
    athleteEmail,
    createdAt,
    coachNotes,
    // keep original just in case you want it later
    _raw: raw,
  };
}

export default function ReviewQueuePage() {
  const router = useRouter();
  const { user, logout } = useAuthContext();

  const role = useMemo(() => {
    const r = String(user?.role || user?.Role || "").trim().toLowerCase();
    if (!r) return "";
    if (r === "organization") return "organization";
    if (r === "admin") return "admin";
    if (r === "trainer") return "trainer";
    if (r.includes("org")) return "organization";
    if (r.includes("admin")) return "admin";
    if (r.includes("train")) return "trainer";
    if (r.includes("ath")) return "athlete";
    return r;
  }, [user]);

  const isOrgSide = role === "organization" || role === "admin" || role === "trainer";

  const orgName = useMemo(() => {
    const guess =
      user?.OrgName ||
      user?.["Organization Name"] ||
      user?.OrganizationName ||
      user?.organizationName ||
      user?.Organization ||
      (role === "organization" ? (user?.Name || user?.name) : "") ||
      "Organization";
    return String(guess || "Organization");
  }, [user, role]);

  const orgEmail = useMemo(() => String(user?.Email || user?.email || ""), [user]);

  const orgToken = useMemo(() => {
    return String(user?.Token || user?.token || user?.["Organization Token"] || "").trim();
  }, [user]);

  const orgId = useMemo(() => {
    return String(user?.orgId || user?.OrgId || "").trim();
  }, [user]);

  // Guards
  useEffect(() => {
    if (!user) {
      router.push("/");
      return;
    }
    if (role && !isOrgSide) {
      router.push("/dashboard");
      return;
    }
  }, [user, role, isOrgSide, router]);

  // Data
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [items, setItems] = useState([]);

  // UI
  const [search, setSearch] = useState("");
  const [filterMode, setFilterMode] = useState("pending"); // pending | needs_info | approved | all
  const [sortMode, setSortMode] = useState("newest"); // newest | oldest
  const [expanded, setExpanded] = useState({});

  // Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [active, setActive] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveErr, setSaveErr] = useState("");
  const [lightboxUrl, setLightboxUrl] = useState("");

  const toggleExpanded = (id) => {
    const key = String(id || "").trim();
    if (!key) return;
    setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const openModal = (item) => {
    setSaveErr("");
    setActive(item);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setActive(null);
    setSaveErr("");
    setSaving(false);
    setLightboxUrl("");
  };

  const refreshQueue = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      // ✅ Correct endpoint
      const res = await fetch("/api/org/reviewQueue/getReviewQueue", {
        method: "GET",
        credentials: "include",
      });

      const data = await safeJson(res);
      if (!res.ok) throw new Error(data?.error || "Failed to load review queue");

      const rawItems = Array.isArray(data?.items) ? data.items : [];
      setItems(rawItems.map(normalizeQueueItem));
    } catch (err) {
      console.error("[org/review-queue] refreshQueue error:", err);
      setError(err?.message || "Failed to load review queue.");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    if (!isOrgSide) return;
    refreshQueue();
  }, [user, isOrgSide, refreshQueue]);

  const counts = useMemo(() => {
    const list = Array.isArray(items) ? items : [];
    const pending = list.filter((x) => String(x?.reviewStatus || "").toLowerCase() === "pending")
      .length;
    const needsInfo = list.filter(
      (x) => String(x?.reviewStatus || "").toLowerCase() === "needs_info"
    ).length;
    const approved = list.filter(
      (x) => String(x?.reviewStatus || "").toLowerCase() === "approved"
    ).length;
    return { pending, needsInfo, approved, total: list.length };
  }, [items]);

  const headline = useMemo(() => {
    if (!counts.total) return "No items in queue.";
    if (counts.pending > 0) return `Start here: ${counts.pending} item(s) pending review`;
    if (counts.needsInfo > 0) return `Follow up: ${counts.needsInfo} item(s) need info`;
    return "Queue is clear — keep it up.";
  }, [counts]);

  const filtered = useMemo(() => {
    const q = String(search || "").trim().toLowerCase();
    let list = Array.isArray(items) ? [...items] : [];

    if (q) {
      list = list.filter((it) => {
        const hay = [
          it?.title,
          it?.date,
          it?.status,
          it?.reviewStatus,
          it?.attachmentSummary,
          it?.athleteName,
          it?.athleteEmail,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return hay.includes(q);
      });
    }

    const st = String(filterMode || "pending").toLowerCase();
    if (st !== "all") {
      list = list.filter((it) => String(it?.reviewStatus || "").toLowerCase() === st);
    }

    const byCreated = (a, b) => {
      const at = safeDate(a?.createdAt)?.getTime?.() || 0;
      const bt = safeDate(b?.createdAt)?.getTime?.() || 0;
      return sortMode === "oldest" ? at - bt : bt - at;
    };

    list.sort(byCreated);
    return list;
  }, [items, search, filterMode, sortMode]);

  const onLogout = async () => {
    try {
      await logout?.();
    } finally {
      router.push("/");
    }
  };

  const updateReviewStatus = async (id, reviewStatus, coachNotes = "") => {
    const rid = String(id || "").trim();
    if (!rid) return;

    setSaveErr("");
    setSaving(true);

    try {
      // ✅ Correct endpoint
      const res = await fetch("/api/org/reviewQueue/reviewQueueUpdate", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        // ✅ Body mapping: endpoint expects "status" (not "reviewStatus")
        body: JSON.stringify({ id: rid, status: reviewStatus, coachNotes }),
      });

      const data = await safeJson(res);
      if (!res.ok) throw new Error(data?.error || "Failed to update review");

      // update in place
      setItems((prev) => {
        const list = Array.isArray(prev) ? [...prev] : [];
        const idx = list.findIndex((x) => String(x?.id) === rid);
        if (idx >= 0) list[idx] = { ...list[idx], reviewStatus };
        return list;
      });

      // keep modal item in sync
      setActive((prev) =>
        prev && String(prev?.id) === rid ? { ...prev, reviewStatus } : prev
      );

      closeModal();
    } catch (err) {
      setSaveErr(err?.message || "Failed to update.");
    } finally {
      setSaving(false);
    }
  };

  const inputBase =
    "w-full px-4 py-3 rounded-xl border border-gray-300 bg-white text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#46769B]";

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-blue-50 text-gray-900 font-sans">
      <main className="max-w-7xl mx-auto px-4 py-8 space-y-6">
        {/* Header */}
        <div className="bg-white rounded-2xl shadow-md border border-blue-100 p-6">
          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <ClipboardList className="w-6 h-6 text-[#46769B]" />
                <h1 className="text-2xl font-extrabold truncate">Review Queue</h1>
              </div>
              <p className="text-sm text-gray-600 mt-1">
                {orgName} • Logged in as <span className="font-semibold">{orgEmail}</span>
              </p>

              <div className="mt-3 flex flex-wrap gap-2">
                <Pill tone="good">
                  <ShieldCheck className="w-3.5 h-3.5 mr-1.5" />
                  Org Session Active
                </Pill>

                {orgToken ? (
                  <Pill tone="good">
                    <Sparkles className="w-3.5 h-3.5 mr-1.5" />
                    Token Loaded
                  </Pill>
                ) : (
                  <Pill tone="bad">
                    <AlertTriangle className="w-3.5 h-3.5 mr-1.5" />
                    Missing Token
                  </Pill>
                )}

                {orgId ? (
                  <Pill tone="good">
                    <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
                    orgId Loaded
                  </Pill>
                ) : (
                  <Pill tone="warn">
                    <AlertTriangle className="w-3.5 h-3.5 mr-1.5" />
                    orgId missing (legacy session)
                  </Pill>
                )}

                <Pill>
                  <ClipboardList className="w-3.5 h-3.5 mr-1.5" />
                  {headline}
                </Pill>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" onClick={() => router.push("/org/dashboard")}>
                <ArrowRight className="w-4 h-4 rotate-180" />
                Back
              </Button>
              <Button variant="secondary" onClick={refreshQueue} disabled={loading}>
                <RefreshCcw className="w-4 h-4" />
                Refresh
              </Button>
              <Button variant="dark" onClick={onLogout}>
                <LogOut className="w-4 h-4" />
                Log out
              </Button>
            </div>
          </div>

          {loading ? (
            <div className="mt-5 rounded-2xl border border-blue-100 bg-blue-50 p-4">
              <p className="text-sm text-gray-800 font-semibold">Loading review queue…</p>
              <p className="text-[11px] text-gray-600 mt-1">
                Pulling completed daily workouts that include uploads.
              </p>
            </div>
          ) : null}

          {error ? (
            <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4">
              <p className="text-sm text-red-700 font-semibold">{error}</p>
              <p className="text-[11px] text-red-600 mt-1">
                If this persists, log out and back in to refresh your session cookie.
              </p>
            </div>
          ) : null}
        </div>

        {/* Quick stats */}
        <div className="grid md:grid-cols-3 gap-4">
          <div className="bg-white rounded-2xl shadow-md border border-blue-100 p-5">
            <p className="text-xs text-gray-500">Pending</p>
            <p className="text-2xl font-extrabold text-gray-900 mt-1">{counts.pending}</p>
          </div>
          <div className="bg-white rounded-2xl shadow-md border border-blue-100 p-5">
            <p className="text-xs text-gray-500">Needs Info</p>
            <p className="text-2xl font-extrabold text-gray-900 mt-1">{counts.needsInfo}</p>
          </div>
          <div className="bg-white rounded-2xl shadow-md border border-blue-100 p-5">
            <p className="text-xs text-gray-500">Approved</p>
            <p className="text-2xl font-extrabold text-gray-900 mt-1">{counts.approved}</p>
          </div>
        </div>

        {/* Queue + Controls */}
        <div className="grid lg:grid-cols-12 gap-6">
          {/* Left: Queue */}
          <section className="lg:col-span-8 bg-white rounded-2xl shadow-md border border-blue-100 p-6">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
              <div>
                <h2 className="text-lg font-extrabold">Queue</h2>
                <p className="text-sm text-gray-600 mt-1">
                  Review uploads and confirm the athlete’s daily workout.
                </p>

                <div className="mt-3 flex flex-wrap gap-2">
                  <Pill tone="warn">
                    <AlertTriangle className="w-3.5 h-3.5 mr-1.5" />
                    Pending: {counts.pending}
                  </Pill>
                  <Pill tone="warn">
                    <HelpCircle className="w-3.5 h-3.5 mr-1.5" />
                    Needs info: {counts.needsInfo}
                  </Pill>
                  <Pill tone="good">
                    <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
                    Approved: {counts.approved}
                  </Pill>
                </div>
              </div>

              <div className="w-full sm:w-[460px] space-y-2">
                <div className="relative">
                  <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    className={classNames(inputBase, "pl-10")}
                    placeholder="Search by title, date, athlete, summary…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button
                    variant={filterMode === "pending" ? "primary" : "secondary"}
                    className="px-3 py-2 text-xs"
                    onClick={() => setFilterMode("pending")}
                  >
                    <Filter className="w-4 h-4" />
                    Pending
                  </Button>
                  <Button
                    variant={filterMode === "needs_info" ? "primary" : "secondary"}
                    className="px-3 py-2 text-xs"
                    onClick={() => setFilterMode("needs_info")}
                  >
                    Needs Info
                  </Button>
                  <Button
                    variant={filterMode === "approved" ? "primary" : "secondary"}
                    className="px-3 py-2 text-xs"
                    onClick={() => setFilterMode("approved")}
                  >
                    Approved
                  </Button>
                  <Button
                    variant={filterMode === "all" ? "primary" : "secondary"}
                    className="px-3 py-2 text-xs"
                    onClick={() => setFilterMode("all")}
                  >
                    All
                  </Button>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button
                    variant={sortMode === "newest" ? "primary" : "secondary"}
                    className="px-3 py-2 text-xs"
                    onClick={() => setSortMode("newest")}
                  >
                    Newest
                  </Button>
                  <Button
                    variant={sortMode === "oldest" ? "primary" : "secondary"}
                    className="px-3 py-2 text-xs"
                    onClick={() => setSortMode("oldest")}
                  >
                    Oldest
                  </Button>
                </div>
              </div>
            </div>

            <div className="mt-5 overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-gray-500 border-b">
                    <th className="py-3 pr-4">Item</th>
                    <th className="py-3 pr-4">Date</th>
                    <th className="py-3 pr-4">Daily Status</th>
                    <th className="py-3 pr-4">Review</th>
                    <th className="py-3 pr-4">Created</th>
                    <th className="py-3 pr-2 text-right">Actions</th>
                  </tr>
                </thead>

                <tbody>
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-6 text-center text-gray-500">
                        No items found.
                        <div className="text-[11px] text-gray-400 mt-1">
                          This queue is powered by DailyWorkouts with uploads + completed status.
                        </div>
                      </td>
                    </tr>
                  )}

                  {filtered.map((it) => {
                    const id = String(it?.id || "");
                    const isExpanded = !!expanded[id];

                    const title = normalizeText(it?.title) || "Daily Workout";
                    const date = normalizeText(it?.date);
                    const dwStatus = normalizeText(it?.status);
                    const rev = normalizeText(it?.reviewStatus) || "pending";

                    return (
                      <Fragment key={id}>
                        <tr className="border-b">
                          <td className="py-3 pr-4">
                            <button
                              type="button"
                              onClick={() => toggleExpanded(id)}
                              className="text-left w-full"
                              title="Expand"
                            >
                              <div className="flex items-center gap-2">
                                {isExpanded ? (
                                  <ChevronDown className="w-4 h-4 text-gray-400" />
                                ) : (
                                  <ChevronRight className="w-4 h-4 text-gray-400" />
                                )}
                                <div className="min-w-0">
                                  <div className="font-semibold text-gray-900 truncate">{title}</div>
                                  <div className="text-[11px] text-gray-500 mt-0.5 truncate">
                                    {it?.attachmentSummary || "Uploads attached"}
                                  </div>
                                </div>
                              </div>
                            </button>
                          </td>

                          <td className="py-3 pr-4">
                            <div className="text-gray-700 font-medium">{date || "—"}</div>
                          </td>

                          <td className="py-3 pr-4">
                            <Pill tone={dailyWorkoutTone(dwStatus)}>{dwStatus || "—"}</Pill>
                          </td>

                          <td className="py-3 pr-4">
                            <Pill tone={reviewTone(rev)}>{rev.replaceAll("_", " ")}</Pill>
                          </td>

                          <td className="py-3 pr-4">
                            <div className="text-gray-700 font-medium">
                              {it?.createdAt ? fmtDate(it.createdAt) : "—"}
                            </div>
                          </td>

                          <td className="py-3 pr-2">
                            <div className="flex justify-end gap-2">
                              <Button
                                variant="secondary"
                                className="px-3 py-2 text-xs"
                                onClick={() => openModal(it)}
                                disabled={!id}
                              >
                                Review
                                <ArrowRight className="w-4 h-4" />
                              </Button>
                            </div>
                          </td>
                        </tr>

                        {isExpanded ? (
                          <tr className="border-b bg-gray-50">
                            <td colSpan={6} className="py-4 px-4">
                              <div className="grid md:grid-cols-3 gap-4">
                                <div className="rounded-2xl border border-gray-200 bg-white p-4">
                                  <p className="text-xs text-gray-500 flex items-center gap-2">
                                    <FileText className="w-4 h-4 text-gray-400" />
                                    Summary
                                  </p>
                                  <p className="text-sm font-extrabold text-gray-900 mt-1">{title}</p>
                                  <p className="text-[11px] text-gray-500 mt-2">
                                    {it?.attachmentSummary || "—"}
                                  </p>
                                </div>

                                <div className="rounded-2xl border border-gray-200 bg-white p-4">
                                  <p className="text-xs text-gray-500 flex items-center gap-2">
                                    <ClipboardList className="w-4 h-4 text-gray-400" />
                                    Linked items
                                  </p>
                                  <p className="text-[12px] text-gray-700 mt-2">
                                    Attachments:{" "}
                                    <span className="font-semibold">
                                      {Array.isArray(it?.attachments) ? it.attachments.length : 0}
                                    </span>
                                  </p>
                                </div>

                                <div className="rounded-2xl border border-gray-200 bg-white p-4">
                                  <p className="text-xs text-gray-500 flex items-center gap-2">
                                    <User className="w-4 h-4 text-gray-400" />
                                    Athlete
                                  </p>
                                  <p className="text-sm font-extrabold text-gray-900 mt-1">
                                    {it?.athleteName || "Athlete"}
                                  </p>
                                  <p className="text-[12px] text-gray-600 mt-1 truncate">
                                    {it?.athleteEmail || "—"}
                                  </p>
                                </div>
                              </div>
                            </td>
                          </tr>
                        ) : null}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          {/* Right: guidance */}
          <section className="lg:col-span-4 bg-white rounded-2xl shadow-md border border-blue-100 p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-extrabold">Workflow</h2>
                <p className="text-sm text-gray-600 mt-1">Process uploads fast.</p>
              </div>
              <Button
                variant="secondary"
                className="px-3 py-2 text-xs"
                onClick={refreshQueue}
                disabled={loading}
              >
                <RefreshCcw className="w-4 h-4" />
                Refresh
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
                <p className="text-sm font-extrabold text-gray-900">Skimmer-style behavior</p>
                <p className="text-[12px] text-gray-600 mt-1">
                  On mobile, athletes can “swipe → camera → confirm” to complete the daily workout
                  with proof.
                </p>
              </div>

              <div className="rounded-2xl border border-gray-200 p-4">
                <p className="text-sm font-extrabold text-gray-900">Notes</p>
                <p className="text-[12px] text-gray-600 mt-1">
                  Review is optional unless required by org policy. Use “Needs info” to guide better
                  uploads next time.
                </p>
              </div>
            </div>
          </section>
        </div>

        {/* Review Modal */}
        <Modal
          open={modalOpen}
          title={active ? `Review: ${active?.title || "Daily Workout"}` : "Review"}
          onClose={closeModal}
        >
          {saveErr ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-3 mb-4">
              <p className="text-sm text-red-700 font-semibold">{saveErr}</p>
            </div>
          ) : null}

          {active ? (
            <div className="space-y-4">
              <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                <p className="text-xs text-gray-500">Daily Workout</p>
                <p className="text-sm font-extrabold text-gray-900 mt-1">
                  {active?.title || "Daily Workout"}
                </p>
                <p className="text-[12px] text-gray-700 mt-1">
                  Date: <span className="font-semibold">{active?.date || "—"}</span>
                </p>

                <div className="mt-3 flex flex-wrap gap-2">
                  <Pill tone={dailyWorkoutTone(active?.status)}>{active?.status || "—"}</Pill>
                  <Pill tone={reviewTone(active?.reviewStatus)}>
                    Review: {String(active?.reviewStatus || "pending").replaceAll("_", " ")}
                  </Pill>
                  {active?.createdAt ? <Pill>Created: {fmtDate(active.createdAt)}</Pill> : null}
                </div>

                {(active?.athleteName || active?.athleteEmail) && (
                  <div className="mt-3 text-[12px] text-gray-700">
                    Athlete:{" "}
                    <span className="font-semibold">
                      {active?.athleteName || "Athlete"}
                    </span>{" "}
                    <span className="text-gray-500">{active?.athleteEmail || ""}</span>
                  </div>
                )}
              </div>

              {/* Attachments */}
              <div className="rounded-2xl border border-gray-200 p-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-extrabold text-gray-900 flex items-center gap-2">
                    <ImageIcon className="w-4 h-4 text-gray-500" />
                    Uploads
                  </p>
                  <Pill>{Array.isArray(active?.attachments) ? active.attachments.length : 0}</Pill>
                </div>

                {active?.attachmentSummary ? (
                  <p className="text-[12px] text-gray-600 mt-2">{active.attachmentSummary}</p>
                ) : null}

                <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {(Array.isArray(active?.attachments) ? active.attachments : []).map((att, i) => {
                    const url = extractAttachmentUrl(att);
                    const name = att?.filename || `Upload ${i + 1}`;
                    if (!url) {
                      return (
                        <div
                          key={`${i}-${name}`}
                          className="rounded-2xl border border-gray-200 bg-gray-50 p-3 text-[11px] text-gray-500"
                        >
                          {name}
                        </div>
                      );
                    }
                    return (
                      <button
                        key={`${i}-${name}`}
                        type="button"
                        className="group rounded-2xl overflow-hidden border border-gray-200 bg-white"
                        onClick={() => setLightboxUrl(url)}
                        title="Open"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={url}
                          alt={name}
                          className="w-full h-32 object-cover group-hover:opacity-95"
                          loading="lazy"
                        />
                        <div className="p-2 text-[11px] text-gray-600 truncate">{name}</div>
                      </button>
                    );
                  })}
                </div>

                {!Array.isArray(active?.attachments) || active.attachments.length === 0 ? (
                  <div className="mt-3 rounded-2xl border border-gray-200 bg-gray-50 p-3 text-[12px] text-gray-600">
                    No attachments found on this record.
                  </div>
                ) : null}
              </div>

              <div className="flex flex-wrap gap-2 justify-end">
                <Button
                  variant="secondary"
                  onClick={() => updateReviewStatus(active?.id, "needs_info")}
                  disabled={saving || !active?.id}
                  className="px-3 py-2 text-xs"
                >
                  <HelpCircle className="w-4 h-4" />
                  Needs Info
                </Button>

                <Button
                  onClick={() => updateReviewStatus(active?.id, "approved")}
                  disabled={saving || !active?.id}
                  className="px-3 py-2 text-xs"
                >
                  <ThumbsUp className="w-4 h-4" />
                  Approve
                </Button>
              </div>

              <div className="text-[11px] text-gray-500">
                Persists to Airtable fields:{" "}
                <span className="font-mono">ReviewStatus</span>,{" "}
                <span className="font-mono">ReviewedAt</span>,{" "}
                <span className="font-mono">ReviewedBy</span>{" "}
                (plus optional <span className="font-mono">CoachNotes</span> if you add it).
              </div>
            </div>
          ) : null}
        </Modal>

        {/* Lightbox */}
        {lightboxUrl ? (
          <div className="fixed inset-0 z-[10000]">
            <div
              className="absolute inset-0 bg-black/70"
              onClick={() => setLightboxUrl("")}
              role="button"
              tabIndex={0}
            />
            <div className="absolute inset-0 flex items-center justify-center p-4">
              <div className="max-w-4xl w-full">
                <div className="flex justify-end mb-2">
                  <button
                    className="p-2 rounded-xl bg-white/90 border border-white/40 hover:bg-white"
                    onClick={() => setLightboxUrl("")}
                    type="button"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={lightboxUrl}
                  alt="Upload"
                  className="w-full max-h-[80vh] object-contain rounded-2xl border border-white/20"
                />
              </div>
            </div>
          </div>
        ) : null}
      </main>
    </div>
  );
}
