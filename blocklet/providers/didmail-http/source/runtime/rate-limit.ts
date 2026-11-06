import { bindings } from './bindings';
export async function rateLimit(key: string, limit = 60, windowMs = 60_000) {
  const now = Date.now();
  const row = await bindings.DB.prepare(
    `INSERT INTO rate_limits (key, count, resetAt) VALUES (?, 1, ?)
    ON CONFLICT(key) DO UPDATE SET count = CASE WHEN resetAt <= ? THEN 1 ELSE MIN(count + 1, ?) END,
    resetAt = CASE WHEN resetAt <= ? THEN excluded.resetAt ELSE resetAt END RETURNING count`,
  )
    .bind(key, now + windowMs, now, limit + 1, now)
    .first<{ count: number }>();
  return row!.count <= limit;
}
