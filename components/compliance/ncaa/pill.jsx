// components/compliance/ncaa/Pill.jsx
"use client";

export default function Pill({ children }) {
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full border border-gray-200 bg-white text-[11px] text-gray-700">
      {children}
    </span>
  );
}