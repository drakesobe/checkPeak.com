import { AirtableConnect } from '@theo-dev/airtable-connect';
import nodemailer from 'nodemailer';

const airtable = new AirtableConnect({
  apiKey: process.env.AIRTABLE_API_KEY,
  baseId: process.env.AIRTABLE_BASE_ID,
});

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { athleteId } = req.body;
  if (!athleteId) return res.status(400).json({ error: 'Athlete ID required' });

  // generate random token
  const token = Math.random().toString(36).substr(2, 10);

  // update athlete with token
  const updatedAthlete = await airtable.update('Athletes', athleteId, { 'Invite Token': token });

  const inviteLink = `${process.env.NEXT_PUBLIC_BASE_URL}/athlete-signup/${token}`;

  // Send email if athlete email exists
  const athleteEmail = updatedAthlete.fields.Email;
  if (athleteEmail) {
    try {
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: process.env.SMTP_PORT,
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });

      await transporter.sendMail({
        from: `"PEAK Dashboard" <${process.env.SMTP_USER}>`,
        to: athleteEmail,
        subject: 'You’re invited to join PEAK',
        html: `
          <p>Hi ${updatedAthlete.fields.Name || 'Athlete'},</p>
          <p>You’ve been invited to join your organization’s PEAK account.</p>
          <p>Click the link below to sign up:</p>
          <a href="${inviteLink}" style="color: #1d4ed8;">${inviteLink}</a>
          <p>— The PEAK Team</p>
        `,
      });
    } catch (err) {
      console.error('Email send failed', err);
      return res.status(500).json({ error: 'Failed to send invite email' });
    }
  }

  res.status(200).json({ token, link: inviteLink });
}
