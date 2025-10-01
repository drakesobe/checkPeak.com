export default async function handler(req, res) {
  const { code } = req.query;
  console.log("[lookupBarcode] Received request for barcode:", code);

  if (!code) {
    console.error("[lookupBarcode] Missing barcode parameter");
    return res.status(400).json({ error: "Missing barcode parameter" });
  }

  try {
    const url = `https://world.openfoodfacts.org/api/v0/product/${encodeURIComponent(code)}.json`;
    console.log("[lookupBarcode] Fetching URL:", url);

    const response = await fetch(url);
    const json = await response.json();

    console.log("[lookupBarcode] Response status:", json.status);
    if (json.status === 1 && json.product) {
      console.log("[lookupBarcode] Product found:", json.product.product_name || "No product name");
      const ingredients =
        json.product.ingredients_text_en ||
        json.product.ingredients_text ||
        (Array.isArray(json.product.ingredients)
          ? json.product.ingredients.map((i) => i?.text).filter(Boolean).join(", ")
          : "");
      console.log("[lookupBarcode] Ingredients text:", ingredients);

      return res.status(200).json({ ingredients });
    } else {
      console.warn("[lookupBarcode] Product not found for barcode:", code);
      return res.status(404).json({ error: "Product not found" });
    }
  } catch (err) {
    console.error("[lookupBarcode] Lookup error:", err);
    return res.status(500).json({ error: "Failed to fetch product info", details: String(err) });
  }
}
