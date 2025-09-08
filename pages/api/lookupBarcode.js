// pages/api/lookupBarcode.js
export default async function handler(req, res) {
  const { code } = req.query;

  if (!code) {
    return res.status(400).json({ error: "Missing barcode" });
  }

  try {
    // Example: Open Food Facts
    const response = await fetch(`https://world.openfoodfacts.org/api/v0/product/${code}.json`);
    const json = await response.json();

    if (json.status === 1) {
      const ingredients = json.product.ingredients_text || "";
      return res.status(200).json({ ingredients });
    } else {
      return res.status(404).json({ error: "Product not found" });
    }
  } catch (err) {
    console.error("Barcode lookup error:", err);
    return res.status(500).json({ error: "Failed to fetch product info" });
  }
}
