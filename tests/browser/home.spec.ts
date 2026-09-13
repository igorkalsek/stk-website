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
    featured: 'Featured in the coming days',
    updates: 'Fresh calendar changes',
    calendar: 'Personal calendar instructions',
    organisers: 'More for organisers'
  }
];

async function mockHomepageApis(page: Page) {
  const events = [
    ['1', '2026-09-13', 'Fallback race', 'Kranj'],
    ['2', '2026-09-26', 'Ranked race two', 'Velenje'],
    ['3', '2026-09-27', 'Ranked race three', 'Slovenske Konjice'],
    ['4', '2026-09-14', 'Second fallback race', 'Celje']
  ].map(([row, datum, naziv_prireditve, kraj]) => ({
    row, datum, naziv_prireditve, kraj, regija: 'Savinjska', status_dogodka: 'potrjeno',
    vidno_v_javnem_koledarju: 'DA', povezava_prijava: `https://example.com/register/${row}?private=drop`
  }));
  await page.route('**/api/interest-preview', (route) => route.fulfill({ json: {
    ok: true,
    type: 'interest_preview',
    items: [{ event_id: 'R000002', rank: 1 }, { event_id: 'R000003', rank: 2 }]
  } }));
  await page.route(`${API_HOST}/**`, async (route) => {
    const url = new URL(route.request().url());
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
