// components/account/PersonalInfoSection.js
function classNames(...xs) {
  return xs.filter(Boolean).join(" ");
}

export default function PersonalInfoSection({
  formData,
  validation,
  isOrgPrimary,
  onChangeField,
}) {
  const labelBase = "block text-gray-800 font-medium mb-1";
  const inputBase =
    "w-full border border-gray-200 rounded-2xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-[#46769B]/30 transition text-gray-900 placeholder:text-gray-400";
  const readOnlyBase =
    "w-full border border-gray-200 rounded-2xl px-4 py-2 bg-gray-50 text-gray-700";

  return (
    <div className="space-y-4 mt-6">
      <h2 className="text-lg font-semibold text-gray-900">Personal Info</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className={labelBase}>Name</label>
          <input
            type="text"
            value={formData?.name || ""}
            onChange={(e) => onChangeField?.("name", e.target.value)}
            className={inputBase}
            placeholder="Your name"
          />
          {isOrgPrimary ? (
            <p className="text-[11px] text-gray-500 mt-2">
              Organization owners may see this as the organization name (depending on your Organizations table).
            </p>
          ) : null}
        </div>

        <div>
          <label className={labelBase}>Email</label>
          <input
            type="email"
            value={formData?.email || ""}
            onChange={(e) => onChangeField?.("email", e.target.value)}
            className={classNames(inputBase, validation?.email ? "" : "border-red-300 focus:ring-red-200")}
            placeholder="you@example.com"
          />
          {!validation?.email ? (
            <p className="text-red-600 text-xs mt-1">Invalid email format</p>
          ) : null}
        </div>

        <div>
          <label className={labelBase}>Phone</label>
          <input
            type="tel"
            value={formData?.phone || ""}
            onChange={(e) => onChangeField?.("phone", e.target.value)}
            className={classNames(inputBase, validation?.phone ? "" : "border-red-300 focus:ring-red-200")}
            placeholder="+15551234567 (optional)"
          />
          {!validation?.phone ? (
            <p className="text-red-600 text-xs mt-1">Invalid phone number (digits, optional +, 7–15 chars).</p>
          ) : null}
        </div>

        <div>
          <label className={labelBase}>Created</label>
          <input type="text" value={formData?.created || "—"} readOnly className={readOnlyBase} />
        </div>
      </div>
    </div>
  );
}
