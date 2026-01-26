// components/org/CreateWorkoutModal.jsx
"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import {
  X,
  Plus,
  Users,
  CalendarDays,
  Dumbbell,
  AlertTriangle,
  Trash2,
  ChevronDown,
  ChevronUp,
  ClipboardList,
  Link as LinkIcon,
  Filter,
} from "lucide-react";

function classNames(...xs) {
  return xs.filter(Boolean).join(" ");
}

async function safeJson(res) {
  try {
    return await res.json();
  } catch {
    return {};
  }
}

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function normalizeTeam(v) {
  return String(v || "").trim().toLowerCase();
}

function titleTeam(v) {
  const s = normalizeTeam(v);
  if (!s) return "";
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function getAthleteTeam(a) {
  // Supports common shapes from /api/org/getAthletes
  return (
    a?.team ||
    a?.Team ||
    a?.sport ||
    a?.Sport ||
    a?.primarySport ||
    a?.PrimarySport ||
    ""
  );
}

function toNumberOrEmpty(v) {
  if (v === "" || v === null || typeof v === "undefined") return "";
  const n = Number(v);
  return Number.isFinite(n) ? n : "";
}

function sanitizeUrl(url) {
  const s = String(url || "").trim();
  if (!s) return "";
  if (/^https?:\/\//i.test(s)) return s;
  if (/^[\w-]+\.[\w.-]+/.test(s)) return `https://${s}`;
  return s;
}

function Pill({ children, tone = "neutral" }) {
  const toneCls =
    tone === "warn"
      ? "bg-amber-50 text-amber-800 border-amber-200"
      : tone === "bad"
      ? "bg-red-50 text-red-800 border-red-200"
      : tone === "good"
      ? "bg-emerald-50 text-emerald-800 border-emerald-200"
      : "bg-gray-100 text-gray-700 border-gray-200";

  return (
    <span
      className={classNames(
        "inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold border",
        toneCls
      )}
    >
      {children}
    </span>
  );
}

function Button({
  children,
  onClick,
  variant = "primary",
  disabled = false,
  className = "",
  type = "button",
  title = "",
}) {
  const base =
    "inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition";
  const styles =
    variant === "primary"
      ? "bg-[#46769B] text-white hover:brightness-110"
      : variant === "dark"
      ? "bg-gray-900 text-white hover:opacity-90"
      : "bg-white text-gray-800 border border-gray-200 hover:bg-gray-50";

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={classNames(
        base,
        styles,
        disabled ? "opacity-70 cursor-not-allowed" : "",
        className
      )}
    >
      {children}
    </button>
  );
}

/**
 * ModalShell upgrades:
 * - max-height constrained to viewport
 * - scrollable body
 */
function ModalShell({ open, title, subtitle, onClose, children }) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[9999]">
      <div
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
        role="button"
        tabIndex={0}
      />

      <div className="absolute inset-0 flex items-center justify-center p-3 sm:p-4">
        <div
          className={classNames(
            "w-full bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden",
            "max-w-3xl xl:max-w-5xl",
            "max-h-[92vh]"
          )}
        >
          <div className="p-5 border-b flex items-start justify-between gap-4 bg-white">
            <div className="min-w-0">
              <p className="text-lg font-extrabold text-gray-900 truncate">{title}</p>
              {subtitle ? (
                <p className="text-[12px] text-gray-500 mt-1">{subtitle}</p>
              ) : null}
            </div>
            <button
              className="p-2 rounded-xl border border-gray-200 hover:bg-gray-50"
              onClick={onClose}
              type="button"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="p-5 overflow-y-auto max-h-[calc(92vh-80px)]">{children}</div>
        </div>
      </div>
    </div>
  );
}

function newItem(order) {
  return {
    Order: order,
    ExerciseName: "",
    Sets: "",
    Reps: "",
    Weight: "",
    Rest: "",
    Instructions: "",
    VideoURL: "",
    EvidenceRequired: "none", // none | photo | video | photo_or_video
  };
}

/**
 * CreateWorkoutModal
 *
 * - Sport is OPTIONAL (used for labeling/filtering only)
 * - Team dropdown filters athlete list (football, basketball, etc.)
 * - “Select shown” becomes effectively “Select team” after filtering
 * - Items builder maps to your Airtable columns (optional)
 *
 * Requires:
 *  - GET  /api/org/getAthletes
 *  - POST /api/org/workouts/create
 *    expects { date, title, athleteIds, status?, sport?, items? }
 */
export default function CreateWorkoutModal({
  open,
  onClose,
  dateISO, // "YYYY-MM-DD"
  sport, // OPTIONAL label e.g. "Football" (can be empty)
  onCreated,
}) {
  const [loadingAthletes, setLoadingAthletes] = useState(false);
  const [athletes, setAthletes] = useState([]);

  const [title, setTitle] = useState("");
  const [status, setStatus] = useState("assigned");
  const [selected, setSelected] = useState({}); // athleteId -> true
  const [search, setSearch] = useState("");

  // ✅ Team filter (All / Football / Basketball / etc.)
  const [teamFilter, setTeamFilter] = useState("all"); // normalized team or "all"

  // Items builder
  const [itemsOpen, setItemsOpen] = useState(() => {
    if (typeof window === "undefined") return true;
    return window.innerWidth >= 1024;
  });
  const [items, setItems] = useState([newItem(1)]);

  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [okMsg, setOkMsg] = useState("");

  const inputBase =
    "w-full px-4 py-3 rounded-xl border border-gray-300 bg-white text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#46769B]";

  // Reset state whenever it opens
  useEffect(() => {
    if (!open) return;
    setErr("");
    setOkMsg("");
    setTitle((prev) => prev || `${sport || "Workout"} — ${dateISO || ""}`);
    setStatus("assigned");
    setSelected({});
    setSearch("");
    setTeamFilter("all");

    // default items panel open on desktop, collapsed on mobile
    setItemsOpen(typeof window !== "undefined" ? window.innerWidth >= 1024 : true);
    setItems([newItem(1)]);
  }, [open, sport, dateISO]);

  const fetchAthletes = useCallback(async () => {
    setLoadingAthletes(true);
    setErr("");

    try {
      const res = await fetch("/api/org/getAthletes", {
        method: "GET",
        credentials: "include",
      });
      const data = await safeJson(res);
      if (!res.ok) throw new Error(data?.error || "Failed to load athletes");

      const list = Array.isArray(data?.athletes) ? data.athletes : [];
      setAthletes(list);
    } catch (e) {
      setAthletes([]);
      setErr(e?.message || "Failed to load athletes");
    } finally {
      setLoadingAthletes(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    fetchAthletes();
  }, [open, fetchAthletes]);

  // Teams derived from athlete list (supports a.team/a.sport/etc)
  const teamsAll = useMemo(() => {
    const list = Array.isArray(athletes) ? athletes : [];
    const set = new Set();
    list.forEach((a) => {
      const t = normalizeTeam(getAthleteTeam(a));
      if (t) set.add(t);
    });
    return Array.from(set).sort();
  }, [athletes]);

  const filteredAthletes = useMemo(() => {
    const q = String(search || "").trim().toLowerCase();
    const list = Array.isArray(athletes) ? athletes : [];

    return list.filter((a) => {
      const name = String(a?.name || a?.Name || "").toLowerCase();
      const email = normalizeEmail(a?.email || a?.Email);

      const team = normalizeTeam(getAthleteTeam(a));
      const teamOk = teamFilter === "all" ? true : team === teamFilter;

      const queryOk = !q ? true : name.includes(q) || email.includes(q);

      return teamOk && queryOk;
    });
  }, [athletes, search, teamFilter]);

  const selectedIds = useMemo(() => {
    return Object.entries(selected)
      .filter(([, v]) => !!v)
      .map(([k]) => k);
  }, [selected]);

  const toggleAll = (on) => {
    const next = {};
    (filteredAthletes || []).forEach((a) => {
      const id = a?.id || a?.recordId || a?.record_id || a?.airtableId;
      if (id) next[String(id)] = !!on;
    });
    setSelected((prev) => ({ ...prev, ...next }));
  };

  const toggleOne = (id) => {
    const key = String(id || "");
    if (!key) return;
    setSelected((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  // ---------- Items helpers ----------
  const renumberOrders = (list) => {
    const cleaned = (list || []).map((it, idx) => {
      const ord = toNumberOrEmpty(it?.Order);
      return { ...it, Order: ord === "" ? idx + 1 : ord };
    });

    const seen = new Set();
    let needsNormalize = false;
    for (const it of cleaned) {
      const ord = Number(it.Order);
      if (!Number.isFinite(ord) || ord <= 0 || seen.has(ord)) {
        needsNormalize = true;
        break;
      }
      seen.add(ord);
    }
    if (!needsNormalize) return cleaned;

    return cleaned.map((it, idx) => ({ ...it, Order: idx + 1 }));
  };

  const addItem = () => {
    setItems((prev) => {
      const next = Array.isArray(prev) ? [...prev] : [];
      next.push(newItem(next.length + 1));
      return renumberOrders(next);
    });
  };

  const removeItem = (index) => {
    setItems((prev) => {
      const next = (Array.isArray(prev) ? [...prev] : []).filter((_, i) => i !== index);
      return renumberOrders(next.length ? next : [newItem(1)]);
    });
  };

  const updateItem = (index, patch) => {
    setItems((prev) => {
      const next = Array.isArray(prev) ? [...prev] : [];
      next[index] = { ...(next[index] || newItem(index + 1)), ...patch };
      return next;
    });
  };

  const sortedItemsForSubmit = useMemo(() => {
    const list = renumberOrders(items || []);
    return [...list].sort((a, b) => Number(a.Order) - Number(b.Order));
  }, [items]);

  const hasAnyMeaningfulItem = useMemo(() => {
    const list = Array.isArray(items) ? items : [];
    return list.some((it) => String(it?.ExerciseName || "").trim());
  }, [items]);

  const validateItems = () => {
    const list = sortedItemsForSubmit;

    if (!hasAnyMeaningfulItem) return { ok: true, items: [] };

    for (let i = 0; i < list.length; i++) {
      const it = list[i] || {};
      const name = String(it.ExerciseName || "").trim();

      const hasOther =
        toNumberOrEmpty(it.Order) !== "" ||
        toNumberOrEmpty(it.Sets) !== "" ||
        String(it.Reps || "").trim() ||
        String(it.Weight || "").trim() ||
        String(it.Rest || "").trim() ||
        String(it.Instructions || "").trim() ||
        String(it.VideoURL || "").trim() ||
        String(it.EvidenceRequired || "").trim();

      if (hasOther && !name) {
        return { ok: false, error: `Item #${i + 1}: ExerciseName is required.` };
      }

      const sets = toNumberOrEmpty(it.Sets);
      if (sets !== "" && Number(sets) < 0) {
        return { ok: false, error: `Item #${i + 1}: Sets must be 0 or greater.` };
      }

      const ord = toNumberOrEmpty(it.Order);
      if (ord !== "" && Number(ord) <= 0) {
        return { ok: false, error: `Item #${i + 1}: Order must be 1 or greater.` };
      }

      const ev = String(it.EvidenceRequired || "none");
      const allowed = ["none", "photo", "video", "photo_or_video"];
      if (!allowed.includes(ev)) {
        return { ok: false, error: `Item #${i + 1}: EvidenceRequired is invalid.` };
      }
    }

    const cleaned = list
      .filter((it) => String(it?.ExerciseName || "").trim())
      .map((it, idx) => ({
        Order: Number(toNumberOrEmpty(it.Order) || idx + 1),
        ExerciseName: String(it.ExerciseName || "").trim(),
        Sets: toNumberOrEmpty(it.Sets) === "" ? null : Number(it.Sets),
        Reps: String(it.Reps || "").trim() || null,
        Weight: String(it.Weight || "").trim() || null,
        Rest: String(it.Rest || "").trim() || null,
        Instructions: String(it.Instructions || "").trim() || null,
        VideoURL: sanitizeUrl(it.VideoURL) || null,
        EvidenceRequired: String(it.EvidenceRequired || "none"),
      }));

    return { ok: true, items: cleaned };
  };

  const submit = async () => {
    setErr("");
    setOkMsg("");

    if (!dateISO) return setErr("Missing date.");
    if (!String(title || "").trim()) return setErr("Title is required.");
    if (!selectedIds.length) return setErr("Select at least one athlete.");

    const itemsCheck = validateItems();
    if (!itemsCheck.ok) return setErr(itemsCheck.error || "Invalid items.");

    setSaving(true);
    try {
      const payload = {
        date: String(dateISO).slice(0, 10),
        title: String(title).trim(),
        status,
        athleteIds: selectedIds,
        items: itemsCheck.items,
        ...(sport ? { sport: String(sport) } : {}), // ✅ sport optional
      };

      const res = await fetch("/api/org/workouts/create", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await safeJson(res);
      if (!res.ok) throw new Error(data?.error || "Failed to create workout");

      setOkMsg("Workout created!");
      onCreated?.(data?.dailyWorkout || data?.workout || null);

      setTimeout(() => {
        onClose?.();
      }, 400);
    } catch (e) {
      setErr(e?.message || "Failed to create workout");
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalShell
      open={open}
      onClose={onClose}
      title="Create workout"
      subtitle="Pick a team (optional), assign athletes, set the title, and (optionally) build workout item rows."
    >
      <div className="space-y-5">
        {/* Context */}
        <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-2">
            <CalendarDays className="w-4 h-4 text-gray-500" />
            <p className="text-sm font-semibold text-gray-900">{dateISO || "—"}</p>
            {sport ? <Pill>{sport}</Pill> : <Pill tone="neutral">No sport label</Pill>}
          </div>
          <div className="flex items-center gap-2">
            <Dumbbell className="w-4 h-4 text-gray-500" />
            <p className="text-[12px] text-gray-600">
              Selected: <span className="font-semibold">{selectedIds.length}</span>
            </p>
            <Pill tone={hasAnyMeaningfulItem ? "good" : "neutral"}>
              Items: {hasAnyMeaningfulItem ? `${items.length}` : "none"}
            </Pill>
          </div>
        </div>

        {/* Errors / OK */}
        {err ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4">
            <p className="text-sm text-red-700 font-semibold flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              {err}
            </p>
          </div>
        ) : null}

        {okMsg ? (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
            <p className="text-sm text-emerald-800 font-semibold">{okMsg}</p>
          </div>
        ) : null}

        {/* Title */}
        <div>
          <label className="text-xs text-gray-600 font-semibold">Workout title</label>
          <input
            className={classNames(inputBase, "mt-2")}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Lower Body Strength (Player-specific or Team-wide)"
          />
        </div>

        {/* Status */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-gray-600 font-semibold">Status</label>
            <select
              className="mt-2 w-full px-4 py-3 rounded-xl border border-gray-300 bg-white text-sm"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="assigned">assigned</option>
              <option value="draft">draft</option>
              <option value="archived">archived</option>
            </select>
            <p className="text-[11px] text-gray-500 mt-2">
              If your Airtable doesn’t use these exact values, you can remove this dropdown.
            </p>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
            <p className="text-xs text-gray-500">Workflow</p>
            <p className="text-sm font-semibold text-gray-900 mt-1">Select by team, then fine-tune</p>
            <p className="text-[11px] text-gray-500 mt-2">
              Pick Football/Basketball/etc → select shown → deselect a few → create.
            </p>
          </div>
        </div>

        {/* Items builder */}
        <div className="rounded-2xl border border-gray-200 overflow-hidden">
          <button
            type="button"
            className="w-full p-4 bg-white hover:bg-gray-50 flex items-center justify-between gap-3"
            onClick={() => setItemsOpen((v) => !v)}
          >
            <div className="flex items-center gap-2 min-w-0">
              <ClipboardList className="w-4 h-4 text-gray-500" />
              <p className="text-sm font-extrabold text-gray-900 truncate">Workout items (Airtable rows)</p>
              <Pill tone={hasAnyMeaningfulItem ? "good" : "neutral"}>
                {hasAnyMeaningfulItem ? `${items.length} rows` : "optional"}
              </Pill>
            </div>
            {itemsOpen ? (
              <ChevronUp className="w-4 h-4 text-gray-500" />
            ) : (
              <ChevronDown className="w-4 h-4 text-gray-500" />
            )}
          </button>

          {itemsOpen ? (
            <div className="p-4 border-t bg-gray-50 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <p className="text-[12px] text-gray-600">
                  Maps to Airtable: Order, ExerciseName, Sets, Reps, Weight, Rest, Instructions, VideoURL, EvidenceRequired.
                </p>
                <div className="flex gap-2">
                  <Button variant="secondary" className="px-3 py-2 text-xs" onClick={addItem}>
                    <Plus className="w-4 h-4" />
                    Add item
                  </Button>
                  <Button
                    variant="secondary"
                    className="px-3 py-2 text-xs"
                    onClick={() => setItems([newItem(1)])}
                    title="Reset items"
                  >
                    Clear items
                  </Button>
                </div>
              </div>

              <div className="space-y-3">
                {(items || []).map((it, idx) => (
                  <div key={idx} className="rounded-2xl border border-gray-200 bg-white p-4">
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-sm font-extrabold text-gray-900">Item {idx + 1}</p>
                      <button
                        type="button"
                        className="p-2 rounded-xl border border-gray-200 hover:bg-gray-50"
                        onClick={() => removeItem(idx)}
                        title="Remove item"
                      >
                        <Trash2 className="w-4 h-4 text-gray-700" />
                      </button>
                    </div>

                    <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="text-xs text-gray-600 font-semibold">Order</label>
                        <input
                          className={classNames(inputBase, "mt-2")}
                          value={toNumberOrEmpty(it?.Order)}
                          onChange={(e) => updateItem(idx, { Order: toNumberOrEmpty(e.target.value) })}
                          placeholder="1"
                          inputMode="numeric"
                        />
                      </div>

                      <div className="sm:col-span-2">
                        <label className="text-xs text-gray-600 font-semibold">ExerciseName</label>
                        <input
                          className={classNames(inputBase, "mt-2")}
                          value={it?.ExerciseName || ""}
                          onChange={(e) => updateItem(idx, { ExerciseName: e.target.value })}
                          placeholder="e.g. Trap Bar Deadlift"
                        />
                      </div>
                    </div>

                    <div className="mt-3 grid grid-cols-1 sm:grid-cols-4 gap-3">
                      <div>
                        <label className="text-xs text-gray-600 font-semibold">Sets</label>
                        <input
                          className={classNames(inputBase, "mt-2")}
                          value={toNumberOrEmpty(it?.Sets)}
                          onChange={(e) => updateItem(idx, { Sets: toNumberOrEmpty(e.target.value) })}
                          placeholder="3"
                          inputMode="numeric"
                        />
                      </div>

                      <div>
                        <label className="text-xs text-gray-600 font-semibold">Reps</label>
                        <input
                          className={classNames(inputBase, "mt-2")}
                          value={it?.Reps || ""}
                          onChange={(e) => updateItem(idx, { Reps: e.target.value })}
                          placeholder="8-10"
                        />
                      </div>

                      <div>
                        <label className="text-xs text-gray-600 font-semibold">Weight</label>
                        <input
                          className={classNames(inputBase, "mt-2")}
                          value={it?.Weight || ""}
                          onChange={(e) => updateItem(idx, { Weight: e.target.value })}
                          placeholder="225 lb"
                        />
                      </div>

                      <div>
                        <label className="text-xs text-gray-600 font-semibold">Rest</label>
                        <input
                          className={classNames(inputBase, "mt-2")}
                          value={it?.Rest || ""}
                          onChange={(e) => updateItem(idx, { Rest: e.target.value })}
                          placeholder="90s"
                        />
                      </div>
                    </div>

                    <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs text-gray-600 font-semibold">EvidenceRequired</label>
                        <select
                          className="mt-2 w-full px-4 py-3 rounded-xl border border-gray-300 bg-white text-sm"
                          value={it?.EvidenceRequired || "none"}
                          onChange={(e) => updateItem(idx, { EvidenceRequired: e.target.value })}
                        >
                          <option value="none">none</option>
                          <option value="photo">photo</option>
                          <option value="video">video</option>
                          <option value="photo_or_video">photo_or_video</option>
                        </select>
                        <p className="text-[11px] text-gray-500 mt-2">
                          Must match Airtable single select values exactly.
                        </p>
                      </div>

                      <div>
                        <label className="text-xs text-gray-600 font-semibold">VideoURL</label>
                        <div className="mt-2 relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                            <LinkIcon className="w-4 h-4" />
                          </span>
                          <input
                            className={classNames(inputBase, "pl-10")}
                            value={it?.VideoURL || ""}
                            onChange={(e) => updateItem(idx, { VideoURL: e.target.value })}
                            placeholder="https://..."
                          />
                        </div>
                        <p className="text-[11px] text-gray-500 mt-2">YouTube, Hudl, Drive link, etc.</p>
                      </div>
                    </div>

                    <div className="mt-3">
                      <label className="text-xs text-gray-600 font-semibold">Instructions</label>
                      <textarea
                        className={classNames(inputBase, "mt-2 min-h-[96px]")}
                        value={it?.Instructions || ""}
                        onChange={(e) => updateItem(idx, { Instructions: e.target.value })}
                        placeholder="Coaching cues, tempo, technique notes..."
                      />
                    </div>

                    <p className="text-[11px] text-gray-500 mt-3">
                      Leaving ExerciseName blank means this row will not be submitted.
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        {/* Athlete picker */}
        <div className="rounded-2xl border border-gray-200 p-4">
          <div className="flex flex-col gap-3">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-gray-500" />
                <p className="text-sm font-extrabold text-gray-900">Assign athletes</p>
                <Pill>{loadingAthletes ? "Loading…" : `${filteredAthletes.length} shown`}</Pill>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  variant="secondary"
                  className="px-3 py-2 text-xs"
                  onClick={() => toggleAll(true)}
                  disabled={loadingAthletes || !filteredAthletes.length}
                  title="Select athletes currently shown"
                >
                  Select shown
                </Button>
                <Button
                  variant="secondary"
                  className="px-3 py-2 text-xs"
                  onClick={() => toggleAll(false)}
                  disabled={loadingAthletes || !filteredAthletes.length}
                  title="Clear selection for athletes currently shown"
                >
                  Clear shown
                </Button>
                <Button
                  variant="secondary"
                  className="px-3 py-2 text-xs"
                  onClick={fetchAthletes}
                  disabled={loadingAthletes}
                >
                  Refresh
                </Button>
              </div>
            </div>

            {/* Team + Search */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
              <div className="sm:col-span-5">
                <label className="text-xs text-gray-600 font-semibold flex items-center gap-2">
                  <Filter className="w-3.5 h-3.5" />
                  Team
                </label>
                <select
                  className="mt-2 w-full px-4 py-3 rounded-xl border border-gray-300 bg-white text-sm"
                  value={teamFilter}
                  onChange={(e) => setTeamFilter(e.target.value)}
                >
                  <option value="all">All teams</option>
                  {teamsAll.map((t) => (
                    <option key={t} value={t}>
                      {titleTeam(t)}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-gray-500 mt-2">
                  Filter the list, then “Select shown” to quickly assign that team.
                </p>
              </div>

              <div className="sm:col-span-7">
                <label className="text-xs text-gray-600 font-semibold">Search</label>
                <input
                  className={classNames(inputBase, "mt-2")}
                  placeholder="Search athletes by name or email…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                <div className="mt-2 flex flex-wrap gap-2">
                  <Pill>{teamFilter === "all" ? "All teams" : titleTeam(teamFilter)}</Pill>
                  <Pill tone="good">{selectedIds.length} selected</Pill>
                </div>
              </div>
            </div>

            <div className="max-h-[320px] overflow-auto rounded-2xl border border-gray-200">
              {loadingAthletes ? (
                <div className="p-4 text-sm text-gray-600">Loading athletes…</div>
              ) : filteredAthletes.length === 0 ? (
                <div className="p-4 text-sm text-gray-600">No athletes found.</div>
              ) : (
                <ul className="divide-y">
                  {filteredAthletes.map((a) => {
                    const id = String(a?.id || a?.recordId || a?.record_id || a?.airtableId || "");
                    const checked = !!selected[id];
                    const team = titleTeam(getAthleteTeam(a));

                    return (
                      <li key={id} className="p-3 hover:bg-gray-50">
                        <label className="flex items-start gap-3 cursor-pointer">
                          <input
                            type="checkbox"
                            className="mt-1"
                            checked={checked}
                            onChange={() => toggleOne(id)}
                          />
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-gray-900 truncate">
                              {a?.name || a?.Name || "Athlete"}
                            </p>
                            <p className="text-[12px] text-gray-600 break-all">
                              {normalizeEmail(a?.email || a?.Email) || "—"}
                            </p>
                            <div className="mt-2 flex flex-wrap gap-2">
                              {team ? <Pill>{team}</Pill> : null}
                              {a?.status ? <Pill>{a.status}</Pill> : null}
                              {a?.needsPlan ? <Pill tone="bad">Needs plan</Pill> : null}
                              {a?.stale ? <Pill tone="warn">Needs update</Pill> : null}
                            </div>
                          </div>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        </div>

        {/* Footer actions */}
        <div className="flex flex-col sm:flex-row justify-end gap-2 pt-1">
          <Button variant="secondary" onClick={onClose} className="w-full sm:w-auto">
            Cancel
          </Button>
          <Button
            onClick={submit}
            disabled={saving}
            className="w-full sm:w-auto"
            title="Create workout"
          >
            <Plus className="w-4 h-4" />
            {saving ? "Creating..." : "Create workout"}
          </Button>
        </div>
      </div>
    </ModalShell>
  );
}
