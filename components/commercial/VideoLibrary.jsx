// components/commercial/VideoLibrary.jsx
// Aligned with org DS system and design language.
"use client";

import { useState, useEffect, useCallback } from "react";
import { CheckCircle2, Upload, Video, X, ArrowRight } from "lucide-react";
import VideoUpload from "./VideoUpload";
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

// ─── Utilities ────────────────────────────────────────────────────────────────
function muxThumb(id) {
  return `https://image.mux.com/${id}/thumbnail.jpg?width=480&height=270&fit_mode=smartcrop`;
}

function fmtDuration(secs) {
  if (!secs) return null;
  const m = Math.floor(secs / 60), s = secs % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function parseTags(raw) {
  try { return typeof raw === "string" ? JSON.parse(raw) : (raw ?? {}); }
  catch { return {}; }
}

function getTagList(raw) {
  return Object.values(parseTags(raw))
    .flatMap(v => Array.isArray(v) ? v : [v])
    .filter(Boolean);
}

// ─── Launch checklist ─────────────────────────────────────────────────────────
function LaunchChecklist({ trainerSlug, onUploadClick }) {
  const steps = [
    {
      n: 1, done: true,
      title: "Profile created",
      desc: "Your public trainer profile is live.",
    },
    {
      n: 2, done: false, active: true,
      title: "Upload your first video",
      desc: "Add a workout to your library. Upload a file or paste a YouTube/Vimeo link.",
      cta: { label: "Add first video", action: onUploadClick },
    },
    {
      n: 3, done: false,
      title: "Add your first client",
      desc: "Add a client by email — they get instant access.",
    },
  ];

  return (
    <div className="rounded-sm overflow-hidden"
      style={{ backgroundColor: DS.cardBg, border: `1px solid ${DS.border}`, borderTop: `3px solid ${DS.brand}` }}>

      <div className="px-5 py-4 border-b" style={{ borderColor: DS.border, backgroundColor: DS.pageBg }}>
        <p className="text-[10px] font-black uppercase tracking-wider mb-0.5" style={{ color: DS.brand }}>
          Getting started
        </p>
        <p className="text-sm font-black" style={{ color: DS.bodyText }}>
          Launch your library
        </p>
        <p className="text-xs mt-0.5" style={{ color: DS.labelText }}>
          Three steps to your first paying client.
        </p>
      </div>

      <div className="px-5 py-4">
        {steps.map((step, i) => (
          <div key={step.n} className="flex gap-4">
            <div className="flex flex-col items-center shrink-0 w-8">
              <div
                className="w-8 h-8 rounded-sm flex items-center justify-center shrink-0 text-xs font-black"
                style={{
                  backgroundColor: step.done ? DS.safe : step.active ? DS.brand : DS.pageBg,
                  border: step.done || step.active ? "none" : `1px solid ${DS.border}`,
                  color: step.done || step.active ? "#fff" : DS.dimText,
                }}>
                {step.done ? <CheckCircle2 className="w-4 h-4" /> : step.n}
              </div>
              {i < steps.length - 1 && (
                <div className="w-px flex-1 my-1.5"
                  style={{ backgroundColor: step.done ? DS.safe : DS.border, minHeight: 20 }} />
              )}
            </div>

            <div className={`flex-1 ${i < steps.length - 1 ? "pb-5" : "pb-0"}`} style={{ paddingTop: 4 }}>
              <p className="text-xs font-black mb-1 flex items-center gap-2"
                style={{ color: step.done ? DS.dimText : DS.bodyText }}>
                {step.title}
                {step.done && (
                  <span className="px-1.5 py-0.5 rounded-sm text-[10px] font-black"
                    style={{ backgroundColor: DS.safeBg, color: DS.safe }}>
                    Done
                  </span>
                )}
              </p>
              <p className="text-[11px] leading-relaxed mb-2" style={{ color: DS.labelText }}>
                {step.desc}
              </p>
              {step.cta && (
                <button type="button" onClick={step.cta.action}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-sm text-xs font-black transition"
                  style={{ backgroundColor: DS.brand, color: "#fff" }}>
                  <Upload className="w-3 h-3" />
                  {step.cta.label}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {trainerSlug && (
        <div className="flex items-center justify-between gap-3 px-5 py-3 border-t"
          style={{ borderColor: DS.border, backgroundColor: DS.pageBg }}>
          <div>
            <p className="text-[10px] font-black uppercase tracking-wider" style={{ color: DS.brand }}>
              Your public profile is live
            </p>
            <p className="text-[11px]" style={{ color: DS.dimText }}>
              checkpeak.com/trainer/{trainerSlug}
            </p>
          </div>
          <a href={`/trainer/${trainerSlug}`} target="_blank" rel="noopener"
            className="flex items-center gap-1 text-[11px] font-bold transition"
            style={{ color: DS.brand }}>
            View <ArrowRight className="w-3 h-3" />
          </a>
        </div>
      )}
    </div>
  );
}

// ─── Video card ───────────────────────────────────────────────────────────────
function VideoCard({ video, onTogglePublish, onDelete }) {
  const f          = video.fields ?? {};
  const status     = f.status ?? "pending";
  const isReady    = status === "ready";
  const thumb      = f.muxPlaybackId ? muxThumb(f.muxPlaybackId) : null;
  const tier       = f.tier ?? "Basic";
  const ts         = TIER_STYLE[tier]   ?? TIER_STYLE.Basic;
  const ss         = STATUS_STYLE[status] ?? STATUS_STYLE.pending;
  const tags       = getTagList(f.tags).slice(0, 4);
  const [publishing, setPublishing] = useState(false);

  async function toggle() {
    setPublishing(true);
    await onTogglePublish(video.id, !f.published);
    setPublishing(false);
  }

  return (
    <div className="rounded-sm overflow-hidden transition-shadow hover:shadow-md"
      style={{ backgroundColor: DS.cardBg, border: `1px solid ${DS.border}` }}>

      {/* Thumbnail */}
      <div className="relative" style={{ paddingBottom: "56.25%", backgroundColor: DS.pageBg, overflow: "hidden" }}>
        {thumb
          ? <img src={thumb} alt={f.title} className="absolute inset-0 w-full h-full object-cover" />
          : (
            <div className="absolute inset-0 flex items-center justify-center">
              {status === "processing" ? (
                <div className="flex flex-col items-center gap-1.5">
                  <div className="w-5 h-5 border-2 rounded-full animate-spin"
                    style={{ borderColor: DS.border, borderTopColor: DS.brand }} />
                  <span className="text-[10px]" style={{ color: DS.dimText }}>Transcoding…</span>
                </div>
              ) : (
                <Video className="w-8 h-8" style={{ color: DS.brandBorder }} />
              )}
            </div>
          )
        }

        {/* Duration badge */}
        {fmtDuration(f.duration) && (
          <span className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded-sm text-[10px] font-bold"
            style={{ backgroundColor: "rgba(0,0,0,0.65)", color: "#fff" }}>
            {fmtDuration(f.duration)}
          </span>
        )}

        {/* Live indicator bar */}
        <div className="absolute top-0 left-0 right-0 h-0.5 transition-colors"
          style={{ backgroundColor: f.published ? DS.safe : "transparent" }} />
      </div>

      <div className="p-3">
        {/* Title */}
        <p className="text-xs font-black mb-2 truncate" style={{ color: DS.bodyText }}>
          {f.title || "Untitled"}
        </p>

        {/* Tier + Status badges */}
        <div className="flex flex-wrap gap-1 mb-2">
          <span className="px-1.5 py-0.5 rounded-sm text-[10px] font-black"
            style={{ backgroundColor: ts.bg, border: `1px solid ${ts.border}`, color: ts.color }}>
            {tier}
          </span>
          <span className="px-1.5 py-0.5 rounded-sm text-[10px] font-black"
            style={{ backgroundColor: ss.bg, color: ss.color }}>
            {ss.label}
          </span>
        </div>

        {/* Tags */}
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-3">
            {tags.map(tag => (
              <span key={tag} className="px-1.5 py-0.5 rounded-sm text-[10px] font-semibold"
                style={{ backgroundColor: DS.pageBg, color: DS.dimText, border: `1px solid ${DS.border}` }}>
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Publish toggle + Delete */}
        <div className="flex items-center justify-between" style={{ marginTop: tags.length > 0 ? 0 : 8 }}>
          <button type="button"
            onClick={isReady && !publishing ? toggle : undefined}
            disabled={!isReady || publishing}
            className="flex items-center gap-2 disabled:opacity-40">
            <div className="relative transition-colors"
              style={{ width: 32, height: 18, borderRadius: 99, backgroundColor: f.published ? DS.safe : DS.border }}>
              <div className="absolute top-0.5 transition-all"
                style={{ left: f.published ? 16 : 2, width: 14, height: 14, borderRadius: 99, backgroundColor: "#fff" }} />
            </div>
            <span className="text-[11px] font-bold"
              style={{ color: f.published ? DS.safe : DS.labelText }}>
              {f.published ? "Live" : isReady ? "Publish" : "Not ready"}
            </span>
          </button>

          <button type="button" onClick={() => onDelete(video.id)}
            className="transition" style={{ color: DS.dimText }}
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
    <div
      className="fixed inset-0 z-[200] flex items-start justify-center overflow-y-auto"
      style={{ paddingTop: 80, paddingBottom: 40, paddingLeft: 16, paddingRight: 16, backgroundColor: "rgba(0,0,0,0.5)" }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-xl rounded-sm"
        style={{ backgroundColor: DS.cardBg, border: `1px solid ${DS.border}` }}>

        {/* Modal header */}
        <div className="flex items-center justify-between px-5 py-3 border-b"
          style={{ borderColor: DS.border }}>
          <p className="text-sm font-black" style={{ color: DS.bodyText }}>Add to library</p>
          <button type="button" onClick={onClose}
            className="transition" style={{ color: DS.dimText }}
            onMouseEnter={e => { e.currentTarget.style.color = DS.bodyText; }}
            onMouseLeave={e => { e.currentTarget.style.color = DS.dimText; }}>
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Upload form */}
        <div className="p-5">
          <VideoUpload trainerId={trainerId} onSuccess={onSuccess} />
        </div>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function VideoLibrary({ trainerId, trainerSlug, onVideoCountChange }) {
  const [videos,      setVideos]      = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [showUpload,  setShowUpload]  = useState(false);
  const [filter,      setFilter]      = useState("all");

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/commercial/videos", { credentials: "include" });
    if (res.ok) {
      const vids = (await res.json()).videos ?? [];
      setVideos(vids);
      onVideoCountChange?.(vids.length);
    }
    setLoading(false);
  }, [onVideoCountChange]);

  useEffect(() => { load(); }, [load]);

  // Poll every 8s while any video is still processing
  useEffect(() => {
    const hasProcessing = videos.some(v => ["pending", "processing"].includes(v.fields?.status));
    if (!hasProcessing) return;
    const t = setTimeout(load, 8000);
    return () => clearTimeout(t);
  }, [videos, load]);

  async function togglePublish(id, published) {
    await fetch(`/api/commercial/videos?id=${id}`, {
      method: "PUT", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ published }),
    });
    setVideos(prev => prev.map(v =>
      v.id === id ? { ...v, fields: { ...v.fields, published } } : v
    ));
  }

  async function handleDelete(id) {
    if (!confirm("Remove this video? This can't be undone.")) return;
    await fetch(`/api/commercial/videos?id=${id}&hard=true`, { method: "DELETE", credentials: "include" });
    setVideos(prev => {
      const updated = prev.filter(v => v.id !== id);
      onVideoCountChange?.(updated.length);
      return updated;
    });
  }

  const filtered = videos.filter(v => {
    if (filter === "all")  return true;
    if (filter === "live") return v.fields?.published;
    return v.fields?.tier === filter;
  });

  const counts = {
    total:      videos.length,
    live:       videos.filter(v => v.fields?.published).length,
    processing: videos.filter(v => ["pending", "processing"].includes(v.fields?.status)).length,
  };

  // ── Loading skeleton ─────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map(i => (
          <div key={i} className="animate-pulse h-16 rounded-sm"
            style={{ backgroundColor: DS.cardBg, border: `1px solid ${DS.border}` }} />
        ))}
      </div>
    );
  }

  // ── Empty state ──────────────────────────────────────────────────────────────
  if (videos.length === 0) {
    return (
      <>
        {showUpload && (
          <UploadModal
            trainerId={trainerId}
            onClose={() => setShowUpload(false)}
            onSuccess={() => { setShowUpload(false); load(); }}
          />
        )}
        <LaunchChecklist trainerSlug={trainerSlug} onUploadClick={() => setShowUpload(true)} />
      </>
    );
  }

  // ── Library ──────────────────────────────────────────────────────────────────
  return (
    <div>

      {/* Stats row + upload button */}
      <div className="flex items-center gap-3 flex-wrap mb-3">
        {[
          { label: "Total",      value: counts.total      },
          { label: "Live",       value: counts.live       },
          { label: "Processing", value: counts.processing },
        ].map(({ label, value }) => (
          <div key={label} className="flex items-center gap-2 px-3 py-1.5 rounded-sm"
            style={{ backgroundColor: DS.cardBg, border: `1px solid ${DS.border}` }}>
            <span className="text-[10px] font-black uppercase tracking-wider" style={{ color: DS.dimText }}>
              {label}
            </span>
            <span className="text-sm font-black tabular-nums" style={{ color: DS.bodyText }}>
              {value}
            </span>
          </div>
        ))}
        <button type="button" onClick={() => setShowUpload(true)}
          className="ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-sm text-xs font-black transition"
          style={{ backgroundColor: DS.brand, color: "#fff" }}>
          <Upload className="w-3 h-3" />
          Upload / Add video
        </button>
      </div>

      {/* Filter tabs */}
      <div className="flex items-center gap-1 mb-4">
        {["all", "Basic", "Premium", "Ultra", "live"].map(f => (
          <button key={f} type="button" onClick={() => setFilter(f)}
            className="px-2.5 py-1.5 rounded-sm text-xs font-bold border transition"
            style={{
              backgroundColor: filter === f ? DS.brand + "15" : "transparent",
              borderColor:     filter === f ? DS.brand + "55" : DS.border,
              color:           filter === f ? DS.brand : DS.labelText,
            }}>
            {f === "all" ? "All" : f === "live" ? "Live" : f}
          </button>
        ))}
      </div>

      {/* Upload modal */}
      {showUpload && (
        <UploadModal
          trainerId={trainerId}
          onClose={() => setShowUpload(false)}
          onSuccess={() => { setShowUpload(false); load(); }}
        />
      )}

      {/* Video grid */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 rounded-sm"
          style={{ backgroundColor: DS.cardBg, border: `1px solid ${DS.border}` }}>
          <Video className="w-8 h-8 mb-3" style={{ color: DS.brandBorder }} />
          <p className="text-sm font-black mb-1" style={{ color: DS.labelText }}>No videos match this filter</p>
          <button type="button" onClick={() => setFilter("all")}
            className="text-xs font-bold mt-2" style={{ color: DS.brand, background: "none", border: "none", cursor: "pointer" }}>
            Show all →
          </button>
        </div>
      ) : (
        <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))" }}>
          {filtered.map(v => (
            <VideoCard key={v.id} video={v} onTogglePublish={togglePublish} onDelete={handleDelete} />
          ))}
        </div>
      )}
    </div>
  );
}