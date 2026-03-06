// components/org/prescriptions/SelectedAthleteCard.jsx
"use client";

import { normalizeEmail } from "@/lib/org/prescriptions/prescriptions-utils";

const DS = {
  brand: "#1E3A5F", brandLight: "#2A4F7C", brandBg: "#EEF3F9", brandBorder: "#C0D0E0",
  caution: "#B86000", cautionBg: "#FFFBF0", cautionBorder: "#FFD580",
  border: "#E8ECF0", pageBg: "#F4F7FB", cardBg: "#FFFFFF",
  bodyText: "#1A2535", labelText: "#5A6A7D", dimText: "#9BA8B4",
};

export default function SelectedAthleteCard({ selectedAthlete, selectedAthleteToken, view, setView }) {
  const name  = selectedAthlete?.name || "Athlete";
  const email = selectedAthlete?.email ? normalizeEmail(selectedAthlete.email) : "";

  return (
    <div
      className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-4 py-3"
      style={{
        backgroundColor: DS.cardBg,
        border: `1px solid ${DS.border}`,
        borderTop: `3px solid ${DS.brand}`,
      }}
    >
      <div className="min-w-0">
        <p className="text-xs font-black uppercase tracking-wider" style={{ color: DS.dimText }}>
          Selected Athlete
        </p>
        {selectedAthleteToken ? (
          <p className="text-sm mt-0.5 truncate" style={{ color: DS.bodyText }}>
            <span className="font-bold">{name}</span>
            {email && <span style={{ color: DS.labelText }}> · {email}</span>}
            <span style={{ color: DS.dimText }}> · {selectedAthleteToken.length > 14
              ? `${selectedAthleteToken.slice(0, 8)}…${selectedAthleteToken.slice(-5)}`
              : selectedAthleteToken}
            </span>
          </p>
        ) : selectedAthlete ? (
          <p className="text-sm mt-0.5 truncate" style={{ color: DS.bodyText }}>
            <span className="font-bold">{name}</span>
            {email && <span style={{ color: DS.labelText }}> · {email}</span>}
            <span style={{ color: DS.caution }}> · Token missing</span>
          </p>
        ) : (
          <p className="text-sm mt-0.5" style={{ color: DS.dimText }}>
            Select an athlete from the roster to begin.
          </p>
        )}
      </div>

      <div className="flex gap-1.5 shrink-0">
        {["builder", "history"].map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => setView(v)}
            className="px-3 py-1.5 text-xs font-black uppercase tracking-wide rounded-sm transition-all"
            style={{
              backgroundColor: view === v ? DS.brand : DS.cardBg,
              color:           view === v ? "#fff"   : DS.labelText,
              border:          `1px solid ${view === v ? DS.brand : DS.border}`,
            }}
            onMouseEnter={(e) => { if (view !== v) { e.currentTarget.style.borderColor = DS.brandBorder; e.currentTarget.style.color = DS.brand; } }}
            onMouseLeave={(e) => { if (view !== v) { e.currentTarget.style.borderColor = DS.border; e.currentTarget.style.color = DS.labelText; } }}
          >
            {v === "builder" ? "Builder" : "History"}
          </button>
        ))}
      </div>
    </div>
  );
}