// pages/api/saveStack.js

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
  // Use AND() + double quotes to avoid quoting issues
  // Escape double quotes inside values (defensive)
  const e = String(email).replace(/"/g, '\\"');
  const s = String(stackId).replace(/"/g, '\\"');
  return `AND({UserEmail}="${e}", {StackID}="${s}")`;
}

async function fetchAllSaved({ apiKey, baseId, tableName, email }) {
  // Fetch all saved records for a user (paged)
  const records = [];
  const baseUrl = `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(
    tableName
  )}`;

  // filter by email only (not stackId)
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

    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    const { UserEmail, stack } = req.body || {};
    const normalizedEmail = normalizeEmail(UserEmail);
    const stackId = normalizeStackId(stack?.id);

    if (!normalizedEmail || !normalizedEmail.includes("@") || !stackId) {
      return res.status(400).json({
        error: "UserEmail and stack.id are required",
      });
    }

    const baseUrl = `https://api.airtable.com/v0/${BASE_ID}/${encodeURIComponent(
      TABLE_NAME
    )}`;

    // 1) Prevent duplicates: check if record already exists for (email, stackId)
    const filter = buildFilterByFormula({ email: normalizedEmail, stackId });
    const checkUrl = `${baseUrl}?filterByFormula=${encodeURIComponent(
      filter
    )}&maxRecords=1`;

    const checkRes = await fetch(checkUrl, {
      headers: { Authorization: `Bearer ${AIRTABLE_API_KEY}` },
    });

    if (!checkRes.ok) {
      const text = await checkRes.text();
      console.error("Airtable check error:", checkRes.status, text);
      return res.status(500).json({ error: "Failed to save stack" });
    }

    const checkData = await checkRes.json();
    const existing = (checkData.records || [])[0];

    if (!existing) {
      // 2) Create new saved record
      const createRes = await fetch(baseUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${AIRTABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fields: {
            UserEmail: normalizedEmail,
            StackID: stackId,
            DateSaved: new Date().toISOString(),
            Notes: stack?.notes || "",
          },
        }),
      });

      if (!createRes.ok) {
        const text = await createRes.text();
        console.error("Airtable save error:", createRes.status, text);
        return res.status(500).json({ error: "Failed to save stack" });
      }

      await createRes.json(); // not required, but ensures request completes cleanly
    }

    // 3) Always return latest saved list
    const savedStacks = await fetchAllSaved({
      apiKey: AIRTABLE_API_KEY,
      baseId: BASE_ID,
      tableName: TABLE_NAME,
      email: normalizedEmail,
    });

    return res.status(200).json({ savedStacks });
  } catch (error) {
    console.error("API error:", error);
    return res.status(500).json({ error: "Failed to save stack" });
  }
}
