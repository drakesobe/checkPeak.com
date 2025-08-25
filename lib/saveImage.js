import fs from "fs";
import path from "path";
import fetch from "node-fetch";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { imageUrl, filename } = req.body;
  if (!imageUrl || !filename) {
    return res.status(400).json({ error: "imageUrl and filename are required" });
  }

  try {
    // Determine local save path
    const uploadsDir = path.join(process.cwd(), "public", "uploads");
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    const localPath = path.join(uploadsDir, filename);

    // Fetch and save the image
    const response = await fetch(imageUrl);
    if (!response.ok) {
      console.warn("Failed to fetch image:", response.statusText);
      // Fail gracefully
      return res.status(200).json({ savedPath: null });
    }

    const buffer = await response.arrayBuffer();
    fs.writeFileSync(localPath, Buffer.from(buffer));

    // Return the local path
    const publicPath = "/uploads/" + filename;
    res.status(200).json({ savedPath: publicPath });
  } catch (err) {
    console.error("Save Image Error:", err);
    // Fail gracefully, OCR can still run
    res.status(200).json({ savedPath: null });
  }
}
