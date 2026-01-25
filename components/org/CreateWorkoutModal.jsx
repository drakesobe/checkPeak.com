// components/org/CreateWorkoutModal.jsx
"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { X, Plus, Users, CalendarDays, Dumbbell, AlertTriangle } from "lucide-react";

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
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div className="w-full max-w-2xl bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden">
          <div className="p-5 border-b flex items-start justify-between gap-4">
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

          <div className="p-5">{children}</div>
        </div>
      </div>
    </div>
  );
}

/**
 * CreateWorkoutModal
 *
 * - Fetches athletes (once when opened)
 * - Creates a DailyWorkout for selected date + sport
 * - Lets trainer choose athletes to link
 *
 * Requires:
 *  - GET  /api/org/getAthletes
 *  - POST /api/org/workouts/create  (expects { date, title, sport, athleteIds, items? })
 */
export default function CreateWorkoutModal({
  open,
  onClose,
  dateISO,          // "YYYY-MM-DD"
  sport,            // "Basketball"
  onCreated,        // callback(newWorkout)
}) {
  const [loadingAthletes, setLoadingAthletes] = useState(false);
  const [athletes, setAthletes] = useState([]);

  const [title, setTitle] = useState("");
  const [status, setStatus] = useState("assigned"); // optional if your backend supports
  const [selected, setSelected] = useState({}); // athleteId -> true
  const [search, setSearch] = useState("");

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
      // Expected athlete shape: { id, name, email, status } etc.
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
    // Load athletes only when modal is opened
    fetchAthletes();
  }, [open, fetchAthletes]);

  const filteredAthletes = useMemo(() => {
    const q = String(search || "").trim().toLowerCase();
    const list = Array.isArray(athletes) ? athletes : [];
    if (!q) return list;

    return list.filter((a) => {
      const name = String(a?.name || "").toLowerCase();
      const email = normalizeEmail(a?.email);
      return name.includes(q) || email.includes(q);
    });
  }, [athletes, search]);

  const selectedIds = useMemo(() => {
    return Object.entries(selected)
      .filter(([, v]) => !!v)
      .map(([k]) => k);
  }, [selected]);

  const toggleAll = (on) => {
    const next = {};
    (filteredAthletes || []).forEach((a) => {
      if (a?.id) next[String(a.id)] = !!on;
    });
    setSelected((prev) => ({ ...prev, ...next }));
  };

  const toggleOne = (id) => {
    const key = String(id || "");
    if (!key) return;
    setSelected((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const submit = async () => {
    setErr("");
    setOkMsg("");

    if (!dateISO) return setErr("Missing date.");
    if (!sport) return setErr("Missing sport.");
    if (!String(title || "").trim()) return setErr("Title is required.");
    if (!selectedIds.length) return setErr("Select at least one athlete.");

    setSaving(true);
    try {
      const res = await fetch("/api/org/workouts/create", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: dateISO,
          title: String(title).trim(),
          status, // only used if backend supports it
          sport,
          athleteIds: selectedIds,
          items: [], // you can expand later from this modal or in the Day drawer
        }),
      });

      const data = await safeJson(res);
      if (!res.ok) throw new Error(data?.error || "Failed to create workout");

      setOkMsg("Workout created!");
      onCreated?.(data?.dailyWorkout || data?.workout || null);

      // close after a short moment
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
      subtitle="Pick athletes, set the title, and create the day’s workout. You can add items right after."
    >
      <div className="space-y-5">
        {/* Context */}
        <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-2">
            <CalendarDays className="w-4 h-4 text-gray-500" />
            <p className="text-sm font-semibold text-gray-900">{dateISO || "—"}</p>
            <Pill>{sport || "—"}</Pill>
          </div>
          <div className="flex items-center gap-2">
            <Dumbbell className="w-4 h-4 text-gray-500" />
            <p className="text-[12px] text-gray-600">
              Selected: <span className="font-semibold">{selectedIds.length}</span>
            </p>
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
            placeholder="e.g. Basketball — Lower Body Power"
          />
        </div>

        {/* Status (optional) */}
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
            <p className="text-xs text-gray-500">Tip</p>
            <p className="text-sm font-semibold text-gray-900 mt-1">
              Create first, add items after
            </p>
            <p className="text-[11px] text-gray-500 mt-2">
              This keeps scheduling fast. Items can be built from the day drawer right after creation.
            </p>
          </div>
        </div>

        {/* Athlete picker */}
        <div className="rounded-2xl border border-gray-200 p-4">
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
              >
                Select shown
              </Button>
              <Button
                variant="secondary"
                className="px-3 py-2 text-xs"
                onClick={() => toggleAll(false)}
                disabled={loadingAthletes || !filteredAthletes.length}
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

          <div className="mt-3">
            <input
              className={inputBase}
              placeholder="Search athletes by name or email…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="mt-3 max-h-[320px] overflow-auto rounded-2xl border border-gray-200">
            {loadingAthletes ? (
              <div className="p-4 text-sm text-gray-600">Loading athletes…</div>
            ) : filteredAthletes.length === 0 ? (
              <div className="p-4 text-sm text-gray-600">No athletes found.</div>
            ) : (
              <ul className="divide-y">
                {filteredAthletes.map((a) => {
                  const id = String(a?.id || "");
                  const checked = !!selected[id];
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
                            {a?.name || "Athlete"}
                          </p>
                          <p className="text-[12px] text-gray-600 break-all">
                            {normalizeEmail(a?.email) || "—"}
                          </p>
                          <div className="mt-2 flex flex-wrap gap-2">
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
