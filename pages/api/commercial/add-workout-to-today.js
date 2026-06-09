// pages/api/commercial/add-workout-to-today.js
// Adds a published commercial workout to the athlete's Today page.

import { createClient } from '@supabase/supabase-js';
import { getRequestUser } from '@/lib/commercial/getRequestUser';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function toTrimmed(v) { return String(v ?? '').trim(); }
function toNumOrNull(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function nyDateISO() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York',
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date());
  const y = parts.find(p => p.type === 'year')?.value;
  const m = parts.find(p => p.type === 'month')?.value;
  const d = parts.find(p => p.type === 'day')?.value;
  return `${y}-${m}-${d}`;
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).end();

  // Auth — cookie session (web) or athleteToken/email from body (mobile)
  const user        = getRequestUser(req);
  const mobileToken = toTrimmed(req.body?.athleteToken ?? req.headers?.['x-athlete-token'] ?? '');

  // _authUser is a JSON string sent by the mobile app as a fallback
  let mobileUser = null;
  if (req.body?._authUser) {
    try { mobileUser = JSON.parse(decodeURIComponent(req.body._authUser)); } catch {}
  }

  if (!user && !mobileToken && !mobileUser) {
    return res.status(401).json({ ok: false, error: 'Not logged in' });
  }

  const { workoutId, date } = req.body ?? {};
  if (!workoutId) return res.status(400).json({ ok: false, error: 'Missing workoutId' });

  const targetDate = toTrimmed(date) || nyDateISO();

  // Resolve email for web session, or use token for mobile
  const email = toTrimmed(
    user?.Email || user?.email || mobileUser?.Email || mobileUser?.email || ''
  ).toLowerCase();

  if (!email && !mobileToken) {
    return res.status(400).json({ ok: false, error: 'No account identifier' });
  }

  // ── 1. Fetch commercial workout from Airtable ─────────────────────────────
  const { default: Airtable } = await import('airtable');
  const commercialBase = new Airtable({ apiKey: process.env.COMMERCIAL_TRAINERS_API_KEY })
    .base(process.env.COMMERCIAL_TRAINERS_BASE_ID);

  let workout;
  try {
    workout = await commercialBase(process.env.WORKOUT_PROGRAMS_TABLE_ID).find(workoutId);
  } catch (err) {
    console.error('[add-workout-to-today] find workout:', err?.message);
    return res.status(404).json({ ok: false, error: 'Workout not found' });
  }

  if (!workout.fields.published) {
    return res.status(403).json({ ok: false, error: 'Workout not available' });
  }

  // ── 2. Parse exercises ────────────────────────────────────────────────────
  let exercises = [];
  try { exercises = JSON.parse(workout.fields.exercises || '[]'); } catch {}

  const meaningful = exercises
    .filter(ex => toTrimmed(ex.ExerciseName))
    .map((ex, i) => ({
      exercise_name:     toTrimmed(ex.ExerciseName),
      sets:              toNumOrNull(ex.Sets),
      reps:              toTrimmed(ex.Reps) || null,
      evidence_required: 'voluntary_activity_vara',
      sort_order:        toNumOrNull(ex.Order) ?? i + 1,
    }));

  // ── 3. Look up athlete in Supabase ────────────────────────────────────────
  const query = email
    ? supabase.from('athletes').select('id, athlete_token').eq('email', email).single()
    : supabase.from('athletes').select('id, athlete_token').eq('athlete_token', mobileToken).single();

  const { data: athleteRow, error: athErr } = await query;

  if (athErr || !athleteRow) {
    console.error('[add-workout-to-today] athlete lookup:', athErr?.message, { email, mobileToken });
    return res.status(400).json({
      ok: false,
      error: "Your account isn't linked to an athlete profile.",
    });
  }

  // ── 4. Create DailyWorkout in Supabase ────────────────────────────────────
  const { data: dw, error: dwErr } = await supabase
    .from('daily_workouts')
    .insert({
      athlete_id: athleteRow.id,
      title:      String(workout.fields.title || 'Workout'),
      date:       targetDate,
      status:     'assigned',
    })
    .select('id')
    .single();

  if (dwErr || !dw) {
    console.error('[add-workout-to-today] create DailyWorkout:', dwErr?.message);
    return res.status(500).json({ ok: false, error: 'Failed to create workout record' });
  }

  // ── 5. Create WorkoutItems in Supabase ────────────────────────────────────
  if (meaningful.length > 0) {
    const items = meaningful.map(it => ({
      daily_workout_id:  dw.id,
      athlete_id:        athleteRow.id,
      exercise_name:     it.exercise_name,
      sets:              it.sets,
      reps:              it.reps,
      evidence_required: it.evidence_required,
      sort_order:        it.sort_order,
      status:            'assigned',
    }));

    const { error: itemErr } = await supabase.from('workout_items').insert(items);
    if (itemErr) console.error('[add-workout-to-today] create items:', itemErr.message);
  }

  console.log('[add-workout-to-today] success:', {
    dailyWorkoutId: dw.id, athleteId: athleteRow.id, date: targetDate, items: meaningful.length,
  });
  return res.json({ ok: true, dailyWorkoutId: dw.id, itemCount: meaningful.length });
}
