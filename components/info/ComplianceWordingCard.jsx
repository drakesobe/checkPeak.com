// components/info/ComplianceWordingCard.jsx
"use client";

import { useState } from "react";
import { FaExternalLinkAlt } from "react-icons/fa";

function asParas(v) {
  if (!v) return [];
  if (Array.isArray(v)) return v.filter(Boolean).map(String);
  const s = String(v).trim();
  return s ? s.split("\n").map((x) => x.trim()).filter(Boolean) : [];
}

function clampStyle(lines) {
  return {
    display: "-webkit-box",
    WebkitBoxOrient: "vertical",
    WebkitLineClamp: lines,
    overflow: "hidden",
  };
}

export default function ComplianceWordingCard({ item }) {
  const [hovered, setHovered] = useState(false);
  const whyText = asParas(item?.whyItMatters).join(" ");
  const tags    = Array.isArray(item?.tags) ? item.tags : [];

  return (
    <a
      href={item?.href || "#"}
      target="_blank"
      rel="noopener noreferrer"
      className="block h-full transition-all"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        backgroundColor: "#FFFFFF",
        border: `1px solid ${hovered ? "#1E3A5F30" : "#E8ECF0"}`,
        borderTop: `4px solid ${hovered ? "#1E3A5F" : "#C0D0E0"}`,
        boxShadow: hovered
          ? "0 8px 28px rgba(30,58,95,0.10)"
          : "0 1px 4px rgba(0,0,0,0.04)",
        transition: "all 0.2s ease",
        textDecoration: "none",
      }}
    >
      <div className="h-full flex flex-col p-5">

        {/* Title */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <p
            className="font-black uppercase leading-tight text-sm"
            style={{
              fontFamily: "'Barlow Condensed', sans-serif",
              color: "#2D3748",
              letterSpacing: "0.05em",
              ...clampStyle(2),
            }}
            title={item?.title || ""}
          >
            {item?.title}
          </p>
          <FaExternalLinkAlt
            className="shrink-0 text-xs mt-0.5 transition-colors"
            style={{ color: hovered ? "#1E3A5F" : "#9BA8B4" }}
          />
        </div>

        {/* Quote block */}
        {item?.quote && (
          <div
            className="mb-3 px-4 py-3"
            style={{
              backgroundColor: "#F7F9FC",
              borderLeft: "3px solid #1E3A5F",
            }}
          >
            <p
              className="text-sm leading-relaxed italic"
              style={{
                fontFamily: "'Barlow', sans-serif",
                color: "#2D3748",
                fontWeight: 600,
                ...clampStyle(3),
              }}
              title={item.quote}
            >
              {item.quote}
            </p>
          </div>
        )}

        {/* Why it matters */}
        <div className="mb-3">
          <p
            className="text-xs font-black uppercase tracking-wider mb-1.5"
            style={{ fontFamily: "'Barlow', sans-serif", color: "#1E3A5F" }}
          >
            Why this matters
          </p>
          <p
            className="text-sm leading-relaxed"
            style={{
              fontFamily: "'Barlow', sans-serif",
              color: "#6B7A8D",
              ...clampStyle(4),
            }}
            title={whyText}
          >
            {whyText || "Included as an official reference for program-first compliance messaging."}
          </p>
        </div>

        <div className="flex-1" />

        {/* Tags */}
        {tags.length ? (
          <div className="flex flex-wrap gap-1.5 mt-3">
            {tags.map((t) => (
              <span
                key={t}
                className="inline-flex items-center px-2.5 py-0.5 text-xs font-black uppercase tracking-wide rounded-sm"
                style={{
                  backgroundColor: "#EEF3F9",
                  color: "#1E3A5F",
                  border: "1px solid #C0D0E0",
                  fontFamily: "'Barlow', sans-serif",
                }}
              >
                {t}
              </span>
            ))}
          </div>
        ) : (
          <div className="mt-3 h-[20px]" aria-hidden />
        )}
      </div>
    </a>
  );
}