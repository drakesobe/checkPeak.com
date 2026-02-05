// /components/org/dashboard/EditAthleteModal.jsx
"use client";

import { ArrowRight } from "lucide-react";
import { classNames } from "@/lib/org/dashboard-utils";
import { Button, Modal } from "@/components/org/dashboard/DashboardUI";

export default function EditAthleteModal({
  open,
  athlete,         // { email, name, status, tags, notes }
  setAthlete,      // setter
  saving,
  error,
  onClose,
  onSave,
}) {
  const inputBase =
    "w-full px-4 py-3 rounded-xl border border-gray-300 bg-white text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#46769B]";

  return (
    <Modal
      open={open}
      title={athlete ? `Edit: ${athlete.name || athlete.email}` : "Edit Athlete"}
      onClose={onClose}
    >
      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-3 mb-4">
          <p className="text-sm text-red-700 font-semibold">{error}</p>
        </div>
      ) : null}

      <div className="space-y-4">
        <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
          <p className="text-xs text-gray-500">Athlete</p>
          <p className="text-sm font-extrabold text-gray-900 mt-1 break-words">
            {athlete?.name || "Athlete"}
          </p>
          <p className="text-[12px] text-gray-600 mt-1 break-all">
            {athlete?.email || ""}
          </p>
        </div>

        <div>
          <label className="text-xs text-gray-600 font-semibold">Status</label>
          <select
            className="mt-2 w-full px-4 py-3 rounded-xl border border-gray-300 bg-white text-sm"
            value={athlete?.status || "Active"}
            onChange={(e) =>
              setAthlete((prev) => ({ ...prev, status: e.target.value }))
            }
          >
            <option value="Active">Active</option>
            <option value="Injured">Injured</option>
            <option value="Offseason">Offseason</option>
            <option value="Inactive">Inactive</option>
          </select>
          <p className="text-[11px] text-gray-500 mt-2">
            This becomes a filter later (and can trigger reminders).
          </p>
        </div>

        <div>
          <label className="text-xs text-gray-600 font-semibold">Tags</label>
          <input
            className={classNames(inputBase, "mt-2")}
            placeholder="Comma separated tags (e.g. Cut, High Sweat, Two-a-days)"
            value={(athlete?.tags || []).join(", ")}
            onChange={(e) => {
              const parts = e.target.value
                .split(",")
                .map((x) => x.trim())
                .filter(Boolean);
              setAthlete((prev) => ({ ...prev, tags: parts }));
            }}
          />
          <p className="text-[11px] text-gray-500 mt-2">
            Stored as Airtable multi-select (Tags).
          </p>
        </div>

        <div>
          <label className="text-xs text-gray-600 font-semibold">
            Notes (optional)
          </label>
          <textarea
            className="mt-2 w-full min-h-[90px] px-4 py-3 rounded-xl border border-gray-300 bg-white text-sm"
            placeholder="Anything the coach should remember..."
            value={athlete?.notes || ""}
            onChange={(e) =>
              setAthlete((prev) => ({ ...prev, notes: e.target.value }))
            }
          />
        </div>

        <div className="flex flex-col sm:flex-row justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose} className="w-full sm:w-auto">
            Cancel
          </Button>
          <Button onClick={onSave} disabled={saving} className="w-full sm:w-auto">
            {saving ? "Saving..." : "Save"}
            <ArrowRight className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </Modal>
  );
}
