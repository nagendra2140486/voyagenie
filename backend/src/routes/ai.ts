import { Router } from 'express';
import { z } from 'zod';
import { config, type Feature } from '../config.js';
import { recordAudit } from '../services/audit.js';
import { callAiService } from '../services/aiClient.js';
import { promptHash, readCache, writeCache } from '../services/cache.js';
import { consumeRateLimit } from '../services/rateLimit.js';

export const aiRouter = Router();

export const itinerarySchema = z.object({
  destination: z.string().trim().min(2).max(120),
  days: z.number().int().min(1).max(30),
  budget: z.enum(['low', 'medium', 'high']).default('medium'),
  travel_type: z.string().trim().max(60).default('solo'),
  interests: z.array(z.string().trim().max(40)).max(8).default([]),
  // Field maxima sit above LLM_MAX_INPUT_CHARS so the prompt-length guardrail
  // produces the user-facing message instead of a generic validation error.
  constraints: z.string().trim().max(8000).default(''),
});

export const chatSchema = z.object({
  message: z.string().trim().min(1).max(8000),
  history: z
    .array(z.object({ role: z.enum(['user', 'assistant']), content: z.string().max(4000) }))
    .max(20)
    .default([]),
});

export const budgetSchema = z.object({
  destination: z.string().trim().min(2).max(120),
  days: z.number().int().min(1).max(30),
  budget_amount: z.number().positive().max(1_000_000),
  currency: z.string().trim().max(8).default('USD'),
  travellers: z.number().int().min(1).max(20).default(1),
  travel_style: z.string().trim().max(60).default('balanced'),
});

/** Total free-text characters counted against LLM_MAX_INPUT_CHARS. */
const freeTextLength = (payload: Record<string, unknown>): number =>
  Object.values(payload)
    .flatMap((value) => (Array.isArray(value) ? value : [value]))
    .filter((value): value is string => typeof value === 'string')
    .reduce((total, value) => total + value.length, 0);

interface FeatureRoute {
  feature: Feature;
  path: string;
  aiPath: string;
  schema: z.ZodTypeAny;
}

const ROUTES: FeatureRoute[] = [
  { feature: 'itinerary', path: '/itinerary', aiPath: '/generate-itinerary', schema: itinerarySchema },
  { feature: 'chat', path: '/chat', aiPath: '/travel-chat', schema: chatSchema },
  { feature: 'budget', path: '/budget', aiPath: '/budget-optimizer', schema: budgetSchema },
];

for (const route of ROUTES) {
  aiRouter.post(route.path, async (req, res) => {
    const sessionId = req.sessionId;
    const parsed = route.schema.safeParse(req.body);
    if (!parsed.success) {
      await recordAudit({
        sessionId,
        feature: route.feature,
        status: 'rejected_validation',
        detail: parsed.error.issues[0]?.message,
      });
      res.status(400).json({
        code: 'invalid_request',
        message: parsed.error.issues[0]?.message ?? 'Invalid request payload.',
      });
      return;
    }

    const payload = parsed.data as Record<string, unknown>;
    const promptChars = freeTextLength(payload);

    if (promptChars > config.llm.maxInputChars) {
      await recordAudit({ sessionId, feature: route.feature, status: 'rejected_prompt_length', promptChars });
      res.status(400).json({
        code: 'prompt_too_long',
        message: `Your input is ${promptChars} characters. The limit is ${config.llm.maxInputChars} characters.`,
      });
      return;
    }

    const hash = promptHash(route.feature, payload);
    const cached = await readCache(hash);
    if (cached) {
      await recordAudit({
        sessionId,
        feature: route.feature,
        status: 'success',
        detail: 'served from cache',
        promptChars,
        cached: true,
      });
      res.json({ ...cached, cached: true });
      return;
    }

    const limit = await consumeRateLimit(sessionId, route.feature);
    res.setHeader('x-ratelimit-limit', String(limit.limit));
    res.setHeader('x-ratelimit-remaining', String(limit.remaining));
    if (!limit.allowed) {
      await recordAudit({ sessionId, feature: route.feature, status: 'rejected_rate_limit', promptChars });
      res.status(429).json({
        code: 'rate_limited',
        message: `You have reached the hourly limit of ${limit.limit} ${route.feature} requests. Please try again after ${new Date(limit.resetsAt).toUTCString()}.`,
        rateLimit: limit,
      });
      return;
    }

    const result = await callAiService(route.aiPath, payload);
    if (!result.ok) {
      await recordAudit({
        sessionId,
        feature: route.feature,
        status: result.code === 'timeout' ? 'timeout' : 'error',
        detail: result.code,
        promptChars,
      });
      res.status(result.status).json({ code: result.code, message: result.message });
      return;
    }

    await recordAudit({
      sessionId,
      feature: route.feature,
      status: 'success',
      provider: result.meta?.provider,
      model: result.meta?.model,
      promptChars: result.meta?.prompt_chars ?? promptChars,
      tokenEstimate: result.meta?.token_estimate ?? 0,
      latencyMs: result.meta?.latency_ms ?? 0,
    });

    const response = { content: result.content, meta: result.meta };
    await writeCache(hash, route.feature, response);
    res.json({ ...response, cached: false, rateLimit: limit });
  });
}
