// pages/api/commercial/analytics.js
// Trainer analytics: subscriber counts, MRR estimate, Mux video views, recent joins.
import { getRequestUser } from "@/lib/commercial/getRequestUser";
import {
  getTrainerByUserId,
  getSubscriptionsByTrainer,
  getVideosByTrainer,
  getWorkoutsByTrainer,
} from "@/lib/commercial/db";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "GET") return res.status(405).end();

  const user = getRequestUser(req);
  if (!user) return res.status(401).json({ error: "Unauthorized" });

  const trainer = await getTrainerByUserId(user.email || user.Email);
  if (!trainer) return res.status(404).json({ error: "No trainer profile" });

  const f = trainer.fields ?? {};

  const [subscriptions, videos, workouts] = await Promise.all([
    getSubscriptionsByTrainer(trainer.id),
    getVideosByTrainer(trainer.id),
    getWorkoutsByTrainer(trainer.id).catch(() => []),
  ]);

  // ── Subscriber analytics ────────────────────────────────────────────────────
  const activeSubs  = subscriptions.filter(s => s.fields?.status === "active");
  const now         = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    .toISOString().slice(0, 10);

  const newThisMonth = activeSubs.filter(
    s => (s.fields?.startDate ?? "") >= startOfMonth
  ).length;

  const tierCounts = { Basic: 0, Premium: 0, Ultra: 0 };
  for (const sub of activeSubs) {
    const t = sub.fields?.tier;
    if (t in tierCounts) tierCounts[t]++;
  }

  const mrr =
    (tierCounts.Basic   * (Number(f.basicPrice)   || 0)) +
    (tierCounts.Premium * (Number(f.premiumPrice) || 0)) +
    (tierCounts.Ultra   * (Number(f.ultraPrice)   || 0));

  const recentJoins = [...activeSubs]
    .sort((a, b) => {
      const da = a.fields?.startDate ?? "";
      const db = b.fields?.startDate ?? "";
      return db > da ? 1 : db < da ? -1 : 0;
    })
    .slice(0, 6)
    .map(s => ({
      email: s.fields?.clientEmail ?? "",
      name:  s.fields?.clientName  ?? "",
      tier:  s.fields?.tier        ?? "",
      date:  s.fields?.startDate   ?? "",
    }));

  // ── Mux video views (last 28 days) ──────────────────────────────────────────
  // Non-fatal: gracefully returns empty object if Mux Data is unavailable.
  let muxViewsByAsset = {};
  try {
    const muxAuth = Buffer.from(
      `${process.env.MUX_TOKEN_ID}:${process.env.MUX_TOKEN_SECRET}`
    ).toString("base64");

    const muxRes = await fetch(
      "https://api.mux.com/data/v1/metrics/views/breakdown?group_by=asset_id&timeframe[]=28:days",
      { headers: { Authorization: `Basic ${muxAuth}` } }
    );

    if (muxRes.ok) {
      const muxData = await muxRes.json();
      for (const row of muxData.data ?? []) {
        if (row.field) muxViewsByAsset[row.field] = Number(row.value) || 0;
      }
    }
  } catch (e) {
    console.warn("[analytics] Mux data unavailable (non-fatal):", e.message);
  }

  const videoStats = videos
    .map(v => ({
      id:            v.id,
      title:         v.fields?.title         ?? "Untitled",
      tier:          v.fields?.tier          ?? "Basic",
      published:     Boolean(v.fields?.published),
      muxPlaybackId: v.fields?.muxPlaybackId ?? null,
      thumbnailUrl:  v.fields?.thumbnailUrl  ?? null,
      embedUrl:      v.fields?.embedUrl      ?? null,
      views:         muxViewsByAsset[v.fields?.muxAssetId] ?? 0,
    }))
    .sort((a, b) => b.views - a.views);

  return res.status(200).json({
    subscribers: {
      total: activeSubs.length,
      newThisMonth,
      byTier: tierCounts,
      mrr,
      recentJoins,
    },
    content: {
      totalVideos:       videos.length,
      publishedVideos:   videos.filter(v => v.fields?.published).length,
      totalWorkouts:     workouts.length,
      publishedWorkouts: workouts.filter(w => w.fields?.published).length,
    },
    topVideos: videoStats.slice(0, 8),
    prices: {
      basic:   Number(f.basicPrice)   || 0,
      premium: Number(f.premiumPrice) || 0,
      ultra:   Number(f.ultraPrice)   || 0,
    },
  });
}
