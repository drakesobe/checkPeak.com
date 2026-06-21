// pages/api/commercial/workout-templates.js
// GET - returns this trainer's org workout templates.
// Mobile-compatible: uses getRequestUser so _authUser query param works.
// Reads the same organizations.workout_templates JSONB that the web's
// /api/org/templates/list uses — same data, mobile-accessible auth.

import { createClient } from '@supabase/supabase-js';
import { getRequestUser } from '@/lib/commercial/getRequestUser';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function normalizeTemplate(t) {
  return {
    id:          String(t?.id          || ''),
    name:        String(t?.name        || 'Untitled'),
    category:    String(t?.category    || 'strength'),
    description: String(t?.description || ''),
    exercises:   Array.isArray(t?.exercises) ? t.exercises : [],
  };
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  if (req.method !== 'GET') return res.status(405).end();

  const user = getRequestUser(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  const orgToken = String(user.orgToken || user.Token || user.token || '').trim().toUpperCase();
  if (!orgToken) return res.status(400).json({ error: 'No org token in session' });

  try {
    const { data: org, error } = await supabase
      .from('organizations')
      .select('workout_templates')
      .eq('token', orgToken)
      .maybeSingle();

    if (error) throw error;

    let templates = org?.workout_templates ?? [];
    if (!Array.isArray(templates)) templates = [];

    return res.status(200).json({ ok: true, templates: templates.map(normalizeTemplate) });
  } catch (e) {
    console.error('[commercial/workout-templates]', e?.message || e);
    return res.status(500).json({ error: e?.message || 'Failed to load templates' });
  }
}
