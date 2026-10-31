import { interestContract } from '../fixtures/interest-contract.mjs';
import { expect, test, type Page } from '@playwright/test';

const API_HOST = 'https://stk-master-api.igor-kalsek.workers.dev';
const ANALYTICS_HOST = 'https://script.google.com';

const homes = [
  {
    path: '/',
    finder: 'Najdi tek',
    finderHref: '/iskalnik-tekov/',
    myRaces: 'Moji teki',
    myRacesHref: '/moji-teki/',
    tekobot: 'Vprašajte Tekobota',
    tekobotHref: '/stk-tekobot/',
    current: 'Aktualno',
    upcoming: 'Naslednji teki',
    interest: 'Največ zanimanja',
    interestDescription: 'Aktivno zanimanje pomenijo kliki na razpise in prijavne povezave, shranitve ter koledarske akcije. Ogledi profilov niso merilo aktivnega zanimanja.',
    interestEmpty: 'Trenutno še ni dovolj podatkov o zanimanju.',
    interestError: 'Podatki o zanimanju trenutno niso na voljo.',
    featured: 'Izpostavljeno v naslednjih dneh',
    updates: 'Sveže spremembe v koledarju',
    calendar: 'Navodila za osebni koledar',
    organisers: 'Več za organizatorje'
  },
  {
    path: '/en/',
    finder: 'Find a race',
    finderHref: '/en/find-races/',
    myRaces: 'My races',
    myRacesHref: '/en/my-races/',
    tekobot: 'Ask STK Tekobot',
    tekobotHref: '/en/stk-tekobot/',
    current: 'Current races',
    upcoming: 'Upcoming races',
    interest: 'Races attracting the most interest',
    interestDescription: 'Active interest includes official information and registration link clicks, saves and calendar actions. Profile views do not count as active interest.',
    interestEmpty: 'There is not enough interest data yet.',
    interestError: 'Interest data is currently unavailable.',
    featured: 'Featured in the coming days',
    updates: 'Fresh calendar changes',
    calendar: 'Personal calendar instructions',
    organisers: 'More for organisers'
  }
];

for (const home of homes) for (const width of [390, 1440]) {
  test(`${home.path} DEV-047 switches 2026/2027 safely at ${width}px and expires old results`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    const events = await mockHomepageApis(page, false, false, true);
    const next = { ...events[1], datum: '2027-03-07', naziv_prireditve: '2027 canonical race' };
    await page.route(`${API_HOST}/?year=2027`, route => route.fulfill({ json: { data: [next] } }));
    await page.route('**/api/interest-preview*', route => {
      const year = new URL(route.request().url()).searchParams.get('year') || '2026';
      const event = year === '2027' ? next : events[1];
      return route.fulfill({ json: interestContract([{ event_id: 'R000002', event_name: event.naziv_prireditve, event_date: event.datum }],
        { year, now: new Date('2026-09-13T12:00:00Z') }) });
    });
    await page.goto(home.path);
    const section = page.locator('section[aria-labelledby="voted-title"]');
    const cards = section.locator('[data-top-events] .event-card');
    await expect(cards.locator('h3')).toHaveText(['Ranked race two']);
    await section.locator('[data-interest-year]').selectOption('2027');
    await expect(cards.locator('h3')).toHaveText(['2027 canonical race']);
    await expect(cards.locator('h3 a')).toHaveAttribute('href', new RegExp(`${home.path === '/' ? '/tek/' : '/en/races/'}2027/r000002-`));
    await expect(cards).toHaveAttribute('data-analytics-event-year', '2027');
    // Returning to a year must read fresh Master rows, not a lifetime-page promise.
    events[1].naziv_prireditve = 'Updated 2026 canonical race';
    events[1].datum = '2026-09-28';
    await section.locator('[data-interest-year]').selectOption('2026');
    await expect(cards.locator('h3')).toHaveText(['Updated 2026 canonical race']);
    await expect(cards.locator('time')).toHaveAttribute('datetime', '2026-09-28');
    await section.locator('[data-interest-year]').selectOption('2027');
    await expect(cards.locator('h3')).toHaveText(['2027 canonical race']);
    await page.clock.fastForward(301000);
    await expect(cards).toHaveCount(0);
    await expect(section.locator('[data-status="top"]')).toHaveText(home.interestError);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  });
}

async function mockHomepageApis(page: Page, withRecentUpdate = false, longTitle = false, advanceClock = false) {
  if (advanceClock) await page.clock.install({ time: new Date('2026-09-13T12:00:00Z') });
  else await page.clock.setFixedTime(new Date('2026-09-13T12:00:00Z'));
  const events = [
    ['1', '2026-09-13', 'Fallback race', 'Kranj'],
    ['2', '2026-09-26', 'Ranked race two', 'Velenje'],
    ['3', '2026-09-27', 'Ranked race three', 'Slovenske Konjice'],
    ['4', '2026-09-14', 'Second fallback race', 'Celje']
  ].map(([row, datum, naziv_prireditve, kraj]) => ({
    row, datum, naziv_prireditve: longTitle && row === '2' ? 'Mednarodni družinski gorski ultramaraton – International family mountain race along the Slovenian trails' : naziv_prireditve,
    kraj: longTitle && row === '3' ? '' : kraj, regija: longTitle && row === '3' ? '' : 'Savinjska', status_dogodka: 'potrjeno',
    votes_total: row === '2' ? 999 : 1,
    vidno_v_javnem_koledarju: 'DA', povezava_prijava: `https://example.com/register/${row}?private=drop`
  }));
  await page.route('**/api/interest-preview*', (route) => route.fulfill({ json: interestContract(
    [events[1], events[2]].map(e => ({ event_id: 'R' + e.row.padStart(6, '0'), event_name: e.naziv_prireditve, event_date: e.datum })),
    { now: new Date('2026-09-13T12:00:00Z') }
  ) }));
  await page.route(`${API_HOST}/**`, async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/recent_updates' && withRecentUpdate) {
      const update = { ...events[1], update_type: 'updated', recent_update_date: '2026-09-20', public_summary: 'Podatki dogodka so bili posodobljeni.' };
      return route.fulfill({ json: { ok: true, recent_updates_last_days: { years: ['2026', '2027'], updated_events: [update], events: [update] } } });
    }
    if (url.pathname === '/stats') {
      return route.fulfill({ json: { confirmed_public_events_total: 0, family_friendly_total: 0, group_runs_total: 0 } });
    }
    if (url.pathname === '/group-runs') return route.fulfill({ json: { row_count: 0 } });
    if (url.pathname === '/') return route.fulfill({ json: { data: url.searchParams.get('year') === '2027' ? [] : events } });
    return route.fulfill({ json: { data: [] } });
  });
  await page.route(`${ANALYTICS_HOST}/**`, (route) => route.fulfill({ status: 204, body: '' }));
  return events;
}

for (const home of homes) {
  for (const width of [1440, 390]) {
    for (const state of ['success', 'http-error', 'network-error', 'invalid-json', 'invalid-payload', 'invalid-items', 'empty', 'unmatched'] as const) {
      test(`${home.path} interest ${state} at ${width}px keeps analytic order and truthful states`, async ({ page }) => {
        await page.setViewportSize({ width, height: 900 });
        const events = await mockHomepageApis(page);
        const errors: string[] = [];
        page.on('pageerror', (error) => errors.push(error.message));
        await page.route('**/api/interest-preview*', (route) => {
          if (state === 'http-error') return route.fulfill({ status: 503, json: { ok: false } });
          if (state === 'network-error') return route.abort('failed');
          if (state === 'invalid-json') return route.fulfill({ contentType: 'application/json', body: '{' });
          if (state === 'invalid-payload') return route.fulfill({ json: { ok: true, type: 'wrong', items: [] } });
          if (state === 'invalid-items') return route.fulfill({ json: { ok: true, type: 'interest_preview', items: 'bad' } });
          const selected = state === 'empty' ? [] : state === 'unmatched' ? [
            { event_id: 'R999999', event_name: 'Unknown race', event_date: '2026-12-01' }
          ] : [events[2], events[1]].map(e => ({ event_id: 'R' + e.row.padStart(6, '0'), event_name: e.naziv_prireditve, event_date: e.datum }));
          return route.fulfill({ json: interestContract(selected, { now: new Date('2026-09-13T12:00:00Z') }) });
        });
        // A viable voted response must never appear as a substitute interest ranking.
        await page.route(`${API_HOST}/top?**`, (route) => route.fulfill({ json: { events: [{
          row: '4', datum: '2026-09-14', naziv_prireditve: 'Vote-only fallback', kraj: 'Celje',
          status_dogodka: 'potrjeno', vidno_v_javnem_koledarju: 'DA', votes_total: 10000
        }] } }));
        await page.goto(home.path);
        const section = page.locator('section[aria-labelledby="voted-title"]');
        const cards = section.locator('[data-analytics-placement="home_interest"]');
        if (state === 'success') {
          await expect(cards.locator('h3')).toHaveText(['Ranked race three', 'Ranked race two']);
          await expect(cards).toHaveCount(2);
          expect(await cards.evaluateAll((elements) => elements.map((element) => element.getAttribute('data-analytics-event-id')))).toEqual(['r000003', 'r000002']);
          await expect(cards.first().locator('time')).toHaveAttribute('datetime', '2026-09-27');
          await expect(cards.first().locator('h3 a')).toHaveAttribute('href', new RegExp(`${home.path === '/' ? '/tek/' : '/en/races/'}2026/r000003-`));
          await expect(cards.first().locator('[data-saved-race-button]')).toBeVisible();
          await expect(section.locator('[data-status="top"]')).toBeEmpty();
        } else {
          await expect(section.locator('[data-status="top"]')).toHaveText(state === 'empty' ? home.interestEmpty : home.interestError);
          await expect(section.locator('[data-top-events]')).toBeEmpty();
        }
        await expect(section.locator('[data-top-description]')).toHaveText(home.interestDescription);
        await expect(section).not.toContainText(/999|10000|Glasovanje odprto|Voting open|Vote-only fallback/);
        await expect(section.locator('.event-details, .pill-orange')).toHaveCount(0);
        await expect(section.getByRole('link', { name: home.path === '/' ? 'Poglejte vse teke' : 'View all races' })).toHaveAttribute('href', home.finderHref);
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
        expect(errors).toEqual([]);
      });
    }
  }

  test(`${home.path} keeps home_interest tracking on a ranked card click`, async ({ page }) => {
    await mockHomepageApis(page);
    await page.goto(home.path);
    const card = page.locator('[data-top-events] [data-analytics-placement="home_interest"]').first();
    await expect(card.locator('h3 a')).toBeVisible();
    const requestPromise = page.waitForRequest((request) => request.url().startsWith(`${ANALYTICS_HOST}/`) && request.method() === 'POST' && JSON.parse(request.postData() ?? '{}').event_type === 'event_card_clicked');
    await card.locator('h3 a').click();
    const body = JSON.parse((await requestPromise).postData() ?? '{}');
    expect(body).toMatchObject({ event_type: 'event_card_clicked', placement: 'home_interest', event_id: 'r000002', event_year: '2026', event_key: '2026:r000002' });
  });

  test(`${home.path} keeps the recent-update card placement in the intercepted click request`, async ({ page }) => {
    await mockHomepageApis(page, true);
    await page.goto(home.path);
    const card = page.locator('[data-recent-updates] .update-card[data-analytics-placement="home_updates"]');
    await expect(card.locator('h3 a')).toBeVisible();
    const requestPromise = page.waitForRequest((request) => request.url().startsWith(`${ANALYTICS_HOST}/`) && request.method() === 'POST' && JSON.parse(request.postData() ?? '{}').event_type === 'event_card_clicked');
    await card.locator('h3 a').click();
    const body = JSON.parse((await requestPromise).postData() ?? '{}');
    expect(body).toMatchObject({ event_type: 'event_card_clicked', placement: 'home_updates', event_id: 'r000002', event_year: '2026', event_key: '2026:r000002' });
  });

  test(`${home.path} renders classified metadata in global recency order and leaves unknown types unlabelled`, async ({ page }) => {
    await mockHomepageApis(page);
    const summaries: Record<string, string> = { new: 'Nov dogodek v koledarju.', confirmed: 'Dogodek je bil potrjen.', updated: 'Podatki dogodka so bili posodobljeni.' };
    const race = (row: string, type: string, recent: string) => ({
      row, datum: '2026-12-17', naziv_prireditve: `DEV-017 ${type}`, kraj: 'Ljubljana',
      update_type: type, recent_update_date: recent, public_summary: summaries[type] ?? 'Neznana sprememba.'
    });
    await page.route(`${API_HOST}/recent_updates?**`, (route) => route.fulfill({ json: {
      ok: true, recent_updates_last_days: { years: ['2026', '2027'],
        events: [race('11', 'unknown', '2026-10-07'), race('12', 'new', '2026-10-06'), race('13', 'confirmed', '2026-10-05'), race('14', 'updated', '2026-10-04')],
        updated_events: [race('14', 'updated', '2026-10-04'), race('11', 'unknown', '2026-10-07')],
        new_events: [race('12', 'new', '2026-10-06')],
        confirmed_events: [race('13', 'confirmed', '2026-10-05')]
      }
    } }));
    await page.goto(home.path);
    const cards = page.locator('[data-recent-updates] .update-card');
    await expect(cards).toHaveCount(4);
    await expect(cards.locator('h3')).toHaveText(['DEV-017 unknown', 'DEV-017 new', 'DEV-017 confirmed', 'DEV-017 updated']);
    const labels = home.path === '/' ? ['Dodano', 'Potrjeno', 'Posodobljeno'] : ['Added', 'Confirmed', 'Updated'];
    await expect(cards.nth(0).locator('.update-meta')).not.toContainText(/Updated|Posodobljeno/);
    if (home.path === '/en/') await expect(cards.nth(0)).not.toContainText('Calendar details for this race were updated.');
    const translatedSummaries = home.path === '/' ? Object.values(summaries) : ['New event in the calendar.', 'The event was confirmed.', 'Calendar details for this race were updated.'];
    for (const [index, label] of labels.entries()) {
      await expect(cards.nth(index + 1).locator('.update-meta')).toContainText(label);
      await expect(cards.nth(index + 1)).toContainText(translatedSummaries[index]);
      await expect(cards.nth(index + 1).locator('.update-meta')).not.toContainText(home.path === '/' ? 'dogodek' : 'event');
      await expect(cards.nth(index + 1).locator('.update-event-meta time')).toHaveAttribute('datetime', '2026-12-17');
    }
  });

  test(`${home.path} keeps key paths and the compact section hierarchy`, async ({ page }) => {
    await mockHomepageApis(page);
    await page.goto(home.path);

    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    const heroActions = page.locator('.home-hero-actions');
    await expect(heroActions.getByRole('link', { name: home.finder, exact: true })).toHaveAttribute('href', home.finderHref);
    await expect(heroActions.getByRole('link', { name: home.myRaces, exact: true })).toHaveAttribute('href', home.myRacesHref);
    await expect(heroActions.getByRole('link', { name: home.tekobot, exact: true })).toHaveAttribute('href', home.tekobotHref);
    await expect(page.locator('.home-entry-grid')).toHaveCount(0);
    await expect(page.locator('.hero-preview')).toHaveCount(0);

    for (const heading of [home.featured, home.current, home.upcoming, home.interest, home.updates]) {
      await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible();
    }
    await expect(page.locator('.home-stats-strip [data-stat="confirmed_public_events_total"]')).toHaveText('0');
    await expect(page.locator('[data-featured-upcoming] > li')).toHaveCount(3);
    expect(await page.locator('[data-featured-upcoming] .home-featured-race').evaluateAll((cards) =>
      cards.map((card) => card.getAttribute('data-analytics-placement'))
    )).toEqual(['home_featured', 'home_featured', 'home_featured']);
    expect(await page.locator('[data-featured-upcoming] a, [data-featured-upcoming] button').evaluateAll((controls) =>
      controls.map((control) => control.closest('[data-analytics-placement]')?.getAttribute('data-analytics-placement'))
    )).not.toContain(undefined);
    await expect(page.getByRole('link', { name: home.calendar, exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: home.organisers, exact: true })).toBeVisible();

    const tops = await page.locator('#featured-upcoming-title, #current-title, #voted-title, #updates-title, #my-stk-title, #trust-title, #utility-title')
      .evaluateAll((elements) => elements.map((element) => Math.round(element.getBoundingClientRect().top + window.scrollY)));
    expect(tops).toEqual([...tops].sort((a, b) => a - b));
  });

  for (const width of [390, 430]) {
    test(`${home.path} has no horizontal overflow at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await mockHomepageApis(page);
      await page.goto(home.path);
      const dimensions = await page.evaluate(() => ({
        clientWidth: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth
      }));
      expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth);
    });
  }
}

for (const home of homes) {
  for (const width of [390, 1440]) {
    for (const state of ['success', 'master2027-down', 'recent-down', 'old-api', 'missing-events'] as const) {
      test(`${home.path} DEV-033 ${state} at ${width}px keeps year-safe links and analytics`, async ({ page }, testInfo) => {
        await page.setViewportSize({ width, height: 1000 });
        const events = await mockHomepageApis(page);
        await page.clock.setFixedTime(new Date('2026-10-17T10:00:00Z'));
        const race = (year: string, row: string, title: string, date: string) => ({
          year, row, datum: date, naziv_prireditve: title, kraj: 'Ljubljana',
          status_dogodka: 'potrjeno', vidno_v_javnem_koledarju: 'DA'
        });
        const oldRace = race('2026', '37', 'Same row 2026', '2026-12-20');
        const backyard = race('2027', '37', 'Backyard Ultra Ljubljana 2027', '2027-10-08');
        const maribor = race('2027', '38', 'Trail Maribor 2027', '2027-06-12');
        await page.route(`${API_HOST}/**`, async (route) => {
          const url = new URL(route.request().url());
          if (url.pathname === '/') {
            if (url.searchParams.get('year') === '2027' && state === 'master2027-down') return route.abort('failed');
            return route.fulfill({ json: { data: url.searchParams.get('year') === '2027' ? [backyard, maribor] : [oldRace] } });
          }
          if (url.pathname !== '/recent_updates') return route.fallback();
          expect(url.searchParams.get('years')).toBe('2026,2027');
          if (state === 'recent-down') return route.abort('failed');
          return route.fulfill({ json: { ok: true, recent_updates_last_days: {
            ...(state === 'old-api' ? {} : { years: ['2026', '2027'] }),
            events: state === 'missing-events' ? undefined : [...[maribor, maribor, backyard].map(e => ({ ...e, update_type: 'new', recent_update_date: '2026-10-16', public_summary: 'Nov dogodek v koledarju.' })),
              { ...oldRace, update_type: 'updated', recent_update_date: '2026-10-15' },
              { row: '37', naziv_prireditve: 'Missing year', update_type: 'confirmed', recent_update_date: '2026-10-14' },
              { row: '39', naziv_prireditve: 'Fifth card must be omitted', update_type: 'updated', recent_update_date: '2026-10-13' }
            ],
            new_events: [backyard, maribor].map(e => ({ ...e, update_type: 'new', recent_update_date: '2026-10-16', public_summary: 'Nov dogodek v koledarju.' })),
            updated_events: [{ ...oldRace, update_type: 'updated', recent_update_date: '2026-10-15' }],
            confirmed_events: [{ row: '37', naziv_prireditve: 'Missing year', update_type: 'confirmed', recent_update_date: '2026-10-14' }]
          } } });
        });
        await page.goto(home.path);
        const cards = page.locator('[data-recent-updates] .update-card');
        if (state === 'recent-down' || state === 'old-api' || state === 'missing-events') {
          await expect(cards).toContainText(home.path === '/' ? 'trenutno niso dosegljive' : 'currently unavailable');
          await expect(cards.locator('a')).toHaveCount(0);
          await expect(page.locator('[data-recent-updates] [data-analytics-event-year]')).toHaveCount(0);
          await expect(cards).not.toContainText('Dodano');
          await expect(cards).not.toContainText('Added');
          return;
        }
        await expect(cards).toHaveCount(4);
        await expect(cards.locator('h3')).toHaveText(['Trail Maribor 2027', 'Backyard Ultra Ljubljana 2027', 'Same row 2026', 'Missing year']);
        const prefix = home.path === '/' ? '/tek/' : '/en/races/';
        const first = cards.nth(0), second = cards.nth(1), third = cards.nth(2);
        await expect(first).toContainText(home.path === '/' ? 'Dodano' : 'Added');
        await expect(third.locator('a')).toHaveAttribute('href', new RegExp(`^${prefix}2026/r000037-`));
        await expect(third).toHaveAttribute('data-analytics-event-year', '2026');
        await expect(cards.nth(3).locator('a')).toHaveCount(0);
        await expect(cards.nth(3)).not.toHaveAttribute('data-analytics-event-year');
        if (state === 'master2027-down') {
          await expect(first.locator('a')).toHaveCount(0);
          await expect(second.locator('a')).toHaveCount(0);
          await expect(first).not.toHaveAttribute('data-analytics-event-year');
        } else {
          await expect(first.locator('a')).toHaveAttribute('href', new RegExp(`^${prefix}2027/r000038-`));
          await expect(second.locator('a')).toHaveAttribute('href', new RegExp(`^${prefix}2027/r000037-`));
          await expect(first).toHaveAttribute('data-analytics-event-year', '2027');
          const click = page.waitForRequest(request => request.url().includes('script.google.com') && request.postData()?.includes('event_card_clicked') === true);
          await second.locator('a').click({ modifiers: ['ControlOrMeta'] });
          const body = JSON.parse((await click).postData() ?? '{}');
          expect(body).toMatchObject({ event_id: 'r000037', event_year: '2027', event_key: '2027:r000037', placement: 'home_updates' });
          await page.locator('.home-update-section').screenshot({ path: testInfo.outputPath(`dev033-${home.path === '/' ? 'sl' : 'en'}-${width}.png`) });
        }
        expect(await page.locator('body').evaluate(el => el.scrollWidth <= window.innerWidth)).toBe(true);
      });
    }
  }
}

// Geometry is checked against rendered controls, including a long title and absent location.
for (const home of homes) for (const width of [390, 430, 768, 1440]) {
  test(`${home.path} compact cards keep titles, rank and actions aligned at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await mockHomepageApis(page, true, true);
    await page.goto(home.path);
    const featured = page.locator('.home-featured-race');
    const interest = page.locator('[data-top-events] .event-card');
    await expect(featured).toHaveCount(3);
    await expect(interest).toHaveCount(2);
    if (width >= 768) {
      const actionRows = await featured.locator('.home-featured-actions').evaluateAll(elements => elements.map(e => Math.round(e.getBoundingClientRect().top)));
      expect(new Set(actionRows).size).toBe(1);
    }
    for (const card of await featured.all()) {
      const controls = card.locator('.home-featured-actions > a, summary, [data-saved-race-button]');
      for (const control of await controls.all()) {
        const rect = (await control.boundingBox())!;
        expect(rect.width).toBeGreaterThanOrEqual(44);
        expect(rect.height).toBeGreaterThanOrEqual(44);
        await page.keyboard.press('Tab');
        await control.focus();
        expect(await control.evaluate(e => getComputedStyle(e).outlineStyle)).not.toBe('none');
      }
      const title = (await card.locator('h3').boundingBox())!;
      if (width <= 520) expect(title.width).toBeGreaterThan(240);
      const menu = card.locator('details');
      await menu.locator('summary').focus();
      await page.keyboard.press('Enter');
      await expect(menu).toHaveAttribute('open', '');
      for (const link of await menu.locator('a').all()) {
        const rect = (await link.boundingBox())!;
        expect(rect.x).toBeGreaterThanOrEqual(0);
        expect(rect.x + rect.width).toBeLessThanOrEqual(width);
        expect(rect.height).toBeGreaterThanOrEqual(44);
        await expect(link).toHaveAttribute('href', /^(https:|data:text\/calendar)/);
      }
      await menu.locator('summary').press('Enter');
      const save = card.locator('[data-saved-race-button]');
      await save.click(); await expect(save).toHaveAttribute('aria-pressed', 'true');
      await save.click(); await expect(save).toHaveAttribute('aria-pressed', 'false');
    }
    for (const card of await interest.all()) {
      const r = (await card.boundingBox())!;
      const title = (await card.locator('h3').boundingBox())!;
      const save = (await card.locator('[data-saved-race-button]').boundingBox())!;
      expect(save.width).toBeGreaterThanOrEqual(44);
      expect(save.height).toBeGreaterThanOrEqual(44);
      expect(save.x).toBeGreaterThanOrEqual(title.x + title.width);
      expect(save.y + save.height).toBeLessThanOrEqual(r.y + r.height);
      if (width <= 520) {
        expect(r.height).toBeLessThan(150);
        expect(title.width).toBeGreaterThan(240);
      }
    }
    expect(await interest.first().evaluate(e => getComputedStyle(e, '::before').content)).toContain('interest-rank');
    const update = page.locator('.update-card').first();
    await expect(update.locator('.update-meta')).toContainText(home.path === '/' ? 'Posodobljeno ·' : 'Updated ·');
    await expect(update.locator('.update-meta')).not.toContainText(home.path === '/' ? '26. sep.' : '26 Sept');
    await expect(update.locator('.update-event-meta time')).toHaveAttribute('datetime', '2026-09-26');
    const description = update.locator('.update-description');
    await expect(description).toBeVisible();
    // Stress the same text container with a long localized description as well.
    await description.evaluate((e, english) => {
      e.textContent = (english ? 'The published race information and official links have been updated. ' : 'Objavljeni podatki teka in uradne povezave so bili posodobljeni. ').repeat(12);
    }, home.path === '/en/');
    expect(await description.evaluate(e => e.scrollWidth > e.clientWidth + 1)).toBe(false);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  });
}

// DEV-044 F3: the visual order and compact actions must remain usable with real-sized text.
for (const home of homes) for (const width of [390, 1440]) {
  for (const scenario of ['full', 'missing', 'empty'] as const) {
    test(`${home.path} current races ${scenario} at ${width}px preserve actions and reading order`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.addInitScript(() => localStorage.setItem('stkAnalyticsOptOut', 'true'));
      await page.route('**/*', route => ['GET', 'HEAD'].includes(route.request().method()) ? route.continue() : route.abort());
      await mockHomepageApis(page);
      const title = 'Mednarodni družinski gorski ultramaraton – International family mountain race along the Slovenian trails';
      const events = scenario === 'empty' ? [] : [
        { row: '37', datum: '2026-09-26', naziv_prireditve: title, kraj: scenario === 'missing' ? '' : 'Ljubljana', regija: scenario === 'missing' ? '' : 'Osrednjeslovenska', povezava_prijava: scenario === 'missing' ? '' : 'https://example.com/registration', povezava_razpis: 'https://example.com/notice', status_dogodka: 'potrjeno', vidno_v_javnem_koledarju: 'DA' },
        { row: '38', datum: '2026-09-27', naziv_prireditve: 'Second race', kraj: 'Celje', regija: 'Savinjska', status_dogodka: 'potrjeno', vidno_v_javnem_koledarju: 'DA' }
      ];
      await page.route(`${API_HOST}/**`, route => {
        const url = new URL(route.request().url());
        if (url.pathname === '/') return route.fulfill({ json: { data: url.searchParams.get('year') === '2027' ? [] : events } });
        if (url.pathname === '/additional') return route.fulfill({ json: { data: scenario === 'full' ? [{ master_row: '37', zanesljivost: 'visoka', rok_prijave: '2026-09-25' }] : [] } });
        return route.fulfill({ json: { data: [] } });
      });
      await page.goto(home.path);
      const current = page.locator('.home-current-sections');
      const next = current.locator('.home-primary-section');
      const deadlines = current.locator('[data-registration-deadlines-section]');
      const cards = next.locator('[data-analytics-placement="home_this_week"]');
      await expect(cards).toHaveCount(events.length);
      if (scenario === 'empty') {
        await expect(next.locator('.event-card h3')).toHaveText(home.path === '/' ? 'Trenutno ni prikazanih najbližjih tekov' : 'No upcoming races are shown right now');
      } else {
        await expect(cards.locator('h3')).toHaveText([title.replace('–', '-'), 'Second race']);
        await expect(cards.first().locator('time')).toHaveAttribute('datetime', '2026-09-26');
        await expect(cards.first().locator('h3 a')).toHaveAttribute('href', new RegExp(`${home.path === '/' ? '/tek/' : '/en/races/'}2026/r000037-`));
        await expect(cards.first().locator('a[data-analytics-link-type="razpis"]')).toHaveAttribute('href', 'https://example.com/notice');
        await expect(cards.first().locator('a[data-analytics-link-type="razpis"]')).toHaveAccessibleName(home.path === '/' ? 'Razpis' : 'Official info');
        await expect(cards.first().locator('a[data-analytics-link-type="prijava"]')).toHaveCount(scenario === 'full' ? 1 : 0);
        if (scenario === 'missing') await expect(cards.first().locator(':scope > p')).toHaveCount(0);
        for (const card of await cards.all()) {
          const heading = card.locator('h3');
          expect(await heading.evaluate(e => e.scrollWidth <= e.clientWidth + 1 && e.scrollHeight <= e.clientHeight + 1)).toBe(true);
          const controls = card.locator('.event-actions > a, .event-actions > button, .event-actions summary');
          for (const control of await controls.all()) {
            const rect = (await control.boundingBox())!;
            expect(rect.width).toBeGreaterThanOrEqual(44);
            expect(rect.height).toBeGreaterThanOrEqual(44);
            await page.keyboard.press('Tab');
            await control.focus();
            expect(await control.evaluate(e => getComputedStyle(e).outlineStyle)).not.toBe('none');
          }
          const calendar = card.locator('.calendar-menu');
          await calendar.locator('summary').press('Enter');
          await expect(calendar).toHaveAttribute('open', '');
          for (const option of await calendar.locator('a').all()) {
            const rect = (await option.boundingBox())!;
            expect(rect.height).toBeGreaterThanOrEqual(44);
            expect(rect.x).toBeGreaterThanOrEqual(0);
            expect(rect.x + rect.width).toBeLessThanOrEqual(width);
            await expect(option).toHaveAttribute('href', /^(https:|data:text\/calendar)/);
          }
          await calendar.locator('summary').press('Enter');
          const save = card.locator('[data-saved-race-button]');
          await expect(save).toHaveAccessibleName(home.path === '/' ? 'Shrani tek' : 'Save race');
          await save.click(); await expect(save).toHaveAttribute('aria-pressed', 'true');
          await save.click(); await expect(save).toHaveAttribute('aria-pressed', 'false');
        }
      }
      if (scenario === 'full') {
        await expect(deadlines).toBeVisible();
        expect(await next.evaluate(e => e.nextElementSibling?.hasAttribute('data-registration-deadlines-section'))).toBe(true);
        // Read both viewport-relative rectangles in one frame: focus/clicks above
        // may still be smoothly scrolling the page between separate protocol calls.
        const [nextRect, deadlineRect] = await current.evaluate(section =>
          ['.home-primary-section', '[data-registration-deadlines-section]'].map(selector =>
            section.querySelector(selector)!.getBoundingClientRect().toJSON()));
        if (width === 390) expect(nextRect.y + nextRect.height).toBeLessThanOrEqual(deadlineRect.y);
        else {
          expect(deadlineRect.x + deadlineRect.width).toBeLessThanOrEqual(nextRect.x);
          expect(Math.abs(deadlineRect.y - nextRect.y)).toBeLessThan(1);
        }
      } else {
        await expect(deadlines).toBeHidden();
        const nextRect = (await next.boundingBox())!, layoutRect = (await current.locator('.home-current-layout').boundingBox())!;
        expect(Math.abs(nextRect.width - layoutRect.width)).toBeLessThan(1);
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    });
  }
}
