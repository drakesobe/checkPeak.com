// components/org/trainers/TrainersTable.js
"use client";

import { useMemo, useState } from "react";
import { Edit3, Save, Ban, Trash2 } from "lucide-react";

import Pill from "@/components/org/trainers/ui/Pill";
import Button from "@/components/org/trainers/ui/Button";

import { formatET } from "@/components/org/trainers/utils/time";
import { normalizeEmail } from "@/components/org/trainers/utils/strings";

/* ----------------------------------------------------- */
/* Helpers                                               */
/* ----------------------------------------------------- */

function fmtDateET(value) {
  if (!value) return "—";
  // formatET should already output a nice ET timestamp; we append "ET" for clarity
  return `${formatET(value)} ET`;
}

/* ----------------------------------------------------- */
/* Component                                             */
/* ----------------------------------------------------- */

export default function TrainersTable({
  trainers = [],
  loading = false,
  canManage = false,
  onEditSave,
  onRemoveClick,
}) {
  const rows = useMemo(() => (Array.isArray(trainers) ? trainers : []), [trainers]);

  // Inline edit state (single-row edit at a time)
  const [editRow, setEditRow] = useState(null); // { id, name, email, role, active }
  const [savingId, setSavingId] = useState("");

  const startEdit = (t) => {
    if (!canManage) return;
    setEditRow({
      id: t?.id,
      name: String(t?.Name || ""),
      email: String(t?.Email || ""),
      role: String(t?.Role || "trainer").toLowerCase(),
      active: Boolean(t?.Active),
    });
  };

  const cancelEdit = () => {
    setEditRow(null);
    setSavingId("");
  };

  const saveEdit = async () => {
    if (!editRow?.id) return;
    if (typeof onEditSave !== "function") return;

    const payload = {
      memberId: editRow.id,
      name: String(editRow.name || "").trim(),
      email: normalizeEmail(editRow.email),
      role: String(editRow.role || "trainer").toLowerCase(),
      active: Boolean(editRow.active),
    };

    if (!payload.email || !payload.email.includes("@")) return;
    if (!["trainer", "admin"].includes(payload.role)) return;

    setSavingId(editRow.id);
    try {
      await onEditSave(payload);
      cancelEdit();
    } finally {
      setSavingId("");
    }
  };

  const isEditing = (id) => editRow?.id && String(editRow.id) === String(id);

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-gray-500 border-b">
            <th className="py-3 pr-4">Member</th>
            <th className="py-3 pr-4">Email</th>
            <th className="py-3 pr-4">Role</th>
            <th className="py-3 pr-4">Status</th>
            <th className="py-3 pr-4">Added (ET)</th>
            <th className="py-3 pr-2 text-right">Actions</th>
          </tr>
        </thead>

        <tbody className="divide-y divide-gray-100">
          {/* Empty states */}
          {!loading && rows.length === 0 ? (
            <tr>
              <td colSpan={6} className="py-10 text-center text-gray-500">
                No trainers found.
              </td>
            </tr>
          ) : null}

          {loading ? (
            <tr>
              <td colSpan={6} className="py-10 text-center text-gray-500">
                Loading trainers…
              </td>
            </tr>
          ) : null}

          {/* Rows */}
          {!loading &&
            rows.map((t) => {
              const id = t?.id;
              const editing = isEditing(id);

              const email = normalizeEmail(t?.Email);
              const role = String(t?.Role || "trainer").toLowerCase();
              const active = Boolean(t?.Active);
              const createdAt = t?.createdAt || t?.CreatedAt || t?.createdTime || t?._createdTime || "";

              return (
                <tr key={id || email} className="align-top">
                  {/* Member */}
                  <td className="py-3 pr-4">
                    {editing ? (
                      <div className="space-y-2">
                        <input
                          className="w-full px-4 py-3 rounded-xl border border-gray-300 bg-white text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#46769B]"
                          value={editRow.name}
                          onChange={(e) => setEditRow((p) => ({ ...p, name: e.target.value }))}
                          placeholder="Name"
                        />
                        <div className="text-[11px] text-gray-500">Member name</div>
                      </div>
                    ) : (
                      <>
                        <div className="font-semibold text-gray-900">{t?.Name || "Member"}</div>
                        <div className="text-[11px] text-gray-500">
                          {role === "admin" ? "Admin access" : "Trainer access"}
                        </div>
                      </>
                    )}
                  </td>

                  {/* Email */}
                  <td className="py-3 pr-4">
                    {editing ? (
                      <div className="space-y-2">
                        <input
                          className="w-full px-4 py-3 rounded-xl border border-gray-300 bg-white text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#46769B]"
                          value={editRow.email}
                          onChange={(e) => setEditRow((p) => ({ ...p, email: e.target.value }))}
                          placeholder="email@domain.com"
                        />
                        <div className="text-[11px] text-gray-500">Login email</div>
                      </div>
                    ) : (
                      <div className="text-gray-700 font-medium">{email || "—"}</div>
                    )}
                  </td>

                  {/* Role */}
                  <td className="py-3 pr-4">
                    {editing ? (
                      <select
                        className="w-full px-4 py-3 rounded-xl border border-gray-300 bg-white text-sm"
                        value={editRow.role}
                        onChange={(e) => setEditRow((p) => ({ ...p, role: e.target.value }))}
                      >
                        <option value="trainer">Trainer</option>
                        <option value="admin">Admin</option>
                      </select>
                    ) : (
                      <Pill tone={role === "admin" ? "good" : "neutral"}>{role}</Pill>
                    )}
                  </td>

                  {/* Status */}
                  <td className="py-3 pr-4">
                    {editing ? (
                      <div className="space-y-2">
                        <label className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={!!editRow.active}
                            onChange={(e) => setEditRow((p) => ({ ...p, active: e.target.checked }))}
                          />
                          <span>{editRow.active ? "Active" : "Inactive"}</span>
                        </label>
                        <div className="text-[11px] text-gray-500">Controls org access</div>
                      </div>
                    ) : (
                      <Pill tone={active ? "good" : "warn"}>{active ? "Active" : "Inactive"}</Pill>
                    )}
                  </td>

                  {/* Added */}
                  <td className="py-3 pr-4">
                    <div className="text-gray-700 font-medium">{fmtDateET(createdAt)}</div>
                  </td>

                  {/* Actions */}
                  <td className="py-3 pr-2">
                    <div className="flex justify-end gap-2">
                      {editing ? (
                        <>
                          <Button
                            variant="secondary"
                            className="px-3 py-2 text-xs"
                            onClick={cancelEdit}
                            disabled={savingId === id}
                            title="Cancel"
                          >
                            <Ban className="w-4 h-4" />
                            Cancel
                          </Button>

                          <Button
                            className="px-3 py-2 text-xs"
                            onClick={saveEdit}
                            disabled={savingId === id}
                            title="Save"
                          >
                            <Save className="w-4 h-4" />
                            {savingId === id ? "Saving..." : "Save"}
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button
                            variant="secondary"
                            className="px-3 py-2 text-xs"
                            onClick={() => startEdit(t)}
                            disabled={!canManage || !id}
                            title={!canManage ? "Only Admin/Org can edit" : "Edit member"}
                          >
                            <Edit3 className="w-4 h-4" />
                            Edit
                          </Button>

                          <Button
                            variant="secondary"
                            className="px-3 py-2 text-xs"
                            onClick={() => onRemoveClick?.(t)}
                            disabled={!canManage || !id}
                            title={!canManage ? "Only Admin/Org can remove" : "Deactivate member"}
                          >
                            <Trash2 className="w-4 h-4" />
                            Remove
                          </Button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
        </tbody>
      </table>
    </div>
  );
}
