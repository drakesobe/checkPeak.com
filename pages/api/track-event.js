// pages/api/track-event.js
import Airtable from "airtable";

/** Extract full client IP from request (no anonymization) **/
function getClientIp(req) {
  const xf = req.headers["x-forwarded-for"];
  // x-forwarded-for can be a list: "client, proxy1, proxy2"
  let ip = Array.isArray(xf) ? xf[0] : xf?.split(",")[0];

  ip = ip || req.headers["x-real-ip"] || req.socket?.remoteAddress || null;
  if (!ip) return null;

  // Normalize IPv6-encoded IPv4, e.g. "::ffff:123.45.67.89"
  if (ip.startsWith("::ffff:")) ip = ip.substring(7);

  return ip;
}

const analyticsBase =
  process.env.ANALYTICS_API_KEY && process.env.ANALYTICS_BASE_ID
    ? new Airtable({ apiKey: process.env.ANALYTICS_API_KEY }).base(
        process.env.ANALYTICS_BASE_ID
      )
    : null;

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed. Use POST." });
  }

  if (!analyticsBase || !process.env.ANALYTICS_TABLE_NAME) {
    return res
      .status(500)
      .json({ error: "Analytics Airtable not configured" });
  }

  try {
    const {
      eventName,
      eventType,
      userEmail,
      path,
      source,
      device,
      payload,
    } = req.body || {};

    if (!eventName) {
      return res.status(400).json({ error: "eventName is required" });
    }

    const nowIso = new Date().toISOString();
    const ipAddress = getClientIp(req);

    const fields = {
      "Event Name": String(eventName),
      "Event Type": eventType || "",
      "User Email": userEmail || "",
      Source: source || "",
      Path: path || "",
      Device: device || "",
      "IP Address": ipAddress || "",
      "Payload (JSON)": JSON.stringify(payload || {}),
      "Created At": nowIso,
    };

    // Optional: debug log to terminal
    console.log("[/api/track-event] Creating analytics row with fields:", fields);

    const created = await analyticsBase(
      process.env.ANALYTICS_TABLE_NAME
    ).create([{ fields }]);

    return res.status(200).json({ ok: true, id: created[0].id });
  } catch (err) {
    console.error("[/api/track-event] Error:", err);
    return res.status(500).json({
      error: "Failed to track event",
      details: err?.message || String(err),
    });
  }
}
