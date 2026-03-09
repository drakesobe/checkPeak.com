// components/org/trainers/RemoveMemberModal.js
"use client";

import { useEffect, useRef } from "react";
import { X, Trash2, AlertTriangle } from "lucide-react";
import { DS, FONT_CONDENSED } from "./ds.js";
import { Btn, Banner } from "./ui.js";
import { normalizeEmail } from "@/components/org/trainers/utils/strings";

export default function RemoveMemberModal({
  open,
  member,
  canManage = false,
  onClose,
  onConfirm,
  errorText,
}) {
  const overlayRef = useRef(null);
  const disabled   = !canManage || !member;

  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (e.key === "Escape") onClose?.(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;

  const name  = member?.Name  || member?.Email || "Member";
  const email = normalizeEmail(member?.Email || "");
  const initials = String(name).slice(0, 2).toUpperCase();

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{ backgroundColor: "rgba(8,14,26,0.55)", backdropFilter: "blur(2px)" }}
      onClick={(e) => { if (e.target === overlayRef.current) onClose?.(); }}
    >
      <div className="w-full max-w-sm bg-white" style={{ border: `1px solid ${DS.border}` }}>

        {/* Header */}
        <div
          className="flex items-center justify-between gap-4 px-6 py-4"
          style={{ borderBottom: `1px solid ${DS.border}` }}
        >
          <h2
            className="font-black leading-none"
            style={{ fontFamily: FONT_CONDENSED, fontSize: "1.3rem", color: DS.bodyText, letterSpacing: "-0.01em" }}
          >
            REMOVE MEMBER
          </h2>
          <button
            type="button" onClick={onClose}
            className="p-1.5 transition-opacity hover:opacity-60"
            style={{ border: `1px solid ${DS.border}`, color: DS.dimText }}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">

          {!canManage && (
            <Banner type="warning">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              You don't have permission to remove members.
            </Banner>
          )}

          {errorText && (
            <Banner type="error">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              {errorText}
            </Banner>
          )}

          {/* Confirm block */}
          <div className="px-4 py-4" style={{ backgroundColor: DS.pageBg, border: `1px solid ${DS.border}` }}>
            <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: DS.labelText }}>
              Deactivate org access for:
            </p>

            <div className="flex items-center gap-3">
              {/* Monogram */}
              <div
                className="w-10 h-10 flex items-center justify-center font-black text-sm shrink-0"
                style={{
                  backgroundColor: DS.badBg,
                  border: `1px solid ${DS.badBorder}`,
                  color: DS.bad,
                  fontFamily: FONT_CONDENSED,
                  fontSize: "1rem",
                }}
              >
                {initials}
              </div>
              <div>
                <p className="text-sm font-bold" style={{ color: DS.bodyText }}>{name}</p>
                {email && <p className="text-xs font-mono mt-0.5" style={{ color: DS.dimText }}>{email}</p>}
              </div>
            </div>

            <p className="text-xs mt-3" style={{ color: DS.dimText }}>
              This member can be reactivated at any time via Edit → Active.
            </p>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3">
            <Btn variant="ghost" onClick={onClose} type="button">
              Cancel
            </Btn>
            <Btn
              variant="danger"
              onClick={() => { if (member) onConfirm?.(member); }}
              disabled={disabled}
              type="button"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Deactivate
            </Btn>
          </div>
        </div>
      </div>
    </div>
  );
}