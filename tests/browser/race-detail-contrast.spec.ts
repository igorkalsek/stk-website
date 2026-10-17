import { test, expect, type Page } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('stkAnalyticsOptOut', 'true'));
});

// Sample the rendered background with text hidden, so gradients, translucent
// chips and the page underneath are included without antialiased text pixels.
async function contrastReadings(page: Page) {
  const selectors = [
    '.event-detail-hero-chip strong', '.event-detail-hero-fact dt',
    '.event-detail-date-card-year', '.event-detail-date-line',
    '.event-detail-status-pill', '.organizer-confirmation-badge',
    '.event-detail-highlight-text strong', '.race-status-control .muted-note'
  ];
  const items = await page.evaluate((selectors) => selectors.flatMap(selector =>
    [...document.querySelectorAll<HTMLElement>(selector)].filter(e => e.getClientRects().length).map(e => {
      const r = e.getBoundingClientRect();
      return { selector, color: getComputedStyle(e).color, x: r.x, y: r.y + scrollY, w: r.width, h: r.height };
    })), selectors);
  const style = await page.addStyleTag({ content: selectors.map(s => `${s}, ${s} * { color: transparent !important; text-shadow: none !important; }`).join('\n') });
  const screenshot = (await page.screenshot({ fullPage: true })).toString('base64');
  await style.evaluate(e => e.remove());
  return page.evaluate(async ({ items, screenshot }) => {
    const image = new Image(); image.src = `data:image/png;base64,${screenshot}`; await image.decode();
    const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height;
    const ctx = canvas.getContext('2d')!; ctx.drawImage(image, 0, 0);
    const { data } = ctx.getImageData(0, 0, image.width, image.height);
    const luminance = (rgb: number[]) => rgb.map(v => {
      v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
    }).reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i], 0);
    return items.map(item => {
      const color = item.color.match(/[\d.]+/g)!.map(Number); const alpha = color[3] ?? 1;
      let minimum = Infinity;
      // Exclude rounded borders; scan the central text band across its width.
      for (let y = Math.ceil(item.y + item.h * .25); y < item.y + item.h * .75; y += 2) {
        for (let x = Math.ceil(item.x + Math.min(12, item.w * .1)); x < item.x + item.w - Math.min(12, item.w * .1); x += 2) {
          const offset = (y * image.width + x) * 4;
          const bg = Array.from(data.slice(offset, offset + 3));
          const fg = bg.map((v, i) => color[i] * alpha + v * (1 - alpha));
          const a = luminance(fg), b = luminance(bg);
          minimum = Math.min(minimum, (Math.max(a, b) + .05) / (Math.min(a, b) + .05));
        }
      }
      return { selector: item.selector, minimum };
    });
  }, { items, screenshot });
}

for (const width of [390, 430, 768, 1440]) {
  for (const lang of ['sl', 'en']) {
    for (const scenario of [
      { slug: 'r000256-go4trail', confirmed: false },
      { slug: 'r000256-go4trail', confirmed: true },
      { slug: 'r000048-24-mali-kraski-maraton-2026', confirmed: false }
    ]) {
      const { slug, confirmed } = scenario;
      test(`${slug} ${lang} ${width}px organizer ${confirmed ? 'confirmed' : 'unconfirmed'} @contrast`, async ({ page }) => {
        await page.setViewportSize({ width, height: 1000 });
        await page.clock.setFixedTime(new Date('2026-10-13T10:00:00+02:00'));
        await page.route('**/organizer-confirmations?year=2026', route => route.fulfill({ json: {
          ok: true, type: 'organizer_confirmations', year: '2026',
          events: confirmed ? [{ event_id: 'R000256', data_confirmed: true }] : []
        } }));
        await page.goto(`${lang === 'sl' ? '/tek' : '/en/races'}/2026/${slug}/`);
        const badge = page.locator('[data-organizer-confirmation-badge]');
        if (confirmed) await expect(badge).toBeVisible(); else await expect(badge).toBeHidden();
        const cta = page.locator('[data-organizer-confirmation-cta]');
        if (confirmed) await expect(cta).toBeHidden(); else await expect(cta).toBeVisible();
        if (!confirmed) {
          await page.locator('#event-detail-title').evaluate((e, lang) => {
            e.textContent = lang === 'sl'
              ? 'Mednarodni družinski gorski ultramaraton po najlepših poteh Slovenije – dolgi naziv prireditve 2026'
              : 'International family mountain ultramarathon along the most beautiful trails in Slovenia – long race title 2026';
          }, lang);
        }
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
        const clipped = await page.locator('#event-detail-title, .event-detail-hero-chip, .event-detail-hero-fact dd').evaluateAll(elements =>
          elements.filter(e => e.scrollWidth > e.clientWidth + 1).map(e => e.textContent));
        expect(clipped).toEqual([]);
        const readings = await contrastReadings(page);
        // Region now belongs to the location fact; only actual cup/family chips remain.
        expect(readings.filter(r => r.selector === '.event-detail-hero-chip strong')).toHaveLength(await page.locator('.event-detail-hero-chip strong').count());
        expect(readings.some(r => r.selector === '.event-detail-hero-fact dt')).toBe(true);
        for (const reading of readings) expect(reading.minimum, reading.selector).toBeGreaterThanOrEqual(4.5);
        console.log(JSON.stringify({ width, lang, confirmed, readings }));
        const save = page.locator('[data-saved-race-button]').first();
        await save.click(); await expect(save).toHaveAttribute('aria-pressed', 'true');
        await save.click(); await expect(save).toHaveAttribute('aria-pressed', 'false');
        await page.locator('[data-race-status-control]').selectOption('planning');
        await expect(page.locator('[data-race-status-control]')).toHaveValue('planning');
        await page.screenshot({ path: `test-results/dev020-${slug}-${lang}-${width}-${confirmed}.png`, fullPage: true });
      });
    }
  }
}
