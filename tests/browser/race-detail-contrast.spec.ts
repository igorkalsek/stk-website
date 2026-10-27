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

// DEV-024: the profile badge sits under the title; only the matching edition's
// confirmation action is hidden after the existing projection validates it.
const confirmationProfiles = [
  { year: '2027', id: 'R000011', slug: 'r000011-45-maraton-treh-src' },
  { year: '2027', id: 'R000012', slug: 'r000012-kras-trail-2027' },
  { year: '2027', id: 'R000019', slug: 'r000019-4-trail-po-kraskih-klancih-2027' },
  { year: '2026', id: 'R000256', slug: 'r000256-go4trail' },
];
for (const lang of ['sl', 'en']) for (const width of [390, 1440]) {
  for (const mode of ['confirmed', 'pending-email', 'pending-confirmation', 'email-only', 'empty', 'false', 'wrong-year', 'wrong-event', 'http', 'network', 'json'] as const) {
    test(`profile confirmation placement ${lang} ${width}px ${mode}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 1000 });
      const errors: string[] = [];
      page.on('pageerror', error => errors.push(error.message));
      let calls = 0;
      let active = confirmationProfiles[0];
      await page.route('**/*', route => {
        const request = route.request();
        const url = new URL(request.url());
        if (!['GET', 'HEAD'].includes(request.method())) return route.abort();
        if (url.hostname === '127.0.0.1') return route.continue();
        if (url.pathname !== '/organizer-confirmations') return route.abort();
        calls++;
        expect(url.searchParams.get('year')).toBe(active.year);
        if (mode === 'network') return route.abort();
        if (mode === 'http') return route.fulfill({ status: 503 });
        if (mode === 'json') return route.fulfill({ body: '{', contentType: 'application/json' });
        return route.fulfill({ json: {
          ok: true, type: 'organizer_confirmations', year: mode === 'wrong-year' ? '2026' : active.year,
          events: mode === 'empty' ? [] : [{ event_id: mode === 'wrong-event' ? 'R000034' : active.id,
            ...(mode === 'confirmed' || mode.startsWith('wrong-') ? { data_confirmed: true } :
              mode === 'false' ? { data_confirmed: false } : { ...(mode === 'email-only' ? {} : { status: mode === 'pending-email' ? 'PENDING_EMAIL' : 'PENDING_CONFIRMATION' }), email_verified: true }) }]
        } });
      });
      const profiles = mode === 'confirmed' ? confirmationProfiles : [confirmationProfiles[0]];
      for (const profile of profiles) {
        active = profile;
        calls = 0;
        await page.goto(`${lang === 'sl' ? '/tek' : '/en/races'}/${profile.year}/${profile.slug}/`);
        await page.waitForLoadState('networkidle');
        const badge = page.locator('[data-organizer-confirmation-badge]');
        await expect(badge).toHaveCount(1);
        await expect(badge).toHaveText(lang === 'sl' ? '✓ Podatke potrdil organizator' : '✓ Data confirmed by organizer');
        expect(await badge.evaluate(e => e.previousElementSibling?.id)).toBe('event-detail-title');
        expect(await badge.evaluate(e => e.nextElementSibling?.classList.contains('event-detail-hero-facts'))).toBe(true);
        await expect(page.locator('.event-detail-organizer-panel [data-organizer-confirmation-badge]')).toHaveCount(0);
        const cta = page.locator('[data-organizer-confirmation-cta]');
        if (mode === 'confirmed') {
          await expect(badge).toBeVisible();
          await expect(cta).toBeHidden();
          const positions = await page.evaluate(() => {
            const title = document.querySelector('#event-detail-title')!.getBoundingClientRect();
            const badge = document.querySelector('[data-organizer-confirmation-badge]')!.getBoundingClientRect();
            const facts = document.querySelector('.event-detail-hero-facts')!.getBoundingClientRect();
            return { titleBottom: title.bottom, badgeTop: badge.top, badgeBottom: badge.bottom, factsTop: facts.top };
          });
          expect(positions.badgeTop).toBeGreaterThanOrEqual(positions.titleBottom);
          expect(positions.factsTop).toBeGreaterThan(positions.badgeBottom);
        } else {
          await expect(badge).toBeHidden();
          await expect(cta).toBeVisible();
        }
        const confirmationUrl = new URL((await cta.getAttribute('href'))!, 'http://127.0.0.1:4321');
        expect(confirmationUrl.searchParams.get('year')).toBe(profile.year);
        expect(confirmationUrl.searchParams.get('eventKey')).toBe(profile.id.toLowerCase());
        const correction = page.locator('.event-detail-organizer-actions a').last();
        await expect(correction).toBeVisible();
        await expect(correction).toHaveText(lang === 'sl' ? 'Predlagajte popravek ali dopolnitev' : 'Suggest an update or correction');
        await expect(correction).toHaveAttribute('href', /\S/);
        await expect(page.locator('.event-detail-status-pill')).toBeVisible();
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
        expect(calls).toBe(1);
      }
      expect(errors).toEqual([]);
    });
  }
}

for (const mismatch of ['year', 'event-id']) {
  test(`verified badge leaves a ${mismatch}-mismatched confirmation action available`, async ({ page }) => {
    await page.route('**/tek/2026/r000256-go4trail/', async route => {
      const response = await route.fetch();
      const body = (await response.text()).replace(/data-organizer-confirmation-cta[^>]+/, attributes =>
        attributes.replace(mismatch === 'year' ? 'data-year="2026"' : 'data-event-id="R000256"',
          mismatch === 'year' ? 'data-year="2027"' : 'data-event-id="R000011"'));
      await route.fulfill({ response, body });
    });
    await page.route('**/organizer-confirmations?year=2026', route => route.fulfill({ json: {
      ok: true, type: 'organizer_confirmations', year: '2026', events: [{ event_id: 'R000256', data_confirmed: true }]
    } }));
    await page.goto('/tek/2026/r000256-go4trail/');
    await expect(page.locator('[data-organizer-confirmation-badge]')).toBeVisible();
    await expect(page.locator('[data-organizer-confirmation-cta]')).toBeVisible();
    await expect(page.locator('.event-detail-organizer-actions a').last()).toBeVisible();
  });
}
