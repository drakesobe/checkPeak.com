// components/account/OrgCodeCard.jsx
import Link from "next/link";

const DS = {
  brand:       "#1E3A5F",
  brandBg:     "#EEF3F9",
  brandBorder: "#C0D0E0",
  border:      "#E8ECF0",
  bodyText:    "#2D3748",
  labelText:   "#6B7A8D",
  dimText:     "#9BA8B4",
  readOnlyBg:  "#F7F9FC",
};

function NavChip({ href, children }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center px-4 py-2 text-xs font-bold uppercase tracking-wide transition-all rounded-sm"
      style={{
        backgroundColor: DS.brandBg,
        color: DS.brand,
        border: `1px solid ${DS.brandBorder}`,
      }}
      onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "#D8E6F3"; }}
      onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = DS.brandBg; }}
    >
      {children}
    </Link>
  );
}

export default function OrgCodeCard({ orgToken, copyOk, onCopyOrgCode }) {
  return (
    <div
      className="p-5"
      style={{
        backgroundColor: DS.brandBg,
        border: `1px solid ${DS.brandBorder}`,
        borderLeft: `4px solid ${DS.brand}`,
      }}
    >
      {/* Title row */}
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <p
            className="text-xs font-black uppercase tracking-wider mb-1"
            style={{ color: DS.brand }}
          >
            Organization code
          </p>
          <p className="text-xs" style={{ color: DS.labelText }}>
            Share this with athletes so they can connect to your team.
          </p>
        </div>

        {/* Copy button */}
        <div className="shrink-0 flex flex-col items-end gap-1.5">
          <button
            type="button"
            onClick={onCopyOrgCode}
            disabled={!orgToken}
            className="px-4 py-2 text-xs font-bold uppercase tracking-wide transition-all rounded-sm"
            style={
              orgToken
                ? { backgroundColor: DS.brand, color: "#fff" }
                : { backgroundColor: DS.border, color: DS.dimText, cursor: "not-allowed" }
            }
            onMouseEnter={(e) => { if (orgToken) e.currentTarget.style.filter = "brightness(1.12)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.filter = "none"; }}
          >
            Copy
          </button>
          <span
            className="text-xs text-right min-h-[1rem]"
            style={{ color: DS.dimText }}
          >
            {copyOk || ""}
          </span>
        </div>
      </div>

      {/* Code display */}
      <div>
        <p
          className="text-xs font-bold uppercase tracking-wider mb-1.5"
          style={{ color: DS.labelText }}
        >
          Code
        </p>
        <input
          type="text"
          value={orgToken || "—"}
          readOnly
          onFocus={(e) => e.target.select()}
          className="w-full text-sm font-mono px-3 py-2.5 outline-none cursor-text"
          style={{
            backgroundColor: DS.readOnlyBg,
            border: `1px solid ${DS.border}`,
            color: orgToken ? DS.bodyText : DS.dimText,
            letterSpacing: orgToken ? "0.08em" : "normal",
          }}
        />
        {!orgToken && (
          <p className="text-xs mt-1.5" style={{ color: DS.dimText }}>
            Token missing from session — log out and back in to refresh.
          </p>
        )}
      </div>

      {/* Nav links */}
      <div className="mt-4 flex flex-wrap gap-2">
        <NavChip href="/org/trainers">Manage Trainers</NavChip>
        <NavChip href="/org/workouts-calendar">Org Dashboard</NavChip>
      </div>
    </div>
  );
}