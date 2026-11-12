import { expect, test } from '@playwright/test';

test.use({ timezoneId: 'America/Los_Angeles' });

const host = 'https://stk-master-api.igor-kalsek.workers.dev';
for (const lang of ['sl', 'en']) for (const width of [390, 1440]) {
  for (const state of ['success', 'same', 'empty', 'initial-down', 'http-error', 'network-error', 'timeout', 'invalid-json', 'old-contract', 'invalid-date', 'invalid-period', 'master-down'] as const) {
    test(`DEV-057 ${lang} ${width}px ${state}`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width, height: 900 });
      await page.clock.setFixedTime(new Date('2026-11-12T12:00:00Z'));
      const events = Array.from({ length: 24 }, (_, i) => ({
        year: i % 2 ? '2027' : '2026', row: String(37 + Math.floor(i / 2)),
        datum: `${i % 2 ? '2027' : '2026'}-12-${String(28 - i).padStart(2, '0')}`,
        naziv_prireditve: `Race ${i}`, kraj: 'Ljubljana',
        status_dogodka: 'potrjeno', vidno_v_javnem_koledarju: 'DA',
        recent_update_date: i < 4 ? '2026-11-12' : '2026-10-20', update_type: 'updated',
        public_summary: 'Podatki dogodka so bili posodobljeni.'
      }));
      let extendedRequests = 0;
      let fail = !['success', 'same', 'empty', 'master-down', 'initial-down'].includes(state);
      let release: (() => void) | undefined;
      const waiting = new Promise<void>(resolve => { release = resolve; });
      await page.route('**/api/interest-preview*', route => route.fulfill({ status: 503, body: '' }));
      const analytics: any[] = [];
      await page.route('https://script.google.com/**', route => {
        if (route.request().method() === 'POST') {
          try { analytics.push(JSON.parse(route.request().postData() || '{}')); } catch {}
        }
        return route.fulfill({ status: 204, body: '' });
      });
      const errors: string[] = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.route(`${host}/**`, async route => {
        const url = new URL(route.request().url());
        if (url.pathname === '/') {
          if (state === 'master-down' && url.searchParams.get('year') === '2027') return route.abort();
          return route.fulfill({ json: { data: events.filter(e => e.year === (url.searchParams.get('year') || '2026')) } });
        }
        if (url.pathname !== '/recent_updates') return route.fulfill({ json: { data: [] } });
        expect(url.searchParams.get('years')).toBe('2026,2027');
        const extended = url.searchParams.get('days') === '30';
        if (!extended && state === 'initial-down') return route.abort();
        expect(url.searchParams.get('limit')).toBe(extended ? '20' : '4');
        if (extended) {
          extendedRequests++;
          if (extendedRequests === 1 && state === 'success') await waiting;
          if (fail) {
            if (state === 'http-error') return route.fulfill({ status: 503, body: '' });
            if (state === 'network-error') return route.abort();
            if (state === 'timeout') { await new Promise(resolve => setTimeout(resolve, 12500)); return route.abort(); }
            if (state === 'invalid-json') return route.fulfill({ contentType: 'application/json', body: '{' });
          }
        }
        const selected = extended ? (state === 'same' ? events.slice(0, 4) : state === 'empty' ? [] : [events[0], events[0], ...events.slice(1)]) : events.slice(0, 4);
        return route.fulfill({ json: { ok: true, recent_updates_last_days: {
          years: extended && fail && state === 'old-contract' ? undefined : ['2026', '2027'],
          period: { from: extended && fail && state === 'invalid-period' ? '2026-02-30' : extended ? '2026-10-14' : '2026-11-06', to: '2026-11-12', days: extended ? 30 : 7 },
          events: extended && fail && state === 'invalid-date' ? [{ ...events[0], recent_update_date: 'bad' }] : selected,
          new_events: [...events].reverse()
        } } });
      });
      await page.goto(lang === 'sl' ? '/' : '/en/');
      const section = page.locator('section[aria-labelledby="updates-title"]');
      const cards = section.locator('.update-card');
      const button = section.locator('[data-updates-toggle]');
      await expect(button).toHaveAccessibleName(lang === 'sl' ? 'Poglejte več sprememb' : 'Show more updates');
      const status = section.getByRole('status');
      if (state === 'initial-down') {
        await expect(cards).toContainText(lang === 'sl' ? 'trenutno niso dosegljive' : 'currently unavailable');
      } else {
        await expect(cards).toHaveCount(4);
        await expect(cards.locator('h3')).toHaveText(events.slice(0, 4).map(e => e.naziv_prireditve));
      }
      await expect(button).toHaveAttribute('aria-controls', 'recent-updates');
      await expect(button).toHaveAttribute('aria-expanded', 'false');
      expect(extendedRequests).toBe(0);
      const initial = await section.locator('[data-recent-updates]').innerHTML();
      await button.focus();
      await page.keyboard.press('Enter');
      if (state === 'success') {
        await expect(button).toHaveAttribute('aria-disabled', 'true');
        await expect(section.locator('#recent-updates')).toHaveAttribute('aria-busy', 'true');
        await page.keyboard.press('Enter');
        expect(extendedRequests).toBe(1);
        release!();
      }
      if (fail) {
        await expect(status).toContainText(lang === 'sl' ? 'Poskusite znova' : 'Please try again', { timeout: 16000 });
        expect(await section.locator('[data-recent-updates]').innerHTML()).toBe(initial);
        await expect(button).toHaveAttribute('aria-expanded', 'false');
        await expect(button).toBeFocused();
        fail = false;
        await page.keyboard.press('Space');
      }
      await expect(button).toHaveAttribute('aria-expanded', 'true');
      await expect(button).toHaveAccessibleName(lang === 'sl' ? 'Pokažite manj' : 'Show fewer updates');
      await expect(button).toBeFocused();
      await expect(status).toContainText(lang === 'sl' ? '14. okt. 2026' : '14 Oct 2026');
      await expect(status).toContainText(lang === 'sl' ? '12. nov. 2026' : '12 Nov 2026');
      const count = state === 'same' ? 4 : state === 'empty' ? 0 : 20;
      if (count) {
        await expect(cards).toHaveCount(count);
        await expect(cards.locator('h3')).toHaveText(events.slice(0, count).map(e => e.naziv_prireditve));
        await expect(cards.first().locator('.update-event-meta time')).toHaveAttribute('datetime', '2026-12-28');
        await expect(cards.first().locator('.update-meta')).toContainText(lang === 'sl' ? '12. nov.' : '12 Nov');
        const snapshot = await cards.first().ariaSnapshot();
        expect(snapshot.indexOf(lang === 'sl' ? 'Datum teka' : 'Race date')).toBeLessThan(snapshot.indexOf('Race 0'));
        expect(await cards.first().locator('.update-event-meta').evaluate(e => parseFloat(getComputedStyle(e).fontSize))).toBeGreaterThan(await cards.first().locator('.update-meta').evaluate(e => parseFloat(getComputedStyle(e).fontSize)));
        await expect(cards.nth(1).locator('h3 a')).toHaveCount(state === 'master-down' ? 0 : 1);
        if (state !== 'master-down') await expect(cards.nth(1)).toHaveAttribute('data-analytics-event-year', '2027');
      } else await expect(cards).toContainText(lang === 'sl' ? '30 dneh' : '30 days');
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
      if (state === 'success') {
        await section.screenshot({ style: '.site-header, astro-dev-toolbar { visibility: hidden !important; }', path: testInfo.outputPath(`updates-${lang}-${width}.png`) });
        const link = cards.nth(1).locator('h3 a');
        await link.evaluate(e => e.addEventListener('click', event => event.preventDefault()));
        await link.click();
        await expect.poll(() => analytics.filter(e => e.event_type === 'event_card_clicked' && e.placement === 'home_updates').length).toBe(1);
        expect(analytics.find(e => e.event_type === 'event_card_clicked' && e.placement === 'home_updates')).toMatchObject({ event_year: '2027', event_key: '2027:r000037' });
      }
      await button.focus();
      await page.keyboard.press('Space');
      await expect(button).toHaveAttribute('aria-expanded', 'false');
      expect(await section.locator('[data-recent-updates]').innerHTML()).toBe(initial);
      if (state === 'initial-down') await expect(status).toBeEmpty();
      await expect(button).toBeFocused();
      await page.keyboard.press('Enter');
      await expect(button).toHaveAttribute('aria-expanded', 'true');
      expect(extendedRequests).toBe(['success', 'same', 'empty', 'master-down', 'initial-down'].includes(state) ? 1 : 2);
      const impressions = analytics.filter(e => e.event_type === 'race_card_impression' && e.placement === 'home_updates').map(e => `${e.event_year}:${e.event_id}`);
      expect(new Set(impressions).size).toBe(impressions.length);
      expect(errors).toEqual([]);
    });
  }
}
