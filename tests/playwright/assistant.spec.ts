import { test, expect } from '@playwright/test';

const ASSISTANT_URL =
  'https://voyagenie-app.azurewebsites.net/assistant';

test.describe('AI Assistant Module', () => {

  test('Suggested Question Journey', async ({ page }) => {

    await page.goto(ASSISTANT_URL);

    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);

    await page
      .getByText('Is Singapore a good destination with young children?')
      .click();

    console.log('Suggested question clicked');

    await page.waitForTimeout(5000);

    await expect(
      page.getByText('For family trips')
    ).toBeVisible();

    console.log('Response displayed');

    await page.waitForTimeout(5000);
  });

  test('Custom User Question Journey', async ({ page }) => {

    await page.goto(ASSISTANT_URL);

    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);

    const questionBox =
      page.getByPlaceholder('Ask a travel question...');

    await questionBox.fill(
      'What is the best time to visit Japan?'
    );

    console.log('Question entered');

    await page.waitForTimeout(2000);

    await page.getByRole('button', {
      name: 'Send'
    }).click();

    console.log('Send clicked');

    await page.waitForTimeout(5000);

    await expect(
      page.getByText('What is the best time to visit Japan?')
    ).toBeVisible();

    console.log('Question visible in chat');

    await page.waitForTimeout(5000);
  });

  test('Multiple Custom Questions', async ({ page }) => {

    await page.goto(ASSISTANT_URL);

    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);

    const questions = [
      'What is the best time to visit Japan?',
      'How much budget is required for Singapore?',
      'What should I pack for Iceland?'
    ];

    const questionBox =
      page.getByPlaceholder('Ask a travel question...');

    for (const question of questions) {

      await questionBox.fill(question);

      await page.waitForTimeout(2000);

      await page.getByRole('button', {
        name: 'Send'
      }).click();

      console.log(`Sent question: ${question}`);

      await page.waitForTimeout(5000);
    }

    await page.waitForTimeout(10000);
  });

  test('Verify Send Button', async ({ page }) => {

    await page.goto(ASSISTANT_URL);

    await page.waitForLoadState('networkidle');

    const sendButton = page.getByRole('button', {
      name: 'Send'
    });

    await expect(sendButton).toBeVisible();

    console.log('Send button is visible');

    await page.waitForTimeout(5000);
  });

});