import { chromium, expect } from '@playwright/test';
import { writeFileSync } from 'node:fs';
import { description } from './stress-preload.mjs';
const browser = await chromium.launch();
const results = [];
try {
  for (const language of ['sl', 'en']) for (const width of [390, 768, 1440]) {
    const page = await browser.newPage({ viewport: { width, height: 1000 } });
    await page.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1' && route.request().method() === 'GET' ? route.continue() : route.abort());
    await page.goto(`http://127.0.0.1:4321/${language === 'sl' ? 'tek' : 'en/races'}/2026/r000267-velenje-trail-2026/`);
    const details = page.locator('.registration-fee-details');
    await details.locator('summary').click();
    expect(await details.locator('p').textContent()).toBe(description);
    await expect(details.locator('img, script')).toHaveCount(0);
    expect(await page.evaluate(() => window.u03Unsafe)).toBeUndefined();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
    expect(await details.locator('p').evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
    if (width === 390) await details.screenshot({ path: `docs/evidence/ux-u03/stress-${language}-${width}.png` });
    results.push({ language, width, length: description.length, escaped: true, overflow: false });
    await page.close();
  }
  writeFileSync('docs/evidence/ux-u03/stress.json', JSON.stringify(results, null, 2) + '\n');
} finally { await browser.close(); }
