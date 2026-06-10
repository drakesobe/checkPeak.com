// pages/api/track-event.js
import { supabaseAdmin as db } from "@/lib/supabase";
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

const SKIP_EVENTS = new Set(["scroll_milestone", "time_milestone"]);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed. Use POST." });
  }

  try {
    const {
      eventName, eventType, userEmail, path, pageTitle,
      previousPath, entryPage, source, scrollDepth, timeOnPageSec,
      isReturnVisitor, payload, anonId, sessionId, consent,
      client, timestampEst, timestampUtc, consentGiven,
    } = req.body || {};

    if (!eventName) return res.status(400).json({ error: "eventName is required" });

    if (SKIP_EVENTS.has(eventName)) {
      return res.status(200).json({ ok: true, skipped: true });
    }

    const hasConsent =
      consent?.analytics === true ||
      consentGiven === true ||
      consentGiven === "true";

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

    const ip        = getClientIp(req);
    const userAgent = req.headers["user-agent"] || "";

    const row = {
      event_name:    String(eventName),
      event_type:    String(eventType || "") || null,
      path:          String(path      || "") || null,
      page_title:    String(pageTitle || "") || null,
      created_at:    createdAt,
      created_at_est: createdEst,
      consent:       hasConsent ? "yes" : "no",
      device_type:   String(client?.deviceType || "") || null,
      referrer:      String(client?.referrer   || "") || null,
      user_agent:    String(userAgent) || null,
      ip_hash:       hashIp(ip) || null,

      // Consent-gated fields
      user_email:        hasConsent ? String(userEmail    || "") || null : null,
      source:            hasConsent ? String(source       || "") || null : null,
      previous_path:     hasConsent ? String(previousPath || "") || null : null,
      entry_page:        hasConsent ? String(entryPage    || "") || null : null,
      scroll_depth:      hasConsent && typeof scrollDepth   === "number" ? scrollDepth   : null,
      time_on_page:      hasConsent && typeof timeOnPageSec === "number" ? timeOnPageSec : null,
      anon_id:           hasConsent ? String(anonId    || "") || null : null,
      session_id:        hasConsent ? String(sessionId || "") || null : null,
      is_return_visitor: hasConsent && typeof isReturnVisitor === "boolean" ? isReturnVisitor : null,
      payload_json:      hasConsent ? (payload || null) : null,
      utm_json:          hasConsent ? (client?.utm || null) : null,
    };

    const { data: created, error } = await db
      .from("analytics_events")
      .insert(row)
      .select("id")
      .single();

    if (error) throw error;

    return res.status(200).json({ ok: true, id: created?.id });

  } catch (err) {
    console.error("[/api/track-event] Error:", err);
    return res.status(500).json({ error: "Failed to track event", details: err?.message });
  }
}
