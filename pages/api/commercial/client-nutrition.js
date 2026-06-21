// pages/api/commercial/client-nutrition.js
// Assigns a nutrition plan to a commercial client (looked up by email).
// Archives any existing active plans first.
// POST { clientEmail, phase, calories, protein, carbs, fat, hydration, notes, _authUser }

import { createClient } from '@supabase/supabase-js';
import { getRequestUser }    from '@/lib/commercial/getRequestUser';
import { getTrainerByUserId } from '@/lib/commercial/db';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const PHASE_MAP = {
  maintain:    'Maintain',
  surplus:     'Surplus',
  cut:         'Cut',
  'game week': 'Game Week',
  'bye week':  'Bye Week',
};
function normalizePhase(raw) {
  return PHASE_MAP[String(raw || '').toLowerCase().trim()] || 'Maintain';
}
function trim(v)    { return String(v ?? '').trim(); }
function numStr(v)  { return String(Number(v) || 0); }

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  if (req.method !== 'POST') return res.status(405).end();

  const user = getRequestUser(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  const trainer = await getTrainerByUserId(user.email || user.Email);
  if (!trainer) return res.status(403).json({ error: 'No trainer profile' });

  const { clientEmail, phase, calories, protein, carbs, fat, hydration, notes } = req.body ?? {};
  if (!trim(clientEmail)) return res.status(400).json({ error: 'clientEmail required' });
  if (!calories || !protein) return res.status(400).json({ error: 'calories and protein required' });

  const orgToken = trim(user.orgToken || user.Token || user.token || '').toUpperCase();
  if (!orgToken) return res.status(400).json({ error: 'Org token missing from session' });

  try {
    // 1. Look up athlete
    const { data: athlete, error: athErr } = await supabase
      .from('athletes')
      .select('id, athlete_token, name')
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

    // 2. Archive existing active plans
    const { data: existing } = await supabase
      .from('nutrition_plans')
      .select('id')
      .eq('athlete_token', athlete.athlete_token)
      .eq('status', 'active');

    if (existing?.length) {
      await supabase
        .from('nutrition_plans')
        .update({ status: 'archived', archived_at: new Date().toISOString() })
        .in('id', existing.map(p => p.id));
    }

    // 3. Create new active plan
    const trainerName = trim(trainer.fields?.name || user.email || user.Email || '');
    const { data: plan, error: planErr } = await supabase
      .from('nutrition_plans')
      .insert({
        athlete_token:   athlete.athlete_token,
        athlete_id:      athlete.id,
        org_token:       orgToken,
        status:          'active',
        phase:           normalizePhase(phase),
        daily_calories:  numStr(calories),
        daily_protein:   numStr(protein),
        daily_carbs:     numStr(carbs),
        daily_fat:       numStr(fat),
        daily_hydration: numStr(hydration),
        prescription:    trim(notes),
        created_by:      trainerName,
        created_at:      new Date().toISOString(),
        updated_at:      new Date().toISOString(),
      })
      .select('id')
      .single();

    if (planErr) throw planErr;

    return res.status(200).json({
      ok:            true,
      planId:        plan.id,
      archivedCount: existing?.length || 0,
      phase:         normalizePhase(phase),
    });
  } catch (e) {
    console.error('[client-nutrition]', e);
    return res.status(500).json({ error: e?.message || 'Failed to assign plan' });
  }
}
