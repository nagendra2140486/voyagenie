import { expect, test } from '@playwright/test';

const NAV_ROUTES = [
  { path: '/', heading: 'Plan the trip you actually want' },
  { path: '/destinations', heading: 'Find your next trip' },
  { path: '/packages', heading: 'Curated travel packages' },
  { path: '/planner', heading: 'Generate a day-by-day itinerary' },
  { path: '/assistant', heading: 'Ask anything about your trip' },
  { path: '/budget', heading: 'Make your budget go further' },
  { path: '/trips', heading: 'Saved itineraries and budgets' },
  { path: '/about', heading: 'Travel planning that respects your time and your budget' },
  { path: '/contact', heading: 'Talk to a travel specialist' },
  { path: '/ai-governance', heading: 'AI usage, controls and audit log' },
];

test.describe('Voyagenie commercial journeys', () => {
  test('home page shows the catalogue highlights', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Plan the trip you actually want');
    await expect(page.getByTestId('destination-card').first()).toBeVisible();
    expect(await page.getByTestId('destination-card').count()).toBeGreaterThanOrEqual(3);
    expect(await page.getByTestId('package-card').count()).toBeGreaterThanOrEqual(1);
  });

  test('hero search leads to a destination detail page', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('hero-search').fill('Singapore');
    await page.getByRole('button', { name: 'Search' }).click();

    await expect(page).toHaveURL(/\/destinations\?q=Singapore/);
    const firstCard = page.getByTestId('destination-card').first();
    await expect(firstCard).toContainText('Singapore');
    await firstCard.getByRole('link', { name: 'Explore' }).click();

    await expect(page).toHaveURL(/\/destinations\/\d+$/);
    await expect(page.getByRole('heading', { name: 'Overview' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Top attractions' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Trip snapshot' })).toBeVisible();
  });

  test('destination filters narrow the catalogue', async ({ page }) => {
    await page.goto('/destinations');
    await expect(page.getByTestId('result-count')).toContainText('12 destinations found');

    await page.selectOption('#budget', 'low');
    await expect(page.getByTestId('result-count')).not.toContainText('12 destinations');
    for (const card of await page.getByTestId('destination-card').all()) {
      await expect(card).toContainText('low budget');
    }

    // Budget + country apply as AND: narrowing to a country still present in the
    // low-budget results must keep at least that destination and drop the others.
    const lowBudgetCount = await page.getByTestId('destination-card').count();
    const firstTitle = await page.getByTestId('destination-card').first().locator('.card__title').innerText();
    const country = firstTitle.split(', ')[1];

    await page.selectOption('#country', country);
    await expect(page.getByTestId('destination-card').first()).toBeVisible();
    expect(await page.getByTestId('destination-card').count()).toBeLessThanOrEqual(lowBudgetCount);
    for (const card of await page.getByTestId('destination-card').all()) {
      await expect(card).toContainText('low budget');
      await expect(card).toContainText(country);
    }
  });

  test('an unmatched filter combination shows the empty state', async ({ page }) => {
    await page.goto('/destinations?q=nowhere-that-exists');
    await expect(page.getByRole('heading', { name: 'No destinations match those filters' })).toBeVisible();
    await page.getByRole('button', { name: 'Clear filters' }).click();
    await expect(page.getByTestId('result-count')).toContainText('12 destinations found');
  });

  test('packages can be filtered by travel style', async ({ page }) => {
    await page.goto('/packages');
    await expect(page.getByTestId('package-card').first()).toBeVisible();
    expect(await page.getByTestId('package-card').count()).toBeGreaterThanOrEqual(5);

    await page.getByRole('button', { name: 'luxury', exact: true }).click();
    await expect(page.getByTestId('package-card').first()).toContainText('luxury');
    expect(await page.getByTestId('package-card').count()).toBeGreaterThanOrEqual(1);
  });

  test('a package hands its destination and duration to the planner', async ({ page }) => {
    await page.goto('/packages');
    await page.getByTestId('package-card').first().getByRole('link', { name: 'Plan this trip' }).click();
    await expect(page.locator('#destination')).toBeVisible();

    await expect(page).toHaveURL(/\/planner\?destination=.+&days=\d+/);
    await expect(page.locator('#destination')).not.toHaveValue('');
  });

  test('contact inquiry is accepted and given a reference', async ({ page }) => {
    await page.goto('/contact');
    await page.fill('#name', 'Playwright Tester');
    await page.fill('#email', 'playwright@example.com');
    await page.fill('#subject', 'Group booking');
    await page.fill('#message', 'We are planning a group trip for eight people in November.');
    await page.getByRole('button', { name: 'Send inquiry' }).click();

    await expect(page.getByTestId('success-alert')).toContainText('reference');
    // Fields reset so the form is ready for the next inquiry.
    await expect(page.locator('#name')).toHaveValue('');
  });

  test('contact form blocks an invalid email client-side', async ({ page }) => {
    await page.goto('/contact');
    await page.fill('#name', 'Playwright Tester');
    await page.fill('#email', 'not-an-email');
    await page.fill('#message', 'This message is long enough to satisfy the minimum length.');
    await page.getByRole('button', { name: 'Send inquiry' }).click();

    await expect(page.getByTestId('success-alert')).toHaveCount(0);
    expect(await page.locator('#email').evaluate((el: HTMLInputElement) => el.validity.valid)).toBe(false);
  });

  for (const route of NAV_ROUTES) {
    test(`route ${route.path} renders`, async ({ page }) => {
      await page.goto(route.path);
      await expect(page.getByRole('heading', { level: 1 })).toContainText(route.heading, { ignoreCase: true });
    });
  }

  test('unknown route renders the 404 page', async ({ page }) => {
    await page.goto('/no-such-page');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('404');
    await page.getByRole('link', { name: 'Back to home' }).click();
    await expect(page).toHaveURL(/\/$/);
  });
});
