export default function handler(req, res) {
  res.status(200).json({
    NUTRITION_API_KEY: process.env.NUTRITION_API_KEY || null,
    NUTRITION_BASE_ID: process.env.NUTRITION_BASE_ID || null,
    cwd: process.cwd(),
  });
}
