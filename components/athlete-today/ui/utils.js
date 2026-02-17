// components/athlete-today/ui/utils.js

export function classNames(...xs) {
  return xs.filter(Boolean).join(" ");
}

export async function safeJson(res) {
  try {
    return await res.json();
  } catch {
    return {};
  }
}

/**
 * statusTone
 * broadened for your real statuses used across workout/nutrition flows
 */
export function statusTone(status) {
  const s = String(status || "").toLowerCase();

  if (s === "completed") return "good";
  if (s === "pending_review" || s === "needs_info" || s === "assigned")
    return "warn";
  if (s === "rejected") return "bad";
  if (s === "draft") return "neutral";

  return "neutral";
}
