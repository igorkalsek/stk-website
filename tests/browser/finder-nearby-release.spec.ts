import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { NEARBY_EDITION_LOCATIONS, NEARBY_ORIGINS } from '../../src/finder/nearby-production-index';
import { filterNearbyRaces } from '../../src/utils-nearby-races';

// Production build and production catalog, with the captured Worker population.
// No synthetic approval or geography transform is used by this suite.
const snapshot = JSON.parse(readFileSync(new URL('../../docs/evidence/dev056-release/public-events.json', import.meta.url), 'utf8'));
const API = 'https://stk-master-api.igor-kalsek.workers.dev';
for (const year of ['2026','2027']) for (const lang of ['sl','en']) for (const width of [390,1280]) {
  test(`production nearby ${year}/${lang}/${width}: real index, all radii, privacy, GPS and other filters`, async ({page}, testInfo) => {
    await page.clock.setFixedTime(new Date('2026-11-13T09:00:00Z'));
    await page.setViewportSize({width,height:844});
    const analytics: string[] = [];
    const errors: string[] = [];
    page.on('pageerror', error=>errors.push(String(error)));
    await page.addInitScript(() => {
      const state = {calls:0,deny:false};
      (window as any).__geo = state;
      Object.defineProperty(navigator,'geolocation',{value:{getCurrentPosition(success:any, failure:any) {
        state.calls++;
        if (state.deny) failure({code:1});
        else success({coords:{latitude:46.134166666667,longitude:14.994166666667}});
      }}});
      Object.defineProperty(navigator,'sendBeacon',{configurable:true,value:undefined});
    });
    await page.route(`${API}/**`, async route => {
      const url = new URL(route.request().url());
      if (url.pathname === '/additional' || url.pathname === '/top') return route.fulfill({json:{data:[]}});
      const selectedYear = url.searchParams.get('year') === '2027' ? '2027' : '2026';
      const data = snapshot.events.filter((e:any)=>e.year === selectedYear).map((e:any)=>({
        row:e.row,datum:e.date,naziv_prireditve:e.naziv_prireditve,kraj:e.place,regija:e.region,
        tip_podlage:e.surface,razdalje_km:e.distances,povezava_razpis:e.noticeUrl,
        status_dogodka:'potrjeno',vidno_v_javnem_koledarju:'DA'
      }));
      return route.fulfill({json:{data}});
    });
    await page.route('https://script.google.com/**', async route => {
      analytics.push(route.request().postData() || '');
      return route.fulfill({status:204,body:''});
    });
    const path = `${lang === 'en' ? '/en/find-races/' : '/iskalnik-tekov/'}?year=${year}`;
    await page.goto(path);
    const cards = page.locator('[data-search-results] .search-event-card');
    const panel = page.locator('[data-nearby-panel]');
    const full = snapshot.events.filter((e:any)=>e.year === year);
    // The normal Finder initially renders a page of results.
    await expect(cards.first()).toBeVisible();
    if (width < 600) await page.locator('[data-mobile-filter-panel] > summary').click();
    await expect(panel).toBeVisible();
    await expect(panel.locator('[data-nearby-sources]')).toContainText('Wikidata (CC0)');
    expect(await page.evaluate(()=>(window as any).__geo.calls)).toBe(0);
    const origin = panel.locator('[data-nearby-origin-place]');
    await expect(origin.locator('option')).toHaveCount(NEARBY_ORIGINS.length + 1);
    await origin.selectOption('Q15930'); // actual Zagorje ob Savi CC0 reference
    const point = NEARBY_ORIGINS.find(p=>p.id === 'Q15930')!;
    const radius = panel.locator('[data-nearby-radius]');
    for (const value of ['10','25','50','100']) {
      await radius.selectOption(value);
      const matched = filterNearbyRaces(full, NEARBY_EDITION_LOCATIONS, point, Number(value)).matches;
      const visible = Math.min(matched.length,30);
      await expect(cards).toHaveCount(visible);
      await expect(cards.locator('[data-nearby-distance]')).toHaveCount(visible);
      const dates = await cards.locator('[data-saved-race-button]').evaluateAll(buttons => buttons.map(b=>b.getAttribute('data-event-date')));
      expect(dates).toEqual([...dates].sort()); // nearby must preserve the selected date order
      await expect(panel.locator('[data-nearby-status]')).toContainText(lang === 'en'
        ? `Locations are missing for ${year === '2026' ? 2 : 5} of ${full.length}`
        : `Za ${year === '2026' ? 2 : 5} od ${full.length}`);
      if (matched.length) {
        await expect(cards.first().locator('[data-nearby-distance]')).toContainText('≈');
        await expect(cards.first().locator('[data-nearby-distance]')).toContainText(lang === 'en' ? 'approximate event location' : 'približne lokacije prireditve');
      }
    }
    // Region and text filters still intersect the nearby set and retain URL state.
    await page.locator('[data-filter="region"]').selectOption('Savinjska');
    await expect(page).toHaveURL(/region=Savinjska/);
    expect(await cards.count()).toBeGreaterThan(0);
    await expect(cards.first()).toContainText('Savinjska');
    await page.locator('[data-filter="search"]').fill('SZTL');
    await expect(cards.first()).toContainText('SZTL');
    await page.locator('[data-filter="search"]').fill('');
    await page.locator('[data-filter="region"]').selectOption('');
    // Save button retains its usual behavior; no origin metadata is persisted.
    await cards.first().locator('[data-saved-race-button]').click();
    await expect(cards.first().locator('[data-saved-race-button]')).toHaveAttribute('aria-pressed','true');
    // GPS is explicit and denial leaves place selection usable.
    await page.evaluate(()=>(window as any).__geo.deny = true);
    await panel.locator('[data-nearby-geolocate]').click();
    await expect(panel.locator('[data-nearby-status]')).toContainText(lang === 'en' ? 'Select a place' : 'Izberite kraj');
    await origin.selectOption('Q15930');
    await page.evaluate(()=>(window as any).__geo.deny = false);
    await panel.locator('[data-nearby-geolocate]').click();
    await expect(panel.locator('[data-nearby-origin-summary]')).toContainText(lang === 'en' ? 'Device location' : 'Lokacija naprave');
    expect(await page.evaluate(()=>(window as any).__geo.calls)).toBe(2);
    // A zero-hit query must retain the incomplete-coverage warning.
    await origin.selectOption('Q631387');
    await radius.selectOption('10');
    if (year === '2026') {
      await origin.selectOption('Q2139428'); // Kranjska Gora, no 2026 races in 10 km
      await expect(cards).toHaveCount(0);
      await expect(page.locator('[data-search-results]')).toContainText(lang === 'en' ? 'No located races' : 'ni zadetkov med teki z znano lokacijo');
      await expect(panel.locator('[data-nearby-status]')).toContainText(lang === 'en' ? 'may be incomplete' : 'lahko nepopolni');
    }
    await origin.selectOption('Q15930');
    // Manual edits invalidate stale results immediately and invalid input is recoverable.
    await panel.locator('[data-nearby-manual] > summary').click();
    const latitude = panel.locator('[data-nearby-latitude]');
    await latitude.fill('invalid');
    await panel.locator('[data-nearby-apply]').click();
    await expect(panel.locator('[data-nearby-status]')).toContainText(lang === 'en' ? 'Enter valid' : 'Vnesite veljavno');
    await expect(page.locator('[data-nearby-distance]')).toHaveCount(0);
    await origin.selectOption('Q15930');
    await expect(page.locator('[data-nearby-distance]').first()).toBeVisible();
    const stored = await page.evaluate(()=>({url:location.href,local:JSON.stringify(localStorage),session:JSON.stringify(sessionStorage),cookie:document.cookie}));
    for (const coordinate of ['46.134166666667','14.994166666667']) {
      expect(JSON.stringify(stored)).not.toContain(coordinate);
      expect(analytics.join(' ')).not.toContain(coordinate);
    }
    await panel.locator('[data-nearby-manual] > summary').click();
    await page.evaluate(()=>window.scrollTo({top:0,behavior:'instant'}));
    await page.screenshot({path:testInfo.outputPath(`nearby-${year}-${lang}-${width}.png`),fullPage:true});
    expect(await page.evaluate(()=>document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    // Global reset must clear nearby memory as well as the visible form.
    await page.locator('[data-clear-filters]').first().click();
    await expect(panel.locator('[data-nearby-origin-summary]')).toBeEmpty();
    await expect(page.locator('[data-nearby-distance]')).toHaveCount(0);
    await expect(latitude).toHaveValue('');
    await expect(cards.first()).toBeVisible();
    expect(errors).toEqual([]);
  });
}
