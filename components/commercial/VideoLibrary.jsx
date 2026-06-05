// components/commercial/VideoLibrary.jsx
// Videos + Workouts tabs. Trainer-facing library manager.
// Cards now surface a "One-Time" price badge when an item has a one-time price.
"use client";

import { useState, useEffect, useCallback } from "react";
import { CheckCircle2, Upload, Video, X, ArrowRight, Dumbbell, Plus, Edit2 } from "lucide-react";
import VideoUpload from "./VideoUpload";
import WorkoutBuilder from "./WorkoutBuilder";
import { DS } from "@/components/org/dashboard/DashboardUI";

// ─── Config ───────────────────────────────────────────────────────────────────

const TIER_STYLE = {
  Basic:   { bg: DS.safeBg,    color: DS.safe,    border: DS.safeBorder    },
  Premium: { bg: DS.cautionBg, color: DS.caution, border: DS.cautionBorder },
  Ultra:   { bg: DS.brandBg,   color: DS.brand,   border: DS.brandBorder   },
};

const STATUS_STYLE = {
  ready:      { bg: DS.safeBg,    color: DS.safe,    label: "Ready"       },
  processing: { bg: DS.cautionBg, color: DS.caution, label: "Processing…" },
  pending:    { bg: DS.pageBg,    color: DS.dimText, label: "Pending"     },
  error:      { bg: DS.bannedBg,  color: DS.banned,  label: "Error"       },
};

function muxThumb(id) {
  return `https://image.mux.com/${id}/thumbnail.jpg?width=480&height=270&fit_mode=smartcrop`;
}

function fmtDuration(secs) {
  if (!secs) return null;
  const m = Math.floor(secs / 60), s = secs % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

// ─── Launch checklist ─────────────────────────────────────────────────────────

function LaunchChecklist({ trainerSlug, onUploadClick }) {
  const steps = [
    { n: 1, done: true,  title: "Profile created",       desc: "Your public trainer profile is live."                               },
    { n: 2, done: false, active: true, title: "Add your first video",  desc: "Upload a file or paste a YouTube/Vimeo link.",
      cta: { label: "Add first video", action: onUploadClick } },
    { n: 3, done: false, title: "Add your first client", desc: "Add a client by email — they get instant access."                    },
  ];

  return (
    <div className="rounded-sm overflow-hidden"
      style={{ backgroundColor: DS.cardBg, border: `1px solid ${DS.border}`, borderTop: `3px solid ${DS.brand}` }}>
      <div className="px-5 py-4 border-b" style={{ borderColor: DS.border, backgroundColor: DS.pageBg }}>
        <p className="text-[10px] font-black uppercase tracking-wider mb-0.5" style={{ color: DS.brand }}>Getting started</p>
        <p className="text-sm font-black" style={{ color: DS.bodyText }}>Launch your library</p>
        <p className="text-xs mt-0.5" style={{ color: DS.labelText }}>Three steps to your first paying client.</p>
      </div>
      <div className="px-5 py-4">
        {steps.map((step, i) => (
          <div key={step.n} className="flex gap-4">
            <div className="flex flex-col items-center shrink-0 w-8">
              <div className="w-8 h-8 rounded-sm flex items-center justify-center shrink-0 text-xs font-black"
                style={{ backgroundColor: step.done ? DS.safe : step.active ? DS.brand : DS.pageBg, border: step.done || step.active ? "none" : `1px solid ${DS.border}`, color: step.done || step.active ? "#fff" : DS.dimText }}>
                {step.done ? <CheckCircle2 className="w-4 h-4" /> : step.n}
              </div>
              {i < steps.length - 1 && <div className="w-px flex-1 my-1.5" style={{ backgroundColor: step.done ? DS.safe : DS.border, minHeight: 20 }} />}
            </div>
            <div className={`flex-1 ${i < steps.length - 1 ? "pb-5" : "pb-0"}`} style={{ paddingTop: 4 }}>
              <p className="text-xs font-black mb-1 flex items-center gap-2" style={{ color: step.done ? DS.dimText : DS.bodyText }}>
                {step.title}
                {step.done && <span className="px-1.5 py-0.5 rounded-sm text-[10px] font-black" style={{ backgroundColor: DS.safeBg, color: DS.safe }}>Done</span>}
              </p>
              <p className="text-[11px] leading-relaxed mb-2" style={{ color: DS.labelText }}>{step.desc}</p>
              {step.cta && (
                <button type="button" onClick={step.cta.action}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-sm text-xs font-black transition"
                  style={{ backgroundColor: DS.brand, color: "#fff" }}>
                  <Upload className="w-3 h-3" />{step.cta.label}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
      {trainerSlug && (
        <div className="flex items-center justify-between gap-3 px-5 py-3 border-t" style={{ borderColor: DS.border, backgroundColor: DS.pageBg }}>
          <div>
            <p className="text-[10px] font-black uppercase tracking-wider" style={{ color: DS.brand }}>Your public profile is live</p>
            <p className="text-[11px]" style={{ color: DS.dimText }}>checkpeak.com/trainer/{trainerSlug}</p>
          </div>
          <a href={`/trainer/${trainerSlug}`} target="_blank" rel="noopener"
            className="flex items-center gap-1 text-[11px] font-bold" style={{ color: DS.brand }}>
            View <ArrowRight className="w-3 h-3" />
          </a>
        </div>
      )}
    </div>
  );
}

// ─── Video card ───────────────────────────────────────────────────────────────

function VideoCard({ video, onTogglePublish, onDelete }) {
  const f       = video.fields ?? {};
  const status  = f.status ?? "pending";
  const isReady = status === "ready";
  const thumb = videoThumb(f, 480, 270);
  const tier    = f.tier ?? "Basic";
  const ts      = TIER_STYLE[tier] ?? TIER_STYLE.Basic;
  const ss      = STATUS_STYLE[status] ?? STATUS_STYLE.pending;
  const price   = Number(f.price) > 0 ? Number(f.price) : null;
  const [publishing, setPublishing] = useState(false);

  async function toggle() {
    setPublishing(true);
    await onTogglePublish(video.id, !f.published);
    setPublishing(false);
  }

  return (
    <div className="rounded-sm overflow-hidden transition-shadow hover:shadow-md"
      style={{ backgroundColor: DS.cardBg, border: `1px solid ${DS.border}` }}>
      <div className="relative" style={{ paddingBottom: "56.25%", backgroundColor: DS.pageBg, overflow: "hidden" }}>
        {thumb
          ? <img src={thumb} alt={f.title} className="absolute inset-0 w-full h-full object-cover" />
          : <div className="absolute inset-0 flex items-center justify-center">
              {status === "processing"
                ? <div className="flex flex-col items-center gap-1.5">
                    <div className="w-5 h-5 border-2 rounded-full animate-spin" style={{ borderColor: DS.border, borderTopColor: DS.brand }} />
                    <span className="text-[10px]" style={{ color: DS.dimText }}>Transcoding…</span>
                  </div>
                : <Video className="w-8 h-8" style={{ color: DS.brandBorder }} />
              }
            </div>
        }
        {fmtDuration(f.duration) && (
          <span className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded-sm text-[10px] font-bold" style={{ backgroundColor: "rgba(0,0,0,0.65)", color: "#fff" }}>
            {fmtDuration(f.duration)}
          </span>
        )}
        <div className="absolute top-0 left-0 right-0 h-0.5 transition-colors" style={{ backgroundColor: f.published ? DS.safe : "transparent" }} />
      </div>
      <div className="p-3">
        <p className="text-xs font-black mb-2 truncate" style={{ color: DS.bodyText }}>{f.title || "Untitled"}</p>
        <div className="flex flex-wrap gap-1 mb-3">
          <span className="px-1.5 py-0.5 rounded-sm text-[10px] font-black" style={{ backgroundColor: ts.bg, border: `1px solid ${ts.border}`, color: ts.color }}>{tier}</span>
          <span className="px-1.5 py-0.5 rounded-sm text-[10px] font-black" style={{ backgroundColor: ss.bg, color: ss.color }}>{ss.label}</span>
          {price != null && (
            <span className="px-1.5 py-0.5 rounded-sm text-[10px] font-black" style={{ backgroundColor: DS.brandBg, border: `1px solid ${DS.brandBorder}`, color: DS.brand }}>
              ${price} · One-Time
            </span>
          )}
        </div>
        <div className="flex items-center justify-between">
          <button type="button" onClick={isReady && !publishing ? toggle : undefined} disabled={!isReady || publishing} className="flex items-center gap-2 disabled:opacity-40">
            <div className="relative transition-colors" style={{ width: 32, height: 18, borderRadius: 99, backgroundColor: f.published ? DS.safe : DS.border }}>
              <div className="absolute top-0.5 transition-all" style={{ left: f.published ? 16 : 2, width: 14, height: 14, borderRadius: 99, backgroundColor: "#fff" }} />
            </div>
            <span className="text-[11px] font-bold" style={{ color: f.published ? DS.safe : DS.labelText }}>
              {f.published ? "Live" : isReady ? "Publish" : "Not ready"}
            </span>
          </button>
          <button type="button" onClick={() => onDelete(video.id)} className="transition" style={{ color: DS.dimText }}
            onMouseEnter={e => { e.currentTarget.style.color = DS.banned; }}
            onMouseLeave={e => { e.currentTarget.style.color = DS.dimText; }}>
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

function ytId(url = "") {
  const m = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{11})/);
  return m ? m[1] : null;
}

// Best available thumbnail: stored → Mux → YouTube-derived → none.
function videoThumb(f = {}, w = 480, h = 270) {
  if (f.thumbnailUrl) return f.thumbnailUrl;                 // captured at save time (Vimeo, etc.)
  if (f.muxPlaybackId) return `https://image.mux.com/${f.muxPlaybackId}/thumbnail.jpg?width=${w}&height=${h}&fit_mode=smartcrop`;
  const yt = ytId(f.embedUrl);
  if (yt) return `https://img.youtube.com/vi/${yt}/hqdefault.jpg`;
  return null;                                              // Vimeo w/o stored thumb, or unknown source
}

// ─── Workout card ─────────────────────────────────────────────────────────────

function WorkoutCard({ workout, onTogglePublish, onDelete, onEdit }) {
  const f         = workout.fields ?? {};
  const tier      = f.tier ?? "Basic";
  const ts        = TIER_STYLE[tier] ?? TIER_STYLE.Basic;
  const price     = Number(f.price) > 0 ? Number(f.price) : null;
  const [publishing, setPublishing] = useState(false);

  let exercises = [];
  try { exercises = JSON.parse(f.exercises || "[]"); } catch {}

  const exerciseCount = exercises.filter(ex => String(ex.ExerciseName || "").trim()).length;
  const groups        = [...new Set(exercises.map(ex => ex.groupId).filter(Boolean))];
  const hasGroups     = groups.length > 0;

  async function toggle() {
    setPublishing(true);
    await onTogglePublish(workout.id, !f.published);
    setPublishing(false);
  }

  return (
    <div className="rounded-sm overflow-hidden transition-shadow hover:shadow-md"
      style={{ backgroundColor: DS.cardBg, border: `1px solid ${DS.border}` }}>
      {/* Header */}
      <div className="p-3 border-b" style={{ borderColor: DS.border, backgroundColor: DS.pageBg }}>
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="w-8 h-8 rounded-sm flex items-center justify-center flex-shrink-0" style={{ backgroundColor: ts.bg, border: `1px solid ${ts.border}` }}>
            <Dumbbell className="w-4 h-4" style={{ color: ts.color }} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-black truncate" style={{ color: DS.bodyText }}>{f.title || "Untitled"}</p>
            {f.description && (
              <p className="text-[11px] truncate mt-0.5" style={{ color: DS.dimText }}>{f.description}</p>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-1">
          <span className="px-1.5 py-0.5 rounded-sm text-[10px] font-black" style={{ backgroundColor: ts.bg, border: `1px solid ${ts.border}`, color: ts.color }}>{tier}</span>
          <span className="px-1.5 py-0.5 rounded-sm text-[10px] font-semibold" style={{ backgroundColor: DS.pageBg, color: DS.dimText, border: `1px solid ${DS.border}` }}>
            {exerciseCount} exercise{exerciseCount !== 1 ? "s" : ""}
          </span>
          {hasGroups && (
            <span className="px-1.5 py-0.5 rounded-sm text-[10px] font-semibold" style={{ backgroundColor: "rgba(124,58,237,0.08)", color: "#7C3AED", border: "1px solid rgba(124,58,237,0.2)" }}>
              Supersets
            </span>
          )}
          {price != null && (
            <span className="px-1.5 py-0.5 rounded-sm text-[10px] font-black" style={{ backgroundColor: DS.brandBg, color: DS.brand, border: `1px solid ${DS.brandBorder}` }}>
              ${price} · One-Time
            </span>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="p-3 flex items-center justify-between">
        <button type="button" onClick={!publishing ? toggle : undefined} disabled={publishing} className="flex items-center gap-2 disabled:opacity-40">
          <div className="relative transition-colors" style={{ width: 32, height: 18, borderRadius: 99, backgroundColor: f.published ? DS.safe : DS.border }}>
            <div className="absolute top-0.5 transition-all" style={{ left: f.published ? 16 : 2, width: 14, height: 14, borderRadius: 99, backgroundColor: "#fff" }} />
          </div>
          <span className="text-[11px] font-bold" style={{ color: f.published ? DS.safe : DS.labelText }}>
            {f.published ? "Live" : "Publish"}
          </span>
        </button>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => onEdit(workout)} className="transition" style={{ color: DS.brand }}
            onMouseEnter={e => { e.currentTarget.style.opacity = "0.7"; }}
            onMouseLeave={e => { e.currentTarget.style.opacity = "1"; }}>
            <Edit2 className="w-3.5 h-3.5" />
          </button>
          <button type="button" onClick={() => onDelete(workout.id)} className="transition" style={{ color: DS.dimText }}
            onMouseEnter={e => { e.currentTarget.style.color = DS.banned; }}
            onMouseLeave={e => { e.currentTarget.style.color = DS.dimText; }}>
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Upload modal ─────────────────────────────────────────────────────────────

function UploadModal({ onClose, trainerId, onSuccess }) {
  return (
    <div className="fixed inset-0 z-[200] flex items-start justify-center overflow-y-auto"
      style={{ paddingTop: 80, paddingBottom: 40, paddingLeft: 16, paddingRight: 16, backgroundColor: "rgba(0,0,0,0.5)" }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="w-full max-w-xl rounded-sm" style={{ backgroundColor: DS.cardBg, border: `1px solid ${DS.border}` }}>
        <div className="flex items-center justify-between px-5 py-3 border-b" style={{ borderColor: DS.border }}>
          <p className="text-sm font-black" style={{ color: DS.bodyText }}>Add video to library</p>
          <button type="button" onClick={onClose} className="transition" style={{ color: DS.dimText }}
            onMouseEnter={e => { e.currentTarget.style.color = DS.bodyText; }}
            onMouseLeave={e => { e.currentTarget.style.color = DS.dimText; }}>
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-5">
          <VideoUpload trainerId={trainerId} onSuccess={onSuccess} />
        </div>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function VideoLibrary({ trainerId, trainerSlug, onVideoCountChange }) {
  const [libraryTab, setLibraryTab]   = useState("videos");  // "videos" | "workouts"

  // Videos state
  const [videos,      setVideos]      = useState([]);
  const [videosLoading, setVideosLoading] = useState(true);
  const [showUpload,  setShowUpload]  = useState(false);
  const [videoFilter, setVideoFilter] = useState("all");

  // Workouts state
  const [workouts,     setWorkouts]     = useState([]);
  const [workoutsLoading, setWorkoutsLoading] = useState(true);
  const [showBuilder,  setShowBuilder]  = useState(false);
  const [editingWorkout, setEditingWorkout] = useState(null);
  const [workoutFilter, setWorkoutFilter] = useState("all");

  // ── Load videos ──────────────────────────────────────────────────────────
  const loadVideos = useCallback(async () => {
    setVideosLoading(true);
    const res = await fetch("/api/commercial/videos", { credentials: "include" });
    if (res.ok) {
      const vids = (await res.json()).videos ?? [];
      setVideos(vids);
      onVideoCountChange?.(vids.length);
    }
    setVideosLoading(false);
  }, [onVideoCountChange]);

  useEffect(() => { loadVideos(); }, [loadVideos]);

  useEffect(() => {
    const hasProcessing = videos.some(v => ["pending", "processing"].includes(v.fields?.status));
    if (!hasProcessing) return;
    const t = setTimeout(loadVideos, 8000);
    return () => clearTimeout(t);
  }, [videos, loadVideos]);

  // ── Load workouts ────────────────────────────────────────────────────────
  const loadWorkouts = useCallback(async () => {
    setWorkoutsLoading(true);
    const res = await fetch("/api/commercial/workout-programs", { credentials: "include" });
    if (res.ok) setWorkouts((await res.json()).workouts ?? []);
    setWorkoutsLoading(false);
  }, []);

  useEffect(() => { loadWorkouts(); }, [loadWorkouts]);

  // ── Video actions ─────────────────────────────────────────────────────────
  async function toggleVideoPublish(id, published) {
    await fetch(`/api/commercial/videos?id=${id}`, {
      method: "PUT", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ published }),
    });
    setVideos(prev => prev.map(v => v.id === id ? { ...v, fields: { ...v.fields, published } } : v));
  }

  async function deleteVideo(id) {
    if (!confirm("Remove this video? This can't be undone.")) return;
    await fetch(`/api/commercial/videos?id=${id}&hard=true`, { method: "DELETE", credentials: "include" });
    setVideos(prev => { const u = prev.filter(v => v.id !== id); onVideoCountChange?.(u.length); return u; });
  }

  // ── Workout actions ───────────────────────────────────────────────────────
  async function toggleWorkoutPublish(id, published) {
    await fetch(`/api/commercial/workout-programs?id=${id}`, {
      method: "PUT", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ published }),
    });
    setWorkouts(prev => prev.map(w => w.id === id ? { ...w, fields: { ...w.fields, published } } : w));
  }

  async function deleteWorkout(id) {
    if (!confirm("Delete this workout?")) return;
    await fetch(`/api/commercial/workout-programs?id=${id}`, { method: "DELETE", credentials: "include" });
    setWorkouts(prev => prev.filter(w => w.id !== id));
  }

  function handleWorkoutSaved(workout) {
    if (editingWorkout) {
      setWorkouts(prev => prev.map(w => w.id === workout.id ? workout : w));
    } else {
      setWorkouts(prev => [workout, ...prev]);
    }
    setEditingWorkout(null);
  }

  // ── Filtered lists ────────────────────────────────────────────────────────
  const filteredVideos = videos.filter(v => {
    if (videoFilter === "all")     return true;
    if (videoFilter === "live")    return v.fields?.published;
    if (videoFilter === "forsale") return Number(v.fields?.price) > 0;
    return v.fields?.tier === videoFilter;
  });

  const filteredWorkouts = workouts.filter(w => {
    if (workoutFilter === "all")     return true;
    if (workoutFilter === "live")    return w.fields?.published;
    if (workoutFilter === "forsale") return Number(w.fields?.price) > 0;
    return w.fields?.tier === workoutFilter;
  });

  const videoCounts = {
    total:      videos.length,
    live:       videos.filter(v => v.fields?.published).length,
    processing: videos.filter(v => ["pending", "processing"].includes(v.fields?.status)).length,
  };

  const workoutCounts = {
    total: workouts.length,
    live:  workouts.filter(w => w.fields?.published).length,
  };

  // Filter chips — "For sale" surfaces one-time purchasable items
  const FILTERS = ["all", "Basic", "Premium", "Ultra", "live", "forsale"];
  const filterLabel = f => f === "all" ? "All" : f === "live" ? "Live" : f === "forsale" ? "For sale" : f;

  // ── Render ────────────────────────────────────────────────────────────────

  // Show launch checklist if no videos AND no workouts
  if (!videosLoading && !workoutsLoading && videos.length === 0 && workouts.length === 0) {
    return (
      <>
        {showUpload && <UploadModal trainerId={trainerId} onClose={() => setShowUpload(false)} onSuccess={() => { setShowUpload(false); loadVideos(); }} />}
        <LaunchChecklist trainerSlug={trainerSlug} onUploadClick={() => setShowUpload(true)} />
      </>
    );
  }

  return (
    <div>
      {/* ── Library tab toggle ── */}
      <div className="flex items-center gap-2 mb-4">
        {[
          { key: "videos",   label: "Videos",   icon: <Video className="w-3.5 h-3.5" />,    count: videoCounts.total   },
          { key: "workouts", label: "Workouts", icon: <Dumbbell className="w-3.5 h-3.5" />, count: workoutCounts.total },
        ].map(({ key, label, icon, count }) => (
          <button key={key} type="button" onClick={() => setLibraryTab(key)}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-sm text-xs font-bold border transition"
            style={{
              backgroundColor: libraryTab === key ? DS.brand + "15" : "transparent",
              borderColor:     libraryTab === key ? DS.brand + "55" : DS.border,
              color:           libraryTab === key ? DS.brand : DS.labelText,
            }}>
            {icon}
            {label}
            <span className="px-1.5 py-0.5 rounded-sm text-[10px] font-black tabular-nums"
              style={{ backgroundColor: libraryTab === key ? DS.brand + "20" : DS.pageBg, color: libraryTab === key ? DS.brand : DS.dimText }}>
              {count}
            </span>
          </button>
        ))}
      </div>

      {/* ── VIDEOS TAB ── */}
      {libraryTab === "videos" && (
        <div>
          {/* Stats + upload */}
          <div className="flex items-center gap-3 flex-wrap mb-3">
            {[{ label: "Total", value: videoCounts.total }, { label: "Live", value: videoCounts.live }, { label: "Processing", value: videoCounts.processing }].map(({ label, value }) => (
              <div key={label} className="flex items-center gap-2 px-3 py-1.5 rounded-sm" style={{ backgroundColor: DS.cardBg, border: `1px solid ${DS.border}` }}>
                <span className="text-[10px] font-black uppercase tracking-wider" style={{ color: DS.dimText }}>{label}</span>
                <span className="text-sm font-black tabular-nums" style={{ color: DS.bodyText }}>{value}</span>
              </div>
            ))}
            <button type="button" onClick={() => setShowUpload(true)}
              className="ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-sm text-xs font-black transition"
              style={{ backgroundColor: DS.brand, color: "#fff" }}>
              <Upload className="w-3 h-3" /> Upload / Add video
            </button>
          </div>

          {/* Filter */}
          <div className="flex items-center gap-1 mb-4 flex-wrap">
            {FILTERS.map(f => (
              <button key={f} type="button" onClick={() => setVideoFilter(f)}
                className="px-2.5 py-1.5 rounded-sm text-xs font-bold border transition"
                style={{ backgroundColor: videoFilter === f ? DS.brand + "15" : "transparent", borderColor: videoFilter === f ? DS.brand + "55" : DS.border, color: videoFilter === f ? DS.brand : DS.labelText }}>
                {filterLabel(f)}
              </button>
            ))}
          </div>

          {showUpload && <UploadModal trainerId={trainerId} onClose={() => setShowUpload(false)} onSuccess={() => { setShowUpload(false); loadVideos(); }} />}

          {videosLoading ? (
            <div className="space-y-2">
              {[1,2,3].map(i => <div key={i} className="animate-pulse h-16 rounded-sm" style={{ backgroundColor: DS.cardBg, border: `1px solid ${DS.border}` }} />)}
            </div>
          ) : filteredVideos.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 rounded-sm" style={{ backgroundColor: DS.cardBg, border: `1px solid ${DS.border}` }}>
              <Video className="w-8 h-8 mb-3" style={{ color: DS.brandBorder }} />
              <p className="text-sm font-black mb-1" style={{ color: DS.labelText }}>No videos match this filter</p>
              <button type="button" onClick={() => setVideoFilter("all")} className="text-xs font-bold mt-2" style={{ color: DS.brand, background: "none", border: "none", cursor: "pointer" }}>Show all →</button>
            </div>
          ) : (
            <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))" }}>
              {filteredVideos.map(v => <VideoCard key={v.id} video={v} onTogglePublish={toggleVideoPublish} onDelete={deleteVideo} />)}
            </div>
          )}
        </div>
      )}

      {/* ── WORKOUTS TAB ── */}
      {libraryTab === "workouts" && (
        <div>
          {/* Stats + create */}
          <div className="flex items-center gap-3 flex-wrap mb-3">
            {[{ label: "Total", value: workoutCounts.total }, { label: "Live", value: workoutCounts.live }].map(({ label, value }) => (
              <div key={label} className="flex items-center gap-2 px-3 py-1.5 rounded-sm" style={{ backgroundColor: DS.cardBg, border: `1px solid ${DS.border}` }}>
                <span className="text-[10px] font-black uppercase tracking-wider" style={{ color: DS.dimText }}>{label}</span>
                <span className="text-sm font-black tabular-nums" style={{ color: DS.bodyText }}>{value}</span>
              </div>
            ))}
            <button type="button" onClick={() => { setEditingWorkout(null); setShowBuilder(true); }}
              className="ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-sm text-xs font-black transition"
              style={{ backgroundColor: DS.brand, color: "#fff" }}>
              <Plus className="w-3 h-3" /> Create workout
            </button>
          </div>

          {/* Filter */}
          <div className="flex items-center gap-1 mb-4 flex-wrap">
            {FILTERS.map(f => (
              <button key={f} type="button" onClick={() => setWorkoutFilter(f)}
                className="px-2.5 py-1.5 rounded-sm text-xs font-bold border transition"
                style={{ backgroundColor: workoutFilter === f ? DS.brand + "15" : "transparent", borderColor: workoutFilter === f ? DS.brand + "55" : DS.border, color: workoutFilter === f ? DS.brand : DS.labelText }}>
                {filterLabel(f)}
              </button>
            ))}
          </div>

          {/* WorkoutBuilder drawer */}
          <WorkoutBuilder
            open={showBuilder}
            onClose={() => { setShowBuilder(false); setEditingWorkout(null); }}
            editWorkout={editingWorkout}
            onSaved={handleWorkoutSaved}
          />

          {workoutsLoading ? (
            <div className="space-y-2">
              {[1,2,3].map(i => <div key={i} className="animate-pulse h-24 rounded-sm" style={{ backgroundColor: DS.cardBg, border: `1px solid ${DS.border}` }} />)}
            </div>
          ) : filteredWorkouts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 rounded-sm" style={{ backgroundColor: DS.cardBg, border: `1px solid ${DS.border}` }}>
              <Dumbbell className="w-8 h-8 mb-3" style={{ color: DS.brandBorder }} />
              <p className="text-sm font-black mb-1" style={{ color: DS.labelText }}>
                {workouts.length === 0 ? "No workouts yet" : "No workouts match this filter"}
              </p>
              {workouts.length === 0 && (
                <>
                  <p className="text-xs mb-4" style={{ color: DS.dimText }}>Create a workout or import from a template from your Workouts Calendar.</p>
                  <button type="button" onClick={() => { setEditingWorkout(null); setShowBuilder(true); }}
                    className="px-4 py-2 rounded-sm text-xs font-black" style={{ backgroundColor: DS.brand, color: "#fff" }}>
                    + Create first workout
                  </button>
                </>
              )}
            </div>
          ) : (
            <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))" }}>
              {filteredWorkouts.map(w => (
                <WorkoutCard
                  key={w.id} workout={w}
                  onTogglePublish={toggleWorkoutPublish}
                  onDelete={deleteWorkout}
                  onEdit={(workout) => { setEditingWorkout(workout); setShowBuilder(true); }}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}