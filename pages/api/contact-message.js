// pages/api/contact-message.js
// Saves contact form message to Firestore and emails Matthew@checkpeak.com

import { Resend } from "resend";
import { db } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM   = `CheckPeak <noreply@${process.env.RESEND_FROM_DOMAIN ?? "checkpeak.com"}>`;
const TO     = "Matthew@checkpeak.com";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const { name, email, subject, message } = req.body || {};
  if (!name || !email || !message) {
    return res.status(400).json({ error: "Missing required fields." });
  }

  try {
    await addDoc(collection(db, "contact_messages"), {
      name, email,
      subject: subject || "",
      message,
      createdAt: serverTimestamp(),
    });

    await resend.emails.send({
      from:    FROM,
      to:      TO,
      replyTo: email,
      subject: subject ? `Contact: ${subject}` : `New message from ${name}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head><meta charset="utf-8"></head>
        <body style="margin:0;padding:0;background:#060810;font-family:'Helvetica Neue',Arial,sans-serif;">
          <div style="max-width:560px;margin:0 auto;padding:40px 24px;">

            <div style="border-bottom:3px solid #4FABFF;padding-bottom:20px;margin-bottom:28px;">
              <p style="margin:0 0 4px;font-size:11px;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;color:#4FABFF;">
                CheckPeak
              </p>
              <h1 style="margin:0;font-size:26px;font-weight:900;color:#ffffff;line-height:1.1;">
                New Contact Message
              </h1>
            </div>

            <table style="width:100%;border-collapse:collapse;">
              ${[
                ["From",    `<a href="mailto:${email}" style="color:#4FABFF;text-decoration:none;">${name} &lt;${email}&gt;</a>`],
                ["Subject", subject || "—"],
              ].map(([label, value]) => `
                <tr>
                  <td style="padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.07);vertical-align:top;width:100px;">
                    <span style="font-size:11px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:rgba(255,255,255,0.45);">${label}</span>
                  </td>
                  <td style="padding:10px 0 10px 16px;border-bottom:1px solid rgba(255,255,255,0.07);font-size:15px;color:#ffffff;">
                    ${value}
                  </td>
                </tr>
              `).join("")}
            </table>

            <div style="margin-top:24px;padding:16px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.1);border-left:3px solid #4FABFF;">
              <p style="margin:0;font-size:15px;line-height:1.65;color:rgba(255,255,255,0.82);">
                ${message.replace(/\n/g, "<br>")}
              </p>
            </div>

            <div style="margin-top:32px;text-align:center;">
              <a href="mailto:${email}"
                style="display:inline-block;padding:12px 28px;background:#4FABFF;color:#060810;font-size:13px;font-weight:900;letter-spacing:0.1em;text-transform:uppercase;text-decoration:none;border-radius:2px;">
                Reply to ${name}
              </a>
            </div>

            <p style="margin:32px 0 0;font-size:11px;color:rgba(255,255,255,0.28);text-align:center;">
              Submitted via checkpeak.com/contact
            </p>
          </div>
        </body>
        </html>
      `,
    });

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error("[contact-message]", err);
    return res.status(500).json({ error: "Failed to send. Please try again." });
  }
}
