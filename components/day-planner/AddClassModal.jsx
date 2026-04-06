// components/day-planner/AddClassModal.jsx
import { useState } from "react";

const DAY_LABELS = ["Su","Mo","Tu","We","Th","Fr","Sa"];

const inputStyle = {
  width: "100%", padding: "10px 14px",
  background: "rgba(255,255,255,0.05)",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 10, color: "#fff", fontSize: 14,
  outline: "none", fontFamily: "inherit",
  transition: "border-color 0.15s",
};

export function AddClassModal({ onSave, onClose }) {
  const [name,  setName]  = useState("");
  const [time,  setTime]  = useState("");
  const [room,  setRoom]  = useState("");
  const [days,  setDays]  = useState([1, 2, 3, 4, 5]); // Mon–Fri default
  const [err,   setErr]   = useState("");

  function toggleDay(d) {
    setDays(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d]);
  }

  function handleSave() {
    if (!name.trim()) { setErr("Class name is required."); return; }
    if (!time.trim()) { setErr("Time is required."); return; }
    if (days.length === 0) { setErr("Select at least one day."); return; }
    onSave({ name: name.trim(), time: time.trim(), room: room.trim(), days });
    onClose();
  }

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 999,
        background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)",
        display: "flex", alignItems: "flex-end", justifyContent: "center",
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        width: "100%", maxWidth: 480,
        background: "#111827",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: "20px 20px 0 0",
        padding: "28px 24px 40px",
      }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
          <div>
            <div style={{
              fontSize: 11, fontWeight: 700, letterSpacing: "0.1em",
              textTransform: "uppercase", color: "#F59E0B", marginBottom: 4,
            }}>
              Add Class
            </div>
            <div style={{ fontSize: 19, fontWeight: 800, color: "#fff" }}>
              New recurring class
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              width: 32, height: 32, borderRadius: 8,
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.1)",
              color: "#9CA3AF", cursor: "pointer", fontSize: 16,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >
            ×
          </button>
        </div>

        {/* Fields */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

          {/* Class name */}
          <div>
            <label style={{
              display: "block", fontSize: 11, fontWeight: 700,
              letterSpacing: "0.08em", textTransform: "uppercase",
              color: "#6B7280", marginBottom: 6,
            }}>
              Class Name *
            </label>
            <input
              value={name}
              onChange={e => { setName(e.target.value); setErr(""); }}
              placeholder="e.g. Sports Nutrition, Exercise Science"
              style={inputStyle}
              onFocus={e  => e.target.style.borderColor = "#F59E0B"}
              onBlur={e   => e.target.style.borderColor = "rgba(255,255,255,0.1)"}
            />
          </div>

          {/* Time + Room */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div>
              <label style={{
                display: "block", fontSize: 11, fontWeight: 700,
                letterSpacing: "0.08em", textTransform: "uppercase",
                color: "#6B7280", marginBottom: 6,
              }}>
                Time *
              </label>
              <input
                value={time}
                onChange={e => { setTime(e.target.value); setErr(""); }}
                placeholder="9:00 AM"
                style={inputStyle}
                onFocus={e => e.target.style.borderColor = "#F59E0B"}
                onBlur={e  => e.target.style.borderColor = "rgba(255,255,255,0.1)"}
              />
            </div>
            <div>
              <label style={{
                display: "block", fontSize: 11, fontWeight: 700,
                letterSpacing: "0.08em", textTransform: "uppercase",
                color: "#6B7280", marginBottom: 6,
              }}>
                Room / Location
              </label>
              <input
                value={room}
                onChange={e => setRoom(e.target.value)}
                placeholder="Room 201"
                style={inputStyle}
                onFocus={e => e.target.style.borderColor = "#F59E0B"}
                onBlur={e  => e.target.style.borderColor = "rgba(255,255,255,0.1)"}
              />
            </div>
          </div>

          {/* Day selector */}
          <div>
            <label style={{
              display: "block", fontSize: 11, fontWeight: 700,
              letterSpacing: "0.08em", textTransform: "uppercase",
              color: "#6B7280", marginBottom: 8,
            }}>
              Repeats On
            </label>
            <div style={{ display: "flex", gap: 6 }}>
              {DAY_LABELS.map((d, i) => {
                const active = days.includes(i);
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => toggleDay(i)}
                    style={{
                      flex: 1, padding: "8px 0",
                      borderRadius: 8, fontSize: 11, fontWeight: 700,
                      cursor: "pointer", transition: "all 0.15s ease",
                      background: active ? "#F59E0B" : "rgba(255,255,255,0.05)",
                      border: `1px solid ${active ? "#F59E0B" : "rgba(255,255,255,0.1)"}`,
                      color: active ? "#000" : "#6B7280",
                    }}
                  >
                    {d}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Error */}
        {err && (
          <div style={{
            marginTop: 12, fontSize: 13, color: "#F87171",
            padding: "8px 12px",
            background: "rgba(239,68,68,0.08)",
            borderRadius: 8, border: "1px solid rgba(239,68,68,0.2)",
          }}>
            {err}
          </div>
        )}

        {/* Save */}
        <button
          onClick={handleSave}
          style={{
            width: "100%", marginTop: 20, padding: "13px",
            background: "#F59E0B", border: "none", borderRadius: 12,
            color: "#000", fontSize: 14, fontWeight: 800,
            cursor: "pointer", letterSpacing: "0.04em",
            fontFamily: "inherit", transition: "opacity 0.15s",
          }}
          onMouseEnter={e => e.currentTarget.style.opacity = "0.9"}
          onMouseLeave={e => e.currentTarget.style.opacity = "1"}
        >
          Add to Schedule
        </button>
      </div>
    </div>
  );
}