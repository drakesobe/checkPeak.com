// pages/athlete/profile.jsx
// Athlete's recruiting profile editor.

"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/router";
import { useAuthContext } from "@/hooks/useAuth";
import {
  Check, Copy, Eye, EyeOff, ExternalLink, ChevronLeft, Loader2,
  Camera, X, TrendingUp, TrendingDown, Minus, Shield,
  Link as LinkIcon, Share2, BarChart2,
} from "lucide-react";
import { Toaster, toast } from "react-hot-toast";

const C = {
  bg:      "#0A0A0F",
  surface: "#0E0E16",
  card:    "#131320",
  card2:   "#181828",
  line:    "#1C1C2E",
  line2:   "#242438",
  white:   "#EEEEFF",
  dim:     "rgba(238,238,255,0.65)",
  muted:   "rgba(238,238,255,0.38)",
  faint:   "rgba(238,238,255,0.06)",
  faint2:  "rgba(238,238,255,0.03)",
  accent:  "#4FABFF",
  green:   "#00C851",
  red:     "#EF4444",
  gold:    "#FFD700",
};

// ─── Completion score ─────────────────────────────────────────────────────────

function getScore(form) {
  let s = 0;
  if (form._hasAvatar)              s += 20;
  if ((form.bio || "").length >= 50) s += 15;
  if ((form.achievements || []).length >= 1) s += 15;
  if (form.sport)            s += 10;
  if (form.position)         s += 10;
  if (form.school)           s += 10;
  if (form.graduation_year)  s += 10;
  if (form.height)           s += 5;
  if (form.weight)           s += 5;
  return s;
}

function getMissing(form) {
  const m = [];
  if (!form._hasAvatar)                           m.push("Profile photo");
  if (!form.sport)                                m.push("Sport");
  if (!form.position)                             m.push("Position");
  if (!form.school)                               m.push("School");
  if (!form.graduation_year)                      m.push("Graduation year");
  if ((form.achievements || []).length === 0)     m.push("Achievements");
  if ((form.bio || "").length < 50)               m.push("Bio (50+ chars)");
  if (!form.height)                               m.push("Height");
  if (!form.weight)                               m.push("Weight");
  return m;
}

function scoreColor(s) {
  if (s >= 90) return C.green;
  if (s >= 70) return "#A3E635";
  if (s >= 40) return "#F59E0B";
  return C.red;
}

// ─── Subcomponents ────────────────────────────────────────────────────────────

function Field({ label, hint, children }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", color: C.muted, marginBottom: 7 }}>
        {label}
        {hint && (
          <span style={{ fontWeight: 500, textTransform: "none", letterSpacing: 0, color: "rgba(238,238,255,0.22)", marginLeft: 6 }}>{hint}</span>
        )}
      </div>
      {children}
    </div>
  );
}

const inputStyle = {
  width: "100%", boxSizing: "border-box",
  padding: "11px 14px",
  background: C.card2, border: `1px solid ${C.line2}`,
  borderRadius: 10, fontSize: 14, fontWeight: 500, color: C.white,
  fontFamily: "inherit", outline: "none",
  transition: "border-color 0.15s",
};

function AvatarUploader({ url, name, onUploaded }) {
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef(null);

  const initials = (name || "A").split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase();

  const handleFile = async (file) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) { toast.error("Please upload an image file"); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error("Image must be under 5 MB"); return; }

    setUploading(true);
    const fd = new FormData();
    fd.append("file", file);
    try {
      const r = await fetch("/api/athlete/avatar", { method: "POST", credentials: "include", body: fd });
      const d = await r.json();
      if (!d.ok) throw new Error(d.error || "Upload failed");
      onUploaded(d.url);
      toast.success("Photo updated");
    } catch (e) {
      toast.error(e.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 20, marginBottom: 28, padding: "18px 0", borderBottom: `1px solid ${C.line}` }}>
      <div style={{ position: "relative", flexShrink: 0 }}>
        <div style={{
          width: 80, height: 80, borderRadius: "50%",
          background: url ? "transparent" : "linear-gradient(135deg, #1A2540 0%, #0D1530 100%)",
          border: `2px solid ${C.line2}`,
          overflow: "hidden",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          {url
            ? <img src={url} alt="avatar" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            : <span style={{ fontSize: 26, fontWeight: 900, color: C.accent }}>{initials}</span>
          }
          {uploading && (
            <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "50%" }}>
              <Loader2 size={20} color={C.accent} style={{ animation: "spin 0.9s linear infinite" }} />
              <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
            </div>
          )}
        </div>
        <button
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          style={{
            position: "absolute", bottom: -2, right: -2,
            width: 26, height: 26, borderRadius: "50%",
            background: C.accent, border: `2px solid ${C.bg}`,
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer",
          }}>
          <Camera size={12} color="#fff" />
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          style={{ display: "none" }}
          onChange={e => handleFile(e.target.files?.[0])}
        />
      </div>
      <div>
        <div style={{ fontSize: 14, fontWeight: 700, color: C.dim, marginBottom: 4 }}>Profile photo</div>
        <div style={{ fontSize: 11, color: C.muted, lineHeight: 1.5 }}>
          Shown on your public profile.<br />Face photos build recruiter trust significantly.
        </div>
        <button
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          style={{ marginTop: 10, padding: "6px 14px", background: C.faint, border: `1px solid ${C.line2}`, borderRadius: 7, fontSize: 11, fontWeight: 700, color: C.dim, cursor: "pointer", fontFamily: "inherit" }}>
          {url ? "Change photo" : "Upload photo"}
        </button>
      </div>
    </div>
  );
}

function AchievementsInput({ value = [], onChange }) {
  const [input, setInput] = useState("");
  const inputRef = useRef(null);

  const add = () => {
    const v = input.trim().slice(0, 60);
    if (!v || value.length >= 10 || value.includes(v)) { setInput(""); return; }
    onChange([...value, v]);
    setInput("");
  };

  const remove = (i) => onChange(value.filter((_, idx) => idx !== i));

  const handleKey = (e) => {
    if (e.key === "Enter" || e.key === ",") { e.preventDefault(); add(); }
    if (e.key === "Backspace" && !input && value.length) remove(value.length - 1);
  };

  return (
    <div
      onClick={() => inputRef.current?.focus()}
      style={{
        display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center",
        padding: "10px 12px", background: C.card2,
        border: `1px solid ${C.line2}`, borderRadius: 10,
        minHeight: 46, cursor: "text",
      }}
    >
      {value.map((a, i) => (
        <div key={i} style={{
          display: "flex", alignItems: "center", gap: 5,
          padding: "4px 10px 4px 12px",
          background: "rgba(79,171,255,0.1)", border: "1px solid rgba(79,171,255,0.22)",
          borderRadius: 20, fontSize: 12, fontWeight: 700, color: C.accent,
          flexShrink: 0,
        }}>
          {a}
          <button
            onClick={e => { e.stopPropagation(); remove(i); }}
            style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex", color: "rgba(79,171,255,0.5)", lineHeight: 1, fontSize: 14 }}>
            ×
          </button>
        </div>
      ))}
      {value.length < 10 && (
        <input
          ref={inputRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKey}
          onBlur={add}
          placeholder={value.length === 0 ? "Type and press Enter — All-State, Team Captain…" : "Add more…"}
          style={{
            border: "none", background: "none", outline: "none",
            fontSize: 13, color: C.white, fontFamily: "inherit",
            flex: 1, minWidth: 120, padding: "2px 0",
          }}
        />
      )}
    </div>
  );
}

function ViewAnalytics({ viewStats }) {
  if (!viewStats) return null;
  const { thisWeek, lastWeek, allTime } = viewStats;
  const diff  = thisWeek - lastWeek;
  const trend = diff > 0 ? "up" : diff < 0 ? "down" : "flat";

  return (
    <div style={{ padding: "18px 0", borderTop: `1px solid ${C.line}`, marginTop: 4 }}>
      <div style={{ fontSize: 9, fontWeight: 900, letterSpacing: "0.16em", color: C.muted, marginBottom: 14 }}>PROFILE VIEWS</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
        <div style={{ padding: "14px", background: C.card2, border: `1px solid ${C.line2}`, borderRadius: 10, textAlign: "center" }}>
          <div style={{ fontSize: 26, fontWeight: 900, color: C.white, letterSpacing: "-0.03em", lineHeight: 1 }}>{thisWeek}</div>
          <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: "0.1em", color: C.muted, marginTop: 7 }}>THIS WEEK</div>
        </div>
        <div style={{ padding: "14px", background: C.card2, border: `1px solid ${C.line2}`, borderRadius: 10, textAlign: "center" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}>
            {trend === "up" && <TrendingUp size={14} color={C.green} />}
            {trend === "down" && <TrendingDown size={14} color={C.red} />}
            {trend === "flat" && <Minus size={14} color={C.muted} />}
            <div style={{ fontSize: 20, fontWeight: 900, letterSpacing: "-0.03em", color: trend === "up" ? C.green : trend === "down" ? C.red : C.muted }}>
              {diff > 0 ? `+${diff}` : diff === 0 ? "—" : diff}
            </div>
          </div>
          <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: "0.1em", color: C.muted, marginTop: 7 }}>VS LAST WEEK</div>
        </div>
        <div style={{ padding: "14px", background: C.card2, border: `1px solid ${C.line2}`, borderRadius: 10, textAlign: "center" }}>
          <div style={{ fontSize: 26, fontWeight: 900, color: C.dim, letterSpacing: "-0.03em", lineHeight: 1 }}>{allTime}</div>
          <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: "0.1em", color: C.muted, marginTop: 7 }}>ALL TIME</div>
        </div>
      </div>
    </div>
  );
}

function QRCodeSection({ shareUrl, athleteName }) {
  const [show, setShow] = useState(false);
  const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(shareUrl)}&bgcolor=0A0A0F&color=4FABFF&margin=2&format=png`;

  if (!shareUrl) return null;

  return (
    <div>
      <button
        onClick={() => setShow(s => !s)}
        style={{
          display: "flex", alignItems: "center", gap: 6,
          padding: "8px 14px", background: C.faint, border: `1px solid ${C.line2}`,
          borderRadius: 8, fontSize: 11, fontWeight: 700, color: C.dim,
          cursor: "pointer", fontFamily: "inherit", flexShrink: 0,
        }}>
        <span style={{ fontSize: 12 }}>⬜</span>
        QR Code
      </button>

      {show && (
        <div style={{ marginTop: 14, padding: 20, background: C.card2, border: `1px solid ${C.line2}`, borderRadius: 12 }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 18 }}>
            <img
              src={qrSrc}
              alt="QR code for recruiting profile"
              width={100}
              height={100}
              style={{ borderRadius: 8, flexShrink: 0, border: `1px solid ${C.line2}` }}
            />
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.dim, marginBottom: 6 }}>Share at events</div>
              <div style={{ fontSize: 11, color: C.muted, lineHeight: 1.55, marginBottom: 12 }}>
                Screenshot this QR code to share your profile at showcases, tournaments, and combines. Coaches can scan it to view your full profile instantly.
              </div>
              <a
                href={qrSrc.replace("size=300x300", "size=600x600")}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: "inline-flex", alignItems: "center", gap: 5,
                  padding: "7px 14px", background: C.faint, border: `1px solid ${C.line2}`,
                  borderRadius: 7, fontSize: 11, fontWeight: 700, color: C.dim,
                  textDecoration: "none",
                }}>
                <ExternalLink size={11} />
                Open full size
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

const GRAD_YEARS = Array.from({ length: 12 }, (_, i) => new Date().getFullYear() + i - 1);

const RECRUITING_STATUS_OPTIONS = [
  { key: "open",      label: "Open to Offers"  },
  { key: "committed", label: "Committed"        },
  { key: "signed",    label: "Signed / Verbal"  },
];

const BLANK_FORM = {
  sport: "", position: "", graduation_year: "", school: "",
  height: "", weight: "", gpa: "", sat_score: "", act_score: "",
  bio: "", show_contact: false,
  achievements: [], hudl_url: "",
  recruiting_status: "", top_schools: ["", "", ""], family_statement: "",
  _hasAvatar: false,
};

export default function AthleteProfile() {
  const router  = useRouter();
  const { user, authReady } = useAuthContext();

  const role      = String(user?.role || user?.Role || "").toLowerCase();
  const isAthlete = role.includes("ath");
  const userName  = user?.Name || user?.name || "";

  const [loading,    setLoading]    = useState(true);
  const [saving,     setSaving]     = useState(false);
  const [form,       setForm]       = useState(BLANK_FORM);
  const [savedForm,  setSavedForm]  = useState(null);
  const [isPublic,   setIsPublic]   = useState(false);
  const [shareToken, setShareToken] = useState("");
  const [avatarUrl,  setAvatarUrl]  = useState("");
  const [canNativeShare, setCanNativeShare] = useState(false);
  const [copied,     setCopied]     = useState(false);
  const [viewStats,  setViewStats]  = useState(null);
  const [prVideos,        setPrVideos]        = useState([]);
  const [playingId,       setPlayingId]       = useState(null);
  const [expandedExercise, setExpandedExercise] = useState(null);

  const shareUrl = shareToken && typeof window !== "undefined"
    ? `${window.location.origin}/recruit/${shareToken}`
    : "";

  const isDirty = savedForm !== null && JSON.stringify(form) !== JSON.stringify(savedForm);
  const score   = getScore(form);
  const missing = getMissing(form);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [r, rv] = await Promise.all([
        fetch("/api/athlete/profile",   { credentials: "include" }),
        fetch("/api/athlete/pr-videos", { credentials: "include" }),
      ]);
      const d  = await r.json();
      const dv = await rv.json().catch(() => ({ videos: [] }));
      if (!d.ok) { toast.error("Could not load profile"); return; }
      setPrVideos(dv.videos ?? []);
      const p = d.profile;
      const loaded = {
        sport:           p.sport           || "",
        position:        p.position        || "",
        graduation_year: p.graduation_year ? String(p.graduation_year) : "",
        school:          p.school          || "",
        height:          p.height          || "",
        weight:          p.weight          || "",
        gpa:             p.gpa             || "",
        bio:              p.bio              || "",
        show_contact:     !!p.show_contact,
        achievements:     Array.isArray(p.achievements) ? p.achievements : [],
        hudl_url:         p.hudl_url         || "",
        sat_score:        p.sat_score        ? String(p.sat_score) : "",
        act_score:        p.act_score        ? String(p.act_score) : "",
        recruiting_status: p.recruiting_status || "",
        top_schools:      (() => { const s = Array.isArray(p.top_schools) ? p.top_schools : []; return [s[0]||"", s[1]||"", s[2]||""]; })(),
        family_statement: p.family_statement  || "",
        _hasAvatar:       !!p.avatar_url,
      };
      setForm(loaded);
      setSavedForm(JSON.parse(JSON.stringify(loaded)));
      setIsPublic(!!p.is_public);
      setShareToken(p.share_token || "");
      const av = p.avatar_url || "";
      setAvatarUrl(av);
      if (av) { try { localStorage.setItem("checkpeak:athlete-avatar", av); } catch {} }
      setViewStats(d.viewStats    || null);
    } catch {
      toast.error("Could not load profile");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authReady && isAthlete) load();
  }, [authReady, isAthlete, load]);

  const save = async () => {
    if (saving) return;
    setSaving(true);
    try {
      const { _hasAvatar, ...payload } = form;
      const r = await fetch("/api/athlete/profile", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "update", ...payload }),
      });
      const d = await r.json();
      if (!d.ok) throw new Error(d.error || "Failed to save");
      setSavedForm(JSON.parse(JSON.stringify(form)));
      toast.success("Profile saved");
    } catch (e) {
      toast.error(e.message || "Could not save");
    } finally {
      setSaving(false);
    }
  };

  const togglePublic = async () => {
    const next = !isPublic;
    setSaving(true);
    try {
      const r = await fetch("/api/athlete/profile", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: next ? "share" : "unpublish" }),
      });
      const d = await r.json();
      if (!d.ok) throw new Error(d.error || "Failed");
      setIsPublic(next);
      if (next && d.shareToken) setShareToken(d.shareToken);
      toast.success(next ? "Profile is now public" : "Profile set to private");
    } catch (e) {
      toast.error(e.message || "Could not update visibility");
    } finally {
      setSaving(false);
    }
  };

  const copyLink = () => {
    if (!shareUrl) return;
    navigator.clipboard?.writeText(shareUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    });
  };

  useEffect(() => {
    setCanNativeShare(typeof navigator !== "undefined" && "share" in navigator);
  }, []);

  const nativeShare = () => {
    if (!shareUrl || !canNativeShare) return;
    const firstName = (userName || "Athlete").split(" ")[0];
    navigator.share({
      title: `${userName || "Athlete"} · CheckPeak Recruiting Profile`,
      text: `Check out ${firstName}'s recruiting profile on CheckPeak`,
      url: shareUrl,
    }).catch(() => {});
  };

  const handleAvatarUploaded = (url) => {
    setAvatarUrl(url);
    setForm(p => ({ ...p, _hasAvatar: true }));
    setSavedForm(p => p ? { ...p, _hasAvatar: true } : p);
    try { localStorage.setItem("checkpeak:athlete-avatar", url); } catch {}
  };

  if (!authReady) return null;
  if (!isAthlete) return (
    <div style={{ padding: 32, fontSize: 14, color: C.muted }}>Not authorized.</div>
  );

  return (
    <div style={{ minHeight: "100dvh", background: C.bg, paddingBottom: 80 }}>
      <Toaster position="bottom-center" toastOptions={{
        style: { background: "#1A1A2E", color: "#EEEEFF", fontSize: 13, fontWeight: 600, border: "1px solid #2A2A4A" },
        error: { iconTheme: { primary: "#EF4444", secondary: "#1A1A2E" } },
      }} />

      {/* ── Header ── */}
      <div style={{
        background: C.surface, borderBottom: `1px solid ${C.line}`,
        position: "sticky", top: 0, zIndex: 20,
        paddingTop: "env(safe-area-inset-top,0)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "13px 18px" }}>
          <button onClick={() => router.back()} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex" }}>
            <ChevronLeft size={20} color={C.muted} />
          </button>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: C.white, letterSpacing: "-0.3px" }}>Recruiting Profile</div>
            <div style={{ fontSize: 11, color: C.muted, marginTop: 1 }}>
              {isPublic ? "Public · visible to coaches" : "Private · only you can see this"}
            </div>
          </div>
          <button
            onClick={save}
            disabled={saving || loading || !isDirty}
            style={{
              padding: "8px 18px",
              background: isDirty ? C.accent : C.faint,
              border: `1px solid ${isDirty ? C.accent : C.line2}`,
              borderRadius: 9, fontSize: 12, fontWeight: 800,
              color: isDirty ? "#fff" : C.muted,
              cursor: isDirty && !saving ? "pointer" : "not-allowed",
              fontFamily: "inherit",
              transition: "all 0.2s",
              opacity: saving ? 0.7 : 1,
            }}>
            {saving ? "Saving…" : isDirty ? "Save" : "Saved"}
          </button>
        </div>
      </div>

      <div style={{ maxWidth: 520, margin: "0 auto", padding: "24px 18px" }}>
        {loading ? (
          <div style={{ display: "flex", justifyContent: "center", padding: 60 }}>
            <Loader2 size={24} color={C.muted} style={{ animation: "spin 1s linear infinite" }} />
            <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
          </div>
        ) : (
          <>
            {/* ── COMPLETION SCORE ── */}
            <div style={{
              padding: "16px 18px", background: C.card,
              border: `1px solid ${score >= 90 ? "rgba(0,200,81,0.2)" : C.line2}`,
              borderRadius: 14, marginBottom: 24,
            }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                <div style={{ fontSize: 10, fontWeight: 900, letterSpacing: "0.14em", color: C.muted }}>PROFILE STRENGTH</div>
                <div style={{ fontSize: 22, fontWeight: 900, color: scoreColor(score), letterSpacing: "-0.03em" }}>{score}%</div>
              </div>
              {/* Progress bar */}
              <div style={{ height: 5, background: C.line2, borderRadius: 3, overflow: "hidden", marginBottom: 12 }}>
                <div style={{
                  height: "100%", width: `${score}%`,
                  background: scoreColor(score),
                  borderRadius: 3,
                  transition: "width 0.5s ease, background 0.5s",
                }} />
              </div>
              {missing.length > 0 && (
                <div style={{ fontSize: 11, color: C.muted, lineHeight: 1.5 }}>
                  <span style={{ color: C.dim, fontWeight: 600 }}>Add next: </span>
                  {missing.slice(0, 3).join(" · ")}
                  {missing.length > 3 && <span style={{ color: "rgba(238,238,255,0.22)" }}> +{missing.length - 3} more</span>}
                </div>
              )}
              {score === 100 && (
                <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: C.green, fontWeight: 700 }}>
                  <Shield size={11} color={C.green} />
                  Profile complete — you&apos;re standing out to recruiters
                </div>
              )}
            </div>

            {/* ── SEASON STATS LINK ── */}
            <button
              onClick={() => router.push("/athlete/stats")}
              style={{
                width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "14px 18px", background: C.card, border: `1px solid ${C.line2}`,
                borderRadius: 12, marginBottom: 20, cursor: "pointer", fontFamily: "inherit",
              }}>
              <div style={{ textAlign: "left" }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: C.white }}>Season Stats</div>
                <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>Game-by-game log, season totals, and performance tracking</div>
              </div>
              <ChevronLeft size={16} color={C.muted} style={{ transform: "rotate(180deg)", flexShrink: 0 }} />
            </button>

            {/* ── AVATAR ── */}
            <AvatarUploader url={avatarUrl} name={userName} onUploaded={handleAvatarUploaded} />

            {/* ── YOUR INFO ── */}
            <div style={{ fontSize: 9, fontWeight: 900, letterSpacing: "0.16em", color: C.muted, marginBottom: 16 }}>YOUR INFO</div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 4 }}>
              <Field label="Sport">
                <input
                  value={form.sport}
                  onChange={e => setForm(p => ({ ...p, sport: e.target.value }))}
                  placeholder="Baseball, Football…"
                  style={inputStyle}
                />
              </Field>
              <Field label="Position">
                <input
                  value={form.position}
                  onChange={e => setForm(p => ({ ...p, position: e.target.value }))}
                  placeholder="SS, QB, PG…"
                  style={inputStyle}
                />
              </Field>
            </div>

            <Field label="School">
              <input
                value={form.school}
                onChange={e => setForm(p => ({ ...p, school: e.target.value }))}
                placeholder="Lincoln High School"
                style={inputStyle}
              />
            </Field>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14, marginBottom: 4 }}>
              <Field label="Class of">
                <select
                  value={form.graduation_year}
                  onChange={e => setForm(p => ({ ...p, graduation_year: e.target.value }))}
                  style={{ ...inputStyle, appearance: "none" }}>
                  <option value="">Year</option>
                  {GRAD_YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </Field>
              <Field label="Height">
                <input
                  value={form.height}
                  onChange={e => setForm(p => ({ ...p, height: e.target.value }))}
                  placeholder={`6'1"`}
                  style={inputStyle}
                />
              </Field>
              <Field label="Weight">
                <input
                  value={form.weight}
                  onChange={e => setForm(p => ({ ...p, weight: e.target.value }))}
                  placeholder="182 lb"
                  style={inputStyle}
                />
              </Field>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14, marginBottom: 4 }}>
              <Field label="GPA" hint="optional">
                <input
                  value={form.gpa}
                  onChange={e => setForm(p => ({ ...p, gpa: e.target.value }))}
                  placeholder="3.8"
                  style={inputStyle}
                />
              </Field>
              <Field label="SAT Score" hint="optional">
                <input
                  value={form.sat_score}
                  onChange={e => setForm(p => ({ ...p, sat_score: e.target.value }))}
                  placeholder="1280"
                  inputMode="numeric"
                  style={inputStyle}
                />
              </Field>
              <Field label="ACT Score" hint="optional">
                <input
                  value={form.act_score}
                  onChange={e => setForm(p => ({ ...p, act_score: e.target.value }))}
                  placeholder="27"
                  inputMode="numeric"
                  style={inputStyle}
                />
              </Field>
            </div>

            <Field label="Bio" hint="shown on your profile — 500 chars">
              <textarea
                value={form.bio}
                onChange={e => setForm(p => ({ ...p, bio: e.target.value.slice(0, 500) }))}
                placeholder="3 years varsity, team captain, 2× All-State…"
                rows={4}
                style={{ ...inputStyle, resize: "vertical", lineHeight: 1.6 }}
              />
              <div style={{ fontSize: 10, color: C.muted, marginTop: 4, textAlign: "right" }}>{form.bio.length}/500</div>
            </Field>

            {/* ── ACHIEVEMENTS ── */}
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 9, fontWeight: 900, letterSpacing: "0.16em", color: C.muted, marginBottom: 8 }}>
                ACHIEVEMENTS
                <span style={{ fontWeight: 500, textTransform: "none", letterSpacing: 0, color: "rgba(238,238,255,0.22)", marginLeft: 6 }}>
                  up to 10 · press Enter to add
                </span>
              </div>
              <AchievementsInput
                value={form.achievements}
                onChange={v => setForm(p => ({ ...p, achievements: v }))}
              />
              <div style={{ fontSize: 10, color: C.muted, marginTop: 6 }}>
                Examples: 2× All-State · Team Captain · Academic All-American · Region MVP
              </div>
            </div>

            {/* ── FILM LINK (HUDL) ── */}
            <Field label="Hudl profile link" hint="optional">
              <div style={{ position: "relative" }}>
                <LinkIcon size={13} color={C.muted} style={{ position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} />
                <input
                  value={form.hudl_url}
                  onChange={e => setForm(p => ({ ...p, hudl_url: e.target.value }))}
                  placeholder="https://www.hudl.com/athletes/…"
                  style={{ ...inputStyle, paddingLeft: 34 }}
                />
              </div>
              <div style={{ fontSize: 10, color: C.muted, marginTop: 5 }}>Shown as a film link on your profile. Coaches use Hudl to evaluate athletes.</div>
            </Field>

            {/* ── RECRUITING STATUS ── */}
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 9, fontWeight: 900, letterSpacing: "0.16em", color: C.muted, marginBottom: 16 }}>RECRUITING STATUS</div>

              <Field label="Status" hint="shown on your profile">
                <select
                  value={form.recruiting_status}
                  onChange={e => setForm(p => ({ ...p, recruiting_status: e.target.value }))}
                  style={{ ...inputStyle, appearance: "none" }}>
                  <option value="">Not set</option>
                  {RECRUITING_STATUS_OPTIONS.map(o => <option key={o.key} value={o.key}>{o.label}</option>)}
                </select>
              </Field>

              <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", color: C.muted, marginBottom: 10 }}>
                {form.recruiting_status === "committed" || form.recruiting_status === "signed" ? "Committed To" : "Top Schools"}
                <span style={{ fontWeight: 500, textTransform: "none", letterSpacing: 0, color: "rgba(238,238,255,0.22)", marginLeft: 6 }}>up to 3</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {[0, 1, 2].map(i => (
                  <input
                    key={i}
                    value={form.top_schools[i]}
                    onChange={e => {
                      const next = [...form.top_schools];
                      next[i] = e.target.value;
                      setForm(p => ({ ...p, top_schools: next }));
                    }}
                    placeholder={`School ${i + 1}`}
                    style={inputStyle}
                  />
                ))}
              </div>
            </div>

            {/* ── VISIBILITY ── */}
            <div style={{
              padding: "18px", background: isPublic ? "rgba(0,200,81,0.05)" : C.card,
              border: `1px solid ${isPublic ? "rgba(0,200,81,0.2)" : C.line2}`,
              borderRadius: 14, marginBottom: 20, transition: "all 0.3s",
            }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: isPublic ? 14 : 0 }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                    {isPublic ? <Eye size={13} color={C.green} /> : <EyeOff size={13} color={C.muted} />}
                    <span style={{ fontSize: 13, fontWeight: 700, color: isPublic ? C.green : C.dim }}>
                      {isPublic ? "Profile is public" : "Profile is private"}
                    </span>
                  </div>
                  <div style={{ fontSize: 11, color: C.muted, marginTop: 3 }}>
                    {isPublic ? "Anyone with your link can view your profile" : "Only you can see this — share when ready"}
                  </div>
                </div>
                <button
                  onClick={togglePublic}
                  disabled={saving}
                  style={{
                    padding: "8px 16px", borderRadius: 9, fontSize: 12, fontWeight: 800,
                    cursor: "pointer", fontFamily: "inherit", border: "none", flexShrink: 0, marginLeft: 12,
                    background: isPublic ? "rgba(239,68,68,0.12)" : C.green,
                    color: isPublic ? C.red : "#02180A",
                    opacity: saving ? 0.6 : 1,
                    transition: "all 0.2s",
                  }}>
                  {isPublic ? "Make private" : "Go public"}
                </button>
              </div>

              {isPublic && shareUrl && (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {/* Share URL row */}
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{
                      flex: 1, padding: "8px 12px", background: "rgba(0,0,0,0.3)",
                      border: "1px solid rgba(0,200,81,0.18)", borderRadius: 8,
                      fontSize: 11, fontWeight: 600, color: C.muted,
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    }}>
                      {shareUrl}
                    </div>
                    <button onClick={copyLink} style={{
                      display: "flex", alignItems: "center", gap: 5, padding: "8px 12px",
                      background: copied ? "rgba(0,200,81,0.12)" : C.faint,
                      border: `1px solid ${copied ? "rgba(0,200,81,0.3)" : C.line2}`,
                      borderRadius: 8, fontSize: 11, fontWeight: 700,
                      color: copied ? C.green : C.dim, cursor: "pointer", fontFamily: "inherit", flexShrink: 0,
                      transition: "all 0.2s",
                    }}>
                      {copied ? <Check size={11} /> : <Copy size={11} />}
                      {copied ? "Copied!" : "Copy"}
                    </button>
                    {canNativeShare && (
                      <button onClick={nativeShare} style={{
                        display: "flex", alignItems: "center", gap: 5, padding: "8px 12px",
                        background: C.faint, border: `1px solid ${C.line2}`,
                        borderRadius: 8, fontSize: 11, fontWeight: 700,
                        color: C.accent, cursor: "pointer", fontFamily: "inherit", flexShrink: 0,
                      }}>
                        <Share2 size={11} />
                        Share
                      </button>
                    )}
                    <a href={shareUrl} target="_blank" rel="noopener noreferrer" style={{
                      display: "flex", padding: 8, background: C.faint,
                      border: `1px solid ${C.line2}`, borderRadius: 8, flexShrink: 0,
                    }}>
                      <ExternalLink size={13} color={C.muted} />
                    </a>
                  </div>
                  {/* QR Code */}
                  <QRCodeSection shareUrl={shareUrl} athleteName={userName} />
                </div>
              )}
            </div>

            {/* ── SHOW CONTACT EMAIL ── */}
            <div style={{ padding: "16px 18px", background: C.card, border: `1px solid ${C.line2}`, borderRadius: 12, marginBottom: 24 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: C.dim }}>Show contact email</div>
                  <div style={{ fontSize: 11, color: C.muted, marginTop: 3, lineHeight: 1.5 }}>
                    Recruiters can send you messages through a form — your email stays private.
                  </div>
                </div>
                <button
                  onClick={() => setForm(p => ({ ...p, show_contact: !p.show_contact }))}
                  style={{
                    width: 44, height: 26, borderRadius: 13, border: "none",
                    cursor: "pointer", flexShrink: 0, marginLeft: 14,
                    background: form.show_contact ? C.accent : C.line2,
                    transition: "background 0.2s", position: "relative",
                  }}>
                  <div style={{
                    position: "absolute", top: 3, left: form.show_contact ? 21 : 3,
                    width: 20, height: 20, borderRadius: "50%", background: "#fff",
                    transition: "left 0.2s",
                  }} />
                </button>
              </div>
            </div>

            {/* ── VIEW ANALYTICS ── */}
            {isPublic && viewStats && <ViewAnalytics viewStats={viewStats} />}

            {/* ── PR PERFORMANCE VIDEOS ── */}
            {(() => {
              // Group by exercise, API already returns newest-first
              const groups = [];
              const seen = {};
              prVideos.forEach(v => {
                const key = v.exercise_title;
                if (!seen[key]) { seen[key] = []; groups.push({ key, videos: seen[key] }); }
                seen[key].push(v);
              });
              if (!groups.length) return null;

              const fmtLabel = (v) => [
                v.actual_weight ? `${v.actual_weight} lbs` : null,
                v.actual_reps   ? `${v.actual_reps} reps`  : null,
              ].filter(Boolean).join(" · ");

              const fmtDate = (v) => v.date
                ? new Date(v.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                : null;

              const PlayBtn = ({ v }) => {
                const isPlaying = playingId === v.id;
                return (
                  <div>
                    {isPlaying ? (
                      <video src={v.video_url} controls autoPlay
                        style={{ width: "100%", height: 220, objectFit: "contain", background: "#000", display: "block" }}
                      />
                    ) : (
                      <button
                        onClick={() => setPlayingId(v.id)}
                        style={{
                          width: "100%", background: "none", border: "none",
                          cursor: "pointer", padding: "12px 16px",
                          display: "flex", alignItems: "center", gap: 12, fontFamily: "inherit",
                        }}
                      >
                        <div style={{
                          width: 34, height: 34, borderRadius: "50%", flexShrink: 0,
                          background: "rgba(251,191,36,0.1)", border: "1px solid rgba(251,191,36,0.3)",
                          display: "flex", alignItems: "center", justifyContent: "center",
                        }}>
                          <div style={{ width: 0, height: 0, borderStyle: "solid", borderWidth: "5px 0 5px 10px", borderColor: "transparent transparent transparent #FBBF24", marginLeft: 2 }} />
                        </div>
                        <div style={{ textAlign: "left", flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 12, fontWeight: 700, color: C.white }}>{fmtLabel(v) || "—"}</div>
                          {fmtDate(v) && <div style={{ fontSize: 10, color: C.muted, marginTop: 1 }}>{fmtDate(v)}</div>}
                        </div>
                      </button>
                    )}
                  </div>
                );
              };

              return (
                <div style={{ marginBottom: 24 }}>
                  <div style={{ fontSize: 9, fontWeight: 900, letterSpacing: "0.16em", color: C.muted, marginBottom: 14 }}>
                    PR PERFORMANCE VIDEOS
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {groups.map(({ key, videos }) => {
                      const latest = videos[0];
                      const older  = videos.slice(1);
                      const isExpanded = expandedExercise === key;
                      return (
                        <div key={key} style={{ background: C.card, border: `1px solid rgba(251,191,36,0.2)`, borderRadius: 12, overflow: "hidden" }}>
                          {/* Exercise title + PR count */}
                          <div style={{
                            display: "flex", alignItems: "center", justifyContent: "space-between",
                            padding: "10px 16px", borderBottom: `1px solid ${C.line2}`,
                            background: "rgba(251,191,36,0.04)",
                          }}>
                            <div style={{ fontSize: 13, fontWeight: 800, color: C.white, letterSpacing: "-0.2px" }}>{key}</div>
                            <div style={{ fontSize: 9, fontWeight: 900, letterSpacing: "0.12em", color: "#FBBF24" }}>
                              {videos.length} PR{videos.length > 1 ? "s" : ""}
                            </div>
                          </div>

                          {/* Latest video */}
                          <PlayBtn v={latest} />

                          {/* Older PRs — expandable */}
                          {older.length > 0 && (
                            <>
                              <button
                                onClick={() => setExpandedExercise(isExpanded ? null : key)}
                                style={{
                                  width: "100%", background: "none",
                                  border: "none", borderTop: `1px solid ${C.line2}`,
                                  cursor: "pointer", padding: "9px 16px",
                                  display: "flex", alignItems: "center", justifyContent: "space-between",
                                  fontFamily: "inherit",
                                }}
                              >
                                <span style={{ fontSize: 11, fontWeight: 600, color: C.muted }}>
                                  {isExpanded ? "Hide" : `${older.length} previous PR${older.length > 1 ? "s" : ""}`}
                                </span>
                                <span style={{ fontSize: 11, color: C.muted }}>{isExpanded ? "▲" : "▼"}</span>
                              </button>
                              {isExpanded && older.map(v => (
                                <div key={v.id} style={{ borderTop: `1px solid ${C.line2}` }}>
                                  <PlayBtn v={v} />
                                </div>
                              ))}
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}

            {/* ── WHAT RECRUITERS SEE ── */}
            <div style={{ padding: "16px 18px", background: C.faint2, border: `1px solid ${C.line}`, borderRadius: 12, marginBottom: 28, marginTop: isPublic && viewStats ? 24 : 0 }}>
              <div style={{ fontSize: 9, fontWeight: 900, letterSpacing: "0.14em", color: C.muted, marginBottom: 14 }}>
                WHAT RECRUITERS SEE
              </div>
              {[
                { label: "Photo & physical info",             on: true },
                { label: "Achievements & accolades",          on: form.achievements.length > 0, note: form.achievements.length === 0 ? "add achievements above" : `${form.achievements.length} listed` },
                { label: "Strength PRs",                      on: true, note: (() => { const ex = [...new Set(prVideos.map(v => v.exercise_title))]; return ex.length > 0 ? `${ex.length} exercise${ex.length > 1 ? "s" : ""}, ${prVideos.length} video${prVideos.length > 1 ? "s" : ""}` : "auto-populated from training logs"; })() },
                { label: "Training heatmap",                  on: true, note: "12-week consistency grid" },
                { label: "Athletic tracking stats",           on: true, note: "from game film — if film tracking is active" },
                { label: "Highlight reel",                    on: true, note: "if you've published one" },
                { label: "Hudl film link",                    on: !!form.hudl_url, note: form.hudl_url ? "linked" : "add Hudl URL above" },
                { label: "Contact form",                      on: form.show_contact },
              ].map((item, i) => (
                <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 9, marginBottom: 9 }}>
                  <div style={{
                    width: 14, height: 14, borderRadius: "50%",
                    background: item.on ? "rgba(0,200,81,0.12)" : C.faint,
                    border: `1px solid ${item.on ? "rgba(0,200,81,0.35)" : C.line2}`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    flexShrink: 0, marginTop: 1,
                  }}>
                    {item.on && <Check size={8} color={C.green} strokeWidth={3} />}
                  </div>
                  <div>
                    <span style={{ fontSize: 12, fontWeight: 600, color: item.on ? C.dim : C.muted }}>{item.label}</span>
                    {item.note && (
                      <span style={{ fontSize: 10, color: "rgba(238,238,255,0.22)", marginLeft: 6 }}>{item.note}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* ── SAVE BUTTON ── */}
            <button
              onClick={save}
              disabled={saving || !isDirty}
              style={{
                width: "100%", padding: 16,
                background: isDirty ? C.accent : C.faint,
                border: `1px solid ${isDirty ? C.accent : C.line2}`,
                borderRadius: 12, fontSize: 14, fontWeight: 800,
                color: isDirty ? "#fff" : C.muted,
                cursor: isDirty && !saving ? "pointer" : "not-allowed",
                fontFamily: "inherit", opacity: saving ? 0.7 : 1,
                transition: "all 0.25s",
              }}>
              {saving ? "Saving…" : isDirty ? "Save profile" : "All changes saved"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
