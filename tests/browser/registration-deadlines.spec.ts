import { expect, test } from '@playwright/test';

const cases = [
  { slug: 'r000254-4-lahinja-trail', date: '2026-11-04', name: 'Lahinja online cutoff' },
  { slug: 'r000255-obala-ultra-trail-powered-by-i-feel-slovenia', date: '2026-10-15', name: 'actual final cutoff' },
  { slug: 'r000259-tekaski-pozdrav-jeseni', date: '2026-11-04', name: 'combined online and cheaper cutoff' }
];

for (const language of ['sl', 'en']) {
  for (const width of [390, 768, 1440]) {
    test(`${language} at ${width}px: real deadline profiles before/on/after cutoff`, async ({ page }) => {
      const errors: string[] = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.route('**/*', route => {
        const request = route.request();
        // Browser smoke must never submit analytics, votes or production writes.
        if (!['GET', 'HEAD'].includes(request.method())) return route.abort();
        return route.continue();
      });
      await page.setViewportSize({ width, height: 1000 });
      for (const scenario of cases) {
        for (const offset of [-1, 0, 1]) {
          const now = new Date(Date.parse(scenario.date + 'T12:00:00Z') + offset * 86400000);
          await page.clock.install({ time: now });
          const prefix = language === 'sl' ? '/tek/2026/' : '/en/races/2026/';
          await page.goto(prefix + scenario.slug + '/');
          const deadline = page.locator('[data-registration-deadline][data-deadline-kind="registration"]');
          await expect(deadline).toHaveAttribute('data-registration-deadline-initialized', 'true');
          await expect(deadline).toHaveAttribute('data-deadline-date', scenario.date);
          const text = await deadline.innerText();
          expect(text).not.toMatch(/zapre|closes/i);
          if (offset === 0) expect(text).toBe(language === 'sl' ? 'Rok prijave je danes' : 'Registration deadline today');
          const source = deadline.locator('..').getByRole('link', { name: language === 'sl' ? 'Preverite pogoje prijave pri organizatorju' : 'Check registration terms with the organiser' });
          await expect(source).toHaveAttribute('href', /^https:\/\//);
          expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
          if (scenario.slug.includes('lahinja') && offset === 0) {
            await deadline.scrollIntoViewIfNeeded();
            await page.screenshot({ path: `/tmp/website-p2-${language}-${width}.png` });
          }
        }
      }
      expect(errors).toEqual([]);
    });
  }
}
