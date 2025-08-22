// lib/ocrProcess.js
export default async function processOCR(file) {
  if (!file) throw new Error("No file provided");

  // STEP 1: Upload file
  const formData = new FormData();
  formData.append("file", file);

  const uploadRes = await fetch("/api/upload-temp-file", {
    method: "POST",
    body: formData,
  });

  if (!uploadRes.ok) {
    const data = await uploadRes.json();
    throw new Error(data.error || "File upload failed");
  }

  const { filePath } = await uploadRes.json();
  if (!filePath) throw new Error("Upload did not return file path");

  // STEP 2: OCR processing via SSE (or fallback)
  const ocrRes = await fetch("/api/ocrapi", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ filePath }),
  });

  if (!ocrRes.ok) {
    const data = await ocrRes.json();
    throw new Error(data.error || "OCR failed");
  }

  const { text: ocrText } = await ocrRes.json();

  // STEP 3: Fetch banned substances from Airtable
  const airtableRes = await fetch("/api/getBannedSubstances");
  if (!airtableRes.ok) throw new Error("Failed to fetch banned substances");

  const bannedSubstances = await airtableRes.json();

  // STEP 4: Match OCR text against banned substances
  const summary = [];
  const lowerText = ocrText.toLowerCase();

  bannedSubstances.forEach((item) => {
    const names = [item.name, ...(item.synonyms || [])].filter(Boolean);
    for (const name of names) {
      if (lowerText.includes(name.toLowerCase())) {
        summary.push({
          name: item.name,
          banType: item["Ban Type"] || item.bannedBy || "Unknown",
          snippet: getSnippet(lowerText, name.toLowerCase()),
          dosageLimit: item["Dosage Limit"] || "",
          notes: item["Notes / Source / Citation"] || "",
          bannedBy: item["Banned By"] || "",
        });
        break;
      }
    }
  });

  return { ocrText, summary };
}

function getSnippet(text, term, chars = 30) {
  const idx = text.indexOf(term);
  if (idx === -1) return "";
  const start = Math.max(0, idx - chars);
  const end = Math.min(text.length, idx + term.length + chars);
  return text.substring(start, end).replace(/\n/g, " ");
}
