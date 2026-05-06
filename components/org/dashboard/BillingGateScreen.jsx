// components/org/workouts-calendar/BillingGateScreen.jsx
"use client";

import { ArrowRight, LogOut, Lock } from "lucide-react";
import { DS, Button } from "@/components/org/dashboard/DashboardUI";
import { fmtDate } from "./format";

export default function BillingGateScreen({ role, billing, error, onLogout, onGoAccount }) {
  const canManage = role === "admin" || role === "organization";

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ backgroundColor: DS.pageBg }}>
      <div className="w-full max-w-md" style={{ backgroundColor: DS.cardBg, border: `1px solid ${DS.border}`, borderTop: `3px solid ${DS.brand}` }}>
        {/* Header */}
        <div className="px-5 py-4 flex items-start gap-3" style={{ borderBottom: `1px solid ${DS.border}` }}>
          <div className="w-8 h-8 flex items-center justify-center shrink-0" style={{ backgroundColor: DS.brandBg, border: `1px solid ${DS.brandBorder}` }}>
            <Lock className="w-4 h-4" style={{ color: DS.brand }} />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-black uppercase tracking-widest" style={{ color: DS.brand }}>CheckPeak</p>
            <h1 className="text-lg font-black mt-0.5" style={{ color: DS.bodyText }}>Subscription required</h1>
            <p className="text-xs mt-1" style={{ color: DS.labelText }}>
              Your organization's access is locked. Start a subscription to continue.
            </p>
          </div>
        </div>

        <div className="p-5">
          {error ? (
            <div className="p-3 text-xs font-bold mb-4" style={{ backgroundColor: DS.bannedBg, border: `1px solid ${DS.bannedBorder}`, color: DS.banned }}>
              {error}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-px mb-5" style={{ backgroundColor: DS.border }}>
              <div className="p-3" style={{ backgroundColor: DS.pageBg }}>
                <p className="text-xs uppercase tracking-wider font-black" style={{ color: DS.dimText }}>Status</p>
                <p className="text-sm font-black mt-1" style={{ color: DS.bodyText }}>
                  {billing?.statusRaw || billing?.status || "-"}
                </p>
              </div>
              <div className="p-3" style={{ backgroundColor: DS.pageBg }}>
                <p className="text-xs uppercase tracking-wider font-black" style={{ color: DS.dimText }}>Trial ends</p>
                <p className="text-sm font-black mt-1" style={{ color: DS.bodyText }}>
                  {fmtDate(billing?.trialEnds)}
                </p>
              </div>
            </div>
          )}

          <div className="flex flex-col gap-2">
            {canManage ? (
              <Button onClick={onGoAccount} className="w-full justify-center">
                Manage Billing <ArrowRight className="w-3.5 h-3.5" />
              </Button>
            ) : (
              <p className="text-xs p-3" style={{ backgroundColor: DS.pageBg, border: `1px solid ${DS.border}`, color: DS.labelText }}>
                Ask your Org Owner or Admin to update billing in <strong>Account → Billing</strong>.
              </p>
            )}
            <Button variant="secondary" onClick={onLogout} className="w-full justify-center">
              <LogOut className="w-3.5 h-3.5" /> Log out
            </Button>
          </div>

          <p className="text-xs mt-4" style={{ color: DS.dimText }}>
            Billing IDs are set by Stripe checkout + webhooks - never enter them manually.
          </p>
        </div>
      </div>
    </div>
  );
}