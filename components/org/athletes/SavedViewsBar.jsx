"use client";

export default function SavedViewsBar({ cardClass, views, onApply, onDelete }) {
  if (!Array.isArray(views) || views.length === 0) return null;

  return (
    <div className={`${cardClass} p-5`}>
      <p className="text-sm font-bold text-gray-900">Saved Views</p>
      <p className="text-xs text-gray-500 mt-1">Local presets for fast workflows (ready queue, incomplete cleanup, etc.)</p>

      <div className="mt-3 flex flex-wrap gap-2">
        {views.map((v) => (
          <div key={v.id} className="flex items-center gap-2 px-3 py-2 rounded-xl border border-gray-200 bg-white">
            <button className="text-sm font-semibold text-gray-900 hover:underline" onClick={() => onApply(v)}>
              {v.name}
            </button>
            <button
              className="text-xs px-2 py-1 rounded-lg border border-gray-200 bg-white hover:bg-gray-50"
              onClick={() => onDelete(v.id)}
              title="Delete view"
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}