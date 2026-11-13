import { test, expect } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';

// Public Worker descriptions observed 2026-11-14; no Sheets access or writes.
const velenje = 'Družinski trail: otroci brezplačno, odrasli 20 € do 31. 10. oziroma 25 € od 1.–20. 11.; Poskok 20/25 €, Pozoj 40/45 €, Mastodont 55/60 €.';
const donation = 'Ni klasične prijavnine; minimalna skupna donacija na ekipo 50 EUR oziroma najmanj 1 EUR na krog.';
const profiles = [
  { slug: 'r000267-velenje-trail-2026', amount: '0–60 €', description: velenje, past: false },
  { slug: 'r000268-14-goricatlon', amount: donation, past: false },
  { slug: 'r000254-4-lahinja-trail', amount: '35–70 €', past: true },
  { slug: 'r000064-23-bistriski-tek', amount: null, past: true }
];

for (const language of ['sl', 'en']) for (const width of [390, 768, 1440]) {
  test(`entry fee descriptions and archive: ${language} ${width}px`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.setViewportSize({ width, height: 1000 });
    await page.clock.setFixedTime(new Date('2026-11-14T12:00:00Z'));
    await page.addInitScript(() => localStorage.setItem('stkAnalyticsOptOut', 'true'));
    await page.route('**/*', route => {
      const request = route.request();
      return new URL(request.url()).hostname === '127.0.0.1' && request.method() === 'GET'
        ? route.continue() : route.abort();
    });
    const evidence: unknown[] = [];
    for (const profile of profiles) {
      await page.goto(`${language === 'sl' ? '/tek' : '/en/races'}/2026/${profile.slug}/`);
      const fee = page.locator('.event-detail-list > div').filter({ has: page.locator('dt', { hasText: language === 'sl' ? /^Startnina$/ : /^Entry fee$/ }) });
      const closed = await fee.count() ? await fee.innerText() : null;
      if (profile.amount === null) {
        await expect(fee).toHaveCount(0);
      } else {
        await expect(fee).toHaveCount(1);
        await expect(fee.locator('.registration-fee-value')).toHaveText(profile.amount);
        const details = fee.locator('details');
        if (profile.description) {
          await expect(details).not.toHaveAttribute('open');
          await expect(details.locator('p')).toBeHidden();
          const summary = details.locator('summary');
          await expect(summary).toHaveText(language === 'sl' ? 'Podrobnosti prijavnine' : 'Entry fee details');
          await summary.focus();
          await page.keyboard.press('Shift+Tab');
          await page.keyboard.press('Tab');
          await expect(summary).toBeFocused();
          expect(await summary.evaluate(el => getComputedStyle(el).outlineStyle)).toBe('solid');
          expect(await summary.evaluate(el => parseFloat(getComputedStyle(el).outlineWidth))).toBeGreaterThanOrEqual(2);
          await page.keyboard.press('Enter');
          await expect(details).toHaveAttribute('open', '');
          await expect(details.locator('p')).toHaveText(profile.description);
          await expect(details.locator('p')).toHaveAttribute('lang', 'sl');
          await expect(details.locator('p')).toBeVisible();
          await expect(fee.getByText(profile.description, { exact: true })).toHaveCount(1);
          await expect(fee.locator('.registration-fee-source')).toHaveCount(language === 'en' ? 1 : 0);
          if (language === 'en') await expect(fee.locator('small')).toHaveText('Organizer information in Slovenian');
          if (process.env.U03_EVIDENCE_DIR) {
            mkdirSync(process.env.U03_EVIDENCE_DIR, { recursive: true });
            await fee.locator('..').locator('..').screenshot({ path: `${process.env.U03_EVIDENCE_DIR}/${profile.slug}-${language}-${width}-open.png` });
          }
          await page.keyboard.press('Space');
          await expect(details).not.toHaveAttribute('open');
          await summary.click();
          await expect(details).toHaveAttribute('open', '');
        }
        if (profile.slug.includes('goricatlon')) {
          await expect(details).toHaveCount(0);
          await expect(fee.locator('.registration-fee-value')).toHaveAttribute('lang', 'sl');
          await expect(fee.locator('small')).toHaveCount(language === 'en' ? 1 : 0);
          const schema = JSON.parse((await page.locator('script[type="application/ld+json"]').textContent())!);
          expect(schema.offers?.price).toBeUndefined();
          await expect(page.locator('.event-detail-highlights').getByText(language === 'sl' ? 'Brezplačna možnost' : 'Free option', { exact: true })).toHaveCount(0);
        }
        // Check local overflow as well as the whole document, including open details.
        expect(await fee.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
        const heading = fee.locator('..').locator('..').getByRole('heading');
        await expect(heading).toHaveText(profile.past
          ? (language === 'sl' ? /Arhiv prijav/ : /Registration archive/)
          : (language === 'sl' ? /Prijava in udeležba/ : /Registration and participation/));
        if (process.env.U03_EVIDENCE_DIR && (profile.description || (language === 'sl' && width === 390 && profile.slug.includes('goricatlon')))) {
          await details.evaluateAll(elements => elements.forEach(el => el.removeAttribute('open')));
          await fee.locator('..').locator('..').screenshot({ path: `${process.env.U03_EVIDENCE_DIR}/${profile.slug}-${language}-${width}-closed.png` });
        }
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
      evidence.push({ language, width, slug: profile.slug, closed, text: await fee.count() ? await fee.textContent() : null, scrollWidth: await page.evaluate(() => document.documentElement.scrollWidth) });
    }
    if (process.env.U03_EVIDENCE_DIR) writeFileSync(`${process.env.U03_EVIDENCE_DIR}/${language}-${width}.json`, JSON.stringify(evidence, null, 2) + '\n');
    expect(errors).toEqual([]);
  });
}
