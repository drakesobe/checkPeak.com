"use client";

import { useMemo, useState } from "react";
import { Mail, RefreshCcw, UserPlus, Copy, Send, ExternalLink, Info } from "lucide-react";
import Button from "@/components/org/trainers/ui/Button";
import { safeJson } from "@/components/org/trainers/utils/http";
import { normalizeEmail } from "@/components/org/trainers/utils/strings";
import { buildInviteEmail, encodeMailto } from "@/components/org/trainers/utils/email";

function cx(...xs) {
  return xs.filter(Boolean).join(" ");
}

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
      "w-full max-w-full px-4 py-3 rounded-xl border border-gray-300 bg-white text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#46769B]/25",
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
    const draft = buildInviteEmail({
      orgName,
      inviterName,
      to: setupEmail,
      role: setupRole,
      inviteUrl: setupUrl,
      expiresAt,
    });
    window.location.href = encodeMailto(draft);
  };

  const copyDraft = async () => {
    if (!setupUrl || !setupEmail) return;
    const draft = buildInviteEmail({
      orgName,
      inviterName,
      to: setupEmail,
      role: setupRole,
      inviteUrl: setupUrl,
      expiresAt,
    });
    await navigator.clipboard.writeText(`Subject: ${draft.subject}\n\n${draft.body}`);
    setInviteOk("Copied email draft.");
    setTimeout(() => setInviteOk(""), 2500);
  };

  const copyLink = async () => {
    if (!setupUrl) return;
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
    <section
      className={cx(
        "w-full max-w-full overflow-x-hidden",
        "bg-white rounded-2xl shadow-md border border-blue-100",
        // ✅ tighter on mobile
        "p-3 sm:p-6"
      )}
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 sm:gap-3">
        <div className="min-w-0">
          <h2 className="text-base sm:text-lg font-extrabold">Invite</h2>
          <p className="text-[12px] sm:text-sm text-gray-600 mt-1 leading-snug">
            Create a trainer/admin invite and open an email draft.
          </p>
        </div>

        <Button
          variant="secondary"
          className="px-3 py-2 text-xs w-full sm:w-auto justify-center"
          onClick={() => onInviteCreated?.()}
          disabled={inviteSending}
          title="Refresh list"
        >
          <RefreshCcw className="w-4 h-4" />
          Refresh
        </Button>
      </div>

      {!canManageMembers ? (
        <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 p-3 sm:p-4">
          <p className="text-sm text-amber-900 font-semibold">Your role is Trainer. Invites are disabled.</p>
          <p className="text-[11px] text-amber-800 mt-1 leading-snug">
            Ask an Admin/Organization owner to invite members.
          </p>
        </div>
      ) : null}

      <div className="mt-4 space-y-3 sm:space-y-4">
        {/* Email */}
        <div className="min-w-0">
          <label className="text-[11px] sm:text-xs text-gray-600 font-semibold">Email</label>
          <div className="relative mt-2 min-w-0">
            <Mail className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              className={cx(inputBase, "pl-10")}
              placeholder="coach@domain.com"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              disabled={!canManageMembers}
              inputMode="email"
              autoCapitalize="none"
              autoCorrect="off"
            />
          </div>
          <p className="text-[11px] text-gray-500 mt-2 leading-snug">
            We’ll generate a setup link and open a pre-filled email draft.
          </p>
        </div>

        {/* Name + Role */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="min-w-0">
            <label className="text-[11px] sm:text-xs text-gray-600 font-semibold">Name (optional)</label>
            <input
              className={cx(inputBase, "mt-2")}
              placeholder="Coach name"
              value={inviteName}
              onChange={(e) => setInviteName(e.target.value)}
              disabled={!canManageMembers}
            />
            <p className="text-[11px] text-gray-500 mt-2 leading-snug">
              Helpful for personalization in the invite email.
            </p>
          </div>

          <div className="min-w-0">
            <label className="text-[11px] sm:text-xs text-gray-600 font-semibold">Role</label>
            <select
              className="mt-2 w-full max-w-full px-4 py-3 rounded-xl border border-gray-300 bg-white text-sm"
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value)}
              disabled={!canManageMembers}
            >
              <option value="trainer">Trainer</option>
              <option value="admin">Admin (Head Trainer)</option>
            </select>
            <p className="text-[11px] text-gray-500 mt-2 leading-snug">
              Admins can manage invites. Trainers can use org tools.
            </p>
          </div>
        </div>

        {/* CTA */}
        <div className="pt-0.5">
          <Button onClick={createInvite} disabled={inviteSending || !canManageMembers} className="w-full justify-center">
            <UserPlus className="w-4 h-4" />
            {inviteSending ? "Creating..." : "Create Invite"}
          </Button>

          <p className="text-[11px] text-gray-500 mt-2 leading-snug flex items-start gap-2">
            <Info className="w-3.5 h-3.5 mt-[1px] text-gray-400" />
            If your email app doesn’t open, use “Copy link” and send it manually.
          </p>
        </div>

        {/* Result */}
        {setupUrl ? (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3 sm:p-4 space-y-3 overflow-x-hidden">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 sm:gap-3">
              <div className="min-w-0">
                <p className="text-sm font-extrabold text-emerald-900">Trainer setup link</p>
                <p className="text-[11px] text-emerald-800 mt-1 leading-snug break-words">
                  Share this link so they can set their password.
                  {expiresAt ? (
                    <>
                      {" "}
                      Expires: <span className="font-mono break-all">{expiresAt}</span>
                    </>
                  ) : null}
                </p>
              </div>

              <Button
                variant="secondary"
                className="px-3 py-2 text-xs w-full sm:w-auto justify-center"
                onClick={copyLink}
              >
                <Copy className="w-4 h-4" />
                Copy link
              </Button>
            </div>

            <div className="min-w-0">
              <input
                className={cx(inputBase, "font-mono text-[12px]")}
                value={setupUrl}
                readOnly
                onFocus={(e) => e.target.select()}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-0.5">
              <Button variant="secondary" className="px-3 py-2 text-xs w-full justify-center" onClick={copyDraft}>
                <Copy className="w-4 h-4" />
                Copy email
              </Button>

              <Button className="px-3 py-2 text-xs w-full justify-center" onClick={openDraft}>
                <Send className="w-4 h-4" />
                Open draft
                {/* ✅ no xs: (works in default Tailwind) */}
                <ExternalLink className="w-4 h-4 hidden sm:inline-flex" />
              </Button>
            </div>

            <p className="text-[11px] text-emerald-800 leading-relaxed break-words">
              Uses <span className="font-mono">mailto:</span> to open the user’s default email app.
            </p>
          </div>
        ) : null}

        {/* Info */}
        <div className="rounded-2xl border border-gray-200 bg-gray-50 p-3 sm:p-4 overflow-x-hidden">
          <p className="text-sm font-extrabold text-gray-900">Inline edit</p>
          <p className="text-[11px] text-gray-600 mt-1 leading-relaxed break-words">
            Click <span className="font-semibold">Edit</span> on a member to update Name, Email, Role, or Active. Saving
            calls <span className="font-mono">/api/org/members/update</span>.
          </p>
        </div>
      </div>
    </section>
  );
}