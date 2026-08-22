import { expect, test, type Page } from '@playwright/test';

const API_HOST = 'https://stk-master-api.igor-kalsek.workers.dev';
const ANALYTICS_HOST = 'https://script.google.com';
const V1_KEY = 'stkSavedRacesV1';
const V2_KEY = 'stkSavedRacesV2';

type SavedRaceStatus = 'following' | 'planning' | 'registered' | 'completed';
type SavedRaceFixture = { eventId: string; year: string; date: string; title: string; status?: SavedRaceStatus };

const races2026 = [
  {
    row: '101',
    datum: '2026-08-15',
    naziv_prireditve: 'Ljubljana Test Run',
    kraj: 'Ljubljana',
    regija: 'Osrednjeslovenska',
    tip_podlage: 'cesta',
    razdalje_km: '10',
    status_dogodka: 'potrjeno',
    vidno_v_javnem_koledarju: 'DA',
    povezava_razpis: 'https://example.com/notice-101',
    povezava_prijava: 'https://example.com/register-101'
  },
  {
    row: '102',
    datum: '2026-09-20',
    naziv_prireditve: 'Maribor Test Trail',
    kraj: 'Maribor',
    regija: 'Podravska',
    tip_podlage: 'trail',
    razdalje_km: '15',
    status_dogodka: 'potrjeno',
    vidno_v_javnem_koledarju: 'DA'
  },
  {
    row: '103',
    datum: '2026-10-10',
    naziv_prireditve: 'Celje Test Run',
    kraj: 'Celje',
    regija: 'Savinjska',
    tip_podlage: 'cesta',
    razdalje_km: '5',
    status_dogodka: 'potrjeno',
    vidno_v_javnem_koledarju: 'DA'
  },
  {
    row: '104',
    datum: '2026-01-10',
    naziv_prireditve: 'Past Test Run',
    kraj: 'Kranj',
    regija: 'Gorenjska',
    tip_podlage: 'cesta',
    razdalje_km: '10',
    status_dogodka: 'potrjeno',
    vidno_v_javnem_koledarju: 'DA'
  }
];

const additional2026 = [
  {
    leto: '2026',
    master_sheet: '2026',
    master_row: '101',
    datum: '2026-08-15',
    naziv_prireditve: 'Ljubljana Test Run',
    zanesljivost: 'visoka',
    rok_cenejse_prijave: '2026-07-18',
    rok_prijave: '2026-07-23'
  }
];


const statusFilterAdditional2026 = [
  {
    leto: '2026', master_sheet: '2026',
    master_row: '101',
    datum: '2026-08-15',
    naziv_prireditve: 'Ljubljana Test Run',
    zanesljivost: 'visoka',
    rok_cenejse_prijave: '2026-07-18',
    rok_prijave: '2026-07-24'
  },
  {
    leto: '2026', master_sheet: '2026',
    master_row: '102',
    datum: '2026-09-20',
    naziv_prireditve: 'Maribor Test Trail',
    zanesljivost: 'visoka',
    rok_cenejse_prijave: '2026-07-19',
    rok_prijave: '2026-07-25'
  },
  {
    leto: '2026', master_sheet: '2026',
    master_row: '103',
    datum: '2026-10-10',
    naziv_prireditve: 'Celje Test Run',
    zanesljivost: 'visoka',
    rok_cenejse_prijave: '2026-07-20',
    rok_prijave: '2026-07-26'
  }
];

const duplicateAdditional2026 = [
  {
    leto: '2026',
    master_sheet: '2026',
    master_row: '101',
    datum: '2026-08-15',
    naziv_prireditve: 'Ljubljana Test Run',
    zanesljivost: 'visoka',
    rok_cenejse_prijave: '2026-07-16',
    rok_prijave: '2026-07-16'
  }
];

const byId: Record<string, SavedRaceFixture> = {
  r000101: { eventId: 'r000101', year: '2026', date: '2026-08-15', title: 'Ljubljana Test Run' },
  r000102: { eventId: 'r000102', year: '2026', date: '2026-09-20', title: 'Maribor Test Trail' },
  r000103: { eventId: 'r000103', year: '2026', date: '2026-10-10', title: 'Celje Test Run' },
  r000104: { eventId: 'r000104', year: '2026', date: '2026-01-10', title: 'Past Test Run' },
  r000101_2027: { eventId: 'r000101', year: '2027', date: '2027-08-15', title: 'Ljubljana Future Run' }
};

const v2Race = (id: keyof typeof byId, status: SavedRaceStatus) => ({ version: 2, ...byId[id], status });
const legacyRace = (id: keyof typeof byId) => ({ version: 1, ...byId[id] });
const card = (page: Page, key: string) => page.locator(`[data-key="${key}"]`);
const deadlineGroup = (page: Page, key: string) => card(page, key).locator('[data-my-race-deadlines]');
const count = (page: Page, status: SavedRaceStatus) => page.locator(`[data-my-races-status-count="${status}"]`);
const filter = (page: Page, status: SavedRaceStatus | 'all') => page.locator(`[data-my-races-status-filter="${status}"]`);

async function freezeLjubljanaDate(page: Page) {
  const clock = (page as Page & { clock?: { setFixedTime: (date: Date) => Promise<void> } }).clock;
  if (clock?.setFixedTime) {
    await clock.setFixedTime(new Date('2026-07-15T10:00:00+02:00'));
    return;
  }
  await page.addInitScript(() => {
    const fixed = new Date('2026-07-15T08:00:00.000Z').getTime();
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

async function mockMyRacesApis(page: Page, options: { additional?: unknown[]; additional2027?: unknown[]; races2027?: unknown[]; additionalStatus?: number } = {}) {
  const analytics: unknown[] = [];
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  page.on('console', (msg) => {
    if (msg.type() !== 'error') return;
    const isExpectedAdditionalFailure = Boolean(options.additionalStatus && options.additionalStatus >= 400) && msg.text().includes('Failed to load resource');
    if (!isExpectedAdditionalFailure) pageErrors.push(msg.text());
  });

  const requestCounts = { master2026: 0, master2027: 0, additional: 0 };
  await page.route(`${API_HOST}/**`, async (route) => {
    const url = new URL(route.request().url());

    if (url.pathname === '/additional') {
      requestCounts.additional += 1;
      if (options.additionalStatus && options.additionalStatus >= 400) return route.fulfill({ status: options.additionalStatus, contentType: 'application/json', body: JSON.stringify({ error: 'additional failed' }) });
      const rows = url.searchParams.get('year') === '2027' ? options.additional2027 ?? [] : options.additional ?? additional2026;
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: rows }) });
    }

    if (url.searchParams.get('year') === '2027') {
      requestCounts.master2027 += 1;
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(options.races2027 ?? []) });
    }

    requestCounts.master2026 += 1;
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(races2026) });
  });

  await page.route(`${ANALYTICS_HOST}/**`, async (route) => {
    const postData = route.request().postData();
    if (postData) {
      try { analytics.push(JSON.parse(postData)); } catch { analytics.push(postData); }
    }
    return route.fulfill({ status: 204, body: '' });
  });

  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'sendBeacon', { configurable: true, value: undefined });
  });

  return { analytics, pageErrors, requestCounts };
}

async function seedLegacySavedRaces(page: Page, races: ReturnType<typeof legacyRace>[]) {
  await page.addInitScript(({ key, racesToSeed }) => {
    const marker = 'stk-test-seeded-v1';
    if (sessionStorage.getItem(marker) === 'true') return;
    localStorage.clear();
    localStorage.setItem(key, JSON.stringify({ version: 1, races: racesToSeed }));
    sessionStorage.setItem(marker, 'true');
  }, { key: V1_KEY, racesToSeed: races });
}

async function seedV2SavedRaces(page: Page, races: ReturnType<typeof v2Race>[]) {
  await page.addInitScript(({ key, racesToSeed }) => {
    const marker = 'stk-test-seeded-v2';
    if (sessionStorage.getItem(marker) === 'true') return;
    localStorage.clear();
    localStorage.setItem(key, JSON.stringify({ version: 2, races: racesToSeed }));
    sessionStorage.setItem(marker, 'true');
  }, { key: V2_KEY, racesToSeed: races });
}

async function readSavedRacesV2(page: Page) {
  return page.evaluate((key) => {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  }, V2_KEY);
}

async function readLegacySavedRaces(page: Page) {
  return page.evaluate((key) => localStorage.getItem(key), V1_KEY);
}

async function openMyRaces(page: Page, path = '/moji-teki/') {
  await freezeLjubljanaDate(page);
  await page.goto(path);
  await expect(page.locator('[data-my-races-app]')).not.toContainText(/Loading saved races|Nalagamo shranjene teke/);
}

async function expectNoUnexpectedErrors(pageErrors: string[]) {
  await expect.poll(() => pageErrors).toEqual([]);
}

test('attaches a 2027 deadline only to the matching 2027 saved race', async ({ page }) => {
  const race2027 = { ...races2026[0], datum: '2027-08-15', naziv_prireditve: 'Ljubljana Future Run' };
  const additional2027 = [{ ...additional2026[0], leto: '2027', master_sheet: '2027', datum: '2027-08-15', naziv_prireditve: 'Ljubljana Future Run', rok_cenejse_prijave: '', rok_prijave: '2027-08-01' }];
  const conflicting2026 = [{ ...additional2026[0], rok_prijave: '2026-07-23' }];
  const { pageErrors, requestCounts } = await mockMyRacesApis(page, { additional: conflicting2026, additional2027, races2027: [race2027] });
  await seedV2SavedRaces(page, [v2Race('r000101_2027', 'following')]);

  await openMyRaces(page);

  const raceCard = card(page, '2027:r000101');
  await expect(raceCard).toBeVisible();
  const registrationDeadline = raceCard.locator('[data-my-race-deadline][data-deadline-kind="registration"]');
  await expect(registrationDeadline).toHaveCount(1);
  await expect(registrationDeadline).toContainText('1. avgusta');
  await expect(raceCard).not.toContainText('23. julija');
  expect(requestCounts.additional).toBe(2);
  await expectNoUnexpectedErrors(pageErrors);
});

function expectNoPersonalStatusInAnalytics(analytics: unknown[]) {
  const serialized = JSON.stringify(analytics);
  expect(serialized).not.toMatch(/following|planning|registered|completed|status/);
}

test('uses one compact status control and a progressive calendar menu on a race card', async ({ page }) => {
  const { pageErrors } = await mockMyRacesApis(page);
  await seedV2SavedRaces(page, [v2Race('r000101', 'registered')]);

  await openMyRaces(page);

  const raceCard = card(page, '2026:r000101');
  const status = raceCard.getByLabel('Moj status');
  await expect(status).toHaveValue('registered');
  expect(await status.locator('option').evaluateAll((options) => options.map((option) => (option as HTMLOptionElement).value))).toEqual(['', 'following', 'planning', 'registered', 'completed']);
  await expect(raceCard.locator('[data-race-status-badge]')).toHaveCount(0);

  const primaryActions = raceCard.locator('.my-race-actions-primary');
  await expect(primaryActions.getByRole('link', { name: /Prijava/ })).toBeVisible();
  await expect(primaryActions.getByRole('link', { name: /Podrobnosti/ })).toBeVisible();
  await expect(primaryActions.getByRole('link', { name: /Razpis/ })).toBeVisible();
  await expect(primaryActions.locator('.my-race-action-registration')).toHaveCount(1);

  const calendar = raceCard.locator('[data-race-calendar-menu]');
  await expect(calendar).not.toHaveAttribute('open', '');
  await expect(calendar.locator('.race-calendar-actions a')).toHaveCount(3);
  await calendar.locator('summary').click();
  await expect(calendar).toHaveAttribute('open', '');
  await expect(calendar.locator('.race-calendar-actions')).toContainText('Google koledar');
  await expect(calendar.locator('.race-calendar-actions')).toContainText('Apple/iCal');
  await expect(calendar.locator('.race-calendar-actions')).toContainText('Outlook');
  await expect(raceCard.locator('.my-race-remove')).toHaveText('Odstrani');
  await expectNoUnexpectedErrors(pageErrors);
});

test('integrates verified deadlines into the saved race card and summarizes the nearest one', async ({ page }) => {
  await freezeLjubljanaDate(page);
  const { pageErrors } = await mockMyRacesApis(page);
  await seedV2SavedRaces(page, [v2Race('r000101', 'following')]);

  await openMyRaces(page);

  const raceCard = card(page, '2026:r000101');
  await expect(raceCard).toBeVisible();
  await expect(page.locator('[data-my-races-status-summary]')).toHaveCount(0);
  await expect(raceCard.locator('[data-my-race-deadlines]')).toHaveCount(1);
  await expect(raceCard.locator('[data-my-race-deadline]')).toHaveCount(2);
  await expect(raceCard.locator('[data-my-race-deadline][data-deadline-kind="early"]')).toContainText('Cenejša prijava · 18. julija · še 3 dni');
  await expect(raceCard.locator('[data-race-calendar-menu]')).toHaveCount(1);

  const summary = page.locator('[data-next-registration-deadline]');
  await expect(summary).toContainText('Naslednji prijavni rok');
  await expect(summary).toContainText('Ljubljana Test Run');
  await expect(summary).toContainText('Cenejša prijava do 18. julija · čez 3 dni');
  await expect(summary.locator('.deadline-calendar-menu')).toHaveCount(0);
  await expect(summary.locator('a[href="#my-race-2026-r000101"]')).toHaveText('Prikaži v načrtu');

  for (const deadline of [
    { kind: 'early', googleDate: '20260718', outlookDate: '2026-07-18' },
    { kind: 'registration', googleDate: '20260723', outlookDate: '2026-07-23' }
  ]) {
    const item = raceCard.locator(`[data-my-race-deadline][data-deadline-kind="${deadline.kind}"]`);
    await expect(item.locator('summary')).toHaveText('Dodaj rok v koledar');
    const hrefs = await item.locator('.deadline-calendar-actions a').evaluateAll((links) => links.map((link) => (link as HTMLAnchorElement).href));
    expect(hrefs).toHaveLength(3);
    expect(hrefs.find((href) => href.includes('calendar.google.com'))).toContain(deadline.googleDate);
    expect(hrefs.find((href) => href.startsWith('data:text/calendar'))).toContain(deadline.googleDate);
    expect(hrefs.find((href) => href.includes('outlook.live.com'))).toContain(encodeURIComponent(deadline.outlookDate));
    expect(hrefs.join(' ')).not.toContain('20260815');
  }

  await expectNoUnexpectedErrors(pageErrors);
});

test('deduplicates identical early and final deadline dates', async ({ page }) => {
  await freezeLjubljanaDate(page);
  const { pageErrors } = await mockMyRacesApis(page, { additional: duplicateAdditional2026 });
  await seedV2SavedRaces(page, [v2Race('r000101', 'following')]);

  await openMyRaces(page);

  const raceCard = card(page, '2026:r000101');
  await expect(raceCard.locator('[data-my-race-deadline]')).toHaveCount(1);
  await expect(raceCard.locator('[data-my-race-deadline][data-deadline-kind="registration"]')).toContainText('Prijava · 16. julija · jutri');

  await expect(page.locator('[data-next-registration-deadline]')).toContainText('Prijave do 16. julija · jutri');
  await expect(raceCard.locator('.deadline-calendar-menu')).toHaveCount(1);
  await expectNoUnexpectedErrors(pageErrors);
});

test('updates the next deadline summary eligibility when saved status changes without API refetches', async ({ page }) => {
  await freezeLjubljanaDate(page);
  const { pageErrors, requestCounts } = await mockMyRacesApis(page);
  await seedV2SavedRaces(page, [v2Race('r000101', 'planning')]);

  await openMyRaces(page);
  await expect(page.locator('[data-next-registration-deadline]')).toHaveCount(1);
  expect(requestCounts.additional).toBe(2);
  expect(requestCounts.master2026).toBe(1);
  expect(requestCounts.master2027).toBe(1);

  await card(page, '2026:r000101').getByLabel('Moj status').selectOption('completed');
  await expect(page.locator('[data-next-registration-deadline]')).toHaveCount(0);
  await expect(card(page, '2026:r000101').locator('[data-my-race-deadlines]')).toHaveCount(1);
  expect(requestCounts.additional).toBe(2);
  expect(requestCounts.master2026).toBe(1);
  expect(requestCounts.master2027).toBe(1);

  await card(page, '2026:r000101').getByLabel('Moj status').selectOption('following');
  await expect(page.locator('[data-next-registration-deadline]')).toHaveCount(1);
  expect(requestCounts.additional).toBe(2);
  expect(requestCounts.master2026).toBe(1);
  expect(requestCounts.master2027).toBe(1);
  await expectNoUnexpectedErrors(pageErrors);
});


test('filters deadline groups together with race cards', async ({ page }) => {
  await freezeLjubljanaDate(page);
  const { pageErrors, requestCounts } = await mockMyRacesApis(page, { additional: statusFilterAdditional2026 });
  await seedV2SavedRaces(page, [
    v2Race('r000101', 'following'),
    v2Race('r000102', 'planning'),
    v2Race('r000103', 'registered')
  ]);

  await openMyRaces(page);

  await expect(filter(page, 'all')).toHaveAttribute('aria-pressed', 'true');
  for (const key of ['2026:r000101', '2026:r000102', '2026:r000103']) {
    await expect(card(page, key)).toBeVisible();
    await expect(deadlineGroup(page, key)).toBeVisible();
  }
  expect(requestCounts.additional).toBe(2);
  expect(requestCounts.master2026).toBe(1);
  expect(requestCounts.master2027).toBe(1);

  await filter(page, 'planning').click();
  await expect(filter(page, 'planning')).toHaveAttribute('aria-pressed', 'true');
  await expect(filter(page, 'following')).toHaveAttribute('aria-pressed', 'false');
  await expect(filter(page, 'registered')).toHaveAttribute('aria-pressed', 'false');
  await expect(filter(page, 'completed')).toHaveAttribute('aria-pressed', 'false');
  await expect(card(page, '2026:r000102')).toBeVisible();
  await expect(deadlineGroup(page, '2026:r000102')).toBeVisible();
  await expect(card(page, '2026:r000101')).toHaveCount(0);
  await expect(card(page, '2026:r000103')).toHaveCount(0);
  await expect(deadlineGroup(page, '2026:r000101')).toHaveCount(0);
  await expect(deadlineGroup(page, '2026:r000103')).toHaveCount(0);

  await card(page, '2026:r000102').getByLabel('Moj status').selectOption('following');
  await expect(card(page, '2026:r000102')).toHaveCount(0);
  await expect(deadlineGroup(page, '2026:r000102')).toHaveCount(0);
  await expect(filter(page, 'planning')).toHaveAttribute('aria-pressed', 'true');
  await expect(count(page, 'planning')).toHaveText('0');
  await expect(filter(page, 'planning')).toContainText('Planiram 0');

  await filter(page, 'following').click();
  await expect(card(page, '2026:r000101')).toBeVisible();
  await expect(card(page, '2026:r000102')).toBeVisible();
  await expect(deadlineGroup(page, '2026:r000101')).toBeVisible();
  await expect(deadlineGroup(page, '2026:r000102')).toBeVisible();
  await expect(card(page, '2026:r000103')).toHaveCount(0);
  await expect(deadlineGroup(page, '2026:r000103')).toHaveCount(0);

  await filter(page, 'registered').click();
  await expect(card(page, '2026:r000103')).toBeVisible();
  await expect(deadlineGroup(page, '2026:r000103')).toBeVisible();
  await expect(card(page, '2026:r000101')).toHaveCount(0);
  await expect(card(page, '2026:r000102')).toHaveCount(0);
  await expect(deadlineGroup(page, '2026:r000101')).toHaveCount(0);
  await expect(deadlineGroup(page, '2026:r000102')).toHaveCount(0);

  await filter(page, 'completed').click();
  await expect(page.getByText('V tem statusu ni shranjenih tekov.')).toBeVisible();
  await expect(page.locator('[data-key]')).toHaveCount(0);
  await expect(page.locator('[data-next-registration-deadline]')).toHaveCount(0);

  await filter(page, 'all').click();
  for (const key of ['2026:r000101', '2026:r000102', '2026:r000103']) {
    await expect(card(page, key)).toBeVisible();
    await expect(deadlineGroup(page, key)).toBeVisible();
  }

  expect(requestCounts.additional).toBe(2);
  expect(requestCounts.master2026).toBe(1);
  expect(requestCounts.master2027).toBe(1);
  await expectNoUnexpectedErrors(pageErrors);
});

test('keeps My races usable when optional additional API fails', async ({ page }) => {
  await freezeLjubljanaDate(page);
  const { pageErrors } = await mockMyRacesApis(page, { additionalStatus: 500 });
  await seedV2SavedRaces(page, [v2Race('r000101', 'following'), v2Race('r000102', 'planning')]);

  await openMyRaces(page);

  await expect(card(page, '2026:r000101')).toBeVisible();
  await expect(card(page, '2026:r000102')).toBeVisible();
  await expect(page.locator('[data-next-registration-deadline]')).toHaveCount(0);
  await expect(page.getByText('API trenutno ni dosegljiv')).toHaveCount(0);
  await filter(page, 'planning').click();
  await expect(card(page, '2026:r000102')).toBeVisible();
  await expect(card(page, '2026:r000101')).toHaveCount(0);
  await expectNoUnexpectedErrors(pageErrors);
});

test('migrates V1 saved races to V2 and preserves the race', async ({ page }) => {
  const { pageErrors } = await mockMyRacesApis(page);
  await seedLegacySavedRaces(page, [legacyRace('r000101')]);

  await openMyRaces(page);

  const migratedCard = card(page, '2026:r000101');
  await expect(migratedCard).toBeVisible();
  await expect(migratedCard.getByRole('link', { name: 'Ljubljana Test Run' })).toBeVisible();
  await expect(migratedCard.getByLabel('Moj status')).toHaveValue('following');
  await expect(migratedCard.locator('[data-race-status-badge]')).toHaveCount(0);
  await expect(migratedCard.getByLabel('Moj status')).toHaveAttribute('data-race-status', 'following');
  await expect(count(page, 'following')).toHaveText('1');
  await expect(filter(page, 'following')).toContainText('Spremljam 1');

  const migrated = await readSavedRacesV2(page);
  expect(migrated.version).toBe(2);
  expect(migrated.races).toHaveLength(1);
  expect(migrated.races[0].status).toBe('following');
  await expect.poll(() => readLegacySavedRaces(page)).toBeNull();
  await expectNoUnexpectedErrors(pageErrors);
});

test('filters races, changes status and preserves it after reload', async ({ page }) => {
  const { pageErrors } = await mockMyRacesApis(page);
  await seedV2SavedRaces(page, [
    v2Race('r000101', 'following'),
    v2Race('r000102', 'planning'),
    v2Race('r000103', 'registered'),
    v2Race('r000104', 'completed')
  ]);

  await openMyRaces(page);

  await expect(count(page, 'following')).toHaveText('1');
  await expect(filter(page, 'following')).toContainText('Spremljam 1');
  await expect(count(page, 'planning')).toHaveText('1');
  await expect(filter(page, 'planning')).toContainText('Planiram 1');
  await expect(count(page, 'registered')).toHaveText('1');
  await expect(filter(page, 'registered')).toContainText('Prijavljen 1');
  await expect(count(page, 'completed')).toHaveText('1');
  await expect(filter(page, 'completed')).toContainText('Opravljen 1');
  await expect(filter(page, 'all')).toHaveAttribute('aria-pressed', 'true');

  await filter(page, 'registered').click();
  await expect(filter(page, 'registered')).toHaveAttribute('aria-pressed', 'true');
  await expect(card(page, '2026:r000103')).toBeVisible();
  await expect(card(page, '2026:r000101')).toHaveCount(0);
  await expect(card(page, '2026:r000102')).toHaveCount(0);
  await expect(card(page, '2026:r000104')).toHaveCount(0);

  await card(page, '2026:r000103').getByLabel('Moj status').selectOption('planning');
  await expect(card(page, '2026:r000103')).toHaveCount(0);
  await expect(page.getByText('V tem statusu ni shranjenih tekov.')).toBeVisible();
  await expect(count(page, 'registered')).toHaveText('0');
  await expect(filter(page, 'registered')).toContainText('Prijavljen 0');
  await expect(count(page, 'planning')).toHaveText('2');
  await expect(filter(page, 'planning')).toContainText('Planiram 2');
  await expect(filter(page, 'registered')).toHaveAttribute('aria-pressed', 'true');

  await page.reload();
  await expect(count(page, 'planning')).toHaveText('2');
  await expect(filter(page, 'planning')).toContainText('Planiram 2');
  const state = await readSavedRacesV2(page);
  expect(state.races.filter((race: any) => race.eventId === 'r000103')).toHaveLength(1);
  expect(state.races.find((race: any) => race.eventId === 'r000103').status).toBe('planning');
  await expectNoUnexpectedErrors(pageErrors);
});

test('removes a race when status is changed to Not in My races', async ({ page }) => {
  const { analytics, pageErrors } = await mockMyRacesApis(page);
  await seedV2SavedRaces(page, [v2Race('r000102', 'planning')]);

  await openMyRaces(page);
  await expect(card(page, '2026:r000102')).toBeVisible();
  await expect(filter(page, 'all')).toContainText('1');

  await card(page, '2026:r000102').getByLabel('Moj status').selectOption('');

  await expect(card(page, '2026:r000102')).toHaveCount(0);
  await expect(page.getByText('Nimate še shranjenih tekov.')).toBeVisible();
  await expect(page.locator('[data-race-status-badge]')).toHaveCount(0);
  const state = await readSavedRacesV2(page);
  expect(state.races.some((race: any) => race.eventId === 'r000102')).toBe(false);

  await expect.poll(() => analytics.filter((event: any) => event.event_type === 'race_unsaved').length).toBe(1);
  expectNoPersonalStatusInAnalytics(analytics);
  await expectNoUnexpectedErrors(pageErrors);
});

test('does not emit save or unsave analytics for a status-only change', async ({ page }) => {
  const { analytics, pageErrors } = await mockMyRacesApis(page);
  await seedV2SavedRaces(page, [v2Race('r000101', 'following')]);

  await openMyRaces(page);
  await card(page, '2026:r000101').getByLabel('Moj status').selectOption('registered');

  const state = await readSavedRacesV2(page);
  expect(state.races.find((race: any) => race.eventId === 'r000101').status).toBe('registered');
  await page.waitForTimeout(100);
  expect(analytics.filter((event: any) => event.event_type === 'race_saved')).toHaveLength(0);
  expect(analytics.filter((event: any) => event.event_type === 'race_unsaved')).toHaveLength(0);
  expectNoPersonalStatusInAnalytics(analytics);
  await expectNoUnexpectedErrors(pageErrors);
});

test('supports English labels, filters and persistence', async ({ page }) => {
  const { pageErrors } = await mockMyRacesApis(page, { additional: statusFilterAdditional2026 });
  await seedV2SavedRaces(page, [
    v2Race('r000101', 'following'),
    v2Race('r000102', 'planning'),
    v2Race('r000103', 'registered')
  ]);

  await openMyRaces(page, '/en/my-races/');

  await expect(count(page, 'following')).toHaveText('1');
  await expect(filter(page, 'following')).toContainText('Following 1');
  await expect(count(page, 'planning')).toHaveText('1');
  await expect(filter(page, 'planning')).toContainText('Planning 1');
  await expect(count(page, 'registered')).toHaveText('1');
  await expect(filter(page, 'registered')).toContainText('Registered 1');
  await expect(count(page, 'completed')).toHaveText('0');
  await expect(filter(page, 'completed')).toContainText('Completed 0');
  await expect(filter(page, 'all')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByText('Stored only in this browser · no account or cross-device sync.')).toBeVisible();
  await expect(deadlineGroup(page, '2026:r000101')).toBeVisible();
  await expect(deadlineGroup(page, '2026:r000102')).toBeVisible();
  await expect(deadlineGroup(page, '2026:r000103')).toBeVisible();

  const optionText = await page.locator('[data-race-status-control]').evaluateAll((controls) => controls.flatMap((control) => Array.from((control as HTMLSelectElement).options).map((option) => option.textContent || '')).join(' '));
  expect(optionText).not.toMatch(/Spremljam|Planiram|Prijavljen|Opravljen|Ni v Mojih tekih/);

  await filter(page, 'planning').click();
  await expect(card(page, '2026:r000102')).toBeVisible();
  await expect(deadlineGroup(page, '2026:r000102')).toBeVisible();
  await expect(deadlineGroup(page, '2026:r000101')).toHaveCount(0);
  await expect(deadlineGroup(page, '2026:r000103')).toHaveCount(0);

  await filter(page, 'following').click();
  await expect(card(page, '2026:r000101')).toBeVisible();
  await expect(deadlineGroup(page, '2026:r000101')).toBeVisible();
  await expect(deadlineGroup(page, '2026:r000102')).toHaveCount(0);

  await filter(page, 'registered').click();
  await expect(filter(page, 'registered')).toHaveAttribute('aria-pressed', 'true');
  await expect(card(page, '2026:r000103')).toBeVisible();
  await expect(deadlineGroup(page, '2026:r000103')).toBeVisible();
  await expect(deadlineGroup(page, '2026:r000101')).toHaveCount(0);
  await card(page, '2026:r000103').getByLabel('My status').selectOption('completed');

  await expect(page.getByText('There are no saved races with this status.')).toBeVisible();
  await expect(page.getByText('V tem statusu ni shranjenih tekov.')).toHaveCount(0);
  await expect(page.locator('[data-next-registration-deadline]')).toHaveCount(0);
  await expect(count(page, 'registered')).toHaveText('0');
  await expect(filter(page, 'registered')).toContainText('Registered 0');
  await expect(count(page, 'completed')).toHaveText('1');
  await expect(filter(page, 'completed')).toContainText('Completed 1');

  await page.reload();
  const state = await readSavedRacesV2(page);
  expect(state.races.find((race: any) => race.eventId === 'r000103').status).toBe('completed');

  const ids = await page.locator('[data-race-status-control]').evaluateAll((controls) => controls.map((control) => (control as HTMLSelectElement).id));
  expect(new Set(ids).size).toBe(ids.length);
  await expectNoUnexpectedErrors(pageErrors);
});

test('opens plan by default and supports the shared season deep link and accessible tab navigation', async ({ page }) => {
  await mockMyRacesApis(page);
  await seedV2SavedRaces(page, [{ version: 2, eventId: '104', year: '2026', date: '2026-01-10', title: 'Past Test Run', status: 'completed' }]);

  await openMyRaces(page, '/moji-teki/');
  await expect(page.getByRole('tab', { name: 'Načrt' })).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('[data-my-races-panel="plan"]')).toBeVisible();
  await expect(page.locator('[data-my-races-panel="season"]')).toBeHidden();

  await openMyRaces(page, '/moji-teki/?view=season');
  const slSeason = page.getByRole('tab', { name: 'Moja sezona' });
  await expect(slSeason).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('[data-my-races-panel="season"]')).toBeVisible();
  await page.reload();
  await expect(slSeason).toHaveAttribute('aria-selected', 'true');
  await slSeason.press('ArrowLeft');
  await expect(page.getByRole('tab', { name: 'Načrt' })).toHaveAttribute('aria-selected', 'true');
  await page.getByRole('tab', { name: 'Načrt' }).press('End');
  await expect(slSeason).toHaveAttribute('aria-selected', 'true');
  await slSeason.press('Home');
  await expect(page.getByRole('tab', { name: 'Načrt' })).toHaveAttribute('aria-selected', 'true');
  await slSeason.click();
  await expect(page.locator('[data-my-races-panel="season"]')).toBeVisible();

  await openMyRaces(page, '/en/my-races/');
  await expect(page.getByRole('tab', { name: 'Plan', exact: true })).toHaveAttribute('aria-selected', 'true');
  await openMyRaces(page, '/en/my-races/?view=season');
  await expect(page.getByRole('tab', { name: 'My season' })).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('[data-my-races-panel="season"]')).toBeVisible();
  await expect(page.getByText('Moja sezona', { exact: true })).toHaveCount(0);
  await expect(page.locator('[data-my-races-panel="season"]')).toContainText('Upper Carniola');
  await expect(page.locator('[data-my-races-panel="season"]')).toContainText('Road');
  await expect(page.locator('[data-my-races-panel="season"]')).not.toContainText('Gorenjska');

  await page.setViewportSize({ width: 390, height: 844 });
  const overflows = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  expect(overflows).toBe(false);
});

test('refreshes the homepage My STK component after save and unsave without reloading', async ({ page }) => {
  await mockMyRacesApis(page);
  await page.addInitScript(([v1, v2]) => { localStorage.removeItem(v1); localStorage.removeItem(v2); }, [V1_KEY, V2_KEY]);
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Ustvarite svojo tekaško sezono' })).toBeVisible();
  const saveButton = page.locator('[data-saved-race-button]').first();
  await expect(saveButton).toBeVisible();

  await saveButton.click();
  await expect(page.locator('[data-my-stk] .my-stk-dashboard')).toBeVisible();

  await saveButton.click();
  await expect(page.getByRole('heading', { name: 'Ustvarite svojo tekaško sezono' })).toBeVisible();
});
