"use client";

import Link from "next/link";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

function classNames(...xs) {
  return xs.filter(Boolean).join(" ");
}

export default function ChangePasswordModal({
  open,
  onClose,
  inputBase,
  passwordData,
  onField,
  pwScore,
  pwLabel,
  saving,
  error,
  message,
  onSave,
}) {
  const [showPw1, setShowPw1] = useState(false);
  const [showPw2, setShowPw2] = useState(false);
  const [showPw3, setShowPw3] = useState(false);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 420, damping: 32 }}
            className="bg-white rounded-3xl p-6 w-full max-w-md relative border border-blue-100 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold tracking-wide text-[#46769B]">SECURITY</p>
                <h2 className="text-lg font-extrabold text-gray-900 mt-1">Change Password</h2>
                <p className="text-[12px] text-gray-600 mt-1">Use a strong password you don’t reuse elsewhere.</p>
              </div>

              <button
                onClick={onClose}
                className="h-9 w-9 rounded-2xl border border-gray-200 grid place-items-center text-gray-600 hover:bg-gray-50 transition"
                aria-label="Close"
                type="button"
              >
                ✕
              </button>
            </div>

            <div className="mt-4 space-y-3">
              <AnimatePresence>
                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    className="p-3 rounded-2xl bg-red-50 border border-red-100 text-red-700 text-sm"
                  >
                    {error}
                  </motion.div>
                )}
              </AnimatePresence>

              <AnimatePresence>
                {message && (
                  <motion.div
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    className="p-3 rounded-2xl bg-emerald-50 border border-emerald-100 text-emerald-800 text-sm"
                  >
                    {message}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Current password */}
              <div>
                <label className="block text-gray-800 font-medium mb-1">Current password</label>
                <div className="relative">
                  <input
                    type={showPw1 ? "text" : "password"}
                    placeholder="Enter current password"
                    value={passwordData.currentPassword}
                    onChange={(e) => onField("currentPassword", e.target.value)}
                    className={`${inputBase} pr-14`}
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw1((v) => !v)}
                    className="absolute inset-y-0 right-3 text-sm font-semibold text-gray-500 hover:text-gray-700"
                  >
                    {showPw1 ? "Hide" : "Show"}
                  </button>
                </div>
              </div>

              {/* New password */}
              <div>
                <label className="block text-gray-800 font-medium mb-1">New password</label>
                <div className="relative">
                  <input
                    type={showPw2 ? "text" : "password"}
                    placeholder="At least 8 characters"
                    value={passwordData.newPassword}
                    onChange={(e) => onField("newPassword", e.target.value)}
                    className={`${inputBase} pr-14`}
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw2((v) => !v)}
                    className="absolute inset-y-0 right-3 text-sm font-semibold text-gray-500 hover:text-gray-700"
                  >
                    {showPw2 ? "Hide" : "Show"}
                  </button>
                </div>

                <div className="mt-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-500">Strength</span>
                    <span className="font-semibold text-gray-700">{pwLabel}</span>
                  </div>
                  <div className="mt-1 h-2 rounded-full bg-gray-100 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-[#46769B] transition-all"
                      style={{ width: `${(pwScore / 5) * 100}%` }}
                    />
                  </div>
                  <p className="mt-2 text-[11px] text-gray-500">Tip: Use 12+ characters and mix letters, numbers, and symbols.</p>
                </div>
              </div>

              {/* Confirm password */}
              <div>
                <label className="block text-gray-800 font-medium mb-1">Confirm new password</label>
                <div className="relative">
                  <input
                    type={showPw3 ? "text" : "password"}
                    placeholder="Re-enter new password"
                    value={passwordData.confirmPassword}
                    onChange={(e) => onField("confirmPassword", e.target.value)}
                    className={`${inputBase} pr-14`}
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw3((v) => !v)}
                    className="absolute inset-y-0 right-3 text-sm font-semibold text-gray-500 hover:text-gray-700"
                  >
                    {showPw3 ? "Hide" : "Show"}
                  </button>
                </div>

                {passwordData.confirmPassword.length > 0 && passwordData.newPassword !== passwordData.confirmPassword ? (
                  <p className="mt-2 text-xs text-red-600">Passwords don’t match yet.</p>
                ) : null}

                {passwordData.confirmPassword.length > 0 &&
                passwordData.newPassword === passwordData.confirmPassword &&
                passwordData.newPassword.length >= 8 ? (
                  <p className="mt-2 text-xs text-emerald-700">Passwords match ✅</p>
                ) : null}
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end gap-2">
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-2xl bg-gray-100 text-gray-700 font-semibold hover:bg-gray-200 transition"
                type="button"
              >
                Cancel
              </button>
              <button
                onClick={onSave}
                disabled={saving}
                className={classNames(
                  "px-4 py-2 rounded-2xl text-white font-semibold shadow-sm transition",
                  saving ? "bg-gray-300 cursor-not-allowed" : "bg-[#46769B] hover:brightness-110"
                )}
                type="button"
              >
                {saving ? "Saving..." : "Save"}
              </button>
            </div>

            <div className="mt-4 flex items-center justify-between text-xs">
              <Link href="/" className="text-gray-500 hover:underline" onClick={onClose}>
                Back to home
              </Link>
              <Link href="/forgot-password" className="text-[#46769B] font-semibold hover:underline" onClick={onClose}>
                Forgot password?
              </Link>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
