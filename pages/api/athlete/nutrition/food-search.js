// pages/api/athlete/nutrition/food-search.js
// Proxy to USDA FoodData Central API.
// Set FDC_API_KEY in .env for full database (~600k foods).
// Without the key, falls back to a curated 40-item athlete food list.
//
// USDA free key: https://api.nal.usda.gov/signup  (instant, no approval)

import { requireAthlete } from "@/lib/requireAthlete";

// ── Curated fallback (macros are per 100g unless noted) ───────────────────────

const LOCAL_FOODS = [
  // Grains
  { id: "l-oatmeal",       name: "Oatmeal, dry",               cal: 389, pro: 17,  carb: 66, fat: 7,   measures: [{ label: "0.5 cup (dry)",  g: 40  }, { label: "1 cup (dry)", g: 81  }] },
  { id: "l-white-rice",    name: "White rice, cooked",          cal: 130, pro: 2.7, carb: 28, fat: 0.3, measures: [{ label: "0.5 cup",        g: 93  }, { label: "1 cup",       g: 186 }] },
  { id: "l-brown-rice",    name: "Brown rice, cooked",          cal: 123, pro: 2.7, carb: 26, fat: 1,   measures: [{ label: "0.5 cup",        g: 98  }, { label: "1 cup",       g: 195 }] },
  { id: "l-pasta",         name: "Pasta, cooked",               cal: 158, pro: 5.8, carb: 31, fat: 0.9, measures: [{ label: "0.5 cup",        g: 100 }, { label: "1 cup",       g: 200 }] },
  { id: "l-bread-ww",      name: "Whole wheat bread",           cal: 247, pro: 13,  carb: 41, fat: 4,   measures: [{ label: "1 slice (28g)",   g: 28  }, { label: "2 slices",    g: 56  }] },
  { id: "l-bagel",         name: "Bagel, plain",                cal: 271, pro: 10,  carb: 53, fat: 1.7, measures: [{ label: "1 bagel",         g: 105 }, { label: "1/2 bagel",   g: 52  }] },
  { id: "l-granola",       name: "Granola",                     cal: 471, pro: 10,  carb: 64, fat: 20,  measures: [{ label: "0.25 cup",        g: 30  }, { label: "0.5 cup",     g: 61  }] },
  // Proteins
  { id: "l-chicken",       name: "Chicken breast, cooked",      cal: 165, pro: 31,  carb: 0,  fat: 3.6, measures: [{ label: "3 oz",            g: 85  }, { label: "4 oz",        g: 113 }, { label: "6 oz", g: 170 }] },
  { id: "l-beef",          name: "Ground beef, 93% lean",       cal: 172, pro: 24,  carb: 0,  fat: 8,   measures: [{ label: "3 oz",            g: 85  }, { label: "4 oz",        g: 113 }] },
  { id: "l-turkey",        name: "Turkey breast, cooked",       cal: 135, pro: 30,  carb: 0,  fat: 1,   measures: [{ label: "3 oz",            g: 85  }, { label: "4 oz",        g: 113 }] },
  { id: "l-salmon",        name: "Salmon, cooked",              cal: 206, pro: 28,  carb: 0,  fat: 10,  measures: [{ label: "3 oz",            g: 85  }, { label: "6 oz",        g: 170 }] },
  { id: "l-tuna",          name: "Tuna, canned in water",       cal: 116, pro: 26,  carb: 0,  fat: 0.8, measures: [{ label: "3 oz (85g)",      g: 85  }, { label: "1 can (5oz)", g: 142 }] },
  { id: "l-eggs",          name: "Eggs, whole",                 cal: 155, pro: 13,  carb: 1.1,fat: 11,  measures: [{ label: "1 egg",           g: 50  }, { label: "2 eggs",      g: 100 }, { label: "3 eggs", g: 150 }] },
  { id: "l-egg-whites",    name: "Egg whites",                  cal: 52,  pro: 11,  carb: 0.7,fat: 0.2, measures: [{ label: "1 white",         g: 33  }, { label: "3 whites",    g: 99  }, { label: "0.5 cup", g: 120 }] },
  { id: "l-whey",          name: "Whey protein powder",         cal: 370, pro: 74,  carb: 10, fat: 4,   measures: [{ label: "1 scoop (30g)",   g: 30  }] },
  // Dairy
  { id: "l-greekyogurt",   name: "Greek yogurt, plain 0%",      cal: 59,  pro: 10,  carb: 3.6,fat: 0.4, measures: [{ label: "6 oz",           g: 170 }, { label: "1 cup",       g: 245 }] },
  { id: "l-cottage",       name: "Cottage cheese, 2%",          cal: 84,  pro: 11,  carb: 3.4,fat: 2.3, measures: [{ label: "0.5 cup",        g: 113 }, { label: "1 cup",       g: 226 }] },
  { id: "l-milk-whole",    name: "Whole milk",                  cal: 61,  pro: 3.2, carb: 4.8,fat: 3.3, measures: [{ label: "1 cup",          g: 244 }] },
  { id: "l-milk-skim",     name: "Skim milk",                   cal: 34,  pro: 3.4, carb: 5,  fat: 0.1, measures: [{ label: "1 cup",          g: 244 }] },
  { id: "l-cheddar",       name: "Cheddar cheese",              cal: 403, pro: 25,  carb: 1.3,fat: 33,  measures: [{ label: "1 oz",           g: 28  }, { label: "2 oz",        g: 56  }] },
  // Fruits
  { id: "l-banana",        name: "Banana",                      cal: 89,  pro: 1.1, carb: 23, fat: 0.3, measures: [{ label: "1 small",         g: 101 }, { label: "1 medium",    g: 118 }, { label: "1 large", g: 136 }] },
  { id: "l-apple",         name: "Apple",                       cal: 52,  pro: 0.3, carb: 14, fat: 0.2, measures: [{ label: "1 medium",        g: 182 }, { label: "1 large",     g: 223 }] },
  { id: "l-orange",        name: "Orange",                      cal: 47,  pro: 0.9, carb: 12, fat: 0.1, measures: [{ label: "1 medium",        g: 130 }] },
  { id: "l-blueberries",   name: "Blueberries",                 cal: 57,  pro: 0.7, carb: 14, fat: 0.3, measures: [{ label: "0.5 cup",        g: 74  }, { label: "1 cup",       g: 148 }] },
  { id: "l-strawberries",  name: "Strawberries",                cal: 32,  pro: 0.7, carb: 7.7,fat: 0.3, measures: [{ label: "0.5 cup",        g: 76  }, { label: "1 cup",       g: 152 }] },
  // Vegetables / Carbs
  { id: "l-sweet-potato",  name: "Sweet potato, cooked",        cal: 90,  pro: 2,   carb: 21, fat: 0.1, measures: [{ label: "1 medium",        g: 130 }, { label: "1 cup mashed",g: 257 }] },
  { id: "l-broccoli",      name: "Broccoli, cooked",            cal: 35,  pro: 2.4, carb: 7.2,fat: 0.4, measures: [{ label: "0.5 cup",        g: 78  }, { label: "1 cup",       g: 156 }] },
  { id: "l-spinach",       name: "Spinach, raw",                cal: 23,  pro: 2.9, carb: 3.6,fat: 0.4, measures: [{ label: "1 cup",          g: 30  }, { label: "2 cups",      g: 60  }] },
  // Fats
  { id: "l-avocado",       name: "Avocado",                     cal: 160, pro: 2,   carb: 9,  fat: 15,  measures: [{ label: "0.5 avocado",     g: 68  }, { label: "1 avocado",   g: 136 }] },
  { id: "l-pb",            name: "Peanut butter",               cal: 588, pro: 25,  carb: 20, fat: 50,  measures: [{ label: "1 tbsp",          g: 16  }, { label: "2 tbsp",      g: 32  }] },
  { id: "l-almond-butter", name: "Almond butter",               cal: 614, pro: 21,  carb: 19, fat: 56,  measures: [{ label: "1 tbsp",          g: 16  }, { label: "2 tbsp",      g: 32  }] },
  { id: "l-almonds",       name: "Almonds",                     cal: 579, pro: 21,  carb: 22, fat: 50,  measures: [{ label: "1 oz",           g: 28  }, { label: "0.25 cup",    g: 35  }] },
  { id: "l-olive-oil",     name: "Olive oil",                   cal: 884, pro: 0,   carb: 0,  fat: 100, measures: [{ label: "1 tsp",           g: 5   }, { label: "1 tbsp",      g: 14  }] },
  // Condiments
  { id: "l-honey",         name: "Honey",                       cal: 304, pro: 0.3, carb: 82, fat: 0,   measures: [{ label: "1 tsp",           g: 7   }, { label: "1 tbsp",      g: 21  }] },
  { id: "l-maple-syrup",   name: "Maple syrup",                 cal: 260, pro: 0,   carb: 67, fat: 0.1, measures: [{ label: "1 tbsp",          g: 20  }] },
  // Misc
  { id: "l-oj",            name: "Orange juice",                cal: 45,  pro: 0.7, carb: 10, fat: 0.2, measures: [{ label: "8 fl oz",         g: 248 }] },
  { id: "l-prot-bar",      name: "Protein bar (generic)",       cal: 200, pro: 20,  carb: 22, fat: 7,   measures: [{ label: "1 bar (60g)",     g: 60  }] },
];

function nutrientVal(list, id) {
  return Number(list?.find(n => n.nutrientId === id)?.value ?? 0) || 0;
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  if (req.method !== "GET") return res.status(405).end();

  const auth = requireAthlete(req);
  if (!auth.ok) return res.status(401).json({ error: "Unauthorized" });

  const q = String(req.query.q || "").trim().toLowerCase();
  if (q.length < 2) return res.status(200).json({ ok: true, foods: [] });

  const fdcKey = process.env.USDA_API_KEY || process.env.FDC_API_KEY;

  if (fdcKey) {
    try {
      const url = `https://api.nal.usda.gov/fdc/v1/foods/search?api_key=${fdcKey}&query=${encodeURIComponent(q)}&dataType=Foundation,SR%20Legacy,Branded&pageSize=25`;
      const r = await Promise.race([
        fetch(url),
        new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), 5000)),
      ]);
      if (r.ok) {
        const data = await r.json();
        const foods = (data.foods || []).slice(0, 20).map(f => {
          const nutrients = f.foodNutrients || [];
          const cal  = nutrientVal(nutrients, 1008);
          const pro  = nutrientVal(nutrients, 1003);
          const carb = nutrientVal(nutrients, 1005);
          const fat  = nutrientVal(nutrients, 1004);

          const measures = [];
          if (f.servingSize && f.servingSizeUnit) {
            measures.push({ label: `${f.householdServingFullText || f.servingSize + f.servingSizeUnit}`, g: Number(f.servingSize) });
          }
          (f.foodMeasures || []).slice(0, 5).forEach(m => {
            if (m.gramWeight && m.disseminationText) {
              measures.push({ label: m.disseminationText, g: Number(m.gramWeight) });
            }
          });
          if (!measures.length) measures.push({ label: "100g", g: 100 });

          return {
            id: `fdc-${f.fdcId}`,
            name: f.description,
            brand: f.brandName || null,
            cal, pro, carb, fat,
            measures: measures.slice(0, 6),
          };
        });
        // Only use USDA results if we actually got some — otherwise fall through to local
        if (foods.length > 0) {
          return res.status(200).json({ ok: true, foods });
        }
      }
    } catch {
      // fall through to local list
    }
  }

  // Local curated fallback
  const foods = LOCAL_FOODS.filter(f => f.name.toLowerCase().includes(q)).slice(0, 15);
  return res.status(200).json({ ok: true, foods });
}
