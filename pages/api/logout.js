// pages/api/logout.js
export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const isProd = process.env.NODE_ENV === "production";

  const parts = [
    "user=",
    "Path=/",
    "SameSite=Lax",
    "HttpOnly",
    "Max-Age=0",
  ];

  if (isProd) parts.push("Secure");

  res.setHeader("Set-Cookie", parts.join("; "));
  return res.status(200).json({ ok: true });
}
