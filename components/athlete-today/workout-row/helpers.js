export function normStatus(s) {
  return String(s || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/-+/g, "_");
}

export function asBool(v) {
  if (typeof v === "boolean") return v;
  return String(v ?? "").trim().toLowerCase() === "true";
}

export function safeText(v) {
  return String(v ?? "").trim();
}

export function hasText(v) {
  return Boolean(safeText(v));
}

export function formatWeight(v) {
  if (v === null || v === undefined) return "";
  const s = String(v).trim();
  return s || "";
}

export function cx(...xs) {
  return xs.filter(Boolean).join(" ");
}
