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
    interestDescription: 'Prihajajoči teki glede na zabeležene interakcije obiskovalcev STK – oglede, klike na razpise, prijave in druge akcije.',
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
    interestDescription: 'Upcoming races ranked by recorded visitor interactions on STK, including race views, official information and registration clicks.',
    interestEmpty: 'There is not enough interest data yet.',
    interestError: 'Interest data is currently unavailable.',
    featured: 'Featured in the coming days',
    updates: 'Fresh calendar changes',
    calendar: 'Personal calendar instructions',
    organisers: 'More for organisers'
  }
];

async function mockHomepageApis(page: Page, withRecentUpdate = false) {
  await page.clock.setFixedTime(new Date('2026-09-13T12:00:00Z'));
  const events = [
    ['1', '2026-09-13', 'Fallback race', 'Kranj'],
    ['2', '2026-09-26', 'Ranked race two', 'Velenje'],
    ['3', '2026-09-27', 'Ranked race three', 'Slovenske Konjice'],
    ['4', '2026-09-14', 'Second fallback race', 'Celje']
  ].map(([row, datum, naziv_prireditve, kraj]) => ({
    row, datum, naziv_prireditve, kraj, regija: 'Savinjska', status_dogodka: 'potrjeno',
    votes_total: row === '2' ? 999 : 1,
    vidno_v_javnem_koledarju: 'DA', povezava_prijava: `https://example.com/register/${row}?private=drop`
  }));
  await page.route('**/api/interest-preview', (route) => route.fulfill({ json: {
    ok: true,
    type: 'interest_preview',
    items: [{ event_id: 'R000002', rank: 1 }, { event_id: 'R000003', rank: 2 }]
  } }));
  await page.route(`${API_HOST}/**`, async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/recent_updates' && withRecentUpdate) {
      return route.fulfill({ json: { updated_events: [{ ...events[1], update_type: 'updated', recent_update_date: '2026-09-20' }] } });
    }
    if (url.pathname === '/stats') {
      return route.fulfill({ json: { confirmed_public_events_total: 0, family_friendly_total: 0, group_runs_total: 0 } });
    }
    if (url.pathname === '/group-runs') return route.fulfill({ json: { row_count: 0 } });
    if (url.pathname === '/') return route.fulfill({ json: { data: events } });
    return route.fulfill({ json: { data: [] } });
  });
  await page.route(`${ANALYTICS_HOST}/**`, (route) => route.fulfill({ status: 204, body: '' }));
}

for (const home of homes) {
  for (const width of [1440, 390]) {
    for (const state of ['success', 'http-error', 'network-error', 'invalid-json', 'invalid-payload', 'invalid-items', 'empty', 'unmatched'] as const) {
      test(`${home.path} interest ${state} at ${width}px keeps analytic order and truthful states`, async ({ page }) => {
        await page.setViewportSize({ width, height: 900 });
        await mockHomepageApis(page);
        const errors: string[] = [];
        page.on('pageerror', (error) => errors.push(error.message));
        await page.route('**/api/interest-preview', (route) => {
          if (state === 'http-error') return route.fulfill({ status: 503, json: { ok: false } });
          if (state === 'network-error') return route.abort('failed');
          if (state === 'invalid-json') return route.fulfill({ contentType: 'application/json', body: '{' });
          if (state === 'invalid-payload') return route.fulfill({ json: { ok: true, type: 'wrong', items: [] } });
          if (state === 'invalid-items') return route.fulfill({ json: { ok: true, type: 'interest_preview', items: 'bad' } });
          const items = state === 'empty' ? [] : state === 'unmatched' ? [{ event_id: 'R999999', rank: 1 }] : [
            { event_id: 'R000003', rank: 1, total_interest_actions_30d: 8, total_interest_actions_all: 10 },
            { event_id: 'R000002', rank: 2, total_interest_actions_30d: 4, total_interest_actions_all: 20 }
          ];
          return route.fulfill({ json: { ok: true, type: 'interest_preview', items } });
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
          await expect(section.locator('[data-status="top"]')).toHaveText(state === 'empty' || state === 'unmatched' ? home.interestEmpty : home.interestError);
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
      recent_updates_last_days: {
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
      await expect(cards.nth(index + 1).locator('.update-meta')).toContainText(home.path === '/' ? ' · dogodek ' : ' · event ');
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
