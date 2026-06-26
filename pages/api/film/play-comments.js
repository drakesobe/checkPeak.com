// pages/api/film/play-comments.js
// GET    ?playId=        — list comments for a play
// POST   { playId, body } — add a comment
// PATCH  { commentId, pin: true|false } — pin/unpin (coach only)
// DELETE { commentId }   — delete own comment

import { createClient } from "@supabase/supabase-js";
import { readUserCookie } from "@/lib/requireUser";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function parseUser(req) {
  const raw = req.method === "GET" ? req.query?._authUser : req.body?._authUser;
  if (raw) { try { return JSON.parse(String(raw)); } catch {} }
  return readUserCookie(req);
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  const user = parseUser(req);
  if (!user) return res.status(401).json({ error: "Not authenticated" });

  const userId   = String(user.email || user.Email || user.id || user.athlete_token || "").trim().toLowerCase();
  const userName = String(user.name  || user.Name || user.email || user.Email || "").trim() || "Athlete";

  try {
    if (req.method === "GET") {
      const playId = String(req.query.playId || "").trim();
      if (!playId) return res.status(400).json({ error: "playId required" });

      const { data: comments, error } = await supabase
        .from("play_comments")
        .select("id, user_id, user_name, body, created_at, is_pinned")
        .eq("play_id", playId)
        .order("is_pinned", { ascending: false })
        .order("created_at", { ascending: true });

      if (error) throw error;
      return res.status(200).json({ ok: true, comments: comments ?? [] });
    }

    if (req.method === "POST") {
      const { playId, body: commentBody } = req.body ?? {};
      if (!playId)              return res.status(400).json({ error: "playId required" });
      if (!commentBody?.trim()) return res.status(400).json({ error: "body required" });
      if (commentBody.length > 500) return res.status(400).json({ error: "Comment too long (max 500 chars)" });

      const { data, error } = await supabase
        .from("play_comments")
        .insert({
          play_id:   playId,
          user_id:   userId,
          user_name: userName,
          body:      commentBody.trim(),
          is_pinned: req.body.pinned === true,
        })
        .select()
        .single();

      if (error) throw error;
      return res.status(200).json({ ok: true, comment: data });
    }

    if (req.method === "PATCH") {
      const { commentId, pin } = req.body ?? {};
      if (!commentId) return res.status(400).json({ error: "commentId required" });
      if (typeof pin !== "boolean") return res.status(400).json({ error: "pin (boolean) required" });

      const { error } = await supabase
        .from("play_comments")
        .update({ is_pinned: pin })
        .eq("id", commentId);

      if (error) throw error;
      return res.status(200).json({ ok: true, is_pinned: pin });
    }

    if (req.method === "DELETE") {
      const commentId = String(req.body?.commentId || "").trim();
      if (!commentId) return res.status(400).json({ error: "commentId required" });

      const { error } = await supabase
        .from("play_comments")
        .delete()
        .eq("id", commentId)
        .eq("user_id", userId); // only delete own comments

      if (error) throw error;
      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (err) {
    console.error("[play-comments]", err);
    return res.status(500).json({ error: "Server error", details: err?.message });
  }
}
