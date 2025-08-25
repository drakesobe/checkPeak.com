const categories = [
  "All",
  "Pre-Workout",
  "Protein Powder",
  "Energy Drinks",
  "Protein Bars",
  "BCAAs",
  "Misc",
];

export default function CategorySelector({ activeCategory, setActiveCategory }) {
  return (
    <div className="flex flex-wrap gap-3 mb-6 justify-center">
      {categories.map((cat) => (
        <button
          key={cat}
          onClick={() => setActiveCategory(cat)}
          className={`px-4 py-2 rounded-full text-sm font-medium transition-transform hover:scale-105 ${
            activeCategory === cat ? "bg-[#46769B] text-white shadow-md" : "bg-gray-800 text-gray-300 hover:bg-gray-700"
          }`}
        >
          {cat}
        </button>
      ))}
    </div>
  );
}
