// pages/api/commercial/completion.js
import { getRequestUser } from "@/lib/commercial/getRequestUser";
import { getSubscriptionByClientAndTrainer, getVideoById } from "@/lib/commercial/airtable";

const BASE_ID = process.env.AIRTABLE_BASE_ID;
const API_KEY = process.env.AIRTABLE_API_KEY;
const HEADERS = { Authorization: `Bearer ${API_KEY}`, "Content-Type": "application/json" };

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const user = getRequestUser(req);
  if (!user) return res.status(401).end();

  const { videoId, completedAt } = req.body;
  if (!videoId) return res.status(400).end();

  try {
    const video     = await getVideoById(videoId);
    const trainerId = video?.fields?.trainerId;
    if (!trainerId) return res.status(200).end();

    const clientEmail = user.email || user.Email;
    const sub = await getSubscriptionByClientAndTrainer(clientEmail, trainerId);
    if (!sub) return res.status(403).end();

    await fetch(`https://api.airtable.com/v0/${BASE_ID}/VideoCompletions`, {
      method:  "POST",
      headers: HEADERS,
      body: JSON.stringify({
        fields: {
          videoId,
          trainerId,
          clientEmail,
          clientName:  user.name || user.Name || "",
          videoTitle:  video.fields?.title ?? "",
          completedAt: completedAt ?? new Date().toISOString(),
          tier:        sub.fields?.tier ?? "",
        },
      }),
    });

    return res.status(200).json({ logged: true });
  } catch (err) {
    console.error("[completion]", err);
    return res.status(200).end();
  }
}