import { expect, test, type Page } from '@playwright/test';
import { googleProposalFormContract } from '../../src/proposal-form/proposal-form-contract';

const contract = googleProposalFormContract;
const correctionQuery = 'event=Dolgi%20%C5%A0marnogorski%20tek&year=2027&date=2027-05-01&place=Ljubljana&source=https%3A%2F%2Fexample.com%2Fzelo-dolg-url%2Frazpis&returnUrl=%2Ftek%2F2027%2Fdolgi-tek%2F&lang=sl';

async function interceptForm(page: Page) {
  let payload: URLSearchParams | undefined;
  await page.route(contract.responseUrl, async (route) => {
    payload = new URLSearchParams(route.request().postData() ?? '');
    await route.fulfill({ status: 200, contentType: 'text/html', body: '<html>ok</html>' });
  });
  return () => payload;
}

test.describe('native proposal form', () => {
  test('SL empty validation, valid new race, mobile and no console errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
    const getPayload = await interceptForm(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/dodaj-ali-popravi-tek/');
    await expect(page.getByRole('heading', { name: 'Dodajte ali popravite tek' })).toBeVisible();
    await expect(page.getByLabel(/Opis/)).toHaveValue('');
    await expect(page.getByRole('button', { name: 'Pošlji predlog' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Počisti obrazec' })).toBeVisible();
    await page.getByRole('button', { name: 'Pošlji predlog' }).click();
    await expect(page.getByRole('alert')).toContainText('Tip predloga');
    await expect(page.getByRole('alert')).toContainText('Datum');
    await expect(page.getByRole('alert')).toContainText('Kontaktni e-naslov');
    await page.getByLabel('Nov tek').check();
    await page.getByLabel(/Datum/).fill('2026-09-12');
    await page.getByLabel(/Naziv prireditve/).fill('Štajerski ultra tek z zelo zelo dolgim nazivom');
    await page.getByLabel(/^Kraj/).fill('Maribor');
    await page.getByLabel(/Regija/).selectOption('Podravska');
    await page.getByLabel(/Povezava/).fill('https://example.com/razpis/2026?zelo=dolg-url');
    await page.getByLabel(/Opis/).fill('Daljši opis predloga z razdaljami, slovenskimi znaki čšž in podrobnostmi.');
    await page.getByLabel(/organizator/).selectOption('Ne');
    await page.getByLabel(/uradni razpis/).selectOption('Da');
    await page.getByLabel(/Kontaktni/).fill('test@example.com');
    await page.getByLabel('Trasa / zemljevid / GPX').check();
    await page.getByRole('button', { name: 'Pošlji predlog' }).click();
    await expect.poll(() => getPayload()?.get(contract.fields.title)).toBe('Štajerski ultra tek z zelo zelo dolgim nazivom');
    expect(getPayload()?.get(contract.fields.email)).toBe('test@example.com');
    expect(getPayload()?.get(contract.fields.additionalData)).toBe('Trasa / zemljevid / GPX');
    await expect(page.locator('[data-submit-status]')).toContainText('poslana obstoječemu Google Forms');
    await expect(page.getByRole('link', { name: 'Oddajte nov predlog' })).toHaveAttribute('href', '/dodaj-ali-popravi-tek/');
    await expect(page.getByRole('link', { name: 'Odprite obrazec v Google Forms' })).toHaveAttribute('data-analytics-link-type', 'correction_form');
    expect(errors).toEqual([]);
  });

  test('EN page and prefilled correction keep safe return URL on desktop', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
    const getPayload = await interceptForm(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`/en/add-or-correct-race/?${correctionQuery.replace('lang=sl','lang=en')}`);
    await expect(page.getByRole('heading', { name: 'Add or correct a race' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Send proposal' })).toBeVisible();
    await expect(page.getByText('Selected race for correction')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Back to race page' })).toHaveAttribute('href', '/tek/2027/dolgi-tek/');
    await expect(page.getByLabel(/Official source link/)).toHaveValue('https://example.com/zelo-dolg-url/razpis');
    await expect(page.getByLabel('Correction or update for an existing race')).toBeChecked();
    await expect(page.getByLabel(/Region/)).toContainText('Central Slovenia');
    await page.getByLabel(/Region/).selectOption('Osrednjeslovenska');
    await page.getByLabel(/Are you/).selectOption({ label: 'Yes' });
    await page.getByLabel(/official announcement/).selectOption({ label: 'I do not know' });
    await page.getByLabel(/Contact email/).fill('review@example.com');
    await page.getByRole('button', { name: 'Send proposal' }).click();
    await expect.poll(() => getPayload()?.get(contract.fields.proposalType)).toBe('Popravek obstoječega vnosa v koledarju');
    expect(getPayload()?.get(contract.fields.date)).toBe('2027-05-01');
    expect(getPayload()?.get(contract.fields.organizer)).toBe('Da');
    expect(getPayload()?.get(contract.fields.officialAnnouncement2026)).toBe('Ne vem');
    expect(getPayload()?.get(contract.fields.description)).toContain('Language/context: English STK page.');
    await expect(page.locator('[data-submit-status]')).toContainText('sent to the existing Google Forms');
    await expect(page.getByRole('link', { name: 'Submit a new proposal' })).toHaveAttribute('href', '/en/add-or-correct-race/');
    expect(errors).toEqual([]);
  });

  test('unsafe returnUrl is not rendered', async ({ page }) => {
    await page.goto('/dodaj-ali-popravi-tek/?event=Tek&source=detail&returnUrl=https://evil.test/&date=2026-02-02&place=Kraj');
    await expect(page.getByRole('link', { name: 'Nazaj na stran teka' })).toHaveCount(0);
    await expect(page.getByLabel(/Povezava/)).toHaveValue('');
  });
});
