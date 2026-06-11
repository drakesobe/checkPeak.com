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

function isDone(a, doneTokens, completedEmails) {
  const tok   = String(getAthleteToken(a) || "").trim();
  const email = normalizeEmail(a?.email);
  return (tok && doneTokens?.has?.(tok)) || (email && completedEmails?.has?.(email));
}

function AthleteRow({ a, isActive, done, onSelect }) {
  const email = normalizeEmail(a?.email);
  const token = String(getAthleteToken(a) || "").trim();

  return (
    <button
      type="button"
      onClick={() => onSelect(a, email, token)}
      disabled={!token && !email}
      className="w-full text-left px-4 py-3 transition-all"
      style={{
        backgroundColor: isActive ? DS.brandBg : "transparent",
        borderBottom:    `1px solid ${DS.border}`,
        borderLeft:      isActive
          ? `3px solid ${DS.brand}`
          : done
            ? `3px solid ${DS.safe}20`
            : "3px solid transparent",
        opacity:         (!token && !email) ? 0.4 : done && !isActive ? 0.55 : 1,
      }}
      onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.backgroundColor = DS.pageBg; }}
      onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.backgroundColor = "transparent"; }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <p
              className="text-sm font-bold truncate"
              style={{
                color:          isActive ? DS.brand : DS.bodyText,
                textDecoration: done && !isActive ? "line-through" : "none",
              }}
            >
              {a?.name || "Athlete"}
            </p>
            {a?.sport && (
              <span
                className="shrink-0 text-xs font-bold px-1.5 py-0.5 rounded-sm"
                style={{ backgroundColor: DS.brandBg, color: DS.labelText, border: `1px solid ${DS.brandBorder}` }}
              >
                {a.sport}
              </span>
            )}
          </div>
          <p className="text-xs truncate mt-0.5" style={{ color: DS.dimText }}>
            {email || "No email"}
          </p>
        </div>

        <span
          className="shrink-0 text-xs font-bold px-1.5 py-0.5 rounded-sm mt-0.5"
          style={done
            ? { backgroundColor: DS.safeBg, color: DS.safe, border: `1px solid ${DS.safeBorder}` }
            : { backgroundColor: DS.cautionBg, color: DS.caution, border: `1px solid ${DS.cautionBorder}` }
          }
        >
          {done ? "✓" : "—"}
        </span>
      </div>
    </button>
  );
}

function SectionLabel({ label, color }) {
  return (
    <div
      className="px-4 py-1.5 sticky top-0 z-10"
      style={{
        backgroundColor: color === "safe" ? DS.safeBg : DS.cautionBg,
        borderBottom:    `1px solid ${color === "safe" ? DS.safeBorder : DS.cautionBorder}`,
      }}
    >
      <span
        className="text-xs font-black uppercase tracking-widest"
        style={{ color: color === "safe" ? DS.safe : DS.caution }}
      >
        {label}
      </span>
    </div>
  );
}

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
  /* ── Split into pending / done ── */
  const { pendingList, doneList } = useMemo(() => {
    const alphabetical = [...filteredAthletes].sort((a, b) =>
      (a?.name || "").localeCompare(b?.name || "")
    );
    const pending = [], done = [];
    for (const a of alphabetical) {
      isDone(a, doneTokens, completedEmails) ? done.push(a) : pending.push(a);
    }
    return { pendingList: pending, doneList: done };
  }, [filteredAthletes, doneTokens, completedEmails]);

  const totalCount   = athletes.length;
  const doneCount    = useMemo(() => {
    return athletes.filter(a => isDone(a, doneTokens, completedEmails)).length;
  }, [athletes, doneTokens, completedEmails]);
  const progressPct  = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;

  function handleSelect(a, email, token) {
    if (email) setSelectedAthleteEmail(email);
    if (token) {
      router.push(`/org/prescriptions?athleteToken=${encodeURIComponent(token)}`, undefined, { shallow: true });
    } else if (email) {
      router.push(`/org/prescriptions?athleteEmail=${encodeURIComponent(email)}`, undefined, { shallow: true });
    }
  }

  return (
    <aside
      className="flex flex-col w-full"
      style={{ border: `1px solid ${DS.border}`, borderTop: `3px solid ${DS.brand}`, backgroundColor: DS.cardBg }}
    >
      {/* Header */}
      <div className="px-4 pt-4 pb-3" style={{ borderBottom: `1px solid ${DS.border}` }}>
        <div className="flex items-start justify-between gap-2 mb-3">
          <div>
            <p className="text-sm font-black uppercase tracking-wide" style={{ color: DS.bodyText }}>
              Roster
            </p>
            <p className="text-xs mt-0.5" style={{ color: DS.dimText }}>
              {filteredAthletes.length}/{totalCount} athletes
              {doneTokensLoading && <span className="ml-1">· updating…</span>}
            </p>
          </div>

          {/* Done count badge */}
          {totalCount > 0 && (
            <div className="text-right">
              <p className="text-xl font-black tabular-nums leading-none" style={{ color: doneCount === totalCount ? DS.safe : DS.brand }}>
                {doneCount}<span className="text-xs font-bold" style={{ color: DS.dimText }}>/{totalCount}</span>
              </p>
              <p className="text-xs" style={{ color: DS.dimText }}>active plans</p>
            </div>
          )}
        </div>

        {/* Progress bar */}
        {totalCount > 0 && (
          <div className="mb-3">
            <div
              className="w-full rounded-full overflow-hidden"
              style={{ height: 6, backgroundColor: DS.border }}
            >
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width:           `${progressPct}%`,
                  backgroundColor: progressPct === 100 ? DS.safe : DS.brand,
                }}
              />
            </div>
            <p className="text-xs mt-1" style={{ color: DS.dimText }}>
              {progressPct}% of roster assigned
            </p>
          </div>
        )}

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5" style={{ color: DS.dimText }} />
          <input
            className="w-full pl-8 pr-7 text-sm py-2 outline-none rounded-sm"
            style={{ border: `1px solid ${DS.brandBorder}`, backgroundColor: DS.brandBg, color: DS.bodyText }}
            placeholder="Search name, email, token…"
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
      <div className="overflow-auto flex-1" style={{ maxHeight: 520 }}>

        {filteredAthletes.length === 0 && (
          <div className="p-4">
            <p className="text-sm font-bold" style={{ color: DS.bodyText }}>No athletes found</p>
            <p className="text-xs mt-0.5" style={{ color: DS.dimText }}>Clear search or confirm signups.</p>
          </div>
        )}

        {/* Pending section */}
        {pendingList.length > 0 && (
          <>
            <SectionLabel label={`Needs Plan · ${pendingList.length}`} color="caution" />
            {pendingList.map((a) => {
              const email   = normalizeEmail(a?.email);
              const token   = String(getAthleteToken(a) || "").trim();
              const isActive = (token && selectedAthleteToken && token === String(selectedAthleteToken).trim())
                || (email && email === normalizeEmail(selectedAthleteEmail));
              return (
                <AthleteRow
                  key={a.id || token || email}
                  a={a}
                  isActive={isActive}
                  done={false}
                  onSelect={handleSelect}
                />
              );
            })}
          </>
        )}

        {/* Done section */}
        {doneList.length > 0 && (
          <>
            <SectionLabel label={`Active Plans · ${doneList.length}`} color="safe" />
            {doneList.map((a) => {
              const email   = normalizeEmail(a?.email);
              const token   = String(getAthleteToken(a) || "").trim();
              const isActive = (token && selectedAthleteToken && token === String(selectedAthleteToken).trim())
                || (email && email === normalizeEmail(selectedAthleteEmail));
              return (
                <AthleteRow
                  key={a.id || token || email}
                  a={a}
                  isActive={isActive}
                  done={true}
                  onSelect={handleSelect}
                />
              );
            })}
          </>
        )}
      </div>

      {/* Footer keyboard hint */}
      <div
        className="px-4 py-2.5 text-xs"
        style={{ borderTop: `1px solid ${DS.border}`, color: DS.dimText, backgroundColor: DS.pageBg }}
      >
        <span className="font-bold" style={{ color: DS.labelText }}>Ctrl+Enter</span> = Save &amp; Next ·{" "}
        <span className="font-bold" style={{ color: DS.labelText }}>Ctrl+S</span> = Save
      </div>
    </aside>
  );
}
