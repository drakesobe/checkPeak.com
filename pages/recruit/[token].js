// pages/recruit/[token].js
// Public recruiting profile — server-side rendered so OG tags work with all
// social/messaging link preview crawlers and the page loads instantly.

import Head from "next/head";
import { useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { Film, Mail, Zap, Dumbbell, TrendingUp, ChevronRight, ExternalLink, X, Check, Send, Shield, Play, Lock, Trophy } from "lucide-react";
import { sendNotification } from "@/lib/sendNotification";

const C = {
  bg:      "#08090B",
  surface: "#0D0F16",
  card:    "#131620",
  card2:   "#191D28",
  line:    "#1C2030",
  line2:   "#242A3E",
  white:   "#F0F3FA",
  dim:     "rgba(240,243,250,0.62)",
  muted:   "rgba(240,243,250,0.38)",
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

function SectionHeader({ icon: Icon, label, sub, verified }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 18 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <Icon size={13} color={C.accent} />
        <div>
          <div style={{ fontSize: 9, fontWeight: 900, letterSpacing: "0.18em", color: C.accent }}>{label}</div>
          {sub && <div style={{ fontSize: 10, color: C.muted, marginTop: 3 }}>{sub}</div>}
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
              <div style={{ fontSize: 11, fontWeight: 600, color: C.dim, marginTop: 6, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{pr.exercise}</div>
              {hasVideo && (
                <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 4 }}>
                  <div style={{ width: 18, height: 18, borderRadius: "50%", background: "rgba(79,171,255,0.15)", border: "1px solid rgba(79,171,255,0.3)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Play size={8} color={C.accent} fill={C.accent} style={{ marginLeft: 1 }} />
                  </div>
                  <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: "0.1em", color: C.accent }}>WATCH</span>
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
  const days     = Array.from({ length: 84 }, (_, i) => {
    const d = new Date(today); d.setDate(d.getDate() - (83 - i));
    return d.toISOString().split("T")[0];
  });
  const weeks  = Array.from({ length: 12 }, (_, wi) => days.slice(wi * 7, wi * 7 + 7));
  const active = new Set(heatmapDates);
  const monthLabels = weeks.map(week => {
    const d = new Date(week[0] + "T12:00:00");
    return d.getDate() <= 7 ? d.toLocaleDateString("en-US", { month: "short" }) : "";
  });
  const totalActive = heatmapDates.length;
  const pct = Math.round((totalActive / 84) * 100);

  return (
    <div>
      <div style={{ display: "flex", gap: 4, overflowX: "auto", paddingBottom: 4 }}>
        {weeks.map((week, wi) => (
          <div key={wi} style={{ display: "flex", flexDirection: "column", gap: 4, flexShrink: 0 }}>
            <div style={{ height: 12, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ fontSize: 7.5, fontWeight: 700, color: C.muted, whiteSpace: "nowrap", letterSpacing: "0.04em" }}>{monthLabels[wi]}</span>
            </div>
            {week.map((day, di) => {
              const isActive = active.has(day);
              const isToday  = day === todayStr;
              const age      = 11 - wi;
              const opacity  = isActive ? 1 : age > 8 ? 0.4 : 0.6;
              return (
                <div key={di} title={day} style={{ width: 11, height: 11, borderRadius: 2, background: isActive ? C.accent : C.faint, opacity, boxShadow: isToday ? `0 0 0 1px ${C.accent}` : "none" }} />
              );
            })}
          </div>
        ))}
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 12 }}>
        <div style={{ fontSize: 11, color: C.muted }}>
          <span style={{ color: C.white, fontWeight: 800 }}>{totalActive}</span> training days in 12 weeks
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 10, color: C.muted }}>Less</span>
          {[0.06, 0.3, 0.6, 1].map((o, i) => (
            <div key={i} style={{ width: 10, height: 10, borderRadius: 2, background: C.accent, opacity: o }} />
          ))}
          <span style={{ fontSize: 10, color: C.muted }}>More</span>
        </div>
      </div>
      <div style={{ marginTop: 10, display: "flex", gap: 20 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
          <span style={{ fontSize: 22, fontWeight: 900, color: C.green, letterSpacing: "-0.03em" }}>{sessions30d}</span>
          <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: "0.1em", color: C.muted }}>SESSIONS · LAST 30 DAYS</span>
        </div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
          <span style={{ fontSize: 22, fontWeight: 900, color: C.dim, letterSpacing: "-0.03em" }}>{pct}%</span>
          <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: "0.1em", color: C.muted }}>CONSISTENCY</span>
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
                <label style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.1em", color: C.muted, display: "block", marginBottom: 6 }}>YOUR NAME *</label>
                <input style={inputStyle} placeholder="Coach Smith" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
              </div>
              <div>
                <label style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.1em", color: C.muted, display: "block", marginBottom: 6 }}>YOUR EMAIL *</label>
                <input style={inputStyle} placeholder="coach@university.edu" type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} />
              </div>
            </div>
            <div>
              <label style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.1em", color: C.muted, display: "block", marginBottom: 6 }}>SCHOOL / ORGANIZATION</label>
              <input style={inputStyle} placeholder="State University Athletics" value={form.org} onChange={e => setForm(p => ({ ...p, org: e.target.value }))} />
            </div>
            <div>
              <label style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.1em", color: C.muted, display: "block", marginBottom: 6 }}>MESSAGE *</label>
              <textarea style={{ ...inputStyle, resize: "vertical", lineHeight: 1.6, minHeight: 100 }}
                placeholder={`Hi ${athleteName.split(" ")[0]}, I'm a coach at State University…`}
                value={form.message}
                onChange={e => setForm(p => ({ ...p, message: e.target.value.slice(0, 2000) }))}
                rows={4}
              />
              <div style={{ fontSize: 10, color: C.muted, textAlign: "right", marginTop: 4 }}>{form.message.length}/2000</div>
            </div>
            {status === "error" && (
              <div style={{ padding: "10px 14px", background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)", borderRadius: 8, fontSize: 12, color: "#EF4444" }}>{errMsg}</div>
            )}
            <button onClick={submit} disabled={!canSubmit || status === "sending"} style={{ padding: "14px", background: canSubmit ? C.accent : C.faint, border: `1px solid ${canSubmit ? C.accent : C.line2}`, borderRadius: 12, fontSize: 14, fontWeight: 800, color: canSubmit ? "#fff" : C.muted, cursor: canSubmit ? "pointer" : "not-allowed", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, opacity: status === "sending" ? 0.7 : 1 }}>
              <Send size={14} />
              {status === "sending" ? "Sending…" : "Send message"}
            </button>
            <p style={{ fontSize: 10, color: C.muted, textAlign: "center", margin: 0 }}>
              Your message is routed through CheckPeak — the athlete&apos;s email is not exposed.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function RecruitPage({ data, token, ogImageUrl }) {
  const [showContact, setShowContact] = useState(false);

  if (!data) return (
    <div style={{ minHeight: "100vh", background: C.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ textAlign: "center", padding: 32 }}>
        <div style={{ marginBottom: 16, display: "flex", justifyContent: "center" }}><Lock size={40} color="rgba(255,255,255,0.35)" strokeWidth={1.3} /></div>
        <div style={{ fontSize: 20, fontWeight: 800, color: C.white, marginBottom: 8 }}>Profile not available</div>
        <div style={{ fontSize: 13, color: C.muted }}>This profile is private or no longer exists.</div>
      </div>
    </div>
  );

  const { profile, athlete, strengthPRs, athleticStats, reel, heatmapDates, trainingStats } = data;

  const name         = athlete?.name  || "Athlete";
  const sport        = profile.sport  || null;
  const position     = profile.position || null;
  const school       = profile.school   || null;
  const gradYear     = profile.graduation_year || null;
  const height       = profile.height   || null;
  const weight       = profile.weight   || null;
  const gpa          = profile.gpa      || null;
  const bio          = profile.bio      || null;
  const achievements = profile.achievements || [];
  const avatarUrl    = profile.avatar_url   || null;
  const hudlUrl      = profile.hudl_url     || null;
  const hasContact   = !!athlete?.email;

  const hasAthletics = athleticStats && (athleticStats.peakSpeed || athleticStats.avgSpeed);
  const hasStrength  = strengthPRs?.length > 0;
  const hasHeatmap   = (heatmapDates?.length > 0) || (trainingStats?.sessions30d > 0);

  const subtitleParts = [position, school, gradYear ? `Class of ${gradYear}` : null].filter(Boolean);
  const physicalParts = [height, weight, gpa ? `GPA ${gpa}` : null].filter(Boolean);

  const pageTitle = `${name}${sport ? ` · ${sport}` : ""}${position ? ` · ${position}` : ""}`;
  const pageDesc  = bio || `Recruiting profile for ${name}${school ? ` at ${school}` : ""}. Powered by CheckPeak.`;

  return (
    <>
      <Head>
        <title>{pageTitle} · CheckPeak</title>
        <meta name="description"        content={pageDesc} />
        <meta name="viewport"           content="width=device-width, initial-scale=1" />
        <meta name="robots"             content="index, follow" />

        {/* Open Graph — works for iMessage, WhatsApp, Slack, LinkedIn, Twitter */}
        <meta property="og:type"        content="profile" />
        <meta property="og:title"       content={`${pageTitle} · CheckPeak Recruiting Profile`} />
        <meta property="og:description" content={pageDesc} />
        {ogImageUrl && <meta property="og:image"       content={ogImageUrl} />}
        {ogImageUrl && <meta property="og:image:width"  content="1200" />}
        {ogImageUrl && <meta property="og:image:height" content="630" />}

        {/* Twitter card */}
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

      <div style={{ maxWidth: 640, margin: "0 auto", padding: "0 0 100px" }}>

        {/* Top bar */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px 22px 0" }}>
          <span style={{ fontSize: 13, fontWeight: 900, letterSpacing: "0.1em", color: C.accent }}>CHECKPEAK</span>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {sport && (
              <span style={{ fontSize: 9, fontWeight: 900, letterSpacing: "0.12em", padding: "3px 10px", borderRadius: 4, background: "rgba(79,171,255,0.08)", border: "1px solid rgba(79,171,255,0.22)", color: C.accent }}>
                {sport.toUpperCase()}
              </span>
            )}
            <span style={{ fontSize: 9, fontWeight: 700, color: C.muted, letterSpacing: "0.06em" }}>Recruiting Profile</span>
          </div>
        </div>

        {/* Hero */}
        <div style={{ padding: "24px 22px 22px", borderBottom: `1px solid ${C.line}`, animation: "fadeUp 0.35s ease both" }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 18, marginBottom: 16 }}>
            <Avatar url={avatarUrl} name={name} size={76} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 32, fontWeight: 900, color: C.white, letterSpacing: "-0.04em", lineHeight: 1.05, marginBottom: 8 }}>{name}</div>
              {subtitleParts.length > 0 && (
                <div style={{ fontSize: 13, fontWeight: 600, color: C.dim, letterSpacing: "-0.01em", lineHeight: 1.4 }}>{subtitleParts.join("  ·  ")}</div>
              )}
            </div>
          </div>

          {physicalParts.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginBottom: 16 }}>
              {physicalParts.map((p, i) => (
                <span key={i} style={{ fontSize: 11, fontWeight: 700, color: C.muted, padding: "4px 11px", background: C.faint, border: `1px solid ${C.line}`, borderRadius: 6 }}>{p}</span>
              ))}
            </div>
          )}

          {hasContact && (
            <button onClick={() => setShowContact(true)} style={{ display: "flex", alignItems: "center", gap: 7, padding: "10px 18px", background: "rgba(79,171,255,0.1)", border: "1px solid rgba(79,171,255,0.28)", borderRadius: 10, fontSize: 13, fontWeight: 700, color: C.accent, cursor: "pointer", fontFamily: "inherit" }}>
              <Mail size={13} />
              Request information
            </button>
          )}
        </div>

        {/* Achievements */}
        {achievements.length > 0 && (
          <div style={{ padding: "18px 22px", borderBottom: `1px solid ${C.line}`, animation: "fadeUp 0.35s ease 0.06s both" }}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {achievements.map((a, i) => (
                <div key={i} style={{ padding: "5px 14px", background: i === 0 ? "rgba(255,215,0,0.07)" : C.faint, border: `1px solid ${i === 0 ? "rgba(255,215,0,0.22)" : C.line}`, borderRadius: 20, fontSize: 12, fontWeight: 700, color: i === 0 ? "#FFD700" : C.dim, display: "flex", alignItems: "center", gap: 6 }}>
                  {i === 0 && <Trophy size={11} color="#FFD700" strokeWidth={1.8} />}
                  {a}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Athletic Performance */}
        {hasAthletics && (
          <div style={{ padding: "24px 22px 22px", borderBottom: `1px solid ${C.line}`, animation: "fadeUp 0.35s ease 0.1s both" }}>
            <SectionHeader icon={Zap} label="Athletic Performance" sub={`${athleticStats.playCount} tracked plays · ${athleticStats.filmCount} ${athleticStats.filmCount === 1 ? "game" : "games"}`} verified />
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(80px, 1fr))", border: `1px solid ${C.line}`, borderRadius: 12, overflow: "hidden", background: C.card }}>
              {athleticStats.peakSpeed != null && (
                <div style={{ padding: "18px 14px", textAlign: "center", borderRight: `1px solid ${C.line}` }}>
                  <div style={{ fontSize: 28, fontWeight: 900, color: C.accent, letterSpacing: "-0.04em", lineHeight: 1 }}>{athleticStats.peakSpeed}</div>
                  <div style={{ fontSize: 9, fontWeight: 700, color: C.muted, marginTop: 2 }}>mph</div>
                  <div style={{ fontSize: 8, fontWeight: 900, letterSpacing: "0.1em", color: C.muted, marginTop: 6 }}>PEAK SPEED</div>
                </div>
              )}
              {athleticStats.avgSpeed != null && (
                <div style={{ padding: "18px 14px", textAlign: "center", borderRight: athleticStats.avgAccel != null ? `1px solid ${C.line}` : "none" }}>
                  <div style={{ fontSize: 28, fontWeight: 900, color: C.white, letterSpacing: "-0.04em", lineHeight: 1 }}>{athleticStats.avgSpeed}</div>
                  <div style={{ fontSize: 9, fontWeight: 700, color: C.muted, marginTop: 2 }}>mph</div>
                  <div style={{ fontSize: 8, fontWeight: 900, letterSpacing: "0.1em", color: C.muted, marginTop: 6 }}>AVG SPEED</div>
                </div>
              )}
              {athleticStats.avgAccel != null && (
                <div style={{ padding: "18px 14px", textAlign: "center" }}>
                  <div style={{ fontSize: 28, fontWeight: 900, color: C.white, letterSpacing: "-0.04em", lineHeight: 1 }}>{athleticStats.avgAccel}</div>
                  <div style={{ fontSize: 9, fontWeight: 700, color: C.muted, marginTop: 2 }}>m/s²</div>
                  <div style={{ fontSize: 8, fontWeight: 900, letterSpacing: "0.1em", color: C.muted, marginTop: 6 }}>ACCELERATION</div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Strength Profile */}
        {hasStrength && (
          <div style={{ padding: "24px 22px 22px", borderBottom: `1px solid ${C.line}`, animation: "fadeUp 0.35s ease 0.16s both" }}>
            <SectionHeader icon={Dumbbell} label="Strength Profile" sub={`${trainingStats.totalExercises} exercises tracked · personal records`} verified />
            <PRGrid prs={strengthPRs} />
          </div>
        )}

        {/* Training Commitment */}
        {hasHeatmap && (
          <div style={{ padding: "24px 22px 22px", borderBottom: `1px solid ${C.line}`, animation: "fadeUp 0.35s ease 0.22s both" }}>
            <SectionHeader
              icon={TrendingUp}
              label="Training Commitment"
              sub={trainingStats.trainingSince ? `Logging since ${new Date(trainingStats.trainingSince + "T12:00:00").toLocaleDateString("en-US", { month: "long", year: "numeric" })}` : undefined}
              verified
            />
            <TrainingHeatmap heatmapDates={heatmapDates} sessions30d={trainingStats.sessions30d} />
          </div>
        )}

        {/* Film */}
        {(reel || hudlUrl) && (
          <div style={{ padding: "24px 22px 22px", borderBottom: `1px solid ${C.line}`, animation: "fadeUp 0.35s ease 0.28s both" }}>
            <SectionHeader icon={Film} label="Film" />
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {reel && (
                <a href={`/reel/${reel.shareToken}`} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 18px", background: C.card, border: `1px solid ${C.line2}`, borderRadius: 12, cursor: "pointer" }}>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: C.white, marginBottom: 3 }}>{reel.title || "Highlight Reel"}</div>
                      <div style={{ fontSize: 11, color: C.muted, fontWeight: 600 }}>{reel.playCount} {reel.playCount === 1 ? "play" : "plays"} · CheckPeak Reel</div>
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
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 18px", background: C.card, border: `1px solid ${C.line2}`, borderRadius: 12, cursor: "pointer" }}>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: C.white, marginBottom: 3 }}>Hudl Profile</div>
                      <div style={{ fontSize: 11, color: C.muted, fontWeight: 600 }}>View game film on Hudl</div>
                    </div>
                    <ExternalLink size={14} color={C.muted} />
                  </div>
                </a>
              )}
            </div>
          </div>
        )}

        {/* Bio */}
        {bio && (
          <div style={{ padding: "24px 22px 22px", borderBottom: `1px solid ${C.line}`, animation: "fadeUp 0.35s ease 0.34s both" }}>
            <SectionHeader icon={TrendingUp} label="About" />
            <p style={{ fontSize: 14, fontWeight: 500, color: C.dim, lineHeight: 1.75, margin: 0 }}>{bio}</p>
          </div>
        )}

        {/* Contact CTA */}
        <div style={{ padding: "28px 22px 0", animation: "fadeUp 0.35s ease 0.40s both" }}>
          {hasContact ? (
            <button onClick={() => setShowContact(true)} style={{ width: "100%", padding: "16px", background: C.accent, border: "none", borderRadius: 14, fontSize: 15, fontWeight: 800, color: "#fff", cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 9, letterSpacing: "-0.01em" }}>
              <Mail size={16} />
              Request information from {name.split(" ")[0]}
            </button>
          ) : (
            <div style={{ padding: "16px 20px", background: C.faint, border: `1px solid ${C.line}`, borderRadius: 14, textAlign: "center" }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.dim }}>Interested in {name.split(" ")[0]}?</div>
              <div style={{ fontSize: 11, color: C.muted, marginTop: 5, lineHeight: 1.5 }}>Contact information is private — reach out through your recruitment channel.</div>
            </div>
          )}
        </div>

        {/* Coach CTA footer */}
        <div style={{ margin: "48px 22px 0", padding: "28px 24px", background: C.surface, border: `1px solid ${C.line2}`, borderRadius: 16, animation: "fadeUp 0.35s ease 0.46s both" }}>
          <div style={{ fontSize: 9, fontWeight: 900, letterSpacing: "0.18em", color: C.accent, marginBottom: 10 }}>FOR COACHES & RECRUITERS</div>
          <div style={{ fontSize: 19, fontWeight: 800, color: C.white, letterSpacing: "-0.02em", lineHeight: 1.25, marginBottom: 12 }}>This is where elite athletes track their development.</div>
          <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.65, marginBottom: 20 }}>CheckPeak is the training platform athletes actually use — workout tracking, strength PRs, GPS performance from film, and nutrition. Every stat on this page came from real training data.</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 22 }}>
            {["Track your entire roster's training & nutrition", "GPS speed & acceleration from game film", "Film library + highlight reels"].map((line, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ width: 5, height: 5, borderRadius: "50%", background: C.accent, flexShrink: 0 }} />
                <span style={{ fontSize: 12, fontWeight: 600, color: C.dim }}>{line}</span>
              </div>
            ))}
          </div>
          <a href="/" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "13px 24px", background: "rgba(79,171,255,0.12)", border: "1px solid rgba(79,171,255,0.3)", borderRadius: 10, fontSize: 13, fontWeight: 800, color: C.accent, textDecoration: "none" }}>
            Get started free <ChevronRight size={14} />
          </a>
        </div>

        {/* Footer */}
        <div style={{ padding: "28px 22px 0", textAlign: "center", borderTop: `1px solid ${C.line}`, marginTop: 32 }}>
          <div style={{ fontSize: 10, color: "rgba(240,243,250,0.2)", fontWeight: 600, letterSpacing: "0.06em" }}>
            Powered by <span style={{ color: C.accent }}>CHECKPEAK</span> · Athlete Development Platform
          </div>
        </div>

      </div>

      {showContact && <ContactModal athleteName={name} token={token} onClose={() => setShowContact(false)} />}
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
    .select("exercise_title, actual_weight, actual_reps, target_weight, video_url")
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
      prMap[title] = { exercise: title, maxWeight: w, unit, maxReps: r, videoUrl: log.video_url || null };
    }
  }
  const strengthPRs = Object.values(prMap).sort((a, b) => b.maxWeight - a.maxWeight).slice(0, 8);

  // 4. Training heatmap (84 days) + 30-day stats
  const since84 = Date.now() - 84 * 24 * 60 * 60 * 1000;
  const since30 = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const { data: trainingLogs } = await db
    .from("set_logs").select("date, timestamp")
    .eq("athlete_token", profile.athlete_token).gt("timestamp", since84);

  const heatmapDates    = [...new Set((trainingLogs ?? []).map(l => l.date).filter(Boolean))];
  const distinctDates30d = new Set((trainingLogs ?? []).filter(l => l.timestamp > since30).map(l => l.date).filter(Boolean)).size;

  const { data: oldestLog } = await db
    .from("set_logs").select("date")
    .eq("athlete_token", profile.athlete_token)
    .order("timestamp", { ascending: true }).limit(1).maybeSingle();

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

  // 6. Public reel
  const { data: reel } = await db
    .from("athlete_reels").select("share_token, title, play_ids")
    .eq("athlete_id", profile.athlete_token).eq("is_public", true).maybeSingle();

  // 7. View logging + push notification (fire-and-forget — don't block the response)
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
          bio:             profile.bio             || null,
          achievements:    profile.achievements    || [],
          avatar_url:      profile.avatar_url      || null,
          hudl_url:        profile.hudl_url        || null,
          view_count:      newViewCount,
        },
        athlete: {
          name:  athlete?.name  || "Athlete",
          email: profile.show_contact ? (athlete?.email || null) : null,
        },
        strengthPRs: strengthPRs.map(pr => ({ ...pr, videoUrl: pr.videoUrl || null })),
        athleticStats:  athleticStats || null,
        reel:           reel ? { shareToken: reel.share_token, title: reel.title || null, playCount: reel.play_ids?.length ?? 0 } : null,
        heatmapDates,
        trainingStats: {
          sessions30d:    distinctDates30d,
          totalExercises: Object.keys(prMap).length,
          trainingSince:  oldestLog?.date || null,
        },
      },
    },
  };
}
