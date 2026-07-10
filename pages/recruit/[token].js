// pages/recruit/[token].js
// Public recruiting profile — server-side rendered so OG tags work with all
// social/messaging link preview crawlers and the page loads instantly.

import Head from "next/head";
import { useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { Film, Mail, Zap, Dumbbell, TrendingUp, MessageSquare, ChevronRight, ExternalLink, X, Check, Send, Shield, Play, Lock, Trophy, Eye, Bookmark, BarChart2 } from "lucide-react";
import { sendNotification } from "@/lib/sendNotification";
import { SPORT_STATS, aggregateStats, getFields, getComputed, getFootballGroup } from "@/lib/sportStats";

const C = {
  bg:      "#08090B",
  surface: "#0D0F16",
  card:    "#131620",
  card2:   "#191D28",
  line:    "#1C2030",
  line2:   "#242A3E",
  white:   "#F0F3FA",
  dim:     "rgba(240,243,250,0.80)",
  muted:   "rgba(240,243,250,0.54)",
  faint:   "rgba(240,243,250,0.07)",
  accent:  "#4FABFF",
  green:   "#00C851",
};

// ─── DB helpers ───────────────────────────────────────────────────────────────

function avg(arr) { return arr.length ? arr.reduce((s, v) => s + v, 0) / arr.length : null; }
function max(arr) { return arr.length ? arr.reduce((m, v) => (v > m ? v : m), -Infinity) : null; }
function round1(n) { return n != null ? Math.round(n * 10) / 10 : null; }
function round2(n) { return n != null ? Math.round(n * 100) / 100 : null; }

// ─── Sub-components ───────────────────────────────────────────────────────────

function Avatar({ url, name, size = 72 }) {
  const initials = (name || "A").split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase();
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%", flexShrink: 0,
      background: url ? "transparent" : "linear-gradient(135deg, #1A2540 0%, #0D1530 100%)",
      border: `2px solid ${C.line2}`, overflow: "hidden",
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      {url
        ? <img src={url} alt={name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        : <span style={{ fontSize: size * 0.34, fontWeight: 900, color: C.accent, letterSpacing: "-0.02em" }}>{initials}</span>
      }
    </div>
  );
}

function VerifiedBadge() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 4, padding: "3px 8px", background: "rgba(0,200,81,0.08)", border: "1px solid rgba(0,200,81,0.22)", borderRadius: 4 }}>
      <Shield size={9} color={C.green} />
      <span style={{ fontSize: 8, fontWeight: 900, letterSpacing: "0.14em", color: C.green }}>VERIFIED DATA</span>
    </div>
  );
}

function socialHref(raw, base) {
  if (!raw) return null;
  if (raw.startsWith("http")) return raw;
  const handle = raw.replace(/^@/, "").trim();
  return `${base}/${handle}`;
}

function relativeDate(dateStr) {
  if (!dateStr) return null;
  const days = Math.floor((Date.now() - new Date(dateStr + "T12:00:00").getTime()) / (24 * 60 * 60 * 1000));
  if (days < 7) return "this week";
  if (days < 14) return "last week";
  if (days < 60) return `${Math.floor(days / 7)}w ago`;
  return new Date(dateStr + "T12:00:00").toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

function SectionHeader({ icon: Icon, label, sub, verified }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 18 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <Icon size={15} color={C.accent} />
        <div>
          <div style={{ fontSize: 12, fontWeight: 900, letterSpacing: "0.14em", color: C.accent }}>{label}</div>
          {sub && <div style={{ fontSize: 12, color: C.muted, marginTop: 3, lineHeight: 1.4 }}>{sub}</div>}
        </div>
      </div>
      {verified && <VerifiedBadge />}
    </div>
  );
}

function PRVideoModal({ pr, onClose }) {
  const onBackdrop = (e) => { if (e.target === e.currentTarget) onClose(); };
  return (
    <div onClick={onBackdrop} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.94)", backdropFilter: "blur(10px)", zIndex: 300, display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "max(env(safe-area-inset-top),20px) 20px 16px" }}>
        <div>
          <div style={{ fontSize: 9, fontWeight: 900, letterSpacing: "0.18em", color: "#FFD700", marginBottom: 4, textTransform: "uppercase" }}>PR FILM</div>
          <div style={{ fontSize: 22, fontWeight: 900, color: "#fff", letterSpacing: "-0.03em", lineHeight: 1 }}>
            {pr.exercise}
          </div>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.muted, marginTop: 4 }}>
            {pr.maxWeight} {pr.unit} — verified performance
          </div>
        </div>
        <button onClick={onClose} style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)", width: 36, height: 36, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
          <X size={16} color="rgba(255,255,255,0.7)" />
        </button>
      </div>

      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 16px" }}>
        <video
          src={pr.videoUrl}
          controls
          autoPlay
          playsInline
          style={{ width: "100%", maxWidth: 640, maxHeight: "68dvh", borderRadius: 12, background: "#000", display: "block" }}
        />
      </div>

      <div style={{ padding: "16px 20px", paddingBottom: "calc(env(safe-area-inset-bottom) + 20px)", display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 6, padding: "10px 14px", background: "rgba(0,200,81,0.08)", border: "1px solid rgba(0,200,81,0.22)", borderRadius: 8 }}>
          <Shield size={10} color={C.green} />
          <span style={{ fontSize: 10, fontWeight: 900, letterSpacing: "0.12em", color: C.green }}>VERIFIED · DATA FROM ATHLETE&apos;S TRAINING LOG</span>
        </div>
        <button onClick={onClose} style={{ padding: "13px 24px", background: C.accent, border: "none", borderRadius: 10, fontSize: 13, fontWeight: 800, color: "#fff", cursor: "pointer", fontFamily: "inherit", flexShrink: 0 }}>
          Close
        </button>
      </div>
    </div>
  );
}

function PRGrid({ prs }) {
  const [activeVideo, setActiveVideo] = useState(null);
  if (!prs?.length) return null;

  return (
    <>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))", gap: 8 }}>
        {prs.map((pr, i) => {
          const hasVideo = !!pr.videoUrl;
          return (
            <div
              key={i}
              onClick={hasVideo ? () => setActiveVideo(pr) : undefined}
              style={{
                padding: "14px 14px 12px",
                background: i === 0 ? "rgba(79,171,255,0.06)" : C.faint,
                border: `1px solid ${i === 0 ? "rgba(79,171,255,0.2)" : C.line}`,
                borderRadius: 10,
                cursor: hasVideo ? "pointer" : "default",
                position: "relative",
                transition: hasVideo ? "border-color 0.15s, transform 0.15s" : "none",
              }}
              onMouseEnter={hasVideo ? (e => { e.currentTarget.style.borderColor = "rgba(79,171,255,0.45)"; e.currentTarget.style.transform = "scale(1.02)"; }) : undefined}
              onMouseLeave={hasVideo ? (e => { e.currentTarget.style.borderColor = i === 0 ? "rgba(79,171,255,0.2)" : C.line; e.currentTarget.style.transform = "scale(1)"; }) : undefined}
            >
              <div style={{ display: "flex", alignItems: "baseline", gap: 3 }}>
                <span style={{ fontSize: 22, fontWeight: 900, color: C.white, letterSpacing: "-0.03em", lineHeight: 1 }}>{pr.maxWeight}</span>
                <span style={{ fontSize: 10, fontWeight: 700, color: C.muted }}>{pr.unit}</span>
              </div>
              <div style={{ fontSize: 12, fontWeight: 600, color: C.dim, marginTop: 6, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{pr.exercise}</div>
              {pr.prDate && <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, marginTop: 3 }}>{relativeDate(pr.prDate)}</div>}
              {hasVideo && (
                <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 4 }}>
                  <div style={{ width: 18, height: 18, borderRadius: "50%", background: "rgba(79,171,255,0.15)", border: "1px solid rgba(79,171,255,0.3)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Play size={8} color={C.accent} fill={C.accent} style={{ marginLeft: 1 }} />
                  </div>
                  <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.08em", color: C.accent }}>WATCH</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
      {activeVideo && <PRVideoModal pr={activeVideo} onClose={() => setActiveVideo(null)} />}
    </>
  );
}

function TrainingHeatmap({ heatmapDates, sessions30d }) {
  const today    = new Date();
  const todayStr = today.toISOString().split("T")[0];
  const WEEKS    = 24;
  const DAYS     = WEEKS * 7;
  const CELL     = 12;
  const GAP      = 3;
  const days     = Array.from({ length: DAYS }, (_, i) => {
    const d = new Date(today); d.setDate(d.getDate() - (DAYS - 1 - i));
    return d.toISOString().split("T")[0];
  });
  const weeks  = Array.from({ length: WEEKS }, (_, wi) => days.slice(wi * 7, wi * 7 + 7));
  const active = new Set(heatmapDates);

  const monthLabels = weeks.map(week => {
    const d = new Date(week[0] + "T12:00:00");
    return d.getDate() <= 7 ? d.toLocaleDateString("en-US", { month: "short" }) : "";
  });

  const DAY_LABELS  = ["", "M", "", "W", "", "F", ""];
  const totalActive = heatmapDates.filter(d => days.includes(d)).length;
  const pct         = Math.round((totalActive / DAYS) * 100);

  return (
    <div>
      {/* Scrollable only if needed on narrow screens; on desktop fills ~360px naturally */}
      <div style={{ overflowX: "auto", WebkitOverflowScrolling: "touch", paddingBottom: 4 }}>
        <div style={{ display: "flex", gap: GAP, width: "fit-content" }}>

          {/* Day-of-week label column */}
          <div style={{ display: "flex", flexDirection: "column", gap: GAP, paddingTop: CELL + GAP + 3, flexShrink: 0, width: 14 }}>
            {DAY_LABELS.map((lbl, i) => (
              <div key={i} style={{ height: CELL, display: "flex", alignItems: "center", justifyContent: "flex-end" }}>
                <span style={{ fontSize: 9, fontWeight: 700, color: C.muted }}>{lbl}</span>
              </div>
            ))}
          </div>

          {/* Week columns — fixed cell size, scrollable container handles overflow */}
          {weeks.map((week, wi) => (
            <div key={wi} style={{ display: "flex", flexDirection: "column", gap: GAP, flexShrink: 0 }}>
              <div style={{ height: CELL, display: "flex", alignItems: "center" }}>
                <span style={{ fontSize: 9, fontWeight: 700, color: C.muted, whiteSpace: "nowrap" }}>{monthLabels[wi]}</span>
              </div>
              {week.map((day, di) => {
                const isActive = active.has(day);
                const isToday  = day === todayStr;
                return (
                  <div
                    key={di}
                    title={day}
                    style={{
                      width: CELL, height: CELL, borderRadius: 2,
                      background: isActive ? C.accent : C.faint,
                      opacity: isActive ? 1 : 0.5,
                      boxShadow: isToday ? `0 0 0 1.5px ${C.accent}` : "none",
                    }}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Legend + total */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 10 }}>
        <div style={{ fontSize: 13, color: C.muted }}>
          <span style={{ color: C.white, fontWeight: 800 }}>{totalActive}</span> training days in 6 months
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <span style={{ fontSize: 11, color: C.muted }}>Less</span>
          {[0.08, 0.3, 0.65, 1].map((o, i) => (
            <div key={i} style={{ width: 10, height: 10, borderRadius: 2, background: C.accent, opacity: o }} />
          ))}
          <span style={{ fontSize: 11, color: C.muted }}>More</span>
        </div>
      </div>

      {/* Summary stats */}
      <div style={{ marginTop: 12, display: "flex", gap: 20 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
          <span style={{ fontSize: 22, fontWeight: 900, color: C.green, letterSpacing: "-0.03em" }}>{sessions30d}</span>
          <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.06em", color: C.muted }}>SESSIONS · LAST 30 DAYS</span>
        </div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
          <span style={{ fontSize: 22, fontWeight: 900, color: C.dim, letterSpacing: "-0.03em" }}>{pct}%</span>
          <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.06em", color: C.muted }}>CONSISTENCY</span>
        </div>
      </div>
    </div>
  );
}

function ContactModal({ athleteName, token, onClose }) {
  const [form,   setForm]   = useState({ name: "", email: "", org: "", message: "" });
  const [status, setStatus] = useState("idle");
  const [errMsg, setErrMsg] = useState("");

  const onBackdrop = (e) => { if (e.target === e.currentTarget) onClose(); };

  const canSubmit = form.name.trim() && form.email.includes("@") && form.message.trim().length >= 10;

  const submit = async () => {
    if (!canSubmit || status === "sending") return;
    setStatus("sending"); setErrMsg("");
    try {
      const r = await fetch("/api/recruit/contact", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, senderName: form.name.trim(), senderEmail: form.email.trim(), senderOrg: form.org.trim() || undefined, message: form.message.trim() }),
      });
      const d = await r.json();
      if (!d.ok) throw new Error(d.error || "Failed to send");
      setStatus("success");
    } catch (e) { setStatus("error"); setErrMsg(e.message || "Something went wrong."); }
  };

  const inputStyle = {
    width: "100%", boxSizing: "border-box", padding: "11px 14px",
    background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: 10, fontSize: 14, fontWeight: 500, color: C.white, fontFamily: "inherit", outline: "none",
  };

  return (
    <div onClick={onBackdrop} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", backdropFilter: "blur(4px)", zIndex: 200, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
      <div style={{ width: "100%", maxWidth: 520, background: C.surface, border: `1px solid ${C.line2}`, borderBottom: "none", borderRadius: "20px 20px 0 0", padding: "28px 24px 40px", maxHeight: "90dvh", overflowY: "auto" }}>
        <div style={{ width: 36, height: 4, borderRadius: 2, background: C.line2, margin: "0 auto 24px" }} />
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 800, color: C.white, letterSpacing: "-0.02em" }}>Request information</div>
            <div style={{ fontSize: 12, color: C.muted, marginTop: 4 }}>Message forwarded to {athleteName.split(" ")[0]}</div>
          </div>
          <button onClick={onClose} style={{ background: C.faint, border: `1px solid ${C.line}`, borderRadius: 8, padding: 8, cursor: "pointer", display: "flex" }}>
            <X size={14} color={C.muted} />
          </button>
        </div>

        {status === "success" ? (
          <div style={{ textAlign: "center", padding: "40px 0" }}>
            <div style={{ width: 56, height: 56, borderRadius: "50%", background: "rgba(0,200,81,0.12)", border: "2px solid rgba(0,200,81,0.3)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px" }}>
              <Check size={24} color={C.green} />
            </div>
            <div style={{ fontSize: 18, fontWeight: 800, color: C.white, marginBottom: 10 }}>Message sent</div>
            <div style={{ fontSize: 13, color: C.muted, lineHeight: 1.6 }}>{athleteName.split(" ")[0]} will receive your inquiry and can reply to your email directly.</div>
            <button onClick={onClose} style={{ marginTop: 28, padding: "12px 28px", background: C.faint, border: `1px solid ${C.line2}`, borderRadius: 10, fontSize: 13, fontWeight: 700, color: C.dim, cursor: "pointer", fontFamily: "inherit" }}>Close</button>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 800, letterSpacing: "0.06em", color: C.muted, display: "block", marginBottom: 6 }}>YOUR NAME *</label>
                <input style={inputStyle} placeholder="Coach Smith" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 800, letterSpacing: "0.06em", color: C.muted, display: "block", marginBottom: 6 }}>YOUR EMAIL *</label>
                <input style={inputStyle} placeholder="coach@university.edu" type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} />
              </div>
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 800, letterSpacing: "0.06em", color: C.muted, display: "block", marginBottom: 6 }}>SCHOOL / ORGANIZATION</label>
              <input style={inputStyle} placeholder="State University Athletics" value={form.org} onChange={e => setForm(p => ({ ...p, org: e.target.value }))} />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 800, letterSpacing: "0.06em", color: C.muted, display: "block", marginBottom: 6 }}>MESSAGE *</label>
              <textarea style={{ ...inputStyle, resize: "vertical", lineHeight: 1.6, minHeight: 100 }}
                placeholder={`Hi ${athleteName.split(" ")[0]}, I'm a coach at State University…`}
                value={form.message}
                onChange={e => setForm(p => ({ ...p, message: e.target.value.slice(0, 2000) }))}
                rows={4}
              />
              <div style={{ fontSize: 12, color: C.muted, textAlign: "right", marginTop: 4 }}>{form.message.length}/2000</div>
            </div>
            {status === "error" && (
              <div style={{ padding: "10px 14px", background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)", borderRadius: 8, fontSize: 12, color: "#EF4444" }}>{errMsg}</div>
            )}
            <button onClick={submit} disabled={!canSubmit || status === "sending"} style={{ padding: "14px", background: canSubmit ? C.accent : C.faint, border: `1px solid ${canSubmit ? C.accent : C.line2}`, borderRadius: 12, fontSize: 14, fontWeight: 800, color: canSubmit ? "#fff" : C.muted, cursor: canSubmit ? "pointer" : "not-allowed", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, opacity: status === "sending" ? 0.7 : 1 }}>
              <Send size={14} />
              {status === "sending" ? "Sending…" : "Send message"}
            </button>
            <p style={{ fontSize: 12, color: C.muted, textAlign: "center", margin: 0 }}>
              Your message is routed through CheckPeak — the athlete&apos;s email is not exposed.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function WatchlistModal({ athleteName, athleteFirstName, token, onClose, onSuccess }) {
  const [form,   setForm]   = useState({ name: "", email: "", org: "" });
  const [status, setStatus] = useState("idle");
  const [errMsg, setErrMsg] = useState("");

  const onBackdrop = (e) => { if (e.target === e.currentTarget) onClose(); };
  const canSubmit  = form.name.trim() && form.email.includes("@");

  const submit = async () => {
    if (!canSubmit || status === "sending") return;
    setStatus("sending"); setErrMsg("");
    try {
      const r = await fetch("/api/recruit/watchlist", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, coachName: form.name.trim(), coachEmail: form.email.trim(), coachOrg: form.org.trim() || undefined }),
      });
      const d = await r.json();
      if (!d.ok) throw new Error(d.error || "Failed");
      setStatus("success");
      onSuccess?.();
    } catch (e) { setStatus("error"); setErrMsg(e.message || "Something went wrong."); }
  };

  const inputStyle = {
    width: "100%", boxSizing: "border-box", padding: "11px 14px",
    background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: 10, fontSize: 14, fontWeight: 500, color: C.white, fontFamily: "inherit", outline: "none",
  };

  return (
    <div onClick={onBackdrop} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", backdropFilter: "blur(4px)", zIndex: 200, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
      <div style={{ width: "100%", maxWidth: 520, background: C.surface, border: `1px solid ${C.line2}`, borderBottom: "none", borderRadius: "20px 20px 0 0", padding: "28px 24px 40px", maxHeight: "90dvh", overflowY: "auto" }}>
        <div style={{ width: 36, height: 4, borderRadius: 2, background: C.line2, margin: "0 auto 24px" }} />

        {status === "success" ? (
          <div style={{ textAlign: "center", padding: "32px 0" }}>
            <div style={{ width: 56, height: 56, borderRadius: "50%", background: "rgba(255,215,0,0.1)", border: "2px solid rgba(255,215,0,0.3)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px" }}>
              <Bookmark size={24} color="#FFD700" fill="#FFD700" />
            </div>
            <div style={{ fontSize: 18, fontWeight: 800, color: C.white, marginBottom: 10 }}>You&apos;re watching {athleteFirstName}</div>
            <div style={{ fontSize: 13, color: C.muted, lineHeight: 1.65 }}>
              {athleteFirstName} was notified that a coach is following their progress. You&apos;ll hear from us when they hit new milestones.
            </div>
            <button onClick={onClose} style={{ marginTop: 28, padding: "12px 28px", background: C.faint, border: `1px solid ${C.line2}`, borderRadius: 10, fontSize: 13, fontWeight: 700, color: C.dim, cursor: "pointer", fontFamily: "inherit" }}>Close</button>
          </div>
        ) : (
          <>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 6 }}>
              <div>
                <div style={{ fontSize: 18, fontWeight: 800, color: C.white, letterSpacing: "-0.02em" }}>Watch {athleteFirstName}</div>
                <div style={{ fontSize: 13, color: C.muted, marginTop: 4, lineHeight: 1.5 }}>Get notified when they set new PRs, hit training milestones, or update their profile.</div>
              </div>
              <button onClick={onClose} style={{ background: C.faint, border: `1px solid ${C.line}`, borderRadius: 8, padding: 8, cursor: "pointer", display: "flex", flexShrink: 0 }}>
                <X size={14} color={C.muted} />
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 20 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 800, letterSpacing: "0.06em", color: C.muted, display: "block", marginBottom: 6 }}>YOUR NAME *</label>
                  <input style={inputStyle} placeholder="Coach Smith" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 800, letterSpacing: "0.06em", color: C.muted, display: "block", marginBottom: 6 }}>YOUR EMAIL *</label>
                  <input style={inputStyle} placeholder="coach@university.edu" type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} />
                </div>
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 800, letterSpacing: "0.06em", color: C.muted, display: "block", marginBottom: 6 }}>SCHOOL / ORGANIZATION</label>
                <input style={inputStyle} placeholder="State University Athletics" value={form.org} onChange={e => setForm(p => ({ ...p, org: e.target.value }))} />
              </div>
              {status === "error" && (
                <div style={{ padding: "10px 14px", background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)", borderRadius: 8, fontSize: 12, color: "#EF4444" }}>{errMsg}</div>
              )}
              <button onClick={submit} disabled={!canSubmit || status === "sending"} style={{ padding: "14px", background: canSubmit ? "rgba(255,215,0,0.12)" : C.faint, border: `1px solid ${canSubmit ? "rgba(255,215,0,0.3)" : C.line2}`, borderRadius: 12, fontSize: 14, fontWeight: 800, color: canSubmit ? "#FFD700" : C.muted, cursor: canSubmit ? "pointer" : "not-allowed", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, opacity: status === "sending" ? 0.7 : 1 }}>
                <Bookmark size={15} />
                {status === "sending" ? "Adding…" : `Watch ${athleteFirstName}`}
              </button>
              <p style={{ fontSize: 12, color: C.muted, textAlign: "center", margin: 0 }}>
                {athleteFirstName} will be notified that a coach is watching their development.
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Game Stats Section ───────────────────────────────────────────────────────

const SPORT_LABELS_DISPLAY = {
  football: "Football", basketball: "Basketball", baseball: "Baseball",
  softball: "Softball", soccer: "Soccer", track: "Track & Field",
  swimming: "Swimming", volleyball: "Volleyball", wrestling: "Wrestling",
  lacrosse: "Lacrosse", hockey: "Hockey", tennis: "Tennis",
};

// Compact per-game stat line — "14/22 · 187 yds · 2 TD"
function fmtGameLine(stats, sport, groupKey, roleKey) {
  if (!stats || typeof stats !== "object") return null;
  const s = stats;
  if (sport === "football") {
    const parts = [];
    if (s.att > 0)      parts.push(`${s.comp ?? 0}/${s.att} passing`);
    if (s.pass_yds > 0) parts.push(`${s.pass_yds} yds`);
    if (s.pass_td > 0)  parts.push(`${s.pass_td} TD`);
    if (s.int > 0)      parts.push(`${s.int} INT`);
    if (s.rush_yds > 0) parts.push(`${s.rush_yds} rush`);
    if (s.rush_td > 0 && s.att === 0) parts.push(`${s.rush_td} TD`);
    if (s.rec > 0)      parts.push(`${s.rec} rec`);
    if (s.rec_yds > 0)  parts.push(`${s.rec_yds} yds`);
    if (s.rec_td > 0)   parts.push(`${s.rec_td} TD`);
    if (s.tackles > 0)  parts.push(`${s.tackles} tkl`);
    if (s.sacks > 0)    parts.push(`${s.sacks} sack`);
    return parts.slice(0, 4).join(" · ") || null;
  }
  // Generic: first 3 non-zero numeric fields
  const line = Object.entries(s).filter(([, v]) => typeof v === "number" && v > 0).slice(0, 3).map(([k, v]) => `${v} ${k.replace(/_/g, " ")}`);
  return line.join(" · ") || null;
}

function GameStatsSection({ gameStats, seasonGoals }) {
  if (!gameStats) return null;
  const sportLabel = SPORT_LABELS_DISPLAY[gameStats.sport] || gameStats.sport;
  const goals = seasonGoals || [];

  // ── Track / Swimming (events) ─────────────────────────────────────────────
  if (gameStats.type === "events") {
    return (
      <div style={{ padding: "20px 22px", borderBottom: `1px solid ${C.line}`, animation: "fadeUp 0.35s ease 0.24s both" }}>
        <SectionHeader icon={BarChart2} label="Season Stats" sub={`${sportLabel} · ${gameStats.season} · ${gameStats.gameCount} ${gameStats.gameCount === 1 ? "meet" : "meets"}`} />
        {gameStats.bestMarks.length > 0 && (
          <>
            <div style={{ fontSize: 9, fontWeight: 900, letterSpacing: "0.13em", color: C.muted, marginBottom: 10 }}>BEST MARKS THIS SEASON</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8, marginBottom: 16 }}>
              {gameStats.bestMarks.map((m, i) => (
                <div key={i} style={{ padding: "14px", background: C.card, border: `1px solid ${C.line}`, borderRadius: 10 }}>
                  <div style={{ fontSize: 20, fontWeight: 900, color: C.white, letterSpacing: "-0.02em", lineHeight: 1 }}>{m.mark}</div>
                  <div style={{ fontSize: 10, fontWeight: 900, letterSpacing: "0.08em", color: C.muted, marginTop: 5 }}>{m.event.toUpperCase()}</div>
                  {m.place && <div style={{ fontSize: 11, fontWeight: 700, color: C.accent, marginTop: 3 }}>{m.place}</div>}
                </div>
              ))}
            </div>
          </>
        )}
        {gameStats.recentGames.length > 0 && (
          <>
            <div style={{ fontSize: 9, fontWeight: 900, letterSpacing: "0.13em", color: C.muted, marginBottom: 8 }}>RECENT MEETS</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 1, background: C.line, borderRadius: 10, overflow: "hidden" }}>
              {gameStats.recentGames.map((g, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", background: C.card }}>
                  <span style={{ flex: 1, fontSize: 13, fontWeight: 700, color: C.dim, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{g.opponent || "Meet"}</span>
                  {g.date && <span style={{ fontSize: 11, color: C.muted, flexShrink: 0 }}>{new Date(g.date + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    );
  }

  // ── Standard sport stats ─────────────────────────────────────────────────
  const { totals, computed: computedVals, display, labels, wins, losses, ties, gameCount, season, prevSeason, recentGames, coachVerified = 0 } = gameStats;

  const statTiles = (display || []).map(key => {
    const raw = computedVals?.[key] != null ? computedVals[key] : (totals?.[key] != null ? totals[key] : null);
    if (raw == null || raw === "—") return null;
    const numVal = typeof raw === "number" ? raw : parseFloat(raw);
    const fmtVal = typeof raw === "string" ? raw : (!isNaN(numVal) && numVal >= 1000 ? numVal.toLocaleString() : String(raw));
    return { key, val: fmtVal, label: (labels?.[key] || key).toUpperCase() };
  }).filter(Boolean);

  const recordParts = [wins > 0 ? `${wins}W` : null, losses > 0 ? `${losses}L` : null, ties > 0 ? `${ties}T` : null].filter(Boolean);
  const record = recordParts.length ? recordParts.join("-") : null;
  const allVerified = coachVerified === gameCount && gameCount > 0;

  return (
    <div style={{ padding: "20px 22px", borderBottom: `1px solid ${C.line}`, animation: "fadeUp 0.35s ease 0.24s both" }}>

      {/* ── Section header ── */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: allVerified ? 12 : 18 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <BarChart2 size={14} color={C.accent} />
            <span style={{ fontSize: 13, fontWeight: 900, color: C.white, letterSpacing: "-0.01em" }}>Season Stats</span>
          </div>
          <div style={{ fontSize: 11, color: C.muted, fontWeight: 600 }}>
            {sportLabel} · {season}
            {record && <span style={{ marginLeft: 8, color: C.dim, fontWeight: 700 }}>{record}</span>}
            {prevSeason && <span style={{ marginLeft: 8, color: "rgba(240,243,250,0.25)", fontWeight: 500 }}>prev: {prevSeason.gameCount}g in {prevSeason.season}</span>}
          </div>
        </div>
        {coachVerified > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 10px", background: allVerified ? "rgba(0,200,81,0.1)" : "rgba(0,200,81,0.05)", border: `1px solid ${allVerified ? "rgba(0,200,81,0.35)" : "rgba(0,200,81,0.18)"}`, borderRadius: 6, flexShrink: 0 }}>
            <Shield size={10} color={C.green} strokeWidth={2.5} />
            <span style={{ fontSize: 9, fontWeight: 900, letterSpacing: "0.12em", color: C.green }}>
              {allVerified ? "ALL COACH VERIFIED" : `${coachVerified}/${gameCount} VERIFIED`}
            </span>
          </div>
        )}
      </div>

      {/* ── Trust banner when all games are coach-verified ── */}
      {allVerified && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", background: "rgba(0,200,81,0.07)", border: "1px solid rgba(0,200,81,0.20)", borderRadius: 10, marginBottom: 16 }}>
          <Shield size={14} color={C.green} strokeWidth={2} />
          <div>
            <div style={{ fontSize: 10, fontWeight: 900, letterSpacing: "0.12em", color: C.green, marginBottom: 2 }}>INDEPENDENTLY VERIFIED BY COACHING STAFF</div>
            <div style={{ fontSize: 11, color: "rgba(240,243,250,0.55)", lineHeight: "1.4" }}>
              Every game in this log was recorded directly by {sportLabel} coaches — not self-reported.
            </div>
          </div>
        </div>
      )}

      {/* ── Broadcast stat bar ── */}
      {statTiles.length > 0 && (
        <div style={{ marginBottom: 18 }}>
          {/* Hero stat — first one gets full-width accent treatment */}
          <div style={{ display: "flex", gap: 1, background: C.line, borderRadius: 12, overflow: "hidden", marginBottom: 1 }}>
            <div style={{ flex: "0 0 auto", minWidth: 90, padding: "18px 16px", background: "linear-gradient(135deg, #0F1829 0%, #0B1120 100%)", borderRight: `1px solid ${C.line}`, display: "flex", flexDirection: "column", justifyContent: "center" }}>
              <div style={{ fontSize: 36, fontWeight: 900, color: C.white, letterSpacing: "-0.04em", lineHeight: 1 }}>{statTiles[0].val}</div>
              <div style={{ fontSize: 9, fontWeight: 900, letterSpacing: "0.14em", color: C.accent, marginTop: 6 }}>{statTiles[0].label}</div>
            </div>
            {statTiles.slice(1).map((s) => (
              <div key={s.key} style={{ flex: 1, padding: "14px 10px", background: C.card, textAlign: "center", display: "flex", flexDirection: "column", justifyContent: "center" }}>
                <div style={{ fontSize: 22, fontWeight: 900, color: C.dim, letterSpacing: "-0.03em", lineHeight: 1 }}>{s.val}</div>
                <div style={{ fontSize: 8, fontWeight: 900, letterSpacing: "0.1em", color: C.muted, marginTop: 5 }}>{s.label}</div>
              </div>
            ))}
          </div>
          {/* Divider line with games count */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8, marginBottom: 2 }}>
            <div style={{ flex: 1, height: 1, background: C.line }} />
            <span style={{ fontSize: 9, fontWeight: 700, color: "rgba(240,243,250,0.22)", letterSpacing: "0.1em", whiteSpace: "nowrap" }}>
              SEASON TOTALS · {gameCount} {gameCount === 1 ? "GAME" : "GAMES"}
            </span>
            <div style={{ flex: 1, height: 1, background: C.line }} />
          </div>
        </div>
      )}

      {/* ── Recent games ── */}
      {recentGames.length > 0 && (
        <div>
          <div style={{ fontSize: 9, fontWeight: 900, letterSpacing: "0.14em", color: C.muted, marginBottom: 8 }}>GAME LOG</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {recentGames.map((g, i) => {
              const isWin  = g.result === "W" || g.result === "win";
              const isLoss = g.result === "L" || g.result === "loss";
              const gameLine = fmtGameLine(g.stats, gameStats.sport, gameStats.groupKey, gameStats.roleKey);
              return (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 14px", background: i % 2 === 0 ? C.card : C.surface, borderRadius: 8 }}>
                  {/* Result pill */}
                  <div style={{ width: 22, height: 22, borderRadius: 4, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: isWin ? "rgba(0,200,81,0.15)" : isLoss ? "rgba(239,68,68,0.12)" : C.faint }}>
                    <span style={{ fontSize: 10, fontWeight: 900, color: isWin ? C.green : isLoss ? "#EF4444" : C.muted }}>
                      {g.result ? String(g.result).toUpperCase().slice(0, 1) : "–"}
                    </span>
                  </div>
                  {/* Opponent */}
                  <span style={{ fontSize: 12, fontWeight: 700, color: C.dim, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: "0 0 auto", maxWidth: 100 }}>
                    {g.opponent ? `vs ${g.opponent}` : "Game"}
                  </span>
                  {/* Per-game stat line — the money detail */}
                  {gameLine && (
                    <span style={{ flex: 1, fontSize: 11, fontWeight: 600, color: C.accent, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {gameLine}
                    </span>
                  )}
                  {!gameLine && <span style={{ flex: 1 }} />}
                  {/* Score */}
                  {g.team_score != null && g.opp_score != null && (
                    <span style={{ fontSize: 11, fontWeight: 800, color: isWin ? C.white : C.muted, flexShrink: 0 }}>
                      {g.team_score}–{g.opp_score}
                    </span>
                  )}
                  {/* Coach verified shield */}
                  {g.logged_by === "coach" && (
                    <div title="Coach verified" style={{ flexShrink: 0, display: "flex", alignItems: "center" }}>
                      <Shield size={10} color={C.green} strokeWidth={2.5} />
                    </div>
                  )}
                  {/* Date */}
                  {g.date && (
                    <span style={{ fontSize: 10, color: "rgba(240,243,250,0.28)", flexShrink: 0 }}>
                      {new Date(g.date + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Season goals — visible to recruiters; signals athlete thinks professionally */}
      {goals.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <div style={{ fontSize: 9, fontWeight: 900, letterSpacing: "0.13em", color: C.muted, marginBottom: 10 }}>SEASON GOALS</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {goals.map(g => (
              <div key={g.field_key}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 5 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: g.done ? C.green : C.dim }}>{g.label}</span>
                    {g.done && <span style={{ fontSize: 9, fontWeight: 900, letterSpacing: "0.1em", color: C.green, padding: "2px 7px", background: "rgba(0,200,81,0.1)", borderRadius: 20 }}>REACHED</span>}
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 700, color: C.muted }}>
                    <span style={{ color: g.done ? C.green : C.white }}>{g.current}</span>
                    <span style={{ color: "rgba(240,243,250,0.3)" }}> / {g.target}</span>
                  </span>
                </div>
                <div style={{ height: 5, background: C.faint, borderRadius: 3, overflow: "hidden" }}>
                  <div style={{ height: "100%", borderRadius: 3, background: g.done ? C.green : `linear-gradient(90deg,${C.accent}99,${C.accent})`, width: `${g.pct}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function RecruitPage({ data, token, ogImageUrl }) {
  const [showContact,   setShowContact]   = useState(false);
  const [showWatchlist, setShowWatchlist] = useState(false);
  const [isWatching,    setIsWatching]    = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem(`watching_${token}`) === "1";
  });

  if (!data) return (
    <div style={{ minHeight: "100vh", background: C.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ textAlign: "center", padding: 32 }}>
        <div style={{ marginBottom: 16, display: "flex", justifyContent: "center" }}><Lock size={40} color="rgba(255,255,255,0.35)" strokeWidth={1.3} /></div>
        <div style={{ fontSize: 20, fontWeight: 800, color: C.white, marginBottom: 8 }}>Profile not available</div>
        <div style={{ fontSize: 13, color: C.muted }}>This profile is private or no longer exists.</div>
      </div>
    </div>
  );

  const { profile, athlete, strengthPRs, athleticStats, reel, heatmapDates, trainingStats, viewStats, watchlistCount, gameStats, seasonGoals } = data;

  const name             = athlete?.name  || "Athlete";
  const sport            = profile.sport  || null;
  const position         = profile.position || null;
  const school           = profile.school   || null;
  const gradYear         = profile.graduation_year || null;
  const height           = profile.height   || null;
  const weight           = profile.weight   || null;
  const gpa              = profile.gpa      || null;
  const satScore         = profile.sat_score         || null;
  const actScore         = profile.act_score         || null;
  const recruitingStatus = profile.recruiting_status || null;
  const topSchools       = profile.top_schools       || [];
  const familyStatement  = profile.family_statement  || null;
  const bio              = profile.bio      || null;
  const achievements     = profile.achievements  || [];
  const avatarUrl        = profile.avatar_url    || null;
  const hudlUrl          = profile.hudl_url      || null;
  const instagramUrl     = profile.instagram_url || null;
  const twitterUrl       = profile.twitter_url   || null;
  const maxprepsUrl      = profile.maxpreps_url  || null;
  const hasContact       = !!athlete?.email;
  const hasSocial        = !!(instagramUrl || twitterUrl || maxprepsUrl);

  const isCommitted  = recruitingStatus === "committed" || recruitingStatus === "signed";
  const statusLabel  = recruitingStatus === "signed" ? "SIGNED" : recruitingStatus === "committed" ? "COMMITTED" : recruitingStatus === "open" ? "OPEN TO OFFERS" : null;
  const statusColor  = recruitingStatus === "signed" ? "#FFD700" : recruitingStatus === "committed" ? C.green : C.accent;
  const statusBg     = recruitingStatus === "signed" ? "rgba(255,215,0,0.07)" : recruitingStatus === "committed" ? "rgba(0,200,81,0.06)" : "rgba(79,171,255,0.06)";
  const statusBorder = recruitingStatus === "signed" ? "rgba(255,215,0,0.25)" : recruitingStatus === "committed" ? "rgba(0,200,81,0.2)" : "rgba(79,171,255,0.2)";

  const hasAthletics = athleticStats && (athleticStats.peakSpeed || athleticStats.avgSpeed);
  const hasStrength  = strengthPRs?.length > 0;
  const hasHeatmap   = (heatmapDates?.length > 0) || (trainingStats?.sessions30d > 0);
  const hasFilm      = !!(reel || hudlUrl);


  const pageTitle = `${name}${sport ? ` · ${sport}` : ""}${position ? ` · ${position}` : ""}`;
  const pageDesc  = bio || `Recruiting profile for ${name}${school ? ` at ${school}` : ""}. Powered by CheckPeak.`;

  const featuredStat = null; // removed — PRs live in Strength Profile below

  const levelLabel         = profile.level === "highschool" ? "HS" : profile.level === "college" ? "College" : profile.level === "pro" ? "Pro" : null;
  const avgSessionsPerWeek = trainingStats.avgSessionsPerWeek ?? 0;
  const trendDelta         = trainingStats.trendDelta ?? null;
  const trainingAgeMonths  = trainingStats.trainingSince
    ? Math.max(1, Math.round((Date.now() - new Date(trainingStats.trainingSince + "T12:00:00").getTime()) / (30.5 * 24 * 60 * 60 * 1000)))
    : null;

  const showTrend    = trendDelta != null && trendDelta !== 0;
  const insightCount = [trainingAgeMonths, avgSessionsPerWeek > 0, showTrend].filter(Boolean).length;

  return (
    <>
      <Head>
        <title>{pageTitle} · CheckPeak</title>
        <meta name="description"        content={pageDesc} />
        <meta name="viewport"           content="width=device-width, initial-scale=1" />
        <meta name="robots"             content="index, follow" />
        <meta property="og:type"        content="profile" />
        <meta property="og:title"       content={`${pageTitle} · CheckPeak Recruiting Profile`} />
        <meta property="og:description" content={pageDesc} />
        {ogImageUrl && <meta property="og:image"       content={ogImageUrl} />}
        {ogImageUrl && <meta property="og:image:width"  content="1200" />}
        {ogImageUrl && <meta property="og:image:height" content="630" />}
        <meta name="twitter:card"       content="summary_large_image" />
        <meta name="twitter:title"      content={`${pageTitle} · CheckPeak`} />
        <meta name="twitter:description" content={pageDesc} />
        {ogImageUrl && <meta name="twitter:image" content={ogImageUrl} />}
      </Head>

      <style>{`
        *{box-sizing:border-box;margin:0;padding:0}
        body{background:${C.bg};color:${C.white};font-family:-apple-system,"SF Pro Display","Helvetica Neue",sans-serif;-webkit-font-smoothing:antialiased}
        @keyframes fadeUp{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}
        ::-webkit-scrollbar{width:4px;height:4px}
        ::-webkit-scrollbar-thumb{background:${C.line2};border-radius:2px}
      `}</style>

      {/* Sticky action bar — always accessible while scrolling */}
      <div style={{ position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)", width: "100%", maxWidth: 640, zIndex: 90, pointerEvents: "none", padding: "52px 20px 24px", background: `linear-gradient(to top, ${C.bg} 55%, transparent 100%)` }}>
        <div style={{ display: "flex", gap: 10, pointerEvents: "all" }}>
          {/* Watchlist button */}
          <button
            onClick={() => { if (!isWatching) setShowWatchlist(true); }}
            style={{
              flexShrink: 0, padding: "15px 18px",
              background: isWatching ? "rgba(255,215,0,0.1)" : C.faint,
              border: `1px solid ${isWatching ? "rgba(255,215,0,0.35)" : C.line2}`,
              borderRadius: 14, fontSize: 13, fontWeight: 800,
              color: isWatching ? "#FFD700" : C.dim,
              cursor: isWatching ? "default" : "pointer", fontFamily: "inherit",
              display: "flex", alignItems: "center", gap: 7,
            }}
          >
            <Bookmark size={15} fill={isWatching ? "#FFD700" : "none"} />
            {isWatching ? "Watching" : "Watch"}
          </button>
          {/* Contact button */}
          <button
            onClick={() => setShowContact(true)}
            style={{ flex: 1, padding: "15px 24px", background: "linear-gradient(135deg, #5BB8FF 0%, #3B8FDB 100%)", border: "none", borderRadius: 14, fontSize: 15, fontWeight: 800, color: "#fff", cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 9, letterSpacing: "-0.01em", boxShadow: "0 4px 28px rgba(79,171,255,0.28)" }}
          >
            <Mail size={16} />
            Contact {name.split(" ")[0]}
          </button>
        </div>
      </div>

      <div style={{ maxWidth: 640, margin: "0 auto", padding: "0 0 160px" }}>

        {/* Top bar */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px 22px 0" }}>
          <span style={{ fontSize: 13, fontWeight: 900, letterSpacing: "0.1em", color: C.accent }}>CHECKPEAK</span>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {sport && (
              <span style={{ fontSize: 11, fontWeight: 900, letterSpacing: "0.1em", padding: "4px 10px", borderRadius: 4, background: "rgba(79,171,255,0.08)", border: "1px solid rgba(79,171,255,0.22)", color: C.accent }}>
                {sport.toUpperCase()}
              </span>
            )}
            <span style={{ fontSize: 11, fontWeight: 700, color: C.muted, letterSpacing: "0.04em" }}>Recruiting Profile</span>
          </div>
        </div>

        {/* ── HERO ── */}
        <div style={{ borderBottom: `1px solid ${C.line}`, animation: "fadeUp 0.35s ease both" }}>

          {/* Identity row */}
          <div style={{ display: "flex", alignItems: "flex-start", gap: 16, padding: "22px 22px 20px" }}>
            <Avatar url={avatarUrl} name={name} size={80} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 26, fontWeight: 900, color: C.white, letterSpacing: "-0.03em", lineHeight: 1.1 }}>{name}</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
                {position && <span style={{ fontSize: 12, fontWeight: 800, color: C.accent, padding: "3px 10px", background: "rgba(79,171,255,0.08)", border: "1px solid rgba(79,171,255,0.22)", borderRadius: 5 }}>{position}</span>}
                {levelLabel && gradYear && <span style={{ fontSize: 12, fontWeight: 700, color: C.dim, padding: "3px 10px", background: C.faint, border: `1px solid ${C.line}`, borderRadius: 5 }}>{levelLabel} · Class of {gradYear}</span>}
                {levelLabel && !gradYear && <span style={{ fontSize: 12, fontWeight: 700, color: C.dim, padding: "3px 10px", background: C.faint, border: `1px solid ${C.line}`, borderRadius: 5 }}>{levelLabel}</span>}
                {!levelLabel && gradYear && <span style={{ fontSize: 12, fontWeight: 700, color: C.dim, padding: "3px 10px", background: C.faint, border: `1px solid ${C.line}`, borderRadius: 5 }}>Class of {gradYear}</span>}
              </div>
              {school && <div style={{ fontSize: 13, color: C.muted, fontWeight: 600, marginTop: 7 }}>📍 {school}</div>}

              {/* Achievements inline — part of identity, not a separate section */}
              {achievements.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
                  {achievements.map((a, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 4, padding: "3px 10px", background: i === 0 ? "rgba(255,215,0,0.07)" : C.faint, border: `1px solid ${i === 0 ? "rgba(255,215,0,0.22)" : C.line}`, borderRadius: 20, fontSize: 12, fontWeight: 700, color: i === 0 ? "#FFD700" : C.dim }}>
                      {i === 0 && <Trophy size={10} color="#FFD700" strokeWidth={2} />}
                      {a}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Stat bar — physical measurables + academics */}
          {(() => {
            const testScore = satScore ? { value: satScore, label: "SAT" } : actScore ? { value: actScore, label: "ACT" } : null;
            const statItems = [
              height ? { value: height, label: "HEIGHT" } : null,
              weight ? { value: String(weight).match(/lb|kg/i) ? weight : `${weight} lb`, label: "WEIGHT" } : null,
              gpa ? { value: gpa, label: "GPA" } : null,
              testScore,
            ].filter(Boolean);
            if (!statItems.length) return null;
            return (
              <div style={{ display: "flex", borderTop: `1px solid ${C.line}` }}>
                {statItems.map((s, i) => (
                  <div key={i} style={{ flex: 1, padding: "13px 0", textAlign: "center", borderRight: i < statItems.length - 1 ? `1px solid ${C.line}` : "none" }}>
                    <div style={{ fontSize: 17, fontWeight: 900, color: C.white, letterSpacing: "-0.02em", lineHeight: 1 }}>{s.value}</div>
                    <div style={{ fontSize: 9, fontWeight: 900, letterSpacing: "0.09em", color: C.muted, marginTop: 4 }}>{s.label}</div>
                  </div>
                ))}
              </div>
            );
          })()}

          {/* Social proof strip — views + watchlist */}
          {(viewStats.total > 1 || watchlistCount > 0) && (
            <div style={{ padding: "8px 22px", borderTop: `1px solid ${C.line}`, display: "flex", alignItems: "center", gap: 14 }}>
              {viewStats.total > 1 && (
                <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  <Eye size={10} color={C.muted} />
                  <span style={{ fontSize: 11, color: C.muted }}>
                    <span style={{ color: C.dim, fontWeight: 700 }}>{viewStats.thisWeek > 0 ? viewStats.thisWeek + 1 : viewStats.total}</span>
                    {viewStats.thisWeek > 0 ? " coaches this week" : " total views"}
                  </span>
                </div>
              )}
              {watchlistCount > 0 && (
                <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  <Bookmark size={10} color="#FFD700" fill="#FFD700" />
                  <span style={{ fontSize: 11, color: C.muted }}>
                    <span style={{ color: "#FFD700", fontWeight: 700 }}>{watchlistCount}</span> {watchlistCount === 1 ? "coach" : "coaches"} watching
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── RECRUITING STATUS ── */}
        {statusLabel && (
          <div style={{ padding: "12px 22px", borderBottom: `1px solid ${C.line}`, background: statusBg, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10, animation: "fadeUp 0.35s ease 0.05s both" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: 7, height: 7, borderRadius: "50%", background: statusColor, boxShadow: `0 0 6px ${statusColor}` }} />
              <span style={{ fontSize: 12, fontWeight: 900, letterSpacing: "0.1em", color: statusColor }}>{statusLabel}</span>
            </div>
            {topSchools.length > 0 && (
              <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                {isCommitted
                  ? <span style={{ fontSize: 12, fontWeight: 700, color: statusColor }}>{topSchools[0]}</span>
                  : topSchools.map((s, i) => (
                      <span key={i} style={{ fontSize: 12, fontWeight: 700, color: C.dim, padding: "2px 9px", background: C.faint, border: `1px solid ${C.line}`, borderRadius: 20 }}>
                        {s}
                      </span>
                    ))
                }
              </div>
            )}
          </div>
        )}

        {/* ── FILM — coaches watch before reading the numbers ── */}
        {hasFilm && (
          <div style={{ padding: "20px 22px", borderBottom: `1px solid ${C.line}`, animation: "fadeUp 0.35s ease 0.1s both" }}>
            <SectionHeader icon={Film} label="Film" sub="Highlight reel & game footage" />
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {reel && (
                <a href={`/reel/${reel.shareToken}`} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none" }}>
                  <div
                    style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 18px", background: "rgba(79,171,255,0.05)", border: "1px solid rgba(79,171,255,0.2)", borderRadius: 12, cursor: "pointer", transition: "border-color 0.15s" }}
                    onMouseEnter={e => e.currentTarget.style.borderColor = "rgba(79,171,255,0.42)"}
                    onMouseLeave={e => e.currentTarget.style.borderColor = "rgba(79,171,255,0.2)"}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <div style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(79,171,255,0.12)", border: "1px solid rgba(79,171,255,0.25)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        <Play size={14} color={C.accent} fill={C.accent} style={{ marginLeft: 2 }} />
                      </div>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: C.white, marginBottom: 2 }}>{reel.title || "Highlight Reel"}</div>
                        <div style={{ fontSize: 13, color: C.muted, fontWeight: 600 }}>{reel.playCount} {reel.playCount === 1 ? "play" : "plays"} · curated by the athlete</div>
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                      <span style={{ fontSize: 13, fontWeight: 800, color: C.accent }}>Watch</span>
                      <ChevronRight size={14} color={C.accent} />
                    </div>
                  </div>
                </a>
              )}
              {hudlUrl && (
                <a href={hudlUrl} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 18px", background: C.card, border: `1px solid ${C.line2}`, borderRadius: 12, cursor: "pointer" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <div style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(255,165,0,0.08)", border: "1px solid rgba(255,165,0,0.2)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        <Film size={14} color="#FFA500" />
                      </div>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: C.white, marginBottom: 2 }}>Hudl Profile</div>
                        <div style={{ fontSize: 13, color: C.muted, fontWeight: 600 }}>Full game film</div>
                      </div>
                    </div>
                    <ExternalLink size={14} color={C.muted} />
                  </div>
                </a>
              )}
            </div>
          </div>
        )}

        {/* ── BIO + SOCIAL — identity in one block ── */}
        {(bio || hasSocial) && (
          <div style={{ padding: "20px 22px", borderBottom: `1px solid ${C.line}`, animation: "fadeUp 0.35s ease 0.14s both" }}>
            {bio && (
              <>
                <div style={{ fontSize: 10, fontWeight: 900, letterSpacing: "0.13em", color: C.muted, marginBottom: 14 }}>IN THEIR OWN WORDS</div>
                <div style={{ paddingLeft: 14, borderLeft: `2px solid rgba(79,171,255,0.3)` }}>
                  <p style={{ fontSize: 15, fontWeight: 500, color: C.dim, lineHeight: 1.8, margin: "0 0 10px", fontStyle: "italic" }}>{bio}</p>
                  <span style={{ fontSize: 12, fontWeight: 700, color: C.muted }}>— {name}</span>
                </div>
              </>
            )}
            {hasSocial && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginTop: bio ? 16 : 0 }}>
                {instagramUrl && (
                  <a href={socialHref(instagramUrl, "https://instagram.com")} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: 6, padding: "7px 12px", background: "rgba(225,48,108,0.07)", border: "1px solid rgba(225,48,108,0.2)", borderRadius: 7, fontSize: 12, fontWeight: 700, color: "#E1306C" }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none"/></svg>
                    Instagram
                  </a>
                )}
                {twitterUrl && (
                  <a href={socialHref(twitterUrl, "https://x.com")} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: 6, padding: "7px 12px", background: C.faint, border: `1px solid ${C.line}`, borderRadius: 7, fontSize: 12, fontWeight: 700, color: C.dim }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.746l7.73-8.835L1.254 2.25H8.08l4.253 5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
                    Twitter / X
                  </a>
                )}
                {maxprepsUrl && (
                  <a href={maxprepsUrl.startsWith("http") ? maxprepsUrl : `https://${maxprepsUrl}`} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: 6, padding: "7px 12px", background: "rgba(79,171,255,0.06)", border: "1px solid rgba(79,171,255,0.18)", borderRadius: 7, fontSize: 12, fontWeight: 700, color: C.accent }}>
                    <ExternalLink size={11} />
                    MaxPreps
                  </a>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── FAMILY MESSAGE ── */}
        {familyStatement && (
          <div style={{ padding: "20px 22px", borderBottom: `1px solid ${C.line}`, animation: "fadeUp 0.35s ease 0.18s both" }}>
            <div style={{ fontSize: 10, fontWeight: 900, letterSpacing: "0.13em", color: C.muted, marginBottom: 14 }}>FROM THE FAMILY</div>
            <div style={{ paddingLeft: 14, borderLeft: `2px solid rgba(255,215,0,0.35)` }}>
              <p style={{ fontSize: 15, fontWeight: 500, color: C.dim, lineHeight: 1.8, margin: "0 0 10px", fontStyle: "italic" }}>{familyStatement}</p>
              <span style={{ fontSize: 12, fontWeight: 700, color: C.muted }}>— {name.split(" ")[1] || name.split(" ")[0]} Family</span>
            </div>
          </div>
        )}

        {/* ── DATA VERIFICATION ── */}
        {(hasStrength || hasAthletics || hasHeatmap) && (
          <div style={{ padding: "9px 22px", display: "flex", alignItems: "center", gap: 7, borderBottom: `1px solid ${C.line}`, background: "rgba(0,200,81,0.02)" }}>
            <Shield size={11} color={C.green} style={{ flexShrink: 0 }} />
            <span style={{ fontSize: 11, color: "rgba(0,200,81,0.75)", fontWeight: 700, letterSpacing: "0.01em" }}>
              All performance data is verified — logged live from the athlete&apos;s phone, not self-reported.
            </span>
          </div>
        )}

        {/* ── SEASON STATS ── */}
        <GameStatsSection gameStats={gameStats} seasonGoals={seasonGoals || []} />

        {/* ── TRAINING COMMITMENT — work ethic is a coachability signal ── */}
        {hasHeatmap && (
          <div style={{ padding: "20px 22px", borderBottom: `1px solid ${C.line}`, animation: "fadeUp 0.35s ease 0.22s both" }}>
            <SectionHeader
              icon={TrendingUp}
              label="Training Commitment"
              sub={trainingStats.trainingSince ? `Logging since ${new Date(trainingStats.trainingSince + "T12:00:00").toLocaleDateString("en-US", { month: "long", year: "numeric" })}` : "Real-time workout log"}
            />
            {insightCount > 0 && (
              <div style={{ display: "grid", gridTemplateColumns: `repeat(${insightCount}, 1fr)`, gap: 8, marginBottom: 18 }}>
                {trainingAgeMonths && (
                  <div style={{ padding: "12px 14px", background: C.faint, border: `1px solid ${C.line}`, borderRadius: 10, textAlign: "center" }}>
                    <div style={{ fontSize: 22, fontWeight: 900, color: C.white, letterSpacing: "-0.03em", lineHeight: 1 }}>{trainingAgeMonths}</div>
                    <div style={{ fontSize: 10, fontWeight: 900, letterSpacing: "0.08em", color: C.muted, marginTop: 4 }}>MONTHS ACTIVE</div>
                  </div>
                )}
                {avgSessionsPerWeek > 0 && (
                  <div style={{ padding: "12px 14px", background: C.faint, border: `1px solid ${C.line}`, borderRadius: 10, textAlign: "center" }}>
                    <div style={{ fontSize: 22, fontWeight: 900, color: C.white, letterSpacing: "-0.03em", lineHeight: 1 }}>{avgSessionsPerWeek}</div>
                    <div style={{ fontSize: 10, fontWeight: 900, letterSpacing: "0.08em", color: C.muted, marginTop: 4 }}>SESSIONS / WEEK</div>
                  </div>
                )}
                {showTrend && (
                  <div style={{ padding: "12px 14px", background: trendDelta > 0 ? "rgba(0,200,81,0.05)" : "rgba(239,68,68,0.04)", border: `1px solid ${trendDelta > 0 ? "rgba(0,200,81,0.18)" : "rgba(239,68,68,0.18)"}`, borderRadius: 10, textAlign: "center" }}>
                    <div style={{ fontSize: 22, fontWeight: 900, color: trendDelta > 0 ? C.green : "#EF4444", letterSpacing: "-0.03em", lineHeight: 1 }}>{trendDelta > 0 ? `+${trendDelta}` : trendDelta}</div>
                    <div style={{ fontSize: 10, fontWeight: 900, letterSpacing: "0.08em", color: C.muted, marginTop: 4 }}>VS PREV 6 WKS</div>
                  </div>
                )}
              </div>
            )}
            <TrainingHeatmap heatmapDates={heatmapDates} sessions30d={trainingStats.sessions30d} />
          </div>
        )}

        {/* ── STRENGTH PROFILE ── */}
        {hasStrength && (
          <div style={{ padding: "20px 22px", borderBottom: `1px solid ${C.line}`, animation: "fadeUp 0.35s ease 0.28s both" }}>
            <SectionHeader icon={Dumbbell} label="Strength Profile" sub={`${trainingStats.totalExercises} exercises tracked · personal records from real sessions`} />
            <PRGrid prs={strengthPRs} />
            <p style={{ fontSize: 12, color: C.muted, marginTop: 10, lineHeight: 1.5 }}>Cards with ▶ include video of the actual set — tap to watch.</p>
          </div>
        )}

        {/* ── ATHLETIC PERFORMANCE — from game film ── */}
        {hasAthletics && (
          <div style={{ padding: "20px 22px", borderBottom: `1px solid ${C.line}`, animation: "fadeUp 0.35s ease 0.34s both" }}>
            <SectionHeader icon={Zap} label="Athletic Performance" sub={`GPS data · ${athleticStats.filmCount} game ${athleticStats.filmCount === 1 ? "film" : "films"} · ${athleticStats.playCount} tracked plays`} />
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(80px, 1fr))", border: `1px solid ${C.line}`, borderRadius: 12, overflow: "hidden", background: C.card }}>
              {athleticStats.peakSpeed != null && (
                <div style={{ padding: "18px 14px", textAlign: "center", borderRight: `1px solid ${C.line}` }}>
                  <div style={{ fontSize: 28, fontWeight: 900, color: C.accent, letterSpacing: "-0.04em", lineHeight: 1 }}>{athleticStats.peakSpeed}</div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, marginTop: 2 }}>mph</div>
                  <div style={{ fontSize: 10, fontWeight: 900, letterSpacing: "0.08em", color: C.muted, marginTop: 6 }}>PEAK SPEED</div>
                </div>
              )}
              {athleticStats.avgSpeed != null && (
                <div style={{ padding: "18px 14px", textAlign: "center", borderRight: athleticStats.avgAccel != null ? `1px solid ${C.line}` : "none" }}>
                  <div style={{ fontSize: 28, fontWeight: 900, color: C.white, letterSpacing: "-0.04em", lineHeight: 1 }}>{athleticStats.avgSpeed}</div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, marginTop: 2 }}>mph</div>
                  <div style={{ fontSize: 10, fontWeight: 900, letterSpacing: "0.08em", color: C.muted, marginTop: 6 }}>AVG SPEED</div>
                </div>
              )}
              {athleticStats.avgAccel != null && (
                <div style={{ padding: "18px 14px", textAlign: "center" }}>
                  <div style={{ fontSize: 28, fontWeight: 900, color: C.white, letterSpacing: "-0.04em", lineHeight: 1 }}>{athleticStats.avgAccel}</div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, marginTop: 2 }}>m/s²</div>
                  <div style={{ fontSize: 10, fontWeight: 900, letterSpacing: "0.08em", color: C.muted, marginTop: 6 }}>ACCELERATION</div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── COACH PROMO FOOTER ── */}
        <div style={{ margin: "36px 22px 0", padding: "24px", background: C.surface, border: `1px solid ${C.line2}`, borderRadius: 14, animation: "fadeUp 0.35s ease 0.40s both" }}>
          <div style={{ fontSize: 10, fontWeight: 900, letterSpacing: "0.14em", color: C.accent, marginBottom: 8 }}>FOR COACHES & RECRUITERS</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: C.white, letterSpacing: "-0.02em", lineHeight: 1.3, marginBottom: 16 }}>
            Every stat on this page came from real training — not a questionnaire.
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
            {[
              ["Roster training & nutrition tracking", C.accent],
              ["Film library, highlight reels & PR video", C.accent],
              ["Strength PRs with verified in-session video", C.accent],
            ].map(([line, color], i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", background: C.faint, borderRadius: 8 }}>
                <Check size={13} color={color} strokeWidth={2.5} style={{ flexShrink: 0 }} />
                <span style={{ fontSize: 13, fontWeight: 600, color: C.dim }}>{line}</span>
              </div>
            ))}
          </div>
          <a href="/" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 7, padding: "14px 24px", background: "linear-gradient(135deg, #5BB8FF 0%, #3B8FDB 100%)", borderRadius: 10, fontSize: 14, fontWeight: 800, color: "#fff", textDecoration: "none", boxShadow: "0 4px 20px rgba(79,171,255,0.22)" }}>
            Get CheckPeak free <ChevronRight size={15} />
          </a>
        </div>

        {/* Footer */}
        <div style={{ padding: "24px 22px 0", textAlign: "center", borderTop: `1px solid ${C.line}`, marginTop: 28 }}>
          <div style={{ fontSize: 11, color: "rgba(240,243,250,0.25)", fontWeight: 600, letterSpacing: "0.05em" }}>
            Powered by <span style={{ color: "rgba(79,171,255,0.5)" }}>CHECKPEAK</span>
          </div>
        </div>

      </div>

      {showContact   && <ContactModal   athleteName={name} token={token} onClose={() => setShowContact(false)} />}
      {showWatchlist && (
        <WatchlistModal
          athleteName={name}
          athleteFirstName={name.split(" ")[0]}
          token={token}
          onClose={() => setShowWatchlist(false)}
          onSuccess={() => {
            setIsWatching(true);
            if (typeof window !== "undefined") localStorage.setItem(`watching_${token}`, "1");
          }}
        />
      )}
    </>
  );
}

// ─── Server-side data fetching ────────────────────────────────────────────────

export async function getServerSideProps({ params, req, res }) {
  // CDN-cache the rendered HTML so repeat recruiter visits are instant.
  // 60s fresh, 5min stale-while-revalidate — views are approximately counted.
  res.setHeader("Cache-Control", "public, s-maxage=60, stale-while-revalidate=300");

  const token = String(params?.token || "").trim();
  if (!token) return { notFound: true };

  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  // 1. Profile
  const { data: profile } = await db
    .from("athlete_profiles").select("*")
    .eq("share_token", token).eq("is_public", true).maybeSingle();

  if (!profile) return { notFound: true };

  // 2. Athlete
  const { data: athlete } = await db
    .from("athletes").select("name, email, sport")
    .eq("athlete_token", profile.athlete_token).maybeSingle();

  // 3. Strength PRs (last 365 days)
  const since365 = Date.now() - 365 * 24 * 60 * 60 * 1000;
  const { data: logs } = await db
    .from("set_logs")
    .select("exercise_title, actual_weight, actual_reps, target_weight, video_url, date")
    .eq("athlete_token", profile.athlete_token)
    .gt("actual_weight", 0).gt("actual_reps", 0).gt("timestamp", since365)
    .order("actual_weight", { ascending: false }).limit(1000);

  const prMap = {};
  for (const log of (logs ?? [])) {
    const title = (log.exercise_title || "").trim();
    if (!title) continue;
    const w = Number(log.actual_weight) || 0;
    const r = Number(log.actual_reps)   || 0;
    if (w <= 0) continue;
    const unit = /kg/i.test(String(log.target_weight || "")) ? "kg" : "lb";
    if (!prMap[title] || w > prMap[title].maxWeight) {
      prMap[title] = { exercise: title, maxWeight: w, unit, maxReps: r, videoUrl: log.video_url || null, prDate: log.date || null };
    }
  }
  const strengthPRs = Object.values(prMap).sort((a, b) => b.maxWeight - a.maxWeight).slice(0, 8);

  // 4. Training heatmap (168 days / 24 weeks) + 30-day stats
  const since168 = Date.now() - 168 * 24 * 60 * 60 * 1000;
  const since30  = Date.now() - 30  * 24 * 60 * 60 * 1000;
  const { data: trainingLogs } = await db
    .from("set_logs").select("date, timestamp")
    .eq("athlete_token", profile.athlete_token).gt("timestamp", since168);

  const heatmapDates    = [...new Set((trainingLogs ?? []).map(l => l.date).filter(Boolean))];
  const since30Iso      = new Date(since30).toISOString();
  const distinctDates30d = new Set((trainingLogs ?? []).filter(l => l.timestamp >= since30Iso).map(l => l.date).filter(Boolean)).size;

  const { data: oldestLog } = await db
    .from("set_logs").select("date")
    .eq("athlete_token", profile.athlete_token)
    .order("timestamp", { ascending: true }).limit(1).maybeSingle();

  // Weeks since first log — used as the denominator so a new athlete doesn't
  // show "0.1 sessions/week" just because we divide by the full 24-week window
  const loggingWeeks = oldestLog?.date
    ? Math.max(1, Math.ceil((Date.now() - new Date(oldestLog.date + "T12:00:00").getTime()) / (7 * 86400000)))
    : 24;
  const heatmapDivisorWeeks = Math.min(loggingWeeks, 24);

  // 5. Athletic stats
  let athleticStats = null;
  if (athlete?.name) {
    const orgId = (await db.from("athletes").select("org_id").eq("athlete_token", profile.athlete_token).maybeSingle()).data?.org_id;
    if (orgId) {
      const { data: rosterRows } = await db.from("roster").select("jersey_number").eq("org_id", orgId).ilike("player_name", athlete.name);
      const jerseys = (rosterRows ?? []).map(r => r.jersey_number).filter(n => n != null);
      if (jerseys.length) {
        const { data: tracks } = await db
          .from("player_tracks")
          .select("max_speed_mph, avg_speed_mph, accel_peak_ms2, game_plays!inner(game_films!inner(id))")
          .eq("org_id", orgId).in("jersey_number", jerseys).not("max_speed_mph", "is", null).limit(500);
        if (tracks?.length) {
          const speeds     = tracks.map(t => t.avg_speed_mph).filter(v => v != null);
          const peakSpeeds = tracks.map(t => t.max_speed_mph).filter(v => v != null);
          const accels     = tracks.map(t => t.accel_peak_ms2).filter(v => v != null);
          const filmIds    = new Set(tracks.map(t => t.game_plays?.game_films?.id).filter(Boolean));
          athleticStats = {
            peakSpeed: round1(max(peakSpeeds)),
            avgSpeed:  round1(avg(speeds)),
            avgAccel:  round2(avg(accels)),
            playCount: tracks.length,
            filmCount: filmIds.size,
          };
        }
      }
    }
  }

  // 5.5. Game-by-game season stats (current + previous season)
  const thisYear = new Date().getFullYear();
  let gameStats = null;
  try {
    const { data: rawGames } = await db
      .from("athlete_game_logs")
      .select("*")
      .eq("athlete_token", profile.athlete_token)
      .in("season_year", [thisYear, thisYear - 1])
      .order("game_date", { ascending: false })
      .limit(200);

    if (rawGames?.length) {
      const sport = (profile.sport || athlete?.sport || "").toLowerCase().trim();
      const cfg = SPORT_STATS[sport];
      if (cfg) {
        const seasonGames = rawGames.filter(g => g.season_year === thisYear);
        const prevGames   = rawGames.filter(g => g.season_year === thisYear - 1);

        if (cfg.type === "events") {
          const markMap = {};
          for (const game of seasonGames) {
            for (const e of (game.stats?.events ?? [])) {
              if (!e.event || !e.mark) continue;
              if (!markMap[e.event]) markMap[e.event] = { event: e.event, mark: e.mark, place: e.place || null };
            }
          }
          if (seasonGames.length > 0) {
            gameStats = {
              type: "events",
              sport,
              season: thisYear,
              gameCount: seasonGames.length,
              bestMarks: Object.values(markMap).slice(0, 8),
              recentGames: seasonGames.slice(0, 4).map(g => ({
                date: g.game_date, opponent: g.opponent || null, result: g.result || null,
                team_score: null, opp_score: null, logged_by: g.logged_by || "athlete",
              })),
            };
          }
        } else {
          const groupKey = cfg.type === "grouped" ? getFootballGroup(profile.position) : null;
          const roleKey  = cfg.type === "role"
            ? (rawGames.find(g => g.role_key)?.role_key ?? Object.keys(cfg.roles)[0])
            : null;
          const fields   = getFields(sport, groupKey, roleKey);
          const computed = getComputed(sport, groupKey, roleKey);
          const displayKeys = cfg.type === "grouped" && groupKey
            ? (cfg.groups[groupKey]?.display ?? [])
            : cfg.type === "role" && roleKey
            ? (cfg.roles[roleKey]?.display ?? [])
            : (cfg.display ?? []);
          const labelMap = {};
          [...fields, ...computed].forEach(f => { labelMap[f.key] = f.label; });

          const computeSeasonData = (games) => {
            if (!games.length) return null;
            const totals = aggregateStats(games, fields);
            const computedVals = {};
            computed.forEach(c => { try { computedVals[c.key] = c.fn(totals); } catch { computedVals[c.key] = "—"; } });
            return { totals, computed: computedVals };
          };

          const current = computeSeasonData(seasonGames);
          if (current) {
            const prev   = computeSeasonData(prevGames);
            const wins   = seasonGames.filter(g => g.result === "W").length;
            const losses = seasonGames.filter(g => g.result === "L").length;
            const ties   = seasonGames.filter(g => g.result === "T" || g.result === "D").length;
            const coachVerified = seasonGames.filter(g => g.logged_by === "coach").length;
            gameStats = {
              type: "stats",
              sport,
              season: thisYear,
              gameCount: seasonGames.length,
              coachVerified,
              wins, losses, ties,
              totals: current.totals,
              computed: current.computed,
              display: displayKeys,
              labels: labelMap,
              groupKey,
              roleKey,
              prevSeason: prev ? {
                season: thisYear - 1,
                gameCount: prevGames.length,
                totals: prev.totals,
                computed: prev.computed,
              } : null,
              recentGames: seasonGames.slice(0, 5).map(g => ({
                date: g.game_date,
                opponent: g.opponent || null,
                result: g.result || null,
                team_score: g.team_score ?? null,
                opp_score: g.opp_score ?? null,
                logged_by: g.logged_by || "athlete",
                stats: g.stats || {},
              })),
            };
          }
        }
      }
    }
  } catch { /* game_logs table may not exist yet */ }

  // 5.6. Season goals (show on recruit page to signal athlete professionalism)
  let seasonGoals = [];
  if (gameStats?.type === "stats" && gameStats.totals) {
    try {
      const sport5 = gameStats.sport;
      const { data: rawGoals } = await db
        .from("athlete_stat_goals")
        .select("field_key, target")
        .eq("athlete_token", profile.athlete_token)
        .eq("sport", sport5)
        .eq("season_year", thisYear);

      if (rawGoals?.length) {
        seasonGoals = rawGoals.map(g => {
          const computedVal = gameStats.computed?.[g.field_key];
          const current = computedVal != null && computedVal !== "—"
            ? parseFloat(computedVal) || 0
            : Number(gameStats.totals[g.field_key] || 0);
          const target  = Number(g.target);
          const pct     = target > 0 ? Math.min(Math.round(current / target * 100), 100) : 0;
          return {
            field_key: g.field_key,
            label:     gameStats.labels?.[g.field_key] || g.field_key,
            target,
            current:   current % 1 === 0 ? current : Number(current.toFixed(1)),
            pct,
            done:      pct >= 100,
          };
        }).filter(g => g.target > 0);
      }
    } catch { /* table may not exist yet */ }
  }

  // 6. Public reel
  const { data: reel } = await db
    .from("athlete_reels").select("share_token, title, play_ids")
    .eq("athlete_id", profile.athlete_token).eq("is_public", true).maybeSingle();

  // 7. View stats + watchlist count (query BEFORE logging this view so we don't count ourselves)
  const weekAgo  = new Date(Date.now() - 7  * 86400000).toISOString();
  const weekRes = await db
    .from("profile_views").select("*", { count: "exact", head: true })
    .eq("share_token", token).gte("viewed_at", weekAgo);
  const viewsThisWeek = weekRes.count ?? 0;

  let watchlistCount = 0;
  try {
    const watchRes = await db
      .from("recruit_watchlist").select("*", { count: "exact", head: true })
      .eq("share_token", token);
    watchlistCount = watchRes.count ?? 0;
  } catch { /* table may not exist yet */ }

  // View logging + push notification (fire-and-forget)
  const newViewCount = (profile.view_count || 0) + 1;
  db.from("athlete_profiles").update({ view_count: newViewCount }).eq("share_token", token).then(() => {}).catch(() => {});
  db.from("profile_views").insert({ share_token: token }).then(() => {}).catch(() => {});
  sendNotification([profile.athlete_token], {
    title: "Profile viewed",
    body: `Your recruiting profile just got a view. ${newViewCount} total.`,
    data: { type: "profile_view", screen: "recruiting-profile" },
    type: "profile_view",
  });

  // 8. Build absolute OG image URL (needed for social crawlers)
  const host = process.env.NEXT_PUBLIC_SITE_URL
    || (req.headers["x-forwarded-proto"] ? `${req.headers["x-forwarded-proto"]}://${req.headers["x-forwarded-host"] || req.headers.host}` : `https://${req.headers.host}`);
  const ogParams = new URLSearchParams({
    name:   athlete?.name  || "Athlete",
    sport:  profile.sport  || athlete?.sport || "",
    pos:    profile.position || "",
    school: profile.school   || "",
    year:   profile.graduation_year ? String(profile.graduation_year) : "",
  });
  const ogImageUrl = `${host}/api/recruit/og?${ogParams}`;

  return {
    props: {
      token,
      ogImageUrl,
      data: {
        profile: {
          sport:           profile.sport           || athlete?.sport || null,
          position:        profile.position        || null,
          graduation_year: profile.graduation_year || null,
          school:          profile.school          || null,
          height:          profile.height          || null,
          weight:          profile.weight          || null,
          gpa:             profile.gpa             || null,
          level:           profile.level           || null,
          bio:             profile.bio             || null,
          achievements:    profile.achievements    || [],
          avatar_url:        profile.avatar_url        || null,
          hudl_url:          profile.hudl_url          || null,
          instagram_url:     profile.instagram_url     || null,
          twitter_url:       profile.twitter_url       || null,
          maxpreps_url:      profile.maxpreps_url      || null,
          sat_score:         profile.sat_score         || null,
          act_score:         profile.act_score         || null,
          recruiting_status: profile.recruiting_status || null,
          top_schools:       Array.isArray(profile.top_schools) ? profile.top_schools.slice(0, 3) : null,
          family_statement:  profile.family_statement  || null,
          view_count:        newViewCount,
        },
        athlete: {
          name:  athlete?.name  || "Athlete",
          email: profile.show_contact ? (athlete?.email || null) : null,
        },
        strengthPRs: strengthPRs.map(pr => ({ ...pr, videoUrl: pr.videoUrl || null })),
        athleticStats:  athleticStats || null,
        reel:           reel ? { shareToken: reel.share_token, title: reel.title || null, playCount: reel.play_ids?.length ?? 0 } : null,
        gameStats,
        seasonGoals,
        heatmapDates,
        trainingStats: {
          sessions30d:        distinctDates30d,
          totalExercises:     Object.keys(prMap).length,
          trainingSince:      oldestLog?.date || null,
          avgSessionsPerWeek: Math.round((heatmapDates.length / heatmapDivisorWeeks) * 10) / 10,
          trendDelta: (() => {
            // Suppress comparison when the athlete hasn't been logging long enough
            // for both the "recent" and "prior" 6-week windows to be meaningful
            if (loggingWeeks < 12) return null;
            const now    = Date.now();
            const recent = heatmapDates.filter(d => new Date(d + "T12:00:00").getTime() >= now - 42 * 86400000).length;
            const prior  = heatmapDates.filter(d => {
              const t = new Date(d + "T12:00:00").getTime();
              return t >= now - 84 * 86400000 && t < now - 42 * 86400000;
            }).length;
            return recent - prior;
          })(),
        },
        viewStats:     { total: newViewCount, thisWeek: viewsThisWeek },
        watchlistCount,
      },
    },
  };
}
