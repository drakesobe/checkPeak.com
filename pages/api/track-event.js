// pages/api/track-event.js
import Airtable from "airtable";
import crypto from "crypto";

function getClientIp(req) {
  const xf = req.headers["x-forwarded-for"];
  let ip = Array.isArray(xf) ? xf[0] : xf?.split(",")[0];
  ip = ip || req.headers["x-real-ip"] || req.socket?.remoteAddress || null;
  if (!ip) return null;
  if (ip.startsWith("::ffff:")) ip = ip.substring(7);
  return ip;
}

// Recommended: store a hashed IP instead of raw IP
function hashIp(ip) {
  if (!ip) return "";
  const salt = process.env.IP_HASH_SALT || "";
  return crypto.createHash("sha256").update(`${salt}:${ip}`).digest("hex");
}

const analyticsBase =
  process.env.ANALYTICS_API_KEY && process.env.ANALYTICS_BASE_ID
    ? new Airtable({ apiKey: process.env.ANALYTICS_API_KEY }).base(process.env.ANALYTICS_BASE_ID)
    : null;

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed. Use POST." });
  if (!analyticsBase || !process.env.ANALYTICS_TABLE_NAME) {
    return res.status(500).json({ error: "Analytics Airtable not configured" });
  }

  try {
    const {
      eventName,
      eventType,
      userEmail,
      path,
      source,
      payload,
      anonId,
      consent,
      client,
    } = req.body || {};

    if (!eventName) return res.status(400).json({ error: "eventName is required" });

    const nowIso = new Date().toISOString();
    const ip = getClientIp(req);

    const userAgent = req.headers["user-agent"] || "";
    const acceptLanguage = req.headers["accept-language"] || "";

    const fields = {
      "Event Name": String(eventName),
      "Event Type": eventType || "",
      "User Email": userEmail || "",
      Source: source || "",
      Path: path || "",
      "Anon ID": anonId || "",
      Consent: consent ? "yes" : "no",
      "IP Hash": hashIp(ip), // ✅ safer than raw IP
      // If you insist on raw IP, add a separate field, but I strongly discourage it.
      // "IP Address": ip || "",
      "User Agent": userAgent,
      "Accept-Language": acceptLanguage,
      "Client (JSON)": JSON.stringify(client || {}),
      "Payload (JSON)": JSON.stringify(payload || {}),
      "Created At": nowIso,
    };

    const created = await analyticsBase(process.env.ANALYTICS_TABLE_NAME).create([{ fields }]);
    return res.status(200).json({ ok: true, id: created[0].id });
  } catch (err) {
    console.error("[/api/track-event] Error:", err);
    return res.status(500).json({
      error: "Failed to track event",
      details: err?.message || String(err),
    });
  }
}
