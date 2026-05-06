// pages/api/org/athlete/bulk-import.js
// POST { athletes: [{ firstName, lastName, email, sport, phone }] }
// Creates Athlete records in Airtable, deduplicates against existing emails,
// returns { created, skipped, errors: [{ email, reason }] }

import { requireOrgSideUser } from "@/lib/requireUser";
import { AT, base, F } from "@/lib/airtableOrgWorkoutConfig";
import bcrypt from "bcryptjs";
import crypto from "crypto";

// ─── Field map - adjust these to match your Athletes table ───────────────────
const A = {
  NAME:    F?.ATH_NAME    || "Name",
  EMAIL:   F?.ATH_EMAIL   || "Email",
  SPORT:   F?.ATH_SPORT   || "sport",
  PHONE:   F?.ATH_PHONE   || "Phone",
  TOKEN:   F?.ATH_TOKEN   || "AthleteToken",
  ORG:     F?.ATH_ORG     || "Organization",
  ORGID:   F?.ATH_ORGID   || "Token",
  PASS:    F?.ATH_PASS    || "Password",
  ROLE:    F?.ATH_ROLE    || "Role",
  STATUS:  F?.ATH_STATUS  || "Status",
  CREATED:   F?.ATH_CREATED || "CreatedAt",
};

function chunk(arr, n = 10) {
  const out = [];
  for (let i = 0; i < (arr || []).length; i += n) out.push(arr.slice(i, i + n));
  return out;
}

function escapeAirtableString(str = "") {
  return String(str).replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

function generateAthleteToken() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let id = "ATH-";
  for (let i = 0; i < 8; i++) id += chars[Math.floor(Math.random() * chars.length)];
  return id;
}

function generateTempPassword() {
  // Readable temp password - athlete will be prompted to change on first login
  return `Peak${crypto.randomBytes(4).toString("hex").toUpperCase()}!`;
}

function validateEmail(e) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(e || "").trim());
}

async function getExistingEmails(b, emails) {
  const Athletes = b(AT.tables.athletes);
  const emailField = A.EMAIL;
  const existing = new Set();

  for (const emailChunk of chunk(emails, 30)) {
    const orParts = emailChunk.map(e => `LOWER({${emailField}})='${escapeAirtableString(e.toLowerCase())}'`).join(",");
    const rows = await Athletes.select({
      filterByFormula: `OR(${orParts})`,
      fields: [emailField],
      maxRecords: emailChunk.length,
    }).firstPage();
    for (const r of rows || []) {
      const e = String(r?.fields?.[emailField] || "").trim().toLowerCase();
      if (e) existing.add(e);
    }
  }
  return existing;
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const user = requireOrgSideUser(req, res);
  if (!user) return;

  const { athletes } = req.body || {};

  if (!Array.isArray(athletes) || !athletes.length) {
    return res.status(400).json({ error: "athletes array is required" });
  }
  if (athletes.length > 1000) {
    return res.status(400).json({ error: "Maximum 1,000 athletes per import" });
  }

  const orgId    = user.orgId;
  const orgRecId = user.orgRecordId || user.orgId;
  const orgToken = String(user.Token || user.token || user["Organization Token"] || "").trim();
  if (!orgId) return res.status(400).json({ error: "Missing orgId on session" });

  // ── Validate incoming rows ────────────────────────────────────────────────
  const valid   = [];
  const errors  = [];

  for (const a of athletes) {
    const email = String(a.email || "").trim().toLowerCase();
    if (!email || !validateEmail(email)) {
      errors.push({ email: email || "(blank)", reason: "Invalid email" });
      continue;
    }
    const firstName = String(a.firstName || "").trim();
    const lastName  = String(a.lastName  || "").trim();
    if (!firstName || !lastName) {
      errors.push({ email, reason: "Missing first or last name" });
      continue;
    }
    valid.push({ ...a, email, firstName, lastName });
  }

  if (!valid.length) {
    return res.status(400).json({ ok: false, created: 0, skipped: 0, errors });
  }

  const b = base();

  // ── Deduplicate against existing Athletes in Airtable ────────────────────
  const incomingEmails  = valid.map(a => a.email);
  const existingEmails  = await getExistingEmails(b, incomingEmails);

  const toCreate = [];
  let   skipped  = 0;

  for (const a of valid) {
    if (existingEmails.has(a.email)) {
      errors.push({ email: a.email, reason: "Email already exists in roster" });
      skipped++;
      continue;
    }
    toCreate.push(a);
  }

  // ── Create Airtable records in batches of 10 ─────────────────────────────
  let created = 0;

  for (const batch of chunk(toCreate, 10)) {
    const records = await Promise.all(batch.map(async a => {
      const tempPassword = generateTempPassword();
      const hashedPass   = await bcrypt.hash(tempPassword, 10);
      const token        = generateAthleteToken();
      const name         = `${a.firstName} ${a.lastName}`;

      const fields = {
        [A.NAME]:   name,
        [A.EMAIL]:  a.email,
        [A.TOKEN]:  token,
        [A.PASS]:   hashedPass,
        [A.ROLE]:   "athlete",
        [A.CREATED]: new Date().toISOString(),
        // Optional fields - only write if value exists
        ...(a.sport ? { [A.SPORT]: a.sport } : {}),
        ...(a.phone ? { [A.PHONE]: a.phone } : {}),
        // Org link - adjust field name/format to match your Airtable setup
        ...(orgToken ? { [A.ORGID]: orgToken } : {}),
        ...(orgRecId ? { [A.ORG]:   [orgRecId] } : {}), 
      };

      // Remove any undefined keys
      for (const k of Object.keys(fields)) {
        if (!k || k === "undefined") delete fields[k];
      }

      return { fields, _tempPassword: tempPassword, _email: a.email, _name: name };
    }));

    // Write to Airtable
    try {
      const creates = records.map(({ fields }) => ({ fields }));
      await b(AT.tables.athletes).create(creates);
      created += records.length;

      // TODO: Send invite emails here if you have an email service set up.
      // Example with your existing email infrastructure:
      // for (const r of records) {
      //   await sendInviteEmail({ to: r._email, name: r._name, tempPassword: r._tempPassword });
      // }
    } catch (e) {
      console.error("[bulk-import] Airtable create error:", e?.message);
      for (const r of records) {
        errors.push({ email: r._email, reason: e?.message || "Airtable write failed" });
      }
    }
  }

  return res.status(200).json({
    ok:      true,
    created,
    skipped,
    errors,
  });
}