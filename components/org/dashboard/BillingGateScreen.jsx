// components/org/dashboard/BillingGateScreen.jsx
"use client";

import { ArrowRight, LogOut, Lock } from "lucide-react";
import { Button } from "@/components/org/dashboard/DashboardUI";
import { fmtDate } from "./format";

export default function BillingGateScreen({ role, billing, error, onLogout, onGoAccount }) {
  const canManageBilling = role === "admin" || role === "organization";

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-blue-50 text-gray-900 font-sans">
      <main className="max-w-3xl mx-auto px-4 py-10">
        <div className="bg-white rounded-3xl shadow-md border border-blue-100 p-7">
          <div className="flex items-start gap-3">
            <div className="shrink-0 w-11 h-11 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center">
              <Lock className="w-5 h-5 text-[#46769B]" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold tracking-wide text-[#46769B]">CHECKPEAK</p>
              <h1 className="text-2xl font-extrabold text-gray-900 mt-1">Subscription required</h1>
              <p className="text-sm text-gray-600 mt-2">
                Your organization’s access is currently locked. Start a subscription to continue using the org dashboard.
              </p>
            </div>
          </div>

          {error ? (
            <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4">
              <p className="text-sm font-semibold text-red-700">{error}</p>
            </div>
          ) : (
            <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                <div className="text-xs font-semibold text-gray-600">Status</div>
                <div className="text-sm font-semibold text-gray-900 mt-1">
                  {billing?.statusRaw || billing?.status || "—"}
                </div>
              </div>
              <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                <div className="text-xs font-semibold text-gray-600">Trial ends</div>
                <div className="text-sm font-semibold text-gray-900 mt-1">{fmtDate(billing?.trialEnds)}</div>
              </div>
            </div>
          )}

          <div className="mt-6 flex flex-col sm:flex-row gap-2 sm:justify-end">
            {canManageBilling ? (
              <Button variant="dark" onClick={onGoAccount} className="w-full sm:w-auto">
                Manage Billing
                <ArrowRight className="w-4 h-4" />
              </Button>
            ) : (
              <div className="text-sm text-gray-600 py-2">
                Ask your Org Owner/Admin to update billing in <span className="font-semibold">Account → Billing</span>.
              </div>
            )}

            <Button variant="secondary" onClick={onLogout} className="w-full sm:w-auto">
              <LogOut className="w-4 h-4" />
              Log out
            </Button>
          </div>

          <div className="mt-4 text-[11px] text-gray-500">
            Note: Billing IDs (Stripe Customer/Subscription) should never be manually entered by users. They’re set by
            Stripe checkout + webhooks.
          </div>
        </div>
      </main>
    </div>
  );
}
