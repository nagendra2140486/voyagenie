import { config as loadEnv } from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
loadEnv({ path: path.resolve(here, '../../.env') });

const num = (name: string, fallback: number): number => {
  const parsed = Number(process.env[name]);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export type Feature = 'itinerary' | 'chat' | 'budget';

export const config = {
  port: num('BACKEND_PORT', 4000),
  // Interactive docs are a development aid; production defaults to serving neither UI nor spec.
  docsEnabled: (process.env.API_DOCS_ENABLED ?? String(process.env.NODE_ENV !== 'production')) !== 'false',
  databaseUrl: process.env.DATABASE_URL ?? 'postgresql://voyagenie:voyagenie@localhost:5432/voyagenie',
  aiServiceUrl: (process.env.AI_SERVICE_URL ?? 'http://localhost:8000').replace(/\/$/, ''),
  corsOrigin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
  contactInquiriesPerHour: num('CONTACT_INQUIRIES_PER_HOUR', 5),
  isProduction: process.env.NODE_ENV === 'production',
  // Where the app is actually served from; the fallback origin when CORS_ORIGIN is a wildcard.
  publicOrigin: process.env.PUBLIC_ORIGIN ?? 'http://localhost:5173',
  llm: {
    provider: process.env.LLM_PROVIDER ?? 'mock',
    model: process.env.LLM_MODEL ?? 'mock-travel-1',
    timeoutSeconds: num('LLM_TIMEOUT_SECONDS', 60),
    maxInputChars: num('LLM_MAX_INPUT_CHARS', 2000),
    cacheEnabled: (process.env.LLM_CACHE_ENABLED ?? 'true') !== 'false',
  },
  rateLimitPerHour: {
    itinerary: num('RATE_LIMIT_ITINERARY_PER_HOUR', 10),
    chat: num('RATE_LIMIT_CHAT_PER_HOUR', 25),
    budget: num('RATE_LIMIT_BUDGET_PER_HOUR', 10),
  } satisfies Record<Feature, number>,
};
