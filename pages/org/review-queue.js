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

import { normalizeText } from "@/components/org/reviewQueue/utils";

export default function ReviewQueuePage() {
  const router = useRouter();
  const { user, logout } = useAuthContext();

  const { loading, error, items, setItems, refreshQueue, counts, fmtDate } = useReviewQueue();

  const role = useMemo(() => {
    const r = String(user?.role || user?.Role || "").trim().toLowerCase();
    if (!r) return "";
    if (r === "organization") return "organization";
    if (r === "admin") return "admin";
    if (r === "trainer") return "trainer";
    if (r.includes("org")) return "organization";
    if (r.includes("admin")) return "admin";
    if (r.includes("train")) return "trainer";
    if (r.includes("ath")) return "athlete";
    return r;
  }, [user]);

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

  const orgToken = useMemo(
    () => String(user?.Token || user?.token || user?.["Organization Token"] || "").trim(),
    [user]
  );
  const orgId = useMemo(() => String(user?.orgId || user?.OrgId || user?.org?.id || "").trim(), [user]);

  // Guards
  useEffect(() => {
    if (!user) {
      router.push("/");
      return;
    }
    if (role && !isOrgSide) router.push("/dashboard");
  }, [user, role, isOrgSide, router]);

  // UI state
  const [search, setSearch] = useState("");
  const [filterMode, setFilterMode] = useState("pending"); // pending | needs_info | approved | all
  const [sortMode, setSortMode] = useState("newest"); // newest | oldest
  const [expanded, setExpanded] = useState({});

  // Modal / lightbox
  const [modalOpen, setModalOpen] = useState(false);
  const [active, setActive] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveErr, setSaveErr] = useState("");
  const [lightboxUrl, setLightboxUrl] = useState("");

  // Initial load
  useEffect(() => {
    if (!user || !isOrgSide) return;
    refreshQueue();
  }, [user, isOrgSide, refreshQueue]);

  const headline = useMemo(() => {
    if (!counts.total) return "No items in queue.";
    if (counts.pending > 0) return `Start here: ${counts.pending} item(s) pending review`;
    if (counts.needsInfo > 0) return `Follow up: ${counts.needsInfo} item(s) need info`;
    return "Queue is clear — keep it up.";
  }, [counts]);

  const filtered = useMemo(() => {
    const q = String(search || "").trim().toLowerCase();
    let list = Array.isArray(items) ? [...items] : [];

    if (q) {
      list = list.filter((it) => {
        const hay = [
          it?.title,
          it?.date,
          it?.status,
          it?.reviewStatus,
          it?.attachmentSummary,
          it?.athleteName,
          it?.athleteEmail,
          it?.coachNotes, // ✅ include notes in search too
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return hay.includes(q);
      });
    }

    const st = String(filterMode || "pending").toLowerCase();
    if (st !== "all") {
      list = list.filter((it) => String(it?.reviewStatus || "").toLowerCase() === st);
    }

    const byCreated = (a, b) => {
      const at = a?.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bt = b?.createdAt ? new Date(b.createdAt).getTime() : 0;
      return sortMode === "oldest" ? at - bt : bt - at;
    };

    list.sort(byCreated);
    return list;
  }, [items, search, filterMode, sortMode]);

  const toggleExpanded = useCallback((id) => {
    const key = String(id || "").trim();
    if (!key) return;
    setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

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
          // ✅ send coachNotes along when provided
          body: JSON.stringify({ id: rid, status: reviewStatus, coachNotes }),
        });

        const data = await res.json().catch(() => ({}));
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

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-blue-50 text-gray-900 font-sans">
      <main className="max-w-7xl mx-auto px-4 py-8 space-y-6">
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
          onLogout={onLogout}
        />

        <ReviewQueueStats counts={counts} />

        <div className="grid lg:grid-cols-12 gap-6">
          <section className="lg:col-span-8 bg-white rounded-2xl shadow-md border border-blue-100 p-6">
            <ReviewQueueControls
              counts={counts}
              search={search}
              setSearch={setSearch}
              filterMode={filterMode}
              setFilterMode={setFilterMode}
              sortMode={sortMode}
              setSortMode={setSortMode}
            />

            <ReviewQueueTable
              items={filtered}
              expanded={expanded}
              toggleExpanded={toggleExpanded}
              openModal={openModal}
              fmtDate={fmtDate}
              normalizeText={normalizeText}
              counts={counts}
            />
          </section>

          <ReviewQueueWorkflow onRefresh={refreshQueue} loading={loading} />
        </div>

        <ReviewQueueModal
          open={modalOpen}
          active={active}
          saving={saving}
          saveErr={saveErr}
          fmtDate={fmtDate}
          onClose={closeModal}
          // ✅ NEW: modal will pass note string to onNeedsInfo(note)
          onNeedsInfo={(note) => updateReviewStatus(active?.id, "needs_info", note)}
          onApprove={() => updateReviewStatus(active?.id, "approved")}
          onOpenLightbox={(url) => setLightboxUrl(url)}
        />

        <ReviewQueueLightbox url={lightboxUrl} onClose={() => setLightboxUrl("")} />
      </main>
    </div>
  );
}
