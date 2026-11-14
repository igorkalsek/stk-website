import { expect, test, type Page } from '@playwright/test';

const API = 'https://stk-master-api.igor-kalsek.workers.dev';
test.use({ timezoneId: 'America/Los_Angeles' });

const homes = [
  { path: '/', yearPath: '/tek/', label: 'V ospredju' },
  { path: '/en/', yearPath: '/en/races/', label: 'In the spotlight' }
];

const event = (row: number, date: string, title: string) => ({
  row: String(row), datum: date, naziv_prireditve: title, kraj: 'Ljubljana',
  regija: 'Osrednjeslovenska', tip_podlage: 'cesta',
  status_dogodka: 'potrjeno', vidno_v_javnem_koledarju: 'DA'
});

async function mock(page: Page, current: ReturnType<typeof event>[], next: ReturnType<typeof event>[] = [], date = '2026-11-03') {
  const state = { selection: null as Record<string, unknown> | null, configError: false, masterError: false, hold: null as Promise<void> | null, requests: 0, analytics: [] as Record<string, unknown>[] };
  await page.clock.setFixedTime(new Date(date + 'T12:00:00Z'));
  await page.route('**/api/interest-preview*', (route) =>
    route.fulfill({ json: { ok: true, type: 'interest_preview', items: [] } })
  );
  await page.route(API + '/**', async (route) => {
    const url = new URL(route.request().url());
    if (url.searchParams.get('spotlight') === '1') {
      state.requests++;
      await state.hold;
      if (state.configError) return route.fulfill({ status: 503, body: '' });
      return route.fulfill({ json: { ok: true, type: 'homepage_spotlight', version: 1, selection: state.selection } });
    }
    if (url.pathname === '/') {
      if (state.masterError) return route.abort();
      return route.fulfill({ json: { data: url.searchParams.get('year') === '2027' ? next : current } });
    }
    if (url.pathname === '/stats') return route.fulfill({ json: { confirmed_public_events_total: 0, family_friendly_total: 0 } });
    return route.fulfill({ json: { data: [] } });
  });
  await page.route('https://script.google.com/**', (route) => {
    if (route.request().method() === 'POST') {
      try { state.analytics.push(JSON.parse(route.request().postData() || '{}')); } catch {}
    }
    return route.fulfill({ status: 204, body: '' });
  });
  return state;
}

for (const home of homes) for (const width of [390, 1440]) {
  test('hero spotlight editorial event appears beside or below main heading ' + home.path + ' ' + width, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    const closest = [
      event(1, '2026-11-04', 'Nearby one'),
      event(2, '2026-11-05', 'Nearby two'),
      event(3, '2026-11-06', 'Nearby three'),
      event(4, '2026-11-07', 'Nearby four')
    ];
    const featured = event(5, '2026-12-03', 'Ridge Mountain Trail – a long but readable race title');
    await mock(page, [...closest, featured]);
    await page.goto(home.path);
    const card = page.locator('[data-home-spotlight]');
    await expect(card).toBeVisible();
    await expect(page.locator('.home-hero-card')).toHaveClass(/home-hero-with-featured/);
    await expect(card.locator('h2')).toHaveText(home.label);
    await expect(card.locator('[data-spotlight-title]')).toHaveText(featured.naziv_prireditve.replace(/[‐‑‒–—―]/g, '-'));
    await expect(card.locator('[data-spotlight-title]')).toHaveAttribute('href', new RegExp(home.yearPath + '2026/r000005-'));
    await expect(card).toHaveAttribute('data-analytics-event-id', 'r000005');
    await expect(card).toHaveAttribute('data-analytics-event-year', '2026');
    await expect(card).not.toContainText('Sponsored');
    await expect(card.locator('[data-spotlight-surface]')).toHaveText(home.path === '/en/' ? 'Road' : 'cesta');
    const bounds = await page.evaluate(() => {
      const left = document.querySelector('.home-hero-copy')?.getBoundingClientRect();
      const right = document.querySelector('[data-home-spotlight]')?.getBoundingClientRect();
      return { left: left ? { top: left.top, right: left.right } : null, right: right ? { top: right.top, left: right.left } : null,
        scrollWidth: document.documentElement.scrollWidth, clientWidth: document.documentElement.clientWidth };
    });
    expect(bounds.scrollWidth).toBeLessThanOrEqual(bounds.clientWidth);
    if (width === 1440) expect(bounds.right!.left).toBeGreaterThanOrEqual(bounds.left!.right - 2);
    else expect(bounds.right!.top).toBeGreaterThanOrEqual(bounds.left!.top);
  });
}

test('hero editorial slot falls back safely when no eligible race exists', async ({ page }) => {
  await mock(page, [event(1, '2026-11-04', 'Only nearby race')]);
  await page.goto('/');
  const card = page.locator('[data-home-spotlight]');
  await expect(card).toBeHidden();
  await expect(page.locator('.home-hero-card')).not.toHaveClass(/home-hero-with-featured/);
  await expect(page.getByRole('link', { name: 'Najdi tek', exact: true }).first()).toBeVisible();
});

test('hero editorial slot can feature a real next-year race', async ({ page }) => {
  await mock(page, [event(1, '2026-12-21', 'Nearby December race')], [event(15, '2027-01-20', 'January Race 2027')], '2026-12-20');
  await page.goto('/en/');
  const card = page.locator('[data-home-spotlight]');
  await expect(card.locator('[data-spotlight-title]')).toHaveText('January Race 2027');
  await expect(card).toHaveAttribute('data-analytics-event-year', '2027');
  await expect(card.locator('[data-spotlight-title]')).toHaveAttribute('href', /\/en\/races\/2027\/r000015-/);
});

const jamatlon = event(263, '2026-11-28', 'Zimski jamatlon');
const manual = {
  year: '2026', master_row: '263', expected_event_date: '2026-11-28', expected_event_name: 'Zimski jamatlon',
  start_date: '2026-11-13', end_date: '2026-11-28', selection_type: 'editorial'
};
const auto = event(300, '2026-12-15', 'Automatic fallback race');
const fixtures = ['2026-11-29', '2026-11-30', '2026-12-01', '2026-12-02'].map((date,i) => event(i+1,date,'Nearby ' + i));
const impressions = (state: Awaited<ReturnType<typeof mock>>) => state.analytics.filter(e => e.event_type === 'featured_race_impression');

for (const home of homes) for (const width of [390, 1440]) for (const kind of ['editorial', 'partner']) {
  test(`manual ${kind} ${home.path} ${width}px, no premature or duplicate impressions`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 1000 });
    const state = await mock(page, [...fixtures, jamatlon, auto], [], '2026-11-20');
    state.selection = { ...manual, selection_type: kind };
    let release!: () => void;
    state.hold = new Promise(resolve => { release = resolve; });
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(home.path);
    await expect.poll(() => state.requests).toBe(1);
    const card = page.locator('[data-home-spotlight]');
    await expect(card).toBeHidden();
    expect(impressions(state)).toHaveLength(0);
    release(); state.hold = null;
    await expect(card).toHaveAttribute('data-selection-mode',kind);
    await expect(card.locator('[data-spotlight-title]')).toHaveText('Zimski jamatlon');
    await expect(card.locator('[data-spotlight-title]')).toHaveAttribute('href',new RegExp(home.yearPath + '2026/r000263-'));
    await expect(card.locator('[data-spotlight-label]')).toHaveText(kind === 'partner'
      ? (home.path === '/' ? 'PARTNERSKA PROMOCIJA' : 'PARTNER PROMOTION')
      : (home.path === '/' ? 'UREDNIŠKI IZBOR STK' : 'STK EDITORIAL PICK'));
    await card.scrollIntoViewIfNeeded();
    await expect.poll(() => impressions(state).length).toBe(1);
    expect(impressions(state)[0]).toMatchObject({ event_id:'R000263',event_year:'2026',placement:'home_featured' });
    await page.evaluate(() => window.dispatchEvent(new Event('focus')));
    await expect.poll(() => state.requests).toBe(2);
    await expect(card).toHaveAttribute('data-selection-mode',kind);
    await page.waitForLoadState('networkidle');
    expect(impressions(state)).toHaveLength(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
    await info.attach(`spotlight-${kind}-${width}`, { body: await page.screenshot({ path: info.outputPath(`spotlight-${kind}-${width}.png`) }), contentType:'image/png' });
    // Existing click analytics still identify the canonical race.
    await card.locator('[data-spotlight-title]').evaluate(link => link.addEventListener('click', event => event.preventDefault(), { once:true }));
    await card.locator('[data-spotlight-title]').click();
    await expect.poll(() => state.analytics.filter(e => e.event_type === 'event_card_clicked' && e.placement === 'home_featured').length).toBe(1);
    expect(errors).toEqual([]);
  });
}

for (const failure of ['inactive', 'snapshot', 'unofficial', 'hidden', 'config-down', 'master-down', 'selected-year-down']) {
  test(`manual safe fallback: ${failure}`, async ({ page }) => {
    const selected = { ...jamatlon,
      ...(failure === 'unofficial' ? { status_dogodka:'neuradno' } : {}),
      ...(failure === 'hidden' ? { vidno_v_javnem_koledarju:'NE' } : {}) };
    const state = await mock(page, [...fixtures,selected,auto], [], '2026-11-20');
    state.selection = failure === 'inactive' ? null : { ...manual,
      ...(failure === 'snapshot' ? { expected_event_name:'Other race' } : {}) };
    state.configError = failure === 'config-down'; state.masterError = failure === 'master-down';
    if (failure === 'selected-year-down') {
      state.selection = { ...manual, year:'2027',expected_event_date:'2027-11-28' };
      await page.route(API + '/?year=2027',route => route.abort());
    }
    await page.goto('/');
    const card = page.locator('[data-home-spotlight]');
    await page.waitForLoadState('networkidle');
    if (failure === 'master-down') {
      await expect(card).toBeHidden(); expect(impressions(state)).toHaveLength(0);
    } else {
      await expect(card).toHaveAttribute('data-selection-mode','automatic');
      await expect(card.locator('[data-spotlight-title]')).toHaveText(auto.naziv_prireditve);
    }
    expect(impressions(state).some(e => e.event_id === 'R000263')).toBe(false);
  });
}

test('open page switches at Ljubljana midnight and disabled control needs no deploy', async ({ page }) => {
  const state = await mock(page, [...fixtures,jamatlon,auto], [], '2026-11-28');
  await page.clock.install({ time: new Date('2026-11-28T22:59:59Z') });
  state.selection = { ...manual };
  await page.goto('/en/');
  const card = page.locator('[data-home-spotlight]');
  await expect(card).toHaveAttribute('data-selection-mode','editorial');
  await page.clock.runFor(1001);
  await expect(card).toHaveAttribute('data-selection-mode','automatic');
  await expect(card.locator('[data-spotlight-title]')).toHaveText(auto.naziv_prireditve);
  await page.clock.setFixedTime(new Date('2026-11-20T12:00:00Z'));
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(card).toHaveAttribute('data-selection-mode','editorial');
  state.selection = null;
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(card).toHaveAttribute('data-selection-mode','automatic');
});

test('refresh failure clears a previously visible manual promotion and timeout ignores late control', async ({ page }) => {
  const state = await mock(page,[...fixtures,jamatlon,auto],[],'2026-11-20');
  state.selection = { ...manual };
  await page.goto('/');
  const card = page.locator('[data-home-spotlight]');
  await expect(card).toHaveAttribute('data-selection-mode','editorial');
  await expect.poll(() => impressions(state).length).toBe(1);
  state.configError = true;
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(card).toHaveAttribute('data-selection-mode','automatic');
  state.masterError = true;
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await page.waitForLoadState('networkidle');
  await expect(card).toBeHidden();
  state.masterError = false; state.configError = false;
  await page.clock.install({ time:new Date('2026-11-20T12:00:00Z') });
  let release!: () => void;
  state.hold = new Promise(resolve => { release = resolve; });
  const before = state.requests;
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect.poll(() => state.requests).toBe(before+1);
  await expect(card).toBeHidden();
  await page.clock.runFor(10001);
  await expect(card).toHaveAttribute('data-selection-mode','automatic');
  release(); state.hold = null;
  await page.waitForLoadState('networkidle');
  await expect(card).toHaveAttribute('data-selection-mode','automatic');
  expect(impressions(state).filter(e => e.event_id === 'R000263')).toHaveLength(1);
});

// DEV-059 / U05: measure the complete home, including the first chronological card.
for (const home of homes) for (const width of [390, 768, 1440]) {
  for (const scenario of ['automatic', 'manual', 'long', 'missing', 'empty'] as const) {
    test(`U05 compact spotlight ${home.path} ${width}px ${scenario}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 1200 });
      const closest = ['2026-11-15', '2026-11-16', '2026-11-17', '2026-11-18'].map((date, i) => event(i + 1, date, 'Nearby race ' + i));
      const title = scenario === 'long'
        ? (home.path === '/' ? 'Mednarodni dobrodelni gorski ultramaraton po slovenskih poteh z družinskim spremljevalnim programom in dolgim neprekinjenim nazivom ' : 'International charity mountain ultramarathon along Slovenian trails with a family programme and an exceptionally long unbroken name ') + 'Trail'.repeat(35)
        : 'Miklavžev tek';
      const selected = { ...event(5, '2026-12-06', title), ...(scenario === 'missing' ? { kraj: '', regija: '', tip_podlage: '' } : {}) };
      const state = await mock(page, scenario === 'empty' ? closest : [...closest, selected], [], '2026-11-14');
      if (scenario === 'manual') state.selection = { ...manual, master_row: '5', expected_event_name: title, expected_event_date: selected.datum, end_date: selected.datum };
      await page.goto(home.path);
      const card = page.locator('[data-home-spotlight]');
      const first = page.locator('[data-nearest-events] .event-card').first();
      await expect(first.locator('h3')).toHaveText('Nearby race 0');
      await page.waitForLoadState('networkidle');
      if (scenario === 'empty') {
        await expect(card).toBeHidden();
        await expect(page.locator('.home-hero-card')).not.toHaveClass(/home-hero-with-featured/);
      } else {
        await expect(card).toBeVisible();
        await expect(card).toHaveAttribute('data-selection-mode', scenario === 'manual' ? 'editorial' : 'automatic');
        await expect(card).toHaveAttribute('data-analytics-placement', 'home_featured');
        await expect(card).toHaveAttribute('data-analytics-featured-impression', 'true');
        await expect(card).toHaveAttribute('data-analytics-event-id', 'r000005');
        await expect(card).toHaveAttribute('data-analytics-event-name', title);
        await expect(card).toHaveAttribute('data-analytics-event-date', selected.datum);
        await expect(card).toHaveAttribute('data-analytics-event-year', '2026');
        await expect(card.locator('h3')).toHaveText(title);
        await expect(card.locator('time')).toHaveAttribute('datetime', selected.datum);
        const titleLink = card.locator('[data-spotlight-title]');
        const cta = card.locator('[data-spotlight-cta]');
        await expect(titleLink).toHaveAttribute('href', new RegExp('^' + home.yearPath + '2026/r000005-'));
        expect(await cta.getAttribute('href')).toBe(await titleLink.getAttribute('href'));
        if (scenario === 'missing') {
          await expect(card.locator('[data-spotlight-place]')).toBeHidden();
          await expect(card.locator('[data-spotlight-surface]')).toBeHidden();
        } else {
          await expect(card.locator('[data-spotlight-place]')).toHaveText('Ljubljana');
          await expect(card.locator('[data-spotlight-surface]')).toHaveText(home.path === '/' ? 'cesta' : 'Road');
        }
        if (scenario === 'automatic') {
          const contrasts = await card.evaluate(el => {
            const rgb = (value: string) => value.match(/[\d.]+/g)!.slice(0, 3).map(Number);
            const luminance = (channels: number[]) => channels.map(n => { const c = n / 255; return c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4; }).reduce((sum, c, i) => sum + c * [.2126, .7152, .0722][i], 0);
            const ratio = (a: number[], b: number[]) => { const x = luminance(a), y = luminance(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); };
            const backgrounds = getComputedStyle(el).backgroundImage.match(/rgb\([^)]+\)/g)!.map(rgb);
            const text = ['h2', '[data-spotlight-title]', '[data-spotlight-date]', '[data-spotlight-place]'].map(selector => Math.min(...backgrounds.map(bg => ratio(rgb(getComputedStyle(el.querySelector(selector)!).color), bg))));
            const buttons = ['[data-spotlight-label]', '[data-spotlight-cta]'].map(selector => { const style = getComputedStyle(el.querySelector(selector)!); return ratio(rgb(style.color), rgb(style.backgroundColor)); });
            return [...text, ...buttons];
          });
          for (const ratio of contrasts) expect(ratio).toBeGreaterThanOrEqual(4.5);
        }
        expect(await card.locator('h3').evaluate(el => el.scrollHeight <= el.clientHeight && el.scrollWidth <= el.clientWidth)).toBe(true);
        if (width === 390 && scenario !== 'long') expect((await card.boundingBox())!.height).toBeLessThanOrEqual(205);
        if (width === 390) {
          const actions = await page.locator('.home-hero-actions a').evaluateAll(links => links.map(link => link.getBoundingClientRect().toJSON()));
          expect(actions).toHaveLength(2);
          expect(actions[0].top).toBe(actions[1].top);
          for (const rect of actions) { expect(rect.height).toBeGreaterThanOrEqual(44); expect(rect.width).toBeGreaterThanOrEqual(44); }
        }
        // Real sequential keyboard movement, with visible focus and >=44px touch targets.
        await titleLink.focus();
        await page.keyboard.press('Shift+Tab');
        await page.keyboard.press('Tab');
        await expect(titleLink).toBeFocused();
        await page.keyboard.press('Tab');
        await expect(cta).toBeFocused();
        for (const link of [titleLink, cta]) {
          const rect = (await link.boundingBox())!;
          expect(rect.height).toBeGreaterThanOrEqual(44);
          expect(rect.width).toBeGreaterThanOrEqual(44);
        }
        expect(await cta.evaluate(el => getComputedStyle(el).outlineStyle)).toBe('solid');
      }
      if (width === 390 && scenario === 'automatic') {
        // Linux system fonts can put the unchanged hero title on two lines
        // and its lead on three. Exercise both on macOS without loosening the target.
        await page.addStyleTag({ content: '.home-hero-copy h1 { max-width: 250px; } .home-hero-copy .hero-lead { max-width: 265px; }' });
      }
      // Read document coordinates in a single frame; keyboard focus may scroll the viewport.
      const position = await first.evaluate(el => el.getBoundingClientRect().top + scrollY);
      if (width === 390 && scenario !== 'long') expect(position).toBeLessThanOrEqual(900);
      const stable = await page.locator('.home-current-sections').evaluate(el => el.getBoundingClientRect().top + scrollY);
      await page.waitForTimeout(200);
      expect(await page.locator('.home-current-sections').evaluate(el => el.getBoundingClientRect().top + scrollY)).toBe(stable);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    });
  }
}
