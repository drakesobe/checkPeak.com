// components/account/BillingSection.jsx
"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";

// ─── DS tokens ───────────────────────────────────────────────────────────────
const DS = {
  brand:         "#1E3A5F",
  brandBg:       "#EEF3F9",
  brandBorder:   "#C0D0E0",
  banned:        "#C8102E",
  bannedBg:      "#FFF0F0",
  bannedBorder:  "#FFC8C8",
  caution:       "#E87722",
  cautionBg:     "#FFFBF0",
  cautionBorder: "#FFE0A8",
  cautionText:   "#7A4A0A",
  safe:          "#00873E",
  safeBg:        "#F0FBF4",
  safeBorder:    "#A8DFB8",
  border:        "#E8ECF0",
  cardBg:        "#FFFFFF",
  pageBg:        "#F7F9FC",
  bodyText:      "#2D3748",
  labelText:     "#6B7A8D",
  dimText:       "#9BA8B4",
};

// ─── Helpers ─────────────────────────────────────────────────────────────────
async function safeJson(res) {
  try { return await res.json(); } catch { return {}; }
}

function fmtDate(v) {
  if (!v) return "—";
  try {
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) return String(v);
    return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  } catch { return String(v); }
}

function normalizePhone(v) { return String(v || "").trim(); }

function isEmail(v) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v || "")); }

function completionScore(data) {
  const required = [
    "billingName", "billingEmail", "billingAddress1",
    "billingCity", "billingState", "billingPostal",
    "billingCountry", "legalBusinessName",
  ];
  const filled = required.filter((k) => String(data?.[k] || "").trim().length > 0).length;
  return { filled, total: required.length };
}

// ─── Shared input primitives ──────────────────────────────────────────────────
function FieldLabel({ children, required }) {
  return (
    <label
      className="block text-xs font-black uppercase tracking-wider mb-1.5"
      style={{ color: DS.labelText }}
    >
      {children}
      {required && <span style={{ color: DS.banned }}> *</span>}
    </label>
  );
}

function TextInput({ value, onChange, placeholder, disabled, inputMode, type = "text" }) {
  return (
    <input
      type={type}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      disabled={disabled}
      inputMode={inputMode}
      className="w-full text-sm px-3 py-2.5 outline-none transition-all"
      style={{
        border: `1px solid ${DS.brandBorder}`,
        backgroundColor: disabled ? DS.pageBg : DS.brandBg,
        color: disabled ? DS.dimText : DS.bodyText,
        cursor: disabled ? "not-allowed" : "text",
      }}
      onFocus={(e) => {
        if (!disabled) {
          e.currentTarget.style.borderColor = DS.brand;
          e.currentTarget.style.boxShadow = `0 0 0 3px ${DS.brand}18`;
        }
      }}
      onBlur={(e) => {
        e.currentTarget.style.borderColor = DS.brandBorder;
        e.currentTarget.style.boxShadow = "none";
      }}
    />
  );
}

function TextArea({ value, onChange, placeholder, disabled, minHeight = "90px" }) {
  return (
    <textarea
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      disabled={disabled}
      className="w-full text-sm px-3 py-2.5 outline-none transition-all resize-y"
      style={{
        minHeight,
        border: `1px solid ${DS.brandBorder}`,
        backgroundColor: disabled ? DS.pageBg : DS.brandBg,
        color: disabled ? DS.dimText : DS.bodyText,
        cursor: disabled ? "not-allowed" : "text",
      }}
      onFocus={(e) => {
        if (!disabled) {
          e.currentTarget.style.borderColor = DS.brand;
          e.currentTarget.style.boxShadow = `0 0 0 3px ${DS.brand}18`;
        }
      }}
      onBlur={(e) => {
        e.currentTarget.style.borderColor = DS.brandBorder;
        e.currentTarget.style.boxShadow = "none";
      }}
    />
  );
}

function SelectInput({ value, onChange, disabled, children }) {
  return (
    <select
      value={value}
      onChange={onChange}
      disabled={disabled}
      className="w-full text-sm px-3 py-2.5 outline-none transition-all"
      style={{
        border: `1px solid ${DS.brandBorder}`,
        backgroundColor: disabled ? DS.pageBg : DS.brandBg,
        color: disabled ? DS.dimText : DS.bodyText,
        cursor: disabled ? "not-allowed" : "pointer",
      }}
      onFocus={(e) => {
        if (!disabled) e.currentTarget.style.borderColor = DS.brand;
      }}
      onBlur={(e) => {
        e.currentTarget.style.borderColor = DS.brandBorder;
      }}
    >
      {children}
    </select>
  );
}

function ReadOnlyDisplay({ value }) {
  return (
    <div
      className="text-sm px-3 py-2.5 truncate"
      style={{
        border: `1px solid ${DS.border}`,
        backgroundColor: DS.pageBg,
        color: DS.labelText,
      }}
    >
      {value || "—"}
    </div>
  );
}

function CheckboxField({ id, checked, onChange, disabled, label }) {
  return (
    <div className="flex items-center gap-3 mt-2">
      <input
        id={id}
        type="checkbox"
        className="h-4 w-4 accent-current"
        checked={Boolean(checked)}
        onChange={onChange}
        disabled={disabled}
        style={{ accentColor: DS.brand }}
      />
      <label
        htmlFor={id}
        className="text-sm font-bold"
        style={{ color: DS.bodyText }}
      >
        {label}
      </label>
    </div>
  );
}

function FieldHint({ children, error }) {
  return (
    <p className="text-xs mt-1.5" style={{ color: error ? DS.banned : DS.dimText }}>
      {children}
    </p>
  );
}

// ─── Collapsible section ──────────────────────────────────────────────────────
function Section({ title, subtitle, open, onToggle, children, right }) {
  return (
    <div
      style={{
        border: `1px solid ${DS.border}`,
        backgroundColor: DS.cardBg,
      }}
    >
      <button
        type="button"
        onClick={onToggle}
        className="w-full text-left px-5 py-4 flex items-start justify-between gap-3 transition-colors"
        style={{ color: DS.bodyText }}
        onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = DS.brandBg; }}
        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; }}
      >
        <div className="min-w-0">
          <p
            className="text-xs font-black uppercase tracking-wider"
            style={{ color: DS.bodyText }}
          >
            {title}
          </p>
          {subtitle && (
            <p className="text-xs mt-1 leading-relaxed" style={{ color: DS.labelText }}>
              {subtitle}
            </p>
          )}
        </div>
        <div className="shrink-0 flex items-center gap-3">
          {right && <div className="hidden sm:block">{right}</div>}
          <div
            className="h-7 w-7 flex items-center justify-center text-sm font-bold transition-colors"
            style={{
              border: `1px solid ${DS.brandBorder}`,
              backgroundColor: open ? DS.brand : "transparent",
              color: open ? "#fff" : DS.labelText,
            }}
            aria-hidden
          >
            {open ? "−" : "+"}
          </div>
        </div>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18 }}
          >
            <div
              className="px-5 pb-5 pt-2"
              style={{ borderTop: `1px solid ${DS.border}` }}
            >
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Status pill helper ───────────────────────────────────────────────────────
function statusStyle(s) {
  const str = String(s || "").toLowerCase();
  if (!str) return { bg: DS.pageBg, color: DS.dimText, text: "Not started" };
  if (str.includes("trial"))   return { bg: DS.brandBg,  color: DS.brand,  text: "Trial" };
  if (str.includes("active"))  return { bg: DS.safeBg,   color: DS.safe,   text: "Active" };
  if (str.includes("past"))    return { bg: DS.cautionBg, color: DS.caution, text: "Past Due" };
  if (str.includes("cancel"))  return { bg: DS.pageBg,   color: DS.dimText, text: "Canceled" };
  if (str.includes("suspend") || str.includes("unpaid"))
    return { bg: DS.bannedBg, color: DS.banned, text: "Suspended" };
  return { bg: DS.pageBg, color: DS.dimText, text: s };
}

function StatusPill({ status }) {
  const { bg, color, text } = statusStyle(status);
  return (
    <span
      className="inline-flex items-center px-3 py-1 text-xs font-bold uppercase tracking-wide rounded-sm"
      style={{ backgroundColor: bg, color, border: `1px solid ${color}30` }}
    >
      {text}
    </span>
  );
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────
function LoadingRow() {
  return (
    <div className="text-sm" style={{ color: DS.dimText }}>
      Loading…
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
const EMPTY_DATA = {
  billingName: "", billingEmail: "", billingPhone: "", billingRoleTitle: "",
  billingAddress1: "", billingAddress2: "", billingCity: "",
  billingState: "", billingPostal: "", billingCountry: "",
  legalBusinessName: "", dbaName: "", businessType: "",
  taxIdType: "", taxIdLast4: "", taxExempt: false, taxExemptCertUrl: "",
  preferredPaymentMethod: "", paymentTerms: "", poRequired: false, poNumber: "",
  bankName: "", routingLast4: "", accountLast4: "", wireInstructions: "",
  invoiceNotes: "", notes: "",
};

/**
 * BillingSection
 * Props: memberId, role, onDirtyChange, onRegisterSave
 */
export default function BillingSection({ memberId, role, onDirtyChange, onRegisterSave }) {
  const canEdit = role === "admin" || role === "organization";

  const [loading, setLoading]           = useState(true);
  const [saving, setSaving]             = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [msg, setMsg]                   = useState("");
  const [err, setErr]                   = useState("");
  const [canStartTrial, setCanStartTrial] = useState(false);
  const [data, setData]                 = useState(EMPTY_DATA);
  const [stripeInfo, setStripeInfo]     = useState({
    plan: "", status: "", stripeCustomerId: "",
    stripeSubscriptionId: "", trialEnds: "",
    currentPeriodEnd: "", renewalDate: "",
  });
  const [original, setOriginal]         = useState(null);

  // Section open/close
  const [openContact,  setOpenContact]  = useState(true);
  const [openAddress,  setOpenAddress]  = useState(false);
  const [openBusiness, setOpenBusiness] = useState(false);
  const [openPayment,  setOpenPayment]  = useState(false);
  const [openBank,     setOpenBank]     = useState(false);

  const hasChanges = useMemo(() => {
    if (!original) return false;
    return Object.keys(data).some((k) => String(data[k] ?? "") !== String(original[k] ?? ""));
  }, [data, original]);

  const req = useMemo(() => completionScore(data), [data]);
  const isBillingProfileComplete = req.filled === req.total;

  const billingWarnings = useMemo(() => {
    const w = [];
    if (data.billingEmail && !isEmail(data.billingEmail)) w.push("Billing email looks invalid.");
    if (data.taxIdLast4 && String(data.taxIdLast4).replace(/\D/g, "").length !== 4)
      w.push("Tax ID (Last 4) should be exactly 4 digits.");
    if (data.routingLast4 && String(data.routingLast4).replace(/\D/g, "").length !== 4)
      w.push("Routing (Last 4) should be exactly 4 digits.");
    if (data.accountLast4 && String(data.accountLast4).replace(/\D/g, "").length !== 4)
      w.push("Account (Last 4) should be exactly 4 digits.");
    return w;
  }, [data]);

  // ── Load ───────────────────────────────────────────────────────────────────
  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setErr("");
    setMsg("");

    (async () => {
      try {
        const res  = await fetch("/api/org/billing/get", { method: "GET", credentials: "include" });
        const json = await safeJson(res);
        if (!res.ok) throw new Error(json?.error || "Failed to load billing.");

        const b = json?.billing || {};
        const next = Object.fromEntries(
          Object.keys(EMPTY_DATA).map((k) => [k, b[k] !== undefined ? b[k] : EMPTY_DATA[k]])
        );
        // Coerce booleans
        next.taxExempt  = Boolean(b?.taxExempt);
        next.poRequired = Boolean(b?.poRequired);

        const nextStripe = {
          plan: b?.plan || "", status: b?.status || "",
          stripeCustomerId: b?.stripeCustomerId || "",
          stripeSubscriptionId: b?.stripeSubscriptionId || "",
          trialEnds: b?.trialEnds || "",
          currentPeriodEnd: b?.currentPeriodEnd || "",
          renewalDate: b?.renewalDate || "",
        };

        if (mounted) {
          setData(next);
          setOriginal(next);
          setStripeInfo(nextStripe);
          setCanStartTrial(Boolean(json?.canStartTrial));
        }
      } catch (e) {
        if (mounted) setErr(e?.message || "Failed to load billing.");
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => { mounted = false; };
  }, []);

  const onField = (name, value) => setData((prev) => ({ ...prev, [name]: value }));

  // ── Save ───────────────────────────────────────────────────────────────────
  const onSave = useCallback(async () => {
    if (!canEdit || saving || !hasChanges) return;
    setSaving(true);
    setErr("");
    setMsg("");

    try {
      const payload = {
        ...data,
        billingPhone: normalizePhone(data.billingPhone),
        taxIdLast4:   String(data.taxIdLast4   || "").replace(/\D/g, "").slice(-4),
        routingLast4: String(data.routingLast4  || "").replace(/\D/g, "").slice(-4),
        accountLast4: String(data.accountLast4  || "").replace(/\D/g, "").slice(-4),
      };

      const res  = await fetch("/api/org/billing/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ memberId, billing: payload }),
      });
      const json = await safeJson(res);
      if (!res.ok) throw new Error(json?.error || "Failed to save billing.");

      setOriginal(data);
      setMsg("Billing updated.");
      setTimeout(() => setMsg(""), 2500);
    } catch (e) {
      setErr(e?.message || "Failed to save billing.");
      throw e;
    } finally {
      setSaving(false);
    }
  }, [canEdit, saving, hasChanges, memberId, data]);

  // ── Bridge to parent ───────────────────────────────────────────────────────
  useEffect(() => { onDirtyChange?.(Boolean(hasChanges)); }, [hasChanges, onDirtyChange]);

  useEffect(() => {
    onRegisterSave?.(async () => {
      if (!canEdit || saving || loading || !hasChanges) return { ok: false, skipped: true };
      await onSave();
      return { ok: true };
    });
  }, [onRegisterSave, canEdit, saving, loading, hasChanges, onSave]);

  // ── Stripe actions ─────────────────────────────────────────────────────────
  const openPortal = async () => {
    if (!canEdit || actionLoading) return;
    setActionLoading(true);
    setErr("");
    setMsg("");
    try {
      const res  = await fetch("/api/stripe/customer-portal", {
        method: "POST", headers: { "Content-Type": "application/json" },
        credentials: "include", body: JSON.stringify({}),
      });
      const json = await safeJson(res);
      if (!res.ok)    throw new Error(json?.error || "Failed to open billing portal.");
      if (!json?.url) throw new Error("Stripe did not return a portal URL.");
      window.location.href = json.url;
    } catch (e) {
      setErr(e?.message || "Failed to open billing portal.");
    } finally {
      setActionLoading(false);
    }
  };

  const startTrial = async () => {
    if (!canEdit || actionLoading) return;
    if (!isBillingProfileComplete) {
      setErr(`Complete billing profile first (${req.filled}/${req.total}). We need contact, address, and legal name.`);
      setOpenContact(true);
      setOpenAddress(true);
      setOpenBusiness(true);
      return;
    }
    setActionLoading(true);
    setErr("");
    setMsg("");
    try {
      const res  = await fetch("/api/stripe/create-checkout-session", {
        method: "POST", headers: { "Content-Type": "application/json" },
        credentials: "include", body: JSON.stringify({}),
      });
      const json = await safeJson(res);
      if (!res.ok)    throw new Error(json?.error || "Failed to start checkout.");
      if (!json?.url) throw new Error("Stripe did not return a checkout URL.");
      window.location.href = json.url;
    } catch (e) {
      setErr(e?.message || "Failed to start trial.");
    } finally {
      setActionLoading(false);
    }
  };

  const hasStripeSub  = Boolean(String(stripeInfo?.stripeSubscriptionId || "").trim());
  const allowTrial    = Boolean(canStartTrial) && !hasStripeSub;
  const { bg: sBg, color: sColor, text: sText } = statusStyle(stripeInfo?.status);

  return (
    <div className="space-y-4 mt-2">

      {/* ── Section header ─────────────────────────────────────────── */}
      <div
        className="flex items-start justify-between gap-3 pb-3"
        style={{ borderBottom: `2px solid ${DS.border}` }}
      >
        <div>
          <h2
            className="font-black uppercase"
            style={{
              fontFamily: "'Barlow Condensed', sans-serif",
              fontSize: "0.95rem",
              color: DS.bodyText,
              letterSpacing: "0.06em",
            }}
          >
            Billing
          </h2>
          <p className="text-xs mt-1" style={{ color: DS.dimText }}>
            Admin and org owners only. Subscription + contact info.
          </p>

          {/* Status pills */}
          <div className="mt-2 flex flex-wrap gap-2">
            <StatusPill status={stripeInfo?.status} />

            <span
              className="inline-flex items-center px-3 py-1 text-xs font-bold uppercase tracking-wide rounded-sm"
              style={{
                backgroundColor: isBillingProfileComplete ? DS.safeBg  : DS.cautionBg,
                color:           isBillingProfileComplete ? DS.safe     : DS.caution,
                border: `1px solid ${isBillingProfileComplete ? DS.safeBorder : DS.cautionBorder}`,
              }}
            >
              Profile {req.filled}/{req.total}
            </span>

            {stripeInfo?.plan && (
              <span
                className="inline-flex items-center px-3 py-1 text-xs font-bold uppercase tracking-wide rounded-sm"
                style={{ backgroundColor: DS.pageBg, color: DS.labelText, border: `1px solid ${DS.border}` }}
              >
                {stripeInfo.plan}
              </span>
            )}
          </div>
        </div>

        {/* Quick save button */}
        <button
          type="button"
          onClick={onSave}
          disabled={!canEdit || saving || !hasChanges || loading}
          className="shrink-0 px-4 py-2 text-xs font-bold uppercase tracking-wide transition-all rounded-sm"
          style={
            canEdit && !saving && hasChanges && !loading
              ? { backgroundColor: DS.brand, color: "#fff" }
              : { backgroundColor: DS.border, color: DS.dimText, cursor: "not-allowed" }
          }
          onMouseEnter={(e) => { if (canEdit && !saving && hasChanges && !loading) e.currentTarget.style.filter = "brightness(1.12)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.filter = "none"; }}
        >
          {saving ? "Saving…" : "Save Billing"}
        </button>
      </div>

      {/* ── Feedback — local to billing only ───────────────────────── */}
      <AnimatePresence>
        {(msg || err) && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="px-4 py-3 text-sm font-medium"
            style={msg
              ? { backgroundColor: DS.safeBg,   borderLeft: `4px solid ${DS.safe}`,   color: "#1A5C33" }
              : { backgroundColor: DS.bannedBg,  borderLeft: `4px solid ${DS.banned}`, color: "#7A1A1A" }
            }
          >
            {msg || err}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Validation warnings ─────────────────────────────────────── */}
      {billingWarnings.length > 0 && (
        <div
          className="px-4 py-3"
          style={{
            backgroundColor: DS.cautionBg,
            border: `1px solid ${DS.cautionBorder}`,
            borderLeft: `4px solid ${DS.caution}`,
          }}
        >
          <p
            className="text-xs font-black uppercase tracking-wider mb-2"
            style={{ color: DS.cautionText }}
          >
            Check these fields
          </p>
          <ul className="space-y-1">
            {billingWarnings.map((w) => (
              <li key={w} className="flex items-start gap-2">
                <span className="mt-1 w-1 h-1 rounded-full shrink-0" style={{ backgroundColor: DS.caution }} />
                <span className="text-xs" style={{ color: DS.cautionText }}>{w}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ── Subscription (Stripe, read-only) ────────────────────────── */}
      <div
        className="p-5"
        style={{
          backgroundColor: DS.brandBg,
          border: `1px solid ${DS.brandBorder}`,
          borderLeft: `4px solid ${DS.brand}`,
        }}
      >
        <div className="flex flex-col sm:flex-row items-start justify-between gap-6">
          <div className="min-w-0 flex-1">
            <p
              className="text-xs font-black uppercase tracking-wider mb-1"
              style={{ color: DS.brand }}
            >
              Subscription
            </p>
            <p className="text-xs leading-relaxed mb-4" style={{ color: DS.labelText }}>
              Start your 30-day free trial, or manage payment details in Stripe.
            </p>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { label: "Trial ends",      value: fmtDate(stripeInfo.trialEnds) },
                { label: "Period end",      value: fmtDate(stripeInfo.currentPeriodEnd) },
                { label: "Renewal",         value: fmtDate(stripeInfo.renewalDate) },
                { label: "Stripe", value: stripeInfo.stripeCustomerId || "—" },
              ].map(({ label, value }) => (
                <div key={label}>
                  <p
                    className="text-xs font-bold uppercase tracking-wider mb-2"
                    style={{ color: DS.labelText }}
                  >
                    {label}
                  </p>
                  <div
                    className="text-xs px-3 py-2 font-mono truncate"
                    style={{
                      backgroundColor: DS.cardBg,
                      border: `1px solid ${DS.border}`,
                      color: DS.labelText,
                    }}
                  >
                    {value}
                  </div>
                </div>
              ))}
            </div>

            <p className="text-xs mt-4" style={{ color: DS.dimText }}>
              Plan, status, and dates are read-only — synced from Stripe webhooks.
            </p>
          </div>

          {/* Stripe action buttons */}
          <div
            className="shrink-0 flex flex-col gap-3 w-full sm:w-auto sm:self-start"
          >
            <button
              type="button"
              onClick={startTrial}
              disabled={!canEdit || actionLoading || !allowTrial}
              className="px-4 py-2.5 text-xs font-bold uppercase tracking-wide transition-all rounded-sm"
              style={
                canEdit && !actionLoading && allowTrial
                  ? { backgroundColor: DS.brand, color: "#fff" }
                  : { backgroundColor: DS.border, color: DS.dimText, cursor: "not-allowed" }
              }
              onMouseEnter={(e) => { if (canEdit && !actionLoading && allowTrial) e.currentTarget.style.filter = "brightness(1.12)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.filter = "none"; }}
            >
              {hasStripeSub ? "Subscription active" : actionLoading ? "Loading…" : "Start 30-day trial"}
            </button>

            <button
              type="button"
              onClick={openPortal}
              disabled={!canEdit || actionLoading || !stripeInfo.stripeCustomerId}
              className="px-4 py-2.5 text-xs font-bold uppercase tracking-wide transition-all rounded-sm"
              style={
                canEdit && !actionLoading && stripeInfo.stripeCustomerId
                  ? { backgroundColor: DS.cardBg, color: DS.brand, border: `1px solid ${DS.brandBorder}` }
                  : { backgroundColor: DS.pageBg, color: DS.dimText, border: `1px solid ${DS.border}`, cursor: "not-allowed" }
              }
              onMouseEnter={(e) => { if (canEdit && !actionLoading && stripeInfo.stripeCustomerId) e.currentTarget.style.backgroundColor = "#D8E6F3"; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = canEdit && stripeInfo.stripeCustomerId ? DS.cardBg : DS.pageBg; }}
            >
              Manage billing
            </button>
          </div>
        </div>
      </div>

      {/* ── Collapsible editable sections ───────────────────────────── */}
      <Section
        title="Billing Contact"
        subtitle="Who we contact for invoices, receipts, and billing questions."
        open={openContact}
        onToggle={() => setOpenContact((v) => !v)}
      >
        {loading ? <LoadingRow /> : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <FieldLabel required>Billing Contact Name</FieldLabel>
              <TextInput value={data.billingName} onChange={(e) => onField("billingName", e.target.value)} placeholder="Primary billing contact" disabled={!canEdit} />
            </div>
            <div>
              <FieldLabel>Billing Role / Title</FieldLabel>
              <TextInput value={data.billingRoleTitle} onChange={(e) => onField("billingRoleTitle", e.target.value)} placeholder="Athletic Director, Admin…" disabled={!canEdit} />
            </div>
            <div>
              <FieldLabel required>Billing Email</FieldLabel>
              <TextInput type="email" value={data.billingEmail} onChange={(e) => onField("billingEmail", e.target.value)} placeholder="billing@school.edu" disabled={!canEdit} />
            </div>
            <div>
              <FieldLabel>Billing Phone</FieldLabel>
              <TextInput type="tel" value={data.billingPhone} onChange={(e) => onField("billingPhone", e.target.value)} placeholder="+15551234567" disabled={!canEdit} />
            </div>
            <div className="md:col-span-2">
              <FieldLabel>Invoice Notes</FieldLabel>
              <TextArea value={data.invoiceNotes} onChange={(e) => onField("invoiceNotes", e.target.value)} placeholder="Anything helpful for billing (invoice email rules, department…)" disabled={!canEdit} />
            </div>
          </div>
        )}
      </Section>

      <Section
        title="Billing Address"
        subtitle="Required for invoicing, tax rules, and some payment methods."
        open={openAddress}
        onToggle={() => setOpenAddress((v) => !v)}
      >
        {loading ? <LoadingRow /> : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <FieldLabel required>Address Line 1</FieldLabel>
              <TextInput value={data.billingAddress1} onChange={(e) => onField("billingAddress1", e.target.value)} placeholder="Street address" disabled={!canEdit} />
            </div>
            <div className="md:col-span-2">
              <FieldLabel>Address Line 2</FieldLabel>
              <TextInput value={data.billingAddress2} onChange={(e) => onField("billingAddress2", e.target.value)} placeholder="Suite, department, mail stop" disabled={!canEdit} />
            </div>
            <div>
              <FieldLabel required>City</FieldLabel>
              <TextInput value={data.billingCity} onChange={(e) => onField("billingCity", e.target.value)} placeholder="City" disabled={!canEdit} />
            </div>
            <div>
              <FieldLabel required>State / Province</FieldLabel>
              <TextInput value={data.billingState} onChange={(e) => onField("billingState", e.target.value)} placeholder="State / Province" disabled={!canEdit} />
            </div>
            <div>
              <FieldLabel required>Postal Code</FieldLabel>
              <TextInput value={data.billingPostal} onChange={(e) => onField("billingPostal", e.target.value)} placeholder="ZIP / Postal" disabled={!canEdit} />
            </div>
            <div>
              <FieldLabel required>Country</FieldLabel>
              <SelectInput value={data.billingCountry} onChange={(e) => onField("billingCountry", e.target.value)} disabled={!canEdit}>
                <option value="">Select…</option>
                <option value="United States">United States</option>
                <option value="Canada">Canada</option>
                <option value="United Kingdom">United Kingdom</option>
                <option value="Other">Other</option>
              </SelectInput>
            </div>
          </div>
        )}
      </Section>

      <Section
        title="Business & Tax"
        subtitle="Legal name is required. Tax fields are optional unless you need tax-exempt handling."
        open={openBusiness}
        onToggle={() => setOpenBusiness((v) => !v)}
      >
        {loading ? <LoadingRow /> : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <FieldLabel required>Legal Business Name</FieldLabel>
              <TextInput value={data.legalBusinessName} onChange={(e) => onField("legalBusinessName", e.target.value)} placeholder="Legal entity name" disabled={!canEdit} />
            </div>
            <div>
              <FieldLabel>DBA Name</FieldLabel>
              <TextInput value={data.dbaName} onChange={(e) => onField("dbaName", e.target.value)} placeholder="Doing business as" disabled={!canEdit} />
            </div>
            <div>
              <FieldLabel>Business Type</FieldLabel>
              <SelectInput value={data.businessType} onChange={(e) => onField("businessType", e.target.value)} disabled={!canEdit}>
                <option value="">Select…</option>
                {["LLC","Corp","Nonprofit","School","Individual","Other"].map((o) => <option key={o} value={o}>{o}</option>)}
              </SelectInput>
            </div>
            <div>
              <FieldLabel>Tax ID Type</FieldLabel>
              <SelectInput value={data.taxIdType} onChange={(e) => onField("taxIdType", e.target.value)} disabled={!canEdit}>
                <option value="">Select…</option>
                {["EIN","VAT","GST","Other"].map((o) => <option key={o} value={o}>{o}</option>)}
              </SelectInput>
            </div>
            <div>
              <FieldLabel>Tax ID (Last 4 only)</FieldLabel>
              <TextInput value={data.taxIdLast4} onChange={(e) => onField("taxIdLast4", e.target.value)} placeholder="1234" disabled={!canEdit} inputMode="numeric" />
              <FieldHint>Do not store full Tax IDs in the app.</FieldHint>
            </div>
            <div>
              <CheckboxField id="taxExempt" checked={data.taxExempt} onChange={(e) => onField("taxExempt", e.target.checked)} disabled={!canEdit} label="Tax Exempt" />
            </div>
            <div className="md:col-span-2">
              <FieldLabel>Tax Exempt Certificate URL</FieldLabel>
              <TextInput value={data.taxExemptCertUrl} onChange={(e) => onField("taxExemptCertUrl", e.target.value)} placeholder="https://…" disabled={!canEdit} />
            </div>
          </div>
        )}
      </Section>

      <Section
        title="Payment & PO"
        subtitle="Set expectations for invoicing and purchasing workflows."
        open={openPayment}
        onToggle={() => setOpenPayment((v) => !v)}
      >
        {loading ? <LoadingRow /> : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <FieldLabel>Preferred Payment Method</FieldLabel>
              <SelectInput value={data.preferredPaymentMethod} onChange={(e) => onField("preferredPaymentMethod", e.target.value)} disabled={!canEdit}>
                <option value="">Select…</option>
                {["Card","ACH","Invoice","Wire","Other"].map((o) => <option key={o} value={o}>{o}</option>)}
              </SelectInput>
            </div>
            <div>
              <FieldLabel>Payment Terms</FieldLabel>
              <SelectInput value={data.paymentTerms} onChange={(e) => onField("paymentTerms", e.target.value)} disabled={!canEdit}>
                <option value="">Select…</option>
                {["Due on receipt","Net 15","Net 30"].map((o) => <option key={o} value={o}>{o}</option>)}
              </SelectInput>
            </div>
            <div>
              <CheckboxField id="poRequired" checked={data.poRequired} onChange={(e) => onField("poRequired", e.target.checked)} disabled={!canEdit} label="PO Required" />
            </div>
            <div>
              <FieldLabel>PO Number</FieldLabel>
              <TextInput value={data.poNumber} onChange={(e) => onField("poNumber", e.target.value)} placeholder="PO-12345" disabled={!canEdit} />
            </div>
            <div className="md:col-span-2">
              <FieldLabel>Internal Billing Notes</FieldLabel>
              <TextArea value={data.notes} onChange={(e) => onField("notes", e.target.value)} placeholder="Internal notes (not visible to customers)" disabled={!canEdit} />
            </div>
          </div>
        )}
      </Section>

      <Section
        title="Bank / Wire (optional)"
        subtitle="Store last-4 only. Full banking details should live in Stripe or finance systems."
        open={openBank}
        onToggle={() => setOpenBank((v) => !v)}
      >
        {loading ? <LoadingRow /> : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <FieldLabel>Bank Name</FieldLabel>
              <TextInput value={data.bankName} onChange={(e) => onField("bankName", e.target.value)} placeholder="Bank / Institution" disabled={!canEdit} />
            </div>
            <div />
            <div>
              <FieldLabel>Routing (Last 4)</FieldLabel>
              <TextInput value={data.routingLast4} onChange={(e) => onField("routingLast4", e.target.value)} placeholder="1234" disabled={!canEdit} inputMode="numeric" />
            </div>
            <div>
              <FieldLabel>Account (Last 4)</FieldLabel>
              <TextInput value={data.accountLast4} onChange={(e) => onField("accountLast4", e.target.value)} placeholder="5678" disabled={!canEdit} inputMode="numeric" />
            </div>
            <div className="md:col-span-2">
              <FieldLabel>Wire Instructions</FieldLabel>
              <TextArea value={data.wireInstructions} onChange={(e) => onField("wireInstructions", e.target.value)} placeholder="If needed (optional)." disabled={!canEdit} minHeight="110px" />
              <FieldHint>At scale, wire details move to a finance workflow rather than the app.</FieldHint>
            </div>
          </div>
        )}
      </Section>

    </div>
  );
}