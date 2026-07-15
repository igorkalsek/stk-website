import { expect, test, type Page } from '@playwright/test';
import { googleProposalFormContract } from '../../src/proposal-form/proposal-form-contract';

const contract = googleProposalFormContract;
const correctionQuery = 'event=Dolgi%20%C5%A0marnogorski%20tek&year=2027&date=2027-05-01&place=Ljubljana&source=https%3A%2F%2Fexample.com%2Fzelo-dolg-url%2Frazpis&returnUrl=%2Ftek%2F2027%2Fdolgi-tek%2F&lang=sl';

type InterceptedForm = { getPayloads: () => URLSearchParams[]; getPayload: () => URLSearchParams | undefined; getSubmissions: () => number };

async function interceptForm(page: Page): Promise<InterceptedForm> {
  const payloads: URLSearchParams[] = [];
  await page.route(contract.responseUrl, async (route) => {
    payloads.push(new URLSearchParams(route.request().postData() ?? ''));
    await route.fulfill({ status: 200, contentType: 'text/html', body: '<html>ok</html>' });
  });
  return { getPayloads: () => payloads, getPayload: () => payloads.at(-1), getSubmissions: () => payloads.length };
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

test.describe('native proposal form', () => {
  test('SL new race URL helpers, hidden links, exact payload, mobile and no console errors', async ({ page }) => {
    const errors = collectConsoleErrors(page);
    const form = await interceptForm(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/dodaj-ali-popravi-tek/');

    await expect(page.getByText('Pošljite predlog za nov tek, popravek ali dopolnitev podatkov.')).toBeVisible();
    await expect(page.getByText('Predlog ne bo objavljen samodejno.')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Oddajte nov predlog' })).toBeHidden();
    await expect(page.getByRole('link', { name: 'Nazaj na koledar' })).toBeHidden();
    await expect(page.getByRole('textbox', { name: 'Uradni vir', exact: true })).toBeVisible();
    await expect(page.getByRole('textbox', { name: /Povezava do razpisa/ })).toHaveCount(0);

    await page.getByRole('radio', { name: 'Nov tek' }).check();
    await expect(page.getByRole('textbox', { name: 'Dodatni podatki o teku' })).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Kraj', exact: true })).toHaveAttribute('required', '');
    await expect(page.locator('#proposal-date')).toHaveAttribute('required', '');
    await page.getByRole('textbox', { name: 'Uradni vir', exact: true }).fill('organizator.si/razpis');
    await page.getByRole('textbox', { name: 'Uradni vir', exact: true }).blur();
    await expect(page.getByRole('textbox', { name: 'Uradni vir', exact: true })).toHaveValue('https://organizator.si/razpis');
    await page.getByRole('textbox', { name: 'Uradni vir', exact: true }).fill('https://tekaski-koledar.si/dodaj-ali-popravi-tek/');
    await page.getByRole('textbox', { name: 'Uradni vir', exact: true }).blur();
    await expect(page.getByText('To je povezava na Slovenski Tekaški Koledar')).toBeVisible();
    await page.getByRole('textbox', { name: 'Uradni vir', exact: true }).fill('notaurl://bad');
    await page.getByRole('button', { name: 'Pošlji predlog' }).click();
    await expect(page.getByText('Vnesite celoten spletni naslov')).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Uradni vir', exact: true })).toHaveAttribute('aria-invalid', 'true');
    await page.getByRole('textbox', { name: 'Uradni vir', exact: true }).fill('https://example.com/razpis/2026?zelo=dolg-url');
    await expect(page.getByText('Vnesite celoten spletni naslov')).toBeHidden();
    await expect(page.getByRole('textbox', { name: 'Uradni vir', exact: true })).not.toHaveAttribute('aria-invalid', 'true');

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
    await expect(page.locator('[data-submit-status]')).toContainText('Oddaja je bila poslana.');
    await expect(page.getByRole('button', { name: 'Pošlji predlog' })).toBeHidden();
    await expect(page.getByRole('link', { name: 'Oddajte nov predlog' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Nazaj na koledar' })).toBeVisible();
    await page.locator('[data-proposal-form]').evaluate((formElement: HTMLFormElement) => formElement.requestSubmit());
    await expect.poll(() => form.getSubmissions()).toBe(1);
    await expect(page.getByRole('link', { name: 'Imate težave z oddajo? Odprite rezervni obrazec.' })).toHaveAttribute('data-analytics-link-type', 'correction_form');
    await assertNoConsoleErrors(page, errors);
  });

  test('EN prefilled correction keeps safe return URL, accessible names and reset cancel on desktop', async ({ page }) => {
    const errors = collectConsoleErrors(page);
    const form = await interceptForm(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`/en/add-or-correct-race/?${correctionQuery.replace('lang=sl','lang=en')}`);

    await expect(page.getByText('Send a proposal for a new race')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Back to race page' })).toHaveAttribute('href', '/tek/2027/dolgi-tek/');
    await expect(page.getByRole('textbox', { name: 'Official source', exact: true })).toHaveValue('https://example.com/zelo-dolg-url/razpis');
    await expect(page.getByRole('textbox', { name: /Link to the race announcement/ })).toHaveCount(0);
    await expect(page.getByRole('radio', { name: 'Correct or add details to an existing race' })).toBeChecked();
    await expect(page.locator('#proposal-date')).not.toHaveAttribute('required', '');
    await page.getByRole('checkbox', { name: 'Name or place', exact: true }).check();
    await page.getByRole('textbox', { name: 'Enter the missing or correct details' }).fill('Place should be Ljubljana Center.');
    await page.getByRole('combobox', { name: 'Region' }).selectOption('I do not know / I am not sure (I will explain in the description)');
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
    await expect(page.locator('[data-submit-status]')).toContainText('The submission was sent.');
    await assertNoConsoleErrors(page, errors);
  });

  test('combined existing change requires race identity, maps categories, and posts exact payload', async ({ page }) => {
    const form = await interceptForm(page);
    await page.goto('/dodaj-ali-popravi-tek/');
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
    await expect(page.getByRole('textbox', { name: 'Uradni vir', exact: true })).toBeVisible();
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
    await page.getByRole('textbox', { name: 'Uradni vir', exact: true }).fill('https://example.com/vir');
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
    await page.getByRole('radio', { name: 'Drugo', exact: true }).check();
    await expect(page.locator('#proposal-date')).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Naziv prireditve' })).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Kraj', exact: true })).toBeVisible();
    await expect(page.getByRole('combobox', { name: 'Regija' })).toBeVisible();
    await expect(page.getByRole('combobox', { name: 'Ali ste organizator?' })).toBeVisible();
    await expect(page.getByRole('combobox', { name: 'Ali je za izbrano leto že objavljen uradni razpis ali uradna objava?' })).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Uradni vir', exact: true })).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Opis oziroma podrobnosti' })).toHaveAttribute('required', '');
    await expect(page.getByRole('textbox', { name: 'Kontaktni e-naslov' })).toHaveAttribute('required', '');
    await page.locator('#proposal-date').fill('2026-10-10');
    await page.getByRole('textbox', { name: 'Naziv prireditve' }).fill('Drugo vprašanje');
    await page.getByRole('textbox', { name: 'Kraj', exact: true }).fill('Celje');
    await page.getByRole('combobox', { name: 'Regija' }).selectOption('Savinjska');
    await page.getByRole('textbox', { name: 'Uradni vir', exact: true }).fill('https://example.com/drugo');
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

  test('unsafe returnUrl is not rendered', async ({ page }) => {
    await page.goto('/dodaj-ali-popravi-tek/?event=Tek&source=detail&returnUrl=https://evil.test/&date=2026-02-02&place=Kraj');
    await expect(page.getByRole('link', { name: 'Nazaj na stran teka' })).toHaveCount(0);
    await expect(page.getByRole('textbox', { name: 'Uradni vir', exact: true })).toHaveValue('');
  });
});
