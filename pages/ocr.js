// pages/ocr.js
"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import OCRUpload from "../components/OCRUpload";
import BarcodeUpload from "../components/BarcodeUpload";
import OCRScanResults from "../components/OCRScanResults";
import ProgressBar from "../components/ProgressBar";
import FinishSetupModal from "../components/FinishSetupModal";
import { useAuthContext } from "../hooks/useAuth";
import { toast } from "react-hot-toast";
import { trackEvent } from "@/lib/analytics";

function normalizeRole(r) {
  return r === "Organization" ? "Organization" : "Athlete";
}

export default function OCRPage() {
  const { user } = useAuthContext();

  const [activeTab, setActiveTab] = useState("Scan");
  const [scanMode, setScanMode] = useState("Nutrition Label");
  const [ocrTexts, setOcrTexts] = useState([]);
  const [rawOCR, setRawOCR] = useState("");
  const [detectedBanned, setDetectedBanned] = useState([]);
  const [detectedIngredients, setDetectedIngredients] = useState([]);
  const [combinedHighlightedOCR, setCombinedHighlightedOCR] = useState("");
  const [progress, setProgress] = useState(0);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState("");
  const tabRefs = useRef({});
  const underlineRef = useRef(null);
  const [showRawOCR, setShowRawOCR] = useState(false);

  // -----------------------------
  // 🔒 Conversion Gate (Email unlock)
  // -----------------------------
  const [unlockEmail, setUnlockEmail] = useState("");
  const [unlockRole, setUnlockRole] = useState("Athlete"); // ✅ only Athlete/Organization
  const [unlockOrgToken, setUnlockOrgToken] = useState(""); // ✅ token (optional)
  const [unlockLoading, setUnlockLoading] = useState(false);
  const [unlockError, setUnlockError] = useState("");
  const [unlockSuccess, setUnlockSuccess] = useState(false);

  const [isUnlocked, setIsUnlocked] = useState(false);
  const [unlockSeen, setUnlockSeen] = useState(false);

  // -----------------------------
  // ✅ Step 2: Finish setup modal
  // -----------------------------
  const [showFinishSetup, setShowFinishSetup] = useState(false);

  const getLs = (k) => {
    if (typeof window === "undefined") return null;
    return window.localStorage.getItem(k);
  };

  const setLs = (k, v) => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(k, v);
  };

  const [lastScanMeta, setLastScanMeta] = useState({
    productName: null,
    scanMode: null,
    bannedCount: 0,
    ingredientCount: 0,
  });

  const hasResults =
    (rawOCR && rawOCR.trim().length > 0) ||
    detectedBanned.length > 0 ||
    detectedIngredients.length > 0;

  // Consider unlocked if logged-in OR previously unlocked via email
  useEffect(() => {
    const loggedIn = !!(user && (user.Email || user.email));
    if (loggedIn) {
      setIsUnlocked(true);
      return;
    }

    const saved = getLs("cp_unlocked");
    if (saved === "1") setIsUnlocked(true);
  }, [user]);

  // Prompt finish-setup on next visit if they unlocked but never finished
  useEffect(() => {
    const loggedIn = !!(user && (user.Email || user.email));
    if (loggedIn) return;

    const unlocked = getLs("cp_unlocked") === "1";
    if (!unlocked) return;

    const dismissed = getLs("cp_finish_setup_dismissed") === "1";
    const completed = getLs("cp_finish_setup_completed") === "1";
    if (dismissed || completed) return;

    // don’t pop instantly on load; wait a beat
    const t = setTimeout(() => setShowFinishSetup(true), 900);
    return () => clearTimeout(t);
  }, [user]);

  // Fire analytics when gate is shown (once per page load)
  useEffect(() => {
    if (!hasResults) return;
    if (isUnlocked) return;
    if (unlockSeen) return;

    setUnlockSeen(true);

    try {
      trackEvent("unlock_gate_shown", {
        eventType: "conversion_gate",
        userEmail: user?.Email || user?.email || "",
        path: typeof window !== "undefined" ? window.location.pathname : "",
        source: "ocr_results_gate",
        device: typeof navigator !== "undefined" ? navigator.userAgent : "",
        payload: {
          scanMode: lastScanMeta?.scanMode || scanMode,
          bannedCount: lastScanMeta?.bannedCount ?? detectedBanned.length,
          ingredientCount:
            lastScanMeta?.ingredientCount ?? detectedIngredients.length,
          productName: lastScanMeta?.productName || null,
        },
      });
    } catch (e) {
      console.error("unlock_gate_shown tracking failed:", e);
    }
  }, [
    hasResults,
    isUnlocked,
    unlockSeen,
    user,
    scanMode,
    lastScanMeta,
    detectedBanned.length,
    detectedIngredients.length,
  ]);

  const resolveOrgToken = async (token) => {
    const t = String(token || "").trim();
    if (!t) return null;

    const res = await fetch(`/api/org/resolveToken?token=${encodeURIComponent(t)}`, {
      method: "GET",
    });
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      throw new Error(data?.error || "Invalid organization token.");
    }

    return data?.org || null; // { id, name, token }
  };

  const handleUnlockSubmit = async (e) => {
    e.preventDefault();
    setUnlockError("");
    setUnlockSuccess(false);

    const email = unlockEmail.trim();
    const role = normalizeRole(unlockRole);
    const orgToken = String(unlockOrgToken || "").trim();

    if (!email || !email.includes("@")) {
      setUnlockError("Please enter a valid email.");
      return;
    }

    setUnlockLoading(true);
    try {
      // ✅ If they picked Organization and provided a token, resolve it.
      // Token remains OPTIONAL: if blank, proceed.
      let resolvedOrg = null;
      if (role === "Organization" && orgToken) {
        resolvedOrg = await resolveOrgToken(orgToken);
      }

      // Save to your existing waitlist endpoint (Airtable)
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          role,
          organizationToken: orgToken || null,
          organizationId: resolvedOrg?.id || null,
          organizationName: resolvedOrg?.name || null,
          source: "ocr_unlock_gate",
        }),
      });

      if (!res.ok) throw new Error("Unable to save. Please try again.");

      setUnlockSuccess(true);
      setIsUnlocked(true);

      // persist soft-unlock identity for step 2
      setLs("cp_unlocked", "1");
      setLs("cp_unlocked_email", email);
      setLs("cp_unlocked_role", role);
      setLs("cp_unlocked_org_token", orgToken || "");
      setLs("cp_unlocked_org_id", resolvedOrg?.id || "");
      setLs("cp_unlocked_org_name", resolvedOrg?.name || "");

      // Analytics: unlock completed
      try {
        await trackEvent("unlock_gate_completed", {
          eventType: "conversion_gate",
          userEmail: email,
          path: typeof window !== "undefined" ? window.location.pathname : "",
          source: "ocr_results_gate",
          device: typeof navigator !== "undefined" ? navigator.userAgent : "",
          payload: {
            scanMode: lastScanMeta?.scanMode || scanMode,
            bannedCount: lastScanMeta?.bannedCount ?? detectedBanned.length,
            ingredientCount:
              lastScanMeta?.ingredientCount ?? detectedIngredients.length,
            productName: lastScanMeta?.productName || null,
            org: resolvedOrg
              ? { id: resolvedOrg?.id || "", name: resolvedOrg?.name || "", token: orgToken || "" }
              : orgToken
              ? { token: orgToken }
              : null,
          },
        });
      } catch (e2) {
        console.error("unlock_gate_completed tracking failed:", e2);
      }

      toast.success("Unlocked! Now save this by finishing setup.");

      // ✅ Step 2 prompt (after value delivered)
      const dismissed = getLs("cp_finish_setup_dismissed") === "1";
      const completed = getLs("cp_finish_setup_completed") === "1";
      if (!dismissed && !completed) {
        setTimeout(() => setShowFinishSetup(true), 900);
      }
    } catch (err) {
      console.error(err);
      setUnlockError(err?.message || "Something went wrong. Please try again.");
    } finally {
      setUnlockLoading(false);
    }
  };

  // -----------------------------
  // Existing stuff
  // -----------------------------
  // Tab underline animation
  useEffect(() => {
    const currentTab = tabRefs.current[scanMode];
    const underline = underlineRef.current;
    if (currentTab && underline) {
      const { offsetLeft, offsetWidth } = currentTab;
      underline.style.left = `${offsetLeft}px`;
      underline.style.width = `${offsetWidth}px`;
    }
  }, [scanMode]);

  // 🔥 Analytics: Scan page view
  useEffect(() => {
    if (activeTab !== "Scan") return;

    try {
      trackEvent("page_view_scan", {
        eventType: "page_view",
        userEmail: user?.Email || user?.email || "",
        path: typeof window !== "undefined" ? window.location.pathname : "",
        source: "ocr_page",
        device: typeof navigator !== "undefined" ? navigator.userAgent : "",
      });
    } catch (err) {
      console.error("page_view_scan tracking failed:", err);
    }
  }, [activeTab, user]);

  const normalizeRecord = (r) => {
    if (!r) return null;
    if (r.fields) return r;
    const id = r.id || r.recordId || Math.random().toString(36).slice(2);
    return { id, fields: r };
  };

  // 🔥 Core: handle scan results + analytics
  const handleScanResult = async (result) => {
    if (!result) return;

    const raw = result.rawIngredients || result.ocrText || result.text || "";
    if (!raw) return;

    setOcrTexts((prev) => [...prev, raw]);
    setRawOCR((prev) => (prev ? prev + " " + raw : raw));
    setShowRawOCR(false);

    const bannedMatchesRaw =
      result.matchedBanned ||
      result.matchedBannedRecords ||
      result.matched_banned ||
      [];
    const bannedMatches = Array.isArray(bannedMatchesRaw)
      ? bannedMatchesRaw.map(normalizeRecord)
      : [];
    setDetectedBanned(bannedMatches);

    const ingredientMatchesRaw =
      result.matchedIngredients ||
      result.detectedIngredients ||
      result.matched_ingredients ||
      result.matchedIngredientRecords ||
      [];
    const ingredientMatches = Array.isArray(ingredientMatchesRaw)
      ? ingredientMatchesRaw.map(normalizeRecord)
      : [];
    setDetectedIngredients(ingredientMatches);

    setLastScanMeta({
      productName: result.productName || null,
      scanMode,
      bannedCount: bannedMatches.length,
      ingredientCount: ingredientMatches.length,
    });

    try {
      const bannedDetails = result.bannedDetails || {};
      await trackEvent("scan_completed", {
        eventType: "scan",
        userEmail: user?.Email || user?.email || "",
        path: typeof window !== "undefined" ? window.location.pathname : "",
        source: scanMode === "Nutrition Label" ? "nutrition_label" : "barcode",
        device: typeof navigator !== "undefined" ? navigator.userAgent : "",
        payload: {
          scanMode,
          productName: result.productName || null,
          bannedCount: bannedMatches.length,
          ingredientCount: ingredientMatches.length,
          bannedDetails,
          found: result.found ?? true,
        },
      });
    } catch (err) {
      console.error("scan_completed tracking failed:", err);
    }
  };

  const handleOCRScan = async (text) => {
    if (!text) return;
    setScanning(true);
    setProgress(0);
    setError("");

    setUnlockError("");
    setUnlockSuccess(false);

    try {
      trackEvent("scan_started", {
        eventType: "scan_start",
        userEmail: user?.Email || user?.email || "",
        path: typeof window !== "undefined" ? window.location.pathname : "",
        source: "nutrition_label",
        device: typeof navigator !== "undefined" ? navigator.userAgent : "",
      });
    } catch {}

    try {
      const res = await fetch("/api/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text,
          userEmail: user?.Email || user?.email || "",
        }),
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

  const handleBarcodeScan = async (result) => {
    if (!result) return;
    setScanning(true);
    setProgress(0);
    setError("");

    setUnlockError("");
    setUnlockSuccess(false);

    try {
      trackEvent("scan_started", {
        eventType: "scan_start",
        userEmail: user?.Email || user?.email || "",
        path: typeof window !== "undefined" ? window.location.pathname : "",
        source: "barcode",
        device: typeof navigator !== "undefined" ? navigator.userAgent : "",
      });
    } catch {}

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

  const bannedCount = lastScanMeta?.bannedCount ?? detectedBanned.length;
  const ingredientCount =
    lastScanMeta?.ingredientCount ?? detectedIngredients.length;

  const gateTitle =
    bannedCount > 0
      ? "Potential risk detected"
      : "Scan complete — no obvious red flags found";

  const gateSubtitle =
    bannedCount > 0
      ? "Unlock details + save scan history so you can reference this later."
      : "Save this scan to build history and get alerts as our database expands.";

  const finishEmail = useMemo(
    () => getLs("cp_unlocked_email") || "",
    [showFinishSetup]
  );
  const finishRole = useMemo(
    () => getLs("cp_unlocked_role") || "Athlete",
    [showFinishSetup]
  );
  const finishOrg = useMemo(
    () => getLs("cp_unlocked_org_token") || "",
    [showFinishSetup]
  );

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-blue-50 text-gray-900 font-sans">
      {scanning && <ProgressBar progress={progress} scanning={scanning} />}

      <FinishSetupModal
        isOpen={showFinishSetup && !(user && (user.Email || user.email))}
        defaultEmail={finishEmail}
        defaultRole={normalizeRole(finishRole)}
        defaultOrg={finishOrg}
        onClose={(meta) => {
          setShowFinishSetup(false);

          // Track dismissal/completion
          try {
            trackEvent("finish_setup_closed", {
              eventType: "finish_setup",
              userEmail: finishEmail || "",
              source: "ocr_finish_setup_modal",
              payload: { completed: !!meta?.completed },
            });
          } catch {}

          if (!meta?.completed) {
            // persist dismissal already handled in modal button,
            // but keep safe here in case they close via backdrop/X
            setLs("cp_finish_setup_dismissed", "1");
          }
        }}
      />

      <main className="max-w-6xl mx-auto px-2 sm:px-4 py-4 sm:py-8 space-y-6 sm:space-y-8">
        {activeTab === "Scan" && (
          <>
            {/* Mode Tabs */}
            <div className="relative flex flex-wrap justify-center sm:justify-start gap-2 sm:gap-4 mb-4 sm:mb-6">
              {["Nutrition Label", "Barcode"].map((mode) => (
                <div
                  key={mode}
                  ref={(el) => (tabRefs.current[mode] = el)}
                  onClick={() => setScanMode(mode)}
                  className={`cursor-pointer px-4 sm:px-6 py-3 sm:py-4 font-semibold rounded-t-xl transition-all duration-200 text-sm sm:text-base
                    ${
                      scanMode === mode
                        ? "bg-white text-[#46769B] scale-105 shadow-md z-10"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200 hover:-translate-y-1 shadow-sm z-0"
                    }`}
                >
                  {mode}
                </div>
              ))}
              <div
                ref={underlineRef}
                className="absolute bottom-0 h-1 bg-[#46769B] rounded-full transition-all duration-300 z-20"
                style={{ width: 0, left: 0 }}
              />
            </div>

            {/* Upload area */}
            <div className="w-full bg-white p-4 sm:p-6 rounded-b-2xl shadow-md mx-auto border border-blue-100">
              {scanMode === "Nutrition Label" ? (
                <OCRUpload multiple={true} onScan={handleOCRScan} />
              ) : (
                <BarcodeUpload onResult={handleBarcodeScan} showScanButton={true} />
              )}
            </div>

            {error && (
              <p className="text-red-500 mt-2 text-center text-sm sm:text-base">
                {error}
              </p>
            )}

            {/* Results block (gated) */}
            <section className="w-full bg-white p-4 sm:p-6 rounded-2xl shadow-md mx-auto border border-blue-100 mt-4 relative overflow-hidden">
              {/* Headline counts always visible */}
              {hasResults && (
                <div className="mb-4 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
                  <div className="text-sm sm:text-base">
                    <p className="font-semibold text-gray-900">Results summary</p>
                    <p className="text-gray-600 text-xs sm:text-sm">
                      {lastScanMeta?.productName
                        ? `Product: ${lastScanMeta.productName} • `
                        : ""}
                      Mode: {lastScanMeta?.scanMode || scanMode}
                    </p>
                  </div>

                  <div className="flex gap-2 flex-wrap">
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-semibold border ${
                        bannedCount > 0
                          ? "bg-red-50 text-red-700 border-red-200"
                          : "bg-emerald-50 text-emerald-700 border-emerald-200"
                      }`}
                    >
                      {bannedCount} flagged
                    </span>
                    <span className="px-3 py-1 rounded-full text-xs font-semibold border bg-indigo-50 text-indigo-700 border-indigo-200">
                      {ingredientCount} ingredients matched
                    </span>
                  </div>
                </div>
              )}

              {/* Blur results if not unlocked */}
              <div
                className={`${
                  !isUnlocked && hasResults
                    ? "filter blur-sm pointer-events-none select-none"
                    : ""
                }`}
              >
                <OCRScanResults
                  ocrText={rawOCR}
                  detectedSubstances={detectedBanned}
                  detectedIngredients={detectedIngredients}
                  showOCR={true}
                />
              </div>

              {/* Gate overlay (fixed to viewport) */}
              {!isUnlocked && hasResults && (
                <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/40">
                  <div className="w-full max-w-xl bg-white/95 backdrop-blur-md border border-gray-200 rounded-2xl shadow-xl p-5 sm:p-6">
                    <div className="flex flex-col gap-2 text-center">
                      <p
                        className={`text-sm font-semibold ${
                          bannedCount > 0 ? "text-red-700" : "text-emerald-700"
                        }`}
                      >
                        {gateTitle}
                      </p>
                      <h3 className="text-xl sm:text-2xl font-bold text-gray-900">
                        Unlock full details + save this scan
                      </h3>
                      <p className="text-gray-600 text-sm">{gateSubtitle}</p>

                      <form
                        onSubmit={handleUnlockSubmit}
                        className="mt-3 flex flex-col gap-2"
                      >
                        <input
                          type="email"
                          value={unlockEmail}
                          onChange={(e) => setUnlockEmail(e.target.value)}
                          placeholder="Email to unlock + save scans"
                          className="w-full px-4 py-3 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#46769B]"
                          required
                        />

                        <div className="flex flex-col sm:flex-row gap-2">
                          <select
                            value={unlockRole}
                            onChange={(e) => setUnlockRole(normalizeRole(e.target.value))}
                            className="w-full sm:w-48 px-3 py-3 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#46769B]"
                          >
                            <option value="Athlete">Athlete</option>
                            <option value="Organization">Organization</option>
                          </select>

                          <input
                            type="text"
                            value={unlockOrgToken}
                            onChange={(e) => setUnlockOrgToken(e.target.value)}
                            placeholder="Team / Organization Token (optional)"
                            className="w-full px-4 py-3 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#46769B]"
                          />
                        </div>

                        <button
                          type="submit"
                          disabled={unlockLoading}
                          className={`w-full px-4 py-3 rounded-xl bg-[#46769B] text-white font-semibold text-sm shadow-sm hover:brightness-110 transition ${
                            unlockLoading ? "opacity-70 cursor-not-allowed" : ""
                          }`}
                        >
                          {unlockLoading ? "Unlocking..." : "Unlock Details"}
                        </button>

                        {unlockError && (
                          <p className="text-xs text-red-500">{unlockError}</p>
                        )}
                        {unlockSuccess && (
                          <p className="text-xs text-emerald-600">
                            Unlocked. Finish setup to save scans.
                          </p>
                        )}

                        <p className="text-[10px] text-gray-500 mt-1">
                          No spam. Used only for scan history + updates.
                        </p>
                      </form>
                    </div>
                  </div>
                </div>
              )}
            </section>
          </>
        )}

        {activeTab === "Search" && (
          <section className="w-full bg-white p-4 sm:p-6 rounded-2xl shadow-md mx-auto border border-blue-100 mt-4">
            <p className="text-gray-500 italic text-center text-sm sm:text-base">
              Search functionality coming soon.
            </p>
          </section>
        )}
      </main>
    </div>
  );
}
