import { FaDumbbell, FaBolt, FaLeaf, FaCoffee, FaAppleAlt, FaCapsules } from "react-icons/fa";

const banTypeColors = [
  { label: "Prohibited", color: "#d62828" },
  { label: "Limited to Out of Competition", color: "#f77f00" },
  { label: "Particular Sports", color: "#003049" },
];

const valueFilters = [
  { label: "Best Value", key: "bestValue" },
  { label: "Moderate", key: "moderate" },
  { label: "High Price", key: "highPrice" },
];

export default function Filters({ activeBanType, setActiveBanType, activeValueFilter, setActiveValueFilter }) {
  const handleBanClick = (label) => {
    setActiveBanType(activeBanType === label ? null : label);
  };

  const handleValueClick = (key) => {
    setActiveValueFilter(activeValueFilter === key ? null : key);
  };

  return (
    <div className="flex flex-wrap gap-4 mb-6 justify-center">
      {banTypeColors.map((type) => (
        <div
          key={type.label}
          className={`flex items-center gap-2 cursor-pointer transition-transform hover:scale-110 px-3 py-1 rounded-full border ${
            activeBanType === type.label ? "border-gray-200 bg-opacity-30" : "border-transparent"
          }`}
          onClick={() => handleBanClick(type.label)}
          title={type.label}
        >
          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: type.color }} />
          <span className="text-sm font-medium">{type.label}</span>
        </div>
      ))}

      {valueFilters.map((filter) => (
        <div
          key={filter.key}
          className={`px-3 py-1 rounded-full cursor-pointer border transition-transform hover:scale-110 ${
            activeValueFilter === filter.key ? "border-gray-200 bg-opacity-30" : "border-transparent"
          }`}
          onClick={() => handleValueClick(filter.key)}
        >
          <span className="text-sm font-medium">{filter.label}</span>
        </div>
      ))}
    </div>
  );
}
