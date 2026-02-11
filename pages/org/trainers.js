// pages/org/trainers.js
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthContext } from "@/hooks/useAuth";

/**
 * Components (your modular structure)
 */
import OrgTrainersHeader from "@/components/org/trainers/OrgTrainersHeader";
import InviteCard from "@/components/org/trainers/InviteCard";
import TeamTableCard from "@/components/org/trainers/TeamTableCard";
import TrainersTable from "@/components/org/trainers/TrainersTable";
import RemoveMemberModal from "@/components/org/trainers/RemoveMemberModal";

/* ----------------------------------------------------- */
/* Helpers                                               */
/* ----------------------------------------------------- */

async function safeJson(res) {
  try {
    return await res.json();
  } catch {
    return {};
  }
}

/* ----------------------------------------------------- */
/* Page                                                  */
/* ----------------------------------------------------- */

export default function TrainersPage() {
  const router = useRouter();
  const { user, logout } = useAuthContext();

  // Normalize role for gating + UI
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
  const orgToken = useMemo(() => String(user?.Token || user?.token || user?.["Organization Token"] || "").trim(), [user]);
  const orgId = useMemo(() => String(user?.orgId || user?.OrgId || "").trim(), [user]);

  // Optional: show who sent the invite (defaults nicely)
  const inviterName = useMemo(() => {
    return String(user?.Name || user?.name || orgName || "Organization").trim();
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
  /* Page-owned UI state           */
  /* ----------------------------- */

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [trainers, setTrainers] = useState([]);

  // Header banner states
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

  /* ----------------------------- */
  /* Data fetch                    */
  /* ----------------------------- */

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
  /* Counts                        */
  /* ----------------------------- */

  const counts = useMemo(() => {
    const list = Array.isArray(trainers) ? trainers : [];
    const admins = list.filter((t) => String(t?.Role || "").toLowerCase() === "admin").length;
    const coaches = list.filter((t) => String(t?.Role || "").toLowerCase() === "trainer").length;
    const inactive = list.filter((t) => !t?.Active).length;
    return { total: list.length, admins, coaches, inactive };
  }, [trainers]);

  /* ----------------------------------------------------- */
  /* Render                                                 */
  /* ----------------------------------------------------- */

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-blue-50 text-gray-900 font-sans">
      <main className="max-w-7xl mx-auto px-4 py-8 space-y-6">
        <OrgTrainersHeader
          orgName={orgName}
          orgEmail={orgEmail}
          orgToken={orgToken}
          orgId={orgId}
          role={role}
          canManageMembers={canManageMembers}
          counts={counts}
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

        <div className="grid lg:grid-cols-12 gap-6">
          {/* Left: Invite */}
          <div className="lg:col-span-4">
            <InviteCard
              canManageMembers={canManageMembers}
              orgName={orgName}
              inviterName={inviterName}
              onInviteCreated={refresh}
              setInviteOk={setInviteOk}
              setInviteErr={setInviteErr}
            />
          </div>

          {/* Right: Table */}
          <div className="lg:col-span-8">
            <TeamTableCard
              title="Team"
              subtitle="Admins and trainers who can access org tools."
              hint="Tip: inactive members stay listed and can be reactivated via Edit."
              rows={trainers} // in case TeamTableCard expects rows for header counts/search
            >
              <TrainersTable
                trainers={trainers}
                loading={loading}
                canManage={canManageMembers}
                onEditSave={updateMember}
                onRemoveClick={openRemove}
                setSaveErr={setSaveErr}
                setSaveOk={setSaveOk}
              />
            </TeamTableCard>
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
