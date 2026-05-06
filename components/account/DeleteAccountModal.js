// components/account/DeleteAccountModal.js
// Confirmation modal for permanent account deletion.
// User must type "DELETE" and enter their password before the button activates.
// On success: logs out and redirects to /?deleted=1

import { useState } from "react";
import { useRouter } from "next/router";
import { useAuthContext } from "@/hooks/useAuth";

const BRAND     = "#5B9EC9";
const DANGER    = "#DC2626";
const FONT_BODY = "'Barlow', sans-serif";
const FONT_COND = "'Barlow Condensed', sans-serif";

const INPUT_BASE = {
  width:        "100%",
  padding:      "10px 12px",
  border:       "1px solid rgba(0,0,0,0.12)",
  borderRadius: "10px",
  background:   "#F8F9FA",
  color:        "#0A0C10",
  fontSize:     "14px",
  fontFamily:   FONT_BODY,
  outline:      "none",
  transition:   "border-color 0.15s, box-shadow 0.15s, background 0.15s",
};

const LABEL_STYLE = {
  fontSize:      "10px",
  fontWeight:    800,
  letterSpacing: "0.1em",
  textTransform: "uppercase",
  color:         "rgba(0,0,0,0.45)",
  fontFamily:    FONT_COND,
  display:       "block",
  marginBottom:  "6px",
};

export default function DeleteAccountModal({ open, onClose, athleteId }) {
  const router = useRouter();
  const { logout } = useAuthContext();

  const [confirm,  setConfirm]  = useState("");
  const [password, setPassword] = useState("");
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState("");

  const canSubmit = confirm === "DELETE" && password.length >= 6 && !loading;

  const reset = () => {
    setConfirm("");
    setPassword("");
    setError("");
    setLoading(false);
  };

  const handleClose = () => {
    reset();
    onClose?.();
  };

  const handleDelete = async () => {
    if (!canSubmit) return;
    setError("");
    setLoading(true);
    try {
      const res  = await fetch("/api/delete-account", {
        method:      "POST",
        headers:     { "Content-Type": "application/json" },
        credentials: "include",
        body:        JSON.stringify({ athleteId, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Failed to delete account.");

      // Sign out then redirect
      await logout?.();
      router.push("/?deleted=1");
    } catch (e) {
      setError(e?.message || "Failed to delete account. Please try again.");
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <div
      style={{
        position:        "fixed",
        inset:           0,
        zIndex:          50,
        display:         "flex",
        alignItems:      "center",
        justifyContent:  "center",
        padding:         "16px",
        background:      "rgba(10,12,16,0.6)",
        backdropFilter:  "blur(8px)",
        fontFamily:      FONT_BODY,
      }}
    >
      <div
        style={{
          width:        "100%",
          maxWidth:     "420px",
          background:   "#fff",
          borderRadius: "20px",
          boxShadow:    "0 24px 60px rgba(0,0,0,0.25), 0 4px 16px rgba(0,0,0,0.08)",
          overflow:     "hidden",
        }}
      >
        {/* ── Header ── */}
        <div
          style={{
            background:   "rgba(220,38,38,0.05)",
            borderBottom: "1px solid rgba(220,38,38,0.12)",
            padding:      "20px 24px 16px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "8px" }}>
            {/* Warning icon */}
            <div style={{
              width: "36px", height: "36px", borderRadius: "50%",
              background: "rgba(220,38,38,0.1)", border: "1px solid rgba(220,38,38,0.2)",
              display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
            }}>
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none"
                stroke={DANGER} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                <line x1="12" y1="9"  x2="12"   y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
            </div>
            <h2 style={{
              margin: 0, fontSize: "20px", fontWeight: 900,
              color: "#0A0C10", fontFamily: FONT_COND, letterSpacing: "0.01em",
            }}>
              Delete Account
            </h2>
          </div>
          <p style={{ margin: 0, fontSize: "13px", color: "rgba(0,0,0,0.55)", lineHeight: 1.6 }}>
            This is permanent and cannot be undone. Your account, scan history, and all
            associated data will be deleted within 30 days.
          </p>
        </div>

        {/* ── Body ── */}
        <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: "16px" }}>

          {/* Error banner */}
          {!!error && (
            <div style={{
              background:   "rgba(220,38,38,0.06)",
              border:       "1px solid rgba(220,38,38,0.2)",
              borderRadius: "10px",
              padding:      "10px 14px",
              fontSize:     "13px",
              color:        DANGER,
              lineHeight:   1.5,
            }}>
              {error}
            </div>
          )}

          {/* Type DELETE */}
          <div>
            <label style={LABEL_STYLE}>Type DELETE to confirm</label>
            <input
              type="text"
              value={confirm}
              onChange={e => { setConfirm(e.target.value.toUpperCase()); setError(""); }}
              placeholder="DELETE"
              autoComplete="off"
              disabled={loading}
              style={{
                ...INPUT_BASE,
                borderColor: confirm === "DELETE" ? "rgba(220,38,38,0.4)" : "rgba(0,0,0,0.12)",
              }}
              onFocus={e => {
                e.currentTarget.style.boxShadow  = "0 0 0 3px rgba(220,38,38,0.1)";
                e.currentTarget.style.background = "#fff";
              }}
              onBlur={e => {
                e.currentTarget.style.boxShadow  = "none";
                e.currentTarget.style.background = "#F8F9FA";
              }}
            />
          </div>

          {/* Password */}
          <div>
            <label style={LABEL_STYLE}>Enter your password</label>
            <input
              type="password"
              value={password}
              onChange={e => { setPassword(e.target.value); setError(""); }}
              placeholder="Your current password"
              autoComplete="current-password"
              disabled={loading}
              style={INPUT_BASE}
              onFocus={e => {
                e.currentTarget.style.boxShadow  = "0 0 0 3px rgba(220,38,38,0.1)";
                e.currentTarget.style.background = "#fff";
              }}
              onBlur={e => {
                e.currentTarget.style.boxShadow  = "none";
                e.currentTarget.style.background = "#F8F9FA";
              }}
            />
          </div>

          {/* Action buttons */}
          <div style={{ display: "flex", gap: "10px", marginTop: "4px" }}>
            <button
              type="button"
              onClick={handleClose}
              disabled={loading}
              style={{
                flex:         1,
                padding:      "11px",
                borderRadius: "12px",
                border:       "1px solid rgba(0,0,0,0.12)",
                background:   "transparent",
                color:        "rgba(0,0,0,0.6)",
                fontSize:     "14px",
                fontWeight:   600,
                cursor:       loading ? "not-allowed" : "pointer",
                fontFamily:   FONT_BODY,
                transition:   "background 0.15s",
              }}
              onMouseEnter={e => { if (!loading) e.currentTarget.style.background = "#F1F5F9"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={handleDelete}
              disabled={!canSubmit}
              style={{
                flex:           1,
                padding:        "11px",
                borderRadius:   "12px",
                border:         "none",
                background:     canSubmit ? DANGER : "rgba(220,38,38,0.25)",
                color:          "#fff",
                fontSize:       "14px",
                fontWeight:     800,
                cursor:         canSubmit ? "pointer" : "not-allowed",
                fontFamily:     FONT_COND,
                letterSpacing:  "0.04em",
                display:        "flex",
                alignItems:     "center",
                justifyContent: "center",
                gap:            "6px",
                transition:     "background 0.15s",
              }}
              onMouseEnter={e => { if (canSubmit) e.currentTarget.style.background = "#B91C1C"; }}
              onMouseLeave={e => { if (canSubmit) e.currentTarget.style.background = DANGER; }}
            >
              {loading ? (
                <>
                  <svg
                    style={{ animation: "spin 1s linear infinite" }}
                    width="14" height="14" viewBox="0 0 24 24" fill="none"
                    aria-hidden="true"
                  >
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.25" />
                    <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                  </svg>
                  Deleting…
                </>
              ) : "Delete Account"}
            </button>
          </div>

          {/* Support link */}
          <p style={{
            margin: 0, fontSize: "11px", color: "rgba(0,0,0,0.35)",
            textAlign: "center", lineHeight: 1.6,
          }}>
            Need help instead?{" "}
            <a
              href="mailto:support@checkpeak.com"
              style={{ color: BRAND, fontWeight: 600, textDecoration: "none" }}
              onMouseEnter={e => { e.currentTarget.style.textDecoration = "underline"; }}
              onMouseLeave={e => { e.currentTarget.style.textDecoration = "none"; }}
            >
              Contact support
            </a>
          </p>
        </div>
      </div>

      {/* Spin keyframe - injected once */}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}