// components/account/PersonalInfoSection.jsx
const DS = {
  brand:       "#1E3A5F",
  brandBg:     "#EEF3F9",
  brandBorder: "#C0D0E0",
  banned:      "#C8102E",
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

function TextInput({ value, onChange, placeholder, type = "text", invalid }) {
  return (
    <input
      type={type}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      className="w-full text-sm px-3 py-2.5 transition-all outline-none"
      style={{
        border: `1px solid ${invalid ? DS.banned : DS.brandBorder}`,
        backgroundColor: DS.brandBg,
        color: DS.bodyText,
      }}
      onFocus={(e) => {
        e.currentTarget.style.borderColor = invalid ? DS.banned : DS.brand;
        e.currentTarget.style.boxShadow = `0 0 0 3px ${invalid ? DS.banned : DS.brand}18`;
      }}
      onBlur={(e) => {
        e.currentTarget.style.borderColor = invalid ? DS.banned : DS.brandBorder;
        e.currentTarget.style.boxShadow = "none";
      }}
    />
  );
}

function ReadOnlyInput({ value }) {
  return (
    <input
      type="text"
      value={value || "—"}
      readOnly
      className="w-full text-sm px-3 py-2.5 outline-none cursor-default"
      style={{
        border: `1px solid ${DS.border}`,
        backgroundColor: DS.readOnlyBg,
        color: DS.dimText,
      }}
    />
  );
}

function FieldHint({ children, error }) {
  return (
    <p
      className="text-xs mt-1.5"
      style={{ color: error ? DS.banned : DS.dimText }}
    >
      {children}
    </p>
  );
}

export default function PersonalInfoSection({
  formData,
  validation,
  isOrgPrimary,
  onChangeField,
}) {
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
          Personal Info
        </h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Name */}
        <div>
          <FieldLabel>Name</FieldLabel>
          <TextInput
            value={formData?.name || ""}
            onChange={(e) => onChangeField?.("name", e.target.value)}
            placeholder="Your name"
          />
          {isOrgPrimary && (
            <FieldHint>
              This may appear as the organization name depending on your Airtable setup.
            </FieldHint>
          )}
        </div>

        {/* Email */}
        <div>
          <FieldLabel>Email</FieldLabel>
          <TextInput
            type="email"
            value={formData?.email || ""}
            onChange={(e) => onChangeField?.("email", e.target.value)}
            placeholder="you@example.com"
            invalid={!validation?.email}
          />
          {!validation?.email && (
            <FieldHint error>Invalid email format.</FieldHint>
          )}
        </div>

        {/* Phone */}
        <div>
          <FieldLabel>Phone <span style={{ color: DS.dimText, fontWeight: 400 }}>(optional)</span></FieldLabel>
          <TextInput
            type="tel"
            value={formData?.phone || ""}
            onChange={(e) => onChangeField?.("phone", e.target.value)}
            placeholder="+15551234567"
            invalid={!validation?.phone}
          />
          {!validation?.phone && (
            <FieldHint error>Invalid phone — digits only, optional +, 7–15 characters.</FieldHint>
          )}
        </div>

        {/* Created — read only */}
        <div>
          <FieldLabel>Member since</FieldLabel>
          <ReadOnlyInput value={formData?.created} />
          <FieldHint>Set at account creation.</FieldHint>
        </div>
      </div>
    </div>
  );
}