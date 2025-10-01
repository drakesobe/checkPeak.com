import fetchWithTimeout from "../../lib/fetchWithTimeout"; // We'll move the helper there
import { NextApiRequest, NextApiResponse } from "next";

// Helper to fetch API internally
async function callApiCheck(barcode, labelImage) {
  const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/check`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ barcode, labelImage }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Internal /api/check failed: ${errText}`);
  }

  return res.json();
}

export default async function handler(req, res) {
  try {
    const method = (req.method || "GET").toUpperCase();

    let barcode = null;
    let labelImage = null;

    if (method === "GET") {
      barcode = req.query?.barcode ? String(req.query.barcode).trim() : null;
    } else if (method === "POST") {
      const body = req.body || {};
      barcode = body.barcode ? String(body.barcode).trim() : null;
      labelImage = body.labelImage || null;
    }

    if (!barcode) {
      return res.status(400).json({ error: "Missing 'barcode' parameter" });
    }

    console.log("[/api/barcode] Forwarding request to /api/check with barcode:", barcode);

    const result = await callApiCheck(barcode, labelImage);

    return res.status(200).json(result);
  } catch (err) {
    console.error("[/api/barcode] error:", err);
    return res.status(500).json({ error: "Internal server error", details: String(err?.message || err) });
  }
}
