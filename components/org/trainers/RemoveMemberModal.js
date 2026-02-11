// components/org/trainers/RemoveMemberModal.js
"use client";

import Modal from "@/components/org/trainers/ui/Modal";
import Button from "@/components/org/trainers/ui/Button";
import { Trash2 } from "lucide-react";
import { normalizeEmail } from "@/components/org/trainers/utils/strings";

export default function RemoveMemberModal({ open, member, canManageMembers, onClose, onConfirm, errorText }) {
  return (
    <Modal
      open={open}
      title={member ? `Remove: ${member?.Name || member?.Email || "Member"}` : "Remove Member"}
      onClose={onClose}
    >
      {errorText ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-3 mb-4">
          <p className="text-sm text-red-700 font-semibold">{errorText}</p>
        </div>
      ) : null}

      <div className="space-y-4">
        <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
          <p className="text-xs text-gray-500">Confirm</p>
          <p className="text-sm font-extrabold text-gray-900 mt-1">This will deactivate org access for:</p>
          <p className="text-[12px] text-gray-700 mt-2">
            <span className="font-semibold">{member?.Name || "Member"}</span>
            {member?.Email ? (
              <>
                {" "}
                • <span className="font-mono">{normalizeEmail(member.Email)}</span>
              </>
            ) : null}
          </p>
          <p className="text-[11px] text-gray-500 mt-2">
            Deactivated members can be reactivated later via Edit → Active=true.
          </p>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={onConfirm}
            disabled={!canManageMembers}
            className="bg-red-600 hover:brightness-110"
          >
            <Trash2 className="w-4 h-4" />
            Remove
          </Button>
        </div>
      </div>
    </Modal>
  );
}
