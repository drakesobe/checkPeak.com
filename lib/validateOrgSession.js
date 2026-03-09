// lib/validateOrgSession.js
//
// Call this in any org-side page as soon as `user` is available.
// Returns { valid: true } or { valid: false, missing: string[] }.
//
// This surfaces user-object field casing mismatches immediately rather than
// letting them silently degrade into 400 "Missing orgId" or empty UI strings.
//
// REQUIRED fields (every org-side API call depends on these):
//   user.orgId  — the Airtable record ID of the org (used in member queries)
//   user.Token  — the org's token (used as fallback filter + on invite)
//   user.role   — determines canManage / canView gates
//
// RECOMMENDED fields (affect UI quality but don't break API calls):
//   user.Name or user.name   — shown in header + invite emails
//   user.Email or user.email — shown in header subtitle
//   user.OrgName             — shown in header + invite emails

const REQUIRED = [
  {
    keys:    ["orgId", "OrgId"],
    label:   "orgId",
    why:     "Every org API call requires orgId to scope queries to your organization.",
  },
  {
    keys:    ["Token", "token"],
    label:   "Token",
    why:     "Token is used as a fallback filter in members/list and is required by members/invite.",
  },
  {
    keys:    ["role", "Role"],
    label:   "role",
    why:     "Role determines whether the user can view/manage members.",
  },
];

const RECOMMENDED = [
  { keys: ["Name",    "name"],    label: "Name"    },
  { keys: ["Email",   "email"],   label: "Email"   },
  { keys: ["OrgName", "orgName"], label: "OrgName" },
];

function hasAny(obj, keys) {
  return keys.some((k) => obj?.[k] !== undefined && obj?.[k] !== null && obj?.[k] !== "");
}

/**
 * @param {object} user — the user object from useAuthContext()
 * @param {object} [opts]
 * @param {boolean} [opts.logWarnings=true] — log recommended field warnings to console
 * @returns {{ valid: boolean, missing: string[], warnings: string[] }}
 */
export function validateOrgSession(user, { logWarnings = true } = {}) {
  if (!user || typeof user !== "object") {
    return {
      valid:    false,
      missing:  ["user object is null or not an object"],
      warnings: [],
    };
  }

  const missing  = [];
  const warnings = [];

  for (const field of REQUIRED) {
    if (!hasAny(user, field.keys)) {
      missing.push(
        `user.${field.label} is missing or empty — ${field.why}\n` +
        `  Checked keys: ${field.keys.map((k) => `user.${k}`).join(", ")}\n` +
        `  Actual user keys: ${Object.keys(user).join(", ")}`
      );
    }
  }

  for (const field of RECOMMENDED) {
    if (!hasAny(user, field.keys)) {
      warnings.push(
        `user.${field.label} not found (checked: ${field.keys.map((k) => `user.${k}`).join(", ")})`
      );
    }
  }

  if (logWarnings && warnings.length > 0 && typeof console !== "undefined") {
    console.warn(
      "[validateOrgSession] Recommended fields missing on session user:\n" +
      warnings.map((w) => `  ⚠ ${w}`).join("\n") +
      "\n  Full user object:", user
    );
  }

  if (missing.length > 0 && typeof console !== "undefined") {
    console.error(
      "[validateOrgSession] REQUIRED fields missing on session user — API calls will fail:\n" +
      missing.map((m) => `  ✗ ${m}`).join("\n")
    );
  }

  return {
    valid:    missing.length === 0,
    missing,
    warnings,
  };
}

/**
 * Convenience: returns the first resolved value across multiple key candidates.
 * Useful for reading a field that may have been serialized under different casings.
 *
 * Example:
 *   const orgId = resolveField(user, ["orgId", "OrgId", "org_id"])
 */
export function resolveField(obj, keys, fallback = "") {
  for (const k of keys) {
    const v = obj?.[k];
    if (v !== undefined && v !== null && v !== "") return v;
  }
  return fallback;
}