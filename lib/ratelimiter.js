// lib/ratelimiter.js

// Per-instance hourly cap for paid endpoints (OCR, vision). Serverless instances don't share
// memory, so this bounds abuse per instance rather than globally.
const hourly = new Map(); // key -> [timestamps]
export function hourlyLimit(req, res, key, max) {
  const ip  = String(req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "unknown").split(",")[0].trim();
  const id  = `${key}:${ip}`;
  const now = Date.now();
  const recent = (hourly.get(id) || []).filter((t) => now - t < 3600_000);
  if (recent.length >= max) {
    res.status(429).json({ error: "You've hit the scan limit for now. Try again in an hour." });
    return false;
  }
  recent.push(now);
  hourly.set(id, recent);
  return true;
}
const RATE_LIMIT_MS = 5000; // 5 seconds per IP
const MAX_REQUESTS = 4; // allow 4 concurrent requests per interval
const lastCalls = {}; // { endpoint: { ip: [timestamps] } }

/**
 * Enhanced rate limiter for Next.js API routes.
 * Supports multiple endpoints, logs IP hits, and prevents flooding.
 * @param {import('next').NextApiRequest} req
 * @param {import('next').NextApiResponse} res
 * @param {string} [endpoint] Optional name for the endpoint to track separately
 * @returns {boolean} true if request allowed, false if rate-limited
 */
export function ratelimiter(req, res, endpoint = "default") {
  const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress;
  const now = Date.now();

  if (!lastCalls[endpoint]) lastCalls[endpoint] = {};
  if (!lastCalls[endpoint][ip]) lastCalls[endpoint][ip] = [];

  // Filter out timestamps older than RATE_LIMIT_MS
  lastCalls[endpoint][ip] = lastCalls[endpoint][ip].filter(
    (timestamp) => now - timestamp < RATE_LIMIT_MS
  );

  if (lastCalls[endpoint][ip].length >= MAX_REQUESTS) {
    console.log(`[RateLimiter] IP ${ip} blocked on endpoint ${endpoint}`);
    res.status(429).json({ error: "Too many requests. Try again later." });
    return false;
  }

  // Log the request
  lastCalls[endpoint][ip].push(now);
  console.log(`[RateLimiter] IP ${ip} allowed on endpoint ${endpoint}`);
  return true;
}
