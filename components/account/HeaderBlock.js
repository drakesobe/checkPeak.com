// components/account/HeaderBlock.jsx
import Link from "next/link";

const DS = {
  brand:       "#1E3A5F",
  brandBg:     "#EEF3F9",
  brandBorder: "#C0D0E0",
  border:      "#E8ECF0",
  bodyText:    "#2D3748",
  labelText:   "#6B7A8D",
  dimText:     "#9BA8B4",
};

function NavLink({ href, children }) {
  return (
    <Link
      href={href}
      className="text-xs font-bold uppercase tracking-wider hover:underline transition-colors"
      style={{ color: DS.labelText }}
    >
      {children}
    </Link>
  );
}

export default function HeaderBlock({
  roleLabel,
  email,
  isOrgMember,
  memberId,
  dashboardHref,
  isOrgSide,
}) {
  return (
    <div
      className="flex items-start justify-between gap-4 pb-5"
      style={{ borderBottom: `1px solid ${DS.border}` }}
    >
      {/* Left — title + pills */}
      <div className="min-w-0">
        <span
          className="inline-block text-xs font-black uppercase tracking-wider mb-2"
          style={{ color: DS.brand }}
        >
          CheckPeak
        </span>

        <h1
          className="font-black uppercase leading-none"
          style={{
            fontFamily: "'Barlow Condensed', sans-serif",
            fontSize: "clamp(1.5rem, 4vw, 2rem)",
            color: DS.bodyText,
            letterSpacing: "0.02em",
          }}
        >
          Account Settings
        </h1>

        <p className="text-sm mt-1.5" style={{ color: DS.labelText }}>
          Manage your profile, security, and organization connection.
        </p>

        {/* Pills */}
        <div className="mt-3 flex flex-wrap gap-2">
          {roleLabel && (
            <span
              className="inline-flex items-center px-3 py-1 text-xs font-bold uppercase tracking-wide rounded-sm"
              style={{
                backgroundColor: DS.brandBg,
                color: DS.brand,
                border: `1px solid ${DS.brandBorder}`,
              }}
            >
              {roleLabel}
            </span>
          )}
          {email && (
            <span
              className="inline-flex items-center px-3 py-1 text-xs font-medium truncate max-w-[240px] rounded-sm"
              style={{
                backgroundColor: "#F7F9FC",
                color: DS.labelText,
                border: `1px solid ${DS.border}`,
              }}
            >
              {email}
            </span>
          )}
          {isOrgMember && memberId && (
            <span
              className="inline-flex items-center px-3 py-1 text-xs font-medium rounded-sm"
              style={{
                backgroundColor: "#F7F9FC",
                color: DS.dimText,
                border: `1px solid ${DS.border}`,
              }}
            >
              Member
            </span>
          )}
        </div>
      </div>

      {/* Right — nav links */}
      <div className="shrink-0 flex flex-col items-end gap-2 pt-1">
        <NavLink href="/">Home</NavLink>
        <NavLink href={dashboardHref || "/"}>Dashboard</NavLink>
        {isOrgSide && <NavLink href="/org/trainers">Trainers</NavLink>}
      </div>
    </div>
  );
}