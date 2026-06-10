// pages/api/generate-invite.js
import nodemailer from "nodemailer";
import { supabaseAdmin as db } from "@/lib/supabase";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const { athleteId } = req.body;
  if (!athleteId) return res.status(400).json({ error: "Athlete ID required" });

  // Generate a random invite token
  const token = Math.random().toString(36).substr(2, 10);

  try {
    // Save invite token to athlete record
    const { data: athlete, error } = await db
      .from("athletes")
      .update({ invite_token: token })
      .eq("id", athleteId)
      .select("id, name, email")
      .single();

    if (error) throw error;

    const inviteLink = `${process.env.NEXT_PUBLIC_BASE_URL}/athlete-signup/${token}`;

    // Send email if athlete has one
    if (athlete.email) {
      try {
        const transporter = nodemailer.createTransport({
          host:   process.env.SMTP_HOST,
          port:   Number(process.env.SMTP_PORT || 465),
          secure: String(process.env.SMTP_SECURE || "true") === "true",
          auth:   { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
        });

        await transporter.sendMail({
          from:    `"PEAK Dashboard" <${process.env.SMTP_USER}>`,
          to:      athlete.email,
          subject: "You're invited to join PEAK",
          html: `
            <p>Hi ${athlete.name || "Athlete"},</p>
            <p>You've been invited to join your organization's PEAK account.</p>
            <p>Click the link below to sign up:</p>
            <a href="${inviteLink}" style="color: #1d4ed8;">${inviteLink}</a>
            <p>- The PEAK Team</p>
          `,
        });
      } catch (err) {
        console.error("Email send failed", err);
        return res.status(500).json({ error: "Failed to send invite email" });
      }
    }

    return res.status(200).json({ token, link: inviteLink });
  } catch (err) {
    console.error("[generate-invite] error:", err);
    return res.status(500).json({ error: "Failed to generate invite" });
  }
}
