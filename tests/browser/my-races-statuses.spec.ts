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

const byId: Record<string, SavedRaceFixture> = {
  r000101: { eventId: 'r000101', year: '2026', date: '2026-08-15', title: 'Ljubljana Test Run' },
  r000102: { eventId: 'r000102', year: '2026', date: '2026-09-20', title: 'Maribor Test Trail' },
  r000103: { eventId: 'r000103', year: '2026', date: '2026-10-10', title: 'Celje Test Run' },
  r000104: { eventId: 'r000104', year: '2026', date: '2026-01-10', title: 'Past Test Run' }
};

const v2Race = (id: keyof typeof byId, status: SavedRaceStatus) => ({ version: 2, ...byId[id], status });
const legacyRace = (id: keyof typeof byId) => ({ version: 1, ...byId[id] });
const card = (page: Page, key: string) => page.locator(`[data-key="${key}"]`);
const count = (page: Page, status: SavedRaceStatus) => page.locator(`[data-my-races-status-count="${status}"]`);
const filter = (page: Page, status: SavedRaceStatus | 'all') => page.locator(`[data-my-races-status-filter="${status}"]`);

async function mockMyRacesApis(page: Page) {
  const analytics: unknown[] = [];
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  page.on('console', (msg) => { if (msg.type() === 'error') pageErrors.push(msg.text()); });

  await page.route(`${API_HOST}/**`, async (route) => {
    const url = new URL(route.request().url());
    if (url.searchParams.get('year') === '2027') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
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
    localStorage.clear();
    Object.defineProperty(navigator, 'sendBeacon', { configurable: true, value: undefined });
  });

  return { analytics, pageErrors };
}

async function seedLegacySavedRaces(page: Page, races: ReturnType<typeof legacyRace>[]) {
  await page.addInitScript(({ key, racesToSeed }) => {
    localStorage.setItem(key, JSON.stringify({ version: 1, races: racesToSeed }));
  }, { key: V1_KEY, racesToSeed: races });
}

async function seedV2SavedRaces(page: Page, races: ReturnType<typeof v2Race>[]) {
  await page.addInitScript(({ key, racesToSeed }) => {
    localStorage.setItem(key, JSON.stringify({ version: 2, races: racesToSeed }));
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
  await page.goto(path);
  await expect(page.locator('[data-my-races-app]')).not.toContainText(/Loading saved races|Nalagamo shranjene teke/);
}

async function expectNoUnexpectedErrors(pageErrors: string[]) {
  await expect.poll(() => pageErrors).toEqual([]);
}

function expectNoPersonalStatusInAnalytics(analytics: unknown[]) {
  const serialized = JSON.stringify(analytics);
  expect(serialized).not.toMatch(/following|planning|registered|completed|status/);
}

test('migrates V1 saved races to V2 and preserves the race', async ({ page }) => {
  const { pageErrors } = await mockMyRacesApis(page);
  await seedLegacySavedRaces(page, [legacyRace('r000101')]);

  await openMyRaces(page);

  await expect(page.getByText('Ljubljana Test Run')).toBeVisible();
  await expect(card(page, '2026:r000101').getByLabel('Moj status')).toHaveValue('following');
  await expect(card(page, '2026:r000101').locator('[data-race-status-badge]')).toHaveText('Spremljam');
  await expect(count(page, 'following')).toHaveText(/Spremljam\s+1/);

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

  await expect(count(page, 'following')).toHaveText(/Spremljam\s+1/);
  await expect(count(page, 'planning')).toHaveText(/Planiram\s+1/);
  await expect(count(page, 'registered')).toHaveText(/Prijavljen\s+1/);
  await expect(count(page, 'completed')).toHaveText(/Opravljen\s+1/);
  await expect(filter(page, 'all')).toHaveAttribute('aria-pressed', 'true');

  await filter(page, 'registered').click();
  await expect(filter(page, 'registered')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByText('Celje Test Run')).toBeVisible();
  await expect(page.getByText('Ljubljana Test Run')).toHaveCount(0);
  await expect(page.getByText('Maribor Test Trail')).toHaveCount(0);
  await expect(page.getByText('Past Test Run')).toHaveCount(0);

  await card(page, '2026:r000103').getByLabel('Moj status').selectOption('planning');
  await expect(page.getByText('Celje Test Run')).toHaveCount(0);
  await expect(page.getByText('V tem statusu ni shranjenih tekov.')).toBeVisible();
  await expect(count(page, 'registered')).toHaveText(/Prijavljen\s+0/);
  await expect(count(page, 'planning')).toHaveText(/Planiram\s+2/);
  await expect(filter(page, 'registered')).toHaveAttribute('aria-pressed', 'true');

  await page.reload();
  await expect(count(page, 'planning')).toHaveText(/Planiram\s+2/);
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
  const { pageErrors } = await mockMyRacesApis(page);
  await seedV2SavedRaces(page, [
    v2Race('r000101', 'following'),
    v2Race('r000102', 'planning'),
    v2Race('r000103', 'registered')
  ]);

  await openMyRaces(page, '/en/my-races/');

  await expect(page.getByText('Following')).toBeVisible();
  await expect(page.getByText('Planning')).toBeVisible();
  await expect(page.getByText('Registered')).toBeVisible();
  await expect(page.getByText('Completed')).toBeVisible();
  await expect(page.getByRole('button', { name: /All/ })).toBeVisible();
  await expect(page.getByText('Saved races and their personal statuses are stored only in your browser. They are not sent to the server and do not sync between devices.')).toBeVisible();

  const optionText = await page.locator('[data-race-status-control]').evaluateAll((controls) => controls.flatMap((control) => Array.from((control as HTMLSelectElement).options).map((option) => option.textContent || '')).join(' '));
  expect(optionText).not.toMatch(/Spremljam|Planiram|Prijavljen|Opravljen|Ni v Mojih tekih/);

  await filter(page, 'registered').click();
  await expect(filter(page, 'registered')).toHaveAttribute('aria-pressed', 'true');
  await card(page, '2026:r000103').getByLabel('My status').selectOption('completed');

  await expect(page.getByText('There are no saved races with this status.')).toBeVisible();
  await expect(count(page, 'registered')).toHaveText(/Registered\s+0/);
  await expect(count(page, 'completed')).toHaveText(/Completed\s+1/);

  await page.reload();
  const state = await readSavedRacesV2(page);
  expect(state.races.find((race: any) => race.eventId === 'r000103').status).toBe('completed');

  const ids = await page.locator('[data-race-status-control]').evaluateAll((controls) => controls.map((control) => (control as HTMLSelectElement).id));
  expect(new Set(ids).size).toBe(ids.length);
  await expectNoUnexpectedErrors(pageErrors);
});
