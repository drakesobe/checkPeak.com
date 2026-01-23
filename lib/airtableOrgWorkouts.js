import Airtable from "airtable";

export function getBase(apiKey, baseId) {
  return new Airtable({ apiKey }).base(baseId);
}

export function escapeAirtableString(str = "") {
  return String(str).replace(/'/g, "\\'");
}

export function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}
export function normalizeToken(token) {
  return String(token || "").trim();
}
