// pages/api/film/exchange.js
// GET  ?filmId=   → list exchanges for a film (auth required)
// POST { filmId, receivingEmail, message } → create exchange + send email

// ── Supabase table required ────────────────────────────────────────────────
// Run this in Supabase SQL editor before deploying:
//
// CREATE TABLE IF NOT EXISTS film_exchanges (
//   id                   uuid DEFAULT gen_random_uuid() PRIMARY KEY,
//   requesting_org_id    text NOT NULL,
//   requesting_org_name  text,
//   requesting_film_id   uuid REFERENCES game_films(id) ON DELETE CASCADE,
//   receiving_email      text NOT NULL,
//   receiving_org_id     text,
//   received_film_id     uuid REFERENCES game_films(id),
//   message              text,
//   token                text UNIQUE NOT NULL,
//   status               text NOT NULL DEFAULT 'pending',
//   created_at           timestamptz DEFAULT now(),
//   accepted_at          timestamptz
// );
// CREATE INDEX IF NOT EXISTS idx_film_exchanges_film   ON film_exchanges(requesting_film_id);
// CREATE INDEX IF NOT EXISTS idx_film_exchanges_token  ON film_exchanges(token);
// CREATE INDEX IF NOT EXISTS idx_film_exchanges_email  ON film_exchanges(receiving_email);
// ─────────────────────────────────────────────────────────────────────────────

import crypto          from "crypto";
import nodemailer      from "nodemailer";
import { createClient} from "@supabase/supabase-js";
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

function getBaseUrl() {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}

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

async function sendExchangeEmail({ to, fromOrgName, filmTitle, gameDate, playCount, successPct, message, exchangeUrl }) {
  const smtp = getSmtp();
  if (!smtp.user || !smtp.pass) {
    console.warn("[film/exchange] SMTP not configured — skipping email");
    return;
  }

  const dateStr = gameDate ? new Date(gameDate).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) : "";
  const subject = `${fromOrgName} wants to exchange game film with you`;

  const html = `
    <div style="font-family: -apple-system, 'Segoe UI', Arial, sans-serif; background: #0a0c12; padding: 0; margin: 0;">
      <div style="max-width: 560px; margin: 0 auto; padding: 40px 24px;">

        <!-- Logo -->
        <div style="margin-bottom: 32px;">
          <span style="font-size: 18px; font-weight: 900; color: #4FABFF; letter-spacing: -0.5px;">Check<span style="color: #ffffff;">Peak</span></span>
        </div>

        <!-- Headline -->
        <h1 style="margin: 0 0 8px; font-size: 26px; font-weight: 800; color: #f0f2f6; line-height: 1.2;">
          Film Exchange Request
        </h1>
        <p style="margin: 0 0 28px; font-size: 16px; color: #9ba8b4; line-height: 1.5;">
          <strong style="color: #f0f2f6;">${fromOrgName}</strong> wants to exchange game film with you.
        </p>

        <!-- Film card -->
        <div style="background: #13151f; border-radius: 14px; border: 1px solid rgba(255,255,255,0.08); padding: 20px 22px; margin-bottom: 20px;">
          <div style="font-size: 11px; font-weight: 800; color: #4FABFF; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px;">They're sharing</div>
          <div style="font-size: 18px; font-weight: 800; color: #f0f2f6; margin-bottom: 4px;">${filmTitle}</div>
          ${dateStr ? `<div style="font-size: 13px; color: #9ba8b4; margin-bottom: 16px;">${dateStr}</div>` : `<div style="margin-bottom: 16px;"></div>`}
          <div style="display: flex; gap: 20px;">
            <div>
              <div style="font-size: 22px; font-weight: 900; color: #f0f2f6;">${playCount ?? "—"}</div>
              <div style="font-size: 11px; color: #9ba8b4; text-transform: uppercase; letter-spacing: 0.5px;">Plays Tagged</div>
            </div>
            ${successPct != null ? `
            <div>
              <div style="font-size: 22px; font-weight: 900; color: #34C759;">${successPct}%</div>
              <div style="font-size: 11px; color: #9ba8b4; text-transform: uppercase; letter-spacing: 0.5px;">Success Rate</div>
            </div>` : ""}
          </div>
        </div>

        <!-- Message -->
        ${message ? `
        <div style="background: rgba(79,171,255,0.07); border-left: 3px solid #4FABFF; border-radius: 0 10px 10px 0; padding: 14px 18px; margin-bottom: 28px;">
          <div style="font-size: 11px; font-weight: 700; color: #4FABFF; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 6px;">Message from ${fromOrgName}</div>
          <div style="font-size: 14px; color: #d0d8e4; line-height: 1.6; font-style: italic;">"${message}"</div>
        </div>` : `<div style="margin-bottom: 28px;"></div>`}

        <!-- CTA -->
        <a href="${exchangeUrl}" style="display: block; background: #4FABFF; color: #0a0c12; text-decoration: none; text-align: center; font-size: 15px; font-weight: 800; padding: 16px 24px; border-radius: 12px; margin-bottom: 16px; letter-spacing: -0.2px;">
          View Their Film &amp; Complete Exchange →
        </a>
        <p style="margin: 0 0 40px; font-size: 12px; color: #5a6a7d; text-align: center;">
          Or copy this link: <a href="${exchangeUrl}" style="color: #4FABFF;">${exchangeUrl}</a>
        </p>

        <!-- Footer -->
        <div style="border-top: 1px solid rgba(255,255,255,0.07); padding-top: 20px;">
          <p style="margin: 0; font-size: 12px; color: #5a6a7d; line-height: 1.6;">
            You received this because ${fromOrgName} sent you a film exchange via CheckPeak.<br>
            If you weren't expecting this, you can safely ignore it.
          </p>
        </div>

      </div>
    </div>
  `;

  const transporter = nodemailer.createTransport({
    host: smtp.host, port: smtp.port, secure: smtp.secure,
    auth: { user: smtp.user, pass: smtp.pass },
  });

  await transporter.sendMail({
    from:    `CheckPeak Film <${smtp.from}>`,
    to,
    subject,
    text:    `${fromOrgName} wants to exchange film with you.\n\nView their film and respond: ${exchangeUrl}`,
    html,
  });
}

// ── GET ───────────────────────────────────────────────────────────────────────

async function getExchanges(req, res, orgId) {
  const filmId = String(req.query.filmId ?? "").trim();
  if (!filmId) return res.status(400).json({ error: "filmId required" });

  const { data: exchanges, error } = await supabase
    .from("film_exchanges")
    .select("id, receiving_email, receiving_org_id, received_film_id, external_url, message, status, created_at, accepted_at")
    .eq("requesting_film_id", filmId)
    .eq("requesting_org_id", orgId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return res.status(200).json({ ok: true, exchanges: exchanges ?? [] });
}

// ── POST ──────────────────────────────────────────────────────────────────────

async function createExchange(req, res, orgId, user) {
  const { filmId, receivingEmail, message } = req.body ?? {};
  if (!filmId)        return res.status(400).json({ error: "filmId required" });
  if (!receivingEmail || !receivingEmail.includes("@"))
    return res.status(400).json({ error: "Valid receivingEmail required" });

  const cleanEmail = String(receivingEmail).trim().toLowerCase();

  // Verify film belongs to requesting org
  const { data: film, error: filmErr } = await supabase
    .from("game_films")
    .select("id, title, game_date, opponent, org_id, status, mux_playback_id, play_count")
    .eq("id", filmId)
    .single();

  if (filmErr || !film || film.org_id !== orgId)
    return res.status(404).json({ error: "Film not found" });

  // Don't allow requesting coach to exchange with themselves
  const { data: requestingOrg } = await supabase
    .from("organizations")
    .select("id, name, email")
    .eq("token", orgId)
    .maybeSingle();

  if (requestingOrg?.email?.toLowerCase() === cleanEmail)
    return res.status(400).json({ error: "You can't exchange with your own organization" });

  // Check for existing pending exchange to the same email for this film
  const { data: existing } = await supabase
    .from("film_exchanges")
    .select("id, status")
    .eq("requesting_film_id", filmId)
    .eq("receiving_email", cleanEmail)
    .maybeSingle();

  if (existing && existing.status === "pending")
    return res.status(409).json({ error: "An exchange request is already pending with this email" });

  // Check if receiving org is in the system
  const { data: receivingOrg } = await supabase
    .from("organizations")
    .select("id, name, token")
    .eq("email", cleanEmail)
    .maybeSingle();

  // Compute quick analytics for the email teaser
  const { data: plays } = await supabase
    .from("game_plays")
    .select("result")
    .eq("film_id", filmId);

  const playCount  = plays?.length ?? film.play_count ?? 0;
  const successes  = plays?.filter(p => p.result === "success" || p.result === "td").length ?? 0;
  const successPct = playCount > 0 ? Math.round(successes / playCount * 100) : null;

  // Generate exchange token
  const token = crypto.randomBytes(32).toString("hex");

  const { data: exchange, error: insErr } = await supabase
    .from("film_exchanges")
    .insert({
      requesting_org_id:   orgId,
      requesting_org_name: requestingOrg?.name ?? user.name ?? user.email ?? "A coach",
      requesting_film_id:  filmId,
      receiving_email:     cleanEmail,
      receiving_org_id:    receivingOrg?.token ?? null,
      message:             message?.trim() || null,
      token,
      status:              "pending",
    })
    .select("id, token")
    .single();

  if (insErr) throw insErr;

  // Send the email
  const baseUrl     = getBaseUrl();
  const exchangeUrl = `${baseUrl}/film-exchange/${token}`;
  const filmTitle   = film.title || (film.opponent ? `vs ${film.opponent}` : "Game Film");

  try {
    await sendExchangeEmail({
      to:          cleanEmail,
      fromOrgName: requestingOrg?.name ?? "A CheckPeak team",
      filmTitle,
      gameDate:    film.game_date,
      playCount,
      successPct,
      message:     message?.trim() || null,
      exchangeUrl,
    });
  } catch (emailErr) {
    console.error("[film/exchange] email failed (non-fatal):", emailErr);
    // Exchange was created — email failure is non-fatal
  }

  return res.status(200).json({
    ok: true,
    exchangeId: exchange.id,
    receivingOrgName: receivingOrg?.name ?? null,
    inSystem: !!receivingOrg,
  });
}

// ── Handler ───────────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  const user  = parseUser(req);
  if (!user) return res.status(401).json({ error: "Not authenticated" });

  const orgId = String(user.orgToken || user.Token || user.orgId || user.OrgId || "").trim();
  if (!orgId) return res.status(400).json({ error: "Missing org identity" });

  try {
    if (req.method === "GET")  return await getExchanges(req, res, orgId);
    if (req.method === "POST") return await createExchange(req, res, orgId, user);
    return res.status(405).json({ error: "Method not allowed" });
  } catch (err) {
    console.error("[film/exchange]", err);
    return res.status(500).json({ error: "Server error", details: err?.message });
  }
}
