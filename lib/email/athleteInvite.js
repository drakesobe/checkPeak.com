// lib/email/athleteInvite.js
// "Your coach added you to <program>" email for athletes added to a roster before they have an
// account (CSV import). They finish by downloading the app and signing up with the same email and
// the team code, which links them to the roster row (see /api/athlete-signup).

import { Resend } from "resend";
import { escapeHtml, NOTIFY_FROM } from "@/lib/notifyOwner";

export const APP_STORE_URL = "https://apps.apple.com/us/app/checkpeak/id6769081617";
const BATCH = 100; // Resend batch limit

export function buildAthleteInvite({ athleteName, orgName, coachName, teamCode, email }) {
  const first = String(athleteName || "").trim().split(/\s+/)[0] || "there";
  const program = String(orgName || "your program").trim();
  const coach = String(coachName || "").trim();
  const addedBy = coach ? `${coach} added you to ${program}` : `You've been added to ${program}`;
  const subject = `${addedBy} on CheckPeak`;

  const text = [
    `Hi ${first},`,
    "",
    `${addedBy} on CheckPeak, where your team's workouts, nutrition and supplement checks live.`,
    "",
    "To get set up:",
    `1. Download the CheckPeak app: ${APP_STORE_URL}`,
    `2. Tap Create account and sign up with this email: ${email}`,
    `3. Enter your team code: ${teamCode}`,
    "",
    "You'll see today's workouts as soon as you're in.",
    "",
    "Didn't expect this? You can ignore this email.",
  ].join("\n");

  const e = escapeHtml;
  const step = (n, body) => `
    <tr>
      <td style="width:32px;vertical-align:top;padding:0 0 16px;">
        <div style="width:24px;height:24px;border-radius:12px;background:#1E3A5F;color:#fff;font-size:12px;font-weight:700;line-height:24px;text-align:center;">${n}</div>
      </td>
      <td style="vertical-align:top;padding:2px 0 16px;font-size:15px;line-height:1.5;color:#334155;">${body}</td>
    </tr>`;

  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#F7F8FA;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <div style="max-width:520px;margin:0 auto;padding:32px 16px;">
    <div style="background:#fff;border:1px solid #E5E7EB;border-radius:12px;padding:28px 24px;">
      <p style="margin:0 0 16px;font-size:12px;font-weight:800;letter-spacing:0.14em;text-transform:uppercase;color:#1E3A5F;">CheckPeak</p>
      <h1 style="margin:0 0 8px;font-size:22px;line-height:1.25;color:#0F172A;">${e(addedBy)}</h1>
      <p style="margin:0 0 24px;font-size:15px;line-height:1.5;color:#64748B;">Hi ${e(first)}, your team's workouts, nutrition and supplement checks are on CheckPeak. Setup takes about a minute.</p>
      <table role="presentation" style="width:100%;border-collapse:collapse;">
        ${step(1, `Download the CheckPeak app.<br><a href="${APP_STORE_URL}" style="display:inline-block;margin-top:10px;background:#1E3A5F;color:#fff;text-decoration:none;font-weight:600;font-size:14px;padding:10px 16px;border-radius:8px;">Get the app</a>`)}
        ${step(2, `Tap <strong>Create account</strong> and use this email:<br><strong style="color:#0F172A;">${e(email)}</strong>`)}
        ${step(3, `Enter your team code:<br><span style="display:inline-block;margin-top:8px;font-family:ui-monospace,Menlo,Consolas,monospace;font-size:18px;font-weight:700;letter-spacing:0.06em;color:#0F172A;background:#F7F8FA;border:1px dashed #CBD5E1;border-radius:8px;padding:8px 12px;">${e(teamCode)}</span>`)}
      </table>
      <p style="margin:8px 0 0;font-size:14px;color:#64748B;">You'll see today's workouts as soon as you're in.</p>
    </div>
    <p style="margin:16px 0 0;font-size:12px;line-height:1.5;color:#94A3B8;text-align:center;">Didn't expect this? You can ignore this email.</p>
  </div>
</body></html>`;

  return { subject, text, html };
}

// Sends invites; never throws. Returns { sent, failed, skipped } (skipped when email isn't configured).
export async function sendAthleteInvites({ athletes, orgName, coachName, teamCode, replyTo }) {
  const list = (athletes || []).filter((a) => a?.email);
  if (!list.length) return { sent: 0, failed: 0, skipped: 0 };
  if (!process.env.RESEND_API_KEY) {
    console.warn("[athleteInvite] RESEND_API_KEY not set; invites not sent");
    return { sent: 0, failed: 0, skipped: list.length };
  }

  const resend = new Resend(process.env.RESEND_API_KEY);
  let sent = 0, failed = 0;
  for (let i = 0; i < list.length; i += BATCH) {
    const batch = list.slice(i, i + BATCH).map((a) => ({
      from: NOTIFY_FROM,
      to: a.email,
      ...(replyTo ? { replyTo } : {}),
      ...buildAthleteInvite({ athleteName: a.name, orgName, coachName, teamCode, email: a.email }),
    }));
    try {
      const { error } = await resend.batch.send(batch);
      if (error) throw new Error(error.message || String(error));
      sent += batch.length;
    } catch (err) {
      console.error("[athleteInvite] batch failed:", err?.message || err);
      failed += batch.length;
    }
  }
  return { sent, failed, skipped: 0 };
}
