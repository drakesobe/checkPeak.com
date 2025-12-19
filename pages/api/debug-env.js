export default function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  const keys = [
    "PLAN_TEMPLATES_API_KEY",
    "PLAN_TEMPLATES_BASE_ID",
    "PLAN_TEMPLATES_TABLE_NAME",
  ];

  const out = {};
  for (const k of keys) {
    const v = process.env[k];
    out[k] = { present: Boolean(v), length: v ? String(v).length : 0 };
  }

  res.status(200).json({
    host: req.headers.host,
    cwd: process.cwd(),
    nodeEnv: process.env.NODE_ENV || "",
    keys: out,
  });
}
