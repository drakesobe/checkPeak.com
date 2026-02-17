// components/athlete-today/complete-item-modal/components/SectionTitle.jsx

"use client";

export default function SectionTitle({ icon, title, subtitle = "", right = null }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          {icon ? (
            <span className="h-9 w-9 rounded-2xl border border-gray-200 bg-gray-50 flex items-center justify-center shrink-0">
              {icon}
            </span>
          ) : null}

          <div className="min-w-0">
            <p className="text-sm font-extrabold text-gray-900">{title}</p>
            {subtitle ? (
              <p className="text-[12px] text-gray-600 mt-0.5 leading-snug">
                {subtitle}
              </p>
            ) : null}
          </div>
        </div>
      </div>

      {right ? <div className="shrink-0">{right}</div> : null}
    </div>
  );
}
