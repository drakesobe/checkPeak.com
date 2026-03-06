// components/org/prescriptions/AthleteRoster.jsx
"use client";

import { useMemo } from "react";
import { formatDateTime, getAthleteToken, normalizeEmail } from "@/lib/org/prescriptions/prescriptions-utils";
import { Search, X } from "lucide-react";

const DS = {
  brand:         "#1E3A5F",
  brandLight:    "#2A4F7C",
  brandBg:       "#EEF3F9",
  brandBorder:   "#C0D0E0",
  safe:          "#00873E",
  safeBg:        "#F0FBF4",
  safeBorder:    "#A8DFB8",
  caution:       "#B86000",
  cautionBg:     "#FFFBF0",
  cautionBorder: "#FFD580",
  border:        "#E8ECF0",
  pageBg:        "#F4F7FB",
  cardBg:        "#FFFFFF",
  bodyText:      "#1A2535",
  labelText:     "#5A6A7D",
  dimText:       "#9BA8B4",
};

export default function AthleteRoster({
  athletes = [],
  filteredAthletes = [],
  athleteSearch,
  setAthleteSearch,

  selectedAthleteEmail,
  setSelectedAthleteEmail,

  selectedAthleteToken,

  completedEmails,
  doneTokens = new Set(),
  doneTokensLoading = false,

  router,
}) {
  // Sort: pending first, done at bottom
  const sorted = useMemo(() => {
    return [...filteredAthletes].sort((a, b) => {
      const tokA = String(getAthleteToken(a) || "").trim();
      const tokB = String(getAthleteToken(b) || "").trim();
      const doneA = (tokA && doneTokens?.has?.(tokA)) || (normalizeEmail(a?.email) && completedEmails?.has?.(normalizeEmail(a?.email)));
      const doneB = (tokB && doneTokens?.has?.(tokB)) || (normalizeEmail(b?.email) && completedEmails?.has?.(normalizeEmail(b?.email)));
      if (doneA === doneB) return (a?.name || "").localeCompare(b?.name || "");
      return doneA ? 1 : -1;
    });
  }, [filteredAthletes, doneTokens, completedEmails]);

  const pendingCount = useMemo(
    () => sorted.filter((a) => {
      const tok = String(getAthleteToken(a) || "").trim();
      return !(tok && doneTokens?.has?.(tok));
    }).length,
    [sorted, doneTokens]
  );

  return (
    <aside
      className="flex flex-col w-full"
      style={{ border: `1px solid ${DS.border}`, borderTop: `3px solid ${DS.brand}`, backgroundColor: DS.cardBg }}
    >
      {/* Header */}
      <div className="px-4 pt-4 pb-3" style={{ borderBottom: `1px solid ${DS.border}` }}>
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-sm font-black uppercase tracking-wide" style={{ color: DS.bodyText }}>
              Athletes
            </p>
            <div className="mt-1 flex items-center gap-2">
              <span
                className="text-xs font-bold px-2 py-0.5 rounded-sm"
                style={{ backgroundColor: DS.brandBg, color: DS.brand, border: `1px solid ${DS.brandBorder}` }}
              >
                {filteredAthletes.length}/{athletes.length}
              </span>
              {pendingCount > 0 && (
                <span
                  className="text-xs font-bold px-2 py-0.5 rounded-sm"
                  style={{ backgroundColor: DS.cautionBg, color: DS.caution, border: `1px solid ${DS.cautionBorder}` }}
                >
                  {pendingCount} pending
                </span>
              )}
              {doneTokensLoading && (
                <span className="text-xs" style={{ color: DS.dimText }}>updating…</span>
              )}
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="relative mt-3">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5" style={{ color: DS.dimText }} />
          <input
            className="w-full pl-8 pr-7 text-sm py-2 outline-none rounded-sm"
            style={{ border: `1px solid ${DS.brandBorder}`, backgroundColor: DS.brandBg, color: DS.bodyText }}
            placeholder="Search by name, email, token…"
            value={athleteSearch}
            onChange={(e) => setAthleteSearch(e.target.value)}
            onFocus={(e) => { e.currentTarget.style.borderColor = DS.brand; }}
            onBlur={(e)  => { e.currentTarget.style.borderColor = DS.brandBorder; }}
          />
          {athleteSearch && (
            <button
              type="button"
              onClick={() => setAthleteSearch("")}
              className="absolute right-2 top-1/2 -translate-y-1/2"
              style={{ color: DS.dimText }}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* List */}
      <div className="overflow-auto flex-1" style={{ maxHeight: 440 }}>
        {sorted.length === 0 && (
          <div className="p-4">
            <p className="text-sm font-bold" style={{ color: DS.bodyText }}>No athletes found</p>
            <p className="text-xs mt-0.5" style={{ color: DS.dimText }}>Clear search or confirm signups.</p>
          </div>
        )}

        {sorted.map((a) => {
          const email    = normalizeEmail(a?.email);
          const token    = String(getAthleteToken(a) || "").trim();

          const isActive =
            (token && selectedAthleteToken && token === String(selectedAthleteToken).trim()) ||
            (email && email === normalizeEmail(selectedAthleteEmail));

          const done = (token && doneTokens?.has?.(token)) || (email && completedEmails?.has?.(email));

          return (
            <button
              key={a.id || token || email}
              type="button"
              onClick={() => {
                if (email) setSelectedAthleteEmail(email);
                if (token) {
                  router.push(`/org/prescriptions?athleteToken=${encodeURIComponent(token)}`, undefined, { shallow: true });
                  return;
                }
                if (email) {
                  router.push(`/org/prescriptions?athleteEmail=${encodeURIComponent(email)}`, undefined, { shallow: true });
                }
              }}
              disabled={!token && !email}
              className="w-full text-left px-4 py-3 transition-colors"
              style={{
                backgroundColor: isActive ? DS.brandBg : "transparent",
                borderBottom: `1px solid ${DS.border}`,
                borderLeft: isActive ? `3px solid ${DS.brand}` : "3px solid transparent",
                opacity: (!token && !email) ? 0.45 : 1,
              }}
              onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.backgroundColor = DS.pageBg; }}
              onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.backgroundColor = "transparent"; }}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold truncate" style={{ color: DS.bodyText }}>
                    {a?.name || "Athlete"}
                  </p>
                  <p className="text-xs truncate mt-0.5" style={{ color: DS.dimText }}>
                    {email || "No email"}
                  </p>
                  {token ? (
                    <p className="text-xs mt-0.5 truncate" style={{ color: DS.dimText }}>
                      {token.length > 16 ? `${token.slice(0, 10)}…${token.slice(-5)}` : token}
                    </p>
                  ) : (
                    <p className="text-xs mt-0.5" style={{ color: DS.caution }}>Token missing</p>
                  )}
                </div>

                <span
                  className="shrink-0 text-xs font-bold px-1.5 py-0.5 rounded-sm mt-0.5"
                  style={done
                    ? { backgroundColor: DS.safeBg,    color: DS.safe,    border: `1px solid ${DS.safeBorder}`    }
                    : { backgroundColor: DS.cautionBg, color: DS.caution, border: `1px solid ${DS.cautionBorder}` }
                  }
                >
                  {done ? "✓ Done" : "Pending"}
                </span>
              </div>

              {a?.createdAt && (
                <p className="text-xs mt-1" style={{ color: DS.dimText }}>
                  Joined {formatDateTime(a.createdAt)}
                </p>
              )}
            </button>
          );
        })}
      </div>

      {/* Footer hint */}
      <div
        className="px-4 py-2.5 text-xs"
        style={{ borderTop: `1px solid ${DS.border}`, color: DS.dimText, backgroundColor: DS.pageBg }}
      >
        <span className="font-bold" style={{ color: DS.labelText }}>Enter</span> = Save & Next ·{" "}
        <span className="font-bold" style={{ color: DS.labelText }}>Ctrl+Enter</span> = Save
      </div>
    </aside>
  );
}