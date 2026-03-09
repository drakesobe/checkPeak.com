// pages/org/trainers.js
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthContext } from "@/hooks/useAuth";

import OrgTrainersHeader from "@/components/org/trainers/OrgTrainersHeader";
import TrainersTable     from "@/components/org/trainers/TrainersTable";
import InviteModal       from "@/components/org/trainers/InviteModal";
import EditMemberPanel   from "@/components/org/trainers/EditMemberPanel";
import RemoveMemberModal from "@/components/org/trainers/RemoveMemberModal";

async function safeJson(res) {
  try { return await res.json(); } catch { return {}; }
}

// Returns the first non-empty value found across multiple key candidates.
// Handles field name casing variations without silent undefined failures.
function resolveField(obj, keys, fallback = "") {
  for (const k of keys) {
    const v = obj?.[k];
    if (v !== undefined && v !== null && v !== "") return v;
  }
  return fallback;
}

// Logs a console error in dev if any required session fields are missing.
// Required: orgId, Token, role — all org API routes depend on these.
function validateOrgSession(user) {
  if (!user || typeof user !== "object") return;
  const REQUIRED = [
    { keys: ["orgId", "OrgId"],   label: "orgId",  why: "scopes all member queries"      },
    { keys: ["Token", "token"],   label: "Token",  why: "required by invite + list APIs" },
    { keys: ["role",  "Role"],    label: "role",   why: "controls canManage gates"        },
  ];
  const missing = REQUIRED.filter(
    ({ keys }) => !keys.some((k) => user[k] !== undefined && user[k] !== null && user[k] !== "")
  );
  if (missing.length > 0) {
    console.error(
      "[trainers] Session user is missing required fields — API calls will return 400:\n" +
      missing.map(({ label, why }) => `  ✗ ${label} (${why})`).join("\n") +
      "\n  Actual keys on user:", Object.keys(user)
    );
  }
}

// Normalize the role string coming from various Airtable field shapes
function parseRole(user) {
  const r = String(user?.role || user?.Role || "").trim().toLowerCase();
  if (!r) return "";
  if (r === "organization" || r.includes("org"))   return "organization";
  if (r === "admin"        || r.includes("admin")) return "admin";
  if (r === "trainer"      || r.includes("train")) return "trainer";
  if (r === "athlete"      || r.includes("ath"))   return "athlete";
  return r;
}

export default function TrainersPage() {
  const router = useRouter();
  const { user, logout } = useAuthContext();

  /* ── Auth + role ── */
  const role            = useMemo(() => parseRole(user), [user]);
  const isOrgSide       = role === "organization" || role === "admin" || role === "trainer";
  const canManageMembers = role === "organization" || role === "admin";

  useEffect(() => {
    if (!user)       { router.push("/");          return; }
    if (!isOrgSide)  { router.push("/dashboard"); return; }
  }, [user, isOrgSide, router]);

  /* ── Session validation — surfaces field casing mismatches immediately ── */
  useEffect(() => {
    if (!user) return;
    // validateOrgSession logs errors/warnings to the console if required fields
    // are missing or under unexpected key names. In dev this makes field casing
    // mismatches obvious immediately rather than silent 400s from the API.
    validateOrgSession(user, { logWarnings: true });
  }, [user]);

  /* ── Session display — resolveField checks multiple key casings ── */
  const orgName = useMemo(() => {
    const v = resolveField(user, [
      "OrgName", "orgName", "Organization Name", "OrganizationName", "organizationName", "Organization",
    ]) || (role === "organization" ? resolveField(user, ["Name", "name"]) : "") || "Organization";
    return String(v || "Organization");
  }, [user, role]);

  const orgEmail    = useMemo(() => resolveField(user, ["Email", "email"]),              [user]);
  const orgToken    = useMemo(() => resolveField(user, ["Token", "token"]).trim(),        [user]);
  const inviterName = useMemo(
    () => (resolveField(user, ["Name", "name"]) || orgName || "Team").trim(),
    [user, orgName]
  );

  /* ── Data ── */
  const [loading,  setLoading]  = useState(true);
  const [trainers, setTrainers] = useState([]);

  /* ── Banners ── */
  const [inviteErr, setInviteErr] = useState("");
  const [inviteOk,  setInviteOk]  = useState("");
  const [saveErr,   setSaveErr]   = useState("");
  const [saveOk,    setSaveOk]    = useState("");

  /* ── Filter + search (owned by page, passed to header) ── */
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");

  /* ── Panel state ── */
  const [inviteOpen, setInviteOpen] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [removeOpen,   setRemoveOpen]   = useState(false);
  const [removeTarget, setRemoveTarget] = useState(null);

  /* ── Refresh ── */
  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res  = await fetch("/api/org/members/list", { method: "GET", credentials: "include" });
      const data = await safeJson(res);
      if (!res.ok) throw new Error(data?.error || "Failed to load members.");

      const raw = Array.isArray(data?.trainers) ? data.trainers : [];
      setTrainers(raw.map((t) => ({
        ...t,
        id:        t?.id,
        Name:      t?.Name    ?? t?.name  ?? "",
        Email:     t?.Email   ?? t?.email ?? "",
        Role:      t?.Role    ?? t?.role  ?? "trainer",
        Active:    typeof t?.Active === "boolean" ? t.Active
                 : typeof t?.active === "boolean" ? t.active : false,
        createdAt: t?.createdAt || t?.CreatedAt || t?.createdTime || t?._createdTime || "",
      })));
    } catch (e) {
      setTrainers([]);
      setSaveErr(e?.message || "Failed to load members.");
      setTimeout(() => setSaveErr(""), 4000);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { if (user && isOrgSide) refresh(); }, [user, isOrgSide, refresh]);

  /* ── Counts for filter chips ── */
  const counts = useMemo(() => {
    const list = Array.isArray(trainers) ? trainers : [];
    return {
      total:    list.length,
      admins:   list.filter(t => String(t?.Role || "").toLowerCase() === "admin").length,
      coaches:  list.filter(t => String(t?.Role || "").toLowerCase() === "trainer").length,
      inactive: list.filter(t => !t?.Active).length,
    };
  }, [trainers]);

  /* ── Filtered + searched rows ── */
  const visibleRows = useMemo(() => {
    let list = Array.isArray(trainers) ? trainers : [];

    // Filter chip
    if (filter === "admin")    list = list.filter(t => String(t?.Role || "").toLowerCase() === "admin");
    if (filter === "trainer")  list = list.filter(t => String(t?.Role || "").toLowerCase() === "trainer");
    if (filter === "inactive") list = list.filter(t => !t?.Active);

    // Search
    const q = search.trim().toLowerCase();
    if (q) list = list.filter(t => {
      const hay = [t?.Name, t?.Email, t?.Role, t?.Active ? "active" : "inactive"]
        .filter(Boolean).join(" ").toLowerCase();
      return hay.includes(q);
    });

    return list;
  }, [trainers, filter, search]);

  /* ── Actions ── */
  const onLogout = useCallback(async () => {
    try { await logout?.(); } finally { router.push("/"); }
  }, [logout, router]);

  const updateMember = useCallback(async (payload) => {
    setSaveErr(""); setSaveOk("");
    if (!canManageMembers) throw new Error("Only Organization/Admin can update members.");
    const res  = await fetch("/api/org/members/update", {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await safeJson(res);
    if (!res.ok) throw new Error(data?.error || "Failed to update member.");
    setSaveOk("Changes saved."); setTimeout(() => setSaveOk(""), 2500);
    await refresh();
  }, [canManageMembers, refresh]);

  const deactivateMember = useCallback(async ({ memberId }) => {
    setSaveErr(""); setSaveOk("");
    if (!canManageMembers) throw new Error("Only Organization/Admin can remove members.");
    const res  = await fetch("/api/org/members/remove", {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ memberId }),
    });
    const data = await safeJson(res);
    if (!res.ok) throw new Error(data?.error || "Failed to remove member.");
    setSaveOk("Member deactivated."); setTimeout(() => setSaveOk(""), 2500);
    await refresh();
  }, [canManageMembers, refresh]);

  const bulkDeactivate = useCallback(async (ids) => {
    setSaveErr(""); setSaveOk("");
    if (!canManageMembers) return;
    try {
      await Promise.all(ids.map(id => deactivateMember({ memberId: id })));
      setSaveOk(`${ids.length} member${ids.length !== 1 ? "s" : ""} deactivated.`);
      setTimeout(() => setSaveOk(""), 3000);
    } catch (e) {
      setSaveErr(e?.message || "Bulk deactivate failed.");
      setTimeout(() => setSaveErr(""), 4000);
    }
  }, [canManageMembers, deactivateMember]);

  /* ─────────────────────────────────────────────────────────
     Render
  ───────────────────────────────────────────────────────── */
  return (
    <div className="min-h-screen" style={{ backgroundColor: "#F4F7FB" }}>
      <main className="max-w-7xl mx-auto px-4 sm:px-8 pt-6 pb-12 space-y-5">

        {/* Header: title, filter chips, search, actions */}
        <OrgTrainersHeader
          orgName={orgName}
          orgEmail={orgEmail}
          orgToken={orgToken}
          counts={counts}
          canManageMembers={canManageMembers}
          loading={loading}
          filter={filter}
          onFilterChange={setFilter}
          search={search}
          onSearchChange={setSearch}
          onBack={() => router.push("/org/dashboard")}
          onRefresh={refresh}
          onLogout={onLogout}
          onInvite={() => setInviteOpen(true)}
          inviteErr={inviteErr}
          saveErr={saveErr}
          inviteOk={inviteOk}
          saveOk={saveOk}
        />

        {/* Full-width team table */}
        <TrainersTable
          rows={visibleRows}
          loading={loading}
          canManage={canManageMembers}
          hasSearch={search.length > 0 || filter !== "all"}
          onEdit={(member) => setEditTarget(member)}
          onRemove={(member) => { setRemoveTarget(member); setRemoveOpen(true); }}
          onInvite={() => setInviteOpen(true)}
          onBulkDeactivate={bulkDeactivate}
        />

      </main>

      {/* ── Panels + modals ── */}

      <InviteModal
        open={inviteOpen}
        orgName={orgName}
        inviterName={inviterName}
        onInviteCreated={() => { refresh(); setInviteOk("Member invited."); setTimeout(() => setInviteOk(""), 2500); }}
        onClose={() => setInviteOpen(false)}
      />

      <EditMemberPanel
        open={Boolean(editTarget)}
        member={editTarget}
        onClose={() => setEditTarget(null)}
        onSave={async (payload) => {
          await updateMember(payload);
          setEditTarget(null);
        }}
      />

      <RemoveMemberModal
        open={removeOpen}
        member={removeTarget}
        canManage={canManageMembers}
        onClose={() => { setRemoveOpen(false); setRemoveTarget(null); }}
        onConfirm={async (m) => {
          const id = m?.id || removeTarget?.id;
          if (!id) return;
          await deactivateMember({ memberId: id });
          setRemoveOpen(false);
          setRemoveTarget(null);
        }}
      />
    </div>
  );
}