"use client";

function classNames(...xs) {
  return xs.filter(Boolean).join(" ");
}

export default function Button({
  children,
  onClick,
  variant = "primary",
  disabled = false,
  className = "",
  title = "",
  type = "button",
}) {
  const base =
    "inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition " +
    "leading-none focus:outline-none focus-visible:ring-2 focus-visible:ring-[#46769B]/30 focus-visible:ring-inset";

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
      className={classNames(base, styles, disabled ? "opacity-70 cursor-not-allowed" : "", className)}
      type={type}
    >
      {children}
    </button>
  );
}
