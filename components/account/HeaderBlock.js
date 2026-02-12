// components/account/HeaderBlock.js
import Link from "next/link";

function classNames(...xs) {
  return xs.filter(Boolean).join(" ");
}

export default function HeaderBlock({
  roleLabel,
  email,
  isOrgMember,
  memberId,
  dashboardHref,
  isOrgSide,
}) {
  const pill = "inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold";

  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <p className="text-xs font-semibold tracking-wide text-[#46769B]">CHECKPEAK</p>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight mt-1">
          Account Settings
        </h1>
        <p className="text-gray-600 text-sm mt-2">
          Manage your profile, security, and organization connection.
        </p>

        <div className="mt-3 flex flex-wrap gap-2">
          <span className={classNames(pill, "bg-blue-50 text-[#46769B]")}>{roleLabel}</span>

          {email ? (
            <span className={classNames(pill, "bg-gray-50 text-gray-700 truncate max-w-[260px]")}>
              {email}
            </span>
          ) : null}

          {isOrgMember && memberId ? (
            <span className={classNames(pill, "bg-gray-50 text-gray-700")}>Member</span>
          ) : null}
        </div>
      </div>

      <div className="shrink-0 flex flex-col items-end gap-2">
        <Link href="/" className="text-sm font-semibold text-[#46769B] hover:underline">
          Home
        </Link>
        <Link href={dashboardHref || "/"} className="text-sm font-semibold text-gray-600 hover:underline">
          Dashboard
        </Link>

        {isOrgSide ? (
          <Link href="/org/trainers" className="text-sm font-semibold text-gray-600 hover:underline">
            Trainers
          </Link>
        ) : null}
      </div>
    </div>
  );
}
