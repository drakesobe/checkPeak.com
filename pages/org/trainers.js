// pages/org/trainers.js (or pages/org/trainers.jsx)
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthContext } from "@/hooks/useAuth";

import OrgTrainersHeader from "@/components/org/trainers/OrgTrainersHeader";
import InviteCard from "@/components/org/trainers/InviteCard";
import TeamTableCard from "@/components/org/trainers/TeamTableCard";
import RemoveMemberModal from "@/components/org/trainers/RemoveMemberModal";

async function safeJson(res) {
  try {
    return await res.json();
  } catch {
    return {};
  }
}

export default function TrainersPage() {
  const router = useRouter();
  const { user, logout } = useAuthContext();

  // Role normalization for gating + perms
  const role = useMemo(() => {
    const r = String(user?.role || user?.Role || "").trim().toLowerCase();
    if (!r) return "";
    if (r === "organization" || r.includes("org")) return "organization";
    if (r === "admin" || r.includes("admin")) return "admin";
    if (r === "trainer" || r.includes("train")) return "trainer";
    if (r === "athlete" || r.includes("ath")) return "athlete";
    return r;
  }, [user]);

  const isOrgSide = role === "organization" || role === "admin" || role === "trainer";
  const canManageMembers = role === "organization" || role === "admin";

  // Session display props
  const orgName = useMemo(() => {
    const guess =
      user?.OrgName ||
      user?.["Organization Name"] ||
      user?.OrganizationName ||
      user?.organizationName ||
      user?.Organization ||
      (role === "organization" ? user?.Name || user?.name : "") ||
      "Organization";
    return String(guess || "Organization");
  }, [user, role]);

  const orgEmail = useMemo(() => String(user?.Email || user?.email || ""), [user]);
  const orgToken = useMemo(() => String(user?.Token || user?.token || "").trim(), [user]);
  const orgId = useMemo(() => String(user?.orgId || user?.OrgId || "").trim(), [user]);

  const inviterName = useMemo(() => {
    return String(user?.Name || user?.name || orgName || "Team").trim();
  }, [user, orgName]);

  /* ----------------------------- */
  /* Guards                        */
  /* ----------------------------- */

  useEffect(() => {
    if (!user) {
      router.push("/");
      return;
    }
    if (!isOrgSide) {
      router.push("/dashboard");
      return;
    }
  }, [user, isOrgSide, router]);

  /* ----------------------------- */
  /* Data + UI state               */
  /* ----------------------------- */

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [trainers, setTrainers] = useState([]);

  // header banner messages (shared across page + InviteCard)
  const [inviteErr, setInviteErr] = useState("");
  const [inviteOk, setInviteOk] = useState("");
  const [saveErr, setSaveErr] = useState("");
  const [saveOk, setSaveOk] = useState("");

  // Remove modal state
  const [removeOpen, setRemoveOpen] = useState(false);
  const [removeTarget, setRemoveTarget] = useState(null);

  const openRemove = useCallback((member) => {
    setRemoveTarget(member || null);
    setRemoveOpen(true);
  }, []);

  const closeRemove = useCallback(() => {
    setRemoveOpen(false);
    setRemoveTarget(null);
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/org/members/list", {
        method: "GET",
        credentials: "include",
      });

      const data = await safeJson(res);
      if (!res.ok) throw new Error(data?.error || "Failed to load members.");

      const raw = Array.isArray(data?.trainers) ? data.trainers : [];

      const normalized = raw.map((t) => ({
        ...t,
        id: t?.id,
        Name: t?.Name ?? t?.name ?? "",
        Email: t?.Email ?? t?.email ?? "",
        Role: t?.Role ?? t?.role ?? "trainer",
        Active:
          typeof t?.Active === "boolean"
            ? t.Active
            : typeof t?.active === "boolean"
            ? t.active
            : false,
        createdAt: t?.createdAt || t?.CreatedAt || t?.createdTime || t?._createdTime || "",
      }));

      setTrainers(normalized);
    } catch (e) {
      setTrainers([]);
      setError(e?.message || "Failed to load members.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!user || !isOrgSide) return;
    refresh();
  }, [user, isOrgSide, refresh]);

  /* ----------------------------- */
  /* Actions                       */
  /* ----------------------------- */

  const onLogout = useCallback(async () => {
    try {
      await logout?.();
    } finally {
      router.push("/");
    }
  }, [logout, router]);

  const updateMember = useCallback(
    async ({ memberId, name, email, role: nextRole, active }) => {
      setSaveErr("");
      setSaveOk("");
      setInviteErr("");
      setInviteOk("");

      if (!canManageMembers) throw new Error("Only Organization/Admin can update members.");

      const res = await fetch("/api/org/members/update", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberId, name, email, role: nextRole, active }),
      });

      const data = await safeJson(res);
      if (!res.ok) throw new Error(data?.error || "Failed to update member.");

      setSaveOk("Saved.");
      setTimeout(() => setSaveOk(""), 2500);

      await refresh();
      return data;
    },
    [canManageMembers, refresh]
  );

  const deactivateMember = useCallback(
    async ({ memberId }) => {
      setSaveErr("");
      setSaveOk("");
      setInviteErr("");
      setInviteOk("");

      if (!canManageMembers) throw new Error("Only Organization/Admin can remove members.");

      const res = await fetch("/api/org/members/remove", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberId }),
      });

      const data = await safeJson(res);
      if (!res.ok) throw new Error(data?.error || "Failed to remove member.");

      setSaveOk("Member deactivated.");
      setTimeout(() => setSaveOk(""), 2500);

      await refresh();
      return data;
    },
    [canManageMembers, refresh]
  );

  /* ----------------------------- */
  /* Derived counts                */
  /* ----------------------------- */

  const counts = useMemo(() => {
    const list = Array.isArray(trainers) ? trainers : [];
    const admins = list.filter((t) => String(t?.Role || "").toLowerCase() === "admin").length;
    const coaches = list.filter((t) => String(t?.Role || "").toLowerCase() === "trainer").length;
    const inactive = list.filter((t) => !t?.Active).length;
    const total = list.length;
    return { total, admins, coaches, inactive };
  }, [trainers]);

  /* ----------------------------------------------------- */
  /* Render                                                */
  /* ----------------------------------------------------- */

  return (
    <div className="min-h-screen overflow-x-hidden bg-gradient-to-b from-gray-50 to-blue-50 text-gray-900 font-sans">
      <main className="max-w-7xl mx-auto px-4 pt-6 pb-[calc(env(safe-area-inset-bottom,0px)+24px)] sm:py-8 space-y-5 sm:space-y-6 overflow-x-hidden">
        <OrgTrainersHeader
          orgName={orgName}
          orgEmail={orgEmail}
          orgToken={orgToken}
          orgId={orgId}
          counts={counts}
          canManageMembers={canManageMembers}
          loading={loading}
          error={error}
          inviteErr={inviteErr}
          saveErr={saveErr}
          inviteOk={inviteOk}
          saveOk={saveOk}
          onRefresh={refresh}
          onLogout={onLogout}
          onBack={() => router.push("/org/dashboard")}
        />

        <div className="sm:hidden">
          <p className="text-[11px] font-semibold text-gray-500 px-1">Invite teammates and manage access</p>
        </div>

        <div className="grid lg:grid-cols-12 gap-4 sm:gap-6">
          <div className="lg:col-span-4">
            <div className="space-y-3">
              <div className="sm:hidden">
                <p className="text-xs font-semibold text-gray-700 px-1">Invite</p>
              </div>

              <InviteCard
                canManageMembers={canManageMembers}
                orgName={orgName}
                inviterName={inviterName}
                onInviteCreated={refresh}
                setInviteOk={setInviteOk}
                setInviteErr={setInviteErr}
              />
            </div>
          </div>

          <div className="lg:col-span-8">
            <div className="space-y-3">
              <div className="sm:hidden">
                <p className="text-xs font-semibold text-gray-700 px-1">Team</p>
                <p className="text-[11px] text-gray-500 px-1 mt-0.5">
                  Admins and trainers who can access org tools.
                </p>
              </div>

              <TeamTableCard
                title="Team"
                subtitle="Admins and trainers who can access org tools."
                hint="Tip: inactive members stay listed and can be reactivated via Edit."
                rows={trainers}
                loading={loading}
                canManage={canManageMembers}
                onEditSave={updateMember}
                onRemoveClick={openRemove}
              />
            </div>
          </div>
        </div>

        <RemoveMemberModal
          open={removeOpen}
          member={removeTarget}
          onClose={closeRemove}
          disabled={!canManageMembers}
          onConfirm={async () => {
            if (!removeTarget?.id) return;
            await deactivateMember({ memberId: removeTarget.id });
            closeRemove();
          }}
        />
      </main>
    </div>
  );
}