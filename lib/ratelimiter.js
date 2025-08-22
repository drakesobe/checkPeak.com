// lib/ratelimiter.js
const RATE_LIMIT_MS = 5000; // 5 seconds per IP
const lastCall = {};

/**
 * Enhanced rate limiter for Next.js API routes.
 * Supports multiple endpoints, logs IP hits, and prevents flooding.
 * @param {import('next').NextApiRequest} req
 * @param {import('next').NextApiResponse} res
 * @param {string} [endpoint] Optional name for the endpoint to track separately
 * @returns {boolean} true if request allowed, false if rate-limited
 */
export function ratelimiter(req, res, endpoint = 'default') {
  const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress;
  const now = Date.now();

  // Initialize storage for this endpoint if needed
  if (!lastCall[endpoint]) lastCall[endpoint] = {};

  if (lastCall[endpoint][ip] && now - lastCall[endpoint][ip] < RATE_LIMIT_MS) {
    console.log(`[RateLimiter] IP ${ip} blocked on endpoint ${endpoint}`);
    res.status(429).json({ error: "Too many requests. Try again later." });
    return false;
  }

  // Log the request
  console.log(`[RateLimiter] IP ${ip} allowed on endpoint ${endpoint}`);
  lastCall[endpoint][ip] = now;
  return true;
}
