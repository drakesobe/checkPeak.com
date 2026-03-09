// components/org/trainers/EditMemberPanel.js
"use client";

import { useEffect, useRef, useState } from "react";
import { X, Save, AlertTriangle, User, Mail, Shield, ToggleLeft, ToggleRight } from "lucide-react";
import { DS, FONT_CONDENSED } from "./ds.js";
import { FieldLabel, Input, Select, Btn, RolePill, StatusPill, Banner } from "./ui.js";
import { normalizeEmail } from "@/components/org/trainers/utils/strings";

export default function EditMemberPanel({
  member,       // the member object to edit
  open,
  onClose,
  onSave,       // async (payload) => void
}) {
  const overlayRef = useRef(null);

  const [name,   setName]   = useState("");
  const [email,  setEmail]  = useState("");
  const [role,   setRole]   = useState("trainer");
  const [active, setActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err,    setErr]    = useState("");
  const [ok,     setOk]     = useState("");

  /* Populate form when member changes */
  useEffect(() => {
    if (member) {
      setName(String(member?.Name  || ""));
      setEmail(String(member?.Email || ""));
      setRole(String(member?.Role   || "trainer").toLowerCase());
      setActive(Boolean(member?.Active));
      setErr(""); setOk("");
    }
  }, [member]);

  /* Escape key */
  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (e.key === "Escape") onClose?.(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  const handleSave = async () => {
    setErr(""); setOk("");
    const cleanEmail = normalizeEmail(email);
    if (!cleanEmail || !cleanEmail.includes("@")) { setErr("Valid email is required."); return; }
    if (!["trainer", "admin"].includes(role)) { setErr("Invalid role."); return; }

    setSaving(true);
    try {
      await onSave?.({
        memberId: member?.id,
        name:   String(name  || "").trim(),
        email:  cleanEmail,
        role,
        active,
      });
      setOk("Changes saved.");
      setTimeout(() => { setOk(""); onClose?.(); }, 900);
    } catch (e) {
      setErr(e?.message || "Failed to save changes.");
    } finally { setSaving(false); }
  };

  const isDirty =
    name   !== String(member?.Name  || "") ||
    email  !== String(member?.Email || "") ||
    role   !== String(member?.Role  || "trainer").toLowerCase() ||
    active !== Boolean(member?.Active);

  if (!open || !member) return null;

  const displayName = member?.Name || member?.Email || "Member";

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-start justify-end"
      style={{ backgroundColor: "rgba(8,14,26,0.45)", backdropFilter: "blur(2px)" }}
      onClick={(e) => { if (e.target === overlayRef.current) onClose?.(); }}
    >
      {/* Panel */}
      <div
        className="relative h-full w-full max-w-md flex flex-col bg-white overflow-y-auto"
        style={{ borderLeft: `1px solid ${DS.border}` }}
      >
        {/* Header */}
        <div
          className="flex items-start justify-between gap-4 px-6 py-5 sticky top-0 bg-white z-10"
          style={{ borderBottom: `1px solid ${DS.border}` }}
        >
          <div className="min-w-0">
            <h2
              className="font-black leading-none"
              style={{ fontFamily: FONT_CONDENSED, fontSize: "1.5rem", color: DS.bodyText, letterSpacing: "-0.01em" }}
            >
              EDIT MEMBER
            </h2>
            <p className="text-xs mt-1 truncate" style={{ color: DS.dimText }}>
              {displayName}
            </p>
          </div>
          <button
            type="button" onClick={onClose}
            className="p-2 transition-opacity hover:opacity-60 shrink-0 mt-0.5"
            style={{ border: `1px solid ${DS.border}`, color: DS.dimText }}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Current state chips */}
        <div
          className="flex items-center gap-2 px-6 py-3"
          style={{ borderBottom: `1px solid ${DS.border}`, backgroundColor: DS.pageBg }}
        >
          <RolePill role={String(member?.Role || "trainer").toLowerCase()} />
          <StatusPill active={Boolean(member?.Active)} />
          {isDirty && (
            <span
              className="text-xs font-bold uppercase tracking-widest ml-auto"
              style={{ color: DS.warn }}
            >
              Unsaved changes
            </span>
          )}
        </div>

        {/* Form body */}
        <div className="flex-1 px-6 py-6 space-y-6">

          {/* Banners */}
          {err && (
            <Banner type="error">
              <AlertTriangle className="w-4 h-4 shrink-0" /> {err}
            </Banner>
          )}
          {ok && <Banner type="success">{ok}</Banner>}

          {/* Name */}
          <div>
            <FieldLabel>
              <span className="flex items-center gap-1.5">
                <User className="w-3.5 h-3.5" /> Name
              </span>
            </FieldLabel>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Full name"
            />
          </div>

          {/* Email */}
          <div>
            <FieldLabel>
              <span className="flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5" /> Email
              </span>
            </FieldLabel>
            <Input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="email@domain.com"
              inputMode="email" autoCapitalize="none" autoCorrect="off"
            />
            <p className="text-xs mt-1.5" style={{ color: DS.dimText }}>
              This is the email used to log in.
            </p>
          </div>

          {/* Role */}
          <div>
            <FieldLabel>
              <span className="flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5" /> Role
              </span>
            </FieldLabel>
            <Select value={role} onChange={(e) => setRole(e.target.value)}>
              <option value="trainer">Trainer — can use org tools</option>
              <option value="admin">Admin — can manage invites + members</option>
            </Select>
          </div>

          {/* Active toggle */}
          <div>
            <FieldLabel>Access status</FieldLabel>
            <button
              type="button"
              onClick={() => setActive(v => !v)}
              className="w-full flex items-center justify-between gap-4 px-4 py-3 transition-colors"
              style={{
                border:          `1px solid ${active ? DS.goodBorder : DS.warnBorder}`,
                backgroundColor: active ? DS.goodBg : DS.warnBg,
              }}
            >
              <div className="text-left">
                <p className="text-sm font-bold" style={{ color: active ? DS.good : DS.warn }}>
                  {active ? "Active" : "Inactive"}
                </p>
                <p className="text-xs mt-0.5" style={{ color: DS.dimText }}>
                  {active
                    ? "Member can access org tools."
                    : "Member's access is disabled. They can be reactivated at any time."}
                </p>
              </div>
              {active
                ? <ToggleRight className="w-6 h-6 shrink-0" style={{ color: DS.good }} />
                : <ToggleLeft  className="w-6 h-6 shrink-0" style={{ color: DS.warn }} />
              }
            </button>
          </div>

        </div>

        {/* Footer actions */}
        <div
          className="px-6 py-4 flex items-center justify-between gap-3 sticky bottom-0 bg-white"
          style={{ borderTop: `1px solid ${DS.border}` }}
        >
          <Btn variant="ghost" onClick={onClose} disabled={saving}>
            Cancel
          </Btn>
          <Btn
            variant="primary"
            onClick={handleSave}
            disabled={saving || !isDirty}
            className="flex-1"
          >
            <Save className="w-4 h-4" />
            {saving ? "Saving…" : "Save changes"}
          </Btn>
        </div>
      </div>
    </div>
  );
}