// pages/org/athletes.js
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/router";
import { useAuthContext } from "@/hooks/useAuth";
import toast, { Toaster } from "react-hot-toast";

/**
 * Org Athletes Page — Coach Speed Edition (Enhanced)
 *
 * Built for coaches processing 50–200 athletes quickly:
 * - Queue mode + Next Up
 * - Auto-advance after marking Done
 * - Saved views (localStorage)
 * - Bulk actions (copy emails, export CSV, open prescriptions, mark done/star)
 * - Quick View drawer with autosave notes + status toggles
 * - Sticky table header (desktop)
 * - Keyboard shortcuts:
 *    / search, j/k navigate, x select, o open prescriptions, d done, s star, n next-up
 *
 * NOTE:
 * - Done/Star/Notes + Saved Views are stored locally (per org) for speed.
 * - If you later want shared progress across coaches, we can persist these to Airtable.
 */

function cleanString(v) {
  return v == null ? "" : String(v).trim();
}
function normalizeEmail(v) {
  const s = cleanString(v).toLowerCase();
  if (!s || !s.includes("@")) return "";
  return s;
}
function formatDateTime(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "numeric",
    minute: "2-digit",
  });
}
function safeJsonParse(s, fallback) {
  try {
    return JSON.parse(s);
  } catch {
    return fallback;
  }
}
function safeCsvCell(v) {
  const s = cleanString(v);
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}
function downloadTextFile(filename, content, mime = "text/plain;charset=utf-8") {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
function clamp(n, min, max) {
  return Math.min(Math.max(n, min), max);
}

export default function OrgAthletesPage() {
  const router = useRouter();
  const { user } = useAuthContext();

  const abortRef = useRef(null);
  const searchRef = useRef(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [athletesRaw, setAthletesRaw] = useState([]);

  // UX controls
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all"); // all | ready | incomplete | done | starred
  const [sortKey, setSortKey] = useState("createdAt"); // createdAt | name | email
  const [sortDir, setSortDir] = useState("desc"); // asc | desc
  const [pageSize, setPageSize] = useState(50);
  const [page, setPage] = useState(1);

  // Selection
  const [selectedIds, setSelectedIds] = useState(() => new Set());

  // Drawer
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerAthleteId, setDrawerAthleteId] = useState("");

  // Row highlight (desktop single click)
  const [activeRowId, setActiveRowId] = useState("");

  // Note autosave indicator
  const [noteDirty, setNoteDirty] = useState(false);
  const noteSaveTimer = useRef(null);

  // local coach state (per org)
  const role = useMemo(() => {
    const r = String(user?.role || user?.Role || "").toLowerCase();
    if (r.includes("org")) return "organization";
    if (r.includes("ath")) return "athlete";
    return "";
  }, [user]);

  const orgToken = useMemo(() => {
    return String(
      user?.Token || user?.token || user?.["Organization Token"] || ""
    ).trim();
  }, [user]);

  const orgKey = useMemo(() => {
    const base = orgToken ? `org:${orgToken.slice(0, 12)}` : "org:unknown";
    return base;
  }, [orgToken]);

  const LS_COACH = useMemo(() => `${orgKey}:athleteCoachState:v2`, [orgKey]);
  const LS_VIEWS = useMemo(() => `${orgKey}:athleteSavedViews:v1`, [orgKey]);

  const [coachState, setCoachState] = useState(() => {
    if (typeof window === "undefined") return { done: {}, starred: {}, notes: {} };
    const raw = window.localStorage.getItem(LS_COACH);
    const parsed = safeJsonParse(raw || "", null);
    if (!parsed || typeof parsed !== "object") return { done: {}, starred: {}, notes: {} };
    return {
      done: parsed.done && typeof parsed.done === "object" ? parsed.done : {},
      starred: parsed.starred && typeof parsed.starred === "object" ? parsed.starred : {},
      notes: parsed.notes && typeof parsed.notes === "object" ? parsed.notes : {},
    };
  });

  const [savedViews, setSavedViews] = useState(() => {
    if (typeof window === "undefined") return [];
    const raw = window.localStorage.getItem(LS_VIEWS);
    const parsed = safeJsonParse(raw || "", []);
    return Array.isArray(parsed) ? parsed : [];
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(LS_COACH, JSON.stringify(coachState));
  }, [coachState, LS_COACH]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(LS_VIEWS, JSON.stringify(savedViews));
  }, [savedViews, LS_VIEWS]);

  // Guard: must be org
  useEffect(() => {
    if (!user) return;
    if (role !== "organization") router.push("/dashboard");
  }, [user, role, router]);

  const normalizeAthlete = (a) => {
    const email = normalizeEmail(a?.email || a?.Email);
    const name = cleanString(a?.name || a?.Name) || "—";
    const createdAt =
      a?.createdAt ||
      a?.CreatedAt ||
      a?.created ||
      a?.Created ||
      a?.created_time ||
      a?.["Created time"] ||
      "";
    const title = cleanString(a?.title || a?.Title) || "Athlete";
    const id = String(
      a?.id ||
        a?.Id ||
        a?.recordId ||
        email ||
        name ||
        Math.random().toString(36).slice(2)
    );

    return { id, raw: a, name, email, title, createdAt };
  };

  const athletes = useMemo(() => {
    return (Array.isArray(athletesRaw) ? athletesRaw : []).map(normalizeAthlete);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [athletesRaw]);

  const athletesMap = useMemo(() => {
    const m = new Map();
    for (const a of athletes) m.set(a.id, a);
    return m;
  }, [athletes]);

  const fetchAthletes = async () => {
    try {
      abortRef.current?.abort?.();
    } catch {}
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError("");

    try {
      if (!orgToken) {
        setAthletesRaw([]);
        setError("Missing organization token on your account. Please contact support.");
        return;
      }

      // Preferred: header-based
      let res = await fetch(`/api/org/getAthletes`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          ...(orgToken ? { "x-org-token": orgToken } : {}),
        },
        credentials: "same-origin",
        signal: controller.signal,
      });

      // Fallback: older route expects token query
      if (!res.ok) {
        res = await fetch(`/api/org/getAthletes?token=${encodeURIComponent(orgToken)}`, {
          method: "GET",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          signal: controller.signal,
        });
      }

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Failed to load athletes.");

      const list = Array.isArray(data?.athletes) ? data.athletes : [];
      setAthletesRaw(list);

      // reset selection + page
      setSelectedIds(new Set());
      setPage(1);
      setActiveRowId("");
      setDrawerOpen(false);
      setDrawerAthleteId("");
    } catch (err) {
      if (err?.name === "AbortError") return;
      console.error("[org/athletes] load error:", err);
      setError(err?.message || "Failed to load athletes.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!user) return;
    if (role !== "organization") return;
    fetchAthletes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, role, orgToken]);

  const stats = useMemo(() => {
    const total = athletes.length;
    const ready = athletes.filter((a) => !!a.email).length;
    const incomplete = total - ready;

    const doneCount = athletes.reduce((acc, a) => acc + (coachState?.done?.[a.id] ? 1 : 0), 0);
    const starredCount = athletes.reduce((acc, a) => acc + (coachState?.starred?.[a.id] ? 1 : 0), 0);

    let newest = "";
    for (const a of athletes) {
      const t = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const cur = newest ? new Date(newest).getTime() : 0;
      if (t && t > cur) newest = a.createdAt;
    }

    return { total, ready, incomplete, doneCount, starredCount, newest };
  }, [athletes, coachState]);

  const filtered = useMemo(() => {
    const q = cleanString(query).toLowerCase();
    let list = athletes;

    if (q) {
      list = list.filter((a) => {
        const name = String(a.name || "").toLowerCase();
        const email = String(a.email || "").toLowerCase();
        const title = String(a.title || "").toLowerCase();
        return name.includes(q) || email.includes(q) || title.includes(q);
      });
    }

    if (filter === "ready") list = list.filter((a) => !!a.email);
    if (filter === "incomplete") list = list.filter((a) => !a.email);
    if (filter === "done") list = list.filter((a) => !!coachState?.done?.[a.id]);
    if (filter === "starred") list = list.filter((a) => !!coachState?.starred?.[a.id]);

    const dir = sortDir === "asc" ? 1 : -1;
    const sorted = [...list].sort((a, b) => {
      if (sortKey === "name") return a.name.localeCompare(b.name) * dir;
      if (sortKey === "email") return String(a.email || "").localeCompare(String(b.email || "")) * dir;

      const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return (ta - tb) * dir;
    });

    return sorted;
  }, [athletes, query, filter, sortKey, sortDir, coachState]);

  const totalPages = useMemo(() => {
    if (!filtered.length) return 1;
    return Math.max(1, Math.ceil(filtered.length / pageSize));
  }, [filtered.length, pageSize]);

  const safePage = useMemo(() => clamp(page, 1, totalPages), [page, totalPages]);

  const paged = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    const end = start + pageSize;
    return filtered.slice(start, end);
  }, [filtered, safePage, pageSize]);

  useEffect(() => {
    if (page !== safePage) setPage(safePage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [safePage]);

  // Progress within current filtered list
  const batchProgress = useMemo(() => {
    const total = filtered.length;
    const done = filtered.reduce((acc, a) => acc + (coachState?.done?.[a.id] ? 1 : 0), 0);
    const pct = total ? Math.round((done / total) * 100) : 0;
    return { total, done, pct };
  }, [filtered, coachState]);

  const selectedList = useMemo(() => {
    if (!selectedIds || selectedIds.size === 0) return [];
    return Array.from(selectedIds)
      .map((id) => athletesMap.get(id))
      .filter(Boolean);
  }, [selectedIds, athletesMap]);

  const selectedEmails = useMemo(() => {
    return selectedList.map((a) => a.email).filter(Boolean);
  }, [selectedList]);

  const inputBase =
    "w-full px-4 py-3 rounded-xl border border-gray-300 bg-white text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#46769B]/30";
  const card = "bg-white rounded-2xl shadow-md border border-blue-100";

  const copyText = async (text, okMsg = "Copied") => {
    try {
      await navigator.clipboard.writeText(String(text || ""));
      toast.success(okMsg);
    } catch {
      window.prompt("Copy:", String(text || ""));
    }
  };

  const openPrescriptions = (email) => {
    const em = normalizeEmail(email);
    if (!em) {
      toast.error("This athlete is missing an email.");
      return;
    }
    router.push(`/org/prescriptions?athleteEmail=${encodeURIComponent(em)}`);
  };

  const openPrescriptionsNewTab = (email) => {
    const em = normalizeEmail(email);
    if (!em) {
      toast.error("Missing email.");
      return;
    }
    window.open(
      `/org/prescriptions?athleteEmail=${encodeURIComponent(em)}`,
      "_blank",
      "noopener,noreferrer"
    );
  };

  const toggleDone = (id) => {
    setCoachState((prev) => {
      const next = { ...prev, done: { ...(prev?.done || {}) } };
      next.done[id] = !next.done[id];
      return next;
    });
  };

  const toggleStarred = (id) => {
    setCoachState((prev) => {
      const next = { ...prev, starred: { ...(prev?.starred || {}) } };
      next.starred[id] = !next.starred[id];
      return next;
    });
  };

  const setNote = (id, note) => {
    // mark dirty and debounce the indicator
    setNoteDirty(true);
    if (noteSaveTimer.current) clearTimeout(noteSaveTimer.current);
    noteSaveTimer.current = setTimeout(() => setNoteDirty(false), 650);

    setCoachState((prev) => {
      const next = { ...prev, notes: { ...(prev?.notes || {}) } };
      next.notes[id] = note;
      return next;
    });
  };

  const toggleSelect = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAllOnPage = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const a of paged) next.add(a.id);
      return next;
    });
    toast.success("Selected page");
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
    toast.success("Selection cleared");
  };

  const exportCsv = (rows, filenamePrefix) => {
    const header = [
      "Name",
      "Email",
      "Title",
      "CreatedAt",
      "Done",
      "Starred",
      "CoachNote",
    ].join(",");

    const lines = rows.map((a) => {
      const done = coachState?.done?.[a.id] ? "Yes" : "No";
      const starred = coachState?.starred?.[a.id] ? "Yes" : "No";
      const note = cleanString(coachState?.notes?.[a.id] || "");
      return [
        safeCsvCell(a.name),
        safeCsvCell(a.email || ""),
        safeCsvCell(a.title || ""),
        safeCsvCell(a.createdAt ? formatDateTime(a.createdAt) : ""),
        safeCsvCell(done),
        safeCsvCell(starred),
        safeCsvCell(note),
      ].join(",");
    });

    const content = [header, ...lines].join("\n");
    downloadTextFile(
      `${filenamePrefix}_${new Date().toISOString().slice(0, 10)}.csv`,
      content,
      "text/csv;charset=utf-8"
    );
  };

  const exportSelectedCsv = () => {
    if (!selectedList.length) return toast.error("No athletes selected.");
    exportCsv(selectedList, "selected_athletes");
    toast.success("Exported selected CSV");
  };

  const exportFilteredCsv = () => {
    if (!filtered.length) return toast.error("Nothing to export.");
    exportCsv(filtered, "athletes_filtered");
    toast.success("Exported filtered CSV");
  };

  const copySelectedEmails = () => {
    if (!selectedEmails.length) return toast.error("No emails selected.");
    copyText(selectedEmails.join(", "), "Emails copied");
  };

  const bulkOpenPrescriptions = async () => {
    if (!selectedEmails.length) return toast.error("Select athletes with emails first.");

    const limit = 12;
    const list = selectedEmails.slice(0, limit);

    // confirm if opening a lot
    if (selectedEmails.length > 6) {
      const ok = window.confirm(
        `Open ${list.length} prescription tabs now? (We cap at ${limit} tabs.)`
      );
      if (!ok) return;
    }

    toast.success(`Opening ${list.length} tabs…`);
    for (let i = 0; i < list.length; i++) {
      await new Promise((r) => setTimeout(r, 140));
      openPrescriptionsNewTab(list[i]);
    }

    if (selectedEmails.length > limit) {
      toast(`Opened first ${limit}. Export/copy emails for the rest.`, { icon: "ℹ️" });
    }
  };

  const bulkMarkDone = (value) => {
    if (!selectedList.length) return toast.error("No athletes selected.");
    setCoachState((prev) => {
      const next = { ...prev, done: { ...(prev?.done || {}) } };
      for (const a of selectedList) next.done[a.id] = !!value;
      return next;
    });
    toast.success(value ? "Marked Done" : "Cleared Done");
  };

  const bulkStar = (value) => {
    if (!selectedList.length) return toast.error("No athletes selected.");
    setCoachState((prev) => {
      const next = { ...prev, starred: { ...(prev?.starred || {}) } };
      for (const a of selectedList) next.starred[a.id] = !!value;
      return next;
    });
    toast.success(value ? "Starred" : "Unstarred");
  };

  // Drawer helpers
  const drawerAthlete = useMemo(() => {
    return athletesMap.get(drawerAthleteId) || null;
  }, [athletesMap, drawerAthleteId]);

  const openDrawer = (id) => {
    setDrawerAthleteId(id);
    setDrawerOpen(true);
    setActiveRowId(id);
  };

  // Queue logic: next not-done in current filtered list
  const getNextUpId = () => {
    if (!filtered.length) return "";
    for (const a of filtered) {
      if (!coachState?.done?.[a.id]) return a.id;
    }
    return filtered[0]?.id || "";
  };

  const goNextUp = () => {
    const id = getNextUpId();
    if (!id) return toast.error("No athletes in this view.");
    openDrawer(id);
  };

  const goNextAfter = (currentId) => {
    if (!filtered.length) return;
    const idx = filtered.findIndex((a) => a.id === currentId);
    if (idx < 0) return;

    // find next not-done after current, wrap around
    for (let step = 1; step <= filtered.length; step++) {
      const a = filtered[(idx + step) % filtered.length];
      if (!coachState?.done?.[a.id]) {
        openDrawer(a.id);
        return;
      }
    }

    // if all done, just go next row
    const next = filtered[(idx + 1) % filtered.length];
    if (next) openDrawer(next.id);
  };

  const toggleDoneAndMaybeAdvance = (id, advanceIfDone = true) => {
    const willBeDone = !coachState?.done?.[id];
    toggleDone(id);

    // Auto-advance only if the result becomes Done
    if (advanceIfDone && willBeDone) {
      setTimeout(() => goNextAfter(id), 60);
    }
  };

  // Saved views
  const saveCurrentView = () => {
    const name = window.prompt("Name this view:", "Ready queue");
    if (!name) return;

    const view = {
      id: Math.random().toString(36).slice(2),
      name: String(name).trim(),
      state: { query, filter, sortKey, sortDir, pageSize },
      createdAt: Date.now(),
    };

    setSavedViews((prev) => [view, ...prev].slice(0, 12));
    toast.success("Saved view");
  };

  const applyView = (view) => {
    const s = view?.state || {};
    setQuery(s.query ?? "");
    setFilter(s.filter ?? "all");
    setSortKey(s.sortKey ?? "createdAt");
    setSortDir(s.sortDir ?? "desc");
    setPageSize(s.pageSize ?? 50);
    setPage(1);
    setSelectedIds(new Set());
    toast.success(`Applied: ${view?.name || "View"}`);
  };

  const deleteView = (id) => {
    setSavedViews((prev) => prev.filter((v) => v.id !== id));
    toast.success("Deleted view");
  };

  // Keyboard shortcuts
  useEffect(() => {
    const isTypingTarget = () => {
      const el = document.activeElement;
      if (!el) return false;
      const tag = el.tagName?.toLowerCase?.();
      if (tag === "input" || tag === "textarea" || tag === "select") return true;
      if (el.getAttribute && el.getAttribute("contenteditable") === "true") return true;
      return false;
    };

    const onKeyDown = (e) => {
      if (role !== "organization") return;

      // "/" focus search
      if (e.key === "/" && !isTypingTarget()) {
        e.preventDefault();
        searchRef.current?.focus?.();
        return;
      }

      // n = next-up
      if (e.key === "n" && !isTypingTarget()) {
        e.preventDefault();
        goNextUp();
        return;
      }

      if (e.key === "Escape") {
        if (drawerOpen) setDrawerOpen(false);
        return;
      }

      if (isTypingTarget()) return;

      // j/k navigation uses filtered list when drawer open, else uses current paged list via activeRowId
      const currentId = drawerOpen
        ? drawerAthlete?.id
        : activeRowId || "";

      const list = drawerOpen ? filtered : paged;
      const idx = currentId ? list.findIndex((a) => a.id === currentId) : -1;

      if (e.key === "j") {
        const next = list[clamp((idx >= 0 ? idx : -1) + 1, 0, list.length - 1)];
        if (next) (drawerOpen ? openDrawer(next.id) : setActiveRowId(next.id));
      }
      if (e.key === "k") {
        const prev = list[clamp((idx >= 0 ? idx : 0) - 1, 0, list.length - 1)];
        if (prev) (drawerOpen ? openDrawer(prev.id) : setActiveRowId(prev.id));
      }

      if (e.key === "x" && currentId) toggleSelect(currentId);
      if (e.key === "o") {
        const a = athletesMap.get(currentId);
        if (a?.email) openPrescriptions(a.email);
      }
      if (e.key === "d" && currentId) toggleDoneAndMaybeAdvance(currentId, drawerOpen);
      if (e.key === "s" && currentId) toggleStarred(currentId);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role, drawerOpen, drawerAthlete, filtered, paged, activeRowId, coachState, athletesMap]);

  // UI helpers
  const statusPill = (a) => {
    if (a.email) return "bg-emerald-100 text-emerald-700 border-emerald-200";
    return "bg-gray-100 text-gray-600 border-gray-200";
  };

  const isDone = (id) => !!coachState?.done?.[id];
  const isStarred = (id) => !!coachState?.starred?.[id];

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-blue-50 text-gray-900">
      <Toaster position="top-center" />

      {/* Drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-40">
          <div
            className="absolute inset-0 bg-black/20"
            onClick={() => setDrawerOpen(false)}
          />
          <div className="absolute right-0 top-0 h-full w-full sm:w-[520px] bg-white border-l border-gray-200 shadow-xl">
            <div className="p-5 border-b border-gray-200 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs text-gray-500">Quick View</p>
                <h3 className="text-lg font-bold text-gray-900 truncate">
                  {drawerAthlete?.name || "Athlete"}
                </h3>
                <p className="text-xs text-gray-500 mt-1 truncate">
                  {drawerAthlete?.email || "Missing email"}
                </p>
                <p className="text-[11px] text-gray-500 mt-1">
                  Created: {formatDateTime(drawerAthlete?.createdAt)}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  className="px-4 py-2 rounded-xl border border-gray-200 bg-white text-sm font-semibold hover:bg-gray-50"
                  onClick={() => goNextUp()}
                  title="Next not-done in this view (shortcut: n)"
                >
                  Next Up
                </button>
                <button
                  className="px-4 py-2 rounded-xl border border-gray-200 bg-white text-sm font-semibold hover:bg-gray-50"
                  onClick={() => setDrawerOpen(false)}
                >
                  Close
                </button>
              </div>
            </div>

            <div className="p-5 space-y-4 overflow-auto h-[calc(100%-80px)]">
              <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs text-gray-500">Status</p>
                    <div className="mt-2 flex items-center gap-2">
                      <span
                        className={`text-xs px-2 py-1 rounded-lg border ${statusPill(
                          drawerAthlete || {}
                        )}`}
                      >
                        {drawerAthlete?.email ? "Ready" : "Incomplete"}
                      </span>
                      <span
                        className={`text-xs px-2 py-1 rounded-lg border ${
                          drawerAthlete && isDone(drawerAthlete.id)
                            ? "bg-emerald-600 text-white border-emerald-600"
                            : "bg-white text-gray-700 border-gray-200"
                        }`}
                      >
                        {drawerAthlete && isDone(drawerAthlete.id) ? "Done" : "Not done"}
                      </span>
                      <span
                        className={`text-xs px-2 py-1 rounded-lg border ${
                          drawerAthlete && isStarred(drawerAthlete.id)
                            ? "bg-yellow-400 text-gray-900 border-yellow-300"
                            : "bg-white text-gray-700 border-gray-200"
                        }`}
                      >
                        {drawerAthlete && isStarred(drawerAthlete.id) ? "Starred" : "Not starred"}
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-500">Batch progress</p>
                    <p className="text-sm font-bold text-gray-900 mt-1">
                      {batchProgress.done}/{batchProgress.total} ({batchProgress.pct}%)
                    </p>
                  </div>
                </div>

                <div className="mt-3 w-full h-2 rounded-full bg-gray-200 overflow-hidden">
                  <div className="h-full bg-[#46769B]" style={{ width: `${batchProgress.pct}%` }} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  className="px-4 py-3 rounded-xl bg-gray-900 text-white text-sm font-semibold hover:opacity-90 disabled:opacity-50"
                  disabled={!drawerAthlete?.email}
                  onClick={() => openPrescriptions(drawerAthlete?.email)}
                  title="Open prescriptions (shortcut: o)"
                >
                  Prescriptions
                </button>
                <button
                  className="px-4 py-3 rounded-xl border border-gray-200 bg-white text-sm font-semibold hover:bg-gray-50 disabled:opacity-50"
                  disabled={!drawerAthlete?.email}
                  onClick={() => copyText(drawerAthlete?.email, "Email copied")}
                >
                  Copy Email
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  className={`px-4 py-3 rounded-xl text-sm font-semibold border ${
                    drawerAthlete && isDone(drawerAthlete.id)
                      ? "bg-emerald-600 text-white border-emerald-600"
                      : "bg-white text-gray-900 border-gray-200 hover:bg-gray-50"
                  }`}
                  onClick={() => drawerAthlete && toggleDoneAndMaybeAdvance(drawerAthlete.id, true)}
                  title="Toggle done (shortcut: d). Auto-advances when marking done."
                >
                  {drawerAthlete && isDone(drawerAthlete.id) ? "✓ Done (auto)" : "Mark Done (auto)"}
                </button>

                <button
                  className={`px-4 py-3 rounded-xl text-sm font-semibold border ${
                    drawerAthlete && isStarred(drawerAthlete.id)
                      ? "bg-yellow-400 text-gray-900 border-yellow-300"
                      : "bg-white text-gray-900 border-gray-200 hover:bg-gray-50"
                  }`}
                  onClick={() => drawerAthlete && toggleStarred(drawerAthlete.id)}
                  title="Toggle star (shortcut: s)"
                >
                  {drawerAthlete && isStarred(drawerAthlete.id) ? "★ Starred" : "Star"}
                </button>
              </div>

              <div className="rounded-2xl border border-gray-200 bg-white p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-bold text-gray-900">Coach Note</p>
                  <span className="text-[11px] text-gray-500">
                    {noteDirty ? "Saving…" : "Saved"}
                  </span>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Local-only note for speed. Included in exports.
                </p>
                <textarea
                  className="mt-3 w-full px-4 py-3 rounded-xl border border-gray-300 bg-white text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#46769B]/30 min-h-[120px]"
                  value={
                    drawerAthlete ? cleanString(coachState?.notes?.[drawerAthlete.id] || "") : ""
                  }
                  onChange={(e) => drawerAthlete && setNote(drawerAthlete.id, e.target.value)}
                  placeholder="Ex: Needs email confirmed • Parent contact • Follow up Monday"
                />
              </div>

              <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                <p className="text-sm font-bold text-gray-900">Shortcuts</p>
                <p className="text-xs text-gray-600 mt-2 leading-relaxed">
                  <span className="font-semibold">/</span> search •{" "}
                  <span className="font-semibold">j/k</span> move •{" "}
                  <span className="font-semibold">x</span> select •{" "}
                  <span className="font-semibold">o</span> open •{" "}
                  <span className="font-semibold">d</span> done •{" "}
                  <span className="font-semibold">s</span> star •{" "}
                  <span className="font-semibold">n</span> next-up
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      <main className="max-w-6xl mx-auto px-4 py-8 pb-28 space-y-6">
        {/* Header */}
        <div className={`${card} p-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between`}>
          <div>
            <h1 className="text-2xl font-bold">Athletes</h1>
            <p className="text-sm text-gray-600 mt-1">
              Coach-first roster with queue mode, bulk actions, and quick notes.
            </p>
            <p className="text-[11px] text-gray-500 mt-2">
              Tip: filter “Ready”, sort “Newest”, then use <span className="font-semibold">Next Up</span> to process quickly.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => router.push("/org/dashboard")}
              className="px-4 py-2 rounded-xl border border-gray-200 bg-white text-sm font-semibold hover:bg-gray-50"
            >
              Dashboard
            </button>

            <button
              onClick={saveCurrentView}
              className="px-4 py-2 rounded-xl border border-gray-200 bg-white text-sm font-semibold hover:bg-gray-50"
              title="Save current filters/sort/page size"
            >
              Save View
            </button>

            <button
              onClick={goNextUp}
              className="px-4 py-2 rounded-xl bg-[#46769B] text-white text-sm font-semibold hover:opacity-95"
              title="Open the next not-done athlete (shortcut: n)"
              disabled={loading || filtered.length === 0}
            >
              Next Up
            </button>

            <button
              onClick={fetchAthletes}
              className="px-4 py-2 rounded-xl border border-gray-200 bg-white text-sm font-semibold hover:bg-gray-50 disabled:opacity-60"
              disabled={loading}
            >
              {loading ? "Refreshing…" : "Refresh"}
            </button>
          </div>
        </div>

        {/* Saved views */}
        {savedViews.length > 0 && (
          <div className={`${card} p-5`}>
            <p className="text-sm font-bold text-gray-900">Saved Views</p>
            <p className="text-xs text-gray-500 mt-1">
              Local presets for fast workflows (ready queue, incomplete cleanup, etc.)
            </p>

            <div className="mt-3 flex flex-wrap gap-2">
              {savedViews.map((v) => (
                <div
                  key={v.id}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl border border-gray-200 bg-white"
                >
                  <button
                    className="text-sm font-semibold text-gray-900 hover:underline"
                    onClick={() => applyView(v)}
                  >
                    {v.name}
                  </button>
                  <button
                    className="text-xs px-2 py-1 rounded-lg border border-gray-200 bg-white hover:bg-gray-50"
                    onClick={() => deleteView(v.id)}
                    title="Delete view"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Stats */}
        <div className="grid sm:grid-cols-5 gap-4">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
            <p className="text-xs text-gray-500">Total</p>
            <p className="text-3xl font-extrabold text-[#46769B] mt-1">{stats.total}</p>
          </div>
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
            <p className="text-xs text-gray-500">Ready</p>
            <p className="text-3xl font-extrabold text-[#46769B] mt-1">{stats.ready}</p>
          </div>
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
            <p className="text-xs text-gray-500">Incomplete</p>
            <p className="text-3xl font-extrabold text-[#46769B] mt-1">{stats.incomplete}</p>
          </div>
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
            <p className="text-xs text-gray-500">Done</p>
            <p className="text-3xl font-extrabold text-[#46769B] mt-1">{stats.doneCount}</p>
          </div>
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
            <p className="text-xs text-gray-500">Starred</p>
            <p className="text-3xl font-extrabold text-[#46769B] mt-1">{stats.starredCount}</p>
          </div>
        </div>

        {/* Batch progress */}
        <div className={`${card} p-5`}>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <p className="text-sm font-bold text-gray-900">
                Batch Progress{" "}
                <span className="text-gray-500 font-semibold">
                  ({batchProgress.done}/{batchProgress.total})
                </span>
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Progress is calculated on the current filtered list.
              </p>
            </div>
            <div className="text-sm font-bold text-gray-900">{batchProgress.pct}%</div>
          </div>
          <div className="mt-3 w-full h-3 rounded-full bg-gray-100 overflow-hidden">
            <div className="h-full bg-[#46769B]" style={{ width: `${batchProgress.pct}%` }} />
          </div>
        </div>

        {/* Toolbar */}
        <div className={`${card} p-5 space-y-4`}>
          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-3">
              <p className="text-sm font-semibold text-red-800">Error</p>
              <p className="text-sm text-red-700 mt-1">{error}</p>
            </div>
          )}

          <div className="grid md:grid-cols-12 gap-3 items-center">
            <div className="md:col-span-6">
              <input
                ref={searchRef}
                className={inputBase}
                placeholder="Search name, email, title… (press /)"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setPage(1);
                  setSelectedIds(new Set());
                }}
              />
            </div>

            <div className="md:col-span-3 flex gap-2">
              <select
                className="w-full px-3 py-3 rounded-xl border border-gray-300 bg-white text-sm"
                value={sortKey}
                onChange={(e) => setSortKey(e.target.value)}
              >
                <option value="createdAt">Sort: Created</option>
                <option value="name">Sort: Name</option>
                <option value="email">Sort: Email</option>
              </select>

              <button
                type="button"
                className="px-4 py-3 rounded-xl border border-gray-200 bg-white text-sm font-semibold hover:bg-gray-50"
                onClick={() => setSortDir((d) => (d === "asc" ? "desc" : "asc"))}
                title="Toggle sort direction"
              >
                {sortDir === "asc" ? "↑" : "↓"}
              </button>
            </div>

            <div className="md:col-span-3 flex gap-2">
              <select
                className="w-full px-3 py-3 rounded-xl border border-gray-300 bg-white text-sm"
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value) || 50);
                  setPage(1);
                  setSelectedIds(new Set());
                }}
              >
                <option value={10}>10 / page</option>
                <option value={25}>25 / page</option>
                <option value={50}>50 / page</option>
                <option value={100}>100 / page</option>
              </select>

              <button
                type="button"
                className="px-4 py-3 rounded-xl border border-gray-200 bg-white text-sm font-semibold hover:bg-gray-50"
                onClick={() => {
                  setQuery("");
                  setFilter("all");
                  setSortKey("createdAt");
                  setSortDir("desc");
                  setPage(1);
                  setSelectedIds(new Set());
                }}
                title="Reset filters"
              >
                Reset
              </button>
            </div>
          </div>

          {/* Filter chips */}
          <div className="flex flex-wrap gap-2">
            {[
              { key: "all", label: `All (${stats.total})` },
              { key: "ready", label: `Ready (${stats.ready})` },
              { key: "incomplete", label: `Incomplete (${stats.incomplete})` },
              { key: "done", label: `Done (${stats.doneCount})` },
              { key: "starred", label: `Starred (${stats.starredCount})` },
            ].map((x) => (
              <button
                key={x.key}
                type="button"
                onClick={() => {
                  setFilter(x.key);
                  setPage(1);
                  setSelectedIds(new Set());
                }}
                className={`px-3 py-2 rounded-xl text-sm font-semibold border ${
                  filter === x.key
                    ? "bg-[#46769B] text-white border-[#46769B]"
                    : "bg-white text-gray-900 border-gray-200 hover:bg-gray-50"
                }`}
              >
                {x.label}
              </button>
            ))}
          </div>

          {/* Paging + selection info */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-gray-500">
              Showing <span className="font-semibold">{paged.length}</span> of{" "}
              <span className="font-semibold">{filtered.length}</span> (filtered) • Selected{" "}
              <span className="font-semibold">{selectedIds.size}</span>
            </p>

            <div className="flex items-center gap-2">
              <button
                type="button"
                className="px-3 py-2 rounded-xl border border-gray-200 bg-white text-sm font-semibold hover:bg-gray-50 disabled:opacity-50"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={safePage <= 1}
              >
                Prev
              </button>
              <span className="text-sm text-gray-600">
                Page <span className="font-semibold">{safePage}</span> /{" "}
                <span className="font-semibold">{totalPages}</span>
              </span>
              <button
                type="button"
                className="px-3 py-2 rounded-xl border border-gray-200 bg-white text-sm font-semibold hover:bg-gray-50 disabled:opacity-50"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={safePage >= totalPages}
              >
                Next
              </button>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className={`${card} p-6`}>
          {loading ? (
            <div className="text-sm text-gray-600">Loading athletes…</div>
          ) : filtered.length === 0 ? (
            <div className="text-sm text-gray-600">No athletes found. Try clearing filters/search.</div>
          ) : (
            <>
              {/* Mobile cards */}
              <div className="space-y-3 md:hidden">
                {paged.map((a) => (
                  <div key={a.id} className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={selectedIds.has(a.id)}
                            onChange={() => toggleSelect(a.id)}
                          />
                          <button
                            type="button"
                            onClick={() => openDrawer(a.id)}
                            className="text-left min-w-0"
                          >
                            <p className="text-sm font-bold text-gray-900 truncate">{a.name}</p>
                            <p className="text-xs text-gray-500 mt-1 truncate">{a.title}</p>
                          </button>
                        </div>

                        <p className="text-xs text-gray-600 mt-2 truncate">
                          {a.email ? a.email : <span className="text-red-600 font-semibold">Missing email</span>}
                        </p>

                        <p className="text-[11px] text-gray-500 mt-1">
                          Created: {formatDateTime(a.createdAt)}
                        </p>
                      </div>

                      <div className="flex flex-col items-end gap-2">
                        <button
                          className={`px-2 py-1 rounded-lg text-xs font-bold border ${
                            isStarred(a.id)
                              ? "bg-yellow-400 border-yellow-300 text-gray-900"
                              : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50"
                          }`}
                          onClick={() => toggleStarred(a.id)}
                          title="Star"
                        >
                          ★
                        </button>

                        <span className={`text-xs px-2 py-1 rounded-lg border ${statusPill(a)}`}>
                          {a.email ? "Ready" : "Incomplete"}
                        </span>

                        <button
                          className={`text-xs px-2 py-1 rounded-lg border ${
                            isDone(a.id)
                              ? "bg-emerald-600 text-white border-emerald-600"
                              : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50"
                          }`}
                          onClick={() => toggleDoneAndMaybeAdvance(a.id, false)}
                          title="Toggle done"
                        >
                          {isDone(a.id) ? "Done" : "Not done"}
                        </button>
                      </div>
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => openPrescriptions(a.email)}
                        className="px-3 py-2 rounded-xl bg-gray-900 text-white text-xs font-semibold hover:opacity-90 disabled:opacity-50"
                        disabled={!a.email}
                      >
                        Prescriptions
                      </button>
                      <button
                        type="button"
                        onClick={() => copyText(a.email, "Email copied")}
                        className="px-3 py-2 rounded-xl border border-gray-200 bg-white text-xs font-semibold hover:bg-gray-50 disabled:opacity-50"
                        disabled={!a.email}
                      >
                        Copy Email
                      </button>
                    </div>

                    <div className="mt-2 grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => openDrawer(a.id)}
                        className="px-3 py-2 rounded-xl border border-gray-200 bg-white text-xs font-semibold hover:bg-gray-50"
                      >
                        Quick View
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleDoneAndMaybeAdvance(a.id, false)}
                        className={`px-3 py-2 rounded-xl text-xs font-semibold border ${
                          isDone(a.id)
                            ? "bg-emerald-600 text-white border-emerald-600"
                            : "bg-white border-gray-200 hover:bg-gray-50"
                        }`}
                      >
                        {isDone(a.id) ? "✓ Done" : "Mark done"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop table */}
              <div className="hidden md:block overflow-x-auto">
                <div className="flex items-center justify-between gap-3 mb-3">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={selectAllOnPage}
                      className="px-3 py-2 rounded-xl border border-gray-200 bg-white text-sm font-semibold hover:bg-gray-50"
                    >
                      Select page
                    </button>
                    <button
                      type="button"
                      onClick={clearSelection}
                      className="px-3 py-2 rounded-xl border border-gray-200 bg-white text-sm font-semibold hover:bg-gray-50 disabled:opacity-50"
                      disabled={selectedIds.size === 0}
                    >
                      Clear selection
                    </button>
                  </div>

                  <p className="text-xs text-gray-500">
                    Single click highlight • Double click Quick View
                  </p>
                </div>

                <div className="max-h-[560px] overflow-auto rounded-2xl border border-gray-200">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-white z-10 border-b border-gray-200">
                      <tr className="text-left text-gray-500">
                        <th className="py-3 px-3 w-[44px]">Sel</th>
                        <th className="py-3 px-3 w-[44px]">★</th>
                        <th className="py-3 px-3">Name</th>
                        <th className="py-3 px-3">Email</th>
                        <th className="py-3 px-3">Title</th>
                        <th className="py-3 px-3">Created</th>
                        <th className="py-3 px-3 w-[110px]">Done</th>
                        <th className="py-3 px-3">Actions</th>
                      </tr>
                    </thead>

                    <tbody>
                      {paged.map((a) => (
                        <tr
                          key={a.id}
                          className={`border-b last:border-b-0 hover:bg-gray-50 ${
                            activeRowId === a.id ? "bg-blue-50" : ""
                          }`}
                          onClick={() => setActiveRowId(a.id)}
                          onDoubleClick={() => openDrawer(a.id)}
                        >
                          <td className="py-3 px-3">
                            <input
                              type="checkbox"
                              checked={selectedIds.has(a.id)}
                              onChange={() => toggleSelect(a.id)}
                              onClick={(e) => e.stopPropagation()}
                            />
                          </td>

                          <td className="py-3 px-3">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleStarred(a.id);
                              }}
                              className={`px-2 py-1 rounded-lg text-xs font-bold border ${
                                isStarred(a.id)
                                  ? "bg-yellow-400 border-yellow-300 text-gray-900"
                                  : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50"
                              }`}
                              title="Star"
                            >
                              ★
                            </button>
                          </td>

                          <td className="py-3 px-3 font-semibold text-gray-900">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                openDrawer(a.id);
                              }}
                              className="hover:underline text-left"
                            >
                              {a.name}
                            </button>
                          </td>

                          <td className="py-3 px-3 text-gray-700">
                            {a.email ? (
                              <div className="flex items-center gap-2">
                                <span className="font-medium">{a.email}</span>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    copyText(a.email, "Email copied");
                                  }}
                                  className="px-2 py-1 rounded-lg border border-gray-200 bg-white text-[11px] font-semibold hover:bg-gray-50"
                                  title="Copy email"
                                >
                                  Copy
                                </button>
                              </div>
                            ) : (
                              <span className="text-red-600 font-semibold">Missing email</span>
                            )}
                          </td>

                          <td className="py-3 px-3 text-gray-700">{a.title}</td>

                          <td className="py-3 px-3 text-gray-500">
                            {formatDateTime(a.createdAt)}
                          </td>

                          <td className="py-3 px-3">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleDoneAndMaybeAdvance(a.id, false);
                              }}
                              className={`px-3 py-2 rounded-xl text-xs font-semibold border ${
                                isDone(a.id)
                                  ? "bg-emerald-600 text-white border-emerald-600"
                                  : "bg-white border-gray-200 hover:bg-gray-50"
                              }`}
                            >
                              {isDone(a.id) ? "✓ Done" : "Mark"}
                            </button>
                          </td>

                          <td className="py-3 px-3">
                            <div className="flex items-center gap-2">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openPrescriptions(a.email);
                                }}
                                className="px-3 py-2 rounded-xl bg-gray-900 text-white text-xs font-semibold hover:opacity-90 disabled:opacity-50"
                                disabled={!a.email}
                              >
                                Prescriptions
                              </button>

                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openDrawer(a.id);
                                }}
                                className="px-3 py-2 rounded-xl border border-gray-200 bg-white text-xs font-semibold hover:bg-gray-50"
                              >
                                Quick View
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <p className="mt-4 text-[11px] text-gray-500 leading-relaxed">
                  Done/Star/Notes + Saved Views are stored locally for speed. Exports include coach notes.
                </p>
              </div>
            </>
          )}
        </div>
      </main>

      {/* Sticky bulk actions bar */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-30 border-t border-gray-200 bg-white/90 backdrop-blur">
          <div className="max-w-6xl mx-auto px-4 py-3 flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between">
            <div className="text-xs text-gray-700">
              Selected: <span className="font-semibold">{selectedIds.size}</span>
              {selectedEmails.length > 0 && (
                <>
                  {" "}
                  • Emails: <span className="font-semibold">{selectedEmails.length}</span>
                </>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={copySelectedEmails}
                className="px-4 py-3 rounded-xl border border-gray-200 bg-white text-sm font-semibold hover:bg-gray-50 disabled:opacity-50"
                disabled={selectedEmails.length === 0}
              >
                Copy Emails
              </button>

              <button
                type="button"
                onClick={exportSelectedCsv}
                className="px-4 py-3 rounded-xl border border-gray-200 bg-white text-sm font-semibold hover:bg-gray-50"
              >
                Export Selected CSV
              </button>

              <button
                type="button"
                onClick={bulkOpenPrescriptions}
                className="px-5 py-3 rounded-xl bg-[#46769B] text-white text-sm font-semibold hover:opacity-95 disabled:opacity-50"
                disabled={selectedEmails.length === 0}
                title="Opens up to 12 tabs"
              >
                Open Prescriptions (tabs)
              </button>

              <button
                type="button"
                onClick={() => bulkMarkDone(true)}
                className="px-4 py-3 rounded-xl border border-gray-200 bg-white text-sm font-semibold hover:bg-gray-50"
              >
                Mark Done
              </button>

              <button
                type="button"
                onClick={() => bulkMarkDone(false)}
                className="px-4 py-3 rounded-xl border border-gray-200 bg-white text-sm font-semibold hover:bg-gray-50"
              >
                Clear Done
              </button>

              <button
                type="button"
                onClick={() => bulkStar(true)}
                className="px-4 py-3 rounded-xl border border-gray-200 bg-white text-sm font-semibold hover:bg-gray-50"
              >
                Star
              </button>

              <button
                type="button"
                onClick={() => bulkStar(false)}
                className="px-4 py-3 rounded-xl border border-gray-200 bg-white text-sm font-semibold hover:bg-gray-50"
              >
                Unstar
              </button>

              <button
                type="button"
                onClick={clearSelection}
                className="px-4 py-3 rounded-xl border border-gray-200 bg-white text-sm font-semibold hover:bg-gray-50"
              >
                Clear
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
