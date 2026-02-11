// components/org/RemoveMemberModal.js
"use client";

import { Trash2, X } from "lucide-react";
import { Button, classNames, inputBaseClass } from "./TeamUI";

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function Modal({ open, title, children, onClose }) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[9999]">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} role="button" tabIndex={0} />
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div className="w-full max-w-xl bg-white rounded-2xl shadow-xl border border-gray-200">
          <div className="p-5 border-b flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-lg font-extrabold text-gray-900 truncate">{title}</p>
              <p className="text-[12px] text-gray-500 mt-1">Manage org-side access (Admin/Trainer).</p>
            </div>
            <button
              className="p-2 rounded-xl border border-gray-200 hover:bg-gray-50"
              onClick={onClose}
              type="button"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="p-5">{children}</div>
        </div>
      </div>
    </div>
  );
}

export default function RemoveMemberModal({
  open,
  target,
  canManageMembers,
  busy,
  error,
  onClose,
  onConfirm,
}) {
  return (
    <Modal
      open={open}
      title={
        target ? `Remove: ${target?.Name || target?.Email || "Member"}` : "Remove Member"
      }
      onClose={onClose}
    >
      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-3 mb-4">
          <p className="text-sm text-red-700 font-semibold">{error}</p>
        </div>
      ) : null}

      <div className="space-y-4">
        {!canManageMembers ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
            <p className="text-sm font-semibold text-amber-900">Only Organization/Admin can remove members.</p>
            <p className="text-[11px] text-amber-800 mt-1">Ask an admin to deactivate this staff member.</p>
          </div>
        ) : null}

        <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
          <p className="text-xs text-gray-500">Confirm</p>
          <p className="text-sm font-extrabold text-gray-900 mt-1">
            This will deactivate org access for:
          </p>
          <p className="text-[12px] text-gray-700 mt-2">
            <span className="font-semibold">{target?.Name || "Member"}</span>
            {target?.Email ? (
              <>
                {" "}
                • <span className="font-mono">{normalizeEmail(target.Email)}</span>
              </>
            ) : null}
          </p>
          <p className="text-[11px] text-gray-500 mt-2">
            Deactivated members can be reactivated later by editing and setting Active=true.
          </p>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button
            onClick={onConfirm}
            disabled={busy || !canManageMembers}
            className={classNames("bg-red-600 hover:brightness-110")}
          >
            <Trash2 className="w-4 h-4" />
            {busy ? "Removing..." : "Remove"}
          </Button>
        </div>

        <div className="text-[11px] text-gray-500">
          This calls <span className="font-mono">/api/org/members/remove</span>. If you prefer, wire it to{" "}
          <span className="font-mono">/api/org/members/update</span> with{" "}
          <span className="font-mono">active=false</span>.
        </div>
      </div>
    </Modal>
  );
}
