// components/org/dashboard/BillingGateScreen.jsx
"use client";

import { ArrowRight, LogOut, Lock, AlertTriangle, CreditCard, Clock } from "lucide-react";
import { DS, Button } from "@/components/org/dashboard/DashboardUI";
import { fmtDate } from "./format";

function deriveState(billing) {
  const s = String(billing?.statusRaw || billing?.status || "").toLowerCase();
  if (s.includes("past") || s.includes("due"))          return "past_due";
  if (s.includes("unpaid") || s.includes("suspend"))    return "suspended";
  if (s.includes("cancel"))                             return "canceled";
  if (s === "active")                                   return "active";
  if (s.includes("trial"))                              return "trial_ended";
  // No status at all — check if sandbox data exists
  if (billing?.sandboxEnds)                             return "sandbox_expired";
  return "not_started";
}

const STATE_CONFIG = {
  not_started: {
    icon:     Lock,
    iconBg:   DS.brandBg,
    iconColor: DS.brand,
    accent:   DS.brand,
    title:    "Subscription required",
    body:     "Start your 30-day free trial to unlock your organization's access.",
    ctaLabel: "Go to billing",
  },
  sandbox_expired: {
    icon:     Clock,
    iconBg:   DS.cautionBg,
    iconColor: DS.caution,
    accent:   DS.caution,
    title:    "Free trial expired",
    body:     "Your 14-day sandbox period has ended. Start a subscription to continue.",
    ctaLabel: "Start subscription",
  },
  trial_ended: {
    icon:     Clock,
    iconBg:   DS.cautionBg,
    iconColor: DS.caution,
    accent:   DS.caution,
    title:    "Trial ended",
    body:     "Your free trial has expired. Add a payment method to reactivate access.",
    ctaLabel: "Manage billing",
  },
  past_due: {
    icon:     AlertTriangle,
    iconBg:   "#FFF0F0",
    iconColor: DS.banned,
    accent:   DS.banned,
    title:    "Payment past due",
    body:     "A recent payment failed. Update your payment method to restore access.",
    ctaLabel: "Update payment",
  },
  suspended: {
    icon:     AlertTriangle,
    iconBg:   "#FFF0F0",
    iconColor: DS.banned,
    accent:   DS.banned,
    title:    "Access suspended",
    body:     "Your subscription is unpaid and access has been suspended.",
    ctaLabel: "Resolve billing",
  },
  canceled: {
    icon:     CreditCard,
    iconBg:   DS.pageBg,
    iconColor: DS.dimText,
    accent:   DS.labelText,
    title:    "Subscription canceled",
    body:     "Your subscription was canceled. Start a new subscription to reactivate.",
    ctaLabel: "Reactivate",
  },
};

export default function BillingGateScreen({ role, billing, error, onLogout, onGoAccount }) {
  const canManage = role === "admin" || role === "organization";
  const state     = deriveState(billing);
  const cfg       = STATE_CONFIG[state] || STATE_CONFIG.not_started;
  const Icon      = cfg.icon;

  const trialDate    = fmtDate(billing?.trialEnds);
  const sandboxDate  = fmtDate(billing?.sandboxEnds);
  const periodDate   = fmtDate(billing?.currentPeriodEnd);

  const infoRows = [
    billing?.statusRaw && { label: "Status",      value: billing.statusRaw },
    trialDate          && { label: "Trial ended",  value: trialDate },
    sandboxDate        && { label: "Sandbox ended", value: sandboxDate },
    periodDate         && { label: "Period end",   value: periodDate },
  ].filter(Boolean);

  return (
    <div className="min-h-screen flex items-center justify-center px-4"
      style={{ backgroundColor: DS.pageBg }}>
      <div className="w-full max-w-md"
        style={{ backgroundColor: DS.cardBg, border: `1px solid ${DS.border}`, borderTop: `3px solid ${cfg.accent}` }}>

        {/* Header */}
        <div className="px-5 py-4 flex items-start gap-3" style={{ borderBottom: `1px solid ${DS.border}` }}>
          <div className="w-8 h-8 flex items-center justify-center shrink-0"
            style={{ backgroundColor: cfg.iconBg, border: `1px solid ${cfg.accent}22` }}>
            <Icon className="w-4 h-4" style={{ color: cfg.iconColor }} />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-black uppercase tracking-widest" style={{ color: cfg.accent }}>
              CheckPeak
            </p>
            <h1 className="text-lg font-black mt-0.5" style={{ color: DS.bodyText }}>
              {cfg.title}
            </h1>
            <p className="text-xs mt-1 leading-relaxed" style={{ color: DS.labelText }}>
              {cfg.body}
            </p>
          </div>
        </div>

        <div className="p-5">
          {error ? (
            <div className="p-3 text-xs font-bold mb-4"
              style={{ backgroundColor: "#FFF0F0", border: `1px solid ${DS.bannedBorder}`, color: DS.banned }}>
              {error}
            </div>
          ) : infoRows.length > 0 ? (
            <div className="grid grid-cols-2 gap-px mb-5" style={{ backgroundColor: DS.border }}>
              {infoRows.map(({ label, value }) => (
                <div key={label} className="p-3" style={{ backgroundColor: DS.pageBg }}>
                  <p className="text-xs uppercase tracking-wider font-black" style={{ color: DS.dimText }}>{label}</p>
                  <p className="text-sm font-black mt-1" style={{ color: DS.bodyText }}>{value}</p>
                </div>
              ))}
            </div>
          ) : null}

          <div className="flex flex-col gap-2">
            {canManage ? (
              <Button onClick={onGoAccount} className="w-full justify-center">
                {cfg.ctaLabel} <ArrowRight className="w-3.5 h-3.5" />
              </Button>
            ) : (
              <div className="text-xs p-3"
                style={{ backgroundColor: DS.pageBg, border: `1px solid ${DS.border}`, color: DS.labelText }}>
                Ask your Org Owner or Admin to update billing in{" "}
                <strong>Account → Billing</strong>.
              </div>
            )}
            <Button variant="secondary" onClick={onLogout} className="w-full justify-center">
              <LogOut className="w-3.5 h-3.5" /> Log out
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
