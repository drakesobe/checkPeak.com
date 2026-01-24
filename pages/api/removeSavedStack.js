// pages/api/removeSavedStack.js

function mustEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing ${name} env var`);
  return v;
}

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function normalizeStackId(id) {
  return String(id ?? "").trim();
}

function buildFilterByFormula({ email, stackId }) {
  const e = String(email).replace(/"/g, '\\"');
  const s = String(stackId).replace(/"/g, '\\"');
  return `AND({UserEmail}="${e}", {StackID}="${s}")`;
}

async function fetchAllSaved({ apiKey, baseId, tableName, email }) {
  const records = [];
  const baseUrl = `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(
    tableName
  )}`;

  const safeEmail = String(email).replace(/"/g, '\\"');
  const filter = `{UserEmail}="${safeEmail}"`;

  let offset = null;
  do {
    const url =
      baseUrl +
      `?filterByFormula=${encodeURIComponent(filter)}` +
      `&pageSize=100` +
      (offset ? `&offset=${encodeURIComponent(offset)}` : "");

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Airtable fetch failed (${res.status}): ${text}`);
    }

    const data = await res.json();
    records.push(...(data.records || []));
    offset = data.offset || null;
  } while (offset);

  return records.map((r) => ({
    recordId: r.id,
    StackID: normalizeStackId(r.fields?.StackID),
    Notes: r.fields?.Notes || "",
    DateSaved: r.fields?.DateSaved || null,
  }));
}

export default async function handler(req, res) {
  try {
    const AIRTABLE_API_KEY = mustEnv("SAVEDSTACKS_API_KEY");
    const BASE_ID = mustEnv("SAVEDSTACKS_BASE_ID");
    const TABLE_NAME = mustEnv("SAVEDSTACKS_TABLE_NAME");

    if (req.method !== "DELETE") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    const { recordId, UserEmail, stackId } = req.body || {};
    const normalizedEmail = normalizeEmail(UserEmail);

    if (!normalizedEmail || !normalizedEmail.includes("@")) {
      return res.status(400).json({ error: "UserEmail is required" });
    }

    const baseUrl = `https://api.airtable.com/v0/${BASE_ID}/${encodeURIComponent(
      TABLE_NAME
    )}`;

    // If recordId provided, delete that single record
    if (recordId) {
      const delUrl = `${baseUrl}/${encodeURIComponent(recordId)}`;
      const delRes = await fetch(delUrl, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${AIRTABLE_API_KEY}` },
      });

      if (!delRes.ok) {
        const text = await delRes.text();
        console.error("Airtable delete error:", delRes.status, text);
        return res.status(500).json({ error: "Failed to remove saved stack" });
      }
    } else {
      // Otherwise require stackId so we can find/delete record(s)
      const sid = normalizeStackId(stackId);
      if (!sid) {
        return res
          .status(400)
          .json({ error: "recordId or stackId is required" });
      }

      // Find all records for (email, stackId) — and delete them all (dedupe cleanup)
      const filter = buildFilterByFormula({ email: normalizedEmail, stackId: sid });
      const findUrl = `${baseUrl}?filterByFormula=${encodeURIComponent(
        filter
      )}&pageSize=100`;

      const findRes = await fetch(findUrl, {
        headers: { Authorization: `Bearer ${AIRTABLE_API_KEY}` },
      });

      if (!findRes.ok) {
        const text = await findRes.text();
        console.error("Airtable find error:", findRes.status, text);
        return res.status(500).json({ error: "Failed to remove saved stack" });
      }

      const findData = await findRes.json();
      const ids = (findData.records || []).map((r) => r.id).filter(Boolean);

      // Nothing to delete is not an error; return current list
      for (const id of ids) {
        const delUrl = `${baseUrl}/${encodeURIComponent(id)}`;
        const delRes = await fetch(delUrl, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${AIRTABLE_API_KEY}` },
        });

        if (!delRes.ok) {
          const text = await delRes.text();
          console.error("Airtable delete error:", delRes.status, text);
          return res.status(500).json({ error: "Failed to remove saved stack" });
        }
      }
    }

    // Return updated saved stacks
    const savedStacks = await fetchAllSaved({
      apiKey: AIRTABLE_API_KEY,
      baseId: BASE_ID,
      tableName: TABLE_NAME,
      email: normalizedEmail,
    });

    return res.status(200).json({ savedStacks });
  } catch (error) {
    console.error("API error:", error);
    return res.status(500).json({ error: "Failed to remove saved stack" });
  }
}
