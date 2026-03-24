// pages/api/smartstack/subscribe.js
// Saves a price-alert email to the Athletes table (ATHLETE_TABLE_NAME).
// Matches field names from athlete-signup.js exactly.
// POST { email, category }
import Airtable from "airtable";

function asString(v) { return String(v ?? "").trim(); }

function isValidEmail(e) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(asString(e));
}

function escapeAirtable(str = "") {
  return String(str).replace(/'/g, "\\'");
}

const base =
  process.env.ATHLETE_API_KEY && process.env.ATHLETE_BASE_ID
    ? new Airtable({ apiKey: process.env.ATHLETE_API_KEY }).base(process.env.ATHLETE_BASE_ID)
    : null;

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const email    = asString(req.body?.email).toLowerCase();
  const category = asString(req.body?.category) || "Supplements";

  if (!isValidEmail(email)) {
    return res.status(400).json({ error: "Invalid email address." });
  }

  if (!base || !process.env.ATHLETE_TABLE_NAME) {
    console.warn("[smartstack/subscribe] Athletes table not configured — email not saved:", email);
    return res.status(200).json({ ok: true, saved: false, reason: "not_configured" });
  }

  try {
    // Check for existing record — don't create duplicates
    const existing = await base(process.env.ATHLETE_TABLE_NAME)
      .select({
        filterByFormula: `LOWER({Email})='${escapeAirtable(email)}'`,
        maxRecords: 1,
      })
      .firstPage();

    if (existing.length > 0) {
      // Already in the table — still a success, just don't duplicate
      console.log(`[smartstack/subscribe] Already exists: ${email}`);
      return res.status(200).json({ ok: true, saved: false, reason: "already_exists" });
    }

    // Create lightweight lead record — same fields as athlete-signup.js
    await base(process.env.ATHLETE_TABLE_NAME).create([{
      fields: {
        Email:     email,
        Name:      email.split("@")[0], // best guess at a name until they sign up
        Title:     "Athlete",
        Role:      "Athlete",
        Type:      "Athlete",
        Source:    "price_alert",
        CreatedAt: new Date().toISOString(),
        // Tag the category they were interested in — useful for segmenting blasts
        Notes:     `Price alert subscriber — interested in: ${category}`,
      },
    }]);

    console.log(`[smartstack/subscribe] Saved: ${email} (${category})`);
    return res.status(200).json({ ok: true, saved: true });

  } catch (err) {
    console.error("[smartstack/subscribe] Airtable error:", err);
    // Non-fatal — don't break the UX
    return res.status(200).json({ ok: true, saved: false, reason: err?.message });
  }
}