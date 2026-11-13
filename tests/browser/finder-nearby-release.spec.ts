import { expect, test } from '@playwright/test';
import { getDisplayEventTitle } from '../../src/utils-events';
import { readFileSync } from 'node:fs';
import { NEARBY_EDITION_LOCATIONS, NEARBY_ORIGINS } from '../../src/finder/nearby-production-index';
import { buildEventDetailPath, buildEnglishEventDetailPath } from '../../src/utils-event-detail';
import { buildNearbyMapLink } from '../../src/utils-nearby-index';
import { filterNearbyRaces, summarizeNearbyCoverage } from '../../src/utils-nearby-races';

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
        await expect(cards.first().locator('[data-nearby-distance]')).toContainText(lang === 'en' ? 'Approximate location' : 'Približna lokacija');
      }
    }
    if (year === '2026') {
      await origin.selectOption('Q392333'); // Štanjel: edition-specific organizer start
      const exact = cards.filter({hasText:'25. Štanjelski tek'}).locator('[data-nearby-distance]');
      await expect(exact).toContainText(lang === 'en' ? 'Verified start' : 'Potrjen štart');
      await expect(exact).not.toContainText('≈');
      await origin.selectOption('Q15930');
    }
    const missingKeys = new Set(summarizeNearbyCoverage(full, NEARBY_EDITION_LOCATIONS).unlocatedEditionKeys);
    const missing = full.filter((event:any) => missingKeys.has(`${event.year}!${event.row}`))
      .sort((a:any,b:any) => a.date.localeCompare(b.date));
    const disclosure = panel.locator('[data-nearby-unlocated]');
    const summary = disclosure.locator('summary');
    const unlocatedLinks = disclosure.locator('li a');
    await expect(summary).toContainText(lang === 'en' ? 'Show races without a verified location' : 'Prikaži teke brez določene lokacije');
    await expect(summary).toContainText(`(${missing.length})`);
    await expect(disclosure).not.toHaveAttribute('open', '');
    await expect(unlocatedLinks.first()).not.toBeVisible();
    const radiusCount = await cards.count();
    await summary.focus();
    await page.keyboard.press('Enter');
    await expect(disclosure).toHaveAttribute('open', '');
    await expect(unlocatedLinks).toHaveCount(missing.length);
    expect(await unlocatedLinks.allTextContents()).toEqual(missing.map((e:any) => getDisplayEventTitle(e.naziv_prireditve)));
    const buildPath = lang === 'en' ? buildEnglishEventDetailPath : buildEventDetailPath;
    expect(await unlocatedLinks.evaluateAll(links => links.map(a => a.getAttribute('href'))))
      .toEqual(missing.map((e:any) => buildPath(e)));
    await expect(cards).toHaveCount(radiusCount);
    await page.keyboard.press('Tab');
    await expect(unlocatedLinks.first()).toBeFocused();
    await summary.focus();
    await page.keyboard.press('Space');
    await expect(unlocatedLinks.first()).not.toBeVisible();
    await summary.press('Enter');
    await page.screenshot({path:testInfo.outputPath(`unlocated-${year}-${lang}-${width}.png`),fullPage:true});
    await summary.press('Enter');
    // List follows current non-geographic filters without changing radius results.
    await page.locator('[data-filter="search"]').fill(missing[0].naziv_prireditve);
    await expect(unlocatedLinks).toHaveCount(1);
    await expect(cards).toHaveCount(0);
    await page.locator('[data-filter="search"]').fill('no-such-event-dev058');
    await expect(disclosure).toBeHidden();
    await page.locator('[data-filter="search"]').fill('');
    await expect(summary).toContainText(`(${missing.length})`);
    // Region and text filters still intersect the nearby set and retain URL state.
    await page.locator('[data-filter="region"]').selectOption('Savinjska');
    await expect(page).toHaveURL(/region=Savinjska/);
    expect(await cards.count()).toBeGreaterThan(0);
    await expect(cards.first()).toContainText('Savinjska');
    await expect(disclosure.locator('li')).toHaveCount(missing.filter((e:any) => e.region === 'Savinjska').length);
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
    await page.locator('[data-search-results]').screenshot({path:testInfo.outputPath(`cards-${year}-${lang}-${width}.png`)});
    expect(await page.evaluate(()=>document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    // Global reset must clear nearby memory as well as the visible form.
    await page.locator('[data-clear-filters]').first().click();
    await expect(panel.locator('[data-nearby-origin-summary]')).toBeEmpty();
    await expect(page.locator('[data-nearby-distance]')).toHaveCount(0);
    await expect(disclosure).toBeHidden();
    await expect(latitude).toHaveValue('');
    await expect(cards.first()).toBeVisible();
    // Switching public year starts with no stale location or omitted-edition list.
    const otherYear = year === '2026' ? '2027' : '2026';
    await page.locator(`[data-year-link="${otherYear}"]`).click();
    await expect(cards.first()).toBeVisible();
    await expect(page.locator('[data-nearby-distance]')).toHaveCount(0);
    if (width < 600) await page.locator('[data-mobile-filter-panel] > summary').click();
    await origin.selectOption('Q15930');
    const otherFull = snapshot.events.filter((e:any) => e.year === otherYear);
    const otherMissing = summarizeNearbyCoverage(otherFull, NEARBY_EDITION_LOCATIONS).unlocatedEditionKeys.length;
    await expect(summary).toContainText(`(${otherMissing})`);
    expect(errors).toEqual([]);
  });
}

for (const lang of ['sl', 'en'] as const) for (const width of [390, 1280]) {
  test(`profile maps ${lang}/${width}: verified start, approximation and text fallback`, async ({page}, testInfo) => {
    await page.setViewportSize({width, height:844});
    for (const [row, precision] of [['266', 'start'], ['260', 'approximate'], ['263', 'missing']]) {
      const event = snapshot.events.find((e:any) => e.year === '2026' && e.row === row);
      const path = lang === 'en' ? buildEnglishEventDetailPath(event) : buildEventDetailPath(event);
      await page.goto(path);
      const map = page.locator('[data-analytics-link-type="map_click"]');
      const expected = buildNearbyMapLink(event, NEARBY_EDITION_LOCATIONS, lang);
      await expect(map).toHaveAttribute('href', expected.url);
      await expect(map).toHaveAttribute('target', '_blank');
      await expect(map).toHaveAttribute('rel', 'noopener noreferrer');
      await expect(page.locator('[data-map-precision]')).toContainText(expected.label);
      if (precision === 'approximate') await expect(page.locator('[data-map-precision]')).toContainText(expected.notice!);
      await map.scrollIntoViewIfNeeded();
      await page.screenshot({path:testInfo.outputPath(`map-${precision}-${lang}-${width}.png`)});
      expect(await page.evaluate(()=>document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    }
  });
}

for (const lang of ['sl','en']) {
  test(`live unlocated data ${lang}: changed identity, new race, safe text and empty year`, async ({page}) => {
    await page.clock.setFixedTime(new Date('2026-11-13T09:00:00Z'));
    let empty = false;
    const original = snapshot.events.find((e:any) => e.year === '2027' && e.row === '51');
    const unsafeTitle = '<img src=x onerror=alert(1)> New race';
    const full = snapshot.events.filter((e:any) => e.year === '2027').map((e:any) => e.row === '51'
      ? {...e, date:'2027-01-10'} : e).concat({...original, row:'999', naziv_prireditve:unsafeTitle});
    await page.route(`${API}/**`, async route => {
      const url = new URL(route.request().url());
      const data = empty || ['/additional','/top'].includes(url.pathname) ? [] : full.map((e:any) => ({
        row:e.row, datum:e.date, naziv_prireditve:e.naziv_prireditve, kraj:e.place, regija:e.region,
        status_dogodka:'potrjeno', vidno_v_javnem_koledarju:'DA'
      }));
      await route.fulfill({json:{data}});
    });
    await page.goto(`${lang === 'en' ? '/en/find-races/' : '/iskalnik-tekov/'}?year=2027`);
    await expect(page.locator('[data-search-results] .search-event-card').first()).toBeVisible();
    await page.locator('[data-nearby-origin-place]').selectOption('Q631387');
    const details = page.locator('[data-nearby-unlocated]');
    const count = summarizeNearbyCoverage(full, NEARBY_EDITION_LOCATIONS).unlocatedEditionKeys.length;
    await expect(details.locator('summary')).toContainText(`(${count})`);
    await details.locator('summary').click();
    await expect(details.locator('li a').filter({hasText:unsafeTitle})).toHaveCount(1);
    await expect(details.locator('img')).toHaveCount(0);
    await expect(details.locator('li a').filter({hasText:getDisplayEventTitle(original.naziv_prireditve)})).toHaveCount(1);
    expect(await details.locator('li a').evaluateAll(links => links.every(a => a.getAttribute('href')?.startsWith('/')))).toBe(true);
    await expect(page.locator('[data-search-results]')).not.toContainText(unsafeTitle);
    await expect(page.locator('[data-search-results]')).not.toContainText(getDisplayEventTitle(original.naziv_prireditve));
    empty = true;
    await page.reload();
    await expect(page.locator('[data-search-results] .search-event-card')).toHaveCount(0);
    await page.locator('[data-nearby-origin-place]').selectOption('Q631387');
    await expect(details).toBeHidden();
  });
}
