// pages/api/lookupUser.js
import Airtable from "airtable";
import bcrypt from "bcryptjs";

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function escapeAirtableString(str = "") {
  return String(str).replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function normalizeRole(role) {
  const r = String(role || "").trim().toLowerCase();
  if (r === "organization" || r === "org" || r === "owner") return "organization";
  if (r === "admin") return "admin";
  if (r === "trainer") return "trainer";
  return "athlete";
}

function stripPassword(fields = {}) {
  const out = { ...fields };
  delete out.Password;
  delete out.password;
  delete out.PasswordHash;
  return out;
}

function pickAthleteToken(fields = {}) {
  const v =
    fields.AthleteToken ||
    fields["AthleteToken"] ||
    fields["Athlete Token"] ||
    fields["Athlete_Token"] ||
    "";
  return String(v || "").trim();
}

function toSessionUser(user) {
  const rawRole = String(user?.role || user?.Role || "").trim();
  const roleLower = rawRole.toLowerCase();

  const role =
    roleLower === "admin"
      ? "Admin"
      : roleLower === "trainer"
      ? "Trainer"
      : roleLower === "organization" || roleLower === "org" || roleLower.includes("org")
      ? "Organization"
      : "Athlete";

  const session = {
    id: user?.id || "",
    role,
    Email: user?.Email || user?.email || "",
    Name: user?.Name || user?.name || "",
  };

  // ✅ Athlete keys
  if (role === "Athlete") {
    session.athleteId = user?.athleteId || user?.AthleteId || user?.id || "";
    if (user?.AthleteToken)    session.AthleteToken    = String(user.AthleteToken).trim();
    if (user?.Token)           session.Token           = String(user.Token).trim();
    if (user?.OrgName)         session.OrgName         = String(user.OrgName).trim();
    // ✅ Include org record ID so mobile Feed query matches Firestore posts
    if (user?.organizationId)  session.organizationId  = String(user.organizationId).trim();
    if (user?.OrganizationId)  session.OrganizationId  = String(user.OrganizationId).trim();
  }

  // ✅ Org-side extras
  if (role !== "Athlete") {
    if (user?.Token)   session.Token   = String(user.Token).trim();
    if (user?.orgId)   session.orgId   = user.orgId;
    if (user?.memberId)session.memberId= user.memberId;
    if (user?.OrgName) session.OrgName = user.OrgName;
  }

  // Remove empties
  Object.keys(session).forEach((k) => {
    if (session[k] === "" || session[k] == null) delete session[k];
  });

  return session;
}

function setUserCookie(res, sessionUser) {
  const value = encodeURIComponent(JSON.stringify(sessionUser));
  const isProd = process.env.NODE_ENV === "production";

  const parts = [
    `user=${value}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    "Max-Age=604800",
  ];

  if (isProd) parts.push("Secure");
  res.setHeader("Set-Cookie", parts.join("; "));
}

async function ensureOrgMemberForOrgOwner({
  orgBase, orgId, orgEmail, orgName, orgMembersTableId,
}) {
  const emailLower = normalizeEmail(orgEmail);
  const safeEmail  = escapeAirtableString(emailLower);

  const existing = await orgBase(orgMembersTableId)
    .select({
      filterByFormula: `AND(LOWER({Email})='${safeEmail}', FIND('${escapeAirtableString(orgId)}', ARRAYJOIN({Organization}&'')) > 0)`,
      maxRecords: 1,
    })
    .firstPage();

  if (existing?.length) return existing[0];

  const created = await orgBase(orgMembersTableId).create({
    Email:        emailLower,
    Name:         String(orgName || "Organization Owner").trim(),
    Role:         "admin",
    Active:       true,
    Organization: [orgId],
  });

  return created;
}

/**
 * ✅ Resolve org name for an athlete from their linked Organization record IDs.
 * Returns the org name string, or "" if unresolvable.
 */
async function resolveAthleteOrg(orgRecordIds, orgBase, orgsTableName) {
  if (!Array.isArray(orgRecordIds) || !orgRecordIds.length) return { name: "", id: "" };
  const firstId = String(orgRecordIds[0] || "").trim();
  if (!firstId || !firstId.startsWith("rec")) return { name: "", id: "" };
  try {
    const orgRecord = await orgBase(orgsTableName).find(firstId);
    const name = String(
      orgRecord?.fields?.Name ||
      orgRecord?.fields?.["Organization Name"] ||
      ""
    ).trim();
    return { name, id: firstId };
  } catch {
    return { name: "", id: "" };
  }
}

/* -------------------------------------------------------------------------- */
/* Main                                                                       */
/* -------------------------------------------------------------------------- */

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
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

  const roleNorm   = normalizeRole(role);
  const emailLower = normalizeEmail(email);
  const safeEmail  = escapeAirtableString(emailLower);

  const ATHLETE_API_KEY       = process.env.ATHLETE_API_KEY;
  const ATHLETE_BASE_ID       = process.env.ATHLETE_BASE_ID;
  const ATHLETE_TABLE_NAME    = process.env.ATHLETE_TABLE_NAME;
  const ORGANIZATIONS_API_KEY = process.env.ORGANIZATIONS_API_KEY;
  const ORGANIZATIONS_BASE_ID = process.env.ORGANIZATIONS_BASE_ID;
  const ORGANIZATIONS_TABLE_NAME = process.env.ORGANIZATIONS_TABLE_NAME;
  const ORG_MEMBERS_TABLE_ID  = process.env.ORG_MEMBERS_TABLE_ID || "tblRvpw7XeVZfdKIq";

  if (roleNorm === "athlete") {
    if (!ATHLETE_API_KEY || !ATHLETE_BASE_ID || !ATHLETE_TABLE_NAME) {
      return res.status(500).json({ error: "Athletes Airtable not configured." });
    }
  } else {
    if (!ORGANIZATIONS_API_KEY || !ORGANIZATIONS_BASE_ID || !ORGANIZATIONS_TABLE_NAME) {
      return res.status(500).json({ error: "Organizations Airtable not configured." });
    }
  }

  try {
    /* ------------------------------------------------------------------ */
    /* ATHLETE LOGIN                                                       */
    /* ------------------------------------------------------------------ */
    if (roleNorm === "athlete") {
      const athleteBase = new Airtable({ apiKey: ATHLETE_API_KEY }).base(ATHLETE_BASE_ID);

      const records = await athleteBase(ATHLETE_TABLE_NAME)
        .select({
          filterByFormula: `LOWER({Email})='${safeEmail}'`,
          maxRecords: 1,
        })
        .firstPage();

      if (!records.length) {
        return res.status(404).json({ error: "User not found" });
      }

      const record     = records[0];
      const fields     = record.fields || {};
      const storedHash = fields.Password || "";

      if (!storedHash) {
        return res.status(500).json({ error: "Athlete record missing Password hash." });
      }

      const match = await bcrypt.compare(String(password), String(storedHash));
      if (!match) return res.status(401).json({ error: "Invalid credentials" });

      const safeFields   = stripPassword(fields);
      const athleteToken = pickAthleteToken(fields);

      // ✅ Resolve org name + record ID from linked Organization field
      let orgName = "";
      let orgRecordId = "";
      const orgLinks = fields.Organization;
      if (
        Array.isArray(orgLinks) && orgLinks.length &&
        ORGANIZATIONS_API_KEY && ORGANIZATIONS_BASE_ID && ORGANIZATIONS_TABLE_NAME
      ) {
        const orgBase = new Airtable({ apiKey: ORGANIZATIONS_API_KEY }).base(ORGANIZATIONS_BASE_ID);
        const resolved = await resolveAthleteOrg(orgLinks, orgBase, ORGANIZATIONS_TABLE_NAME);
        orgName     = resolved.name;
        orgRecordId = resolved.id;
      }

      const userOut = {
        id:           record.id,
        athleteId:    record.id,
        ...safeFields,
        role:         "Athlete",
        Role:         "Athlete",
        Email:        safeFields.Email || emailLower,
        AthleteToken: athleteToken || "",
        // ✅ Org name + record ID — both available in session for mobile + web
        ...(orgName     ? { OrgName: orgName }                     : {}),
        ...(orgRecordId ? { organizationId: orgRecordId,
                            OrganizationId: orgRecordId }          : {}),
      };

      const sessionUser = toSessionUser(userOut);
      setUserCookie(res, sessionUser);

      return res.status(200).json({
        user: userOut,
        debug: {
          athleteTokenPresent: Boolean(athleteToken),
          athleteToken:        athleteToken ? athleteToken : null,
          orgName:             orgName     || null,
          orgRecordId:         orgRecordId || null,
        },
      });
    }

    /* ------------------------------------------------------------------ */
    /* ORG-SIDE LOGIN (Organization / Admin / Trainer)                    */
    /* ------------------------------------------------------------------ */

    const orgBase        = new Airtable({ apiKey: ORGANIZATIONS_API_KEY }).base(ORGANIZATIONS_BASE_ID);
    const wantsMemberOnly = roleNorm === "admin" || roleNorm === "trainer";

    // 1) Try Organization primary account
    if (!wantsMemberOnly) {
      const orgAccount = await orgBase(ORGANIZATIONS_TABLE_NAME)
        .select({
          filterByFormula: `LOWER({Email})='${safeEmail}'`,
          maxRecords: 1,
        })
        .firstPage();

      if (orgAccount.length) {
        const record     = orgAccount[0];
        const fields     = record.fields || {};
        const storedHash = fields.Password || "";

        if (!storedHash) {
          return res.status(500).json({ error: "Organization record missing Password hash." });
        }

        const match = await bcrypt.compare(String(password), String(storedHash));
        if (!match) return res.status(401).json({ error: "Invalid credentials" });

        const safeFields = stripPassword(fields);
        const orgToken   = safeFields.Token || safeFields["Organization Token"] || fields.Token || "";
        const orgName    = safeFields.Name  || safeFields["Organization Name"]  || "Organization";

        let ownerMemberId = null;
        try {
          const ownerMember = await ensureOrgMemberForOrgOwner({
            orgBase, orgId: record.id,
            orgEmail: safeFields.Email || emailLower,
            orgName, orgMembersTableId: ORG_MEMBERS_TABLE_ID,
          });
          ownerMemberId = ownerMember?.id || null;
        } catch {}

        const userOut = {
          id:       record.id,
          ...safeFields,
          role:     "Organization",
          Role:     "Organization",
          Email:    safeFields.Email || emailLower,
          Token:    orgToken,
          orgId:    record.id,
          memberId: ownerMemberId || undefined,
          OrgName:  String(orgName || "").trim(),
        };

        const sessionUser = toSessionUser(userOut);
        setUserCookie(res, sessionUser);
        return res.status(200).json({ user: userOut });
      }
    }

    // 2) OrgMembers (admin / trainer)
    const memberRecords = await orgBase(ORG_MEMBERS_TABLE_ID)
      .select({
        filterByFormula: `AND(LOWER({Email})='${safeEmail}', {Active}=TRUE())`,
        maxRecords: 10,
      })
      .firstPage();

    if (!memberRecords.length) {
      return res.status(404).json({ error: "User not found" });
    }

    if (memberRecords.length > 1) {
      const orgIds = memberRecords
        .map((m) => Array.isArray(m.fields?.Organization) ? m.fields.Organization[0] : null)
        .filter(Boolean);
      return res.status(409).json({
        error: "This email belongs to multiple organizations. Please select your organization.",
        orgIds,
      });
    }

    const member     = memberRecords[0];
    const fields     = member.fields || {};
    const storedHash = fields.PasswordHash || "";

    if (!storedHash) {
      return res.status(500).json({ error: "OrgMember record missing PasswordHash." });
    }

    const match = await bcrypt.compare(String(password), String(storedHash));
    if (!match) return res.status(401).json({ error: "Invalid credentials" });

    const roleField = String(fields.Role || "").trim().toLowerCase();
    if (wantsMemberOnly && roleNorm !== roleField) {
      return res.status(403).json({ error: "Not authorized" });
    }

    let outRole = "Trainer";
    if (roleField === "admin")                                    outRole = "Admin";
    if (roleField === "organization" || roleField === "org")      outRole = "Organization";

    const orgLinks = fields.Organization;
    const orgId    = Array.isArray(orgLinks) && orgLinks.length ? orgLinks[0] : null;
    if (!orgId) {
      return res.status(500).json({ error: "OrgMember missing Organization link." });
    }

    const orgRecord = await orgBase(ORGANIZATIONS_TABLE_NAME).find(orgId);
    const orgToken  = String(orgRecord?.fields?.Token || "").trim();
    const orgName   = String(orgRecord?.fields?.Name  || "Organization").trim();
    const safeFields = stripPassword(fields);

    const userOut = {
      id:       member.id,
      ...safeFields,
      role:     outRole,
      Role:     outRole,
      Email:    safeFields.Email || emailLower,
      Name:     safeFields.Name  || outRole,
      Token:    orgToken,
      orgId,
      memberId: member.id,
      OrgName:  orgName,
    };

    const sessionUser = toSessionUser(userOut);
    setUserCookie(res, sessionUser);
    return res.status(200).json({ user: userOut });

  } catch (err) {
    console.error("[lookupUser] error:", err);
    return res.status(500).json({
      error: "Failed to lookup user",
      airtable: {
        statusCode: err?.statusCode,
        message:    err?.message,
        error:      err?.error,
      },
    });
  }
}