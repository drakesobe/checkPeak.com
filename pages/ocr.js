// pages/ocr.js
// Supplement scanner: label photos (read by Claude vision) or barcode lookup, checked against the banned list.
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import LabelCapture     from "@/components/scanner/LabelCapture";
import ScanVerdict      from "@/components/scanner/ScanVerdict";
import BarcodeCapture   from "@/components/scanner/BarcodeCapture";
import FinishSetupModal from "@/components/FinishSetupModal";
import { useAuthContext } from "@/hooks/useAuth";
import { toast }          from "react-hot-toast";
import { trackEvent }     from "@/lib/analytics";
import { DS }             from "@/components/scanResultsTokens";

const F = { cond: "'Barlow Condensed', sans-serif", body: "'Barlow', sans-serif" };
const MODES = ["Label", "Barcode"];

const getLs = (k) => { try { return window.localStorage.getItem(k); } catch { return null; } };
const setLs = (k, v) => { try { window.localStorage.setItem(k, v); } catch {} };

function track(name, extra = {}) {
  try {
    trackEvent(name, {
      path:   window.location.pathname,
      device: navigator.userAgent,
      ...extra,
    });
  } catch (err) {
    console.error(`${name} tracking failed:`, err);
  }
}

// ---------------------------------------------------------------------------
// Unlock gate: anonymous visitors trade an email for the full breakdown.
// The verdict itself is always visible.
// ---------------------------------------------------------------------------

function UnlockGate({ status, onUnlocked }) {
  const [email, setEmail]     = useState("");
  const [role, setRole]       = useState("Athlete");
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");

  async function submit(e) {
    e.preventDefault();
    const clean = email.trim();
    if (!clean.includes("@")) { setError("Enter a valid email."); return; }
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: clean, role, source: "ocr_unlock_gate" }),
      });
      if (!res.ok) throw new Error("Couldn't save that. Please try again.");
      try { window.gtag?.("event", "conversion", { send_to: "AW-17990566633/giolCJ2S_70cEOmFyYJD" }); } catch {}
      setLs("cp_unlocked", "1");
      setLs("cp_unlocked_email", clean);
      setLs("cp_unlocked_role", role);
      track("unlock_gate_completed", { eventType: "conversion_gate", userEmail: clean, source: "ocr_results_gate", payload: { status } });
      onUnlocked();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form
      onSubmit={submit}
      style={{ padding: "clamp(16px, 4vw, 22px)", background: DS.cardBg, border: `1px solid ${DS.border}`, borderTop: `3px solid ${DS.brand}`, boxShadow: "0 12px 40px rgba(13,27,42,0.12)", display: "flex", flexDirection: "column", gap: 10 }}
    >
      <p style={{ fontFamily: F.cond, fontWeight: 900, fontStyle: "italic", fontSize: 22, textTransform: "uppercase", color: DS.bodyText, margin: 0, lineHeight: 1 }}>
        See the full breakdown
      </p>
      <p style={{ fontFamily: F.body, fontSize: 14, color: DS.labelText, margin: 0, lineHeight: 1.5 }}>
        Every ingredient, why anything was flagged, and what each ingredient does. Free, and we'll save your scans.
      </p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        <input
          type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
          placeholder="you@school.edu" aria-label="Email"
          style={{ flex: "1 1 220px", minHeight: 46, padding: "0 14px", fontFamily: F.body, fontSize: 15, border: `1px solid ${DS.border}`, background: "#F8FAFC", color: DS.bodyText }}
        />
        <select
          value={role} onChange={(e) => setRole(e.target.value)} aria-label="I am a"
          style={{ flex: "0 0 auto", minHeight: 46, padding: "0 12px", fontFamily: F.body, fontSize: 15, border: `1px solid ${DS.border}`, background: "#F8FAFC", color: DS.bodyText }}
        >
          <option value="Athlete">I'm an athlete</option>
          <option value="Organization">I'm a coach</option>
        </select>
      </div>
      <button
        type="submit" disabled={loading}
        style={{ minHeight: 48, fontFamily: F.cond, fontSize: 15, fontWeight: 900, letterSpacing: "0.1em", textTransform: "uppercase", background: loading ? DS.hoverBg : DS.brand, color: loading ? DS.dimText : "#fff", border: "none", cursor: loading ? "not-allowed" : "pointer" }}
      >
        {loading ? "Unlocking…" : "Show full breakdown →"}
      </button>
      {error && <p role="alert" style={{ fontFamily: F.body, fontSize: 13, color: DS.banned, margin: 0 }}>{error}</p>}
    </form>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function OCRPage() {
  const { user } = useAuthContext();
  const loggedIn = !!(user && (user.Email || user.email));
  const userEmail = user?.Email || user?.email || "";

  const [mode, setMode]         = useState("Label");
  const [result, setResult]     = useState(null);   // latest scan only; replaced on every scan
  const [notice, setNotice]     = useState("");     // "couldn't read / not found" messages
  const [unlocked, setUnlocked] = useState(false);
  const [showFinishSetup, setShowFinishSetup] = useState(false);
  const [missingBarcode, setMissingBarcode] = useState(null); // looked up but not found
  const [pendingBarcode, setPendingBarcode] = useState(null); // label scan in progress for this barcode
  const resultRef = useRef(null);

  useEffect(() => {
    if (loggedIn || getLs("cp_unlocked") === "1") setUnlocked(true);
  }, [loggedIn]);

  useEffect(() => { track("page_view_scan", { eventType: "page_view", userEmail, source: "ocr_page" }); }, [userEmail]);

  useEffect(() => {
    if (result && !unlocked) track("unlock_gate_shown", { eventType: "conversion_gate", source: "ocr_results_gate", payload: { status: result.verdict?.status } });
  }, [result, unlocked]);

  function startScan(source) {
    setResult(null);
    setNotice("");
    track("scan_started", { eventType: "scan_start", userEmail, source });
  }

  function finishScan(source, data) {
    if (!data?.found) {
      setResult(null);
      setNotice(data?.message || "We couldn't check that product. Try again with a clearer photo.");
      // A real barcode that no database knows: offer to scan its label (and remember it)
      setMissingBarcode(source === "barcode" && !data?.invalid && data?.barcode ? data.barcode : null);
      return;
    }
    setMissingBarcode(null);
    if (source === "label") {
      if (data.learnedBarcode) toast.success("Saved. Next time anyone scans this barcode, the result is instant.");
      setPendingBarcode(null);
    }
    setResult(data);
    track("scan_completed", {
      eventType: "scan", userEmail, source,
      payload: { status: data.verdict?.status, productName: data.productName || null, bannedCount: data.matchedBanned?.length || 0 },
    });
    requestAnimationFrame(() => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }

  function scanLabelForBarcode() {
    setPendingBarcode(missingBarcode);
    setMissingBarcode(null);
    setNotice("");
    setMode("Label");
  }

  function handleUnlocked() {
    setUnlocked(true);
    toast.success("Unlocked. Finish setup to keep your scan history.");
    if (getLs("cp_finish_setup_dismissed") !== "1" && getLs("cp_finish_setup_completed") !== "1") {
      setTimeout(() => setShowFinishSetup(true), 900);
    }
  }

  const finishEmail = useMemo(() => (showFinishSetup ? getLs("cp_unlocked_email") || "" : ""), [showFinishSetup]);
  const finishRole  = useMemo(() => (showFinishSetup ? getLs("cp_unlocked_role") || "Athlete" : "Athlete"), [showFinishSetup]);

  return (
    <div style={{ minHeight: "100vh", background: DS.pageBg, color: DS.bodyText, fontFamily: F.body }}>
      <FinishSetupModal
        isOpen={showFinishSetup && !loggedIn}
        defaultEmail={finishEmail}
        defaultRole={finishRole}
        defaultOrg=""
        onClose={(meta) => {
          setShowFinishSetup(false);
          if (!meta?.completed) setLs("cp_finish_setup_dismissed", "1");
        }}
      />

      <main style={{ maxWidth: 760, margin: "0 auto", padding: "clamp(1.5rem, 4vw, 2.5rem) clamp(1rem, 4vw, 1.5rem) 4rem" }}>

        <header style={{ marginBottom: "clamp(1.25rem, 3vw, 1.75rem)" }}>
          <p style={{ fontFamily: F.cond, fontSize: 12, fontWeight: 900, letterSpacing: "0.2em", textTransform: "uppercase", color: DS.labelText, margin: "0 0 8px" }}>
            Supplement check
          </p>
          <h1 style={{ fontFamily: F.cond, fontWeight: 900, fontStyle: "italic", fontSize: "clamp(1.9rem, 6vw, 3rem)", lineHeight: 0.92, letterSpacing: "-0.02em", textTransform: "uppercase", margin: "0 0 10px", textWrap: "balance" }}>
            Check it <span style={{ color: DS.brand }}>before you take it.</span>
          </h1>
          <p style={{ fontSize: 15, lineHeight: 1.6, color: DS.labelText, margin: 0, maxWidth: "56ch" }}>
            Photograph the label and we'll read every ingredient and check it against the banned-substance list.
          </p>
        </header>

        {/* Mode switch */}
        <div role="tablist" aria-label="Scan method" style={{ display: "inline-flex", border: `1px solid ${DS.border}`, background: DS.cardBg, marginBottom: 12 }}>
          {MODES.map((m) => (
            <button
              key={m}
              type="button"
              role="tab"
              aria-selected={mode === m}
              onClick={() => { setMode(m); setNotice(""); setMissingBarcode(null); if (m === "Barcode") setPendingBarcode(null); }}
              style={{ minHeight: 42, padding: "0 20px", fontFamily: F.cond, fontSize: 14, fontWeight: 900, letterSpacing: "0.1em", textTransform: "uppercase", border: "none", cursor: "pointer", background: mode === m ? DS.bodyText : "transparent", color: mode === m ? "#fff" : DS.labelText }}
            >
              {m === "Label" ? "Label photo" : "Barcode"}
            </button>
          ))}
        </div>

        <section style={{ background: DS.cardBg, border: `1px solid ${DS.border}`, padding: "clamp(1rem, 4vw, 1.5rem)", marginBottom: 16 }}>
          {mode === "Label" ? (
            <LabelCapture
              barcode={pendingBarcode}
              onStart={() => startScan("label")}
              onResult={(data) => finishScan("label", data)}
            >
              {pendingBarcode && (
                <p style={{ fontSize: 14, lineHeight: 1.5, margin: 0, padding: "10px 12px", background: DS.brandBg, border: `1px solid ${DS.brandBorder}`, color: DS.bodyText }}>
                  Scanning the label for barcode <strong style={{ fontVariantNumeric: "tabular-nums" }}>{pendingBarcode}</strong>.
                  {loggedIn ? " We'll remember this product so the next scan is instant." : " Sign in and we'll remember this product for next time."}
                </p>
              )}
            </LabelCapture>
          ) : (
            <BarcodeCapture onStart={() => startScan("barcode")} onResult={(data) => finishScan("barcode", data)} />
          )}
        </section>

        {notice && (
          <div role="alert" style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 12, fontSize: 15, lineHeight: 1.55, padding: "12px 16px", margin: "0 0 16px", background: DS.cautionBg, border: `1px solid ${DS.cautionBorder}`, color: DS.cautionText }}>
            <span style={{ flex: "1 1 260px" }}>{notice}</span>
            {missingBarcode && (
              <button
                type="button"
                onClick={scanLabelForBarcode}
                style={{ minHeight: 44, padding: "0 16px", fontFamily: F.cond, fontSize: 14, fontWeight: 900, letterSpacing: "0.08em", textTransform: "uppercase", border: "none", background: DS.bodyText, color: "#fff", cursor: "pointer" }}
              >
                Scan the label instead →
              </button>
            )}
          </div>
        )}

        {result && (
          <div ref={resultRef} style={{ scrollMarginTop: 90 }}>
            <ScanVerdict
              result={result}
              locked={!unlocked}
              gate={!unlocked && <UnlockGate status={result.verdict?.status} onUnlocked={handleUnlocked} />}
              onReset={() => { setResult(null); window.scrollTo({ top: 0, behavior: "smooth" }); }}
            />
          </div>
        )}
      </main>
    </div>
  );
}
