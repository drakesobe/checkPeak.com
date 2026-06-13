// pages/api/commercial/trainer.js
import { getRequestUser } from "@/lib/commercial/getRequestUser";
import {
  getTrainerByUserId,
  createTrainer,
  updateTrainer,
} from "@/lib/commercial/db";

function slugify(str) {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

export default async function handler(req, res) {
  const user = getRequestUser(req);
  if (!user) return res.status(401).json({ error: "Unauthorized" });

  const userId = user.email || user.Email;

  if (req.method === "GET") {
    const trainer = await getTrainerByUserId(userId);
    if (!trainer) return res.status(404).json({ error: "No trainer profile" });
    return res.status(200).json({ trainer });
  }

  if (req.method === "POST") {
    const existing = await getTrainerByUserId(userId);
    if (existing) return res.status(409).json({ error: "Profile already exists" });

    const { name, specialty, bio, basicPrice, premiumPrice, ultraPrice,
        clientCount, orgType, goal, sport } = req.body;
    if (!name || !specialty) return res.status(400).json({ error: "Name and specialty required" });

    const slug = slugify(name) + "-" + Math.random().toString(36).slice(2, 6);

    const record = await createTrainer({
      userId,
      name,
      slug,
      specialty,
      bio:          bio ?? "",
      basicPrice:   Number(basicPrice)   || 0,
      premiumPrice: Number(premiumPrice) || 0,
      ultraPrice:   Number(ultraPrice)   || 0,
      activeClientCount: 0,
      clientCount:       clientCount ?? "",
      orgType:           orgType     ?? "",
      goal:              goal        ?? "",
      sport:             sport       ?? "",
    });

    return res.status(201).json({ trainer: record });
  }

  if (req.method === "PUT") {
    const trainer = await getTrainerByUserId(userId);
    if (!trainer) return res.status(404).json({ error: "No trainer profile" });

    // All updatable fields including new perks fields
    const allowed = [
      "name", "specialty", "bio",
      "basicPrice", "premiumPrice", "ultraPrice",
      "basicPerks", "premiumPerks", "ultraPerks",
      "libraryLocked",
      "instagramUrl", "youtubeUrl", "websiteUrl",
      "welcomeMessage", "notifyOnSubscribe",
    ];

    const fields = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) {
        if (["basicPrice", "premiumPrice", "ultraPrice"].includes(key)) {
          fields[key] = Number(req.body[key]) || 0;
        } else if (key === "libraryLocked" || key === "notifyOnSubscribe") {
          fields[key] = Boolean(req.body[key]);
        } else {
          fields[key] = req.body[key];
        }
      }
    }

    const updated = await updateTrainer(trainer.id, fields);
    return res.status(200).json({ trainer: updated });
  }

  return res.status(405).end();
}