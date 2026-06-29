// pages/api/walkthrough-request.js
// Saves walkthrough request to Firestore and emails Matthew@checkpeak.com

import { Resend } from "resend";
import { db } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM   = `CheckPeak <noreply@${process.env.RESEND_FROM_DOMAIN ?? "checkpeak.com"}>`;
const TO     = "Matthew@checkpeak.com";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const { name, email, organization, role, athletes, message } = req.body || {};
  if (!name || !email || !organization || !role) {
    return res.status(400).json({ error: "Missing required fields." });
  }

  try {
    // 1. Save to Firestore
    await addDoc(collection(db, "walkthrough_requests"), {
      name, email, organization, role,
      athletes: athletes || "",
      message:  message  || "",
      status:   "pending",
      createdAt: serverTimestamp(),
    });

    // 2. Notify Matthew
    await resend.emails.send({
      from:    FROM,
      to:      TO,
      subject: `New walkthrough request — ${name} · ${organization}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head><meta charset="utf-8"></head>
        <body style="margin:0;padding:0;background:#060810;font-family:'Helvetica Neue',Arial,sans-serif;">
          <div style="max-width:560px;margin:0 auto;padding:40px 24px;">

            <!-- Header -->
            <div style="border-bottom:3px solid #4FABFF;padding-bottom:20px;margin-bottom:28px;">
              <p style="margin:0 0 4px;font-size:11px;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;color:#4FABFF;">
                CheckPeak
              </p>
              <h1 style="margin:0;font-size:26px;font-weight:900;color:#ffffff;line-height:1.1;">
                New Walkthrough Request
              </h1>
            </div>

            <!-- Fields -->
            <table style="width:100%;border-collapse:collapse;">
              ${[
                ["Name",         name],
                ["Email",        `<a href="mailto:${email}" style="color:#4FABFF;text-decoration:none;">${email}</a>`],
                ["Organization", organization],
                ["Role",         role],
                ["Athletes",     athletes || "—"],
              ].map(([label, value]) => `
                <tr>
                  <td style="padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.07);vertical-align:top;width:130px;">
                    <span style="font-size:11px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:rgba(255,255,255,0.45);">${label}</span>
                  </td>
                  <td style="padding:10px 0 10px 16px;border-bottom:1px solid rgba(255,255,255,0.07);font-size:15px;color:#ffffff;">
                    ${value}
                  </td>
                </tr>
              `).join("")}
            </table>

            ${message ? `
            <!-- Message -->
            <div style="margin-top:24px;padding:16px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.1);border-left:3px solid #4FABFF;">
              <p style="margin:0 0 6px;font-size:11px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:rgba(255,255,255,0.45);">
                Their message
              </p>
              <p style="margin:0;font-size:15px;line-height:1.65;color:rgba(255,255,255,0.82);">
                ${message.replace(/\n/g, "<br>")}
              </p>
            </div>
            ` : ""}

            <!-- CTA -->
            <div style="margin-top:32px;text-align:center;">
              <a href="mailto:${email}?subject=Your%20CheckPeak%20walkthrough&body=Hi%20${encodeURIComponent(name)}%2C%0A%0AThanks%20for%20reaching%20out%20about%20CheckPeak!%20I%27d%20love%20to%20set%20up%20a%20time%20that%20works%20for%20you.%0A%0AHere%20is%20a%20Google%20Meet%20link%3A%20%5Badd%20link%5D%0A%0AWhat%20times%20work%20best%20for%20you%3F%0A%0A%E2%80%94%20Matthew"
                style="display:inline-block;padding:12px 28px;background:#4FABFF;color:#060810;font-size:13px;font-weight:900;letter-spacing:0.1em;text-transform:uppercase;text-decoration:none;border-radius:2px;">
                Reply with Google Meet Link
              </a>
            </div>

            <!-- Footer -->
            <p style="margin:32px 0 0;font-size:11px;color:rgba(255,255,255,0.28);text-align:center;">
              Submitted via checkpeak.com/book
            </p>

          </div>
        </body>
        </html>
      `,
    });

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error("[walkthrough-request]", err);
    return res.status(500).json({ error: "Failed to submit. Please try again." });
  }
}
