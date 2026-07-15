import { expect, test } from '@playwright/test';

test('my races status source contracts are present', async ({ page }) => {
  await page.goto('/moji-teki/');
  await expect(page.locator('[data-my-races-app]')).toHaveAttribute('data-language', 'sl');
});
