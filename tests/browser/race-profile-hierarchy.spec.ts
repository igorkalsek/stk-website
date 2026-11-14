import { test, expect } from '@playwright/test';

const slug = 'r000267-velenje-trail-2026';
for (const language of ['sl', 'en']) for (const width of [390, 768, 1440]) {
  test(`DEV-059 hierarchy, deadlines, keyboard and saved state: ${language} ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.clock.setFixedTime(new Date('2026-11-14T12:00:00Z'));
    await page.addInitScript(() => localStorage.setItem('stkAnalyticsOptOut', 'true'));
    await page.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1' && route.request().method() === 'GET' ? route.continue() : route.abort());
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`${language === 'sl' ? '/tek' : '/en/races'}/2026/${slug}/`);
    const fee = page.locator('.registration-fee-value');
    const deadline = page.locator('[data-deadline-kind="registration"]').locator('..').locator('.registration-deadline-absolute');
    const feeBox = (await fee.boundingBox())!;
    const deadlineBox = (await deadline.boundingBox())!;
    console.log(JSON.stringify({ language, width, feeY: feeBox.y, deadlineY: deadlineBox.y, deadlineBottom: deadlineBox.y + deadlineBox.height }));
    // Audit coordinates refer to the top of the visible value, as in the before/after evidence.
    if (width < 900) {
      const limit = width === 390 ? 800 : 950;
      expect(feeBox.y).toBeLessThanOrEqual(limit);
      expect(deadlineBox.y).toBeLessThanOrEqual(limit);
    }
    const registration = page.locator('.event-detail-info-card-grid article').first();
    const save = page.locator('.event-detail-my-race-panel [data-saved-race-button]');
    expect((await registration.boundingBox())!.y + (await registration.boundingBox())!.height).toBeLessThan((await save.boundingBox())!.y);
    expect(await registration.locator('.registration-deadline-detail dt').allTextContents()).toEqual(language === 'sl' ? ['Rok prijave', 'Cenejša prijava'] : ['Registration deadline', 'Cheaper registration']);
    expect(await page.locator('.event-detail-highlight-text strong').allTextContents()).not.toContain(language === 'sl' ? 'Razdalje' : 'Distances');
    await expect(page.locator('.event-detail-info-card-grid')).toContainText(language === 'sl' ? 'Višinski vzpon (razdalja ni navedena)' : 'Elevation gain (distance unspecified)');
    await expect(page.locator('.event-detail-hero-badges')).toHaveCount(0);
    await expect(page.getByRole('heading', { name: language === 'sl' ? 'Družine in otroci' : 'Families and children' })).toBeVisible();
    await expect(page.locator('.event-detail-highlights')).toContainText(language === 'sl' ? 'Brezplačna možnost' : 'Free option');

    // Traverse real DOM order from official actions through fee details to the moved tools.
    const lastOfficial = page.locator('.event-detail-official-actions a:visible').last();
    await lastOfficial.focus();
    await page.keyboard.press('Tab');
    const summary = page.locator('.registration-fee-details summary');
    await expect(summary).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.locator('.registration-fee-details')).toHaveAttribute('open', '');
    await page.keyboard.press('Space');
    await expect(page.locator('.registration-fee-details')).not.toHaveAttribute('open');
    let reachedSave = false;
    for (let i = 0; i < 12; i++) {
      await page.keyboard.press('Tab');
      if (await save.evaluate(el => el === document.activeElement)) { reachedSave = true; break; }
    }
    expect(reachedSave).toBe(true);
    expect(await save.evaluate(el => getComputedStyle(el).outlineStyle)).toBe('solid');
    await page.keyboard.press('Enter');
    await expect(save).toHaveAttribute('aria-pressed', 'true');
    await page.keyboard.press('Tab');
    const status = page.locator('[data-race-status-control]');
    await expect(status).toBeFocused();
    await page.keyboard.press('p');
    await page.keyboard.press('Enter');
    await expect(status).toHaveValue('planning');
    await page.reload();
    await expect(status).toHaveValue('planning');
    await expect(save).toHaveAttribute('aria-pressed', 'true');
    // A past free option must not leave an empty highlights heading behind.
    await page.clock.setFixedTime(new Date('2026-12-06T12:00:00Z'));
    await page.reload();
    await expect(page.locator('.event-detail-highlights')).toBeHidden();
    await expect(fee).toHaveText('0–60 €');
    await expect(page.locator('.event-detail-official-actions [data-race-archive-only]')).toBeVisible();
    await page.clock.setFixedTime(new Date('2026-11-14T12:00:00Z'));
    await page.reload();
    await page.locator('.event-detail-language-switch a').click();
    await expect(page.locator('html')).toHaveAttribute('lang', language === 'sl' ? 'en' : 'sl');
    await expect(status).toHaveValue('planning');
    await expect(save).toHaveAttribute('aria-pressed', 'true');
    await page.locator('.event-detail-breadcrumb a').click();
    await page.locator('[data-year-link="2027"]').click();
    await expect(page).toHaveURL(/year=2027/);
    await page.locator('[data-year-link="2026"]').click();
    await expect(page).toHaveURL(/\/(?:iskalnik-tekov|en\/find-races)\/$/);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    expect(errors).toEqual([]);
  });
}
