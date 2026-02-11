// components/org/trainers/utils/strings.js
export function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

export function classNames(...xs) {
  return xs.filter(Boolean).join(" ");
}
