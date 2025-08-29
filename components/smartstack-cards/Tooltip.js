"use client";

export default function Tooltip({ content, children }) {
  return (
    <div className="relative group inline-block">
      {children}
      <div className="absolute bottom-full mb-1 left-1/2 transform -translate-x-1/2 px-2 py-1 text-xs bg-gray-800 text-white rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50">
        {content}
      </div>
    </div>
  );
}
