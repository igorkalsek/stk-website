import { test, expect } from '@playwright/test';

const profiles = [
  { year: '2026', slug: 'r000256-go4trail', registration: true, past: false, today: '2026-11-07' },
  { year: '2026', slug: 'r000254-4-lahinja-trail', registration: true, past: true, today: '2026-11-09', combined: true },
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
        await page.clock.setFixedTime(new Date(`${profile.today ?? '2026-10-17'}T12:00:00Z`));
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

        const official = page.locator('.event-detail-official-actions').getByRole('link');
        await expect(official).toHaveCount(profile.registration && !profile.combined ? 2 : 1);
        for (const link of await official.all()) {
          await expect(link).toHaveAttribute('href', /^https:\/\//);
          await expect(link).toHaveAttribute('target', '_blank');
          if (await link.getAttribute('data-race-archive-only') === null) {
            await expect(link).toHaveAttribute('data-stk-event-id', /^R\d{6}$/);
            await expect(link).toHaveAttribute('data-stk-event-name', /\S/);
            await expect(link).toHaveAttribute('data-stk-event-date', new RegExp(`^${profile.year}-`));
            await expect(link).toHaveAttribute('data-stk-event-year', profile.year);
            await expect(link).toHaveAttribute('data-analytics-placement', 'race_detail');
          }
          const rect = await link.boundingBox();
          expect(rect!.height).toBeGreaterThanOrEqual(44);
        }
        const primary = official.first();
        const archive = page.locator('.event-detail-official-actions [data-race-archive-only]');
        const registrationCta = page.locator('.event-detail-official-actions [data-race-upcoming-only]');
        if (profile.past && profile.registration) {
          await expect(registrationCta).toBeHidden();
          await expect(archive).toBeVisible();
          await expect(archive).toHaveText(language === 'sl' ? /prijava \(arhiv\)$/i : /registration \(archive\)$/i);
          await expect(archive).toHaveAttribute('href', (await registrationCta.getAttribute('href'))!);
          expect(await primary.evaluate(e => getComputedStyle(e).backgroundColor)).not.toBe('rgb(240, 160, 48)');
        } else {
          await expect(archive).toBeHidden();
          await expect(primary).toHaveAttribute('data-analytics-link-type', profile.registration ? 'prijava' : 'razpis');
          expect(await primary.evaluate(e => getComputedStyle(e).backgroundColor)).toBe('rgb(240, 160, 48)');
        }
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
        const status = page.locator('.event-detail-status-pill');
        if (profile.past) await expect(status).toHaveText(language === 'sl' ? 'Pretekli tek' : 'Past race');
        else if (profile.today) await expect(status).toHaveText(language === 'sl' ? 'Danes' : 'Today');
        else await expect(status).toHaveText(language === 'sl' ? /^Prihaja čez/ : /^Coming in/);

        const disclaimer = page.locator('.event-detail-disclaimer');
        const registrationPrompt = disclaimer.getByText(language === 'sl' ? /Pred prijavo/ : /Before registering/);
        if (profile.past) await expect(registrationPrompt).toBeHidden();
        else await expect(registrationPrompt).toBeVisible();

        if (profile.combined) {
          await expect(page.getByRole('heading', { name: language === 'sl' ? 'Arhivske opombe' : 'Archive notes' })).toBeVisible();
          const archiveHeading = page.getByRole('heading', { name: language === 'sl' ? 'Arhiv prijav' : 'Registration archive' });
          await expect(archiveHeading).toBeVisible();
          const registration = archiveHeading.locator('..');
          await expect(registration.getByText('35–70 €', { exact: true })).toBeVisible();
          await expect(registration.locator('.registration-deadline-absolute').first()).toBeVisible();
          await expect(registration.locator('[data-registration-deadline]').first()).toBeHidden();
          await expect(registration.getByRole('link')).toHaveCount(0);
        }

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
