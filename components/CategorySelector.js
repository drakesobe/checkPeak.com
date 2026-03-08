"use client";

const categories = [
  "All",
  "Pre-Workout",
  "Protein Powder",
  "Energy Drinks",
  "Protein Bars",
  "BCAAs",
  "Vitamins",
  "Berberine",
  "Ashwagandha",
  "Misc",
];

const vitaminSubcategories = [
  "All Vitamins",
  "Vitamin A",
  "Vitamin B",
  "Vitamin C",
  "Vitamin D",
];

export default function CategorySelector({
  activeCategory,
  setActiveCategory,
  activeVitaminCategory,
  setActiveVitaminCategory,
}) {
  const handleCategoryClick = (cat) => {
    setActiveCategory(cat);

    if (cat !== "Vitamins") {
      setActiveVitaminCategory("");
    } else if (!activeVitaminCategory) {
      setActiveVitaminCategory("All Vitamins");
    }
  };

  return (
    <div className="mb-6">
      {/* Main categories */}
      <div className="flex flex-wrap gap-3 justify-center">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => handleCategoryClick(cat)}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-transform hover:scale-105 ${
              activeCategory === cat
                ? "bg-[#46769B] text-white shadow-md"
                : "bg-gray-800 text-gray-300 hover:bg-gray-700"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Vitamin subcategories */}
      {activeCategory === "Vitamins" && (
        <div className="flex flex-wrap gap-3 justify-center mt-4">
          {vitaminSubcategories.map((subcat) => (
            <button
              key={subcat}
              onClick={() => setActiveVitaminCategory(subcat)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-transform hover:scale-105 ${
                activeVitaminCategory === subcat
                  ? "bg-[#46769B] text-white shadow-md"
                  : "bg-gray-700 text-gray-300 hover:bg-gray-600"
              }`}
            >
              {subcat}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}