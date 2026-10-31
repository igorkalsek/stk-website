import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('stkAnalyticsOptOut', 'true'));
});

const api = 'https://stk-master-api.igor-kalsek.workers.dev';
const race = (overrides = {}) => ({ datum: '2027-02-10', naziv_prireditve: 'Tek', status_dogodka: 'potrjeno', vidno_v_javnem_koledarju: 'DA', ...overrides });

for (const lang of ['sl', 'en']) {
  for (const width of [320, 390, 641, 768, 1440]) {
    test(`${lang} yearly stats preserve 2026, links and accessible layout at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 1000 });
      let yearRequests = 0;
      let statsRequests = 0;
      let groupRequests = 0;
      await page.route(`${api}/**`, (route) => {
        const url = new URL(route.request().url());
        if (url.searchParams.get('year') === '2027') {
          yearRequests++;
          return route.fulfill({ json: { data: [race({ opombe_javne: 'Družinska prijava s popustom' }), race({ naziv_prireditve: 'Otroški tek', razdalje_km: '1' }), race({ opombe_javne: 'Otroški teki 200 m' }), race({ opombe_javne: 'Brezplačna prijava. Tek samo za polnoletne osebe (18+).' }), race({ status_dogodka: 'neuradno', opombe_javne: 'Družinam prijazno' }), race({ vidno_v_javnem_koledarju: 'NE' })] } });
        }
        if (url.pathname === '/stats') { statsRequests++; return route.fulfill({ json: { stats: { confirmed_public_events_total: 281, family_friendly_total: 138 } } }); }
        if (url.pathname === '/group-runs') { groupRequests++; return route.fulfill({ json: { row_count: 22 } }); }
        return route.fulfill({ json: { data: [] } });
      });
      await page.route('**/api/interest-preview*', (route) => route.fulfill({ json: { ok: true, type: 'interest_preview', items: [] } }));
      await page.goto(lang === 'sl' ? '/' : '/en/');
      const strip = page.locator('.home-stats-strip');
      const current = strip.getByRole('article', { name: 'STK 2026' });
      const future = strip.getByRole('article', { name: 'STK 2027' });
      await expect(current.locator('[data-stat]')).toHaveText(['281', '138', '22']);
      await expect(page.locator('[data-my-stk-global-stats] [data-stat]')).toHaveText(['281', '138', '22']);
      await expect(future.locator('[data-year-stat]')).toHaveText(['4', '2']);
      await expect(future).toContainText(lang === 'sl' ? 'Koledar se dopolnjuje' : 'Calendar in progress');
      await expect(future).toContainText(lang === 'sl' ? 'družinam prijaznih' : 'family-friendly');
      await expect(future.locator('[data-stat="group_runs_total"]')).toHaveCount(0);
      const finder = lang === 'sl' ? '/iskalnik-tekov/' : '/en/find-races/';
      await expect(current.getByRole('link')).toHaveAttribute('href', `${finder}?year=2026`);
      const link = future.getByRole('link', { name: lang === 'sl' ? 'Raziščite teke 2027' : 'Explore races in 2027' });
      await expect(link).toHaveAttribute('href', `${finder}?year=2027`);
      await link.focus();
      await expect(link).toBeFocused();
      expect(await link.evaluate((el) => getComputedStyle(el).outlineStyle)).not.toBe('none');
      const boxes = await Promise.all([current.boundingBox(), future.boundingBox()]);
      expect(boxes.every(Boolean)).toBe(true);
      if (width > 640) expect(boxes[0]!.y).toBe(boxes[1]!.y);
      else expect(boxes[1]!.y).toBeGreaterThan(boxes[0]!.y + boxes[0]!.height);
      const overlaps = await strip.evaluate((element) => {
        const intersects = (a: DOMRect, b: DOMRect) => a.left < b.right - 0.5 && b.left < a.right - 0.5 && a.top < b.bottom - 0.5 && b.top < a.bottom - 0.5;
        const problems: string[] = [];
        for (const card of element.querySelectorAll('.home-year-stats')) {
          const bounds = card.getBoundingClientRect();
          const parts = [...card.querySelectorAll('h2, small, p > span, a')];
          for (const [index, part] of parts.entries()) {
            const rect = part.getBoundingClientRect();
            if (rect.left < bounds.left || rect.right > bounds.right || rect.top < bounds.top || rect.bottom > bounds.bottom) problems.push('outside card');
            for (const other of parts.slice(index + 1)) if (intersects(rect, other.getBoundingClientRect())) problems.push('inner overlap');
          }
          const next = document.querySelector('.home-featured-upcoming')!;
          if (intersects(bounds, next.getBoundingClientRect())) problems.push('next section overlap');
        }
        return problems;
      });
      expect(overlaps).toEqual([]);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
      expect([yearRequests, statsRequests, groupRequests]).toEqual([1, 1, 1]);
      await page.screenshot({ path: `/tmp/stk-home-${lang}-${width}.png`, fullPage: false });
    });
  }
  for (const state of ['empty', 'missing', 'http-error', 'network-error', 'invalid-json', 'current-unavailable']) {
    test(`${lang} yearly stats show neutral values for ${state}`, async ({ page }) => {
      await page.route(`${api}/**`, (route) => {
        const url = new URL(route.request().url());
        if (url.searchParams.get('year') === '2027') {
          if (state === 'http-error') return route.fulfill({ status: 503, body: '' });
          if (state === 'network-error') return route.abort();
          if (state === 'invalid-json') return route.fulfill({ body: '{', contentType: 'application/json' });
          return route.fulfill({ json: state === 'empty' ? { data: [] } : state === 'current-unavailable' ? { data: [race()] } : {} });
        }
        if (state === 'current-unavailable') return route.fulfill({ status: 503 });
        if (url.pathname === '/stats') return route.fulfill({ json: { stats: { confirmed_public_events_total: 281, family_friendly_total: 138 } } });
        if (url.pathname === '/group-runs') return route.fulfill({ json: { row_count: 22 } });
        return route.fulfill({ json: { data: [] } });
      });
      await page.goto(lang === 'sl' ? '/' : '/en/');
      const missing = lang === 'sl' ? 'Ni podatka' : 'Not available';
      await expect(page.locator('[data-year-stat]')).toHaveText(state === 'current-unavailable' ? ['1', '0'] : [missing, missing]);
      await expect(page.locator('.home-stats-strip [data-stat]')).toHaveText(state === 'current-unavailable' ? Array(3).fill(lang === 'sl' ? 'Ni podatka' : 'No data') : ['281', '138', '22']);
    });
  }
}
