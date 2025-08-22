const RATE_LIMIT_MS = 5000; // 5 seconds per IP
const lastCall = {};

export function rateLimiter(req, res) {
  const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress;
  const now = Date.now();

  if (lastCall[ip] && now - lastCall[ip] < RATE_LIMIT_MS) {
    res.status(429).json({ error: "Too many requests. Try again later." });
    return false;
  }

  lastCall[ip] = now;
  return true;
}
