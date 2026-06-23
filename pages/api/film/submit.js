// pages/api/film/submit.js
// AI analysis pipeline has been removed. This endpoint is no longer active.
export default function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.status(410).json({ error: "AI analysis has been removed. Tag plays manually and use the analytics dashboard." });
}
