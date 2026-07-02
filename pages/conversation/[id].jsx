// pages/conversation/[id].jsx
"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/router";
import { useAuthContext } from "@/hooks/useAuth";
import {
  doc, getDoc, collection, query, orderBy, onSnapshot,
  addDoc, serverTimestamp, updateDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { IconChat } from "@/components/Icons";

const CP = {
  black:   "#060810",
  surface: "#0C1525",
  raised:  "#111E30",
  border:  "rgba(255,255,255,0.08)",
  accent:  "#4FABFF",
  white:   "#FFFFFF",
  ghost:   "rgba(255,255,255,0.55)",
  dim:     "rgba(255,255,255,0.30)",
  faint:   "rgba(255,255,255,0.10)",
  fontBC:  "'Barlow Condensed', 'Arial Narrow', sans-serif",
  fontB:   "'Barlow', Arial, sans-serif",
};

function avatarColor(str = "") {
  const palette = ["#4FABFF","#7C6EF5","#0D9A55","#D4900A","#FF7B35","#D92B3A"];
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  return palette[Math.abs(hash) % palette.length];
}

function initials(name = "") {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function fmtTime(ts) {
  if (!ts) return "";
  const d = ts.toDate?.() || new Date(ts);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function fmtDate(ts) {
  if (!ts) return "";
  const d = ts.toDate?.() || new Date(ts);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) return "Today";
  const diff = now.getTime() - d.getTime();
  if (diff < 604800000) return d.toLocaleDateString([], { weekday: "long" });
  return d.toLocaleDateString([], { month: "long", day: "numeric" });
}

// Handle whatever field name the mobile app uses
function getMsgText(msg) {
  return msg.content || msg.text || msg.message || msg.body || "";
}

function Avatar({ name, id, size = 32 }) {
  const color = avatarColor(id || name);
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%", flexShrink: 0,
      background: color + "22", border: `1px solid ${color}55`,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontFamily: CP.fontBC, fontSize: Math.round(size * 0.38), fontWeight: 800, color,
    }}>
      {initials(name)}
    </div>
  );
}

// Hide the global NavBar on this page
export const getLayout = (page) => page;

export default function ConversationPage() {
  const router = useRouter();
  const { id } = router.query;
  const { user } = useAuthContext();

  const myId   = String(user?.id || user?.athleteId || "");
  const myName = String(user?.Name || user?.name || "");

  const [conv,     setConv]     = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [text,     setText]     = useState("");
  const [sending,  setSending]  = useState(false);

  const bottomRef = useRef(null);
  const inputRef  = useRef(null);

  useEffect(() => {
    if (!id) return;
    getDoc(doc(db, "conversations", id))
      .then(snap => {
        if (snap.exists()) setConv({ id: snap.id, ...snap.data() });
        else router.replace("/dashboard");
      })
      .catch(() => router.replace("/dashboard"));
  }, [id]);

  useEffect(() => {
    if (!id) return;
    const q = query(
      collection(db, "conversations", id, "messages"),
      orderBy("createdAt", "asc"),
    );
    const unsub = onSnapshot(q, snap => {
      const list = [];
      snap.forEach(d => list.push({ id: d.id, ...d.data() }));
      setMessages(list);
      setLoading(false);
    }, () => setLoading(false));
    return unsub;
  }, [id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = useCallback(async () => {
    const trimmed = text.trim();
    if (!trimmed || sending || !id || !myId) return;
    setText("");
    setSending(true);
    // Reset textarea height
    if (inputRef.current) inputRef.current.style.height = "auto";
    try {
      await addDoc(collection(db, "conversations", id, "messages"), {
        senderId:   myId,
        senderName: myName,
        content:    trimmed,   // write as 'content'
        text:       trimmed,   // also write 'text' for mobile app compatibility
        createdAt:  serverTimestamp(),
        type:       "text",
      });
      await updateDoc(doc(db, "conversations", id), {
        lastMessage:   trimmed,
        lastMessageAt: serverTimestamp(),
        lastSenderId:  myId,
      });
    } catch {}
    finally { setSending(false); }
  }, [text, sending, id, myId, myName]);

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
  };

  const convName = conv
    ? conv.name || (() => {
        const otherId = conv.participantIds?.find(pid => pid !== myId);
        return otherId ? (conv.participantNames?.[otherId] || "Conversation") : "Conversation";
      })()
    : "Loading…";

  const otherParticipant = conv && !conv.isGroup
    ? (() => {
        const otherId = conv.participantIds?.find(pid => pid !== myId);
        return { id: otherId, name: conv.participantNames?.[otherId] || "?" };
      })()
    : null;

  // Group messages: add date divider + collapse consecutive same-sender
  const grouped = messages.reduce((acc, msg, i) => {
    const prev = messages[i - 1];
    const prevDate = prev ? fmtDate(prev.createdAt) : null;
    const thisDate = fmtDate(msg.createdAt);
    const showDate   = thisDate !== prevDate;
    const showAvatar = !prev || prev.senderId !== msg.senderId || showDate;
    acc.push({ ...msg, showDate, showAvatar, dateLabel: thisDate });
    return acc;
  }, []);

  if (!user) return null;

  return (
    <>
      <style>{`
        html, body { margin: 0; padding: 0; background: ${CP.black}; height: 100%; }
        * { box-sizing: border-box; }
        .conv-input:focus { outline: none; border-color: rgba(79,171,255,0.45) !important; }
        .conv-input::placeholder { color: rgba(255,255,255,0.25); }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 2px; }
      `}</style>

      <div style={{
        position: "fixed", inset: 0, zIndex: 50,
        background: CP.black, display: "flex", flexDirection: "column",
        fontFamily: CP.fontB, color: CP.white,
      }}>

        {/* ── Header ─────────────────────────────────────────────────── */}
        <div style={{
          display: "flex", alignItems: "center", gap: 12,
          padding: "0 20px", height: 64, flexShrink: 0,
          background: CP.surface,
          borderBottom: `0.5px solid ${CP.border}`,
          boxShadow: "0 1px 0 rgba(255,255,255,0.04)",
        }}>
          <button onClick={() => router.back()} style={{
            width: 38, height: 38, borderRadius: 10, flexShrink: 0,
            background: CP.faint, border: `0.5px solid ${CP.border}`,
            cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
            color: CP.ghost, fontSize: 18, transition: "background 0.15s",
          }}
            onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.15)"}
            onMouseLeave={e => e.currentTarget.style.background = CP.faint}
          >
            ←
          </button>

          {otherParticipant && <Avatar name={otherParticipant.name} id={otherParticipant.id} size={38} />}
          {conv?.isGroup && (
            <div style={{ width: 38, height: 38, borderRadius: "50%", background: "rgba(79,171,255,0.12)", border: "1px solid rgba(79,171,255,0.3)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: CP.fontBC, fontSize: 16, fontWeight: 800, color: CP.accent }}>
              #
            </div>
          )}

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: CP.white, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {convName}
            </div>
            {conv?.isGroup && (
              <div style={{ fontSize: 11, color: CP.accent, fontWeight: 600, marginTop: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {Object.values(conv.participantNames || {}).join(", ")}
              </div>
            )}
          </div>
        </div>

        {/* ── Thread ─────────────────────────────────────────────────── */}
        <div style={{ flex: 1, overflowY: "auto", padding: "20px 20px 12px", maxWidth: 760, width: "100%", margin: "0 auto", alignSelf: "stretch", display: "flex", flexDirection: "column" }}>

          {loading ? (
            <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: CP.dim, fontSize: 14 }}>
              Loading…
            </div>
          ) : messages.length === 0 ? (
            <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12 }}>
              <IconChat size={40} color="rgba(255,255,255,0.25)" />
              <div style={{ fontSize: 15, fontWeight: 700, color: CP.ghost }}>No messages yet</div>
              <div style={{ fontSize: 13, color: CP.dim }}>Say something to get the conversation started.</div>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
              {grouped.map((msg, i) => {
                const isMe   = msg.senderId === myId;
                const msgText = getMsgText(msg);

                return (
                  <div key={msg.id || i}>
                    {/* Date divider */}
                    {msg.showDate && (
                      <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "20px 0 12px" }}>
                        <div style={{ flex: 1, height: "0.5px", background: CP.border }} />
                        <span style={{ fontSize: 11, fontWeight: 600, color: CP.dim, whiteSpace: "nowrap", fontFamily: CP.fontBC, letterSpacing: "0.08em", textTransform: "uppercase" }}>
                          {msg.dateLabel}
                        </span>
                        <div style={{ flex: 1, height: "0.5px", background: CP.border }} />
                      </div>
                    )}

                    {/* Message */}
                    <div style={{
                      display: "flex",
                      alignItems: "flex-end",
                      gap: 8,
                      justifyContent: isMe ? "flex-end" : "flex-start",
                      marginTop: msg.showAvatar && !msg.showDate ? 12 : 3,
                    }}>
                      {/* Left avatar slot */}
                      {!isMe && (
                        <div style={{ width: 32, flexShrink: 0, marginBottom: 2 }}>
                          {msg.showAvatar && (
                            <Avatar name={msg.senderName || "?"} id={msg.senderId} size={32} />
                          )}
                        </div>
                      )}

                      <div style={{ maxWidth: "68%", display: "flex", flexDirection: "column", alignItems: isMe ? "flex-end" : "flex-start", gap: 3 }}>
                        {/* Sender name for groups */}
                        {!isMe && msg.showAvatar && conv?.isGroup && (
                          <div style={{ fontSize: 11, fontWeight: 700, color: avatarColor(msg.senderId), marginLeft: 2 }}>
                            {msg.senderName}
                          </div>
                        )}

                        {/* Bubble */}
                        <div style={{
                          padding: "10px 14px",
                          borderRadius: isMe ? "18px 18px 4px 18px" : "4px 18px 18px 18px",
                          background: isMe ? CP.accent : CP.raised,
                          border: isMe ? "none" : `0.5px solid ${CP.border}`,
                          fontSize: 14,
                          lineHeight: 1.55,
                          color: isMe ? "#040A14" : CP.white,
                          wordBreak: "break-word",
                          whiteSpace: "pre-wrap",
                        }}>
                          {msgText || <span style={{ opacity: 0.3, fontStyle: "italic" }}>-</span>}
                        </div>

                        {/* Timestamp */}
                        <div style={{ fontSize: 10, color: CP.dim, marginLeft: isMe ? 0 : 6, marginRight: isMe ? 6 : 0 }}>
                          {fmtTime(msg.createdAt)}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={bottomRef} style={{ height: 4 }} />
            </div>
          )}
        </div>

        {/* ── Composer ───────────────────────────────────────────────── */}
        <div style={{
          flexShrink: 0,
          background: CP.surface,
          borderTop: `0.5px solid ${CP.border}`,
          padding: "12px 20px 16px",
        }}>
          <div style={{ maxWidth: 760, margin: "0 auto", display: "flex", alignItems: "flex-end", gap: 10 }}>
            <textarea
              ref={inputRef}
              className="conv-input"
              value={text}
              onChange={e => setText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Message…"
              rows={1}
              style={{
                flex: 1, padding: "10px 16px",
                background: CP.raised,
                border: `1px solid ${CP.border}`,
                borderRadius: 24, color: CP.white,
                fontSize: 14, fontFamily: CP.fontB, lineHeight: 1.5,
                resize: "none", maxHeight: 120, overflow: "auto",
                transition: "border-color 0.15s",
              }}
              onInput={e => {
                e.target.style.height = "auto";
                e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px";
              }}
            />
            <button onClick={send} disabled={!text.trim() || sending} style={{
              width: 42, height: 42, borderRadius: "50%", flexShrink: 0, border: "none",
              background: text.trim() ? CP.accent : "rgba(255,255,255,0.06)",
              cursor: text.trim() ? "pointer" : "default",
              display: "flex", alignItems: "center", justifyContent: "center",
              transition: "background 0.2s, transform 0.1s",
            }}
              onMouseDown={e => { if (text.trim()) e.currentTarget.style.transform = "scale(0.92)"; }}
              onMouseUp={e => { e.currentTarget.style.transform = "scale(1)"; }}
            >
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={text.trim() ? "#040A14" : CP.dim} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" fill={text.trim() ? "#040A14" : "none"} />
              </svg>
            </button>
          </div>
        </div>

      </div>
    </>
  );
}