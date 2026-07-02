// pages/org/messaging.js
// Org Command Center - three tools for coaches:
//   Feed        → broadcast to teams (bulletins, announcements)
//   Messages    → 1:1 and group DMs with athletes
//   Leaderboard → live streak rankings, accountability monitoring
"use client";

import {
  useEffect, useRef, useState, useCallback, useMemo,
} from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  collection, query, where, orderBy, onSnapshot, // orderBy kept for feed query
  addDoc, updateDoc, doc, getDoc, getDocs, setDoc,
  serverTimestamp, arrayUnion,
} from "firebase/firestore";
import {
  ref as storageRef, uploadBytesResumable, getDownloadURL, deleteObject,
} from "firebase/storage";
import {
  Send, ImagePlus, X, Pin, Clock,
  ArrowLeft, Paperclip, Camera, MessageSquare, Rss,
  Plus, Trophy, TrendingUp, Flame, Zap, Crown, Leaf,
  Check, Radio, Users,
} from "lucide-react";
import { useAuthContext } from "@/hooks/useAuth";
import { db, storage } from "@/lib/firebase";
import { useBillingGate }   from "@/hooks/org/useBillingGate";
import BillingGateScreen    from "@/components/org/reviewQueue/BillingGateScreen";
import BillingLoadingScreen from "@/components/org/reviewQueue/BillingLoadingScreen";

// ── Design tokens ─────────────────────────────────────────────────────────────
const DS = {
  brand:        "#1E3A5F",
  brandBg:      "#EEF3F9",
  brandBorder:  "#C0D0E0",
  banned:       "#C8102E",
  bannedBg:     "#FFF0F0",
  bannedBorder: "#FFC8C8",
  border:       "#E8ECF0",
  pageBg:       "#F4F7FB",
  cardBg:       "#FFFFFF",
  bodyText:     "#1A2535",
  labelText:    "#5A6A7D",
  dimText:      "#9BA8B4",
  // Tab accents
  feedAccent:    "#1E3A5F",
  msgAccent:     "#7C3AED",
  rankAccent:    "#D97706",
};

// ── Static data ───────────────────────────────────────────────────────────────
const ALL_SPORTS = [
  { key: "soccer",     label: "Soccer"        },
  { key: "basketball", label: "Basketball"    },
  { key: "xc",         label: "Cross Country" },
  { key: "football",   label: "Football"      },
  { key: "track",      label: "Track"         },
  { key: "swim",       label: "Swimming"      },
  { key: "tennis",     label: "Tennis"        },
  { key: "hockey",     label: "Hockey"        },
  { key: "baseball",   label: "Baseball"      },
  { key: "softball",   label: "Softball"      },
];
const SPORT_MAP = Object.fromEntries(ALL_SPORTS.map(s => [s.key, s]));
const SNAP_DURATION   = 7;
const REPLAY_DURATION = 5;

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtTimeAgo(ts) {
  if (!ts) return "just now";
  const d    = ts?.toDate ? ts.toDate() : new Date(ts);
  const diff = Date.now() - d;
  if (diff < 60000)     return "just now";
  if (diff < 3600000)   return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000)  return `${Math.floor(diff / 3600000)}h ago`;
  if (diff < 604800000) return d.toLocaleDateString([], { weekday: "short", hour: "2-digit", minute: "2-digit" });
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

function fmtTimestamp(ts) {
  if (!ts) return "";
  const d = ts?.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function fmtDateLabel(ts) {
  if (!ts) return "";
  const d   = ts?.toDate ? ts.toDate() : new Date(ts);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) return "Today";
  const yest = new Date(now); yest.setDate(now.getDate() - 1);
  if (d.toDateString() === yest.toDateString()) return "Yesterday";
  return d.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" });
}

function shouldShowDate(messages, index) {
  if (index === 0) return true;
  const curr = messages[index].createdAt;
  const prev = messages[index - 1].createdAt;
  if (!curr || !prev) return false;
  const cd = curr?.toDate ? curr.toDate() : new Date(curr);
  const pd = prev?.toDate ? prev.toDate() : new Date(prev);
  return cd.toDateString() !== pd.toDateString();
}

function getInitials(name) {
  const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function avatarColor(str) {
  const colors = ["#4FABFF", "#7C6EF5", "#0D9A55", "#D4900A", "#FF7B35", "#D92B3A"];
  let hash = 0;
  for (let i = 0; i < String(str || "").length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

function scopeLabelFeed(post) {
  if (post.scope === "org") return "Everyone";
  const sports = Array.isArray(post.sports) ? post.sports : [];
  if (!sports.length) return "Team";
  if (sports.length === 1) {
    const s = SPORT_MAP[sports[0]];
    return s?.label || sports[0];
  }
  return sports.map(k => SPORT_MAP[k]?.label || k).join(", ");
}

function getConvName(conv, myId) {
  if (conv.name) return conv.name;
  const otherId = (conv.participantIds || []).find(id => id !== myId);
  return otherId ? (conv.participantNames?.[otherId] || "Unknown") : "Unknown";
}

function formatFileSize(bytes) {
  if (!bytes) return "";
  if (bytes < 1024)    return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

function normalizeRole(raw) {
  const s = String(raw || "").trim().toLowerCase();
  if (s.includes("ath")) return "athlete";
  return "staff";
}

function StreakIcon({ n }) {
  if (n === 0)  return null;
  if (n < 3)   return <Leaf  size={11} style={{ color: "#0D9A55" }} />;
  if (n < 7)   return <Flame size={11} style={{ color: "#FF7B35" }} />;
  if (n < 14)  return <Zap   size={11} style={{ color: DS.rankAccent }} />;
  if (n < 30)  return <Flame size={11} style={{ color: "#C8102E" }} />;
  return <Crown size={11} style={{ color: "#F5C842" }} />;
}

function useIsMobile(bp = 768) {
  const [mobile, setMobile] = useState(
    typeof window !== "undefined" ? window.innerWidth < bp : false
  );
  useEffect(() => {
    const fn = () => setMobile(window.innerWidth < bp);
    window.addEventListener("resize", fn);
    return () => window.removeEventListener("resize", fn);
  }, [bp]);
  return mobile;
}

// ── Upload helper ─────────────────────────────────────────────────────────────
function uploadFile(file, path, onProgress) {
  return new Promise((resolve, reject) => {
    const sRef = storageRef(storage, path);
    const task = uploadBytesResumable(sRef, file, { contentType: file.type || "application/octet-stream" });
    task.on("state_changed",
      s => onProgress?.(Math.round((s.bytesTransferred / s.totalBytes) * 100)),
      reject,
      () => getDownloadURL(task.snapshot.ref).then(url => resolve({ url, storagePath: path })).catch(reject),
    );
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// FEED COMPONENTS
// ══════════════════════════════════════════════════════════════════════════════

function FeedPostCard({ post }) {
  const color    = avatarColor(post.authorId || post.authorName || "");
  const initials = getInitials(post.authorName || "Coach");
  return (
    <div style={{ background: DS.cardBg, border: `1px solid ${post.pinned ? DS.brand + "55" : DS.border}`, borderLeft: `3px solid ${post.pinned ? DS.brand : DS.border}`, borderRadius: 12, padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
      {post.pinned && (
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <Pin size={12} style={{ color: DS.brand }} />
          <span style={{ fontSize: 10, fontWeight: 700, color: DS.brand, textTransform: "uppercase", letterSpacing: "0.1em" }}>Pinned</span>
        </div>
      )}
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ width: 38, height: 38, borderRadius: "50%", flexShrink: 0, background: color + "22", border: `1.5px solid ${color}44`, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <span style={{ fontSize: 13, fontWeight: 800, color }}>{initials}</span>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: DS.bodyText, marginBottom: 2 }}>{post.authorName || "Coach"}</div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: DS.brand, display: "inline-flex", alignItems: "center", gap: 3 }}>
              {post.scope === "org" ? <Radio size={10} /> : <Users size={10} />}
              {scopeLabelFeed(post)}
            </span>
            <span style={{ fontSize: 11, color: DS.dimText }}>·</span>
            <span style={{ fontSize: 11, color: DS.dimText, display: "flex", alignItems: "center", gap: 3 }}>
              <Clock size={12} />{fmtTimeAgo(post.createdAt)}
            </span>
          </div>
        </div>
      </div>
      <p style={{ fontSize: 15, color: DS.bodyText, lineHeight: 1.6, margin: 0, whiteSpace: "pre-wrap" }}>{post.content}</p>
      {post.imageUrl && <img src={post.imageUrl} alt="Attachment" style={{ width: "100%", maxHeight: 300, objectFit: "cover", borderRadius: 8 }} />}
      {post.reactions && Object.entries(post.reactions).some(([, v]) => (v?.length || 0) > 0) && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {Object.entries(post.reactions).map(([emoji, users]) => {
            const count = Array.isArray(users) ? users.length : 0;
            if (!count) return null;
            return (
              <span key={emoji} style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 10px", borderRadius: 20, background: DS.brandBg, border: `1px solid ${DS.brandBorder}`, fontSize: 12, color: DS.brand, fontWeight: 600 }}>
                {emoji} {count}
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}

function FeedComposePanel({ onClose, myId, myName, myRole, mySport, orgId }) {
  const [content,        setContent]        = useState("");
  const [scope,          setScope]          = useState(mySport ? "team" : "org");
  const [selectedSports, setSelectedSports] = useState(mySport ? [mySport] : []);
  const [imageFile,      setImageFile]      = useState(null);
  const [imagePreview,   setImagePreview]   = useState(null);
  const [posting,        setPosting]        = useState(false);
  const [error,          setError]          = useState("");
  const fileInputRef = useRef(null);

  const toggleSport = key => {
    if (scope === "team") setSelectedSports(prev => prev.includes(key) ? [] : [key]);
    else setSelectedSports(prev => prev.includes(key) ? prev.filter(s => s !== key) : [...prev, key]);
  };

  const handlePost = async () => {
    if (!content.trim()) return;
    if (scope !== "org" && selectedSports.length === 0) { setError("Select at least one sport/team."); return; }
    if (!orgId) { setError("Organisation ID is missing - try logging out and back in."); return; }
    setPosting(true); setError("");
    try {
      let imageUrl = null;
      if (imageFile) imageUrl = (await uploadFile(imageFile, `feed/${orgId}/${Date.now()}.jpg`)).url;
      await addDoc(collection(db, "posts"), {
        authorId: myId, authorName: myName, authorRole: myRole, orgId, scope,
        sports: scope === "org" ? [] : selectedSports,
        content: content.trim(), imageUrl,
        createdAt: serverTimestamp(), reactions: {}, pinned: false,
      });
      setPosting(false);
      onClose();
    } catch (err) {
      setPosting(false);
      setError(err?.message || "Failed to post.");
    }
  };

  const scopes = [
    { key: "org",        label: "Everyone",   Icon: Radio },
    { key: "team",       label: "One sport",  Icon: Users },
    { key: "multi-team", label: "Multi-sport", Icon: Rss  },
  ];

  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}
        style={{ position: "fixed", inset: 0, zIndex: 40, background: "rgba(26,37,53,0.45)", backdropFilter: "blur(3px)" }} />
      <motion.div initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
        transition={{ type: "spring", stiffness: 320, damping: 32 }}
        onClick={e => e.stopPropagation()}
        style={{ position: "fixed", top: 0, right: 0, bottom: 0, width: "min(520px, 100vw)", zIndex: 41, background: DS.cardBg, borderLeft: `1px solid ${DS.border}`, boxShadow: "-8px 0 32px rgba(26,37,53,0.12)", display: "flex", flexDirection: "column" }}>
        <div style={{ height: 3, background: `linear-gradient(to right, ${DS.brand}, #4A7FA5, transparent)`, flexShrink: 0 }} />
        <div style={{ padding: "18px 20px", borderBottom: `1px solid ${DS.border}`, display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
          <div>
            <p style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.14em", color: DS.dimText, marginBottom: 4 }}>New Post</p>
            <h2 style={{ fontSize: 20, fontWeight: 800, color: DS.bodyText, margin: 0 }}>Team Bulletin</h2>
          </div>
          <button type="button" onClick={onClose} style={{ width: 34, height: 34, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", background: DS.pageBg, border: `1px solid ${DS.border}`, color: DS.labelText, cursor: "pointer" }}>
            <X size={16} />
          </button>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: 20 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div>
              <p style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", color: DS.dimText, marginBottom: 10 }}>Post to</p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 6, padding: 4, background: DS.pageBg, border: `1px solid ${DS.border}`, borderRadius: 10 }}>
                {scopes.map(s => (
                  <button key={s.key} type="button"
                    onClick={() => { setScope(s.key); if (s.key === "org") setSelectedSports([]); else if (s.key === "team" && mySport) setSelectedSports([mySport]); }}
                    style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 5, padding: "8px 6px", borderRadius: 7, border: "none", background: scope === s.key ? DS.cardBg : "transparent", boxShadow: scope === s.key ? "0 1px 4px rgba(0,0,0,0.08)" : "none", color: scope === s.key ? DS.brand : DS.labelText, fontWeight: scope === s.key ? 700 : 500, fontSize: 12, cursor: "pointer", textAlign: "center" }}>
                    <s.Icon size={12} />{s.label}
                  </button>
                ))}
              </div>
            </div>
            {scope !== "org" && (
              <div>
                <p style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", color: DS.dimText, marginBottom: 10 }}>
                  {scope === "team" ? "Select sport" : "Select sports"}
                </p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {ALL_SPORTS.map(s => {
                    const active = selectedSports.includes(s.key);
                    return (
                      <button key={s.key} type="button" onClick={() => toggleSport(s.key)}
                        style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "6px 12px", borderRadius: 20, background: active ? DS.brandBg : DS.cardBg, border: `1px solid ${active ? DS.brandBorder : DS.border}`, color: active ? DS.brand : DS.labelText, fontSize: 12, fontWeight: active ? 700 : 500, cursor: "pointer" }}>
                        {s.label}{active && <Check size={10} />}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            <div>
              <p style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", color: DS.dimText, marginBottom: 10 }}>Message</p>
              <textarea value={content} onChange={e => setContent(e.target.value)}
                placeholder="Write an update for your team…" maxLength={1000} rows={6}
                style={{ width: "100%", padding: "12px 14px", background: DS.pageBg, border: `1px solid ${DS.border}`, borderRadius: 10, color: DS.bodyText, fontSize: 14, fontFamily: "inherit", resize: "vertical", outline: "none", boxSizing: "border-box", lineHeight: 1.6 }}
                onFocus={e => { e.target.style.borderColor = DS.brand; }}
                onBlur={e  => { e.target.style.borderColor = DS.border; }} />
              <div style={{ textAlign: "right", marginTop: 4, fontSize: 11, color: DS.dimText }}>{content.length}/1000</div>
            </div>
            {imagePreview ? (
              <div style={{ position: "relative" }}>
                <img src={imagePreview} alt="Preview" style={{ width: "100%", maxHeight: 220, objectFit: "cover", borderRadius: 10 }} />
                <button type="button" onClick={() => { setImageFile(null); setImagePreview(null); }}
                  style={{ position: "absolute", top: 8, right: 8, width: 28, height: 28, borderRadius: "50%", background: "rgba(0,0,0,0.6)", border: "none", color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <X size={14} />
                </button>
              </div>
            ) : (
              <button type="button" onClick={() => fileInputRef.current?.click()}
                style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "10px 14px", borderRadius: 8, background: DS.pageBg, border: `1px dashed ${DS.border}`, color: DS.labelText, fontSize: 13, fontWeight: 500, cursor: "pointer", width: "100%" }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = DS.brandBorder; e.currentTarget.style.color = DS.brand; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = DS.border; e.currentTarget.style.color = DS.labelText; }}>
                <ImagePlus size={16} /> Add photo
              </button>
            )}
            <input ref={fileInputRef} type="file" accept="image/*" style={{ display: "none" }}
              onChange={e => { const f = e.target.files?.[0]; if (f) { setImageFile(f); setImagePreview(URL.createObjectURL(f)); } }} />
            {error && <div style={{ padding: "10px 14px", borderRadius: 8, background: DS.bannedBg, border: `1px solid ${DS.bannedBorder}`, color: DS.banned, fontSize: 13 }}>{error}</div>}
          </div>
        </div>
        <div style={{ padding: "14px 20px", paddingBottom: "max(14px, env(safe-area-inset-bottom))", borderTop: `1px solid ${DS.border}`, display: "flex", gap: 10, flexShrink: 0, background: DS.cardBg }}>
          <button type="button" onClick={handlePost} disabled={!content.trim() || posting}
            style={{ flex: 1, padding: "12px 20px", borderRadius: 10, border: "none", background: content.trim() && !posting ? DS.brand : DS.border, color: content.trim() && !posting ? "#fff" : DS.dimText, fontSize: 14, fontWeight: 800, cursor: content.trim() && !posting ? "pointer" : "not-allowed", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
            <Send size={16} />{posting ? "Posting…" : "Post to Feed"}
          </button>
          <button type="button" onClick={onClose} style={{ padding: "12px 16px", borderRadius: 10, background: DS.pageBg, border: `1px solid ${DS.border}`, color: DS.labelText, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
            Cancel
          </button>
        </div>
      </motion.div>
    </>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// MESSAGES COMPONENTS
// ══════════════════════════════════════════════════════════════════════════════

function PeekViewer({ msg, myId, convId, isReplay, onClose }) {
  const duration = isReplay ? REPLAY_DURATION : SNAP_DURATION;
  const [secs, setSecs] = useState(duration);
  const [pct,  setPct]  = useState(100);
  const done = useRef(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setSecs(s => {
        const next = s - 1;
        setPct(Math.max(0, (next / duration) * 100));
        if (next <= 0) { clearInterval(interval); cleanup(); }
        return next;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const cleanup = useCallback(async () => {
    if (done.current) return;
    done.current = true;
    try {
      if (isReplay) {
        await updateDoc(doc(db, "conversations", convId, "messages", msg.id), { snapReplayedBy: arrayUnion(myId), imageUrl: null });
        if (msg.storagePath) await deleteObject(storageRef(storage, msg.storagePath)).catch(() => {});
      } else {
        await updateDoc(doc(db, "conversations", convId, "messages", msg.id), { snapOpenedBy: arrayUnion(myId) });
      }
    } catch {}
    onClose();
  }, [msg, myId, convId, isReplay, onClose]);

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 100, background: "#000", display: "flex", alignItems: "center", justifyContent: "center" }}>
      {msg.imageUrl && <img src={msg.imageUrl} alt="Peek" style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} />}
      <div style={{ position: "absolute", top: 20, left: 20, right: 20, height: 3, background: "rgba(255,255,255,0.2)", borderRadius: 2, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${pct}%`, background: isReplay ? "#FF7B35" : "#4FABFF", borderRadius: 2, transition: "width 1s linear" }} />
      </div>
      <div style={{ position: "absolute", top: 36, left: 24, background: "rgba(0,0,0,0.6)", borderRadius: 20, padding: "8px 14px", textAlign: "center" }}>
        <div style={{ fontSize: 22, fontWeight: 800, color: "#fff", lineHeight: 1 }}>{secs}</div>
        <div style={{ fontSize: 9, fontWeight: 700, color: "rgba(255,255,255,0.6)", textTransform: "uppercase", letterSpacing: "0.12em", marginTop: 2 }}>{isReplay ? "replay" : "peek"}</div>
      </div>
      <button type="button" onClick={cleanup} style={{ position: "absolute", top: 36, right: 24, width: 40, height: 40, borderRadius: "50%", background: "rgba(0,0,0,0.6)", border: "none", color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <X size={16} />
      </button>
      <div style={{ position: "absolute", bottom: 60, left: 0, right: 0, textAlign: "center" }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: "#fff", textShadow: "0 1px 8px rgba(0,0,0,0.8)" }}>{msg.senderName}</div>
        {isReplay && <div style={{ marginTop: 6, display: "inline-block", background: "rgba(255,123,53,0.85)", borderRadius: 20, padding: "4px 14px", fontSize: 12, fontWeight: 700, color: "#fff" }}>↺ Replay · once only</div>}
      </div>
    </div>
  );
}

function MessageBubble({ msg, isMe, showAvatar, isGroup, myId, convId }) {
  const [viewing,   setViewing]   = useState(false);
  const [replaying, setReplaying] = useState(false);
  const hasOpened   = msg.snapOpenedBy?.includes(myId) ?? false;
  const hasReplayed = msg.snapReplayedBy?.includes(myId) ?? false;
  const hasImage    = !!msg.imageUrl;
  const canView     = !isMe && !hasOpened  && hasImage;
  const canReplay   = !isMe && hasOpened   && !hasReplayed && hasImage;
  const color = avatarColor(msg.senderId);

  return (
    <div style={{ display: "flex", flexDirection: isMe ? "row-reverse" : "row", alignItems: "flex-end", marginBottom: 4, gap: 6 }}>
      {!isMe && isGroup && (
        <div style={{ width: 28, flexShrink: 0 }}>
          {showAvatar && (
            <div style={{ width: 28, height: 28, borderRadius: "50%", background: color + "22", border: `1px solid ${color}44`, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ fontSize: 10, fontWeight: 800, color }}>{getInitials(msg.senderName)}</span>
            </div>
          )}
        </div>
      )}
      <div style={{ maxWidth: "72%", display: "flex", flexDirection: "column", alignItems: isMe ? "flex-end" : "flex-start", gap: 2 }}>
        {!isMe && isGroup && showAvatar && <span style={{ fontSize: 11, fontWeight: 700, color, marginLeft: 10 }}>{msg.senderName}</span>}
        {msg.type === "text" && msg.text && (
          <div style={{ padding: "9px 14px", borderRadius: 18, borderBottomRightRadius: isMe ? 4 : 18, borderBottomLeftRadius: isMe ? 18 : 4, background: isMe ? DS.brand : DS.pageBg, border: isMe ? "none" : `1px solid ${DS.border}` }}>
            <span style={{ fontSize: 14, color: isMe ? "#fff" : DS.bodyText, lineHeight: 1.5 }}>{msg.text}</span>
          </div>
        )}
        {msg.type === "peek" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: isMe ? "flex-end" : "flex-start" }}>
            <div onClick={() => canView && setViewing(true)}
              style={{ display: "inline-flex", alignItems: "center", gap: 10, padding: "10px 14px", borderRadius: 16, background: isMe ? DS.brand : DS.pageBg, border: isMe ? "none" : `1px solid ${DS.brandBorder}`, cursor: canView ? "pointer" : "default", opacity: (!isMe && hasReplayed) ? 0.4 : 1 }}>
              <div style={{ width: 34, height: 34, borderRadius: "50%", background: isMe ? "rgba(255,255,255,0.15)" : DS.brandBg, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Camera size={16} style={{ color: isMe ? "#fff" : DS.brand }} />
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: isMe ? "#fff" : DS.bodyText }}>{isMe ? "Peek sent" : "Peek"}</div>
                <div style={{ fontSize: 11, color: isMe ? "rgba(255,255,255,0.6)" : DS.dimText }}>
                  {isMe ? (hasOpened ? "Opened" : "Delivered") : canView ? `Tap to view · ${SNAP_DURATION}s` : canReplay ? "Click replay below" : "Opened"}
                </div>
              </div>
            </div>
            {canReplay && (
              <button type="button" onClick={() => setReplaying(true)} style={{ fontSize: 11, fontWeight: 700, color: "#FF7B35", background: "none", border: "1px solid #FF7B3555", borderRadius: 20, padding: "3px 10px", cursor: "pointer" }}>
                ↺ Replay once
              </button>
            )}
          </div>
        )}
        {msg.type === "file" && msg.fileUrl && (
          <a href={msg.fileUrl} target="_blank" rel="noopener noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 10, padding: "10px 14px", borderRadius: 14, textDecoration: "none", background: isMe ? DS.brand : DS.pageBg, border: isMe ? "none" : `1px solid ${DS.border}` }}>
            <Paperclip size={16} style={{ color: isMe ? "#fff" : DS.brand, flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: isMe ? "#fff" : DS.bodyText, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{msg.fileName || "File"}</div>
              {msg.fileSize && <div style={{ fontSize: 11, color: isMe ? "rgba(255,255,255,0.6)" : DS.dimText }}>{formatFileSize(msg.fileSize)}</div>}
            </div>
            <span style={{ fontSize: 11, fontWeight: 700, color: isMe ? "rgba(255,255,255,0.7)" : DS.brand }}>Open</span>
          </a>
        )}
        <span style={{ fontSize: 10, color: DS.dimText, marginLeft: isMe ? 0 : 10, marginRight: isMe ? 10 : 0 }}>{fmtTimestamp(msg.createdAt)}</span>
      </div>
      {viewing   && <PeekViewer msg={msg} myId={myId} convId={convId} isReplay={false} onClose={() => setViewing(false)} />}
      {replaying && <PeekViewer msg={msg} myId={myId} convId={convId} isReplay={true}  onClose={() => setReplaying(false)} />}
    </div>
  );
}

function ConversationView({ convId, myId, myName, onBack, isMobile }) {
  const [conversation, setConversation] = useState(null);
  const [messages,     setMessages]     = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [text,         setText]         = useState("");
  const [sending,      setSending]      = useState(false);
  const [uploading,    setUploading]    = useState(false);
  const [uploadPct,    setUploadPct]    = useState(0);
  const bottomRef    = useRef(null);
  const fileInputRef = useRef(null);
  const snapInputRef = useRef(null);

  useEffect(() => {
    if (!convId) return;
    getDoc(doc(db, "conversations", convId)).then(snap => {
      if (snap.exists()) setConversation({ id: snap.id, ...snap.data() });
    });
  }, [convId]);

  useEffect(() => {
    if (!convId) return;
    setLoading(true);
    const q = query(collection(db, "conversations", convId, "messages"), orderBy("createdAt", "asc"));
    const unsub = onSnapshot(q, snap => {
      const list = [];
      snap.forEach(d => list.push({ id: d.id, ...d.data() }));
      setMessages(list);
      setLoading(false);
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 80);
    }, err => { console.error("[messages]", err); setLoading(false); });
    return unsub;
  }, [convId]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const updateConv = async (preview) => {
    await updateDoc(doc(db, "conversations", convId), { lastMessage: preview, lastMessageAt: serverTimestamp(), lastSenderId: myId }).catch(() => {});
  };

  const sendText = async () => {
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    setSending(true); setText("");
    try {
      await addDoc(collection(db, "conversations", convId, "messages"), { senderId: myId, senderName: myName, type: "text", text: trimmed, imageUrl: null, fileName: null, fileUrl: null, fileSize: null, storagePath: null, snapOpenedBy: [], snapReplayedBy: [], createdAt: serverTimestamp() });
      await updateConv(trimmed);
    } catch (err) { console.error("[sendText]", err); }
    finally { setSending(false); }
  };

  const sendSnap = async (file) => {
    if (!file) return;
    setUploading(true); setUploadPct(0);
    try {
      const path = `snaps/${convId}/${Date.now()}_${myId}.jpg`;
      const { url, storagePath } = await uploadFile(file, path, pct => setUploadPct(pct));
      await addDoc(collection(db, "conversations", convId, "messages"), { senderId: myId, senderName: myName, type: "peek", text: null, imageUrl: url, fileName: null, fileUrl: null, fileSize: null, storagePath, snapOpenedBy: [], snapReplayedBy: [], createdAt: serverTimestamp() });
      await updateConv("Photo");
    } catch (err) { console.error("[sendSnap]", err); }
    finally { setUploading(false); setUploadPct(0); }
  };

  const sendFile = async (file) => {
    if (!file) return;
    setUploading(true); setUploadPct(0);
    try {
      const path = `chat/${convId}/${Date.now()}_${file.name}`;
      const { url } = await uploadFile(file, path, pct => setUploadPct(pct));
      await addDoc(collection(db, "conversations", convId, "messages"), { senderId: myId, senderName: myName, type: "file", text: null, imageUrl: null, fileName: file.name, fileUrl: url, fileSize: file.size || null, storagePath: path, snapOpenedBy: [], snapReplayedBy: [], createdAt: serverTimestamp() });
      await updateConv(`📎 ${file.name}`);
    } catch (err) { console.error("[sendFile]", err); }
    finally { setUploading(false); setUploadPct(0); }
  };

  const title    = conversation ? (conversation.name || (conversation.participantIds || []).filter(p => p !== myId).map(p => conversation.participantNames?.[p] || "Unknown").join(", ")) : "…";
  const isGroup  = conversation?.isGroup ?? false;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: DS.cardBg }}>
      <div style={{ padding: "12px 16px", borderBottom: `1px solid ${DS.border}`, display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
        {(isMobile || onBack) && (
          <button type="button" onClick={onBack} style={{ width: 34, height: 34, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", background: DS.pageBg, border: `1px solid ${DS.border}`, color: DS.labelText, cursor: "pointer", flexShrink: 0 }}>
            <ArrowLeft size={16} />
          </button>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: DS.bodyText, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{title}</div>
          {isGroup && <div style={{ fontSize: 11, color: DS.dimText }}>{(conversation?.participantIds || []).length} members</div>}
        </div>
      </div>
      {uploading && (
        <div style={{ height: 28, background: DS.brandBg, display: "flex", alignItems: "center", justifyContent: "center", position: "relative", overflow: "hidden", flexShrink: 0 }}>
          <div style={{ position: "absolute", top: 0, left: 0, bottom: 0, width: `${uploadPct}%`, background: DS.brandBorder, transition: "width 0.3s ease" }} />
          <span style={{ position: "relative", fontSize: 11, fontWeight: 600, color: DS.brand }}>{uploadPct < 100 ? `Uploading ${uploadPct}%…` : "Processing…"}</span>
        </div>
      )}
      <div style={{ flex: 1, overflowY: "auto", padding: "12px 16px" }}>
        {loading ? (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%" }}>
            <div style={{ width: 24, height: 24, border: `2px solid ${DS.brandBorder}`, borderTopColor: DS.brand, borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
          </div>
        ) : messages.length === 0 ? (
          <div style={{ textAlign: "center", padding: "40px 20px", color: DS.dimText, fontSize: 14 }}>No messages yet. Say hello!</div>
        ) : (
          messages.map((msg, i) => {
            const isMe    = msg.senderId === myId;
            const nextMsg = messages[i + 1];
            const showAv  = !nextMsg || nextMsg.senderId !== msg.senderId;
            const showDate = shouldShowDate(messages, i);
            return (
              <div key={msg.id}>
                {showDate && (
                  <div style={{ textAlign: "center", margin: "16px 0" }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: DS.dimText, background: DS.pageBg, padding: "3px 10px", borderRadius: 20 }}>{fmtDateLabel(msg.createdAt)}</span>
                  </div>
                )}
                <MessageBubble msg={msg} isMe={isMe} showAvatar={showAv} isGroup={isGroup} myId={myId} convId={convId} />
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>
      <div style={{ padding: "10px 12px", paddingBottom: "max(10px, env(safe-area-inset-bottom))", borderTop: `1px solid ${DS.border}`, display: "flex", alignItems: "flex-end", gap: 6, flexShrink: 0, background: DS.cardBg }}>
        <button type="button" onClick={() => snapInputRef.current?.click()} disabled={uploading} title="Send a Peek"
          style={{ width: 36, height: 36, borderRadius: "50%", background: DS.brandBg, border: `1px solid ${DS.brandBorder}`, color: DS.brand, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <Camera size={16} />
        </button>
        <input ref={snapInputRef} type="file" accept="image/*" capture="environment" style={{ display: "none" }}
          onChange={e => { const f = e.target.files?.[0]; if (f) { sendSnap(f); e.target.value = ""; } }} />
        <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploading} title="Attach file"
          style={{ width: 36, height: 36, borderRadius: "50%", background: DS.pageBg, border: `1px solid ${DS.border}`, color: DS.labelText, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <Paperclip size={16} />
        </button>
        <input ref={fileInputRef} type="file" style={{ display: "none" }}
          onChange={e => { const f = e.target.files?.[0]; if (f) { sendFile(f); e.target.value = ""; } }} />
        <textarea value={text} onChange={e => setText(e.target.value)} placeholder="Message…" maxLength={2000} rows={1}
          onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendText(); } }}
          style={{ flex: 1, padding: "9px 14px", background: DS.pageBg, border: `1px solid ${DS.border}`, borderRadius: 20, color: DS.bodyText, fontSize: 14, fontFamily: "inherit", resize: "none", outline: "none", maxHeight: 120, lineHeight: 1.5, overflowY: "auto" }}
          onFocus={e => { e.target.style.borderColor = DS.brand; }}
          onBlur={e  => { e.target.style.borderColor = DS.border; }} />
        <button type="button" onClick={sendText} disabled={!text.trim() || sending}
          style={{ width: 36, height: 36, borderRadius: "50%", background: (text.trim() && !sending) ? DS.brand : DS.pageBg, border: (text.trim() && !sending) ? "none" : `1px solid ${DS.border}`, color: (text.trim() && !sending) ? "#fff" : DS.dimText, cursor: (text.trim() && !sending) ? "pointer" : "not-allowed", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <Send size={16} />
        </button>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function ConversationRow({ conv, myId, isActive, onClick }) {
  const name    = getConvName(conv, myId);
  const color   = avatarColor(conv.id);
  const preview = conv.lastMessage ? (conv.lastSenderId === myId ? `You: ${conv.lastMessage}` : conv.lastMessage) : "No messages yet";
  return (
    <button type="button" onClick={onClick}
      style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", width: "100%", textAlign: "left", background: isActive ? DS.brandBg : DS.cardBg, borderLeft: `3px solid ${isActive ? DS.brand : "transparent"}`, border: "none", borderBottom: `1px solid ${DS.border}`, cursor: "pointer" }}
      onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = DS.pageBg; }}
      onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = DS.cardBg; }}>
      <div style={{ width: 44, height: 44, borderRadius: "50%", background: color + "22", border: `1.5px solid ${color}44`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <span style={{ fontSize: 16, fontWeight: 800, color }}>{conv.isGroup ? "#" : getInitials(name)}</span>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 4 }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: DS.bodyText, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</span>
          <span style={{ fontSize: 11, color: DS.dimText, flexShrink: 0 }}>{fmtTimeAgo(conv.lastMessageAt)}</span>
        </div>
        <div style={{ fontSize: 12, color: DS.dimText, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginTop: 2 }}>{preview}</div>
      </div>
    </button>
  );
}

function NewConversationModal({ onClose, myId, myName, orgId, orgToken, onCreated }) {
  const [members,   setMembers]   = useState([]);
  const [selected,  setSelected]  = useState([]);
  const [groupName, setGroupName] = useState("");
  const [search,    setSearch]    = useState("");
  const [loading,   setLoading]   = useState(true);
  const [creating,  setCreating]  = useState(false);
  const [error,     setError]     = useState("");

  useEffect(() => {
    if (!orgToken) { setLoading(false); return; }
    fetch(`/api/athlete/teammates?token=${encodeURIComponent(orgToken)}`)
      .then(r => r.json())
      .then(data => {
        if (!data.ok) throw new Error(data.error || "Failed to load athletes.");
        setMembers((data.teammates || []).map(t => ({ id: t.id, name: t.name, role: t.role || "Athlete", sport: t.sport || "", orgId })));
      })
      .catch(err => setError(err?.message || "Failed to load athletes."))
      .finally(() => setLoading(false));
  }, [orgToken, myId]);

  const toggle = id => setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const create = async () => {
    if (!selected.length) return;
    setCreating(true); setError("");
    try {
      const isGroup        = selected.length > 1;
      const participantIds = [myId, ...selected];
      const participantNames = { [myId]: myName };
      selected.forEach(id => { const m = members.find(x => x.id === id); if (m) participantNames[id] = m.name || "Unknown"; });
      if (!isGroup) {
        const otherId = selected[0];
        const snap = await getDocs(query(collection(db, "conversations"), where("participantIds", "array-contains", myId), where("isGroup", "==", false)));
        const existing = snap.docs.find(d => d.data().participantIds.includes(otherId));
        if (existing) { onCreated(existing.id); return; }
      }
      const ref = await addDoc(collection(db, "conversations"), { name: isGroup ? (groupName.trim() || "Group Chat") : null, isGroup, participantIds, participantNames, lastMessage: null, lastMessageAt: null, lastSenderId: null, orgId, createdAt: serverTimestamp() });
      onCreated(ref.id);
    } catch (err) {
      setError(err?.message || "Failed to create conversation.");
    } finally { setCreating(false); }
  };

  const filtered = members.filter(m => !search || (m.name || "").toLowerCase().includes(search.toLowerCase()));

  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}
        style={{ position: "fixed", inset: 0, zIndex: 50, background: "rgba(26,37,53,0.45)", backdropFilter: "blur(3px)" }} />
      <div style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)", zIndex: 51, width: "min(480px, 92vw)" }}>
        <motion.div initial={{ opacity: 0, scale: 0.96, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96, y: 12 }}
          onClick={e => e.stopPropagation()}
          style={{ maxHeight: "min(80vh, 600px)", background: DS.cardBg, borderRadius: 16, border: `1px solid ${DS.border}`, boxShadow: "0 20px 60px rgba(26,37,53,0.2)", display: "flex", flexDirection: "column", overflow: "hidden" }}>
          <div style={{ padding: "18px 20px", borderBottom: `1px solid ${DS.border}`, display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
            <div>
              <p style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.14em", color: DS.dimText, marginBottom: 4 }}>New</p>
              <h2 style={{ fontSize: 18, fontWeight: 800, color: DS.bodyText, margin: 0 }}>{selected.length > 1 ? "Group Message" : "New Message"}</h2>
            </div>
            <button type="button" onClick={onClose} style={{ width: 32, height: 32, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", background: DS.pageBg, border: `1px solid ${DS.border}`, color: DS.labelText, cursor: "pointer" }}>
              <X size={16} />
            </button>
          </div>
          <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px" }}>
            {selected.length > 1 && (
              <input type="text" value={groupName} onChange={e => setGroupName(e.target.value)} placeholder="Group name (optional)" maxLength={40}
                style={{ width: "100%", padding: "9px 12px", background: DS.pageBg, border: `1px solid ${DS.border}`, borderRadius: 8, color: DS.bodyText, fontSize: 13, fontFamily: "inherit", outline: "none", marginBottom: 14, boxSizing: "border-box" }} />
            )}
            <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search athletes…"
              style={{ width: "100%", padding: "9px 12px", background: DS.pageBg, border: `1px solid ${DS.border}`, borderRadius: 8, color: DS.bodyText, fontSize: 13, fontFamily: "inherit", outline: "none", marginBottom: 12, boxSizing: "border-box" }} />
            {loading ? (
              <div style={{ padding: "20px 0", textAlign: "center", color: DS.dimText, fontSize: 13 }}>Loading athletes…</div>
            ) : filtered.length === 0 ? (
              <div style={{ padding: "20px 0", textAlign: "center", color: DS.dimText, fontSize: 13 }}>{members.length === 0 ? "No athletes found in your org." : "No results."}</div>
            ) : filtered.map((m, i) => {
              const isSel = selected.includes(m.id);
              const color = avatarColor(m.id);
              return (
                <button key={m.id} type="button" onClick={() => toggle(m.id)}
                  style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", padding: "10px 0", borderBottom: i < filtered.length - 1 ? `1px solid ${DS.border}` : "none", background: "none", border: "none", cursor: "pointer", textAlign: "left" }}>
                  <div style={{ width: 38, height: 38, borderRadius: "50%", background: color + "22", border: `1px solid ${color}44`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <span style={{ fontSize: 13, fontWeight: 800, color }}>{getInitials(m.name || "?")}</span>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: DS.bodyText }}>{m.name || "Unknown"}</div>
                    {m.sport ? <div style={{ fontSize: 11, color: DS.dimText }}>{m.role} · {m.sport}</div> : m.role && <div style={{ fontSize: 11, color: DS.dimText }}>{m.role}</div>}
                  </div>
                  <div style={{ width: 22, height: 22, borderRadius: "50%", border: `1.5px solid ${isSel ? DS.brand : DS.border}`, background: isSel ? DS.brand : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    {isSel && <span style={{ fontSize: 11, color: "#fff", fontWeight: 800 }}>✓</span>}
                  </div>
                </button>
              );
            })}
            {error && <div style={{ marginTop: 12, padding: "10px 14px", borderRadius: 8, background: DS.bannedBg, border: `1px solid ${DS.bannedBorder}`, color: DS.banned, fontSize: 13 }}>{error}</div>}
          </div>
          {selected.length > 0 && (
            <div style={{ padding: "14px 20px", borderTop: `1px solid ${DS.border}`, flexShrink: 0 }}>
              <button type="button" onClick={create} disabled={creating}
                style={{ width: "100%", padding: "12px 20px", borderRadius: 10, border: "none", background: DS.brand, color: "#fff", fontSize: 14, fontWeight: 800, cursor: creating ? "not-allowed" : "pointer", opacity: creating ? 0.6 : 1 }}>
                {creating ? "Creating…" : selected.length > 1 ? `Create Group · ${selected.length + 1} people` : "Start Conversation"}
              </button>
            </div>
          )}
        </motion.div>
      </div>
    </>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ══════════════════════════════════════════════════════════════════════════════
export default function OrgMessagingPage() {
  const router   = useRouter();
  const { user, logout } = useAuthContext();
  const isMobile = useIsMobile();

  // ── Auth guard - wait for user to hydrate ─────────────────────────────────
  const myId    = String(user?.id || user?.memberId || "");
  const myName  = String(user?.Name || user?.name || "Coach");
  const myRole  = String(user?.role || user?.Role || "");
  const mySport = String(user?.sport || "").trim().toLowerCase();
  const orgId   = String(user?.orgId || user?.OrgId || user?.organizationId || user?.OrganizationId || user?.id ||"");
  const orgToken = String(user?.Token || user?.token || user?.["Organization Token"] || "").trim();

  const isStaff = normalizeRole(myRole) === "staff";

  const role = useMemo(() => {
    const r = String(user?.role || user?.Role || "").trim().toLowerCase();
    if (r === "organization" || r.includes("org"))   return "organization";
    if (r === "admin"        || r.includes("admin")) return "admin";
    if (r === "trainer"      || r.includes("train")) return "trainer";
    if (r.includes("ath"))                           return "athlete";
    return r;
  }, [user]);
  const isOrgSide = role === "organization" || role === "admin" || role === "trainer";

  const { billingLoading, billingErr, billing, isPaidOk, rawIsPaidOk, isAdminBypass } = useBillingGate({ user, role, isOrgSide });
  const showBillingWarning = isAdminBypass && !rawIsPaidOk;
  const onLogout = useCallback(async () => {
    try { await logout?.(); } finally { router.push("/"); }
  }, [logout, router]);

  const [activeTab,    setActiveTab]    = useState("feed");
  const [activeConvId, setActiveConvId] = useState(null);

  // Feed
  const [posts,       setPosts]       = useState([]);
  const [feedLoading, setFeedLoading] = useState(true);
  const [feedErr,     setFeedErr]     = useState("");
  const [composeOpen, setComposeOpen] = useState(false);
  const [sportFilter, setSportFilter] = useState("all");

  // Messages
  const [conversations, setConversations] = useState([]);
  const [convsLoading,  setConvsLoading]  = useState(true);
  const [showNewConv,   setShowNewConv]   = useState(false);

  // Leaderboard
  const [leaderboard, setLeaderboard] = useState([]);
  const [lbLoading,   setLbLoading]   = useState(false);
  const [lbSport,     setLbSport]     = useState("all");

  // ── Sync coach profile to Firestore ───────────────────────────────────────
  useEffect(() => {
    if (!myId || !orgId) return;
    setDoc(doc(db, "users", myId), { name: myName, role: myRole, orgId, updatedAt: serverTimestamp() }, { merge: true }).catch(() => {});
  }, [myId, myName, myRole, orgId]);

  // ── Feed listener ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!orgId) { setFeedLoading(false); return; }
    setFeedErr("");
    const q = query(collection(db, "posts"), where("orgId", "==", orgId), orderBy("pinned", "desc"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, snap => {
      const list = [];
      snap.forEach(d => list.push({ id: d.id, ...d.data() }));
      setPosts(list);
      setFeedLoading(false);
    }, err => { setFeedErr(err?.message || "Failed to load feed."); setFeedLoading(false); });
    return unsub;
  }, [orgId]);

  // ── Conversations listener ────────────────────────────────────────────────
  useEffect(() => {
    if (!myId) { setConvsLoading(false); return; }
    const q = query(collection(db, "conversations"), where("participantIds", "array-contains", myId), orderBy("lastMessageAt", "desc"));
    const unsub = onSnapshot(q, snap => {
      const list = [];
      snap.forEach(d => list.push({ id: d.id, ...d.data() }));
      setConversations(list);
      setConvsLoading(false);
    }, err => { console.error("[conversations]", err); setConvsLoading(false); });
    return unsub;
  }, [myId]);

  // ── Leaderboard listener ──────────────────────────────────────────────────
  // NOTE: `where + orderBy` on different fields requires a composite Firestore index.
  // We sort client-side instead to avoid that requirement.
  useEffect(() => {
    if (!orgId) return;
    setLbLoading(true);
    const q = query(collection(db, "streaks"), where("orgId", "==", orgId));
    const unsub = onSnapshot(q, snap => {
      const list = [];
      snap.forEach(d => list.push({ id: d.id, ...d.data() }));
      list.sort((a, b) => (b.current || 0) - (a.current || 0));
      setLeaderboard(list);
      setLbLoading(false);
    }, err => { console.error("[leaderboard]", err); setLbLoading(false); });
    return unsub;
  }, [orgId]);

  const filteredPosts = useMemo(() => {
    if (sportFilter === "all") return posts;
    if (sportFilter === "org") return posts.filter(p => p.scope === "org");
    return posts.filter(p => p.scope === "org" || (Array.isArray(p.sports) && p.sports.includes(sportFilter)));
  }, [posts, sportFilter]);

  const activeSports = useMemo(() => {
    const keys = new Set();
    posts.forEach(p => (p.sports || []).forEach(s => keys.add(s)));
    return ALL_SPORTS.filter(s => keys.has(s.key));
  }, [posts]);

  const filteredLb = useMemo(() =>
    lbSport === "all" ? leaderboard : leaderboard.filter(e => e.sport === lbSport),
  [leaderboard, lbSport]);

  const showConvList = !isMobile || !activeConvId;
  const showConvView = activeConvId && (!isMobile || !!activeConvId);

  // ── Tab config ────────────────────────────────────────────────────────────
  const TABS = [
    { key: "feed",        label: "Feed",        icon: Rss,          accent: DS.feedAccent,  count: posts.length },
    { key: "messages",    label: "Messages",    icon: MessageSquare,accent: DS.msgAccent,   count: conversations.length },
    { key: "leaderboard", label: "Leaderboard", icon: Trophy,       accent: DS.rankAccent,  count: leaderboard.length },
  ];

  if (billingLoading) return <BillingLoadingScreen />;
  if (billingErr || !isPaidOk) {
    return (
      <BillingGateScreen
        role={role} billing={billing} error={billingErr}
        onLogout={onLogout} onGoAccount={() => router.push("/account")}
      />
    );
  }

  if (!user || !myId) {
    return (
      <div style={{ minHeight: "100vh", background: DS.pageBg, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ width: 32, height: 32, border: `3px solid ${DS.brandBorder}`, borderTopColor: DS.brand, borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: DS.pageBg, color: DS.bodyText, display: "flex", flexDirection: "column" }}>
    
      {/* ── Page header ───────────────────────────────────────────────────── */}
      <div style={{ background: DS.brand, padding: "14px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", flexShrink: 0 }}>
        <div>
          <p style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.14em", color: "rgba(255,255,255,0.5)", marginBottom: 3 }}>Coach</p>
          <h1 style={{ fontSize: 20, fontWeight: 900, color: "#fff", margin: 0, letterSpacing: "-0.3px" }}>Command Center</h1>
          <p style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", marginTop: 2 }}>
            {posts.length} posts · {conversations.length} conversations · {leaderboard.length} athletes tracked
          </p>
        </div>
        <button type="button" onClick={() => router.push("/org/workouts-calendar")}
          style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "7px 12px", borderRadius: 8, background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)", color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer", textTransform: "uppercase", letterSpacing: "0.06em", whiteSpace: "nowrap" }}>
          ← Dashboard
        </button>
      </div>

      {showBillingWarning && (
        <div className="flex items-center justify-between gap-3 px-4 py-2.5 text-xs font-bold"
          style={{ backgroundColor: "#FFFBF0", borderBottom: "1px solid #FFE0A8", color: "#7A4A0A" }}>
          <span>⚠ Billing requires attention - your organization's subscription is not active.</span>
          <button type="button" onClick={() => router.push("/account")}
            className="shrink-0 px-3 py-1 font-black uppercase tracking-wider"
            style={{ backgroundColor: "#E87722", color: "#fff", border: "none", cursor: "pointer" }}
            onMouseEnter={e => { e.currentTarget.style.filter = "brightness(1.1)"; }}
            onMouseLeave={e => { e.currentTarget.style.filter = "none"; }}>
            Fix billing
          </button>
        </div>
      )}

      {/* ── Tab bar ───────────────────────────────────────────────────────── */}
      <div style={{ background: DS.cardBg, borderBottom: `1px solid ${DS.border}`, display: "flex", flexShrink: 0 }}>
        {TABS.map(({ key, label, icon: Icon, accent, count }) => {
          const active = activeTab === key;
          return (
            <button key={key} type="button" onClick={() => setActiveTab(key)}
              style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "13px 20px", background: "none", border: "none", borderBottom: `2px solid ${active ? accent : "transparent"}`, color: active ? accent : DS.labelText, fontWeight: active ? 700 : 500, fontSize: 14, cursor: "pointer", transition: "all 0.15s ease", position: "relative" }}>
              <Icon size={16} />
              {label}
              {count > 0 && (
                <span style={{ fontSize: 10, fontWeight: 800, background: active ? accent : DS.border, color: active ? "#fff" : DS.dimText, borderRadius: 10, padding: "1px 6px", lineHeight: "16px" }}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── Tab content ───────────────────────────────────────────────────── */}
      <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>

        {/* ── FEED ─────────────────────────────────────────────────────────── */}
        {activeTab === "feed" && (
          <div style={{ flex: 1, overflowY: "auto" }}>
            <div style={{ maxWidth: 680, margin: "0 auto", padding: "20px 16px 60px" }}>
              {isStaff && (
                <div style={{ marginBottom: 16 }}>
                  <button type="button" onClick={() => setComposeOpen(true)}
                    style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "10px 18px", borderRadius: 10, background: DS.brand, border: "none", color: "#fff", fontSize: 13, fontWeight: 800, cursor: "pointer" }}>
                    <Send size={16} /> New Post
                  </button>
                </div>
              )}
              {activeSports.length > 0 && (
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 16 }}>
                  {[{ key: "all", label: "All" }, { key: "org", label: "Everyone" }, ...activeSports].map(s => {
                    const active = sportFilter === s.key;
                    return (
                      <button key={s.key} type="button" onClick={() => setSportFilter(s.key)}
                        style={{ padding: "5px 12px", borderRadius: 20, background: active ? DS.brand : DS.cardBg, border: `1px solid ${active ? DS.brand : DS.border}`, color: active ? "#fff" : DS.labelText, fontSize: 12, fontWeight: active ? 700 : 500, cursor: "pointer" }}>
                        {s.label}
                      </button>
                    );
                  })}
                </div>
              )}
              {feedErr && <div style={{ padding: "12px 16px", borderRadius: 10, marginBottom: 16, background: DS.bannedBg, border: `1px solid ${DS.bannedBorder}`, color: DS.banned, fontSize: 13 }}>{feedErr}</div>}
              {feedLoading && (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {[120, 90, 150].map((h, i) => <div key={i} style={{ height: h, borderRadius: 12, background: "linear-gradient(90deg,#f0f4f8 25%,#e6ecf2 50%,#f0f4f8 75%)", backgroundSize: "200% 100%", animation: "shimmer 1.4s infinite", border: `1px solid ${DS.border}` }} />)}
                </div>
              )}
              {!feedLoading && filteredPosts.length === 0 && !feedErr && (
                <div style={{ textAlign: "center", padding: "60px 20px", background: DS.cardBg, border: `1px solid ${DS.border}`, borderRadius: 12 }}>
                  <div style={{ display: "flex", justifyContent: "center", marginBottom: 12 }}><Rss size={40} style={{ color: DS.dimText }} /></div>
                  <p style={{ fontSize: 16, fontWeight: 700, color: DS.bodyText, marginBottom: 6 }}>No posts yet</p>
                  <p style={{ fontSize: 14, color: DS.dimText, marginBottom: 24, lineHeight: 1.6 }}>
                    {isStaff ? "Post an update and your athletes will see it in the app immediately." : "Your coaches haven't posted anything yet."}
                  </p>
                  {isStaff && (
                    <button type="button" onClick={() => setComposeOpen(true)}
                      style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "11px 24px", borderRadius: 10, background: DS.brand, border: "none", color: "#fff", fontSize: 14, fontWeight: 800, cursor: "pointer" }}>
                      <Send size={16} /> Write first post
                    </button>
                  )}
                </div>
              )}
              {!feedLoading && filteredPosts.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {filteredPosts.map(post => <FeedPostCard key={post.id} post={post} />)}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── MESSAGES ─────────────────────────────────────────────────────── */}
        {activeTab === "messages" && (
          <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
            {showConvList && (
              <div style={{ width: isMobile ? "100%" : 300, flexShrink: 0, borderRight: isMobile ? "none" : `1px solid ${DS.border}`, display: "flex", flexDirection: "column", background: DS.cardBg, overflow: "hidden" }}>
                <div style={{ padding: "14px 16px", borderBottom: `1px solid ${DS.border}`, display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: DS.bodyText }}>Conversations</span>
                  <button type="button" onClick={() => setShowNewConv(true)}
                    style={{ width: 32, height: 32, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", background: DS.brandBg, border: `1px solid ${DS.brandBorder}`, color: DS.brand, cursor: "pointer" }}>
                    <Plus size={16} />
                  </button>
                </div>
                <div style={{ flex: 1, overflowY: "auto" }}>
                  {convsLoading ? (
                    <div style={{ padding: "20px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
                      {[1, 2, 3].map(i => <div key={i} style={{ height: 64, borderRadius: 8, background: DS.pageBg, animation: "shimmer 1.4s infinite" }} />)}
                    </div>
                  ) : conversations.length === 0 ? (
                    <div style={{ padding: "40px 20px", textAlign: "center" }}>
                      <div style={{ width: 56, height: 56, borderRadius: "50%", background: DS.pageBg, border: `1px solid ${DS.border}`, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px" }}>
                        <MessageSquare size={24} style={{ color: DS.dimText }} />
                      </div>
                      <p style={{ fontSize: 14, fontWeight: 700, color: DS.bodyText, marginBottom: 6 }}>No messages yet</p>
                      <p style={{ fontSize: 12, color: DS.dimText, lineHeight: 1.6, marginBottom: 16 }}>Start a conversation with an athlete or coach.</p>
                      <button type="button" onClick={() => setShowNewConv(true)}
                        style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "9px 18px", borderRadius: 8, background: DS.brand, border: "none", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                        <Plus size={16} /> New Message
                      </button>
                    </div>
                  ) : conversations.map(conv => (
                    <ConversationRow key={conv.id} conv={conv} myId={myId} isActive={activeConvId === conv.id} onClick={() => setActiveConvId(conv.id)} />
                  ))}
                </div>
              </div>
            )}
            {!isMobile && !activeConvId && (
              <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", background: DS.pageBg }}>
                <div style={{ textAlign: "center" }}>
                  <div style={{ width: 64, height: 64, borderRadius: "50%", background: DS.cardBg, border: `1px solid ${DS.border}`, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
                    <MessageSquare size={28} style={{ color: DS.dimText }} />
                  </div>
                  <p style={{ fontSize: 15, fontWeight: 700, color: DS.bodyText, marginBottom: 6 }}>Select a conversation</p>
                  <p style={{ fontSize: 13, color: DS.dimText }}>or start a new one</p>
                </div>
              </div>
            )}
            {showConvView && activeConvId && (
              <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
                <ConversationView key={activeConvId} convId={activeConvId} myId={myId} myName={myName} isMobile={isMobile} onBack={() => setActiveConvId(null)} />
              </div>
            )}
          </div>
        )}

        {/* ── LEADERBOARD ───────────────────────────────────────────────────── */}
        {activeTab === "leaderboard" && (
          <div style={{ flex: 1, overflowY: "auto" }}>
            <div style={{ maxWidth: 760, margin: "0 auto", padding: "20px 16px 60px" }}>

              {/* Header */}
              <div style={{ marginBottom: 24 }}>
                <p style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.14em", color: DS.rankAccent, marginBottom: 6 }}>Season Rankings</p>
                <h2 style={{ fontSize: 28, fontWeight: 900, color: DS.bodyText, letterSpacing: "-0.5px", margin: 0 }}>Team Leaderboard</h2>
                <p style={{ fontSize: 13, color: DS.dimText, marginTop: 6, lineHeight: 1.5 }}>
                  Consecutive days completing all workouts, meals, and classes - updated in real-time.
                </p>
              </div>

              {/* Summary stats */}
              {leaderboard.length > 0 && (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 24 }}>
                  {[
                    { label: "Athletes", value: leaderboard.length, Icon: Users, color: DS.brand },
                    { label: "Avg streak", value: `${Math.round(leaderboard.reduce((a, e) => a + (e.current || 0), 0) / leaderboard.length)}d`, Icon: TrendingUp, color: "#0D9A55" },
                    { label: "Top streak", value: `${leaderboard[0]?.current || 0}d`, Icon: Flame, color: DS.rankAccent },
                  ].map(stat => (
                    <div key={stat.label} style={{ background: DS.cardBg, border: `1px solid ${DS.border}`, borderRadius: 12, padding: "14px 16px", textAlign: "center" }}>
                      <div style={{ display: "flex", justifyContent: "center", marginBottom: 6 }}>
                        <stat.Icon size={20} style={{ color: stat.color }} />
                      </div>
                      <div style={{ fontSize: 22, fontWeight: 900, color: DS.bodyText }}>{stat.value}</div>
                      <div style={{ fontSize: 11, color: DS.dimText, marginTop: 2, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em" }}>{stat.label}</div>
                    </div>
                  ))}
                </div>
              )}

              {/* Sport filter */}
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 16 }}>
                {[{ key: "all", label: "All Teams" }, ...ALL_SPORTS].map(s => {
                  const active = lbSport === s.key;
                  return (
                    <button key={s.key} type="button" onClick={() => setLbSport(s.key)}
                      style={{ padding: "5px 12px", borderRadius: 20, background: active ? DS.rankAccent : DS.cardBg, border: `1px solid ${active ? DS.rankAccent : DS.border}`, color: active ? "#fff" : DS.labelText, fontSize: 12, fontWeight: active ? 700 : 500, cursor: "pointer" }}>
                      {s.label}
                    </button>
                  );
                })}
              </div>

              {/* Table */}
              {lbLoading ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {[1,2,3,4,5].map(i => <div key={i} style={{ height: 60, borderRadius: 10, background: "linear-gradient(90deg,#f0f4f8 25%,#e6ecf2 50%,#f0f4f8 75%)", backgroundSize: "200% 100%", animation: "shimmer 1.4s infinite" }} />)}
                </div>
              ) : filteredLb.length === 0 ? (
                <div style={{ textAlign: "center", padding: "60px 20px", background: DS.cardBg, border: `1px solid ${DS.border}`, borderRadius: 12 }}>
                  <div style={{ display: "flex", justifyContent: "center", marginBottom: 12 }}><Trophy size={40} style={{ color: DS.rankAccent }} /></div>
                  <p style={{ fontSize: 15, fontWeight: 700, color: DS.bodyText, marginBottom: 6 }}>No streaks yet</p>
                  <p style={{ fontSize: 13, color: DS.dimText, lineHeight: 1.6 }}>Athletes appear here once they complete all tasks for a day.</p>
                </div>
              ) : (() => {
                const maxStreak = filteredLb[0]?.current || 1;
                return (
                  <div style={{ background: DS.cardBg, border: `1px solid ${DS.border}`, borderRadius: 12, overflow: "hidden" }}>
                    <div style={{ display: "grid", gridTemplateColumns: "52px 1fr 110px 90px", padding: "10px 16px", borderBottom: `1px solid ${DS.border}`, background: DS.pageBg }}>
                      {["RK", "ATHLETE", "SPORT", "STREAK"].map((h, i) => (
                        <span key={h} style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", color: DS.dimText, textAlign: i === 3 ? "right" : "left" }}>{h}</span>
                      ))}
                    </div>
                    {filteredLb.slice(0, 25).map((entry, i) => {
                      const rank  = i + 1;
                      const color = avatarColor(entry.id || entry.userId);
                      const sport = ALL_SPORTS.find(s => s.key === entry.sport);
                      const pct   = entry.current / maxStreak;
                      const medalColor = rank === 1 ? "#F5C842" : rank === 2 ? "#A8B8C8" : "#C47A45";
                      return (
                        <div key={entry.id || entry.userId}
                          style={{ display: "grid", gridTemplateColumns: "52px 1fr 110px 90px", padding: "12px 16px", borderBottom: i < filteredLb.slice(0,25).length - 1 ? `1px solid ${DS.border}` : "none", alignItems: "center", background: rank <= 3 ? DS.brandBg : "transparent" }}>
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
                            {rank <= 3
                              ? <span style={{ width: 28, height: 28, borderRadius: "50%", border: `2px solid ${medalColor}`, background: medalColor + "22", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 900, color: medalColor }}>{rank}</span>
                              : <span style={{ fontSize: 13, fontWeight: 800, color: DS.dimText, width: 28, height: 28, borderRadius: "50%", background: DS.pageBg, display: "flex", alignItems: "center", justifyContent: "center" }}>{rank}</span>
                            }
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                            <div style={{ width: 34, height: 34, borderRadius: "50%", background: color + "22", border: `1.5px solid ${color}44`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                              <span style={{ fontSize: 12, fontWeight: 800, color }}>{getInitials(entry.name || "?")}</span>
                            </div>
                            <div style={{ minWidth: 0 }}>
                              <div style={{ fontSize: 14, fontWeight: 700, color: DS.bodyText, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{entry.name}</div>
                              <div style={{ height: 3, background: DS.border, borderRadius: 2, marginTop: 4, width: 80, overflow: "hidden" }}>
                                <div style={{ height: "100%", width: `${Math.round(pct * 100)}%`, background: entry.current >= 7 ? "#FF7B35" : DS.rankAccent, borderRadius: 2 }} />
                              </div>
                            </div>
                          </div>
                          <div style={{ fontSize: 12, color: DS.dimText, fontWeight: 500 }}>{sport ? sport.label : entry.sport}</div>
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 3 }}>
                            <span style={{ fontSize: 18, fontWeight: 900, color: entry.current >= 7 ? DS.rankAccent : DS.bodyText }}>{entry.current}</span>
                            <span style={{ fontSize: 11, color: DS.dimText }}>d</span>
                            <StreakIcon n={entry.current} />
                          </div>
                        </div>
                      );
                    })}
                    {filteredLb.length > 25 && (
                      <div style={{ padding: "12px 16px", textAlign: "center", color: DS.dimText, fontSize: 12, fontWeight: 600, borderTop: `1px solid ${DS.border}` }}>
                        + {filteredLb.length - 25} more athletes not shown
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          </div>
        )}
      </div>

      {/* ── Modals ────────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {composeOpen && (
          <FeedComposePanel onClose={() => setComposeOpen(false)} myId={myId} myName={myName} myRole={myRole} mySport={mySport} orgId={orgId} />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showNewConv && (
          <NewConversationModal
            onClose={() => setShowNewConv(false)}
            myId={myId} myName={myName} orgId={orgId} orgToken={orgToken}
            onCreated={convId => { setShowNewConv(false); setActiveConvId(convId); setActiveTab("messages"); }}
          />
        )}
      </AnimatePresence>

      <style>{`
        @keyframes shimmer { from { background-position: -200% 0; } to { background-position: 200% 0; } }
        @keyframes spin    { to   { transform: rotate(360deg);    } }
      `}</style>
    </div>
  );
}