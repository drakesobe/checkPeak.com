"use client";

import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";

function classNames(...xs) {
  return xs.filter(Boolean).join(" ");
}

/**
 * ActionsSection
 *
 * Props:
 * - canSave: boolean
 * - saving: boolean
 * - onSaveAll: () => Promise<void>   // NEW: saves profile + billing
 * - onOpenPassword: () => void
 * - onLogout: () => void
 * - saveLabel?: string              // NEW: dynamic label (e.g. "Save Profile + Billing")
 * - message?: string
 * - error?: string
 */
export default function ActionsSection({
  canSave,
  saving,
  onSaveAll,
  onOpenPassword,
  onLogout,
  saveLabel = "Save Changes",
  message = "",
  error = "",
}) {
  return (
    <div className="mt-6 space-y-4">
      <AnimatePresence>
        {(message || error) && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className={classNames(
              "text-center text-sm font-medium py-3 px-4 rounded-2xl border",
              message
                ? "bg-emerald-50 text-emerald-800 border-emerald-100"
                : "bg-red-50 text-red-700 border-red-100"
            )}
          >
            {message || error}
          </motion.div>
        )}
      </AnimatePresence>

      <button
        type="button"
        onClick={onSaveAll}
        disabled={!canSave}
        className={classNames(
          "w-full py-3 rounded-2xl text-white font-semibold shadow-md transition",
          canSave
            ? "bg-[#46769B] hover:brightness-110"
            : "bg-gray-200 text-gray-500 cursor-not-allowed shadow-none"
        )}
      >
        {saving ? "Saving..." : saveLabel}
      </button>

      <button
        type="button"
        onClick={onOpenPassword}
        className="w-full py-3 rounded-2xl bg-blue-50 border border-blue-100 text-[#46769B] font-semibold hover:bg-blue-100 transition"
      >
        Change Password
      </button>

      <button
        type="button"
        onClick={onLogout}
        className="w-full py-3 rounded-2xl bg-red-50 border border-red-100 text-red-700 font-semibold hover:bg-red-100 transition"
      >
        Log Out
      </button>

      <div className="flex items-center justify-between text-xs pt-1">
        <Link href="/" className="text-gray-500 hover:underline">
          Back to home
        </Link>
        <Link href="/forgot-password" className="text-[#46769B] font-semibold hover:underline">
          Forgot password?
        </Link>
      </div>
    </div>
  );
}
