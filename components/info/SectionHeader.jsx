// components/info/SectionHeader.jsx
"use client";

export default function SectionHeader({ kicker, title, titleAccent, subtitle, align = "center", light = false }) {
  const alignClass = align === "left" ? "text-left" : "text-center mx-auto";
  const titleColor = light ? "#FFFFFF" : "#2D3748";
  const kickerColor = light ? "rgba(255,255,255,0.6)" : "#1E3A5F";
  const kickerBg = light ? "rgba(255,255,255,0.1)" : "#EEF3F9";
  const kickerBorder = light ? "rgba(255,255,255,0.18)" : "#C0D0E0";
  const subtitleColor = light ? "rgba(255,255,255,0.72)" : "#6B7A8D";

  return (
    <div className={`max-w-3xl ${alignClass}`}>
      {kicker && (
        <span
          className="inline-flex items-center rounded-sm px-3 py-1 text-xs font-black uppercase tracking-wider mb-4"
          style={{ backgroundColor: kickerBg, color: kickerColor, border: `1px solid ${kickerBorder}` }}
        >
          {kicker}
        </span>
      )}
      <h2
        className="font-black leading-none"
        style={{
          fontFamily: "'Barlow Condensed', sans-serif",
          fontSize: "clamp(1.4rem, 4vw, 2.5rem)",
          color: titleColor,
          letterSpacing: "0.01em",
          textTransform: "uppercase",
        }}
      >
        {titleAccent
          ? <>
              {title}{" "}
              <span style={{ color: "#C8102E" }}>{titleAccent}</span>
            </>
          : title}
      </h2>
      {subtitle && (
        <p
          className="mt-3 text-sm sm:text-base leading-relaxed"
          style={{ fontFamily: "'Barlow', sans-serif", color: subtitleColor }}
        >
          {subtitle}
        </p>
      )}
    </div>
  );
}