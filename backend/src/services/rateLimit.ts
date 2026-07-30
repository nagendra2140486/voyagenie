import { config, type Feature } from '../config.js';
import { query } from '../db.js';

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  used: number;
  remaining: number;
  resetsAt: string;
}

const hourWindow = (): Date => {
  const now = new Date();
  now.setUTCMinutes(0, 0, 0);
  return now;
};

/** Atomically increments the per-session, per-feature hourly counter in PostgreSQL. */
export const consumeRateLimit = async (sessionId: string, feature: Feature): Promise<RateLimitResult> => {
  const limit = config.rateLimitPerHour[feature];
  const windowStart = hourWindow();

  const rows = await query<{ request_count: number }>(
    `INSERT INTO rate_limit_counter (session_id, feature, hour_window, request_count)
     VALUES ($1, $2, $3, 1)
     ON CONFLICT (session_id, feature, hour_window)
     DO UPDATE SET request_count = rate_limit_counter.request_count + 1
     RETURNING request_count`,
    [sessionId, feature, windowStart],
  );

  const used = Number(rows[0]?.request_count ?? 1);
  const resetsAt = new Date(windowStart.getTime() + 60 * 60 * 1000).toISOString();
  return { allowed: used <= limit, limit, used, remaining: Math.max(0, limit - used), resetsAt };
};

export const getRateLimitUsage = async (sessionId: string): Promise<Record<string, RateLimitResult>> => {
  const windowStart = hourWindow();
  const rows = await query<{ feature: string; request_count: number }>(
    'SELECT feature, request_count FROM rate_limit_counter WHERE session_id = $1 AND hour_window = $2',
    [sessionId, windowStart],
  );
  const resetsAt = new Date(windowStart.getTime() + 60 * 60 * 1000).toISOString();
  const usage: Record<string, RateLimitResult> = {};
  for (const feature of Object.keys(config.rateLimitPerHour) as Feature[]) {
    const used = Number(rows.find((r) => r.feature === feature)?.request_count ?? 0);
    const limit = config.rateLimitPerHour[feature];
    usage[feature] = { allowed: used < limit, limit, used, remaining: Math.max(0, limit - used), resetsAt };
  }
  return usage;
};
