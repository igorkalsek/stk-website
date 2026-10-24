import { test, expect } from '@playwright/test';

for (const language of ['sl', 'en']) for (const width of [390, 1440]) {
  const path = `${language === 'sl' ? '/tek' : '/en/races'}/2026/r000256-go4trail/`;
  const canonical = `https://tekaski-koledar.si${path}`;
  const sl = language === 'sl';
  test.describe(`${language} ${width}px sharing`, () => {
    test.beforeEach(async ({ page, context }) => {
      await page.setViewportSize({ width, height: 900 });
      // No analytics, posts or remote mutations; Facebook navigation is fulfilled locally.
      await context.route('**/*', route => {
        const request = route.request();
        if (!['GET', 'HEAD'].includes(request.method())) return route.abort();
        if (new URL(request.url()).hostname === '127.0.0.1') return route.continue();
        return route.fulfill({ body: '<p>External sharing destination</p>', contentType: 'text/html' });
      });
      await page.addInitScript(() => {
        localStorage.setItem('stkAnalyticsOptOut', 'true');
        const state = (window as any).__sharing = { copies: [] as string[], fallback: [] as string[], mode: 'resolve', clipboard: 'resolve', exec: 'success' };
        Object.defineProperty(navigator, 'share', { configurable: true, value: async (data: ShareData) => {
          state.payload = data;
          if (state.mode === 'pending') await new Promise(resolve => { state.resolve = resolve; });
          if (state.mode === 'cancel') throw new DOMException('Canceled', 'AbortError');
          if (state.mode === 'error') throw new DOMException('Denied', 'NotAllowedError');
        } });
        Object.defineProperty(navigator, 'canShare', { configurable: true, value: () => true });
        Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async (value: string) => {
          state.copies.push(value);
          if (state.clipboard === 'reject') throw new DOMException('Denied', 'NotAllowedError');
        } } });
        document.execCommand = () => {
          state.fallback.push((document.activeElement as HTMLTextAreaElement)?.value);
          if (state.exec === 'throw') throw new Error('copy failed');
          return state.exec === 'success';
        };
      });
    });

    test('native payload, pending, resolution, cancellation and errors', async ({ page }) => {
      await page.goto(path);
      const button = page.getByRole('button', { name: sl ? 'Deli tek' : 'Share race', exact: true });
      const feedback = page.locator('[data-share-feedback]');
      await expect(button).toBeVisible();
      await expect(button).toHaveAttribute('data-analytics-event-type', 'share_clicked');
      await expect(button).toHaveAttribute('data-analytics-target-url', canonical);
      await page.evaluate(() => { (window as any).__sharing.mode = 'pending'; });
      await button.click();
      await expect(button).toBeDisabled();
      await expect(feedback).toBeEmpty();
      const payload = await page.evaluate(() => (window as any).__sharing.payload);
      expect(payload).toMatchObject({ title: 'Go4trail', url: canonical });
      expect(payload.text).toContain('Go4trail');
      expect(payload.text).toContain('Nova Gorica');
      expect(payload.text).toContain('2026');
      expect(payload.text).not.toContain('http');
      await page.evaluate(() => (window as any).__sharing.resolve());
      await expect(feedback).toHaveText(sl ? 'Za dokončanje deljenja preverite izbrano aplikacijo.' : 'Check the selected app to finish sharing.');
      await expect(button).toBeEnabled();
      for (const mode of ['cancel', 'error']) {
        await page.evaluate(mode => { (window as any).__sharing.mode = mode; }, mode);
        await button.click();
        await expect(feedback).toHaveText(mode === 'cancel'
          ? sl ? 'Deljenje je preklicano ali ni na voljo. Uporabite lahko spodnje možnosti.' : 'Sharing was canceled or is unavailable. You can use the options below.'
          : sl ? 'Deljenje ni uspelo. Uporabite spodnje možnosti.' : 'Sharing failed. Use the options below.');
        await expect(button).toBeEnabled();
        await expect(page.locator('[data-copy-share-url]')).toBeVisible();
      }
      expect(await page.evaluate(() => (window as any).__sharing.copies)).toEqual([]);
      await page.keyboard.press('Tab');
      await button.focus();
      await expect(button).toBeFocused();
      expect(await button.evaluate(e => getComputedStyle(e).outlineStyle)).not.toBe('none');
      const rect = (await button.boundingBox())!;
      expect(rect.height).toBeGreaterThanOrEqual(44);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
      await expect(feedback).toHaveAttribute('role', 'status');
      await expect(feedback).toHaveAttribute('aria-live', 'polite');
    });

    for (const capability of ['missing', 'false', 'throws', 'no-canShare']) {
      test(`capability: ${capability}, existing options and metadata`, async ({ page }) => {
        await page.addInitScript(capability => {
          if (capability === 'missing') Object.defineProperty(navigator, 'share', { value: undefined });
          if (capability === 'false') Object.defineProperty(navigator, 'canShare', { value: () => false });
          if (capability === 'throws') Object.defineProperty(navigator, 'canShare', { value: () => { throw new Error('blocked'); } });
          if (capability === 'no-canShare') Object.defineProperty(navigator, 'canShare', { value: undefined });
        }, capability);
        await page.goto(path);
        if (capability === 'no-canShare') await expect(page.locator('[data-native-share]')).toBeVisible();
        else await expect(page.locator('[data-native-share]')).toBeHidden();
        for (const action of ['facebook', 'whatsapp', 'x', 'email']) {
          const link = page.locator(`[data-analytics-action-type="share_${action}_click"]`);
          await expect(link).toBeVisible();
          await expect(link).toHaveAttribute('data-analytics-event-type', 'share_clicked');
          await expect(link).toHaveAttribute('data-analytics-target-url', canonical);
          expect(decodeURIComponent((await link.getAttribute('href'))!)).toContain(canonical);
        }
        await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', canonical);
        await expect(page.locator('meta[property="og:url"]')).toHaveAttribute('content', canonical);
        await expect(page.locator('meta[property="og:image"]')).toHaveAttribute('content', 'https://tekaski-koledar.si/stk-logo.jpeg');
        await expect(page.locator('html')).toHaveAttribute('lang', language);
        for (const lang of ['sl', 'en']) await expect(page.locator(`link[rel="alternate"][hreflang="${lang}"]`)).toHaveCount(1);
      });
    }

    for (const clipboard of ['resolve', 'missing', 'reject']) {
      test(`copy and Facebook with Clipboard ${clipboard}`, async ({ page, context }) => {
        await page.addInitScript(clipboard => {
          (window as any).__sharing.clipboard = clipboard;
          if (clipboard === 'missing') Object.defineProperty(navigator, 'clipboard', { value: undefined });
        }, clipboard);
        await page.goto(path);
        const feedback = page.locator('[data-share-feedback]');
        const state = () => page.evaluate(() => (window as any).__sharing);
        await page.locator('[data-copy-share-url]').click();
        await expect(feedback).toHaveText(sl ? 'Povezava je kopirana.' : 'Link copied.');
        expect(clipboard === 'resolve' ? (await state()).copies : (await state()).fallback).toEqual([canonical]);
        await page.locator('button[data-copy-share-text]').click();
        const description = await page.locator('button[data-copy-share-text]').getAttribute('data-copy-share-text');
        expect(description).toContain(canonical);
        const popupPromise = context.waitForEvent('page');
        await page.locator('[data-facebook-share-button]').click();
        const popup = await popupPromise;
        await popup.waitForLoadState();
        expect(new URL(popup.url()).searchParams.get('u')).toBe(canonical);
        await popup.close();
        await expect(feedback).toHaveText(sl ? 'Besedilo je kopirano. Na Facebooku ga ročno prilepite in dokončajte objavo.' : 'Text copied. Paste it manually on Facebook and finish your post.');
        expect(clipboard === 'resolve' ? (await state()).copies : (await state()).fallback).toEqual([canonical, description, description]);
        expect(await page.locator('textarea[readonly]').count()).toBe(0);

        // A failed copy must replace the previous success, including fallback false/throw.
        for (const exec of ['false', 'throw']) {
          await page.evaluate(exec => { const s = (window as any).__sharing; s.clipboard = 'reject'; s.exec = exec; }, exec);
          await page.locator('[data-copy-share-url]').click();
          await expect(feedback).toHaveText(sl ? 'Povezave ni bilo mogoče kopirati.' : 'Could not copy the link.');
          await page.locator('button[data-copy-share-text]').click();
          await expect(feedback).toHaveText(sl ? 'Opisa ni bilo mogoče kopirati.' : 'Could not copy the description.');
          const popupPromise = context.waitForEvent('page');
          await page.locator('[data-facebook-share-button]').click();
          await (await popupPromise).close();
          await expect(feedback).toContainText(sl ? 'Besedila ni bilo mogoče kopirati.' : 'Could not copy the text.');
          await expect(feedback).not.toContainText(sl ? 'Facebook je odprt' : 'Facebook is open');
          expect(await page.locator('textarea[readonly]').count()).toBe(0);
        }
      });
    }
  });
}
