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

function hashIp(ip) {
  if (!ip) return "";
  const salt = process.env.IP_HASH_SALT || "";
  return crypto.createHash("sha256").update(`${salt}:${ip}`).digest("hex");
}

const analyticsBase =
  process.env.ANALYTICS_API_KEY && process.env.ANALYTICS_BASE_ID
    ? new Airtable({ apiKey: process.env.ANALYTICS_API_KEY }).base(process.env.ANALYTICS_BASE_ID)
    : null;

// Scroll and time milestones are too noisy for Airtable — they still
// fire to GA on the client, just skip the DB write here.
const SKIP_AIRTABLE = new Set([
  "scroll_milestone",
  "time_milestone",
]);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed. Use POST." });
  }
  if (!analyticsBase || !process.env.ANALYTICS_TABLE_NAME) {
    return res.status(500).json({ error: "Analytics Airtable not configured" });
  }

  try {
    const {
      eventName,
      eventType,
      userEmail,
      path,
      pageTitle,
      previousPath,
      entryPage,
      source,
      scrollDepth,
      timeOnPageSec,
      isReturnVisitor,
      payload,
      anonId,
      sessionId,
      consent,
      client,
      timestampEst,
      timestampUtc,
    } = req.body || {};

    if (!eventName) return res.status(400).json({ error: "eventName is required" });

    if (SKIP_AIRTABLE.has(eventName)) {
      return res.status(200).json({ ok: true, skipped: true });
    }

    // Use client-side EST timestamp if present, fallback to server time
    const createdAt  = timestampUtc || new Date().toISOString();
    const createdEst = timestampEst || (() => {
      const now = new Date();
      const f   = new Intl.DateTimeFormat("en-US", {
        timeZone: "America/New_York",
        year: "numeric", month: "2-digit", day: "2-digit",
        hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
      });
      const p = {};
      f.formatToParts(now).forEach(({ type, value }) => { p[type] = value; });
      return `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}:${p.second} EST`;
    })();

    const ip         = getClientIp(req);
    const userAgent  = req.headers["user-agent"] || "";
    const acceptLang = req.headers["accept-language"] || "";

    const deviceType = client?.deviceType || "";
    const connection = client?.connection || "";
    const pageLoadMs = client?.pageLoadMs ?? null;
    const timezone   = client?.timezone   || "";
    const language   = client?.language   || "";
    const referrer   = client?.referrer   || "";
    const utm        = client?.utm        || {};
    const viewport   = client?.viewport   || {};
    const screen     = client?.screen     || {};
    const geo        = client?.geo        || {};

    const fields = {
      // ── Core ──────────────────────────────────────────────────────────
      "Event Name":        String(eventName),
      "Event Type":        String(eventType  || ""),
      "User Email":        String(userEmail  || ""),
      "Source":            String(source     || ""),
      "Path":              String(path       || ""),

      // ── Timestamps ────────────────────────────────────────────────────
      "Created At":        createdAt,
      "Created At (EST)":  createdEst,

      // ── Page context ──────────────────────────────────────────────────
      "Page Title":        String(pageTitle    || ""),
      "Previous Path":     String(previousPath || ""),
      "Entry Page":        String(entryPage    || ""),

      // ── Engagement ────────────────────────────────────────────────────
      "Scroll Depth":      typeof scrollDepth   === "number" ? scrollDepth   : null,
      "Time on Page":      typeof timeOnPageSec === "number" ? timeOnPageSec : null,

      // ── Visitor identity ───────────────────────────────────────────────
      "Anon ID":           String(anonId    || ""),
      "Session ID":        String(sessionId || ""),
      "Is Return Visitor": typeof isReturnVisitor === "boolean" ? isReturnVisitor : false,

      // ── Device + network ───────────────────────────────────────────────
      "Device Type":       String(deviceType || ""),
      "Connection":        String(connection || ""),
      "Performance (ms)":  typeof pageLoadMs === "number" ? pageLoadMs : null,

      // ── Location ──────────────────────────────────────────────────────
      "Latitude":          typeof geo.lat === "number" ? geo.lat : null,
      "Longitude":         typeof geo.lng === "number" ? geo.lng : null,
      "Geo Accuracy (m)":  typeof geo.accuracy === "number" ? geo.accuracy : null,

      // ── Client context ─────────────────────────────────────────────────
      "Timezone":          String(timezone   || ""),
      "Language":          String(language   || ""),
      "Referrer":          String(referrer   || ""),
      "User Agent":        String(userAgent  || ""),
      "Accept-Language":   String(acceptLang || ""),

      // ── Privacy-safe identity ──────────────────────────────────────────
      "IP Hash":           hashIp(ip),

      // ── Consent ────────────────────────────────────────────────────────
      "Consent":           consent?.analytics ? "yes" : "no",

      // ── Structured overflows ───────────────────────────────────────────
      "UTM (JSON)":        JSON.stringify(utm),
      "Viewport (JSON)":   JSON.stringify({ viewport, screen }),
      "Payload (JSON)":    JSON.stringify(payload || {}),
    };

    const cleanFields = Object.fromEntries(
      Object.entries(fields).filter(([, v]) => v !== null && v !== undefined)
    );

    const created = await analyticsBase(process.env.ANALYTICS_TABLE_NAME).create([
      { fields: cleanFields },
    ]);

    return res.status(200).json({ ok: true, id: created[0].id });

  } catch (err) {
    console.error("[/api/track-event] Error:", err);
    return res.status(500).json({
      error:   "Failed to track event",
      details: err?.message || String(err),
    });
  }
}