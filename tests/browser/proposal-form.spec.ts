import { expect, test, type Page } from '@playwright/test';
import { googleProposalFormContract } from '../../src/proposal-form/proposal-form-contract';

const contract = googleProposalFormContract;
const normalizeLineEndings = (value: FormDataEntryValue | null | undefined) => String(value ?? '').replace(/\r\n?/g, '\n');
const correctionQuery = 'event=Dolgi%20%C5%A0marnogorski%20tek&year=2027&date=2027-05-01&place=Ljubljana&region=Osrednjeslovenska&source=https%3A%2F%2Fexample.com%2Fzelo-dolg-url%2Frazpis&returnUrl=%2Ftek%2F2027%2Fdolgi-tek%2F&lang=sl';
const fullContextQuery = 'event=Dolgi%20%C5%A0marnogorski%20tek&year=2027&date=2027-05-01&place=Ljubljana&region=Osrednjeslovenska&eventKey=2027-dolgi-smarnogorski-tek&context=detail&source=detail&returnUrl=%2Ftek%2F2027%2Fdolgi-tek%2F&startTime=10%3A00&distances=10%20km%3B%2021%20km&noticeUrl=https%3A%2F%2Fexample.com%2Frazpis&surface=asfalt&cup=Pokal%20STK&elevationGain=650';
const completeContextQuery = `${fullContextQuery}&registrationMinEur=20&registrationMaxEur=25&registrationDescription=Razli%C4%8Dne%20razdalje&registrationDeadline=2027-04-20&earlyRegistrationDeadline=2027-04-01&dayOfRegistration=Da&registrationUrl=https%3A%2F%2Fexample.com%2Fprijava&routeUrl=https%3A%2F%2Fexample.com%2Ftrasa&otherDetails=Dru%C5%BEinam%20prijazno&organizator_naziv=%C5%A0D%20Objavljeno&organizator_url=https%3A%2F%2Fexample.com%2Forg`;
const zagorjeContextQuery = 'event=21.%20Tek%20in%20pohod%20po%20Zagorski%20dolini&year=2026&date=2026-08-01&place=Zagorje%20ob%20Savi&region=Zasavska&startTime=18%3A00&distances=0%2C2%20km%20%C2%B7%200%2C3%20km%20%C2%B7%200%2C5%20km%20%C2%B7%201%20km%20%C2%B7%204%2C6%20km%20%C2%B7%207%2C5%20km%20%C2%B7%2010%2C3%20km&surface=Cesta&registrationMinEur=15&registrationMaxEur=25&registrationDescription=Otro%C5%A1ki%20teki&registrationDeadline=2026-08-01&earlyRegistrationDeadline=2026-07-27&dayOfRegistration=DA';

type InterceptedForm = { getPayloads: () => URLSearchParams[]; getPayload: () => URLSearchParams | undefined; getSubmissions: () => number; getUrls: () => string[]; getDirectPosts: () => number };
type InterceptOptions = { responseMode?: 'fulfill' | 'hang' };
const analyticsEndpointPattern = 'https://script.google.com/macros/s/**';

async function interceptForm(page: Page, options: InterceptOptions = {}): Promise<InterceptedForm> {
  const urls: string[] = [];
  const posts: URLSearchParams[] = [];
  await page.route(`${contract.viewUrl}**`, async (route) => {
    urls.push(route.request().url());
    await route.fulfill({ status: 200, contentType: 'text/html', body: '<html><title>Google form</title><body>Google form</body></html>' });
  });
  await page.route(`${contract.responseUrl}**`, async (route) => {
    urls.push(route.request().url());
    posts.push(new URLSearchParams(route.request().postData() ?? ''));
    if (options.responseMode === 'hang') return new Promise(() => undefined);
    await route.fulfill({ status: 200, contentType: 'text/html', body: '<html><body>OK</body></html>' });
  });
  return {
    getPayloads: () => posts,
    getPayload: () => posts.at(-1),
    getSubmissions: () => posts.length,
    getUrls: () => urls,
    getDirectPosts: () => posts.length
  };
}


async function mockRacePickerApi(page: Page, fail = false) {
  const row = { row: '12', datum: '2026-07-19', naziv_prireditve: '20. Gorski tek na Bevkov vrh – trail 2026', kraj: 'Gorenje Jazne', regija: 'Goriška', status_dogodka: 'Potrjeno', vidno_v_javnem_koledarju: 'DA', tip_podlage: 'trail', razdalje_km: '10.5', cas_zacetka: '10:00', povezava_razpis: 'https://example.com/razpis', povezava_prijava: 'https://example.com/prijava', pokal: 'Pokal STK' };
  await page.route('https://stk-master-api.igor-kalsek.workers.dev/**', async (route) => fail ? route.abort() : route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([row]) }));
}

async function assertNoConsoleErrors(page: Page, errors: string[]) {
  await page.waitForTimeout(50);
  expect(errors).toEqual([]);
}

function collectConsoleErrors(page: Page) {
  const errors: string[] = [];
  page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
  return errors;
}

async function waitForProposalRuntime(page: Page) {
  await expect(page.locator('[data-proposal-form]')).toHaveAttribute('data-proposal-runtime-ready', 'true');
}

async function enterSlovenianManualCorrectionMode(page: Page) {
  await page.getByRole('radio', { name: 'Popravek ali dopolnitev obstoječega teka' }).check();
  await page.getByTestId('race-picker-manual').click();
  await expect(page.locator('#proposal-date')).toBeVisible();
}

test.describe('native proposal form', () => {
  test('current workflow step preserves proposal query context and entered data', async ({ page }) => {
    await mockRacePickerApi(page);
    await page.goto(`/dodaj-ali-popravi-tek/?${correctionQuery}`);
    await waitForProposalRuntime(page);
    const originalUrl = page.url();
    const currentStep = page.locator('.organizer-workflow [aria-current="step"]');
    await expect(currentStep).toHaveText(/Objavite ali posodobite tek/);
    await expect(currentStep).not.toHaveAttribute('href');
    await expect(currentStep).toHaveAttribute('aria-current', 'step');
    await page.locator('#proposal-description').fill('Podatek, ki se ne sme izgubiti.');
    await currentStep.click();
    await expect(page).toHaveURL(originalUrl);
    await expect(page.locator('#proposal-description')).toHaveValue('Podatek, ki se ne sme izgubiti.');
  });

  test('SL organizer confirmation validates and posts exactly once on mobile', async ({ page }) => {
    const errors = collectConsoleErrors(page); const intercepted = await interceptForm(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/dodaj-ali-popravi-tek/?mode=confirm&${completeContextQuery}`); await waitForProposalRuntime(page);
    await expect(page.getByRole('heading', { name: 'Objavljeni podatki o teku' })).toBeVisible();
    await expect(page.locator('.proposal-type-fieldset')).toBeHidden(); await expect(page.locator('#proposal-date')).toBeHidden();
    await expect.poll(() => page.locator('.form-grid').locator('input,select,textarea').evaluateAll((controls: HTMLInputElement[]) => controls.every((control) => control.disabled))).toBe(true);
    await page.getByRole('button', { name: 'Potrdite podatke' }).click(); expect(intercepted.getSubmissions()).toBe(0);
    await expect(page.getByRole('alert')).toContainText('Ime organizacije ali društva'); await expect(page.locator('#confirmation-organization')).toBeFocused();
    await page.locator('#confirmation-organization').fill('ŠD Test'); await page.locator('#confirmation-email').fill('org@example.com');
    await page.getByRole('button', { name: 'Potrdite podatke' }).click(); expect(intercepted.getSubmissions()).toBe(0);
    await expect(page.getByRole('alert')).toContainText('Potrjujem, da nastopam');
    const publishedSummary = page.getByRole('region', { name: 'Objavljeni podatki o teku' }).locator('.confirmation-summary');
    await expect(publishedSummary.getByText('Uradni naziv organizatorja')).toBeVisible();
    await expect(publishedSummary.getByText('ŠD Objavljeno')).toBeVisible();
    await expect(publishedSummary.getByText('Uradna spletna stran organizatorja')).toBeVisible();
    await expect(publishedSummary).toContainText('Dolgi Šmarnogorski tek');
    await expect(publishedSummary).toContainText('2027-05-01');
    await expect(publishedSummary).toContainText('ŠD Objavljeno');
    await expect(page.locator('#confirmation-statement')).toBeFocused();
    await page.locator('#confirmation-statement').check(); await page.getByRole('button', { name: 'Potrdite podatke' }).click();
    await expect.poll(() => intercepted.getSubmissions()).toBe(1); const payload = intercepted.getPayload();
    expect(payload?.get(contract.fields.proposalType)).toBe(contract.values.proposalTypes[1]);
    expect(payload?.get(contract.fields.description)).toContain('Vrsta predloga: Potrditev podatkov organizatorja');
    expect(payload?.get(contract.fields.organizer)).toBe('Da'); expect(payload?.get(contract.fields.officialAnnouncement2026)).toBe('Ne vem');
    expect(page.url()).not.toContain('docs.google.com'); expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
    await assertNoConsoleErrors(page, errors);
  });

  test('EN organizer confirmation preserves correction and safe return links', async ({ page }) => {
    const errors = collectConsoleErrors(page); const intercepted = await interceptForm(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`/en/add-or-correct-race/?mode=confirm&${completeContextQuery.replace('lang=sl', 'lang=en').replace('/tek/2027/', '/en/races/2027/')}`); await waitForProposalRuntime(page);
    await expect(page.getByRole('heading', { name: 'Published race information' })).toBeVisible();
    const publishedSummary = page.getByRole('region', { name: 'Published race information' }).locator('.confirmation-summary');
    await expect(publishedSummary.getByText('Official organizer name')).toBeVisible();
    await expect(publishedSummary.getByText('ŠD Objavljeno')).toBeVisible();
    await expect(page.getByRole('link', { name: 'The information is not correct – open the correction form' })).not.toHaveAttribute('href', /mode=confirm/);
    await page.locator('#confirmation-organization').fill('Test Club'); await page.locator('#confirmation-email').fill('org@example.com'); await page.locator('#confirmation-statement').check();
    await page.getByRole('button', { name: 'Confirm information' }).click(); await expect.poll(() => intercepted.getSubmissions()).toBe(1);
    expect(intercepted.getPayload()?.get(contract.fields.description)).toContain('Vrsta predloga: Potrditev podatkov organizatorja'); await assertNoConsoleErrors(page, errors);
  });

  test('confirmation without race context explains next steps and cannot post', async ({ page }) => {
    const intercepted = await interceptForm(page); await page.goto('/dodaj-ali-popravi-tek/?mode=confirm'); await waitForProposalRuntime(page);
    await expect(page.getByRole('heading', { name: 'Podatki o teku manjkajo' })).toBeVisible();
    await expect.poll(() => page.locator('.confirmation-mode').locator('input,textarea').evaluateAll((controls: HTMLInputElement[]) => controls.every((control) => control.disabled))).toBe(true);
    await expect(page.getByRole('button', { name: 'Potrdite podatke' })).toHaveCount(0); expect(intercepted.getSubmissions()).toBe(0);
  });
  test('SL new race URL helpers, hidden links, exact payload, mobile and no console errors', async ({ page }) => {
    const errors = collectConsoleErrors(page);
    const form = await interceptForm(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/dodaj-ali-popravi-tek/');
    await waitForProposalRuntime(page);

    await expect(page.getByText('Predlog za nov tek, popravek ali dopolnitev podatkov se pred objavo pregleda in preveri.')).toBeVisible();
    await expect(page.getByText('Predlog se ne objavi samodejno.')).toBeVisible();
    await expect(page.getByText('Predlog bo poslan v pregled. Ostali boste na tej strani.')).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Uradni vir (neobvezno)', exact: true })).toBeVisible();
    await expect(page.locator('#proposal-source')).not.toHaveAttribute('required', '');
    await expect(page.getByRole('textbox', { name: /Povezava do razpisa/ })).toHaveCount(0);

    await page.getByRole('radio', { name: 'Nov tek' }).check();
    await expect(page.getByRole('textbox', { name: 'Opis teka in dodatne informacije', exact: true })).toBeVisible();
    await expect(page.locator('#proposal-description')).toHaveAttribute('placeholder', 'Npr. razdalje, čas starta, vrsta podlage, prijavnina in povezava za prijavo.');
    await expect(page.getByText('Po želji dodajte podatke o izvedbi, prijavi, ceni in trasi.')).toBeVisible();
    await expect(page.getByRole('group', { name: 'Dodatni podatki o teku' })).toBeVisible();
    await expect(page.getByText('Navedite manjkajoči ali pravilen podatek.')).toHaveCount(0);
    await expect(page.getByText('Kaj želite popraviti ali dopolniti?')).toHaveCount(0);
    await expect(page.locator('[data-change-options-details]')).toBeHidden();
    await expect(page.locator('input[name="proposal-change-category"]:visible')).toHaveCount(0);
    await expect(page.getByTestId('additional-correction-intent')).toBeHidden();
    await expect(page.locator('[data-change-summary]')).toBeHidden();
    await expect(page.getByRole('heading', { name: 'Podatki o izvedbi' })).toBeVisible();
    for (const testId of ['basic-correction-start-time', 'basic-correction-distances', 'basic-correction-surface', 'basic-correction-registration-url', 'basic-correction-cup', 'additional-entry-fee-min', 'additional-entry-fee-max', 'additional-entry-fee-description', 'additional-registration-deadline', 'additional-cheaper-registration', 'additional-race-day-registration', 'additional-elevation', 'additional-route-url', 'additional-other', 'basic-correction-organizer-name', 'basic-correction-organizer-url']) {
      await expect(page.getByTestId(testId)).toBeVisible();
      await expect(page.getByTestId(testId)).toBeEnabled();
    }
    for (const testId of ['basic-correction-date', 'basic-correction-title', 'basic-correction-place', 'basic-correction-region', 'basic-correction-notice-url']) await expect(page.getByTestId(testId)).toBeHidden();
    await expect(page.getByRole('textbox', { name: 'Kraj', exact: true })).toHaveAttribute('required', '');
    await expect(page.locator('#proposal-date')).toHaveAttribute('required', '');
    await page.locator('#proposal-source').fill('organizator.si/razpis');
    await page.locator('#proposal-source').blur();
    await expect(page.locator('#proposal-source')).toHaveValue('https://organizator.si/razpis');
    await page.locator('#proposal-source').fill('https://tekaski-koledar.si/dodaj-ali-popravi-tek/');
    await page.locator('#proposal-source').blur();
    await expect(page.getByText('To je povezava na Slovenski Tekaški Koledar')).toBeVisible();
    await page.locator('#proposal-source').fill('notaurl://bad');
    await page.getByRole('button', { name: 'Pošlji predlog' }).click();
    await expect(page.locator('#proposal-source-error')).toBeVisible();
    await expect(page.locator('#proposal-source')).toHaveAttribute('aria-invalid', 'true');
    await page.locator('#proposal-source').fill('https://example.com/razpis/2026?zelo=dolg-url');
    await expect(page.locator('#proposal-source-error')).toBeHidden();
    await expect(page.locator('#proposal-source')).not.toHaveAttribute('aria-invalid', 'true');

    const emailValidity = async (value: string) => page.locator('#proposal-email').evaluate((input: HTMLInputElement, nextValue) => { input.value = nextValue as string; return { valid: input.checkValidity(), patternMismatch: input.validity.patternMismatch, valueMissing: input.validity.valueMissing }; }, value);
    await expect.poll(async () => (await emailValidity('test@example.com')).valid).toBe(true);
    await expect.poll(async () => (await emailValidity('review@example.com')).valid).toBe(true);
    await expect.poll(async () => (await emailValidity('igor@gmail')).patternMismatch).toBe(true);
    await expect.poll(async () => (await emailValidity('test@')).valid).toBe(false);
    await expect.poll(async () => (await emailValidity('')).valueMissing).toBe(true);

    await page.locator('#proposal-date').fill('2026-09-12');
    await page.getByRole('textbox', { name: 'Naziv prireditve' }).fill('Štajerski ultra tek z zelo zelo dolgim nazivom');
    await page.getByRole('textbox', { name: 'Kraj', exact: true }).fill('Maribor');
    await page.getByRole('combobox', { name: 'Regija' }).selectOption('Podravska');
    await page.getByRole('textbox', { name: 'Opis teka in dodatne informacije', exact: true }).fill('Razdalje 10 km in 21 km, start ob 10.00.');
    await page.getByTestId('basic-correction-start-time').fill('10:00');
    await page.getByTestId('basic-correction-distances').fill('10 km; 21 km');
    await page.getByTestId('basic-correction-surface').selectOption('asfalt');
    await page.getByTestId('basic-correction-registration-url').fill('https://example.com/prijava');
    await page.getByTestId('basic-correction-cup').fill('Pokal STK');
    await page.getByTestId('basic-correction-organizer-name').fill('ŠD Objavljeno');
    await page.getByTestId('basic-correction-organizer-url').fill('https://example.com/organizator');
    await page.getByTestId('additional-entry-fee-min').fill('15');
    await page.getByTestId('additional-entry-fee-max').fill('25');
    await page.getByTestId('additional-entry-fee-description').fill('Cena je odvisna od razdalje.');
    await page.getByTestId('additional-registration-deadline').fill('2026-08-01');
    await page.getByTestId('additional-cheaper-registration').fill('2026-07-27');
    await page.getByTestId('additional-race-day-registration').selectOption('Da');
    await page.getByTestId('additional-elevation').fill('450');
    await page.getByTestId('additional-route-url').fill('https://example.com/trasa');
    await page.getByTestId('additional-other').fill('Otroški teki');
    await page.getByRole('combobox', { name: 'Ali ste organizator?' }).selectOption('Ne');
    await page.getByRole('combobox', { name: 'Ali je za izbrano leto že objavljen uradni razpis ali uradna objava?' }).selectOption('Da');
    await page.getByRole('textbox', { name: 'Kontaktni e-naslov' }).fill('test@example.com');
    await page.getByRole('button', { name: 'Pošlji predlog' }).click();

    await expect.poll(() => form.getSubmissions()).toBe(1);
    const payload = form.getPayload();
    expect(payload?.get(contract.fields.proposalType)).toBe('Nov tek (dodajanje nove prireditve)');
    expect(payload?.get(contract.fields.date)).toBe('2026-09-12');
    expect(payload?.get(contract.fields.title)).toBe('Štajerski ultra tek z zelo zelo dolgim nazivom');
    expect(payload?.get(contract.fields.place)).toBe('Maribor');
    expect(payload?.get(contract.fields.region)).toBe('Podravska');
    expect(payload?.get(contract.fields.officialSource)).toBe('https://example.com/razpis/2026?zelo=dolg-url');
    const expectedDescription = 'Razdalje 10 km in 21 km, start ob 10.00.\n\nČas začetka: 10:00\nRazdalje: 10 km; 21 km\nVrsta podlage: asfalt\nPrijavna povezava: https://example.com/prijava\nPokal ali serija: Pokal STK\nUradni naziv organizatorja: ŠD Objavljeno\nUradna spletna stran organizatorja: https://example.com/organizator\nNajnižja prijavnina: 15\nNajvišja prijavnina: 25\nOpis prijavnine: Cena je odvisna od razdalje.\nRok prijave: 2026-08-01\nRok cenejše prijave: 2026-07-27\nPrijave na dan dogodka: Da\nVišinski metri: 450\nTrasa, zemljevid ali GPX: https://example.com/trasa\nDrugi dodatni podatki: Otroški teki';
    expect(normalizeLineEndings(payload?.get(contract.fields.description))).toBe(expectedDescription);
    expect(payload?.getAll(contract.fields.additionalData)).toEqual(['Prijavnina / startnina', 'Rok prijave', 'Cenejša prijava / sprememba cene', 'Prijave na dan dogodka', 'Višinski metri', 'Trasa / zemljevid / GPX', 'Drugo']);
    const fallbackParams = new URL(await page.locator('[data-correction-form-link]').getAttribute('href') || '').searchParams;
    expect(fallbackParams.get(contract.fields.description)).toBe(expectedDescription);
    expect(fallbackParams.getAll(contract.fields.additionalData)).toEqual(payload?.getAll(contract.fields.additionalData));
    expect(payload?.get(contract.fields.organizer)).toBe('Ne');
    expect(payload?.get(contract.fields.officialAnnouncement2026)).toBe('Da');
    expect(payload?.get(contract.fields.email)).toBe('test@example.com');
    expect(form.getUrls().at(-1)).toContain('/formResponse');
    expect(payload?.get(contract.fields.dateYear)).toBe('2026');
    expect(payload?.get(contract.fields.dateMonth)).toBe('9');
    expect(payload?.get(contract.fields.dateDay)).toBe('12');
    expect(page.url()).not.toContain('docs.google.com');
    await assertNoConsoleErrors(page, errors);
  });



  test('new race with empty date blocks submission before Google POST', async ({ page }) => {
    const form = await interceptForm(page);
    await page.goto('/dodaj-ali-popravi-tek/?mode=new');
    await waitForProposalRuntime(page);
    await expect.poll(() => page.locator('.confirmation-mode').locator('input,textarea').evaluateAll((controls: HTMLInputElement[]) => controls.every((control) => control.disabled))).toBe(true);
    await page.getByRole('textbox', { name: 'Naziv prireditve' }).fill('dfdfg');
    await page.getByRole('textbox', { name: 'Kraj', exact: true }).fill('Maribor');
    await page.getByRole('combobox', { name: 'Regija' }).selectOption('Podravska');
    await page.locator('#proposal-source').fill('https://example.com/razpis');
    await page.getByRole('textbox', { name: 'Opis teka in dodatne informacije', exact: true }).fill('Razdalje 5 km.');
    await page.getByRole('combobox', { name: 'Ali ste organizator?' }).selectOption('Ne');
    await page.getByRole('combobox', { name: 'Ali je za izbrano leto že objavljen uradni razpis ali uradna objava?' }).selectOption('Ne vem');
    await page.getByRole('textbox', { name: 'Kontaktni e-naslov' }).fill('test@example.com');
    await page.getByRole('button', { name: 'Pošlji predlog' }).click();

    await expect.poll(() => form.getSubmissions()).toBe(0);
    await expect(page).toHaveURL(/dodaj-ali-popravi-tek/);
    await expect(page.locator('#proposal-date')).toHaveAttribute('aria-invalid', 'true');
    await expect(page.locator('#proposal-date')).toBeFocused();
    await expect(page.getByRole('button', { name: 'Pošlji predlog' })).toBeEnabled();
  });

  test('valid new race posts formResponse once including date parts and stays on STK page', async ({ page }) => {
    const form = await interceptForm(page);
    await page.goto('/dodaj-ali-popravi-tek/?mode=new');
    await waitForProposalRuntime(page);
    await page.locator('#proposal-date').fill('2026-09-12');
    await page.getByRole('textbox', { name: 'Naziv prireditve' }).fill('Štajerski ultra tek');
    await page.getByRole('textbox', { name: 'Kraj', exact: true }).fill('Maribor');
    await page.getByRole('combobox', { name: 'Regija' }).selectOption('Podravska');
    await page.locator('#proposal-source').fill('https://example.com/razpis');
    await page.getByRole('textbox', { name: 'Opis teka in dodatne informacije', exact: true }).fill('Razdalje 10 km in 21 km.');
    await page.getByRole('combobox', { name: 'Ali ste organizator?' }).selectOption('Ne');
    await page.getByRole('combobox', { name: 'Ali je za izbrano leto že objavljen uradni razpis ali uradna objava?' }).selectOption('Da');
    await page.getByRole('textbox', { name: 'Kontaktni e-naslov' }).fill('test@example.com');
    await page.getByRole('button', { name: 'Pošlji predlog' }).click();

    await expect.poll(() => form.getSubmissions()).toBe(1);
    const payload = form.getPayload();
    expect(payload?.get(contract.fields.proposalType)).toBe('Nov tek (dodajanje nove prireditve)');
    expect(payload?.get(contract.fields.date)).toBe('2026-09-12');
    expect(payload?.get(contract.fields.dateYear)).toBe('2026');
    expect(payload?.get(contract.fields.dateMonth)).toBe('9');
    expect(payload?.get(contract.fields.dateDay)).toBe('12');
    expect(payload?.get(contract.fields.title)).toBe('Štajerski ultra tek');
    expect(payload?.get(contract.fields.place)).toBe('Maribor');
    expect(payload?.get(contract.fields.region)).toBe('Podravska');
    expect(payload?.get(contract.fields.officialSource)).toBe('https://example.com/razpis');
    expect(payload?.get(contract.fields.description)).toBe('Razdalje 10 km in 21 km.');
    expect(payload?.get(contract.fields.organizer)).toBe('Ne');
    expect(payload?.get(contract.fields.officialAnnouncement2026)).toBe('Da');
    expect(payload?.get(contract.fields.email)).toBe('test@example.com');
    await expect(page.getByRole('alert')).toContainText('Predlog je bil poslan. Hvala za pomoč pri dopolnjevanju koledarja.');
    await expect(page).toHaveURL(/dodaj-ali-popravi-tek/);
  });



  test('iframe load events before submit do not show success, double click sends one POST, fallback is current', async ({ page }) => {
    const form = await interceptForm(page);
    await page.goto('/dodaj-ali-popravi-tek/?mode=new');
    await waitForProposalRuntime(page);
    await page.locator('[data-submit-target]').evaluate((iframe: HTMLIFrameElement) => iframe.dispatchEvent(new Event('load')));
    await expect(page.getByText('Predlog je bil poslan. Hvala za pomoč pri dopolnjevanju koledarja.')).toHaveCount(0);
    await page.locator('#proposal-date').fill('2026-09-12');
    await page.getByRole('textbox', { name: 'Naziv prireditve' }).fill('Enkratni tek');
    await page.getByRole('textbox', { name: 'Kraj', exact: true }).fill('Maribor');
    await page.getByRole('combobox', { name: 'Regija' }).selectOption('Podravska');
    await page.locator('#proposal-source').fill('https://example.com/razpis');
    await page.getByRole('textbox', { name: 'Opis teka in dodatne informacije', exact: true }).fill('Opis za enkratno oddajo.');
    await page.getByRole('combobox', { name: 'Ali ste organizator?' }).selectOption('Ne');
    await page.getByRole('combobox', { name: 'Ali je za izbrano leto že objavljen uradni razpis ali uradna objava?' }).selectOption('Da');
    await page.getByRole('textbox', { name: 'Kontaktni e-naslov' }).fill('once@example.com');
    await expect(page.locator('[data-correction-form-link]')).toHaveAttribute('href', /entry\.528776717=Enkratni\+tek/);
    await page.locator('[data-proposal-form]').evaluate((formElement: HTMLFormElement) => {
      formElement.requestSubmit();
      formElement.requestSubmit();
    });
    await expect.poll(() => form.getSubmissions()).toBe(1);
    expect(page.url()).not.toContain('docs.google.com');
  });

  test('invalid strict date does not create date parts or POST', async ({ page }) => {
    const form = await interceptForm(page);
    await page.goto('/dodaj-ali-popravi-tek/?mode=new');
    await waitForProposalRuntime(page);
    await page.locator('#proposal-date').evaluate((input: HTMLInputElement) => { input.value = '2026-02-31'; });
    await page.getByRole('textbox', { name: 'Naziv prireditve' }).fill('Neveljaven datum');
    await page.getByRole('textbox', { name: 'Kraj', exact: true }).fill('Kranj');
    await page.getByRole('combobox', { name: 'Regija' }).selectOption('Gorenjska');
    await page.getByRole('textbox', { name: 'Opis teka in dodatne informacije', exact: true }).fill('Opis.');
    await page.getByRole('combobox', { name: 'Ali ste organizator?' }).selectOption('Ne');
    await page.getByRole('combobox', { name: 'Ali je za izbrano leto že objavljen uradni razpis ali uradna objava?' }).selectOption('Da');
    await page.getByRole('textbox', { name: 'Kontaktni e-naslov' }).fill('date@example.com');
    await page.getByRole('button', { name: 'Pošlji predlog' }).click();
    await expect.poll(() => form.getSubmissions()).toBe(0);
    await expect(page.locator('[data-date-part="year"]')).toBeDisabled();
  });

  test('new race can submit with empty optional official source and EN label parity', async ({ page }) => {
    const form = await interceptForm(page);
    await page.goto('/dodaj-ali-popravi-tek/?mode=new');
    await waitForProposalRuntime(page);
    await expect(page.locator('#proposal-source')).not.toHaveAttribute('required', '');
    await expect(page.getByRole('textbox', { name: 'Uradni vir (neobvezno)', exact: true })).toBeVisible();
    await page.locator('#proposal-date').fill('2026-11-15');
    await page.getByRole('textbox', { name: 'Naziv prireditve' }).fill('Tek brez vira');
    await page.getByRole('textbox', { name: 'Kraj', exact: true }).fill('Celje');
    await page.getByRole('combobox', { name: 'Regija' }).selectOption('Savinjska');
    await page.getByRole('textbox', { name: 'Opis teka in dodatne informacije', exact: true }).fill('Opis teka brez uradnega vira.');
    await page.getByRole('combobox', { name: 'Ali ste organizator?' }).selectOption('Ne');
    await page.getByRole('combobox', { name: 'Ali je za izbrano leto že objavljen uradni razpis ali uradna objava?' }).selectOption('Ne');
    await page.getByRole('textbox', { name: 'Kontaktni e-naslov' }).fill('test@example.com');
    await page.getByRole('button', { name: 'Pošlji predlog' }).click();

    await expect.poll(() => form.getSubmissions()).toBe(1);
    expect(form.getPayload()?.get(contract.fields.officialSource)).toBe('');

    await page.goto('/en/add-or-correct-race/?mode=new');
    await waitForProposalRuntime(page);
    await expect(page.getByRole('group', { name: 'Additional race details' })).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Race description and additional information', exact: true })).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Official source (optional)', exact: true })).toBeVisible();
    await expect(page.locator('#proposal-source')).not.toHaveAttribute('required', '');
  });

  test('native form posts directly to hidden iframe target without viewform navigation', async ({ page }) => {
    const form = await interceptForm(page);
    await page.goto('/dodaj-ali-popravi-tek/?mode=new');
    await waitForProposalRuntime(page);
    await expect(page.locator('[data-submit-target]')).toHaveCount(1);
    await expect(page.locator('[data-proposal-form]')).toHaveAttribute('target', 'proposal-form-target');
    await expect(page.locator('[data-proposal-form]')).toHaveAttribute('action', contract.responseUrl);
    await page.getByRole('button', { name: 'Pošlji predlog' }).click();
    await expect.poll(() => form.getSubmissions()).toBe(0);
    expect(form.getDirectPosts()).toBe(0);
  });

  test('EN prefilled correction keeps safe return URL, accessible names and reset cancel on desktop', async ({ page }) => {
    const errors = collectConsoleErrors(page);
    const form = await interceptForm(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`/en/add-or-correct-race/?${correctionQuery.replace('lang=sl','lang=en')}`);
    await waitForProposalRuntime(page);

    await expect(page.getByText('A proposal for a new race, correction or additional information is reviewed and verified before publication.')).toBeVisible();
    await expect(page.getByText('Submissions are not published automatically.')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Back to race page' })).toHaveAttribute('href', '/tek/2027/dolgi-tek/');
    await expect(page.locator('#proposal-source')).toBeHidden();
    await expect(page.getByTestId('basic-correction-notice-url')).toBeVisible();
    await expect(page.getByTestId('basic-correction-notice-url')).toHaveValue('https://example.com/zelo-dolg-url/razpis');
    await expect(page.getByTestId('basic-correction-notice-url')).toHaveAttribute('data-original-value', 'https://example.com/zelo-dolg-url/razpis');
    await expect(page.locator('[data-context-existing-radio]')).toBeChecked();
    await expect(page.locator('#proposal-date')).toBeHidden();
    await expect(page.getByRole('heading', { name: 'Enter changes' })).toBeVisible();
    await expect(page.locator('[data-published-details]')).toHaveCount(0);
    const context = page.getByRole('region', { name: 'Dolgi Šmarnogorski tek' });
    await expect(context).toContainText('01/05/2027 · Ljubljana · Osrednjeslovenska');
    await expect(page.getByTestId('structured-basic-section')).toBeVisible();
    await expect(page.locator('label:has(input[name="proposal-change-category"][value="basic-title-place"])')).toBeHidden();
    await expect(page.getByTestId('basic-correction-place')).toHaveValue('Ljubljana');
    await expect(page.getByTestId('basic-correction-place')).toHaveAttribute('data-original-value', 'Ljubljana');
    await page.getByTestId('basic-correction-place').fill('Ljubljana Center');
    await expect(page.getByTestId('basic-correction-place')).toHaveAttribute('data-changed', 'true');
    const placeCard = page.locator('[data-basic-card="place"]');
    await expect(placeCard.getByText('Changed', { exact: true })).toBeVisible();
    await placeCard.getByRole('button', { name: 'Undo' }).click();
    await expect(page.getByTestId('basic-correction-place')).toHaveValue('Ljubljana');
    await page.getByTestId('basic-correction-place').fill('Ljubljana Center');
    await page.getByRole('combobox', { name: 'Are you the organizer?' }).selectOption('No');
    await page.getByRole('combobox', { name: 'Has the official announcement for the selected year already been published?' }).selectOption('I do not know');
    await page.getByRole('textbox', { name: 'Contact email' }).fill('review@example.com');
    page.once('dialog', async (dialog) => { expect(dialog.message()).toBe('Clear your changes and restore the selected race details?'); await dialog.dismiss(); });
    await expect(page.getByRole('button', { name: 'Clear entered changes' })).toBeVisible();
    await page.getByRole('button', { name: 'Clear entered changes' }).click();
    await expect(page.getByTestId('basic-correction-place')).toHaveValue('Ljubljana Center');
    await page.getByRole('button', { name: 'Submit change' }).click();

    await expect.poll(() => form.getPayload()?.get(contract.fields.proposalType)).toBe('Popravek obstoječega vnosa v koledarju');
    expect(form.getPayload()?.get(contract.fields.date)).toBe('2027-05-01');
    expect(form.getPayload()?.get(contract.fields.place)).toBe('Ljubljana');
    expect(form.getPayload()?.get(contract.fields.description)).toContain('Current: Ljubljana');
    expect(form.getPayload()?.get(contract.fields.description)).toContain('Proposed: Ljubljana Center');
    expect(form.getUrls().at(-1)).toContain('/formResponse');
    await assertNoConsoleErrors(page, errors);
  });


  test('existing correction starts with race picker, supports search, keyboard selection, manual fallback and API failure', async ({ page }) => {
    await mockRacePickerApi(page);
    await page.goto('/dodaj-ali-popravi-tek/');
    await waitForProposalRuntime(page);
    await page.getByRole('radio', { name: 'Popravek ali dopolnitev obstoječega teka' }).check();
    await expect(page.getByTestId('race-picker')).toBeVisible();
    await expect(page.locator('#proposal-date')).toBeHidden();
    await page.getByTestId('race-picker-search').fill('Bevkov');
    await expect(page.getByRole('option', { name: /20\. Gorski tek na Bevkov vrh/ })).toBeVisible();
    await page.getByTestId('race-picker-search').fill('Gorenje Jazne');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/event=20\.\+Gorski\+tek\+na\+Bevkov\+vrh/);
    await expect(page.getByTestId('race-picker')).toBeHidden();
    await expect(page.locator('[data-correction-context]')).toBeVisible();
    await expect(page.getByTestId('structured-additional-section')).toBeVisible();

    await page.goto('/dodaj-ali-popravi-tek/');
    await waitForProposalRuntime(page);
    await page.getByRole('radio', { name: 'Popravek ali dopolnitev obstoječega teka' }).check();
    await page.getByTestId('race-picker-manual').click();
    await expect(page.locator('#proposal-date')).toBeVisible();
    await page.getByTestId('race-picker-back').click();
    await expect(page.locator('#proposal-date')).toBeHidden();

    await page.goto('/en/add-or-correct-race/');
    await waitForProposalRuntime(page);
    await page.getByRole('radio', { name: 'Correct or add details to an existing race' }).check();
    await expect(page.getByTestId('race-picker')).toBeVisible();
    await expect(page.getByLabel('Search by race name or place')).toBeVisible();
  });

  test('race picker loading failure still allows manual correction entry', async ({ page }) => {
    await mockRacePickerApi(page, true);
    await page.goto('/dodaj-ali-popravi-tek/');
    await waitForProposalRuntime(page);
    await page.getByRole('radio', { name: 'Popravek ali dopolnitev obstoječega teka' }).check();
    await expect(page.getByTestId('race-picker')).toBeVisible();
    await page.getByTestId('race-picker-manual').click();
    await expect(page.locator('#proposal-date')).toBeVisible();
  });

  test('combined existing change requires race identity, maps categories, and posts exact payload', async ({ page }) => {
    const form = await interceptForm(page);
    await page.goto('/dodaj-ali-popravi-tek/');
    await waitForProposalRuntime(page);
    await page.getByRole('radio', { name: 'Popravek ali dopolnitev obstoječega teka' }).check();
    await expect(page.getByTestId('race-picker')).toBeVisible();
    await page.getByTestId('race-picker-manual').click();
    await expect(page.getByText('Kaj želite popraviti ali dopolniti?')).toBeVisible();
    await expect(page.getByTestId('structured-additional-section')).toBeVisible();
    await expect(page.getByText('Izberite osnovni popravek ali spodaj vnesite dodatne podatke v ločena polja.')).toBeVisible();
    await expect(page.locator('#proposal-date')).toBeVisible();
    await expect(page.locator('#proposal-date')).toHaveAttribute('required', '');
    await expect(page.getByRole('textbox', { name: 'Naziv prireditve' })).toHaveAttribute('required', '');
    await expect(page.getByRole('textbox', { name: 'Kraj', exact: true })).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Kraj', exact: true })).toHaveAttribute('required', '');
    await expect(page.getByRole('combobox', { name: 'Regija' })).toBeVisible();
    await expect(page.getByRole('combobox', { name: 'Ali ste organizator?' })).toBeVisible();
    await expect(page.getByRole('combobox', { name: 'Ali je za izbrano leto že objavljen uradni razpis ali uradna objava?' })).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Uradni vir (neobvezno)', exact: true })).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Kontaktni e-naslov' })).toHaveAttribute('required', '');
    await expect(page.locator('input[name="proposal-change-category"][value="Popravek napačnega dodatnega podatka"]')).toHaveCount(0);
    await expect(page.getByTestId('additional-correction-intent')).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Vnesite manjkajoče ali pravilne podatke' })).toHaveAttribute('placeholder', 'Navedite manjkajoči ali pravilen podatek.');
    const additionalBox = await page.locator('[data-additional-section]').boundingBox();
    const descriptionBox = await page.getByRole('textbox', { name: 'Vnesite manjkajoče ali pravilne podatke' }).boundingBox();
    expect(additionalBox && descriptionBox && additionalBox.y < descriptionBox.y).toBeTruthy();
    await expect(page.getByRole('checkbox', { name: 'Datum ali ura', exact: true })).toBeVisible();
    await page.getByRole('checkbox', { name: 'Datum ali ura', exact: true }).check();

    await page.getByRole('textbox', { name: 'Vnesite manjkajoče ali pravilne podatke' }).fill('Datum naj bo 13. 9. 2026.');
    await page.getByTestId('additional-entry-fee-min').fill('20');
    await page.getByTestId('additional-entry-fee-max').fill('25');
    await page.getByTestId('additional-entry-fee-description').fill('Cena je odvisna od razdalje.');
    await page.getByRole('textbox', { name: 'Kontaktni e-naslov' }).fill('igor@gmail');
    await page.getByRole('button', { name: 'Pošlji predlog' }).click();
    await expect(page.getByRole('alert')).toContainText('Datum');
    await expect(page.getByRole('alert')).toContainText('Naziv prireditve');
    await page.locator('#proposal-date').fill('2026-09-12');
    await page.getByRole('textbox', { name: 'Naziv prireditve' }).fill('Tek z dodatnimi podatki');
    await page.getByRole('textbox', { name: 'Kraj', exact: true }).fill('Kranj');
    await page.getByRole('combobox', { name: 'Regija' }).selectOption('Gorenjska');
    await page.getByRole('combobox', { name: 'Ali ste organizator?' }).selectOption('Ne');
    await page.getByRole('combobox', { name: 'Ali je za izbrano leto že objavljen uradni razpis ali uradna objava?' }).selectOption('Ne vem');
    await page.locator('#proposal-source').fill('https://example.com/vir');
    await page.getByRole('button', { name: 'Pošlji predlog' }).click();
    await expect(page.getByTestId('additional-correction-intent')).toHaveAttribute('aria-invalid', 'true');
    await expect(page.getByRole('alert')).toContainText('Vrsta dopolnitve');
    await page.getByTestId('additional-correction-intent').selectOption('correcting');
    await expect(page.getByTestId('additional-correction-intent')).not.toHaveAttribute('aria-invalid', 'true');
    await expect(page.getByRole('alert')).toContainText('Kontaktni e-naslov');
    await page.getByRole('textbox', { name: 'Kontaktni e-naslov' }).fill('test@example.com');
    await expect(page.getByRole('alert')).toBeHidden();
    await page.getByRole('button', { name: 'Pošlji predlog' }).click();

    await expect.poll(() => form.getSubmissions()).toBe(1);
    const payload = form.getPayload();
    expect(payload?.get(contract.fields.proposalType)).toBe('Popravek obstoječega vnosa v koledarju');
    expect(payload?.get(contract.fields.date)).toBe('2026-09-12');
    expect(payload?.get(contract.fields.title)).toBe('Tek z dodatnimi podatki');
    const normalizeLineEndings = (value: string | null | undefined) => value?.replace(/\r\n?/g, '\n') ?? null;
    const description = normalizeLineEndings(payload?.get(contract.fields.description));
    expect(description).toContain('Izbrane vrste sprememb: Datum ali ura');
    expect(description).toContain('Datum naj bo 13. 9. 2026.');
    expect(description).toContain('Najnižja prijavnina: 20');
    expect(description).toContain('Najvišja prijavnina: 25');
    expect(description).toContain('Opis prijavnine: Cena je odvisna od razdalje.');
    expect(payload?.getAll(contract.fields.additionalData)).toEqual(['Prijavnina / startnina', 'Popravek napačnega dodatnega podatka']);
    expect(payload?.get(contract.fields.place)).toBe('Kranj');
    expect(payload?.get(contract.fields.region)).toBe('Gorenjska');
    expect(payload?.get(contract.fields.organizer)).toBe('Ne');
    expect(payload?.get(contract.fields.officialAnnouncement2026)).toBe('Ne vem');
  });


  test('fallback URL and direct POST use equivalent canonical business values', async ({ page }) => {
    const form = await interceptForm(page);
    await page.goto('/dodaj-ali-popravi-tek/');
    await waitForProposalRuntime(page);
    await enterSlovenianManualCorrectionMode(page);
    await page.locator('#proposal-date').fill('2026-09-12');
    await page.getByRole('textbox', { name: 'Naziv prireditve' }).fill('Tek za pariteto');
    await page.getByRole('textbox', { name: 'Kraj', exact: true }).fill('Kranj');
    await page.getByRole('combobox', { name: 'Regija' }).selectOption('Gorenjska');
    await page.locator('#proposal-source').fill('https://example.com/vir');
    await page.getByTestId('additional-entry-fee-min').fill('20');
    await page.getByTestId('additional-route-url').fill('ftp://example.com/trasa');
    await page.getByRole('button', { name: 'Pošlji predlog' }).click();
    await expect(page.locator('#proposal-route-error')).toBeVisible();
    await expect.poll(() => form.getSubmissions()).toBe(0);
    await page.getByTestId('additional-route-url').fill('https://example.com/trasa');
    await expect(page.locator('#proposal-route-error')).toBeHidden();
    await page.getByTestId('additional-correction-intent').selectOption('correcting');
    await page.getByRole('combobox', { name: 'Ali ste organizator?' }).selectOption('Ne');
    await page.getByRole('combobox', { name: 'Ali je za izbrano leto že objavljen uradni razpis ali uradna objava?' }).selectOption('Ne vem');
    await page.getByRole('textbox', { name: 'Kontaktni e-naslov' }).fill('parity@example.com');
    const fallbackParams = new URL(await page.locator('[data-correction-form-link]').getAttribute('href') ?? '').searchParams;
    await page.getByRole('button', { name: 'Pošlji predlog' }).click();
    await expect.poll(() => form.getSubmissions()).toBe(1);
    const payload = form.getPayload();
    const normalizeLineEndings = (value: string | null | undefined) => value?.replace(/\r\n?/g, '\n') ?? null;
    for (const field of [contract.fields.proposalType, contract.fields.date, contract.fields.dateYear, contract.fields.dateMonth, contract.fields.dateDay, contract.fields.title, contract.fields.place, contract.fields.region, contract.fields.officialSource, contract.fields.organizer, contract.fields.officialAnnouncement2026, contract.fields.email]) {
      expect(payload?.get(field)).toBe(fallbackParams.get(field));
    }
    expect(normalizeLineEndings(payload?.get(contract.fields.description))).toBe(normalizeLineEndings(fallbackParams.get(contract.fields.description)));
    expect(payload?.getAll(contract.fields.additionalData)).toEqual(fallbackParams.getAll(contract.fields.additionalData));
    expect(fallbackParams.get('usp')).toBe('pp_url');
  });

  test('reset clears structured additional fields', async ({ page }) => {
    await page.goto('/dodaj-ali-popravi-tek/');
    await waitForProposalRuntime(page);
    await enterSlovenianManualCorrectionMode(page);
    await page.getByTestId('additional-entry-fee-min').fill('20');
    await page.getByTestId('additional-entry-fee-max').fill('25');
    await page.getByTestId('additional-entry-fee-description').fill('Različne razdalje');
    await page.getByTestId('additional-registration-deadline').fill('2026-08-10');
    await page.getByTestId('additional-race-day-registration').selectOption('Da');
    await page.getByTestId('additional-elevation').fill('650');
    await page.getByTestId('additional-route-url').fill('https://example.com/trasa');
    await page.getByTestId('additional-other').fill('Drugo besedilo');
    await page.getByTestId('additional-correction-intent').selectOption('missing');
    await page.getByRole('button', { name: 'Počisti obrazec' }).click();
    await expect(page.getByTestId('additional-entry-fee-min')).toHaveValue('');
    await expect(page.getByTestId('additional-entry-fee-max')).toHaveValue('');
    await expect(page.getByTestId('additional-entry-fee-description')).toHaveValue('');
    await expect(page.getByTestId('additional-registration-deadline')).toHaveValue('');
    await expect(page.getByTestId('additional-race-day-registration')).toHaveValue('');
    await expect(page.getByTestId('additional-elevation')).toHaveValue('');
    await expect(page.getByTestId('additional-route-url')).toHaveValue('');
    await expect(page.getByTestId('additional-other')).toHaveValue('');
    await expect(page.getByTestId('additional-correction-intent')).toHaveValue('');
  });

  test('Other shows only relevant fields and posts exact payload without hidden blockers', async ({ page }) => {
    const form = await interceptForm(page);
    await page.goto('/dodaj-ali-popravi-tek/');
    await waitForProposalRuntime(page);
    await page.getByRole('link', { name: 'Drugo vprašanje ali sporočilo' }).click();
    await waitForProposalRuntime(page);
    for (const selector of ['#proposal-date', '#proposal-title', '#proposal-place', '#proposal-region', '[data-additional-section]', '[data-field-row="announcement"]']) await expect(page.locator(selector)).toBeHidden();
    await expect(page.getByRole('combobox', { name: 'Ali ste organizator?' })).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Uradni vir (neobvezno)', exact: true })).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Opis oziroma podrobnosti' })).toHaveAttribute('required', '');
    await expect(page.locator('#proposal-description')).toHaveAttribute('placeholder', 'Napišite sporočilo ali pojasnite predlog.');
    await expect(page.getByRole('textbox', { name: 'Kontaktni e-naslov' })).toHaveAttribute('required', '');
    await page.locator('#proposal-source').fill('https://example.com/drugo');
    await page.getByRole('combobox', { name: 'Ali ste organizator?' }).selectOption('Ne');
    await page.getByRole('textbox', { name: 'Opis oziroma podrobnosti' }).fill('Splošno vprašanje o koledarju.');
    await page.getByRole('textbox', { name: 'Kontaktni e-naslov' }).fill('other@example.com');
    await page.getByRole('button', { name: 'Pošlji predlog' }).click();
    await expect.poll(() => form.getSubmissions()).toBe(1);
    const payload = form.getPayload();
    expect(payload?.get(contract.fields.proposalType)).toBe('Drugo');
    expect(payload?.get(contract.fields.description)).toBe('Splošno vprašanje o koledarju.');
    expect(payload?.get(contract.fields.email)).toBe('other@example.com');
    expect(payload?.get(contract.fields.date)).toBe('2026-01-01');
    expect(payload?.get(contract.fields.title)).toBe('Drugo');
    expect(payload?.get(contract.fields.place)).toBe('Ni navedeno');
    expect(payload?.get(contract.fields.region)).toBe(contract.values.regions.at(-1));
    expect(payload?.get(contract.fields.organizer)).toBe('Ne');
    expect(payload?.get(contract.fields.officialAnnouncement2026)).toBe('Ne vem');
  });


  test('selected race prefill does not create a false initial diff', async ({ page }) => {
    await page.goto(`/dodaj-ali-popravi-tek/?${zagorjeContextQuery}`);
    await waitForProposalRuntime(page);
    await expect(page.getByTestId('basic-correction-date')).toHaveValue('2026-08-01');
    await expect(page.getByTestId('basic-correction-title')).toHaveValue('21. Tek in pohod po Zagorski dolini');
    await expect(page.getByTestId('basic-correction-place')).toHaveValue('Zagorje ob Savi');
    await expect(page.getByTestId('basic-correction-region')).toHaveValue('Zasavska');
    await expect(page.getByTestId('basic-correction-start-time')).toHaveValue('18:00');
    await expect(page.getByTestId('basic-correction-distances')).toHaveValue('0,2 km · 0,3 km · 0,5 km · 1 km · 4,6 km · 7,5 km · 10,3 km');
    const surface = page.getByTestId('basic-correction-surface');
    await expect(surface).toHaveValue('cesta');
    await expect(surface.locator('option[value="cesta"]')).toHaveCount(1);
    await expect(surface.locator('option').filter({ hasText: /^Cesta$/ })).toHaveCount(1);
    await expect(surface.locator('option[value="Cesta"]')).toHaveCount(0);
    await expect(page.getByTestId('additional-entry-fee-min')).toHaveValue('15');
    await expect(page.getByTestId('additional-entry-fee-max')).toHaveValue('25');
    await expect(page.getByTestId('additional-entry-fee-description')).toHaveValue('Otroški teki');
    await expect(page.getByTestId('additional-registration-deadline')).toHaveValue('2026-08-01');
    await expect(page.getByTestId('additional-cheaper-registration')).toHaveValue('2026-07-27');
    await expect(page.getByTestId('additional-race-day-registration')).toHaveValue('Da');
    await expect(page.locator('[data-changed="true"]')).toHaveCount(0);
    await expect(page.locator('[data-change-summary] .change-chip')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Pošlji predlog' })).toBeVisible();

    const startTimeCard = page.locator('[data-basic-card="startTime"]');
    await page.getByTestId('basic-correction-start-time').fill('19:00');
    await expect(page.locator('[data-changed="true"]')).toHaveCount(1);
    await expect(page.locator('[data-change-summary] .change-chip')).toHaveCount(1);
    await expect(page.getByRole('button', { name: 'Pošlji spremembo' })).toBeVisible();
    await startTimeCard.getByRole('button', { name: 'Razveljavi' }).click();
    await expect(page.getByTestId('basic-correction-start-time')).toHaveValue('18:00');
    await expect(page.locator('[data-changed="true"]')).toHaveCount(0);
    await expect(page.locator('[data-change-summary] .change-chip')).toHaveCount(0);
  });

  test('context mode hides complete identity and uses compact structured correction fields', async ({ page }) => {
    const form = await interceptForm(page);
    await page.goto(`/dodaj-ali-popravi-tek/?${completeContextQuery}`);
    await waitForProposalRuntime(page);

    await expect(page.locator('.proposal-type-fieldset')).toBeHidden();
    await expect(page.locator('[data-context-existing-radio]')).toBeChecked();
    await expect(page.locator('[data-correction-context]')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Trenutno objavljeni podatki' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /Popravi|Dopolni|Dopolnite manjkajoče podatke/ })).toHaveCount(0);
    await expect(page.getByText('Dolgi Šmarnogorski tek').first()).toBeVisible();
    await expect(page.getByText('1. 5. 2027 · Ljubljana · Osrednjeslovenska')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Vnesite spremembe' })).toBeVisible();
    const correctionInstruction = page.getByText('Spremenite samo podatke, ki jih želite popraviti. Če obstoječo vrednost izbrišete, predlagate odstranitev tega podatka.', { exact: true });
    await expect(correctionInstruction).toBeVisible();
    await expect(correctionInstruction).toHaveCount(1);

    for (const selector of ['#proposal-date', '#proposal-title', '#proposal-place', '#proposal-region']) {
      await expect(page.locator(selector)).toBeHidden();
      await expect(page.locator(selector)).toBeEnabled();
    }
    await expect(page.locator('#proposal-date')).toHaveValue('2027-05-01');
    await expect(page.locator('#proposal-title')).toHaveValue('Dolgi Šmarnogorski tek');
    await expect(page.locator('#proposal-place')).toHaveValue('Ljubljana');
    await expect(page.locator('#proposal-region')).toHaveValue('Osrednjeslovenska');
    const descriptionInput = page.locator('#proposal-description');
    const descriptionRequiredMark = page.locator('[data-field-row="description"] [data-required-mark]');
    await expect(descriptionInput).toHaveValue('');
    await expect(descriptionRequiredMark).toBeVisible();
    await expect(descriptionInput).toHaveAttribute('required', '');
    await expect(page.getByText('Če ne spremenite nobenega zgornjega polja, tukaj opišite predlog. Sicer je pojasnilo neobvezno.')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Dodajte nov tek' })).toHaveAttribute('href', '/dodaj-ali-popravi-tek/?mode=new');

    await expect(page.getByTestId('structured-basic-section')).toBeVisible();
    await expect(page.getByTestId('basic-correction-date')).toHaveValue('2027-05-01');
    await expect(page.getByTestId('basic-correction-title')).toHaveValue('Dolgi Šmarnogorski tek');
    await expect(page.getByTestId('basic-correction-notice-url')).toHaveValue('https://example.com/razpis');
    await expect(page.getByTestId('basic-correction-date')).toHaveAttribute('data-original-value', '2027-05-01');
    await expect(page.getByTestId('basic-correction-date')).not.toHaveAttribute('data-changed', 'true');

    await expect(page.getByTestId('structured-additional-section')).not.toHaveAttribute('open', '');
    await expect(page.getByTestId('structured-additional-section').locator('summary')).toHaveText('Prijava, cena in trasa');
    await expect(page.getByTestId('additional-entry-fee-min')).toHaveValue('20');
    await expect(page.getByTestId('additional-entry-fee-max')).toHaveValue('25');
    const feeDescription = page.getByTestId('additional-entry-fee-description');
    expect(await feeDescription.evaluate((field) => field.tagName)).toBe('TEXTAREA');
    await expect(feeDescription).toHaveAttribute('rows', '3');
    await expect(page.getByTestId('additional-entry-fee-description')).toHaveValue('Različne razdalje');
    await expect(page.getByTestId('additional-registration-deadline')).toHaveValue('2027-04-20');
    await expect(page.getByTestId('additional-route-url')).toHaveValue('https://example.com/trasa');
    await expect(page.getByTestId('additional-entry-fee-min')).toHaveAttribute('data-original-value', '20');
    await expect(page.getByTestId('additional-correction-intent')).toBeHidden();
    await page.getByTestId('basic-correction-date').fill('2027-05-02');
    await expect(descriptionRequiredMark).toBeHidden();
    await expect(descriptionInput).not.toHaveAttribute('required', '');
    await expect(page.getByTestId('basic-correction-date')).toHaveAttribute('data-changed', 'true');
    const dateCard = page.locator('[data-basic-card="date"]');
    await expect(dateCard.getByText('Spremenjeno', { exact: true })).toBeVisible();
    await expect(page.locator('[data-change-summary]')).toContainText('Spremenjeni podatki (1)');
    await expect(page.getByRole('button', { name: 'Pošlji spremembo' })).toBeVisible();
    page.once('dialog', (dialog) => dialog.accept());
    await page.getByRole('button', { name: 'Počisti vnesene spremembe' }).click();
    await expect(page.getByTestId('basic-correction-date')).toHaveValue('2027-05-01');
    await expect(page.getByTestId('basic-correction-date')).not.toHaveAttribute('data-changed', 'true');
    await expect(dateCard).not.toHaveAttribute('data-changed');
    await expect(dateCard.getByText('Spremenjeno', { exact: true })).toBeHidden();
    await expect(dateCard.getByRole('button', { name: 'Razveljavi' })).toBeHidden();
    await expect(descriptionRequiredMark).toBeVisible();
    await expect(descriptionInput).toHaveAttribute('required', '');
    await expect(page.getByRole('button', { name: 'Pošlji predlog' })).toBeVisible();

    await expect(page.locator('[data-change-options-details]')).toBeHidden();
    await expect(page.locator('[data-context-other-option]')).toBeHidden();
    await expect(page.getByTestId('additional-correction-intent')).toBeHidden();

    await page.getByRole('button', { name: 'Pošlji predlog' }).click();
    await expect(page.getByRole('alert')).toContainText('Vnesite vsaj en popravek ali dopolnitev');
    await expect.poll(() => form.getSubmissions()).toBe(0);

    await descriptionInput.fill('Obstoječe besedilo ostane.');
    await page.getByTestId('basic-correction-date').fill('2027-05-02');
    await expect(descriptionRequiredMark).toBeHidden();
    await expect(descriptionInput).not.toHaveAttribute('required', '');
    const additionalDetails = page.getByTestId('structured-additional-section');
    await additionalDetails.locator('summary').click();
    await expect(additionalDetails).toHaveAttribute('open', '');
    await expect(page.getByTestId('additional-entry-fee-min')).toBeVisible();
    await page.getByTestId('additional-entry-fee-min').fill('25');
    await page.getByTestId('additional-route-url').fill('');
    await expect(page.getByTestId('additional-route-url')).toHaveAttribute('data-changed', 'true');
    await expect(page.getByTestId('structured-additional-section')).toHaveAttribute('open', '');
    const submitChangesButton = page.getByRole('button', { name: 'Pošlji 3 spremembe' });
    await expect(submitChangesButton).toBeVisible();
    await submitChangesButton.click();
    await expect(page.getByRole('alert')).not.toContainText('Vnesite vsaj en popravek ali dopolnitev');
    await expect(page.getByRole('alert')).toContainText('Ali ste organizator?');
    await expect(page.getByRole('alert')).toContainText('Kontaktni e-naslov');
    await expect.poll(() => form.getSubmissions()).toBe(0);

    await page.getByRole('combobox', { name: 'Ali ste organizator?' }).selectOption('Ne');
    await page.getByRole('combobox', { name: 'Ali je za izbrano leto že objavljen uradni razpis ali uradna objava?' }).selectOption('Da');
    await page.getByRole('textbox', { name: 'Kontaktni e-naslov' }).fill('context@example.com');
    await submitChangesButton.click();

    await expect.poll(() => form.getSubmissions()).toBe(1);
    const payload = form.getPayload();
    expect(payload?.get(contract.fields.proposalType)).toBe('Popravek obstoječega vnosa v koledarju');
    expect(payload?.get(contract.fields.date)).toBe('2027-05-01');
    expect(payload?.get(contract.fields.title)).toBe('Dolgi Šmarnogorski tek');
    expect(payload?.get(contract.fields.place)).toBe('Ljubljana');
    expect(payload?.get(contract.fields.region)).toBe('Osrednjeslovenska');
    const description = String(payload?.get(contract.fields.description) ?? '');
    expect(description).toContain('Trenutno: 2027-05-01');
    expect(description).toContain('Predlagano: 2027-05-02');
    expect(description).toContain('Obstoječe besedilo ostane.');
    expect(description).toContain('Najnižja prijavnina');
    expect(description).toContain('Trenutno: 20');
    expect(description).toContain('Predlagano: 25');
    expect(description).toContain('Trenutno: https://example.com/trasa');
    expect(description).toContain('Predlagano: ODSTRANI PODATEK');
    expect(payload?.getAll(contract.fields.additionalData)).toEqual(['Prijavnina / startnina', 'Trasa / zemljevid / GPX', 'Popravek napačnega dodatnega podatka']);
  });

  test('context changes preselect ignores invalid and keeps chips unique', async ({ page }) => {
    await page.goto(`/dodaj-ali-popravi-tek/?${fullContextQuery}&changes=basic-date-time,NEVELJAVNO,basic-date-time`);
    await waitForProposalRuntime(page);
    await expect(page.locator('[data-published-details]')).toHaveCount(0);
    await expect(page.getByTestId('basic-correction-date')).toBeVisible();
    await expect(page.getByTestId('basic-correction-date')).toHaveValue('2027-05-01');
    await expect(page.locator('input[name="proposal-change-category"][value="basic-date-time"]')).not.toBeChecked();
    await expect(page.locator('input[name="proposal-change-category"][value="Višinski metri"]')).toHaveCount(0);
    await expect(page.locator('[data-change-summary] .change-chip')).toHaveCount(0);
  });

  test('context generic entry is compact and does not show legacy basic groups', async ({ page }) => {
    await page.goto(`/dodaj-ali-popravi-tek/?${fullContextQuery}`);
    await waitForProposalRuntime(page);
    await expect(page.locator('[data-published-details]')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Dopolnite manjkajoče podatke' })).toHaveCount(0);
    await expect(page.locator('input[name="proposal-change-category"]:checked')).toHaveCount(0);
    await expect(page.getByTestId('basic-correction-notice-url')).toHaveValue('https://example.com/razpis');
    await expect(page.locator('[data-change-options-details]')).toBeHidden();
    await expect(page.locator('[data-context-other-option]')).toBeHidden();
    await expect(page.locator('input[name="proposal-change-category"]:visible')).toHaveCount(0);
  });

  test('general mode query parameter can preselect new or other without race context', async ({ page }) => {
    await page.goto('/dodaj-ali-popravi-tek/?mode=new');
    await waitForProposalRuntime(page);
    await expect(page.getByRole('radio', { name: 'Nov tek' })).toBeChecked();
    await expect(page.getByRole('textbox', { name: 'Opis teka in dodatne informacije', exact: true })).toBeVisible();
    await expect(page.locator('#proposal-description')).toHaveAttribute('placeholder', 'Npr. razdalje, čas starta, vrsta podlage, prijavnina in povezava za prijavo.');
    await expect(page.getByText('Navedite manjkajoči ali pravilen podatek.')).toHaveCount(0);
    await page.goto('/dodaj-ali-popravi-tek/?mode=other');
    await waitForProposalRuntime(page);
    await expect(page.locator('[data-context-other-radio]')).toBeChecked();
    await expect(page.locator('input[name="proposal-type-ui"]')).toHaveCount(4);
    await expect(page.getByRole('combobox', { name: 'Ali ste organizator?' })).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Kontaktni e-naslov' })).toBeVisible();
    for (const selector of ['#proposal-date', '#proposal-title', '#proposal-place', '#proposal-region', '[data-additional-section]', '[data-field-row="announcement"]']) await expect(page.locator(selector)).toBeHidden();
    await expect(page.locator('#proposal-description')).toHaveAttribute('placeholder', 'Napišite sporočilo ali pojasnite predlog.');
  });

  test('selected context omits old missing-details action when no conservative missing category exists', async ({ page }) => {
    await page.goto(`/dodaj-ali-popravi-tek/?${completeContextQuery}`);
    await waitForProposalRuntime(page);
    await expect(page.locator('[data-published-details]')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Dopolnite manjkajoče podatke' })).toHaveCount(0);
  });


  test('timeout keeps entered values and enables retry', async ({ page }) => {
    await page.addInitScript(() => {
      const nativeSetTimeout = window.setTimeout;
      window.setTimeout = ((handler: TimerHandler, timeout?: number, ...args: unknown[]) => {
        if (timeout === 12000) return nativeSetTimeout(handler, 0, ...args);
        return nativeSetTimeout(handler, timeout, ...args);
      }) as typeof window.setTimeout;
    });
    const form = await interceptForm(page, { responseMode: 'hang' });
    await page.goto('/dodaj-ali-popravi-tek/?mode=new');
    await waitForProposalRuntime(page);
    await page.locator('#proposal-date').fill('2026-09-12');
    await page.getByRole('textbox', { name: 'Naziv prireditve' }).fill('Tek po timeoutu');
    await page.getByRole('textbox', { name: 'Kraj', exact: true }).fill('Maribor');
    await page.getByRole('combobox', { name: 'Regija' }).selectOption('Podravska');
    await page.getByRole('textbox', { name: 'Opis teka in dodatne informacije', exact: true }).fill('Opis ostane.');
    await page.getByRole('combobox', { name: 'Ali ste organizator?' }).selectOption('Ne');
    await page.getByRole('combobox', { name: 'Ali je za izbrano leto že objavljen uradni razpis ali uradna objava?' }).selectOption('Da');
    await page.getByRole('textbox', { name: 'Kontaktni e-naslov' }).fill('timeout@example.com');
    await page.getByRole('button', { name: 'Pošlji predlog' }).click();
    await expect.poll(() => form.getSubmissions()).toBe(1);
    await expect(page.getByRole('alert')).toContainText('Predloga trenutno ni bilo mogoče poslati.');
    await expect(page.getByRole('button', { name: 'Pošlji predlog' })).toBeEnabled();
    await expect(page.getByRole('textbox', { name: 'Naziv prireditve' })).toHaveValue('Tek po timeoutu');
    await expect(page.getByRole('textbox', { name: 'Opis teka in dodatne informacije', exact: true })).toHaveValue('Opis ostane.');
    await expect(page.getByRole('textbox', { name: 'Kontaktni e-naslov' })).toHaveValue('timeout@example.com');
  });

  test('confirmation timeout restores the localized confirmation button label', async ({ page }) => {
    await page.addInitScript(() => {
      const nativeSetTimeout = window.setTimeout;
      window.setTimeout = ((handler: TimerHandler, timeout?: number, ...args: unknown[]) => timeout === 12000 ? nativeSetTimeout(handler, 0, ...args) : nativeSetTimeout(handler, timeout, ...args)) as typeof window.setTimeout;
    });
    const form = await interceptForm(page, { responseMode: 'hang' });
    await page.goto(`/dodaj-ali-popravi-tek/?mode=confirm&${completeContextQuery}`); await waitForProposalRuntime(page);
    await page.locator('#confirmation-organization').fill('ŠD Test'); await page.locator('#confirmation-email').fill('org@example.com'); await page.locator('#confirmation-statement').check();
    await page.getByRole('button', { name: 'Potrdite podatke' }).click(); await expect.poll(() => form.getSubmissions()).toBe(1);
    await expect(page.getByRole('alert')).toContainText('Predloga trenutno ni bilo mogoče poslati.');
    await expect(page.getByRole('button', { name: 'Potrdite podatke' })).toBeEnabled();
  });

  test('fallback analytics redacts prefilled values from target URL', async ({ page }) => {
    const analyticsPayloads: unknown[] = [];
    await page.route(analyticsEndpointPattern, async (route) => {
      const body = route.request().postData() ?? '';
      if (body) analyticsPayloads.push(JSON.parse(body));
      await route.fulfill({ status: 204, body: '' });
    });
    await page.goto('/dodaj-ali-popravi-tek/');
    await waitForProposalRuntime(page);
    await enterSlovenianManualCorrectionMode(page);
    await page.locator('#proposal-date').fill('2026-09-12');
    await page.getByRole('textbox', { name: 'Naziv prireditve' }).fill('Zasebni naslov teka');
    await page.getByRole('textbox', { name: 'Kraj', exact: true }).fill('Skrivni kraj');
    await page.getByRole('combobox', { name: 'Regija' }).selectOption('Podravska');
    await page.locator('#proposal-source').fill('https://example.com/skrivni-vir');
    await page.getByTestId('additional-entry-fee-min').fill('20');
    await page.getByTestId('additional-registration-deadline').fill('2026-08-10');
    await page.getByTestId('additional-route-url').fill('https://example.com/skrivna-trasa');
    await page.getByTestId('additional-other').fill('Zaseben strukturiran opis.');
    await page.getByTestId('additional-correction-intent').selectOption('missing');
    await page.getByRole('combobox', { name: 'Ali ste organizator?' }).selectOption('Ne');
    await page.getByRole('combobox', { name: 'Ali je za izbrano leto že objavljen uradni razpis ali uradna objava?' }).selectOption('Da');
    await page.getByRole('textbox', { name: 'Kontaktni e-naslov' }).fill('secret@example.com');
    await page.locator('[data-correction-form-link]').click();
    await expect.poll(() => analyticsPayloads.length).toBeGreaterThan(0);
    const fallbackEvent = analyticsPayloads.find((payload): payload is Record<string, string> => {
      if (!payload || typeof payload !== 'object') return false;
      const eventPayload = payload as Record<string, string>;
      return eventPayload.event_type === 'external_link_clicked' && eventPayload.action_type === 'google_form_click';
    });
    expect(fallbackEvent).toBeTruthy();
    expect(fallbackEvent?.target_url).toContain('/viewform');
    expect(fallbackEvent?.target_url).not.toContain('?');
    expect(fallbackEvent?.target_domain).toBe('');
    const serialized = JSON.stringify(analyticsPayloads);
    for (const sensitive of ['Zasebni naslov teka', 'Skrivni kraj', 'skrivni-vir', 'Skrivna prijavnina', 'Skrivni rok', 'skrivna-trasa', 'Zaseben strukturiran opis', 'secret@example.com', '2026-09-12', 'entry.', 'usp=']) {
      expect(serialized).not.toContain(sensitive);
    }
  });

  test('unsafe returnUrl is not rendered', async ({ page }) => {
    await page.goto('/dodaj-ali-popravi-tek/?event=Tek&source=detail&returnUrl=https://evil.test/&date=2026-02-02&place=Kraj');
    await waitForProposalRuntime(page);
    await expect(page.getByRole('link', { name: 'Nazaj na stran teka' })).toHaveCount(0);
    await expect(page.locator('#proposal-source')).toHaveValue('');
  });
});
