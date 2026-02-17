// components/athlete-today/ui/atoms/Button.jsx
"use client";

import { classNames } from "../utils";

export default function Button({
  children,
  onClick,
  variant = "primary",
  disabled = false,
  className = "",
  type = "button",
  title = "",
}) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition whitespace-nowrap";
  const size = "px-3 py-2 sm:px-4 sm:py-2 text-xs sm:text-sm";
  const styles =
    variant === "primary"
      ? "bg-[#46769B] text-white hover:brightness-110"
      : variant === "dark"
      ? "bg-gray-900 text-white hover:opacity-90"
      : "bg-white text-gray-800 border border-gray-200 hover:bg-gray-50";

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={classNames(
        base,
        size,
        styles,
        disabled ? "opacity-70 cursor-not-allowed" : "",
        className
      )}
    >
      {children}
    </button>
  );
}
