import { Trend } from 'k6/metrics';

export const API_URL = (__ENV.VOYAGENIE_API_URL || 'http://localhost:4000').replace(/\/$/, '');

/** AI latency budget. The default suits LLM_PROVIDER=mock; override with -e AI_P95_MS=... */
export const AI_P95_MS = Number(__ENV.AI_P95_MS || 1500);

/** One session per iteration: AI features are rate limited per session (10 itinerary,
 *  25 chat, 10 budget per hour), so a shared id would turn a long run into 429s. */
export const newSession = () => `k6-${__VU}-${__ITER}-${Date.now()}`;

export const headers = (session) => ({
  'content-type': 'application/json',
  'x-session-id': session,
});

/** Unique per call so `llm_cache` cannot absorb the request and we measure the provider path. */
export const uniqueSuffix = () => `${__VU}-${__ITER}-${Math.random().toString(36).slice(2, 8)}`;

export const trends = {
  catalogue: new Trend('journey_catalogue_ms', true),
  detail: new Trend('journey_destination_detail_ms', true),
  packages: new Trend('journey_packages_ms', true),
  contact: new Trend('journey_contact_ms', true),
  itinerary: new Trend('journey_ai_itinerary_ms', true),
  chat: new Trend('journey_ai_chat_ms', true),
  budget: new Trend('journey_ai_budget_ms', true),
  trips: new Trend('journey_trips_ms', true),
  governance: new Trend('journey_governance_ms', true),
};
