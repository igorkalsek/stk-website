import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const component = readFileSync(new URL('../src/components/HomeUpcomingRaces.astro', import.meta.url), 'utf8');
const pages = {
  sl: readFileSync(new URL('../src/pages/index.astro', import.meta.url), 'utf8'),
  en: readFileSync(new URL('../src/pages/en/index.astro', import.meta.url), 'utf8')
};

test('both homepages render cached upcoming race cards in their initial HTML', () => {
  for (const [lang, source] of Object.entries(pages)) {
    assert.match(source, /getPublicYearData\(DEFAULT_PUBLIC_YEAR\)/, `${lang} should reuse cached Master build data`);
    assert.match(source, new RegExp(`<HomeUpcomingRaces events=\\{initialUpcomingEvents\\} lang="${lang}" \\/>`));
  }
  assert.doesNotMatch(pages.sl, /Najbližji teki bodo prikazani tukaj/);
  assert.doesNotMatch(pages.en, /Nearest races will appear here/);
});

test('static cards preserve localized detail paths and the client analytics contract', () => {
  assert.match(component, /buildEnglishEventDetailPath/);
  assert.match(component, /buildEventDetailPath/);
  assert.match(component, /data-analytics-placement="home_this_week"/);
  for (const attribute of ['event-id', 'event-name', 'event-date', 'event-year']) {
    assert.match(component, new RegExp(`data-analytics-${attribute}=`));
  }
  assert.match(component, /getStableEventId\(event\)/);
  assert.match(component, /data-analytics-link-type/);
});

test('static calendar links explicitly use the card language for SL and EN descriptions', () => {
  assert.match(component, /registrationUrl: event\.registrationUrl, language: lang/);
  assert.match(component, /buildGoogleCalendarEventUrl\(calendarEvent\)/);
  assert.match(component, /buildIcsDataUrl\(calendarEvent\)/);
  assert.match(component, /buildOutlookCalendarEventUrl\(calendarEvent\)/);
});

test('failed refreshes retain static cards and successful refreshes replace rather than append', () => {
  for (const [lang, source] of Object.entries(pages)) {
    const nearestLoader = source.slice(source.indexOf('async function loadNearestEvents()'), source.indexOf('async function loadStats()'));
    const catchBlock = nearestLoader.slice(nearestLoader.indexOf('} catch (error)'));
    assert.doesNotMatch(catchBlock, /container\.innerHTML\s*=/, `${lang} failure must retain server-rendered cards`);
    const startup = source.slice(source.indexOf('if (enableApiDebug) createDebugPanel();'));
    assert.ok(startup.indexOf('initSavedRaceButtons(initialNearestEvents)') < startup.indexOf('loadNearestEvents()'), `${lang} should initialize static save buttons before starting the API refresh`);
    assert.match(nearestLoader, /container\.innerHTML = eventCards/, `${lang} success should replace changed cards`);
    assert.doesNotMatch(nearestLoader, /insertAdjacentHTML|container\.append/, `${lang} refresh must not append duplicate cards`);
    assert.match(nearestLoader, /normalizeRenderedCards\(container\.innerHTML\) !== normalizeRenderedCards\(eventCards\)/, `${lang} should avoid replacing identical initial markup`);
    assert.match(nearestLoader, /container\.innerHTML = eventCards;\s*initSavedRaceButtons\(container\);/, `${lang} should initialize newly replaced buttons`);
    assert.doesNotMatch(nearestLoader, /}\s*initSavedRaceButtons\(container\);\s*setStatus\('nearest'/, `${lang} should not reinitialize unchanged static buttons`);
  }
});
