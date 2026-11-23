import { ApiError } from "./api";

type Bucket = { count: number; resetAt: number };

declare global {
  // eslint-disable-next-line no-var
  var __hookmergeBuckets: Map<string, Bucket> | undefined;
}

function buckets() {
  if (!globalThis.__hookmergeBuckets) globalThis.__hookmergeBuckets = new Map();
  return globalThis.__hookmergeBuckets;
}

export function clientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return req.headers.get("x-real-ip") || "local";
}

/** Fixed-window limiter. In-memory is intentional: single-node deployment. */
export function rateLimit(key: string, limit: number, windowMs: number) {
  const map = buckets();
  const now = Date.now();
  const bucket = map.get(key);

  if (!bucket || bucket.resetAt <= now) {
    map.set(key, { count: 1, resetAt: now + windowMs });
    if (map.size > 5000) {
      for (const [k, b] of map) if (b.resetAt <= now) map.delete(k);
    }
    return;
  }

  if (bucket.count >= limit) {
    const seconds = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
    throw new ApiError(
      "rate_limited",
      `Too many attempts. Try again in ${seconds}s.`,
      429,
      "Slow down and retry shortly.",
    );
  }
  bucket.count += 1;
}

export function limitByIp(req: Request, scope: string, limit: number, windowMs: number) {
  rateLimit(`${scope}:${clientIp(req)}`, limit, windowMs);
}
