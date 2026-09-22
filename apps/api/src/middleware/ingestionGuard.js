// Bounded, per-process limit. IPs stay only in memory, never in event documents.
// This is abuse mitigation, not proof of a human visitor.
export function rateLimit({ limit = 60, windowMs = 60000, maxClients = 10000 } = {}) {
  const clients = new Map();
  return (req, res, next) => {
    const now = Date.now();
    for (const [key, value] of clients) if (value.until <= now) clients.delete(key);
    const key = req.ip;
    let bucket = clients.get(key);
    if (!bucket) {
      if (clients.size >= maxClients) return res.status(429).json({ error: "rate_limited" });
      bucket = { count: 0, until: now + windowMs };
      clients.set(key, bucket);
    }
    if (++bucket.count > limit) {
      res.set("Retry-After", String(Math.ceil((bucket.until - now) / 1000)));
      return res.status(429).json({ error: "rate_limited" });
    }
    next();
  };
}

export function originGuard(allowedOrigins) {
  return (req, res, next) => {
    const origin = req.get("Origin");
    if (origin && !allowedOrigins.includes(origin)) {
      return res.status(403).json({ error: "origin_not_allowed" });
    }
    next();
  };
}
