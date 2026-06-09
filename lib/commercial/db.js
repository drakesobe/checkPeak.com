// lib/commercial/db.js
// Drop-in replacement for lib/commercial/airtable.js
// Same function signatures - wraps Supabase rows into { id, fields } to match
// the shape API routes already expect, so imports can be swapped one file at a time.
import { supabaseAdmin as db } from "@/lib/supabase";

// ─── Shape helpers ────────────────────────────────────────────────────────────

const JSONB_FIELDS = new Set(["tags", "exercises"]);

function snakeToCamel(k) {
  return k.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
}

function camelToSnake(k) {
  return k.replace(/[A-Z]/g, c => "_" + c.toLowerCase());
}

// Supabase row → { id, fields: { camelCase } }
function toRecord(row) {
  if (!row) return null;
  const fields = {};
  for (const [k, v] of Object.entries(row)) {
    if (k === "id" || k === "airtable_id") continue;
    fields[snakeToCamel(k)] = v;
  }
  return { id: row.id, fields };
}

// camelCase fields object → snake_case Postgres row
// Handles: JSONB fields that arrive as JSON strings (from existing API routes)
function toRow(camelObj) {
  const row = {};
  for (const [k, v] of Object.entries(camelObj)) {
    const snakeKey = camelToSnake(k);
    if (JSONB_FIELDS.has(k) && typeof v === "string") {
      try { row[snakeKey] = JSON.parse(v); } catch { row[snakeKey] = v; }
    } else {
      row[snakeKey] = v;
    }
  }
  return row;
}

// ─── Trainers ─────────────────────────────────────────────────────────────────

export async function getTrainerByUserId(userId) {
  const { data } = await db.from("trainers").select("*").eq("user_id", userId).maybeSingle();
  return toRecord(data);
}

export async function getTrainerBySlug(slug) {
  const { data } = await db.from("trainers").select("*").eq("slug", slug).maybeSingle();
  return toRecord(data);
}

export async function getTrainerById(recordId) {
  const { data } = await db.from("trainers").select("*").eq("id", recordId).maybeSingle();
  return toRecord(data);
}

export async function getPublicTrainers() {
  const { data } = await db.from("trainers").select("*").order("name");
  return (data ?? []).map(toRecord);
}

export async function createTrainer(fields) {
  const { data, error } = await db.from("trainers").insert(toRow(fields)).select().single();
  if (error) { console.error("[db] createTrainer:", error); return { error }; }
  return toRecord(data);
}

export async function updateTrainer(recordId, fields) {
  const { data, error } = await db.from("trainers").update(toRow(fields)).eq("id", recordId).select().single();
  if (error) { console.error("[db] updateTrainer:", error); return { error }; }
  return toRecord(data);
}

// ─── Videos ───────────────────────────────────────────────────────────────────

export async function getVideosByTrainer(trainerId, { publishedOnly = false } = {}) {
  let q = db.from("videos").select("*").eq("trainer_id", trainerId).order("created_at", { ascending: false });
  if (publishedOnly) q = q.eq("published", true);
  const { data } = await q;
  return (data ?? []).map(toRecord);
}

export async function getVideoById(recordId) {
  const { data } = await db.from("videos").select("*").eq("id", recordId).maybeSingle();
  return toRecord(data);
}

export async function getVideoByUploadId(uploadId) {
  const { data } = await db.from("videos").select("*").eq("mux_upload_id", uploadId).maybeSingle();
  return toRecord(data);
}

export async function createVideo(fields) {
  const { data, error } = await db.from("videos").insert(toRow(fields)).select().single();
  if (error) { console.error("[db] createVideo:", error); return { error }; }
  return toRecord(data);
}

export async function updateVideo(recordId, fields) {
  const { data, error } = await db.from("videos").update(toRow(fields)).eq("id", recordId).select().single();
  if (error) { console.error("[db] updateVideo:", error); return { error }; }
  return toRecord(data);
}

export async function deleteVideo(recordId) {
  const { error } = await db.from("videos").delete().eq("id", recordId);
  if (error) { console.error("[db] deleteVideo:", error); return { error }; }
  return { deleted: true };
}

// ─── Subscriptions ────────────────────────────────────────────────────────────

export async function getSubscriptionsByTrainer(trainerId) {
  const { data } = await db.from("subscriptions").select("*").eq("trainer_id", trainerId);
  return (data ?? []).map(toRecord);
}

export async function getSubscriptionByClientAndTrainer(clientEmail, trainerId) {
  const { data } = await db
    .from("subscriptions")
    .select("*")
    .eq("client_email", clientEmail)
    .eq("trainer_id", trainerId)
    .eq("status", "active")
    .maybeSingle();
  return toRecord(data);
}

export async function getSubscriptionsByEmail(clientEmail) {
  const { data } = await db
    .from("subscriptions")
    .select("*")
    .eq("client_email", clientEmail)
    .eq("status", "active");
  return (data ?? []).map(toRecord);
}

export async function createSubscription(fields) {
  const { data, error } = await db.from("subscriptions").insert(toRow(fields)).select().single();
  if (error) { console.error("[db] createSubscription:", error); return { error }; }
  return toRecord(data);
}

export async function updateSubscription(recordId, fields) {
  const { data, error } = await db.from("subscriptions").update(toRow(fields)).eq("id", recordId).select().single();
  if (error) { console.error("[db] updateSubscription:", error); return { error }; }
  return toRecord(data);
}

// ─── Video Completions ────────────────────────────────────────────────────────

export async function getCompletionsByClientAndTrainer(clientEmail, trainerId) {
  const { data } = await db
    .from("video_completions")
    .select("*")
    .eq("client_email", clientEmail)
    .eq("trainer_id", trainerId);
  return (data ?? []).map(toRecord);
}

export async function createCompletion(fields) {
  const { data, error } = await db.from("video_completions").insert(toRow(fields)).select().single();
  if (error) { console.error("[db] createCompletion:", error); return { error }; }
  return toRecord(data);
}

// ─── Workouts ─────────────────────────────────────────────────────────────────

export async function getWorkoutsByTrainer(trainerId, { publishedOnly = false } = {}) {
  let q = db.from("commercial_workouts").select("*").eq("trainer_id", trainerId).order("title");
  if (publishedOnly) q = q.eq("published", true);
  const { data } = await q;
  return (data ?? []).map(toRecord);
}

export async function getWorkoutById(recordId) {
  const { data } = await db.from("commercial_workouts").select("*").eq("id", recordId).maybeSingle();
  return toRecord(data);
}

export async function createWorkout(fields) {
  const { data, error } = await db.from("commercial_workouts").insert(toRow(fields)).select().single();
  if (error) { console.error("[db] createWorkout:", error); return { error }; }
  return toRecord(data);
}

export async function updateWorkout(recordId, fields) {
  const { data, error } = await db.from("commercial_workouts").update(toRow(fields)).eq("id", recordId).select().single();
  if (error) { console.error("[db] updateWorkout:", error); return { error }; }
  return toRecord(data);
}

export async function deleteWorkout(recordId) {
  const { error } = await db.from("commercial_workouts").delete().eq("id", recordId);
  if (error) { console.error("[db] deleteWorkout:", error); return { error }; }
  return { deleted: true };
}

// ─── Purchases ────────────────────────────────────────────────────────────────

export async function getPurchasesByEmailAndTrainer(clientEmail, trainerId) {
  const { data } = await db
    .from("purchases")
    .select("*")
    .eq("client_email", clientEmail)
    .eq("trainer_id", trainerId)
    .eq("status", "active");
  return (data ?? []).map(toRecord);
}

export async function getPurchaseByEmailAndItem(clientEmail, itemId) {
  const { data } = await db
    .from("purchases")
    .select("*")
    .eq("client_email", clientEmail)
    .eq("item_id", itemId)
    .eq("status", "active")
    .maybeSingle();
  return toRecord(data);
}

export async function createPurchase(fields) {
  const { data, error } = await db.from("purchases").insert(toRow(fields)).select().single();
  if (error) { console.error("[db] createPurchase:", error); return { error }; }
  return toRecord(data);
}
