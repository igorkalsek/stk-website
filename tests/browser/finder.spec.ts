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
  additional('103', '2026-10-10', 'Soča Mountain Ultra', '35', '50', '2026-09-25', '', '', '2100', 'https://example.com/route-soca'),
  additional('104', '2026-11-08', 'Celje City Run', '12', '24', '2026-10-28', '', '', '120', 'https://example.com/notice')
];

const additional2027 = [
  additional('201', '2027-05-01', 'Koper Spring Run', '15', '20', '2027-04-20', '', 'da', '250', 'https://example.com/route-koper'),
  additional('202', '2027-06-12', 'Pohorje Trail', '30', '45', '2027-05-30', '', '', '1400', 'https://example.com/route-pohorje')
];

function race(row: string, datum: string, naziv_prireditve: string, kraj: string, regija: string, tip_podlage: string, razdalje_km: string, opombe_javne: string) {
  return { row, datum, naziv_prireditve, kraj, regija, tip_podlage, razdalje_km, opombe_javne, status_dogodka: 'potrjeno', vidno_v_javnem_koledarju: 'DA', cas_zacetka: '10:00', povezava_razpis: 'https://example.com/notice', povezava_prijava: 'https://example.com/register' };
}

function additional(master_row: string, datum: string, naziv_prireditve: string, prijavnina_min_eur: string, prijavnina_max_eur: string, rok_prijave: string, rok_cenejse_prijave: string, prijave_na_dan_dogodka: string, visinski_m_plus: string, trasa_url: string) {
  const leto = datum.slice(0, 4);
  return { leto, master_sheet: leto, master_row, datum, naziv_prireditve, zanesljivost: 'visoka', prijavnina_min_eur, prijavnina_max_eur, rok_prijave, rok_cenejse_prijave, prijave_na_dan_dogodka, visinski_m_plus, trasa_url };
}

async function mockFinderApis(page: Page) {
  const analytics: unknown[] = [];
  await page.route(`${API_HOST}/**`, async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/additional') return route.fulfill({ json: { data: url.searchParams.get('year') === '2027' ? additional2027 : additional2026 } });
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

async function freezeFinderDate(page: Page) {
  const clock = (page as Page & { clock?: { setFixedTime: (date: Date) => Promise<void> } }).clock;
  if (clock?.setFixedTime) {
    await clock.setFixedTime(new Date('2026-07-25T10:00:00+02:00'));
    return;
  }
  await page.addInitScript(() => {
    const fixed = new Date('2026-07-25T08:00:00.000Z').getTime();
    const RealDate = Date;
    class MockDate extends RealDate {
      constructor(...args: any[]) {
        if (args.length === 0) super(fixed);
        else super(args[0], args[1], args[2], args[3], args[4], args[5], args[6]);
      }
      static now() { return fixed; }
    }
    Object.defineProperty(window, 'Date', { configurable: true, value: MockDate });
  });
}

test.beforeEach(async ({ page }) => {
  await freezeFinderDate(page);
});

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


const storedPreferences = JSON.stringify({
  version: 1,
  distanceBuckets: ['over-5-to-10'],
  surfaceCategories: ['trail'],
  regions: [],
  familyFriendly: false,
  active: false
});

async function seedStoredPreferences(page: Page, active = false) {
  await page.addInitScript(({ value, active }) => {
    const parsed = JSON.parse(value);
    parsed.active = active;
    localStorage.setItem('stkRacePreferencesV1', JSON.stringify(parsed));
  }, { value: storedPreferences, active });
}


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
  await freezeFinderDate(page);
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

test('preserves and applies additional-data filters for the 2027 Slovenian finder', async ({ page }) => {
  await openFinder(page, '/iskalnik-tekov/?year=2027&fee=20', 'sl');
  await expect(page).toHaveURL(/year=2027/);
  await expect(page).toHaveURL(/fee=20/);
  await expect(page.locator('[data-filter="registration-fee"]')).toHaveValue('20');
  await expect(page.locator('[data-search-results]')).toContainText('Koper Spring Run');
  await expect(page.locator('[data-search-results]')).not.toContainText('Pohorje Trail');
});

test('preserves 2027 additional quick picks through the shared English finder state', async ({ page }) => {
  await openFinder(page, '/en/find-races/?year=2027&quick=deadlines-soon,budget,route', 'en');
  await expect(page).toHaveURL(/year=2027/);
  await expect(page).toHaveURL(/quick=deadlines-soon%2Cbudget%2Croute/);
  for (const quick of ['deadlines-soon', 'budget', 'route']) {
    await expect(page.locator(`[data-quick-pick="${quick}"]`)).toHaveAttribute('aria-pressed', 'true');
  }
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



test('uses a desktop sidebar with separate results column and toolbar sort', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openFinder(page, '/en/find-races/', 'en');
  await expect(page.locator('.finder-workspace')).toBeVisible();
  await expect(page.locator('.finder-sidebar')).toBeVisible();
  await expect(page.locator('.finder-results-column')).toBeVisible();
  await expect(page.locator('.finder-results-toolbar [data-filter="sort"]')).toBeVisible();
  const sidebar = await page.locator('.finder-sidebar').boundingBox();
  const results = await page.locator('.finder-results-column').boundingBox();
  expect(sidebar).toBeTruthy();
  expect(results).toBeTruthy();
  expect(sidebar!.width).toBeGreaterThanOrEqual(280);
  expect(sidebar!.width).toBeLessThanOrEqual(340);
  expect(results!.x).toBeGreaterThan(sidebar!.x + sidebar!.width - 1);
});

test('stacks finder workspace on mobile without horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 });
  await openFinder(page, '/en/find-races/', 'en');
  const sidebar = await page.locator('.finder-sidebar').boundingBox();
  const results = await page.locator('.finder-results-column').boundingBox();
  expect(sidebar).toBeTruthy();
  expect(results).toBeTruthy();
  expect(results!.y).toBeGreaterThan(sidebar!.y);
  await expect(page.locator('[data-more-filters]')).not.toHaveAttribute('open', '');
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  expect(overflow).toBe(false);
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
  await expect(more.locator('[data-filter="sort"]')).toHaveCount(0);
  await expect(page.locator('.finder-results-toolbar [data-filter="sort"]')).toBeVisible();
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

test('deduplicates secondary race actions by destination URL', async ({ page }) => {
  await openFinder(page, '/en/find-races/?q=Celje', 'en');
  const sameUrlCard = page.locator('.search-event-card').filter({ hasText: 'Celje City Run' });
  await sameUrlCard.locator('.search-event-more-menu summary').click();
  const sameMenu = sameUrlCard.locator('.search-event-more-menu-options');
  const official = sameMenu.getByRole('link', { name: 'Official info' });
  await expect(official).toHaveCount(1);
  await expect(official).toHaveAttribute('href', 'https://example.com/notice');
  await expect(official).toHaveAttribute('data-analytics-link-type', 'razpis');
  await expect(sameMenu.getByRole('link', { name: 'Route' })).toHaveCount(0);

  await page.goto('/en/find-races/?q=Ljubljana');
  await expect(page.locator('[data-result-count]')).toContainText(/race/i);
  const differentUrlCard = page.locator('.search-event-card').filter({ hasText: 'Ljubljana 10K Trail' });
  await differentUrlCard.locator('.search-event-more-menu summary').click();
  const differentMenu = differentUrlCard.locator('.search-event-more-menu-options');
  await expect(differentMenu.getByRole('link', { name: 'Official info' })).toHaveCount(1);
  await expect(differentMenu.getByRole('link', { name: 'Route' })).toHaveCount(1);
  await expect(differentMenu.getByRole('link', { name: 'Route' })).toHaveAttribute('href', 'https://example.com/route-ljubljana');
});

test('tracks localized finder registration links with the compatible writer contract', async ({ page }) => {
  for (const [path, language] of [['/iskalnik-tekov/?q=Ljubljana', 'sl'], ['/en/find-races/?q=Ljubljana', 'en']] as const) {
    const analytics = await mockFinderApis(page);
    await page.goto(path);
    await expect(page.locator('[data-result-count]')).toContainText(language === 'en' ? /race/i : /dogodek|tek/i);
    const registration = page.locator('.search-event-card a[href="https://example.com/register"]').first();
    await registration.evaluate((link) => link.addEventListener('click', (event) => event.preventDefault(), { once: true }));
    await registration.click();
    await expect.poll(() => analytics.find((event: any) => event.action_type === 'prijava')).toBeTruthy();
    const payload = analytics.find((event: any) => event.action_type === 'prijava') as any;
    expect(payload).toMatchObject({
      event_type: 'external_link_clicked', language, event_id: '101', event_year: '2026', event_key: '2026:101',
      target_url: 'https://example.com/register', target_domain: 'example.com', placement: 'finder_results'
    });
  }
});

test('shows only the no-saved-preferences state', async ({ page }) => {
  await openFinder(page, '/en/find-races/', 'en');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await expect(page.locator('[data-result-count]')).toContainText(/race/i);
  await expect(page.getByRole('button', { name: 'Set preferences' })).toBeVisible();
  await expect(page.getByText('Choose your preferred distances, surfaces and regions. The information stays only in this browser.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Show races for me' })).toBeHidden();
  await expect(page.getByRole('button', { name: 'Show all races' })).toBeHidden();
  await expect(page.getByRole('button', { name: 'Reset' })).toBeHidden();
  await expect(page.locator('[data-preferences-summary]')).toBeHidden();
  await expect(page.locator('[data-preferences-form]')).toBeHidden();
  const tabbableFormControls = await page.locator('[data-preferences-form] input, [data-preferences-form] button').evaluateAll((controls) => controls.filter((control) => (control as HTMLElement).tabIndex >= 0).length);
  expect(tabbableFormControls).toBe(0);
});

test('shows only the saved inactive race-preferences state', async ({ page }) => {
  await seedStoredPreferences(page, false);
  await openFinder(page, '/en/find-races/', 'en');
  await expect(page.locator('[data-preferences-compact]')).toContainText('Preferences are saved');
  await expect(page.locator('[data-preferences-summary]')).toContainText('5–10 km');
  await expect(page.locator('[data-preferences-summary]')).toContainText('Trail');
  await expect(page.getByRole('button', { name: 'Show races for me' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Edit' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Reset' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Set preferences' })).toBeHidden();
  await expect(page.getByRole('button', { name: 'Show all races' })).toBeHidden();
  await expect(page.locator('[data-preferences-form]')).toBeHidden();
});

test('shows only the active race-preferences state', async ({ page }) => {
  await seedStoredPreferences(page, true);
  await openFinder(page, '/en/find-races/', 'en');
  await expect(page.locator('[data-preferences-compact]')).toContainText('Races for me is active');
  await expect(page.locator('[data-preferences-summary]')).toContainText('5–10 km');
  await expect(page.getByRole('button', { name: 'Edit' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Show all races' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Set preferences' })).toBeHidden();
  await expect(page.getByRole('button', { name: 'Show races for me' })).toBeHidden();
  await expect(page.getByRole('button', { name: 'Reset' })).toBeHidden();
  await expect(page.locator('[data-preferences-form]')).toBeHidden();
  await expect(page.locator('[data-filter="sort"]')).toHaveValue('my-races');
});

test('shows only the editing race-preferences state and restores compact state on cancel', async ({ page }) => {
  await seedStoredPreferences(page, false);
  await openFinder(page, '/en/find-races/', 'en');
  const apiBefore = await page.evaluate(() => performance.getEntriesByType('resource').filter((entry) => entry.name.includes('stk-master-api')).length);
  await page.getByRole('button', { name: 'Edit' }).click();
  await expect(page.locator('[data-preferences-form]')).toBeVisible();
  await expect(page.locator('[data-preferences-form-heading]')).toBeFocused();
  await expect(page.locator('[data-preferences-state-text]')).toBeHidden();
  await expect(page.locator('[data-preferences-summary]')).toBeHidden();
  await expect(page.locator('[data-preferences-compact]')).toBeHidden();
  await expect(page.getByRole('button', { name: 'Save and show races for me' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Cancel editing' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Reset preference' })).toBeVisible();
  await page.getByRole('button', { name: 'Cancel editing' }).click();
  await expect(page.locator('[data-preferences-compact]')).toContainText('Preferences are saved');
  await expect(page.getByRole('button', { name: 'Edit' })).toBeFocused();
  const apiAfter = await page.evaluate(() => performance.getEntriesByType('resource').filter((entry) => entry.name.includes('stk-master-api')).length);
  expect(apiAfter).toBe(apiBefore);
});

test('keeps first-time race preferences compact until setup is requested', async ({ page }) => {
  const analytics = await mockFinderApis(page);
  await page.goto('/en/find-races/');
  await expect(page.locator('[data-result-count]')).toContainText(/race/i);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await expect(page.locator('[data-preferences-form]')).toBeHidden();
  await expect(page.getByRole('button', { name: 'Set preferences' })).toBeVisible();
  await expect(page.getByText('Choose your preferred distances, surfaces and regions. The information stays only in this browser.')).toHaveCount(1);
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
  await expect(page.getByRole('button', { name: 'Show all races' })).toBeVisible();
  await page.getByRole('button', { name: 'Show all races' }).click();
  await expect(page.locator('[data-preferences-compact]')).toContainText('Preferences are saved');
  await expect(page.getByRole('button', { name: 'Show races for me' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Reset' })).toBeVisible();
  await page.getByRole('button', { name: 'Show races for me' }).click();
  await expect(page.locator('[data-filter="sort"]')).toHaveValue('my-races');
  await expect(page.getByRole('button', { name: 'Edit' })).toBeVisible();
  await page.getByRole('button', { name: 'Edit' }).click();
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
  await expect(card.locator('.search-event-primary-actions')).toContainText('Details');
  await expect(card.locator('.search-event-primary-actions')).toContainText('Registration');
  await expect(card.locator('[data-saved-race-button]')).toBeVisible();
  await card.locator('[data-saved-race-button]').click();
  await expect(card.locator('[data-saved-race-button]')).toHaveAttribute('aria-pressed', 'true');
  await expect(card.locator('.search-event-secondary-actions')).toContainText('More');
  await expect(card.locator('.calendar-menu')).toHaveCount(0);
  await expect(card.locator('details.search-event-more-menu')).toHaveCount(1);
  await card.locator('.search-event-more-menu summary').click();
  await expect(card.locator('.search-event-more-menu-options')).toContainText('Google Calendar');
  await expect(card.locator('.search-event-more-menu-options')).toContainText('Apple / iCal');
  await expect(card.locator('.search-event-more-menu-options')).toContainText('Outlook');
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
  await expect(page.locator('[data-search-results]')).toContainText('More');
  await expect(page.locator('[data-search-results]')).toContainText('Details');
  await expect(page.locator('[data-search-results]')).toContainText('Google Calendar');
});
