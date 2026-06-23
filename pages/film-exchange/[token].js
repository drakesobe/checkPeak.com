// pages/film-exchange/[token].js
import { Fragment, useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/router";
import Head from "next/head";
import MuxPlayer from "@mux/mux-player-react";
import { CheckCircle, Upload, Film, ArrowRight, Link2, ExternalLink } from "lucide-react";

const DS = {
  bg:      "#080a10",
  card:    "#0f1320",
  raised:  "#161c2e",
  brand:   "#4FABFF",
  brandBg: "rgba(79,171,255,0.10)",
  green:   "#34C759",
  greenBg: "rgba(52,199,89,0.12)",
  amber:   "#F59E0B",
  border:  "rgba(255,255,255,0.08)",
  body:    "#f0f2f6",
  label:   "#9ba8b4",
  dim:     "#5a6a7d",
};

// ── Hooks ─────────────────────────────────────────────────────────────────────

function useIsMobile() {
  const [m, setM] = useState(false);
  useEffect(() => {
    const check = () => setM(window.innerWidth < 600);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);
  return m;
}

// ── Platform detection ────────────────────────────────────────────────────────

function detectPlatform(url) {
  if (!url) return null;
  const u = url.toLowerCase();
  if (u.includes("hudl.com"))                               return { name: "HUDL",        color: "#FC4C02" };
  if (u.includes("youtube.com") || u.includes("youtu.be")) return { name: "YouTube",      color: "#FF0000" };
  if (u.includes("vimeo.com"))                              return { name: "Vimeo",        color: "#1AB7EA" };
  if (u.includes("drive.google.com"))                       return { name: "Google Drive", color: "#4285F4" };
  if (u.includes("dropbox.com"))                            return { name: "Dropbox",      color: "#0061FE" };
  if (u.includes("box.com"))                                return { name: "Box",          color: "#0061D5" };
  try { new URL(url); return { name: "Link", color: DS.label }; } catch { return null; }
}

// ── Components ────────────────────────────────────────────────────────────────

function StatPill({ value, label, color = DS.brand }) {
  return (
    <div style={{ textAlign: "center", flexShrink: 0 }}>
      <div style={{ fontSize: 26, fontWeight: 900, color, lineHeight: 1, letterSpacing: -1 }}>{value}</div>
      <div style={{ fontSize: 10, fontWeight: 700, color: DS.dim, textTransform: "uppercase", letterSpacing: "0.08em", marginTop: 3, whiteSpace: "nowrap" }}>{label}</div>
    </div>
  );
}

function ProgressBar({ pct, height = 3 }) {
  return (
    <div style={{ height, borderRadius: height, background: "rgba(255,255,255,0.07)", overflow: "hidden" }}>
      <div style={{ height: "100%", width: `${Math.min(100, pct)}%`, background: DS.brand, borderRadius: height, transition: "width 0.4s ease" }} />
    </div>
  );
}

function StepIndicator({ step }) {
  const steps   = ["View Film", "Share Yours", "Done"];
  const stepMap = { view: 0, upload: 1, done: 2 };
  const current = stepMap[step] ?? 0;
  return (
    <div style={{ display: "flex", alignItems: "center", marginBottom: 28 }}>
      {steps.map((label, i) => {
        const done   = i < current;
        const active = i === current;
        return (
          <Fragment key={label}>
            {i > 0 && <div style={{ flex: 1, height: 1.5, background: done ? DS.brand : DS.border, maxWidth: 36, margin: "0 8px", transition: "background 0.3s" }} />}
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{
                width: 22, height: 22, borderRadius: 11, flexShrink: 0,
                background: done ? DS.brand : active ? DS.brand : "transparent",
                border: `2px solid ${done || active ? DS.brand : DS.border}`,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 10, fontWeight: 900,
                color: done || active ? "#000" : DS.dim,
                transition: "all 0.25s",
              }}>
                {done ? "✓" : i + 1}
              </div>
              <span style={{ fontSize: 11, fontWeight: active ? 700 : 500, color: active ? DS.body : DS.dim, whiteSpace: "nowrap" }}>{label}</span>
            </div>
          </Fragment>
        );
      })}
    </div>
  );
}

function ErrBox({ children }) {
  return (
    <div style={{ background: "rgba(255,59,48,0.09)", border: "1px solid rgba(255,59,48,0.22)", borderRadius: 10, padding: "10px 14px", marginBottom: 14, fontSize: 13, color: "#FF6B6B", display: "flex", alignItems: "flex-start", gap: 8, lineHeight: 1.5 }}>
      <span style={{ flexShrink: 0 }}>⚠</span>
      <span>{children}</span>
    </div>
  );
}

const labelStyle = {
  display: "block", fontSize: 11, fontWeight: 700, color: "#9ba8b4",
  textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 7,
};
const inputStyle = {
  width: "100%", boxSizing: "border-box",
  background: "#161c2e", border: "1.5px solid rgba(255,255,255,0.1)", borderRadius: 10,
  padding: "12px 14px", fontSize: 14, color: "#f0f2f6", outline: "none",
  transition: "border-color 0.15s, box-shadow 0.15s",
};

// ── Page ──────────────────────────────────────────────────────────────────────

export default function FilmExchangePage() {
  const router    = useRouter();
  const { token } = router.query;
  const fileRef   = useRef(null);
  const isMobile  = useIsMobile();

  const [data,           setData]           = useState(null);
  const [error,          setError]          = useState("");
  const [step,           setStep]           = useState("view");
  const [shareMode,      setShareMode]      = useState("upload");
  const [programName,    setProgramName]    = useState("");
  const [email,          setEmail]          = useState("");
  const [title,          setTitle]          = useState("");
  const [isDragging,     setIsDragging]     = useState(false);

  const [file,           setFile]           = useState(null);
  const [uploading,      setUploading]      = useState(false);
  const [uploadPct,      setUploadPct]      = useState(0);
  const [uploadErr,      setUploadErr]      = useState("");

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

  const handleFileSelect = useCallback((e) => {
    const f = e.target.files?.[0];
    if (f) setFile(f);
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setIsDragging(false);
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
        xhr.upload.onprogress = (e) => { if (e.lengthComputable) setUploadPct(Math.round(e.loaded / e.total * 100)); };
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

  async function shareLink() {
    if (!linkUrl.trim())             { setLinkErr("Paste your film link first"); return; }
    if (!email.includes("@"))        { setLinkErr("Enter your email address"); return; }
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

  // ── Loading / error ────────────────────────────────────────────────────────

  if (error) return (
    <div style={{ minHeight: "100vh", background: DS.bg, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ textAlign: "center", maxWidth: 360 }}>
        <div style={{ fontSize: 52, marginBottom: 16 }}>🎬</div>
        <h2 style={{ margin: "0 0 10px", color: DS.body, fontWeight: 800, fontSize: 20 }}>Exchange not found</h2>
        <p style={{ margin: "0 0 28px", color: DS.label, lineHeight: 1.65, fontSize: 14 }}>{error}</p>
        <a href="/" style={{ fontSize: 13, fontWeight: 700, color: DS.brand, textDecoration: "none" }}>← Back to CheckPeak</a>
      </div>
    </div>
  );

  if (!data) return (
    <div style={{ minHeight: "100vh", background: DS.bg, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16 }}>
      <div style={{ width: 40, height: 40, border: `3px solid ${DS.brand}`, borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
      <span style={{ fontSize: 14, color: DS.dim }}>Loading exchange…</span>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  const { exchange, film, analytics, receivedFilm } = data;
  const filmTitle    = film?.title || (film?.opponent ? `vs ${film.opponent}` : "Game Film");
  const dateStr      = film?.gameDate
    ? new Date(film.gameDate).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
    : "";
  const orgName      = exchange?.requestingOrgName ?? "A coach";
  const orgInitial   = orgName[0]?.toUpperCase() ?? "C";
  const canUpload    = file && email.includes("@") && !uploading;
  const canLink      = linkUrl.trim() && email.includes("@") && !linkSubmitting;
  const platform     = detectPlatform(linkUrl);
  const donePlatform = detectPlatform(exchange?.externalUrl);

  const px = isMobile ? "16px" : "28px";

  return (
    <>
      <Head>
        <title>{orgName} — Film Exchange · CheckPeak</title>
        <meta name="description" content="View and respond to a game film exchange request." />
        <meta name="robots" content="noindex" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <style>{`
        @keyframes spin    { to { transform: rotate(360deg); } }
        @keyframes fadeUp  { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        * { box-sizing: border-box; }
        input, button, textarea { -webkit-tap-highlight-color: transparent; }
        input:focus, textarea:focus { border-color: #4FABFF !important; box-shadow: 0 0 0 3px rgba(79,171,255,0.14) !important; }
      `}</style>

      <div style={{ minHeight: "100vh", background: DS.bg, fontFamily: "-apple-system, 'Segoe UI', Arial, sans-serif" }}>

        {/* ── Nav ── */}
        <div style={{ borderBottom: `1px solid ${DS.border}`, padding: `0 ${px}`, position: "sticky", top: 0, background: `${DS.bg}e8`, zIndex: 50, backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)" }}>
          <div style={{ maxWidth: 780, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", height: 54 }}>
            <span style={{ fontSize: 17, fontWeight: 900, color: DS.brand, letterSpacing: -0.5, userSelect: "none" }}>
              Check<span style={{ color: DS.body }}>Peak</span>
            </span>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <a href="/login" style={{ fontSize: 13, fontWeight: 600, color: DS.label, textDecoration: "none" }}>Sign In</a>
              {!isMobile && (
                <a href="/org-login" style={{ fontSize: 12, fontWeight: 800, color: "#000", background: DS.brand, padding: "7px 16px", borderRadius: 8, textDecoration: "none", letterSpacing: -0.2 }}>
                  Get Started Free
                </a>
              )}
            </div>
          </div>
        </div>

        <div style={{ maxWidth: 780, margin: "0 auto", padding: `${isMobile ? "28px" : "48px"} ${px} 80px`, animation: "fadeUp 0.3s ease" }}>

          {/* ── Step indicator ── */}
          <StepIndicator step={step} />

          {/* ── Hero: org avatar + sender ── */}
          <div style={{ display: "flex", alignItems: "center", gap: isMobile ? 12 : 16, marginBottom: 28 }}>
            <div style={{
              width: isMobile ? 46 : 56, height: isMobile ? 46 : 56, borderRadius: 15, flexShrink: 0,
              background: "linear-gradient(135deg, rgba(79,171,255,0.18), rgba(79,171,255,0.32))",
              border: `1.5px solid rgba(79,171,255,0.28)`,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: isMobile ? 20 : 24, fontWeight: 900, color: DS.brand,
              boxShadow: "0 4px 20px rgba(79,171,255,0.15)",
            }}>
              {orgInitial}
            </div>
            <div>
              <div style={{ fontSize: 12, color: DS.dim, fontWeight: 600, marginBottom: 3 }}>Film exchange request from</div>
              <h1 style={{ margin: 0, fontSize: isMobile ? 20 : 28, fontWeight: 900, color: DS.body, lineHeight: 1.1, letterSpacing: -0.5 }}>
                {orgName}
              </h1>
            </div>
          </div>

          {/* ── Film player ── */}
          {film?.muxPlaybackId ? (
            <div style={{ borderRadius: 18, overflow: "hidden", background: "#000", marginBottom: 20, boxShadow: "0 0 0 1px rgba(255,255,255,0.06), 0 24px 64px rgba(0,0,0,0.65)" }}>
              <MuxPlayer
                playbackId={film.muxPlaybackId}
                streamType="on-demand"
                style={{ width: "100%", aspectRatio: "16/9", display: "block" }}
                accentColor={DS.brand}
              />
            </div>
          ) : (
            <div style={{ borderRadius: 18, background: DS.card, border: `1px solid ${DS.border}`, aspectRatio: "16/9", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", marginBottom: 20, gap: 12 }}>
              <Film size={40} color={DS.dim} />
              <span style={{ fontSize: 13, color: DS.dim, textAlign: "center" }}>
                {film?.status === "uploading" ? "Film is processing — check back soon" : "Film preview unavailable"}
              </span>
            </div>
          )}

          {/* ── Film info + analytics ── */}
          <div style={{ background: DS.card, borderRadius: 14, border: `1px solid ${DS.border}`, padding: isMobile ? "16px" : "18px 22px", marginBottom: 20 }}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 14, flexWrap: "wrap" }}>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: isMobile ? 15 : 17, fontWeight: 800, color: DS.body, marginBottom: 2 }}>{filmTitle}</div>
                {dateStr && <div style={{ fontSize: 13, color: DS.label }}>{dateStr}</div>}
              </div>
              {exchange?.sharePlays && analytics && (
                <div style={{ display: "flex", gap: isMobile ? 16 : 24, flexShrink: 0 }}>
                  {analytics.playCount > 0 && <StatPill value={analytics.playCount} label="Plays" />}
                  {analytics.successPct != null && <StatPill value={`${analytics.successPct}%`} label="Success" color={DS.green} />}
                  {analytics.tds > 0 && <StatPill value={analytics.tds} label="TDs" color={DS.amber} />}
                </div>
              )}
            </div>
            {exchange?.sharePlays && analytics?.runs > 0 && analytics?.passes > 0 && (
              <div style={{ marginTop: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: DS.dim, marginBottom: 6, fontWeight: 700 }}>
                  <span>RUN · {analytics.runs}</span>
                  <span>PASS · {analytics.passes}</span>
                </div>
                <ProgressBar pct={analytics.runs / (analytics.runs + analytics.passes) * 100} />
              </div>
            )}
          </div>

          {/* ── Coach message ── */}
          {exchange?.message && (
            <div style={{ borderLeft: `3px solid ${DS.brand}`, background: DS.brandBg, borderRadius: "0 12px 12px 0", padding: "14px 18px", marginBottom: 28 }}>
              <div style={{ fontSize: 10, fontWeight: 800, color: DS.brand, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 6 }}>
                Message from {orgName}
              </div>
              <div style={{ fontSize: 14, color: DS.body, lineHeight: 1.7, fontStyle: "italic" }}>
                "{exchange.message}"
              </div>
            </div>
          )}

          <div style={{ height: 1, background: DS.border, margin: "28px 0" }} />

          {/* ══════════════════════════════════════════════════════════════════
              STEP: done
          ══════════════════════════════════════════════════════════════════ */}
          {step === "done" ? (
            <div style={{ textAlign: "center", padding: `${isMobile ? "20px" : "36px"} 0 8px`, animation: "fadeUp 0.4s ease" }}>
              <div style={{
                width: 76, height: 76, borderRadius: 38,
                background: "radial-gradient(circle, rgba(52,199,89,0.2) 0%, rgba(52,199,89,0.04) 100%)",
                border: `1.5px solid rgba(52,199,89,0.3)`,
                display: "flex", alignItems: "center", justifyContent: "center",
                margin: "0 auto 22px",
                boxShadow: "0 8px 32px rgba(52,199,89,0.15)",
              }}>
                <CheckCircle size={36} color={DS.green} />
              </div>
              <h2 style={{ margin: "0 0 8px", fontSize: isMobile ? 22 : 28, fontWeight: 900, color: DS.body, letterSpacing: -0.5 }}>
                Exchange complete!
              </h2>
              <p style={{ margin: "0 0 32px", fontSize: 15, color: DS.label, lineHeight: 1.65, maxWidth: 380, marginLeft: "auto", marginRight: "auto" }}>
                <strong style={{ color: DS.body }}>{orgName}</strong> has been notified. They'll be in touch soon.
              </p>

              {/* Submission confirmation */}
              {(receivedFilm || exchange?.externalUrl) && (
                <div style={{ background: DS.card, borderRadius: 14, border: `1px solid ${DS.border}`, padding: "16px 20px", maxWidth: 400, margin: "0 auto 16px", textAlign: "left" }}>
                  <div style={{ fontSize: 10, fontWeight: 800, color: DS.dim, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12 }}>Your submission</div>
                  {receivedFilm && (
                    <>
                      <div style={{ fontSize: 15, fontWeight: 700, color: DS.body, marginBottom: 5 }}>{receivedFilm.title ?? "Uploaded Film"}</div>
                      <div style={{ fontSize: 12, color: DS.dim, display: "flex", alignItems: "center", gap: 7 }}>
                        <div style={{ width: 6, height: 6, borderRadius: 3, background: receivedFilm.status === "ready" ? DS.green : DS.amber, flexShrink: 0 }} />
                        {receivedFilm.status === "ready" ? "Ready to view" : "Processing — usually a few minutes"}
                      </div>
                    </>
                  )}
                  {exchange?.externalUrl && (
                    <>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                        {donePlatform && <div style={{ width: 8, height: 8, borderRadius: 4, background: donePlatform.color, flexShrink: 0 }} />}
                        <span style={{ fontSize: 14, fontWeight: 700, color: DS.body }}>{donePlatform?.name ?? "External"} link shared</span>
                      </div>
                      <a href={exchange.externalUrl} target="_blank" rel="noopener noreferrer"
                        style={{ fontSize: 12, fontWeight: 700, color: donePlatform?.color ?? DS.brand, textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 5 }}>
                        <ExternalLink size={11} /> View your link
                      </a>
                    </>
                  )}
                </div>
              )}

              {/* What happens next */}
              <div style={{ background: DS.card, borderRadius: 14, border: `1px solid ${DS.border}`, padding: "16px 20px", maxWidth: 400, margin: "0 auto 28px", textAlign: "left" }}>
                <div style={{ fontSize: 10, fontWeight: 800, color: DS.dim, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 14 }}>What happens next</div>
                {[
                  ["📧", `${orgName} receives an email notification`],
                  ["🎬", "They review your film in their film room"],
                  ["🏈", "Both programs have each other's game film"],
                ].map(([icon, text], i) => (
                  <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 12, ...(i > 0 ? { marginTop: 11, paddingTop: 11, borderTop: `1px solid ${DS.border}` } : {}) }}>
                    <span style={{ fontSize: 18, lineHeight: "1.35", flexShrink: 0 }}>{icon}</span>
                    <span style={{ fontSize: 13, color: DS.label, lineHeight: 1.55 }}>{text}</span>
                  </div>
                ))}
              </div>

              {/* Upsell */}
              <div style={{ padding: "20px 22px", background: DS.raised, borderRadius: 16, border: `1px solid ${DS.border}`, textAlign: "left", maxWidth: 400, width: "100%", margin: "0 auto" }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: DS.body, marginBottom: 5 }}>Want your own film room?</div>
                <div style={{ fontSize: 13, color: DS.label, marginBottom: 16, lineHeight: 1.65 }}>
                  CheckPeak gives your program film tagging, analytics, cut-ups, and instant exchanges — free to try.
                </div>
                <a href="/org-login" style={{ display: "inline-flex", alignItems: "center", gap: 8, background: DS.brand, color: "#000", textDecoration: "none", fontWeight: 800, fontSize: 13, padding: "11px 20px", borderRadius: 10, letterSpacing: -0.2 }}>
                  Get started free <ArrowRight size={14} />
                </a>
              </div>
            </div>

          /* ══════════════════════════════════════════════════════════════════
              STEP: upload
          ══════════════════════════════════════════════════════════════════ */
          ) : step === "upload" ? (
            <div style={{ animation: "fadeUp 0.25s ease" }}>
              <button
                onClick={() => setStep("view")}
                style={{ display: "inline-flex", alignItems: "center", gap: 5, background: "none", border: "none", cursor: "pointer", color: DS.label, fontSize: 13, fontWeight: 600, marginBottom: 22, padding: 0 }}
              >
                ← Back
              </button>
              <h2 style={{ margin: "0 0 4px", fontSize: isMobile ? 20 : 22, fontWeight: 800, color: DS.body }}>Share your film</h2>
              <p style={{ margin: "0 0 24px", fontSize: 14, color: DS.label, lineHeight: 1.55 }}>
                <strong style={{ color: DS.body }}>{orgName}</strong> gets access as soon as you share.
              </p>

              {/* Tab switcher */}
              <div style={{ display: "flex", background: DS.raised, borderRadius: 12, padding: 4, marginBottom: 28, border: `1px solid ${DS.border}` }}>
                {[
                  { id: "upload", label: "Upload a File", Icon: Upload },
                  { id: "link",   label: "Paste a Link",  Icon: Link2  },
                ].map(({ id, label, Icon }) => {
                  const active = shareMode === id;
                  return (
                    <button
                      key={id}
                      onClick={() => { setShareMode(id); setUploadErr(""); setLinkErr(""); }}
                      style={{
                        flex: 1, padding: isMobile ? "10px 8px" : "9px 14px", borderRadius: 9, border: "none", cursor: "pointer",
                        background: active ? DS.brand : "transparent",
                        color:      active ? "#000"   : DS.dim,
                        fontSize: isMobile ? 12 : 13, fontWeight: 700,
                        display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                        transition: "all 0.15s",
                      }}
                    >
                      <Icon size={13} /> {label}
                    </button>
                  );
                })}
              </div>

              {/* ── UPLOAD FILE ── */}
              {shareMode === "upload" && (
                <>
                  <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 12, marginBottom: 14 }}>
                    <div>
                      <label style={labelStyle}>Program / School</label>
                      <input style={inputStyle} value={programName} onChange={e => setProgramName(e.target.value)} placeholder="Lincoln High School" />
                    </div>
                    <div>
                      <label style={labelStyle}>Your Email <span style={{ color: DS.brand }}>*</span></label>
                      <input style={inputStyle} type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="coach@school.edu" />
                    </div>
                  </div>
                  <div style={{ marginBottom: 20 }}>
                    <label style={labelStyle}>Film Title <span style={{ color: DS.dim, fontWeight: 500, textTransform: "none", letterSpacing: 0 }}>(optional)</span></label>
                    <input style={inputStyle} value={title} onChange={e => setTitle(e.target.value)} placeholder={`vs ${orgName}`} />
                  </div>

                  {/* Drop zone */}
                  <div
                    onDrop={handleDrop}
                    onDragOver={e => e.preventDefault()}
                    onDragEnter={() => setIsDragging(true)}
                    onDragLeave={() => setIsDragging(false)}
                    onClick={() => !uploading && fileRef.current?.click()}
                    style={{
                      border: `2px dashed ${file ? DS.green : isDragging ? DS.brand : DS.border}`,
                      borderRadius: 16, padding: isMobile ? "32px 20px" : "48px 24px", textAlign: "center",
                      cursor: uploading ? "default" : "pointer",
                      background: file ? DS.greenBg : isDragging ? DS.brandBg : DS.raised,
                      transition: "all 0.2s", marginBottom: 20,
                      boxShadow: isDragging ? `0 0 0 4px ${DS.brand}22` : "none",
                    }}
                  >
                    <input ref={fileRef} type="file" accept="video/*" style={{ display: "none" }} onChange={handleFileSelect} />
                    {file ? (
                      <>
                        <div style={{ fontSize: 40, marginBottom: 10 }}>🎬</div>
                        <div style={{ fontSize: 15, fontWeight: 700, color: DS.green }}>{file.name}</div>
                        <div style={{ fontSize: 12, color: DS.dim, marginTop: 5 }}>
                          {(file.size / 1024 / 1024).toFixed(1)} MB · {isMobile ? "Tap" : "Click"} to change
                        </div>
                      </>
                    ) : isDragging ? (
                      <>
                        <div style={{ width: 52, height: 52, borderRadius: 14, background: DS.brandBg, border: `1.5px solid ${DS.brand}44`, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px" }}>
                          <Upload size={24} color={DS.brand} />
                        </div>
                        <div style={{ fontSize: 16, fontWeight: 700, color: DS.brand }}>Drop it here!</div>
                      </>
                    ) : (
                      <>
                        <div style={{ width: 52, height: 52, borderRadius: 14, background: "rgba(255,255,255,0.04)", border: `1.5px solid ${DS.border}`, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
                          <Upload size={22} color={DS.dim} />
                        </div>
                        <div style={{ fontSize: isMobile ? 14 : 15, fontWeight: 700, color: DS.label }}>
                          {isMobile ? "Tap to select your film" : "Drag & drop your game film here"}
                        </div>
                        <div style={{ fontSize: 12, color: DS.dim, marginTop: 5 }}>
                          {!isMobile && "or click to browse · "}MP4, MOV, or any video format
                        </div>
                      </>
                    )}
                  </div>

                  {uploading && (
                    <div style={{ marginBottom: 20, background: DS.raised, borderRadius: 12, padding: "16px 18px", border: `1px solid ${DS.border}` }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 700, color: DS.body }}>
                            {uploadPct < 100 ? "Uploading your film…" : "Finalizing…"}
                          </div>
                          <div style={{ fontSize: 11, color: DS.dim, marginTop: 3 }}>Don't close this tab</div>
                        </div>
                        <div style={{ fontSize: 24, fontWeight: 900, color: DS.brand, letterSpacing: -1 }}>{uploadPct}%</div>
                      </div>
                      <ProgressBar pct={uploadPct} height={5} />
                    </div>
                  )}

                  {uploadErr && <ErrBox>{uploadErr}</ErrBox>}

                  <button
                    onClick={upload} disabled={!canUpload}
                    style={{
                      width: "100%", padding: "15px 20px", borderRadius: 12, border: "none",
                      cursor: canUpload ? "pointer" : "not-allowed",
                      background: canUpload ? DS.brand : "rgba(255,255,255,0.06)",
                      color:      canUpload ? "#000"   : DS.dim,
                      fontSize: 15, fontWeight: 800,
                      display: "flex", alignItems: "center", justifyContent: "center", gap: 9,
                      boxShadow: canUpload ? "0 8px 28px rgba(79,171,255,0.22)" : "none",
                      transition: "all 0.2s",
                    }}
                  >
                    {uploading ? "Uploading…" : <><Upload size={16} /> Upload & Complete Exchange</>}
                  </button>
                </>
              )}

              {/* ── PASTE LINK ── */}
              {shareMode === "link" && (
                <>
                  <div style={{ background: DS.raised, borderRadius: 14, padding: "18px 20px", marginBottom: 24, border: `1px solid ${DS.border}` }}>
                    <div style={{ fontSize: 15, fontWeight: 800, color: DS.body, marginBottom: 6 }}>
                      Already on HUDL, YouTube, or Vimeo?
                    </div>
                    <div style={{ fontSize: 13, color: DS.label, lineHeight: 1.65 }}>
                      Paste your shareable link — no re-uploading needed. <strong style={{ color: DS.body }}>{orgName}</strong> gets direct access.
                    </div>
                  </div>

                  <div style={{ marginBottom: platform ? 12 : 20 }}>
                    <label style={labelStyle}>Film Link</label>
                    <div style={{ position: "relative" }}>
                      <input
                        style={{ ...inputStyle, paddingRight: 68 }}
                        value={linkUrl}
                        onChange={e => setLinkUrl(e.target.value)}
                        placeholder="https://www.hudl.com/video/…"
                        onKeyDown={e => e.key === "Enter" && canLink && shareLink()}
                        autoComplete="off"
                        autoCorrect="off"
                        autoCapitalize="none"
                        spellCheck={false}
                      />
                      <button
                        onClick={async () => {
                          try { setLinkUrl(await navigator.clipboard.readText()); } catch {}
                        }}
                        style={{
                          position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)",
                          background: "rgba(255,255,255,0.08)", border: "none", borderRadius: 7,
                          padding: "5px 11px", fontSize: 11, fontWeight: 700, color: DS.label, cursor: "pointer",
                        }}
                      >
                        Paste
                      </button>
                    </div>
                  </div>

                  {linkUrl.trim() && (
                    <div style={{ marginBottom: 20 }}>
                      {platform ? (
                        <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: `${platform.color}18`, border: `1px solid ${platform.color}38`, borderRadius: 8, padding: "6px 14px" }}>
                          <div style={{ width: 8, height: 8, borderRadius: 4, background: platform.color }} />
                          <span style={{ fontSize: 12, fontWeight: 700, color: platform.color }}>{platform.name} link detected ✓</span>
                        </div>
                      ) : (
                        <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "rgba(255,59,48,0.08)", border: "1px solid rgba(255,59,48,0.22)", borderRadius: 8, padding: "6px 14px" }}>
                          <span style={{ fontSize: 12, fontWeight: 700, color: "#FF6B6B" }}>Doesn't look like a valid URL</span>
                        </div>
                      )}
                    </div>
                  )}

                  <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 12, marginBottom: 20 }}>
                    <div>
                      <label style={labelStyle}>Program / School</label>
                      <input style={inputStyle} value={programName} onChange={e => setProgramName(e.target.value)} placeholder="Lincoln High School" />
                    </div>
                    <div>
                      <label style={labelStyle}>Your Email <span style={{ color: DS.brand }}>*</span></label>
                      <input style={inputStyle} type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="coach@school.edu" />
                    </div>
                  </div>

                  {linkErr && <ErrBox>{linkErr}</ErrBox>}

                  <button
                    onClick={shareLink} disabled={!canLink}
                    style={{
                      width: "100%", padding: "15px 20px", borderRadius: 12, border: "none",
                      cursor: canLink ? "pointer" : "not-allowed",
                      background: canLink ? DS.brand : "rgba(255,255,255,0.06)",
                      color:      canLink ? "#000"   : DS.dim,
                      fontSize: 15, fontWeight: 800,
                      display: "flex", alignItems: "center", justifyContent: "center", gap: 9,
                      boxShadow: canLink ? "0 8px 28px rgba(79,171,255,0.22)" : "none",
                      transition: "all 0.2s",
                    }}
                  >
                    {linkSubmitting ? "Sharing…" : <><Link2 size={16} /> Share Film Link</>}
                  </button>
                </>
              )}

              <p style={{ marginTop: 20, textAlign: "center", fontSize: 13, color: DS.dim }}>
                Already on CheckPeak?{" "}
                <a href={`/login?redirect=/film-exchange/${token}`} style={{ color: DS.brand, fontWeight: 700, textDecoration: "none" }}>
                  Sign in to share from your library →
                </a>
              </p>
            </div>

          /* ══════════════════════════════════════════════════════════════════
              STEP: view
          ══════════════════════════════════════════════════════════════════ */
          ) : (
            <div style={{ animation: "fadeUp 0.25s ease" }}>
              <div style={{ textAlign: "center", marginBottom: isMobile ? 24 : 30 }}>
                <h2 style={{ margin: "0 0 10px", fontSize: isMobile ? 20 : 26, fontWeight: 900, color: DS.body, letterSpacing: -0.5 }}>
                  Your move, Coach.
                </h2>
                <p style={{ margin: 0, fontSize: 14, color: DS.label, lineHeight: 1.7, maxWidth: 420, marginLeft: "auto", marginRight: "auto" }}>
                  Share your game film and <strong style={{ color: DS.body }}>{orgName}</strong> gets instant access. No account needed.
                </p>
              </div>

              <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", gap: 12, marginBottom: 20 }}>
                <button
                  onClick={() => { setShareMode("upload"); setStep("upload"); }}
                  style={{
                    flex: 1, padding: "17px 24px", borderRadius: 14, border: "none", cursor: "pointer",
                    background: DS.brand, color: "#000", fontSize: 15, fontWeight: 800,
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
                    boxShadow: "0 8px 32px rgba(79,171,255,0.3)",
                    transition: "transform 0.12s, box-shadow 0.12s",
                  }}
                >
                  <Upload size={18} /> Upload a File
                </button>
                <button
                  onClick={() => { setShareMode("link"); setStep("upload"); }}
                  style={{
                    flex: 1, padding: "17px 24px", borderRadius: 14,
                    border: `1.5px solid ${DS.border}`, cursor: "pointer", background: DS.raised,
                    color: DS.body, fontSize: 15, fontWeight: 800,
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
                    transition: "border-color 0.15s",
                  }}
                >
                  <Link2 size={18} /> Share a Link
                </button>
              </div>

              <p style={{ fontSize: 12, color: DS.dim, textAlign: "center", margin: "0 0 6px", lineHeight: 1.65 }}>
                On HUDL, Vimeo, or another platform? <strong style={{ color: DS.label }}>Share a Link</strong> — no re-uploading needed.
              </p>
              <p style={{ marginTop: 16, fontSize: 13, color: DS.dim, textAlign: "center" }}>
                Already on CheckPeak?{" "}
                <a href={`/login?redirect=/film-exchange/${token}`} style={{ color: DS.brand, fontWeight: 700, textDecoration: "none" }}>
                  Sign in to share from your library →
                </a>
              </p>
            </div>
          )}

        </div>

        {/* ── Footer ── */}
        <div style={{ borderTop: `1px solid ${DS.border}`, padding: "18px 24px", textAlign: "center" }}>
          <span style={{ fontSize: 12, color: DS.dim }}>
            Powered by{" "}
            <a href="/" style={{ color: DS.brand, fontWeight: 700, textDecoration: "none" }}>CheckPeak</a>
            {" "}· Game Film Platform for Coaches
          </span>
        </div>

      </div>
    </>
  );
}
