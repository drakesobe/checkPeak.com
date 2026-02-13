// components/org/prescriptions/AthleteRoster.jsx
"use client";

import { formatDateTime, getAthleteToken, normalizeEmail } from "@/lib/org/prescriptions/prescriptions-utils";

export default function AthleteRoster({
  athletes = [],
  filteredAthletes = [],
  athleteSearch,
  setAthleteSearch,

  selectedAthleteEmail,
  setSelectedAthleteEmail,

  selectedAthleteToken,

  completedEmails, // local speed-mode done (optional)
  doneTokens = new Set(), // ✅ Airtable truth
  doneTokensLoading = false,

  router,
  inputBase,
}) {
  return (
    <aside className="lg:col-span-4 bg-white rounded-2xl shadow-md border border-blue-100 p-5 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold">Athletes</h2>
          <p className="text-xs text-gray-500 mt-1">
            Status is based on NutritionPlans (token). Switching athletes won’t spam history calls.
          </p>
          {doneTokensLoading ? (
            <p className="text-[11px] text-gray-400 mt-1">Updating Done/Pending…</p>
          ) : null}
        </div>
        <span className="text-xs text-gray-500">
          {filteredAthletes.length}/{athletes.length}
        </span>
      </div>

      <input
        className={inputBase}
        placeholder="Search name, email, or ATH-token…"
        value={athleteSearch}
        onChange={(e) => setAthleteSearch(e.target.value)}
      />

      <div className="space-y-2 max-h-[420px] overflow-auto pr-1">
        {filteredAthletes.length === 0 && (
          <div className="rounded-xl bg-gray-50 border border-gray-200 p-3">
            <p className="text-sm text-gray-700 font-semibold">No athletes found</p>
            <p className="text-xs text-gray-500 mt-1">Clear search or confirm signups.</p>
          </div>
        )}

        {filteredAthletes.map((a) => {
          const email = normalizeEmail(a?.email);
          const token = String(getAthleteToken(a) || "").trim();

          const isActive =
            (token && selectedAthleteToken && token === String(selectedAthleteToken).trim()) ||
            (email && email === normalizeEmail(selectedAthleteEmail));

          // ✅ Done/Pending: Airtable truth by token
          const doneByToken = token ? doneTokens?.has?.(token) : false;

          // optional local done (speed-mode)
          const doneByEmail = email && completedEmails?.has?.(email);

          const done = doneByToken || doneByEmail;

          return (
            <button
              key={a.id || token || email || Math.random().toString(36).slice(2)}
              type="button"
              onClick={() => {
                if (email) setSelectedAthleteEmail(email);

                if (token) {
                  router.push(`/org/prescriptions?athleteToken=${encodeURIComponent(token)}`, undefined, {
                    shallow: true,
                  });
                  return;
                }

                if (email) {
                  router.push(`/org/prescriptions?athleteEmail=${encodeURIComponent(email)}`, undefined, {
                    shallow: true,
                  });
                }
              }}
              className={`w-full text-left rounded-xl border p-3 transition ${
                isActive ? "border-[#46769B] bg-blue-50" : "border-gray-200 bg-white hover:bg-gray-50"
              }`}
              disabled={!token && !email}
              title={!token && !email ? "Missing token and email" : ""}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">{a?.name || "Athlete"}</p>
                  <p className="text-xs text-gray-500 mt-0.5 truncate">{email || "Missing email"}</p>

                  {token ? (
                    <p className="text-[11px] text-gray-400 mt-1 truncate">Token: {token}</p>
                  ) : (
                    <p className="text-[11px] text-amber-700 mt-1 truncate">Token missing (lookup)</p>
                  )}
                </div>

                {done ? (
                  <span className="text-xs px-2 py-1 rounded-lg bg-emerald-100 text-emerald-700 border border-emerald-200">
                    ✓ Done
                  </span>
                ) : (
                  <span className="text-xs px-2 py-1 rounded-lg bg-gray-100 text-gray-600 border border-gray-200">
                    Pending
                  </span>
                )}
              </div>

              {a?.createdAt && <p className="text-[11px] text-gray-400 mt-1">Joined: {formatDateTime(a.createdAt)}</p>}
            </button>
          );
        })}
      </div>

      <div className="text-[11px] text-gray-500">
        Speed shortcuts: <span className="font-semibold">Enter</span> = Save & Next,{" "}
        <span className="font-semibold">Ctrl/Cmd+Enter</span> = Save
      </div>
    </aside>
  );
}
