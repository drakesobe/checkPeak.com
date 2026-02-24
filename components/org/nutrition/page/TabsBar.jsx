// components/org/nutrition/page/TabsBar.jsx
"use client";

function cx(...xs) {
  return xs.filter(Boolean).join(" ");
}

function TabButton({ active, children, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        "px-3 py-2 rounded-xl text-sm font-semibold border transition",
        active
          ? "bg-white border-blue-200 text-gray-900 shadow-sm"
          : "bg-white/60 border-transparent text-gray-600 hover:bg-white hover:border-gray-200"
      )}
    >
      {children}
    </button>
  );
}

export default function TabsBar({ tab, setTab }) {
  return (
    <div className="flex flex-wrap gap-2">
      <TabButton active={tab === "overview"} onClick={() => setTab("overview")}>
        Overview
      </TabButton>
      <TabButton active={tab === "queue"} onClick={() => setTab("queue")}>
        Athlete Queue
      </TabButton>
      <TabButton active={tab === "templates"} onClick={() => setTab("templates")}>
        Plan Templates
      </TabButton>
      <TabButton active={tab === "safe"} onClick={() => setTab("safe")}>
        SmartStack Safe Picks
      </TabButton>
      <TabButton active={tab === "insights"} onClick={() => setTab("insights")}>
        Insights
      </TabButton>
    </div>
  );
}