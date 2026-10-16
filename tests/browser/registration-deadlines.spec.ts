import { expect, test } from '@playwright/test';
import v2 from '../fixtures/profile-deadlines-v2.json' with { type: 'json' };

const cases = [
  { slug: 'r000254-4-lahinja-trail', date: '2026-11-04', name: 'Lahinja online cutoff' },
  { slug: 'r000255-obala-ultra-trail-powered-by-i-feel-slovenia', date: '2026-10-15', name: 'actual final cutoff' },
  { slug: 'r000259-tekaski-pozdrav-jeseni', date: '2026-11-04', name: 'combined online and cheaper cutoff' }
];

for (const language of ['sl', 'en']) {
  for (const width of [390, 768, 1440]) {
    test(`${language} at ${width}px: real deadline profiles before/on/after cutoff`, async ({ page }) => {
      const errors: string[] = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.route('**/*', route => {
        const request = route.request();
        // Browser smoke must never submit analytics, votes or production writes.
        if (!['GET', 'HEAD'].includes(request.method())) return route.abort();
        if (new URL(request.url()).pathname === '/deadlines') return route.abort();
        return route.continue();
      });
      await page.setViewportSize({ width, height: 1000 });
      for (const scenario of cases) {
        for (const offset of [-1, 0, 1]) {
          const now = new Date(Date.parse(scenario.date + 'T12:00:00Z') + offset * 86400000);
          await page.clock.install({ time: now });
          const prefix = language === 'sl' ? '/tek/2026/' : '/en/races/2026/';
          await page.goto(prefix + scenario.slug + '/');
          const deadline = page.locator('[data-registration-deadline][data-deadline-kind="registration"]');
          await expect(deadline).toHaveAttribute('data-registration-deadline-initialized', 'true');
          await expect(deadline).toHaveAttribute('data-deadline-date', scenario.date);
          const text = await deadline.innerText();
          expect(text).not.toMatch(/zapre|closes/i);
          if (offset === 0) expect(text).toBe(language === 'sl' ? 'Rok prijave je danes' : 'Registration deadline today');
          const source = deadline.locator('..').getByRole('link', { name: language === 'sl' ? 'Preverite pogoje prijave pri organizatorju' : 'Check registration terms with the organiser' });
          await expect(source).toHaveAttribute('href', /^https:\/\//);
          expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
          if (scenario.slug.includes('lahinja') && offset === 0) {
            await deadline.scrollIntoViewIfNeeded();
            await page.screenshot({ path: `/tmp/website-p2-${language}-${width}.png` });
          }
        }
      }
      expect(errors).toEqual([]);
    });
  }
}

// T17: frozen public production v2 response; all browser API traffic is isolated.
const pilots = [
  { slug: 'r000254-4-lahinja-trail', item: v2.items[1], sl: 'Rok spletnih prijav', en: 'Online registration deadline' },
  { slug: 'r000256-go4trail', item: v2.items[0], sl: 'Rok predprijav in rok cenejše prijave', en: 'Advance registration deadline and cheaper registration deadline' },
  { slug: 'r000265-23-miklavzev-tek-2026', item: v2.items[2], sl: 'Končni rok prijave', en: 'Final registration deadline' }
];

for (const language of ['sl', 'en'] as const) {
  for (const width of [390, 768, 1440]) {
    test(`v2 verified profiles ${language} at ${width}px`, async ({ page }) => {
      const errors: string[] = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.clock.install({ time: new Date('2026-10-16T12:00:00Z') });
      await page.setViewportSize({ width, height: 1000 });
      await page.route('**/*', route => {
        const request = route.request();
        const url = new URL(request.url());
        if (!['GET', 'HEAD'].includes(request.method())) return route.abort();
        if (url.hostname === 'stk-master-api.igor-kalsek.workers.dev') {
          if (url.pathname !== '/deadlines') return route.abort();
          expect(url.searchParams.get('contract')).toBe('2');
          expect(url.searchParams.get('year')).toBe('2026');
          return route.fulfill({ json: v2 });
        }
        return url.hostname === '127.0.0.1' ? route.continue() : route.abort();
      });
      for (const pilot of pilots) {
        const path = (language === 'sl' ? '/tek/2026/' : '/en/races/2026/') + pilot.slug + '/';
        await page.goto(path);
        const deadline = page.locator('[data-deadline-kind="registration"]');
        await expect(deadline).toHaveAttribute('data-deadline-v2-id', pilot.item.deadline_id);
        await expect(deadline).toHaveAttribute('data-deadline-date', pilot.item.deadline_date);
        await expect(deadline.locator('../..').locator('dt')).toHaveText(pilot[language]);
        await expect(deadline).toContainText(pilot[language]);
        await expect(deadline.locator('..').locator('[data-deadline-v2-source]')).toHaveAttribute('href', pilot.item.deadline_components[0].official_source);
        await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', `https://tekaski-koledar.si${path}`);
        expect(JSON.parse((await page.locator('script[type="application/ld+json"]').first().textContent())!)).toMatchObject({ '@type': 'Event', startDate: pilot.item.datum, url: `https://tekaski-koledar.si${path}` });
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        await expect(page.locator('[data-deadline-kind="early"][data-deadline-v2-id]')).toHaveCount(0);
        if (width === 390) {
          await deadline.scrollIntoViewIfNeeded();
          await page.screenshot({ path: `/tmp/dev031-t17-${language}-${pilot.item.race_id}.png` });
        }
      }
      expect(errors).toEqual([]);
    });
  }

  test(`v2 failures preserve #227 neutral fallback in ${language}`, async ({ page }) => {
    await page.clock.install({ time: new Date('2026-10-16T12:00:00Z') });
    await page.setViewportSize({ width: 390, height: 900 });
    let scenario = 'offline';
    let calls = 0;
    await page.route('**/*', route => {
      const request = route.request();
      const url = new URL(request.url());
      if (!['GET', 'HEAD'].includes(request.method())) return route.abort();
      if (url.hostname !== '127.0.0.1' && url.hostname !== 'stk-master-api.igor-kalsek.workers.dev') return route.abort();
      if (url.hostname !== 'stk-master-api.igor-kalsek.workers.dev') return route.continue();
      if (url.pathname !== '/deadlines') return route.abort();
      calls++;
      if (scenario === 'offline') return route.abort();
      if (scenario === 'timeout') return;
      if (scenario === 'http503') return route.fulfill({ status: 503, body: 'unavailable' });
      if (scenario === 'invalid-json') return route.fulfill({ body: '<html>failure</html>' });
      const payload = structuredClone(v2);
      if (scenario === 'v1') Reflect.deleteProperty(payload, 'contract_version');
      if (scenario === 'expired') payload.items[1].deadline_components[0].valid_until = '2026-10-15';
      if (scenario === 'wrong-id') payload.items[1].race_id = 'R000254';
      if (scenario === 'duplicate') payload.items.push(structuredClone(payload.items[1]));
      return route.fulfill({ json: payload });
    });
    for (scenario of ['offline', 'timeout', 'http503', 'invalid-json', 'v1', 'expired', 'wrong-id', 'duplicate']) {
      const previousCalls = calls;
      await page.goto((language === 'sl' ? '/tek/2026/' : '/en/races/2026/') + pilots[0].slug + '/');
      await expect.poll(() => calls).toBe(previousCalls + 1);
      if (scenario === 'timeout') await page.clock.runFor(12001);
      await page.waitForLoadState('networkidle');
      const deadline = page.locator('[data-deadline-kind="registration"]');
      await expect(deadline).toHaveText(language === 'sl' ? 'Rok prijave je čez 19 dni' : 'Registration deadline in 19 days');
      await expect(page.locator('[data-deadline-v2-id], [data-deadline-v2-source]')).toHaveCount(0);
      await expect(deadline.locator('../..').locator('dt')).toHaveText(language === 'sl' ? 'Rok prijave' : 'Registration deadline');
    }
  });

  test(`v2 expires at Ljubljana midnight in an open ${language} profile`, async ({ page }) => {
    await page.clock.install({ time: new Date('2026-10-22T21:59:00Z') });
    await page.route('**/*', route => {
      const request = route.request();
      const url = new URL(request.url());
      if (!['GET', 'HEAD'].includes(request.method())) return route.abort();
      if (url.hostname === 'stk-master-api.igor-kalsek.workers.dev' && url.pathname === '/deadlines') return route.fulfill({ json: v2 });
      return url.hostname === '127.0.0.1' ? route.continue() : route.abort();
    });
    await page.goto((language === 'sl' ? '/tek/2026/' : '/en/races/2026/') + pilots[0].slug + '/');
    const deadline = page.locator('[data-deadline-kind="registration"]');
    await expect(deadline).toHaveAttribute('data-deadline-v2-id', pilots[0].item.deadline_id);
    await page.clock.runFor(61000);
    await expect(page.locator('[data-deadline-v2-id], [data-deadline-v2-source]')).toHaveCount(0);
    await expect(deadline).toHaveText(language === 'sl' ? 'Rok prijave je čez 12 dni' : 'Registration deadline in 12 days');
    await expect(deadline.locator('../..').locator('dt')).toHaveText(language === 'sl' ? 'Rok prijave' : 'Registration deadline');
  });
}
