// lib/messagingUnread.js
// A conversation is unread for a user when its last message came from someone else after the
// user last opened it. Conversations store `lastReadAt.{userId}` (written by the messaging page).

const toMillis = (t) => {
  if (!t) return 0;
  if (typeof t.toMillis === "function") return t.toMillis();   // Firestore Timestamp
  if (typeof t.seconds === "number") return t.seconds * 1000;  // serialized Timestamp
  const ms = new Date(t).getTime();
  return Number.isFinite(ms) ? ms : 0;
};

export function isConversationUnread(conv, userId) {
  if (!conv || !userId) return false;
  if (!conv.lastSenderId || conv.lastSenderId === userId) return false;
  const lastMessage = toMillis(conv.lastMessageAt);
  if (!lastMessage) return false;
  return lastMessage > toMillis(conv.lastReadAt?.[userId]);
}
