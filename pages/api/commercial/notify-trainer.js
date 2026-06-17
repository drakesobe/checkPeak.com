// pages/api/commercial/notify-trainer.js
// Sends the trainer an email when a new client subscribes.
// Only fires when notifyOnSubscribe is true on the trainer record.

import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const { trainerEmail, trainerName, clientName, clientEmail, tier, dashboardUrl } = req.body;
  if (!trainerEmail || !clientEmail || !tier) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  const TIER_STYLE = {
    Basic:   { color: "#1A7F4B", label: "Basic"   },
    Premium: { color: "#B86000", label: "Premium" },
    Ultra:   { color: "#0066FF", label: "Ultra"   },
  };
  const ts  = TIER_STYLE[tier] ?? TIER_STYLE.Basic;
  const url = dashboardUrl ?? "https://checkpeak.com/commercial/dashboard";

  try {
    await resend.emails.send({
      from:    `CheckPeak <noreply@${process.env.RESEND_FROM_DOMAIN ?? "checkpeak.com"}>`,
      to:      trainerEmail,
      subject: `New ${tier} subscriber - ${clientName || clientEmail}`,
      html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#F2F2EF;font-family:'DM Sans',Helvetica,Arial,sans-serif;">
  <div style="max-width:480px;margin:40px auto;padding:0 16px;">

    <div style="text-align:center;margin-bottom:28px;">
      <p style="font-size:20px;font-weight:800;letter-spacing:-0.02em;color:#0066FF;margin:0;">CheckPeak</p>
    </div>

    <div style="background:#fff;border-radius:16px;overflow:hidden;border:1px solid #E2E2E2;">
      <div style="background:#0066FF;padding:22px 28px;">
        <p style="color:#fff;font-size:20px;font-weight:800;margin:0;letter-spacing:-0.01em;">
          New subscriber 🎉
        </p>
        <p style="color:rgba(255,255,255,0.8);font-size:13px;margin:6px 0 0;">
          Someone just joined your library
        </p>
      </div>

      <div style="padding:28px;">
        <div style="background:#F7F7F5;border-radius:10px;padding:18px;margin-bottom:24px;">
          <p style="margin:0 0 10px;font-size:13px;color:#6B6B6B;font-weight:600;text-transform:uppercase;letter-spacing:0.07em;">Subscriber</p>
          <p style="margin:0 0 4px;font-size:16px;font-weight:800;color:#1A1A1A;">${clientName || "(no name)"}</p>
          <p style="margin:0 0 12px;font-size:13px;color:#6B6B6B;">${clientEmail}</p>
          <span style="display:inline-block;padding:4px 10px;border-radius:6px;font-size:11px;font-weight:800;
            background:${ts.color}18;color:${ts.color};">
            ${ts.label} plan
          </span>
        </div>

        <div style="text-align:center;">
          <a href="${url}" style="display:inline-block;padding:12px 28px;background:#0066FF;color:#fff;
            text-decoration:none;border-radius:8px;font-size:14px;font-weight:700;">
            View in dashboard →
          </a>
        </div>
      </div>

      <div style="border-top:1px solid #E2E2E2;padding:16px 28px;background:#F7F7F5;">
        <p style="color:#6B6B6B;font-size:11px;margin:0;text-align:center;">
          You're receiving this because you have new subscriber notifications enabled.<br>
          Turn them off in your <a href="${url}#settings" style="color:#0066FF;">commercial settings</a>.
        </p>
      </div>
    </div>
  </div>
</body>
</html>`,
    });

    return res.status(200).json({ sent: true });
  } catch (err) {
    console.error("[notify-trainer]", err);
    return res.status(200).json({ sent: false, error: err.message });
  }
}
