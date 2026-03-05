// components/info/ResourceLink.jsx
"use client";

import { useState } from "react";
import { FaExternalLinkAlt } from "react-icons/fa";

export default function ResourceLink({ name, desc, href }) {
  const [hovered, setHovered] = useState(false);
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="block transition-all"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        backgroundColor: "#FFFFFF",
        border: `1px solid ${hovered ? "#1E3A5F40" : "#E8ECF0"}`,
        borderLeft: `4px solid ${hovered ? "#1E3A5F" : "#E8ECF0"}`,
        padding: "1rem 1.25rem",
        boxShadow: hovered ? "0 6px 20px rgba(30,58,95,0.09)" : "0 1px 4px rgba(0,0,0,0.04)",
        transition: "all 0.2s ease",
        textDecoration: "none",
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p
            className="font-black uppercase text-sm leading-tight"
            style={{
              fontFamily: "'Barlow Condensed', sans-serif",
              color: hovered ? "#1E3A5F" : "#2D3748",
              letterSpacing: "0.05em",
              transition: "color 0.2s ease",
            }}
          >
            {name}
          </p>
          <p
            className="mt-1 text-xs sm:text-sm leading-relaxed"
            style={{ fontFamily: "'Barlow', sans-serif", color: "#6B7A8D" }}
          >
            {desc}
          </p>
        </div>
        <FaExternalLinkAlt
          className="shrink-0 mt-0.5 text-xs transition-colors"
          style={{ color: hovered ? "#1E3A5F" : "#9BA8B4" }}
        />
      </div>
    </a>
  );
}