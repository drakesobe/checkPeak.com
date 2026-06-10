// lib/supabaseOrg.js
// Supabase helpers for org/athlete data (replaces Airtable calls across the app).
// All functions return plain objects (not Supabase response wrappers) so call sites
// can destructure { data, error } in the same style as supabaseAdmin directly.

import { supabaseAdmin as db } from "@/lib/supabase";
import bcrypt from "bcryptjs";
import crypto from "crypto";

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function normalizeEmail(v) { return String(v || "").trim().toLowerCase(); }
export function normalizeToken(v) { return String(v || "").trim(); }

export function generateAthleteToken() {
  const a = crypto.randomBytes(3).toString("hex").toUpperCase();
  const b = crypto.randomBytes(3).toString("hex").toUpperCase();
  return `ATH-${a}${b}`;
}

export function generateOrgToken() {
  const a = crypto.randomBytes(3).toString("hex").toUpperCase();
  const b = crypto.randomBytes(3).toString("hex").toUpperCase();
  return `ORG-${a}-${b}`;
}

export function generateInviteToken() {
  return crypto.randomBytes(24).toString("hex");
}

export async function hashPassword(plain) {
  return bcrypt.hash(String(plain), 10);
}

export async function verifyPassword(plain, hash) {
  return bcrypt.compare(String(plain), String(hash || ""));
}

function addDays(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

// ─── Athletes ──────────────────────────────────────────────────────────────────

export async function getAthleteByEmail(email) {
  const { data, error } = await db
    .from("athletes")
    .select("*")
    .eq("email", normalizeEmail(email))
    .maybeSingle();
  return { data, error };
}

export async function getAthleteByToken(token) {
  const { data, error } = await db
    .from("athletes")
    .select("*")
    .eq("athlete_token", normalizeToken(token))
    .maybeSingle();
  return { data, error };
}

export async function getAthleteById(id) {
  const { data, error } = await db
    .from("athletes")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  return { data, error };
}

export async function getAthletesByOrgToken(orgToken) {
  const { data, error } = await db
    .from("athletes")
    .select("id, athlete_token, email, name, sport, status, created_at")
    .eq("org_token", normalizeToken(orgToken))
    .order("name");
  return { data: data ?? [], error };
}

export async function createAthlete({ name, email, password, orgToken, sport }) {
  const password_hash  = await hashPassword(password);
  const athlete_token  = generateAthleteToken();
  const emailNorm      = normalizeEmail(email);

  const { data, error } = await db
    .from("athletes")
    .insert({
      name:          String(name || "").trim(),
      email:         emailNorm,
      password_hash,
      athlete_token,
      org_token:     orgToken ? normalizeToken(orgToken) : null,
      sport:         sport ? String(sport).trim() : null,
      status:        "active",
    })
    .select("id, athlete_token, email, name, org_token, sport")
    .single();

  return { data, error, athlete_token };
}

export async function updateAthlete(id, fields) {
  const allowed = ["name", "email", "sport", "status", "org_token"];
  const update  = {};
  for (const k of allowed) {
    if (fields[k] !== undefined) update[k] = fields[k];
  }
  if (fields.password) update.password_hash = await hashPassword(fields.password);
  const { data, error } = await db
    .from("athletes")
    .update(update)
    .eq("id", id)
    .select("*")
    .single();
  return { data, error };
}

export async function deleteAthlete(id) {
  const { error } = await db.from("athletes").delete().eq("id", id);
  return { error };
}

export async function upsertAthleteByToken({ athlete_token, email, name, org_token, sport }) {
  const { data, error } = await db
    .from("athletes")
    .upsert(
      {
        athlete_token,
        ...(email     ? { email: normalizeEmail(email) } : {}),
        ...(name      ? { name }                         : {}),
        ...(org_token ? { org_token }                    : {}),
        ...(sport     ? { sport }                        : {}),
      },
      { onConflict: "athlete_token", ignoreDuplicates: false }
    )
    .select("id, athlete_token")
    .single();
  return { data, error };
}

// ─── Organizations ─────────────────────────────────────────────────────────────

export async function getOrgByToken(token) {
  const { data, error } = await db
    .from("organizations")
    .select("*")
    .eq("token", normalizeToken(token))
    .maybeSingle();
  return { data, error };
}

export async function getOrgByEmail(email) {
  const { data, error } = await db
    .from("organizations")
    .select("*")
    .eq("email", normalizeEmail(email))
    .maybeSingle();
  return { data, error };
}

export async function getOrgById(id) {
  const { data, error } = await db
    .from("organizations")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  return { data, error };
}

export async function createOrg({ name, email, password, contactName, phone, website, address, notes, type }) {
  const password_hash = await hashPassword(password);
  const token         = generateOrgToken();
  const trialEndsAt   = addDays(14);

  const { data, error } = await db
    .from("organizations")
    .insert({
      name:          String(name || "").trim(),
      email:         normalizeEmail(email),
      password_hash,
      token,
      contact_name:  contactName ? String(contactName).trim() : null,
      phone:         phone       ? String(phone).trim()       : null,
      website:       website     ? String(website).trim()     : null,
      address:       address     ? String(address).trim()     : null,
      notes:         notes       ? String(notes).trim()       : null,
      type:          type        ? String(type).trim()        : "Organization",
      trial_ends_at: trialEndsAt,
      billing_status: "trial",
    })
    .select("id, token, name, email")
    .single();

  return { data, error, token };
}

export async function updateOrg(id, fields) {
  const allowed = ["name", "email", "contact_name", "phone", "website", "address", "notes", "billing_status", "trial_ends_at"];
  const update  = {};
  for (const k of allowed) {
    if (fields[k] !== undefined) update[k] = fields[k];
  }
  if (fields.password) update.password_hash = await hashPassword(fields.password);
  const { data, error } = await db
    .from("organizations")
    .update(update)
    .eq("id", id)
    .select("*")
    .single();
  return { data, error };
}

// ─── Org Members ───────────────────────────────────────────────────────────────

export async function getMemberByEmail(email) {
  const { data, error } = await db
    .from("org_members")
    .select("*, organizations(id, name, token)")
    .eq("email", normalizeEmail(email))
    .eq("active", true)
    .maybeSingle();
  return { data, error };
}

export async function getMembersByOrg(orgToken) {
  const { data, error } = await db
    .from("org_members")
    .select("id, email, name, role, active, created_at")
    .eq("org_token", normalizeToken(orgToken))
    .order("name");
  return { data: data ?? [], error };
}

export async function getMemberByInviteToken(inviteToken) {
  const { data, error } = await db
    .from("org_members")
    .select("*")
    .eq("invite_token", inviteToken)
    .maybeSingle();
  return { data, error };
}

export async function createMemberInvite({ orgId, orgToken, email, name, role }) {
  const invite_token      = generateInviteToken();
  const invite_expires_at = addDays(7);
  const emailNorm         = normalizeEmail(email);

  const { data, error } = await db
    .from("org_members")
    .upsert(
      {
        org_id:           orgId,
        org_token:        normalizeToken(orgToken),
        email:            emailNorm,
        name:             name ? String(name).trim() : null,
        role:             String(role || "trainer").toLowerCase(),
        active:           false,
        invite_token,
        invite_expires_at,
      },
      { onConflict: "org_token,email" }
    )
    .select("id, email, invite_token, invite_expires_at")
    .single();

  return { data, error, invite_token };
}

export async function activateMember(id, { name, password }) {
  const password_hash = await hashPassword(password);
  const { data, error } = await db
    .from("org_members")
    .update({
      name:           String(name || "").trim(),
      password_hash,
      active:         true,
      invite_token:   null,
      invite_expires_at: null,
    })
    .eq("id", id)
    .select("*")
    .single();
  return { data, error };
}

export async function updateMember(id, fields) {
  const allowed = ["name", "role", "active"];
  const update  = {};
  for (const k of allowed) {
    if (fields[k] !== undefined) update[k] = fields[k];
  }
  if (fields.password) update.password_hash = await hashPassword(fields.password);
  const { data, error } = await db
    .from("org_members")
    .update(update)
    .eq("id", id)
    .select("*")
    .single();
  return { data, error };
}

export async function removeMember(id) {
  const { error } = await db.from("org_members").delete().eq("id", id);
  return { error };
}

// ─── Daily Workouts (org-assigned) ────────────────────────────────────────────

export async function createOrgWorkout({ orgToken, athleteId, athleteToken, title, date, status, sport, items = [], scheduledTime, scheduledDuration }) {
  const { data: dw, error: dwErr } = await db
    .from("daily_workouts")
    .insert({
      athlete_id:         athleteId,
      athlete_token:      athleteToken,
      org_token:          normalizeToken(orgToken),
      title:              String(title || "Daily Workout"),
      date:               String(date).slice(0, 10),
      status:             String(status || "assigned"),
      sport:              sport ? String(sport).toLowerCase() : null,
      scheduled_time:     scheduledTime  ? String(scheduledTime).slice(0, 8) : null,
      scheduled_duration: scheduledDuration != null ? Number(scheduledDuration) || null : null,
    })
    .select("id")
    .single();

  if (dwErr || !dw) return { data: null, error: dwErr };

  let itemIds = [];
  if (items.length > 0) {
    const rows = items.map((it, i) => ({
      daily_workout_id:  dw.id,
      sort_order:        it.sort_order ?? it.order ?? i + 1,
      exercise_name:     String(it.exerciseName || it.exercise_name || ""),
      sets:              it.sets   != null ? Number(it.sets)   : null,
      reps:              it.reps   ? String(it.reps)   : null,
      weight:            it.weight ? String(it.weight) : null,
      rpe:               it.rpe    ? String(it.rpe)    : null,
      rest:              it.rest   ? String(it.rest)   : null,
      instructions:      it.instructions ? String(it.instructions) : null,
      video_url:         it.videoUrl || it.video_url ? String(it.videoUrl || it.video_url) : null,
      evidence_required: it.evidenceRequired || it.evidence_required || "none",
      group_id:          it.groupId || it.group_id || null,
    }));

    const { data: createdItems, error: itemErr } = await db
      .from("workout_items")
      .insert(rows)
      .select("id");

    if (!itemErr && createdItems) {
      itemIds = createdItems.map(r => r.id);
    }
  }

  return { data: { id: dw.id, itemIds }, error: null };
}

export async function getOrgWorkoutsByDate({ orgToken, date }) {
  const { data, error } = await db
    .from("daily_workouts")
    .select(`
      id, date, title, status, sport, athlete_id, athlete_token, org_token,
      workout_items (
        id, exercise_name, sets, reps, weight, rpe, rest,
        instructions, video_url, evidence_required, sort_order, group_id,
        workout_completions ( id, status, review_note, athlete_id )
      )
    `)
    .eq("org_token", normalizeToken(orgToken))
    .eq("date", date);
  return { data: data ?? [], error };
}

export async function getOrgWorkoutsByRange({ orgToken, startDate, endDate }) {
  const { data, error } = await db
    .from("daily_workouts")
    .select(`
      id, date, title, status, sport, athlete_id, athlete_token, org_token,
      workout_items ( id, exercise_name, sets, reps, sort_order, group_id )
    `)
    .eq("org_token", normalizeToken(orgToken))
    .gte("date", startDate)
    .lte("date", endDate)
    .order("date");
  return { data: data ?? [], error };
}

export async function getOrgWorkoutById(id) {
  const { data, error } = await db
    .from("daily_workouts")
    .select(`
      id, date, title, status, sport, athlete_id, athlete_token, org_token,
      workout_items (
        id, exercise_name, sets, reps, weight, rpe, rest,
        instructions, video_url, evidence_required, sort_order, group_id,
        workout_completions ( id, status, review_note, athlete_id )
      )
    `)
    .eq("id", id)
    .single();
  return { data, error };
}

export async function updateOrgWorkout(id, fields) {
  const allowed = ["title", "date", "status", "sport"];
  const update  = {};
  for (const k of allowed) {
    if (fields[k] !== undefined) update[k] = fields[k];
  }
  const { data, error } = await db
    .from("daily_workouts")
    .update(update)
    .eq("id", id)
    .select("id, title, date, status, sport")
    .single();
  return { data, error };
}

export async function deleteOrgWorkout(id) {
  const { error } = await db.from("daily_workouts").delete().eq("id", id);
  return { error };
}

export async function addWorkoutItem(dailyWorkoutId, item) {
  const { data, error } = await db
    .from("workout_items")
    .insert({
      daily_workout_id:  dailyWorkoutId,
      sort_order:        item.order ?? item.sort_order ?? 0,
      exercise_name:     String(item.exerciseName || item.exercise_name || ""),
      sets:              item.sets   != null ? Number(item.sets)   : null,
      reps:              item.reps   ? String(item.reps)   : null,
      weight:            item.weight ? String(item.weight) : null,
      rpe:               item.rpe    ? String(item.rpe)    : null,
      rest:              item.rest   ? String(item.rest)   : null,
      instructions:      item.instructions ? String(item.instructions) : null,
      video_url:         item.videoUrl || item.video_url ? String(item.videoUrl || item.video_url) : null,
      evidence_required: item.evidenceRequired || item.evidence_required || "none",
      group_id:          item.groupId || item.group_id || null,
    })
    .select("id")
    .single();
  return { data, error };
}

// ─── Workout Completions ───────────────────────────────────────────────────────

export async function upsertWorkoutCompletion({ workoutItemId, athleteId, athleteToken, orgToken, status, reviewNote }) {
  const { data, error } = await db
    .from("workout_completions")
    .upsert(
      {
        workout_item_id: workoutItemId,
        athlete_id:      athleteId,
        athlete_token:   athleteToken || null,
        org_token:       orgToken     || null,
        status:          String(status || "completed"),
        review_note:     reviewNote   || null,
      },
      { onConflict: "workout_item_id,athlete_id" }
    )
    .select("id, status")
    .single();
  return { data, error };
}

export async function getCompletionsForWorkout(dailyWorkoutId) {
  const { data, error } = await db
    .from("workout_completions")
    .select("id, workout_item_id, athlete_id, athlete_token, status, review_note, created_at")
    .in(
      "workout_item_id",
      db.from("workout_items").select("id").eq("daily_workout_id", dailyWorkoutId)
    );
  return { data: data ?? [], error };
}

// ─── Scans ─────────────────────────────────────────────────────────────────────

export async function createScan({ userEmail, athleteToken, scanId, stackDetails, resultSummary, bannedDetails, scanName }) {
  const share_token = crypto.randomBytes(16).toString("hex");
  const { data, error } = await db
    .from("scans")
    .insert({
      user_email:     normalizeEmail(userEmail),
      athlete_token:  athleteToken || null,
      scan_id:        scanId       || null,
      stack_details:  stackDetails || null,
      result_summary: resultSummary ? String(resultSummary) : null,
      banned_details: bannedDetails || null,
      scan_name:      scanName      ? String(scanName)      : null,
      share_token,
    })
    .select("id, share_token, created_at")
    .single();
  return { data, error };
}

export async function getScansByEmail(userEmail) {
  const { data, error } = await db
    .from("scans")
    .select("id, scan_id, scan_name, result_summary, created_at, share_token")
    .eq("user_email", normalizeEmail(userEmail))
    .order("created_at", { ascending: false });
  return { data: data ?? [], error };
}

export async function getScanById(id) {
  const { data, error } = await db
    .from("scans")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  return { data, error };
}

export async function getScanByScanId(scanId) {
  const { data, error } = await db
    .from("scans")
    .select("*")
    .eq("scan_id", String(scanId))
    .maybeSingle();
  return { data, error };
}

export async function getScanByShareToken(shareToken) {
  const { data, error } = await db
    .from("scans")
    .select("*")
    .eq("share_token", String(shareToken))
    .maybeSingle();
  return { data, error };
}

export async function updateScan(id, fields) {
  const allowed = ["scan_name", "stack_details", "result_summary", "banned_details"];
  const update  = {};
  for (const k of allowed) {
    if (fields[k] !== undefined) update[k] = fields[k];
  }
  update.updated_at = new Date().toISOString();
  const { data, error } = await db.from("scans").update(update).eq("id", id).select("id").single();
  return { data, error };
}

export async function deleteScan(id) {
  const { error } = await db.from("scans").delete().eq("id", id);
  return { error };
}
