// components/org/dashboard/InvitePanel.jsx
"use client";

import { Link as LinkIcon } from "lucide-react";
import { CopyButton } from "@/components/org/dashboard/DashboardUI";

export default function InvitePanel({ orgToken, inviteLink }) {
  return (
    <section className="lg:col-span-8 bg-white rounded-2xl shadow-md border border-blue-100 p-5 sm:p-6">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-lg font-extrabold">Invite Athletes</h2>
          <p className="text-sm text-gray-600 mt-1">Token + link are always visible for coaching ops.</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 sm:justify-end">
          <CopyButton text={orgToken} label="Copy token" compact />
          <CopyButton text={inviteLink} label="Copy link" compact />
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
          <p className="text-xs text-gray-500">Organization Token</p>
          <p className="font-mono text-sm font-semibold break-all mt-1">
            {orgToken || "— missing Token on session user —"}
          </p>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-gray-500">Signup Link</p>
            <LinkIcon className="w-4 h-4 text-gray-400" />
          </div>
          <p className="font-mono text-[12px] font-semibold break-all mt-1">{inviteLink || "—"}</p>
        </div>
      </div>

      {!orgToken ? (
        <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm font-semibold text-amber-900">Token missing from session</p>
          <p className="text-[12px] text-amber-800 mt-1">
            Invite links require the org token. Log out and back in to refresh your session cookie. If you’re a
            trainer/admin, make sure lookupUser sets Token from the linked Organization record.
          </p>
        </div>
      ) : null}
    </section>
  );
}
