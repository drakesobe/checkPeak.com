// pages/api/ocr/proxy-image.js
//
// Fetches a remote image server-side and streams it back to the client.
// Used by NutritionModal when the nutrition label URL is CORS-blocked
// (e.g. Airtable CDN, S3, or other external hosts).
//
// Usage: GET /api/ocr/proxy-image?url=https://...

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { url } = req.query;

  if (!url || typeof url !== "string") {
    return res.status(400).json({ error: "Missing url parameter" });
  }

  // Basic safety — only allow http/https URLs
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return res.status(400).json({ error: "Invalid URL" });
  }

  if (!["http:", "https:"].includes(parsed.protocol)) {
    return res.status(400).json({ error: "Only http/https URLs are allowed" });
  }

  try {
    const upstream = await fetch(url, {
      headers: {
        // Mimic a browser request so CDNs don't block us
        "User-Agent": "Mozilla/5.0 (compatible; CheckPeak/1.0)",
        "Accept":     "image/webp,image/avif,image/*,*/*;q=0.8",
      },
    });

    if (!upstream.ok) {
      return res.status(upstream.status).json({
        error: `Upstream returned ${upstream.status}`,
      });
    }

    const contentType = upstream.headers.get("content-type") || "image/jpeg";

    // Only proxy image content types
    if (!contentType.startsWith("image/")) {
      return res.status(400).json({ error: "URL does not point to an image" });
    }

    const buffer = Buffer.from(await upstream.arrayBuffer());

    res.setHeader("Content-Type",  contentType);
    res.setHeader("Cache-Control", "public, max-age=86400"); // cache 24h
    res.setHeader("Content-Length", buffer.length);
    return res.status(200).send(buffer);
  } catch (err) {
    console.error("[proxy-image] Error:", err);
    return res.status(500).json({ error: "Failed to fetch image" });
  }
}