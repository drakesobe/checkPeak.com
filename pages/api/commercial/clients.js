// pages/api/commercial/clients.js
import { getRequestUser } from "@/lib/commercial/getRequestUser";
import {
  getTrainerByUserId,
  getSubscriptionsByTrainer,
  createSubscription,
  updateSubscription,
  updateTrainer,
} from "@/lib/commercial/db";
import { supabaseAdmin as db } from "@/lib/supabase";

// Generate an ATH-xxx token for a new athlete record
function genAthleteToken() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let t = "ATH-";
  for (let i = 0; i < 8; i++) t += chars[Math.floor(Math.random() * chars.length)];
  return t;
}

// Upsert client into org athletes table so they appear in the workout calendar + nutrition.
// Non-fatal — subscription creation succeeds regardless.
async function syncClientToOrgAthletes({ clientEmail, clientName, orgToken }) {
  if (!orgToken || !clientEmail) return;
  try {
    const email = clientEmail.toLowerCase();
    // Check if athlete already exists for this org
    const { data: existing } = await db
      .from("athletes")
      .select("id, athlete_token")
      .eq("email", email)
      .eq("org_token", orgToken)
      .maybeSingle();
    if (existing) return; // already synced
    // Create minimal athlete record (no password — commercial clients use library link)
    const athlete_token = genAthleteToken();
    const { error } = await db.from("athletes").insert({
      name:          String(clientName || clientEmail).trim(),
      email,
      athlete_token,
      org_token:     orgToken,
      status:        "active",
    });
    if (error) console.warn("[clients] athlete sync insert failed:", error.message);
  } catch (e) {
    console.warn("[clients] athlete sync error:", e.message);
  }
}

export default async function handler(req, res) {
  const user = getRequestUser(req);
  if (!user) return res.status(401).json({ error: "Unauthorized" });

  const trainer = await getTrainerByUserId(user.email || user.Email);
  if (!trainer) return res.status(403).json({ error: "No trainer profile" });

  const trainerId = trainer.id;

  if (req.method === "GET") {
    const clients = await getSubscriptionsByTrainer(trainerId);
    return res.status(200).json({ clients });
  }

  if (req.method === "POST") {
    const { clientName, clientEmail, tier } = req.body;
    if (!clientEmail || !tier) return res.status(400).json({ error: "Email and tier required" });
    if (!["Basic", "Premium", "Ultra"].includes(tier))
      return res.status(400).json({ error: "Invalid tier" });

    const record = await createSubscription({
      trainerId,
      clientName:  clientName ?? "",
      clientEmail,
      tier,
      status:    "active",
      startDate: new Date().toISOString().split("T")[0],
    });

    // Update active client count
    const allClients  = await getSubscriptionsByTrainer(trainerId);
    const activeCount = allClients.filter(c => c.fields?.status === "active").length;
    await updateTrainer(trainerId, { activeClientCount: activeCount });

    // Sync client into org athletes table so they appear in workout calendar + nutrition
    const orgToken = String(user?.orgToken || user?.Token || user?.token || "").trim().toUpperCase();
    syncClientToOrgAthletes({ clientEmail, clientName: clientName ?? "", orgToken });

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://checkpeak.com";

    // Send client access email - non-blocking
    fetch(`${siteUrl}/api/commercial/notify-client`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientEmail,
        clientName:      clientName ?? "",
        trainerName:     trainer.fields?.name ?? "Your trainer",
        trainerSlug:     trainer.fields?.slug ?? "",
        tier,
        welcomeMessage:  trainer.fields?.welcomeMessage ?? "",
      }),
    }).catch(e => console.warn("[clients] notify-client failed:", e.message));

    // Send trainer new-subscriber notification if enabled - non-blocking
    if (trainer.fields?.notifyOnSubscribe !== false) {
      const trainerEmail = String(user?.email || user?.Email || "").trim();
      if (trainerEmail) {
        fetch(`${siteUrl}/api/commercial/notify-trainer`, {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            trainerEmail,
            trainerName:  trainer.fields?.name ?? "",
            clientName:   clientName ?? "",
            clientEmail,
            tier,
            dashboardUrl: `${siteUrl}/commercial/dashboard`,
          }),
        }).catch(e => console.warn("[clients] notify-trainer failed:", e.message));
      }
    }

    return res.status(201).json({ client: record });
  }

  if (req.method === "PUT") {
    const { id } = req.query;
    if (!id) return res.status(400).json({ error: "Missing client id" });
    const fields = {};
    if (req.body.tier)   fields.tier   = req.body.tier;
    if (req.body.status) fields.status = req.body.status;
    const updated = await updateSubscription(id, fields);
    return res.status(200).json({ client: updated });
  }

  if (req.method === "DELETE") {
    const { id } = req.query;
    if (!id) return res.status(400).json({ error: "Missing client id" });
    await updateSubscription(id, { status: "cancelled" });
    return res.status(200).json({ cancelled: true });
  }

  return res.status(405).end();
}