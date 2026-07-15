import { expect, test, type Page } from '@playwright/test';
import { googleProposalFormContract } from '../../src/proposal-form/proposal-form-contract';

const contract = googleProposalFormContract;
const correctionQuery = 'event=Dolgi%20%C5%A0marnogorski%20tek&year=2027&date=2027-05-01&place=Ljubljana&region=Osrednjeslovenska&source=https%3A%2F%2Fexample.com%2Fzelo-dolg-url%2Frazpis&returnUrl=%2Ftek%2F2027%2Fdolgi-tek%2F&lang=sl';
const fullContextQuery = 'event=Dolgi%20%C5%A0marnogorski%20tek&year=2027&date=2027-05-01&place=Ljubljana&region=Osrednjeslovenska&eventKey=2027-dolgi-smarnogorski-tek&context=detail&source=detail&returnUrl=%2Ftek%2F2027%2Fdolgi-tek%2F&startTime=10%3A00&distances=10%20km%3B%2021%20km&noticeUrl=https%3A%2F%2Fexample.com%2Frazpis&surface=asfalt&cup=Pokal%20STK&elevationGain=650';
const completeContextQuery = `${fullContextQuery}&registrationFee=20%20EUR&registrationDeadline=2027-04-20&earlyRegistrationDeadline=2027-04-01&dayOfRegistration=Da&registrationUrl=https%3A%2F%2Fexample.com%2Fprijava&routeUrl=https%3A%2F%2Fexample.com%2Ftrasa`;

type InterceptedForm = { getPayloads: () => URLSearchParams[]; getPayload: () => URLSearchParams | undefined; getSubmissions: () => number; getUrls: () => string[]; getDirectPosts: () => number };

async function interceptForm(page: Page): Promise<InterceptedForm> {
  const urls: string[] = [];
  const directPosts: string[] = [];
  await page.route(`${contract.viewUrl}**`, async (route) => {
    urls.push(route.request().url());
    await route.fulfill({ status: 200, contentType: 'text/html', body: '<html><title>Google form</title><body>Google form</body></html>' });
  });
  await page.route(contract.responseUrl, async (route) => {
    directPosts.push(route.request().url());
    await route.abort();
  });
  return {
    getPayloads: () => urls.map((url) => new URL(url).searchParams),
    getPayload: () => urls.at(-1) ? new URL(urls.at(-1)!).searchParams : undefined,
    getSubmissions: () => urls.length,
    getUrls: () => urls,
    getDirectPosts: () => directPosts.length
  };
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

test.describe('native proposal form', () => {
  test('SL new race URL helpers, hidden links, exact payload, mobile and no console errors', async ({ page }) => {
    const errors = collectConsoleErrors(page);
    const form = await interceptForm(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/dodaj-ali-popravi-tek/');
    await waitForProposalRuntime(page);

    await expect(page.getByText('Predlog za nov tek, popravek ali dopolnitev podatkov se pred objavo pregleda in preveri.')).toBeVisible();
    await expect(page.getByText('Predlog se ne objavi samodejno.')).toBeVisible();
    await expect(page.getByText('Po preverjanju podatkov se bo odprl Google obrazec')).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Uradni vir (neobvezno)', exact: true })).toBeVisible();
    await expect(page.locator('#proposal-source')).not.toHaveAttribute('required', '');
    await expect(page.getByRole('textbox', { name: /Povezava do razpisa/ })).toHaveCount(0);

    await page.getByRole('radio', { name: 'Nov tek' }).check();
    await expect(page.getByRole('textbox', { name: 'Dodatni podatki o teku' })).toBeVisible();
    await expect(page.locator('#proposal-description')).toHaveAttribute('placeholder', 'Npr. razdalje, čas starta, vrsta podlage, prijavnina in povezava za prijavo.');
    await expect(page.getByText('Dodajte podatke, ki še niso zajeti v zgornjih poljih.')).toBeVisible();
    await expect(page.getByText('Navedite manjkajoči ali pravilen podatek.')).toHaveCount(0);
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
    await expect(page.getByText('Vnesite celoten spletni naslov')).toBeVisible();
    await expect(page.locator('#proposal-source')).toHaveAttribute('aria-invalid', 'true');
    await page.locator('#proposal-source').fill('https://example.com/razpis/2026?zelo=dolg-url');
    await expect(page.getByText('Vnesite celoten spletni naslov')).toBeHidden();
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
    await page.getByRole('textbox', { name: 'Dodatni podatki o teku' }).fill('Razdalje 10 km in 21 km, start ob 10.00.');
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
    expect(payload?.get(contract.fields.description)).toBe('Razdalje 10 km in 21 km, start ob 10.00.');
    expect(payload?.get(contract.fields.organizer)).toBe('Ne');
    expect(payload?.get(contract.fields.officialAnnouncement2026)).toBe('Da');
    expect(payload?.get(contract.fields.email)).toBe('test@example.com');
    expect(form.getUrls().at(-1)).toContain('/viewform');
    expect(payload?.get('usp')).toBe('pp_url');
    expect(form.getDirectPosts()).toBe(0);
    await assertNoConsoleErrors(page, errors);
  });



  test('new race with empty date blocks submission before Google POST', async ({ page }) => {
    const form = await interceptForm(page);
    await page.goto('/dodaj-ali-popravi-tek/?mode=new');
    await waitForProposalRuntime(page);
    await page.getByRole('textbox', { name: 'Naziv prireditve' }).fill('dfdfg');
    await page.getByRole('textbox', { name: 'Kraj', exact: true }).fill('Maribor');
    await page.getByRole('combobox', { name: 'Regija' }).selectOption('Podravska');
    await page.locator('#proposal-source').fill('https://example.com/razpis');
    await page.getByRole('textbox', { name: 'Dodatni podatki o teku' }).fill('Razdalje 5 km.');
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

  test('valid new race opens prefilled Google Form URL once including date parts', async ({ page }) => {
    const form = await interceptForm(page);
    await page.goto('/dodaj-ali-popravi-tek/?mode=new');
    await waitForProposalRuntime(page);
    await page.locator('#proposal-date').fill('2026-09-12');
    await page.getByRole('textbox', { name: 'Naziv prireditve' }).fill('Štajerski ultra tek');
    await page.getByRole('textbox', { name: 'Kraj', exact: true }).fill('Maribor');
    await page.getByRole('combobox', { name: 'Regija' }).selectOption('Podravska');
    await page.locator('#proposal-source').fill('https://example.com/razpis');
    await page.getByRole('textbox', { name: 'Dodatni podatki o teku' }).fill('Razdalje 10 km in 21 km.');
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
    await page.getByRole('textbox', { name: 'Dodatni podatki o teku' }).fill('Opis teka brez uradnega vira.');
    await page.getByRole('combobox', { name: 'Ali ste organizator?' }).selectOption('Ne');
    await page.getByRole('combobox', { name: 'Ali je za izbrano leto že objavljen uradni razpis ali uradna objava?' }).selectOption('Ne');
    await page.getByRole('textbox', { name: 'Kontaktni e-naslov' }).fill('test@example.com');
    await page.getByRole('button', { name: 'Pošlji predlog' }).click();

    await expect.poll(() => form.getSubmissions()).toBe(1);
    expect(form.getPayload()?.get(contract.fields.officialSource)).toBe('');

    await page.goto('/en/add-or-correct-race/?mode=new');
    await waitForProposalRuntime(page);
    await expect(page.getByRole('textbox', { name: 'Official source (optional)', exact: true })).toBeVisible();
    await expect(page.locator('#proposal-source')).not.toHaveAttribute('required', '');
  });

  test('native form has no hidden iframe submit target or direct formResponse dependency', async ({ page }) => {
    const form = await interceptForm(page);
    await page.goto('/dodaj-ali-popravi-tek/?mode=new');
    await waitForProposalRuntime(page);
    await expect(page.locator('[data-submit-target]')).toHaveCount(0);
    await expect(page.locator('[data-proposal-form]')).not.toHaveAttribute('target', 'proposal-form-target');
    await expect(page.locator('[data-proposal-form]')).toHaveAttribute('action', contract.viewUrl);
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
    await expect(page.getByRole('textbox', { name: 'Official source (optional)', exact: true })).toBeVisible();
    await expect(page.locator('#proposal-source')).toHaveValue('https://example.com/zelo-dolg-url/razpis');
    await expect(page.getByRole('textbox', { name: /Link to the race announcement/ })).toHaveCount(0);
    await expect(page.locator('[data-context-existing-radio]')).toBeChecked();
    await expect(page.locator('#proposal-date')).toBeHidden();
    await page.getByRole('group', { name: 'What would you like to correct or add?' }).getByText('Other correction options').click();
    await page.getByRole('checkbox', { name: 'Name or place', exact: true }).check();
    await page.getByRole('textbox', { name: 'Enter the missing or correct details' }).fill('Place should be Ljubljana Center.');
    await page.getByRole('combobox', { name: 'Are you the organizer?' }).selectOption('No');
    await page.getByRole('combobox', { name: 'Has the official announcement for the selected year already been published?' }).selectOption('I do not know');
    await page.getByRole('textbox', { name: 'Contact email' }).fill('review@example.com');
    page.once('dialog', async (dialog) => { expect(dialog.message()).toBe('Clear your changes and restore the selected race details?'); await dialog.dismiss(); });
    await page.getByRole('button', { name: 'Clear form' }).click();
    await expect(page.getByRole('textbox', { name: 'Enter the missing or correct details' })).toHaveValue('Place should be Ljubljana Center.');
    await page.getByRole('button', { name: 'Send proposal' }).click();

    await expect.poll(() => form.getPayload()?.get(contract.fields.proposalType)).toBe('Popravek obstoječega vnosa v koledarju');
    expect(form.getPayload()?.get(contract.fields.date)).toBe('2027-05-01');
    expect(form.getPayload()?.get(contract.fields.description)).toContain('Place should be Ljubljana Center.');
    expect(form.getUrls().at(-1)).toContain('/viewform');
    await assertNoConsoleErrors(page, errors);
  });

  test('combined existing change requires race identity, maps categories, and posts exact payload', async ({ page }) => {
    const form = await interceptForm(page);
    await page.goto('/dodaj-ali-popravi-tek/');
    await waitForProposalRuntime(page);
    await page.getByRole('radio', { name: 'Popravek ali dopolnitev obstoječega teka' }).check();
    await expect(page.getByText('Kaj želite popraviti ali dopolniti?')).toBeVisible();
    await expect(page.getByText('Označite vse podatke, ki jih želite dodati ali popraviti.')).toBeVisible();
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
    await expect(page.getByRole('checkbox', { name: 'Popravek že objavljenega dodatnega podatka', exact: true })).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Vnesite manjkajoče ali pravilne podatke' })).toHaveAttribute('placeholder', 'Navedite manjkajoči ali pravilen podatek.');
    const additionalBox = await page.locator('[data-additional-section]').boundingBox();
    const descriptionBox = await page.getByRole('textbox', { name: 'Vnesite manjkajoče ali pravilne podatke' }).boundingBox();
    expect(additionalBox && descriptionBox && additionalBox.y < descriptionBox.y).toBeTruthy();

    await page.getByRole('textbox', { name: 'Vnesite manjkajoče ali pravilne podatke' }).fill('Prijavnina 20 €.');
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
    await expect(page.getByRole('alert')).toContainText('Kaj želite popraviti ali dopolniti?');
    await expect(page.getByRole('checkbox', { name: 'Prijavnina / startnina', exact: true })).toHaveAttribute('aria-invalid', 'true');
    await page.getByRole('checkbox', { name: 'Prijavnina / startnina', exact: true }).check();
    await expect(page.getByRole('checkbox', { name: 'Prijavnina / startnina', exact: true })).not.toHaveAttribute('aria-invalid', 'true');
    await expect(page.getByRole('alert')).toContainText('Kontaktni e-naslov');
    await expect(page.getByRole('alert')).not.toContainText('Kaj želite popraviti ali dopolniti?');
    await page.getByRole('textbox', { name: 'Kontaktni e-naslov' }).fill('test@example.com');
    await expect(page.getByRole('alert')).toBeHidden();
    await page.getByRole('checkbox', { name: 'Popravek že objavljenega dodatnega podatka', exact: true }).check();
    await page.getByRole('button', { name: 'Pošlji predlog' }).click();

    await expect.poll(() => form.getSubmissions()).toBe(1);
    const payload = form.getPayload();
    expect(payload?.get(contract.fields.proposalType)).toBe('Dopolnitev dodatnih podatkov obstoječega teka');
    expect(payload?.get(contract.fields.date)).toBe('2026-09-12');
    expect(payload?.get(contract.fields.title)).toBe('Tek z dodatnimi podatki');
    expect(payload?.get(contract.fields.description)).toContain('Izbrane vrste sprememb: Prijavnina / startnina; Popravek že objavljenega dodatnega podatka');
    expect(payload?.get(contract.fields.description)).toContain('Prijavnina 20 €.');
    expect(payload?.getAll(contract.fields.additionalData)).toEqual(['Prijavnina / startnina', 'Popravek napačnega dodatnega podatka']);
    expect(payload?.get(contract.fields.place)).toBe('Kranj');
    expect(payload?.get(contract.fields.region)).toBe('Gorenjska');
    expect(payload?.get(contract.fields.organizer)).toBe('Ne');
    expect(payload?.get(contract.fields.officialAnnouncement2026)).toBe('Ne vem');
  });

  test('Other shows only relevant fields and posts exact payload without hidden blockers', async ({ page }) => {
    const form = await interceptForm(page);
    await page.goto('/dodaj-ali-popravi-tek/');
    await waitForProposalRuntime(page);
    await page.getByRole('radio', { name: 'Drugo', exact: true }).check();
    await expect(page.locator('#proposal-date')).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Naziv prireditve' })).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Kraj', exact: true })).toBeVisible();
    await expect(page.getByRole('combobox', { name: 'Regija' })).toBeVisible();
    await expect(page.getByRole('combobox', { name: 'Ali ste organizator?' })).toBeVisible();
    await expect(page.getByRole('combobox', { name: 'Ali je za izbrano leto že objavljen uradni razpis ali uradna objava?' })).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Uradni vir (neobvezno)', exact: true })).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Opis oziroma podrobnosti' })).toHaveAttribute('required', '');
    await expect(page.locator('#proposal-description')).toHaveAttribute('placeholder', 'Napišite sporočilo ali pojasnite predlog.');
    await expect(page.getByRole('textbox', { name: 'Kontaktni e-naslov' })).toHaveAttribute('required', '');
    await page.locator('#proposal-date').fill('2026-10-10');
    await page.getByRole('textbox', { name: 'Naziv prireditve' }).fill('Drugo vprašanje');
    await page.getByRole('textbox', { name: 'Kraj', exact: true }).fill('Celje');
    await page.getByRole('combobox', { name: 'Regija' }).selectOption('Savinjska');
    await page.locator('#proposal-source').fill('https://example.com/drugo');
    await page.getByRole('combobox', { name: 'Ali ste organizator?' }).selectOption('Ne');
    await page.getByRole('combobox', { name: 'Ali je za izbrano leto že objavljen uradni razpis ali uradna objava?' }).selectOption('Ne vem');
    await page.getByRole('textbox', { name: 'Opis oziroma podrobnosti' }).fill('Splošno vprašanje o koledarju.');
    await page.getByRole('textbox', { name: 'Kontaktni e-naslov' }).fill('other@example.com');
    await page.getByRole('button', { name: 'Pošlji predlog' }).click();
    await expect.poll(() => form.getSubmissions()).toBe(1);
    const payload = form.getPayload();
    expect(payload?.get(contract.fields.proposalType)).toBe('Drugo');
    expect(payload?.get(contract.fields.description)).toBe('Splošno vprašanje o koledarju.');
    expect(payload?.get(contract.fields.email)).toBe('other@example.com');
    expect(payload?.get(contract.fields.date)).toBe('2026-10-10');
    expect(payload?.get(contract.fields.title)).toBe('Drugo vprašanje');
    expect(payload?.get(contract.fields.place)).toBe('Celje');
    expect(payload?.get(contract.fields.region)).toBe('Savinjska');
    expect(payload?.get(contract.fields.organizer)).toBe('Ne');
    expect(payload?.get(contract.fields.officialAnnouncement2026)).toBe('Ne vem');
  });


  test('context mode hides complete identity, supports field actions, changes preselect and payload', async ({ page }) => {
    const form = await interceptForm(page);
    await page.goto(`/dodaj-ali-popravi-tek/?${fullContextQuery}`);
    await waitForProposalRuntime(page);

    await expect(page.locator('.proposal-type-fieldset')).toBeHidden();
    await expect(page.locator('[data-context-existing-radio]')).toBeChecked();
    await expect(page.getByRole('heading', { name: 'Popravek ali dopolnitev za izbrani tek' }).first()).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Trenutno objavljeni podatki' })).toBeVisible();
    await expect(page.getByText('Dolgi Šmarnogorski tek').first()).toBeVisible();
    await expect(page.getByText('Osrednjeslovenska').first()).toBeVisible();
    await expect(page.getByText('Ni podatka').first()).toBeVisible();

    for (const selector of ['#proposal-date', '#proposal-title', '#proposal-place', '#proposal-region']) {
      await expect(page.locator(selector)).toBeHidden();
      await expect(page.locator(selector)).toBeEnabled();
    }
    await expect(page.locator('#proposal-date')).toHaveValue('2027-05-01');
    await expect(page.locator('#proposal-title')).toHaveValue('Dolgi Šmarnogorski tek');
    await expect(page.locator('#proposal-place')).toHaveValue('Ljubljana');
    await expect(page.locator('#proposal-region')).toHaveValue('Osrednjeslovenska');
    await expect(page.locator('#proposal-source')).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Uradni vir (neobvezno)', exact: true })).toBeVisible();
    await expect(page.locator('#proposal-source')).not.toHaveAttribute('required', '');
    await expect(page.locator('#proposal-source')).toHaveValue('https://example.com/razpis');
    await expect(page.locator('#proposal-description')).not.toHaveValue(/source=detail|Kontekst vira/);

    const advancedDetails = page.locator('[data-change-options-details]');
    await expect(advancedDetails).not.toHaveAttribute('open', '');
    await expect(page.locator('input[name="proposal-change-category"][value="Popravek napačnega dodatnega podatka"]')).not.toBeChecked();
    await advancedDetails.getByText('Druge možnosti popravka').click();
    await expect(advancedDetails).toHaveAttribute('open', '');
    await expect(page.getByRole('checkbox', { name: 'Popravek že objavljenega dodatnega podatka', exact: true })).toBeVisible();
    await advancedDetails.getByText('Druge možnosti popravka').click();
    await expect(advancedDetails).not.toHaveAttribute('open', '');

    await page.locator('#proposal-description').fill('Obstoječe besedilo ostane.');
    await page.locator('.published-detail-item', { hasText: 'Datum' }).getByRole('button', { name: 'Popravi' }).click();
    await expect(page.locator('input[name="proposal-change-category"][value="basic-date-time"]')).toBeChecked();
    await expect(page.locator('[data-change-summary] .change-chip')).toContainText(['Datum ali ura']);
    await expect(page.locator('#proposal-description')).toHaveValue('Obstoječe besedilo ostane.');

    await page.locator('.published-detail-item', { hasText: 'Prijavnina' }).getByRole('button', { name: 'Dopolni' }).click();
    await expect(page.locator('input[name="proposal-change-category"][value="Prijavnina / startnina"]')).toBeChecked();
    await expect(page.locator('[data-change-summary] .change-chip')).toContainText(['Datum ali ura', 'Prijavnina / startnina']);

    await page.getByRole('combobox', { name: 'Ali ste organizator?' }).selectOption('Ne');
    await page.getByRole('combobox', { name: 'Ali je za izbrano leto že objavljen uradni razpis ali uradna objava?' }).selectOption('Da');
    await page.getByRole('textbox', { name: 'Kontaktni e-naslov' }).fill('context@example.com');
    await page.getByRole('button', { name: 'Pošlji predlog' }).click();

    await expect.poll(() => form.getSubmissions()).toBe(1);
    const payload = form.getPayload();
    expect(payload?.get(contract.fields.proposalType)).toBe('Popravek obstoječega vnosa v koledarju');
    expect(payload?.get(contract.fields.date)).toBe('2027-05-01');
    expect(payload?.get(contract.fields.title)).toBe('Dolgi Šmarnogorski tek');
    expect(payload?.get(contract.fields.place)).toBe('Ljubljana');
    expect(payload?.get(contract.fields.region)).toBe('Osrednjeslovenska');
    expect(payload?.get(contract.fields.description)).not.toContain('Kontekst vira: detail');
    expect(payload?.getAll(contract.fields.additionalData)).toEqual(['Prijavnina / startnina']);
    await expect(page.locator('[data-error-summary]')).toBeHidden();
    expect(form.getUrls().at(-1)).toContain('/viewform');
  });

  test('context changes preselect ignores invalid and keeps chips unique', async ({ page }) => {
    await page.goto(`/dodaj-ali-popravi-tek/?${fullContextQuery}&changes=basic-date-time,Vi%C5%A1inski%20metri,NEVELJAVNO,basic-date-time`);
    await waitForProposalRuntime(page);
    await expect(page.locator('input[name="proposal-change-category"][value="basic-date-time"]')).toBeChecked();
    await expect(page.locator('input[name="proposal-change-category"][value="Višinski metri"]')).toBeChecked();
    await expect(page.locator('[data-change-summary] .change-chip')).toHaveText(['Datum ali ura', 'Višinski metri']);
    await expect(page.locator('[data-change-summary] .change-chip')).toHaveCount(2);
  });

  test('context generic entry does not auto-select every missing category and missing-details action is conservative', async ({ page }) => {
    await page.goto(`/dodaj-ali-popravi-tek/?${fullContextQuery}`);
    await waitForProposalRuntime(page);
    await expect(page.locator('input[name="proposal-change-category"]:checked')).toHaveCount(0);
    await page.getByRole('button', { name: 'Dopolnite manjkajoče podatke' }).click();
    await expect(page.locator('input[name="proposal-change-category"][value="Prijavnina / startnina"]')).toBeChecked();
    await expect(page.locator('input[name="proposal-change-category"][value="basic-official-source"]')).not.toBeChecked();
    const otherCheckbox = page.locator('input[name="proposal-change-category"][value="Drugo"]');
    const otherLabel = page.locator('label:has(input[name="proposal-change-category"][value="Drugo"])');
    const advancedDetails = page.locator('[data-change-options-details]');
    await expect(otherCheckbox).not.toBeChecked();
    await expect(advancedDetails).not.toHaveAttribute('open', '');
    await expect(otherLabel).toBeHidden();
    await advancedDetails.getByText('Druge možnosti popravka').click();
    await expect(otherLabel).toBeVisible();
    await expect(otherCheckbox).not.toBeChecked();
  });

  test('general mode query parameter can preselect new or other without race context', async ({ page }) => {
    await page.goto('/dodaj-ali-popravi-tek/?mode=new');
    await waitForProposalRuntime(page);
    await expect(page.getByRole('radio', { name: 'Nov tek' })).toBeChecked();
    await expect(page.getByRole('textbox', { name: 'Dodatni podatki o teku' })).toBeVisible();
    await expect(page.locator('#proposal-description')).toHaveAttribute('placeholder', 'Npr. razdalje, čas starta, vrsta podlage, prijavnina in povezava za prijavo.');
    await expect(page.getByText('Navedite manjkajoči ali pravilen podatek.')).toHaveCount(0);
    await page.goto('/dodaj-ali-popravi-tek/?mode=other');
    await waitForProposalRuntime(page);
    await expect(page.getByRole('radio', { name: 'Drugo', exact: true })).toBeChecked();
    await expect(page.locator('#proposal-description')).toHaveAttribute('placeholder', 'Napišite sporočilo ali pojasnite predlog.');
  });

  test('missing-details action is hidden when no conservative missing category exists', async ({ page }) => {
    await page.goto(`/dodaj-ali-popravi-tek/?${completeContextQuery}`);
    await waitForProposalRuntime(page);
    await expect(page.getByRole('button', { name: 'Dopolnite manjkajoče podatke' })).toBeHidden();
  });

  test('unsafe returnUrl is not rendered', async ({ page }) => {
    await page.goto('/dodaj-ali-popravi-tek/?event=Tek&source=detail&returnUrl=https://evil.test/&date=2026-02-02&place=Kraj');
    await waitForProposalRuntime(page);
    await expect(page.getByRole('link', { name: 'Nazaj na stran teka' })).toHaveCount(0);
    await expect(page.locator('#proposal-source')).toHaveValue('');
  });
});
