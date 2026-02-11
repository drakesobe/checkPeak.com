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

/**
 * OrgTrainersHeader
 *
 * ✅ Designed to work with the modular Trainers page you posted.
 *
 * Accepts either:
 * - canManageMembers (explicit boolean), OR
 * - role (string: "organization" | "admin" | "trainer" | "athlete") and we derive canManageMembers
 *
 * Supports status banners via:
 * - error
 * - inviteErr, saveErr
 * - inviteOk, saveOk
 *
 * If you don’t pass invite/save banners, it won’t render them.
 */

export default function OrgTrainersHeader({
  orgName = "Organization",
  orgEmail = "",
  orgToken = "",
  orgId = "",
  counts = { total: 0, admins: 0, coaches: 0, inactive: 0 },

  // Either pass `role` or `canManageMembers`
  role = "",
  canManageMembers: canManageMembersProp,

  loading = false,

  onBack,
  onRefresh,
  onLogout,

  // banners
  error = "",
  inviteErr = "",
  saveErr = "",
  inviteOk = "",
  saveOk = "",
}) {
  const normalizedRole = String(role || "").trim().toLowerCase();

  const derivedCanManage =
    normalizedRole === "organization" || normalizedRole === "admin";

  const canManageMembers =
    typeof canManageMembersProp === "boolean" ? canManageMembersProp : derivedCanManage;

  const hasErr = Boolean(error || inviteErr || saveErr);
  const hasOk = Boolean(inviteOk || saveOk);

  const total = Number(counts?.total || 0);
  const admins = Number(counts?.admins || 0);
  const coaches = Number(counts?.coaches || 0);
  const inactive = Number(counts?.inactive || 0);

  return (
    <div className="bg-white rounded-2xl shadow-md border border-blue-100 p-6">
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Users className="w-6 h-6 text-[#46769B]" />
            <h1 className="text-2xl font-extrabold truncate">Trainers</h1>
          </div>

          <p className="text-sm text-gray-600 mt-1">
            {orgName}{" "}
            {orgEmail ? (
              <>
                • Logged in as <span className="font-semibold">{orgEmail}</span>
              </>
            ) : null}
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
              Team: {total} (Admins: {admins}, Trainers: {coaches}, Inactive: {inactive})
            </Pill>

            {!canManageMembers ? (
              <Pill tone="warn">
                <AlertTriangle className="w-3.5 h-3.5 mr-1.5" />
                View-only (Trainer role)
              </Pill>
            ) : null}
          </div>

          {hasErr ? (
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
          ) : null}

          {hasOk ? (
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
          ) : null}
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            onClick={onBack}
            disabled={typeof onBack !== "function"}
            title={typeof onBack !== "function" ? "Back handler not provided" : ""}
          >
            <ArrowRight className="w-4 h-4 rotate-180" />
            Back
          </Button>

          <Button
            variant="secondary"
            onClick={onRefresh}
            disabled={loading || typeof onRefresh !== "function"}
            title={typeof onRefresh !== "function" ? "Refresh handler not provided" : ""}
          >
            <RefreshCcw className="w-4 h-4" />
            Refresh
          </Button>

          <Button
            variant="dark"
            onClick={onLogout}
            disabled={typeof onLogout !== "function"}
            title={typeof onLogout !== "function" ? "Logout handler not provided" : ""}
          >
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
