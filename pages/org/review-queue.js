// pages/org/review-queue.js
"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
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
  Tag,
  ThumbsUp,
  ThumbsDown,
  HelpCircle,
} from "lucide-react";

/**
 * Review Queue — matches /org/dashboard design language
 * - Uses cookie session (credentials: include)
 * - Soft-fails with friendly UI
 * - Endpoint placeholders:
 *   GET  /api/org/reviewQueue/list
 *   POST /api/org/reviewQueue/updateStatus
 */

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

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
        <div className="w-full max-w-2xl bg-white rounded-2xl shadow-xl border border-gray-200">
          <div className="p-5 border-b flex items-start justify-between gap-4">
            <div>
              <p className="text-lg font-extrabold text-gray-900">{title}</p>
              <p className="text-[12px] text-gray-500 mt-1">
                Review details and update status.
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

function statusTone(status) {
  const s = String(status || "").toLowerCase();
  if (s === "pending") return "warn";
  if (s === "needs_info") return "warn";
  if (s === "approved") return "good";
  if (s === "rejected") return "bad";
  return "neutral";
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
  const [filterMode, setFilterMode] = useState("pending"); // pending | needs_info | approved | rejected | all
  const [sortMode, setSortMode] = useState("newest"); // newest | oldest

  const [expanded, setExpanded] = useState({});
  const toggleExpanded = (id) => {
    const key = String(id || "").trim();
    if (!key) return;
    setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  // Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [active, setActive] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveErr, setSaveErr] = useState("");

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
  };

  const refreshQueue = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/org/reviewQueue/list", {
        method: "GET",
        credentials: "include",
      });

      const data = await safeJson(res);
      if (!res.ok) throw new Error(data?.error || "Failed to load review queue");

      setItems(Array.isArray(data?.items) ? data.items : []);
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
    const pending = list.filter((x) => String(x?.status || "").toLowerCase() === "pending").length;
    const needsInfo = list.filter((x) => String(x?.status || "").toLowerCase() === "needs_info").length;
    const approved = list.filter((x) => String(x?.status || "").toLowerCase() === "approved").length;
    const rejected = list.filter((x) => String(x?.status || "").toLowerCase() === "rejected").length;
    return { pending, needsInfo, approved, rejected, total: list.length };
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
          it?.type,
          it?.status,
          it?.athleteName,
          it?.athleteEmail,
          it?.trainerName,
          it?.title,
          it?.productName,
          it?.brand,
          it?.reason,
          ...(Array.isArray(it?.tags) ? it.tags : []),
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return hay.includes(q);
      });
    }

    const st = String(filterMode || "pending").toLowerCase();
    if (st !== "all") {
      list = list.filter((it) => String(it?.status || "").toLowerCase() === st);
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

  const updateStatus = async (id, status) => {
    setSaveErr("");
    setSaving(true);

    try {
      const res = await fetch("/api/org/reviewQueue/updateStatus", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status }),
      });

      const data = await safeJson(res);
      if (!res.ok) throw new Error(data?.error || "Failed to update status");

      // update in place
      setItems((prev) => {
        const list = Array.isArray(prev) ? [...prev] : [];
        const idx = list.findIndex((x) => String(x?.id) === String(id));
        if (idx >= 0) list[idx] = { ...list[idx], status };
        return list;
      });

      // keep modal item in sync
      setActive((prev) => (prev && String(prev?.id) === String(id) ? { ...prev, status } : prev));

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
                Pulling pending items that need coaching decisions.
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
        <div className="grid md:grid-cols-4 gap-4">
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
          <div className="bg-white rounded-2xl shadow-md border border-blue-100 p-5">
            <p className="text-xs text-gray-500">Rejected</p>
            <p className="text-2xl font-extrabold text-gray-900 mt-1">{counts.rejected}</p>
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
                  Click an item to review and update status.
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
                  <Pill tone="bad">
                    <ThumbsDown className="w-3.5 h-3.5 mr-1.5" />
                    Rejected: {counts.rejected}
                  </Pill>
                </div>
              </div>

              <div className="w-full sm:w-[460px] space-y-2">
                <div className="relative">
                  <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    className={classNames(inputBase, "pl-10")}
                    placeholder="Search by athlete, product, reason, tag…"
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
                    variant={filterMode === "rejected" ? "primary" : "secondary"}
                    className="px-3 py-2 text-xs"
                    onClick={() => setFilterMode("rejected")}
                  >
                    Rejected
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
                    <th className="py-3 pr-4">Athlete</th>
                    <th className="py-3 pr-4">Status</th>
                    <th className="py-3 pr-4">Created</th>
                    <th className="py-3 pr-2 text-right">Actions</th>
                  </tr>
                </thead>

                <tbody>
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-6 text-center text-gray-500">
                        No items found.
                        <div className="text-[11px] text-gray-400 mt-1">
                          If you haven’t built the API yet, implement{" "}
                          <span className="font-mono">/api/org/reviewQueue/list</span>.
                        </div>
                      </td>
                    </tr>
                  )}

                  {filtered.map((it) => {
                    const id = String(it?.id || it?.recordId || "");
                    const isExpanded = !!expanded[id];
                    const athleteEmail = normalizeEmail(it?.athleteEmail);

                    return (
                      <>
                        <tr key={id || Math.random()} className="border-b">
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
                                  <div className="font-semibold text-gray-900 truncate">
                                    {it?.title || it?.productName || it?.type || "Review Item"}
                                  </div>
                                  <div className="text-[11px] text-gray-500 mt-0.5 truncate">
                                    {it?.reason || it?.summary || "—"}
                                  </div>
                                </div>
                              </div>
                            </button>
                          </td>

                          <td className="py-3 pr-4">
                            <div className="text-gray-900 font-semibold">
                              {it?.athleteName || "Athlete"}
                            </div>
                            <div className="text-[11px] text-gray-500">
                              {athleteEmail || "—"}
                            </div>
                          </td>

                          <td className="py-3 pr-4">
                            <Pill tone={statusTone(it?.status)}>
                              {String(it?.status || "unknown").replaceAll("_", " ")}
                            </Pill>
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
                            <td colSpan={5} className="py-4 px-4">
                              <div className="grid md:grid-cols-3 gap-4">
                                <div className="rounded-2xl border border-gray-200 bg-white p-4">
                                  <p className="text-xs text-gray-500 flex items-center gap-2">
                                    <User className="w-4 h-4 text-gray-400" />
                                    Athlete
                                  </p>
                                  <p className="text-sm font-extrabold text-gray-900 mt-1">
                                    {it?.athleteName || "Athlete"}
                                  </p>
                                  <p className="text-[12px] text-gray-600 mt-1">
                                    {athleteEmail || "—"}
                                  </p>
                                </div>

                                <div className="rounded-2xl border border-gray-200 bg-white p-4">
                                  <p className="text-xs text-gray-500 flex items-center gap-2">
                                    <FileText className="w-4 h-4 text-gray-400" />
                                    Item details
                                  </p>
                                  <p className="text-sm font-extrabold text-gray-900 mt-1 truncate">
                                    {it?.productName || it?.title || it?.type || "—"}
                                  </p>
                                  <p className="text-[11px] text-gray-500 mt-2">
                                    {it?.brand ? `Brand: ${it.brand}` : "—"}
                                  </p>
                                </div>

                                <div className="rounded-2xl border border-gray-200 bg-white p-4">
                                  <p className="text-xs text-gray-500 flex items-center gap-2">
                                    <Tag className="w-4 h-4 text-gray-400" />
                                    Tags
                                  </p>
                                  <div className="mt-2 flex flex-wrap gap-2">
                                    {Array.isArray(it?.tags) && it.tags.length ? (
                                      it.tags.slice(0, 6).map((t) => (
                                        <span
                                          key={t}
                                          className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-semibold border border-gray-200 bg-white text-gray-700"
                                        >
                                          <Tag className="w-3.5 h-3.5 text-gray-400" />
                                          {t}
                                        </span>
                                      ))
                                    ) : (
                                      <span className="text-[11px] text-gray-400">—</span>
                                    )}
                                  </div>
                                </div>
                              </div>

                              {it?.notes ? (
                                <div className="mt-4 rounded-2xl border border-gray-200 bg-white p-4">
                                  <p className="text-xs text-gray-500">Notes</p>
                                  <p className="text-sm text-gray-800 mt-2">{it.notes}</p>
                                </div>
                              ) : null}
                            </td>
                          </tr>
                        ) : null}
                      </>
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
                <p className="text-sm text-gray-600 mt-1">
                  How to process items fast.
                </p>
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
                    Mark <span className="font-semibold">Needs Info</span> to prompt follow-up
                  </li>
                  <li className="flex gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5" />
                    Approve when it’s safe / fits policy
                  </li>
                  <li className="flex gap-2">
                    <ThumbsDown className="w-4 h-4 text-red-600 mt-0.5" />
                    Reject if it violates policy
                  </li>
                </ul>
              </div>

              <div className="rounded-2xl border border-gray-200 p-4">
                <p className="text-sm font-extrabold text-gray-900">Pro tip</p>
                <p className="text-[12px] text-gray-600 mt-1">
                  Keep tags consistent (e.g. <span className="font-semibold">stimulant</span>,{" "}
                  <span className="font-semibold">banned</span>,{" "}
                  <span className="font-semibold">athlete-request</span>) so you can filter later.
                </p>
              </div>

              <div className="rounded-2xl border border-gray-200 p-4">
                <p className="text-sm font-extrabold text-gray-900">Next step</p>
                <p className="text-[12px] text-gray-600 mt-1">
                  If you want, we can plug this into Airtable and auto-create items from:
                  flagged OCR scans, athlete requests, or supplement stacks.
                </p>
              </div>
            </div>
          </section>
        </div>

        {/* Review Modal */}
        <Modal
          open={modalOpen}
          title={active ? `Review: ${active?.title || active?.productName || "Item"}` : "Review Item"}
          onClose={closeModal}
        >
          {saveErr ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-3 mb-4">
              <p className="text-sm text-red-700 font-semibold">{saveErr}</p>
            </div>
          ) : null}

          <div className="space-y-4">
            <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
              <p className="text-xs text-gray-500">Summary</p>
              <p className="text-sm font-extrabold text-gray-900 mt-1">
                {active?.productName || active?.title || active?.type || "—"}
              </p>
              <p className="text-[12px] text-gray-700 mt-1">
                {active?.reason || active?.summary || "—"}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Pill tone={statusTone(active?.status)}>
                  Status: {String(active?.status || "unknown").replaceAll("_", " ")}
                </Pill>
                {active?.createdAt ? <Pill>Created: {fmtDate(active.createdAt)}</Pill> : null}
                {active?.athleteEmail ? <Pill>{normalizeEmail(active.athleteEmail)}</Pill> : null}
              </div>
            </div>

            <div className="flex flex-wrap gap-2 justify-end">
              <Button
                variant="secondary"
                onClick={() => updateStatus(active?.id, "needs_info")}
                disabled={saving || !active?.id}
                className="px-3 py-2 text-xs"
              >
                <HelpCircle className="w-4 h-4" />
                Needs Info
              </Button>

              <Button
                variant="secondary"
                onClick={() => updateStatus(active?.id, "rejected")}
                disabled={saving || !active?.id}
                className="px-3 py-2 text-xs"
              >
                <ThumbsDown className="w-4 h-4" />
                Reject
              </Button>

              <Button
                onClick={() => updateStatus(active?.id, "approved")}
                disabled={saving || !active?.id}
                className="px-3 py-2 text-xs"
              >
                <ThumbsUp className="w-4 h-4" />
                Approve
              </Button>
            </div>

            <div className="text-[11px] text-gray-500">
              Wire <span className="font-mono">/api/org/reviewQueue/updateStatus</span> to persist updates.
            </div>
          </div>
        </Modal>
      </main>
    </div>
  );
}
