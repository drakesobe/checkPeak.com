// components/ui/Card.jsx
import clsx from "clsx";

export default function Card({
  title,
  children,
  header,
  footer,
  actions,
  variant = "default",
  clickable = false,
  className = "",
}) {
  const variants = {
    default: "bg-white border border-blue-100 shadow-md",
    subtle: "bg-white border border-gray-200 shadow-sm",
    elevated: "bg-white border border-gray-100 shadow-xl",
    outline: "bg-transparent border border-gray-300",
    dark: "bg-gray-900 border border-gray-800 text-white",
  };

  return (
    <div
      className={clsx(
        "rounded-2xl w-full transition",
        variants[variant],
        clickable && "cursor-pointer hover:shadow-lg hover:-translate-y-0.5",
        className
      )}
    >
      {/* Header */}
      {(title || header || actions) && (
        <div className="flex items-center justify-between px-6 pt-5 pb-3">
          <div>
            {title && (
              <h2 className="text-lg font-semibold text-gray-900">
                {title}
              </h2>
            )}
            {header}
          </div>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>
      )}

      {/* Body */}
      <div className="px-6 pb-5 text-gray-700">
        {children}
      </div>

      {/* Footer */}
      {footer && (
        <div className="px-6 py-3 border-t border-gray-100 text-sm text-gray-600">
          {footer}
        </div>
      )}
    </div>
  );
}
