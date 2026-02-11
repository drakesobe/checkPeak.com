// components/org/trainers/InviteCard.js
"use client";

import { useMemo, useState } from "react";
import { Mail, RefreshCcw, UserPlus, Copy, Send, ExternalLink } from "lucide-react";
import Button from "@/components/org/trainers/ui/Button";
import { safeJson } from "@/components/org/trainers/utils/http";
import { normalizeEmail } from "@/components/org/trainers/utils/strings";
import { buildInviteEmail, encodeMailto } from "@/components/org/trainers/utils/email";

export default function InviteCard({
  canManageMembers,
  orgName,
  inviterName,
  onInviteCreated,
  setInviteOk,
  setInviteErr,
}) {
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [inviteRole, setInviteRole] = useState("trainer");
  const [inviteSending, setInviteSending] = useState(false);

  const [setupUrl, setSetupUrl] = useState("");
  const [setupEmail, setSetupEmail] = useState("");
  const [setupRole, setSetupRole] = useState("");
  const [expiresAt, setExpiresAt] = useState("");

  const inputBase = useMemo(
    () =>
      "w-full px-4 py-3 rounded-xl border border-gray-300 bg-white text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#46769B]",
    []
  );

  const clearSetup = () => {
    setSetupUrl("");
    setSetupEmail("");
    setSetupRole("");
    setExpiresAt("");
  };

  const openDraft = () => {
    if (!setupUrl || !setupEmail) return;
    const draft = buildInviteEmail({ orgName, inviterName, to: setupEmail, role: setupRole, inviteUrl: setupUrl, expiresAt });
    window.location.href = encodeMailto(draft);
  };

  const copyDraft = async () => {
    if (!setupUrl || !setupEmail) return;
    const draft = buildInviteEmail({ orgName, inviterName, to: setupEmail, role: setupRole, inviteUrl: setupUrl, expiresAt });
    await navigator.clipboard.writeText(`Subject: ${draft.subject}\n\n${draft.body}`);
    setInviteOk("Copied email draft.");
    setTimeout(() => setInviteOk(""), 2500);
  };

  const copyLink = async () => {
    await navigator.clipboard.writeText(setupUrl);
    setInviteOk("Copied setup link.");
    setTimeout(() => setInviteOk(""), 2500);
  };

  const createInvite = async () => {
    setInviteErr("");
    setInviteOk("");
    clearSetup();

    if (!canManageMembers) {
      setInviteErr("Only Organization/Admin can invite members.");
      return;
    }

    const email = normalizeEmail(inviteEmail);
    if (!email || !email.includes("@")) {
      setInviteErr("Enter a valid email.");
      return;
    }

    const role = String(inviteRole || "trainer").toLowerCase();
    if (!["trainer", "admin"].includes(role)) {
      setInviteErr("Role must be trainer or admin.");
      return;
    }

    setInviteSending(true);
    try {
      const res = await fetch("/api/org/members/invite", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          role,
          name: String(inviteName || "").trim() || undefined,
        }),
      });

      const data = await safeJson(res);
      if (!res.ok) throw new Error(data?.error || "Failed to create invite.");

      const url = String(data?.inviteUrl || data?.setupUrl || "");
      const exp = String(data?.expiresAt || data?.inviteExpiresAt || "");

      setSetupUrl(url);
      setSetupEmail(email);
      setSetupRole(role);
      setExpiresAt(exp);

      setInviteEmail("");
      setInviteName("");
      setInviteRole("trainer");

      onInviteCreated?.();

      if (url) {
        setInviteOk("Invite created — opening email draft…");
        setTimeout(() => setInviteOk(""), 2500);
        openDraft();
      } else {
        setInviteOk("Member created/updated.");
        setTimeout(() => setInviteOk(""), 2500);
      }
    } catch (err) {
      setInviteErr(err?.message || "Failed to create invite.");
    } finally {
      setInviteSending(false);
    }
  };

  return (
    <section className="bg-white rounded-2xl shadow-md border border-blue-100 p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-extrabold">Invite</h2>
          <p className="text-sm text-gray-600 mt-1">Create a trainer/admin invite and open an email draft.</p>
        </div>
        <Button
          variant="secondary"
          className="px-3 py-2 text-xs"
          onClick={() => onInviteCreated?.()}
          disabled={inviteSending}
          title="Refresh list"
        >
          <RefreshCcw className="w-4 h-4" />
          Refresh
        </Button>
      </div>

      {!canManageMembers ? (
        <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm text-amber-900 font-semibold">Your role is Trainer. Invites are disabled.</p>
          <p className="text-[11px] text-amber-800 mt-1">Ask an Admin/Organization owner to invite members.</p>
        </div>
      ) : null}

      <div className="mt-5 space-y-4">
        <div>
          <label className="text-xs text-gray-600 font-semibold">Email</label>
          <div className="relative mt-2">
            <Mail className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              className={`${inputBase} pl-10`}
              placeholder="coach@domain.com"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              disabled={!canManageMembers}
            />
          </div>
        </div>

        <div>
          <label className="text-xs text-gray-600 font-semibold">Name (optional)</label>
          <input
            className={inputBase}
            placeholder="Coach name"
            value={inviteName}
            onChange={(e) => setInviteName(e.target.value)}
            disabled={!canManageMembers}
          />
        </div>

        <div>
          <label className="text-xs text-gray-600 font-semibold">Role</label>
          <select
            className="mt-2 w-full px-4 py-3 rounded-xl border border-gray-300 bg-white text-sm"
            value={inviteRole}
            onChange={(e) => setInviteRole(e.target.value)}
            disabled={!canManageMembers}
          >
            <option value="trainer">Trainer</option>
            <option value="admin">Admin (Head Trainer)</option>
          </select>
        </div>

        <div className="flex justify-end pt-1">
          <Button onClick={createInvite} disabled={inviteSending || !canManageMembers}>
            <UserPlus className="w-4 h-4" />
            {inviteSending ? "Creating..." : "Create Invite"}
          </Button>
        </div>

        {setupUrl ? (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-extrabold text-emerald-900">Trainer setup link</p>
                <p className="text-[11px] text-emerald-800 mt-1">
                  Share this link so they can set their password.
                  {expiresAt ? (
                    <>
                      {" "}
                      Expires: <span className="font-mono">{expiresAt}</span>
                    </>
                  ) : null}
                </p>
              </div>
              <Button variant="secondary" className="px-3 py-2 text-xs" onClick={copyLink}>
                <Copy className="w-4 h-4" />
                Copy
              </Button>
            </div>

            <input className={inputBase} value={setupUrl} readOnly onFocus={(e) => e.target.select()} />

            <div className="flex flex-wrap gap-2 justify-end pt-1">
              <Button variant="secondary" className="px-3 py-2 text-xs" onClick={copyDraft}>
                <Copy className="w-4 h-4" />
                Copy email
              </Button>
              <Button className="px-3 py-2 text-xs" onClick={openDraft}>
                <Send className="w-4 h-4" />
                Open draft
                <ExternalLink className="w-4 h-4" />
              </Button>
            </div>

            <p className="text-[11px] text-emerald-800 leading-relaxed">
              Uses <span className="font-mono">mailto:</span> to open the user’s default email app.
            </p>
          </div>
        ) : null}

        <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
          <p className="text-sm font-extrabold text-gray-900">Inline edit</p>
          <p className="text-[11px] text-gray-600 mt-1 leading-relaxed">
            Click <span className="font-semibold">Edit</span> on a member to update Name, Email, Role, or Active.
            Saving calls <span className="font-mono">/api/org/members/update</span>.
          </p>
        </div>
      </div>
    </section>
  );
}
