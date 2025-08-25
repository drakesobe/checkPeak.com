import fs from "fs";
import path from "path";
import fetch from "node-fetch"; // Node 18+ has global fetch

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { imageUrl, filename } = req.body;
  if (!imageUrl || !filename) return res.status(400).json({ error: "imageUrl and filename required" });

  try {
    const response = await fetch(imageUrl);
    if (!response.ok) return res.status(400).json({ error: "Failed to fetch image" });

    const buffer = await response.arrayBuffer();
    const savePath = path.join(process.cwd(), "public", "uploads", filename);

    fs.mkdirSync(path.dirname(savePath), { recursive: true });
    fs.writeFileSync(savePath, Buffer.from(buffer));

    return res.status(200).json({ savedPath: "/uploads/" + filename });
  } catch (err) {
    console.error("Save Image Error:", err);
    return res.status(500).json({ error: "Failed to save image" });
  }
}
