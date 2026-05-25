// components/commercial/VideoUpload.jsx
//
// Handles both upload-from-file and embed-from-URL flows.
// Drop a file → direct upload to Mux, progress bar, pending state.
// Paste a URL → immediate record creation, no waiting.

import { useState, useRef } from "react";

const TIERS    = ["Basic", "Premium", "Ultra"];
const TIER_DESC = {
  Basic:   "All subscribers",
  Premium: "Premium + Ultra only",
  Ultra:   "Ultra only",
};

const TAGS = {
  workoutType:  ["Strength", "Conditioning", "Mobility", "Recovery", "HIIT", "Technique"],
  muscleGroup:  ["Upper Body", "Lower Body", "Full Body", "Core", "Cardio"],
  difficulty:   ["Beginner", "Intermediate", "Advanced"],
  duration:     ["Under 15 min", "15–30 min", "30–45 min", "45+ min"],
  equipment:    ["Bodyweight", "Barbell", "Dumbbell", "Machine", "Bands"],
};

export default function VideoUpload({ trainerId, onSuccess }) {
  const [mode, setMode]           = useState("upload"); // "upload" | "embed"
  const [file, setFile]           = useState(null);
  const [embedUrl, setEmbedUrl]   = useState("");
  const [title, setTitle]         = useState("");
  const [tier, setTier]           = useState("Basic");
  const [tags, setTags]           = useState({});
  const [progress, setProgress]   = useState(0);       // 0–100
  const [status, setStatus]       = useState("idle");  // idle | uploading | processing | done | error
  const [error, setError]         = useState("");
  const fileRef = useRef(null);

  function toggleTag(category, value) {
    setTags(prev => ({ ...prev, [category]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!title.trim()) return setError("Add a title before saving.");
    if (mode === "embed" && !embedUrl.trim()) return setError("Paste a video URL.");
    if (mode === "upload" && !file) return setError("Select a video file.");

    setError("");
    setStatus("uploading");

    try {
      if (mode === "embed") {
        // Embed flow — just create the Airtable record immediately.
        const res = await fetch("/api/commercial/videos", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title, sourceType: "embed", embedUrl, tier, tags }),
        });
        if (!res.ok) throw new Error((await res.json()).error);
        setStatus("done");
        onSuccess?.();
        return;
      }

      // Upload flow — three steps:

      // 1. Get a Mux direct upload URL (and create the Airtable record).
      const initRes = await fetch("/api/commercial/videos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, sourceType: "upload", tier, tags }),
      });
      if (!initRes.ok) throw new Error((await initRes.json()).error);
      const { video: pendingRecord } = await initRes.json();

      // 2. Get the Mux upload URL, passing the Airtable record ID as passthrough.
      const muxRes = await fetch("/api/commercial/mux-upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videoRecordId: pendingRecord.id }),
      });
      if (!muxRes.ok) throw new Error("Could not get upload URL.");
      const { uploadId, uploadUrl } = await muxRes.json();

      // Save uploadId to the Airtable record so the webhook can match it.
      await fetch(`/api/commercial/videos?id=${pendingRecord.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ muxUploadId: uploadId }),
      });

      // 3. PUT the file directly to Mux, tracking progress via XMLHttpRequest.
      await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("PUT", uploadUrl);
        xhr.setRequestHeader("Content-Type", file.type || "video/*");

        xhr.upload.addEventListener("progress", (e) => {
          if (e.lengthComputable) setProgress(Math.round((e.loaded / e.total) * 100));
        });
        xhr.addEventListener("load",  () => (xhr.status < 300 ? resolve() : reject(new Error("Upload failed"))));
        xhr.addEventListener("error", () => reject(new Error("Network error during upload")));
        xhr.send(file);
      });

      // Upload done — Mux is now transcoding. Webhook will mark it ready.
      setProgress(100);
      setStatus("processing");
      onSuccess?.();

    } catch (err) {
      console.error("[VideoUpload]", err);
      setStatus("error");
      setError(err.message || "Something went wrong.");
    }
  }

  const isSubmitting = status === "uploading";

  return (
    <div style={S.card}>
      {/* Mode toggle */}
      <div style={S.modeRow}>
        {["upload", "embed"].map(m => (
          <button
            key={m}
            type="button"
            onClick={() => { setMode(m); setError(""); }}
            style={{ ...S.modeBtn, ...(mode === m ? S.modeBtnActive : {}) }}
          >
            {m === "upload" ? "Upload file" : "Embed URL"}
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit} style={S.form}>
        {/* Title */}
        <label style={S.label}>
          Title
          <input
            style={S.input}
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="e.g. Upper Body Hypertrophy Day 1"
            disabled={isSubmitting}
          />
        </label>

        {/* File or URL */}
        {mode === "upload" ? (
          <div
            style={{ ...S.dropzone, ...(file ? S.dropzoneFilled : {}) }}
            onClick={() => fileRef.current?.click()}
            onDragOver={e => e.preventDefault()}
            onDrop={e => {
              e.preventDefault();
              const f = e.dataTransfer.files[0];
              if (f?.type.startsWith("video/")) setFile(f);
            }}
          >
            <input
              ref={fileRef}
              type="file"
              accept="video/*"
              style={{ display: "none" }}
              onChange={e => setFile(e.target.files[0] ?? null)}
            />
            {file
              ? <><span style={S.fileName}>{file.name}</span><span style={S.fileSize}>{(file.size / 1e6).toFixed(1)} MB</span></>
              : <><span style={S.dropIcon}>↑</span><span style={S.dropText}>Drop video here or click to browse</span><span style={S.dropSub}>MP4, MOV, WebM — no size limit</span></>
            }
          </div>
        ) : (
          <label style={S.label}>
            Video URL
            <input
              style={S.input}
              value={embedUrl}
              onChange={e => setEmbedUrl(e.target.value)}
              placeholder="https://vimeo.com/... or https://youtube.com/..."
              disabled={isSubmitting}
            />
            <span style={S.hint}>Vimeo Pro recommended for paid content — restricts playback to your domain.</span>
          </label>
        )}

        {/* Tier */}
        <div style={S.fieldGroup}>
          <span style={S.label}>Tier access</span>
          <div style={S.tierRow}>
            {TIERS.map(t => (
              <button
                key={t}
                type="button"
                onClick={() => setTier(t)}
                style={{ ...S.tierBtn, ...(tier === t ? S.tierBtnActive[t] : {}) }}
                disabled={isSubmitting}
              >
                <span style={S.tierName}>{t}</span>
                <span style={S.tierDesc}>{TIER_DESC[t]}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Tags */}
        <div style={S.fieldGroup}>
          <span style={S.label}>Tags</span>
          <div style={S.tagGrid}>
            {Object.entries(TAGS).map(([category, options]) => (
              <div key={category} style={S.tagGroup}>
                <span style={S.tagCategoryLabel}>{category.replace(/([A-Z])/g, ' $1').trim()}</span>
                <div style={S.tagOptions}>
                  {options.map(opt => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => toggleTag(category, tags[category] === opt ? undefined : opt)}
                      style={{ ...S.tag, ...(tags[category] === opt ? S.tagActive : {}) }}
                      disabled={isSubmitting}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Progress bar (upload only) */}
        {mode === "upload" && status === "uploading" && (
          <div style={S.progressWrap}>
            <div style={{ ...S.progressBar, width: `${progress}%` }} />
            <span style={S.progressLabel}>{progress}%</span>
          </div>
        )}

        {/* Status messages */}
        {status === "processing" && (
          <div style={S.infoBox}>
            Video uploaded — Mux is transcoding it now. This usually takes 1–3 minutes.
            You can close this window; the video will appear in your library when ready.
          </div>
        )}
        {status === "done" && <div style={S.successBox}>Video saved to your library.</div>}
        {error && <div style={S.errorBox}>{error}</div>}

        <button type="submit" style={S.submit} disabled={isSubmitting}>
          {isSubmitting ? `Uploading… ${progress}%` : mode === "embed" ? "Save video" : "Upload video"}
        </button>
      </form>
    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
// Matches CheckPeak's DM Sans / DS object pattern.

const DS = {
  brand:     "#0066FF",
  brandBg:   "#EBF2FF",
  border:    "#E2E2E2",
  surface:   "#F7F7F5",
  text:      "#1A1A1A",
  dim:       "#6B6B6B",
  safe:      "#1A7F4B",
  safeBg:    "#EAF5EE",
  error:     "#C0392B",
  errorBg:   "#FDECEA",
};

const S = {
  card: {
    fontFamily: "'DM Sans', sans-serif",
    background: "#fff",
    border: `1px solid ${DS.border}`,
    borderRadius: 12,
    padding: "24px",
    maxWidth: 640,
  },
  modeRow: { display: "flex", gap: 4, marginBottom: 20, background: DS.surface, borderRadius: 8, padding: 4 },
  modeBtn: {
    flex: 1, padding: "8px 0", border: "none", borderRadius: 6,
    background: "transparent", fontSize: 14, fontWeight: 500,
    color: DS.dim, cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
  },
  modeBtnActive: { background: "#fff", color: DS.text, boxShadow: "0 1px 3px rgba(0,0,0,0.1)" },
  form:  { display: "flex", flexDirection: "column", gap: 20 },
  label: { display: "flex", flexDirection: "column", gap: 6, fontSize: 13, fontWeight: 600, color: DS.text },
  input: {
    padding: "10px 12px", border: `1px solid ${DS.border}`, borderRadius: 8,
    fontSize: 14, fontFamily: "'DM Sans', sans-serif", color: DS.text,
    outline: "none",
  },
  hint: { fontSize: 12, color: DS.dim, fontWeight: 400 },
  dropzone: {
    display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
    gap: 6, padding: "32px 24px", border: `2px dashed ${DS.border}`,
    borderRadius: 10, cursor: "pointer", background: DS.surface, minHeight: 120,
    transition: "border-color 0.15s",
  },
  dropzoneFilled: { borderColor: DS.brand, background: DS.brandBg },
  dropIcon:   { fontSize: 28, color: DS.dim },
  dropText:   { fontSize: 14, fontWeight: 600, color: DS.text },
  dropSub:    { fontSize: 12, color: DS.dim },
  fileName:   { fontSize: 14, fontWeight: 600, color: DS.text },
  fileSize:   { fontSize: 12, color: DS.dim },
  fieldGroup: { display: "flex", flexDirection: "column", gap: 8 },
  tierRow:    { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 },
  tierBtn: {
    display: "flex", flexDirection: "column", gap: 2, padding: "10px 12px",
    border: `1px solid ${DS.border}`, borderRadius: 8, background: DS.surface,
    cursor: "pointer", textAlign: "left", fontFamily: "'DM Sans', sans-serif",
  },
  tierBtnActive: {
    Basic:   { border: "1.5px solid #1A7F4B", background: DS.safeBg },
    Premium: { border: "1.5px solid #B07D10", background: "#FEF9EC" },
    Ultra:   { border: `1.5px solid ${DS.brand}`, background: DS.brandBg },
  },
  tierName: { fontSize: 13, fontWeight: 700, color: DS.text },
  tierDesc: { fontSize: 11, color: DS.dim, fontWeight: 400 },
  tagGrid:  { display: "flex", flexDirection: "column", gap: 12 },
  tagGroup: { display: "flex", flexDirection: "column", gap: 6 },
  tagCategoryLabel: { fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: DS.dim },
  tagOptions: { display: "flex", flexWrap: "wrap", gap: 6 },
  tag: {
    padding: "5px 12px", borderRadius: 99, border: `1px solid ${DS.border}`,
    background: DS.surface, fontSize: 12, fontWeight: 500, color: DS.dim,
    cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
  },
  tagActive: { background: DS.brandBg, border: `1px solid ${DS.brand}`, color: DS.brand },
  progressWrap: { position: "relative", height: 8, background: DS.surface, borderRadius: 99, overflow: "hidden" },
  progressBar:  { height: "100%", background: DS.brand, borderRadius: 99, transition: "width 0.2s" },
  progressLabel: { fontSize: 12, color: DS.dim, textAlign: "right", marginTop: 4 },
  infoBox:    { padding: "10px 14px", background: DS.brandBg, border: `1px solid ${DS.brand}`, borderRadius: 8, fontSize: 13, color: "#0044AA" },
  successBox: { padding: "10px 14px", background: DS.safeBg, border: `1px solid #1A7F4B`, borderRadius: 8, fontSize: 13, color: DS.safe },
  errorBox:   { padding: "10px 14px", background: DS.errorBg, border: `1px solid ${DS.error}`, borderRadius: 8, fontSize: 13, color: DS.error },
  submit: {
    padding: "12px", background: DS.brand, color: "#fff", border: "none",
    borderRadius: 8, fontSize: 15, fontWeight: 700, cursor: "pointer",
    fontFamily: "'DM Sans', sans-serif",
  },
};