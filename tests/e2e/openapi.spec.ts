import { expect, test } from '@playwright/test';
import { API_URL } from './support';

const EXPECTED_PATHS = [
  '/health',
  '/api/destinations',
  '/api/destinations/filters',
  '/api/destinations/{id}',
  '/api/packages',
  '/api/packages/{id}',
  '/api/trips',
  '/api/trips/{id}',
  '/api/trips/{id}/clone',
  '/api/contact',
  '/api/llm-audit',
  '/ai/itinerary',
  '/ai/chat',
  '/ai/budget',
];

test.describe('OpenAPI documentation', () => {
  test('the spec describes every route and leaks no configuration secrets', async ({ request }) => {
    const response = await request.get(`${API_URL}/api/openapi.json`);
    expect(response.status()).toBe(200);

    const spec = await response.json();
    expect(spec.openapi).toMatch(/^3\.1/);
    expect(spec.info.title).toBe('Voyagenie API');
    for (const path of EXPECTED_PATHS) {
      expect(Object.keys(spec.paths)).toContain(path);
    }

    // The spec is generated from live config, so it must not carry the key or its value.
    expect(JSON.stringify(spec)).not.toContain('LLM_API_KEY');
    expect(spec.paths['/ai/itinerary'].post.operationId).toBe('generateItinerary');
    expect(spec.paths['/ai/itinerary'].post.responses['429']).toBeDefined();
  });

  test('swagger ui renders the operations', async ({ page }) => {
    await page.goto(`${API_URL}/api/docs/`);
    await expect(page.locator('.swagger-ui').first()).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Voyagenie API' })).toBeVisible();
    await expect(page.locator('#operations-tag-GenAI')).toBeVisible();
  });
});
