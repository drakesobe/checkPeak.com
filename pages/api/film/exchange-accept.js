// pages/api/film/exchange-accept.js
// Public endpoint — token IS the auth.
//
// GET  ?token=                              → load exchange + film preview for landing page
// POST { token, action:"presign", … }      → presign S3 upload for non-user recipient
// POST { token, action:"complete", … }     → mark exchange accepted (file upload path)
// POST { token, action:"link-url", … }     → mark exchange accepted (external URL path)
// POST { token, action:"link", filmId }    → existing CheckPeak user links film (cookie auth)
//
// SQL — run once in Supabase before deploying:
//   ALTER TABLE film_exchanges ADD COLUMN IF NOT EXISTS external_url text;

import crypto          from "crypto";
import nodemailer      from "nodemailer";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl }               from "@aws-sdk/s3-request-presigner";
import { createClient }               from "@supabase/supabase-js";
import { readUserCookie }             from "@/lib/requireUser";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const s3 = new S3Client({
  region: process.env.AWS_REGION ?? "us-east-1",
  credentials: {
    accessKeyId:     process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const BUCKET = process.env.FILM_S3_BUCKET ?? "checkpeak-film-raw";

function getSmtp() {
  return {
    host:   process.env.SMTP_HOST   || "smtp.gmail.com",
    port:   Number(process.env.SMTP_PORT || 465),
    secure: String(process.env.SMTP_SECURE || "true") === "true",
    user:   process.env.SMTP_USER,
    pass:   process.env.SMTP_PASS,
    from:   process.env.FROM_EMAIL || process.env.SMTP_USER,
  };
}

function getBaseUrl() {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}

function detectPlatformName(url) {
  if (!url) return "External";
  const u = url.toLowerCase();
  if (u.includes("hudl.com"))                               return "HUDL";
  if (u.includes("youtube.com") || u.includes("youtu.be")) return "YouTube";
  if (u.includes("vimeo.com"))                              return "Vimeo";
  if (u.includes("drive.google.com"))                       return "Google Drive";
  if (u.includes("dropbox.com"))                            return "Dropbox";
  if (u.includes("box.com"))                                return "Box";
  return "External Link";
}

async function notifyRequestingCoach({ toEmail, fromProgramName, filmTitle, receivedFilmId, exchangeToken, externalUrl }) {
  const smtp = getSmtp();
  if (!smtp.user || !smtp.pass) return;

  const baseUrl    = getBaseUrl();
  const isExternal = !!externalUrl;
  const platform   = isExternal ? detectPlatformName(externalUrl) : null;
  const filmUrl    = isExternal ? externalUrl : `${baseUrl}/film-exchange/${exchangeToken}`;
  const ctaLabel   = isExternal ? `View on ${platform} →` : "View Their Film →";

  const html = `
    <div style="font-family: -apple-system, 'Segoe UI', Arial, sans-serif; background: #0a0c12; padding: 40px 24px; max-width: 560px; margin: 0 auto;">
      <div style="margin-bottom: 28px;">
        <span style="font-size: 18px; font-weight: 900; color: #4FABFF;">Check<span style="color: #ffffff;">Peak</span></span>
      </div>
      <div style="background: #13151f; border-radius: 14px; border: 1px solid rgba(255,255,255,0.08); padding: 24px; margin-bottom: 24px;">
        <div style="font-size: 11px; font-weight: 800; color: #34C759; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 10px;">✓ Exchange Accepted</div>
        <h2 style="margin: 0 0 8px; font-size: 22px; font-weight: 800; color: #f0f2f6;">
          ${fromProgramName} responded to your film exchange
        </h2>
        <p style="margin: 0; font-size: 14px; color: #9ba8b4;">
          ${isExternal
            ? `They shared their film via <strong style="color: #f0f2f6;">${platform}</strong>.`
            : `Their film for <strong style="color: #f0f2f6;">${filmTitle}</strong> is now available.`
          }
        </p>
      </div>
      ${isExternal ? `
      <div style="background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; padding: 14px 18px; margin-bottom: 20px;">
        <div style="font-size: 11px; font-weight: 700; color: #9ba8b4; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 6px;">Shared Link</div>
        <div style="font-size: 13px; color: #4FABFF; word-break: break-all; font-family: monospace;">${externalUrl}</div>
      </div>` : ""}
      <a href="${filmUrl}" style="display: block; background: #4FABFF; color: #0a0c12; text-decoration: none; text-align: center; font-size: 15px; font-weight: 800; padding: 16px 24px; border-radius: 12px; margin-bottom: 20px;">
        ${ctaLabel}
      </a>
      <p style="margin: 0; font-size: 12px; color: #5a6a7d; text-align: center;">Powered by CheckPeak</p>
    </div>
  `;

  const transporter = nodemailer.createTransport({
    host: smtp.host, port: smtp.port, secure: smtp.secure,
    auth: { user: smtp.user, pass: smtp.pass },
  });

  await transporter.sendMail({
    from:    `CheckPeak Film <${smtp.from}>`,
    to:      toEmail,
    subject: isExternal
      ? `${fromProgramName} shared their film via ${platform}`
      : `${fromProgramName} accepted your film exchange`,
    text:    isExternal
      ? `${fromProgramName} shared their film via ${platform}: ${externalUrl}`
      : `${fromProgramName} uploaded their film. View it here: ${filmUrl}`,
    html,
  }).catch(e => console.error("[exchange-accept] notify email failed:", e));
}

// ── GET: load exchange for landing page ───────────────────────────────────────

async function getExchange(req, res) {
  const token = String(req.query.token ?? "").trim();
  if (!token) return res.status(400).json({ error: "token required" });

  const { data: exchange, error } = await supabase
    .from("film_exchanges")
    .select("id, requesting_org_id, requesting_org_name, requesting_film_id, receiving_email, receiving_org_id, received_film_id, external_url, message, status, created_at")
    .eq("token", token)
    .single();

  if (error || !exchange) return res.status(404).json({ error: "Exchange not found" });

  // Load requesting film
  const { data: film } = await supabase
    .from("game_films")
    .select("id, title, game_date, opponent, home_away, mux_playback_id, status, play_count")
    .eq("id", exchange.requesting_film_id)
    .single();

  // Load analytics teaser
  const { data: plays } = await supabase
    .from("game_plays")
    .select("result, play_type")
    .eq("film_id", exchange.requesting_film_id);

  const playCount  = plays?.length ?? film?.play_count ?? 0;
  const successes  = plays?.filter(p => p.result === "success" || p.result === "td").length ?? 0;
  const successPct = playCount > 0 ? Math.round(successes / playCount * 100) : null;
  const runs       = plays?.filter(p => p.play_type === "run").length ?? 0;
  const passes     = plays?.filter(p => p.play_type === "pass").length ?? 0;
  const tds        = plays?.filter(p => p.result === "td").length ?? 0;

  // Load received film if already accepted via upload
  let receivedFilm = null;
  if (exchange.received_film_id) {
    const { data: rf } = await supabase
      .from("game_films")
      .select("id, title, mux_playback_id, status, play_count")
      .eq("id", exchange.received_film_id)
      .single();
    receivedFilm = rf;
  }

  return res.status(200).json({
    ok: true,
    exchange: {
      id:                exchange.id,
      status:            exchange.status,
      requestingOrgName: exchange.requesting_org_name,
      receivingEmail:    exchange.receiving_email,
      message:           exchange.message,
      externalUrl:       exchange.external_url ?? null,
      createdAt:         exchange.created_at,
    },
    film: film ? {
      id:            film.id,
      title:         film.title,
      gameDate:      film.game_date,
      opponent:      film.opponent,
      muxPlaybackId: film.mux_playback_id,
      status:        film.status,
    } : null,
    analytics: { playCount, successPct, runs, passes, tds },
    receivedFilm,
  });
}

// ── POST: presign upload for non-user ─────────────────────────────────────────

async function presignUpload(req, res) {
  const { token, email, programName, contentType = "video/mp4" } = req.body;
  if (!token || !email) return res.status(400).json({ error: "token and email required" });

  const { data: exchange } = await supabase
    .from("film_exchanges")
    .select("id, requesting_film_id, status")
    .eq("token", token)
    .single();

  if (!exchange) return res.status(404).json({ error: "Exchange not found" });
  if (exchange.status === "accepted") return res.status(409).json({ error: "Exchange already completed" });

  const uploadId = crypto.randomUUID();
  const s3Key    = `exchange/${uploadId}.mp4`;

  const command   = new PutObjectCommand({ Bucket: BUCKET, Key: s3Key, ContentType: contentType });
  const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 7200 });

  return res.status(200).json({ ok: true, uploadUrl, s3Key, uploadId });
}

// ── POST: complete exchange after file upload ─────────────────────────────────

async function completeExchange(req, res) {
  const { token, s3Key, email, programName, title } = req.body;
  if (!token || !s3Key) return res.status(400).json({ error: "token and s3Key required" });

  const cleanEmail = String(email || "").trim().toLowerCase();

  const { data: exchange } = await supabase
    .from("film_exchanges")
    .select("id, requesting_org_id, requesting_org_name, requesting_film_id, status, token")
    .eq("token", token)
    .single();

  if (!exchange) return res.status(404).json({ error: "Exchange not found" });
  if (exchange.status === "accepted") return res.status(409).json({ error: "Already accepted" });

  const { data: reqFilm } = await supabase
    .from("game_films")
    .select("title, opponent")
    .eq("id", exchange.requesting_film_id)
    .single();

  const reqFilmTitle = reqFilm?.title || (reqFilm?.opponent ? `vs ${reqFilm.opponent}` : "their game film");

  const { data: newFilm, error: filmErr } = await supabase
    .from("game_films")
    .insert({
      org_id:     null,
      title:      title?.trim() || (programName ? `${programName} Film` : "Exchange Film"),
      status:     "uploading",
      s3_key_raw: s3Key,
    })
    .select("id")
    .single();

  if (filmErr) throw filmErr;

  await supabase
    .from("film_exchanges")
    .update({
      status:           "accepted",
      received_film_id: newFilm.id,
      receiving_email:  cleanEmail || undefined,
      accepted_at:      new Date().toISOString(),
    })
    .eq("id", exchange.id);

  try {
    await fetch(`${getBaseUrl()}/api/film/process`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ filmId: newFilm.id, s3Key }),
    });
  } catch (e) {
    console.warn("[exchange-accept] process trigger failed (non-fatal):", e);
  }

  const { data: reqOrg } = await supabase
    .from("organizations")
    .select("email, name")
    .eq("token", exchange.requesting_org_id)
    .maybeSingle();

  if (reqOrg?.email) {
    await notifyRequestingCoach({
      toEmail:         reqOrg.email,
      fromProgramName: programName || cleanEmail || "Your opponent",
      filmTitle:       reqFilmTitle,
      receivedFilmId:  newFilm.id,
      exchangeToken:   exchange.token,
    });
  }

  return res.status(200).json({ ok: true, filmId: newFilm.id });
}

// ── POST: accept via external link (HUDL, YouTube, Vimeo, etc.) ──────────────

async function linkExternalUrl(req, res) {
  const { token, externalUrl, email, programName } = req.body;
  if (!token)       return res.status(400).json({ error: "token required" });
  if (!externalUrl) return res.status(400).json({ error: "externalUrl required" });

  try { new URL(externalUrl.trim()); }
  catch { return res.status(400).json({ error: "Invalid URL — paste a full shareable link (e.g. https://…)" }); }

  const { data: exchange } = await supabase
    .from("film_exchanges")
    .select("id, requesting_org_id, requesting_film_id, status, token")
    .eq("token", token)
    .single();

  if (!exchange)                       return res.status(404).json({ error: "Exchange not found" });
  if (exchange.status === "accepted")  return res.status(409).json({ error: "Exchange already completed" });

  const cleanEmail = String(email || "").trim().toLowerCase();

  await supabase
    .from("film_exchanges")
    .update({
      status:          "accepted",
      external_url:    externalUrl.trim(),
      receiving_email: cleanEmail || undefined,
      accepted_at:     new Date().toISOString(),
    })
    .eq("id", exchange.id);

  const { data: reqFilm } = await supabase
    .from("game_films")
    .select("title, opponent")
    .eq("id", exchange.requesting_film_id)
    .single();

  const reqFilmTitle = reqFilm?.title || (reqFilm?.opponent ? `vs ${reqFilm.opponent}` : "game film");

  const { data: reqOrg } = await supabase
    .from("organizations")
    .select("email")
    .eq("token", exchange.requesting_org_id)
    .maybeSingle();

  if (reqOrg?.email) {
    await notifyRequestingCoach({
      toEmail:         reqOrg.email,
      fromProgramName: programName || cleanEmail || "Your opponent",
      filmTitle:       reqFilmTitle,
      receivedFilmId:  null,
      exchangeToken:   exchange.token,
      externalUrl:     externalUrl.trim(),
    });
  }

  return res.status(200).json({ ok: true });
}

// ── POST: existing CheckPeak user links their film ───────────────────────────

async function linkFilm(req, res) {
  const { token, filmId } = req.body;
  if (!token || !filmId) return res.status(400).json({ error: "token and filmId required" });

  const user  = readUserCookie(req);
  if (!user)  return res.status(401).json({ error: "Sign in to link your film" });
  const orgId = String(user.orgToken || user.Token || user.orgId || user.OrgId || "").trim();

  const [{ data: exchange }, { data: film }] = await Promise.all([
    supabase.from("film_exchanges").select("*").eq("token", token).single(),
    supabase.from("game_films").select("id, org_id, title, opponent").eq("id", filmId).single(),
  ]);

  if (!exchange)                          return res.status(404).json({ error: "Exchange not found" });
  if (exchange.status === "accepted")     return res.status(409).json({ error: "Already accepted" });
  if (!film || film.org_id !== orgId)     return res.status(403).json({ error: "Film not found in your library" });

  await supabase
    .from("film_exchanges")
    .update({
      status:           "accepted",
      received_film_id: filmId,
      receiving_org_id: orgId,
      accepted_at:      new Date().toISOString(),
    })
    .eq("id", exchange.id);

  const { data: reqOrg } = await supabase
    .from("organizations")
    .select("email")
    .eq("token", exchange.requesting_org_id)
    .maybeSingle();

  const { data: receivingOrg } = await supabase
    .from("organizations")
    .select("name")
    .eq("token", orgId)
    .maybeSingle();

  const reqFilmTitle = film.title || (film.opponent ? `vs ${film.opponent}` : "game film");

  if (reqOrg?.email) {
    await notifyRequestingCoach({
      toEmail:         reqOrg.email,
      fromProgramName: receivingOrg?.name ?? "Your opponent",
      filmTitle:       reqFilmTitle,
      receivedFilmId:  filmId,
      exchangeToken:   exchange.token,
    });
  }

  return res.status(200).json({ ok: true });
}

// ── Handler ───────────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  try {
    if (req.method === "GET") return await getExchange(req, res);

    if (req.method === "POST") {
      const { action } = req.body ?? {};
      if (action === "presign")   return await presignUpload(req, res);
      if (action === "complete")  return await completeExchange(req, res);
      if (action === "link-url")  return await linkExternalUrl(req, res);
      if (action === "link")      return await linkFilm(req, res);
      return res.status(400).json({ error: "action required: presign | complete | link-url | link" });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (err) {
    console.error("[exchange-accept]", err);
    return res.status(500).json({ error: "Server error", details: err?.message });
  }
}
