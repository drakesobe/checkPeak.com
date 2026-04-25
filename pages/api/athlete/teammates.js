// pages/api/athlete/teammates.js
// Returns all athletes in the same organization (matched by Token field).
// Used by the mobile app to sync teammates to Firestore once per day.
// Auth: reads session from cookie (same as all other athlete endpoints).

import Airtable from "airtable";

function asString(v) {
  return String(v ?? "").trim();
}

function getSessionUser(req) {
  try {
    const cookieHeader = req.headers.cookie || '';
    const cookies = {};
    cookieHeader.split(';').forEach(part => {
      const eqIdx = part.indexOf('=');
      if (eqIdx === -1) return;
      const key = part.slice(0, eqIdx).trim();
      const val = part.slice(eqIdx + 1).trim();
      cookies[key] = decodeURIComponent(val);
    });
    const raw = cookies['user'];
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // Accept token from query param (mobile) or session cookie (web)
  let orgToken = asString(req.query?.token || req.query?.orgToken || "");

  // Fallback to session cookie if no query param
  if (!orgToken) {
    const session = getSessionUser(req);
    if (!session) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    orgToken = asString(
      session.Token || session.token ||
      session.OrgToken || session.orgToken || ""
    );
  }

  if (!orgToken) {
    return res.status(400).json({ error: "No organization token found" });
  }

  const apiKey    = process.env.ATHLETE_API_KEY;
  const baseId    = process.env.ATHLETE_BASE_ID;
  const tableName = process.env.ATHLETE_TABLE_NAME;

  if (!apiKey || !baseId || !tableName) {
    return res.status(500).json({ error: "Athlete Airtable not configured." });
  }

  try {
    const base    = new Airtable({ apiKey }).base(baseId);
    const records = [];

    // Pull all athletes with matching Token — paginate through all pages
    await base(tableName)
      .select({
        filterByFormula: `{Token} = '${orgToken.replace(/'/g, "\\'")}'`,
        fields: ['Name', 'Email', 'Phone', 'sport', 'Token', 'AthleteToken', 'Role', 'Title', 'Organization'],
        pageSize: 100,
      })
      .eachPage((page, fetchNext) => {
        page.forEach(record => {
          const f = record.fields || {};
          // Exclude the requesting athlete themselves
          if (record.id === (session.id || session.athleteId)) return;
          records.push({
            id:           record.id,
            name:         asString(f.Name),
            email:        asString(f.Email).toLowerCase(),
            phone:        asString(f.Phone),
            sport:        asString(f.sport).toLowerCase(),
            role:         asString(f.Role) || 'Athlete',
            title:        asString(f.Title),
            athleteToken: asString(f.AthleteToken),
            orgToken:     asString(f.Token),
          });
        });
        fetchNext();
      });

    return res.status(200).json({
      ok:        true,
      teammates: records,
      count:     records.length,
    });
  } catch (err) {
    console.error("[teammates] error:", err);
    return res.status(500).json({
      error:   "Failed to fetch teammates",
      details: asString(err?.message || err),
    });
  }
}