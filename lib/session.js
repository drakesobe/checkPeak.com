// lib/session.js
// Tamper-proof sessions. The session object (cookie on web, stored JSON in the mobile app) carries
// `_iat` + `_sig`, an HMAC over the identity claims that grant access. Display fields (name, org name,
// avatar) are not signed, so clients may keep adding them without breaking the session.
//
// Uses Web Crypto so the same code runs in middleware (Edge) and API routes (Node).

const VERSION = "v1";
const MAX_AGE_SECONDS = 365 * 24 * 60 * 60;

// Every key a route might read for each claim. A claim is only valid if ALL present aliases agree,
// so an attacker can't keep the signed key and add a conflicting alias that some route reads first.
const ALIASES = {
  sub:       ["id"],
  email:     ["email", "Email"],
  role:      ["role", "Role"],
  athlete:   ["athlete_token", "AthleteToken", "athleteToken"],
  athleteId: ["athleteId", "athlete_id"],
  member:    ["member_id", "memberId", "MemberId", "orgMemberId", "OrgMemberId"],
  org:       ["org_token", "orgToken", "Token", "token"],
  orgId:     ["org_id", "orgId", "OrgId", "organizationId", "OrganizationId"],
};

// For athletes the org code is the join key itself (knowing it is what lets you join), and the app
// updates it locally after joining a team, so it is not part of an athlete's signed identity.
// For coach/org roles it grants control of that org, so it is signed.
const ORG_SCOPED = new Set(["org", "orgId"]);

function normRole(raw) {
  const r = String(raw || "").trim().toLowerCase();
  if (!r) return "";
  if (r === "organization" || r === "org" || r === "owner" || r.includes("org")) return "organization";
  if (r === "admin" || r.includes("admin") || r === "head trainer" || r === "head_trainer") return "admin";
  if (r === "trainer" || r === "coach" || r.includes("train") || r.includes("coach")) return "trainer";
  if (r.includes("ath")) return "athlete";
  return r;
}

function normValue(claim, v) {
  const s = String(v ?? "").trim();
  if (!s) return "";
  if (claim === "email") return s.toLowerCase();
  if (claim === "role") return normRole(s);
  if (claim === "org") return s.toUpperCase();
  return s;
}

// Returns the canonical claims, or null when aliases disagree (a tampering signal).
export function sessionClaims(obj) {
  if (!obj || typeof obj !== "object") return null;
  const out = {};
  for (const [claim, keys] of Object.entries(ALIASES)) {
    const values = new Set(keys.map((k) => normValue(claim, obj[k])).filter(Boolean));
    if (values.size > 1) return null;
    out[claim] = values.size ? [...values][0] : "";
  }
  if (out.role === "athlete") ORG_SCOPED.forEach((c) => { out[c] = ""; });
  return out;
}

function payload(claims, iat) {
  return [VERSION, iat, ...Object.keys(ALIASES).map((c) => claims[c])].join("|");
}

let keyPromise = null;
function getKey() {
  if (keyPromise) return keyPromise;
  // SESSION_SECRET is preferred. Falling back to a key derived from the (server-only) Supabase
  // service key means deploys never ship without a secret; set SESSION_SECRET to rotate independently.
  const secret = process.env.SESSION_SECRET
    || (process.env.SUPABASE_SERVICE_ROLE_KEY ? `checkpeak-session:${process.env.SUPABASE_SERVICE_ROLE_KEY}` : "");
  if (!secret) throw new Error("SESSION_SECRET (or SUPABASE_SERVICE_ROLE_KEY) must be set to sign sessions.");
  keyPromise = crypto.subtle.importKey(
    "raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  return keyPromise;
}

async function hmac(message) {
  const sig = await crypto.subtle.sign("HMAC", await getKey(), new TextEncoder().encode(message));
  return Array.from(new Uint8Array(sig), (b) => b.toString(16).padStart(2, "0")).join("");
}

function safeEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// Adds _iat/_sig to each object (e.g. the cookie shape and the response-body shape of one login).
export async function signSession(...objects) {
  const iat = Math.floor(Date.now() / 1000);
  return Promise.all(objects.map(async (o) => {
    const claims = sessionClaims(o);
    if (!claims) throw new Error("Cannot sign a session whose identity fields disagree.");
    return { ...o, _iat: iat, _sig: await hmac(payload(claims, iat)) };
  }));
}

// true only for an unexpired session whose identity claims match its signature.
export async function verifySession(obj) {
  if (!obj || typeof obj !== "object") return false;
  const iat = Number(obj._iat);
  if (!Number.isFinite(iat) || typeof obj._sig !== "string") return false;
  const now = Math.floor(Date.now() / 1000);
  if (iat > now + 300 || now - iat > MAX_AGE_SECONDS) return false;
  const claims = sessionClaims(obj);
  if (!claims) return false;
  return safeEqual(obj._sig, await hmac(payload(claims, iat)));
}

// Parses a raw session string (cookie value, query param, form field). Returns the object or null.
export function parseSessionString(raw) {
  if (raw == null || raw === "") return null;
  let s = String(raw);
  // Once-encoded starts with %7B ("{"), twice-encoded with %257B
  for (let i = 0; i < 3 && /^%(7B|25)/i.test(s); i++) {
    try { s = decodeURIComponent(s); } catch { break; }
  }
  try {
    const obj = JSON.parse(s);
    return obj && typeof obj === "object" ? obj : null;
  } catch {
    return null;
  }
}
