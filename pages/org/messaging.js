// pages/org/messaging.js
// Org Messaging — two tabs:
//   Feed     → bulletin board posts (coaches post, athletes read in app)
//   Messages → real-time DMs + group chats (mirrors mobile chat.tsx / conversation.tsx)
//
// Firebase collections used:
//   posts                          — bulletin board
//   conversations                  — DM + group chat metadata
//   conversations/{id}/messages    — individual messages
//   users                          — profile sync so members can find each other
"use client";

import {
  useEffect, useRef, useState, useCallback, useMemo,
} from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  collection, query, where, orderBy, onSnapshot,
  addDoc, updateDoc, doc, getDoc, getDocs, setDoc,
  serverTimestamp, arrayUnion,
} from "firebase/firestore";
import {
  ref as storageRef, uploadBytesResumable, getDownloadURL, deleteObject,
} from "firebase/storage";
import {
  Send, ImagePlus, X, LayoutDashboard, Users, Globe,
  Layers, Pin, Clock, ArrowLeft, Paperclip, Camera,
  MessageSquare, Rss, Plus, ChevronRight,
} from "lucide-react";
import { useAuthContext } from "@/hooks/useAuth";
import { db, storage } from "@/lib/firebase";

/* ─── Design tokens ────────────────────────────────────────────────────────── */
const DS = {
  brand:        "#1E3A5F",
  brandBg:      "#EEF3F9",
  brandBorder:  "#C0D0E0",
  safe:         "#00873E",
  safeBg:       "#F0FBF4",
  safeBorder:   "#A8DFB8",
  caution:      "#B86000",
  cautionBg:    "#FFFBF0",
  cautionBorder:"#FFD580",
  banned:       "#C8102E",
  bannedBg:     "#FFF0F0",
  bannedBorder: "#FFC8C8",
  border:       "#E8ECF0",
  pageBg:       "#F4F7FB",
  cardBg:       "#FFFFFF",
  bodyText:     "#1A2535",
  labelText:    "#5A6A7D",
  dimText:      "#9BA8B4",
};

/* ─── Static data ──────────────────────────────────────────────────────────── */
const ALL_SPORTS = [
  { key: "soccer",     label: "Soccer",        emoji: "⚽" },
  { key: "basketball", label: "Basketball",    emoji: "🏀" },
  { key: "xc",         label: "Cross Country", emoji: "🏃" },
  { key: "football",   label: "Football",      emoji: "🏈" },
  { key: "track",      label: "Track",         emoji: "🏃" },
  { key: "swim",       label: "Swimming",      emoji: "🏊" },
  { key: "tennis",     label: "Tennis",        emoji: "🎾" },
  { key: "hockey",     label: "Hockey",        emoji: "🏒" },
  { key: "baseball",   label: "Baseball",      emoji: "⚾" },
  { key: "softball",   label: "Softball",      emoji: "🥎" },
];
const SPORT_MAP = Object.fromEntries(ALL_SPORTS.map(s => [s.key, s]));
const SNAP_DURATION   = 7;
const REPLAY_DURATION = 5;

/* ─── Helpers ──────────────────────────────────────────────────────────────── */

// FIX: return "just now" for null so pending serverTimestamp() posts show time
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
  for (let i = 0; i < String(str || "").length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

function scopeLabelFeed(post) {
  if (post.scope === "org") return "📣 Everyone";
  const sports = Array.isArray(post.sports) ? post.sports : [];
  if (!sports.length) return "🏅 Team";
  if (sports.length === 1) {
    const s = SPORT_MAP[sports[0]];
    return `${s?.emoji || "🏅"} ${s?.label || sports[0]}`;
  }
  return `🗂 ${sports.map(k => SPORT_MAP[k]?.label || k).join(", ")}`;
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

/* ─── Upload helper ────────────────────────────────────────────────────────── */
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

/* ══════════════════════════════════════════════════════════════════════════════
   FEED COMPONENTS
══════════════════════════════════════════════════════════════════════════════ */

function FeedPostCard({ post }) {
  const color    = avatarColor(post.authorId || post.authorName || "");
  const initials = getInitials(post.authorName || "Coach");

  return (
    <div style={{
      background:   DS.cardBg,
      border:       `1px solid ${post.pinned ? DS.brand + "55" : DS.border}`,
      borderLeft:   `3px solid ${post.pinned ? DS.brand : DS.border}`,
      borderRadius: 12, padding: 16,
      display: "flex", flexDirection: "column", gap: 12,
    }}>
      {post.pinned && (
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <Pin className="w-3 h-3" style={{ color: DS.brand }} />
          <span style={{ fontSize: 10, fontWeight: 700, color: DS.brand, textTransform: "uppercase", letterSpacing: "0.1em" }}>Pinned</span>
        </div>
      )}
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{
          width: 38, height: 38, borderRadius: "50%", flexShrink: 0,
          background: color + "22", border: `1.5px solid ${color}44`,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <span style={{ fontSize: 13, fontWeight: 800, color }}>{initials}</span>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: DS.bodyText, marginBottom: 2 }}>
            {post.authorName || "Coach"}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: DS.brand }}>{scopeLabelFeed(post)}</span>
            <span style={{ fontSize: 11, color: DS.dimText }}>·</span>
            <span style={{ fontSize: 11, color: DS.dimText, display: "flex", alignItems: "center", gap: 3 }}>
              <Clock className="w-3 h-3" />
              {fmtTimeAgo(post.createdAt)}
            </span>
          </div>
        </div>
      </div>
      <p style={{ fontSize: 15, color: DS.bodyText, lineHeight: 1.6, margin: 0, whiteSpace: "pre-wrap" }}>
        {post.content}
      </p>
      {post.imageUrl && (
        <img src={post.imageUrl} alt="Attachment" style={{ width: "100%", maxHeight: 300, objectFit: "cover", borderRadius: 8 }} />
      )}
      {post.reactions && Object.entries(post.reactions).some(([, v]) => (v?.length || 0) > 0) && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {Object.entries(post.reactions).map(([emoji, users]) => {
            const count = Array.isArray(users) ? users.length : 0;
            if (!count) return null;
            return (
              <span key={emoji} style={{
                display: "inline-flex", alignItems: "center", gap: 4,
                padding: "3px 10px", borderRadius: 20,
                background: DS.brandBg, border: `1px solid ${DS.brandBorder}`,
                fontSize: 12, color: DS.brand, fontWeight: 600,
              }}>{emoji} {count}</span>
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

  // FIX: setPosting(false) explicitly before onClose() so state is clean
  // when the panel unmounts — avoids the "Posting…" stuck state.
  // Also validates orgId upfront so the post actually appears in the app.
  const handlePost = async () => {
    if (!content.trim()) return;
    if (scope !== "org" && selectedSports.length === 0) {
      setError("Select at least one sport/team.");
      return;
    }
    if (!orgId) {
      setError("Organisation ID is missing — try logging out and back in.");
      return;
    }

    setPosting(true);
    setError("");

    try {
      let imageUrl = null;
      if (imageFile) {
        imageUrl = (await uploadFile(imageFile, `feed/${orgId}/${Date.now()}.jpg`)).url;
      }

      await addDoc(collection(db, "posts"), {
        authorId:   myId,
        authorName: myName,
        authorRole: myRole,
        orgId,
        scope,
        sports:     scope === "org" ? [] : selectedSports,
        content:    content.trim(),
        imageUrl,
        createdAt:  serverTimestamp(),
        reactions:  {},
        pinned:     false,
      });

      // FIX: clear posting state BEFORE closing so component doesn't
      // freeze on "Posting…" while React is unmounting it
      setPosting(false);
      onClose();
    } catch (err) {
      setPosting(false);
      setError(err?.message || "Failed to post.");
    }
  };

  const scopes = [
    { key: "org",        label: "📣 Everyone" },
    { key: "team",       label: "🏅 One sport" },
    { key: "multi-team", label: "🗂 Multi-sport" },
  ];

  const canPost = content.trim().length > 0 && !posting;

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose}
        style={{ position: "fixed", inset: 0, zIndex: 40, background: "rgba(26,37,53,0.45)", backdropFilter: "blur(3px)" }}
      />
      <motion.div
        initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
        transition={{ type: "spring", stiffness: 320, damping: 32 }}
        onClick={e => e.stopPropagation()}
        style={{
          position: "fixed", top: 0, right: 0, bottom: 0,
          width: "min(520px, 100vw)", zIndex: 41,
          background: DS.cardBg, borderLeft: `1px solid ${DS.border}`,
          boxShadow: "-8px 0 32px rgba(26,37,53,0.12)",
          display: "flex", flexDirection: "column",
        }}
      >
        <div style={{ height: 3, background: `linear-gradient(to right, ${DS.brand}, #4A7FA5, transparent)`, flexShrink: 0 }} />

        {/* Header */}
        <div style={{ padding: "18px 20px", borderBottom: `1px solid ${DS.border}`, display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
          <div>
            <p style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.14em", color: DS.dimText, marginBottom: 4 }}>New Post</p>
            <h2 style={{ fontSize: 20, fontWeight: 800, color: DS.bodyText, margin: 0 }}>Team Bulletin</h2>
          </div>
          <button type="button" onClick={onClose} style={{ width: 34, height: 34, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", background: DS.pageBg, border: `1px solid ${DS.border}`, color: DS.labelText, cursor: "pointer" }}>
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: "auto", padding: 20 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

            {/* Scope selector */}
            <div>
              <p style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", color: DS.dimText, marginBottom: 10 }}>Post to</p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 6, padding: 4, background: DS.pageBg, border: `1px solid ${DS.border}`, borderRadius: 10 }}>
                {scopes.map(s => (
                  <button key={s.key} type="button"
                    onClick={() => {
                      setScope(s.key);
                      if (s.key === "org") setSelectedSports([]);
                      else if (s.key === "team" && mySport) setSelectedSports([mySport]);
                    }}
                    style={{ padding: "8px 4px", borderRadius: 7, border: "none", background: scope === s.key ? DS.cardBg : "transparent", boxShadow: scope === s.key ? "0 1px 4px rgba(0,0,0,0.08)" : "none", color: scope === s.key ? DS.brand : DS.labelText, fontWeight: scope === s.key ? 700 : 500, fontSize: 12, cursor: "pointer", textAlign: "center" }}>
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Sport chips */}
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
                        <span>{s.emoji}</span>
                        {s.label}
                        {active && <span style={{ fontSize: 10, color: DS.brand }}>✓</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Message textarea */}
            <div>
              <p style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", color: DS.dimText, marginBottom: 10 }}>Message</p>
              <textarea
                value={content}
                onChange={e => setContent(e.target.value)}
                placeholder="Write an update for your team…"
                maxLength={1000}
                rows={6}
                style={{ width: "100%", padding: "12px 14px", background: DS.pageBg, border: `1px solid ${DS.border}`, borderRadius: 10, color: DS.bodyText, fontSize: 14, fontFamily: "inherit", resize: "vertical", outline: "none", boxSizing: "border-box", lineHeight: 1.6 }}
                onFocus={e => { e.target.style.borderColor = DS.brand; }}
                onBlur={e  => { e.target.style.borderColor = DS.border; }}
              />
              <div style={{ textAlign: "right", marginTop: 4, fontSize: 11, color: DS.dimText }}>{content.length}/1000</div>
            </div>

            {/* Image */}
            {imagePreview ? (
              <div style={{ position: "relative" }}>
                <img src={imagePreview} alt="Preview" style={{ width: "100%", maxHeight: 220, objectFit: "cover", borderRadius: 10 }} />
                <button type="button" onClick={() => { setImageFile(null); setImagePreview(null); }} style={{ position: "absolute", top: 8, right: 8, width: 28, height: 28, borderRadius: "50%", background: "rgba(0,0,0,0.6)", border: "none", color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <button type="button" onClick={() => fileInputRef.current?.click()}
                style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "10px 14px", borderRadius: 8, background: DS.pageBg, border: `1px dashed ${DS.border}`, color: DS.labelText, fontSize: 13, fontWeight: 500, cursor: "pointer", width: "100%" }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = DS.brandBorder; e.currentTarget.style.color = DS.brand; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = DS.border; e.currentTarget.style.color = DS.labelText; }}>
                <ImagePlus className="w-4 h-4" /> Add photo
              </button>
            )}
            <input
              ref={fileInputRef} type="file" accept="image/*" style={{ display: "none" }}
              onChange={e => {
                const f = e.target.files?.[0];
                if (f) { setImageFile(f); setImagePreview(URL.createObjectURL(f)); }
              }}
            />

            {/* Error */}
            {error && (
              <div style={{ padding: "10px 14px", borderRadius: 8, background: DS.bannedBg, border: `1px solid ${DS.bannedBorder}`, color: DS.banned, fontSize: 13 }}>
                {error}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: "14px 20px", paddingBottom: "max(14px, env(safe-area-inset-bottom))", borderTop: `1px solid ${DS.border}`, display: "flex", gap: 10, flexShrink: 0, background: DS.cardBg }}>
          <button
            type="button"
            onClick={handlePost}
            disabled={!canPost}
            style={{ flex: 1, padding: "12px 20px", borderRadius: 10, border: "none", background: canPost ? DS.brand : DS.border, color: canPost ? "#fff" : DS.dimText, fontSize: 14, fontWeight: 800, cursor: canPost ? "pointer" : "not-allowed", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, transition: "all 0.15s ease" }}
            onMouseEnter={e => { if (canPost) e.currentTarget.style.background = "#162d4a"; }}
            onMouseLeave={e => { if (canPost) e.currentTarget.style.background = DS.brand; }}
          >
            <Send className="w-4 h-4" />
            {posting ? "Posting…" : "Post to Feed"}
          </button>
          <button type="button" onClick={onClose} style={{ padding: "12px 16px", borderRadius: 10, background: DS.pageBg, border: `1px solid ${DS.border}`, color: DS.labelText, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
            Cancel
          </button>
        </div>
      </motion.div>
    </>
  );
}

/* ══════════════════════════════════════════════════════════════════════════════
   CHAT COMPONENTS
══════════════════════════════════════════════════════════════════════════════ */

/* ── Peek viewer ───────────────────────────────────────────────────────────── */
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
        await updateDoc(doc(db, "conversations", convId, "messages", msg.id), {
          snapReplayedBy: arrayUnion(myId), imageUrl: null,
        });
        if (msg.storagePath) await deleteObject(storageRef(storage, msg.storagePath)).catch(() => {});
      } else {
        await updateDoc(doc(db, "conversations", convId, "messages", msg.id), {
          snapOpenedBy: arrayUnion(myId),
        });
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
        <div style={{ fontSize: 9, fontWeight: 700, color: "rgba(255,255,255,0.6)", textTransform: "uppercase", letterSpacing: "0.12em", marginTop: 2 }}>
          {isReplay ? "replay" : "peek"}
        </div>
      </div>
      <button type="button" onClick={cleanup} style={{ position: "absolute", top: 36, right: 24, width: 40, height: 40, borderRadius: "50%", background: "rgba(0,0,0,0.6)", border: "none", color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <X className="w-4 h-4" />
      </button>
      <div style={{ position: "absolute", bottom: 60, left: 0, right: 0, textAlign: "center" }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: "#fff", textShadow: "0 1px 8px rgba(0,0,0,0.8)" }}>{msg.senderName}</div>
        {isReplay && (
          <div style={{ marginTop: 6, display: "inline-block", background: "rgba(255,123,53,0.85)", borderRadius: 20, padding: "4px 14px", fontSize: 12, fontWeight: 700, color: "#fff" }}>
            ↺ Replay · once only
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Message bubble ────────────────────────────────────────────────────────── */
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
          {showAvatar ? (
            <div style={{ width: 28, height: 28, borderRadius: "50%", background: color + "22", border: `1px solid ${color}44`, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ fontSize: 10, fontWeight: 800, color }}>{getInitials(msg.senderName)}</span>
            </div>
          ) : null}
        </div>
      )}

      <div style={{ maxWidth: "72%", display: "flex", flexDirection: "column", alignItems: isMe ? "flex-end" : "flex-start", gap: 2 }}>
        {!isMe && isGroup && showAvatar && (
          <span style={{ fontSize: 11, fontWeight: 700, color, marginLeft: 10 }}>{msg.senderName}</span>
        )}

        {/* Text */}
        {msg.type === "text" && msg.text && (
          <div style={{ padding: "9px 14px", borderRadius: 18, borderBottomRightRadius: isMe ? 4 : 18, borderBottomLeftRadius: isMe ? 18 : 4, background: isMe ? DS.brand : DS.pageBg, border: isMe ? "none" : `1px solid ${DS.border}` }}>
            <span style={{ fontSize: 14, color: isMe ? "#fff" : DS.bodyText, lineHeight: 1.5 }}>{msg.text}</span>
          </div>
        )}

        {/* Peek */}
        {msg.type === "peek" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: isMe ? "flex-end" : "flex-start" }}>
            <div
              onClick={() => canView && setViewing(true)}
              style={{ display: "inline-flex", alignItems: "center", gap: 10, padding: "10px 14px", borderRadius: 16, background: isMe ? DS.brand : DS.pageBg, border: isMe ? "none" : `1px solid ${DS.brandBorder}`, cursor: canView ? "pointer" : "default", opacity: (!isMe && hasReplayed) ? 0.4 : 1 }}
            >
              <div style={{ width: 34, height: 34, borderRadius: "50%", background: isMe ? "rgba(255,255,255,0.15)" : DS.brandBg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>📸</div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: isMe ? "#fff" : DS.bodyText }}>
                  {isMe ? "Peek sent" : "Peek"}
                </div>
                <div style={{ fontSize: 11, color: isMe ? "rgba(255,255,255,0.6)" : DS.dimText }}>
                  {isMe
                    ? (hasOpened ? "Opened" : "Delivered")
                    : canView   ? `Tap to view · ${SNAP_DURATION}s`
                    : canReplay ? "Click replay below"
                    : "Opened"}
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

        {/* File */}
        {msg.type === "file" && msg.fileUrl && (
          <a href={msg.fileUrl} target="_blank" rel="noopener noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 10, padding: "10px 14px", borderRadius: 14, textDecoration: "none", background: isMe ? DS.brand : DS.pageBg, border: isMe ? "none" : `1px solid ${DS.border}` }}>
            <Paperclip className="w-4 h-4" style={{ color: isMe ? "#fff" : DS.brand, flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: isMe ? "#fff" : DS.bodyText, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{msg.fileName || "File"}</div>
              {msg.fileSize && <div style={{ fontSize: 11, color: isMe ? "rgba(255,255,255,0.6)" : DS.dimText }}>{formatFileSize(msg.fileSize)}</div>}
            </div>
            <span style={{ fontSize: 11, fontWeight: 700, color: isMe ? "rgba(255,255,255,0.7)" : DS.brand }}>Open</span>
          </a>
        )}

        <span style={{ fontSize: 10, color: DS.dimText, marginLeft: isMe ? 0 : 10, marginRight: isMe ? 10 : 0 }}>
          {fmtTimestamp(msg.createdAt)}
        </span>
      </div>

      {viewing   && <PeekViewer msg={msg} myId={myId} convId={convId} isReplay={false} onClose={() => setViewing(false)} />}
      {replaying && <PeekViewer msg={msg} myId={myId} convId={convId} isReplay={true}  onClose={() => setReplaying(false)} />}
    </div>
  );
}

/* ── Conversation view ────────────────────────────────────────────────────── */
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

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const updateConv = async (preview) => {
    await updateDoc(doc(db, "conversations", convId), {
      lastMessage: preview, lastMessageAt: serverTimestamp(), lastSenderId: myId,
    }).catch(() => {});
  };

  const sendText = async () => {
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    setSending(true); setText("");
    try {
      await addDoc(collection(db, "conversations", convId, "messages"), {
        senderId: myId, senderName: myName, type: "text", text: trimmed,
        imageUrl: null, fileName: null, fileUrl: null, fileSize: null, storagePath: null,
        snapOpenedBy: [], snapReplayedBy: [], createdAt: serverTimestamp(),
      });
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
      await addDoc(collection(db, "conversations", convId, "messages"), {
        senderId: myId, senderName: myName, type: "peek",
        text: null, imageUrl: url, fileName: null, fileUrl: null,
        fileSize: null, storagePath,
        snapOpenedBy: [], snapReplayedBy: [], createdAt: serverTimestamp(),
      });
      await updateConv("📸 Peek");
    } catch (err) { console.error("[sendSnap]", err); }
    finally { setUploading(false); setUploadPct(0); }
  };

  const sendFile = async (file) => {
    if (!file) return;
    setUploading(true); setUploadPct(0);
    try {
      const path = `chat/${convId}/${Date.now()}_${file.name}`;
      const { url } = await uploadFile(file, path, pct => setUploadPct(pct));
      await addDoc(collection(db, "conversations", convId, "messages"), {
        senderId: myId, senderName: myName, type: "file",
        text: null, imageUrl: null, fileName: file.name, fileUrl: url,
        fileSize: file.size || null, storagePath: path,
        snapOpenedBy: [], snapReplayedBy: [], createdAt: serverTimestamp(),
      });
      await updateConv(`📎 ${file.name}`);
    } catch (err) { console.error("[sendFile]", err); }
    finally { setUploading(false); setUploadPct(0); }
  };

  const title = conversation
    ? (conversation.name || (conversation.participantIds || []).filter(p => p !== myId).map(p => conversation.participantNames?.[p] || "Unknown").join(", "))
    : "…";
  const isGroup = conversation?.isGroup ?? false;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: DS.cardBg }}>
      {/* Header */}
      <div style={{ padding: "12px 16px", borderBottom: `1px solid ${DS.border}`, display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
        {(isMobile || onBack) && (
          <button type="button" onClick={onBack} style={{ width: 34, height: 34, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", background: DS.pageBg, border: `1px solid ${DS.border}`, color: DS.labelText, cursor: "pointer", flexShrink: 0 }}>
            <ArrowLeft className="w-4 h-4" />
          </button>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: DS.bodyText, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{title}</div>
          {isGroup && <div style={{ fontSize: 11, color: DS.dimText }}>{(conversation?.participantIds || []).length} members</div>}
        </div>
      </div>

      {/* Upload progress */}
      {uploading && (
        <div style={{ height: 28, background: DS.brandBg, display: "flex", alignItems: "center", justifyContent: "center", position: "relative", overflow: "hidden", flexShrink: 0 }}>
          <div style={{ position: "absolute", top: 0, left: 0, bottom: 0, width: `${uploadPct}%`, background: DS.brandBorder, transition: "width 0.3s ease" }} />
          <span style={{ position: "relative", fontSize: 11, fontWeight: 600, color: DS.brand }}>
            {uploadPct < 100 ? `Uploading ${uploadPct}%…` : "Processing…"}
          </span>
        </div>
      )}

      {/* Messages */}
      <div style={{ flex: 1, overflowY: "auto", padding: "12px 16px" }}>
        {loading ? (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%" }}>
            <div style={{ width: 24, height: 24, border: `2px solid ${DS.brandBorder}`, borderTopColor: DS.brand, borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
          </div>
        ) : messages.length === 0 ? (
          <div style={{ textAlign: "center", padding: "40px 20px", color: DS.dimText, fontSize: 14 }}>No messages yet. Say hello!</div>
        ) : (
          messages.map((msg, i) => {
            const isMe     = msg.senderId === myId;
            const nextMsg  = messages[i + 1];
            const showAv   = !nextMsg || nextMsg.senderId !== msg.senderId;
            const showDate = shouldShowDate(messages, i);
            return (
              <div key={msg.id}>
                {showDate && (
                  <div style={{ textAlign: "center", margin: "16px 0" }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: DS.dimText, background: DS.pageBg, padding: "3px 10px", borderRadius: 20 }}>
                      {fmtDateLabel(msg.createdAt)}
                    </span>
                  </div>
                )}
                <MessageBubble msg={msg} isMe={isMe} showAvatar={showAv} isGroup={isGroup} myId={myId} convId={convId} />
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input bar */}
      <div style={{ padding: "10px 12px", paddingBottom: "max(10px, env(safe-area-inset-bottom))", borderTop: `1px solid ${DS.border}`, display: "flex", alignItems: "flex-end", gap: 6, flexShrink: 0, background: DS.cardBg }}>
        <button type="button" onClick={() => snapInputRef.current?.click()} disabled={uploading}
          title="Send a Peek (7-second photo)"
          style={{ width: 36, height: 36, borderRadius: "50%", background: DS.brandBg, border: `1px solid ${DS.brandBorder}`, color: DS.brand, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <Camera className="w-4 h-4" />
        </button>
        <input ref={snapInputRef} type="file" accept="image/*" capture="environment" style={{ display: "none" }}
          onChange={e => { const f = e.target.files?.[0]; if (f) { sendSnap(f); e.target.value = ""; } }} />

        <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploading}
          title="Attach file"
          style={{ width: 36, height: 36, borderRadius: "50%", background: DS.pageBg, border: `1px solid ${DS.border}`, color: DS.labelText, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <Paperclip className="w-4 h-4" />
        </button>
        <input ref={fileInputRef} type="file" style={{ display: "none" }}
          onChange={e => { const f = e.target.files?.[0]; if (f) { sendFile(f); e.target.value = ""; } }} />

        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="Message…"
          maxLength={2000}
          rows={1}
          onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendText(); } }}
          style={{ flex: 1, padding: "9px 14px", background: DS.pageBg, border: `1px solid ${DS.border}`, borderRadius: 20, color: DS.bodyText, fontSize: 14, fontFamily: "inherit", resize: "none", outline: "none", maxHeight: 120, lineHeight: 1.5, overflowY: "auto" }}
          onFocus={e => { e.target.style.borderColor = DS.brand; }}
          onBlur={e  => { e.target.style.borderColor = DS.border; }}
        />

        <button type="button" onClick={sendText} disabled={!text.trim() || sending}
          style={{ width: 36, height: 36, borderRadius: "50%", background: (text.trim() && !sending) ? DS.brand : DS.pageBg, border: (text.trim() && !sending) ? "none" : `1px solid ${DS.border}`, color: (text.trim() && !sending) ? "#fff" : DS.dimText, cursor: (text.trim() && !sending) ? "pointer" : "not-allowed", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "all 0.15s ease" }}>
          <Send className="w-4 h-4" />
        </button>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

/* ── Conversation list row ─────────────────────────────────────────────────── */
function ConversationRow({ conv, myId, isActive, onClick }) {
  const name    = getConvName(conv, myId);
  const color   = avatarColor(conv.id);
  const preview = conv.lastMessage
    ? (conv.lastSenderId === myId ? `You: ${conv.lastMessage}` : conv.lastMessage)
    : "No messages yet";

  return (
    <button type="button" onClick={onClick} style={{
      display: "flex", alignItems: "center", gap: 12,
      padding: "12px 16px", width: "100%", textAlign: "left",
      background: isActive ? DS.brandBg : DS.cardBg,
      borderLeft: `3px solid ${isActive ? DS.brand : "transparent"}`,
      border: "none", borderBottom: `1px solid ${DS.border}`,
      cursor: "pointer", transition: "background 0.1s ease",
    }}
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
        const list = (data.teammates || []).map(t => ({
          id:    t.id,
          name:  t.name,
          role:  t.role  || "Athlete",
          sport: t.sport || "",
          orgId,
        }));
        setMembers(list);
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
      selected.forEach(id => {
        const m = members.find(x => x.id === id);
        if (m) participantNames[id] = m.name || "Unknown";
      });

      if (!isGroup) {
        const otherId = selected[0];
        const snap = await getDocs(query(collection(db, "conversations"), where("participantIds", "array-contains", myId), where("isGroup", "==", false)));
        const existing = snap.docs.find(d => d.data().participantIds.includes(otherId));
        if (existing) { onCreated(existing.id); return; }
      }

      const ref = await addDoc(collection(db, "conversations"), {
        name:             isGroup ? (groupName.trim() || "Group Chat") : null,
        isGroup, participantIds, participantNames,
        lastMessage: null, lastMessageAt: null, lastSenderId: null,
        orgId, createdAt: serverTimestamp(),
      });
      onCreated(ref.id);
    } catch (err) {
      setError(err?.message || "Failed to create conversation.");
    } finally { setCreating(false); }
  };

  const filtered = members.filter(m =>
    !search || (m.name || "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose}
        style={{ position: "fixed", inset: 0, zIndex: 50, background: "rgba(26,37,53,0.45)", backdropFilter: "blur(3px)" }}
      />

      {/* Centering wrapper — separate from motion so transforms don't conflict */}
      <div style={{
        position: "fixed", top: "50%", left: "50%",
        transform: "translate(-50%, -50%)",
        zIndex: 51, width: "min(480px, 92vw)",
      }}>
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 12 }}
          onClick={e => e.stopPropagation()}
          style={{
            maxHeight: "min(80vh, 600px)",
            background: DS.cardBg,
            borderRadius: 16,
            border: `1px solid ${DS.border}`,
            boxShadow: "0 20px 60px rgba(26,37,53,0.2)",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          {/* Header */}
          <div style={{ padding: "18px 20px", borderBottom: `1px solid ${DS.border}`, display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
            <div>
              <p style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.14em", color: DS.dimText, marginBottom: 4 }}>New</p>
              <h2 style={{ fontSize: 18, fontWeight: 800, color: DS.bodyText, margin: 0 }}>
                {selected.length > 1 ? "Group Message" : "New Message"}
              </h2>
            </div>
            <button type="button" onClick={onClose} style={{ width: 32, height: 32, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", background: DS.pageBg, border: `1px solid ${DS.border}`, color: DS.labelText, cursor: "pointer" }}>
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Scrollable body */}
          <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px" }}>
            {selected.length > 1 && (
              <input type="text" value={groupName} onChange={e => setGroupName(e.target.value)}
                placeholder="Group name (optional)" maxLength={40}
                style={{ width: "100%", padding: "9px 12px", background: DS.pageBg, border: `1px solid ${DS.border}`, borderRadius: 8, color: DS.bodyText, fontSize: 13, fontFamily: "inherit", outline: "none", marginBottom: 14, boxSizing: "border-box" }} />
            )}
            <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search athletes…"
              style={{ width: "100%", padding: "9px 12px", background: DS.pageBg, border: `1px solid ${DS.border}`, borderRadius: 8, color: DS.bodyText, fontSize: 13, fontFamily: "inherit", outline: "none", marginBottom: 12, boxSizing: "border-box" }} />

            {loading ? (
              <div style={{ padding: "20px 0", textAlign: "center", color: DS.dimText, fontSize: 13 }}>Loading athletes…</div>
            ) : filtered.length === 0 ? (
              <div style={{ padding: "20px 0", textAlign: "center", color: DS.dimText, fontSize: 13 }}>
                {members.length === 0 ? "No athletes found in your org." : "No results."}
              </div>
            ) : filtered.map((m, i) => {
              const isSel = selected.includes(m.id);
              const color = avatarColor(m.id);
              return (
                <button key={m.id} type="button" onClick={() => toggle(m.id)} style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", padding: "10px 0", borderBottom: i < filtered.length - 1 ? `1px solid ${DS.border}` : "none", background: "none", border: "none", cursor: "pointer", textAlign: "left" }}>
                  <div style={{ width: 38, height: 38, borderRadius: "50%", background: color + "22", border: `1px solid ${color}44`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <span style={{ fontSize: 13, fontWeight: 800, color }}>{getInitials(m.name || "?")}</span>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: DS.bodyText }}>{m.name || "Unknown"}</div>
                    {m.sport && <div style={{ fontSize: 11, color: DS.dimText }}>{m.role} · {m.sport}</div>}
                    {!m.sport && m.role && <div style={{ fontSize: 11, color: DS.dimText }}>{m.role}</div>}
                  </div>
                  <div style={{ width: 22, height: 22, borderRadius: "50%", border: `1.5px solid ${isSel ? DS.brand : DS.border}`, background: isSel ? DS.brand : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "all 0.15s ease" }}>
                    {isSel && <span style={{ fontSize: 11, color: "#fff", fontWeight: 800 }}>✓</span>}
                  </div>
                </button>
              );
            })}

            {error && <div style={{ marginTop: 12, padding: "10px 14px", borderRadius: 8, background: DS.bannedBg, border: `1px solid ${DS.bannedBorder}`, color: DS.banned, fontSize: 13 }}>{error}</div>}
          </div>

          {/* Footer — only shown when someone is selected */}
          {selected.length > 0 && (
            <div style={{ padding: "14px 20px", borderTop: `1px solid ${DS.border}`, flexShrink: 0 }}>
              <button type="button" onClick={create} disabled={creating} style={{ width: "100%", padding: "12px 20px", borderRadius: 10, border: "none", background: DS.brand, color: "#fff", fontSize: 14, fontWeight: 800, cursor: creating ? "not-allowed" : "pointer", opacity: creating ? 0.6 : 1 }}>
                {creating ? "Creating…" : selected.length > 1 ? `Create Group · ${selected.length + 1} people` : "Start Conversation"}
              </button>
            </div>
          )}
        </motion.div>
      </div>
    </>
  );
}

/* ══════════════════════════════════════════════════════════════════════════════
   MAIN PAGE
══════════════════════════════════════════════════════════════════════════════ */
export default function OrgMessagingPage() {
  const router   = useRouter();
  const { user } = useAuthContext();
  const isMobile = useIsMobile();

  const myId    = String(user?.id || user?.athleteId || user?.token || "");
  const myName  = String(user?.Name || user?.name || "Coach");
  const myRole  = String(user?.role || user?.Role || "");
  const mySport = String(user?.sport || "").trim().toLowerCase();
  const orgId   = String(
    user?.organizationId || user?.OrganizationId ||
    user?.orgId          || user?.OrgId          ||
    user?.org?.id        || user?.org?.token      ||
    ""
  );

  const isStaff = normalizeRole(myRole) === "staff";
  console.log("DEBUG orgId:", orgId);
console.log("DEBUG myId:", myId);
console.log("DEBUG user keys:", Object.keys(user || {}));
console.log("DEBUG user.id:", user?.id);
console.log("DEBUG user.orgId:", user?.orgId);
console.log("DEBUG user.OrgId:", user?.OrgId);

  const [activeTab,    setActiveTab]    = useState("feed");
  const [activeConvId, setActiveConvId] = useState(null);

  // Feed state
  const [posts,       setPosts]       = useState([]);
  const [feedLoading, setFeedLoading] = useState(true);
  const [feedErr,     setFeedErr]     = useState("");
  const [composeOpen, setComposeOpen] = useState(false);
  const [sportFilter, setSportFilter] = useState("all");

  // Messages state
  const [conversations, setConversations] = useState([]);
  const [convsLoading,  setConvsLoading]  = useState(true);
  const [showNewConv,   setShowNewConv]   = useState(false);

  // ── Sync coach profile to Firestore users collection ─────────────────────
  useEffect(() => {
    if (!myId || !orgId) return;
    setDoc(doc(db, "users", myId), {
      name: myName, role: myRole, orgId, updatedAt: serverTimestamp(),
    }, { merge: true }).catch(err => console.warn("[users sync]", err));
  }, [myId, myName, myRole, orgId]);

  // ── Feed listener ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!orgId) { setFeedLoading(false); return; }
    setFeedErr("");
    let unsub;
    try {
      const q = query(
        collection(db, "posts"),
        where("orgId", "==", orgId),
        orderBy("pinned", "desc"),
        orderBy("createdAt", "desc"),
      );
      unsub = onSnapshot(q, snap => {
        const list = [];
        snap.forEach(d => list.push({ id: d.id, ...d.data() }));
        setPosts(list);
        setFeedLoading(false);
      }, err => {
        setFeedErr(err?.message || "Failed to load feed.");
        setFeedLoading(false);
      });
    } catch (err) {
      setFeedErr(err?.message || "Failed to connect to feed.");
      setFeedLoading(false);
    }
    return () => unsub?.();
  }, [orgId]);

  // ── Conversations listener ────────────────────────────────────────────────
  useEffect(() => {
    if (!myId) { setConvsLoading(false); return; }
    const q = query(
      collection(db, "conversations"),
      where("participantIds", "array-contains", myId),
      orderBy("lastMessageAt", "desc"),
    );
    const unsub = onSnapshot(q, snap => {
      const list = [];
      snap.forEach(d => list.push({ id: d.id, ...d.data() }));
      setConversations(list);
      setConvsLoading(false);
    }, err => { console.error("[conversations]", err); setConvsLoading(false); });
    return unsub;
  }, [myId]);

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

  const showConvList = !isMobile || !activeConvId;
  const showConvView = activeConvId && (!isMobile || !!activeConvId);

  return (
    <div style={{ minHeight: "100vh", background: DS.pageBg, color: DS.bodyText, display: "flex", flexDirection: "column" }}>

      {/* ── Page header ──────────────────────────────────────────────────── */}
      <div style={{ background: DS.brand, padding: "14px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", flexShrink: 0 }}>
        <div>
          <p style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.14em", color: "rgba(255,255,255,0.5)", marginBottom: 3 }}>Org</p>
          <h1 style={{ fontSize: 20, fontWeight: 900, color: "#fff", margin: 0, letterSpacing: "-0.3px" }}>Messaging</h1>
          {/* Debug: remove once orgId confirmed working */}
          {process.env.NODE_ENV !== "production" && (
            <p style={{ fontSize: 10, color: orgId ? "rgba(255,255,255,0.35)" : "#FF7B35", marginTop: 2 }}>
              {orgId ? `orgId: ${orgId}` : "⚠️ orgId EMPTY — posts won't appear in app"}
            </p>
          )}
        </div>
        <button type="button" onClick={() => router.push("/org/dashboard")} style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "7px 12px", borderRadius: 8, background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)", color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer", textTransform: "uppercase", letterSpacing: "0.06em", whiteSpace: "nowrap" }}>
          <LayoutDashboard className="w-3.5 h-3.5" /> Dashboard
        </button>
      </div>

      {/* ── Tab bar ──────────────────────────────────────────────────────── */}
      <div style={{ background: DS.cardBg, borderBottom: `1px solid ${DS.border}`, display: "flex", flexShrink: 0 }}>
        {[
          { key: "feed",     label: "Feed",     icon: Rss },
          { key: "messages", label: "Messages", icon: MessageSquare },
        ].map(({ key, label, icon: Icon }) => (
          <button key={key} type="button" onClick={() => setActiveTab(key)} style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            padding: "12px 20px", background: "none",
            border: "none", borderBottom: `2px solid ${activeTab === key ? DS.brand : "transparent"}`,
            color: activeTab === key ? DS.brand : DS.labelText,
            fontWeight: activeTab === key ? 700 : 500, fontSize: 14,
            cursor: "pointer", transition: "all 0.15s ease",
          }}>
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {/* ── Tab content ──────────────────────────────────────────────────── */}
      <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>

        {/* FEED TAB */}
        {activeTab === "feed" && (
          <div style={{ flex: 1, overflowY: "auto" }}>
            <div style={{ maxWidth: 680, margin: "0 auto", padding: "20px 16px 60px" }}>
              {isStaff && (
                <div style={{ marginBottom: 16 }}>
                  <button type="button" onClick={() => setComposeOpen(true)} style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "10px 18px", borderRadius: 10, background: DS.brand, border: "none", color: "#fff", fontSize: 13, fontWeight: 800, cursor: "pointer" }}>
                    <Send className="w-4 h-4" /> New Post
                  </button>
                </div>
              )}

              {activeSports.length > 0 && (
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 16 }}>
                  {[{ key: "all", label: "All", emoji: "📋" }, { key: "org", label: "Everyone", emoji: "📣" }, ...activeSports].map(s => {
                    const active = sportFilter === s.key;
                    return (
                      <button key={s.key} type="button" onClick={() => setSportFilter(s.key)} style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "5px 12px", borderRadius: 20, background: active ? DS.brand : DS.cardBg, border: `1px solid ${active ? DS.brand : DS.border}`, color: active ? "#fff" : DS.labelText, fontSize: 12, fontWeight: active ? 700 : 500, cursor: "pointer" }}>
                        <span>{s.emoji}</span>{s.label}
                      </button>
                    );
                  })}
                </div>
              )}

              {feedErr && <div style={{ padding: "12px 16px", borderRadius: 10, marginBottom: 16, background: DS.bannedBg, border: `1px solid ${DS.bannedBorder}`, color: DS.banned, fontSize: 13 }}>{feedErr}</div>}

              {feedLoading && (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {[120, 90, 150].map((h, i) => (
                    <div key={i} style={{ height: h, borderRadius: 12, background: "linear-gradient(90deg,#f0f4f8 25%,#e6ecf2 50%,#f0f4f8 75%)", backgroundSize: "200% 100%", animation: "shimmer 1.4s infinite", border: `1px solid ${DS.border}` }} />
                  ))}
                </div>
              )}

              {!feedLoading && filteredPosts.length === 0 && !feedErr && (
                <div style={{ textAlign: "center", padding: "60px 20px", background: DS.cardBg, border: `1px solid ${DS.border}`, borderRadius: 12 }}>
                  <div style={{ fontSize: 40, marginBottom: 12 }}>📋</div>
                  <p style={{ fontSize: 16, fontWeight: 700, color: DS.bodyText, marginBottom: 6 }}>No posts yet</p>
                  <p style={{ fontSize: 14, color: DS.dimText, marginBottom: 24, lineHeight: 1.6 }}>
                    {isStaff ? "Post an update and your athletes will see it in the app immediately." : "Your coaches haven't posted anything yet."}
                  </p>
                  {isStaff && (
                    <button type="button" onClick={() => setComposeOpen(true)} style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "11px 24px", borderRadius: 10, background: DS.brand, border: "none", color: "#fff", fontSize: 14, fontWeight: 800, cursor: "pointer" }}>
                      <Send className="w-4 h-4" /> Write first post
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

        {/* MESSAGES TAB */}
        {activeTab === "messages" && (
          <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>

            {/* Conversation list */}
            {showConvList && (
              <div style={{ width: isMobile ? "100%" : 300, flexShrink: 0, borderRight: isMobile ? "none" : `1px solid ${DS.border}`, display: "flex", flexDirection: "column", background: DS.cardBg, overflow: "hidden" }}>
                <div style={{ padding: "14px 16px", borderBottom: `1px solid ${DS.border}`, display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: DS.bodyText }}>Conversations</span>
                  <button type="button" onClick={() => setShowNewConv(true)} style={{ width: 32, height: 32, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", background: DS.brandBg, border: `1px solid ${DS.brandBorder}`, color: DS.brand, cursor: "pointer" }} title="New conversation">
                    <Plus className="w-4 h-4" />
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
                        <MessageSquare className="w-6 h-6" style={{ color: DS.dimText }} />
                      </div>
                      <p style={{ fontSize: 14, fontWeight: 700, color: DS.bodyText, marginBottom: 6 }}>No messages yet</p>
                      <p style={{ fontSize: 12, color: DS.dimText, lineHeight: 1.6, marginBottom: 16 }}>Start a conversation with an athlete or coach.</p>
                      <button type="button" onClick={() => setShowNewConv(true)} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "9px 18px", borderRadius: 8, background: DS.brand, border: "none", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                        <Plus className="w-4 h-4" /> New Message
                      </button>
                    </div>
                  ) : (
                    conversations.map(conv => (
                      <ConversationRow
                        key={conv.id}
                        conv={conv}
                        myId={myId}
                        isActive={activeConvId === conv.id}
                        onClick={() => setActiveConvId(conv.id)}
                      />
                    ))
                  )}
                </div>
              </div>
            )}

            {/* Empty state — desktop, no conv selected */}
            {!isMobile && !activeConvId && (
              <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", background: DS.pageBg }}>
                <div style={{ textAlign: "center" }}>
                  <div style={{ width: 64, height: 64, borderRadius: "50%", background: DS.cardBg, border: `1px solid ${DS.border}`, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
                    <MessageSquare className="w-7 h-7" style={{ color: DS.dimText }} />
                  </div>
                  <p style={{ fontSize: 15, fontWeight: 700, color: DS.bodyText, marginBottom: 6 }}>Select a conversation</p>
                  <p style={{ fontSize: 13, color: DS.dimText }}>or start a new one</p>
                </div>
              </div>
            )}

            {/* Conversation view */}
            {showConvView && activeConvId && (
              <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
                <ConversationView
                  key={activeConvId}
                  convId={activeConvId}
                  myId={myId}
                  myName={myName}
                  isMobile={isMobile}
                  onBack={() => setActiveConvId(null)}
                />
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Modals ───────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {composeOpen && (
          <FeedComposePanel
            onClose={() => setComposeOpen(false)}
            myId={myId} myName={myName} myRole={myRole}
            mySport={mySport} orgId={orgId}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showNewConv && (
          <NewConversationModal
            onClose={() => setShowNewConv(false)}
            myId={myId} myName={myName} orgId={orgId}
            orgToken={String(user?.Token || "")}
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