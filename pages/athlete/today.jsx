// pages/athlete/today.js (or app/athlete/today/page.jsx if you’re in App Router)
// Full copy/paste — Skimmer-style day strip + swipe-to-upload
// IMPORTANT: This expects an upload endpoint at POST /api/upload/image that returns { url }

"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { useAuthContext } from "@/hooks/useAuth";
import {
  CalendarDays,
  CheckCircle2,
  AlertTriangle,
  Camera,
  Upload,
  RefreshCcw,
  ArrowRight,
  PlayCircle,
  Info,
  X,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

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
  type = "button",
  title = "",
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
      type={type}
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={classNames(
        base,
        styles,
        disabled ? "opacity-70 cursor-not-allowed" : "",
        className
      )}
    >
      {children}
    </button>
  );
}

function statusTone(status) {
  const s = String(status || "").toLowerCase();
  if (s === "completed") return "good";
  if (s === "assigned") return "warn";
  if (s === "draft") return "neutral";
  return "neutral";
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
        <div className="w-full max-w-xl bg-white rounded-2xl shadow-xl border border-gray-200">
          <div className="p-5 border-b flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-lg font-extrabold text-gray-900 truncate">
                {title}
              </p>
              <p className="text-[12px] text-gray-500 mt-1">
                Upload proof or mark complete.
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

/**
 * Swipe-to-act helper:
 * - drag right => triggers onCommit
 * - includes desktop pointer drag + mobile touch drag
 */
function SwipeRow({ children, onCommit, disabled = false, hint = "Swipe right to upload" }) {
  const [dx, setDx] = useState(0);
  const [dragging, setDragging] = useState(false);
  const startX = useRef(0);

  const threshold = 90; // px to trigger

  const onDown = (e) => {
    if (disabled) return;
    setDragging(true);
    startX.current = e.touches ? e.touches[0].clientX : e.clientX;
  };

  const onMove = (e) => {
    if (!dragging || disabled) return;
    const x = e.touches ? e.touches[0].clientX : e.clientX;
    const d = Math.max(0, x - startX.current);
    setDx(Math.min(d, 140));
  };

  const onUp = () => {
    if (!dragging) return;
    setDragging(false);
    if (dx >= threshold) {
      setDx(0);
      onCommit?.();
      return;
    }
    setDx(0);
  };

  return (
    <div
      className="relative"
      onMouseDown={onDown}
      onMouseMove={onMove}
      onMouseUp={onUp}
      onMouseLeave={onUp}
      onTouchStart={onDown}
      onTouchMove={onMove}
      onTouchEnd={onUp}
      role="group"
      aria-label={hint}
    >
      {/* background action */}
      <div className="absolute inset-0 rounded-2xl border border-blue-100 bg-blue-50 flex items-center justify-end pr-4">
        <div className="flex items-center gap-2 text-[#46769B] font-semibold text-sm">
          <Camera className="w-4 h-4" />
          {hint}
        </div>
      </div>

      {/* foreground */}
      <div
        className="relative rounded-2xl"
        style={{
          transform: `translateX(${dx}px)`,
          transition: dragging ? "none" : "transform 220ms ease",
        }}
      >
        {children}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Date helpers                                                               */
/* -------------------------------------------------------------------------- */

function pad2(n) {
  return String(n).padStart(2, "0");
}

function toISODateLocal(d) {
  // local YYYY-MM-DD (no timezone shift)
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function labelForDate(iso) {
  // iso: YYYY-MM-DD
  const d = new Date(`${iso}T12:00:00`);
  const today = new Date();
  const todayIso = toISODateLocal(today);

  if (iso === todayIso) return "Today";

  const yesterdayIso = toISODateLocal(addDays(today, -1));
  if (iso === yesterdayIso) return "Yesterday";

  const tomorrowIso = toISODateLocal(addDays(today, 1));
  if (iso === tomorrowIso) return "Tomorrow";

  return d.toLocaleDateString(undefined, { weekday: "short" });
}

function prettyDate(iso) {
  const d = new Date(`${iso}T12:00:00`);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/* -------------------------------------------------------------------------- */
/* Page                                                                       */
/* -------------------------------------------------------------------------- */

export default function AthleteToday() {
  const router = useRouter();
  const { user, authReady } = useAuthContext();

  const [loading, setLoading] = useState(true);
  const [dailyWorkout, setDailyWorkout] = useState(null);
  const [items, setItems] = useState([]);
  const [err, setErr] = useState("");

  // Selected day (Skimmer-style)
  const [selectedDate, setSelectedDate] = useState(() => toISODateLocal(new Date()));

  // Modal upload state
  const [modalOpen, setModalOpen] = useState(false);
  const [activeItem, setActiveItem] = useState(null);
  const [submittingId, setSubmittingId] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);
  const [coachNote, setCoachNote] = useState("");

  const role = useMemo(() => {
    const raw = String(user?.role || user?.Role || "").trim().toLowerCase();
    if (!raw) return "";
    if (raw.includes("ath")) return "athlete";
    return raw;
  }, [user]);

  const isAthlete = role === "athlete";

  const dateStrip = useMemo(() => {
    // Show 7-day strip centered on selectedDate
    const base = new Date(`${selectedDate}T12:00:00`);
    const start = addDays(base, -3);
    return Array.from({ length: 7 }).map((_, i) => {
      const d = addDays(start, i);
      const iso = toISODateLocal(d);
      return { iso, label: labelForDate(iso), pretty: prettyDate(iso) };
    });
  }, [selectedDate]);

  const load = useCallback(
    async (isoDate) => {
      const date = isoDate || selectedDate;

      setErr("");
      setLoading(true);
      try {
        // Prefer day-based endpoint (optional if you build it)
        let res = await fetch(
          `/api/athlete/workouts/byDate?date=${encodeURIComponent(date)}`,
          { credentials: "include" }
        );

        // Fallback to today endpoint if byDate doesn't exist yet
        if (!res.ok && (res.status === 404 || res.status === 405)) {
          res = await fetch("/api/athlete/workouts/today", {
            credentials: "include",
          });
        }

        const data = await safeJson(res);
        if (!res.ok) throw new Error(data?.error || "Failed to load workout");

        setDailyWorkout(data?.dailyWorkout || null);
        setItems(Array.isArray(data?.items) ? data.items : []);
      } catch (e) {
        setErr(e?.message || "Failed to load");
        setDailyWorkout(null);
        setItems([]);
      } finally {
        setLoading(false);
      }
    },
    [selectedDate]
  );

  useEffect(() => {
    if (!authReady) return;
    if (!user) return;
    if (!isAthlete) return;
    load(selectedDate);
  }, [authReady, user, isAthlete, selectedDate, load]);

  if (!authReady) return null;
  if (!user) return <div style={{ padding: 24 }}>Please log in.</div>;
  if (!isAthlete) return <div style={{ padding: 24 }}>Not authorized.</div>;

  const openUploadModal = (item) => {
    setErr("");
    setSelectedFile(null);
    setCoachNote("");
    setActiveItem(item);
    setModalOpen(true);
  };

  const closeUploadModal = () => {
    setModalOpen(false);
    setActiveItem(null);
    setSelectedFile(null);
    setCoachNote("");
    setSubmittingId("");
  };

  // Upload helper: POST /api/upload/image -> { url }
  const uploadImage = async (file) => {
    const fd = new FormData();
    fd.append("file", file);

    const res = await fetch("/api/upload/image", {
      method: "POST",
      body: fd,
    });

    const data = await safeJson(res);
    if (!res.ok) throw new Error(data?.error || "Image upload failed");
    const url = String(data?.url || "").trim();
    if (!url) throw new Error("Upload failed: missing URL");
    return url;
  };

  /**
   * Submit completion:
   * - If file selected: upload file first -> get URL -> send JSON to completeItem
   * - If no file: optional URL prompt or complete without proof
   */
  const submitCompletion = async ({ workoutItemId, evidenceRequired }) => {
    setErr("");
    setSubmittingId(workoutItemId);

    try {
      let usedFile = selectedFile;

      // If no file selected, fallback to URL prompt for MVP (optional)
      if (!usedFile) {
        const wantsMvpUrl = !evidenceRequired;
        const fileUrl = wantsMvpUrl
          ? window.prompt(
              "Optional: paste a photo URL (MVP). Leave blank to mark complete without proof."
            )
          : window.prompt("Proof required: paste a photo URL (MVP) OR cancel and upload a file.");

        if (fileUrl && String(fileUrl).trim()) {
          const res = await fetch("/api/athlete/workouts/completeItem", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({
              workoutItemId,
              fileUrl: String(fileUrl).trim(),
              note: coachNote || "",
            }),
          });
          const data = await safeJson(res);
          if (!res.ok) throw new Error(data?.error || "Failed to submit");
          await load(selectedDate);
          closeUploadModal();
          return;
        }

        if (evidenceRequired) {
          throw new Error("This item requires a photo. Please upload an image (or provide a URL).");
        }

        const res = await fetch("/api/athlete/workouts/completeItem", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ workoutItemId, fileUrl: "", note: coachNote || "" }),
        });
        const data = await safeJson(res);
        if (!res.ok) throw new Error(data?.error || "Failed to submit");
        await load(selectedDate);
        closeUploadModal();
        return;
      }

      // ✅ Correct flow: upload -> URL -> JSON completion
      const uploadedUrl = await uploadImage(usedFile);

      const res = await fetch("/api/athlete/workouts/completeItem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          workoutItemId,
          fileUrl: uploadedUrl,
          note: coachNote || "",
        }),
      });

      const data = await safeJson(res);
      if (!res.ok) throw new Error(data?.error || "Failed to submit");

      await load(selectedDate);
      closeUploadModal();
    } catch (e) {
      setErr(e?.message || "Failed to submit");
    } finally {
      setSubmittingId("");
    }
  };

  // Quick-complete (no modal) for “optional proof” items
  const quickComplete = async (workoutItemId) => {
    setErr("");
    setSubmittingId(workoutItemId);
    try {
      const res = await fetch("/api/athlete/workouts/completeItem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ workoutItemId, fileUrl: "", note: "" }),
      });
      const data = await safeJson(res);
      if (!res.ok) throw new Error(data?.error || "Failed to submit");
      await load(selectedDate);
    } catch (e) {
      setErr(e?.message || "Failed to submit");
    } finally {
      setSubmittingId("");
    }
  };

  const completedCount = useMemo(() => {
    const list = Array.isArray(items) ? items : [];
    return list.filter(
      (x) =>
        String(x?.Completed || x?.completed || "").toLowerCase() === "true" ||
        String(x?.Status || "").toLowerCase() === "completed"
    ).length;
  }, [items]);

  const totalCount = Array.isArray(items) ? items.length : 0;
  const pct = totalCount ? Math.round((completedCount / totalCount) * 100) : 0;

  const workoutStatus = String(dailyWorkout?.Status || "").toLowerCase();

  const goPrev = () =>
    setSelectedDate((d) => toISODateLocal(addDays(new Date(`${d}T12:00:00`), -1)));
  const goNext = () =>
    setSelectedDate((d) => toISODateLocal(addDays(new Date(`${d}T12:00:00`), 1)));

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-blue-50 text-gray-900 font-sans">
      <main className="max-w-5xl mx-auto px-4 py-8 space-y-6">
        {/* Header */}
        <div className="bg-white rounded-2xl shadow-md border border-blue-100 p-6">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <CalendarDays className="w-6 h-6 text-[#46769B]" />
                  <motion.h1
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-2xl font-extrabold truncate"
                  >
                    {labelForDate(selectedDate)}
                  </motion.h1>

                  <Pill>{prettyDate(selectedDate)}</Pill>
                </div>

                <p className="text-sm text-gray-600 mt-1">
                  {user?.Name || user?.name || "Athlete"} •{" "}
                  <span className="font-semibold">{user?.Email || user?.email}</span>
                </p>

                <div className="mt-3 flex flex-wrap gap-2">
                  {dailyWorkout ? (
                    <>
                      <Pill tone={statusTone(dailyWorkout?.Status)}>
                        {dailyWorkout?.Status || "assigned"}
                      </Pill>
                      <Pill tone={pct === 100 && totalCount > 0 ? "good" : "warn"}>
                        Progress: {completedCount}/{totalCount} ({pct}%)
                      </Pill>
                      {dailyWorkout?.Date ? <Pill>{dailyWorkout.Date}</Pill> : null}
                    </>
                  ) : (
                    <Pill tone="warn">
                      <AlertTriangle className="w-3.5 h-3.5 mr-1.5" />
                      No workout assigned
                    </Pill>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" onClick={() => load(selectedDate)} disabled={loading}>
                  <RefreshCcw className="w-4 h-4" />
                  Refresh
                </Button>
                <Button variant="secondary" onClick={() => router.push("/dashboard")}>
                  Back
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Date strip (Skimmer-style) */}
            <div className="rounded-2xl border border-gray-200 bg-gray-50 p-3">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={goPrev}
                  className="p-2 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 disabled:opacity-60"
                  disabled={loading}
                  aria-label="Previous day"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>

                <div className="flex-1 overflow-x-auto">
                  <div className="flex gap-2 min-w-max px-1">
                    {dateStrip.map((d) => {
                      const active = d.iso === selectedDate;
                      return (
                        <button
                          key={d.iso}
                          type="button"
                          onClick={() => setSelectedDate(d.iso)}
                          disabled={loading}
                          className={classNames(
                            "px-3 py-2 rounded-2xl border text-left transition min-w-[92px]",
                            active
                              ? "bg-[#46769B] text-white border-[#46769B]"
                              : "bg-white text-gray-900 border-gray-200 hover:bg-gray-50"
                          )}
                        >
                          <div
                            className={classNames(
                              "text-xs font-extrabold",
                              active ? "text-white" : "text-gray-900"
                            )}
                          >
                            {d.label}
                          </div>
                          <div
                            className={classNames(
                              "text-[11px]",
                              active ? "text-white/90" : "text-gray-500"
                            )}
                          >
                            {d.pretty}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={goNext}
                  className="p-2 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 disabled:opacity-60"
                  disabled={loading}
                  aria-label="Next day"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              <div className="mt-2 text-[11px] text-gray-500">
                Tip: tap a day to view its workout, then swipe right on an item to upload proof.
              </div>
            </div>

            {err ? (
              <div className="rounded-2xl border border-red-200 bg-red-50 p-4">
                <p className="text-sm text-red-700 font-semibold">{err}</p>
              </div>
            ) : null}

            {loading ? (
              <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4">
                <p className="text-sm text-gray-800 font-semibold">Loading workout…</p>
                <p className="text-[11px] text-gray-600 mt-1">
                  Pulling your plan and items for{" "}
                  <span className="font-semibold">{selectedDate}</span>.
                </p>
              </div>
            ) : null}
          </div>
        </div>

        {/* Workout card */}
        {!loading && !dailyWorkout ? (
          <div className="bg-white rounded-2xl shadow-md border border-blue-100 p-6">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-600" />
              <p className="text-sm font-semibold text-gray-900">
                No workout assigned for this day.
              </p>
            </div>
            <p className="text-[12px] text-gray-600 mt-2">
              If you think this is wrong, refresh or contact your coach.
            </p>
          </div>
        ) : null}

        {!loading && dailyWorkout ? (
          <div className="bg-white rounded-2xl shadow-md border border-blue-100 p-6">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-xs text-gray-500">Daily Workout</p>
                <p className="text-lg font-extrabold text-gray-900 mt-1 truncate">
                  {dailyWorkout?.Title || "Daily Workout"}
                </p>
                <p className="text-[12px] text-gray-600 mt-2">
                  Swipe right on an item to upload a photo — or tap Upload. Optional items can be
                  quick-completed.
                </p>
              </div>

              <div className="flex flex-col items-end gap-2">
                <Pill tone={statusTone(dailyWorkout?.Status)}>
                  {dailyWorkout?.Status || "assigned"}
                </Pill>
                {workoutStatus === "completed" ? (
                  <Pill tone="good">
                    <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
                    Workout complete
                  </Pill>
                ) : null}
              </div>
            </div>

            {/* Items */}
            <div className="mt-5 space-y-3">
              {(Array.isArray(items) ? items : []).map((it) => {
                const id = String(it?.id || it?.ID || "");
                const exercise = it?.ExerciseName || it?.Title || "Exercise";
                const evidenceRequired = String(it?.EvidenceRequired || "").toLowerCase() === "true";
                const isDone =
                  String(it?.Completed || it?.completed || "").toLowerCase() === "true" ||
                  String(it?.Status || "").toLowerCase() === "completed";

                const metaBits = [
                  it?.Sets ? `${it.Sets} sets` : "",
                  it?.Reps ? `${it.Reps} reps` : "",
                  it?.Load ? `Load: ${it.Load}` : "",
                  it?.RPE ? `RPE: ${it.RPE}` : "",
                  it?.Rest ? `Rest: ${it.Rest}` : "",
                ].filter(Boolean);

                const busy = submittingId === id;

                return (
                  <SwipeRow
                    key={id || Math.random().toString(36).slice(2)}
                    disabled={isDone || busy}
                    onCommit={() => openUploadModal({ ...it, id })}
                    hint={isDone ? "Completed" : "Swipe right to upload"}
                  >
                    <div className="rounded-2xl border border-gray-200 bg-white p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-extrabold text-gray-900 truncate">{exercise}</p>
                            {isDone ? (
                              <Pill tone="good">
                                <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
                                Done
                              </Pill>
                            ) : evidenceRequired ? (
                              <Pill tone="warn">
                                <AlertTriangle className="w-3.5 h-3.5 mr-1.5" />
                                Photo required
                              </Pill>
                            ) : (
                              <Pill>Optional photo</Pill>
                            )}
                            {busy ? <Pill tone="warn">Submitting…</Pill> : null}
                          </div>

                          {metaBits.length ? (
                            <p className="text-[12px] text-gray-600 mt-2">
                              {metaBits.join(" • ")}
                            </p>
                          ) : null}

                          {it?.Instructions ? (
                            <div className="mt-3 rounded-2xl border border-gray-200 bg-gray-50 p-3">
                              <p className="text-[12px] text-gray-700 whitespace-pre-wrap">
                                {it.Instructions}
                              </p>
                            </div>
                          ) : null}

                          {it?.VideoURL ? (
                            <a
                              href={it.VideoURL}
                              target="_blank"
                              rel="noreferrer"
                              className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-[#46769B] hover:underline"
                            >
                              <PlayCircle className="w-4 h-4" />
                              Watch demo video
                            </a>
                          ) : null}
                        </div>

                        <div className="flex flex-col gap-2">
                          <Button
                            variant="secondary"
                            className="px-3 py-2 text-xs"
                            onClick={() => openUploadModal({ ...it, id })}
                            disabled={isDone || busy}
                            title="Upload photo / complete"
                          >
                            <Upload className="w-4 h-4" />
                            Upload
                          </Button>

                          {!isDone && !evidenceRequired ? (
                            <Button
                              variant="dark"
                              className="px-3 py-2 text-xs"
                              onClick={() => quickComplete(id)}
                              disabled={busy}
                              title="Mark complete without uploading"
                            >
                              <CheckCircle2 className="w-4 h-4" />
                              Done
                            </Button>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </SwipeRow>
                );
              })}

              {items?.length === 0 ? (
                <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                  <p className="text-sm font-extrabold text-gray-900">No items</p>
                  <p className="text-[12px] text-gray-600 mt-1">
                    A workout exists for this day, but no WorkoutItems were linked.
                  </p>
                </div>
              ) : null}
            </div>
          </div>
        ) : null}

        {/* Upload modal */}
        <Modal
          open={modalOpen}
          title={
            activeItem
              ? `Complete: ${activeItem?.ExerciseName || activeItem?.Title || "Workout item"}`
              : "Complete item"
          }
          onClose={closeUploadModal}
        >
          {activeItem ? (
            <div className="space-y-4">
              <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                <p className="text-xs text-gray-500 flex items-center gap-2">
                  <Info className="w-4 h-4 text-gray-400" />
                  Tip
                </p>
                <p className="text-[12px] text-gray-700 mt-2">
                  Quick proof works best: machine display, bar on rack, treadmill screen, or a selfie
                  in the gym.
                </p>
              </div>

              <div className="rounded-2xl border border-gray-200 p-4">
                <p className="text-sm font-extrabold text-gray-900">Upload proof</p>
                <p className="text-[12px] text-gray-600 mt-1">
                  On mobile, this can open your camera if supported.
                </p>

                <div className="mt-3 grid gap-3">
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                    className="block w-full text-sm"
                  />

                  {selectedFile ? (
                    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3">
                      <p className="text-[12px] text-emerald-900 font-semibold">
                        Selected: {selectedFile.name}
                      </p>
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-gray-200 bg-gray-50 p-3">
                      <p className="text-[12px] text-gray-600">
                        No file selected{" "}
                        {String(activeItem?.EvidenceRequired || "").toLowerCase() === "true"
                          ? "(required for this item)."
                          : "(optional for this item)."}
                      </p>
                    </div>
                  )}

                  <textarea
                    className="w-full min-h-[90px] px-4 py-3 rounded-xl border border-gray-300 bg-white text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#46769B]"
                    placeholder="Optional note (e.g. felt easy today / changed weight / short on time)"
                    value={coachNote}
                    onChange={(e) => setCoachNote(e.target.value)}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="secondary" onClick={closeUploadModal}>
                  Cancel
                </Button>

                <Button
                  onClick={() =>
                    submitCompletion({
                      workoutItemId: String(activeItem?.id || ""),
                      evidenceRequired:
                        String(activeItem?.EvidenceRequired || "").toLowerCase() === "true",
                    })
                  }
                  disabled={!activeItem?.id || submittingId === String(activeItem?.id)}
                >
                  <Camera className="w-4 h-4" />
                  {submittingId === String(activeItem?.id) ? "Submitting…" : "Complete"}
                </Button>
              </div>

              <p className="text-[11px] text-gray-500">
                If you haven’t built /api/upload/image yet, leave file empty and paste a URL when prompted.
              </p>
            </div>
          ) : null}
        </Modal>
      </main>
    </div>
  );
}
