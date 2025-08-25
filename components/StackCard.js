import { motion } from "framer-motion";
import { FaDumbbell, FaBolt, FaLeaf, FaCoffee, FaAppleAlt, FaCapsules } from "react-icons/fa";

const supplementIcons = {
  "Caffeine": <FaCoffee />,
  "L-Theanine": <FaLeaf />,
  "B-Vitamins": <FaCapsules />,
  "Creatine Monohydrate": <FaDumbbell />,
  "L-Glutamine": <FaLeaf />,
  "BCAAs": <FaDumbbell />,
  "Omega-3": <FaCapsules />,
  "Bacopa Monnieri": <FaLeaf />,
  "Rhodiola Rosea": <FaLeaf />,
  "Beta-Alanine": <FaDumbbell />,
  "L-Citrulline": <FaLeaf />,
  "Electrolytes": <FaBolt />,
  "Vitamin C": <FaAppleAlt />,
  "Zinc": <FaCapsules />,
  "Elderberry": <FaAppleAlt />
};

const valueLabel = (valueRating) => {
  switch (valueRating) {
    case "bestValue": return "Best Value 💰";
    case "moderate": return "Moderate 💵";
    case "highPrice": return "Premium 💎";
    default: return "";
  }
};

export default function StackCard({ stack, setModalStack }) {
  return (
    <motion.div
      className="bg-gray-800 p-5 rounded-2xl shadow-md hover:shadow-lg relative group overflow-hidden cursor-pointer"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.3 }}
      onClick={() => stack.nutritionLabel && setModalStack(stack)}
    >
      {/* Hover overlay */}
      <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl flex items-center justify-center">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-4.35-4.35M10.5 18a7.5 7.5 0 100-15 7.5 7.5 0 000 15z" />
        </svg>
      </div>

      {/* Image */}
      {stack.imageUrl ? (
        <img
          src={stack.imageUrl}
          alt={stack.name}
          className="w-full h-40 object-cover rounded-lg mb-2"
          onError={(e) => { e.currentTarget.src = "/fallback-image.svg"; }}
        />
      ) : (
        <div className="w-full h-40 bg-gray-700 flex items-center justify-center rounded-lg mb-2 text-gray-400 text-sm">
          No Image Available
        </div>
      )}

      {/* Stack Name */}
      <h3 className="text-xl font-bold mb-2">{stack.name}</h3>

      {/* Supplements */}
      <p className="text-gray-300 text-sm mb-2 flex flex-wrap gap-2">
        {Array.isArray(stack.supplements) && stack.supplements.length ? (
          stack.supplements.map((supp) => (
            <span key={supp} className="flex items-center gap-1 px-2 py-1 bg-gray-700 rounded-full text-xs">
              {supplementIcons[supp] || <FaCapsules />}
              {supp}
            </span>
          ))
        ) : (
          <span className="text-xs text-gray-400">No supplements listed</span>
        )}
      </p>

      {/* Ratings & BanType */}
      <div className="flex flex-wrap gap-2 mb-2">
        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
          stack.valueRating === "bestValue" ? "bg-green-600 text-white" :
          stack.valueRating === "moderate" ? "bg-yellow-600 text-white" :
          stack.valueRating === "highPrice" ? "bg-red-600 text-white" : ""
        }`}>{valueLabel(stack.valueRating)}</span>

        <span className="px-2 py-1 rounded-full text-xs font-medium" style={{
          backgroundColor: stack.banType === "Prohibited" ? "#d62828" :
                           stack.banType === "Limited to Out of Competition" ? "#f77f00" :
                           stack.banType === "Particular Sports" ? "#003049" : "#555",
          color: "white"
        }}>{stack.banType}</span>
      </div>

      {/* Notes */}
      <p className="text-gray-400 text-sm mb-4">{stack.notes}</p>

      {/* Buttons */}
      <div className="flex gap-2">
        <a
          href={stack.affiliateLink || "#"}
          target="_blank"
          rel="noopener noreferrer"
          className="px-3 py-1 bg-[#46769B] hover:bg-blue-700 rounded-2xl text-white text-sm font-medium transition-colors"
          onClick={(e) => e.stopPropagation()} // prevent modal opening
        >
          See Price
        </a>

        {stack.nutritionLabel && (
          <button
            onClick={(e) => { e.stopPropagation(); setModalStack(stack); }}
            className="px-3 py-1 bg-gray-600 hover:bg-gray-500 rounded-2xl text-white text-sm font-medium transition-colors"
          >
            View Nutrition
          </button>
        )}
      </div>
    </motion.div>
  );
}
