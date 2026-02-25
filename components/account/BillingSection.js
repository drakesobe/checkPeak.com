"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";

function classNames(...xs) {
  return xs.filter(Boolean).join(" ");
}

async function safeJson(res) {
  try {
    return await res.json();
  } catch {
    return {};
  }
}

function fmtDate(v) {
  if (!v) return "—";
  try {
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) return String(v);
    return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  } catch {
    return String(v);
  }
}

function normalizePhone(v) {
  return String(v || "").trim();
}

function isEmail(v) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v || ""));
}

function completionScore(data) {
  const required = [
    "billingName",
    "billingEmail",
    "billingAddress1",
    "billingCity",
    "billingState",
    "billingPostal",
    "billingCountry",
    "legalBusinessName",
  ];

  const filled = required.filter((k) => String(data?.[k] || "").trim().length > 0).length;
  return { filled, total: required.length };
}

function Section({ title, subtitle, open, onToggle, children, right }) {
  return (
    <div className="rounded-3xl border border-gray-200 bg-white overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="w-full text-left px-5 py-4 flex items-start justify-between gap-3 hover:bg-gray-50 transition"
      >
        <div className="min-w-0">
          <div className="text-sm font-semibold text-gray-900">{title}</div>
          {subtitle ? <div className="text-[12px] text-gray-600 mt-1">{subtitle}</div> : null}
        </div>
        <div className="shrink-0 flex items-center gap-3">
          {right ? <div className="hidden sm:block">{right}</div> : null}
          <div
            className={classNames(
              "h-8 w-8 rounded-2xl grid place-items-center border text-gray-600",
              open ? "bg-gray-100 border-gray-200" : "bg-white border-gray-200"
            )}
            aria-hidden
          >
            {open ? "–" : "+"}
          </div>
        </div>
      </button>

      <AnimatePresence initial={false}>
        {open ? (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18 }}
          >
            <div className="px-5 pb-5">{children}</div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

/**
 * BillingSection
 *
 * Props:
 * - memberId: string
 * - role: string
 * - onDirtyChange?: (dirty: boolean) => void
 * - onRegisterSave?: (fn: () => Promise<{ok:boolean; skipped?:boolean}>) => void
 */
export default function BillingSection({ memberId, role, onDirtyChange, onRegisterSave }) {
  const canEdit = role === "admin" || role === "organization";

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  const [canStartTrial, setCanStartTrial] = useState(false);

  // Expanded editable fields to match your Airtable schema (+ our API get/update)
  const [data, setData] = useState({
    // Billing Contact
    billingName: "",
    billingEmail: "",
    billingPhone: "",
    billingRoleTitle: "",

    // Address
    billingAddress1: "",
    billingAddress2: "",
    billingCity: "",
    billingState: "",
    billingPostal: "",
    billingCountry: "",

    // Business identity / tax
    legalBusinessName: "",
    dbaName: "",
    businessType: "", // LLC, Corp, Nonprofit, School, Individual, Other
    taxIdType: "", // EIN, VAT, GST, Other
    taxIdLast4: "",
    taxExempt: false,
    taxExemptCertUrl: "",

    // Preferences / terms
    preferredPaymentMethod: "", // Card, ACH, Invoice, Wire, Other
    paymentTerms: "", // Due on receipt, Net 15, Net 30
    poRequired: false,
    poNumber: "",

    // Bank / wire metadata (last4 only)
    bankName: "",
    routingLast4: "",
    accountLast4: "",
    wireInstructions: "",

    // Optional notes
    invoiceNotes: "",
    notes: "",
  });

  // Stripe-derived fields (read-only)
  const [stripeInfo, setStripeInfo] = useState({
    plan: "",
    status: "",
    stripeCustomerId: "",
    stripeSubscriptionId: "",
    trialEnds: "",
    currentPeriodEnd: "",
    renewalDate: "",
  });

  const [original, setOriginal] = useState(null);

  const hasChanges = useMemo(() => {
    if (!original) return false;
    const keys = Object.keys(data);
    return keys.some((k) => String(data[k] ?? "") !== String(original[k] ?? ""));
  }, [data, original]);

  const inputBase =
    "w-full border border-gray-200 rounded-2xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-[#46769B]/30 transition text-gray-900 placeholder:text-gray-400";
  const readOnlyBase = "w-full border border-gray-200 rounded-2xl px-4 py-2 bg-gray-50 text-gray-700";
  const labelBase = "block text-gray-800 font-medium mb-1";
  const pill = "inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold";

  const [openContact, setOpenContact] = useState(true);
  const [openAddress, setOpenAddress] = useState(false);
  const [openBusiness, setOpenBusiness] = useState(false);
  const [openPayment, setOpenPayment] = useState(false);
  const [openBank, setOpenBank] = useState(false);

  // ✅ Load billing via session token (no orgId required)
  useEffect(() => {
    let mounted = true;

    async function load() {
      setLoading(true);
      setErr("");
      setMsg("");

      try {
        const res = await fetch(`/api/org/billing/get`, {
          method: "GET",
          credentials: "include",
        });

        const json = await safeJson(res);
        if (!res.ok) throw new Error(json?.error || "Failed to load billing.");

        const b = json?.billing || {};

        const next = {
          billingName: b?.billingName || "",
          billingEmail: b?.billingEmail || "",
          billingPhone: b?.billingPhone || "",
          billingRoleTitle: b?.billingRoleTitle || "",

          billingAddress1: b?.billingAddress1 || "",
          billingAddress2: b?.billingAddress2 || "",
          billingCity: b?.billingCity || "",
          billingState: b?.billingState || "",
          billingPostal: b?.billingPostal || "",
          billingCountry: b?.billingCountry || "",

          legalBusinessName: b?.legalBusinessName || "",
          dbaName: b?.dbaName || "",
          businessType: b?.businessType || "",
          taxIdType: b?.taxIdType || "",
          taxIdLast4: b?.taxIdLast4 || "",
          taxExempt: Boolean(b?.taxExempt),
          taxExemptCertUrl: b?.taxExemptCertUrl || "",

          preferredPaymentMethod: b?.preferredPaymentMethod || "",
          paymentTerms: b?.paymentTerms || "",
          poRequired: Boolean(b?.poRequired),
          poNumber: b?.poNumber || "",

          bankName: b?.bankName || "",
          routingLast4: b?.routingLast4 || "",
          accountLast4: b?.accountLast4 || "",
          wireInstructions: b?.wireInstructions || "",

          invoiceNotes: b?.invoiceNotes || "",
          notes: b?.notes || "",
        };

        const nextStripe = {
          plan: b?.plan || "",
          status: b?.status || "",
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
    }

    load();
    return () => {
      mounted = false;
    };
  }, []);

  const onField = (name, value) => setData((prev) => ({ ...prev, [name]: value }));

  // Minimal required for "we can invoice you / identify org"
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

  const onSave = useCallback(async () => {
    if (!canEdit || saving || !hasChanges) return;

    setSaving(true);
    setErr("");
    setMsg("");

    try {
      const payload = {
        ...data,
        billingPhone: normalizePhone(data.billingPhone),
        taxIdLast4: String(data.taxIdLast4 || "").replace(/\D/g, "").slice(-4),
        routingLast4: String(data.routingLast4 || "").replace(/\D/g, "").slice(-4),
        accountLast4: String(data.accountLast4 || "").replace(/\D/g, "").slice(-4),
      };

      const res = await fetch("/api/org/billing/update", {
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

  // ---- Bridge: tell parent when dirty changes ----
  useEffect(() => {
    onDirtyChange?.(Boolean(hasChanges));
  }, [hasChanges, onDirtyChange]);

  // ---- Bridge: register a callable save function for parent ----
  useEffect(() => {
    onRegisterSave?.(async () => {
      if (!canEdit || saving || loading || !hasChanges) return { ok: false, skipped: true };
      await onSave();
      return { ok: true };
    });
  }, [onRegisterSave, canEdit, saving, loading, hasChanges, onSave]);

  const openPortal = async () => {
    if (!canEdit || actionLoading) return;

    setActionLoading(true);
    setErr("");
    setMsg("");

    try {
      const res = await fetch("/api/stripe/customer-portal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({}),
      });

      const json = await safeJson(res);
      if (!res.ok) throw new Error(json?.error || "Failed to open billing portal.");
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

    // Gate trial by minimum billing completeness (you can adjust this rule)
    if (!isBillingProfileComplete) {
      setErr(
        `Please complete billing profile first (${req.filled}/${req.total}). We need a billing contact + address + legal name before starting trial.`
      );
      setOpenContact(true);
      setOpenAddress(true);
      setOpenBusiness(true);
      return;
    }

    setActionLoading(true);
    setErr("");
    setMsg("");

    try {
      const res = await fetch("/api/stripe/create-checkout-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({}),
      });

      const json = await safeJson(res);
      if (!res.ok) throw new Error(json?.error || "Failed to start checkout.");
      if (!json?.url) throw new Error("Stripe did not return a checkout URL.");

      window.location.href = json.url;
    } catch (e) {
      setErr(e?.message || "Failed to start trial.");
    } finally {
      setActionLoading(false);
    }
  };

  // ✅ Canonical: if Stripe Subscription ID exists, trial button is NOT available
  const hasStripeSub = Boolean(String(stripeInfo?.stripeSubscriptionId || "").trim());
  const allowStartTrial = Boolean(canStartTrial) && !hasStripeSub;

  const statusPill = (() => {
    const s = String(stripeInfo?.status || "").toLowerCase();
    if (!s) return { text: "Not started", cls: "bg-gray-50 text-gray-700" };
    if (s.includes("trial")) return { text: "Trial", cls: "bg-blue-50 text-[#46769B]" };
    if (s.includes("active")) return { text: "Active", cls: "bg-emerald-50 text-emerald-800" };
    if (s.includes("past")) return { text: "Past Due", cls: "bg-amber-50 text-amber-800" };
    if (s.includes("cancel")) return { text: "Canceled", cls: "bg-gray-100 text-gray-700" };
    if (s.includes("suspend") || s.includes("unpaid")) return { text: "Suspended", cls: "bg-red-50 text-red-700" };
    return { text: stripeInfo.status, cls: "bg-gray-50 text-gray-700" };
  })();

  return (
    <div className="mt-6 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Billing (Admin)</h2>
          <p className="text-[12px] text-gray-600 mt-1">
            Billing profile + subscription settings. Only Admins and Org Owners can view/edit this.
          </p>

          <div className="mt-3 flex flex-wrap gap-2">
            <span className={classNames(pill, statusPill.cls)}>{statusPill.text}</span>

            <span
              className={classNames(
                pill,
                isBillingProfileComplete ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-800"
              )}
            >
              Billing profile: {req.filled}/{req.total}
            </span>

            {stripeInfo?.plan ? (
              <span className={classNames(pill, "bg-gray-50 text-gray-700")}>Plan: {stripeInfo.plan}</span>
            ) : null}
          </div>
        </div>

        <button
          type="button"
          onClick={onSave}
          disabled={!canEdit || saving || !hasChanges || loading}
          className={classNames(
            "px-4 py-2 rounded-2xl font-semibold transition shadow-sm",
            !canEdit || saving || !hasChanges || loading
              ? "bg-gray-200 text-gray-500 cursor-not-allowed"
              : "bg-[#46769B] text-white hover:brightness-110"
          )}
        >
          {saving ? "Saving..." : "Save Billing"}
        </button>
      </div>

      <AnimatePresence>
        {(msg || err) && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className={classNames(
              "text-sm font-medium py-3 px-4 rounded-2xl border",
              msg ? "bg-emerald-50 text-emerald-800 border-emerald-100" : "bg-red-50 text-red-700 border-red-100"
            )}
          >
            {msg || err}
          </motion.div>
        )}
      </AnimatePresence>

      {!!billingWarnings.length && (
        <div className="rounded-3xl border border-amber-100 bg-amber-50 px-5 py-4 text-amber-900">
          <div className="text-sm font-semibold">Check these fields</div>
          <ul className="mt-2 text-[12px] list-disc list-inside space-y-1">
            {billingWarnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Subscription (Stripe read-only) */}
      <div className="rounded-3xl border border-gray-200 bg-gray-50 p-5">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-900">Subscription</p>
            <p className="text-[12px] text-gray-600 mt-1">
              Start your 30-day free trial on the annual plan, or manage payment details in the Stripe portal.
            </p>

            <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div>
                <label className="text-[11px] font-semibold text-gray-600">Trial ends</label>
                <div className={classNames(readOnlyBase, "mt-1")}>{fmtDate(stripeInfo.trialEnds)}</div>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-gray-600">Current period end</label>
                <div className={classNames(readOnlyBase, "mt-1")}>{fmtDate(stripeInfo.currentPeriodEnd)}</div>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-gray-600">Renewal date</label>
                <div className={classNames(readOnlyBase, "mt-1")}>{fmtDate(stripeInfo.renewalDate)}</div>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-gray-600">Stripe customer</label>
                <div className={classNames(readOnlyBase, "mt-1 font-mono truncate")}>
                  {stripeInfo.stripeCustomerId || "—"}
                </div>
              </div>
            </div>

            <p className="text-[11px] text-gray-500 mt-3">
              Plan/status/dates/Stripe IDs are read-only here and are synced from Stripe webhooks.
            </p>
          </div>

          <div className="shrink-0 flex flex-col gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={startTrial}
              disabled={!canEdit || actionLoading || !allowStartTrial}
              className={classNames(
                "px-4 py-2 rounded-2xl font-semibold transition",
                !canEdit || actionLoading || !allowStartTrial
                  ? "bg-gray-200 text-gray-500 cursor-not-allowed"
                  : "bg-[#46769B] text-white hover:brightness-110"
              )}
            >
              {hasStripeSub ? "Subscription Started" : actionLoading ? "Loading..." : "Start 30-day Trial"}
            </button>

            <button
              type="button"
              onClick={openPortal}
              disabled={!canEdit || actionLoading || !stripeInfo.stripeCustomerId}
              className={classNames(
                "px-4 py-2 rounded-2xl font-semibold transition border",
                !canEdit || actionLoading || !stripeInfo.stripeCustomerId
                  ? "bg-white text-gray-400 border-gray-200 cursor-not-allowed"
                  : "bg-white text-gray-800 border-gray-200 hover:bg-gray-50"
              )}
            >
              Manage Billing
            </button>
          </div>
        </div>
      </div>

      {/* Editable sections */}
      <Section
        title="Billing Contact"
        subtitle="Who we contact for invoices, receipts, and billing questions."
        open={openContact}
        onToggle={() => setOpenContact((v) => !v)}
      >
        {loading ? (
          <div className="text-sm text-gray-600">Loading…</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={labelBase}>Billing Contact Name *</label>
              <input
                className={inputBase}
                value={data.billingName}
                onChange={(e) => onField("billingName", e.target.value)}
                placeholder="Primary billing contact"
                disabled={!canEdit}
              />
            </div>

            <div>
              <label className={labelBase}>Billing Role/Title</label>
              <input
                className={inputBase}
                value={data.billingRoleTitle}
                onChange={(e) => onField("billingRoleTitle", e.target.value)}
                placeholder="Athletic Director, Admin, etc."
                disabled={!canEdit}
              />
            </div>

            <div>
              <label className={labelBase}>Billing Email *</label>
              <input
                className={inputBase}
                value={data.billingEmail}
                onChange={(e) => onField("billingEmail", e.target.value)}
                placeholder="billing@school.edu"
                disabled={!canEdit}
              />
            </div>

            <div>
              <label className={labelBase}>Billing Phone</label>
              <input
                className={inputBase}
                value={data.billingPhone}
                onChange={(e) => onField("billingPhone", e.target.value)}
                placeholder="+15551234567"
                disabled={!canEdit}
              />
            </div>

            <div className="md:col-span-2">
              <label className={labelBase}>Invoice Notes</label>
              <textarea
                className={classNames(inputBase, "min-h-[90px]")}
                value={data.invoiceNotes}
                onChange={(e) => onField("invoiceNotes", e.target.value)}
                placeholder="Anything helpful for billing (invoice email rules, department, etc.)"
                disabled={!canEdit}
              />
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
        {loading ? (
          <div className="text-sm text-gray-600">Loading…</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className={labelBase}>Address Line 1 *</label>
              <input
                className={inputBase}
                value={data.billingAddress1}
                onChange={(e) => onField("billingAddress1", e.target.value)}
                placeholder="Street address"
                disabled={!canEdit}
              />
            </div>

            <div className="md:col-span-2">
              <label className={labelBase}>Address Line 2</label>
              <input
                className={inputBase}
                value={data.billingAddress2}
                onChange={(e) => onField("billingAddress2", e.target.value)}
                placeholder="Suite, department, mail stop"
                disabled={!canEdit}
              />
            </div>

            <div>
              <label className={labelBase}>City *</label>
              <input
                className={inputBase}
                value={data.billingCity}
                onChange={(e) => onField("billingCity", e.target.value)}
                placeholder="City"
                disabled={!canEdit}
              />
            </div>

            <div>
              <label className={labelBase}>State/Province *</label>
              <input
                className={inputBase}
                value={data.billingState}
                onChange={(e) => onField("billingState", e.target.value)}
                placeholder="State/Province"
                disabled={!canEdit}
              />
            </div>

            <div>
              <label className={labelBase}>Postal Code *</label>
              <input
                className={inputBase}
                value={data.billingPostal}
                onChange={(e) => onField("billingPostal", e.target.value)}
                placeholder="ZIP / Postal"
                disabled={!canEdit}
              />
            </div>

            <div>
              <label className={labelBase}>Country *</label>
              <select
                className={inputBase}
                value={data.billingCountry}
                onChange={(e) => onField("billingCountry", e.target.value)}
                disabled={!canEdit}
              >
                <option value="">Select…</option>
                <option value="United States">United States</option>
                <option value="Canada">Canada</option>
                <option value="United Kingdom">United Kingdom</option>
                <option value="Other">Other</option>
              </select>
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
        {loading ? (
          <div className="text-sm text-gray-600">Loading…</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={labelBase}>Legal Business Name *</label>
              <input
                className={inputBase}
                value={data.legalBusinessName}
                onChange={(e) => onField("legalBusinessName", e.target.value)}
                placeholder="Legal entity name"
                disabled={!canEdit}
              />
            </div>

            <div>
              <label className={labelBase}>DBA Name</label>
              <input
                className={inputBase}
                value={data.dbaName}
                onChange={(e) => onField("dbaName", e.target.value)}
                placeholder="Doing business as"
                disabled={!canEdit}
              />
            </div>

            <div>
              <label className={labelBase}>Business Type</label>
              <select
                className={inputBase}
                value={data.businessType}
                onChange={(e) => onField("businessType", e.target.value)}
                disabled={!canEdit}
              >
                <option value="">Select…</option>
                <option value="LLC">LLC</option>
                <option value="Corp">Corp</option>
                <option value="Nonprofit">Nonprofit</option>
                <option value="School">School</option>
                <option value="Individual">Individual</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div>
              <label className={labelBase}>Tax ID Type</label>
              <select
                className={inputBase}
                value={data.taxIdType}
                onChange={(e) => onField("taxIdType", e.target.value)}
                disabled={!canEdit}
              >
                <option value="">Select…</option>
                <option value="EIN">EIN</option>
                <option value="VAT">VAT</option>
                <option value="GST">GST</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div>
              <label className={labelBase}>Tax ID (Last 4 only)</label>
              <input
                className={inputBase}
                value={data.taxIdLast4}
                onChange={(e) => onField("taxIdLast4", e.target.value)}
                placeholder="1234"
                disabled={!canEdit}
                inputMode="numeric"
              />
              <p className="text-[11px] text-gray-500 mt-2">Do not store full Tax IDs in the app.</p>
            </div>

            <div className="flex items-center gap-3 mt-2 md:mt-0">
              <input
                id="taxExempt"
                type="checkbox"
                className="h-4 w-4"
                checked={Boolean(data.taxExempt)}
                onChange={(e) => onField("taxExempt", e.target.checked)}
                disabled={!canEdit}
              />
              <label htmlFor="taxExempt" className="text-sm font-semibold text-gray-800">
                Tax Exempt
              </label>
            </div>

            <div className="md:col-span-2">
              <label className={labelBase}>Tax Exempt Certificate URL</label>
              <input
                className={inputBase}
                value={data.taxExemptCertUrl}
                onChange={(e) => onField("taxExemptCertUrl", e.target.value)}
                placeholder="https://..."
                disabled={!canEdit}
              />
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
        {loading ? (
          <div className="text-sm text-gray-600">Loading…</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={labelBase}>Preferred Payment Method</label>
              <select
                className={inputBase}
                value={data.preferredPaymentMethod}
                onChange={(e) => onField("preferredPaymentMethod", e.target.value)}
                disabled={!canEdit}
              >
                <option value="">Select…</option>
                <option value="Card">Card</option>
                <option value="ACH">ACH</option>
                <option value="Invoice">Invoice</option>
                <option value="Wire">Wire</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div>
              <label className={labelBase}>Payment Terms</label>
              <select
                className={inputBase}
                value={data.paymentTerms}
                onChange={(e) => onField("paymentTerms", e.target.value)}
                disabled={!canEdit}
              >
                <option value="">Select…</option>
                <option value="Due on receipt">Due on receipt</option>
                <option value="Net 15">Net 15</option>
                <option value="Net 30">Net 30</option>
              </select>
            </div>

            <div className="flex items-center gap-3 mt-2">
              <input
                id="poRequired"
                type="checkbox"
                className="h-4 w-4"
                checked={Boolean(data.poRequired)}
                onChange={(e) => onField("poRequired", e.target.checked)}
                disabled={!canEdit}
              />
              <label htmlFor="poRequired" className="text-sm font-semibold text-gray-800">
                PO Required
              </label>
            </div>

            <div>
              <label className={labelBase}>PO Number</label>
              <input
                className={inputBase}
                value={data.poNumber}
                onChange={(e) => onField("poNumber", e.target.value)}
                placeholder="PO-12345"
                disabled={!canEdit}
              />
            </div>

            <div className="md:col-span-2">
              <label className={labelBase}>Internal Billing Notes</label>
              <textarea
                className={classNames(inputBase, "min-h-[90px]")}
                value={data.notes}
                onChange={(e) => onField("notes", e.target.value)}
                placeholder="Internal notes (not visible to customers)"
                disabled={!canEdit}
              />
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
        {loading ? (
          <div className="text-sm text-gray-600">Loading…</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={labelBase}>Bank Name</label>
              <input
                className={inputBase}
                value={data.bankName}
                onChange={(e) => onField("bankName", e.target.value)}
                placeholder="Bank / Institution"
                disabled={!canEdit}
              />
            </div>

            <div />

            <div>
              <label className={labelBase}>Routing (Last 4)</label>
              <input
                className={inputBase}
                value={data.routingLast4}
                onChange={(e) => onField("routingLast4", e.target.value)}
                placeholder="1234"
                disabled={!canEdit}
                inputMode="numeric"
              />
            </div>

            <div>
              <label className={labelBase}>Account (Last 4)</label>
              <input
                className={inputBase}
                value={data.accountLast4}
                onChange={(e) => onField("accountLast4", e.target.value)}
                placeholder="5678"
                disabled={!canEdit}
                inputMode="numeric"
              />
            </div>

            <div className="md:col-span-2">
              <label className={labelBase}>Wire Instructions</label>
              <textarea
                className={classNames(inputBase, "min-h-[110px]")}
                value={data.wireInstructions}
                onChange={(e) => onField("wireInstructions", e.target.value)}
                placeholder="If needed (optional)."
                disabled={!canEdit}
              />
              <p className="text-[11px] text-gray-500 mt-2">
                If you ever plan to support invoicing/wire at scale, this eventually moves to a finance workflow instead of
                the app.
              </p>
            </div>
          </div>
        )}
      </Section>
    </div>
  );
}