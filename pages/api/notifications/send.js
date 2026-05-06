// pages/api/notifications/send.js
// Sends push notifications to one or more athletes via Expo Push API
//
// POST /api/notifications/send
// Body: {
//   athleteIds: string[]   - Airtable record IDs
//   title:      string
//   body:       string
//   data?:      object     - extra data for tap navigation
//   type:       string     - 'workout_assigned' | 'meal_assigned' | 'new_message' | 'class_scheduled'
// }

import Airtable from 'airtable';

const base = new Airtable({ apiKey: process.env.ATHLETE_API_KEY }).base(
  process.env.ATHLETE_BASE_ID
);

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { athleteIds, title, body, data = {}, type = '' } = req.body;

  if (!athleteIds?.length || !title || !body) {
    return res.status(400).json({ error: 'athleteIds, title, and body are required' });
  }

  try {
    // Fetch push tokens for all athletes
    const records = await base(process.env.ATHLETE_TABLE_NAME)
      .select({
        filterByFormula: `OR(${athleteIds.map(id => `RECORD_ID()='${id}'`).join(',')})`,
        fields:          ['PushToken'],
      })
      .all();

    const tokens = records
      .map(r => String(r.fields.PushToken || '').trim())
      .filter(t => t.startsWith('ExponentPushToken'));

    if (!tokens.length) {
      return res.status(200).json({ ok: true, sent: 0, message: 'No valid push tokens found' });
    }

    // Build messages
    const messages = tokens.map(to => ({
      to,
      title,
      body,
      data:    { ...data, type },
      sound:   'default',
      channel: type === 'new_message' ? 'messages' : 'default',
    }));

    // Send to Expo push service in chunks of 100
    const chunks = [];
    for (let i = 0; i < messages.length; i += 100) {
      chunks.push(messages.slice(i, i + 100));
    }

    let totalSent = 0;
    for (const chunk of chunks) {
      const pushRes = await fetch(EXPO_PUSH_URL, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(chunk),
      });
      const pushData = await pushRes.json();
      totalSent += chunk.length;
      console.log('[send-notification] Expo response:', pushData);
    }

    return res.status(200).json({ ok: true, sent: totalSent });
  } catch (err) {
    console.error('[send-notification] Error:', err);
    return res.status(500).json({ error: 'Failed to send notifications' });
  }
}