// pages/org/library.js
// Workout Library (coach): saved workouts athletes can pick on their own (an off-day leg session,
// extra conditioning) without asking a coach to assign it. Athletes see visible workouts in the app
// and add one to their Today; it then shows up in the Review Queue like any other workout.
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import { Plus, RefreshCw, Search, Pencil, Trash2, Eye, EyeOff, X, GripVertical, Library } from "lucide-react";
import { useAuthContext } from "@/hooks/useAuth";
import { PageHeader, APP } from "@/components/app/ui";
import { useBillingGate }   from "@/hooks/org/useBillingGate";
import BillingGateScreen    from "@/components/org/reviewQueue/BillingGateScreen";
import BillingLoadingScreen from "@/components/org/reviewQueue/BillingLoadingScreen";

const CATEGORIES = ["strength", "conditioning", "speed", "mobility", "recovery", "skill"];
const PROOF = [["none", "No proof"], ["photo", "Photo"], ["video", "Video"]];
const titleCase = (s) => String(s || "").replace(/\b\w/g, (c) => c.toUpperCase());

const STYLE = `
  .lib-wrap { max-width: 1120px; padding: 20px 16px 56px; display: grid; gap: 16px; }
  @media (min-width: 700px) { .lib-wrap { padding: 24px 28px 64px; } }
  .lib-grid { display: grid; gap: 14px; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); }
  .lib-card { background: #fff; border: 1px solid ${APP.line}; border-radius: 12px; padding: 16px 16px 12px; display: flex; flex-direction: column; gap: 10px; }
  .lib-card.is-hidden { background: ${APP.lineSoft}; }
  .lib-card h3 { margin: 0; font-size: 15px; font-weight: 700; color: ${APP.ink}; line-height: 1.3; }
  .lib-chip { display: inline-flex; align-items: center; height: 22px; padding: 0 8px; border-radius: 11px; font-size: 12px; font-weight: 600; background: ${APP.brandTint}; color: ${APP.brand}; }
  .lib-chip.muted { background: ${APP.lineSoft}; color: ${APP.muted}; }
  .lib-ex { margin: 0; padding: 0; list-style: none; font-size: 13px; color: ${APP.text}; display: grid; gap: 3px; }
  .lib-ex li { display: flex; justify-content: space-between; gap: 10px; }
  .lib-ex span:last-child { color: ${APP.muted}; white-space: nowrap; font-variant-numeric: tabular-nums; }
  .lib-foot { display: flex; align-items: center; justify-content: space-between; gap: 8px; border-top: 1px solid ${APP.lineSoft}; padding-top: 10px; margin-top: auto; }
  .lib-icon { display: inline-flex; align-items: center; justify-content: center; width: 32px; height: 32px; border-radius: 8px; border: 1px solid transparent; background: none; color: ${APP.muted}; cursor: pointer; }
  .lib-icon:hover { background: ${APP.lineSoft}; color: ${APP.ink}; }
  .lib-icon:focus-visible, .lib-toggle:focus-visible { outline: 2px solid ${APP.brand}; outline-offset: 2px; }
  .lib-toggle { display: inline-flex; align-items: center; gap: 6px; height: 30px; padding: 0 10px; border-radius: 8px; border: 1px solid ${APP.line}; background: #fff; font-size: 12.5px; font-weight: 600; color: ${APP.text}; cursor: pointer; }
  .lib-toggle.on { border-color: rgba(21,128,61,0.3); background: #F0FDF4; color: #15803D; }
  .lib-empty { background: #fff; border: 1px dashed #CBD5E1; border-radius: 12px; padding: 40px 20px; text-align: center; color: ${APP.muted}; font-size: 14px; }
  .lib-empty strong { display: block; color: ${APP.ink}; font-size: 16px; margin-bottom: 6px; }
  .lib-input { width: 100%; height: 36px; padding: 0 10px; border-radius: 8px; border: 1px solid ${APP.line}; font: 400 14px ${APP.font}; color: ${APP.ink}; background: #fff; }
  .lib-input:focus { outline: 2px solid ${APP.brand}; outline-offset: -1px; }
  textarea.lib-input { height: auto; min-height: 60px; padding: 8px 10px; resize: vertical; }
  .lib-label { display: grid; gap: 5px; font-size: 12.5px; font-weight: 600; color: ${APP.text}; }
  .lib-modal-bg { position: fixed; inset: 0; z-index: 80; background: rgba(15,23,42,0.45); display: flex; align-items: flex-start; justify-content: center; padding: 24px 12px; overflow-y: auto; }
  .lib-modal { width: 100%; max-width: 760px; background: #fff; border-radius: 14px; box-shadow: 0 24px 64px rgba(15,23,42,0.25); font-family: ${APP.font}; }
  .lib-row { display: grid; grid-template-columns: 18px minmax(0,2fr) 64px 80px 90px 96px 32px; gap: 8px; align-items: center; }
  @media (max-width: 680px) { .lib-row { grid-template-columns: 18px 1fr 1fr 32px; } .lib-row .opt { grid-column: 2 / -1; } }
`;

const emptyExercise = (i) => ({ Order: i + 1, ExerciseName: "", Sets: null, Reps: "", Weight: "", Rest: "", Instructions: "", VideoURL: "", EvidenceRequired: "none", groupId: null });

function Editor({ initial, onClose, onSaved }) {
  const [w, setW] = useState(() => ({
    id: initial?.id, name: initial?.name || "", category: initial?.category || "strength", sport: initial?.sport || "",
    description: initial?.description || "", athleteVisible: initial?.athleteVisible !== false, createdAt: initial?.createdAt,
    exercises: initial?.exercises?.length ? initial.exercises.map((e) => ({ ...e })) : [emptyExercise(0), emptyExercise(1), emptyExercise(2)],
  }));
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    const esc = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [onClose]);

  const setEx = (i, patch) => setW((s) => ({ ...s, exercises: s.exercises.map((e, j) => (j === i ? { ...e, ...patch } : e)) }));
  const save = async () => {
    const exercises = w.exercises.filter((e) => String(e.ExerciseName || "").trim()).map((e, i) => ({ ...e, Order: i + 1 }));
    if (!w.name.trim()) return setErr("Give the workout a name.");
    if (!exercises.length) return setErr("Add at least one exercise.");
    setSaving(true); setErr("");
    try {
      const res = await fetch("/api/org/templates/save", {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ template: { ...w, name: w.name.trim(), exercises } }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Could not save the workout.");
      onSaved();
    } catch (e) {
      setErr(e.message);
      setSaving(false);
    }
  };

  return (
    <div className="lib-modal-bg" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="lib-modal" role="dialog" aria-modal="true" aria-labelledby="lib-editor-title">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderBottom: `1px solid ${APP.line}` }}>
          <h2 id="lib-editor-title" style={{ margin: 0, fontSize: 17, color: APP.ink }}>{w.id ? "Edit workout" : "New library workout"}</h2>
          <button type="button" className="lib-icon" onClick={onClose} aria-label="Close"><X size={18} /></button>
        </div>
        <div style={{ padding: 20, display: "grid", gap: 14 }}>
          <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
            <label className="lib-label" style={{ gridColumn: "1 / -1" }}>Name
              <input className="lib-input" value={w.name} onChange={(e) => setW({ ...w, name: e.target.value })} placeholder="Lower body: strength" autoFocus />
            </label>
            <label className="lib-label">Type
              <select className="lib-input" value={w.category} onChange={(e) => setW({ ...w, category: e.target.value })}>
                {CATEGORIES.map((c) => <option key={c} value={c}>{titleCase(c)}</option>)}
              </select>
            </label>
            <label className="lib-label">Sport (optional)
              <input className="lib-input" value={w.sport} onChange={(e) => setW({ ...w, sport: e.target.value })} placeholder="All sports" />
            </label>
            <label className="lib-label" style={{ gridColumn: "1 / -1" }}>Notes for athletes (optional)
              <textarea className="lib-input" value={w.description} onChange={(e) => setW({ ...w, description: e.target.value })} placeholder="Warm up 10 minutes first. Good for an off day." />
            </label>
          </div>

          <div style={{ display: "grid", gap: 8 }}>
            <div className="lib-row" style={{ fontSize: 12, fontWeight: 700, color: APP.muted }} aria-hidden="true">
              <span /><span>Exercise</span><span>Sets</span><span>Reps</span><span>Weight</span><span>Proof</span><span />
            </div>
            {w.exercises.map((ex, i) => (
              <div key={i} className="lib-row">
                <GripVertical size={14} color={APP.faint} aria-hidden="true" />
                <input className="lib-input" aria-label={`Exercise ${i + 1}`} value={ex.ExerciseName} onChange={(e) => setEx(i, { ExerciseName: e.target.value })} placeholder={i === 0 ? "Back squat" : "Exercise"} />
                <input className="lib-input" aria-label="Sets" inputMode="numeric" value={ex.Sets ?? ""} onChange={(e) => setEx(i, { Sets: e.target.value.replace(/\D/g, "") || null })} />
                <input className="lib-input" aria-label="Reps" value={ex.Reps} onChange={(e) => setEx(i, { Reps: e.target.value })} placeholder="8" />
                <input className="lib-input opt" aria-label="Weight" value={ex.Weight} onChange={(e) => setEx(i, { Weight: e.target.value })} placeholder="70%" />
                <select className="lib-input opt" aria-label="Proof required" value={ex.EvidenceRequired || "none"} onChange={(e) => setEx(i, { EvidenceRequired: e.target.value })}>
                  {PROOF.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
                <button type="button" className="lib-icon" aria-label={`Remove exercise ${i + 1}`} onClick={() => setW((s) => ({ ...s, exercises: s.exercises.filter((_, j) => j !== i) }))}><Trash2 size={15} /></button>
              </div>
            ))}
            <button type="button" className="app-btn app-btn--ghost" style={{ justifySelf: "start" }} onClick={() => setW((s) => ({ ...s, exercises: [...s.exercises, emptyExercise(s.exercises.length)] }))}>
              <Plus size={15} aria-hidden="true" /> Add exercise
            </button>
          </div>

          <label style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 14, color: APP.text }}>
            <input type="checkbox" checked={w.athleteVisible} onChange={(e) => setW({ ...w, athleteVisible: e.target.checked })} style={{ width: 16, height: 16 }} />
            Athletes can find this and do it on their own
          </label>
          {err && <div role="alert" style={{ padding: "10px 12px", borderRadius: 8, background: APP.dangerTint, color: APP.danger, fontSize: 14 }}>{err}</div>}
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, padding: "14px 20px", borderTop: `1px solid ${APP.line}` }}>
          <button type="button" className="app-btn app-btn--secondary" onClick={onClose}>Cancel</button>
          <button type="button" className="app-btn app-btn--primary" onClick={save} disabled={saving}>{saving ? "Saving…" : "Save workout"}</button>
        </div>
      </div>
    </div>
  );
}

export default function WorkoutLibraryPage() {
  const router = useRouter();
  const { user, authReady, logout } = useAuthContext();
  const role = String(user?.role || user?.Role || "").toLowerCase();
  const isOrgSide = /org|admin|train|coach/.test(role);
  const { billingLoading, billingErr, billing, isPaidOk } = useBillingGate({ user, role, isOrgSide });

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [show, setShow] = useState("all");
  const [editing, setEditing] = useState(null); // null | {} (new) | workout
  const [busyId, setBusyId] = useState("");

  useEffect(() => { if (authReady && !user) router.replace("/"); }, [authReady, user, router]);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const res = await fetch("/api/org/library", { credentials: "include" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || "Could not load the workout library.");
      setData(json);
    } catch (e) { setError(e.message); } finally { setLoading(false); }
  }, []);
  useEffect(() => { if (isOrgSide) load(); }, [isOrgSide, load]);

  const workouts = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (data?.workouts ?? []).filter((w) =>
      (show === "all" || (show === "visible" ? w.athleteVisible : !w.athleteVisible)) &&
      (!q || `${w.name} ${w.sport} ${w.category} ${w.exercises.map((e) => e.name).join(" ")}`.toLowerCase().includes(q)));
  }, [data, query, show]);

  const setVisible = async (w, athleteVisible) => {
    setBusyId(w.id);
    try {
      const res = await fetch("/api/org/templates/save", {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ template: { ...w.raw, athleteVisible } }),
      });
      if (!res.ok) throw new Error();
      setData((d) => ({ ...d, workouts: d.workouts.map((x) => (x.id === w.id ? { ...x, athleteVisible, raw: { ...x.raw, athleteVisible } } : x)) }));
    } catch { setError("Couldn't update that workout. Try again."); } finally { setBusyId(""); }
  };

  const remove = async (w) => {
    if (!window.confirm(`Delete "${w.name}" from your library? Workouts athletes already did stay in their history.`)) return;
    setBusyId(w.id);
    try {
      const res = await fetch("/api/org/templates/delete", {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: w.id }),
      });
      if (!res.ok) throw new Error();
      setData((d) => ({ ...d, workouts: d.workouts.filter((x) => x.id !== w.id) }));
    } catch { setError("Couldn't delete that workout. Try again."); } finally { setBusyId(""); }
  };

  if (billingLoading) return <BillingLoadingScreen />;
  if (billingErr || !isPaidOk) {
    return <BillingGateScreen role={role} billing={billing} error={billingErr} onLogout={async () => { await logout?.(); router.push("/"); }} onGoAccount={() => router.push("/account")} />;
  }

  const all = data?.workouts ?? [];
  const visibleCount = all.filter((w) => w.athleteVisible).length;
  const totals = data?.totals;

  return (
    <div style={{ minHeight: "100vh", background: APP.canvas, fontFamily: APP.font }}>
      <Head><title>Workout Library | CheckPeak</title></Head>
      <style>{STYLE}</style>
      <PageHeader
        title="Workout Library"
        subtitle={data
          ? `${visibleCount} of ${all.length} workouts open to athletes${totals?.uses30d ? ` · done ${totals.uses30d} times by ${totals.athletes30d} athlete${totals.athletes30d === 1 ? "" : "s"} in the last 30 days` : ""}`
          : "Saved workouts your athletes can do on their own"}
        primaryAction={{ label: "New workout", icon: Plus, onClick: () => setEditing({}) }}
        secondaryActions={[{ label: "Refresh", icon: RefreshCw, onClick: load }]}
        toolbar={
          <>
            <div className="app-seg" role="group" aria-label="Show">
              {[["all", "All"], ["visible", "Open to athletes"], ["hidden", "Coaches only"]].map(([k, l]) => (
                <button key={k} type="button" aria-pressed={show === k} onClick={() => setShow(k)}>{l}</button>
              ))}
            </div>
            <label style={{ position: "relative", display: "flex", alignItems: "center", flex: "1 1 220px", maxWidth: 320 }}>
              <span className="sr-only">Search workouts</span>
              <Search size={15} aria-hidden="true" style={{ position: "absolute", left: 10, color: APP.faint }} />
              <input type="search" className="lib-input" style={{ paddingLeft: 32 }} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search workouts or exercises" />
            </label>
          </>
        }
      />

      <div className="lib-wrap">
        {error && <div role="alert" style={{ padding: "10px 14px", borderRadius: 10, background: APP.dangerTint, border: "1px solid #FECACA", color: APP.danger, fontSize: 14 }}>{error}</div>}

        {loading && !data ? (
          <div className="lib-grid">{[0, 1, 2].map((i) => <div key={i} className="lib-card" style={{ height: 180, opacity: 0.6 }} />)}</div>
        ) : all.length === 0 ? (
          <div className="lib-empty">
            <Library size={28} color={APP.faint} aria-hidden="true" style={{ marginBottom: 10 }} />
            <strong>Build your team's library</strong>
            Save workouts athletes can do on their own, like a leg day for an off day or extra conditioning.
            They pick one in the app and it lands on their Today, with proof going to your Review Queue.
            <div style={{ marginTop: 16 }}>
              <button type="button" className="app-btn app-btn--primary" onClick={() => setEditing({})}><Plus size={15} aria-hidden="true" /> Create the first workout</button>
            </div>
          </div>
        ) : workouts.length === 0 ? (
          <div className="lib-empty">No workouts match. Try another search or filter.</div>
        ) : (
          <div className="lib-grid">
            {workouts.map((w) => (
              <article key={w.id} className={`lib-card${w.athleteVisible ? "" : " is-hidden"}`} aria-busy={busyId === w.id}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                  <h3>{w.name}</h3>
                  <span style={{ fontSize: 12, color: APP.muted, whiteSpace: "nowrap" }}>{w.exerciseCount} exercise{w.exerciseCount === 1 ? "" : "s"}</span>
                </div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  <span className="lib-chip">{titleCase(w.category)}</span>
                  <span className="lib-chip muted">{w.sport ? titleCase(w.sport) : "All sports"}</span>
                </div>
                <ul className="lib-ex">
                  {w.exercises.slice(0, 4).map((e, i) => (
                    <li key={i}><span>{e.name}</span><span>{[e.sets && `${e.sets}×`, e.reps].filter(Boolean).join("") || ""}</span></li>
                  ))}
                  {w.exerciseCount > 4 && <li style={{ color: APP.muted }}>+{w.exerciseCount - 4} more</li>}
                </ul>
                <div style={{ fontSize: 12.5, color: APP.muted }}>
                  {w.uses30d ? `Done ${w.uses30d} time${w.uses30d === 1 ? "" : "s"} in the last 30 days` : "Not picked by athletes yet"}
                </div>
                <div className="lib-foot">
                  <button type="button" className={`lib-toggle${w.athleteVisible ? " on" : ""}`} disabled={busyId === w.id}
                    onClick={() => setVisible(w, !w.athleteVisible)} aria-pressed={w.athleteVisible}
                    title={w.athleteVisible ? "Athletes can find and do this. Click to make it coaches only." : "Only coaches see this. Click to open it to athletes."}>
                    {w.athleteVisible ? <Eye size={14} aria-hidden="true" /> : <EyeOff size={14} aria-hidden="true" />}
                    {w.athleteVisible ? "Open to athletes" : "Coaches only"}
                  </button>
                  <div style={{ display: "flex", gap: 2 }}>
                    <button type="button" className="lib-icon" aria-label={`Edit ${w.name}`} onClick={() => setEditing(w.raw)}><Pencil size={15} /></button>
                    <button type="button" className="lib-icon" aria-label={`Delete ${w.name}`} onClick={() => remove(w)}><Trash2 size={15} /></button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>

      {editing && (
        <Editor
          initial={editing.id ? editing : null}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load(); }}
        />
      )}
    </div>
  );
}
