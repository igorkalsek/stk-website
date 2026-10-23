import { test, expect } from '@playwright/test';

const host = 'https://stk-master-api.igor-kalsek.workers.dev';
const races = [
  { row: 11, datum: '2027-05-15', naziv_prireditve: '45. Maraton treh src', kraj: 'Radenci' },
  { row: 12, datum: '2027-03-27', naziv_prireditve: 'Kras Trail 2027', kraj: 'Senožeče' },
  { row: 19, datum: '2027-03-07', naziv_prireditve: '4. Trail po kraških klancih 2027', kraj: 'Križ pri Sežani' },
  { row: 34, datum: '2027-02-20', naziv_prireditve: '7 ur Slivnice 2027', kraj: 'Cerknica' },
].map(race => ({ ...race, status_dogodka: 'potrjeno', vidno_v_javnem_koledarju: 'DA' }));
for (const en of [false, true]) for (const width of [390, 1440]) {
  const path = en ? '/en/for-organizers/' : '/za-organizatorje/';
  for (const mode of ['success', 'empty', 'http', 'network', 'incomplete', 'wrong-year', 'false', 'stale', 'ambiguous', 'master-error', 'invalid-json', 'long-title'] as const) {
    test(`${path} ${mode} at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 950 });
      const errors: string[] = [];
      const requests: string[] = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.route('https://script.google.com/**', route => route.fulfill({ status: 204 }));
      await page.route(`${host}/**`, route => {
        const url = new URL(route.request().url());
        requests.push(url.pathname + url.search);
        if (url.pathname === '/') return route.fulfill({ status: mode === 'master-error' ? 503 : 200, json: { ok: true, sheet: '2027', data: mode === 'ambiguous' ? [...races, races[0], races[1], races[2]] : mode === 'long-title' ? races.map(race => ({ ...race, naziv_prireditve: 'DolgoIme'.repeat(25), kraj: 'Kraj'.repeat(40) })) : races } });
        if (mode === 'network') return route.abort();
        if (mode === 'http') return route.fulfill({ status: 503, body: '' });
        if (mode === 'invalid-json') return route.fulfill({ body: '{', contentType: 'application/json' });
        if (mode === 'incomplete') return route.fulfill({ json: { ok: true } });
        // PENDING and stale snapshots do not appear in the upstream public projection.
        const events = ['empty', 'stale'].includes(mode) ? [] : [11, 12, 19].map(row => ({ event_id: `R${String(row).padStart(6, '0')}`, data_confirmed: mode !== 'false' }));
        return route.fulfill({ json: { ok: true, type: 'organizer_confirmations', year: mode === 'wrong-year' ? '2026' : '2027', events } });
      });
      await page.goto(path);
      await page.waitForLoadState('networkidle');
      const section = page.locator('[data-confirmed-races]');
      if (mode === 'success' || mode === 'long-title') {
        await expect(section).toBeVisible();
        if (mode === 'success') await expect(section.locator('h3')).toHaveText([races[2].naziv_prireditve, races[1].naziv_prireditve, races[0].naziv_prireditve]);
        await expect(section.locator('[data-organizer-confirmation-badge]')).toHaveCount(3);
        for (const badge of await section.locator('[data-organizer-confirmation-badge]').all()) await expect(badge).toBeVisible();
        await expect(section).not.toContainText('Slivnice');
        await expect(section.locator('time').first()).toHaveAttribute('datetime', '2027-03-07');
        if (mode === 'success') await expect(section.locator('[data-race-place]').first()).toHaveText('Križ pri Sežani');
        if (mode === 'success') await expect(section.locator('a').first()).toHaveAttribute('href', `${en ? '/en/races' : '/tek'}/2027/r000019-4-trail-po-kraskih-klancih-2027/`);
        await section.locator('a').first().focus();
        await expect(section.locator('a').first()).toBeFocused();
      } else {
        await expect.poll(() => requests.length).toBeGreaterThanOrEqual(2);
        await expect(section).toBeHidden();
        await expect(section.locator('li')).toHaveCount(0);
      }
      await expect(page.locator('#organizer-confirmation-title')).toHaveText(en ? 'Confirm your race information' : 'Potrdite podatke svojega teka');
      await expect(page.locator('[data-organizer-placement="confirmation"]')).toHaveAttribute('href', en ? '/en/find-races/' : '/iskalnik-tekov/');
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
      expect(errors).toEqual([]);
      expect(requests.filter(url => url.startsWith('/organizer-confirmations'))).toHaveLength(1);
    });
  }
}
