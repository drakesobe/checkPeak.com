// lib/commercial/airtable.js
const API_KEY = process.env.COMMERCIAL_TRAINERS_API_KEY;
const BASE_ID = process.env.COMMERCIAL_TRAINERS_BASE_ID;

const TABLES = {
  trainers:     process.env.COMMERCIAL_TRAINERS_TABLE_ID,
  videos:       process.env.TRAINER_VIDEOS_TABLE_ID,
  subscriptions:process.env.CLIENT_SUBSCRIPTIONS_TABLE_ID,
  completions:  process.env.VIDEO_COMPLETIONS_TABLE_ID,
  workouts:     process.env.COMMERCIAL_WORKOUTS_TABLE_ID,
};

const AT_HEADERS = {
  Authorization: `Bearer ${API_KEY}`,
  "Content-Type": "application/json",
};

function atUrl(table, params = "") {
  const url = `https://api.airtable.com/v0/${BASE_ID}/${encodeURIComponent(table)}${params}`;
  console.log("[airtable] url:", url);
  return url;
}

// ─── Trainers ──────────────────────────────────────────────────────────────────

export async function getTrainerByUserId(userId) {
  const url  = atUrl(TABLES.trainers, `?filterByFormula=({userId}="${userId}")`);
  const res  = await fetch(url, { headers: AT_HEADERS });
  const data = await res.json();
  return data.records?.[0] ?? null;
}

export async function getTrainerBySlug(slug) {
  const url  = atUrl(TABLES.trainers, `?filterByFormula=({slug}="${slug}")`);
  const res  = await fetch(url, { headers: AT_HEADERS });
  const data = await res.json();
  return data.records?.[0] ?? null;
}

export async function getTrainerById(recordId) {
  const res = await fetch(atUrl(TABLES.trainers, `/${recordId}`), { headers: AT_HEADERS });
  if (!res.ok) return null;
  return res.json();
}

export async function getPublicTrainers() {
  const url  = atUrl(TABLES.trainers, `?sort[0][field]=name&sort[0][direction]=asc`);
  const res  = await fetch(url, { headers: AT_HEADERS });
  const data = await res.json();
  return data.records ?? [];
}

export async function createTrainer(fields) {
  const res = await fetch(atUrl(TABLES.trainers), {
    method: "POST", headers: AT_HEADERS, body: JSON.stringify({ fields }),
  });
  return res.json();
}

export async function updateTrainer(recordId, fields) {
  const res = await fetch(atUrl(TABLES.trainers, `/${recordId}`), {
    method: "PATCH", headers: AT_HEADERS, body: JSON.stringify({ fields }),
  });
  return res.json();
}

// ─── Videos ───────────────────────────────────────────────────────────────────

export async function getVideosByTrainer(trainerId, { publishedOnly = false } = {}) {
  let formula = `({trainerId}="${trainerId}")`;
  if (publishedOnly) formula = `AND({trainerId}="${trainerId}", {published}=TRUE())`;
  const url  = atUrl(TABLES.videos, `?filterByFormula=${encodeURIComponent(formula)}&sort[0][field]=createdAt&sort[0][direction]=desc`);
  const res  = await fetch(url, { headers: AT_HEADERS });
  const data = await res.json();
  return data.records ?? [];
}

export async function getVideoById(recordId) {
  const res = await fetch(atUrl(TABLES.videos, `/${recordId}`), { headers: AT_HEADERS });
  return res.json();
}

export async function getVideoByUploadId(uploadId) {
  const url  = atUrl(TABLES.videos, `?filterByFormula=({muxUploadId}="${uploadId}")`);
  const res  = await fetch(url, { headers: AT_HEADERS });
  const data = await res.json();
  return data.records?.[0] ?? null;
}

export async function createVideo(fields) {
  const res = await fetch(atUrl(TABLES.videos), {
    method: "POST", headers: AT_HEADERS, body: JSON.stringify({ fields }),
  });
  return res.json();
}

export async function updateVideo(recordId, fields) {
  const res = await fetch(atUrl(TABLES.videos, `/${recordId}`), {
    method: "PATCH", headers: AT_HEADERS, body: JSON.stringify({ fields }),
  });
  return res.json();
}

export async function deleteVideo(recordId) {
  const res = await fetch(atUrl(TABLES.videos, `/${recordId}`), {
    method: "DELETE", headers: AT_HEADERS,
  });
  return res.json();
}

// ─── Subscriptions ────────────────────────────────────────────────────────────

export async function getSubscriptionsByTrainer(trainerId) {
  const url  = atUrl(TABLES.subscriptions, `?filterByFormula=({trainerId}="${trainerId}")`);
  const res  = await fetch(url, { headers: AT_HEADERS });
  const data = await res.json();
  return data.records ?? [];
}

export async function getSubscriptionByClientAndTrainer(clientEmail, trainerId) {
  const formula = `AND({clientEmail}="${clientEmail}", {trainerId}="${trainerId}", {status}="active")`;
  const url  = atUrl(TABLES.subscriptions, `?filterByFormula=${encodeURIComponent(formula)}`);
  const res  = await fetch(url, { headers: AT_HEADERS });
  const data = await res.json();
  return data.records?.[0] ?? null;
}

export async function getSubscriptionsByEmail(clientEmail) {
  const formula = `AND({clientEmail}="${clientEmail}", {status}="active")`;
  const url  = atUrl(TABLES.subscriptions, `?filterByFormula=${encodeURIComponent(formula)}`);
  const res  = await fetch(url, { headers: AT_HEADERS });
  const data = await res.json();
  return data.records ?? [];
}

export async function createSubscription(fields) {
  const res = await fetch(atUrl(TABLES.subscriptions), {
    method: "POST", headers: AT_HEADERS, body: JSON.stringify({ fields }),
  });
  return res.json();
}

export async function updateSubscription(recordId, fields) {
  const res = await fetch(atUrl(TABLES.subscriptions, `/${recordId}`), {
    method: "PATCH", headers: AT_HEADERS, body: JSON.stringify({ fields }),
  });
  return res.json();
}

// ─── Completions ──────────────────────────────────────────────────────────────

export async function getCompletionsByClientAndTrainer(clientEmail, trainerId) {
  if (!TABLES.completions) return [];
  const formula = `AND({clientEmail}="${clientEmail}", {trainerId}="${trainerId}")`;
  const url  = atUrl(TABLES.completions, `?filterByFormula=${encodeURIComponent(formula)}`);
  const res  = await fetch(url, { headers: AT_HEADERS });
  const data = await res.json();
  return data.records ?? [];
}

export async function createCompletion(fields) {
  if (!TABLES.completions) return null;
  const res = await fetch(atUrl(TABLES.completions), {
    method: "POST", headers: AT_HEADERS, body: JSON.stringify({ fields }),
  });
  return res.json();
}

// ─── Workout Programs ─────────────────────────────────────────────────────────

export async function getWorkoutsByTrainer(trainerId, { publishedOnly = false } = {}) {
  if (!TABLES.workouts) return [];
  let formula = `({trainerId}="${trainerId}")`;
  if (publishedOnly) formula = `AND({trainerId}="${trainerId}", {published}=TRUE())`;
  const url  = atUrl(TABLES.workouts, `?filterByFormula=${encodeURIComponent(formula)}&sort[0][field]=title&sort[0][direction]=asc`);
  const res  = await fetch(url, { headers: AT_HEADERS });
  const data = await res.json();
  return data.records ?? [];
}

export async function createWorkout(fields) {
  if (!TABLES.workouts) return null;
  const res = await fetch(atUrl(TABLES.workouts), {
    method: "POST", headers: AT_HEADERS, body: JSON.stringify({ fields }),
  });
  return res.json();
}

export async function updateWorkout(recordId, fields) {
  if (!TABLES.workouts) return null;
  const res = await fetch(atUrl(TABLES.workouts, `/${recordId}`), {
    method: "PATCH", headers: AT_HEADERS, body: JSON.stringify({ fields }),
  });
  return res.json();
}

export async function deleteWorkout(recordId) {
  if (!TABLES.workouts) return null;
  const res = await fetch(atUrl(TABLES.workouts, `/${recordId}`), {
    method: "DELETE", headers: AT_HEADERS,
  });
  return res.json();
}