import { expect, test } from '@playwright/test';

/**
 * Runs against LLM_PROVIDER=mock, so itinerary/chat/budget content is deterministic
 * and no provider spend is incurred. Each test gets a fresh browser context, hence a
 * fresh x-session-id — trips and rate-limit counters never leak between tests.
 */
test.describe('Voyagenie GenAI journeys', () => {
  test('generates an itinerary and saves it to My Trips', async ({ page }) => {
    await page.goto('/planner');
    await page.fill('#destination', 'Singapore');
    await page.fill('#days', '3');
    await page.getByRole('button', { name: 'Generate itinerary' }).click();

    await expect(page.getByTestId('itinerary-output')).toContainText('Day 1');
    await expect(page.locator('.meta-bar')).toContainText('provider: mock');

    await page.getByRole('button', { name: 'Save to My Trips' }).click();
    await expect(page.getByTestId('success-alert')).toContainText('3-day Singapore trip');

    await page.goto('/trips');
    await expect(page.getByTestId('trip-item')).toHaveCount(1);
    await expect(page.getByTestId('trip-detail')).toContainText('Day 1');
  });

  test('repeating an identical request is served from cache', async ({ page }) => {
    await page.goto('/planner');
    await page.fill('#destination', 'Kyoto');
    await page.fill('#days', '2');

    await page.getByRole('button', { name: 'Generate itinerary' }).click();
    await expect(page.getByTestId('itinerary-output')).toContainText('Day 1');

    await page.getByRole('button', { name: 'Generate itinerary' }).click();
    await expect(page.getByTestId('itinerary-output')).toContainText('Day 1');
    await expect(page.locator('.meta-bar')).toContainText('served from cache');
  });

  test('assistant answers and keeps conversation history', async ({ page }) => {
    await page.goto('/assistant');
    const log = page.getByTestId('chat-log');

    await page.getByTestId('chat-input').fill('What is the best time of year to visit Japan?');
    await page.getByTestId('chat-input').press('Enter');
    await expect(log.locator('.bubble--user')).toHaveCount(1);
    await expect(log.locator('.bubble--ai')).toHaveCount(2); // greeting + answer

    await page.getByTestId('chat-input').fill('And what should I pack?');
    await page.getByTestId('chat-input').press('Enter');
    await expect(log.locator('.bubble--user')).toHaveCount(2);
    await expect(log.locator('.bubble--ai')).toHaveCount(3);
    await expect(page.locator('.meta-bar')).toContainText('model: mock-travel-1');
  });

  test('a suggested question can be sent from the sidebar', async ({ page }) => {
    await page.goto('/assistant');
    await page.getByRole('button', { name: 'What should I pack for Iceland in winter?' }).click();
    await expect(page.getByTestId('chat-log').locator('.bubble--ai')).toHaveCount(2);
  });

  test('budget optimizer returns a category breakdown', async ({ page }) => {
    await page.goto('/budget');
    await page.fill('#destination', 'Bali');
    await page.fill('#amount', '1800');
    await page.getByRole('button', { name: 'Optimize my budget' }).click();

    await expect(page.getByTestId('budget-output')).toContainText('Accommodation');
    await expect(page.locator('.meta-bar')).toContainText('provider: mock');
  });

  test('saved trips can be viewed, renamed, cloned and deleted', async ({ page }) => {
    await page.goto('/planner');
    await page.fill('#destination', 'Lisbon');
    await page.fill('#days', '3');
    await page.getByRole('button', { name: 'Generate itinerary' }).click();
    await expect(page.getByTestId('itinerary-output')).toContainText('Day 1');
    await page.getByRole('button', { name: 'Save to My Trips' }).click();
    await expect(page.getByTestId('success-alert')).toBeVisible();

    await page.goto('/trips');
    const trips = page.getByTestId('trip-item');
    await expect(trips).toHaveCount(1);

    // Rename goes through window.prompt.
    page.once('dialog', (dialog) => dialog.accept('Lisbon long weekend'));
    await trips.first().getByRole('button', { name: 'Rename' }).click();
    await expect(trips.first()).toContainText('Lisbon long weekend');

    await trips.first().getByRole('button', { name: 'Clone' }).click();
    await expect(trips).toHaveCount(2);

    await trips.first().getByRole('button', { name: 'Delete' }).click();
    await expect(trips).toHaveCount(1);

    await trips.first().getByRole('button', { name: 'View' }).click();
    await expect(page.getByTestId('trip-detail')).toContainText('Day 1');
  });

  test('My Trips shows the empty state for a fresh session', async ({ page }) => {
    await page.goto('/trips');
    await expect(page.getByRole('heading', { name: 'No saved trips yet' })).toBeVisible();
  });
});
