// pages/api/org/nav-counts.js
// GET -> { reviewQueue, messages }: things waiting on the coach, shown as badges in the app navigation.
// reviewQueue uses the same loader as the Review Queue page; messages uses the same unread rule
// as the Messaging page, so badges always match what the coach sees there.

import { collection, getDocs, query, where } from "firebase/firestore";
import { db as firestore } from "@/lib/firebase";
import { requireOrg } from "@/lib/requireOrg";
import { resolveOrgId, loadReviewQueueItems } from "@/lib/org/reviewQueueData";
import { isConversationUnread } from "@/lib/messagingUnread";

const CACHE_MS = 45 * 1000; // nav polls every minute; this absorbs bursts of page navigation
const cache = new Map();    // orgToken:userId -> { at, data }

async function countPendingReviews(auth, orgToken) {
  const orgId = await resolveOrgId(auth);
  if (!orgId && !orgToken) return 0;
  const items = await loadReviewQueueItems({ orgId, orgToken });
  return items.filter((i) => i.reviewStatus === "pending").length;
}

// Same identity the Messaging page uses for the signed-in coach
async function countUnreadConversations(userId) {
  if (!userId) return 0;
  const snap = await getDocs(query(collection(firestore, "conversations"), where("participantIds", "array-contains", userId)));
  let unread = 0;
  snap.forEach((d) => { if (isConversationUnread(d.data(), userId)) unread++; });
  return unread;
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "private, no-store");
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const auth = requireOrg(req);
  if (!auth?.ok) return res.status(401).json({ error: "Unauthorized" });

  const orgToken = String(auth.org?.token || "").trim().toUpperCase();
  const userId   = String(auth.user?.id || auth.user?.memberId || "").trim();
  const key      = `${orgToken}:${userId}`;
  const hit = cache.get(key);
  if (req.query.fresh !== "1" && hit && Date.now() - hit.at < CACHE_MS) return res.status(200).json(hit.data);

  const [reviewQueue, messages] = await Promise.all([
    countPendingReviews(auth, orgToken).catch((e) => { console.error("[nav-counts] reviews:", e); return 0; }),
    countUnreadConversations(userId).catch((e) => { console.error("[nav-counts] messages:", e); return 0; }),
  ]);

  const data = { reviewQueue, messages };
  cache.set(key, { at: Date.now(), data });
  return res.status(200).json(data);
}
