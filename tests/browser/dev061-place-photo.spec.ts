import { test, expect } from '@playwright/test';

const places = [
  { year: '2026', slug: 'r000266-25-stanjelski-tek', asset: 'stanjel-2020.webp', altSl: 'Pogled na Štanjel', altEn: 'View of Štanjel' },
  { year: '2027', slug: 'r000010-8-trail-celje', asset: 'celje-old-castle-view.webp', altSl: 'Pogled na Celje s starega gradu', altEn: 'View of Celje from the old castle' }
];

for (const place of places) for (const lang of ['sl', 'en'] as const) for (const width of [390, 768, 1440]) {
  test(`DEV-061 approved photo: ${place.asset} ${lang} ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.addInitScript(() => localStorage.setItem('stkAnalyticsOptOut', 'true'));
    await page.route('**/*', route => {
      const req = route.request();
      return new URL(req.url()).hostname === '127.0.0.1' && ['GET', 'HEAD'].includes(req.method())
        ? route.continue() : route.abort();
    });

    await page.goto(`${lang === 'sl' ? '/tek' : '/en/races'}/${place.year}/${place.slug}/`);
    const photo = page.locator('[data-stk-place-photo]');
    const img = photo.locator('img');
    await expect(photo).toHaveCount(1);
    await expect(img).toHaveAttribute('src', `/images/places/${place.asset}`);
    await expect(img).toHaveAttribute('alt', lang === 'sl' ? place.altSl : place.altEn);
    await expect(img).toHaveAttribute('loading', 'lazy');
    await img.scrollIntoViewIfNeeded();
    await expect.poll(() => img.evaluate(el => (el as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);

    const actions = await page.locator('.event-detail-primary-actions').boundingBox();
    const imageBox = await photo.boundingBox();
    const frame = await photo.locator('.stk-place-photo-frame').boundingBox();
    expect(actions && imageBox && frame).toBeTruthy();
    expect(imageBox!.y).toBeGreaterThanOrEqual(actions!.y + actions!.height);
    expect(frame!.height).toBeLessThanOrEqual(width <= 640 ? 160 : 220);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);

    await expect(photo).toContainText(lang === 'sl' ? 'Fotografija kraja, ne nujno štarta teka' : 'Photo of the place, not necessarily the race start');
    await expect(photo).toContainText(lang === 'sl' ? 'Izrez za prikaz' : 'Cropped for display');
    await expect(photo.locator('figcaption a')).toHaveCount(2);
    expect(await photo.locator('figcaption').evaluate(el => getComputedStyle(el).color)).toBe('rgb(242, 248, 250)');
  });
}

test('DEV-061 strict edition match keeps Kranj hidden until DEV-056 title is reconciled', async ({ page }) => {
  await page.goto('/tek/2026/r000261-kztl-2026-27-sv-jost-nad-kranjem-1-krog/');
  await expect(page.locator('[data-stk-place-photo]')).toHaveCount(0);
});
