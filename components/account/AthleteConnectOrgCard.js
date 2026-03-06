// components/account/AthleteConnectOrgCard.jsx
"use client";

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

export default function AthleteConnectOrgCard({
  orgCode,
  setOrgCode,
  orgConnectLoading,
  orgConnectError,
  orgConnectOk,
  onConnectOrganization,
}) {
  const canSubmit = !orgConnectLoading && String(orgCode || "").trim().length > 0;

  return (
    <div
      className="p-5"
      style={{
        backgroundColor: DS.brandBg,
        border: `1px solid ${DS.brandBorder}`,
        borderLeft: `4px solid ${DS.brand}`,
      }}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <p
            className="text-xs font-black uppercase tracking-wider mb-1"
            style={{ color: DS.brand }}
          >
            Connect to an organization
          </p>
          <p className="text-xs leading-relaxed" style={{ color: DS.labelText }}>
            Enter the code provided by your coach. We'll verify it and link your account.
          </p>
        </div>
        <span
          className="shrink-0 inline-flex items-center px-2.5 py-1 text-xs font-bold uppercase tracking-wide rounded-sm"
          style={{
            backgroundColor: DS.brand,
            color: "#fff",
          }}
        >
          Verified
        </span>
      </div>

      {/* Input + button */}
      <div className="flex flex-col sm:flex-row gap-2 mb-3">
        <input
          type="text"
          value={orgCode}
          onChange={(e) => setOrgCode(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && canSubmit) onConnectOrganization(); }}
          placeholder="Organization code"
          className="flex-1 text-sm px-3 py-2.5 outline-none transition-all"
          style={{
            border: `1px solid ${DS.brandBorder}`,
            backgroundColor: "#fff",
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
          onClick={onConnectOrganization}
          disabled={!canSubmit}
          className="px-5 py-2.5 text-sm font-bold uppercase tracking-wide transition-all rounded-sm"
          style={
            canSubmit
              ? { backgroundColor: DS.brand, color: "#fff" }
              : { backgroundColor: DS.border, color: DS.dimText, cursor: "not-allowed" }
          }
          onMouseEnter={(e) => { if (canSubmit) e.currentTarget.style.filter = "brightness(1.12)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.filter = "none"; }}
        >
          {orgConnectLoading ? "Verifying…" : "Connect"}
        </button>
      </div>

      {/* Feedback */}
      <AnimatePresence>
        {orgConnectError && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="px-3 py-2 text-xs font-medium mb-3"
            style={{
              backgroundColor: DS.bannedBg,
              borderLeft: `3px solid ${DS.banned}`,
              color: "#7A1A1A",
            }}
          >
            {orgConnectError}
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {orgConnectOk && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="px-3 py-2 text-xs font-medium mb-3"
            style={{
              backgroundColor: "#F0FBF4",
              borderLeft: "3px solid #00873E",
              color: "#1A5C33",
            }}
          >
            {orgConnectOk}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Why this matters */}
      <div
        className="px-4 py-3 mt-1"
        style={{
          backgroundColor: "#fff",
          border: `1px solid ${DS.border}`,
        }}
      >
        <p
          className="text-xs font-black uppercase tracking-wider mb-2"
          style={{ color: DS.labelText }}
        >
          Why this matters
        </p>
        <ul className="space-y-1">
          {[
            "Prevents athletes from selecting any organization freely.",
            "Membership is verified by a code shared by your coach.",
            "Your account always displays the verified organization.",
          ].map((item) => (
            <li key={item} className="flex items-start gap-2">
              <span
                className="mt-1.5 w-1 h-1 rounded-full shrink-0"
                style={{ backgroundColor: DS.brand }}
              />
              <span className="text-xs leading-relaxed" style={{ color: DS.labelText }}>
                {item}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}