// components/org/CreateWorkoutModal.jsx
"use client";

import { useEffect, useMemo, useState, useCallback, useRef } from "react";
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
  Search,
  CheckCircle2,
  Info,
} from "lucide-react";

function classNames(...xs) {
  return xs.filter(Boolean).join(" ");
}

function cx(...xs) {
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
  return a?.team || a?.Team || a?.sport || a?.Sport || a?.primarySport || a?.PrimarySport || "";
}

function getAthleteToken(a) {
  return String(a?.AthleteToken || a?.athleteToken || a?.Token || "").trim();
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

function Pill({ children, tone = "neutral", className = "" }) {
  const toneCls =
    tone === "warn"
      ? "bg-amber-50 text-amber-800 border-amber-200"
      : tone === "bad"
      ? "bg-red-50 text-red-800 border-red-200"
      : tone === "good"
      ? "bg-emerald-50 text-emerald-800 border-emerald-200"
      : tone === "blue"
      ? "bg-blue-50 text-blue-900 border-blue-200"
      : "bg-gray-100 text-gray-700 border-gray-200";

  return (
    <span
      className={classNames(
        "inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold border",
        toneCls,
        className
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
 * - ESC closes, locks page scroll
 * - safe-area padding for mobile
 */
function ModalShell({ open, title, subtitle, onClose, children }) {
  useEffect(() => {
    if (!open) return;

    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKey = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", onKey);

    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[10000]">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} role="button" tabIndex={0} />

      <div className="absolute inset-0 flex items-center justify-center px-3 py-3 sm:px-4 sm:py-6">
        <div
          className={classNames(
            "w-full bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden",
            "max-w-3xl xl:max-w-5xl",
            // dvh handles mobile browser chrome better than vh
            "max-h-[calc(100dvh-24px)] sm:max-h-[calc(100vh-48px)]"
          )}
          role="dialog"
          aria-modal="true"
          aria-label={title || "Create workout"}
        >
          <div className="px-5 pt-5 pb-4 border-b flex items-start justify-between gap-4 bg-white">
            <div className="min-w-0">
              <p className="text-lg font-extrabold text-gray-900 truncate">{title}</p>
              {subtitle ? <p className="text-[12px] text-gray-500 mt-1">{subtitle}</p> : null}
            </div>
            <button
              className="p-2 rounded-xl border border-gray-200 hover:bg-gray-50 active:scale-[0.99] transition"
              onClick={onClose}
              type="button"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="px-5 py-5 overflow-y-auto max-h-[calc(100dvh-140px)] sm:max-h-[calc(100vh-180px)]">
            {children}
            <div className="h-2 sm:h-3" />
          </div>
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
    EvidenceRequired: "none",
  };
}

/**
 * CreateWorkoutModal (TOKEN-FIRST)
 *
 * Enhancements added:
 * - Better modal shell behavior: ESC closes, scroll lock, dvh sizing
 * - Footer CTA always reachable, clear disabled states
 * - Athlete selection UX:
 *   - Summary bar with counts
 *   - “Select all shown” and “Clear shown” stays
 *   - “Selected only” toggle for review
 * - Team + Search refined with icons and helper microcopy
 * - Items builder:
 *   - Better spacing, clearer field grouping
 *   - Quick add / clear, and row-level remove
 *   - Validation preview microcopy
 * - Safe URL normalization + item pruning already maintained
 */
export default function CreateWorkoutModal({
  open,
  onClose,
  dateISO,
  sport,
  onCreated,
}) {
  const [loadingAthletes, setLoadingAthletes] = useState(false);
  const [athletes, setAthletes] = useState([]);

  const [title, setTitle] = useState("");
  const [status, setStatus] = useState("assigned");

  const [selected, setSelected] = useState({}); // athleteToken -> true

  const [search, setSearch] = useState("");
  const [teamFilter, setTeamFilter] = useState("all");
  const [showSelectedOnly, setShowSelectedOnly] = useState(false);

  const [itemsOpen, setItemsOpen] = useState(() => {
    if (typeof window === "undefined") return true;
    return window.innerWidth >= 1024;
  });
  const [items, setItems] = useState([newItem(1)]);

  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [okMsg, setOkMsg] = useState("");

  const titleRef = useRef(null);

  const inputBase =
    "w-full px-4 py-3 rounded-xl border border-gray-300 bg-white text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#46769B]/25";

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
    setShowSelectedOnly(false);

    setItemsOpen(typeof window !== "undefined" ? window.innerWidth >= 1024 : true);
    setItems([newItem(1)]);

    // Focus title field for fast flow
    setTimeout(() => {
      try {
        titleRef.current?.focus?.();
      } catch {}
    }, 0);
  }, [open, sport, dateISO]);

  const fetchAthletes = useCallback(async () => {
    setLoadingAthletes(true);
    setErr("");

    try {
      const res = await fetch("/api/org/getAthletes", { method: "GET", credentials: "include" });
      const data = await safeJson(res);
      if (!res.ok) throw new Error(data?.error || "Failed to load athletes");

      const list = Array.isArray(data?.athletes) ? data.athletes : [];

      const missingTokens = list.filter((a) => !getAthleteToken(a)).length;
      if (missingTokens > 0) {
        console.warn(
          `[CreateWorkoutModal] ${missingTokens} athlete(s) missing AthleteToken from /api/org/getAthletes`
        );
      }

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

  const teamsAll = useMemo(() => {
    const list = Array.isArray(athletes) ? athletes : [];
    const set = new Set();
    list.forEach((a) => {
      const t = normalizeTeam(getAthleteTeam(a));
      if (t) set.add(t);
    });
    return Array.from(set).sort();
  }, [athletes]);

  const selectedTokens = useMemo(() => {
    return Object.entries(selected)
      .filter(([, v]) => !!v)
      .map(([k]) => k);
  }, [selected]);

  const selectedCount = selectedTokens.length;

  const filteredAthletes = useMemo(() => {
    const q = String(search || "").trim().toLowerCase();
    const list = Array.isArray(athletes) ? athletes : [];

    let out = list.filter((a) => {
      const token = getAthleteToken(a);
      if (!token) return false;

      const name = String(a?.name || a?.Name || "").toLowerCase();
      const email = normalizeEmail(a?.email || a?.Email);
      const team = normalizeTeam(getAthleteTeam(a));

      const teamOk = teamFilter === "all" ? true : team === teamFilter;
      const queryOk = !q ? true : name.includes(q) || email.includes(q);

      return teamOk && queryOk;
    });

    if (showSelectedOnly) {
      const setSel = new Set(selectedTokens);
      out = out.filter((a) => setSel.has(getAthleteToken(a)));
    }

    return out;
  }, [athletes, search, teamFilter, showSelectedOnly, selectedTokens]);

  const toggleAllShown = (on) => {
    const next = {};
    (filteredAthletes || []).forEach((a) => {
      const token = getAthleteToken(a);
      if (token) next[token] = !!on;
    });
    setSelected((prev) => ({ ...prev, ...next }));
  };

  const clearAllSelected = () => setSelected({});

  const toggleOne = (token) => {
    const key = String(token || "").trim();
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

  const canSubmit = useMemo(() => {
    if (!dateISO) return false;
    if (!String(title || "").trim()) return false;
    if (!selectedCount) return false;
    if (saving) return false;
    return true;
  }, [dateISO, title, selectedCount, saving]);

  const submit = async () => {
    setErr("");
    setOkMsg("");

    if (!dateISO) return setErr("Missing date.");
    if (!String(title || "").trim()) return setErr("Title is required.");
    if (!selectedTokens.length) return setErr("Select at least one athlete.");

    const itemsCheck = validateItems();
    if (!itemsCheck.ok) return setErr(itemsCheck.error || "Invalid items.");

    setSaving(true);
    try {
      const payload = {
        date: String(dateISO).slice(0, 10),
        title: String(title).trim(),
        status,
        athleteIds: selectedTokens,
        items: itemsCheck.items,
        ...(sport ? { sport: String(sport) } : {}),
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

      // Slight delay so success message flashes briefly (feels responsive)
      setTimeout(() => {
        onClose?.();
      }, 350);
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
        {/* Context / Summary */}
        <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center flex-wrap gap-2">
            <CalendarDays className="w-4 h-4 text-gray-500" />
            <p className="text-sm font-semibold text-gray-900">{dateISO || "—"}</p>
            {sport ? <Pill tone="blue">{sport}</Pill> : <Pill tone="neutral">No sport label</Pill>}
            <Pill tone="good" className="ml-0 sm:ml-2">
              <Users className="w-3.5 h-3.5 mr-1.5" />
              {selectedCount} selected
            </Pill>
          </div>

          <div className="flex items-center gap-2">
            <Dumbbell className="w-4 h-4 text-gray-500" />
            <p className="text-[12px] text-gray-600">
              Items: <span className="font-semibold">{hasAnyMeaningfulItem ? items.length : 0}</span>
            </p>
            <Pill tone={hasAnyMeaningfulItem ? "good" : "neutral"}>
              {hasAnyMeaningfulItem ? "Will submit rows" : "Optional"}
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
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-700" />
            <p className="text-sm text-emerald-800 font-semibold">{okMsg}</p>
          </div>
        ) : null}

        {/* Title */}
        <div>
          <label className="text-xs text-gray-600 font-semibold">Workout title</label>
          <input
            ref={titleRef}
            className={classNames(inputBase, "mt-2")}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Lower Body Strength (Team Wide)"
          />
          <div className="mt-2 flex flex-wrap gap-2">
            <Pill tone="neutral">
              <Info className="w-3.5 h-3.5 mr-1.5" />
              Tip: include the session goal (speed, strength, mobility)
            </Pill>
          </div>
        </div>

        {/* Status + Quick guidance */}
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
              Keep <span className="font-semibold">assigned</span> for normal scheduling. Use{" "}
              <span className="font-semibold">draft</span> if you want to build first, then assign later.
            </p>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
            <p className="text-xs text-gray-500">Workflow</p>
            <p className="text-sm font-semibold text-gray-900 mt-1">Filter → Select shown → Fine-tune</p>
            <p className="text-[11px] text-gray-500 mt-2">
              Choose a team, hit <span className="font-semibold">Select shown</span>, then uncheck a few athletes if
              needed.
            </p>
          </div>
        </div>

        {/* Items builder */}
        <div className="rounded-2xl border border-gray-200 overflow-hidden">
          <button
            type="button"
            className="w-full px-4 py-4 bg-white hover:bg-gray-50 flex items-center justify-between gap-3"
            onClick={() => setItemsOpen((v) => !v)}
          >
            <div className="flex items-center gap-2 min-w-0">
              <ClipboardList className="w-4 h-4 text-gray-500" />
              <p className="text-sm font-extrabold text-gray-900 truncate">Workout items (Airtable rows)</p>
              <Pill tone={hasAnyMeaningfulItem ? "good" : "neutral"}>
                {hasAnyMeaningfulItem ? `${items.length} rows` : "optional"}
              </Pill>
            </div>
            {itemsOpen ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
          </button>

          {itemsOpen ? (
            <div className="p-4 border-t bg-gray-50 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[12px] text-gray-700 font-semibold">Fields</p>
                  <p className="text-[12px] text-gray-600">
                    Order, ExerciseName, Sets, Reps, Weight, Rest, Instructions, VideoURL, EvidenceRequired
                  </p>
                  <p className="text-[11px] text-gray-500 mt-2">
                    Rows with blank <span className="font-semibold">ExerciseName</span> are ignored on submit.
                  </p>
                </div>
                <div className="flex gap-2 shrink-0">
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
                      <div className="min-w-0">
                        <p className="text-sm font-extrabold text-gray-900">Item {idx + 1}</p>
                        <p className="text-[11px] text-gray-500 mt-0.5">
                          Keep Order sequential for clean Airtable sort.
                        </p>
                      </div>

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
                {selectedCount ? <Pill tone="good">{selectedCount} selected</Pill> : <Pill tone="warn">None selected</Pill>}
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  variant="secondary"
                  className="px-3 py-2 text-xs"
                  onClick={() => toggleAllShown(true)}
                  disabled={loadingAthletes || !filteredAthletes.length}
                  title="Select athletes currently shown"
                >
                  Select shown
                </Button>
                <Button
                  variant="secondary"
                  className="px-3 py-2 text-xs"
                  onClick={() => toggleAllShown(false)}
                  disabled={loadingAthletes || !filteredAthletes.length}
                  title="Clear selection for athletes currently shown"
                >
                  Clear shown
                </Button>
                <Button
                  variant="secondary"
                  className="px-3 py-2 text-xs"
                  onClick={clearAllSelected}
                  disabled={!selectedCount}
                  title="Clear all selected athletes"
                >
                  Clear all
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

            {/* Team + Search + Selected only */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
              <div className="sm:col-span-4">
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

              <div className="sm:col-span-6">
                <label className="text-xs text-gray-600 font-semibold">Search</label>
                <div className="mt-2 relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                    <Search className="w-4 h-4" />
                  </span>
                  <input
                    className={classNames(inputBase, "pl-10")}
                    placeholder="Search athletes by name or email…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>

                <div className="mt-2 flex flex-wrap gap-2">
                  <Pill>{teamFilter === "all" ? "All teams" : titleTeam(teamFilter)}</Pill>
                  {search ? <Pill tone="blue">Search active</Pill> : <Pill tone="neutral">No search</Pill>}
                </div>
              </div>

              <div className="sm:col-span-2">
                <label className="text-xs text-gray-600 font-semibold">View</label>
                <button
                  type="button"
                  className={cx(
                    "mt-2 w-full px-3 py-3 rounded-xl border text-sm font-semibold transition",
                    showSelectedOnly
                      ? "bg-[#46769B] text-white border-[#46769B]"
                      : "bg-white text-gray-800 border-gray-200 hover:bg-gray-50"
                  )}
                  onClick={() => setShowSelectedOnly((v) => !v)}
                  disabled={!selectedCount}
                  title={!selectedCount ? "Select athletes first" : "Toggle showing only selected athletes"}
                >
                  {showSelectedOnly ? "Selected" : "All"}
                </button>
                <p className="text-[11px] text-gray-500 mt-2">
                  Toggle to review selections quickly.
                </p>
              </div>
            </div>

            <div className="max-h-[340px] overflow-auto rounded-2xl border border-gray-200">
              {loadingAthletes ? (
                <div className="p-4 text-sm text-gray-600">Loading athletes…</div>
              ) : filteredAthletes.length === 0 ? (
                <div className="p-4 text-sm text-gray-600">No athletes found.</div>
              ) : (
                <ul className="divide-y">
                  {filteredAthletes.map((a) => {
                    const token = getAthleteToken(a);
                    if (!token) return null;

                    const checked = !!selected[token];
                    const team = titleTeam(getAthleteTeam(a));

                    return (
                      <li key={token} className="p-3 hover:bg-gray-50">
                        <label className="flex items-start gap-3 cursor-pointer">
                          <input
                            type="checkbox"
                            className="mt-1"
                            checked={checked}
                            onChange={() => toggleOne(token)}
                          />
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-gray-900 truncate">
                              {a?.name || a?.Name || "Athlete"}
                            </p>
                            <p className="text-[12px] text-gray-600 break-all">
                              {normalizeEmail(a?.email || a?.Email) || "—"}
                            </p>
                            <div className="mt-2 flex flex-wrap gap-2">
                              <Pill tone="neutral">Token: {token}</Pill>
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

            {/* Selection summary */}
            <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
              <p className="text-xs text-gray-500">Selection summary</p>
              <div className="mt-2 flex flex-wrap gap-2 items-center">
                <Pill tone={selectedCount ? "good" : "warn"}>{selectedCount} selected</Pill>
                <Pill tone="neutral">{filteredAthletes.length} shown</Pill>
                {teamFilter !== "all" ? <Pill tone="blue">Team: {titleTeam(teamFilter)}</Pill> : null}
                {search ? <Pill tone="blue">Search: “{search}”</Pill> : null}
              </div>
              <p className="text-[11px] text-gray-500 mt-2">
                You must select at least one athlete to create the workout.
              </p>
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
            disabled={!canSubmit}
            className="w-full sm:w-auto"
            title={!selectedCount ? "Select at least one athlete" : "Create workout"}
          >
            <Plus className="w-4 h-4" />
            {saving ? "Creating..." : "Create workout"}
          </Button>
        </div>
      </div>
    </ModalShell>
  );
}