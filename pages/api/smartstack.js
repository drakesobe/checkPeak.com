// pages/api/smartstack.js

export default function handler(req, res) {
  // SmartStack data with categories
  const stacks = [
    {
      id: "1",
      name: "Energy Boost Stack",
      supplements: ["Caffeine", "L-Theanine", "B-Vitamins"],
      valueRating: "bestValue",
      banType: "None",
      category: "Pre-Workout",
      notes: "Optimized for alertness without crash.",
      affiliateLink: "https://www.amazon.com/dp/B01N5IB20Q?tag=youraffiliateid",
    },
    {
      id: "2",
      name: "Recovery Stack",
      supplements: ["Creatine Monohydrate", "L-Glutamine", "BCAAs"],
      valueRating: "moderate",
      banType: "Particular Sports",
      category: "Protein Powder",
      notes: "Supports muscle recovery post-training.",
      affiliateLink: "https://www.amazon.com/dp/B00L4FR0YE?tag=youraffiliateid",
    },
    {
      id: "3",
      name: "Focus Stack",
      supplements: ["Omega-3", "Bacopa Monnieri", "Rhodiola Rosea"],
      valueRating: "highPrice",
      banType: "Limited to Out of Competition",
      category: "Misc",
      notes: "Enhances cognitive focus and memory.",
      affiliateLink: "https://www.amazon.com/dp/B07P8VZKJ2?tag=youraffiliateid",
    },
    {
      id: "4",
      name: "Endurance Stack",
      supplements: ["Beta-Alanine", "L-Citrulline", "Electrolytes"],
      valueRating: "bestValue",
      banType: "Prohibited",
      category: "Pre-Workout",
      notes: "For long-duration performance; check regulations.",
      affiliateLink: "https://www.amazon.com/dp/B08HR3F7HX?tag=youraffiliateid",
    },
    {
      id: "5",
      name: "Immune Support Stack",
      supplements: ["Vitamin C", "Zinc", "Elderberry"],
      valueRating: "moderate",
      banType: "None",
      category: "Misc",
      notes: "Supports overall immune health.",
      affiliateLink: "https://www.amazon.com/dp/B07R7M1ZXM?tag=youraffiliateid",
    },
    {
      id: "6",
      name: "Morning Energy Stack",
      supplements: ["Caffeine", "B-Vitamins", "Electrolytes"],
      valueRating: "bestValue",
      banType: "None",
      category: "Energy Drinks",
      notes: "Kickstart your day with sustained energy.",
      affiliateLink: "https://www.amazon.com/dp/B01LTHP2ZK?tag=youraffiliateid",
    },
    {
      id: "7",
      name: "Protein Power Stack",
      supplements: ["Whey Protein", "Creatine Monohydrate", "BCAAs"],
      valueRating: "moderate",
      banType: "Particular Sports",
      category: "Protein Powder",
      notes: "Supports muscle growth and recovery.",
      affiliateLink: "https://www.amazon.com/dp/B00J074W94?tag=youraffiliateid",
    },
    {
      id: "8",
      name: "Snack & Recover Stack",
      supplements: ["Protein Bars", "Vitamin C", "Zinc"],
      valueRating: "bestValue",
      banType: "None",
      category: "Protein Bars",
      notes: "Healthy snacking with recovery benefits.",
      affiliateLink: "https://www.amazon.com/dp/B07K1XNL9D?tag=youraffiliateid",
    },
    {
      id: "9",
      name: "BCAA Endurance Stack",
      supplements: ["BCAAs", "Electrolytes", "Beta-Alanine"],
      valueRating: "highPrice",
      banType: "Limited to Out of Competition",
      category: "BCAAs",
      notes: "Ideal for long workouts and endurance training.",
      affiliateLink: "https://www.amazon.com/dp/B08HR7N1F1?tag=youraffiliateid",
    }
  ];

  res.status(200).json({ records: stacks });
}
