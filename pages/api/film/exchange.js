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

async function sendExchangeEmail({ to, fromOrgName, films, message, primaryExchangeUrl }) {
  const smtp = getSmtp();
  if (!smtp.user || !smtp.pass) {
    console.warn("[film/exchange] SMTP not configured — skipping email");
    return;
  }

  const isMulti   = films.length > 1;
  const subject   = isMulti
    ? `${fromOrgName} wants to exchange ${films.length} game films with you`
    : `${fromOrgName} wants to exchange game film with you`;

  const filmListHtml = isMulti
    ? `<div style="background: #13151f; border-radius: 14px; border: 1px solid rgba(255,255,255,0.08); padding: 20px 22px; margin-bottom: 20px;">
        <div style="font-size: 11px; font-weight: 800; color: #4FABFF; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 14px;">They're sharing ${films.length} films</div>
        ${films.map((f, i) => {
          const title   = f.title || (f.opponent ? `vs ${f.opponent}` : "Game Film");
          const dateStr = f.game_date ? new Date(f.game_date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "";
          return `<div style="display:flex;align-items:center;gap:12px;padding:${i > 0 ? "10px 0 0" : "0"};${i > 0 ? "border-top:1px solid rgba(255,255,255,0.06);margin-top:10px;" : ""}">
            <div style="flex:1;">
              <div style="font-size:14px;font-weight:700;color:#f0f2f6;">${title}</div>
              ${dateStr ? `<div style="font-size:12px;color:#9ba8b4;margin-top:2px;">${dateStr}</div>` : ""}
            </div>
            ${f.play_count > 0 ? `<div style="font-size:12px;font-weight:700;color:#4FABFF;white-space:nowrap;">${f.play_count} plays</div>` : ""}
          </div>`;
        }).join("")}
      </div>`
    : (() => {
        const f       = films[0];
        const title   = f.title || (f.opponent ? `vs ${f.opponent}` : "Game Film");
        const dateStr = f.game_date ? new Date(f.game_date).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) : "";
        return `<div style="background: #13151f; border-radius: 14px; border: 1px solid rgba(255,255,255,0.08); padding: 20px 22px; margin-bottom: 20px;">
          <div style="font-size: 11px; font-weight: 800; color: #4FABFF; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px;">They're sharing</div>
          <div style="font-size: 18px; font-weight: 800; color: #f0f2f6; margin-bottom: 4px;">${title}</div>
          ${dateStr ? `<div style="font-size: 13px; color: #9ba8b4; margin-bottom: 14px;">${dateStr}</div>` : `<div style="margin-bottom:14px"></div>`}
          ${f.play_count > 0 ? `<div style="font-size: 22px; font-weight: 900; color: #f0f2f6;">${f.play_count}<span style="font-size:11px;color:#9ba8b4;font-weight:600;margin-left:6px;text-transform:uppercase;letter-spacing:0.5px;">Plays Tagged</span></div>` : ""}
        </div>`;
      })();

  const html = `
    <div style="font-family: -apple-system, 'Segoe UI', Arial, sans-serif; background: #0a0c12; padding: 0; margin: 0;">
      <div style="max-width: 560px; margin: 0 auto; padding: 40px 24px;">
        <div style="margin-bottom: 32px;">
          <span style="font-size: 18px; font-weight: 900; color: #4FABFF; letter-spacing: -0.5px;">Check<span style="color: #ffffff;">Peak</span></span>
        </div>
        <h1 style="margin: 0 0 8px; font-size: 26px; font-weight: 800; color: #f0f2f6; line-height: 1.2;">Film Exchange Request</h1>
        <p style="margin: 0 0 28px; font-size: 16px; color: #9ba8b4; line-height: 1.5;">
          <strong style="color: #f0f2f6;">${fromOrgName}</strong> wants to exchange ${isMulti ? `${films.length} game films` : "game film"} with you.
        </p>
        ${filmListHtml}
        ${message ? `
        <div style="background: rgba(79,171,255,0.07); border-left: 3px solid #4FABFF; border-radius: 0 10px 10px 0; padding: 14px 18px; margin-bottom: 28px;">
          <div style="font-size: 11px; font-weight: 700; color: #4FABFF; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 6px;">Message from ${fromOrgName}</div>
          <div style="font-size: 14px; color: #d0d8e4; line-height: 1.6; font-style: italic;">"${message}"</div>
        </div>` : `<div style="margin-bottom: 28px;"></div>`}
        <a href="${primaryExchangeUrl}" style="display: block; background: #4FABFF; color: #0a0c12; text-decoration: none; text-align: center; font-size: 15px; font-weight: 800; padding: 16px 24px; border-radius: 12px; margin-bottom: 16px;">
          View ${isMulti ? "Films" : "Film"} &amp; Complete Exchange →
        </a>
        <p style="margin: 0 0 40px; font-size: 12px; color: #5a6a7d; text-align: center;">
          Or copy this link: <a href="${primaryExchangeUrl}" style="color: #4FABFF;">${primaryExchangeUrl}</a>
        </p>
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
    text:    `${fromOrgName} wants to exchange ${isMulti ? `${films.length} game films` : "film"} with you.\n\nView and respond: ${primaryExchangeUrl}`,
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
  const { filmId, filmIds, receivingEmail, message, sharePlays } = req.body ?? {};

  // Accept either a single filmId or an array of filmIds
  const ids = Array.isArray(filmIds) && filmIds.length ? filmIds
    : filmId ? [filmId]
    : [];
  if (!ids.length) return res.status(400).json({ error: "filmId or filmIds required" });
  if (ids.length > 10) return res.status(400).json({ error: "Too many films selected (max 10)" });
  if (!receivingEmail || !receivingEmail.includes("@"))
    return res.status(400).json({ error: "Valid receivingEmail required" });

  const cleanEmail = String(receivingEmail).trim().toLowerCase();

  // Verify all films belong to requesting org
  const { data: films, error: filmsErr } = await supabase
    .from("game_films")
    .select("id, title, game_date, opponent, org_id, play_count")
    .in("id", ids);

  if (filmsErr || !films?.length) return res.status(404).json({ error: "Films not found" });

  const badFilm = films.find(f => f.org_id !== orgId);
  if (badFilm) return res.status(403).json({ error: "One or more films not in your library" });

  // Don't allow self-exchange
  const { data: requestingOrg } = await supabase
    .from("organizations")
    .select("id, name, email")
    .eq("token", orgId)
    .maybeSingle();

  if (requestingOrg?.email?.toLowerCase() === cleanEmail)
    return res.status(400).json({ error: "You can't exchange with your own organization" });

  // Check if receiving org is in the system
  const { data: receivingOrg } = await supabase
    .from("organizations")
    .select("id, name, token")
    .eq("email", cleanEmail)
    .maybeSingle();

  // Generate a token per film and batch-insert exchange records
  const orgName = requestingOrg?.name ?? user.name ?? user.email ?? "A coach";
  const tokens  = films.map(() => crypto.randomBytes(32).toString("hex"));

  const doSharePlays = sharePlays === true; // default false — plays are private unless explicitly shared

  const records = films.map((film, i) => ({
    requesting_org_id:   orgId,
    requesting_org_name: orgName,
    requesting_film_id:  film.id,
    receiving_email:     cleanEmail,
    receiving_org_id:    receivingOrg?.token ?? null,
    message:             message?.trim() || null,
    token:               tokens[i],
    status:              "pending",
    share_plays:         doSharePlays,
  }));

  const { error: insErr } = await supabase.from("film_exchanges").insert(records);
  if (insErr) throw insErr;

  // Send ONE email covering all films
  const baseUrl            = getBaseUrl();
  const primaryExchangeUrl = `${getBaseUrl()}/film-exchange/${tokens[0]}`;

  try {
    await sendExchangeEmail({
      to:                cleanEmail,
      fromOrgName:       orgName,
      films,
      message:           message?.trim() || null,
      primaryExchangeUrl,
    });
  } catch (emailErr) {
    console.error("[film/exchange] email failed (non-fatal):", emailErr);
  }

  return res.status(200).json({
    ok:               true,
    exchangeCount:    films.length,
    receivingOrgName: receivingOrg?.name ?? null,
    inSystem:         !!receivingOrg,
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
