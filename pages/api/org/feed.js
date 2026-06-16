// pages/api/org/feed.js
// Team announcements feed.
//
// GET  ?limit=20&offset=0       — paginated announcements (newest first)
// POST { content, authorName? } — create announcement
// POST { action: 'like', id, athleteId } — toggle like on an announcement

import { supabaseAdmin as db } from "@/lib/supabase";
import { readUserCookie }      from "@/lib/requireUser";

function parseUser(req) {
  const raw = req.body?._authUser ?? req.query?._authUser;
  if (raw) {
    try { return JSON.parse(decodeURIComponent(String(raw))); } catch {}
  }
  return readUserCookie(req);
}

function getOrgToken(user) {
  return String(user?.orgToken || user?.Token || user?.token || "").trim();
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  const user = parseUser(req);
  if (!user) return res.status(401).json({ error: "Not authenticated" });

  const orgToken = getOrgToken(user);
  if (!orgToken) return res.status(400).json({ error: "Missing org token" });

  // ── GET ──────────────────────────────────────────────────────────────────────
  if (req.method === "GET") {
    const limit  = Math.min(Number(req.query.limit  || 20), 50);
    const offset = Number(req.query.offset || 0);

    const { data, error } = await db
      .from("org_announcements")
      .select("id, author_name, content, like_count, created_at")
      .eq("org_token", orgToken)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error("[org/feed GET]", error);
      return res.status(500).json({ error: error.message });
    }

    const posts = (data ?? []).map(p => ({
      id:         p.id,
      authorName: p.author_name,
      content:    p.content,
      likes:      p.like_count ?? 0,
      createdAt:  p.created_at,
    }));

    return res.status(200).json({ ok: true, posts });
  }

  // ── POST ─────────────────────────────────────────────────────────────────────
  if (req.method === "POST") {
    const { action, id: postId, athleteId, content, authorName } = req.body || {};

    // Like toggle
    if (action === "like") {
      if (!postId || !athleteId) {
        return res.status(400).json({ error: "id and athleteId required" });
      }

      // Check if already liked
      const { data: existing } = await db
        .from("org_announcement_likes")
        .select("id")
        .eq("announcement_id", postId)
        .eq("athlete_id", athleteId)
        .maybeSingle();

      if (existing) {
        // Unlike
        await db.from("org_announcement_likes").delete()
          .eq("announcement_id", postId).eq("athlete_id", athleteId);
        await db.rpc("decrement_like_count", { row_id: postId }).catch(() =>
          db.from("org_announcements").update({ like_count: db.raw("GREATEST(like_count - 1, 0)") }).eq("id", postId)
        );
        const { data: updated } = await db.from("org_announcements").select("like_count").eq("id", postId).single();
        return res.status(200).json({ ok: true, liked: false, likeCount: updated?.like_count ?? 0 });
      } else {
        // Like
        await db.from("org_announcement_likes").insert({ announcement_id: postId, athlete_id: athleteId })
          .onConflict("announcement_id,athlete_id").ignore();
        await db.from("org_announcements").update({ like_count: db.raw?.("like_count + 1") }).eq("id", postId)
          .catch(async () => {
            const { data: cur } = await db.from("org_announcements").select("like_count").eq("id", postId).single();
            await db.from("org_announcements").update({ like_count: (cur?.like_count ?? 0) + 1 }).eq("id", postId);
          });
        // Reliable increment via select + update
        const { data: cur } = await db.from("org_announcements").select("like_count").eq("id", postId).single();
        await db.from("org_announcements").update({ like_count: (cur?.like_count ?? 0) + 1 }).eq("id", postId);
        return res.status(200).json({ ok: true, liked: true, likeCount: (cur?.like_count ?? 0) + 1 });
      }
    }

    // Create announcement
    if (!content) return res.status(400).json({ error: "content is required" });

    const displayName = String(authorName || user.orgName || user.name || "Coach").trim();

    const { data, error } = await db.from("org_announcements").insert({
      org_token:   orgToken,
      author_name: displayName,
      content:     String(content).trim(),
    }).select().single();

    if (error) {
      console.error("[org/feed POST]", error);
      return res.status(500).json({ error: error.message });
    }

    return res.status(201).json({
      ok:   true,
      post: {
        id:         data.id,
        authorName: data.author_name,
        content:    data.content,
        likes:      0,
        createdAt:  data.created_at,
      },
    });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
