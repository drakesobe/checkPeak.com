// pages/org/review-queue.js
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { useAuthContext } from "@/hooks/useAuth";
import { useReviewQueue } from "@/hooks/org/useReviewQueue";

import ReviewQueueHeader from "@/components/org/reviewQueue/ReviewQueueHeader";
import ReviewQueueStats from "@/components/org/reviewQueue/ReviewQueueStats";
import ReviewQueueControls from "@/components/org/reviewQueue/ReviewQueueControls";
import ReviewQueueTable from "@/components/org/reviewQueue/ReviewQueueTable";
import ReviewQueueWorkflow from "@/components/org/reviewQueue/ReviewQueueWorkflow";
import ReviewQueueModal from "@/components/org/reviewQueue/ReviewQueueModal";
import ReviewQueueLightbox from "@/components/org/reviewQueue/ReviewQueueLightbox";

import BillingGateScreen from "@/components/org/reviewQueue/BillingGateScreen";
import BillingLoadingScreen from "@/components/org/reviewQueue/BillingLoadingScreen";

import { normalizeText } from "@/components/org/reviewQueue/utils";
import { safeJson, getRole } from "@/components/org/reviewQueue/reviewQueue.helpers";

import { useBillingGate } from "@/hooks/org/useBillingGate";
import { useReviewQueueFilters } from "@/hooks/org/useReviewQueueFilters";

/* ---------------- page ---------------- */

export default function ReviewQueuePage() {
  const router = useRouter();
  const { user, logout } = useAuthContext();

  const { loading, error, items, setItems, refreshQueue, counts, fmtDate: rqFmtDate } = useReviewQueue();

  const role = useMemo(() => getRole(user), [user]);
  const isOrgSide = role === "organization" || role === "admin" || role === "trainer";

  const orgName = useMemo(() => {
    const guess =
      user?.OrgName ||
      user?.["Organization Name"] ||
      user?.OrganizationName ||
      user?.organizationName ||
      user?.Organization ||
      (role === "organization" ? (user?.Name || user?.name) : "") ||
      "Organization";
    return String(guess || "Organization");
  }, [user, role]);

  const orgEmail = useMemo(() => String(user?.Email || user?.email || ""), [user]);
  const orgToken = useMemo(() => String(user?.Token || user?.token || user?.["Organization Token"] || "").trim(), [user]);
  const orgId = useMemo(() => String(user?.orgId || user?.OrgId || user?.org?.id || "").trim(), [user]);

  // Guards (auth + org-side)
  useEffect(() => {
    if (!user) {
      router.push("/");
      return;
    }
    if (role && !isOrgSide) router.push("/dashboard");
  }, [user, role, isOrgSide, router]);

  // Billing gate
  const { billingLoading, billingErr, billing, isPaidOk } = useBillingGate({ user, role, isOrgSide });

  // Filters + sort
  const { search, setSearch, filterMode, setFilterMode, sortMode, setSortMode, filtered } = useReviewQueueFilters(items);

  // Expanded rows
  const [expanded, setExpanded] = useState({});
  const toggleExpanded = useCallback((id) => {
    const key = String(id || "").trim();
    if (!key) return;
    setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  // Modal / lightbox
  const [modalOpen, setModalOpen] = useState(false);
  const [active, setActive] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveErr, setSaveErr] = useState("");
  const [lightboxUrl, setLightboxUrl] = useState("");

  const openModal = useCallback((item) => {
    setSaveErr("");
    setActive(item);
    setModalOpen(true);
  }, []);

  const closeModal = useCallback(() => {
    setModalOpen(false);
    setActive(null);
    setSaveErr("");
    setSaving(false);
    setLightboxUrl("");
  }, []);

  const onLogout = useCallback(async () => {
    try {
      await logout?.();
    } finally {
      router.push("/");
    }
  }, [logout, router]);

  // Initial load (ONLY if billing ok)
  useEffect(() => {
    if (!user || !isOrgSide) return;
    if (billingLoading) return;
    if (!isPaidOk) return;
    refreshQueue();
  }, [user, isOrgSide, billingLoading, isPaidOk, refreshQueue]);

  const headline = useMemo(() => {
    if (!counts.total) return "No items in queue.";
    if (counts.pending > 0) return `Pending reviews: ${counts.pending}`;
    if (counts.needsInfo > 0) return `Needs info: ${counts.needsInfo}`;
    return "Queue is clear.";
  }, [counts]);

  const updateReviewStatus = useCallback(
    async (id, reviewStatus, coachNotes = "") => {
      const rid = String(id || "").trim();
      if (!rid) return;

      setSaveErr("");
      setSaving(true);

      try {
        const res = await fetch("/api/org/reviewQueue/reviewQueueUpdate", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: rid, status: reviewStatus, coachNotes }),
        });

        const data = await safeJson(res);
        if (!res.ok) throw new Error(data?.error || "Failed to update review");

        setItems((prev) => {
          const list = Array.isArray(prev) ? [...prev] : [];
          const idx = list.findIndex((x) => String(x?.id) === rid);
          if (idx >= 0) {
            list[idx] = {
              ...list[idx],
              reviewStatus,
              coachNotes: coachNotes || list[idx]?.coachNotes || "",
            };
          }
          return list;
        });

        setActive((prev) =>
          prev && String(prev?.id) === rid
            ? { ...prev, reviewStatus, coachNotes: coachNotes || prev?.coachNotes || "" }
            : prev
        );

        closeModal();
      } catch (e) {
        setSaveErr(e?.message || "Failed to update.");
      } finally {
        setSaving(false);
      }
    },
    [setItems, closeModal]
  );

  // ---- Billing gate screens ----
  if (billingLoading) return <BillingLoadingScreen />;
  if (billingErr || !isPaidOk) {
    return (
      <BillingGateScreen
        role={role}
        billing={billing}
        error={billingErr}
        onLogout={onLogout}
        onGoAccount={() => router.push("/account")}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-blue-50 text-gray-900 font-sans">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-5 sm:space-y-6">
        <ReviewQueueHeader
          orgName={orgName}
          orgEmail={orgEmail}
          orgToken={orgToken}
          orgId={orgId}
          headline={headline}
          loading={loading}
          error={error}
          onBack={() => router.push("/org/dashboard")}
          onRefresh={refreshQueue}
          // onLogout removed from header per UX decision
        />

        {/* Stats */}
        <ReviewQueueStats counts={counts} />

        {/* Workbench (controls + table + tips all in one full-width card) */}
        <section className="bg-white rounded-2xl shadow-md border border-blue-100 p-4 sm:p-6">
          <ReviewQueueControls
            counts={counts}
            search={search}
            setSearch={setSearch}
            filterMode={filterMode}
            setFilterMode={setFilterMode}
            sortMode={sortMode}
            setSortMode={setSortMode}
          />

          <div className="mt-4">
            <ReviewQueueTable
              items={filtered}
              expanded={expanded}
              toggleExpanded={toggleExpanded}
              openModal={openModal}
              fmtDate={rqFmtDate}
              normalizeText={normalizeText}
              counts={counts}
            />
          </div>

          {/* ✅ Full-width ReviewTips (no max-width wrapper) */}
          <div className="mt-5">
            <ReviewQueueWorkflow onRefresh={refreshQueue} loading={loading} />
          </div>
        </section>

        {/* Modal / lightbox */}
        <ReviewQueueModal
          open={modalOpen}
          active={active}
          saving={saving}
          saveErr={saveErr}
          fmtDate={rqFmtDate}
          onClose={closeModal}
          onNeedsInfo={(note) => updateReviewStatus(active?.id, "needs_info", note)}
          onApprove={() => updateReviewStatus(active?.id, "approved")}
          onOpenLightbox={(url) => setLightboxUrl(url)}
        />

        <ReviewQueueLightbox url={lightboxUrl} onClose={() => setLightboxUrl("")} />
      </main>
    </div>
  );
}
