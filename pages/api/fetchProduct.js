import fetch from "node-fetch";

async function tryNutritionix(barcode) {
  const appId = process.env.NUTRITIONIX_APP_ID;
  const appKey = process.env.NUTRITIONIX_API_KEY;
  if (!appId || !appKey) return null;

  try {
    const url = `https://api.nutritionix.com/v1_1/item?upc=${barcode}&appId=${appId}&appKey=${appKey}`;
    const res = await fetch(url);
    const json = await res.json();
    const ingredients =
      json.nf_ingredient_statement ||
      json.ingredients ||
      json.ingredient_statement ||
      json.ingredient_list ||
      json.ingredients_text ||
      "";
    if (ingredients.trim()) {
      return {
        source: "Nutritionix",
        productName: json.item_name || "",
        brand: json.brand_name || "",
        ingredients: ingredients.trim(),
        nutriments: json.nf_calories || null,
        image: json.photo?.highres || null,
      };
    }
  } catch (err) {
    console.error("Nutritionix error:", err);
  }
  return null;
}

async function tryOpenFoodFacts(barcode) {
  try {
    const res = await fetch(`https://world.openfoodfacts.org/api/v0/product/${barcode}.json`);
    const json = await res.json();
    if (json.status === 1 && json.product) {
      const product = json.product;
      return {
        source: "OpenFoodFacts",
        productName: product.product_name || "",
        brand: product.brands || "",
        ingredients: product.ingredients_text || null,
        nutriments: product.nutriments || null,
        image: product.image_url || null,
      };
    }
  } catch (err) {
    console.error("OpenFoodFacts error:", err);
  }
  return null;
}

async function tryUSDA(barcode) {
  try {
    const key = process.env.USDA_API_KEY;
    if (!key) return null;
    const res = await fetch(
      `https://api.nal.usda.gov/fdc/v1/foods/search?query=${barcode}&api_key=${key}&pageSize=1`
    );
    const json = await res.json();
    if (json.foods?.length) {
      const food = json.foods[0];
      return {
        source: "USDA",
        productName: food.description || "",
        brand: food.brandOwner || "",
        ingredients: food.ingredients || null,
        nutriments: food.foodNutrients || null,
        image: null,
      };
    }
  } catch (err) {
    console.error("USDA error:", err);
  }
  return null;
}

async function tryFoodRepo(barcode) {
  try {
    const key = process.env.FOODREPO_API_KEY;
    if (!key) return null;
    const res = await fetch(`https://www.foodrepo.org/api/v3/products/${barcode}`, {
      headers: { Authorization: `Token token=${key}` },
    });
    const json = await res.json();
    if (json?.data?.attributes?.ingredients_text) {
      return {
        source: "FoodRepo",
        productName: json.data.attributes.name || "",
        brand: json.data.attributes.brand_name || "",
        ingredients: json.data.attributes.ingredients_text,
        nutriments: null,
        image: json.data.attributes.image || null,
      };
    }
  } catch (err) {
    console.error("FoodRepo error:", err);
  }
  return null;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { barcode } = req.body;
  if (!barcode) return res.status(400).json({ error: "No barcode provided." });

  let result = null;

  // Try in order: Nutritionix -> OpenFoodFacts -> USDA -> FoodRepo
  result = await tryNutritionix(barcode);
  if (!result) result = await tryOpenFoodFacts(barcode);
  if (!result) result = await tryUSDA(barcode);
  if (!result) result = await tryFoodRepo(barcode);

  if (!result) {
    return res.status(404).json({ error: "Product not found." });
  }

  return res.status(200).json(result);
}
