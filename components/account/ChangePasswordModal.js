// components/account/ChangePasswordModal.jsx
"use client";

import { useState } from "react";
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
};

// Strength color progresses light→strong
const STRENGTH_COLORS = ["#E8ECF0", "#E87722", "#E8C022", "#4A7FA5", "#1E3A5F"];

function StrengthBar({ score }) {
  return (
    <div className="mt-2">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs" style={{ color: DS.labelText }}>Strength</span>
        <span className="text-xs font-bold" style={{ color: DS.bodyText }}>
          {["", "Weak", "Okay", "Good", "Strong", "Very strong"][score] || ""}
        </span>
      </div>
      <div
        className="h-1.5 w-full overflow-hidden"
        style={{ backgroundColor: DS.border }}
      >
        <div
          className="h-full transition-all duration-300"
          style={{
            width: `${(score / 5) * 100}%`,
            backgroundColor: STRENGTH_COLORS[Math.max(0, score - 1)] || DS.border,
          }}
        />
      </div>
      <p className="mt-1.5 text-xs" style={{ color: DS.dimText }}>
        Use 12+ characters with letters, numbers, and symbols.
      </p>
    </div>
  );
}

function PasswordField({ label, value, onChange, placeholder, autoComplete }) {
  const [show, setShow] = useState(false);
  return (
    <div>
      <label
        className="block text-sm font-bold mb-1.5"
        style={{ color: DS.bodyText }}
      >
        {label}
      </label>
      <div className="relative">
        <input
          type={show ? "text" : "password"}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          className="w-full text-sm px-3 py-2.5 pr-16 transition-all outline-none"
          style={{
            border: `1px solid ${DS.brandBorder}`,
            backgroundColor: DS.brandBg,
            color: DS.bodyText,
          }}
          onFocus={(e) => {
            e.currentTarget.style.borderColor = DS.brand;
            e.currentTarget.style.boxShadow = `0 0 0 3px ${DS.brand}18`;
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = DS.brandBorder;
            e.currentTarget.style.boxShadow = "none";
          }}
        />
        <button
          type="button"
          onClick={() => setShow((v) => !v)}
          className="absolute inset-y-0 right-3 text-xs font-bold transition-colors"
          style={{ color: DS.labelText }}
          onMouseEnter={(e) => (e.currentTarget.style.color = DS.brand)}
          onMouseLeave={(e) => (e.currentTarget.style.color = DS.labelText)}
        >
          {show ? "Hide" : "Show"}
        </button>
      </div>
    </div>
  );
}

export default function ChangePasswordModal({
  open,
  onClose,
  inputBase, // accepted but unused - styling is self-contained
  passwordData,
  onField,
  pwScore,
  pwLabel,
  saving,
  error,
  message,
  onSave,
}) {
  const confirmMismatch =
    passwordData.confirmPassword.length > 0 &&
    passwordData.newPassword !== passwordData.confirmPassword;

  const confirmMatch =
    passwordData.confirmPassword.length > 0 &&
    passwordData.newPassword === passwordData.confirmPassword &&
    passwordData.newPassword.length >= 8;

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
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, y: 14, scale: 0.98 }}
            animate={{ opacity: 1, y: 0,  scale: 1 }}
            exit={{ opacity: 0,    y: 14, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 420, damping: 32 }}
            className="bg-white w-full max-w-md relative"
            style={{
              border: `1px solid ${DS.border}`,
              borderTop: `4px solid ${DS.brand}`,
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
                  style={{ color: DS.brand }}
                >
                  Security
                </p>
                <h2
                  className="text-base font-black uppercase"
                  style={{
                    fontFamily: "'Barlow Condensed', sans-serif",
                    color: DS.bodyText,
                    letterSpacing: "0.04em",
                  }}
                >
                  Change Password
                </h2>
                <p className="text-xs mt-1" style={{ color: DS.labelText }}>
                  Use a strong password you don't reuse elsewhere.
                </p>
              </div>
              <button
                onClick={onClose}
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

              {/* Inline feedback */}
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

              <AnimatePresence>
                {message && (
                  <motion.div
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    className="px-4 py-3 text-sm font-medium"
                    style={{
                      backgroundColor: "#F0FBF4",
                      borderLeft: "4px solid #00873E",
                      color: "#1A5C33",
                    }}
                  >
                    {message}
                  </motion.div>
                )}
              </AnimatePresence>

              <PasswordField
                label="Current password"
                value={passwordData.currentPassword}
                onChange={(v) => onField("currentPassword", v)}
                placeholder="Enter current password"
                autoComplete="current-password"
              />

              <div>
                <PasswordField
                  label="New password"
                  value={passwordData.newPassword}
                  onChange={(v) => onField("newPassword", v)}
                  placeholder="At least 8 characters"
                  autoComplete="new-password"
                />
                <StrengthBar score={pwScore} />
              </div>

              <div>
                <PasswordField
                  label="Confirm new password"
                  value={passwordData.confirmPassword}
                  onChange={(v) => onField("confirmPassword", v)}
                  placeholder="Re-enter new password"
                  autoComplete="new-password"
                />
                {confirmMismatch && (
                  <p className="mt-1.5 text-xs font-semibold" style={{ color: DS.banned }}>
                    Passwords don't match yet.
                  </p>
                )}
                {confirmMatch && (
                  <p className="mt-1.5 text-xs font-semibold" style={{ color: "#00873E" }}>
                    Passwords match ✓
                  </p>
                )}
              </div>
            </div>

            {/* Footer */}
            <div
              className="flex items-center justify-between gap-3 px-6 py-4"
              style={{ borderTop: `1px solid ${DS.border}` }}
            >
              {/* Forgot password - relevant here since user is trying to set one */}
              <a
                href="/forgot-password"
                className="text-xs font-bold hover:underline"
                style={{ color: DS.labelText }}
              >
                Forgot password?
              </a>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-sm font-bold transition-all"
                  style={{
                    color: DS.labelText,
                    border: `1px solid ${DS.border}`,
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = DS.brandBg; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={onSave}
                  disabled={saving}
                  className="px-4 py-2 text-sm font-bold transition-all"
                  style={
                    saving
                      ? { backgroundColor: DS.border, color: DS.dimText, cursor: "not-allowed" }
                      : { backgroundColor: DS.brand, color: "#fff" }
                  }
                  onMouseEnter={(e) => { if (!saving) e.currentTarget.style.filter = "brightness(1.12)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.filter = "none"; }}
                >
                  {saving ? "Saving…" : "Update Password"}
                </button>
              </div>
            </div>

          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}