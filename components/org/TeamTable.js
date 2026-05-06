// components/org/TeamTable.js
"use client";

import { Edit3, Save, Ban, Trash2, Search } from "lucide-react";
import { Button, Pill, roleTone, statusTone, classNames, inputBaseClass } from "./TeamUI";

export default function TeamTable({
  filtered,
  search,
  setSearch,
  canManageMembers,
  fmtDate,
  normalizeEmail,

  editRow,
  setEditRow,
  savingId,

  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  onOpenRemove,
}) {
  const inputBase = inputBaseClass();

  const isEditing = (id) => editRow?.id && String(editRow.id) === String(id);

  return (
    <section className="bg-white rounded-2xl shadow-md border border-blue-100 p-6">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h2 className="text-lg font-extrabold">Team</h2>
          <p className="text-sm text-gray-600 mt-1">Admins and trainers who can access org tools.</p>
          <p className="text-[11px] text-gray-500 mt-1">
            Tip: inactive members stay listed but show as Inactive (reactivate via Edit).
          </p>
        </div>

        <div className="w-full sm:w-[460px] space-y-2">
          <div className="relative">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              className={classNames(inputBase, "pl-10")}
              placeholder="Search by name, email, role…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="mt-5 overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-gray-500 border-b">
              <th className="py-3 pr-4">Member</th>
              <th className="py-3 pr-4">Email</th>
              <th className="py-3 pr-4">Role</th>
              <th className="py-3 pr-4">Status</th>
              <th className="py-3 pr-4">Added</th>
              <th className="py-3 pr-2 text-right">Actions</th>
            </tr>
          </thead>

          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="py-6 text-center text-gray-500">
                  No trainers found.
                  <div className="text-[11px] text-gray-400 mt-1">
                    Ensure <span className="font-mono">/api/org/members/list</span> returns{" "}
                    <span className="font-mono">trainers</span>.
                  </div>
                </td>
              </tr>
            )}

            {filtered.map((t) => {
              const id = t?.id;
              const email = normalizeEmail(t?.Email);
              const editing = isEditing(id);

              const createdAt = t?.createdAt || t?.CreatedAt || "";
              const displayAdded = createdAt ? fmtDate(createdAt) : "-";

              return (
                <tr key={id || email || Math.random()} className="border-b align-top">
                  {/* Member */}
                  <td className="py-3 pr-4">
                    {editing ? (
                      <div className="space-y-2">
                        <input
                          className={inputBase}
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
                          {String(t?.Role || "").toLowerCase() === "admin" ? "Admin access" : "Trainer access"}
                        </div>
                      </>
                    )}
                  </td>

                  {/* Email */}
                  <td className="py-3 pr-4">
                    {editing ? (
                      <div className="space-y-2">
                        <input
                          className={inputBase}
                          value={editRow.email}
                          onChange={(e) => setEditRow((p) => ({ ...p, email: e.target.value }))}
                          placeholder="email@domain.com"
                        />
                        <div className="text-[11px] text-gray-500">Login email</div>
                      </div>
                    ) : (
                      <div className="text-gray-700 font-medium">{email || "-"}</div>
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
                      <Pill tone={roleTone(t?.Role)}>{String(t?.Role || "trainer")}</Pill>
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
                      <Pill tone={statusTone(!!t?.Active)}>{t?.Active ? "Active" : "Inactive"}</Pill>
                    )}
                  </td>

                  {/* Added */}
                  <td className="py-3 pr-4">
                    <div className="text-gray-700 font-medium">{displayAdded}</div>
                  </td>

                  {/* Actions */}
                  <td className="py-3 pr-2">
                    <div className="flex justify-end gap-2">
                      {editing ? (
                        <>
                          <Button
                            variant="secondary"
                            className="px-3 py-2 text-xs"
                            onClick={onCancelEdit}
                            disabled={savingId === id}
                            title="Cancel"
                          >
                            <Ban className="w-4 h-4" />
                            Cancel
                          </Button>

                          <Button
                            className="px-3 py-2 text-xs"
                            onClick={onSaveEdit}
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
                            onClick={() => onStartEdit(t)}
                            disabled={!canManageMembers || !id}
                            title={!canManageMembers ? "Only Admin/Org can edit" : "Edit member"}
                          >
                            <Edit3 className="w-4 h-4" />
                            Edit
                          </Button>

                          <Button
                            variant="secondary"
                            className="px-3 py-2 text-xs"
                            onClick={() => onOpenRemove(t)}
                            disabled={!canManageMembers || !id}
                            title={!canManageMembers ? "Only Admin/Org can remove" : "Deactivate member"}
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

        {editRow?.id ? (
          <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4">
            <p className="text-sm font-extrabold text-amber-900">Editing mode</p>
            <p className="text-[12px] text-amber-800 mt-1">
              You’re editing one member. Save to persist changes, or cancel to discard.
            </p>
          </div>
        ) : null}
      </div>
    </section>
  );
}
