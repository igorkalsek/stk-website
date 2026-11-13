import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

/**
 * DEV-056 test-only ESM bundle. The production Finder gates remain closed.
 * Runs the actual nearby UI module against the real SL/EN page markup,
 * with ONE ephemeral synthetic GURS-approved test record.
 * Never bundles or activates any review JSON in a public website build.
 */
const compile = (relative: string) => ts.transpileModule(
  readFileSync(new URL(relative, import.meta.url), 'utf8'),
  { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }
).outputText;
const CORE_PATH = '/__stk_dev056_pilot_core__.js';
const UI_PATH = '/__stk_dev056_pilot_ui__.js';
const core = compile('../../src/utils-nearby-races.ts');
const ui = compile('../../src/finder/race-finder-nearby-ui.ts')
  .replace("from '../utils-nearby-races.js'", `from '${CORE_PATH}'`);
if (!ui.includes(`from '${CORE_PATH}'`)) throw Error('Pilot module import rewrite failed');

const fixtures = [
  { name: 'SL desktop', locale: 'sl', url: '/iskalnik-tekov/?year=2027', width: 1280, latitude: '46,34', longitude: '15,164716', notice: 'Za 1 od 2 tekov' },
  { name: 'EN mobile', locale: 'en', url: '/en/find-races/?year=2027', width: 390, latitude: '46.34', longitude: '15.164716', notice: 'Locations are missing for 1 of 2 races' }
] as const;

for (const scenario of fixtures) {
  test(`DEV-056 isolated synthetic enabled UI – ${scenario.name}: radius, mobile/SL-EN, privacy and GPS`, async ({ page, context }) => {
    test.setTimeout(60_000);
    await page.setViewportSize({ width: scenario.width, height: 844 });
    await page.route('https://stk-master-api.igor-kalsek.workers.dev/**', route => route.fulfill({ json: { data: [] } }));
    await page.route('https://script.google.com/**', route => route.fulfill({ status: 204, body: '' }));
    await page.route(`**${CORE_PATH}`, route => route.fulfill({ status: 200, contentType: 'text/javascript', body: core }));
    await page.route(`**${UI_PATH}`, route => route.fulfill({ status: 200, contentType: 'text/javascript', body: ui }));
    await page.goto(scenario.url);
    const panel = page.locator('[data-nearby-panel]');
    await expect(panel).toBeHidden();
    await expect(panel.locator('[data-nearby-fields]')).toHaveAttribute('disabled', '');

    const ready = await page.evaluate(async (locale) => {
      const source = await import('/__stk_dev056_pilot_core__.js');
      const browserUi = await import('/__stk_dev056_pilot_ui__.js');
      const location = {
        year: '2027', masterRow: 51, latitude: 46.2490358, longitude: 15.164716,
        precision: 'settlement-approximate', sourceKind: 'official-settlement',
        sourceUrl: 'https://ipi.eprostor.gov.si/wfs-si-gurs-rpe/ogc/features/collections/SI.GURS.RPE%3ANASELJA/items/110300000101473100?f=json',
        sourceCheckedOn: '2026-11-12', sourceFeatureVerified: true,
        reviewStatus: 'approved', approved_for_runtime: true
      };
      const population = [{ year: '2027', row: '51', label: 'Synthetic Žalec edition' },
        { year: '2027', row: '52', label: 'Synthetic unlocated edition' }];
      const tracker = { selection: null, view: null, transitions: 0 };
      let mounted;
      mounted = browserUi.mountNearbyFinderUi({
        enabled: true, locale, locations: [location], root: document,
        onChange: selection => {
          tracker.selection = selection;
          tracker.transitions++;
          tracker.view = selection
            ? source.prepareNearbyFinderView(population, population, [location], selection.origin, selection.radiusKm, locale)
            : null;
          if (tracker.view) mounted.updateNotice([
            tracker.view.copy.distanceBasis,
            tracker.view.copy.approximateNotice,
            tracker.view.copy.coverageNotice,
            tracker.view.copy.radiusNotice
          ].filter(Boolean).join(' '));
        }
      });
      window.__dev056Pilot = tracker;
      return Boolean(mounted);
    }, scenario.locale);
    expect(ready).toBe(true);
    if (scenario.width < 600) {
      const mobile = page.locator('[data-mobile-filter-panel]');
      if (!(await mobile.evaluate((element: HTMLDetailsElement) => element.open))) await mobile.locator('summary').first().click();
    }
    await expect(panel).toBeVisible();
    await expect(panel.locator('[data-nearby-apply]')).toBeEnabled();
    await expect(panel.locator('[data-nearby-latitude]')).toBeEnabled();

    // At ~10.12 km from the reference point, 10 km excludes it; larger radii include it.
    await panel.locator('[data-nearby-latitude]').fill(scenario.latitude);
    await panel.locator('[data-nearby-longitude]').fill(scenario.longitude);
    await panel.locator('[data-nearby-apply]').click();
    for (const [radius, count] of [['10', 0], ['25', 1], ['50', 1], ['100', 1]] as const) {
      await panel.locator('[data-nearby-radius]').selectOption(radius);
      const state = await page.evaluate(() => (window as any).__dev056Pilot);
      expect(state.selection.radiusKm).toBe(Number(radius));
      expect(state.view.status).toBe('partial');
      expect(state.view.coverage.unlocatedEditionKeys).toEqual(['2027!52']);
      expect(state.view.matches).toHaveLength(count);
      if (count) expect(state.view.matches[0].approximate).toBe(true);
    }
    await expect(panel.locator('[data-nearby-status]')).toContainText(scenario.notice);

    // Manual origin and GPS coordinates are never added to URL, query or browser storage.
    const privacy = await page.evaluate(() => ({
      url: location.href,
      local: Object.values(localStorage).join(' '),
      session: Object.values(sessionStorage).join(' ')
    }));
    for (const val of ['46.34','46,34','15.164716','15,164716']) {
      expect(privacy.url).not.toContain(val);
      expect(privacy.local).not.toContain(val);
      expect(privacy.session).not.toContain(val);
    }

    await context.grantPermissions(['geolocation'], { origin: 'http://127.0.0.1:4321' });
    await context.setGeolocation({ latitude: 46.2490358, longitude: 15.164716 });
    const beforeGps = await page.evaluate(() => (window as any).__dev056Pilot.transitions);
    await panel.locator('[data-nearby-geolocate]').click();
    await expect.poll(() => page.evaluate(() => (window as any).__dev056Pilot.transitions)).toBe(beforeGps + 1);
    const selected = await page.evaluate(() => (window as any).__dev056Pilot);
    expect(selected.selection.origin.latitude).toBe(46.2490358);
    expect(selected.selection.origin.longitude).toBe(15.164716);
    expect(selected.view.matches).toHaveLength(1);

    await panel.locator('[data-nearby-clear]').click();
    await expect(panel.locator('[data-nearby-latitude]')).toHaveValue('');
    await expect(panel.locator('[data-nearby-longitude]')).toHaveValue('');
    await expect(panel.locator('[data-nearby-radius]')).toHaveValue('25');
    const cleared = await page.evaluate(() => (window as any).__dev056Pilot);
    expect(cleared.selection).toBeNull();
    expect(cleared.view).toBeNull();
    expect(page.url()).not.toContain('latitude=');
    expect(page.url()).not.toContain('longitude=');
  });
}
