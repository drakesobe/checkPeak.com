// pages/api/ocr.js
import Tesseract from "tesseract.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { imageUrl } = req.body;
  if (!imageUrl) {
    return res.status(400).json({ error: "No imageUrl provided" });
  }

  try {
    const { data } = await Tesseract.recognize(imageUrl, "eng", {
      logger: (m) => console.log("Tesseract:", m),
    });

    const text = data.text.trim();
    console.log("OCR text:", text);

    res.status(200).json({ text });
  } catch (err) {
    console.error("OCR API error:", err);
    res.status(500).json({ error: "Failed to perform OCR" });
  }
}
