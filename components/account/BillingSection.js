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
  if (!v) return null;
  try {
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) return null;
    return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  } catch { return null; }
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

// Tier definitions - used by the plan selector UI
const TIER_DEFS = [
  {
    id: "free",  label: "Starter", range: "1–10 athletes", badge: null,
    monthly: { price: "Free",       note: "Forever free" },
    yearly:  { price: "Free",       note: "Forever free",              savings: null },
  },
  {
    id: "small", label: "Growth",  range: "11–59 athletes", badge: null,
    monthly: { price: "$69.99/mo",  note: "Billed monthly" },
    yearly:  { price: "$49.99/mo",  note: "Billed as $599.88/yr",      savings: "Save $240/yr" },
  },
  {
    id: "large", label: "Pro",     range: "60+ athletes", badge: null,
    monthly: { price: "$499/mo",    note: "Billed monthly" },
    yearly:  { price: "$349/mo",    note: "Billed as $4,188/yr",       savings: "Save $1,800/yr" },
  },
];

// Derive a clean billing state from status + dates
function deriveBillingState(stripeInfo) {
  const s = String(stripeInfo?.status || "").toLowerCase();
  const now = Date.now();

  if (s === "free")                                 return "free";
  if (s.includes("past") || s.includes("due"))      return "past_due";
  if (s.includes("unpaid") || s.includes("suspend")) return "suspended";
  if (s.includes("cancel"))                          return "canceled";
  if (s === "active")                                return "active";
  if (s.includes("trial")) {
    const te = stripeInfo?.trialEnds ? new Date(stripeInfo.trialEnds).getTime() : 0;
    return (te && te > now) ? "trial" : "trial_ended";
  }
  // No stripe sub yet - check if there's a customer ID (went through checkout at least once)
  if (stripeInfo?.stripeCustomerId) return "inactive";
  return "not_started";
}

const STATE_COPY = {
  not_started: {
    heading:  "Start your free trial",
    body:     "30 days free, no credit card required upfront. Complete your billing profile below, then start checkout.",
    accentBg: DS.brandBg,
    accent:   DS.brand,
    border:   DS.brandBorder,
  },
  trial: {
    heading:  "Trial active",
    body:     "Your 30-day free trial is running. Add a payment method in Stripe before it ends to keep access.",
    accentBg: DS.brandBg,
    accent:   DS.brand,
    border:   DS.brandBorder,
  },
  trial_ended: {
    heading:  "Trial ended",
    body:     "Your free trial has expired. Open the billing portal to add a payment method and reactivate.",
    accentBg: DS.cautionBg,
    accent:   DS.caution,
    border:   DS.cautionBorder,
  },
  active: {
    heading:  "Subscription active",
    body:     "Your subscription is current. Use the billing portal to update payment details, download invoices, or cancel.",
    accentBg: DS.safeBg,
    accent:   DS.safe,
    border:   DS.safeBorder,
  },
  past_due: {
    heading:  "Payment past due",
    body:     "A payment failed. Open the billing portal to update your payment method before access is suspended.",
    accentBg: DS.cautionBg,
    accent:   DS.caution,
    border:   DS.cautionBorder,
  },
  suspended: {
    heading:  "Access suspended",
    body:     "Your subscription is unpaid and access has been suspended. Open the billing portal to resolve.",
    accentBg: DS.bannedBg,
    accent:   DS.banned,
    border:   DS.bannedBorder,
  },
  free: {
    heading:  "Starter plan active",
    body:     "You're on the free Starter plan (up to 10 athletes). Workouts, Nutrition, Banned Substance Scanning, and Attendance included. Upgrade anytime.",
    accentBg: DS.safeBg,
    accent:   DS.safe,
    border:   DS.safeBorder,
  },
  canceled: {
    heading:  "Subscription canceled",
    body:     "Your subscription was canceled. Choose a plan below to reactivate your organization's access.",
    accentBg: DS.pageBg,
    accent:   DS.labelText,
    border:   DS.border,
  },
  inactive: {
    heading:  "Subscription inactive",
    body:     "Your subscription is not active. Open the billing portal to reactivate or start a new checkout.",
    accentBg: DS.cautionBg,
    accent:   DS.caution,
    border:   DS.cautionBorder,
  },
};

// ─── Shared input primitives ──────────────────────────────────────────────────
function FieldLabel({ children, required }) {
  return (
    <label className="block text-xs font-black uppercase tracking-wider mb-1.5" style={{ color: DS.labelText }}>
      {children}
      {required && <span style={{ color: DS.banned }}> *</span>}
    </label>
  );
}

function TextInput({ value, onChange, placeholder, disabled, inputMode, type = "text" }) {
  return (
    <input
      type={type} value={value} onChange={onChange} placeholder={placeholder}
      disabled={disabled} inputMode={inputMode}
      className="w-full text-sm px-3 py-2.5 outline-none transition-all"
      style={{
        border: `1px solid ${DS.brandBorder}`,
        backgroundColor: disabled ? DS.pageBg : DS.brandBg,
        color: disabled ? DS.dimText : DS.bodyText,
        cursor: disabled ? "not-allowed" : "text",
      }}
      onFocus={(e) => { if (!disabled) { e.currentTarget.style.borderColor = DS.brand; e.currentTarget.style.boxShadow = `0 0 0 3px ${DS.brand}18`; } }}
      onBlur={(e)  => { e.currentTarget.style.borderColor = DS.brandBorder; e.currentTarget.style.boxShadow = "none"; }}
    />
  );
}

function TextArea({ value, onChange, placeholder, disabled, minHeight = "90px" }) {
  return (
    <textarea
      value={value} onChange={onChange} placeholder={placeholder} disabled={disabled}
      className="w-full text-sm px-3 py-2.5 outline-none transition-all resize-y"
      style={{
        minHeight,
        border: `1px solid ${DS.brandBorder}`,
        backgroundColor: disabled ? DS.pageBg : DS.brandBg,
        color: disabled ? DS.dimText : DS.bodyText,
        cursor: disabled ? "not-allowed" : "text",
      }}
      onFocus={(e) => { if (!disabled) { e.currentTarget.style.borderColor = DS.brand; e.currentTarget.style.boxShadow = `0 0 0 3px ${DS.brand}18`; } }}
      onBlur={(e)  => { e.currentTarget.style.borderColor = DS.brandBorder; e.currentTarget.style.boxShadow = "none"; }}
    />
  );
}

function SelectInput({ value, onChange, disabled, children }) {
  return (
    <select
      value={value} onChange={onChange} disabled={disabled}
      className="w-full text-sm px-3 py-2.5 outline-none transition-all"
      style={{
        border: `1px solid ${DS.brandBorder}`,
        backgroundColor: disabled ? DS.pageBg : DS.brandBg,
        color: disabled ? DS.dimText : DS.bodyText,
        cursor: disabled ? "not-allowed" : "pointer",
      }}
      onFocus={(e) => { if (!disabled) e.currentTarget.style.borderColor = DS.brand; }}
      onBlur={(e)  => { e.currentTarget.style.borderColor = DS.brandBorder; }}
    >
      {children}
    </select>
  );
}

function CheckboxField({ id, checked, onChange, disabled, label }) {
  return (
    <div className="flex items-center gap-3 mt-2">
      <input id={id} type="checkbox" className="h-4 w-4" checked={Boolean(checked)}
        onChange={onChange} disabled={disabled} style={{ accentColor: DS.brand }} />
      <label htmlFor={id} className="text-sm font-bold" style={{ color: DS.bodyText }}>{label}</label>
    </div>
  );
}

function FieldHint({ children, error }) {
  return (
    <p className="text-xs mt-1.5" style={{ color: error ? DS.banned : DS.dimText }}>{children}</p>
  );
}

// ─── Collapsible section ──────────────────────────────────────────────────────
function Section({ title, subtitle, open, onToggle, children }) {
  return (
    <div style={{ border: `1px solid ${DS.border}`, backgroundColor: DS.cardBg }}>
      <button type="button" onClick={onToggle}
        className="w-full text-left px-5 py-4 flex items-start justify-between gap-3 transition-colors"
        style={{ color: DS.bodyText }}
        onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = DS.brandBg; }}
        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; }}
      >
        <div className="min-w-0">
          <p className="text-xs font-black uppercase tracking-wider" style={{ color: DS.bodyText }}>{title}</p>
          {subtitle && <p className="text-xs mt-1 leading-relaxed" style={{ color: DS.labelText }}>{subtitle}</p>}
        </div>
        <div className="h-7 w-7 shrink-0 flex items-center justify-center text-sm font-bold transition-colors"
          style={{ border: `1px solid ${DS.brandBorder}`, backgroundColor: open ? DS.brand : "transparent", color: open ? "#fff" : DS.labelText }}
          aria-hidden>
          {open ? "−" : "+"}
        </div>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.18 }}>
            <div className="px-5 pb-5 pt-2" style={{ borderTop: `1px solid ${DS.border}` }}>
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Status pill ──────────────────────────────────────────────────────────────
function statusStyle(s) {
  const str = String(s || "").toLowerCase();
  if (!str) return { bg: DS.pageBg, color: DS.dimText, text: "Not started" };
  if (str === "free")          return { bg: DS.safeBg,    color: DS.safe,    text: "Free" };
  if (str.includes("trial"))   return { bg: DS.brandBg,   color: DS.brand,   text: "Trial" };
  if (str === "active")        return { bg: DS.safeBg,    color: DS.safe,    text: "Active" };
  if (str.includes("past"))    return { bg: DS.cautionBg, color: DS.caution, text: "Past Due" };
  if (str.includes("cancel"))  return { bg: DS.pageBg,    color: DS.dimText, text: "Canceled" };
  if (str.includes("suspend") || str.includes("unpaid"))
    return { bg: DS.bannedBg, color: DS.banned, text: "Suspended" };
  return { bg: DS.pageBg, color: DS.dimText, text: s };
}

function StatusPill({ status }) {
  const { bg, color, text } = statusStyle(status);
  return (
    <span className="inline-flex items-center px-3 py-1 text-xs font-bold uppercase tracking-wide rounded-sm"
      style={{ backgroundColor: bg, color, border: `1px solid ${color}30` }}>
      {text}
    </span>
  );
}

function LoadingRow() {
  return <div className="text-sm" style={{ color: DS.dimText }}>Loading…</div>;
}

// ─── Action button ────────────────────────────────────────────────────────────
function ActionButton({ onClick, disabled, variant = "primary", children }) {
  const isPrimary = variant === "primary";
  return (
    <button type="button" onClick={onClick} disabled={disabled}
      className="px-4 py-2.5 text-xs font-bold uppercase tracking-wide transition-all rounded-sm w-full sm:w-auto"
      style={
        !disabled
          ? isPrimary
            ? { backgroundColor: DS.brand, color: "#fff" }
            : { backgroundColor: DS.cardBg, color: DS.brand, border: `1px solid ${DS.brandBorder}` }
          : { backgroundColor: DS.border, color: DS.dimText, cursor: "not-allowed" }
      }
      onMouseEnter={(e) => { if (!disabled) e.currentTarget.style.filter = "brightness(1.1)"; }}
      onMouseLeave={(e) => { e.currentTarget.style.filter = "none"; }}
    >
      {children}
    </button>
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
};

export default function BillingSection({ memberId, role, onDirtyChange, onRegisterSave }) {
  const canEdit = role === "admin" || role === "organization";

  const [loading,       setLoading]       = useState(true);
  const [saving,        setSaving]        = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [redirecting,   setRedirecting]   = useState(false); // true once we have a Stripe URL
  const [msg,           setMsg]           = useState("");
  const [err,           setErr]           = useState("");
  const [canStartTrial, setCanStartTrial] = useState(false);
  const [data,          setData]          = useState(EMPTY_DATA);
  const [stripeInfo,    setStripeInfo]    = useState({
    plan: "", status: "", stripeCustomerId: "",
    stripeSubscriptionId: "", trialEnds: "",
    currentPeriodEnd: "", renewalDate: "",
  });
  const [original, setOriginal] = useState(null);

  const [openContact,  setOpenContact]  = useState(true);
  const [openAddress,  setOpenAddress]  = useState(false);
  const [openBusiness, setOpenBusiness] = useState(false);
  const [openPayment,  setOpenPayment]  = useState(false);
  const [openBank,     setOpenBank]     = useState(false);

  const [selectedTier,     setSelectedTier]     = useState("");
  const [showTierSelector, setShowTierSelector] = useState(false);
  const [billingInterval,  setBillingInterval]  = useState("yearly"); // default to annual (better deal)

  const hasChanges = useMemo(() => {
    if (!original) return false;
    return Object.keys(data).some((k) => String(data[k] ?? "") !== String(original[k] ?? ""));
  }, [data, original]);

  const req                   = useMemo(() => completionScore(data), [data]);
  const isBillingProfileComplete = req.filled === req.total;

  const billingWarnings = useMemo(() => {
    const w = [];
    if (data.billingEmail && !isEmail(data.billingEmail))
      w.push("Billing email looks invalid.");
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
    setLoading(true); setErr(""); setMsg("");

    (async () => {
      try {
        const res  = await fetch("/api/org/billing/get", { method: "GET", credentials: "include" });
        const json = await safeJson(res);
        if (!res.ok) throw new Error(json?.error || "Failed to load billing.");

        const b    = json?.billing || {};
        const next = Object.fromEntries(
          Object.keys(EMPTY_DATA).map((k) => [k, b[k] !== undefined ? b[k] : EMPTY_DATA[k]])
        );
        next.taxExempt  = Boolean(b?.taxExempt);
        next.poRequired = Boolean(b?.poRequired);

        const nextStripe = {
          plan: b?.plan || "", status: b?.status || "",
          stripeCustomerId:     b?.stripeCustomerId     || "",
          stripeSubscriptionId: b?.stripeSubscriptionId || "",
          trialEnds:        b?.trialEnds        || "",
          currentPeriodEnd: b?.currentPeriodEnd || "",
          renewalDate:      b?.renewalDate      || "",
        };

        if (mounted) {
          setData(next); setOriginal(next);
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
    setSaving(true); setErr(""); setMsg("");
    try {
      const payload = {
        ...data,
        billingPhone: normalizePhone(data.billingPhone),
        taxIdLast4:   String(data.taxIdLast4   || "").replace(/\D/g, "").slice(-4),
        routingLast4: String(data.routingLast4  || "").replace(/\D/g, "").slice(-4),
        accountLast4: String(data.accountLast4  || "").replace(/\D/g, "").slice(-4),
      };
      const res  = await fetch("/api/org/billing/update", {
        method: "POST", headers: { "Content-Type": "application/json" },
        credentials: "include", body: JSON.stringify({ memberId, billing: payload }),
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
    if (!canEdit || actionLoading || redirecting) return;
    setActionLoading(true); setErr(""); setMsg("");
    try {
      const res  = await fetch("/api/stripe/customer-portal", {
        method: "POST", headers: { "Content-Type": "application/json" },
        credentials: "include", body: JSON.stringify({}),
      });
      const json = await safeJson(res);
      if (!res.ok)    throw new Error(json?.error || "Failed to open billing portal.");
      if (!json?.url) throw new Error("Stripe did not return a portal URL.");
      setRedirecting(true);
      window.location.href = json.url;
    } catch (e) {
      setErr(e?.message || "Failed to open billing portal.");
      setActionLoading(false);
    }
    // intentionally no finally reset - on success we're navigating away
  };

  const startCheckout = async (tier) => {
    if (!canEdit || actionLoading || redirecting) return;

    if (tier !== "free" && !isBillingProfileComplete) {
      setErr(`Complete your billing profile first (${req.filled}/${req.total} fields). We need contact info, address, and legal business name.`);
      setOpenContact(true); setOpenAddress(true); setOpenBusiness(true);
      return;
    }

    setActionLoading(true); setErr(""); setMsg("");

    try {
      if (tier === "free") {
        const res  = await fetch("/api/org/billing/activate-free", {
          method: "POST", headers: { "Content-Type": "application/json" },
          credentials: "include", body: JSON.stringify({}),
        });
        const json = await safeJson(res);
        if (!res.ok) throw new Error(json?.error || "Failed to activate free plan.");
        // Reflect the new state immediately without a full reload
        setStripeInfo((prev) => ({ ...prev, status: "Free", plan: "Starter" }));
        setShowTierSelector(false);
        setMsg("Starter plan activated.");
        setTimeout(() => setMsg(""), 3000);
      } else {
        const res  = await fetch("/api/stripe/create-checkout-session", {
          method: "POST", headers: { "Content-Type": "application/json" },
          credentials: "include", body: JSON.stringify({ tier, interval: billingInterval }),
        });
        const json = await safeJson(res);
        if (!res.ok)    throw new Error(json?.error || "Failed to start checkout.");
        if (!json?.url) throw new Error("Stripe did not return a checkout URL.");
        setRedirecting(true);
        window.location.href = json.url;
      }
    } catch (e) {
      setErr(e?.message || "Failed to start plan.");
      setActionLoading(false);
    }
  };

  // ── Derived display state ─────────────────────────────────────────────────
  const billingState   = deriveBillingState(stripeInfo);
  const stateCopy      = STATE_COPY[billingState] || STATE_COPY.not_started;
  const hasStripeSub   = Boolean(String(stripeInfo?.stripeSubscriptionId || "").trim());
  const hasCustomer    = Boolean(String(stripeInfo?.stripeCustomerId || "").trim());
  const allowTrial     = Boolean(canStartTrial) && !hasStripeSub;

  // Show the tier selector when: no plan chosen, canceled, or user explicitly opens it
  const tierSelectorVisible =
    billingState === "not_started" ||
    billingState === "canceled"    ||
    showTierSelector;

  // Only real subscription dates (Stripe customer ID is shown separately in the footer)
  const dateRows = [
    billingState === "trial"    && { label: "Trial ends",  value: fmtDate(stripeInfo.trialEnds) },
    (billingState === "active"  || billingState === "past_due") && { label: "Renewal",    value: fmtDate(stripeInfo.renewalDate) },
    (billingState === "active"  || billingState === "past_due") && { label: "Period end", value: fmtDate(stripeInfo.currentPeriodEnd) },
  ].filter(Boolean).filter(r => r.value);

  return (
    <div className="space-y-4 mt-2">

      {/* ── Section header ─────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-3 pb-3" style={{ borderBottom: `2px solid ${DS.border}` }}>
        <div>
          <h2 className="font-black uppercase"
            style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "0.95rem", color: DS.bodyText, letterSpacing: "0.06em" }}>
            Billing
          </h2>
          <p className="text-xs mt-1" style={{ color: DS.dimText }}>
            Admin and org owners only. Subscription + contact info.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <StatusPill status={stripeInfo?.status} />
            <span className="inline-flex items-center px-3 py-1 text-xs font-bold uppercase tracking-wide rounded-sm"
              style={{
                backgroundColor: isBillingProfileComplete ? DS.safeBg  : DS.cautionBg,
                color:           isBillingProfileComplete ? DS.safe     : DS.caution,
                border: `1px solid ${isBillingProfileComplete ? DS.safeBorder : DS.cautionBorder}`,
              }}>
              Profile {req.filled}/{req.total}
            </span>
            {stripeInfo?.plan && (
              <span className="inline-flex items-center px-3 py-1 text-xs font-bold uppercase tracking-wide rounded-sm"
                style={{ backgroundColor: DS.pageBg, color: DS.labelText, border: `1px solid ${DS.border}` }}>
                {stripeInfo.plan}
              </span>
            )}
          </div>
        </div>

        <button type="button" onClick={onSave}
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

      {/* ── Feedback ──────────────────────────────────────────────────── */}
      <AnimatePresence>
        {(msg || err) && (
          <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
            className="px-4 py-3 text-sm font-medium"
            style={msg
              ? { backgroundColor: DS.safeBg,   borderLeft: `4px solid ${DS.safe}`,   color: "#1A5C33" }
              : { backgroundColor: DS.bannedBg,  borderLeft: `4px solid ${DS.banned}`, color: "#7A1A1A" }
            }>
            {msg || err}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Validation warnings ───────────────────────────────────────── */}
      {billingWarnings.length > 0 && (
        <div className="px-4 py-3"
          style={{ backgroundColor: DS.cautionBg, border: `1px solid ${DS.cautionBorder}`, borderLeft: `4px solid ${DS.caution}` }}>
          <p className="text-xs font-black uppercase tracking-wider mb-2" style={{ color: DS.cautionText }}>
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

      {/* ── Subscription / plan selection ─────────────────────────────── */}
      {tierSelectorVisible ? (
        /* ── Tier selector ── */
        <div className="p-5"
          style={{ border: `1px solid ${DS.brandBorder}`, borderTop: `3px solid ${DS.brand}`, backgroundColor: DS.cardBg }}>

          <p className="text-xs font-black uppercase tracking-wider mb-1" style={{ color: DS.brand }}>
            Choose your plan
          </p>
          <p className="text-sm font-black mb-1" style={{ color: DS.bodyText }}>
            Right-size your subscription
          </p>
          <p className="text-xs mb-4 leading-relaxed" style={{ color: DS.labelText }}>
            All plans include Workouts, Nutrition, Banned Substance Scanning, and Attendance. Paid plans start with a 30-day free trial.
          </p>

          {/* Billing interval - two prominent option cards */}
          <div className="grid grid-cols-2 gap-3 mb-6">
            {/* Monthly */}
            <button type="button" onClick={() => setBillingInterval("monthly")}
              className="text-left p-4 transition-all"
              style={{
                border:          `2px solid ${billingInterval === "monthly" ? DS.brand : DS.border}`,
                backgroundColor: billingInterval === "monthly" ? DS.brandBg : "#fff",
                cursor:          "pointer",
                outline:         "none",
              }}
              onMouseEnter={(e) => { if (billingInterval !== "monthly") e.currentTarget.style.borderColor = DS.brandBorder; }}
              onMouseLeave={(e) => { if (billingInterval !== "monthly") e.currentTarget.style.borderColor = DS.border; }}
            >
              <div className="flex items-center gap-2 mb-1">
                <div className="w-4 h-4 rounded-full shrink-0 flex items-center justify-center"
                  style={{ border: `2px solid ${billingInterval === "monthly" ? DS.brand : DS.labelText}` }}>
                  {billingInterval === "monthly" && (
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: DS.brand }} />
                  )}
                </div>
                <span className="text-sm font-black uppercase tracking-wide"
                  style={{ color: billingInterval === "monthly" ? DS.brand : DS.bodyText }}>
                  Monthly
                </span>
              </div>
              <p className="text-xs pl-6" style={{ color: DS.dimText }}>Pay month-to-month, cancel anytime</p>
            </button>

            {/* Annual */}
            <button type="button" onClick={() => setBillingInterval("yearly")}
              className="text-left p-4 transition-all relative"
              style={{
                border:          `2px solid ${billingInterval === "yearly" ? DS.safe : DS.border}`,
                backgroundColor: billingInterval === "yearly" ? DS.safeBg : "#fff",
                cursor:          "pointer",
                outline:         "none",
              }}
              onMouseEnter={(e) => { if (billingInterval !== "yearly") e.currentTarget.style.borderColor = DS.safeBorder; }}
              onMouseLeave={(e) => { if (billingInterval !== "yearly") e.currentTarget.style.borderColor = DS.border; }}
            >
              {/* Best value badge - top right corner */}
              <span className="absolute top-0 right-0 px-2 py-0.5 text-xs font-black uppercase tracking-wide"
                style={{ backgroundColor: DS.safe, color: "#fff" }}>
                Best value
              </span>
              <div className="flex items-center gap-2 mb-1 mt-1">
                <div className="w-4 h-4 rounded-full shrink-0 flex items-center justify-center"
                  style={{ border: `2px solid ${billingInterval === "yearly" ? DS.safe : DS.labelText}` }}>
                  {billingInterval === "yearly" && (
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: DS.safe }} />
                  )}
                </div>
                <span className="text-sm font-black uppercase tracking-wide"
                  style={{ color: billingInterval === "yearly" ? DS.safe : DS.bodyText }}>
                  Annual
                </span>
              </div>
              <p className="text-xs pl-6" style={{ color: billingInterval === "yearly" ? "#1A5C33" : DS.dimText }}>
                Save up to <strong>30%</strong> vs monthly - billed once a year
              </p>
            </button>
          </div>

          {/* Plan cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
            {TIER_DEFS.map((td) => {
              const isSel     = selectedTier === td.id;
              const isCurrent = billingState === "free" && td.id === "free";
              const pricing   = td.id === "free" ? td.yearly : td[billingInterval] || td.monthly;
              return (
                <button key={td.id} type="button" onClick={() => setSelectedTier(td.id)}
                  className="text-left p-4 transition-all"
                  style={{
                    border:          `2px solid ${isSel ? DS.brand : DS.border}`,
                    backgroundColor: isSel ? DS.brandBg : "#fff",
                    cursor:          "pointer",
                    outline:         "none",
                  }}
                  onMouseEnter={(e) => { if (!isSel) e.currentTarget.style.borderColor = DS.brandBorder; }}
                  onMouseLeave={(e) => { if (!isSel) e.currentTarget.style.borderColor = DS.border; }}
                >
                  <div className="flex items-start justify-between gap-1 mb-2 min-h-[20px]">
                    <span className="text-xs font-black uppercase tracking-wider" style={{ color: isSel ? DS.brand : DS.labelText }}>
                      {td.label}
                    </span>
                    {td.id !== "free" && pricing.savings && (
                      <span className="shrink-0 text-xs font-black px-1.5 py-0.5 uppercase tracking-wide"
                        style={{ backgroundColor: DS.safe, color: "#fff" }}>
                        {pricing.savings}
                      </span>
                    )}
                    {td.id !== "free" && !pricing.savings && td.badge && (
                      <span className="shrink-0 text-xs font-black px-1.5 py-0.5 uppercase tracking-wide"
                        style={{ backgroundColor: DS.brand, color: "#fff" }}>
                        {td.badge}
                      </span>
                    )}
                    {isCurrent && (
                      <span className="shrink-0 text-xs font-bold px-1.5 py-0.5"
                        style={{ backgroundColor: DS.safeBg, color: DS.safe, border: `1px solid ${DS.safeBorder}` }}>
                        Current
                      </span>
                    )}
                  </div>
                  <p className="text-xs mb-3" style={{ color: DS.dimText }}>{td.range}</p>
                  <p className="text-2xl font-black leading-none" style={{ color: DS.bodyText }}>{pricing.price}</p>
                  <p className="text-xs mt-1.5" style={{ color: DS.dimText }}>{pricing.note}</p>
                </button>
              );
            })}
          </div>

          {/* ── Founder's rate lock callout ── */}
          <div className="mb-5 px-4 py-4"
            style={{ backgroundColor: DS.brandBg, border: `1px solid ${DS.brandBorder}`, borderLeft: `3px solid ${DS.brand}` }}>
            <p className="text-xs font-black uppercase tracking-wider mb-1.5" style={{ color: DS.brand }}>
              Your rate, locked in for life
            </p>
            <p className="text-xs leading-relaxed" style={{ color: DS.bodyText }}>
              Sign up today and your base plan price never changes. As CheckPeak grows, what you pay now is what you'll
              always pay - no surprise increases.{" "}
              <strong style={{ color: DS.brand }}>This is our commitment to the organizations that believe in us early.</strong>{" "}
              Premium add-ons, like access to our in-house dietician services, are available separately through your account manager.
            </p>
          </div>

          {/* Profile completion warning - only required for paid tiers */}
          {selectedTier && selectedTier !== "free" && !isBillingProfileComplete && (
            <p className="text-xs mb-3 font-bold" style={{ color: DS.caution }}>
              Complete your billing profile first ({req.filled}/{req.total} fields required for checkout).
            </p>
          )}

          {/* CTA */}
          <div className="flex items-center gap-3 flex-wrap">
            <ActionButton
              onClick={() => { if (selectedTier) startCheckout(selectedTier); }}
              disabled={
                !canEdit || actionLoading || redirecting || !selectedTier ||
                (billingState === "free" && selectedTier === "free")
              }
            >
              {redirecting
                ? "Redirecting…"
                : actionLoading
                ? "Loading…"
                : !selectedTier
                ? "Select a plan above"
                : selectedTier === "free"
                ? billingState === "free" ? "Already on Starter" : "Activate free plan"
                : selectedTier === "small"
                ? billingInterval === "yearly" ? "Start trial - Growth ($599.88/yr)" : "Start trial - Growth ($69.99/mo)"
                : billingInterval === "yearly" ? "Start trial - Pro ($4,188/yr)"    : "Start trial - Pro ($499/mo)"}
            </ActionButton>

            {/* Back button - only shows when this was opened from the status card */}
            {showTierSelector && (
              <button type="button" onClick={() => { setShowTierSelector(false); setSelectedTier(""); }}
                className="text-xs font-bold hover:underline" style={{ color: DS.labelText }}>
                Cancel
              </button>
            )}
          </div>

          <p className="text-xs mt-4" style={{ color: DS.dimText }}>
            Free plan activates immediately. Paid plans redirect to Stripe - no credit card required to start the 30-day trial.
          </p>
        </div>
      ) : (
        /* ── Status card (active/trial/past_due/free/etc) ── */
        <div style={{ backgroundColor: stateCopy.accentBg, border: `1px solid ${stateCopy.border}`, borderLeft: `4px solid ${stateCopy.accent}` }}>

          {/* ── Header row: label + status pill ── */}
          <div className="flex items-center justify-between gap-3 px-5 pt-4 pb-3"
            style={{ borderBottom: `1px solid ${stateCopy.border}` }}>
            <p className="text-xs font-black uppercase tracking-widest" style={{ color: stateCopy.accent }}>
              Subscription
            </p>
            <StatusPill status={billingState === "free" ? "Free" : (stripeInfo?.status || "")} />
          </div>

          {/* ── State heading + body ── */}
          <div className="px-5 pt-4 pb-4">
            <p className="font-black mb-2"
              style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "1.35rem", letterSpacing: "0.02em", color: DS.bodyText }}>
              {stateCopy.heading}
            </p>
            <p className="text-sm leading-relaxed" style={{ color: DS.labelText }}>
              {stateCopy.body}
            </p>
          </div>

          {/* ── Date chips - only real subscription dates ── */}
          {dateRows.length > 0 && (
            <div className="flex flex-wrap gap-2 px-5 pb-4">
              {dateRows.map(({ label, value }) => (
                <div key={label} className="flex items-center gap-2 px-3 py-1.5 text-xs"
                  style={{ backgroundColor: DS.cardBg, border: `1px solid ${DS.border}` }}>
                  <span className="font-bold uppercase tracking-wider" style={{ color: DS.dimText }}>{label}</span>
                  <span className="font-black" style={{ color: DS.bodyText }}>{value}</span>
                </div>
              ))}
            </div>
          )}

          {/* ── Action buttons ── */}
          <div className="flex flex-col sm:flex-row gap-2 px-5 pb-5">
            {/* Free plan - upgrade */}
            {billingState === "free" && (
              <ActionButton onClick={() => { setShowTierSelector(true); setSelectedTier(""); }}>
                Upgrade plan
              </ActionButton>
            )}

            {/* No sub yet - choose a plan */}
            {!hasStripeSub && billingState !== "free" && (
              <ActionButton
                onClick={() => { setShowTierSelector(true); setSelectedTier(""); }}
                disabled={!canEdit || actionLoading || redirecting || !allowTrial}
              >
                {actionLoading ? "Loading…" : "Choose a plan"}
              </ActionButton>
            )}

            {/* Manage billing portal */}
            <ActionButton
              variant="secondary"
              onClick={openPortal}
              disabled={!canEdit || actionLoading || redirecting || !hasCustomer}
            >
              {redirecting ? "Redirecting…" : actionLoading ? "Loading…" : "Manage billing"}
            </ActionButton>
          </div>

          {/* ── Founder's rate reminder - shown to active/trial customers ── */}
          {(billingState === "active" || billingState === "trial") && (
            <div className="mx-5 mb-4 px-3 py-2.5"
              style={{ backgroundColor: DS.brandBg, border: `1px solid ${DS.brandBorder}`, borderLeft: `3px solid ${DS.brand}` }}>
              <p className="text-xs" style={{ color: DS.brand }}>
                <strong>Your base plan rate is locked in for life.</strong>{" "}
                <span style={{ color: DS.bodyText }}>As we grow and improve the platform, your price stays exactly where it is today. Premium add-ons are available separately through your account manager.</span>
              </p>
            </div>
          )}

          {/* ── Metadata footer ── */}
          {(stripeInfo?.stripeCustomerId || stripeInfo?.plan) && (
            <div className="flex flex-wrap items-center gap-4 px-5 py-2.5"
              style={{ borderTop: `1px solid ${stateCopy.border}` }}>
              {stripeInfo.plan && (
                <span className="text-xs" style={{ color: DS.dimText }}>
                  Plan: <span className="font-bold">{stripeInfo.plan}</span>
                </span>
              )}
              {stripeInfo.stripeCustomerId && (
                <span className="text-xs font-mono truncate" style={{ color: DS.dimText }}>
                  {stripeInfo.stripeCustomerId}
                </span>
              )}
              <span className="text-xs ml-auto" style={{ color: DS.dimText }}>Synced from Stripe</span>
            </div>
          )}
        </div>
      )}

      {/* ── Collapsible editable sections ─────────────────────────────── */}
      <Section title="Billing Contact" subtitle="Who we contact for invoices, receipts, and billing questions."
        open={openContact} onToggle={() => setOpenContact((v) => !v)}>
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
              {data.billingEmail && !isEmail(data.billingEmail) && (
                <FieldHint error>Email address looks invalid.</FieldHint>
              )}
            </div>
            <div>
              <FieldLabel>Billing Phone</FieldLabel>
              <TextInput type="tel" value={data.billingPhone} onChange={(e) => onField("billingPhone", e.target.value)} placeholder="+15551234567" disabled={!canEdit} />
            </div>
          </div>
        )}
      </Section>

      <Section title="Billing Address" subtitle="Required for invoicing, tax rules, and some payment methods."
        open={openAddress} onToggle={() => setOpenAddress((v) => !v)}>
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

      <Section title="Business & Tax" subtitle="Legal name is required. Tax fields are optional unless you need tax-exempt handling."
        open={openBusiness} onToggle={() => setOpenBusiness((v) => !v)}>
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

      <Section title="Payment & PO" subtitle="Set expectations for invoicing and purchasing workflows."
        open={openPayment} onToggle={() => setOpenPayment((v) => !v)}>
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
          </div>
        )}
      </Section>

      <Section title="Bank / Wire (optional)" subtitle="Store last-4 only. Full banking details should live in Stripe or your finance system."
        open={openBank} onToggle={() => setOpenBank((v) => !v)}>
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
