import Airtable from "airtable";
import Tesseract from "tesseract.js";

// Initialize Airtable base
const bannedBase = new Airtable({ apiKey: process.env.BANNED_API_KEY }).base(
  process.env.BANNED_BASE_ID
);

// Escape regex safely
const escapeRegex = (string) => String(string).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// --- Open Food Facts
async function fetchOFFIngredients(barcode) {
  try {
    const res = await fetch(`https://world.openfoodfacts.org/api/v0/product/${barcode}.json`);
    const data = await res.json();
    return data?.product?.ingredients_text || "";
  } catch (err) {
    console.error("OFF fetch error:", err);
    return "";
  }
}

// --- USDA FoodData
async function fetchUSDAIngredients(barcode) {
  try {
    const res = await fetch(
      `https://api.nal.usda.gov/fdc/v1/foods/search?query=${barcode}&api_key=${process.env.USDA_API_KEY}`
    );
    const data = await res.json();
    if (data.foods && data.foods.length > 0) {
      return data.foods
        .map((f) => f.ingredients || "")
        .filter(Boolean)
        .join(" ");
    }
    return "";
  } catch (err) {
    console.error("USDA fetch error:", err);
    return "";
  }
}

// --- FoodRepo
async function fetchFoodRepoIngredients(barcode) {
  try {
    const res = await fetch(`https://www.foodrepo.org/api/v3/products/${barcode}`, {
      headers: { Authorization: `Token token=${process.env.FOODREPO_API_KEY}` },
    });
    const data = await res.json();
    return data?.data?.attributes?.ingredients_text || "";
  } catch (err) {
    console.error("FoodRepo fetch error:", err);
    return "";
  }
}

// --- OCR on label image
async function runOCROnImage(imageUrl) {
  try {
    const { data } = await Tesseract.recognize(imageUrl, "eng", {
      logger: (m) => console.log(m),
    });
    return data?.text || "";
  } catch (err) {
    console.error("OCR error:", err);
    return "";
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  let { text, barcode, ocrText, labelImage } = req.body;

  let isBarcode = Boolean(barcode);
  let barcodeValue = barcode ? String(barcode).trim() : null;

  try {
    let ingredientsText = text || ocrText || "";

    if (isBarcode && barcodeValue) {
      console.log("Barcode received:", barcodeValue);

      // --- 1️⃣ Open Food Facts
      ingredientsText = await fetchOFFIngredients(barcodeValue);
      if (ingredientsText) console.log("Ingredients found via OFF");
      else {
        console.log("OFF lookup failed, trying USDA FoodData...");

        // --- 2️⃣ USDA FoodData
        ingredientsText = await fetchUSDAIngredients(barcodeValue);
        if (ingredientsText) console.log("Ingredients found via USDA");
        else {
          console.log("USDA lookup failed, trying FoodRepo...");

          // --- 3️⃣ FoodRepo
          ingredientsText = await fetchFoodRepoIngredients(barcodeValue);
          if (ingredientsText) console.log("Ingredients found via FoodRepo");
          else if (labelImage) {
            // --- 4️⃣ OCR fallback
            console.log("No ingredients text found, running OCR on label image...");
            ingredientsText = await runOCROnImage(labelImage);
          }
        }
      }

      text = ingredientsText || "";
    }

    if (!text) {
      return res.status(400).json({ error: "No text available for scan" });
    }

    // --- Normalize text
    const normalizedText = text
      .replace(/[\r\n]+/g, " ")
      .replace(/\s+/g, " ")
      .toLowerCase();

    // --- Fetch banned substances from Airtable
    const bannedRecords = await bannedBase(process.env.BANNED_TABLE_NAME)
      .select({ view: "Grid view" })
      .all();

    // --- Match substances
    const matchedBanned = bannedRecords.filter((rec) => {
      const names = [
        rec.get("Substance Name") || "",
        ...(rec.get("Synonyms")?.split(",") || []),
      ]
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean);

      return names.some((name) => {
        if (name.length < 2) return false;
        if (/^[0-9]+$/.test(name)) return false;
        try {
          const regex = new RegExp(`\\b${escapeRegex(name)}\\b`, "i");
          return regex.test(normalizedText);
        } catch {
          return normalizedText.includes(name);
        }
      });
    });

    const bannedResults = matchedBanned.map((rec) => ({
      id: rec.id,
      fields: {
        "Substance Name": rec.get("Substance Name") || "",
        "Ban Type": rec.get("Ban Type") || "",
        "Synonyms": rec.get("Synonyms") || "",
        "Banned By": rec.get("Banned By") || "",
        "Dosage Limit": rec.get("Dosage Limit") || "",
        "Notes": rec.get("Notes") || "",
        "Source / Citation": rec.get("Source / Citation") || "",
      },
    }));

    console.log("Matched banned count:", bannedResults.length);
    bannedResults.forEach((r) =>
      console.log("Matched banned:", r.fields["Substance Name"])
    );

    res.status(200).json({
      ocrText: text,
      matchedBanned: bannedResults,
      debug: {
        isBarcode,
        barcodeValue: barcodeValue || null,
        fetchedIngredients: text,
        labelImage: labelImage || null,
      },
    });
  } catch (err) {
    console.error("Check API Error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}
