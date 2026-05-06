// components/org/trainers/TrainersTable.js
"use client";

import { useMemo, useState } from "react";
import { Edit3, Trash2, UserPlus, ChevronDown, ChevronUp } from "lucide-react";
import { DS, FONT_CONDENSED } from "./ds.js";
import { RolePill, StatusPill, Btn } from "./ui.js";
import { normalizeEmail } from "@/components/org/trainers/utils/strings";
import { formatET } from "@/components/org/trainers/utils/time";

function fmtDate(v) {
  if (!v) return "-";
  try { return `${formatET(v)} ET`; } catch { return "-"; }
}

/* ── Column config for desktop ── */
const COLS = [
  { key: "name",    label: "Member",  width: "w-[220px]" },
  { key: "email",   label: "Email",   width: "flex-1"    },
  { key: "role",    label: "Role",    width: "w-[110px]" },
  { key: "status",  label: "Status",  width: "w-[110px]" },
  { key: "added",   label: "Added",   width: "w-[160px]" },
  { key: "actions", label: "",        width: "w-[140px]" },
];

/* ─────────────────────────────────────────────────────────
   Bulk action bar - appears above table when rows selected
───────────────────────────────────────────────────────── */
function BulkBar({ count, onDeactivate, onClear }) {
  return (
    <div
      className="flex items-center justify-between gap-4 px-6 py-3"
      style={{ backgroundColor: DS.brandBg, borderBottom: `1px solid ${DS.brandBorder}` }}
    >
      <p className="text-sm font-bold" style={{ color: DS.brand }}>
        {count} member{count !== 1 ? "s" : ""} selected
      </p>
      <div className="flex items-center gap-2">
        <Btn variant="ghost" onClick={onClear} style={{ fontSize: "0.7rem" }}>
          Clear
        </Btn>
        <Btn
          variant="danger"
          onClick={onDeactivate}
          style={{ fontSize: "0.7rem" }}
        >
          <Trash2 className="w-3.5 h-3.5" />
          Deactivate selected
        </Btn>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────
   Empty state
───────────────────────────────────────────────────────── */
function EmptyState({ hasSearch, onInvite, canManage }) {
  if (hasSearch) {
    return (
      <div className="py-16 text-center">
        <p className="text-sm font-bold" style={{ color: DS.bodyText }}>No members match your search.</p>
        <p className="text-xs mt-1" style={{ color: DS.dimText }}>Try a different name, email, or role.</p>
      </div>
    );
  }
  return (
    <div className="py-20 flex flex-col items-center gap-4">
      <div
        className="w-14 h-14 flex items-center justify-center"
        style={{ backgroundColor: DS.brandBg, border: `1px solid ${DS.brandBorder}` }}
      >
        <UserPlus className="w-6 h-6" style={{ color: DS.brand }} />
      </div>
      <div className="text-center">
        <p className="text-sm font-bold" style={{ color: DS.bodyText }}>No staff members yet.</p>
        <p className="text-xs mt-1" style={{ color: DS.dimText }}>
          Invite your first trainer or admin to get started.
        </p>
      </div>
      {canManage && (
        <Btn variant="primary" onClick={onInvite}>
          <UserPlus className="w-3.5 h-3.5" />
          Invite member
        </Btn>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────
   Sort button
───────────────────────────────────────────────────────── */
function SortBtn({ colKey, label, sortKey, sortDir, onSort }) {
  const active = sortKey === colKey;
  return (
    <button
      type="button"
      className="inline-flex items-center gap-1 text-xs font-bold uppercase tracking-widest transition-colors"
      style={{ color: active ? DS.brand : DS.dimText }}
      onClick={() => onSort(colKey)}
    >
      {label}
      {active
        ? sortDir === "asc"
          ? <ChevronUp   className="w-3 h-3" />
          : <ChevronDown className="w-3 h-3" />
        : <ChevronDown className="w-3 h-3 opacity-30" />
      }
    </button>
  );
}

/* ─────────────────────────────────────────────────────────
   Main component
───────────────────────────────────────────────────────── */
export default function TrainersTable({
  rows = [],
  loading = false,
  canManage = false,
  hasSearch = false,
  onEdit,
  onRemove,
  onInvite,
  onBulkDeactivate,
}) {
  const [selected, setSelected] = useState(new Set());
  const [sortKey,  setSortKey]  = useState("name");
  const [sortDir,  setSortDir]  = useState("asc");

  const handleSort = (key) => {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("asc"); }
    setSelected(new Set());
  };

  const sorted = useMemo(() => {
    const list = [...(Array.isArray(rows) ? rows : [])];
    list.sort((a, b) => {
      let av = "", bv = "";
      if (sortKey === "name")   { av = String(a?.Name  || ""); bv = String(b?.Name  || ""); }
      if (sortKey === "email")  { av = String(a?.Email || ""); bv = String(b?.Email || ""); }
      if (sortKey === "role")   { av = String(a?.Role  || ""); bv = String(b?.Role  || ""); }
      if (sortKey === "status") { av = a?.Active ? "1" : "0";  bv = b?.Active ? "1" : "0"; }
      if (sortKey === "added")  { av = String(a?.createdAt || ""); bv = String(b?.createdAt || ""); }
      return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
    });
    return list;
  }, [rows, sortKey, sortDir]);

  const allIds      = sorted.map(r => r?.id).filter(Boolean);
  const allSelected = allIds.length > 0 && allIds.every(id => selected.has(id));

  const toggleAll = () => {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(allIds));
  };

  const toggleOne = (id) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleBulkDeactivate = () => {
    onBulkDeactivate?.(Array.from(selected));
    setSelected(new Set());
  };

  /* ── Loading skeleton ── */
  if (loading) {
    return (
      <div className="bg-white" style={{ border: `1px solid ${DS.border}` }}>
        <div className="px-6 py-12 space-y-3">
          {[1,2,3,4].map(i => (
            <div key={i} className="h-12 animate-pulse" style={{ backgroundColor: DS.pageBg }} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white" style={{ border: `1px solid ${DS.border}` }}>

      {/* Bulk bar */}
      {selected.size > 0 && (
        <BulkBar
          count={selected.size}
          onDeactivate={handleBulkDeactivate}
          onClear={() => setSelected(new Set())}
        />
      )}

      {/* ── Empty state ── */}
      {!loading && sorted.length === 0 && (
        <EmptyState hasSearch={hasSearch} onInvite={onInvite} canManage={canManage} />
      )}

      {/* ── Desktop table ── */}
      {sorted.length > 0 && (
        <>
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full min-w-[700px]">
              <thead>
                <tr style={{ borderBottom: `1px solid ${DS.border}`, backgroundColor: DS.pageBg }}>
                  {/* Checkbox */}
                  <th className="pl-5 pr-3 py-3 w-10">
                    {canManage && (
                      <input
                        type="checkbox"
                        checked={allSelected}
                        onChange={toggleAll}
                        className="cursor-pointer"
                        title="Select all"
                      />
                    )}
                  </th>
                  {COLS.map(({ key, label, width }) => (
                    <th key={key} className={`px-3 py-3 text-left ${width}`}>
                      {label && ["name","email","role","status","added"].includes(key) ? (
                        <SortBtn
                          colKey={key} label={label}
                          sortKey={sortKey} sortDir={sortDir}
                          onSort={handleSort}
                        />
                      ) : (
                        <span className="text-xs font-bold uppercase tracking-widest" style={{ color: DS.dimText }}>
                          {label}
                        </span>
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sorted.map((t) => {
                  const id      = t?.id;
                  const email   = normalizeEmail(t?.Email);
                  const role    = String(t?.Role || "trainer").toLowerCase();
                  const active  = Boolean(t?.Active);
                  const created = t?.createdAt || t?.CreatedAt || t?.createdTime || t?._createdTime || "";
                  const isSel   = selected.has(id);

                  return (
                    <tr
                      key={id || email}
                      style={{
                        borderBottom:    `1px solid ${DS.border}`,
                        backgroundColor: isSel ? DS.brandBg : undefined,
                        transition:      "background-color 0.1s",
                      }}
                      onMouseEnter={e => { if (!isSel) e.currentTarget.style.backgroundColor = DS.cardHover; }}
                      onMouseLeave={e => { if (!isSel) e.currentTarget.style.backgroundColor = ""; }}
                    >
                      {/* Checkbox */}
                      <td className="pl-5 pr-3 py-3">
                        {canManage && id && (
                          <input
                            type="checkbox"
                            checked={isSel}
                            onChange={() => toggleOne(id)}
                            className="cursor-pointer"
                          />
                        )}
                      </td>

                      {/* Member */}
                      <td className="px-3 py-3">
                        <p className="text-sm font-semibold" style={{ color: DS.bodyText }}>
                          {t?.Name || "Member"}
                        </p>
                        <p className="text-xs mt-0.5" style={{ color: DS.dimText }}>
                          {role === "admin" ? "Admin access" : "Trainer access"}
                        </p>
                      </td>

                      {/* Email */}
                      <td className="px-3 py-3">
                        <span className="text-sm break-all" style={{ color: DS.labelText }}>
                          {email || "-"}
                        </span>
                      </td>

                      {/* Role */}
                      <td className="px-3 py-3"><RolePill role={role} /></td>

                      {/* Status */}
                      <td className="px-3 py-3"><StatusPill active={active} /></td>

                      {/* Added */}
                      <td className="px-3 py-3">
                        <span className="text-xs" style={{ color: DS.dimText }}>{fmtDate(created)}</span>
                      </td>

                      {/* Actions */}
                      <td className="px-3 py-3">
                        <div className="flex items-center justify-end gap-2">
                          <Btn
                            variant="ghost"
                            onClick={() => onEdit?.(t)}
                            disabled={!canManage || !id}
                            title={!canManage ? "View only" : "Edit member"}
                            style={{ padding: "0.375rem 0.75rem", fontSize: "0.7rem" }}
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                            Edit
                          </Btn>
                          <Btn
                            variant="ghost"
                            onClick={() => onRemove?.(t)}
                            disabled={!canManage || !id}
                            title={!canManage ? "View only" : "Remove member"}
                            style={{ padding: "0.375rem 0.75rem", fontSize: "0.7rem", borderColor: DS.badBorder, color: DS.bad }}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            Remove
                          </Btn>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* ── Mobile cards ── */}
          <div className="sm:hidden divide-y" style={{ borderColor: DS.border }}>
            {sorted.map((t) => {
              const id      = t?.id;
              const email   = normalizeEmail(t?.Email);
              const role    = String(t?.Role || "trainer").toLowerCase();
              const active  = Boolean(t?.Active);
              const created = t?.createdAt || t?.CreatedAt || t?.createdTime || t?._createdTime || "";
              const isSel   = selected.has(id);

              return (
                <div
                  key={id || email}
                  className="px-5 py-4"
                  style={{ backgroundColor: isSel ? DS.brandBg : DS.cardBg }}
                >
                  {/* Top row */}
                  <div className="flex items-start gap-3">
                    {canManage && id && (
                      <input
                        type="checkbox"
                        checked={isSel}
                        onChange={() => toggleOne(id)}
                        className="mt-1 cursor-pointer shrink-0"
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-bold truncate" style={{ color: DS.bodyText }}>
                            {t?.Name || "Member"}
                          </p>
                          <p className="text-xs mt-0.5 break-all" style={{ color: DS.dimText }}>{email || "-"}</p>
                        </div>
                        <div className="flex flex-col items-end gap-1.5 shrink-0">
                          <RolePill role={role} />
                          <StatusPill active={active} />
                        </div>
                      </div>
                      <p className="text-xs mt-2" style={{ color: DS.dimText }}>
                        Added {fmtDate(created)}
                      </p>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 mt-3">
                    <Btn
                      variant="ghost"
                      onClick={() => onEdit?.(t)}
                      disabled={!canManage || !id}
                      className="flex-1 justify-center"
                      style={{ fontSize: "0.7rem" }}
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      Edit
                    </Btn>
                    <Btn
                      variant="ghost"
                      onClick={() => onRemove?.(t)}
                      disabled={!canManage || !id}
                      className="flex-1 justify-center"
                      style={{ fontSize: "0.7rem", borderColor: DS.badBorder, color: DS.bad }}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Remove
                    </Btn>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Footer count */}
          <div
            className="px-6 py-3 flex items-center justify-between"
            style={{ borderTop: `1px solid ${DS.border}`, backgroundColor: DS.pageBg }}
          >
            <p className="text-xs" style={{ color: DS.dimText }}>
              {sorted.length} member{sorted.length !== 1 ? "s" : ""}
              {selected.size > 0 && ` · ${selected.size} selected`}
            </p>
            {selected.size > 0 && (
              <button
                type="button"
                className="text-xs font-bold transition-opacity hover:opacity-60"
                style={{ color: DS.brand }}
                onClick={() => setSelected(new Set())}
              >
                Clear selection
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}