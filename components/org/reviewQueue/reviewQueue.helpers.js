export async function safeJson(res) {
  try {
    return await res.json();
  } catch {
    return {};
  }
}

export function getRole(user) {
  const raw = String(user?.role || user?.Role || "").trim().toLowerCase();
  if (!raw) return "";
  if (raw === "organization") return "organization";
  if (raw === "admin") return "admin";
  if (raw === "trainer") return "trainer";
  if (raw.includes("org")) return "organization";
  if (raw.includes("admin")) return "admin";
  if (raw.includes("train")) return "trainer";
  if (raw.includes("ath")) return "athlete";
  return raw;
}

export function normalizeReviewStatus(v) {
  const s = String(v || "").trim().toLowerCase();
  if (!s) return "";
  if (s === "pending_review") return "pending";
  if (s === "pending") return "pending";
  if (s === "needs_info" || s === "needsinfo" || s === "needs info") return "needs_info";
  if (s === "approved" || s === "complete" || s === "completed") return "approved";
  return s;
}
