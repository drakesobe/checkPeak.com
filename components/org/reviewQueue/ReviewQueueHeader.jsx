// components/org/reviewQueue/ReviewQueueHeader.jsx
"use client";

import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ClipboardList,
  LogOut,
  RefreshCcw,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

import { Button, Pill } from "@/components/org/reviewQueue/ui";

export default function ReviewQueueHeader({
  orgName,
  orgEmail,
  orgToken,
  orgId,
  headline,
  loading,
  error,
  onBack,
  onRefresh,
  onLogout,
}) {
  return (
    <div className="bg-white rounded-2xl shadow-md border border-blue-100 p-6">
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <ClipboardList className="w-6 h-6 text-[#46769B]" />
            <h1 className="text-2xl font-extrabold truncate">Review Queue</h1>
          </div>

          <p className="text-sm text-gray-600 mt-1">
            {orgName} • Logged in as <span className="font-semibold">{orgEmail}</span>
          </p>

          <div className="mt-3 flex flex-wrap gap-2">
            <Pill tone="good">
              <ShieldCheck className="w-3.5 h-3.5 mr-1.5" />
              Org Session Active
            </Pill>

            {orgToken ? (
              <Pill tone="good">
                <Sparkles className="w-3.5 h-3.5 mr-1.5" />
                Token Loaded
              </Pill>
            ) : (
              <Pill tone="bad">
                <AlertTriangle className="w-3.5 h-3.5 mr-1.5" />
                Missing Token
              </Pill>
            )}

            {orgId ? (
              <Pill tone="good">
                <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
                orgId Loaded
              </Pill>
            ) : (
              <Pill tone="warn">
                <AlertTriangle className="w-3.5 h-3.5 mr-1.5" />
                orgId missing (legacy session)
              </Pill>
            )}

            <Pill>
              <ClipboardList className="w-3.5 h-3.5 mr-1.5" />
              {headline}
            </Pill>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={onBack}>
            <ArrowRight className="w-4 h-4 rotate-180" />
            Back
          </Button>
          <Button variant="secondary" onClick={onRefresh} disabled={loading}>
            <RefreshCcw className="w-4 h-4" />
            Refresh
          </Button>
          <Button variant="dark" onClick={onLogout}>
            <LogOut className="w-4 h-4" />
            Log out
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="mt-5 rounded-2xl border border-blue-100 bg-blue-50 p-4">
          <p className="text-sm text-gray-800 font-semibold">Loading review queue…</p>
          <p className="text-[11px] text-gray-600 mt-1">Pulling workouts that include uploads.</p>
        </div>
      ) : null}

      {error ? (
        <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4">
          <p className="text-sm text-red-700 font-semibold">{error}</p>
          <p className="text-[11px] text-red-600 mt-1">If this persists, log out and back in.</p>
        </div>
      ) : null}
    </div>
  );
}
