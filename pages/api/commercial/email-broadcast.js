// pages/api/commercial/email-broadcast.js
// Sends a broadcast email to all (or a tier-filtered subset of) active subscribers.
import { Resend } from "resend";
import { getRequestUser } from "@/lib/commercial/getRequestUser";
import {
  getTrainerByUserId,
  getSubscriptionsByTrainer,
} from "@/lib/commercial/airtable";

const resend = new Resend(process.env.RESEND_API_KEY);

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function buildHtml(trainerName, trainerSlug, subject, body) {
  const site    = process.env.NEXT_PUBLIC_SITE_URL || "https://checkpeak.com";
  const bodyHtml = body.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<br>");
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,sans-serif">
  <div style="max-width:580px;margin:32px auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.08)">
    <div style="background:#0057FF;padding:24px 32px">
      <p style="color:rgba(255,255,255,0.7);font-size:11px;font-weight:800;letter-spacing:0.1em;text-transform:uppercase;margin:0 0 4px">Message from your coach</p>
      <p style="color:#fff;font-size:22px;font-weight:900;margin:0;letter-spacing:-0.02em">${trainerName}</p>
    </div>
    <div style="padding:32px">
      <h2 style="font-size:19px;font-weight:800;color:#0f0f0f;margin:0 0 18px;letter-spacing:-0.01em">${subject}</h2>
      <div style="font-size:14px;line-height:1.75;color:#444">${bodyHtml}</div>
      <div style="margin-top:32px">
        <a href="${site}/trainer/${trainerSlug}/library"
          style="display:inline-block;background:#0057FF;color:#fff;padding:11px 22px;border-radius:6px;font-weight:700;font-size:13px;text-decoration:none;letter-spacing:-0.01em">
          Open library →
        </a>
      </div>
    </div>
    <div style="background:#fafafa;padding:16px 32px;border-top:1px solid #eee">
      <p style="font-size:11px;color:#aaa;margin:0;line-height:1.6">
        You're receiving this because you subscribed to ${trainerName} on
        <a href="${site}" style="color:#0057FF;text-decoration:none">CheckPeak</a>.
        <br><a href="${site}/trainer/${trainerSlug}" style="color:#0057FF">View profile</a>
      </p>
    </div>
  </div>
</body>
</html>`;
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).end();

  const user = getRequestUser(req);
  if (!user) return res.status(401).json({ error: "Unauthorized" });

  const trainer = await getTrainerByUserId(user.email || user.Email);
  if (!trainer) return res.status(404).json({ error: "No trainer profile" });

  const { subject, body, tierFilter } = req.body ?? {};
  if (!subject?.trim()) return res.status(400).json({ error: "Subject is required." });
  if (!body?.trim())    return res.status(400).json({ error: "Message body is required." });

  const f = trainer.fields ?? {};
  const trainerName = f.name  || "Your Coach";
  const trainerSlug = f.slug  || "";
  const fromDomain  = process.env.RESEND_FROM_DOMAIN || "checkpeak.com";

  const subscriptions = await getSubscriptionsByTrainer(trainer.id);
  let targets = subscriptions.filter(s => s.fields?.status === "active");

  if (tierFilter && tierFilter !== "all") {
    targets = targets.filter(s => s.fields?.tier === tierFilter);
  }

  const emails = [...new Set(targets.map(s => s.fields?.clientEmail).filter(Boolean))];
  if (emails.length === 0) {
    return res.status(400).json({ error: "No active subscribers match this filter." });
  }

  const html = buildHtml(trainerName, trainerSlug, subject.trim(), body.trim());
  const from = `${trainerName} via CheckPeak <updates@${fromDomain}>`;

  let sent = 0;
  let failed = 0;

  for (const batch of chunk(emails, 100)) {
    try {
      await resend.batch.send(
        batch.map(to => ({ from, to, subject: subject.trim(), html }))
      );
      sent += batch.length;
    } catch (err) {
      console.error("[email-broadcast] batch error:", err.message);
      failed += batch.length;
    }
  }

  console.log(`[email-broadcast] trainer=${trainer.id} sent=${sent} failed=${failed}`);
  return res.json({ ok: true, sent, failed, total: emails.length });
}
