// components/day-planner/DayPlannerPage.jsx
"use client";

import { useState, useMemo, useRef, useCallback } from "react";
import { useRouter } from "next/router";
import { useAuthContext } from "@/hooks/useAuth";

import { useDayPlanner, todayISO } from "@/hooks/athlete-today/useDayPlanner";
import { DateNav }          from "./DateNav";
import { FilterBar }        from "./FilterBar";
import { ProgressSummary }  from "./ProgressSummary";
import { DayBlock }         from "./DayBlock";
import { AddClassModal }    from "./AddClassModal";
import { IconPlus, IconChevronLeft, IconAlertCircle } from "./DayPlannerIcons";

/* ─── Empty state ────────────────────────────────────────────────────────── */

function EmptyState({ filter }) {
  const msgs = {
    all:       { icon: "📋", title: "Nothing scheduled yet",  sub: "Your day is clear. Add classes or check back when workouts are assigned." },
    workout:   { icon: "🏋️", title: "No workout today",        sub: "Your coach hasn't assigned a workout for this date." },
    nutrition: { icon: "🥗", title: "No nutrition plan",        sub: "You don't have a nutrition plan assigned yet." },
    class:     { icon: "📚", title: "No classes added",         sub: 'Tap "+ Add Class" to add your recurring class schedule.' },
  };
  const m = msgs[filter] || msgs.all;
  return (
    <div style={{
      textAlign: "center", padding: "48px 24px",
      background: "rgba(255,255,255,0.02)",
      border: "1px solid rgba(255,255,255,0.06)",
      borderRadius: 14,
    }}>
      <div style={{ fontSize: 36, marginBottom: 12 }}>{m.icon}</div>
      <div style={{ fontSize: 15, fontWeight: 700, color: "#D1D5DB", marginBottom: 6 }}>{m.title}</div>
      <div style={{ fontSize: 13, color: "#6B7280", lineHeight: 1.5 }}>{m.sub}</div>
    </div>
  );
}

/* ─── Error banner ───────────────────────────────────────────────────────── */

function ErrorBanner({ message }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 10,
      padding: "10px 14px", marginBottom: 12,
      background: "rgba(239,68,68,0.08)",
      border: "1px solid rgba(239,68,68,0.2)",
      borderRadius: 10, color: "#F87171", fontSize: 13,
    }}>
      <IconAlertCircle />
      <span>{message}</span>
    </div>
  );
}

/* ─── Skeleton loader ────────────────────────────────────────────────────── */

function Skeleton() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {[1, 2, 3, 4, 5].map(i => (
        <div key={i} style={{
          height: 64, borderRadius: 12,
          background: "linear-gradient(90deg, rgba(255,255,255,0.04) 25%, rgba(255,255,255,0.07) 50%, rgba(255,255,255,0.04) 75%)",
          backgroundSize: "200% 100%",
          animation: "shimmer 1.4s infinite",
          border: "1px solid rgba(255,255,255,0.05)",
        }} />
      ))}
    </div>
  );
}

/* ─── Page ───────────────────────────────────────────────────────────────── */

export function DayPlannerPage() {
  const router = useRouter();
  const { user, authReady } = useAuthContext();

  /* ── Role ─────────────────────────────────────────────────────────────── */
  const role      = String(user?.role || user?.Role || "").trim().toLowerCase();
  const isAthlete = role.includes("ath");

  /* ── Main hook ────────────────────────────────────────────────────────── */
  const {
    dateISO, setDateISO, shiftDate,
    orderedBlocks, saveOrder, counts,
    toggleDone, toggleMealDone, toggleHydrationDone,
    addClass, deleteClass,
    isLoading, workoutError, nutritionError,
  } = useDayPlanner({ authReady, user, isAthlete });

  /* ── Filter ───────────────────────────────────────────────────────────── */
  const [filter, setFilter] = useState("all");

  const visibleBlocks = useMemo(() => {
    if (filter === "all") return orderedBlocks;
    return orderedBlocks.filter(b => b.type === filter);
  }, [orderedBlocks, filter]);

  /* ── Add class modal ──────────────────────────────────────────────────── */
  const [showAddClass, setShowAddClass] = useState(false);

  /* ── Drag state ───────────────────────────────────────────────────────── */
  const dragIdx      = useRef(null);
  const [dragOverIdx, setDragOverIdx] = useState(null);
  const [draggingId,  setDraggingId]  = useState(null);

  const handleDragStart = useCallback((realIdx, id) => {
    dragIdx.current = realIdx;
    setDraggingId(id);
  }, []);

  const handleDragEnter = useCallback((realIdx) => {
    if (dragIdx.current === null || dragIdx.current === realIdx) return;
    setDragOverIdx(realIdx);
  }, []);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
  }, []);

  const handleDrop = useCallback((realIdx) => {
    if (dragIdx.current === null || dragIdx.current === realIdx) return;
    const next = [...orderedBlocks];
    const [moved] = next.splice(dragIdx.current, 1);
    next.splice(realIdx, 0, moved);
    saveOrder(next);
    dragIdx.current = null;
    setDragOverIdx(null);
    setDraggingId(null);
  }, [orderedBlocks, saveOrder]);

  const handleDragEnd = useCallback(() => {
    dragIdx.current = null;
    setDragOverIdx(null);
    setDraggingId(null);
  }, []);

  /* ─── Render ──────────────────────────────────────────────────────────── */

  return (
    <>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
          background: #0D1117;
          color: #F9FAFB;
          font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', sans-serif;
          -webkit-font-smoothing: antialiased;
        }
        input, select, textarea, button { font-family: inherit; }
        ::-webkit-scrollbar { width: 3px; height: 3px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 99px; }
        @keyframes shimmer {
          from { background-position: -200% 0; }
          to   { background-position:  200% 0; }
        }
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .block-enter { animation: slideUp 0.22s ease both; }
      `}</style>

      <div style={{ minHeight: "100vh", background: "#0D1117" }}>

        {/* ── Sticky header ─────────────────────────────────────────────── */}
        <div style={{
          position: "sticky", top: 0, zIndex: 100,
          background: "rgba(13,17,23,0.95)", backdropFilter: "blur(12px)",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          padding: "14px 20px",
        }}>
          <div style={{ maxWidth: 560, margin: "0 auto" }}>
            <div style={{
              display: "flex", alignItems: "center",
              justifyContent: "space-between",
            }}>
              {/* Back to Today */}
              <button
                onClick={() => router.push("/athlete/today")}
                style={{
                  display: "flex", alignItems: "center", gap: 6,
                  background: "none", border: "none", cursor: "pointer",
                  color: "#6B7280", fontSize: 13, fontWeight: 600, padding: "4px 0",
                }}
              >
                <IconChevronLeft />
                Today
              </button>

              <div style={{ fontSize: 16, fontWeight: 800, color: "#F9FAFB", letterSpacing: "-0.01em" }}>
                Day Planner
              </div>

              {/* Add Class */}
              <button
                onClick={() => setShowAddClass(true)}
                style={{
                  display: "flex", alignItems: "center", gap: 5,
                  padding: "6px 12px", borderRadius: 8,
                  background: "rgba(245,158,11,0.1)",
                  border: "1px solid rgba(245,158,11,0.25)",
                  color: "#F59E0B", fontSize: 12, fontWeight: 700,
                  cursor: "pointer", letterSpacing: "0.02em",
                  transition: "background 0.15s",
                }}
                onMouseEnter={e => e.currentTarget.style.background = "rgba(245,158,11,0.18)"}
                onMouseLeave={e => e.currentTarget.style.background = "rgba(245,158,11,0.1)"}
              >
                <IconPlus />
                Add Class
              </button>
            </div>
          </div>
        </div>

        {/* ── Main content ───────────────────────────────────────────────── */}
        <div style={{ maxWidth: 560, margin: "0 auto", padding: "20px 16px 80px" }}>

          {/* Date navigation */}
          <DateNav
            dateISO={dateISO}
            todayISO={todayISO()}
            onPrev={() => shiftDate(-1)}
            onNext={() => shiftDate(1)}
            onToday={() => setDateISO(todayISO())}
          />

          {/* Errors */}
          {workoutError   && <ErrorBanner message={`Workout: ${workoutError}`} />}
          {nutritionError && <ErrorBanner message={`Nutrition: ${nutritionError}`} />}

          {/* Loading */}
          {isLoading && <Skeleton />}

          {/* Content */}
          {!isLoading && (
            <>
              {/* Progress */}
              {orderedBlocks.length > 0 && (
                <ProgressSummary blocks={orderedBlocks} />
              )}

              {/* Filter */}
              <FilterBar active={filter} onChange={setFilter} counts={counts} />

              {/* Drag hint */}
              {orderedBlocks.length > 1 && filter === "all" && (
                <div style={{
                  fontSize: 11, color: "#374151", textAlign: "center",
                  marginBottom: 12, fontWeight: 500,
                }}>
                  ↕ Drag to reorder your day
                </div>
              )}

              {/* Blocks */}
              {visibleBlocks.length === 0 ? (
                <EmptyState filter={filter} />
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {visibleBlocks.map((block, i) => {
                    const realIdx = orderedBlocks.findIndex(b => b.id === block.id);
                    return (
                      <div
                        key={block.id}
                        className="block-enter"
                        style={{ animationDelay: `${Math.min(i * 0.03, 0.18)}s` }}
                      >
                        <DayBlock
                          block={block}
                          isDragging={draggingId === block.id}
                          isDragOver={dragOverIdx === realIdx}
                          onDragStart={() => handleDragStart(realIdx, block.id)}
                          onDragEnter={() => handleDragEnter(realIdx)}
                          onDragOver={handleDragOver}
                          onDragEnd={handleDragEnd}
                          onDrop={() => handleDrop(realIdx)}
                          onToggleDone={() => toggleDone(block.id)}
                          onToggleMealDone={block.type === "nutrition" ? () => toggleMealDone(block.mealId) : undefined}
                          onToggleHydrationDone={block.type === "nutrition" ? () => toggleHydrationDone(block.mealId) : undefined}
                          onDelete={block.type === "class" ? () => deleteClass(block.classRef || block.id) : undefined}
                        />
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Legend */}
              {orderedBlocks.length > 0 && (
                <div style={{
                  marginTop: 24,
                  display: "flex", gap: 16,
                  justifyContent: "center", flexWrap: "wrap",
                }}>
                  {[
                    { label: "Workout",   color: "#3B82F6" },
                    { label: "Nutrition", color: "#10B981" },
                    { label: "Class",     color: "#F59E0B" },
                    { label: "Done",      color: "#10B981" },
                  ].map(({ label, color }) => (
                    <div key={label} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                      <div style={{ width: 6, height: 6, borderRadius: "50%", background: color }} />
                      <span style={{ fontSize: 11, color: "#4B5563", fontWeight: 500 }}>{label}</span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Add Class modal */}
      {showAddClass && (
        <AddClassModal
          onSave={addClass}
          onClose={() => setShowAddClass(false)}
        />
      )}
    </>
  );
}