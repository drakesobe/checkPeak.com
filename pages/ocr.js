// pages/ocr.js
"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import OCRUpload        from "../components/OCRUpload";
import BarcodeUpload    from "../components/BarcodeUpload";
import OCRScanResults   from "../components/OCRScanResults";
import ProgressBar      from "../components/ProgressBar";
import FinishSetupModal from "../components/FinishSetupModal";
import { useAuthContext } from "../hooks/useAuth";
import { toast }          from "react-hot-toast";
import { trackEvent }     from "@/lib/analytics";
import { DS, FONT_STYLE } from "../components/scanResultsTokens";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function normalizeRole(r) { return r === "Organization" ? "Organization" : "Athlete"; }
function normalizeRecord(r) {
  if (!r) return null;
  if (r.fields) return r;
  const id = r.id || r.recordId || Math.random().toString(36).slice(2);
  return { id, fields: r };
}
const getLs = (k) => { if (typeof window === "undefined") return null; return window.localStorage.getItem(k); };
const setLs = (k, v) => { if (typeof window === "undefined") return; window.localStorage.setItem(k, v); };

// ---------------------------------------------------------------------------
// Brand tokens - CheckPeak clinical light system
// ---------------------------------------------------------------------------

const B = {
  // Accent - blue only for active/primary states
  accent:    "#4FABFF",
  accentDk:  "#0284C7",
  accentBg:  "rgba(79,171,255,0.07)",
  accentBdr: "rgba(79,171,255,0.18)",

  // Text
  ink:       "#0D1B2A",
  body:      "#334155",
  secondary: "#64748B",
  muted:     "#94A3B8",
  ghost:     "#CBD5E1",

  // Surfaces
  pageBg:    "#F4F7FB",
  surface:   "#FFFFFF",
  raised:    "#F1F5F9",

  // Borders
  border:    "#E2E8F0",

  // Semantic
  safe:      "#059669",
  safeBg:    "#ECFDF5",
  safeBdr:   "#A7F3D0",
  banned:    "#DC2626",
  bannedBg:  "#FEF2F2",
  bannedBdr: "#FECACA",
};

const F = {
  cond: "'Barlow Condensed', sans-serif",
  body: "'Barlow', sans-serif",
};

const PAGE_STYLE = `
  @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:ital,wght@0,400;0,700;0,900;1,700;1,900&family=Barlow:wght@400;500;600;700&display=swap');

  .ocr-display { font-family: 'Barlow Condensed', sans-serif; letter-spacing: 0.04em; }
  .ocr-body    { font-family: 'Barlow', sans-serif; }

  .scan-tab {
    font-family: 'Barlow Condensed', sans-serif;
    font-weight: 900;
    font-size: 13px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    padding: 9px 22px;
    cursor: pointer;
    transition: background-color 0.12s, color 0.12s;
    border: 1px solid transparent;
    border-bottom: none;
    user-select: none;
  }
  .scan-tab.active {
    background-color: #FFFFFF;
    color: #0D1B2A;
    border-color: #E2E8F0;
    position: relative;
    z-index: 2;
  }
  .scan-tab.inactive {
    background-color: #F1F5F9;
    color: #64748B;
  }
  .scan-tab.inactive:hover {
    background-color: rgba(79,171,255,0.07);
    color: #4FABFF;
  }

  .gate-input {
    font-family: 'Barlow', sans-serif;
    width: 100%;
    padding: 11px 14px;
    border: 1px solid #E2E8F0;
    font-size: 14px;
    color: #0D1B2A;
    background: #F8FAFC;
    outline: none;
    transition: border-color 0.12s;
  }
  .gate-input:focus {
    border-color: #4FABFF;
    background: #FFFFFF;
  }
`;

// ---------------------------------------------------------------------------
// ResultsSummaryBar
// ---------------------------------------------------------------------------

function ResultsSummaryBar({ bannedCount, ingredientCount, scanMode, productName }) {
  return (
    <div
      style={{
        borderBottom: `1px solid ${B.border}`,
        padding: "14px 20px",
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        background: B.raised,
      }}
    >
      <div>
        <p style={{ fontFamily:F.cond, fontWeight:900, fontSize:13, letterSpacing:"0.06em", textTransform:"uppercase", color:B.ink, margin:0 }}>
          {productName ? productName : `${scanMode} Results`}
        </p>
        <p style={{ fontFamily:F.body, fontSize:11, color:B.muted, margin:"2px 0 0" }}>
          {productName ? `Mode: ${scanMode}` : "Latest scan"}
        </p>
      </div>
      <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
        <span style={{
          fontFamily:F.cond, fontSize:11, fontWeight:700, letterSpacing:"0.08em", textTransform:"uppercase",
          padding:"3px 10px",
          background: bannedCount > 0 ? B.bannedBg : B.safeBg,
          color:      bannedCount > 0 ? B.banned   : B.safe,
          border:     `1px solid ${bannedCount > 0 ? B.bannedBdr : B.safeBdr}`,
        }}>
          {bannedCount} flagged
        </span>
        <span style={{
          fontFamily:F.cond, fontSize:11, fontWeight:700, letterSpacing:"0.08em", textTransform:"uppercase",
          padding:"3px 10px",
          background: B.accentBg, color: B.accentDk, border: `1px solid ${B.accentBdr}`,
        }}>
          {ingredientCount} ingredient{ingredientCount !== 1 ? "s" : ""} matched
        </span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// UnlockGate - slides up from bottom, clinical light design
// ---------------------------------------------------------------------------

function UnlockGate({
  bannedCount, gateTitle, gateSubtitle,
  unlockEmail, setUnlockEmail,
  unlockRole, setUnlockRole,
  unlockOrgToken, setUnlockOrgToken,
  unlockLoading, unlockError, unlockSuccess,
  onSubmit,
}) {
  const accentColor = bannedCount > 0 ? B.banned : B.accent;

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 80,
      display: "flex", alignItems: "flex-end",
      background: "rgba(13,27,42,0.55)", backdropFilter: "blur(4px)",
    }}>
      {/* Slide-up card */}
      <div style={{
        width: "100%",
        maxWidth: 520,
        margin: "0 auto",
        background: B.surface,
        border: `1px solid ${B.border}`,
        borderTop: `3px solid ${accentColor}`,
        boxShadow: "0 -8px 40px rgba(0,0,0,0.15)",
        overflow: "hidden",
      }}>

        {/* Ghost number decoration */}
        <div aria-hidden="true" style={{
          position: "absolute", right: -8, top: -16,
          fontFamily: F.cond, fontWeight: 900, fontStyle: "italic",
          fontSize: 120, lineHeight: 1, color: accentColor, opacity: 0.05,
          userSelect: "none", pointerEvents: "none",
        }}>
          {bannedCount > 0 ? bannedCount : "✓"}
        </div>

        <div style={{ padding: "clamp(1.25rem, 4vw, 1.75rem)", position: "relative" }}>

          {/* Status + headline */}
          <p style={{ fontFamily:F.cond, fontSize:10, fontWeight:900, letterSpacing:"0.16em", textTransform:"uppercase", color:accentColor, margin:"0 0 6px" }}>
            {gateTitle}
          </p>
          <h3 style={{ fontFamily:F.cond, fontWeight:900, fontStyle:"italic", fontSize:"clamp(1.3rem, 4vw, 1.65rem)", letterSpacing:"-0.01em", textTransform:"uppercase", color:B.ink, margin:"0 0 6px", lineHeight:0.95 }}>
            Unlock full details
          </h3>
          <p style={{ fontFamily:F.body, fontSize:13, color:B.secondary, margin:"0 0 20px", lineHeight:1.55 }}>
            {gateSubtitle}
          </p>

          {/* Form */}
          <form onSubmit={onSubmit} style={{ display:"flex", flexDirection:"column", gap:8 }}>
            <input
              type="email"
              value={unlockEmail}
              onChange={(e) => setUnlockEmail(e.target.value)}
              placeholder="Email to unlock + save scans"
              className="gate-input"
              required
            />

            <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
              <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
                <select
                  value={unlockRole}
                  onChange={(e) => setUnlockRole(normalizeRole(e.target.value))}
                  className="gate-input"
                  style={{ flex:"0 0 auto", width:"auto" }}
                >
                  <option value="Athlete">Athlete</option>
                  <option value="Organization">Organization</option>
                </select>
                <input
                  type="text"
                  value={unlockOrgToken}
                  onChange={(e) => setUnlockOrgToken(e.target.value)}
                  placeholder="Team token (optional)"
                  className="gate-input"
                  style={{ flex: 1, minWidth: 140 }}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={unlockLoading}
              style={{
                marginTop: 4,
                height: 50,
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                fontFamily: F.cond, fontSize: 14, fontWeight: 900,
                letterSpacing: "0.1em", textTransform: "uppercase",
                background: unlockLoading ? B.raised : B.accent,
                color: unlockLoading ? B.muted : "#fff",
                border: "none", cursor: unlockLoading ? "not-allowed" : "pointer",
                boxShadow: unlockLoading ? "none" : "0 4px 16px rgba(79,171,255,0.35)",
                transition: "filter 0.12s",
              }}
              onMouseEnter={e => { if(!unlockLoading) e.currentTarget.style.filter="brightness(1.1)"; }}
              onMouseLeave={e => { e.currentTarget.style.filter="none"; }}
            >
              {unlockLoading ? (
                <>
                  <span style={{ width:16, height:16, border:`2px solid ${B.ghost}`, borderTopColor:B.accent, borderRadius:"50%", display:"inline-block", animation:"pb-shimmer 0.8s linear infinite" }} />
                  Unlocking…
                </>
              ) : "Unlock Details →"}
            </button>

            {unlockError && (
              <p style={{ fontFamily:F.body, fontSize:12, color:B.banned, margin:0 }}>{unlockError}</p>
            )}
            {unlockSuccess && (
              <p style={{ fontFamily:F.body, fontSize:12, color:B.safe, margin:0 }}>Unlocked. Finish setup to save scans.</p>
            )}

            <p style={{ fontFamily:F.body, fontSize:11, color:B.muted, textAlign:"center", margin:"4px 0 0" }}>
              No spam. Used only for scan history and updates.
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// OCRPage
// ---------------------------------------------------------------------------

export default function OCRPage() {
  const { user } = useAuthContext();

  const [activeTab,           setActiveTab]           = useState("Scan");
  const [scanMode,            setScanMode]            = useState("Nutrition Label");
  const [rawOCR,              setRawOCR]              = useState("");
  const [detectedBanned,      setDetectedBanned]      = useState([]);
  const [detectedIngredients, setDetectedIngredients] = useState([]);
  const [scanning,            setScanning]            = useState(false);
  const [progress,            setProgress]            = useState(0);
  const [error,               setError]               = useState("");

  const [unlockEmail,    setUnlockEmail]    = useState("");
  const [unlockRole,     setUnlockRole]     = useState("Athlete");
  const [unlockOrgToken, setUnlockOrgToken] = useState("");
  const [unlockLoading,  setUnlockLoading]  = useState(false);
  const [unlockError,    setUnlockError]    = useState("");
  const [unlockSuccess,  setUnlockSuccess]  = useState(false);
  const [isUnlocked,     setIsUnlocked]     = useState(false);
  const [unlockSeen,     setUnlockSeen]     = useState(false);

  const [showFinishSetup, setShowFinishSetup] = useState(false);

  const [lastScanMeta, setLastScanMeta] = useState({
    productName: null, scanMode: null, bannedCount: 0, ingredientCount: 0,
  });

  const hasResults =
    (rawOCR && rawOCR.trim().length > 0) ||
    detectedBanned.length > 0 ||
    detectedIngredients.length > 0;

  const bannedCount     = lastScanMeta?.bannedCount     ?? detectedBanned.length;
  const ingredientCount = lastScanMeta?.ingredientCount ?? detectedIngredients.length;

  useEffect(() => {
    const loggedIn = !!(user && (user.Email || user.email));
    if (loggedIn) { setIsUnlocked(true); return; }
    if (getLs("cp_unlocked") === "1") setIsUnlocked(true);
  }, [user]);

  useEffect(() => {
    const loggedIn = !!(user && (user.Email || user.email));
    if (loggedIn) return;
    if (getLs("cp_unlocked") !== "1") return;
    if (getLs("cp_finish_setup_dismissed") === "1") return;
    if (getLs("cp_finish_setup_completed")  === "1") return;
    const t = setTimeout(() => setShowFinishSetup(true), 900);
    return () => clearTimeout(t);
  }, [user]);

  useEffect(() => {
    if (!hasResults || isUnlocked || unlockSeen) return;
    setUnlockSeen(true);
    try {
      trackEvent("unlock_gate_shown", {
        eventType: "conversion_gate",
        userEmail: user?.Email || user?.email || "",
        path: typeof window !== "undefined" ? window.location.pathname : "",
        source: "ocr_results_gate",
        device: typeof navigator !== "undefined" ? navigator.userAgent : "",
        payload: { scanMode: lastScanMeta?.scanMode || scanMode, bannedCount, ingredientCount, productName: lastScanMeta?.productName || null },
      });
    } catch (e) { console.error("unlock_gate_shown tracking failed:", e); }
  }, [hasResults, isUnlocked, unlockSeen, user, scanMode, lastScanMeta, bannedCount, ingredientCount]);

  const resolveOrgToken = async (token) => {
    const t = String(token ?? "").trim();
    if (!t) return null;
    const res  = await fetch(`/api/org/resolveToken?token=${encodeURIComponent(t)}`);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.error || "Invalid organization token.");
    return data?.org ?? null;
  };

  const handleUnlockSubmit = async (e) => {
    e.preventDefault();
    setUnlockError("");
    setUnlockSuccess(false);
    const email    = unlockEmail.trim();
    const role     = normalizeRole(unlockRole);
    const orgToken = String(unlockOrgToken ?? "").trim();
    if (!email || !email.includes("@")) { setUnlockError("Please enter a valid email."); return; }
    setUnlockLoading(true);
    try {
      let resolvedOrg = null;
      if (role === "Organization" && orgToken) resolvedOrg = await resolveOrgToken(orgToken);
      const res = await fetch("/api/waitlist", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, role, organizationToken: orgToken || null, organizationId: resolvedOrg?.id || null, organizationName: resolvedOrg?.name || null, source: "ocr_unlock_gate" }),
      });
      if (!res.ok) throw new Error("Unable to save. Please try again.");
      try { window.gtag?.("event", "conversion", { send_to: "AW-17990566633/giolCJ2S_70cEOmFyYJD" }); } catch {}
      setUnlockSuccess(true); setIsUnlocked(true);
      setLs("cp_unlocked", "1"); setLs("cp_unlocked_email", email); setLs("cp_unlocked_role", role);
      setLs("cp_unlocked_org_token", orgToken || ""); setLs("cp_unlocked_org_id", resolvedOrg?.id || ""); setLs("cp_unlocked_org_name", resolvedOrg?.name || "");
      try {
        await trackEvent("unlock_gate_completed", { eventType:"conversion_gate", userEmail:email, path:typeof window!=="undefined"?window.location.pathname:"", source:"ocr_results_gate", device:typeof navigator!=="undefined"?navigator.userAgent:"", payload:{ scanMode:lastScanMeta?.scanMode||scanMode, bannedCount, ingredientCount, productName:lastScanMeta?.productName||null, org:resolvedOrg?{id:resolvedOrg.id,name:resolvedOrg.name,token:orgToken}:orgToken?{token:orgToken}:null } });
      } catch (e2) { console.error("unlock_gate_completed tracking failed:", e2); }
      toast.success("Unlocked! Now save this by finishing setup.");
      if (getLs("cp_finish_setup_dismissed") !== "1" && getLs("cp_finish_setup_completed") !== "1") {
        setTimeout(() => setShowFinishSetup(true), 900);
      }
    } catch (err) {
      console.error(err);
      setUnlockError(err?.message || "Something went wrong. Please try again.");
    } finally { setUnlockLoading(false); }
  };

  useEffect(() => {
    if (activeTab !== "Scan") return;
    try { trackEvent("page_view_scan", { eventType:"page_view", userEmail:user?.Email||user?.email||"", path:typeof window!=="undefined"?window.location.pathname:"", source:"ocr_page", device:typeof navigator!=="undefined"?navigator.userAgent:"" }); }
    catch (err) { console.error("page_view_scan tracking failed:", err); }
  }, [activeTab, user]);

  const handleScanResult = async (result) => {
    if (!result) return;
    const raw = result.rawIngredients || result.ocrText || result.text || "";
    if (!raw) return;
    setRawOCR((prev) => (prev ? `${prev} ${raw}` : raw));
    const bannedMatches     = (Array.isArray(result.matchedBanned||result.matchedBannedRecords||result.matched_banned) ? (result.matchedBanned||result.matchedBannedRecords||result.matched_banned) : []).map(normalizeRecord).filter(Boolean);
    const ingredientMatches = (Array.isArray(result.matchedIngredients||result.detectedIngredients||result.matched_ingredients||result.matchedIngredientRecords) ? (result.matchedIngredients||result.detectedIngredients||result.matched_ingredients||result.matchedIngredientRecords) : []).map(normalizeRecord).filter(Boolean);
    setDetectedBanned(bannedMatches);
    setDetectedIngredients(ingredientMatches);
    setLastScanMeta({ productName:result.productName||null, scanMode, bannedCount:bannedMatches.length, ingredientCount:ingredientMatches.length });
    try {
      await trackEvent("scan_completed", { eventType:"scan", userEmail:user?.Email||user?.email||"", path:typeof window!=="undefined"?window.location.pathname:"", source:scanMode==="Nutrition Label"?"nutrition_label":"barcode", device:typeof navigator!=="undefined"?navigator.userAgent:"", payload:{ scanMode, productName:result.productName||null, bannedCount:bannedMatches.length, ingredientCount:ingredientMatches.length, bannedDetails:result.bannedDetails||{}, found:result.found??true } });
    } catch (err) { console.error("scan_completed tracking failed:", err); }
  };

  const handleOCRScan = async (text) => {
    if (!text) return;
    setScanning(true); setProgress(0); setError(""); setUnlockError(""); setUnlockSuccess(false);
    try { trackEvent("scan_started", { eventType:"scan_start", userEmail:user?.Email||user?.email||"", path:typeof window!=="undefined"?window.location.pathname:"", source:"nutrition_label", device:typeof navigator!=="undefined"?navigator.userAgent:"" }); } catch {}
    try {
      const res  = await fetch("/api/check", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ text, userEmail:user?.Email||user?.email||"" }) });
      const data = await res.json();
      await handleScanResult({ rawIngredients:text, ...data });
    } catch (err) { console.error("OCR scan error:", err); setError("Nutrition Label scan failed. Please try again."); }
    finally { setScanning(false); setProgress(100); }
  };

  const handleBarcodeScan = async (result) => {
    if (!result) return;
    setScanning(true); setProgress(0); setError(""); setUnlockError(""); setUnlockSuccess(false);
    try { trackEvent("scan_started", { eventType:"scan_start", userEmail:user?.Email||user?.email||"", path:typeof window!=="undefined"?window.location.pathname:"", source:"barcode", device:typeof navigator!=="undefined"?navigator.userAgent:"" }); } catch {}
    try { await handleScanResult(result); }
    catch (err) { console.error("Barcode scan error:", err); setError("Barcode scan failed. Please try again."); }
    finally { setScanning(false); setProgress(100); }
  };

  const finishEmail = useMemo(() => getLs("cp_unlocked_email")     || "",        [showFinishSetup]);
  const finishRole  = useMemo(() => getLs("cp_unlocked_role")      || "Athlete", [showFinishSetup]);
  const finishOrg   = useMemo(() => getLs("cp_unlocked_org_token") || "",        [showFinishSetup]);

  const gateTitle    = bannedCount > 0 ? "Potential risk detected" : "Scan complete - no obvious red flags";
  const gateSubtitle = bannedCount > 0
    ? "Unlock details and save scan history so you can reference this later."
    : "Save this scan to build history and get alerts as our database expands.";

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: PAGE_STYLE }} />

      <div
        className="ocr-body min-h-screen"
        style={{ backgroundColor: B.pageBg, color: B.ink }}
      >
        {/* Accent progress bar - top of page */}
        {scanning && (
          <div style={{ position:"fixed", top:0, left:0, right:0, zIndex:100 }}>
            <ProgressBar progress={progress} scanning={scanning} />
          </div>
        )}

        <FinishSetupModal
          isOpen={showFinishSetup && !(user && (user.Email || user.email))}
          defaultEmail={finishEmail}
          defaultRole={normalizeRole(finishRole)}
          defaultOrg={finishOrg}
          onClose={(meta) => {
            setShowFinishSetup(false);
            try { trackEvent("finish_setup_closed", { eventType:"finish_setup", userEmail:finishEmail||"", source:"ocr_finish_setup_modal", payload:{ completed:!!meta?.completed } }); } catch {}
            if (!meta?.completed) setLs("cp_finish_setup_dismissed", "1");
          }}
        />

        <main style={{ maxWidth:860, margin:"0 auto", padding:"clamp(1.5rem, 4vw, 2.5rem) clamp(1rem, 3vw, 1.5rem)" }}>

          {/* ── Page header ── */}
          <div style={{ marginBottom:"clamp(1.5rem, 3vw, 2rem)" }}>
            {/* Eyebrow */}
            <div style={{ display:"flex", alignItems:"center", gap:"0.75rem", marginBottom:"0.75rem" }}>
              <div style={{ width:"clamp(1.5rem, 3vw, 2rem)", height:"0.5px", background:"rgba(13,27,42,0.2)" }} />
              <span style={{ fontFamily:F.cond, fontSize:10, fontWeight:900, letterSpacing:"0.2em", textTransform:"uppercase", color:B.secondary }}>
                CheckPeak · Supplement Scanner
              </span>
            </div>
            <h1 style={{ fontFamily:F.cond, fontWeight:900, fontStyle:"italic", fontSize:"clamp(1.75rem, 5vw, 3rem)", lineHeight:0.9, letterSpacing:"-0.02em", textTransform:"uppercase", color:B.ink, margin:"0 0 0.6rem" }}>
              Scan for <span style={{ color:B.accent }}>banned substances.</span>
            </h1>
            <p style={{ fontFamily:F.body, fontSize:"clamp(0.88rem, 1.5vw, 0.95rem)", color:B.secondary, lineHeight:1.65, maxWidth:"52ch", margin:0 }}>
              Upload a nutrition label or scan a barcode. We'll check against our banned substances database and flag any risks.
            </p>
          </div>

          {activeTab === "Scan" && (
            <>
              {/* ── Mode tabs ── */}
              <div style={{ display:"flex", alignItems:"flex-end", gap:2, marginBottom:0 }}>
                {["Nutrition Label", "Barcode"].map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setScanMode(mode)}
                    className={`scan-tab ${scanMode === mode ? "active" : "inactive"}`}
                  >
                    {mode}
                  </button>
                ))}
                <div style={{ flex:1, borderBottom:`1px solid ${B.border}` }} />
              </div>

              {/* ── Upload card ── */}
              <div style={{
                background: B.surface,
                border: `1px solid ${B.border}`,
                borderTop: "none",
                boxShadow: "0 2px 12px rgba(0,0,0,0.04)",
                padding: "clamp(1rem, 3vw, 1.5rem)",
                marginBottom: "clamp(1rem, 2.5vw, 1.5rem)",
              }}>
                {scanMode === "Nutrition Label" ? (
                  <OCRUpload multiple={true} onScan={handleOCRScan} />
                ) : (
                  <BarcodeUpload onResult={handleBarcodeScan} showScanButton={true} />
                )}
              </div>

              {/* ── Error ── */}
              {error && (
                <div style={{
                  fontFamily:F.body, fontSize:13, padding:"12px 16px",
                  background:B.bannedBg, border:`1px solid ${B.bannedBdr}`,
                  color:B.banned, marginBottom:"1rem",
                }}>
                  {error}
                </div>
              )}

              {/* ── Results block ── */}
              <div style={{
                position: "relative",
                background: B.surface,
                border: `1px solid ${B.border}`,
                boxShadow: "0 2px 12px rgba(0,0,0,0.04)",
                overflow: "hidden",
              }}>
                {/* Top accent line - color signals status */}
                {hasResults && (
                  <div style={{
                    height: 3,
                    background: bannedCount > 0 ? B.banned : B.safe,
                  }} />
                )}

                {hasResults && (
                  <ResultsSummaryBar
                    bannedCount={bannedCount}
                    ingredientCount={ingredientCount}
                    scanMode={lastScanMeta?.scanMode || scanMode}
                    productName={lastScanMeta?.productName}
                  />
                )}

                <div style={{
                  filter:        !isUnlocked && hasResults ? "blur(5px)" : "none",
                  pointerEvents: !isUnlocked && hasResults ? "none" : "auto",
                  userSelect:    !isUnlocked && hasResults ? "none" : "auto",
                  transition:    "filter 0.3s",
                }}>
                  <OCRScanResults
                    ocrText={rawOCR}
                    detectedSubstances={detectedBanned}
                    detectedIngredients={detectedIngredients}
                    showOCR={true}
                  />
                </div>
              </div>
            </>
          )}

          {activeTab === "Search" && (
            <div style={{
              background:B.surface, border:`1px solid ${B.border}`,
              padding:"clamp(3rem, 8vw, 5rem) 24px", textAlign:"center",
            }}>
              <p style={{ fontFamily:F.body, fontSize:13, color:B.muted }}>
                Search functionality coming soon.
              </p>
            </div>
          )}
        </main>

        {/* ── Unlock gate overlay ── */}
        {!isUnlocked && hasResults && (
          <UnlockGate
            bannedCount={bannedCount}
            gateTitle={gateTitle}
            gateSubtitle={gateSubtitle}
            unlockEmail={unlockEmail}       setUnlockEmail={setUnlockEmail}
            unlockRole={unlockRole}         setUnlockRole={setUnlockRole}
            unlockOrgToken={unlockOrgToken} setUnlockOrgToken={setUnlockOrgToken}
            unlockLoading={unlockLoading}
            unlockError={unlockError}
            unlockSuccess={unlockSuccess}
            onSubmit={handleUnlockSubmit}
          />
        )}
      </div>
    </>
  );
}