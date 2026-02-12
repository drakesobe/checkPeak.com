"use client";

import { motion, AnimatePresence } from "framer-motion";

function classNames(...xs) {
  return xs.filter(Boolean).join(" ");
}

export default function AthleteConnectOrgCard({
  orgCode,
  setOrgCode,
  orgConnectLoading,
  orgConnectError,
  orgConnectOk,
  onConnectOrganization,
}) {
  const inputBase =
    "w-full border border-gray-200 rounded-2xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-[#46769B]/30 transition text-gray-900 placeholder:text-gray-400";
  const pill = "inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold";

  return (
    <div className="rounded-3xl border border-gray-200 bg-white p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-gray-900">Connect to an organization</p>
          <p className="text-[12px] text-gray-500 mt-1">
            Enter the organization code provided by your coach/team. We’ll verify it and connect your account.
          </p>
        </div>
        <span className={classNames(pill, "bg-blue-50 text-[#46769B] text-[11px]")}>Verified by code</span>
      </div>

      <div className="mt-4 flex flex-col sm:flex-row gap-2">
        <input
          type="text"
          value={orgCode}
          onChange={(e) => setOrgCode(e.target.value)}
          placeholder="Organization code"
          className={inputBase}
        />
        <button
          type="button"
          onClick={onConnectOrganization}
          disabled={orgConnectLoading || !orgCode.trim()}
          className={classNames(
            "px-5 py-2 rounded-2xl font-semibold shadow-sm transition",
            orgConnectLoading || !orgCode.trim()
              ? "bg-gray-200 text-gray-500 cursor-not-allowed"
              : "bg-[#46769B] text-white hover:brightness-110"
          )}
        >
          {orgConnectLoading ? "Verifying..." : "Verify & Connect"}
        </button>
      </div>

      <AnimatePresence>
        {!!orgConnectError && (
          <motion.p
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="mt-3 text-sm text-red-600"
          >
            {orgConnectError}
          </motion.p>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {!!orgConnectOk && (
          <motion.p
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="mt-3 text-sm text-emerald-700"
          >
            {orgConnectOk}
          </motion.p>
        )}
      </AnimatePresence>

      <div className="mt-4 rounded-2xl bg-gray-50 border border-gray-200 p-4">
        <p className="text-xs font-semibold text-gray-900">Why this matters</p>
        <ul className="mt-2 text-[12px] text-gray-600 list-disc list-inside space-y-1">
          <li>Prevents athletes from selecting any organization.</li>
          <li>Organization membership is verified by a shared code.</li>
          <li>Your account always displays the verified organization.</li>
        </ul>
      </div>
    </div>
  );
}
