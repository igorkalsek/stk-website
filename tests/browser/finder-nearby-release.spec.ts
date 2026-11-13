import { expect, test } from '@playwright/test';

// Private build only: real reviewed candidate index; strictly mocked source API.
// This is NOT a smoke test against public live Master or a production deployment.
const API_BASE='https://stk-master-api.igor-kalsek.workers.dev';
const makeEvent=(row: number, datum: string, name: string, place: string) => ({
  row:String(row),datum,naziv_prireditve:name,kraj:place,regija:'Obalno-kraška',
  tip_podlage:'trail',razdalje_km:'10',status_dogodka:'potrjeno',
  vidno_v_javnem_koledarju:'DA',povezava_razpis:'https://example.org/test-offline'
});
const sourceByYear={
  '2026':[
    makeEvent(266,'2026-12-05','25. Štanjelski tek','Štanjel'),
    makeEvent(260,'2026-11-14','Novomeški polmaraton','Novo mesto')
  ],
  '2027':[
    makeEvent(19,'2027-03-07','4. Trail po kraških klancih 2027','Križ pri Sežani'),
    makeEvent(22,'2027-03-21','Mali kraški maraton 2027','Sežana'),
    makeEvent(23,'2027-04-04','Ormoški polmaraton 2027','Ormož')
  ]
} as const;

for (const scenario of [
  {
    year:'2027',language:'en',path:'/en/find-races/?year=2027',width:390,
    located:2, missing:/1 of 3 races/,exact:false
  },
  {
    year:'2026',language:'sl',path:'/iskalnik-tekov/?year=2026',width:1280,
    located:1, missing:/Za 1 od 2 tekov/,exact:true
  }
] as const) {
  test(`DEV-056 private release rehearsal ${scenario.year}/${scenario.language}: static candidate index, no GPS or storage leak`, async ({page})=>{
    await page.clock.setFixedTime(new Date('2026-11-13T09:00:00.000Z'));
    await page.setViewportSize({width:scenario.width,height:844});
    const tracked: string[]=[];
    await page.route(`${API_BASE}/**`,async route=>{
      const url=new URL(route.request().url());
      if (url.pathname==='/additional'||url.pathname==='/top') return route.fulfill({json:{data:[]}});
      const year=url.searchParams.get('year')==='2027'?'2027':scenario.year;
      return route.fulfill({json:{data:sourceByYear[year]}});
    });
    await page.route('https://script.google.com/**',async route=>{
      tracked.push(route.request().postData()||'');
      return route.fulfill({status:204,body:''});
    });
    await page.goto(scenario.path);
    const cards=page.locator('[data-search-results] .search-event-card');
    const panel=page.locator('[data-nearby-panel]');
    await expect(cards).toHaveCount(sourceByYear[scenario.year].length);
    await expect(panel).not.toHaveAttribute('hidden','');
    if(scenario.width<600){
      const mobile=page.locator('[data-mobile-filter-panel]');
      if(!(await mobile.evaluate((e:HTMLDetailsElement)=>e.open))) await mobile.locator(':scope > summary').click();
    }
    await expect(panel).toBeVisible();
    await expect(panel.locator('[data-nearby-pilot-scope]')).toContainText(
      scenario.language==='en'?'only selected races in the Karst region':'le izbrani teki na Krasu'
    );
    await expect(panel.locator('[data-nearby-sources]')).toContainText('Wikidata (CC0)');
    const origin=panel.locator('[data-nearby-origin-place]');
    await expect(origin.locator('option')).toHaveCount(4);
    await origin.selectOption('kriz-sezana');
    await expect(cards).toHaveCount(scenario.located);
    await expect(panel.locator('[data-nearby-status]')).toContainText(scenario.missing);
    const renderedDist=cards.locator('[data-nearby-distance]');
    await expect(renderedDist).toHaveCount(scenario.located);
    if(scenario.exact){
      await expect(cards.first()).toContainText('25. Štanjelski tek');
      await expect(renderedDist.first()).not.toContainText('≈');
    }else{
      await expect(cards.first()).toContainText('4. Trail po kraških klancih 2027');
      await expect(cards.nth(1)).toContainText('Mali kraški maraton 2027');
      await expect(renderedDist.first()).toContainText('≈');
      await expect(renderedDist.nth(1)).toContainText('≈');
    }
    await expect(panel.locator('[data-nearby-origin-summary]')).toContainText('Križ');
    const leaked=await page.evaluate(()=>({
      url:location.href,local:Object.values(localStorage).join(' '),session:Object.values(sessionStorage).join(' ')
    }));
    for(const value of ['45.745','13.86805556']){
      expect(leaked.url).not.toContain(value);
      expect(leaked.local).not.toContain(value);
      expect(leaked.session).not.toContain(value);
      expect(tracked.join(' ')).not.toContain(value);
    }
    await panel.locator('[data-nearby-clear]').click();
    await expect(cards).toHaveCount(sourceByYear[scenario.year].length);
    await expect(panel.locator('[data-nearby-origin-summary]')).toBeEmpty();
    await expect(page.locator('[data-search-results] [data-nearby-distance]')).toHaveCount(0);
  });
}
