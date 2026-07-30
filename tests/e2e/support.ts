import type { APIRequestContext } from '@playwright/test';
import { API_URL } from '../playwright.config';

export { API_URL };

/** Unique per call, so each test gets its own rate-limit bucket and trip list. */
export const sessionId = (label: string): string => `pw-${label}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export const api = (path: string): string => `${API_URL}${path}`;

interface AiCallOptions {
  session: string;
  path: '/ai/itinerary' | '/ai/chat' | '/ai/budget';
  body: Record<string, unknown>;
}

export const callAi = (request: APIRequestContext, { session, path, body }: AiCallOptions) =>
  request.post(api(path), { headers: { 'x-session-id': session }, data: body, failOnStatusCode: false });

/** A payload no other run has used, so the response cache can't absorb the call. */
export const uniqueItinerary = (label: string, index: number) => ({
  destination: `Test City ${label}-${index}`,
  days: 2,
  budget: 'low',
  travel_type: 'solo',
  interests: [] as string[],
});
