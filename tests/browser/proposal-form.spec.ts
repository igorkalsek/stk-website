import { expect, test, type Page } from '@playwright/test';
import { googleProposalFormContract } from '../../src/proposal-form/proposal-form-contract';

const contract = googleProposalFormContract;
const correctionQuery = 'event=Dolgi%20%C5%A0marnogorski%20tek&year=2027&date=2027-05-01&place=Ljubljana&source=https%3A%2F%2Fexample.com%2Fzelo-dolg-url%2Frazpis&returnUrl=%2Ftek%2F2027%2Fdolgi-tek%2F&lang=sl';

async function interceptForm(page: Page) {
  let payload: URLSearchParams | undefined;
  let submissions = 0;
  await page.route(contract.responseUrl, async (route) => {
    submissions += 1;
    payload = new URLSearchParams(route.request().postData() ?? '');
    await route.fulfill({ status: 200, contentType: 'text/html', body: '<html>ok</html>' });
  });
  return { getPayload: () => payload, getSubmissions: () => submissions };
}

test.describe('native proposal form', () => {
  test('SL validation, URL helpers, valid new race, mobile and no console errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
    const form = await interceptForm(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/dodaj-ali-popravi-tek/');
    await expect(page.getByText('Pošljite predlog za nov tek, popravek ali dopolnitev podatkov.')).toBeVisible();
    await expect(page.getByText('Predlog ne bo objavljen samodejno.')).toBeVisible();
    await page.getByRole('button', { name: 'Pošlji predlog' }).click();
    await expect(page.getByRole('alert')).toContainText('Tip predloga');
    await page.getByLabel('Nov tek').check();
    await expect(page.getByLabel(/Dodatni podatki o teku/)).toBeVisible();
    await expect(page.getByLabel(/Datum/)).toHaveAttribute('required', '');
    await page.getByLabel(/Uradni vir/).fill('organizator.si/razpis');
    await page.getByLabel(/Uradni vir/).blur();
    await expect(page.getByLabel(/Uradni vir/)).toHaveValue('https://organizator.si/razpis');
    await page.getByLabel(/Uradni vir/).fill('https://tekaski-koledar.si/dodaj-ali-popravi-tek/');
    await page.getByLabel(/Uradni vir/).blur();
    await expect(page.getByText('To je povezava na Slovenski Tekaški Koledar')).toBeVisible();
    await page.getByLabel(/Uradni vir/).fill('notaurl://bad');
    await page.getByRole('button', { name: 'Pošlji predlog' }).click();
    await expect(page.getByText('Vnesite celoten spletni naslov')).toBeVisible();
    await page.getByLabel(/Datum/).fill('2026-09-12');
    await page.getByLabel(/Naziv prireditve/).fill('Štajerski ultra tek z zelo zelo dolgim nazivom');
    await page.getByLabel(/^Kraj/).fill('Maribor');
    await page.getByLabel(/Regija/).selectOption('Podravska');
    await page.getByLabel(/Uradni vir/).fill('https://example.com/razpis/2026?zelo=dolg-url');
    await page.getByLabel(/Dodatni podatki o teku/).fill('Razdalje 10 km in 21 km, start ob 10.00.');
    await page.getByLabel(/organizator/).selectOption('Ne');
    await page.getByLabel(/uradni razpis/).selectOption('Da');
    await page.getByLabel(/Kontaktni/).fill('test@example.com');
    await page.getByRole('button', { name: 'Pošlji predlog' }).click();
    await expect.poll(() => form.getPayload()?.get(contract.fields.title)).toBe('Štajerski ultra tek z zelo zelo dolgim nazivom');
    expect(form.getPayload()?.get(contract.fields.email)).toBe('test@example.com');
    await expect(page.locator('[data-submit-status]')).toContainText('Hvala, predlog je bil poslan v pregled.');
    await expect(page.getByRole('button', { name: 'Pošlji predlog' })).toBeHidden();
    await expect(page.getByRole('link', { name: 'Oddajte nov predlog' })).toHaveAttribute('href', '/dodaj-ali-popravi-tek/');
    await expect(page.getByRole('link', { name: 'Nazaj na koledar' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Imate težave z oddajo? Odprite rezervni obrazec.' })).toHaveAttribute('data-analytics-link-type', 'correction_form');
    await expect.poll(() => form.getSubmissions()).toBe(1);
    expect(errors).toEqual([]);
  });

  test('EN page and prefilled correction keep safe return URL on desktop', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
    const form = await interceptForm(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`/en/add-or-correct-race/?${correctionQuery.replace('lang=sl','lang=en')}`);
    await expect(page.getByText('Send a proposal for a new race')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Back to race page' })).toHaveAttribute('href', '/tek/2027/dolgi-tek/');
    await expect(page.getByLabel(/Official source/)).toHaveValue('https://example.com/zelo-dolg-url/razpis');
    await expect(page.getByLabel('Correction of an existing race')).toBeChecked();
    await expect(page.getByLabel(/Date/)).not.toHaveAttribute('required', '');
    await page.getByLabel(/Contact email/).fill('review@example.com');
    await page.getByLabel(/What is wrong/).fill('Place should be Ljubljana Center.');
    await page.getByRole('button', { name: 'Send proposal' }).click();
    await expect.poll(() => form.getPayload()?.get(contract.fields.proposalType)).toBe('Popravek obstoječega vnosa v koledarju');
    expect(form.getPayload()?.get(contract.fields.date)).toBe('2027-05-01');
    await expect(page.locator('[data-submit-status]')).toContainText('Thank you, the proposal has been sent for review.');
    expect(errors).toEqual([]);
  });

  test('additional data and Other use conditional required fields', async ({ page }) => {
    await page.goto('/dodaj-ali-popravi-tek/');
    await page.getByLabel('Dopolnitev dodatnih podatkov').check();
    await expect(page.getByText('Kaj želite dopolniti?')).toBeVisible();
    await page.getByLabel(/Vrednosti in pojasnila/).fill('Prijavnina 20 €.');
    await page.getByLabel(/Kontaktni/).fill('test@example.com');
    await page.getByRole('button', { name: 'Pošlji predlog' }).click();
    await expect(page.getByRole('alert')).toContainText('Kaj želite dopolniti?');
    await page.getByLabel('Prijavnina / startnina').check();
    await page.getByLabel('Drugo').check();
    await expect(page.getByLabel(/Datum/)).toBeHidden();
    await expect(page.getByLabel(/Naziv prireditve/)).toBeHidden();
    await expect(page.getByLabel(/organizator/)).toBeHidden();
    await expect(page.getByLabel(/Opis oziroma podrobnosti/)).toBeVisible();
    await expect(page.getByLabel(/Opis oziroma podrobnosti/)).toHaveAttribute('required', '');
    await expect(page.getByLabel(/Kontaktni/)).toHaveAttribute('required', '');
  });

  test('unsafe returnUrl is not rendered', async ({ page }) => {
    await page.goto('/dodaj-ali-popravi-tek/?event=Tek&source=detail&returnUrl=https://evil.test/&date=2026-02-02&place=Kraj');
    await expect(page.getByRole('link', { name: 'Nazaj na stran teka' })).toHaveCount(0);
    await expect(page.getByLabel(/Uradni vir/)).toHaveValue('');
  });
});
