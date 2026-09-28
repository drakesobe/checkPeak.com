// lib/notifyOwner.js
import { Resend } from "resend";

export const OWNER_EMAIL = "Matthew@checkpeak.com";
export const NOTIFY_FROM = `CheckPeak <noreply@${process.env.RESEND_FROM_DOMAIN ?? "checkpeak.com"}>`;

export function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

// Emails the owner a labeled summary. Never throws: a failed notification must not fail the caller.
export async function notifyOwner({ subject, heading, fields, footer = "" }) {
  if (!process.env.RESEND_API_KEY) {
    console.warn("[notifyOwner] RESEND_API_KEY not set; skipping:", subject);
    return;
  }

  const rows = Object.entries(fields)
    .filter(([, v]) => v !== undefined && v !== null && String(v).trim() !== "")
    .map(([label, value]) => `
      <tr>
        <td style="padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.07);vertical-align:top;width:130px;">
          <span style="font-size:11px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:rgba(255,255,255,0.45);">${escapeHtml(label)}</span>
        </td>
        <td style="padding:10px 0 10px 16px;border-bottom:1px solid rgba(255,255,255,0.07);font-size:15px;color:#ffffff;">${escapeHtml(value)}</td>
      </tr>`)
    .join("");

  try {
    const resend = new Resend(process.env.RESEND_API_KEY);
    await resend.emails.send({
      from: NOTIFY_FROM,
      to: OWNER_EMAIL,
      subject,
      html: `
        <!DOCTYPE html>
        <html><head><meta charset="utf-8"></head>
        <body style="margin:0;padding:0;background:#060810;font-family:'Helvetica Neue',Arial,sans-serif;">
          <div style="max-width:560px;margin:0 auto;padding:40px 24px;">
            <div style="border-bottom:3px solid #4FABFF;padding-bottom:20px;margin-bottom:28px;">
              <p style="margin:0 0 4px;font-size:11px;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;color:#4FABFF;">CheckPeak</p>
              <h1 style="margin:0;font-size:26px;font-weight:900;color:#ffffff;line-height:1.1;">${escapeHtml(heading)}</h1>
            </div>
            <table style="width:100%;border-collapse:collapse;">${rows}</table>
            ${footer ? `<p style="margin:32px 0 0;font-size:11px;color:rgba(255,255,255,0.28);text-align:center;">${escapeHtml(footer)}</p>` : ""}
          </div>
        </body></html>`,
    });
  } catch (err) {
    console.error("[notifyOwner] send failed:", err);
  }
}
