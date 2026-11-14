import { readFileSync } from 'node:fs';
import { test, expect } from '@playwright/test';

const samples = JSON.parse(readFileSync('tests/fixtures/u09-source-notes.json', 'utf8'));
const slugs = ['r000267-velenje-trail-2026', 'r000303-11-tek-obcine-menges-2026', 'r000311-kztl-2026-27-kalisce-1-krog'];
for (const width of [390, 768, 1440]) {
  test(`U09 source notes, fees, SEO and layout at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.clock.setFixedTime(new Date('2026-11-14T12:00:00Z'));
    await page.addInitScript(() => localStorage.setItem('stkAnalyticsOptOut', 'true'));
    await page.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1' && route.request().method() === 'GET' ? route.continue() : route.abort());
    for (const [i, slug] of slugs.entries()) {
      const path = `/en/races/2026/${slug}/`;
      await page.goto(path);
      await expect(page.locator('html')).toHaveAttribute('lang', 'en');
      const notes = page.locator('.event-detail-main-column > article p[lang="sl"]');
      expect(await notes.count()).toBeGreaterThan(0);
      const text = (await notes.allTextContents()).join(' ');
      for (const part of samples[i].opombe_javne.split(/(?<=\.)\s+(?=\p{Lu})/u)) expect(text).toContain(part);
      await expect(page.locator('.event-detail-main-column')).not.toContainText('Family activities are available.');
      await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', `https://tekaski-koledar.si${path}`);
      for (const lang of ['sl', 'en']) await expect(page.locator(`link[rel="alternate"][hreflang="${lang}"]`)).toHaveCount(1);
      if (i < 2) {
        const details = page.locator('.registration-fee-details');
        await details.locator('summary').focus();
        await page.keyboard.press('Enter');
        await expect(details.locator('p')).toHaveAttribute('lang', 'sl');
        await expect(details.locator('.registration-fee-source')).toHaveText('Organizer information in Slovenian');
        await expect(page.locator('.registration-fee-amount')).toHaveText(i === 0 ? '0–60 €' : '0–25 €');
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
      await page.screenshot({ path: `/tmp/u09-profile-${i}-${width}.png`, fullPage: true });
    }
    await page.goto('/en/for-organizers/');
    await expect(page.locator('#organizer-confirmation-title').locator('..')).toContainText('Verifying your email address alone does not confirm the race information.');
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    await page.screenshot({ path: `/tmp/u09-organizers-${width}.png`, fullPage: true });
  });

  test(`U09 full family source is accessible without guessing fee conditions at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.clock.setFixedTime(new Date('2026-11-14T12:00:00Z'));
    await page.addInitScript(() => localStorage.setItem('stkAnalyticsOptOut', 'true'));
    const base = JSON.parse(readFileSync('tests/fixtures/family-offers/public-events.json', 'utf8'))[1];
    const note = samples[0].opombe_javne;
    await page.route('https://stk-master-api.igor-kalsek.workers.dev/**', route => route.fulfill({ json: { data: new URL(route.request().url()).pathname === '/' ? [{ ...base, opombe_javne: note }] : [] } }));
    await page.goto('/en/family-friendly-races/');
    const source = page.locator('.family-source-note');
    await expect(source.locator('summary')).toHaveText('Source note (Slovenian)');
    await expect(source).not.toHaveAttribute('open');
    await source.locator('summary').focus();
    await page.keyboard.press('Enter');
    await expect(source.locator('p')).toHaveAttribute('lang', 'sl');
    await expect(source.locator('p')).toHaveText(note);
    await expect(page.locator('.family-note-row')).not.toContainText('Free participation for children or selected categories.');
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    await page.screenshot({ path: `/tmp/u09-family-${width}.png`, fullPage: true });
    await page.keyboard.press('Space');
    await expect(source).not.toHaveAttribute('open');
  });
}
