// pages/film-exchange/[token].js
// Public landing page — opposing coach views the requesting team's film
// and either uploads their own or pastes a link (HUDL, YouTube, Vimeo, etc.)
// No login required.

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/router";
import Head from "next/head";
import MuxPlayer from "@mux/mux-player-react";
import { CheckCircle, Upload, Film, ArrowRight, Play, Link2, ExternalLink } from "lucide-react";

const DS = {
  bg:       "#080a10",
  card:     "#0f1320",
  raised:   "#161c2e",
  brand:    "#4FABFF",
  brandBg:  "rgba(79,171,255,0.10)",
  green:    "#34C759",
  greenBg:  "rgba(52,199,89,0.12)",
  amber:    "#F59E0B",
  border:   "rgba(255,255,255,0.07)",
  body:     "#f0f2f6",
  label:    "#9ba8b4",
  dim:      "#5a6a7d",
};

// ── Platform detection ────────────────────────────────────────────────────────

function detectPlatform(url) {
  if (!url) return null;
  const u = url.toLowerCase();
  if (u.includes("hudl.com"))                               return { name: "HUDL",         color: "#FC4C02" };
  if (u.includes("youtube.com") || u.includes("youtu.be")) return { name: "YouTube",       color: "#FF0000" };
  if (u.includes("vimeo.com"))                              return { name: "Vimeo",         color: "#1AB7EA" };
  if (u.includes("drive.google.com"))                       return { name: "Google Drive",  color: "#4285F4" };
  if (u.includes("dropbox.com"))                            return { name: "Dropbox",       color: "#0061FE" };
  if (u.includes("box.com"))                                return { name: "Box",           color: "#0061D5" };
  try { new URL(url); return { name: "Link", color: DS.label }; } catch { return null; }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function StatPill({ value, label, color = DS.brand }) {
  return (
    <div style={{ textAlign: "center" }}>
      <div style={{ fontSize: 28, fontWeight: 900, color, lineHeight: 1, letterSpacing: -1 }}>{value}</div>
      <div style={{ fontSize: 10, fontWeight: 700, color: DS.dim, textTransform: "uppercase", letterSpacing: "0.08em", marginTop: 3 }}>{label}</div>
    </div>
  );
}

function ProgressBar({ pct }) {
  return (
    <div style={{ height: 3, borderRadius: 2, background: "rgba(255,255,255,0.07)", overflow: "hidden" }}>
      <div style={{ height: "100%", width: `${Math.min(100, pct)}%`, background: DS.brand, borderRadius: 2, transition: "width 0.3s ease" }} />
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function FilmExchangePage() {
  const router    = useRouter();
  const { token } = router.query;
  const fileRef   = useRef(null);

  const [data,           setData]           = useState(null);
  const [error,          setError]          = useState("");
  const [step,           setStep]           = useState("view");    // view | upload | done
  const [shareMode,      setShareMode]      = useState("upload");  // upload | link
  const [programName,    setProgramName]    = useState("");
  const [email,          setEmail]          = useState("");
  const [title,          setTitle]          = useState("");

  // File upload state
  const [file,           setFile]           = useState(null);
  const [uploading,      setUploading]      = useState(false);
  const [uploadPct,      setUploadPct]      = useState(0);
  const [uploadErr,      setUploadErr]      = useState("");

  // Link share state
  const [linkUrl,        setLinkUrl]        = useState("");
  const [linkSubmitting, setLinkSubmitting] = useState(false);
  const [linkErr,        setLinkErr]        = useState("");

  useEffect(() => {
    if (!token) return;
    fetch(`/api/film/exchange-accept?token=${token}`)
      .then(r => r.json())
      .then(d => {
        if (!d.ok) { setError(d.error ?? "Exchange not found"); return; }
        setData(d);
        if (d.exchange?.status === "accepted") setStep("done");
        if (d.exchange?.requestingOrgName) setTitle(`vs ${d.exchange.requestingOrgName}`);
      })
      .catch(() => setError("Failed to load exchange"));
  }, [token]);

  // ── File handlers ──────────────────────────────────────────────────────────

  const handleFileSelect = useCallback((e) => {
    const f = e.target.files?.[0];
    if (f) setFile(f);
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    const f = e.dataTransfer.files?.[0];
    if (f && f.type.startsWith("video/")) setFile(f);
  }, []);

  async function upload() {
    if (!file || !email.includes("@")) return;
    setUploading(true); setUploadErr("");

    try {
      const presignRes  = await fetch("/api/film/exchange-accept", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, action: "presign", email, programName, contentType: file.type || "video/mp4" }),
      });
      const presignData = await presignRes.json();
      if (!presignData.ok) { setUploadErr(presignData.error ?? "Failed to start upload"); setUploading(false); return; }

      const { uploadUrl, s3Key } = presignData;

      await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) setUploadPct(Math.round(e.loaded / e.total * 100));
        };
        xhr.onload  = () => (xhr.status >= 200 && xhr.status < 300) ? resolve() : reject(new Error(`S3 ${xhr.status}`));
        xhr.onerror = () => reject(new Error("Upload network error"));
        xhr.open("PUT", uploadUrl);
        xhr.setRequestHeader("Content-Type", file.type || "video/mp4");
        xhr.send(file);
      });

      const completeRes  = await fetch("/api/film/exchange-accept", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, action: "complete", s3Key, email, programName, title }),
      });
      const completeData = await completeRes.json();
      if (!completeData.ok) { setUploadErr(completeData.error ?? "Failed to finalize"); setUploading(false); return; }

      setStep("done");
    } catch (err) {
      setUploadErr(err.message ?? "Upload failed — please try again");
    } finally {
      setUploading(false);
    }
  }

  // ── Link share handler ─────────────────────────────────────────────────────

  async function shareLink() {
    if (!linkUrl.trim()) { setLinkErr("Paste your film link first"); return; }
    if (!email.includes("@")) { setLinkErr("Enter your email address"); return; }
    if (!detectPlatform(linkUrl.trim())) { setLinkErr("That doesn't look like a valid URL"); return; }

    setLinkSubmitting(true); setLinkErr("");
    try {
      const r = await fetch("/api/film/exchange-accept", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, action: "link-url", externalUrl: linkUrl.trim(), email, programName }),
      });
      const d = await r.json();
      if (!d.ok) { setLinkErr(d.error ?? "Failed to submit link"); setLinkSubmitting(false); return; }
      setStep("done");
    } catch {
      setLinkErr("Network error — please try again");
    } finally {
      setLinkSubmitting(false);
    }
  }

  // ── Error / loading states ─────────────────────────────────────────────────

  if (error) return (
    <div style={{ minHeight: "100vh", background: DS.bg, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>🎬</div>
        <h2 style={{ margin: "0 0 8px", color: DS.body, fontWeight: 800 }}>Exchange not found</h2>
        <p style={{ margin: 0, color: DS.label }}>{error}</p>
      </div>
    </div>
  );

  if (!data) return (
    <div style={{ minHeight: "100vh", background: DS.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ width: 36, height: 36, border: `3px solid ${DS.brand}`, borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  const { exchange, film, analytics, receivedFilm } = data;
  const filmTitle = film?.title || (film?.opponent ? `vs ${film.opponent}` : "Game Film");
  const dateStr   = film?.gameDate
    ? new Date(film.gameDate).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
    : "";

  const canUpload  = file && email.includes("@") && !uploading;
  const canLink    = linkUrl.trim() && email.includes("@") && !linkSubmitting;
  const platform   = detectPlatform(linkUrl);
  const donePlatform = detectPlatform(exchange?.externalUrl);

  return (
    <>
      <Head>
        <title>{exchange?.requestingOrgName ? `${exchange.requestingOrgName} — Film Exchange` : "Film Exchange"} · CheckPeak</title>
        <meta name="description" content="View and respond to a game film exchange request." />
        <meta name="robots" content="noindex" />
      </Head>

      <div style={{ minHeight: "100vh", background: DS.bg, fontFamily: "-apple-system, 'Segoe UI', Arial, sans-serif" }}>

        {/* ── Nav ── */}
        <div style={{ borderBottom: `1px solid ${DS.border}`, padding: "0 24px" }}>
          <div style={{ maxWidth: 840, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", height: 56 }}>
            <span style={{ fontSize: 17, fontWeight: 900, color: DS.brand, letterSpacing: -0.5 }}>
              Check<span style={{ color: DS.body }}>Peak</span>
            </span>
            <a href="/login" style={{ fontSize: 13, fontWeight: 700, color: DS.label, textDecoration: "none" }}>
              Sign In
            </a>
          </div>
        </div>

        <div style={{ maxWidth: 840, margin: "0 auto", padding: "40px 24px 80px" }}>

          {/* ── Header ── */}
          <div style={{ marginBottom: 32 }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: DS.brandBg, border: `1px solid ${DS.brand}33`, borderRadius: 20, padding: "4px 12px", marginBottom: 16 }}>
              <div style={{ width: 6, height: 6, borderRadius: 3, background: DS.brand }} />
              <span style={{ fontSize: 11, fontWeight: 800, color: DS.brand, textTransform: "uppercase", letterSpacing: "0.1em" }}>Film Exchange Request</span>
            </div>
            <h1 style={{ margin: "0 0 8px", fontSize: "clamp(22px, 4vw, 30px)", fontWeight: 900, color: DS.body, lineHeight: 1.15, letterSpacing: -0.5 }}>
              {exchange?.requestingOrgName ?? "A coach"} wants to exchange game film with you
            </h1>
            {dateStr && <p style={{ margin: 0, fontSize: 14, color: DS.label }}>{dateStr}</p>}
          </div>

          {/* ── Film player ── */}
          {film?.muxPlaybackId ? (
            <div style={{ borderRadius: 16, overflow: "hidden", background: "#000", marginBottom: 20, boxShadow: "0 24px 64px rgba(0,0,0,0.5)" }}>
              <MuxPlayer
                playbackId={film.muxPlaybackId}
                streamType="on-demand"
                style={{ width: "100%", aspectRatio: "16/9", display: "block" }}
                accentColor={DS.brand}
              />
            </div>
          ) : (
            <div style={{ borderRadius: 16, background: DS.card, border: `1px solid ${DS.border}`, aspectRatio: "16/9", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", marginBottom: 20, gap: 10 }}>
              <Film size={40} color={DS.dim} />
              <span style={{ fontSize: 13, color: DS.dim }}>
                {film?.status === "uploading" ? "Film is processing — check back soon" : "Film preview unavailable"}
              </span>
            </div>
          )}

          {/* ── Film info + analytics ── */}
          <div style={{ background: DS.card, borderRadius: 14, border: `1px solid ${DS.border}`, padding: "18px 22px", marginBottom: 20 }}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
              <div>
                <div style={{ fontSize: 17, fontWeight: 800, color: DS.body, marginBottom: 2 }}>{filmTitle}</div>
                {dateStr && <div style={{ fontSize: 13, color: DS.label }}>{dateStr}</div>}
              </div>
              {analytics && (
                <div style={{ display: "flex", gap: 24, flexShrink: 0 }}>
                  {analytics.playCount > 0 && <StatPill value={analytics.playCount} label="Plays Tagged" />}
                  {analytics.successPct != null && <StatPill value={`${analytics.successPct}%`} label="Success Rate" color={DS.green} />}
                  {analytics.tds > 0 && <StatPill value={analytics.tds} label="TDs" color={DS.amber} />}
                </div>
              )}
            </div>
            {analytics?.runs > 0 && analytics?.passes > 0 && (
              <div style={{ marginTop: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: DS.dim, marginBottom: 5, fontWeight: 700 }}>
                  <span>RUN {analytics.runs}</span>
                  <span>PASS {analytics.passes}</span>
                </div>
                <ProgressBar pct={analytics.runs / (analytics.runs + analytics.passes) * 100} />
              </div>
            )}
          </div>

          {/* ── Coach message ── */}
          {exchange?.message && (
            <div style={{ borderLeft: `3px solid ${DS.brand}`, background: DS.brandBg, borderRadius: "0 12px 12px 0", padding: "14px 18px", marginBottom: 28 }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: DS.brand, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 6 }}>
                Message from {exchange.requestingOrgName}
              </div>
              <div style={{ fontSize: 14, color: DS.body, lineHeight: 1.65, fontStyle: "italic" }}>
                "{exchange.message}"
              </div>
            </div>
          )}

          <div style={{ height: 1, background: DS.border, margin: "32px 0" }} />

          {/* ══════════════════════════════════════════════════════════════════
              STEP: done
          ══════════════════════════════════════════════════════════════════ */}
          {step === "done" ? (
            <div style={{ textAlign: "center", padding: "40px 0" }}>
              <div style={{ width: 64, height: 64, borderRadius: 32, background: DS.greenBg, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px" }}>
                <CheckCircle size={32} color={DS.green} />
              </div>
              <h2 style={{ margin: "0 0 10px", fontSize: 24, fontWeight: 900, color: DS.body }}>Exchange complete!</h2>
              <p style={{ margin: "0 0 28px", fontSize: 15, color: DS.label, lineHeight: 1.6 }}>
                {exchange?.requestingOrgName} has been notified. They'll be in touch soon.
              </p>

              {/* Uploaded film card */}
              {receivedFilm && (
                <div style={{ background: DS.card, borderRadius: 12, border: `1px solid ${DS.border}`, padding: 18, maxWidth: 340, margin: "0 auto 28px", textAlign: "left" }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: DS.label, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>Your film</div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: DS.body }}>
                    {receivedFilm.title ?? "Uploaded Film"}
                  </div>
                  <div style={{ fontSize: 12, color: DS.dim, marginTop: 4 }}>
                    {receivedFilm.status === "ready" ? "Ready to view" : "Processing — usually takes a few minutes"}
                  </div>
                </div>
              )}

              {/* External link confirmation card */}
              {exchange?.externalUrl && (
                <div style={{ background: DS.card, borderRadius: 12, border: `1px solid ${DS.border}`, padding: 18, maxWidth: 380, margin: "0 auto 28px", textAlign: "left" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                    {donePlatform && (
                      <div style={{ width: 8, height: 8, borderRadius: 4, background: donePlatform.color, flexShrink: 0 }} />
                    )}
                    <div style={{ fontSize: 11, fontWeight: 700, color: DS.label, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                      Your film link · {donePlatform?.name ?? "External"}
                    </div>
                  </div>
                  <div style={{ fontSize: 12, color: DS.dim, wordBreak: "break-all", marginBottom: 12, fontFamily: "monospace" }}>
                    {exchange.externalUrl}
                  </div>
                  <a
                    href={exchange.externalUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 700, color: donePlatform?.color ?? DS.brand, textDecoration: "none" }}
                  >
                    <ExternalLink size={12} /> Open link
                  </a>
                </div>
              )}

              {/* Upsell */}
              <div style={{ padding: "16px 20px", background: DS.raised, borderRadius: 14, display: "inline-block", textAlign: "left", maxWidth: 420 }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: DS.body, marginBottom: 4 }}>Want your own film room?</div>
                <div style={{ fontSize: 13, color: DS.label, marginBottom: 14, lineHeight: 1.55 }}>
                  CheckPeak gives your program a full film tagging suite, analytics, cut-ups, and sharing — free to try.
                </div>
                <a href="/org-login" style={{ display: "inline-flex", alignItems: "center", gap: 6, background: DS.brand, color: "#000", textDecoration: "none", fontWeight: 800, fontSize: 13, padding: "9px 18px", borderRadius: 9 }}>
                  Get started free <ArrowRight size={14} />
                </a>
              </div>
            </div>

          /* ══════════════════════════════════════════════════════════════════
              STEP: upload (file or link)
          ══════════════════════════════════════════════════════════════════ */
          ) : step === "upload" ? (
            <div>
              <h2 style={{ margin: "0 0 6px", fontSize: 20, fontWeight: 800, color: DS.body }}>Share your film</h2>
              <p style={{ margin: "0 0 24px", fontSize: 14, color: DS.label, lineHeight: 1.55 }}>
                {exchange?.requestingOrgName} will get access as soon as you share.
              </p>

              {/* ── Tab switcher ── */}
              <div style={{ display: "flex", gap: 0, background: DS.raised, borderRadius: 12, padding: 4, marginBottom: 28 }}>
                {[
                  { id: "upload", label: "Upload a File",  Icon: Upload },
                  { id: "link",   label: "Paste a Link",   Icon: Link2  },
                ].map(({ id, label, Icon }) => {
                  const active = shareMode === id;
                  return (
                    <button
                      key={id}
                      onClick={() => { setShareMode(id); setUploadErr(""); setLinkErr(""); }}
                      style={{
                        flex: 1, padding: "9px 14px", borderRadius: 9, border: "none",
                        cursor: "pointer",
                        background: active ? DS.brand : "transparent",
                        color:      active ? "#000"   : DS.dim,
                        fontSize: 13, fontWeight: 700,
                        display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
                        transition: "all 0.15s",
                      }}
                    >
                      <Icon size={14} /> {label}
                    </button>
                  );
                })}
              </div>

              {/* ── UPLOAD FILE tab ── */}
              {shareMode === "upload" && (
                <>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
                    <div>
                      <label style={labelStyle}>Program / School</label>
                      <input style={inputStyle} value={programName} onChange={e => setProgramName(e.target.value)}
                        placeholder="Lincoln High School" />
                    </div>
                    <div>
                      <label style={labelStyle}>Your Email <span style={{ color: DS.brand }}>*</span></label>
                      <input style={inputStyle} type="email" value={email} onChange={e => setEmail(e.target.value)}
                        placeholder="coach@school.edu" />
                    </div>
                  </div>
                  <div style={{ marginBottom: 20 }}>
                    <label style={labelStyle}>Film Title</label>
                    <input style={inputStyle} value={title} onChange={e => setTitle(e.target.value)}
                      placeholder={`vs ${exchange?.requestingOrgName ?? "Opponent"}`} />
                  </div>

                  {/* Drop zone */}
                  <div
                    onDrop={handleDrop}
                    onDragOver={e => e.preventDefault()}
                    onClick={() => fileRef.current?.click()}
                    style={{
                      border: `2px dashed ${file ? DS.green : DS.border}`,
                      borderRadius: 14, padding: "36px 24px", textAlign: "center",
                      cursor: "pointer", background: file ? DS.greenBg : DS.raised,
                      transition: "all 0.2s", marginBottom: 20,
                    }}
                  >
                    <input ref={fileRef} type="file" accept="video/*" style={{ display: "none" }} onChange={handleFileSelect} />
                    {file ? (
                      <>
                        <div style={{ fontSize: 28, marginBottom: 8 }}>🎬</div>
                        <div style={{ fontSize: 15, fontWeight: 700, color: DS.green }}>{file.name}</div>
                        <div style={{ fontSize: 12, color: DS.dim, marginTop: 4 }}>
                          {(file.size / 1024 / 1024).toFixed(0)} MB · Click to change
                        </div>
                      </>
                    ) : (
                      <>
                        <Upload size={28} color={DS.dim} style={{ marginBottom: 8 }} />
                        <div style={{ fontSize: 14, fontWeight: 700, color: DS.label }}>Drag & drop your game film here</div>
                        <div style={{ fontSize: 12, color: DS.dim, marginTop: 4 }}>or click to select · MP4, MOV, or any video format</div>
                      </>
                    )}
                  </div>

                  {uploading && (
                    <div style={{ marginBottom: 16 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: DS.label, marginBottom: 6 }}>
                        <span>{uploadPct < 100 ? "Uploading…" : "Finalizing…"}</span>
                        <span>{uploadPct}%</span>
                      </div>
                      <ProgressBar pct={uploadPct} />
                    </div>
                  )}

                  {uploadErr && <ErrBox>{uploadErr}</ErrBox>}

                  <div style={{ display: "flex", gap: 10 }}>
                    <button
                      onClick={upload} disabled={!canUpload}
                      style={{
                        flex: 1, padding: "14px 20px", borderRadius: 12, border: "none",
                        cursor: canUpload ? "pointer" : "not-allowed",
                        background: canUpload ? DS.brand : "rgba(255,255,255,0.07)",
                        color:      canUpload ? "#000"   : DS.dim,
                        fontSize: 14, fontWeight: 800,
                        display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                      }}
                    >
                      {uploading ? "Uploading…" : <><Upload size={15} /> Upload & Complete Exchange</>}
                    </button>
                    <button onClick={() => setStep("view")} style={backBtnStyle}>Back</button>
                  </div>
                </>
              )}

              {/* ── PASTE LINK tab ── */}
              {shareMode === "link" && (
                <>
                  {/* Hero copy */}
                  <div style={{ background: DS.raised, borderRadius: 14, padding: "20px 22px", marginBottom: 24, border: `1px solid ${DS.border}` }}>
                    <div style={{ fontSize: 15, fontWeight: 800, color: DS.body, marginBottom: 6 }}>
                      Already on HUDL, YouTube, or Vimeo?
                    </div>
                    <div style={{ fontSize: 13, color: DS.label, lineHeight: 1.6 }}>
                      Paste your shareable film link below — no re-uploading needed. {exchange?.requestingOrgName} will get the link directly.
                    </div>
                  </div>

                  {/* Link input */}
                  <div style={{ marginBottom: platform ? 10 : 20 }}>
                    <label style={labelStyle}>Film Link</label>
                    <div style={{ position: "relative" }}>
                      <input
                        style={{ ...inputStyle, paddingRight: 48 }}
                        value={linkUrl}
                        onChange={e => setLinkUrl(e.target.value)}
                        placeholder="https://www.hudl.com/video/…"
                        onKeyDown={e => e.key === "Enter" && canLink && shareLink()}
                      />
                      <button
                        onClick={async () => {
                          try {
                            const text = await navigator.clipboard.readText();
                            setLinkUrl(text);
                          } catch {}
                        }}
                        style={{
                          position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)",
                          background: "rgba(255,255,255,0.08)", border: "none", borderRadius: 6,
                          padding: "4px 8px", fontSize: 11, fontWeight: 700, color: DS.label,
                          cursor: "pointer",
                        }}
                      >
                        Paste
                      </button>
                    </div>
                  </div>

                  {/* Platform detection badge */}
                  {linkUrl.trim() && (
                    <div style={{ marginBottom: 20 }}>
                      {platform ? (
                        <div style={{ display: "inline-flex", alignItems: "center", gap: 7, background: `${platform.color}18`, border: `1px solid ${platform.color}40`, borderRadius: 8, padding: "5px 12px" }}>
                          <div style={{ width: 7, height: 7, borderRadius: 4, background: platform.color }} />
                          <span style={{ fontSize: 12, fontWeight: 700, color: platform.color }}>
                            {platform.name} detected ✓
                          </span>
                        </div>
                      ) : (
                        <div style={{ display: "inline-flex", alignItems: "center", gap: 7, background: "rgba(255,59,48,0.08)", border: "1px solid rgba(255,59,48,0.25)", borderRadius: 8, padding: "5px 12px" }}>
                          <span style={{ fontSize: 12, fontWeight: 700, color: "#FF3B30" }}>
                            Doesn't look like a valid URL
                          </span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Name + email */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20 }}>
                    <div>
                      <label style={labelStyle}>Program / School</label>
                      <input style={inputStyle} value={programName} onChange={e => setProgramName(e.target.value)}
                        placeholder="Lincoln High School" />
                    </div>
                    <div>
                      <label style={labelStyle}>Your Email <span style={{ color: DS.brand }}>*</span></label>
                      <input style={inputStyle} type="email" value={email} onChange={e => setEmail(e.target.value)}
                        placeholder="coach@school.edu" />
                    </div>
                  </div>

                  {linkErr && <ErrBox>{linkErr}</ErrBox>}

                  <div style={{ display: "flex", gap: 10 }}>
                    <button
                      onClick={shareLink} disabled={!canLink}
                      style={{
                        flex: 1, padding: "14px 20px", borderRadius: 12, border: "none",
                        cursor: canLink ? "pointer" : "not-allowed",
                        background: canLink ? DS.brand : "rgba(255,255,255,0.07)",
                        color:      canLink ? "#000"   : DS.dim,
                        fontSize: 14, fontWeight: 800,
                        display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                      }}
                    >
                      {linkSubmitting ? "Sharing…" : <><Link2 size={15} /> Share Film Link</>}
                    </button>
                    <button onClick={() => setStep("view")} style={backBtnStyle}>Back</button>
                  </div>
                </>
              )}

              {/* Already a user */}
              <p style={{ marginTop: 20, textAlign: "center", fontSize: 13, color: DS.dim }}>
                Already on CheckPeak?{" "}
                <a href={`/login?redirect=/film-exchange/${token}`} style={{ color: DS.brand, fontWeight: 700, textDecoration: "none" }}>
                  Sign in to share from your library →
                </a>
              </p>
            </div>

          /* ══════════════════════════════════════════════════════════════════
              STEP: view (default — shows film, CTA to share)
          ══════════════════════════════════════════════════════════════════ */
          ) : (
            <div style={{ textAlign: "center" }}>
              <h2 style={{ margin: "0 0 8px", fontSize: 22, fontWeight: 800, color: DS.body }}>
                Your move, Coach.
              </h2>
              <p style={{ margin: "0 0 12px", fontSize: 14, color: DS.label, lineHeight: 1.6, maxWidth: 460, marginLeft: "auto", marginRight: "auto" }}>
                Share your game film and {exchange?.requestingOrgName ?? "their team"} gets instant access. No account required.
              </p>

              {/* Option tiles */}
              <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap", marginBottom: 20 }}>
                <button
                  onClick={() => { setShareMode("upload"); setStep("upload"); }}
                  style={{
                    padding: "16px 28px", borderRadius: 14, border: "none", cursor: "pointer",
                    background: DS.brand, color: "#000", fontSize: 14, fontWeight: 800,
                    display: "inline-flex", alignItems: "center", gap: 9,
                    boxShadow: "0 8px 32px rgba(79,171,255,0.28)",
                  }}
                >
                  <Upload size={17} /> Upload a File
                </button>
                <button
                  onClick={() => { setShareMode("link"); setStep("upload"); }}
                  style={{
                    padding: "16px 28px", borderRadius: 14,
                    border: `1.5px solid ${DS.border}`,
                    cursor: "pointer", background: DS.raised,
                    color: DS.body, fontSize: 14, fontWeight: 800,
                    display: "inline-flex", alignItems: "center", gap: 9,
                  }}
                >
                  <Link2 size={17} /> Share a Link
                </button>
              </div>

              <p style={{ fontSize: 12, color: DS.dim, margin: "0 0 4px" }}>
                Already on HUDL or another platform? Use <strong style={{ color: DS.label }}>Share a Link</strong> — no re-uploading needed.
              </p>
              <p style={{ marginTop: 14, fontSize: 13, color: DS.dim }}>
                Already on CheckPeak?{" "}
                <a href={`/login?redirect=/film-exchange/${token}`} style={{ color: DS.brand, fontWeight: 700, textDecoration: "none" }}>
                  Sign in to share from your library →
                </a>
              </p>
            </div>
          )}

        </div>

        {/* ── Footer ── */}
        <div style={{ borderTop: `1px solid ${DS.border}`, padding: "20px 24px", textAlign: "center" }}>
          <span style={{ fontSize: 12, color: DS.dim }}>
            Powered by{" "}
            <a href="/" style={{ color: DS.brand, fontWeight: 700, textDecoration: "none" }}>CheckPeak</a>
            {" "}— Game Film Platform for Coaches
          </span>
        </div>

      </div>
    </>
  );
}

// ── Shared styles ─────────────────────────────────────────────────────────────

function ErrBox({ children }) {
  return (
    <div style={{ background: "rgba(255,59,48,0.1)", border: "1px solid rgba(255,59,48,0.25)", borderRadius: 10, padding: "10px 14px", marginBottom: 14, fontSize: 13, color: "#FF3B30" }}>
      {children}
    </div>
  );
}

const labelStyle = {
  display: "block", fontSize: 11, fontWeight: 700, color: "#9ba8b4",
  textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 6,
};
const inputStyle = {
  width: "100%", boxSizing: "border-box",
  background: "#161c2e", border: "1.5px solid rgba(255,255,255,0.1)", borderRadius: 10,
  padding: "11px 14px", fontSize: 14, color: "#f0f2f6", outline: "none",
};
const backBtnStyle = {
  padding: "14px 18px", borderRadius: 12, border: `1px solid rgba(255,255,255,0.07)`,
  background: "none", color: "#9ba8b4", fontSize: 13, fontWeight: 700, cursor: "pointer",
};
