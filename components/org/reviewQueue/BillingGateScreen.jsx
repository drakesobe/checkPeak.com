"use client";

import { Lock, ArrowRight, LogOut, AlertTriangle, Clock, CreditCard, CheckCircle2, RefreshCw } from "lucide-react";

const ACCENT = "#1E3A5F";
const CAUTION = "#E87722";
const BANNED  = "#C8102E";

function fmtDate(v) {
  if (!v) return null;
  try {
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) return null;
    return new Intl.DateTimeFormat("en-US", { year: "numeric", month: "short", day: "numeric" }).format(d);
  } catch { return null; }
}

function deriveState(billing) {
  const s = String(billing?.statusRaw || billing?.status || "").toLowerCase();
  if (s.includes("past") || s.includes("due"))          return "past_due";
  if (s.includes("unpaid") || s.includes("suspend"))    return "suspended";
  if (s.includes("cancel"))                             return "canceled";
  if (s === "active")                                   return "active";
  if (s === "free" || s === "starter" || s.includes("starter")) return "starter_plan";
  if (s.includes("trial"))                              return "trial_ended";
  if (s.includes("session_expired") || s === "session_expired") return "session_expired";
  if (billing?.sandboxEnds)                             return "sandbox_expired";
  return "not_started";
}

const STATE_CONFIG = {
  starter_plan: {
    icon: CheckCircle2, accent: "#00873E",
    title: "Starter plan — access issue",
    body:  "Your account is on the Starter plan and should have access. Try logging out and back in. If this persists, contact support.",
    cta:   "Go to account",
  },
  not_started: {
    icon: Lock, accent: ACCENT,
    title: "Subscription required",
    body:  "Start your 30-day free trial to unlock access to the Review Queue.",
    cta:   "Go to billing",
  },
  sandbox_expired: {
    icon: Clock, accent: CAUTION,
    title: "Free trial expired",
    body:  "Your 14-day sandbox period has ended. Start a subscription to continue.",
    cta:   "Start subscription",
  },
  trial_ended: {
    icon: Clock, accent: CAUTION,
    title: "Trial ended",
    body:  "Your free trial has expired. Add a payment method to restore access.",
    cta:   "Manage billing",
  },
  past_due: {
    icon: AlertTriangle, accent: BANNED,
    title: "Payment past due",
    body:  "A recent payment failed. Update your payment method to restore access.",
    cta:   "Update payment",
  },
  suspended: {
    icon: AlertTriangle, accent: BANNED,
    title: "Access suspended",
    body:  "Your subscription is unpaid and access has been suspended.",
    cta:   "Resolve billing",
  },
  canceled: {
    icon: CreditCard, accent: "#6B7A8D",
    title: "Subscription canceled",
    body:  "Your subscription was canceled. Start a new subscription to reactivate.",
    cta:   "Reactivate",
  },
  session_expired: {
    icon: RefreshCw, accent: "#6B7A8D",
    title: "Session expired",
    body:  "You've been away for a while and your session timed out. Sign in again to pick up where you left off.",
    cta:   "Sign in again",
  },
};

export default function BillingGateScreen({ role, billing, error, onLogout, onGoAccount }) {
  const canManageBilling = role === "admin" || role === "organization";
  const state  = deriveState(billing);
  const cfg    = STATE_CONFIG[state] || STATE_CONFIG.not_started;
  const Icon   = cfg.icon;

  const trialDate   = fmtDate(billing?.trialEnds);
  const sandboxDate = fmtDate(billing?.sandboxEnds);
  const periodDate  = fmtDate(billing?.currentPeriodEnd);

  const infoRows = [
    billing?.statusRaw && { label: "Status",       value: billing.statusRaw },
    trialDate          && { label: "Trial ended",  value: trialDate },
    sandboxDate        && { label: "Sandbox ended", value: sandboxDate },
    periodDate         && { label: "Period end",   value: periodDate },
  ].filter(Boolean);

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10"
      style={{ backgroundColor: "#F7F9FC" }}>
      <div className="w-full max-w-md rounded-sm overflow-hidden"
        style={{ backgroundColor: "#fff", border: "1px solid #E8ECF0", borderTop: `3px solid ${cfg.accent}` }}>

        {/* Header */}
        <div className="px-6 py-5 flex items-start gap-3"
          style={{ borderBottom: "1px solid #E8ECF0" }}>
          <div className="shrink-0 w-9 h-9 flex items-center justify-center rounded-sm"
            style={{ backgroundColor: `${cfg.accent}14`, border: `1px solid ${cfg.accent}30` }}>
            <Icon className="w-4 h-4" style={{ color: cfg.accent }} />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-black uppercase tracking-widest" style={{ color: cfg.accent }}>
              CheckPeak
            </p>
            <h1 className="text-xl font-black mt-0.5" style={{ color: "#2D3748" }}>
              {cfg.title}
            </h1>
            <p className="text-sm mt-1 leading-relaxed" style={{ color: "#6B7A8D" }}>
              {cfg.body}
            </p>
          </div>
        </div>

        <div className="p-5">
          {error ? (
            <div className="mb-4 p-3 text-xs font-bold rounded-sm"
              style={{ backgroundColor: "#FFF0F0", border: "1px solid #FFC8C8", color: BANNED }}>
              {error}
            </div>
          ) : infoRows.length > 0 ? (
            <div className="grid grid-cols-2 gap-2 mb-5">
              {infoRows.map(({ label, value }) => (
                <div key={label} className="p-3 rounded-sm"
                  style={{ backgroundColor: "#F7F9FC", border: "1px solid #E8ECF0" }}>
                  <p className="text-xs font-bold uppercase tracking-wider mb-1" style={{ color: "#9BA8B4" }}>
                    {label}
                  </p>
                  <p className="text-sm font-black" style={{ color: "#2D3748" }}>{value}</p>
                </div>
              ))}
            </div>
          ) : null}

          <div className="flex flex-col gap-2">
            {state === "session_expired" ? (
              <>
                <button type="button" onClick={onLogout}
                  className="w-full inline-flex items-center justify-center gap-2 px-5 py-2.5 text-xs font-black uppercase tracking-wide transition"
                  style={{ backgroundColor: cfg.accent, color: "#fff", border: "none", cursor: "pointer" }}
                  onMouseEnter={e => { e.currentTarget.style.filter = "brightness(1.1)"; }}
                  onMouseLeave={e => { e.currentTarget.style.filter = "none"; }}>
                  Sign in again
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
                <button type="button" onClick={onGoAccount}
                  className="w-full inline-flex items-center justify-center gap-2 px-5 py-2.5 text-xs font-bold transition"
                  style={{ backgroundColor: "#fff", border: "1px solid #E8ECF0", color: "#2D3748", cursor: "pointer" }}
                  onMouseEnter={e => { e.currentTarget.style.backgroundColor = "#F7F9FC"; }}
                  onMouseLeave={e => { e.currentTarget.style.backgroundColor = "#fff"; }}>
                  Go to account
                </button>
              </>
            ) : canManageBilling ? (
              <>
                <button type="button" onClick={onGoAccount}
                  className="w-full inline-flex items-center justify-center gap-2 px-5 py-2.5 text-xs font-black uppercase tracking-wide transition"
                  style={{ backgroundColor: cfg.accent, color: "#fff", border: "none", cursor: "pointer" }}
                  onMouseEnter={e => { e.currentTarget.style.filter = "brightness(1.1)"; }}
                  onMouseLeave={e => { e.currentTarget.style.filter = "none"; }}>
                  {cfg.cta}
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
                <button type="button" onClick={onLogout}
                  className="w-full inline-flex items-center justify-center gap-2 px-5 py-2.5 text-xs font-bold transition"
                  style={{ backgroundColor: "#fff", border: "1px solid #E8ECF0", color: "#2D3748", cursor: "pointer" }}
                  onMouseEnter={e => { e.currentTarget.style.backgroundColor = "#F7F9FC"; }}
                  onMouseLeave={e => { e.currentTarget.style.backgroundColor = "#fff"; }}>
                  <LogOut className="w-3.5 h-3.5" />
                  Log out
                </button>
              </>
            ) : (
              <>
                <div className="text-xs p-3 rounded-sm"
                  style={{ backgroundColor: "#F7F9FC", border: "1px solid #E8ECF0", color: "#6B7A8D" }}>
                  Ask your Org Owner or Admin to update billing in{" "}
                  <span className="font-bold">Account → Billing</span>.
                </div>
                <button type="button" onClick={onLogout}
                  className="w-full inline-flex items-center justify-center gap-2 px-5 py-2.5 text-xs font-bold transition"
                  style={{ backgroundColor: "#fff", border: "1px solid #E8ECF0", color: "#2D3748", cursor: "pointer" }}
                  onMouseEnter={e => { e.currentTarget.style.backgroundColor = "#F7F9FC"; }}
                  onMouseLeave={e => { e.currentTarget.style.backgroundColor = "#fff"; }}>
                  <LogOut className="w-3.5 h-3.5" />
                  Log out
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
