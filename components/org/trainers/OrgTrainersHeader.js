// components/org/trainers/OrgTrainersHeader.js
"use client";

import {
  Users,
  ShieldCheck,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  RefreshCcw,
  LogOut,
  ArrowRight,
} from "lucide-react";

import Pill from "./ui/Pill";
import Button from "./ui/Button";

export default function OrgTrainersHeader({
  orgName,
  orgEmail,
  orgToken,
  orgId,
  counts,
  canManageMembers,
  loading,
  onBack,
  onRefresh,
  onLogout,
  error,
  inviteErr,
  saveErr,
  inviteOk,
  saveOk,
}) {
  return (
    <div className="bg-white rounded-2xl shadow-md border border-blue-100 p-6">
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Users className="w-6 h-6 text-[#46769B]" />
            <h1 className="text-2xl font-extrabold truncate">Trainers</h1>
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
              <Users className="w-3.5 h-3.5 mr-1.5" />
              Team: {counts.total} (Admins: {counts.admins}, Trainers: {counts.coaches}, Inactive:{" "}
              {counts.inactive})
            </Pill>

            {!canManageMembers ? (
              <Pill tone="warn">
                <AlertTriangle className="w-3.5 h-3.5 mr-1.5" />
                View-only (Trainer role)
              </Pill>
            ) : null}
          </div>

          {(error || saveErr || inviteErr) && (
            <div className="mt-4 space-y-2">
              {error ? (
                <div className="rounded-2xl border border-red-200 bg-red-50 p-3">
                  <p className="text-sm text-red-700 font-semibold">{error}</p>
                  <p className="text-[11px] text-red-600 mt-1">
                    If this persists, log out and back in to refresh your session cookie.
                  </p>
                </div>
              ) : null}

              {saveErr ? (
                <div className="rounded-2xl border border-red-200 bg-red-50 p-3">
                  <p className="text-sm text-red-700 font-semibold">{saveErr}</p>
                </div>
              ) : null}

              {inviteErr ? (
                <div className="rounded-2xl border border-red-200 bg-red-50 p-3">
                  <p className="text-sm text-red-700 font-semibold">{inviteErr}</p>
                </div>
              ) : null}
            </div>
          )}

          {(saveOk || inviteOk) && (
            <div className="mt-4 space-y-2">
              {saveOk ? (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3">
                  <p className="text-sm text-emerald-800 font-semibold">{saveOk}</p>
                </div>
              ) : null}
              {inviteOk ? (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3">
                  <p className="text-sm text-emerald-800 font-semibold">{inviteOk}</p>
                </div>
              ) : null}
            </div>
          )}
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
          <p className="text-sm text-gray-800 font-semibold">Loading trainers…</p>
          <p className="text-[11px] text-gray-600 mt-1">
            Pulling organization members (Admin/Trainer).
          </p>
        </div>
      ) : null}
    </div>
  );
}
