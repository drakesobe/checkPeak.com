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
import { Lock, ArrowRight, LogOut } from "lucide-react";

async function safeJson(res) {
  try {
    return await res.json();
  } catch {
    return {};
  }
}

function fmtDate(v) {
  if (!v) return "—";
  try {
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) return String(v);
    return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  } catch {
    return String(v);
  }
}

function BillingGateScreen({ role, billing, error, onLogout, onGoAccount }) {
  const canManageBilling = role === "admin" || role === "organization";

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-blue-50 text-gray-900 font-sans">
      <main className="max-w-3xl mx-auto px-4 py-10">
        <div className="bg-white rounded-3xl shadow-md border border-blue-100 p-7">
          <div className="flex items-start gap-3">
            <div className="shrink-0 w-11 h-11 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center">
              <Lock className="w-5 h-5 text-[#46769B]" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold tracking-wide text-[#46769B]">CHECKPEAK</p>
              <h1 className="text-2xl font-extrabold text-gray-900 mt-1">Subscription required</h1>
              <p className="text-sm text-gray-600 mt-2">
                Your organization’s access is currently locked. Start a subscription to continue using the Review Queue.
              </p>
            </div>
          </div>

          {error ? (
            <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4">
              <p className="text-sm font-semibold text-red-700">{error}</p>
            </div>
          ) : (
            <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                <div className="text-xs font-semibold text-gray-600">Status</div>
                <div className="text-sm font-semibold text-gray-900 mt-1">
                  {billing?.statusRaw || billing?.status || "—"}
                </div>
              </div>
              <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                <div className="text-xs font-semibold text-gray-600">Trial ends</div>
                <div className="text-sm font-semibold text-gray-900 mt-1">{fmtDate(billing?.trialEnds)}</div>
              </div>
            </div>
          )}

          <div className="mt-6 flex flex-col sm:flex-row gap-2 sm:justify-end">
            {canManageBilling ? (
              <button
                type="button"
                onClick={onGoAccount}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2 rounded-2xl font-semibold bg-[#46769B] text-white hover:brightness-110 transition shadow-sm"
              >
                Manage Billing
                <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <div className="text-sm text-gray-600 py-2">
                Ask your Org Owner/Admin to update billing in <span className="font-semibold">Account → Billing</span>.
              </div>
            )}

            <button
              type="button"
              onClick={onLogout}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2 rounded-2xl font-semibold bg-white border border-gray-200 text-gray-800 hover:bg-gray-50 transition"
            >
              <LogOut className="w-4 h-4" />
              Log out
            </button>
          </div>

          <div className="mt-4 text-[11px] text-gray-500">
            Note: Billing IDs (Stripe Customer/Subscription) are never user-entered. They come from Stripe checkout +
            webhooks.
          </div>
        </div>
      </main>
    </div>
  );
}

export default function ReviewQueuePage() {
  const router = useRouter();
  const { user, logout } = useAuthContext();

  const { loading, error, items, setItems, refreshQueue, counts, fmtDate: rqFmtDate } = useReviewQueue();

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
  const canInitTrial = role === "organization" || role === "admin";

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

  // ---------------- Billing Gate State ----------------
  const [billingLoading, setBillingLoading] = useState(true);
  const [billingErr, setBillingErr] = useState("");
  const [billing, setBilling] = useState(null);

  const isPaidOk = Boolean(billing?.isPaidOk);

  // Guards
  useEffect(() => {
    if (!user) {
      router.push("/");
      return;
    }
    if (role && !isOrgSide) router.push("/dashboard");
  }, [user, role, isOrgSide, router]);

  // Billing gate: ensure trial + fetch status
  useEffect(() => {
    let mounted = true;

    async function run() {
      if (!user) return;
      if (!isOrgSide) return;

      setBillingLoading(true);
      setBillingErr("");

      try {
        // Owner/admin ensures trial exists (idempotent)
        if (canInitTrial) {
          await fetch("/api/org/billing/ensureTrial", {
            method: "POST",
            credentials: "include",
          }).catch(() => null);
        }

        const res = await fetch("/api/org/billing/status", {
          method: "GET",
          credentials: "include",
        });

        const json = await safeJson(res);
        if (!res.ok) throw new Error(json?.error || "Failed to load billing status.");

        if (mounted) setBilling(json?.billing || null);
      } catch (e) {
        if (mounted) setBillingErr(e?.message || "Failed to load billing status.");
      } finally {
        if (mounted) setBillingLoading(false);
      }
    }

    run();
    return () => {
      mounted = false;
    };
  }, [user, isOrgSide, canInitTrial]);

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

  // Initial load (ONLY if billing ok)
  useEffect(() => {
    if (!user || !isOrgSide) return;
    if (billingLoading) return;
    if (!isPaidOk) return;
    refreshQueue();
  }, [user, isOrgSide, billingLoading, isPaidOk, refreshQueue]);

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
          it?.coachNotes,
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

  // ---- Billing gate screens ----
  if (billingLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-blue-50 text-gray-900 font-sans">
        <main className="max-w-3xl mx-auto px-4 py-10">
          <div className="bg-white rounded-3xl shadow-md border border-blue-100 p-7">
            <p className="text-sm text-gray-600">Loading billing status…</p>
          </div>
        </main>
      </div>
    );
  }

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
              fmtDate={rqFmtDate}
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
