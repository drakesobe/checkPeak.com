// pages/api/notifications/save-token.js
// Saves an Expo push token to the athlete's Airtable record
// POST /api/notifications/save-token { athleteId, token }

import Airtable from 'airtable';

const base = new Airtable({ apiKey: process.env.ATHLETE_API_KEY }).base(
  process.env.ATHLETE_BASE_ID
);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { athleteId, token } = req.body;

  if (!athleteId || !token) {
    return res.status(400).json({ error: 'athleteId and token are required' });
  }

  try {
    await base(process.env.ATHLETE_TABLE_NAME).update([{
      id:     athleteId,
      fields: { PushToken: token },
    }]);

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('[save-token] Error:', err);
    return res.status(500).json({ error: 'Failed to save push token' });
  }
}