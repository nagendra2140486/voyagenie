import { Router } from 'express';
import { z } from 'zod';
import { config } from '../config.js';
import { auditSummary, listAudit } from '../services/audit.js';
import { getRateLimitUsage } from '../services/rateLimit.js';
import { query } from '../db.js';


export const governanceRouter = Router();

export const auditQuerySchema = z.object({ limit: z.coerce.number().int().min(1).max(200).default(50) });

governanceRouter.get('/llm-audit', async (req, res) => {
  const parsed = auditQuerySchema.safeParse(req.query);
  const limit = parsed.success ? parsed.data.limit : 50;
  const [entries, summary, usage, cache] = await Promise.all([
    listAudit(limit),
    auditSummary(),
    getRateLimitUsage(req.sessionId),
    query<{ count: string }>('SELECT COUNT(*)::text AS count FROM llm_cache'),
  ]);
  res.json({
    entries,
    summary,
    rateLimitUsage: usage,
    cacheEntries: Number(cache[0]?.count ?? 0),
    // Only non-secret configuration is exposed; the API key never leaves the server.
    llmConfig: {
      provider: config.llm.provider,
      model: config.llm.model,
      apiKeyConfigured: Boolean(process.env.LLM_API_KEY),
      timeoutSeconds: config.llm.timeoutSeconds,
      maxInputChars: config.llm.maxInputChars,
      cacheEnabled: config.llm.cacheEnabled,
      rateLimitPerHour: config.rateLimitPerHour,
    },
  });
});
