// components/commercial/VideoUpload.jsx
// Upload-from-file or embed-from-URL.
// Equipment is multi-select. Muscle groups expanded.

import { useState, useRef } from "react";
import { DS } from "@/components/org/dashboard/DashboardUI";

// ─── Config ───────────────────────────────────────────────────────────────────
const TIERS = ["Basic", "Premium", "Ultra"];
const TIER_CONFIG = {
  Basic:   { desc: "All subscribers",        color: DS.safe,    bg: DS.safeBg,    border: DS.safeBorder    },
  Premium: { desc: "Premium + Ultra only",   color: DS.caution, bg: DS.cautionBg, border: DS.cautionBorder },
  Ultra:   { desc: "Ultra subscribers only", color: DS.brand,   bg: DS.brandBg,   border: DS.brandBorder   },
};

const TAGS = {
  "Workout Type": ["Strength", "Conditioning", "Mobility", "Recovery", "HIIT", "Technique", "Speed", "Power", "Agility", "Flexibility"],
  "Muscle Group": ["Full Body", "Upper Body", "Lower Body", "Chest", "Back", "Shoulders", "Biceps", "Triceps", "Forearms", "Lats", "Traps", "Quads", "Hamstrings", "Glutes", "Calves", "Hip Flexors", "Abs", "Obliques", "Core"],
  "Difficulty":   ["Beginner", "Intermediate", "Advanced", "Elite"],
  "Duration":     ["Under 15 min", "15–30 min", "30–45 min", "45+ min"],
  "Equipment":    ["Bodyweight", "Barbell", "Dumbbell", "Kettlebell", "Cable", "Machine", "Bands", "Smith Machine", "Pull-up Bar", "Bench", "Box / Plyo", "TRX / Suspension", "Sled", "Battle Ropes"],
};

const TAG_KEYS = {
  "Workout Type": "workoutType",
  "Muscle Group": "muscleGroup",
  "Difficulty":   "difficulty",
  "Duration":     "duration",
  "Equipment":    "equipment",
};

// Equipment is multi-select; all others are single-select
const MULTI_SELECT = new Set(["Equipment", "Muscle Group"]);

const CSS = `
  .vu-drop {
    display: flex; flex-direction: column; align-items: center;
    justify-content: center; gap: 8px; padding: 36px 24px;
    border: 2px dashed ${DS.border}; border-radius: 8px;
    cursor: pointer; background: ${DS.pageBg}; transition: all 0.15s;
    text-align: center;
  }
  .vu-drop:hover, .vu-drop.drag-over {
    border-color: ${DS.brand}; background: ${DS.brandBg};
  }
  .vu-drop.has-file {
    border-color: ${DS.safe}; background: ${DS.safeBg}; border-style: solid;
  }

  .vu-tag-btn {
    padding: 4px 11px; border-radius: 99px;
    border: 1px solid ${DS.border}; background: ${DS.pageBg};
    font-size: 11px; font-weight: 600; color: ${DS.labelText};
    cursor: pointer; font-family: inherit; transition: all 0.12s; white-space: nowrap;
  }
  .vu-tag-btn:hover { border-color: ${DS.brandBorder}; color: ${DS.brand}; background: ${DS.brandBg}; }
  .vu-tag-btn.active { background: ${DS.brandBg}; border-color: ${DS.brand}; color: ${DS.brand}; font-weight: 700; }

  .vu-mode-btn {
    flex: 1; padding: 8px 0; border: none; border-radius: 6px;
    background: transparent; font-size: 13px; font-weight: 600;
    color: ${DS.dimText}; cursor: pointer; font-family: inherit; transition: all 0.12s;
  }
  .vu-mode-btn.active { background: #fff; color: ${DS.bodyText}; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }

  .vu-tier-btn {
    padding: 12px 14px; border-radius: 7px; border: 1px solid ${DS.border};
    background: ${DS.pageBg}; cursor: pointer; font-family: inherit;
    text-align: left; transition: all 0.12s; display: flex; flex-direction: column; gap: 3px;
  }

  @keyframes vu-spin    { to { transform: rotate(360deg); } }
  @keyframes vu-shine   { 0% { left: -100%; } 100% { left: 200%; } }
`;

function SectionLabel({ children }) {
  return (
    <p style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.12em", color: DS.dimText, marginBottom: 8 }}>
      {children}
    </p>
  );
}

function ProgressBar({ progress, label }) {
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: DS.bodyText }}>{label}</span>
        <span style={{ fontSize: 12, fontWeight: 800, color: DS.brand }}>{progress}%</span>
      </div>
      <div style={{ height: 6, background: DS.pageBg, borderRadius: 99, overflow: "hidden", border: `1px solid ${DS.border}` }}>
        <div style={{ height: "100%", width: `${progress}%`, background: `linear-gradient(90deg, ${DS.brand}, #4fa8ff)`, borderRadius: 99, transition: "width 0.3s ease", position: "relative", overflow: "hidden" }}>
          {progress < 100 && (
            <div style={{ position: "absolute", top: 0, bottom: 0, width: "60%", background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent)", animation: "vu-shine 1.2s ease-in-out infinite" }} />
          )}
        </div>
      </div>
    </div>
  );
}

function StatusBanner({ status, error }) {
  if (status === "processing") return (
    <div style={{ padding: "14px 16px", background: DS.brandBg, border: `1px solid ${DS.brandBorder}`, borderRadius: 7, display: "flex", alignItems: "flex-start", gap: 12 }}>
      <div style={{ width: 16, height: 16, border: `2px solid ${DS.brandBorder}`, borderTopColor: DS.brand, borderRadius: "50%", animation: "vu-spin 0.8s linear infinite", flexShrink: 0, marginTop: 1 }} />
      <div>
        <p style={{ fontSize: 13, fontWeight: 700, color: DS.brand, marginBottom: 2 }}>Transcoding in progress</p>
        <p style={{ fontSize: 12, color: DS.labelText, lineHeight: 1.5 }}>Mux is processing your video — usually 1–3 minutes. You can close this window; it will appear in your library automatically when ready.</p>
      </div>
    </div>
  );
  if (status === "done") return (
    <div style={{ padding: "13px 16px", background: DS.safeBg, border: `1px solid ${DS.safeBorder}`, borderRadius: 7, display: "flex", alignItems: "center", gap: 10 }}>
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="8" fill={DS.safe}/><path d="M4.5 8l2.5 2.5L11.5 6" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
      <p style={{ fontSize: 13, fontWeight: 700, color: DS.safe }}>Video saved to your library.</p>
    </div>
  );
  if (status === "error" && error) return (
    <div style={{ padding: "13px 16px", background: DS.bannedBg, border: `1px solid ${DS.banned}25`, borderRadius: 7 }}>
      <p style={{ fontSize: 13, fontWeight: 700, color: DS.banned }}>{error}</p>
    </div>
  );
  return null;
}

export default function VideoUpload({ trainerId, onSuccess }) {
  const [mode,     setMode]     = useState("upload");
  const [file,     setFile]     = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [embedUrl, setEmbedUrl] = useState("");
  const [title,    setTitle]    = useState("");
  const [desc,     setDesc]     = useState("");
  const [tier,     setTier]     = useState("Basic");
  const [tags,     setTags]     = useState({});
  const [progress, setProgress] = useState(0);
  const [status,   setStatus]   = useState("idle");
  const [error,    setError]    = useState("");
  const fileRef = useRef(null);

  const isSubmitting = status === "uploading";
  const isDone       = status === "done" || status === "processing";

  function toggleTag(categoryLabel, value) {
    const key = TAG_KEYS[categoryLabel] ?? categoryLabel;
    if (MULTI_SELECT.has(categoryLabel)) {
      // Multi-select: toggle in/out of array
      setTags(prev => {
        const current = Array.isArray(prev[key]) ? prev[key] : [];
        return {
          ...prev,
          [key]: current.includes(value)
            ? current.filter(v => v !== value)
            : [...current, value],
        };
      });
    } else {
      // Single-select: deselect if same, otherwise replace
      setTags(prev => ({ ...prev, [key]: prev[key] === value ? undefined : value }));
    }
  }

  function isTagActive(categoryLabel, opt) {
    const key = TAG_KEYS[categoryLabel] ?? categoryLabel;
    return MULTI_SELECT.has(categoryLabel)
      ? Array.isArray(tags[key]) && tags[key].includes(opt)
      : tags[key] === opt;
  }

  function reset() {
    setFile(null); setEmbedUrl(""); setTitle(""); setDesc("");
    setTier("Basic"); setTags({}); setProgress(0); setStatus("idle"); setError("");
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!title.trim())                        return setError("Add a title before saving.");
    if (mode === "embed" && !embedUrl.trim()) return setError("Paste a video URL.");
    if (mode === "upload" && !file)           return setError("Select a video file.");

    setError("");
    setStatus("uploading");

    try {
      if (mode === "embed") {
        const res = await fetch("/api/commercial/videos", {
          method: "POST", credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title, description: desc, sourceType: "embed", embedUrl, tier, tags }),
        });
        if (!res.ok) throw new Error((await res.json()).error ?? "Failed to save");
        setStatus("done");
        onSuccess?.();
        return;
      }

      setProgress(5);
      const initRes = await fetch("/api/commercial/videos", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, description: desc, sourceType: "upload", tier, tags }),
      });
      if (!initRes.ok) throw new Error((await initRes.json()).error ?? "Failed to create video record");
      const { video: pendingRecord } = await initRes.json();
      setProgress(12);

      const muxRes = await fetch("/api/commercial/mux-upload", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videoRecordId: pendingRecord.id }),
      });
      if (!muxRes.ok) throw new Error("Could not get upload URL. Check your Mux credentials.");
      const { uploadId, uploadUrl } = await muxRes.json();
      setProgress(18);

      await fetch(`/api/commercial/videos?id=${pendingRecord.id}`, {
        method: "PUT", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ muxUploadId: uploadId }),
      });
      setProgress(22);

      await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("PUT", uploadUrl);
        xhr.setRequestHeader("Content-Type", file.type || "video/*");
        xhr.upload.addEventListener("progress", ev => {
          if (ev.lengthComputable) setProgress(22 + Math.round((ev.loaded / ev.total) * 76));
        });
        xhr.addEventListener("load",  () => xhr.status < 300 ? resolve() : reject(new Error("Upload to Mux failed")));
        xhr.addEventListener("error", () => reject(new Error("Network error during upload")));
        xhr.send(file);
      });

      setProgress(100);
      setStatus("processing");
      onSuccess?.();

    } catch (err) {
      console.error("[VideoUpload]", err);
      setStatus("error");
      setError(err.message || "Something went wrong. Please try again.");
    }
  }

  const inputStyle = {
    padding: "10px 12px", border: `1px solid ${DS.border}`, borderRadius: 6,
    fontSize: 13, fontFamily: "inherit", color: DS.bodyText, outline: "none",
    width: "100%", background: "#fff", transition: "border-color 0.14s, box-shadow 0.14s",
  };
  const focusHandlers = {
    onFocus: e => { e.target.style.borderColor = DS.brand; e.target.style.boxShadow = `0 0 0 3px ${DS.brandBg}`; },
    onBlur:  e => { e.target.style.borderColor = DS.border; e.target.style.boxShadow = "none"; },
  };

  return (
    <div style={{ fontFamily: "system-ui, -apple-system, sans-serif", color: DS.bodyText }}>
      <style>{CSS}</style>

      {/* Mode toggle */}
      <div style={{ display: "flex", gap: 4, marginBottom: 20, background: DS.pageBg, borderRadius: 8, padding: 4, border: `1px solid ${DS.border}` }}>
        {[{ key: "upload", label: "↑  Upload file" }, { key: "embed", label: "⊞  Embed URL" }].map(m => (
          <button key={m.key} type="button"
            className={`vu-mode-btn${mode === m.key ? " active" : ""}`}
            onClick={() => { setMode(m.key); setError(""); }}
            disabled={isSubmitting}>
            {m.label}
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>

        {/* Title */}
        <div>
          <SectionLabel>Title *</SectionLabel>
          <input style={inputStyle} {...focusHandlers}
            value={title} onChange={e => setTitle(e.target.value)}
            placeholder="e.g. Upper Body Hypertrophy — Week 3 Day 1"
            disabled={isSubmitting || isDone} />
        </div>

        {/* Description */}
        <div>
          <SectionLabel>Description <span style={{ textTransform: "none", fontWeight: 500, letterSpacing: 0 }}>(optional)</span></SectionLabel>
          <textarea style={{ ...inputStyle, resize: "vertical", minHeight: 64, lineHeight: 1.5 }} {...focusHandlers}
            value={desc} onChange={e => setDesc(e.target.value)}
            placeholder="What athletes should know before watching — cues, focus points, context."
            disabled={isSubmitting || isDone} />
        </div>

        {/* File or URL */}
        {mode === "upload" ? (
          <div>
            <SectionLabel>Video file *</SectionLabel>
            <div
              className={`vu-drop${dragOver ? " drag-over" : ""}${file ? " has-file" : ""}`}
              onClick={() => !isSubmitting && !isDone && fileRef.current?.click()}
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={e => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f?.type.startsWith("video/")) setFile(f); }}
            >
              <input ref={fileRef} type="file" accept="video/*" style={{ display: "none" }}
                onChange={e => setFile(e.target.files[0] ?? null)} />
              {file ? (
                <>
                  <div style={{ width: 36, height: 36, borderRadius: 8, background: DS.safeBg, border: `1px solid ${DS.safeBorder}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><rect x="2" y="3" width="20" height="18" rx="2" stroke={DS.safe} strokeWidth="1.5"/><polygon points="9,8 9,16 16,12" fill={DS.safe}/></svg>
                  </div>
                  <p style={{ fontSize: 13, fontWeight: 700, color: DS.safe }}>{file.name}</p>
                  <p style={{ fontSize: 11, color: DS.labelText }}>{(file.size / 1e6).toFixed(1)} MB · Click to change</p>
                </>
              ) : (
                <>
                  <div style={{ width: 40, height: 40, borderRadius: 8, background: DS.brandBg, border: `1px solid ${DS.brandBorder}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                      <path d="M12 16V8M12 8l-3 3M12 8l3 3" stroke={DS.brand} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M3 17v2a2 2 0 002 2h14a2 2 0 002-2v-2" stroke={DS.brand} strokeWidth="1.5" strokeLinecap="round"/>
                    </svg>
                  </div>
                  <p style={{ fontSize: 13, fontWeight: 700, color: DS.bodyText }}>Drop video here or click to browse</p>
                  <p style={{ fontSize: 11, color: DS.dimText }}>MP4, MOV, WebM — no size limit</p>
                </>
              )}
            </div>
          </div>
        ) : (
          <div>
            <SectionLabel>Video URL *</SectionLabel>
            <input style={inputStyle} {...focusHandlers}
              value={embedUrl} onChange={e => setEmbedUrl(e.target.value)}
              placeholder="https://vimeo.com/... or https://youtube.com/..."
              disabled={isSubmitting || isDone} />
            <p style={{ fontSize: 11, color: DS.dimText, marginTop: 5 }}>
              Vimeo Pro recommended for paid content — restricts playback to your domain.
            </p>
          </div>
        )}

        {/* Tier */}
        <div>
          <SectionLabel>Tier access</SectionLabel>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
            {TIERS.map(t => {
              const tc = TIER_CONFIG[t];
              const isActive = tier === t;
              return (
                <button key={t} type="button" className="vu-tier-btn"
                  disabled={isSubmitting || isDone}
                  onClick={() => setTier(t)}
                  style={{ borderColor: isActive ? tc.color + "88" : DS.border, background: isActive ? tc.bg : DS.pageBg, borderLeftWidth: isActive ? 3 : 1, borderLeftColor: isActive ? tc.color : DS.border }}>
                  <span style={{ fontSize: 11, fontWeight: 800, color: tc.color, letterSpacing: "0.08em", textTransform: "uppercase" }}>{t}</span>
                  <span style={{ fontSize: 11, color: DS.labelText }}>{tc.desc}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Tags */}
        <div>
          <SectionLabel>Tags <span style={{ textTransform: "none", fontWeight: 500, letterSpacing: 0 }}>(optional)</span></SectionLabel>
          <div style={{ display: "flex", flexDirection: "column", gap: 14, padding: "14px", background: DS.pageBg, border: `1px solid ${DS.border}`, borderRadius: 7 }}>
            {Object.entries(TAGS).map(([categoryLabel, options]) => {
              const isMulti = MULTI_SELECT.has(categoryLabel);
              return (
                <div key={categoryLabel}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 7 }}>
                    <p style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: DS.dimText }}>
                      {categoryLabel}
                    </p>
                    {isMulti && (
                      <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: DS.brand, background: DS.brandBg, padding: "2px 7px", borderRadius: 99, border: `1px solid ${DS.brandBorder}` }}>
                        Multi-select
                      </span>
                    )}
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                    {options.map(opt => (
                      <button key={opt} type="button"
                        className={`vu-tag-btn${isTagActive(categoryLabel, opt) ? " active" : ""}`}
                        disabled={isSubmitting || isDone}
                        onClick={() => toggleTag(categoryLabel, opt)}>
                        {opt}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Progress */}
        {status === "uploading" && (
          <ProgressBar
            progress={progress}
            label={progress < 22 ? "Preparing…" : progress < 98 ? "Uploading to Mux…" : "Finalizing…"}
          />
        )}

        {/* Status banner */}
        <StatusBanner status={status} error={error} />

        {/* Actions */}
        {!isDone ? (
          <button type="submit" disabled={isSubmitting}
            style={{ padding: "12px", background: isSubmitting ? DS.brand + "99" : DS.brand, color: "#fff", border: "none", borderRadius: 7, fontSize: 13, fontWeight: 700, cursor: isSubmitting ? "not-allowed" : "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
            {isSubmitting ? (
              <>
                <span style={{ width: 13, height: 13, border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#fff", borderRadius: "50%", animation: "vu-spin 0.7s linear infinite", display: "inline-block" }} />
                {mode === "upload" ? `Uploading… ${progress}%` : "Saving…"}
              </>
            ) : (
              mode === "upload" ? "Upload video →" : "Save video →"
            )}
          </button>
        ) : status === "done" ? (
          <button type="button" onClick={reset}
            style={{ padding: "11px", background: "transparent", color: DS.brand, border: `1px solid ${DS.brandBorder}`, borderRadius: 7, fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
            + Add another video
          </button>
        ) : null}

      </form>
    </div>
  );
}