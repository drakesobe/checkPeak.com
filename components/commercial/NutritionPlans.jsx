// components/commercial/NutritionPlans.jsx
// Nutrition plan template manager for the commercial trainer dashboard.
"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, Pencil, Trash2, X, ChevronDown, ChevronUp, Eye, EyeOff } from "lucide-react";
import { DS } from "@/components/org/dashboard/DashboardUI";

const PHASES = ["Maintain", "Bulk", "Cut", "Recomp", "Performance"];
const TIERS  = ["Basic", "Premium", "Ultra"];

const TIER_STYLE = {
  Basic:   { bg: DS.safeBg,    color: DS.safe,    border: DS.safeBorder    },
  Premium: { bg: DS.cautionBg, color: DS.caution, border: DS.cautionBorder },
  Ultra:   { bg: DS.brandBg,   color: DS.brand,   border: DS.brandBorder   },
};

const MEALS = ["breakfast", "lunch", "afternoon", "dinner"];
const MEAL_LABELS = { breakfast: "Breakfast", lunch: "Lunch", afternoon: "Afternoon", dinner: "Dinner" };

function emptyPlanJson() {
  return {
    daily: { calories: "", protein: "", carbs: "", fat: "", hydrationOz: "" },
    mealBlocks: {
      breakfast:  { targets: { calories: "", protein: "", carbs: "", fat: "" }, diningHallRules: "", homeExamples: "" },
      lunch:      { targets: { calories: "", protein: "", carbs: "", fat: "" }, diningHallRules: "", homeExamples: "" },
      afternoon:  { targets: { calories: "", protein: "", carbs: "", fat: "" }, diningHallRules: "", homeExamples: "" },
      dinner:     { targets: { calories: "", protein: "", carbs: "", fat: "" }, diningHallRules: "", homeExamples: "" },
    },
    notes: { macros: "", supplements: "", freeformNotes: "" },
  };
}

function planJsonFromRecord(f) {
  const pj = f.planJson;
  if (!pj || typeof pj !== "object") return emptyPlanJson();
  const base = emptyPlanJson();
  return {
    daily: { ...base.daily, ...(pj.daily ?? {}) },
    mealBlocks: {
      breakfast:  { ...base.mealBlocks.breakfast,  ...(pj.mealBlocks?.breakfast  ?? {}), targets: { ...base.mealBlocks.breakfast.targets,  ...(pj.mealBlocks?.breakfast?.targets  ?? {}) } },
      lunch:      { ...base.mealBlocks.lunch,      ...(pj.mealBlocks?.lunch      ?? {}), targets: { ...base.mealBlocks.lunch.targets,      ...(pj.mealBlocks?.lunch?.targets      ?? {}) } },
      afternoon:  { ...base.mealBlocks.afternoon,  ...(pj.mealBlocks?.afternoon  ?? {}), targets: { ...base.mealBlocks.afternoon.targets,  ...(pj.mealBlocks?.afternoon?.targets  ?? {}) } },
      dinner:     { ...base.mealBlocks.dinner,     ...(pj.mealBlocks?.dinner     ?? {}), targets: { ...base.mealBlocks.dinner.targets,     ...(pj.mealBlocks?.dinner?.targets     ?? {}) } },
    },
    notes: { ...base.notes, ...(pj.notes ?? {}) },
  };
}

// ─── Field helpers ─────────────────────────────────────────────────────────────

function Field({ label, hint, children }) {
  return (
    <div className="space-y-1">
      <label className="block text-xs font-black uppercase tracking-wide" style={{ color: DS.labelText }}>
        {label}
        {hint && <span className="ml-2 font-normal normal-case tracking-normal" style={{ color: DS.dimText }}>{hint}</span>}
      </label>
      {children}
    </div>
  );
}

function Input({ value, onChange, placeholder, type = "text" }) {
  return (
    <input
      type={type}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full px-3 py-2 text-sm rounded-sm"
      style={{ backgroundColor: DS.pageBg, border: `1px solid ${DS.border}`, color: DS.bodyText, outline: "none" }}
      onFocus={e => { e.target.style.borderColor = DS.brandBorder; }}
      onBlur={e => { e.target.style.borderColor = DS.border; }}
    />
  );
}

function Textarea({ value, onChange, placeholder, rows = 3 }) {
  return (
    <textarea
      rows={rows}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full px-3 py-2 text-sm rounded-sm resize-y"
      style={{ backgroundColor: DS.pageBg, border: `1px solid ${DS.border}`, color: DS.bodyText, outline: "none" }}
      onFocus={e => { e.target.style.borderColor = DS.brandBorder; }}
      onBlur={e => { e.target.style.borderColor = DS.border; }}
    />
  );
}

function Select({ value, onChange, options }) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className="w-full px-3 py-2 text-sm rounded-sm"
      style={{ backgroundColor: DS.pageBg, border: `1px solid ${DS.border}`, color: DS.bodyText, outline: "none" }}
    >
      {options.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  );
}

// ─── Plan editor modal ─────────────────────────────────────────────────────────

function PlanEditor({ plan, onSave, onClose, saving }) {
  const f = plan?.fields ?? {};

  const [title,       setTitle]       = useState(f.title       ?? "");
  const [description, setDescription] = useState(f.description ?? "");
  const [tier,        setTier]        = useState(f.tier        ?? "Basic");
  const [phase,       setPhase]       = useState(f.phase       ?? "Maintain");
  const [prescription,setPrescription]= useState(f.prescription ?? "");
  const [pj,          setPj]          = useState(() => planJsonFromRecord(f));
  const [mealOpen,    setMealOpen]    = useState(false);

  function setDaily(key, val) {
    setPj(p => ({ ...p, daily: { ...p.daily, [key]: val } }));
  }
  function setMealTarget(meal, key, val) {
    setPj(p => ({ ...p, mealBlocks: { ...p.mealBlocks, [meal]: { ...p.mealBlocks[meal], targets: { ...p.mealBlocks[meal].targets, [key]: val } } } }));
  }
  function setMealNote(meal, key, val) {
    setPj(p => ({ ...p, mealBlocks: { ...p.mealBlocks, [meal]: { ...p.mealBlocks[meal], [key]: val } } }));
  }
  function setNote(key, val) {
    setPj(p => ({ ...p, notes: { ...p.notes, [key]: val } }));
  }

  function handleSave() {
    onSave({ title, description, tier, phase, prescription, planJson: pj });
  }

  return (
    <div className="fixed z-50 flex items-start justify-end" style={{ top: 100, bottom: 0, left: 0, right: 0, backgroundColor: "rgba(0,0,0,0.6)" }}>
      <div className="w-full max-w-2xl overflow-y-auto flex flex-col" style={{ height: "100%", backgroundColor: DS.cardBg, borderLeft: `1px solid ${DS.border}` }}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 shrink-0" style={{ borderBottom: `1px solid ${DS.border}` }}>
          <h2 className="text-sm font-black uppercase tracking-wide" style={{ color: DS.bodyText }}>
            {plan ? "Edit Plan" : "New Nutrition Plan"}
          </h2>
          <button onClick={onClose} type="button" className="p-1 rounded-sm transition" style={{ color: DS.dimText }}
            onMouseEnter={e => e.currentTarget.style.color = DS.bodyText}
            onMouseLeave={e => e.currentTarget.style.color = DS.dimText}>
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 p-5 space-y-5">

          {/* Basics */}
          <Field label="Title">
            <Input value={title} onChange={setTitle} placeholder="e.g. Lean Bulk - 2800 cal" />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Tier">
              <Select value={tier} onChange={setTier} options={TIERS} />
            </Field>
            <Field label="Phase">
              <Select value={phase} onChange={setPhase} options={PHASES} />
            </Field>
          </div>

          <Field label="Description" hint="optional">
            <Textarea value={description} onChange={setDescription} placeholder="Brief overview of who this plan is for..." rows={2} />
          </Field>

          {/* Daily targets */}
          <div>
            <p className="text-xs font-black uppercase tracking-wide mb-3" style={{ color: DS.labelText }}>Daily Targets</p>
            <div className="grid grid-cols-3 gap-2">
              {[["calories","Calories (kcal)"],["protein","Protein (g)"],["carbs","Carbs (g)"],["fat","Fat (g)"],["hydrationOz","Water (oz)"]].map(([k, lbl]) => (
                <Field key={k} label={lbl}>
                  <Input type="number" value={pj.daily[k]} onChange={v => setDaily(k, v)} placeholder="0" />
                </Field>
              ))}
            </div>
          </div>

          {/* Meal blocks */}
          <div style={{ border: `1px solid ${DS.border}`, borderRadius: 3 }}>
            <button type="button" onClick={() => setMealOpen(v => !v)}
              className="w-full flex items-center justify-between px-4 py-3 text-xs font-black uppercase tracking-wide"
              style={{ color: DS.labelText }}>
              Meal Blocks (optional)
              {mealOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
            {mealOpen && (
              <div className="px-4 pb-4 space-y-4" style={{ borderTop: `1px solid ${DS.border}` }}>
                {MEALS.map(meal => (
                  <div key={meal} className="pt-4">
                    <p className="text-xs font-bold uppercase tracking-wide mb-2" style={{ color: DS.bodyText }}>{MEAL_LABELS[meal]}</p>
                    <div className="grid grid-cols-4 gap-2 mb-2">
                      {["calories","protein","carbs","fat"].map(k => (
                        <Field key={k} label={k.charAt(0).toUpperCase() + k.slice(1)}>
                          <Input type="number" value={pj.mealBlocks[meal].targets[k]} onChange={v => setMealTarget(meal, k, v)} placeholder="0" />
                        </Field>
                      ))}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <Field label="Dining hall">
                        <Textarea rows={2} value={pj.mealBlocks[meal].diningHallRules} onChange={v => setMealNote(meal, "diningHallRules", v)} placeholder="Quick plays for dining hall..." />
                      </Field>
                      <Field label="Home examples">
                        <Textarea rows={2} value={pj.mealBlocks[meal].homeExamples} onChange={v => setMealNote(meal, "homeExamples", v)} placeholder="Meal ideas at home..." />
                      </Field>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Notes */}
          <div>
            <p className="text-xs font-black uppercase tracking-wide mb-3" style={{ color: DS.labelText }}>Coach Notes</p>
            <div className="space-y-3">
              <Field label="Macros note">
                <Input value={pj.notes.macros} onChange={v => setNote("macros", v)} placeholder="e.g. Prioritize hitting protein first..." />
              </Field>
              <Field label="Supplements">
                <Input value={pj.notes.supplements} onChange={v => setNote("supplements", v)} placeholder="e.g. Creatine 5g daily, whey post-workout..." />
              </Field>
              <Field label="Freeform notes">
                <Textarea rows={3} value={pj.notes.freeformNotes} onChange={v => setNote("freeformNotes", v)} placeholder="Any additional guidance..." />
              </Field>
            </div>
          </div>

          {/* Full plan text */}
          <Field label="Full plan text" hint="copyable summary for athletes">
            <Textarea rows={6} value={prescription} onChange={setPrescription} placeholder="Paste or type the full plan here. Athletes can copy this directly." />
          </Field>
        </div>

        {/* Footer */}
        <div className="shrink-0 flex items-center justify-end gap-3 px-5 py-4" style={{ borderTop: `1px solid ${DS.border}` }}>
          <button type="button" onClick={onClose} className="px-4 py-2 text-xs font-bold rounded-sm" style={{ border: `1px solid ${DS.border}`, color: DS.labelText }}>
            Cancel
          </button>
          <button type="button" onClick={handleSave} disabled={saving || !title.trim()}
            className="px-4 py-2 text-xs font-black uppercase tracking-wide rounded-sm transition"
            style={{ backgroundColor: saving || !title.trim() ? DS.border : DS.brand, color: "#fff", cursor: saving || !title.trim() ? "not-allowed" : "pointer" }}>
            {saving ? "Saving..." : plan ? "Save Changes" : "Create Plan"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Plan card ─────────────────────────────────────────────────────────────────

function PlanCard({ plan, onEdit, onDelete, onTogglePublish, toggling }) {
  const f    = plan.fields ?? {};
  const ts   = TIER_STYLE[f.tier] ?? TIER_STYLE.Basic;
  const daily = f.planJson?.daily ?? {};

  const macros = ["calories","protein","carbs","fat"]
    .filter(k => daily[k])
    .map(k => ({ calories: `${daily.calories} kcal`, protein: `${daily.protein}g P`, carbs: `${daily.carbs}g C`, fat: `${daily.fat}g F` }[k]))
    .join(" - ");

  return (
    <div className="p-4 rounded-sm" style={{ backgroundColor: DS.cardBg, border: `1px solid ${DS.border}` }}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="text-sm font-black" style={{ color: DS.bodyText }}>{f.title}</span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-sm" style={{ backgroundColor: ts.bg, color: ts.color, border: `1px solid ${ts.border}` }}>
              {f.tier}
            </span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-sm" style={{ backgroundColor: DS.pageBg, color: DS.labelText, border: `1px solid ${DS.border}` }}>
              {f.phase}
            </span>
            {!f.published && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-sm" style={{ backgroundColor: DS.cautionBg, color: DS.caution, border: `1px solid ${DS.cautionBorder}` }}>
                Draft
              </span>
            )}
          </div>
          {f.description && <p className="text-xs mt-0.5" style={{ color: DS.dimText }}>{f.description}</p>}
          {macros && <p className="text-xs mt-1 font-mono" style={{ color: DS.labelText }}>{macros}</p>}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button type="button" title={f.published ? "Unpublish" : "Publish"} onClick={() => onTogglePublish(plan)} disabled={toggling === plan.id}
            className="p-1.5 rounded-sm transition" style={{ color: f.published ? DS.safe : DS.dimText, border: `1px solid ${DS.border}` }}
            onMouseEnter={e => e.currentTarget.style.backgroundColor = DS.pageBg}
            onMouseLeave={e => e.currentTarget.style.backgroundColor = "transparent"}>
            {f.published ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
          </button>
          <button type="button" onClick={() => onEdit(plan)}
            className="p-1.5 rounded-sm transition" style={{ color: DS.labelText, border: `1px solid ${DS.border}` }}
            onMouseEnter={e => e.currentTarget.style.backgroundColor = DS.pageBg}
            onMouseLeave={e => e.currentTarget.style.backgroundColor = "transparent"}>
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button type="button" onClick={() => onDelete(plan.id)}
            className="p-1.5 rounded-sm transition" style={{ color: DS.dimText, border: `1px solid ${DS.border}` }}
            onMouseEnter={e => { e.currentTarget.style.color = DS.banned; e.currentTarget.style.backgroundColor = DS.bannedBg; }}
            onMouseLeave={e => { e.currentTarget.style.color = DS.dimText; e.currentTarget.style.backgroundColor = "transparent"; }}>
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────

export default function NutritionPlans({ trainerId, onPlanCountChange }) {
  const [plans,    setPlans]    = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [editing,  setEditing]  = useState(null);  // null = closed, false = new, plan object = editing
  const [saving,   setSaving]   = useState(false);
  const [toggling, setToggling] = useState(null);
  const [error,    setError]    = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/commercial/nutrition-plans", { credentials: "include" });
      const d = await r.json();
      const loaded = d.plans ?? [];
      setPlans(loaded);
      onPlanCountChange?.(loaded.length);
    } catch { setError("Failed to load plans."); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleSave(fields) {
    setSaving(true);
    try {
      const isNew = editing === false;
      const url   = isNew ? "/api/commercial/nutrition-plans" : `/api/commercial/nutrition-plans?id=${editing.id}`;
      const r     = await fetch(url, {
        method:  isNew ? "POST" : "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(fields),
      });
      if (!r.ok) { const d = await r.json(); setError(d.error ?? "Save failed"); return; }
      setEditing(null);
      await load();
    } catch { setError("Save failed."); }
    finally { setSaving(false); }
  }

  async function handleDelete(id) {
    if (!confirm("Delete this nutrition plan?")) return;
    await fetch(`/api/commercial/nutrition-plans?id=${id}`, { method: "DELETE", credentials: "include" });
    setPlans(p => p.filter(x => x.id !== id));
  }

  async function handleTogglePublish(plan) {
    setToggling(plan.id);
    const f = plan.fields ?? {};
    const r = await fetch(`/api/commercial/nutrition-plans?id=${plan.id}`, {
      method: "PUT", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ published: !f.published }),
    });
    if (r.ok) {
      const d = await r.json();
      setPlans(p => p.map(x => x.id === plan.id ? d.plan : x));
    }
    setToggling(null);
  }

  const published = plans.filter(p => p.fields?.published);
  const drafts    = plans.filter(p => !p.fields?.published);

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide" style={{ color: DS.dimText }}>
            {plans.length} plan{plans.length !== 1 ? "s" : ""} - {published.length} published
          </p>
        </div>
        <button type="button" onClick={() => setEditing(false)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-black uppercase tracking-wide rounded-sm transition"
          style={{ backgroundColor: DS.brand, color: "#fff" }}
          onMouseEnter={e => e.currentTarget.style.opacity = "0.85"}
          onMouseLeave={e => e.currentTarget.style.opacity = "1"}>
          <Plus className="w-3.5 h-3.5" /> New Plan
        </button>
      </div>

      {error && <p className="text-xs mb-3 font-bold" style={{ color: DS.banned }}>{error}</p>}

      {loading ? (
        <div className="space-y-2">
          {[1,2,3].map(i => <div key={i} className="h-16 rounded-sm" style={{ backgroundColor: DS.cardBg, animation: "pulse 1.5s ease-in-out infinite" }} />)}
        </div>
      ) : plans.length === 0 ? (
        <div className="py-16 text-center" style={{ border: `1px solid ${DS.border}`, borderRadius: 3 }}>
          <p className="text-sm font-bold" style={{ color: DS.labelText }}>No nutrition plans yet</p>
          <p className="text-xs mt-1" style={{ color: DS.dimText }}>Create reusable plans your subscribers can access based on their tier.</p>
          <button type="button" onClick={() => setEditing(false)}
            className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 text-xs font-black uppercase tracking-wide rounded-sm"
            style={{ backgroundColor: DS.brand, color: "#fff" }}>
            <Plus className="w-3.5 h-3.5" /> Create First Plan
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {published.length > 0 && (
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest mb-2" style={{ color: DS.safe }}>Published</p>
              <div className="space-y-2">
                {published.map(p => <PlanCard key={p.id} plan={p} onEdit={setEditing} onDelete={handleDelete} onTogglePublish={handleTogglePublish} toggling={toggling} />)}
              </div>
            </div>
          )}
          {drafts.length > 0 && (
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest mb-2" style={{ color: DS.caution }}>Drafts</p>
              <div className="space-y-2">
                {drafts.map(p => <PlanCard key={p.id} plan={p} onEdit={setEditing} onDelete={handleDelete} onTogglePublish={handleTogglePublish} toggling={toggling} />)}
              </div>
            </div>
          )}
        </div>
      )}

      {editing !== null && (
        <PlanEditor
          plan={editing === false ? null : editing}
          onSave={handleSave}
          onClose={() => setEditing(null)}
          saving={saving}
        />
      )}
    </div>
  );
}
