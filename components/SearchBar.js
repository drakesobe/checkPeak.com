import React from "react";

export default function SearchBar({ value, onChange }) {
  return (
    <input
      type="text"
      placeholder="Type substance name, synonym, or banned by..."
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full p-3 rounded-lg border border-gray-300 text-gray-700 text-base focus:outline-none focus:ring-2 focus:ring-blue-400 transition"
    />
  );
}
