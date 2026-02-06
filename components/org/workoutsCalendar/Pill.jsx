// /components/org/dashboard/Pill.jsx
"use client";

function classNames(...xs) {
  return xs.filter(Boolean).join(" ");
}

const TONES = {
  neutral: {
    soft: "bg-gray-100 text-gray-700 border-gray-200",
    solid: "bg-gray-900 text-white border-gray-900",
    outline: "bg-transparent text-gray-800 border-gray-300",
  },
  good: {
    soft: "bg-emerald-50 text-emerald-800 border-emerald-200",
    solid: "bg-emerald-600 text-white border-emerald-600",
    outline: "bg-transparent text-emerald-800 border-emerald-300",
  },
  warn: {
    soft: "bg-amber-50 text-amber-800 border-amber-200",
    solid: "bg-amber-600 text-white border-amber-600",
    outline: "bg-transparent text-amber-800 border-amber-300",
  },
  bad: {
    soft: "bg-red-50 text-red-800 border-red-200",
    solid: "bg-red-600 text-white border-red-600",
    outline: "bg-transparent text-red-800 border-red-300",
  },
  info: {
    soft: "bg-blue-50 text-blue-800 border-blue-200",
    solid: "bg-blue-600 text-white border-blue-600",
    outline: "bg-transparent text-blue-800 border-blue-300",
  },
  dark: {
    soft: "bg-gray-900 text-white border-gray-900",
    solid: "bg-black text-white border-black",
    outline: "bg-transparent text-gray-900 border-gray-900",
  },
};

const SIZES = {
  xs: "px-2 py-0.5 text-[10px]",
  sm: "px-2.5 py-1 text-[11px]",
  md: "px-3 py-1.5 text-[12px]",
};

export default function Pill({
  children,
  tone = "neutral",
  variant = "soft", // soft | solid | outline
  size = "sm", // xs | sm | md
  truncate = false,
  className = "",
  as: Comp = "span",
  title, // optional tooltip title
}) {
  const toneKey = TONES[tone] ? tone : "neutral";
  const variantKey = TONES[toneKey][variant] ? variant : "soft";
  const sizeKey = SIZES[size] ? size : "sm";

  return (
    <Comp
      title={title}
      className={classNames(
        "inline-flex items-center gap-1.5 rounded-full border font-semibold align-middle",
        "max-w-full",
        SIZES[sizeKey] || SIZES.sm,
        TONES[toneKey][variantKey],
        truncate ? "min-w-0 truncate" : "",
        className
      )}
    >
      {children}
    </Comp>
  );
}
