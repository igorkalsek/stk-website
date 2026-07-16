import { expect, test, type Page } from '@playwright/test';

const API_HOST = 'https://stk-master-api.igor-kalsek.workers.dev';
const ANALYTICS_HOST = 'https://script.google.com';

const races2026 = [
  race('101', '2026-08-15', 'Ljubljana 10K Trail', 'Ljubljana', 'Osrednjeslovenska', 'trail', '10', 'družinam prijazno otroški tek'),
  race('102', '2026-09-20', 'Maribor Road 5K', 'Maribor', 'Podravska', 'cesta', '5', ''),
  race('103', '2026-10-10', 'Soča Mountain Ultra', 'Bovec', 'Goriška', 'gorski tek', '55', ''),
  race('104', '2026-11-08', 'Celje City Run', 'Celje', 'Savinjska', 'cesta', '21.1', '')
];

const races2027 = [
  race('201', '2027-05-01', 'Koper Spring Run', 'Koper', 'Obalno-kraška', 'cesta', '10', ''),
  race('202', '2027-06-12', 'Pohorje Trail', 'Maribor', 'Podravska', 'trail', '25', ''),
  race('203', '2027-09-04', 'Bled Family Run', 'Bled', 'Gorenjska', 'cesta/trail', '5;10', 'družinam prijazno otroški tek')
];

const additional2026 = [
  additional('101', '2026-08-15', 'Ljubljana 10K Trail', '15', '25', '2026-08-05', '2026-07-25', 'da', '450', 'https://example.com/route-ljubljana'),
  additional('102', '2026-09-20', 'Maribor Road 5K', '8', '12', '2026-09-10', '', '', '90', ''),
  additional('103', '2026-10-10', 'Soča Mountain Ultra', '35', '50', '2026-09-25', '', '', '2100', 'https://example.com/route-soca')
];

function race(row: string, datum: string, naziv_prireditve: string, kraj: string, regija: string, tip_podlage: string, razdalje_km: string, opombe_javne: string) {
  return { row, datum, naziv_prireditve, kraj, regija, tip_podlage, razdalje_km, opombe_javne, status_dogodka: 'potrjeno', vidno_v_javnem_koledarju: 'DA', cas_zacetka: '10:00', povezava_razpis: 'https://example.com/notice', povezava_prijava: 'https://example.com/register' };
}

function additional(master_row: string, datum: string, naziv_prireditve: string, prijavnina_min_eur: string, prijavnina_max_eur: string, rok_prijave: string, rok_cenejse_prijave: string, prijave_na_dan_dogodka: string, visinski_m_plus: string, trasa_url: string) {
  return { master_row, datum, naziv_prireditve, zanesljivost: 'visoka', prijavnina_min_eur, prijavnina_max_eur, rok_prijave, rok_cenejse_prijave, prijave_na_dan_dogodka, visinski_m_plus, trasa_url };
}

async function mockFinderApis(page: Page) {
  const analytics: unknown[] = [];
  await page.route(`${API_HOST}/**`, async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/additional') return route.fulfill({ json: { data: additional2026 } });
    if (url.pathname === '/top') return route.fulfill({ json: { data: [] } });
    return route.fulfill({ json: { data: url.searchParams.get('year') === '2027' ? races2027 : races2026 } });
  });
  await page.route(`${ANALYTICS_HOST}/**`, async (route) => {
    const postData = route.request().postData();
    if (postData) analytics.push(JSON.parse(postData));
    return route.fulfill({ status: 204, body: '' });
  });
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'sendBeacon', { configurable: true, value: undefined });
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async (value: string) => { (window as any).__copiedText = value; } } });
  });
  return analytics;
}

type FinderLanguage = 'sl' | 'en';

async function openFinder(page: Page, path = '/en/find-races/', language: FinderLanguage = path.startsWith('/en/') ? 'en' : 'sl') {
  await mockFinderApis(page);
  await page.goto(path);
  const expectedCountPattern = language === 'en' ? /race/i : /dogodek|dogodka|dogodki|dogodkov|tek/i;
  await expect(page.locator('[data-result-count]')).toContainText(expectedCountPattern);
}

const chip = (page: Page, kind: string, value?: string) => {
  const selector = value
    ? `[data-remove-filter="${kind}"][data-remove-filter-value="${value}"]`
    : `[data-remove-filter="${kind}"]`;

  return page.locator(selector);
};


test('localizes single English result count as 1 race', async ({ page }) => {
  await openFinder(page, '/en/find-races/?q=Maribor', 'en');
  await expect(page.locator('[data-result-count]')).toHaveText('1 race');
});

test('localizes single Slovenian result count as 1 dogodek', async ({ page }) => {
  await openFinder(page, '/iskalnik-tekov/?q=Maribor', 'sl');
  await expect(page.locator('[data-result-count]')).toHaveText('1 dogodek');
});

test('@smoke restores shareable URL filters, chips and language/year links', async ({ page }) => {
  await openFinder(page, '/en/find-races/?q=Ljubljana&month=08&surface=trail&distance=over-5-to-10&quick=route');
  await expect(page.locator('[data-filter="search"]')).toHaveValue('Ljubljana');
  await expect(page.locator('[data-filter="month"]')).toHaveValue('08');
  await expect(page.locator('[data-quick-pick="route"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(chip(page, 'q')).toContainText('Ljubljana');
  await expect(chip(page, 'month', '08')).toContainText('August');
  await expect(chip(page, 'surface', 'trail')).toContainText('Trail');
  await expect(chip(page, 'distance', 'over-5-to-10')).toContainText('Over 5 to 10 km');
  await expect(chip(page, 'quick', 'route')).toContainText('With route');
  await expect(page.locator('a[hreflang="sl"]')).toHaveAttribute('href', /\/iskalnik-tekov\/\?q=Ljubljana/);
  await expect(page.locator('[data-year-link="2027"]')).toHaveAttribute('href', /year=2027/);
  await page.reload();
  await expect(page.locator('[data-filter="search"]')).toHaveValue('Ljubljana');
  await expect(chip(page, 'q')).toContainText('Ljubljana');
  await expect(chip(page, 'quick', 'route')).toContainText('With route');
});

test('removes individual chips and preserves direct filters distinct from quick picks', async ({ page }) => {
  await openFinder(page);
  await page.locator('[data-quick-pick="budget"]').click();
  await expect(page).toHaveURL(/quick=budget/);
  await expect(page.locator('[data-filter="registration-fee"]')).toHaveValue('20');
  await page.locator('[data-remove-filter="quick"][data-remove-filter-value="budget"]').click();
  await expect(page.locator('[data-filter="registration-fee"]')).toHaveValue('');

  const moreFilters = page.locator('[data-more-filters]');
  await moreFilters.locator('summary').click();
  await expect(moreFilters.locator('[data-filter="registration-fee"]')).toBeVisible();
  await moreFilters.locator('[data-filter="registration-fee"]').selectOption('20');
  await expect(page).toHaveURL(/fee=20/);
  await expect(page.locator('[data-quick-pick="budget"]')).toHaveAttribute('aria-pressed', 'false');
  await expect(chip(page, 'fee', '20')).toContainText('Up to €20');
  await moreFilters.locator('summary').click();
  await expect(moreFilters).not.toHaveAttribute('open', '');
  await expect(page.locator('[data-filter="registration-fee"]')).toHaveValue('20');
  await expect(chip(page, 'fee', '20')).toContainText('Up to €20');
});

test('exercises production additional-data fields for direct filters', async ({ page }) => {
  await openFinder(page, '/en/find-races/?fee=20&deadline=within-14&raceDay=1&route=1&elevation=max-800');
  await expect(page.locator('[data-filter="registration-fee"]')).toHaveValue('20');
  await expect(page.locator('[data-filter="deadline"]')).toHaveValue('within-14');
  await expect(page.locator('[data-filter="day-of-registration"]')).toBeChecked();
  await expect(page.locator('[data-filter="route"]')).toBeChecked();
  await expect(page.locator('[data-filter="elevation"]')).toHaveValue('max-800');
  await expect(chip(page, 'fee', '20')).toContainText('Up to €20');
  await expect(chip(page, 'deadline', 'within-14')).toContainText('Deadline within 14 days');
  await expect(chip(page, 'raceDay')).toContainText('Race-day registration');
  await expect(chip(page, 'route')).toContainText('Has route / map');
  await expect(chip(page, 'elevation', 'max-800')).toContainText('Up to 800 m+');
  await expect(page.locator('[data-search-results]')).toContainText('Ljubljana 10K Trail');
});

test('hydrates 2027 filters from a sparse future-year master payload', async ({ page }) => {
  await openFinder(page, '/en/find-races/?year=2027&month=06&region=Podravska&surface=trail');
  await expect(page.locator('[data-filter="month"]')).toHaveValue('06');
  await expect(page.locator('[data-filter="region"]')).toHaveValue('Podravska');
  await expect(page.locator('[data-filter="surface"]')).toHaveValue('trail');
  await expect(page.locator('[data-search-results]')).toContainText('Pohorje Trail');
  await expect(page.locator('[data-search-results]')).not.toContainText('Koper Spring Run');
});


test('supports Back/Forward URL restoration without duplicate search analytics', async ({ page }) => {
  const analytics = await mockFinderApis(page);
  await page.goto('/en/find-races/?q=Ljubljana');
  await expect(page.locator('[data-result-count]')).toContainText(/race/i);

  const searchEventsBeforeNavigation = analytics.filter((event: any) => event.event_type === 'search_performed').length;

  await page.evaluate(() => {
    window.history.pushState({}, '', '/en/find-races/?q=Ljubljana&distance=over-5-to-10');
    window.dispatchEvent(new PopStateEvent('popstate'));
  });

  await expect(page.locator('[data-filter="search"]')).toHaveValue('Ljubljana');
  await expect(page.locator('[data-filter="distance"]')).toHaveValue('over-5-to-10');
  await expect(chip(page, 'q')).toContainText('Ljubljana');
  await expect(chip(page, 'distance', 'over-5-to-10')).toContainText('Over 5 to 10 km');
  await expect(page.locator('[data-search-results]')).toContainText('Ljubljana 10K Trail');

  await page.goBack();
  await expect(page.locator('[data-filter="search"]')).toHaveValue('Ljubljana');
  await expect(page.locator('[data-filter="distance"]')).toHaveValue('all');
  await expect(chip(page, 'distance', 'over-5-to-10')).toHaveCount(0);

  await page.goForward();
  await expect(page.locator('[data-filter="distance"]')).toHaveValue('over-5-to-10');
  await expect(chip(page, 'distance', 'over-5-to-10')).toContainText('Over 5 to 10 km');

  await expect.poll(() => analytics.filter((event: any) => event.event_type === 'search_performed').length).toBe(searchEventsBeforeNavigation);
});

test('keeps Races for me private while emitting only safe personalized analytics', async ({ page }) => {
  const analytics = await mockFinderApis(page);
  await page.goto('/en/find-races/?q=private-query');
  await expect(page.locator('[data-result-count]')).toContainText(/race/i);
  await page.getByRole('button', { name: 'Set preferences' }).click();
  await page.locator('[data-preference-distance="over-5-to-10"]').check();
  await page.locator('[data-preference-surface="trail"]').check();
  await page.locator('[data-save-preferences]').click();
  await expect(page.locator('[data-filter="sort"]')).toHaveValue('my-races');
  await expect(page).not.toHaveURL(/my-races/);
  await expect.poll(() => page.evaluate(() => localStorage.getItem('stkRacePreferencesV1') ?? '')).toContain('over-5-to-10');
  await expect.poll(() => analytics.find((event: any) => event.event_type === 'personalized_results_used')).toBeTruthy();
  const personalized = analytics.find((event: any) => event.event_type === 'personalized_results_used') as any;
  expect(personalized.filters_json).not.toContain('private-query');
  expect(personalized.filters_json).not.toContain('over-5-to-10');
});

test('shows primary filters and keeps optional filters in one disclosure', async ({ page }) => {
  await openFinder(page, '/iskalnik-tekov/', 'sl');
  await expect(page.locator('.finder-primary-filters [data-filter="search"]')).toBeVisible();
  await expect(page.locator('.finder-primary-filters [data-filter="month"]')).toBeVisible();
  await expect(page.locator('.finder-primary-filters [data-filter="region"]')).toBeVisible();
  await expect(page.locator('.finder-primary-filters [data-filter="distance"]')).toBeVisible();
  const more = page.locator('[data-more-filters]');
  await expect(more).not.toHaveAttribute('open', '');
  await expect(more.locator('[data-filter="surface"]')).not.toBeVisible();
  await more.locator('summary').click();
  await expect(more.locator('[data-filter="surface"]')).toBeVisible();
  await expect(more.locator('[data-filter="registration-fee"]')).toBeVisible();
  await expect(more.locator('[data-filter="deadline"]')).toBeVisible();
  await expect(more.locator('[data-filter="sort"]')).toBeVisible();
  await expect(more.locator('[data-filter="family"]')).toBeVisible();
  await expect(more.locator('[data-filter="route"]')).toBeVisible();
  await expect(more.locator('[data-filter="elevation"]')).toBeVisible();
  await more.locator('[data-filter="registration-fee"]').selectOption('20');
  await expect(page).toHaveURL(/fee=20/);
  await expect(more.locator('summary')).toContainText('Več filtrov (1)');
  await expect(chip(page, 'fee', '20')).toContainText('Do 20 €');
  await more.locator('summary').click();
  await expect(more).not.toHaveAttribute('open', '');
  await expect(page.locator('[data-filter="registration-fee"]')).toHaveValue('20');
});

test('keeps first-time race preferences compact until setup is requested', async ({ page }) => {
  const analytics = await mockFinderApis(page);
  await page.goto('/en/find-races/');
  await expect(page.locator('[data-result-count]')).toContainText(/race/i);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await expect(page.locator('[data-preferences-form]')).toBeHidden();
  await expect(page.getByRole('button', { name: 'Set preferences' })).toBeVisible();
  const apiBefore = await page.evaluate(() => performance.getEntriesByType('resource').filter((entry) => entry.name.includes('stk-master-api')).length);
  await page.getByRole('button', { name: 'Set preferences' }).click();
  await expect(page.locator('[data-preferences-form]')).toBeVisible();
  await expect(page.locator('[data-preferences-form-heading]')).toBeFocused();
  await page.locator('[data-preference-distance="over-5-to-10"]').check();
  await page.locator('[data-preference-surface="trail"]').check();
  await page.locator('[data-save-preferences]').click();
  await expect(page.locator('[data-preferences-form]')).toBeHidden();
  await expect(page.locator('[data-preferences-compact]')).toContainText('Races for me is active');
  await expect(page.locator('[data-preferences-summary]')).toContainText('5–10 km');
  await expect(page.locator('[data-preferences-summary]')).toContainText('Trail');
  await expect(page.locator('[data-filter="sort"]')).toHaveValue('my-races');
  await expect(page.getByRole('button', { name: 'Edit preferences' })).toBeVisible();
  await page.getByRole('button', { name: 'Edit preferences' }).click();
  await expect(page.locator('[data-preferences-form]')).toBeVisible();
  const apiAfter = await page.evaluate(() => performance.getEntriesByType('resource').filter((entry) => entry.name.includes('stk-master-api')).length);
  expect(apiAfter).toBe(apiBefore);
  expect(analytics.some((event: any) => JSON.stringify(event).includes('over-5-to-10'))).toBeFalsy();
});

test('renders compact race facts and separates primary and secondary actions', async ({ page }) => {
  await openFinder(page, '/en/find-races/?q=Ljubljana', 'en');
  const card = page.locator('.search-event-card').first();
  await expect(card.locator('.search-event-location')).toContainText('Ljubljana · Osrednjeslovenska');
  await expect(card.locator('.search-event-facts')).toContainText('Trail');
  await expect(card.locator('.search-event-facts')).toContainText('10 km');
  await expect(card.locator('.search-event-facts')).toContainText('start 10:00');
  await expect(card.locator('.search-event-primary-actions')).toContainText('Race details');
  await expect(card.locator('.search-event-primary-actions')).toContainText('Registration');
  await expect(card.locator('[data-saved-race-button]')).toBeVisible();
  await expect(card.locator('.search-event-secondary-actions')).toContainText('More options');
  await expect(card.locator('.calendar-menu')).not.toHaveAttribute('open', '');
  await card.locator('.calendar-menu summary').click();
  await expect(card.locator('.calendar-menu-options')).toContainText('Google');
  await expect(card.locator('.calendar-menu-options')).toContainText('Apple / iCal');
  await expect(card.locator('.calendar-menu-options')).toContainText('Outlook');
  await expect(card).toHaveAttribute('data-analytics-placement', 'finder_results');
  await expect(card.locator('a[href="https://example.com/register"]')).toHaveCount(1);
  await expect(card.locator('a[href="https://example.com/notice"]')).toHaveCount(1);
});

test('keeps compact finder labels localized in English', async ({ page }) => {
  await openFinder(page, '/en/find-races/', 'en');
  await expect(page.locator('[data-more-filters] summary')).toContainText('More filters');
  await expect(page.getByRole('button', { name: 'Set preferences' })).toBeVisible();
  await expect(page.getByText('Več filtrov')).toHaveCount(0);
  await expect(page.getByText('Nastavite preference')).toHaveCount(0);
  await page.locator('[data-search-results] .search-event-more-menu summary').first().click();
  await expect(page.locator('[data-search-results]')).toContainText('More options');
  await expect(page.locator('[data-search-results]')).toContainText('Race details');
  await expect(page.locator('[data-search-results]')).toContainText('Add to calendar');
});
