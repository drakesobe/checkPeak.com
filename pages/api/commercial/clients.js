// pages/api/commercial/clients.js
import { getRequestUser } from "@/lib/commercial/getRequestUser";
import {
  getTrainerByUserId,
  getSubscriptionsByTrainer,
  createSubscription,
  updateSubscription,
  updateTrainer,
} from "@/lib/commercial/db";

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

    // Fire access email — non-blocking
    fetch(`${process.env.NEXT_PUBLIC_SITE_URL}/api/commercial/notify-client`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientEmail,
        clientName:  clientName ?? "",
        trainerName: trainer.fields?.name ?? "Your trainer",
        trainerSlug: trainer.fields?.slug ?? "",
        tier,
      }),
    }).catch(e => console.warn("[clients] notify failed:", e.message));

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