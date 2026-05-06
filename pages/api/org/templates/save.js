// pages/api/org/templates/save.js
// POST { template } — creates or updates a single template.
// If template.id exists and matches a stored template, it's updated.
// If template.id is new/missing, a new template is created.

import Airtable from "airtable";
import { requireOrgSideUser } from "@/lib/requireUser";

function getBase() {
  if (!process.env.ORGANIZATIONS_API_KEY || !process.env.ORGANIZATIONS_BASE_ID) {
    throw new Error("ORGANIZATIONS_API_KEY or ORGANIZATIONS_BASE_ID env var missing.");
  }
  return new Airtable({ apiKey: process.env.ORGANIZATIONS_API_KEY })
    .base(process.env.ORGANIZATIONS_BASE_ID);
}

function sanitizeExercise(ex, idx) {
  return {
    Order:           Number(ex?.Order ?? idx + 1),
    ExerciseName:    String(ex?.ExerciseName || "").slice(0, 200),
    Sets:            ex?.Sets != null ? Number(ex.Sets) || null : null,
    Reps:            String(ex?.Reps    || "").slice(0, 50),
    Weight:          String(ex?.Weight  || "").slice(0, 50),
    Rest:            String(ex?.Rest    || "").slice(0, 50),
    Instructions:    String(ex?.Instructions || "").slice(0, 2000),
    VideoURL:        String(ex?.VideoURL     || "").slice(0, 500),
    EvidenceRequired:String(ex?.EvidenceRequired || "none").slice(0, 50),
  };
}

function sanitizeTemplate(t, now) {
  const isNew = !t?.id;
  return {
    id:          String(t?.id || crypto.randomUUID?.() || Math.random().toString(36).slice(2)),
    name:        String(t?.name        || "Untitled").slice(0, 120),
    sport:       String(t?.sport       || "").slice(0, 40),
    category:    String(t?.category    || "strength").slice(0, 40),
    description: String(t?.description || "").slice(0, 500),
    exercises:   (Array.isArray(t?.exercises) ? t.exercises : [])
      .slice(0, 60)
      .map(sanitizeExercise),
    createdAt:   isNew ? now : String(t?.createdAt || now),
    updatedAt:   now,
  };
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const user = requireOrgSideUser(req, res);
  if (!user) return;

  const orgId = String(user?.orgId || user?.OrgId || "").trim();
  if (!orgId) return res.status(400).json({ error: "No orgId on session." });

  const { template } = req.body || {};
  if (!template || typeof template !== "object") {
    return res.status(400).json({ error: "template object required." });
  }

  const now   = new Date().toISOString();
  const clean = sanitizeTemplate(template, now);
  const table = process.env.ORGANIZATIONS_TABLE_NAME || "tblDfjURwuvxOI0Su";

  try {
    // Load existing templates
    const record  = await getBase()(table).find(orgId);
    const raw     = (record?.fields?.WorkoutTemplates || "").replace(/\\\_/g, "_");
    let templates = [];
    try { templates = JSON.parse(raw); } catch {}
    if (!Array.isArray(templates)) templates = [];

    // Upsert
    const idx = templates.findIndex(t => t.id === clean.id);
    if (idx >= 0) {
      templates[idx] = clean;
    } else {
      templates.push(clean);
    }

    // Cap at 200 templates
    if (templates.length > 200) templates = templates.slice(-200);

    await getBase()(table).update(orgId, {
      WorkoutTemplates: JSON.stringify(templates),
    });

    return res.status(200).json({ ok: true, template: clean });
  } catch (e) {
    console.error("[templates/save]", e?.message || e);
    return res.status(500).json({ error: e?.message || "Failed to save template." });
  }
}