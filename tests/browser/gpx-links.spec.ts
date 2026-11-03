import { test, expect } from '@playwright/test';
import { GPX_LINKS } from '../../src/data/gpx-links';
import { buildEventDetailSlug } from '../../src/utils-event-detail';

for (const language of ['sl', 'en'] as const) for (const width of [390, 1440]) {
  test(`GPX edition allowlist, labels, safe links and layout: ${language} ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.addInitScript(() => localStorage.setItem('stkAnalyticsOptOut', 'true'));
    await page.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort());
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    for (const group of GPX_LINKS) {
      const e = group.edition;
      const slug = buildEventDetailSlug({ ...e, title: e.name, naziv_prireditve: e.name });
      await page.goto(`${language === 'sl' ? '/tek' : '/en/races'}/${e.year}/${slug}/`);
      const section = page.locator('[data-gpx-section]');
      await expect(section).toBeVisible();
      await expect(section.locator('h2')).toHaveText(language === 'sl' ? 'GPX-sledi in trase' : 'GPX tracks and routes');
      await expect(section.locator('.gpx-warning')).toContainText(language === 'sl' ? 'Njihova veljavnost za aktualno prireditev ni potrjena.' : 'Their validity for the current event is unconfirmed.');
      const links = section.locator('[data-analytics-link-type="gpx"]');
      await expect(links).toHaveCount(group.links.length);
      for (let i = 0; i < group.links.length; i++) {
        const link = group.links[i];
        const button = links.nth(i);
        await expect(button).toHaveAttribute('href', new URL(link.url).href);
        await expect(button).toHaveText(link.kind === 'ZIP' ? (language === 'sl' ? 'Odpri ZIP z GPX' : 'Open ZIP with GPX') : (language === 'sl' ? 'Odpri GPX' : 'Open GPX'));
        await expect(button).toHaveAttribute('target', '_blank');
        await expect(button).toHaveAttribute('rel', 'noopener noreferrer');
        await expect(button).toHaveAttribute('data-stk-event-year', e.year);
        const metadata = section.locator('.gpx-meta').nth(i);
        await expect(metadata).toContainText(link.year === null ? (language === 'sl' ? 'GPX-sled · letnica ni potrjena' : 'GPX track · year unconfirmed') : link.year < Number(e.year) ? (language === 'sl' ? `Arhivska GPX-sled ${link.year}` : `Archived GPX track ${link.year}`) : (language === 'sl' ? `GPX-sled z oznako ${link.year}` : `GPX track labelled ${link.year}`));
        const bounds = await button.boundingBox();
        expect(bounds!.height).toBeGreaterThanOrEqual(44);
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    }
    for (const path of ['/tek/2027/r000017-kocevsko-outdoor-festival-2027/', '/tek/2026/r000053-25-ormoski-polmaraton/']) {
      await page.goto(language === 'sl' ? path : path.replace('/tek/', '/en/races/'));
      await expect(page.locator('h1')).not.toHaveText('Tek ni najden');
      await expect(page.locator('[data-gpx-section]')).toHaveCount(0);
    }
    expect(errors).toEqual([]);
  });
}

test('existing analytics distinguishes archive GPX from ordinary route clicks with edition context', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.removeItem('stkAnalyticsOptOut');
    (window as any).__gpxBeacons = [];
    navigator.sendBeacon = (_url, data) => {
      (data as Blob).text().then(text => (window as any).__gpxBeacons.push(JSON.parse(text)));
      return true;
    };
  });
  await page.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort());
  await page.goto('/tek/2026/r000256-go4trail/');
  // Dispatch through the real delegated handler; prevent external navigation in this local test.
  await page.evaluate(() => document.addEventListener('click', event => event.preventDefault()));
  await page.locator('[data-gpx-section] [data-analytics-link-type="gpx"]').first().click();
  await page.locator('[data-analytics-link-type="trasa"]').first().click();
  await expect.poll(() => page.evaluate(() => (window as any).__gpxBeacons.filter((e: any) => e.event_type === 'external_link_clicked').map((e: any) => e.action_type))).toEqual(['gpx_click', 'route_click']);
  const events = await page.evaluate(() => (window as any).__gpxBeacons.filter((e: any) => e.event_type === 'external_link_clicked'));
  expect(events[0]).toMatchObject({ event_year: '2026', event_id: 'R000256', event_key: '2026:R000256', placement: 'race_detail', target_url: GPX_LINKS.find(e => e.edition.row === '256')!.links[0].url });
});
