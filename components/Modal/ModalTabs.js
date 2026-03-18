"use client";

export default function ModalTabs({ activeTab, setActiveTab }) {
  const tabs = [
    { key: "detected", label: "Detected" },
    { key: "all",      label: "All Text"  },
  ];

  return (
    <div
      className="flex gap-1 rounded-xl p-1"
      style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}
    >
      {tabs.map((tab) => {
        const active = activeTab === tab.key;
        return (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className="flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all"
            style={{
              background:    active ? "rgba(91,158,201,0.18)" : "transparent",
              border:        active ? "1px solid rgba(91,158,201,0.3)" : "1px solid transparent",
              color:         active ? "#5B9EC9" : "rgba(255,255,255,0.4)",
              fontFamily:    "'Barlow Condensed', sans-serif",
              letterSpacing: "0.06em",
              textTransform: "uppercase",
            }}
            aria-selected={active}
            role="tab"
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}