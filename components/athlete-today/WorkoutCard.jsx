// components/athlete-today/WorkoutCard.jsx
"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, ChevronDown, ChevronUp, AlertCircle } from "lucide-react";

const C = {
  card:        "#060810",
  cardBorder:  "#1E1E1E",
  cardSurface: "#161616",
  cardLine:    "#282828",
  white:       "#FFFFFF",
  dim:         "rgba(255,255,255,0.35)",
  muted:       "rgba(255,255,255,0.18)",
  accent:      "#4FABFF",
  green:       "#00C851",
  greenDim:    "rgba(0,200,81,0.15)",
};

const GROUP_COLORS = [
  { accent: "#4FABFF", bg: "rgba(79,171,255,0.08)",  border: "rgba(79,171,255,0.2)"  },
  { accent: "#9B5DE5", bg: "rgba(155,93,229,0.08)", border: "rgba(155,93,229,0.2)" },
  { accent: "#FF6B2B", bg: "rgba(255,107,43,0.08)", border: "rgba(255,107,43,0.2)" },
  { accent: "#00C9A7", bg: "rgba(0,201,167,0.08)",  border: "rgba(0,201,167,0.2)"  },
  { accent: "#F59E0B", bg: "rgba(245,158,11,0.08)", border: "rgba(245,158,11,0.2)" },
];
const GROUP_LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

function buildGroupMeta(exercises) {
  const meta = {};
  let idx = 0;
  exercises.forEach(s => {
    const gid = s?.groupId || s?.item?.groupId;
    if (gid && !meta[gid]) {
      meta[gid] = {
        label: GROUP_LETTERS[idx % 26],
        color: GROUP_COLORS[idx % GROUP_COLORS.length],
        count: 0,
      };
      idx++;
    }
    if (gid) meta[gid].count++;
  });
  Object.values(meta).forEach(m => {
    m.type = m.count >= 3 ? "Circuit" : "Superset";
  });
  return meta;
}

function buildSegments(exercises, groupMeta) {
  const segs = [];
  let i = 0;
  while (i < exercises.length) {
    const ex = exercises[i];
    const gid = ex?.groupId || ex?.item?.groupId;
    if (gid && groupMeta[gid]) {
      const members = [ex];
      let j = i + 1;
      while (j < exercises.length) {
        const nextGid = exercises[j]?.groupId || exercises[j]?.item?.groupId;
        if (nextGid === gid) { members.push(exercises[j]); j++; }
        else break;
      }
      segs.push({ type: "group", groupId: gid, members });
      i = j;
    } else {
      segs.push({ type: "single", sub: ex });
      i++;
    }
  }
  return segs;
}

function haptic(ms = 10) { try { navigator.vibrate?.(ms); } catch {} }

function isDone(optimisticStatus, itemStatus) {
  const s = String(optimisticStatus || itemStatus || "").toLowerCase().trim();
  return s === "completed" || s === "pending_review" || s === "pending review" || s === "approved";
}

function parseMeta(meta) {
  if (!meta) return {};
  const parts = meta.split(" · ");
  const sets   = parts.find(p => p.includes("set"))?.replace(" sets","").replace(" set","") || null;
  const reps   = parts.find(p => p.includes("rep"))?.replace(" reps","").replace(" rep","") || null;
  const weight = parts.find(p => !p.includes("set") && !p.includes("rep") && !p.includes("rest") && p.length > 0 && parts.indexOf(p) === 2) || null;
  const rest   = parts.find(p => p.includes("rest"))?.replace(" rest","") || null;
  return { sets, reps, weight, rest };
}

function ExerciseRow({ sub, optimisticStatusById, onTap, isReadOnly, isLast, groupAccent }) {
  const done     = isDone(optimisticStatusById?.[sub.id], sub.item?.Status);
  const prevDone = useRef(done);
  const [flash,  setFlash] = useState(false);
  const { sets, reps, weight } = parseMeta(sub.meta);

  useEffect(() => {
    if (!prevDone.current && done) {
      haptic(10);
      setFlash(true);
      const t = setTimeout(() => setFlash(false), 600);
      prevDone.current = true;
      return () => clearTimeout(t);
    }
    if (!done) prevDone.current = false;
  }, [done]);

  return (
    <div
      onClick={() => !isReadOnly && onTap(sub)}
      style={{
        display:       "flex",
        alignItems:    "center",
        gap:           16,
        padding:       "13px 24px",
        borderBottom:  isLast ? "none" : `1px solid ${C.cardLine}`,
        cursor:        isReadOnly ? "default" : "pointer",
        background:    flash ? "rgba(0,200,81,0.06)" : "transparent",
        transition:    "background 0.3s",
        userSelect:    "none",
      }}
    >
      <div style={{
        width:          22,
        height:         22,
        borderRadius:   "50%",
        flexShrink:     0,
        border:         `1.5px solid ${done ? C.green : "rgba(255,255,255,0.2)"}`,
        background:     done ? C.greenDim : "transparent",
        display:        "flex",
        alignItems:     "center",
        justifyContent: "center",
        transition:     "all 0.25s ease",
      }}>
        {done && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 500, damping: 25 }}
          >
            <Check size={11} color={C.green} strokeWidth={3} />
          </motion.div>
        )}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize:       14,
          fontWeight:     done ? 400 : 600,
          color:          done ? C.dim : C.white,
          letterSpacing:  "-0.01em",
          overflow:       "hidden",
          textOverflow:   "ellipsis",
          whiteSpace:     "nowrap",
          textDecoration: done ? "line-through" : "none",
          textDecorationColor: "rgba(255,255,255,0.2)",
          transition:     "all 0.2s",
        }}>
          {sub.title}
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
        {sets && reps && (
          <span style={{
            fontSize:      12,
            fontWeight:    700,
            color:         done ? C.muted : "rgba(255,255,255,0.6)",
            letterSpacing: "0.02em",
            fontVariantNumeric: "tabular-nums",
          }}>
            {sets}×{reps}
          </span>
        )}
        {weight && (
          <span style={{
            fontSize:   11,
            fontWeight: 600,
            color:      done ? C.muted : (groupAccent || C.accent),
            background: done ? "rgba(255,255,255,0.04)" : (groupAccent ? groupAccent + "22" : "rgba(79,171,255,0.15)"),
            border:     `1px solid ${done ? "rgba(255,255,255,0.06)" : (groupAccent ? groupAccent + "45" : "rgba(79,171,255,0.3)")}`,
            borderRadius: 4,
            padding:    "2px 7px",
            transition: "all 0.2s",
          }}>
            {weight}
          </span>
        )}
        {sub.evidenceRequired && !done && (
          <AlertCircle size={13} color="rgba(255,165,0,0.6)" />
        )}
      </div>
    </div>
  );
}

function GroupBlock({ groupId, members, meta, optimisticStatusById, onTap, isReadOnly }) {
  const { label, color, type } = meta;

  const doneCount = members.filter(s =>
    isDone(optimisticStatusById?.[s.id], s.item?.Status)
  ).length;
  const allDone = doneCount >= members.length;

  return (
    <div style={{
      margin:       "4px 12px",
      border:       `1px solid ${allDone ? "rgba(0,200,81,0.25)" : color.border}`,
      borderLeft:   `3px solid ${allDone ? C.green : color.accent}`,
      borderRadius: 10,
      overflow:     "hidden",
      transition:   "border-color 0.3s",
    }}>
      <div style={{
        display:      "flex",
        alignItems:   "center",
        gap:          10,
        padding:      "8px 14px",
        background:   allDone ? "rgba(0,200,81,0.06)" : color.bg,
        borderBottom: `1px solid ${allDone ? "rgba(0,200,81,0.15)" : color.border}`,
        transition:   "background 0.3s",
      }}>
        <span style={{
          fontSize:      10,
          fontWeight:    800,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          padding:       "2px 9px",
          borderRadius:  5,
          background:    allDone ? "rgba(0,200,81,0.15)" : color.accent + "22",
          border:        `1px solid ${allDone ? "rgba(0,200,81,0.4)" : color.accent + "50"}`,
          color:         allDone ? C.green : color.accent,
          transition:    "all 0.3s",
        }}>
          {allDone ? "✓ " : ""}{type} {label}
        </span>
        <span style={{ fontSize: 11, color: "rgba(255,255,255,0.32)", fontWeight: 500, flex: 1 }}>
          {members.length} exercises · back to back
        </span>
        {doneCount > 0 && !allDone && (
          <span style={{ fontSize: 11, fontWeight: 800, color: color.accent }}>
            {doneCount}/{members.length}
          </span>
        )}
      </div>

      {members.map((sub, i) => (
        <ExerciseRow
          key={sub.id}
          sub={sub}
          optimisticStatusById={optimisticStatusById}
          onTap={onTap}
          isReadOnly={isReadOnly}
          isLast={i === members.length - 1}
          groupAccent={color.accent}
        />
      ))}
    </div>
  );
}

export default function WorkoutCard({
  dailyWorkout,
  exercises,
  optimisticStatusById,
  onExerciseTap,
  loading,
  isReadOnly,
  selectedDate,
}) {
  const [showAll, setShowAll] = useState(false);

  const groupMeta = useMemo(() => buildGroupMeta(exercises || []), [exercises]);
  const segments  = useMemo(() => buildSegments(exercises || [], groupMeta), [exercises, groupMeta]);

  const groupAccents = useMemo(() => Object.values(groupMeta).map(m => m.color.accent), [groupMeta]);
  const accentBar = groupAccents.length > 1
    ? `linear-gradient(90deg, ${groupAccents.join(", ")})`
    : groupAccents.length === 1
      ? groupAccents[0]
      : C.accent;

  const PREVIEW_SEGS = 2;
  const hasMore      = segments.length > PREVIEW_SEGS;
  const visibleSegs  = showAll ? segments : segments.slice(0, PREVIEW_SEGS);
  const hiddenCount  = exercises
    ? exercises.length - visibleSegs.flatMap(s => s.type === "group" ? s.members : [s.sub]).length
    : 0;

  if (loading && !dailyWorkout) {
    return (
      <div style={{ background: C.card, margin: "0 0 2px", padding: "28px 24px" }}>
        <div style={{ height: 12, width: 80, background: "#222", borderRadius: 3, marginBottom: 16 }} />
        <div style={{ height: 28, width: "60%", background: "#1A1A1A", borderRadius: 3, marginBottom: 24 }} />
        {[1,2,3].map(i => (
          <div key={i} style={{ height: 44, background: "#161616", borderRadius: 2, marginBottom: 1 }} />
        ))}
      </div>
    );
  }

  if (!dailyWorkout) return null;

  const doneCount  = (exercises || []).filter(s => isDone(optimisticStatusById?.[s.id], s.item?.Status)).length;
  const totalCount = (exercises || []).length;
  const allDone    = totalCount > 0 && doneCount >= totalCount;
  const pct        = totalCount > 0 ? (doneCount / totalCount) * 100 : 0;

  return (
    <div style={{ background: C.card, marginBottom: 2 }}>

      <div style={{ height: 3, background: accentBar }} />

      <div style={{ padding: "20px 24px 0" }}>

        <div style={{
          display:        "flex",
          alignItems:     "center",
          justifyContent: "space-between",
          marginBottom:   14,
        }}>
          <span style={{
            fontSize:      9,
            fontWeight:    800,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            color:         allDone ? C.green : C.accent,
            transition:    "color 0.4s",
          }}>
            {allDone ? "✓ Training complete" : "Training"}
          </span>
          <span style={{
            fontSize:      9,
            fontWeight:    600,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color:         C.dim,
          }}>
            {new Date(`${selectedDate}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" }).toUpperCase()}
          </span>
        </div>

        <div style={{
          fontSize:      28,
          fontWeight:    800,
          color:         allDone ? "rgba(255,255,255,0.4)" : C.white,
          letterSpacing: "-0.03em",
          lineHeight:    1.1,
          marginBottom:  16,
          transition:    "color 0.5s",
        }}>
          {dailyWorkout.Title || "Team Workout"}
        </div>

        {Object.keys(groupMeta).length > 0 && (
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 16 }}>
            {Object.values(groupMeta).map(m => (
              <span key={m.label} style={{
                fontSize:      9,
                fontWeight:    800,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                padding:       "2px 8px",
                borderRadius:  4,
                background:    m.color.accent + "18",
                border:        `1px solid ${m.color.accent + "40"}`,
                color:         m.color.accent,
              }}>
                {m.type} {m.label}
              </span>
            ))}
          </div>
        )}

        <div style={{ marginBottom: 20 }}>
          <div style={{
            height:       2,
            background:   "#252525",
            borderRadius: 1,
            overflow:     "hidden",
            marginBottom: 8,
          }}>
            <motion.div
              style={{ height: "100%", borderRadius: 1, background: allDone ? C.green : C.accent }}
              animate={{ width: `${pct}%` }}
              transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1] }}
            />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <span style={{ fontSize: 11, color: C.dim, fontWeight: 500 }}>
              {doneCount} of {totalCount} complete
            </span>
            <span style={{ fontSize: 11, fontWeight: 800, color: allDone ? C.green : C.accent, letterSpacing: "0.05em" }}>
              {Math.round(pct)}%
            </span>
          </div>
        </div>
      </div>

      <div style={{ height: 1, background: C.cardLine, margin: "0 24px" }} />

      <div style={{ paddingTop: 4 }}>
        {visibleSegs.map((seg, si) => {
          if (seg.type === "group") {
            return (
              <GroupBlock
                key={seg.groupId}
                groupId={seg.groupId}
                members={seg.members}
                meta={groupMeta[seg.groupId]}
                optimisticStatusById={optimisticStatusById}
                onTap={onExerciseTap}
                isReadOnly={isReadOnly}
              />
            );
          }
          return (
            <ExerciseRow
              key={seg.sub.id}
              sub={seg.sub}
              optimisticStatusById={optimisticStatusById}
              onTap={onExerciseTap}
              isReadOnly={isReadOnly}
              isLast={si === visibleSegs.length - 1 && !hasMore}
            />
          );
        })}
      </div>

      {hasMore && (
        <div
          onClick={() => setShowAll(v => !v)}
          style={{
            display:        "flex",
            alignItems:     "center",
            justifyContent: "center",
            gap:            6,
            padding:        "13px 24px",
            cursor:         "pointer",
            borderTop:      `1px solid ${C.cardLine}`,
            color:          C.dim,
            fontSize:       12,
            fontWeight:     600,
            letterSpacing:  "0.05em",
          }}
        >
          {showAll ? (
            <><ChevronUp size={13} /> Show less</>
          ) : (
            <><ChevronDown size={13} /> {hiddenCount} more exercises</>
          )}
        </div>
      )}

      {allDone && (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          style={{
            display:        "flex",
            alignItems:     "center",
            gap:            10,
            padding:        "16px 24px",
            borderTop:      `1px solid ${C.cardLine}`,
            background:     "rgba(0,200,81,0.05)",
          }}
        >
          <div style={{
            width:          28,
            height:         28,
            borderRadius:   "50%",
            background:     C.greenDim,
            border:         `1px solid rgba(0,200,81,0.3)`,
            display:        "flex",
            alignItems:     "center",
            justifyContent: "center",
          }}>
            <Check size={13} color={C.green} strokeWidth={3} />
          </div>
          <span style={{ fontSize: 13, fontWeight: 600, color: C.green }}>
            Workout complete
          </span>
        </motion.div>
      )}
    </div>
  );
}