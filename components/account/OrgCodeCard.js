"use client";

import Link from "next/link";

function classNames(...xs) {
  return xs.filter(Boolean).join(" ");
}

export default function OrgCodeCard({ orgToken, copyOk, onCopyOrgCode }) {
  const readOnlyBase = "w-full border border-gray-200 rounded-2xl px-4 py-2 bg-gray-50 text-gray-700";

  return (
    <div className="rounded-3xl border border-gray-200 bg-gray-50 p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-gray-900">Organization code</p>
          <p className="text-[12px] text-gray-600 mt-1">
            Share this code with athletes so they can connect to your team.
          </p>

          <div className="mt-3">
            <label className="text-[11px] font-semibold text-gray-600">Code (from session)</label>
            <input
              type="text"
              value={orgToken ? orgToken : "—"}
              readOnly
              className={classNames(readOnlyBase, "mt-2 font-mono")}
              onFocus={(e) => e.target.select()}
            />
            <p className="text-[11px] text-gray-500 mt-2">
              If this is “—”, your session cookie may be missing Token. Log out & log back in.
            </p>
          </div>
        </div>

        <div className="shrink-0 flex flex-col gap-2">
          <button
            type="button"
            onClick={onCopyOrgCode}
            disabled={!orgToken}
            className={classNames(
              "px-4 py-2 rounded-2xl font-semibold transition",
              orgToken ? "bg-[#46769B] text-white hover:brightness-110" : "bg-gray-200 text-gray-500"
            )}
          >
            Copy
          </button>

          {copyOk ? (
            <div className="text-[11px] text-gray-600 text-right">{copyOk}</div>
          ) : (
            <div className="text-[11px] text-gray-400 text-right"> </div>
          )}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Link
          href="/org/trainers"
          className="inline-flex items-center rounded-2xl px-4 py-2 bg-white border border-gray-200 text-gray-800 font-semibold hover:bg-gray-50 transition"
        >
          Manage team (Trainers)
        </Link>
        <Link
          href="/org/dashboard"
          className="inline-flex items-center rounded-2xl px-4 py-2 bg-white border border-gray-200 text-gray-800 font-semibold hover:bg-gray-50 transition"
        >
          Back to Org Dashboard
        </Link>
      </div>
    </div>
  );
}
