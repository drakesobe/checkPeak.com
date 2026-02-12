"use client";

import AthleteConnectOrgCard from "./AthleteConnectOrgCard";
import OrgCodeCard from "./OrgCodeCard";

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
  } = props;

  const labelBase = "block text-gray-800 font-medium mb-1";
  const readOnlyBase = "w-full border border-gray-200 rounded-2xl px-4 py-2 bg-gray-50 text-gray-700";

  return (
    <div className="space-y-4 mt-6">
      <h2 className="text-lg font-semibold text-gray-900">Organization</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className={labelBase}>Organization (locked)</label>
          <input type="text" value={organizationDisplay} readOnly className={readOnlyBase} />
          <p className="text-[11px] text-gray-500 mt-2">
            This field is verified. Athletes can only connect via an organization code.
          </p>
          {isOrgSide && orgId ? (
            <p className="text-[11px] text-gray-400 mt-1 truncate">Org ID: {String(orgId)}</p>
          ) : null}
        </div>

        <div>
          <label className={labelBase}>Title / Role</label>
          <input type="text" value={titleValue} readOnly className={readOnlyBase} />
          <p className="text-[11px] text-gray-500 mt-2">Role is set by your account type and can’t be edited here.</p>
          {isOrgMember && memberId ? (
            <p className="text-[11px] text-gray-400 mt-1 truncate">Member ID: {String(memberId)}</p>
          ) : null}
        </div>
      </div>

      {isAthlete ? <AthleteConnectOrgCard {...props} /> : null}
      {isOrgSide ? <OrgCodeCard {...props} orgToken={orgToken} /> : null}
    </div>
  );
}
