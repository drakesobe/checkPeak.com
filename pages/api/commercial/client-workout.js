// pages/api/commercial/client-workout.js
// Creates a workout and assigns it to a commercial client (looked up by email).
// POST { clientEmail, title, date, items, scheduledTime?, _authUser }

import { createClient } from '@supabase/supabase-js';
import { getRequestUser }    from '@/lib/commercial/getRequestUser';
import { getTrainerByUserId } from '@/lib/commercial/db';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function trim(v) { return String(v ?? '').trim(); }
function numOrNull(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  if (req.method !== 'POST') return res.status(405).end();

  const user = getRequestUser(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  const trainer = await getTrainerByUserId(user.email || user.Email);
  if (!trainer) return res.status(403).json({ error: 'No trainer profile' });

  const { clientEmail, title, date, items, scheduledTime } = req.body ?? {};
  if (!trim(clientEmail)) return res.status(400).json({ error: 'clientEmail required' });
  if (!trim(title))       return res.status(400).json({ error: 'title required' });
  if (!trim(date))        return res.status(400).json({ error: 'date required' });

  // Resolve orgToken from the auth user — stored as Token or orgToken
  const orgToken = trim(user.orgToken || user.Token || user.token || '').toUpperCase();
  if (!orgToken) return res.status(400).json({ error: 'Org token missing from session' });

  try {
    // 1. Look up the athlete record for this client
    const { data: athlete, error: athErr } = await supabase
      .from('athletes')
      .select('id, athlete_token, name, email')
      .eq('email', trim(clientEmail).toLowerCase())
      .eq('org_token', orgToken)
      .maybeSingle();

    if (athErr) throw athErr;
    if (!athlete) {
      return res.status(404).json({
        error: 'Client not found in your org — they may not have logged in yet.',
        clientEmail,
      });
    }

    // 2. Create daily_workout
    const { data: dw, error: dwErr } = await supabase
      .from('daily_workouts')
      .insert({
        athlete_id:     athlete.id,
        title:          trim(title),
        date:           trim(date).slice(0, 10),
        status:         'assigned',
        scheduled_time: trim(scheduledTime) || null,
      })
      .select('id')
      .single();

    if (dwErr) throw dwErr;

    // 3. Create workout items
    const meaningful = (Array.isArray(items) ? items : [])
      .filter(it => trim(it?.ExerciseName || ''))
      .map((it, i) => ({
        daily_workout_id:  dw.id,
        sort_order:        Number(it.Order ?? i + 1),
        exercise_name:     trim(it.ExerciseName),
        sets:              numOrNull(it.Sets),
        reps:              trim(it.Reps)         || null,
        weight:            trim(it.Weight)       || null,
        rest:              trim(it.Rest)         || null,
        instructions:      trim(it.Instructions) || null,
        video_url:         trim(it.VideoURL)     || null,
        evidence_required: null,
      }));

    if (meaningful.length) {
      const { error: itemErr } = await supabase.from('workout_items').insert(meaningful);
      if (itemErr) console.error('[client-workout] items insert:', itemErr.message);
    }

    return res.status(200).json({
      ok:             true,
      dailyWorkoutId: dw.id,
      itemCount:      meaningful.length,
    });
  } catch (e) {
    console.error('[client-workout]', e);
    return res.status(500).json({ error: e?.message || 'Failed to create workout' });
  }
}
