// components/account/DeleteAccountModal.js
// Confirmation modal for permanent account deletion.
// User must type "DELETE" and enter their password before the button activates.
// On success: logs out and redirects to /?deleted=1

import { useState } from "react";
import { useRouter } from "next/router";
import { useAuthContext } from "@/hooks/useAuth";
import { motion, AnimatePresence } from "framer-motion";

const DS = {
  brand:        "#1E3A5F",
  brandBg:      "#EEF3F9",
  brandBorder:  "#C0D0E0",
  banned:       "#C8102E",
  bannedBg:     "#FFF0F0",
  bannedBorder: "#FFC8C8",
  border:       "#E8ECF0",
  bodyText:     "#2D3748",
  labelText:    "#6B7A8D",
  dimText:      "#9BA8B4",
  readOnlyBg:   "#F7F9FC",
};

function FieldLabel({ children }) {
  return (
    <label
      className="block text-xs font-black uppercase tracking-wider mb-1.5"
      style={{ color: DS.labelText }}
    >
      {children}
    </label>
  );
}

function DangerInput({ value, onChange, placeholder, type = "text", autoComplete, disabled, active }) {
  return (
    <input
      type={type}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      autoComplete={autoComplete}
      disabled={disabled}
      className="w-full text-sm px-3 py-2.5 transition-all outline-none"
      style={{
        border: `1px solid ${active ? DS.bannedBorder : DS.brandBorder}`,
        backgroundColor: disabled ? DS.readOnlyBg : DS.brandBg,
        color: DS.bodyText,
        cursor: disabled ? "not-allowed" : "text",
      }}
      onFocus={(e) => {
        e.currentTarget.style.borderColor = DS.banned;
        e.currentTarget.style.boxShadow = `0 0 0 3px ${DS.banned}18`;
      }}
      onBlur={(e) => {
        e.currentTarget.style.borderColor = active ? DS.bannedBorder : DS.brandBorder;
        e.currentTarget.style.boxShadow = "none";
      }}
    />
  );
}

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

      await logout?.();
      router.push("/?deleted=1");
    } catch (e) {
      setError(e?.message || "Failed to delete account. Please try again.");
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-50 flex items-center justify-center px-4"
          style={{ backgroundColor: "rgba(0,0,0,0.55)" }}
          onClick={handleClose}
        >
          <motion.div
            initial={{ opacity: 0, y: 14, scale: 0.98 }}
            animate={{ opacity: 1, y: 0,  scale: 1 }}
            exit={{ opacity: 0,    y: 14, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 420, damping: 32 }}
            className="bg-white w-full max-w-md relative"
            style={{
              border: `1px solid ${DS.border}`,
              borderTop: `4px solid ${DS.banned}`,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div
              className="flex items-start justify-between gap-4 px-6 py-5"
              style={{ borderBottom: `1px solid ${DS.border}` }}
            >
              <div>
                <p
                  className="text-xs font-black uppercase tracking-wider mb-1"
                  style={{ color: DS.banned }}
                >
                  Danger Zone
                </p>
                <h2
                  className="text-base font-black uppercase"
                  style={{
                    fontFamily: "'Barlow Condensed', sans-serif",
                    color: DS.bodyText,
                    letterSpacing: "0.04em",
                  }}
                >
                  Delete Account
                </h2>
                <p className="text-xs mt-1 leading-relaxed" style={{ color: DS.labelText }}>
                  Permanent and cannot be undone. Your account and all associated data will be deleted within 30 days.
                </p>
              </div>
              <button
                onClick={handleClose}
                type="button"
                aria-label="Close"
                className="shrink-0 flex items-center justify-center w-8 h-8 transition-colors"
                style={{
                  border: `1px solid ${DS.border}`,
                  color: DS.labelText,
                }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = DS.brandBg; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; }}
              >
                ✕
              </button>
            </div>

            {/* Body */}
            <div className="px-6 py-5 space-y-4">

              <AnimatePresence>
                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    className="px-4 py-3 text-sm font-medium"
                    style={{
                      backgroundColor: DS.bannedBg,
                      borderLeft: `4px solid ${DS.banned}`,
                      color: "#7A1A1A",
                    }}
                  >
                    {error}
                  </motion.div>
                )}
              </AnimatePresence>

              <div>
                <FieldLabel>Type DELETE to confirm</FieldLabel>
                <DangerInput
                  type="text"
                  value={confirm}
                  onChange={(e) => { setConfirm(e.target.value.toUpperCase()); setError(""); }}
                  placeholder="DELETE"
                  autoComplete="off"
                  disabled={loading}
                  active={confirm === "DELETE"}
                />
              </div>

              <div>
                <FieldLabel>Enter your password</FieldLabel>
                <DangerInput
                  type="password"
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setError(""); }}
                  placeholder="Your current password"
                  autoComplete="current-password"
                  disabled={loading}
                  active={false}
                />
              </div>
            </div>

            {/* Footer */}
            <div
              className="flex items-center justify-between gap-3 px-6 py-4"
              style={{ borderTop: `1px solid ${DS.border}` }}
            >
              <a
                href="mailto:support@checkpeak.com"
                className="text-xs font-bold hover:underline"
                style={{ color: DS.labelText }}
              >
                Need help? Contact support
              </a>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleClose}
                  disabled={loading}
                  className="px-4 py-2 text-sm font-bold transition-all"
                  style={{
                    color: DS.labelText,
                    border: `1px solid ${DS.border}`,
                    cursor: loading ? "not-allowed" : "pointer",
                  }}
                  onMouseEnter={(e) => { if (!loading) e.currentTarget.style.backgroundColor = DS.brandBg; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; }}
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={!canSubmit}
                  className="px-4 py-2 text-sm font-bold transition-all flex items-center gap-1.5"
                  style={
                    !canSubmit
                      ? { backgroundColor: DS.border, color: DS.dimText, cursor: "not-allowed" }
                      : { backgroundColor: DS.banned, color: "#fff", cursor: "pointer" }
                  }
                  onMouseEnter={(e) => { if (canSubmit) e.currentTarget.style.filter = "brightness(1.1)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.filter = "none"; }}
                >
                  {loading ? (
                    <>
                      <svg
                        style={{ animation: "spin 1s linear infinite" }}
                        width="13" height="13" viewBox="0 0 24 24" fill="none"
                        aria-hidden="true"
                      >
                        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.3" />
                        <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                      </svg>
                      Deleting…
                    </>
                  ) : "Delete Account"}
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </AnimatePresence>
  );
}
