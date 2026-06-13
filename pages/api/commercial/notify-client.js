// pages/api/commercial/notify-client.js
// Sends the client their access email when a trainer adds them.
// Uses Resend - run: npm install resend
// Add RESEND_API_KEY to Vercel env vars.
// Set your from-domain in Resend dashboard → Domains.

import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

const TIER_PERKS = {
  Basic:   ["Full video library access", "Filter by workout type, muscle group & difficulty"],
  Premium: ["Everything in Basic", "Custom workouts built by your trainer"],
  Ultra:   ["Everything in Premium", "In-person training sessions"],
};

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const { clientEmail, clientName, trainerName, trainerSlug, tier, welcomeMessage } = req.body;
  if (!clientEmail || !trainerName || !trainerSlug || !tier) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  const siteUrl    = process.env.NEXT_PUBLIC_SITE_URL ?? "https://checkpeak.com";
  const libraryUrl = `${siteUrl}/trainer/${trainerSlug}/library`;
  const loginUrl   = `${siteUrl}/login?next=/trainer/${trainerSlug}/library`;
  const perks      = TIER_PERKS[tier] ?? TIER_PERKS.Basic;

  try {
    await resend.emails.send({
      from:    `CheckPeak <noreply@${process.env.RESEND_FROM_DOMAIN ?? "checkpeak.com"}>`,
      to:      clientEmail,
      subject: `${trainerName} added you to CheckPeak`,
      html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background:#F2F2EF;font-family:'DM Sans',Helvetica,Arial,sans-serif;">
  <div style="max-width:560px;margin:40px auto;padding:0 16px;">

    <!-- Header -->
    <div style="text-align:center;margin-bottom:32px;">
      <p style="font-size:20px;font-weight:800;letter-spacing:-0.02em;color:#0066FF;margin:0;">
        CheckPeak
      </p>
    </div>

    <!-- Card -->
    <div style="background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #E2E2E2;">

      <!-- Top bar -->
      <div style="background:#0066FF;padding:24px 32px;">
        <p style="color:#ffffff;font-size:22px;font-weight:800;margin:0;letter-spacing:-0.02em;">
          You've been added by ${trainerName}
        </p>
        <p style="color:rgba(255,255,255,0.8);font-size:14px;margin:8px 0 0;">
          Your ${tier} plan is active and ready to use.
        </p>
      </div>

      <!-- Body -->
      <div style="padding:32px;">
        <p style="color:#1A1A1A;font-size:15px;line-height:1.6;margin:0 0 24px;">
          Hi${clientName ? ` ${clientName}` : ""},
        </p>
        <p style="color:#1A1A1A;font-size:15px;line-height:1.6;margin:0 0 24px;">
          <strong>${trainerName}</strong> has added you to their CheckPeak library on the
          <strong>${tier}</strong> plan. Here's what you have access to:
        </p>

        ${welcomeMessage ? `
        <!-- Trainer welcome message -->
        <div style="background:#EEF4FF;border-left:3px solid #0066FF;border-radius:0 8px 8px 0;padding:14px 18px;margin-bottom:24px;">
          <p style="color:#0066FF;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;margin:0 0 6px;">From ${trainerName}</p>
          <p style="color:#1A1A1A;font-size:14px;line-height:1.6;margin:0;white-space:pre-line;">${welcomeMessage}</p>
        </div>` : ""}

        <!-- Perks list -->
        <div style="background:#F7F7F5;border-radius:10px;padding:20px;margin-bottom:28px;">
          ${perks.map(p => `
          <div style="display:flex;gap:10px;align-items:flex-start;margin-bottom:10px;">
            <span style="color:#1A7F4B;font-size:16px;line-height:1.2;">✓</span>
            <span style="color:#1A1A1A;font-size:14px;line-height:1.5;">${p}</span>
          </div>`).join("")}
        </div>

        <!-- CTA -->
        <div style="text-align:center;margin-bottom:24px;">
          <a href="${loginUrl}"
            style="display:inline-block;padding:14px 32px;background:#0066FF;color:#ffffff;
            text-decoration:none;border-radius:8px;font-size:15px;font-weight:700;">
            Access my library →
          </a>
        </div>

        <p style="color:#6B6B6B;font-size:13px;line-height:1.6;margin:0;text-align:center;">
          You'll be asked to log in or create a free CheckPeak account.<br>
          Use this email address (<strong>${clientEmail}</strong>) to sign in.
        </p>
      </div>

      <!-- Footer -->
      <div style="border-top:1px solid #E2E2E2;padding:20px 32px;background:#F7F7F5;">
        <p style="color:#6B6B6B;font-size:12px;margin:0;text-align:center;">
          Your library: <a href="${libraryUrl}" style="color:#0066FF;">${libraryUrl}</a>
        </p>
      </div>
    </div>

    <p style="color:#6B6B6B;font-size:12px;text-align:center;margin-top:24px;">
      CheckPeak Commercial · Sent by ${trainerName}
    </p>
  </div>
</body>
</html>`,
    });

    return res.status(200).json({ sent: true });
  } catch (err) {
    console.error("[notify-client]", err);
    // Don't fail the client-add if email fails - just log it.
    return res.status(200).json({ sent: false, error: err.message });
  }
}