// pages/api/fetchProduct.js
import fetch from "node-fetch";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { barcode } = req.body;
  if (!barcode) return res.status(400).json({ error: "No barcode provided." });

  try {
    // --- 1. Try Open Food Facts first ---
    const offRes = await fetch(`https://world.openfoodfacts.org/api/v0/product/${barcode}.json`);
    const offData = await offRes.json();

    if (offData.status === 1 && offData.product) {
      const product = offData.product;
      const ingredients = product.ingredients_text || null;
      const nutriments = product.nutriments || null;

      return res.status(200).json({
        source: "OpenFoodFacts",
        productName: product.product_name || "",
        brand: product.brands || "",
        ingredients,
        nutriments,
        image: product.image_url || null,
      });
    }

    // --- 2. Fallback: UPCitemDB ---
    const UPC_API_KEY = process.env.UPCITEMDB_API_KEY;
    const upcRes = await fetch(`https://api.upcitemdb.com/prod/trial/lookup?upc=${barcode}`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });
    const upcData = await upcRes.json();

    if (upcData && upcData.items && upcData.items.length > 0) {
      const item = upcData.items[0];
      return res.status(200).json({
        source: "UPCitemDB",
        productName: item.title || "",
        brand: item.brand || "",
        ingredients: item.description || null, // Not guaranteed
        nutriments: null,
        image: item.images?.[0] || null,
      });
    }

    // --- Not found in either ---
    return res.status(404).json({ error: "Product not found in OpenFoodFacts or UPCitemDB." });
  } catch (err) {
    console.error("Product fetch error:", err);
    res.status(500).json({ error: "Internal server error." });
  }
}
