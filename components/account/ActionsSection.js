// components/account/ActionsSection.jsx
"use client";

// No local feedback banner here - feedback is handled by FeedbackBanner in account.js.
// message/error props are accepted but ignored to avoid a breaking change if callers
// still pass them; display is intentionally delegated upward.

const DS = {
  brand:       "#1E3A5F",
  brandBg:     "#EEF3F9",
  brandBorder: "#C0D0E0",
  banned:      "#C8102E",
  bannedBg:    "#FFF0F0",
  bannedBorder:"#FFC8C8",
  border:      "#E8ECF0",
  labelText:   "#6B7A8D",
  dimText:     "#9BA8B4",
};

/**
 * ActionsSection
 *
 * Props:
 * - canSave        boolean
 * - saving         boolean
 * - onSaveAll      () => Promise<void>
 * - onOpenPassword () => void
 * - onLogout       () => void
 * - saveLabel?     string   e.g. "Save Profile + Billing"
 * - message?       string   (accepted but not displayed - see FeedbackBanner)
 * - error?         string   (accepted but not displayed - see FeedbackBanner)
 */
export default function ActionsSection({
  canSave,
  saving,
  onSaveAll,
  onOpenPassword,
  onLogout,
  saveLabel = "Save Changes",
}) {
  return (
    <div className="mt-2 space-y-3">

      {/* ── Primary: Save ──────────────────────────────────────────── */}
      <button
        type="button"
        onClick={onSaveAll}
        disabled={!canSave || saving}
        style={
          canSave && !saving
            ? { backgroundColor: DS.brand, color: "#fff", border: `1px solid ${DS.brand}` }
            : { backgroundColor: DS.border, color: DS.dimText, border: `1px solid ${DS.border}`, cursor: "not-allowed" }
        }
        className="w-full py-3 text-sm font-bold transition-all rounded-sm"
        onMouseEnter={(e) => { if (canSave && !saving) e.currentTarget.style.filter = "brightness(1.12)"; }}
        onMouseLeave={(e) => { e.currentTarget.style.filter = "none"; }}
      >
        {saving ? "Saving…" : saveLabel}
      </button>

      {/* ── Secondary: Change Password ─────────────────────────────── */}
      <button
        type="button"
        onClick={onOpenPassword}
        style={{
          backgroundColor: DS.brandBg,
          color: DS.brand,
          border: `1px solid ${DS.brandBorder}`,
        }}
        className="w-full py-2.5 text-sm font-bold transition-all rounded-sm"
        onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "#D8E6F3"; }}
        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = DS.brandBg; }}
      >
        Change Password
      </button>

      {/* ── Divider - separates navigation from form actions ──────── */}
      <div
        className="flex items-center gap-3 py-1"
        style={{ borderTop: `1px solid ${DS.border}`, paddingTop: "0.75rem", marginTop: "0.25rem" }}
      >
        <span className="flex-1" style={{ borderTop: `1px solid ${DS.border}` }} />
      </div>

      {/* ── Destructive: Log Out ────────────────────────────────────── */}
      <button
        type="button"
        onClick={onLogout}
        style={{
          backgroundColor: "transparent",
          color: DS.banned,
          border: `1px solid ${DS.bannedBorder}`,
        }}
        className="w-full py-2.5 text-sm font-bold transition-all rounded-sm"
        onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = DS.bannedBg; }}
        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; }}
      >
        Log Out
      </button>

    </div>
  );
}