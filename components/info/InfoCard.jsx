// components/info/InfoCard.jsx
"use client";

import { useState } from "react";
import { motion } from "framer-motion";

export default function InfoCard({ icon, title, text, accentColor = "#1E3A5F" }) {
  const [hovered, setHovered] = useState(false);
  return (
    <motion.article
      className="rounded-none flex flex-col overflow-hidden"
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.4 }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        backgroundColor: "#FFFFFF",
        border: `1px solid #E8ECF0`,
        borderTop: `4px solid ${hovered ? accentColor : "#E8ECF0"}`,
        boxShadow: hovered ? "0 8px 32px rgba(30,58,95,0.10)" : "0 1px 4px rgba(0,0,0,0.04)",
        transition: "box-shadow 0.2s ease, border-top-color 0.2s ease",
      }}
    >
      {/* Icon row */}
      <div
        className="px-5 pt-5 pb-4 flex items-center gap-3"
        style={{ borderBottom: `1px solid #F0F4F8` }}
      >
        <div
          className="flex items-center justify-center w-10 h-10 rounded-sm shrink-0"
          style={{ backgroundColor: "#EEF3F9", border: "1px solid #C0D0E0" }}
        >
          {icon}
        </div>
        <h3
          className="font-black leading-tight uppercase"
          style={{
            fontFamily: "'Barlow Condensed', sans-serif",
            fontSize: "1rem",
            color: "#2D3748",
            letterSpacing: "0.05em",
          }}
        >
          {title}
        </h3>
      </div>
      {/* Body */}
      <div className="px-5 py-4 flex-1">
        <p
          className="text-sm leading-relaxed"
          style={{ fontFamily: "'Barlow', sans-serif", color: "#6B7A8D" }}
        >
          {text}
        </p>
      </div>
    </motion.article>
  );
}