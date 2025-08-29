"use client";

export default function ModalTabs({
  activeTab,
  setActiveTab,
  tabs = [
    { key: "detected", label: "Detected Substances", hint: "Only banned/monitored ingredients found" },
    { key: "all", label: "All Ingredients", hint: "Full OCR text of label" },
  ],
  small = false,
}) {
  return (
    <div className={`flex border-b border-gray-700 mb-${small ? "1" : "3"}`}>
      {tabs.map((tab) => (
        <button
          key={tab.key}
          className={`relative px-${small ? "2" : "4"} py-${small ? "1" : "2"} text-sm font-medium transition-colors duration-200
            ${activeTab === tab.key ? "text-white" : "text-gray-400 hover:text-white"}
          `}
          onClick={() => setActiveTab(tab.key)}
        >
          {tab.label}
          {/* Underline animation */}
          <span
            className={`absolute left-0 bottom-0 h-0.5 w-full bg-blue-500 transition-all duration-300
              ${activeTab === tab.key ? "scale-x-100" : "scale-x-0"}
              origin-left
            `}
          ></span>
          {/* Optional hint tooltip */}
          {tab.hint && !small && (
            <span className="absolute top-full left-1/2 -translate-x-1/2 mt-1 text-xs text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity">
              {tab.hint}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
