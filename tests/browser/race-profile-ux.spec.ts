import { test, expect } from '@playwright/test';

const profiles = [
  { year: '2026', slug: 'r000256-go4trail', registration: true, past: false },
  { year: '2027', slug: 'r000017-kocevsko-outdoor-festival-2027', registration: true, past: false },
  { year: '2026', slug: 'r000053-25-ormoski-polmaraton', registration: true, past: true },
  { year: '2026', slug: 'r000064-23-bistriski-tek', registration: false, past: true },
  { year: '2027', slug: 'r000018-hrastnik-trail-2027', registration: false, past: false }
];

for (const language of ['sl', 'en']) {
  for (const width of [390, 430, 768, 1440]) {
    test(`profile content, actions and metadata: ${language} ${width}px`, async ({ page }) => {
      const errors: string[] = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.clock.setFixedTime(new Date('2026-10-17T12:00:00+02:00'));
      await page.setViewportSize({ width, height: width === 1440 ? 1000 : 844 });
      await page.addInitScript(() => {
        localStorage.setItem('stkAnalyticsOptOut', 'true');
        Object.defineProperty(navigator, 'clipboard', { value: { writeText: async () => {} }, configurable: true });
      });
      await page.route('**/*', route => {
        const request = route.request();
        const url = new URL(request.url());
        // Local UI checks must not submit production analytics or change remote data.
        if (!['GET', 'HEAD'].includes(request.method())) return route.abort();
        if (url.hostname === '127.0.0.1') return route.continue();
        if (url.pathname === '/organizer-confirmations') return route.fulfill({ json: {
          ok: true, type: 'organizer_confirmations', year: url.searchParams.get('year'), events: []
        } });
        return route.abort();
      });

      for (const profile of profiles) {
        const path = `${language === 'sl' ? '/tek' : '/en/races'}/${profile.year}/${profile.slug}/`;
        await page.goto(path);
        const hero = page.locator('.event-detail-profile-hero');
        await expect(hero.locator('time')).toHaveCount(1);
        await expect(hero.locator('time')).toHaveAttribute('datetime', new RegExp(`^${profile.year}-`));
        await expect(hero.locator('.event-detail-date-line')).toHaveCount(0);
        expect(await hero.locator('.event-detail-hero-chip strong').allTextContents()).not.toContain(language === 'sl' ? 'Regija' : 'Region');
        const facts = hero.locator('.event-detail-hero-fact dd');
        expect(await facts.evaluateAll(elements => elements.some(e => !e.textContent?.trim()))).toBe(false);
        const content = await page.locator('.event-detail-main-column').boundingBox();
        const tools = await page.locator('.event-detail-action-panel').boundingBox();
        expect(content).not.toBeNull(); expect(tools).not.toBeNull();
        if (width < 900) expect(content!.y + content!.height).toBeLessThanOrEqual(tools!.y);
        else expect(content!.x + content!.width).toBeLessThan(tools!.x);
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);

        const official = page.locator('.event-detail-official-actions a');
        await expect(official).toHaveCount(profile.registration ? 2 : 1);
        for (const link of await official.all()) {
          await expect(link).toHaveAttribute('href', /^https:\/\//);
          await expect(link).toHaveAttribute('target', '_blank');
          const rect = await link.boundingBox();
          expect(rect!.height).toBeGreaterThanOrEqual(44);
        }
        const primary = official.first();
        await expect(primary).toHaveAttribute('data-analytics-link-type', profile.registration ? 'prijava' : 'razpis');
        expect(await primary.evaluate(e => getComputedStyle(e).backgroundColor)).toBe('rgb(240, 160, 48)');
        await primary.focus();
        expect(await primary.evaluate(e => getComputedStyle(e).outlineStyle)).not.toBe('none');

        const canonical = `https://tekaski-koledar.si${path}`;
        await expect(page.locator('html')).toHaveAttribute('lang', language);
        await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', canonical);
        await expect(page.locator('meta[property="og:url"]')).toHaveAttribute('content', canonical);
        await expect(page.locator('meta[property="og:title"]')).toHaveAttribute('content', await page.title());
        await expect(page.locator('meta[property="og:image"]')).toHaveAttribute('content', 'https://tekaski-koledar.si/stk-logo.jpeg');
        await expect(page.locator('link[rel="alternate"][hreflang="sl"]')).toHaveCount(1);
        await expect(page.locator('link[rel="alternate"][hreflang="en"]')).toHaveCount(1);
        const schema = JSON.parse((await page.locator('script[type="application/ld+json"]').textContent())!);
        expect(schema).toMatchObject({ '@type': 'Event', url: canonical });
        expect(schema.startDate).toMatch(new RegExp(`^${profile.year}-`));
        if (profile.past) await expect(page.locator('.event-detail-status-pill')).toHaveText(language === 'sl' ? 'Dogodek je že mimo' : 'This race has already passed');

        if (profile.slug.includes('hrastnik')) {
          await expect(page.locator('.event-detail-hero-fact dt')).toHaveText(language === 'sl' ? ['Kraj / regija', 'Podlaga'] : ['Location / region', 'Surface']);
          await expect(page.locator('.event-detail-highlights')).toHaveCount(0);
          await expect(page.locator('[data-registration-deadline]')).toHaveCount(0);
        }
        const save = page.locator('.event-detail-my-race-panel [data-saved-race-button]');
        for (const control of [save, page.locator('[data-race-status-control]')]) {
          const rect = (await control.boundingBox())!;
          expect(rect.width).toBeGreaterThanOrEqual(44);
          expect(rect.height).toBeGreaterThanOrEqual(44);
          await page.keyboard.press('Tab');
          await control.focus();
          await expect(control).toBeFocused();
          expect(await control.evaluate(e => getComputedStyle(e).outlineStyle)).not.toBe('none');
        }
        await expect(page.locator('[data-race-status-control]')).toHaveAccessibleName(language === 'sl' ? 'Moj status' : 'My status');
        await save.click(); await expect(save).toHaveAttribute('aria-pressed', 'true');
        await page.locator('[data-race-status-control]').selectOption('planning');
        await expect(page.locator('[data-race-status-control]')).toHaveValue('planning');
        await page.reload(); await expect(save).toHaveAttribute('aria-pressed', 'true');
        await expect(page.locator('[data-race-status-control]')).toHaveValue('planning');
        await save.click(); await expect(save).toHaveAttribute('aria-pressed', 'false');
        await expect(page.locator('[data-analytics-calendar-type="google"]')).toHaveAttribute('href', /calendar\.google\.com/);
        await expect(page.locator('[data-analytics-calendar-type="ics"]')).toHaveAttribute('download', /\.ics$/);
        await page.locator('[data-copy-share-url]').click();
        await expect(page.locator('[data-share-feedback]')).toContainText(language === 'sl' ? 'kopirana' : 'copied');
      }
      expect(errors).toEqual([]);
    });
  }
}
