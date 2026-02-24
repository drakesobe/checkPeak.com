"use client";

import { classNames } from "@/components/org/trainers/utils/strings";

export default function Button({
  children,
  onClick,
  variant = "primary",
  disabled = false,
  className = "",
  title = "",
  type = "button",
  fullWidth = false,        // ✅ optional helper
  nowrap = false,           // ✅ optional: force single-line when needed
}) {
  const base = classNames(
    // layout
    "inline-flex items-center justify-center gap-2",
    // sizing
    "px-4 py-2 rounded-xl",
    // typography
    "text-sm font-semibold text-center",
    // ✅ mobile safety: allow shrinking + prevent overflow
    "min-w-0 max-w-full",
    // wrapping behavior
    nowrap ? "whitespace-nowrap" : "whitespace-normal break-words",
    // interaction
    "transition active:scale-[0.99]"
  );

  const styles =
    variant === "primary"
      ? "bg-[#46769B] text-white hover:brightness-110"
      : variant === "dark"
      ? "bg-gray-900 text-white hover:opacity-90"
      : "bg-white text-gray-800 border border-gray-200 hover:bg-gray-50";

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      type={type}
      className={classNames(
        base,
        styles,
        fullWidth ? "w-full" : "",
        disabled ? "opacity-70 cursor-not-allowed" : "",
        className
      )}
    >
      {children}
    </button>
  );
}