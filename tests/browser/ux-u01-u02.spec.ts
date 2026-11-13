import { test, expect, type Locator, type Page } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';

// Optional evidence output also works on main: assertions still fail on defects.
const evidence = process.env.STK_UX_EVIDENCE;
const runs = [
  { row: 1, naziv: 'Ljubljanska runda', kraj: 'Ljubljana', regija: 'Osrednjeslovenska', tip: 'skupinski tek', udelezba: 'Brezplačno' },
  { row: 2, naziv: 'Gorenjski trening', kraj: 'Kranj', regija: 'Gorenjska', tip: 'odprt trening', udelezba: 'Plačljivo / članarina / vadnina' }
];

test.beforeEach(async ({ page, context }) => {
  await page.clock.setFixedTime(new Date('2026-11-13T12:00:00+01:00'));
  await page.addInitScript(() => localStorage.setItem('stkAnalyticsOptOut', 'true'));
  await context.route('**/*', route => {
    const url = new URL(route.request().url());
    if (url.hostname === '127.0.0.1') return route.continue();
    if (url.hostname === 'stk-master-api.igor-kalsek.workers.dev' && url.pathname === '/group-runs') {
      return route.fulfill({ json: { ok: true, data: runs } });
    }
    return route.fulfill({ json: { ok: true, events: [] } });
  });
});

async function record(page: Page, name: string, data: unknown, target: Locator) {
  console.log(JSON.stringify({ name, data }));
  if (!evidence) return;
  mkdirSync(evidence, { recursive: true });
  writeFileSync(`${evidence}/${name}.json`, JSON.stringify(data, null, 2) + '\n');
  await target.scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${evidence}/${name}.png` });
}

// Sample actual rendered pixels with transparent text. Includes the translucent
// panel over the hero gradient; avoids assuming an opaque white background.
async function contrast(page: Page, link: Locator) {
  const color = await link.evaluate(e => getComputedStyle(e).color);
  const style = await page.addStyleTag({ content: '.event-detail-my-race-heading a { color: transparent !important; }' });
  const png = (await link.screenshot()).toString('base64');
  await style.evaluate(e => e.remove());
  return page.evaluate(async ({ color, png }) => {
    const img = new Image(); img.src = `data:image/png;base64,${png}`; await img.decode();
    const canvas = document.createElement('canvas'); canvas.width = img.width; canvas.height = img.height;
    const ctx = canvas.getContext('2d')!; ctx.drawImage(img, 0, 0);
    const { data } = ctx.getImageData(0, 0, img.width, img.height);
    const rgb = color.match(/[\d.]+/g)!.map(Number);
    const luminance = (values: number[]) => values.map(v => {
      v /= 255; return v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4;
    }).reduce((sum, v, i) => sum + v * [.2126, .7152, .0722][i], 0);
    let minimum = Infinity;
    for (let y = Math.ceil(img.height * .25); y < img.height * .75; y++) {
      for (let x = 2; x < img.width - 2; x++) {
        const bg = Array.from(data.slice((y * img.width + x) * 4, (y * img.width + x) * 4 + 3));
        const alpha = rgb[3] ?? 1;
        const fg = bg.map((v, i) => rgb[i] * alpha + v * (1 - alpha));
        const a = luminance(fg), b = luminance(bg);
        minimum = Math.min(minimum, (Math.max(a, b) + .05) / (Math.min(a, b) + .05));
      }
    }
    return { color, minimum };
  }, { color, png });
}

for (const lang of ['sl', 'en']) {
  for (const width of [390, 768, 1440]) {
    test(`U01 share contrast and keyboard ${lang} ${width}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 1000 });
      await page.goto(`${lang === 'sl' ? '/tek' : '/en/races'}/2026/r000256-go4trail/`);
      const link = page.locator('.event-detail-my-race-heading a');
      await expect(link).toHaveText(lang === 'sl' ? 'Deli tek' : 'Share race');
      await expect(link).toHaveAttribute('href', '#race-share');
      await page.mouse.move(0, 0);
      const normal = await contrast(page, link);
      await link.hover();
      const hover = await contrast(page, link);
      await page.mouse.move(0, 0);
      // Reach the link through real keyboard navigation, rather than forcing focus.
      await page.keyboard.press('Tab');
      for (let i = 0; i < 80 && !(await link.evaluate(e => e === document.activeElement)); i++) await page.keyboard.press('Tab');
      await expect(link).toBeFocused();
      const focus = await contrast(page, link);
      const outline = await link.evaluate(e => {
        const s = getComputedStyle(e);
        return { style: s.outlineStyle, width: s.outlineWidth, color: s.outlineColor };
      });
      await record(page, `u01-${lang}-${width}`, { normal, hover, focus, outline }, link);
      for (const state of [normal, hover, focus]) expect.soft(state.minimum).toBeGreaterThanOrEqual(4.5);
      expect(outline.style).not.toBe('none');
      expect(parseFloat(outline.width)).toBeGreaterThanOrEqual(2);
      await page.keyboard.press('Enter');
      await expect(page.locator('#race-share')).toBeFocused();
      await expect(page.locator('[data-copy-share-url]')).toBeVisible();
    });
  }

  for (const width of [390, 641, 768, 820, 900, 1440]) {
    test(`U02 group filters fit and reset ${lang} ${width}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 1000 });
      await page.goto(lang === 'sl' ? '/skupinski-teki/' : '/en/group-runs/');
      const form = page.locator('[data-group-runs-filters]');
      await expect(page.locator('.group-run-card')).toHaveCount(2);
      const metrics = await form.evaluate(form => ({
        clientWidth: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
        controls: [...form.querySelectorAll('input, select, button')].map(e => {
          const r = e.getBoundingClientRect();
          return { name: e.getAttribute('name') || 'reset', left: r.left, right: r.right, width: r.width, height: r.height, clientWidth: e.clientWidth, scrollWidth: e.scrollWidth };
        })
      }));
      await record(page, `u02-${lang}-${width}`, metrics, form);
      expect.soft(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth + 1);
      expect(metrics.controls).toHaveLength(5);
      for (const control of await form.locator('input, select, button').all()) {
        await expect(control).toBeVisible();
        await expect(control).toBeEnabled();
      }
      for (const control of metrics.controls) {
        expect(control.width).toBeGreaterThan(0);
        expect(control.height).toBeGreaterThanOrEqual(44);
        expect.soft(control.left).toBeGreaterThanOrEqual(0);
        expect.soft(control.right).toBeLessThanOrEqual(width + 1);
        expect.soft(control.scrollWidth).toBeLessThanOrEqual(control.clientWidth + 1);
      }
      const search = form.locator('input');
      await search.fill('Ljubljana');
      for (const [name, value] of [['region', runs[0].regija], ['type', runs[0].tip], ['participation', runs[0].udelezba]]) {
        await form.locator(`[name="${name}"]`).selectOption(value);
      }
      await expect(page.locator('.group-run-card')).toHaveCount(1);
      await expect(page.locator('.group-run-card')).toContainText(runs[0].naziv);
      await search.fill('no matching group run');
      await expect(page.locator('.group-run-card')).toHaveCount(0);
      const reset = form.locator('[data-clear-filters]');
      await reset.scrollIntoViewIfNeeded();
      await reset.focus();
      await page.keyboard.press('Enter');
      for (const control of await form.locator('input, select').all()) await expect(control).toHaveValue('');
      await expect(page.locator('.group-run-card')).toHaveCount(2);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width + 1);
    });
  }
}
