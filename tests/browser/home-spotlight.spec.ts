import { expect, test, type Page } from '@playwright/test';

const API = 'https://stk-master-api.igor-kalsek.workers.dev';
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
  await page.clock.setFixedTime(new Date(date + 'T12:00:00Z'));
  await page.route('**/api/interest-preview*', (route) =>
    route.fulfill({ json: { ok: true, type: 'interest_preview', items: [] } })
  );
  await page.route(API + '/**', (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/') {
      return route.fulfill({ json: { data: url.searchParams.get('year') === '2027' ? next : current } });
    }
    if (url.pathname === '/stats') return route.fulfill({ json: { confirmed_public_events_total: 0, family_friendly_total: 0 } });
    return route.fulfill({ json: { data: [] } });
  });
  await page.route('https://script.google.com/**', (route) => route.fulfill({ status: 204, body: '' }));
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
