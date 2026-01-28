// pages/api/finish-setup.js
import Airtable from "airtable";

// Prefer bcryptjs in Next.js
async function hashPassword(plain) {
  const pw = String(plain || "");
  if (!pw) throw new Error("Password is required.");

  try {
    const bcryptjs = await import("bcryptjs");
    const salt = await bcryptjs.genSalt(10);
    return await bcryptjs.hash(pw, salt);
  } catch {
    try {
      const bcrypt = await import("bcrypt");
      const salt = await bcrypt.genSalt(10);
      return await bcrypt.hash(pw, salt);
    } catch {
      throw new Error(
        "Password hashing library not found. Install bcryptjs (recommended): npm i bcryptjs"
      );
    }
  }
}

function normalizeRole(role) {
  return String(role || "").trim().toLowerCase() === "organization"
    ? "organization"
    : "athlete";
}

function escapeAirtableString(str = "") {
  // Airtable formula strings use single quotes; escape them.
  return String(str).replace(/'/g, "\\'");
}

function getConfig(roleNorm) {
  if (roleNorm === "organization") {
    return {
      apiKey: process.env.ORGANIZATIONS_API_KEY,
      baseId: process.env.ORGANIZATIONS_BASE_ID,
      tableName: process.env.ORGANIZATIONS_TABLE_NAME, // can be table ID
    };
  }

  return {
    apiKey: process.env.ATHLETE_API_KEY,
    baseId: process.env.ATHLETE_BASE_ID,
    tableName: process.env.ATHLETE_TABLE_NAME, // can be table ID
  };
}

function missingCfg(cfg) {
  return {
    apiKey: !cfg.apiKey,
    baseId: !cfg.baseId,
    tableName: !cfg.tableName,
  };
}

async function findRecordByEmail({ base, tableName, emailNorm }) {
  const e = escapeAirtableString(emailNorm);

  // Your schema uses {Email}. We'll also tolerate {email}.
  const filterByFormula = `OR(
    LOWER({Email}&'')='${e}',
    LOWER({email}&'')='${e}',
    {Email}='${e}',
    {email}='${e}'
  )`;

  const records = await base(tableName)
    .select({ maxRecords: 1, filterByFormula })
    .firstPage();

  return records?.[0] || null;
}

/**
 * Resolve org token against Organizations table {Token}.
 * Returns:
 * - { id, name, token } if found
 * - { token, unresolved: true, reason } if not found / env missing
 */
async function resolveOrgToken(orgTokenRaw) {
  const token = String(orgTokenRaw || "").trim();
  if (!token) return null;

  const API_KEY = process.env.ORGANIZATIONS_API_KEY;
  const BASE_ID = process.env.ORGANIZATIONS_BASE_ID;
  const TABLE = process.env.ORGANIZATIONS_TABLE_NAME;

  if (!API_KEY || !BASE_ID || !TABLE) {
    return { token, unresolved: true, reason: "Organizations env missing." };
  }

  Airtable.configure({ apiKey: API_KEY });
  const base = Airtable.base(BASE_ID);

  const t = escapeAirtableString(token);

  // Token could be text OR lookup/multi-value; handle both safely
  const filterByFormula = `OR(
    {Token}='${t}',
    FIND('${t}', ARRAYJOIN({Token}&''))>0
  )`;

  const records = await base(TABLE)
    .select({ maxRecords: 1, filterByFormula })
    .firstPage();

  if (!records || records.length === 0) {
    return { token, unresolved: true, reason: "No organization found for that token." };
  }

  const r = records[0];
  return {
    id: r.id,
    name: r.fields?.Name || r.fields?.name || "",
    token,
    unresolved: false,
  };
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { name, email, password, role, organizationToken } = req.body || {};

    const roleNorm = normalizeRole(role);
    const emailNorm = String(email || "").trim().toLowerCase();
    const cleanName = String(name || "").trim();
    const cleanPw = String(password || "");
    const orgToken = String(organizationToken || "").trim();

    if (!cleanName || cleanName.length < 2) {
      return res.status(400).json({ error: "Name is required." });
    }
    if (!emailNorm || !emailNorm.includes("@")) {
      return res.status(400).json({ error: "Valid email is required." });
    }
    if (cleanPw.length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters." });
    }

    const cfg = getConfig(roleNorm);
    const missing = missingCfg(cfg);
    if (missing.apiKey || missing.baseId || missing.tableName) {
      return res.status(500).json({
        error: "Airtable env vars missing for finish-setup.",
        debug: { role: roleNorm, missing },
      });
    }

    // Configure Airtable for target table
    Airtable.configure({ apiKey: cfg.apiKey });
    const base = Airtable.base(cfg.baseId);

    const pwHash = await hashPassword(cleanPw);

    // Resolve org token (optional)
    // We only *apply* org linking fields for ATHLETE role.
    const resolvedOrg = orgToken ? await resolveOrgToken(orgToken) : null;

    // Find existing record by email in the target table
    const existing = await findRecordByEmail({
      base,
      tableName: cfg.tableName,
      emailNorm,
    });

    // Build fields using YOUR exact schema
    // - Name
    // - Email
    // - Password (bcrypt hash)
    const fields = {
      Name: cleanName,
      Email: emailNorm,
      Password: pwHash,
    };

    // ✅ Athlete-only: attach org link + store token
    // Athlete table fields:
    // - Organization (linked record to Organizations)
    // - Token (store org token they entered)
    let orgApplied = false;
    let orgSkippedReason = null;

    if (roleNorm === "athlete" && orgToken) {
      // Always store token in athlete record
      fields.Token = orgToken;

      // If token resolves to an org record, link it
      if (resolvedOrg && resolvedOrg.unresolved === false && resolvedOrg.id) {
        fields.Organization = [resolvedOrg.id];
        orgApplied = true;
      } else {
        orgSkippedReason =
          resolvedOrg?.reason || "Token did not resolve to an organization record.";
      }
    }

    // Upsert
    let action = "updated";
    let record;

    if (existing) {
      record = await base(cfg.tableName).update(existing.id, fields);
      action = "updated";
    } else {
      record = await base(cfg.tableName).create(fields);
      action = "created";
    }

    return res.status(200).json({
      ok: true,
      role: roleNorm,
      action,
      recordId: record?.id || null,
      org: resolvedOrg, // may be null or {unresolved:true}
      orgLink: {
        attempted: roleNorm === "athlete" && !!orgToken,
        applied: orgApplied,
        skippedReason: orgSkippedReason,
      },
    });
  } catch (err) {
    console.error("[finish-setup] error:", err);
    return res.status(500).json({
      error: "Finish setup failed.",
      detail: String(err?.message || err),
    });
  }
}
