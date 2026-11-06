const buckets = new Map<string, { count: number; resetAt: number }>();

export const rateLimit = (key: string, limit = 60, windowMs = 60_000): boolean => {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || b.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (b.count >= limit) return false;
  b.count += 1;
  return true;
};

// eslint-disable-next-line @typescript-eslint/naming-convention
export const __clearRateLimits = (): void => buckets.clear();
