// components/dashboard/ChatPanel.jsx
// Replaces the left sidebar on the athlete dashboard.
// Shows live Messages + Team Feed powered by Firebase Firestore.
//
// Drop-in usage in dashboard.js:
//   import ChatPanel from "@/components/dashboard/ChatPanel";
//   <ChatPanel user={user} onNavigate={nav} />
//
// Assumes:
//   @/lib/firebase exports { db, storage }
//   /conversation/[id] route exists (web)
"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/router";
import {
  collection, query, where, orderBy, onSnapshot,
  addDoc, updateDoc, serverTimestamp, doc,
  getDocs, arrayUnion, arrayRemove,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

// ── Brand tokens (matches dashboard CP) ───────────────────────────────────────
const T = {
  black:   "#060810",
  surface: "#0C1525",
  raised:  "#111E30",
  border:  "rgba(255,255,255,0.08)",
  borderStrong: "rgba(255,255,255,0.15)",
  accent:  "#4FABFF",
  white:   "#FFFFFF",
  ghost:   "rgba(255,255,255,0.55)",
  dim:     "rgba(255,255,255,0.30)",
  faint:   "rgba(255,255,255,0.12)",
  red:     "#D92B3A",
  green:   "#0D9A55",
  amber:   "#D4900A",
  fontBC:  "'Barlow Condensed', 'Arial Narrow', sans-serif",
  fontB:   "'Barlow', Arial, sans-serif",
};

const REACTIONS = ["👍","🔥","💪","❤️","👏"];

// ── Helpers ────────────────────────────────────────────────────────────────────
function fmtTime(ts) {
  if (!ts) return "";
  const d = ts.toDate?.() || new Date(ts);
  const diff = Date.now() - d.getTime();
  if (diff < 60000)    return "now";
  if (diff < 3600000)  return `${Math.floor(diff / 60000)}m`;
  if (diff < 86400000) return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  if (diff < 604800000)return d.toLocaleDateString([], { weekday: "short" });
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

function fmtPostTime(ts) {
  if (!ts) return "";
  const d = ts.toDate?.() || new Date(ts);
  const diff = Date.now() - d.getTime();
  if (diff < 60000)    return "just now";
  if (diff < 3600000)  return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

function getConvName(conv, myId) {
  if (conv.name) return conv.name;
  const otherId = conv.participantIds?.find(id => id !== myId);
  return otherId ? (conv.participantNames?.[otherId] || "Unknown") : "Unknown";
}

function initials(name = "") {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function avatarColor(str = "") {
  const palette = ["#4FABFF","#7C6EF5","#0D9A55","#D4900A","#FF7B35","#D92B3A"];
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  return palette[Math.abs(hash) % palette.length];
}

// ── Shared sub-components ──────────────────────────────────────────────────────

function Avatar({ name, id, size = 34 }) {
  const color = avatarColor(id || name);
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%", flexShrink: 0,
      background: color + "22", border: `1px solid ${color}44`,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontFamily: T.fontBC, fontSize: size * 0.38, fontWeight: 800, color,
    }}>
      {initials(name)}
    </div>
  );
}

function SegmentedControl({ options, value, onChange }) {
  return (
    <div style={{
      display: "flex", gap: 3, padding: 3,
      background: T.raised, borderRadius: 10,
      border: `0.5px solid ${T.border}`,
      margin: "12px 14px",
    }}>
      {options.map(opt => (
        <button key={opt.value} onClick={() => onChange(opt.value)}
          style={{
            flex: 1, padding: "8px 6px", borderRadius: 8, border: "none",
            cursor: "pointer", fontFamily: T.fontBC, fontSize: 12, fontWeight: 700,
            letterSpacing: "0.04em", transition: "all 0.15s",
            background: value === opt.value ? T.surface : "transparent",
            color: value === opt.value ? T.white : T.dim,
          }}>
          {opt.label}
        </button>
      ))}
    </div>
  );
}

// ── MESSAGES TAB ───────────────────────────────────────────────────────────────

function ConvRow({ conv, myId, onClick }) {
  const name    = getConvName(conv, myId);
  const preview = conv.lastMessage
    ? (conv.lastSenderId === myId ? `You: ${conv.lastMessage}` : conv.lastMessage)
    : "No messages yet";
  const color = avatarColor(conv.id);

  return (
    <button onClick={onClick} style={{
      width: "100%", display: "flex", alignItems: "center", gap: 10,
      padding: "10px 14px", background: "transparent",
      border: "none", borderBottom: `0.5px solid ${T.border}`,
      cursor: "pointer", textAlign: "left",
      transition: "background 0.15s",
    }}
      onMouseEnter={e => e.currentTarget.style.background = T.faint}
      onMouseLeave={e => e.currentTarget.style.background = "transparent"}
    >
      <div style={{
        width: 38, height: 38, borderRadius: "50%", flexShrink: 0,
        background: color + "22", border: `1px solid ${color}44`,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontFamily: T.fontBC, fontSize: 13, fontWeight: 800, color,
      }}>
        {conv.isGroup ? "#" : initials(name)}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 6, marginBottom: 2 }}>
          <span style={{
            fontFamily: T.fontB, fontSize: 13, fontWeight: 700,
            color: T.white, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1,
          }}>
            {name}
          </span>
          <span style={{ fontFamily: T.fontB, fontSize: 10, color: T.dim, flexShrink: 0 }}>
            {fmtTime(conv.lastMessageAt)}
          </span>
        </div>
        {conv.isGroup && (
          <div style={{ fontSize: 10, color: T.accent, fontWeight: 600, marginBottom: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {Object.values(conv.participantNames || {}).join(", ")}
          </div>
        )}
        <div style={{ fontSize: 11, color: T.ghost, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {preview}
        </div>
      </div>
    </button>
  );
}

function NewConvModal({ myId, orgId, myName, onClose, onCreated }) {
  const [members,  setMembers]  = useState([]);
  const [selected, setSelected] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [creating, setCreating] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (!orgId) { setLoading(false); return; }
    getDocs(query(collection(db, "users"), where("orgId", "==", orgId)))
      .then(snap => {
        const list = [];
        snap.forEach(d => { if (d.id !== myId) { const f = d.data(); list.push({ id: d.id, name: f.name || "Unknown", role: f.role || "" }); } });
        setMembers(list);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [orgId, myId]);

  const toggle = (id) => setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const create = async () => {
    if (!selected.length || creating) return;
    setCreating(true);
    try {
      const isGroup = selected.length > 1;
      const participantIds = [myId, ...selected];
      const participantNames = { [myId]: myName };
      selected.forEach(id => { const m = members.find(x => x.id === id); if (m) participantNames[id] = m.name; });
      const ref = await addDoc(collection(db, "conversations"), {
        name: isGroup ? "Group Chat" : null,
        isGroup, participantIds, participantNames,
        lastMessage: null, lastMessageAt: null, lastSenderId: null,
        orgId, createdAt: serverTimestamp(),
      });
      onClose();
      router.push(`/conversation/${ref.id}`);
    } catch {} finally { setCreating(false); }
  };

  const modal = (
    <div style={{
      position: "fixed", inset: 0, zIndex: 99999,
      background: "rgba(0,0,0,0.88)",
      display: "flex", alignItems: "center", justifyContent: "center",
    }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        width: 360, maxHeight: "70vh", background: T.raised,
        border: `0.5px solid ${T.borderStrong}`, borderRadius: 16,
        display: "flex", flexDirection: "column", overflow: "hidden",
      }}>
        {/* Header */}
        <div style={{ padding: "18px 20px 14px", borderBottom: `0.5px solid ${T.border}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontFamily: T.fontBC, fontSize: 9, fontWeight: 800, letterSpacing: "0.16em", textTransform: "uppercase", color: T.accent, marginBottom: 4 }}>New</div>
            <div style={{ fontFamily: T.fontBC, fontSize: 20, fontWeight: 900, color: T.white, letterSpacing: "-0.02em" }}>Message</div>
          </div>
          <button onClick={onClose} style={{ background: T.faint, border: `0.5px solid ${T.border}`, borderRadius: "50%", width: 30, height: 30, cursor: "pointer", color: T.ghost, fontSize: 13, display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
        </div>

        {/* Member list */}
        <div style={{ overflowY: "auto", flex: 1 }}>
          {loading ? (
            <div style={{ padding: 32, textAlign: "center", color: T.dim, fontSize: 13 }}>Loading…</div>
          ) : members.length === 0 ? (
            <div style={{ padding: 32, textAlign: "center", color: T.dim, fontSize: 13 }}>No teammates found.</div>
          ) : members.map(m => {
            const isSel = selected.includes(m.id);
            const color = avatarColor(m.id);
            return (
              <button key={m.id} onClick={() => toggle(m.id)} style={{
                width: "100%", display: "flex", alignItems: "center", gap: 12, padding: "11px 20px",
                background: isSel ? T.faint : "transparent", border: "none", borderBottom: `0.5px solid ${T.border}`,
                cursor: "pointer", textAlign: "left", transition: "background 0.15s",
              }}>
                <div style={{ width: 36, height: 36, borderRadius: "50%", background: color + "22", border: `1px solid ${color}44`, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: T.fontBC, fontSize: 12, fontWeight: 800, color, flexShrink: 0 }}>
                  {initials(m.name)}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: T.white }}>{m.name}</div>
                  <div style={{ fontSize: 11, color: T.dim }}>{m.role}</div>
                </div>
                <div style={{
                  width: 20, height: 20, borderRadius: "50%",
                  background: isSel ? T.accent : "transparent",
                  border: `1.5px solid ${isSel ? T.accent : T.border}`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  flexShrink: 0, transition: "all 0.15s",
                }}>
                  {isSel && <span style={{ color: T.black, fontSize: 10, fontWeight: 900 }}>✓</span>}
                </div>
              </button>
            );
          })}
        </div>

        {/* CTA */}
        {selected.length > 0 && (
          <div style={{ padding: "14px 20px", borderTop: `0.5px solid ${T.border}` }}>
            <button onClick={create} disabled={creating} style={{
              width: "100%", padding: "13px", background: T.accent, border: "none",
              borderRadius: 11, fontFamily: T.fontBC, fontSize: 14, fontWeight: 900,
              color: T.black, cursor: creating ? "not-allowed" : "pointer", letterSpacing: "0.04em",
              opacity: creating ? 0.6 : 1,
            }}>
              {creating ? "Creating…" : selected.length > 1 ? `Create Group · ${selected.length + 1} people` : "Start Conversation"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
  return typeof document !== "undefined" ? createPortal(modal, document.body) : null;
}

function MessagesPane({ myId, orgId, myName }) {
  const router = useRouter();
  const [convs,   setConvs]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);

  useEffect(() => {
    if (!myId) { setLoading(false); return; }
    const q = query(
      collection(db, "conversations"),
      where("participantIds", "array-contains", myId),
      orderBy("lastMessageAt", "desc"),
    );
    const unsub = onSnapshot(q, snap => {
      const list = [];
      snap.forEach(d => list.push({ id: d.id, ...d.data() }));
      setConvs(list);
      setLoading(false);
    }, () => setLoading(false));
    return unsub;
  }, [myId]);

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      {/* Sub-header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 14px 10px" }}>
        <span style={{ fontFamily: T.fontBC, fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: T.dim }}>
          {loading ? "" : `${convs.length} conversation${convs.length !== 1 ? "s" : ""}`}
        </span>
        <button onClick={() => setShowNew(true)} style={{
          display: "flex", alignItems: "center", gap: 5,
          background: T.faint, border: `0.5px solid ${T.border}`,
          borderRadius: 20, padding: "5px 12px", cursor: "pointer",
          fontFamily: T.fontBC, fontSize: 11, fontWeight: 700,
          letterSpacing: "0.08em", textTransform: "uppercase", color: T.accent,
        }}>
          + New
        </button>
      </div>

      {/* List */}
      <div style={{ flex: 1, overflowY: "auto" }}>
        {loading ? (
          <div style={{ padding: 24, textAlign: "center", color: T.dim, fontSize: 12 }}>Loading…</div>
        ) : convs.length === 0 ? (
          <div style={{ padding: "32px 20px", textAlign: "center" }}>
            <div style={{ fontSize: 28, marginBottom: 10 }}>💬</div>
            <div style={{ fontFamily: T.fontBC, fontSize: 13, fontWeight: 700, color: T.ghost, marginBottom: 6 }}>No conversations yet</div>
            <div style={{ fontSize: 12, color: T.dim, lineHeight: 1.5, marginBottom: 16 }}>Start a chat with a teammate or coach.</div>
            <button onClick={() => setShowNew(true)} style={{
              background: T.accent, border: "none", borderRadius: 10, padding: "10px 20px",
              fontFamily: T.fontBC, fontSize: 12, fontWeight: 900, color: T.black, cursor: "pointer",
              letterSpacing: "0.08em", textTransform: "uppercase",
            }}>
              New Message
            </button>
          </div>
        ) : convs.map(conv => (
          <ConvRow key={conv.id} conv={conv} myId={myId}
            onClick={() => router.push(`/conversation/${conv.id}`)} />
        ))}
      </div>

      {showNew && (
        <NewConvModal
          myId={myId} orgId={orgId} myName={myName}
          onClose={() => setShowNew(false)}
          onCreated={() => setShowNew(false)}
        />
      )}
    </div>
  );
}

// ── FEED TAB ───────────────────────────────────────────────────────────────────

function PostCard({ post, myId }) {
  const color = avatarColor(post.authorId);
  const scopeLabel = post.scope === "org" ? "📣 Everyone"
    : `🏅 ${post.sports?.map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(", ")}`;

  const toggleReaction = async (emoji) => {
    const has = post.reactions?.[emoji]?.includes(myId);
    try {
      await updateDoc(doc(db, "posts", post.id), {
        [`reactions.${emoji}`]: has ? arrayRemove(myId) : arrayUnion(myId),
      });
    } catch {}
  };

  return (
    <div style={{
      padding: "14px",
      borderBottom: `0.5px solid ${T.border}`,
      ...(post.pinned ? { borderLeft: `2px solid ${T.accent}` } : {}),
    }}>
      {post.pinned && (
        <div style={{ fontFamily: T.fontBC, fontSize: 9, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: T.accent, marginBottom: 8 }}>
          📌 Pinned
        </div>
      )}

      {/* Author row */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <div style={{ width: 30, height: 30, borderRadius: "50%", background: color + "22", border: `1px solid ${color}44`, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: T.fontBC, fontSize: 11, fontWeight: 800, color, flexShrink: 0 }}>
          {initials(post.authorName)}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: T.white, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {post.authorName}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <span style={{ fontSize: 10, color: T.accent, fontWeight: 600 }}>{scopeLabel}</span>
            <span style={{ fontSize: 10, color: T.dim }}>· {fmtPostTime(post.createdAt)}</span>
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{ fontSize: 13, color: T.ghost, lineHeight: 1.55, marginBottom: post.imageUrl ? 8 : 10 }}>
        {post.content}
      </div>

      {/* Image */}
      {post.imageUrl && (
        <img src={post.imageUrl} alt="" style={{ width: "100%", borderRadius: 8, marginBottom: 10, display: "block", maxHeight: 140, objectFit: "cover" }} />
      )}

      {/* Reactions */}
      <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
        {REACTIONS.map(emoji => {
          const count   = post.reactions?.[emoji]?.length || 0;
          const reacted = post.reactions?.[emoji]?.includes(myId);
          return (
            <button key={emoji} onClick={() => toggleReaction(emoji)} style={{
              display: "flex", alignItems: "center", gap: 4,
              padding: "3px 8px", borderRadius: 20, cursor: "pointer",
              background: reacted ? "rgba(79,171,255,0.12)" : T.faint,
              border: `0.5px solid ${reacted ? "rgba(79,171,255,0.35)" : T.border}`,
              fontSize: 12, transition: "all 0.15s",
            }}>
              <span>{emoji}</span>
              {count > 0 && (
                <span style={{ fontSize: 11, fontWeight: 700, color: reacted ? T.accent : T.dim }}>{count}</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function NewPostModal({ myId, myName, myRole, mySport, orgId, onClose }) {
  const [content, setContent] = useState("");
  const [scope,   setScope]   = useState("org");
  const [posting, setPosting] = useState(false);

  const submit = async () => {
    if (!content.trim() || posting) return;
    setPosting(true);
    try {
      await addDoc(collection(db, "posts"), {
        authorId:   myId,
        authorName: myName,
        authorRole: myRole,
        orgId,
        scope,
        sports:     scope === "org" ? [] : mySport ? [mySport] : [],
        content:    content.trim(),
        imageUrl:   null,
        createdAt:  serverTimestamp(),
        reactions:  {},
        pinned:     false,
      });
      onClose();
    } catch {} finally { setPosting(false); }
  };

  const postModal = (
    <div style={{ position: "fixed", inset: 0, zIndex: 99999, background: "rgba(0,0,0,0.88)", display: "flex", alignItems: "center", justifyContent: "center" }}
      onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ width: 400, background: T.raised, border: `0.5px solid ${T.borderStrong}`, borderRadius: 16, overflow: "hidden" }}>
        <div style={{ padding: "18px 20px 14px", borderBottom: `0.5px solid ${T.border}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontFamily: T.fontBC, fontSize: 9, fontWeight: 800, letterSpacing: "0.16em", textTransform: "uppercase", color: T.accent, marginBottom: 4 }}>New</div>
            <div style={{ fontFamily: T.fontBC, fontSize: 20, fontWeight: 900, color: T.white }}>Post</div>
          </div>
          <button onClick={onClose} style={{ background: T.faint, border: `0.5px solid ${T.border}`, borderRadius: "50%", width: 30, height: 30, cursor: "pointer", color: T.ghost, fontSize: 13 }}>✕</button>
        </div>

        <div style={{ padding: "16px 20px 20px", display: "flex", flexDirection: "column", gap: 12 }}>
          {/* Scope */}
          <div style={{ display: "flex", gap: 3, padding: 3, background: T.surface, borderRadius: 10, border: `0.5px solid ${T.border}` }}>
            {[["org", "📣 Everyone"], ["team", "🏅 My Team"]].map(([v, l]) => (
              <button key={v} onClick={() => setScope(v)} style={{
                flex: 1, padding: "8px", borderRadius: 8, border: "none", cursor: "pointer",
                background: scope === v ? T.raised : "transparent",
                color: scope === v ? T.white : T.dim,
                fontFamily: T.fontBC, fontSize: 12, fontWeight: 700, transition: "all 0.15s",
              }}>{l}</button>
            ))}
          </div>

          <textarea
            value={content}
            onChange={e => setContent(e.target.value)}
            placeholder="Write something for your team…"
            maxLength={1000}
            autoFocus
            style={{
              background: T.surface, border: `1px solid ${T.border}`,
              borderRadius: 10, color: T.white, fontSize: 14, padding: "12px 14px",
              minHeight: 110, resize: "none", fontFamily: T.fontB, lineHeight: 1.55,
              outline: "none",
            }}
          />

          <button onClick={submit} disabled={!content.trim() || posting} style={{
            padding: "13px", background: T.accent, border: "none", borderRadius: 11,
            fontFamily: T.fontBC, fontSize: 14, fontWeight: 900, color: T.black,
            cursor: !content.trim() || posting ? "not-allowed" : "pointer",
            opacity: !content.trim() || posting ? 0.4 : 1, letterSpacing: "0.04em",
          }}>
            {posting ? "Posting…" : "Post"}
          </button>
        </div>
      </div>
    </div>
  );
  return typeof document !== "undefined" ? createPortal(postModal, document.body) : null;
}

function FeedPane({ myId, orgId, myName, myRole, mySport }) {
  const [posts,   setPosts]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const isStaff = !String(myRole || "").toLowerCase().includes("ath");

  useEffect(() => {
    if (!orgId) { setLoading(false); return; }
    const q = query(
      collection(db, "posts"),
      where("orgId", "==", orgId),
      orderBy("pinned", "desc"),
      orderBy("createdAt", "desc"),
    );
    const unsub = onSnapshot(q, snap => {
      let list = [];
      snap.forEach(d => list.push({ id: d.id, ...d.data() }));
      if (!isStaff && mySport) {
        list = list.filter(p => p.scope === "org" || p.sports?.includes(mySport));
      }
      setPosts(list);
      setLoading(false);
    }, () => setLoading(false));
    return unsub;
  }, [orgId, mySport, isStaff]);

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      {/* Sub-header */}
      {isStaff && (
        <div style={{ padding: "0 14px 10px" }}>
          <button onClick={() => setShowNew(true)} style={{
            width: "100%", display: "flex", alignItems: "center", gap: 10,
            background: T.faint, border: `0.5px solid ${T.border}`,
            borderRadius: 10, padding: "10px 14px", cursor: "pointer", textAlign: "left",
          }}>
            <div style={{ width: 28, height: 28, borderRadius: "50%", background: T.accent, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, color: T.black, fontWeight: 900, flexShrink: 0 }}>+</div>
            <span style={{ fontSize: 13, color: T.dim }}>Post to your team…</span>
          </button>
        </div>
      )}

      {/* Posts */}
      <div style={{ flex: 1, overflowY: "auto" }}>
        {loading ? (
          <div style={{ padding: 24, textAlign: "center", color: T.dim, fontSize: 12 }}>Loading…</div>
        ) : posts.length === 0 ? (
          <div style={{ padding: "32px 20px", textAlign: "center" }}>
            <div style={{ fontSize: 28, marginBottom: 10 }}>📋</div>
            <div style={{ fontFamily: T.fontBC, fontSize: 13, fontWeight: 700, color: T.ghost, marginBottom: 6 }}>No posts yet</div>
            <div style={{ fontSize: 12, color: T.dim, lineHeight: 1.5 }}>
              {isStaff ? "Post an update to your team above." : "Your coaches haven't posted anything yet."}
            </div>
          </div>
        ) : posts.map(post => (
          <PostCard key={post.id} post={post} myId={myId} />
        ))}
      </div>

      {showNew && (
        <NewPostModal
          myId={myId} myName={myName} myRole={myRole}
          mySport={mySport} orgId={orgId}
          onClose={() => setShowNew(false)}
        />
      )}
    </div>
  );
}

// ── MAIN EXPORT ────────────────────────────────────────────────────────────────
export default function ChatPanel({ user }) {
  const [tab, setTab] = useState("messages");

  const myId    = String(user?.id    || user?.athleteId         || "");
  const orgId   = String(user?.organizationId || user?.orgId    || "");
  const myName  = String(user?.Name  || user?.name              || "");
  const myRole  = String(user?.role  || user?.Role              || "");
  const mySport = String(user?.sport || "").toLowerCase().trim();

  return (
    <aside className="cp-chat-panel" style={{
      background:    T.surface,
      border:        `0.5px solid ${T.border}`,
      display:       "flex",
      flexDirection: "column",
      overflow:      "hidden",
    }}>

      {/* Panel header */}
      <div style={{ padding: "18px 14px 0", borderBottom: `0.5px solid ${T.border}`, paddingBottom: 0 }}>
        <div style={{ fontFamily: T.fontBC, fontSize: 9, fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", color: T.dim, marginBottom: 4 }}>
          Team
        </div>
        <div style={{ fontFamily: T.fontBC, fontSize: 20, fontWeight: 900, color: T.white, letterSpacing: "-0.02em", marginBottom: 12 }}>
          {tab === "messages" ? "Messages" : "Feed"}
        </div>
      </div>

      {/* Segmented control */}
      <SegmentedControl
        options={[{ value: "messages", label: "Messages" }, { value: "feed", label: "Team Feed" }]}
        value={tab}
        onChange={setTab}
      />

      {/* Content */}
      {tab === "messages" ? (
        <MessagesPane myId={myId} orgId={orgId} myName={myName} />
      ) : (
        <FeedPane myId={myId} orgId={orgId} myName={myName} myRole={myRole} mySport={mySport} />
      )}
    </aside>
  );
}