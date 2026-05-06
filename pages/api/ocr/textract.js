// pages/api/ocr/textract.js
//
// Receives a label image from the client, sends it to AWS Textract
// DetectDocumentText, and returns the extracted text string.
//
// Drop-in replacement for the Tesseract pipeline in useOCR.js.
// Same response shape - nothing in OCRUpload or OCRScanResults changes.

import { TextractClient, DetectDocumentTextCommand } from "@aws-sdk/client-textract";

export const config = {
  api: { bodyParser: false }, // we receive raw multipart
};

// ---------------------------------------------------------------------------
// Textract client - initialised once per cold start
// ---------------------------------------------------------------------------

const client = new TextractClient({
  region:      process.env.AWS_REGION      || "us-east-1",
  credentials: {
    accessKeyId:     process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

// ---------------------------------------------------------------------------
// Parse raw body as Buffer
// Next.js bodyParser is disabled so we read the stream manually.
// The client sends a plain binary POST (image bytes), not multipart.
// ---------------------------------------------------------------------------

async function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end",  () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

// ---------------------------------------------------------------------------
// Textract response → plain text string
//
// Textract returns a list of Block objects. We keep only LINE blocks,
// joined with newlines - same shape as Tesseract output so the existing
// quality scoring, highlighting, and substance matching all work unchanged.
// ---------------------------------------------------------------------------

function blocksToText(blocks = []) {
  return blocks
    .filter((b) => b.BlockType === "LINE")
    .map((b) => String(b.Text ?? "").trim())
    .filter(Boolean)
    .join("\n");
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
    return res.status(500).json({ error: "AWS credentials not configured" });
  }

  let imageBytes;
  try {
    imageBytes = await readBody(req);
  } catch (err) {
    return res.status(400).json({ error: "Failed to read image data" });
  }

  if (!imageBytes?.length) {
    return res.status(400).json({ error: "No image data received" });
  }

  // Textract has a 5 MB limit for synchronous DetectDocumentText
  if (imageBytes.length > 5 * 1024 * 1024) {
    return res.status(400).json({ error: "Image too large - max 5 MB" });
  }

  try {
    const command = new DetectDocumentTextCommand({
      Document: { Bytes: imageBytes },
    });

    const response = await client.send(command);
    const text     = blocksToText(response.Blocks ?? []);

    return res.status(200).json({
      ok:   true,
      text,
      // Pass back block count for debugging - not used by the hook
      blockCount: (response.Blocks ?? []).length,
    });
  } catch (err) {
    console.error("Textract error:", err);

    // Surface a clean message for common AWS errors
    const msg =
      err?.name === "InvalidParameterException" ? "Textract could not read this image format." :
      err?.name === "UnsupportedDocumentException" ? "Unsupported image - try JPEG or PNG." :
      err?.name === "DocumentTooLargeException" ? "Image too large for Textract (max 5 MB)." :
      err?.name === "ProvisionedThroughputExceededException" ? "Too many requests - please try again." :
      err?.message || "Textract scan failed";

    return res.status(500).json({ error: msg });
  }
}