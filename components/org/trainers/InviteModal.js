// components/org/trainers/InviteModal.js
"use client";

import { useEffect, useRef, useState } from "react";
import { X, Mail, UserPlus, Copy, Send, ExternalLink, AlertTriangle } from "lucide-react";
import { DS, FONT_CONDENSED } from "./ds.js";
import { FieldLabel, Input, Select, Btn, Banner } from "./ui.js";
import { safeJson } from "@/components/org/trainers/utils/http";
import { normalizeEmail } from "@/components/org/trainers/utils/strings";
import { buildInviteEmail, encodeMailto } from "@/components/org/trainers/utils/email";

export default function InviteModal({
  open,
  orgName,
  inviterName,
  onInviteCreated,
  onClose,
}) {
  const overlayRef = useRef(null);
  const emailRef   = useRef(null);

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName,  setInviteName]  = useState("");
  const [inviteRole,  setInviteRole]  = useState("trainer");
  const [sending,     setSending]     = useState(false);
  const [err,         setErr]         = useState("");
  const [ok,          setOk]          = useState("");

  const [setupUrl,   setSetupUrl]   = useState("");
  const [setupEmail, setSetupEmail] = useState("");
  const [setupRole,  setSetupRole]  = useState("");
  const [expiresAt,  setExpiresAt]  = useState("");

  /* Focus email input on open */
  useEffect(() => {
    if (open) {
      setErr(""); setOk("");
      setTimeout(() => emailRef.current?.focus(), 80);
    } else {
      /* Reset on close */
      setTimeout(() => {
        setInviteEmail(""); setInviteName(""); setInviteRole("trainer");
        setSetupUrl(""); setSetupEmail(""); setSetupRole(""); setExpiresAt("");
        setErr(""); setOk("");
      }, 300);
    }
  }, [open]);

  /* Escape key */
  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (e.key === "Escape") onClose?.(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  const clearSetup = () => { setSetupUrl(""); setSetupEmail(""); setSetupRole(""); setExpiresAt(""); };

  const buildDraft = () => buildInviteEmail({
    orgName, inviterName,
    to: setupEmail, role: setupRole,
    inviteUrl: setupUrl, expiresAt,
  });

  const openDraft = () => {
    if (!setupUrl || !setupEmail) return;
    window.location.href = encodeMailto(buildDraft());
  };

  const copyDraft = async () => {
    const d = buildDraft();
    await navigator.clipboard.writeText(`Subject: ${d.subject}\n\n${d.body}`);
    setOk("Email draft copied to clipboard.");
    setTimeout(() => setOk(""), 3000);
  };

  const copyLink = async () => {
    if (!setupUrl) return;
    await navigator.clipboard.writeText(setupUrl);
    setOk("Setup link copied.");
    setTimeout(() => setOk(""), 3000);
  };

  const handleSubmit = async () => {
    setErr(""); setOk(""); clearSetup();
    const email = normalizeEmail(inviteEmail);
    if (!email || !email.includes("@")) { setErr("Enter a valid email address."); return; }
    const role = String(inviteRole || "trainer").toLowerCase();
    if (!["trainer", "admin"].includes(role)) { setErr("Invalid role."); return; }

    setSending(true);
    try {
      const res = await fetch("/api/org/members/invite", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, role, name: String(inviteName || "").trim() || undefined }),
      });
      const data = await safeJson(res);
      if (!res.ok) throw new Error(data?.error || "Failed to create invite.");

      const url = String(data?.inviteUrl || data?.setupUrl || "");
      const exp = String(data?.expiresAt || data?.inviteExpiresAt || "");

      setSetupUrl(url); setSetupEmail(email); setSetupRole(role); setExpiresAt(exp);
      setInviteEmail(""); setInviteName(""); setInviteRole("trainer");
      onInviteCreated?.();

      if (url) {
        setOk("Invite created. Opening email draft…");
        setTimeout(() => openDraft(), 400);
      } else {
        setOk("Member created successfully.");
      }
    } catch (e) {
      setErr(e?.message || "Failed to create invite.");
    } finally { setSending(false); }
  };

  if (!open) return null;

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-start justify-end"
      style={{ backgroundColor: "rgba(8,14,26,0.45)", backdropFilter: "blur(2px)" }}
      onClick={(e) => { if (e.target === overlayRef.current) onClose?.(); }}
    >
      {/* Slide-in panel from right */}
      <div
        className="relative h-full w-full max-w-md flex flex-col bg-white overflow-y-auto"
        style={{ borderLeft: `1px solid ${DS.border}` }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between gap-4 px-6 py-5 sticky top-0 bg-white z-10"
          style={{ borderBottom: `1px solid ${DS.border}` }}
        >
          <div>
            <h2
              className="font-black leading-none"
              style={{ fontFamily: FONT_CONDENSED, fontSize: "1.5rem", color: DS.bodyText, letterSpacing: "-0.01em" }}
            >
              INVITE MEMBER
            </h2>
            <p className="text-xs mt-1" style={{ color: DS.dimText }}>
              Generate a setup link and send via email.
            </p>
          </div>
          <button
            type="button" onClick={onClose}
            className="p-2 transition-opacity hover:opacity-60 shrink-0"
            style={{ border: `1px solid ${DS.border}`, color: DS.dimText }}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 px-6 py-6 space-y-6">

          {/* Banners */}
          {err && (
            <Banner type="error">
              <AlertTriangle className="w-4 h-4 shrink-0" /> {err}
            </Banner>
          )}
          {ok && <Banner type="success">{ok}</Banner>}

          {/* Form */}
          {!setupUrl && (
            <div className="space-y-5">
              {/* Email */}
              <div>
                <FieldLabel>Email address</FieldLabel>
                <div className="relative">
                  <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                    style={{ color: DS.dimText }} />
                  <Input
                    ref={emailRef}
                    className="pl-9"
                    placeholder="coach@university.edu"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") handleSubmit(); }}
                    inputMode="email" autoCapitalize="none" autoCorrect="off"
                  />
                </div>
              </div>

              {/* Name */}
              <div>
                <FieldLabel>
                  Name{" "}
                  <span className="normal-case font-normal tracking-normal" style={{ color: DS.dimText }}>
                    (optional)
                  </span>
                </FieldLabel>
                <Input
                  placeholder="Coach name"
                  value={inviteName}
                  onChange={(e) => setInviteName(e.target.value)}
                />
                <p className="text-xs mt-1.5" style={{ color: DS.dimText }}>
                  Used to personalize the invite email.
                </p>
              </div>

              {/* Role */}
              <div>
                <FieldLabel>Role</FieldLabel>
                <Select value={inviteRole} onChange={(e) => setInviteRole(e.target.value)}>
                  <option value="trainer">Trainer - can use org tools</option>
                  <option value="admin">Admin - can manage invites + members</option>
                </Select>
              </div>

              <Btn variant="primary" onClick={handleSubmit} disabled={sending} className="w-full">
                <UserPlus className="w-4 h-4" />
                {sending ? "Creating invite…" : "Create invite"}
              </Btn>

              <p className="text-xs text-center" style={{ color: DS.dimText }}>
                If your email client doesn't open automatically, use "Copy link" to send manually.
              </p>
            </div>
          )}

          {/* ── Result ── */}
          {setupUrl && (
            <div className="space-y-5">
              {/* Setup link */}
              <div>
                <div className="flex items-center justify-between gap-3 mb-3">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-widest" style={{ color: DS.good }}>
                      Setup link ready
                    </p>
                    {expiresAt && (
                      <p className="text-xs mt-0.5" style={{ color: DS.dimText }}>
                        Expires: <span className="font-mono">{expiresAt}</span>
                      </p>
                    )}
                  </div>
                  <Btn variant="ghost" onClick={copyLink} style={{ fontSize: "0.7rem" }}>
                    <Copy className="w-3.5 h-3.5" /> Copy link
                  </Btn>
                </div>

                <Input
                  className="font-mono text-xs"
                  style={{ backgroundColor: DS.pageBg }}
                  value={setupUrl}
                  readOnly
                  onFocus={(e) => e.target.select()}
                />
              </div>

              {/* Email actions */}
              <div>
                <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: DS.labelText }}>
                  Send invite
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <Btn variant="ghost" onClick={copyDraft} className="w-full">
                    <Copy className="w-3.5 h-3.5" /> Copy email
                  </Btn>
                  <Btn variant="primary" onClick={openDraft} className="w-full">
                    <Send className="w-3.5 h-3.5" /> Open draft
                    <ExternalLink className="w-3 h-3 hidden sm:block" />
                  </Btn>
                </div>
              </div>

              {/* Send another */}
              <div style={{ borderTop: `1px solid ${DS.border}`, paddingTop: "1.25rem" }}>
                <Btn variant="ghost" onClick={clearSetup} className="w-full">
                  <UserPlus className="w-3.5 h-3.5" /> Invite another member
                </Btn>
              </div>
            </div>
          )}
        </div>

        {/* Info footer */}
        <div
          className="px-6 py-4"
          style={{ borderTop: `1px solid ${DS.border}`, backgroundColor: DS.pageBg }}
        >
          <p className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: DS.labelText }}>
            Inline edit
          </p>
          <p className="text-xs leading-relaxed" style={{ color: DS.dimText }}>
            To update name, email, role, or active status - click{" "}
            <strong style={{ color: DS.labelText }}>Edit</strong> on any row in the team table.
          </p>
        </div>
      </div>
    </div>
  );
}