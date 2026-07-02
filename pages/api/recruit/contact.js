// pages/api/recruit/contact.js
// POST: recruiter sends inquiry to athlete via their public profile
// Athlete email is never exposed — all mail routed through CheckPeak.

import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import { ratelimiter } from "@/lib/ratelimiter";

const db     = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const resend = new Resend(process.env.RESEND_API_KEY);
const FROM   = `CheckPeak Recruiting <noreply@${process.env.RESEND_FROM_DOMAIN ?? "checkpeak.com"}>`;

export default async function handler(req, res) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (!ratelimiter(req, res, "recruit-contact")) return;

  const { token, senderName, senderEmail, senderOrg, message } = req.body || {};
  if (!token || !senderName || !senderEmail || !message) {
    return res.status(400).json({ error: "Name, email, and message are required" });
  }
  if (!senderEmail.includes("@")) return res.status(400).json({ error: "Invalid email" });
  if (message.length > 2000) return res.status(400).json({ error: "Message too long" });

  // Look up profile
  const { data: profile } = await db
    .from("athlete_profiles")
    .select("athlete_token, is_public")
    .eq("share_token", token)
    .eq("is_public", true)
    .maybeSingle();

  if (!profile) return res.status(404).json({ error: "Profile not found or not public" });

  // Athlete name + email
  const { data: athlete } = await db
    .from("athletes")
    .select("name, email")
    .eq("athlete_token", profile.athlete_token)
    .maybeSingle();

  if (!athlete?.email) return res.status(400).json({ error: "Athlete has not enabled contact" });

  const athleteFirst = (athlete.name || "Athlete").split(" ")[0];
  const orgLine      = senderOrg ? ` · ${senderOrg}` : "";
  const subject      = `Recruiting inquiry from ${senderName}${orgLine}`;

  // Store the message in DB for the athlete's inbox (fire-and-forget)
  db.from("recruit_messages").insert({
    athlete_token: profile.athlete_token,
    share_token:   token,
    sender_name:   senderName,
    sender_email:  senderEmail,
    sender_org:    senderOrg || null,
    message,
  }).then(() => {}).catch(() => {});

  // Send push notification to athlete (fire-and-forget)
  const { sendNotification } = await import("@/lib/sendNotification");
  sendNotification([profile.athlete_token], {
    title: `Recruiting inquiry from ${senderName}`,
    body: senderOrg ? `${senderOrg} · ${message.slice(0, 80)}` : message.slice(0, 100),
    data: { type: "recruiter_message", screen: "recruit-inbox" },
    type: "new_message",
  });

  try {
    await resend.emails.send({
      from:    FROM,
      to:      athlete.email,
      replyTo: senderEmail,
      subject,
      html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#060810;font-family:'Helvetica Neue',Arial,sans-serif;">
<div style="max-width:560px;margin:0 auto;padding:40px 24px;">

  <div style="margin-bottom:32px;">
    <p style="margin:0 0 6px;font-size:11px;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;color:#4FABFF;">CheckPeak</p>
    <h1 style="margin:0;font-size:28px;font-weight:900;color:#ffffff;line-height:1.1;">You have a recruiting inquiry</h1>
    <p style="margin:8px 0 0;font-size:14px;color:rgba(255,255,255,0.55);">Someone found your profile on CheckPeak and wants to connect.</p>
  </div>

  <div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.1);border-left:4px solid #4FABFF;border-radius:8px;padding:20px 24px;margin-bottom:28px;">
    <table style="width:100%;border-collapse:collapse;">
      ${[
        ["From",         `${senderName} &lt;${senderEmail}&gt;`],
        ...(senderOrg ? [["Organization", senderOrg]] : []),
      ].map(([label, value]) => `
        <tr>
          <td style="padding:8px 0;vertical-align:top;width:110px;border-bottom:1px solid rgba(255,255,255,0.06);">
            <span style="font-size:10px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:rgba(255,255,255,0.4);">${label}</span>
          </td>
          <td style="padding:8px 0 8px 16px;vertical-align:top;font-size:14px;color:#ffffff;border-bottom:1px solid rgba(255,255,255,0.06);">${value}</td>
        </tr>
      `).join("")}
    </table>

    <div style="margin-top:16px;padding-top:16px;border-top:1px solid rgba(255,255,255,0.06);">
      <p style="margin:0 0 8px;font-size:10px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:rgba(255,255,255,0.4);">Message</p>
      <p style="margin:0;font-size:15px;line-height:1.65;color:rgba(255,255,255,0.85);">${message.replace(/\n/g, "<br>")}</p>
    </div>
  </div>

  <div style="text-align:center;margin-bottom:32px;">
    <a href="mailto:${senderEmail}?subject=Re: ${encodeURIComponent(subject)}"
      style="display:inline-block;padding:14px 32px;background:#4FABFF;color:#060810;font-size:13px;font-weight:900;letter-spacing:0.06em;text-transform:uppercase;text-decoration:none;border-radius:8px;">
      Reply to ${senderName}
    </a>
  </div>

  <p style="margin:0;font-size:11px;color:rgba(255,255,255,0.25);text-align:center;line-height:1.6;">
    This message was sent via your public CheckPeak recruiting profile.<br>
    Reply directly to respond — your email address was not shared.
  </p>

</div>
</body>
</html>
      `,
    });

    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error("[recruit-contact]", e);
    return res.status(500).json({ error: "Failed to send message. Please try again." });
  }
}
