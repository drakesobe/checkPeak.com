// components/org/prescriptions/ConfirmDeleteModal.jsx
"use client";

export default function ConfirmDeleteModal({
  open,
  title = "Delete",
  description = "",
  confirmText = "Delete",
  cancelText = "Cancel",
  loading = false,
  error = "",
  onConfirm,
  onClose,
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/40" onClick={() => (loading ? null : onClose?.())} />
      <div className="relative w-full max-w-md rounded-2xl bg-white border border-gray-200 shadow-xl p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-gray-900">{title}</h3>
            {description ? (
              <p className="text-sm text-gray-600 mt-2 leading-relaxed">{description}</p>
            ) : null}
          </div>

          <button
            type="button"
            onClick={() => (loading ? null : onClose?.())}
            className="px-3 py-1.5 rounded-xl border border-gray-200 bg-white text-sm font-semibold hover:bg-gray-50"
            disabled={loading}
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {error ? (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2">
            <p className="text-sm text-red-700 font-medium">{error}</p>
          </div>
        ) : null}

        <div className="mt-5 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => onClose?.()}
            className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white text-sm font-semibold hover:bg-gray-50"
            disabled={loading}
          >
            {cancelText}
          </button>

          <button
            type="button"
            onClick={() => onConfirm?.()}
            className="w-full px-4 py-3 rounded-xl bg-red-600 text-white text-sm font-semibold hover:brightness-110 disabled:opacity-70 disabled:cursor-not-allowed"
            disabled={loading}
          >
            {loading ? "Deleting…" : confirmText}
          </button>
        </div>

        <p className="mt-3 text-[11px] text-gray-500 leading-relaxed">
          This action permanently removes the template for your organization.
        </p>
      </div>
    </div>
  );
}
