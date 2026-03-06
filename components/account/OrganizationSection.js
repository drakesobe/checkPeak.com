// components/account/OrganizationSection.jsx
"use client";

import AthleteConnectOrgCard from "./AthleteConnectOrgCard";
import OrgCodeCard from "./OrgCodeCard";

const DS = {
  brand:       "#1E3A5F",
  brandBg:     "#EEF3F9",
  brandBorder: "#C0D0E0",
  caution:     "#E87722",
  cautionBg:   "#FFFBF0",
  cautionBorder:"#FFE0A8",
  border:      "#E8ECF0",
  bodyText:    "#2D3748",
  labelText:   "#6B7A8D",
  dimText:     "#9BA8B4",
  readOnlyBg:  "#F7F9FC",
};

function FieldLabel({ children }) {
  return (
    <label
      className="block text-xs font-black uppercase tracking-wider mb-1.5"
      style={{ color: DS.labelText }}
    >
      {children}
    </label>
  );
}

function ReadOnlyInput({ value, loading }) {
  return (
    <input
      type="text"
      value={loading ? "Loading…" : (value || "—")}
      readOnly
      className="w-full text-sm px-3 py-2.5 outline-none cursor-default"
      style={{
        border: `1px solid ${DS.border}`,
        backgroundColor: DS.readOnlyBg,
        color: loading ? DS.dimText : DS.labelText,
        fontStyle: loading ? "italic" : "normal",
      }}
    />
  );
}

function FieldHint({ children }) {
  return (
    <p className="text-xs mt-1.5" style={{ color: DS.dimText }}>
      {children}
    </p>
  );
}

export default function OrganizationSection(props) {
  const {
    isAthlete,
    isOrgSide,
    isOrgMember,
    organizationDisplay,
    orgId,
    titleValue,
    memberId,
    orgToken,
    // Hydrate state — passed from account.js Fix 5
    orgHydrating = false,
    orgHydrateError = "",
  } = props;

  return (
    <div className="space-y-5">
      <div style={{ borderBottom: `2px solid ${DS.border}`, paddingBottom: "0.5rem" }}>
        <h2
          className="font-black uppercase"
          style={{
            fontFamily: "'Barlow Condensed', sans-serif",
            fontSize: "0.95rem",
            color: DS.bodyText,
            letterSpacing: "0.06em",
          }}
        >
          Organization
        </h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Organization name */}
        <div>
          <FieldLabel>Organization</FieldLabel>
          <ReadOnlyInput value={organizationDisplay} loading={orgHydrating} />

          {/* Hydrate error — shown only when the background fetch fails */}
          {orgHydrateError && !orgHydrating && (
            <div
              className="mt-2 px-3 py-2 text-xs"
              style={{
                backgroundColor: DS.cautionBg,
                border: `1px solid ${DS.cautionBorder}`,
                borderLeft: `3px solid ${DS.caution}`,
                color: "#7A4A0A",
              }}
            >
              {orgHydrateError} — try refreshing or logging out and back in.
            </div>
          )}

          {!orgHydrateError && (
            <FieldHint>
              Verified field. Athletes connect via organization code only.
            </FieldHint>
          )}

          {isOrgSide && orgId && (
            <p className="text-xs mt-1 font-mono truncate" style={{ color: DS.dimText }}>
              ID: {String(orgId)}
            </p>
          )}
        </div>

        {/* Title / Role */}
        <div>
          <FieldLabel>Title / Role</FieldLabel>
          <ReadOnlyInput value={titleValue} />
          <FieldHint>Role is set by your account type.</FieldHint>
          {isOrgMember && memberId && (
            <p className="text-xs mt-1 font-mono truncate" style={{ color: DS.dimText }}>
              Member ID: {String(memberId)}
            </p>
          )}
        </div>
      </div>

      {/* Athlete — connect org card */}
      {isAthlete && <AthleteConnectOrgCard {...props} />}

      {/* Org side — share org code */}
      {isOrgSide && <OrgCodeCard {...props} orgToken={orgToken} />}
    </div>
  );
}