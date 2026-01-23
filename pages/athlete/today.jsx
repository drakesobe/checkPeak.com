"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useAuthContext } from "@/hooks/useAuth";

export default function AthleteToday() {
  const { user, authReady } = useAuthContext();
  const [loading, setLoading] = useState(true);
  const [dailyWorkout, setDailyWorkout] = useState(null);
  const [items, setItems] = useState([]);
  const [err, setErr] = useState("");
  const [submittingId, setSubmittingId] = useState("");

  const load = async () => {
    setErr("");
    setLoading(true);
    try {
      const res = await fetch("/api/athlete/workouts/today", { credentials: "include" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Failed to load workout");
      setDailyWorkout(data.dailyWorkout);
      setItems(data.items || []);
    } catch (e) {
      setErr(e.message || "Failed to load");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authReady) return;
    if (!user) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authReady, user]);

  if (!authReady) return null;
  if (!user) return <div style={{ padding: 24 }}>Please log in.</div>;
  if (String(user.role || "").toLowerCase() !== "athlete") return <div style={{ padding: 24 }}>Not authorized.</div>;

  const submitCompletion = async (workoutItemId) => {
    // MVP: ask for an image URL; you can replace with real upload later
    const fileUrl = window.prompt("Paste a photo URL of your setup (MVP). Leave blank to mark complete without evidence.");
    setSubmittingId(workoutItemId);
    try {
      const res = await fetch("/api/athlete/workouts/completeItem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ workoutItemId, fileUrl: fileUrl || "" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Failed to submit");
      // refresh
      await load();
    } catch (e) {
      setErr(e.message || "Failed to submit");
    } finally {
      setSubmittingId("");
    }
  };

  return (
    <div style={{ padding: 24, maxWidth: 900, margin: "0 auto" }}>
      <motion.h1 initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} style={{ fontSize: 26, marginBottom: 10 }}>
        Today
      </motion.h1>

      {err ? <div style={{ background: "#2b1111", padding: 12, borderRadius: 12, marginBottom: 12 }}>{err}</div> : null}

      {loading ? (
        <div style={{ opacity: 0.8 }}>Loading…</div>
      ) : !dailyWorkout ? (
        <div style={{ opacity: 0.8 }}>No workout assigned for today.</div>
      ) : (
        <div style={{ background: "rgba(255,255,255,0.04)", borderRadius: 16, padding: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
            <div>
              <div style={{ fontSize: 18, fontWeight: 700 }}>{dailyWorkout.Title || "Daily Workout"}</div>
              <div style={{ opacity: 0.75, marginTop: 4 }}>{dailyWorkout.Date}</div>
            </div>
            <div style={{ opacity: 0.75 }}>Status: {dailyWorkout.Status}</div>
          </div>

          <div style={{ marginTop: 14 }}>
            {items.map((it) => (
              <div key={it.id} style={{ padding: 12, borderRadius: 14, background: "rgba(0,0,0,0.18)", marginBottom: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                  <div style={{ fontWeight: 700 }}>{it.ExerciseName}</div>
                  <div style={{ opacity: 0.75, fontSize: 12 }}>{it.EvidenceRequired}</div>
                </div>

                <div style={{ opacity: 0.85, marginTop: 6, fontSize: 14 }}>
                  {it.Sets ? `${it.Sets} sets` : ""}
                  {it.Reps ? ` • ${it.Reps} reps` : ""}
                  {it.Load ? ` • Load: ${it.Load}` : ""}
                  {it.RPE ? ` • RPE: ${it.RPE}` : ""}
                  {it.Rest ? ` • Rest: ${it.Rest}` : ""}
                </div>

                {it.Instructions ? <div style={{ marginTop: 8, opacity: 0.9 }}>{it.Instructions}</div> : null}

                {it.VideoURL ? (
                  <div style={{ marginTop: 8 }}>
                    <a href={it.VideoURL} target="_blank" rel="noreferrer" style={{ textDecoration: "underline" }}>
                      Watch demo video →
                    </a>
                  </div>
                ) : null}

                <div style={{ marginTop: 10 }}>
                  <button
                    onClick={() => submitCompletion(it.id)}
                    disabled={submittingId === it.id}
                    style={{ padding: "10px 12px", borderRadius: 12 }}
                  >
                    {submittingId === it.id ? "Submitting…" : "Upload setup photo / Complete"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
