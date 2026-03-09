// components/org/trainers/InviteCard.js
"use client";

import { useMemo, useState } from "react";
import { Mail, UserPlus, Copy, Send, ExternalLink, RefreshCcw, AlertTriangle, CheckCircle } from "lucide-react";
import { safeJson } from "@/components/org/trainers/utils/http";
import { normalizeEmail } from "@/components/org/trainers/utils/strings";
import { buildInviteEmail, encodeMailto } from "@/components/org/trainers/utils/email";

const DS = {
  brand:       "#1E3A5F",
  brandBg:     "#EEF3F9",
  brandBorder: "#C0D0E0",
  border:      "#E8ECF0",
  bodyText:    "#1A2535",
  labelText:   "#5A6A7D",
  dimText:     "#9BA8B4",
  good:        "#00873E",
  goodBg:      "#F0FBF4",
  goodBorder:  "#A8DFB8",
  warn:        "#B86000",
  warnBg:      "#FFFBF0",
  warnBorder:  "#FFD580",
  bad:         "#C8102E",
  badBg:       "#FFF0F0",
  badBorder:   "#FFC8C8",
};

function Label({ children }) {
  return (
    <label className="block text-xs font-bold uppercase tracking-widest mb-2"
      style={{ color: DS.labelText }}>
      {children}
    </label>
  );
}

function Input({ className = "", ...props }) {
  return (
    <input
      className={`w-full px-3 py-2.5 text-sm outline-none transition-colors ${className}`}
      style={{
        backgroundColor: "#FFFFFF",
        border: `1px solid ${DS.border}`,
        color: DS.bodyText,
      }}
      onFocus={e => { e.currentTarget.style.borderColor = DS.brand; }}
      onBlur={e =>  { e.currentTarget.style.borderColor = DS.border; }}
      {...props}
    />
  );
}

function Select({ className = "", children, ...props }) {
  return (
    <select
      className={`w-full px-3 py-2.5 text-sm outline-none ${className}`}
      style={{
        backgroundColor: "#FFFFFF",
        border: `1px solid ${DS.border}`,
        color: DS.bodyText,
      }}
      {...props}
    >
      {children}
    </select>
  );
}

function Btn({ children, onClick, disabled, variant = "primary", className = "" }) {
  const styles = {
    primary:   { backgroundColor: DS.brand,   color: "#FFF",        border: `1px solid ${DS.brand}`   },
    secondary: { backgroundColor: "#FFFFFF",   color: DS.labelText,  border: `1px solid ${DS.border}`  },
    ghost:     { backgroundColor: "transparent", color: DS.labelText, border: `1px solid ${DS.border}` },
  };
  return (
    <button
      type="button" onClick={onClick} disabled={disabled}
      className={`inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-bold uppercase tracking-widest transition-opacity disabled:opacity-40 disabled:cursor-not-allowed ${className}`}
      style={styles[variant]}
    >
      {children}
    </button>
  );
}

export default function InviteCard({
  canManageMembers, orgName, inviterName,
  onInviteCreated, setInviteOk, setInviteErr,
}) {
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName,  setInviteName]  = useState("");
  const [inviteRole,  setInviteRole]  = useState("trainer");
  const [inviteSending, setInviteSending] = useState(false);
  const [setupUrl,   setSetupUrl]   = useState("");
  const [setupEmail, setSetupEmail] = useState("");
  const [setupRole,  setSetupRole]  = useState("");
  const [expiresAt,  setExpiresAt]  = useState("");

  const clearSetup = () => { setSetupUrl(""); setSetupEmail(""); setSetupRole(""); setExpiresAt(""); };

  const openDraft = () => {
    if (!setupUrl || !setupEmail) return;
    const draft = buildInviteEmail({ orgName, inviterName, to: setupEmail, role: setupRole, inviteUrl: setupUrl, expiresAt });
    window.location.href = encodeMailto(draft);
  };

  const copyDraft = async () => {
    if (!setupUrl || !setupEmail) return;
    const draft = buildInviteEmail({ orgName, inviterName, to: setupEmail, role: setupRole, inviteUrl: setupUrl, expiresAt });
    await navigator.clipboard.writeText(`Subject: ${draft.subject}\n\n${draft.body}`);
    setInviteOk("Email draft copied."); setTimeout(() => setInviteOk(""), 2500);
  };

  const copyLink = async () => {
    if (!setupUrl) return;
    await navigator.clipboard.writeText(setupUrl);
    setInviteOk("Setup link copied."); setTimeout(() => setInviteOk(""), 2500);
  };

  const createInvite = async () => {
    setInviteErr(""); setInviteOk(""); clearSetup();
    if (!canManageMembers) { setInviteErr("Only Organization/Admin can invite members."); return; }
    const email = normalizeEmail(inviteEmail);
    if (!email || !email.includes("@")) { setInviteErr("Enter a valid email."); return; }
    const role = String(inviteRole || "trainer").toLowerCase();
    if (!["trainer", "admin"].includes(role)) { setInviteErr("Role must be trainer or admin."); return; }

    setInviteSending(true);
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
        setInviteOk("Invite created — opening email draft…");
        setTimeout(() => setInviteOk(""), 2500);
        openDraft();
      } else {
        setInviteOk("Member created."); setTimeout(() => setInviteOk(""), 2500);
      }
    } catch (err) {
      setInviteErr(err?.message || "Failed to create invite.");
    } finally { setInviteSending(false); }
  };

  return (
    <section className="bg-white" style={{ border: `1px solid ${DS.border}` }}>
      {/* Header */}
      <div className="flex items-center justify-between gap-3 px-6 py-4"
        style={{ borderBottom: `1px solid ${DS.border}` }}>
        <div>
          <h2 className="font-black leading-none"
            style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "1.3rem", color: DS.bodyText, letterSpacing: "-0.01em" }}>
            INVITE
          </h2>
          <p className="text-xs mt-1" style={{ color: DS.dimText }}>
            Generate a setup link and send via email.
          </p>
        </div>
        <button type="button" onClick={() => onInviteCreated?.()} disabled={inviteSending}
          className="p-2 transition-colors disabled:opacity-40"
          style={{ border: `1px solid ${DS.border}`, color: DS.labelText }}
          title="Refresh list"
        >
          <RefreshCcw className="w-4 h-4" />
        </button>
      </div>

      <div className="px-6 py-5 space-y-5">

        {/* Permission warning */}
        {!canManageMembers && (
          <div className="flex items-start gap-3 px-4 py-3"
            style={{ backgroundColor: DS.warnBg, border: `1px solid ${DS.warnBorder}` }}>
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" style={{ color: DS.warn }} />
            <p className="text-sm font-semibold" style={{ color: DS.warn }}>
              Trainer role — invites are disabled.
            </p>
          </div>
        )}

        {/* Email */}
        <div>
          <Label>Email</Label>
          <div className="relative">
            <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2" style={{ color: DS.dimText }} />
            <Input
              className="pl-9"
              placeholder="coach@domain.com"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              disabled={!canManageMembers}
              inputMode="email" autoCapitalize="none" autoCorrect="off"
            />
          </div>
        </div>

        {/* Name + Role */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label>Name <span className="normal-case font-normal" style={{ color: DS.dimText }}>(optional)</span></Label>
            <Input
              placeholder="Coach name"
              value={inviteName}
              onChange={(e) => setInviteName(e.target.value)}
              disabled={!canManageMembers}
            />
          </div>
          <div>
            <Label>Role</Label>
            <Select value={inviteRole} onChange={(e) => setInviteRole(e.target.value)} disabled={!canManageMembers}>
              <option value="trainer">Trainer</option>
              <option value="admin">Admin (Head Trainer)</option>
            </Select>
          </div>
        </div>

        {/* CTA */}
        <Btn onClick={createInvite} disabled={inviteSending || !canManageMembers} className="w-full">
          <UserPlus className="w-4 h-4" />
          {inviteSending ? "Creating…" : "Create Invite"}
        </Btn>

        {/* Result */}
        {setupUrl && (
          <div className="space-y-3" style={{ borderTop: `1px solid ${DS.goodBorder}`, paddingTop: "1.25rem" }}>
            <div className="flex items-center justify-between gap-3">
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
              <Btn variant="ghost" onClick={copyLink} className="shrink-0">
                <Copy className="w-3.5 h-3.5" /> Copy link
              </Btn>
            </div>

            <Input
              className="font-mono text-xs"
              value={setupUrl} readOnly
              onFocus={(e) => e.target.select()}
              style={{ backgroundColor: "#F4F7FB", border: `1px solid ${DS.border}` }}
            />

            <div className="grid grid-cols-2 gap-2">
              <Btn variant="secondary" onClick={copyDraft} className="w-full">
                <Copy className="w-3.5 h-3.5" /> Copy email
              </Btn>
              <Btn onClick={openDraft} className="w-full">
                <Send className="w-3.5 h-3.5" /> Open draft
                <ExternalLink className="w-3.5 h-3.5 hidden sm:block" />
              </Btn>
            </div>
          </div>
        )}

        {/* Info note */}
        <div className="px-4 py-3" style={{ backgroundColor: "#F4F7FB", border: `1px solid ${DS.border}` }}>
          <p className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: DS.labelText }}>
            Inline edit
          </p>
          <p className="text-xs leading-relaxed" style={{ color: DS.dimText }}>
            Click <strong style={{ color: DS.labelText }}>Edit</strong> on any member to update their name, email, role, or active status.
          </p>
        </div>

      </div>
    </section>
  );
}