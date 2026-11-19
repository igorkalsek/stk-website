import { expect, test } from '@playwright/test';

const affiliateUrl = 'https://www.ahotu.com/event/maraton-treh-src?linkId=lp_509155&sourceId=stk&tenantId=ahotu';
const registrationUrl = 'https://www.maraton-radenci.si/prijava/maraton-radenska-classic/';
const noticeUrl = 'https://www.maraton-radenci.si/o-maratonu';
const title = '45. Maraton treh src';
const profiles = [
  {
    language: 'sl', prefix: '/tek',
    actions: ['Prijava prek Ahotu', 'Prijava pri organizatorju', 'Razpis'],
    archive: 'Prijava (arhiv)',
    disclosure: 'Partnerska povezava'
  },
  {
    language: 'en', prefix: '/en/races',
    actions: ['Register via Ahotu', 'Register with organiser', 'Official info'],
    archive: 'Registration (archive)',
    disclosure: 'Affiliate link'
  }
];

for (const profile of profiles) for (const width of [390, 768, 1440]) {
  test(`Ahotu pilot links, analytics and archive: ${profile.language} ${width}px`, async ({ context, page }) => {
    const path = `${profile.prefix}/2027/r000011-45-maraton-treh-src/`;
    const registrations: Record<string, unknown>[] = [];
    // Capture local analytics assertions and block every outbound request.
    await context.route('**/*', async route => {
      const request = route.request();
      const { hostname } = new URL(request.url());
      if (hostname === '127.0.0.1' && request.method() === 'GET') return route.continue();
      if (hostname === 'script.google.com' && request.method() === 'POST') {
        const payload = request.postDataJSON();
        if (payload?.action_type === 'prijava') registrations.push(payload);
      }
      return route.abort();
    });
    await page.addInitScript(() => {
      window.addEventListener('click', event => {
        if (event.target instanceof Element && event.target.closest('.event-detail-official-actions a')) event.preventDefault();
      });
    });
    await page.setViewportSize({ width, height: 900 });
    await page.clock.setFixedTime(new Date('2026-11-18T12:00:00Z'));
    await page.goto(path);

    const group = page.locator('.event-detail-official-actions');
    const links = group.getByRole('link');
    const [affiliate, organiser, notice] = profile.actions.map(name => group.getByRole('link', { name, exact: true }));
    const disclosure = page.getByText(profile.disclosure, { exact: true });
    await expect(links).toHaveText(profile.actions);
    await expect(affiliate).toHaveAttribute('href', affiliateUrl);
    await expect(affiliate).toHaveAttribute('rel', 'noopener noreferrer sponsored');
    await expect(affiliate).toHaveClass(/\bbutton-primary\b/);
    await expect(organiser).toHaveAttribute('href', registrationUrl);
    await expect(organiser).toHaveClass(/\bbutton-secondary-light\b/);
    await expect(notice).toHaveAttribute('href', noticeUrl);
    await expect(disclosure).toBeVisible();
    const disclosureBox = (await disclosure.boundingBox())!;
    for (const link of [affiliate, organiser, notice]) {
      const box = (await link.boundingBox())!;
      expect(box.height).toBeGreaterThanOrEqual(44);
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(width);
      expect(box.y + box.height).toBeLessThan(disclosureBox.y);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);

    await affiliate.focus();
    expect(await affiliate.evaluate(el => getComputedStyle(el).outlineStyle)).toBe('solid');
    await page.keyboard.press('Enter');
    await page.keyboard.press('Tab');
    await expect(organiser).toBeFocused();
    expect(await organiser.evaluate(el => getComputedStyle(el).outlineStyle)).toBe('solid');
    await page.keyboard.press('Enter');
    await page.keyboard.press('Tab');
    await expect(notice).toBeFocused();
    await expect.poll(() => registrations).toMatchObject([affiliateUrl, registrationUrl].map(targetUrl => ({
      event_type: 'external_link_clicked', action_type: 'prijava', placement: 'race_detail',
      language: profile.language, page_path: path, event_id: 'R000011', event_key: '2027:R000011',
      event_name: title, event_date: '2027-05-15', event_year: '2027',
      target_url: targetUrl, target_domain: new URL(targetUrl).hostname.replace(/^www\./, '')
    })));

    await page.clock.setFixedTime(new Date('2027-05-15T22:01:00Z'));
    await page.evaluate(() => window.dispatchEvent(new Event('pageshow')));
    await expect(links).toHaveText([profile.archive, profile.actions[2]]);
    await expect(group.getByRole('link', { name: profile.archive, exact: true })).toHaveAttribute('href', registrationUrl);
    await expect(disclosure).toBeHidden();

    await page.goto(`${profile.prefix}/2027/r000017-kocevsko-outdoor-festival-2027/`);
    await expect(page.getByRole('heading', { level: 1 })).toContainText(/Kočevsko Outdoor Festival/i);
    await expect(page.locator('a[rel~="sponsored"]')).toHaveCount(0);
    await expect(disclosure).toHaveCount(0);
  });
}
