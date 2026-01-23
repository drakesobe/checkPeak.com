"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { motion } from "framer-motion";
import { useAuthContext } from "@/hooks/useAuth";

const blankItem = () => ({
  exerciseName: "",
  sets: "",
  reps: "",
  load: "",
  rpe: "",
  rest: "",
  instructions: "",
  videoUrl: "",
  evidenceRequired: "photo",
});

export default function NewDailyWorkout() {
  const router = useRouter();
  const { user, authReady } = useAuthContext();

  const athleteId = String(router.query.athleteId || "");
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const [date, setDate] = useState(today);
  const [title, setTitle] = useState("Today’s Workout");
  const [items, setItems] = useState([blankItem()]);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");

  const isOrgSide = useMemo(() => {
    const r = String(user?.role || "").toLowerCase();
    return ["organization", "trainer", "admin"].includes(r);
  }, [user]);

  useEffect(() => {
    setErr("");
    setOk("");
  }, [athleteId]);

  if (!authReady) return null;
  if (!user) return <div style={{ padding: 24 }}>Please log in.</div>;
  if (!isOrgSide) return <div style={{ padding: 24 }}>Not authorized.</div>;
  if (!athleteId) return <div style={{ padding: 24 }}>Missing athleteId.</div>;

  const updateItem = (idx, patch) => {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  };

  const addItem = () => setItems((prev) => [...prev, blankItem()]);
  const removeItem = (idx) => setItems((prev) => prev.filter((_, i) => i !== idx));

  const save = async () => {
    setErr("");
    setOk("");
    setSaving(true);
    try {
      const cleanedItems = items
        .map((it, i) => ({
          order: i + 1,
          ...it,
          exerciseName: String(it.exerciseName || "").trim(),
        }))
        .filter((it) => it.exerciseName);

      if (!cleanedItems.length) throw new Error("Add at least one exercise name.");

      const res = await fetch("/api/org/workouts/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          athleteId,
          date,
          title,
          items: cleanedItems,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Failed to create workout");

      setOk("Workout assigned!");
      setTimeout(() => router.push("/org/dashboard"), 650);
    } catch (e) {
      setErr(e.message || "Failed to save workout");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ padding: 24, maxWidth: 900, margin: "0 auto" }}>
      <motion.h1 initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} style={{ fontSize: 26, marginBottom: 10 }}>
        Build Daily Workout
      </motion.h1>

      {err ? <div style={{ background: "#2b1111", padding: 12, borderRadius: 12, marginBottom: 12 }}>{err}</div> : null}
      {ok ? <div style={{ background: "#0f2b16", padding: 12, borderRadius: 12, marginBottom: 12 }}>{ok}</div> : null}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 6 }}>Date</div>
          <input value={date} onChange={(e) => setDate(e.target.value)} type="date" style={{ width: "100%", padding: 10, borderRadius: 10 }} />
        </div>
        <div>
          <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 6 }}>Title</div>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Workout title" style={{ width: "100%", padding: 10, borderRadius: 10 }} />
        </div>
      </div>

      <div style={{ background: "rgba(255,255,255,0.04)", borderRadius: 16, padding: 14 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <h2 style={{ fontSize: 18, margin: 0 }}>Exercises</h2>
          <button onClick={addItem} style={{ padding: "8px 12px", borderRadius: 10 }}>
            + Add
          </button>
        </div>

        {items.map((it, idx) => (
          <div key={idx} style={{ borderTop: idx ? "1px solid rgba(255,255,255,0.08)" : "none", paddingTop: idx ? 12 : 0, marginTop: idx ? 12 : 0 }}>
            <div style={{ display: "flex", gap: 10, alignItems: "center", justifyContent: "space-between" }}>
              <input
                value={it.exerciseName}
                onChange={(e) => updateItem(idx, { exerciseName: e.target.value })}
                placeholder="ExerciseName (required)"
                style={{ width: "100%", padding: 10, borderRadius: 10 }}
              />
              <button onClick={() => removeItem(idx)} style={{ padding: "8px 10px", borderRadius: 10, opacity: 0.9 }}>
                Remove
              </button>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 8, marginTop: 10 }}>
              <input value={it.sets} onChange={(e) => updateItem(idx, { sets: e.target.value })} placeholder="Sets" style={{ padding: 10, borderRadius: 10 }} />
              <input value={it.reps} onChange={(e) => updateItem(idx, { reps: e.target.value })} placeholder="Reps" style={{ padding: 10, borderRadius: 10 }} />
              <input value={it.load} onChange={(e) => updateItem(idx, { load: e.target.value })} placeholder="Load" style={{ padding: 10, borderRadius: 10 }} />
              <input value={it.rpe} onChange={(e) => updateItem(idx, { rpe: e.target.value })} placeholder="RPE" style={{ padding: 10, borderRadius: 10 }} />
              <input value={it.rest} onChange={(e) => updateItem(idx, { rest: e.target.value })} placeholder="Rest" style={{ padding: 10, borderRadius: 10 }} />
            </div>

            <textarea
              value={it.instructions}
              onChange={(e) => updateItem(idx, { instructions: e.target.value })}
              placeholder="Instructions / cues"
              style={{ width: "100%", marginTop: 10, padding: 10, borderRadius: 10, minHeight: 80 }}
            />

            <div style={{ display: "grid", gridTemplateColumns: "1fr 220px", gap: 10, marginTop: 10 }}>
              <input value={it.videoUrl} onChange={(e) => updateItem(idx, { videoUrl: e.target.value })} placeholder="VideoURL (optional)" style={{ padding: 10, borderRadius: 10 }} />
              <select value={it.evidenceRequired} onChange={(e) => updateItem(idx, { evidenceRequired: e.target.value })} style={{ padding: 10, borderRadius: 10 }}>
                <option value="none">EvidenceRequired: none</option>
                <option value="photo">EvidenceRequired: photo</option>
                <option value="video">EvidenceRequired: video</option>
                <option value="photo_or_video">EvidenceRequired: photo_or_video</option>
              </select>
            </div>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 14, display: "flex", gap: 10 }}>
        <button onClick={save} disabled={saving} style={{ padding: "10px 14px", borderRadius: 12 }}>
          {saving ? "Saving…" : "Save & Assign"}
        </button>
        <button onClick={() => router.push("/org/dashboard")} style={{ padding: "10px 14px", borderRadius: 12, opacity: 0.9 }}>
          Cancel
        </button>
      </div>
    </div>
  );
}
