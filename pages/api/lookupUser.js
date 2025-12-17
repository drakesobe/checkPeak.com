// pages/api/lookupUser.js
import Airtable from "airtable";
import bcrypt from "bcryptjs";

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function escapeAirtableString(str = "") {
  return String(str).replace(/'/g, "\\'");
}

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function normalizeRole(role) {
  const r = String(role || "").trim().toLowerCase();
  if (r === "organization" || r === "org") return "organization";
  return "athlete";
}

function stripPassword(fields = {}) {
  const out = { ...fields };
  delete out.Password;
  delete out.password;
  return out;
}

/**
 * Keep the session cookie payload small and consistent.
 * This is what requireOrg reads from the HttpOnly cookie.
 */
function toSessionUser(user) {
  const role = String(user?.role || user?.Role || "");
  const isOrg = role.toLowerCase().includes("org");

  const session = {
    id: user?.id || "",
    role: isOrg ? "Organization" : "Athlete",
    Email: user?.Email || user?.email || "",
    Name: user?.Name || user?.name || "",
  };

  if (isOrg) {
    session.Token =
      user?.Token || user?.token || user?.["Organization Token"] || "";
  } else {
    session.Token = user?.Token || user?.token || "";
  }

  // Remove empties
  Object.keys(session).forEach((k) => {
    if (session[k] === "" || session[k] == null) delete session[k];
  });

  return session;
}

function setUserCookie(res, sessionUser) {
  // Encode JSON into cookie-safe value
  const value = encodeURIComponent(JSON.stringify(sessionUser));

  const isProd = process.env.NODE_ENV === "production";

  // ✅ Important: Path=/ so /api/* routes receive it
  // ✅ HttpOnly so JS can't read it (more secure)
  // ✅ SameSite=Lax for localhost + normal browser nav
  // ✅ Secure only in production (HTTPS)
  const parts = [
    `user=${value}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    // 7 days
    "Max-Age=604800",
  ];

  if (isProd) parts.push("Secure");

  // Optional: helps debugging in Network tab (not required)
  // res.setHeader("X-Auth-Cookie-Set", "1");

  res.setHeader("Set-Cookie", parts.join("; "));
}

export default async function handler(req, res) {
  // Avoid caching login responses anywhere
  res.setHeader(
    "Cache-Control",
    "no-store, no-cache, must-revalidate, proxy-revalidate"
  );
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { email, password, role } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: "Email and password required" });
  }

  const roleNorm = normalizeRole(role);
  const emailLower = normalizeEmail(email);
  const safeEmail = escapeAirtableString(emailLower);

  // ---- Athletes config
  const ATHLETE_API_KEY = process.env.ATHLETE_API_KEY;
  const ATHLETE_BASE_ID = process.env.ATHLETE_BASE_ID;
  const ATHLETE_TABLE_NAME = process.env.ATHLETE_TABLE_NAME;

  // ---- Organizations config
  const ORGANIZATIONS_API_KEY = process.env.ORGANIZATIONS_API_KEY;
  const ORGANIZATIONS_BASE_ID = process.env.ORGANIZATIONS_BASE_ID;
  const ORGANIZATIONS_TABLE_NAME = process.env.ORGANIZATIONS_TABLE_NAME;

  // Minimal required configs based on role
  if (roleNorm === "athlete") {
    if (!ATHLETE_API_KEY || !ATHLETE_BASE_ID || !ATHLETE_TABLE_NAME) {
      return res.status(500).json({
        error:
          "Athletes Airtable not configured. Check ATHLETE_API_KEY, ATHLETE_BASE_ID, ATHLETE_TABLE_NAME.",
        missing: {
          ATHLETE_API_KEY: !ATHLETE_API_KEY,
          ATHLETE_BASE_ID: !ATHLETE_BASE_ID,
          ATHLETE_TABLE_NAME: !ATHLETE_TABLE_NAME,
        },
      });
    }
  } else {
    if (
      !ORGANIZATIONS_API_KEY ||
      !ORGANIZATIONS_BASE_ID ||
      !ORGANIZATIONS_TABLE_NAME
    ) {
      return res.status(500).json({
        error:
          "Organizations Airtable not configured. Check ORGANIZATIONS_API_KEY, ORGANIZATIONS_BASE_ID, ORGANIZATIONS_TABLE_NAME.",
        missing: {
          ORGANIZATIONS_API_KEY: !ORGANIZATIONS_API_KEY,
          ORGANIZATIONS_BASE_ID: !ORGANIZATIONS_BASE_ID,
          ORGANIZATIONS_TABLE_NAME: !ORGANIZATIONS_TABLE_NAME,
        },
      });
    }
  }

  try {
    // Choose base/table by role
    const base =
      roleNorm === "organization"
        ? new Airtable({ apiKey: ORGANIZATIONS_API_KEY }).base(
            ORGANIZATIONS_BASE_ID
          )
        : new Airtable({ apiKey: ATHLETE_API_KEY }).base(ATHLETE_BASE_ID);

    const tableName =
      roleNorm === "organization" ? ORGANIZATIONS_TABLE_NAME : ATHLETE_TABLE_NAME;

    // IMPORTANT: both tables use {Email}
    const records = await base(tableName)
      .select({
        filterByFormula: `LOWER({Email})='${safeEmail}'`,
        maxRecords: 1,
      })
      .firstPage();

    if (!records.length) {
      return res.status(404).json({ error: "User not found" });
    }

    const record = records[0];
    const fields = record.fields || {};
    const storedHash = fields.Password || "";

    if (!storedHash) {
      return res.status(500).json({
        error:
          "User record missing Password hash. Confirm the table has a Password column and it is populated.",
      });
    }

    const match = await bcrypt.compare(String(password), String(storedHash));
    if (!match) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    // Build safe user payload
    const safeFields = stripPassword(fields);

    const user = {
      id: record.id,
      ...safeFields,

      // Normalize role into your app standard
      role: roleNorm === "organization" ? "Organization" : "Athlete",
      Role: roleNorm === "organization" ? "Organization" : "Athlete",

      // Ensure normalized email is present
      Email: safeFields.Email || emailLower,
    };

    // ✅ Set the session cookie server-side (used by requireOrg)
    const sessionUser = toSessionUser(user);
    setUserCookie(res, sessionUser);

    // Helpful server log (optional)
    console.log("[lookupUser] session set:", {
      role: sessionUser.role,
      email: sessionUser.Email,
      hasToken: !!sessionUser.Token,
      nodeEnv: process.env.NODE_ENV,
    });

    return res.status(200).json({ user });
  } catch (err) {
    console.error("[lookupUser] error:", err);
    return res.status(500).json({
      error: "Failed to lookup user",
      airtable: {
        statusCode: err?.statusCode,
        message: err?.message,
        error: err?.error,
      },
    });
  }
}
