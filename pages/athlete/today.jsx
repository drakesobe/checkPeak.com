// /pages/athlete/today.js
"use client";

import { useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuthContext } from "@/hooks/useAuth";

import TodayHeader from "@/components/athlete-today/TodayHeader";
import DateStrip from "@/components/athlete-today/DateStrip";
import WorkoutCard from "@/components/athlete-today/WorkoutCard";
import CompleteItemModal from "@/components/athlete-today/CompleteItemModal";

// IMPORTANT: point to ui.jsx explicitly to avoid any path/alias weirdness
import { toISODateLocal, addDays } from "@/components/athlete-today/ui.jsx";

import { useAthleteToday } from "@/hooks/athlete-today/useAthleteToday";
import { useWorkoutCompletion } from "@/hooks/athlete-today/useWorkoutCompletion";

export default function AthleteToday() {
  const router = useRouter();
  const { user, authReady } = useAuthContext();

  const role = useMemo(() => {
    const raw = String(user?.role || user?.Role || "").trim().toLowerCase();
    if (!raw) return "";
    if (raw.includes("ath")) return "athlete";
    return raw;
  }, [user]);

  const isAthlete = role === "athlete";

  // Always call hooks (no conditional hooks)
  const {
    selectedDate,
    setSelectedDate,
    loading,
    dailyWorkout,
    items,
    err,
    setErr, // if you want to clear errors manually
    reload,
    dateStrip,
    progress,
  } = useAthleteToday({ authReady, user, isAthlete });

  const {
    modalOpen,
    activeItem,
    selectedFile,
    coachNote,
    submittingId,
    openModal,
    closeModal,
    setSelectedFile,
    setCoachNote,
    submitCompletion,
    quickComplete,
  } = useWorkoutCompletion({
    selectedDate,
    reload,
    setErr,
  });

  // Stable helpers
  const goPrev = useCallback(() => {
    setSelectedDate((d) => toISODateLocal(addDays(new Date(`${d}T12:00:00`), -1)));
  }, [setSelectedDate]);

  const goNext = useCallback(() => {
    setSelectedDate((d) => toISODateLocal(addDays(new Date(`${d}T12:00:00`), 1)));
  }, [setSelectedDate]);

  const refresh = useCallback(() => {
    reload(selectedDate);
  }, [reload, selectedDate]);

  // Load on auth + date changes
  useEffect(() => {
    if (!authReady) return;
    if (!user) return;
    if (!isAthlete) return;
    reload(selectedDate);
  }, [authReady, user, isAthlete, selectedDate, reload]);

  // Guards AFTER hooks (prevents "Rendered more hooks" issues)
  if (!authReady) return null;
  if (!user) return <div style={{ padding: 24 }}>Please log in.</div>;
  if (!isAthlete) return <div style={{ padding: 24 }}>Not authorized.</div>;

  const isSubmittingActiveItem = Boolean(submittingId && activeItem?.id === submittingId);

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-blue-50 text-gray-900 font-sans">
      <main className="max-w-5xl mx-auto px-4 py-8 space-y-6">
        <TodayHeader
          user={user}
          selectedDate={selectedDate}
          dailyWorkout={dailyWorkout}
          loading={loading}
          err={err}
          progress={progress}
          onRefresh={refresh}
          onBack={() => router.push("/dashboard")}
        />

        <DateStrip
          loading={loading}
          selectedDate={selectedDate}
          dateStrip={dateStrip}
          onPrev={goPrev}
          onNext={goNext}
          onSelectDate={setSelectedDate}
        />

        <WorkoutCard
          loading={loading}
          dailyWorkout={dailyWorkout}
          items={items}
          onUpload={openModal}
          onQuickComplete={quickComplete}
          submittingId={submittingId}
        />

        <CompleteItemModal
          open={modalOpen}
          item={activeItem}
          selectedFile={selectedFile}
          coachNote={coachNote}
          submitting={isSubmittingActiveItem}
          onClose={closeModal}
          onPickFile={setSelectedFile}
          onChangeNote={setCoachNote}
          onSubmit={() =>
            submitCompletion({
              workoutItemId: String(activeItem?.id || ""),
              evidenceRequired: String(activeItem?.EvidenceRequired || "").toLowerCase() === "true",
            })
          }
        />

        {/* Optional always-visible err block (in addition to header) */}
        {err ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4">
            <p className="text-sm text-red-700 font-semibold">{err}</p>
          </div>
        ) : null}
      </main>
    </div>
  );
}
