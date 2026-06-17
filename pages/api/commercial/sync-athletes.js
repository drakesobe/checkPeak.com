// pages/api/commercial/sync-athletes.js
// POST - bidirectional reconciliation between commercial subscriptions and org athletes.
//
// Forward  (subscriptions → athletes):
//   Anyone who has an active subscription but no athlete record gets one created,
//   regardless of whether they subscribed via public checkout or were manually added.
//
// Reverse  (athletes → subscriptions):
//   Org athletes who already have a subscription (matched by email) get their
//   athlete record updated if their name is missing. We never auto-create
//   subscriptions for athletes who haven't subscribed.
//
// Idempotent - safe to run multiple times.

import { getRequestUser } from "@/lib/commercial/getRequestUser";
import { getTrainerByUserId, getSubscriptionsByTrainer } from "@/lib/commercial/db";
import { supabaseAdmin as db } from "@/lib/supabase";

function genAthleteToken() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let t = "ATH-";
  for (let i = 0; i < 8; i++) t += chars[Math.floor(Math.random() * chars.length)];
  return t;
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const user = getRequestUser(req);
  if (!user) return res.status(401).json({ error: "Unauthorized" });

  const orgToken = String(user?.orgToken || user?.Token || user?.token || "").trim().toUpperCase();
  if (!orgToken) return res.status(400).json({ error: "No org token in session - cannot sync athletes." });

  const trainer = await getTrainerByUserId(user.email || user.Email);
  if (!trainer) return res.status(403).json({ error: "No trainer profile" });

  // Load both tables in parallel
  const [subscriptions, athletesResult] = await Promise.all([
    getSubscriptionsByTrainer(trainer.id),
    db.from("athletes").select("id, email, name, athlete_token").eq("org_token", orgToken).eq("status", "active"),
  ]);

  const activeSubscriptions = subscriptions.filter(c => c.fields?.status === "active");
  const orgAthletes         = athletesResult.data ?? [];

  // Build lookup maps by email for O(1) matching
  const athleteByEmail     = new Map(orgAthletes.map(a => [a.email.toLowerCase(), a]));
  const subscriptionEmails = new Set(
    activeSubscriptions.map(c => String(c.fields?.clientEmail || "").toLowerCase().trim()).filter(Boolean)
  );

  let created  = 0; // subscription → athlete record created
  let updated  = 0; // athlete record updated (name backfilled)
  let linked   = 0; // already matched, no action needed
  const errors = [];

  // ── Forward: subscriptions → athletes ────────────────────────────────────────
  for (const c of activeSubscriptions) {
    const email = String(c.fields?.clientEmail || "").toLowerCase().trim();
    if (!email) continue;

    const existing = athleteByEmail.get(email);

    if (!existing) {
      // No athlete record - create one
      try {
        const { error } = await db.from("athletes").insert({
          name:          String(c.fields?.clientName || email).trim(),
          email,
          athlete_token: genAthleteToken(),
          org_token:     orgToken,
          status:        "active",
        });
        if (error) errors.push({ email, direction: "forward", error: error.message });
        else created++;
      } catch (e) {
        errors.push({ email, direction: "forward", error: e.message });
      }
    } else {
      linked++;
    }
  }

  // ── Reverse: athletes → subscriptions ────────────────────────────────────────
  // For athletes who have a matching subscription, backfill their name if it's
  // blank and the subscription has one.
  for (const athlete of orgAthletes) {
    const email = athlete.email.toLowerCase();
    if (!subscriptionEmails.has(email)) continue; // not a commercial subscriber, skip

    const sub  = activeSubscriptions.find(c => String(c.fields?.clientEmail || "").toLowerCase() === email);
    const subName = String(sub?.fields?.clientName || "").trim();

    if (!athlete.name && subName) {
      try {
        const { error } = await db
          .from("athletes")
          .update({ name: subName })
          .eq("id", athlete.id);
        if (error) errors.push({ email, direction: "reverse", error: error.message });
        else updated++;
      } catch (e) {
        errors.push({ email, direction: "reverse", error: e.message });
      }
    }
  }

  return res.status(200).json({
    ok:      true,
    created,  // athlete records created from subscriptions
    updated,  // athlete names backfilled from subscriptions
    linked,   // already matched, no action needed
    errors,
  });
}
