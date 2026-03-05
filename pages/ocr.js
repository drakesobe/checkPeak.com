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

function normalizeRole(r) {
  return r === "Organization" ? "Organization" : "Athlete";
}

function normalizeRecord(r) {
  if (!r) return null;
  if (r.fields) return r;
  const id = r.id || r.recordId || Math.random().toString(36).slice(2);
  return { id, fields: r };
}

const getLs = (k) => {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(k);
};

const setLs = (k, v) => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(k, v);
};

// ---------------------------------------------------------------------------
// Page styles — Barlow fonts + scoped utility classes
// ---------------------------------------------------------------------------

const PAGE_STYLE = `
  ${FONT_STYLE}

  .ocr-display { font-family: 'Barlow Condensed', sans-serif; letter-spacing: 0.04em; }
  .ocr-body    { font-family: 'Barlow', sans-serif; }

  /* Scan mode tab */
  .scan-tab {
    font-family: 'Barlow Condensed', sans-serif;
    font-weight: 700;
    font-size: 14px;
    letter-spacing: 0.06em;
    padding: 10px 22px;
    border-radius: 12px 12px 0 0;
    cursor: pointer;
    transition: background-color 0.15s, color 0.15s, box-shadow 0.15s;
    border: 1.5px solid transparent;
    border-bottom: none;
    user-select: none;
  }
  .scan-tab.active {
    background-color: #FFFFFF;
    color: #1E3A5F;
    border-color: #E8ECF0;
    box-shadow: 0 -2px 8px rgba(30,58,95,0.07);
    position: relative;
    z-index: 2;
  }
  .scan-tab.inactive {
    background-color: #EEF3F9;
    color: #6B7A8D;
  }
  .scan-tab.inactive:hover {
    background-color: #dce8f5;
    color: #1E3A5F;
  }

  /* Gate overlay form inputs */
  .gate-input {
    font-family: 'Barlow', sans-serif;
    width: 100%;
    padding: 12px 16px;
    border-radius: 14px;
    border: 1.5px solid #E8ECF0;
    font-size: 14px;
    color: #2D3748;
    background: #F7F9FC;
    outline: none;
    transition: border-color 0.15s;
  }
  .gate-input:focus {
    border-color: #5B9EC9;
    background: #FFFFFF;
  }
`;

// ---------------------------------------------------------------------------
// ResultsSummaryBar
// Minimal count row shown above the results block — always visible even
// when the gate is up, so the athlete knows what's behind it.
// ---------------------------------------------------------------------------

function ResultsSummaryBar({ bannedCount, ingredientCount, scanMode, productName }) {
  return (
    <div
      className="ocr-body flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 px-5 py-4"
      style={{ borderBottom: `1px solid ${DS.border}` }}
    >
      <div>
        <p
          className="ocr-display font-bold text-sm"
          style={{ color: DS.bodyText, letterSpacing: "0.04em" }}
        >
          {productName ? `${productName}` : `${scanMode} Results`}
        </p>
        <p className="ocr-body text-xs mt-0.5" style={{ color: DS.labelText }}>
          {productName ? `Mode: ${scanMode}` : "Latest scan"}
        </p>
      </div>

      <div className="flex gap-2 flex-wrap">
        <span
          className="ocr-body inline-flex items-center rounded-full px-3 py-1 text-xs font-bold"
          style={{
            backgroundColor: bannedCount > 0 ? DS.bannedBg  : DS.safeBg,
            color:            bannedCount > 0 ? DS.banned    : DS.safe,
            border:           `1px solid ${bannedCount > 0 ? DS.bannedBorder : DS.safeBorder}`,
          }}
        >
          {bannedCount} flagged
        </span>
        <span
          className="ocr-body inline-flex items-center rounded-full px-3 py-1 text-xs font-bold"
          style={{
            backgroundColor: DS.ingredientBg,
            color:           DS.ingredient,
            border:          `1px solid ${DS.ingredientBorder}`,
          }}
        >
          {ingredientCount} ingredient{ingredientCount !== 1 ? "s" : ""} matched
        </span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// UnlockGate
// Shown as a full-viewport overlay when the user hasn't unlocked yet.
// Calm, clear — not alarming even when banned substances are found.
// ---------------------------------------------------------------------------

function UnlockGate({
  bannedCount,
  gateTitle,
  gateSubtitle,
  unlockEmail, setUnlockEmail,
  unlockRole,  setUnlockRole,
  unlockOrgToken, setUnlockOrgToken,
  unlockLoading,
  unlockError,
  unlockSuccess,
  onSubmit,
}) {
  return (
    <div
      className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center p-0 sm:p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.45)" }}
    >
      {/* Card — slides up from bottom on mobile (native feel) */}
      <div
        className="ocr-body w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl overflow-hidden"
        style={{
          backgroundColor: DS.cardBg,
          border:    `1.5px solid ${DS.border}`,
          boxShadow: "0 -8px 40px rgba(0,0,0,0.18)",
        }}
      >
        {/* Top accent */}
        <div
          style={{
            height: 4,
            backgroundColor: bannedCount > 0 ? DS.banned : DS.safe,
            opacity: 0.7,
          }}
        />

        <div className="px-6 py-6 space-y-4">
          {/* Status + headline */}
          <div className="space-y-1.5">
            <p
              className="ocr-body text-xs font-bold uppercase tracking-widest"
              style={{ color: bannedCount > 0 ? DS.banned : DS.safe }}
            >
              {gateTitle}
            </p>
            <h3
              className="ocr-display font-black"
              style={{ fontSize: "clamp(1.2rem, 4vw, 1.5rem)", color: DS.bodyText }}
            >
              Unlock full details + save this scan
            </h3>
            <p className="ocr-body text-sm" style={{ color: DS.labelText }}>
              {gateSubtitle}
            </p>
          </div>

          {/* Form */}
          <form onSubmit={onSubmit} className="space-y-2.5">
            <input
              type="email"
              value={unlockEmail}
              onChange={(e) => setUnlockEmail(e.target.value)}
              placeholder="Email to unlock + save scans"
              className="gate-input"
              required
            />

            <div className="flex flex-col sm:flex-row gap-2">
              <select
                value={unlockRole}
                onChange={(e) => setUnlockRole(normalizeRole(e.target.value))}
                className="gate-input sm:w-44 shrink-0"
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
              />
            </div>

            <button
              type="submit"
              disabled={unlockLoading}
              className="ocr-display w-full flex items-center justify-center gap-2 rounded-2xl font-bold transition"
              style={{
                height:          52,
                fontSize:        15,
                letterSpacing:   "0.06em",
                backgroundColor: unlockLoading ? DS.border : DS.brand,
                color:           unlockLoading ? DS.dimText : "#fff",
                cursor:          unlockLoading ? "not-allowed" : "pointer",
                boxShadow:       unlockLoading ? "none" : "0 2px 12px rgba(30,58,95,0.25)",
              }}
              onMouseEnter={(e) => { if (!unlockLoading) e.currentTarget.style.backgroundColor = "#254d80"; }}
              onMouseLeave={(e) => { if (!unlockLoading) e.currentTarget.style.backgroundColor = DS.brand; }}
            >
              {unlockLoading ? (
                <>
                  <span
                    className="inline-block rounded-full border-2 border-t-transparent animate-spin"
                    style={{ width: 16, height: 16, borderColor: `${DS.dimText}60`, borderTopColor: DS.dimText }}
                  />
                  Unlocking…
                </>
              ) : "Unlock Details →"}
            </button>

            {unlockError && (
              <p className="ocr-body text-xs" style={{ color: DS.banned }}>
                {unlockError}
              </p>
            )}
            {unlockSuccess && (
              <p className="ocr-body text-xs" style={{ color: DS.safe }}>
                Unlocked. Finish setup to save scans.
              </p>
            )}

            <p className="ocr-body text-[11px] text-center" style={{ color: DS.dimText }}>
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

  // ── Scan state ──
  const [activeTab,            setActiveTab]            = useState("Scan");
  const [scanMode,             setScanMode]             = useState("Nutrition Label");
  const [rawOCR,               setRawOCR]               = useState("");
  const [detectedBanned,       setDetectedBanned]       = useState([]);
  const [detectedIngredients,  setDetectedIngredients]  = useState([]);
  const [scanning,             setScanning]             = useState(false);
  const [progress,             setProgress]             = useState(0);
  const [error,                setError]                = useState("");

  // ── Gate state ──
  const [unlockEmail,     setUnlockEmail]     = useState("");
  const [unlockRole,      setUnlockRole]      = useState("Athlete");
  const [unlockOrgToken,  setUnlockOrgToken]  = useState("");
  const [unlockLoading,   setUnlockLoading]   = useState(false);
  const [unlockError,     setUnlockError]     = useState("");
  const [unlockSuccess,   setUnlockSuccess]   = useState(false);
  const [isUnlocked,      setIsUnlocked]      = useState(false);
  const [unlockSeen,      setUnlockSeen]      = useState(false);

  // ── Finish setup ──
  const [showFinishSetup, setShowFinishSetup] = useState(false);

  // ── Scan meta (for gate copy + summary bar) ──
  const [lastScanMeta, setLastScanMeta] = useState({
    productName:    null,
    scanMode:       null,
    bannedCount:    0,
    ingredientCount: 0,
  });

  const hasResults =
    (rawOCR && rawOCR.trim().length > 0) ||
    detectedBanned.length > 0 ||
    detectedIngredients.length > 0;

  const bannedCount     = lastScanMeta?.bannedCount     ?? detectedBanned.length;
  const ingredientCount = lastScanMeta?.ingredientCount ?? detectedIngredients.length;

  // ── Auth unlock ──
  useEffect(() => {
    const loggedIn = !!(user && (user.Email || user.email));
    if (loggedIn) { setIsUnlocked(true); return; }
    if (getLs("cp_unlocked") === "1") setIsUnlocked(true);
  }, [user]);

  // ── Finish setup prompt ──
  useEffect(() => {
    const loggedIn = !!(user && (user.Email || user.email));
    if (loggedIn) return;
    if (getLs("cp_unlocked") !== "1") return;
    if (getLs("cp_finish_setup_dismissed") === "1") return;
    if (getLs("cp_finish_setup_completed")  === "1") return;
    const t = setTimeout(() => setShowFinishSetup(true), 900);
    return () => clearTimeout(t);
  }, [user]);

  // ── Gate analytics ──
  useEffect(() => {
    if (!hasResults || isUnlocked || unlockSeen) return;
    setUnlockSeen(true);
    try {
      trackEvent("unlock_gate_shown", {
        eventType: "conversion_gate",
        userEmail: user?.Email || user?.email || "",
        path:   typeof window !== "undefined" ? window.location.pathname : "",
        source: "ocr_results_gate",
        device: typeof navigator !== "undefined" ? navigator.userAgent : "",
        payload: {
          scanMode:       lastScanMeta?.scanMode || scanMode,
          bannedCount,
          ingredientCount,
          productName:    lastScanMeta?.productName || null,
        },
      });
    } catch (e) {
      console.error("unlock_gate_shown tracking failed:", e);
    }
  }, [hasResults, isUnlocked, unlockSeen, user, scanMode, lastScanMeta, bannedCount, ingredientCount]);

  // ── Org token resolver ──
  const resolveOrgToken = async (token) => {
    const t = String(token ?? "").trim();
    if (!t) return null;
    const res  = await fetch(`/api/org/resolveToken?token=${encodeURIComponent(t)}`);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.error || "Invalid organization token.");
    return data?.org ?? null;
  };

  // ── Unlock submit ──
  const handleUnlockSubmit = async (e) => {
    e.preventDefault();
    setUnlockError("");
    setUnlockSuccess(false);

    const email    = unlockEmail.trim();
    const role     = normalizeRole(unlockRole);
    const orgToken = String(unlockOrgToken ?? "").trim();

    if (!email || !email.includes("@")) {
      setUnlockError("Please enter a valid email.");
      return;
    }

    setUnlockLoading(true);
    try {
      let resolvedOrg = null;
      if (role === "Organization" && orgToken) {
        resolvedOrg = await resolveOrgToken(orgToken);
      }

      const res = await fetch("/api/waitlist", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          email,
          role,
          organizationToken: orgToken || null,
          organizationId:    resolvedOrg?.id   || null,
          organizationName:  resolvedOrg?.name || null,
          source: "ocr_unlock_gate",
        }),
      });

      if (!res.ok) throw new Error("Unable to save. Please try again.");

      setUnlockSuccess(true);
      setIsUnlocked(true);

      setLs("cp_unlocked",          "1");
      setLs("cp_unlocked_email",    email);
      setLs("cp_unlocked_role",     role);
      setLs("cp_unlocked_org_token", orgToken    || "");
      setLs("cp_unlocked_org_id",    resolvedOrg?.id   || "");
      setLs("cp_unlocked_org_name",  resolvedOrg?.name || "");

      try {
        await trackEvent("unlock_gate_completed", {
          eventType: "conversion_gate",
          userEmail: email,
          path:   typeof window !== "undefined" ? window.location.pathname : "",
          source: "ocr_results_gate",
          device: typeof navigator !== "undefined" ? navigator.userAgent : "",
          payload: {
            scanMode:       lastScanMeta?.scanMode || scanMode,
            bannedCount,
            ingredientCount,
            productName:    lastScanMeta?.productName || null,
            org: resolvedOrg
              ? { id: resolvedOrg.id, name: resolvedOrg.name, token: orgToken }
              : orgToken ? { token: orgToken } : null,
          },
        });
      } catch (e2) {
        console.error("unlock_gate_completed tracking failed:", e2);
      }

      toast.success("Unlocked! Now save this by finishing setup.");

      if (getLs("cp_finish_setup_dismissed") !== "1" && getLs("cp_finish_setup_completed") !== "1") {
        setTimeout(() => setShowFinishSetup(true), 900);
      }
    } catch (err) {
      console.error(err);
      setUnlockError(err?.message || "Something went wrong. Please try again.");
    } finally {
      setUnlockLoading(false);
    }
  };

  // ── Page-view analytics ──
  useEffect(() => {
    if (activeTab !== "Scan") return;
    try {
      trackEvent("page_view_scan", {
        eventType: "page_view",
        userEmail: user?.Email || user?.email || "",
        path:   typeof window !== "undefined" ? window.location.pathname : "",
        source: "ocr_page",
        device: typeof navigator !== "undefined" ? navigator.userAgent : "",
      });
    } catch (err) {
      console.error("page_view_scan tracking failed:", err);
    }
  }, [activeTab, user]);

  // ── Scan result handler ──
  const handleScanResult = async (result) => {
    if (!result) return;

    const raw = result.rawIngredients || result.ocrText || result.text || "";
    if (!raw) return;

    setRawOCR((prev) => (prev ? `${prev} ${raw}` : raw));

    const bannedMatches = (Array.isArray(result.matchedBanned || result.matchedBannedRecords || result.matched_banned)
      ? (result.matchedBanned || result.matchedBannedRecords || result.matched_banned)
      : []
    ).map(normalizeRecord).filter(Boolean);

    const ingredientMatches = (Array.isArray(
      result.matchedIngredients || result.detectedIngredients ||
      result.matched_ingredients || result.matchedIngredientRecords
    )
      ? (result.matchedIngredients || result.detectedIngredients ||
         result.matched_ingredients || result.matchedIngredientRecords)
      : []
    ).map(normalizeRecord).filter(Boolean);

    setDetectedBanned(bannedMatches);
    setDetectedIngredients(ingredientMatches);

    setLastScanMeta({
      productName:    result.productName || null,
      scanMode,
      bannedCount:    bannedMatches.length,
      ingredientCount: ingredientMatches.length,
    });

    try {
      await trackEvent("scan_completed", {
        eventType: "scan",
        userEmail: user?.Email || user?.email || "",
        path:   typeof window !== "undefined" ? window.location.pathname : "",
        source: scanMode === "Nutrition Label" ? "nutrition_label" : "barcode",
        device: typeof navigator !== "undefined" ? navigator.userAgent : "",
        payload: {
          scanMode,
          productName:    result.productName || null,
          bannedCount:    bannedMatches.length,
          ingredientCount: ingredientMatches.length,
          bannedDetails:  result.bannedDetails || {},
          found:          result.found ?? true,
        },
      });
    } catch (err) {
      console.error("scan_completed tracking failed:", err);
    }
  };

  // ── OCR handler ──
  const handleOCRScan = async (text) => {
    if (!text) return;
    setScanning(true);
    setProgress(0);
    setError("");
    setUnlockError("");
    setUnlockSuccess(false);

    try { trackEvent("scan_started", { eventType: "scan_start", userEmail: user?.Email || user?.email || "", path: typeof window !== "undefined" ? window.location.pathname : "", source: "nutrition_label", device: typeof navigator !== "undefined" ? navigator.userAgent : "" }); } catch {}

    try {
      const res  = await fetch("/api/check", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ text, userEmail: user?.Email || user?.email || "" }),
      });
      const data = await res.json();
      await handleScanResult({ rawIngredients: text, ...data });
    } catch (err) {
      console.error("OCR scan error:", err);
      setError("Nutrition Label scan failed. Please try again.");
    } finally {
      setScanning(false);
      setProgress(100);
    }
  };

  // ── Barcode handler ──
  const handleBarcodeScan = async (result) => {
    if (!result) return;
    setScanning(true);
    setProgress(0);
    setError("");
    setUnlockError("");
    setUnlockSuccess(false);

    try { trackEvent("scan_started", { eventType: "scan_start", userEmail: user?.Email || user?.email || "", path: typeof window !== "undefined" ? window.location.pathname : "", source: "barcode", device: typeof navigator !== "undefined" ? navigator.userAgent : "" }); } catch {}

    try {
      await handleScanResult(result);
    } catch (err) {
      console.error("Barcode scan error:", err);
      setError("Barcode scan failed. Please try again.");
    } finally {
      setScanning(false);
      setProgress(100);
    }
  };

  // ── Finish setup memo ──
  const finishEmail = useMemo(() => getLs("cp_unlocked_email")     || "",        [showFinishSetup]);
  const finishRole  = useMemo(() => getLs("cp_unlocked_role")      || "Athlete", [showFinishSetup]);
  const finishOrg   = useMemo(() => getLs("cp_unlocked_org_token") || "",        [showFinishSetup]);

  // ── Gate copy ──
  const gateTitle    = bannedCount > 0 ? "Potential risk detected" : "Scan complete — no obvious red flags";
  const gateSubtitle = bannedCount > 0
    ? "Unlock details and save scan history so you can reference this later."
    : "Save this scan to build history and get alerts as our database expands.";

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: PAGE_STYLE }} />

      <div
        className="ocr-body min-h-screen"
        style={{ backgroundColor: DS.pageBg, color: DS.bodyText }}
      >
        {scanning && <ProgressBar progress={progress} scanning={scanning} />}

        <FinishSetupModal
          isOpen={showFinishSetup && !(user && (user.Email || user.email))}
          defaultEmail={finishEmail}
          defaultRole={normalizeRole(finishRole)}
          defaultOrg={finishOrg}
          onClose={(meta) => {
            setShowFinishSetup(false);
            try {
              trackEvent("finish_setup_closed", {
                eventType: "finish_setup",
                userEmail: finishEmail || "",
                source:    "ocr_finish_setup_modal",
                payload:   { completed: !!meta?.completed },
              });
            } catch {}
            if (!meta?.completed) setLs("cp_finish_setup_dismissed", "1");
          }}
        />

        <main
          className="mx-auto px-3 sm:px-6 py-6 sm:py-10 space-y-6"
          style={{ maxWidth: 900 }}
        >
          {activeTab === "Scan" && (
            <>
              {/* ── Mode tabs ─────────────────────────────────────── */}
              <div className="flex items-end gap-1">
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
                {/* Tab bottom border — connects tabs to upload card */}
                <div
                  className="flex-1"
                  style={{ borderBottom: `1.5px solid ${DS.border}`, marginBottom: 0 }}
                />
              </div>

              {/* ── Upload card ───────────────────────────────────── */}
              <div
                className="rounded-b-2xl rounded-tr-2xl overflow-hidden"
                style={{
                  backgroundColor: DS.cardBg,
                  border:          `1.5px solid ${DS.border}`,
                  borderTop:       "none",
                  boxShadow:       "0 2px 12px rgba(0,0,0,0.06)",
                  padding:         "16px 20px 20px",
                }}
              >
                {scanMode === "Nutrition Label" ? (
                  <OCRUpload multiple={true} onScan={handleOCRScan} />
                ) : (
                  <BarcodeUpload onResult={handleBarcodeScan} showScanButton={true} />
                )}
              </div>

              {/* ── Error ─────────────────────────────────────────── */}
              {error && (
                <div
                  className="ocr-body rounded-2xl px-4 py-3 text-sm"
                  style={{
                    backgroundColor: DS.bannedBg,
                    border:          `1px solid ${DS.bannedBorder}`,
                    color:           DS.banned,
                  }}
                >
                  {error}
                </div>
              )}

              {/* ── Results block ─────────────────────────────────── */}
              <div
                className="relative rounded-2xl overflow-hidden"
                style={{
                  backgroundColor: DS.cardBg,
                  border:          `1.5px solid ${DS.border}`,
                  boxShadow:       "0 2px 12px rgba(0,0,0,0.06)",
                }}
              >
                {/* Always-visible summary bar */}
                {hasResults && (
                  <ResultsSummaryBar
                    bannedCount={bannedCount}
                    ingredientCount={ingredientCount}
                    scanMode={lastScanMeta?.scanMode || scanMode}
                    productName={lastScanMeta?.productName}
                  />
                )}

                {/* Blurred results while gated */}
                <div
                  style={{
                    filter:         !isUnlocked && hasResults ? "blur(5px)" : "none",
                    pointerEvents:  !isUnlocked && hasResults ? "none"       : "auto",
                    userSelect:     !isUnlocked && hasResults ? "none"       : "auto",
                    transition:     "filter 0.3s",
                  }}
                >
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
            <div
              className="ocr-body rounded-2xl px-6 py-12 text-center"
              style={{
                backgroundColor: DS.cardBg,
                border:          `1.5px solid ${DS.border}`,
              }}
            >
              <p className="text-sm" style={{ color: DS.dimText }}>
                Search functionality coming soon.
              </p>
            </div>
          )}
        </main>

        {/* ── Unlock gate overlay ───────────────────────────────── */}
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