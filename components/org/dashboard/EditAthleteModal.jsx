// components/org/workouts-calendar/EditAthleteModal.jsx
"use client";

import { ArrowRight } from "lucide-react";
import { DS, Button, Modal } from "@/components/org/dashboard/DashboardUI";

export default function EditAthleteModal({
  open, athlete, setAthlete, saving, error, onClose, onSave,
}) {
  const inputStyle = {
    width: "100%", padding: "8px 12px", fontSize: "12px",
    backgroundColor: DS.pageBg, color: DS.bodyText,
    border: `1px solid ${DS.border}`, outline: "none",
    fontFamily: "inherit",
  };

  return (
    <Modal open={open} title={athlete ? `Edit: ${athlete.name || athlete.email}` : "Edit Athlete"} onClose={onClose}>
      {error && (
        <div className="px-3 py-2 mb-4 text-xs font-bold" style={{ backgroundColor: DS.bannedBg, border: `1px solid ${DS.bannedBorder}`, color: DS.banned }}>
          {error}
        </div>
      )}

      <div className="space-y-4">
        {/* Identity (read-only) */}
        <div className="px-3 py-3" style={{ backgroundColor: DS.pageBg, border: `1px solid ${DS.border}`, borderLeft: `3px solid ${DS.brand}` }}>
          <p className="text-xs font-black uppercase tracking-wider" style={{ color: DS.dimText }}>Athlete</p>
          <p className="text-sm font-black mt-1 break-words" style={{ color: DS.bodyText }}>{athlete?.name || "Athlete"}</p>
          <p className="text-xs mt-0.5 break-all" style={{ color: DS.labelText }}>{athlete?.email || ""}</p>
        </div>

        {/* Status */}
        <div>
          <label className="text-xs font-black uppercase tracking-wider" style={{ color: DS.labelText }}>Status</label>
          <select
            className="mt-1.5 block"
            style={{ ...inputStyle, cursor: "pointer" }}
            value={athlete?.status || "Active"}
            onChange={(e) => setAthlete((prev) => ({ ...prev, status: e.target.value }))}
            onFocus={(e)  => { e.target.style.borderColor = DS.brand; }}
            onBlur={(e)   => { e.target.style.borderColor = DS.border; }}
          >
            <option value="Active">Active</option>
            <option value="Injured">Injured</option>
            <option value="Offseason">Offseason</option>
            <option value="Inactive">Inactive</option>
          </select>
          <p className="text-xs mt-1" style={{ color: DS.dimText }}>Powers filters and can trigger reminders.</p>
        </div>

        {/* Tags */}
        <div>
          <label className="text-xs font-black uppercase tracking-wider" style={{ color: DS.labelText }}>Tags</label>
          <input
            className="mt-1.5 block"
            style={inputStyle}
            placeholder="Cut, High Sweat, Two-a-days (comma separated)"
            value={(athlete?.tags || []).join(", ")}
            onChange={(e) => {
              const parts = e.target.value.split(",").map((x) => x.trim()).filter(Boolean);
              setAthlete((prev) => ({ ...prev, tags: parts }));
            }}
            onFocus={(e) => { e.target.style.borderColor = DS.brand; }}
            onBlur={(e)  => { e.target.style.borderColor = DS.border; }}
          />
          <p className="text-xs mt-1" style={{ color: DS.dimText }}>Stored as Airtable multi-select.</p>
        </div>

        {/* Notes */}
        <div>
          <label className="text-xs font-black uppercase tracking-wider" style={{ color: DS.labelText }}>Notes</label>
          <textarea
            className="mt-1.5 block"
            style={{ ...inputStyle, minHeight: "80px", resize: "vertical" }}
            placeholder="Anything the coach should remember…"
            value={athlete?.notes || ""}
            onChange={(e) => setAthlete((prev) => ({ ...prev, notes: e.target.value }))}
            onFocus={(e) => { e.target.style.borderColor = DS.brand; }}
            onBlur={(e)  => { e.target.style.borderColor = DS.border; }}
          />
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={onSave} disabled={saving}>
            {saving ? "Saving…" : "Save"}
            <ArrowRight className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>
    </Modal>
  );
}