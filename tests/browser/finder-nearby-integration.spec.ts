import { expect, test } from '@playwright/test';

const MASTER_API = 'https://stk-master-api.igor-kalsek.workers.dev';
const API_DATA = [
  {
    row: '51', datum: '2027-01-09',
    naziv_prireditve: 'Synthetic Zalec Race', kraj: 'Žalec', regija: 'Savinjska',
    tip_podlage: 'cesta', razdalje_km: '5', cas_zacetka: '09:00',
    status_dogodka: 'potrjeno', vidno_v_javnem_koledarju: 'DA',
    povezava_razpis: 'https://example.org/synthetic-zalec', povezava_prijava: 'https://example.org/register-zalec'
  },
  {
    row: '52', datum: '2027-01-16',
    naziv_prireditve: 'Synthetic Kranj Race', kraj: 'Kranj', regija: 'Gorenjska',
    tip_podlage: 'trail', razdalje_km: '10', cas_zacetka: '10:00',
    status_dogodka: 'potrjeno', vidno_v_javnem_koledarju: 'DA',
    povezava_razpis: 'https://example.org/synthetic-kranj', povezava_prijava: 'https://example.org/register-kranj'
  }
];

// In this separate build ONLY, controller constants were temporarily replaced
// by the private config plugin. The normal production build still has false/[].
const scenarios = [
  {lang:'sl',path:'/iskalnik-tekov/?year=2027',width:1280,
   lat:'46,34',lng:'15,164716',missing:/Za 1 od 2 tekov/,km:/zračno/},
  {lang:'en',path:'/en/find-races/?year=2027',width:390,
   lat:'46.34',lng:'15.164716',missing:/1 of 2 races/,km:/straight-line/}
] as const;

for(const scenario of scenarios) {
  test(`DEV-056 private full Finder cards ${scenario.lang}/${scenario.width}: radius, filters, approximation, clear, privacy`,async ({page})=>{
    await page.clock.setFixedTime(new Date('2026-11-13T09:00:00.000Z'));
    await page.setViewportSize({width:scenario.width,height:844});
    const analyticsBodies: string[]=[];
    await page.route(`${MASTER_API}/**`, async route=>{
      const url=new URL(route.request().url());
      if(url.pathname==='/additional'||url.pathname==='/top')
        return route.fulfill({json:{data:[]}});
      return route.fulfill({json:{data:API_DATA}});
    });
    await page.route('https://script.google.com/**',async route=>{
      analyticsBodies.push(route.request().postData()||'');
      await route.fulfill({status:204,body:''});
    });
    await page.goto(scenario.path);
    const cards=page.locator('[data-search-results] .search-event-card');
    const panel=page.locator('[data-nearby-panel]');
    await expect(cards).toHaveCount(2);
    // Mobile Finder collapses the filters with <details>. Open the visible
    // parent first; a properly enabled child panel is not itself visible
    // while its parent details remains closed.
    await expect(panel).not.toHaveAttribute('hidden', '');
    if(scenario.width<600) {
      const details=page.locator('[data-mobile-filter-panel]');
      if(!(await details.evaluate((e:HTMLDetailsElement)=>e.open)))
        await details.locator(':scope > summary').click();
    }
    await expect(panel).toBeVisible();
    await expect(panel.locator('[data-nearby-apply]')).toBeEnabled();
    const town=panel.locator('[data-nearby-origin-place]');
    await expect(panel.locator('[data-nearby-origin-place-group]')).toBeVisible();
    await expect(town.locator('option')).toHaveCount(2);
    await town.selectOption('synthetic-test-origin');
    await expect(panel.locator('[data-nearby-origin-summary]')).toHaveText(
      scenario.lang === 'en' ? 'Active origin: Synthetic test origin' : 'Aktivno izhodišče: Testno izhodišče'
    );
    await expect(cards).toHaveCount(1);
    await expect(cards.first()).toContainText('Synthetic Zalec Race');
    await expect(panel.locator('[data-nearby-status]')).toContainText(scenario.missing);
    await panel.locator('[data-nearby-manual] > summary').click();
    const lat=panel.locator('[data-nearby-latitude]');
    const lng=panel.locator('[data-nearby-longitude]');
    const radius=panel.locator('[data-nearby-radius]');
    await lat.fill(scenario.lat);
    await expect(cards).toHaveCount(2); // editing a selected origin immediately invalidates old matches
    await expect(panel.locator('[data-nearby-origin-summary]')).toContainText(
      scenario.lang === 'en' ? 'apply the search' : 'za posodobitev'
    );
    await expect(town).toHaveValue(''); // manual origin overrides selected place
    await lng.fill(scenario.lng);
    await panel.locator('[data-nearby-apply]').click();
    await expect(panel.locator('[data-nearby-origin-summary]')).toHaveText(
      scenario.lang === 'en' ? 'Active origin: Custom coordinates' : 'Aktivno izhodišče: Ročne koordinate'
    );
    await expect(cards).toHaveCount(1);
    await expect(cards.first()).toContainText('Synthetic Zalec Race');
    await expect(cards.first().locator('[data-nearby-distance]')).toContainText(scenario.km);
    await expect(cards.first().locator('[data-nearby-distance]')).toContainText('≈');
    await expect(panel.locator('[data-nearby-status]')).toContainText(scenario.missing);

    await radius.selectOption('10');
    await expect(cards).toHaveCount(0);
    await expect(page.locator('[data-search-results]')).toContainText(
      scenario.lang==='en'?'No located races in the selected radius':'V izbranem radiju ni zadetkov'
    );
    await expect(panel.locator('[data-nearby-status]')).toContainText(scenario.missing);
    for(const value of ['25','50','100']) {
      await radius.selectOption(value);
      await expect(cards).toHaveCount(1);
      await expect(cards.first()).toContainText('Synthetic Zalec Race');
    }

    // The geographic selection intersects existing Finder region filters.
    await page.locator('[data-filter="region"]').selectOption('Gorenjska');
    await expect(cards).toHaveCount(0);
    await page.locator('[data-filter="region"]').selectOption('');
    await expect(cards).toHaveCount(1);

    await lat.fill('invalid');
    await panel.locator('[data-nearby-apply]').click();
    await expect(cards).toHaveCount(2); // no stale nearby selection
    await expect(lat).toHaveValue('invalid');
    await expect(panel.locator('[data-nearby-status]')).toContainText(
      scenario.lang==='en'?'Enter valid latitude':'Vnesite veljavno'
    );
    await lat.fill(scenario.lat);
    await panel.locator('[data-nearby-apply]').click();
    await expect(cards).toHaveCount(1);

    // No exact user origin should enter URL, storage, or analytics requests.
    const browserState=await page.evaluate(()=>({
      url:location.href, local:Object.values(localStorage).join(' '),
      session:Object.values(sessionStorage).join(' ')
    }));
    for(const text of ['46.34','46,34','15.164716','15,164716']) {
      expect(browserState.url).not.toContain(text);
      expect(browserState.local).not.toContain(text);
      expect(browserState.session).not.toContain(text);
      expect(analyticsBodies.join(' ')).not.toContain(text);
    }

    await panel.locator('[data-nearby-clear]').click();
    await expect(cards).toHaveCount(2);
    await expect(page.locator('[data-search-results] [data-nearby-distance]')).toHaveCount(0);
    await expect(lat).toHaveValue('');
    await expect(lng).toHaveValue('');
    await expect(radius).toHaveValue('25');
    await expect(town).toHaveValue('');
    await expect(panel.locator('[data-nearby-origin-summary]')).toBeEmpty();
    expect(page.url()).not.toContain('lat=');
    expect(page.url()).not.toContain('lng=');
  });
}
