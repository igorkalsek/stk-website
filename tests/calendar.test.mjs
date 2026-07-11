import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildGoogleCalendarEventUrl, buildIcsDataUrl, buildOutlookCalendarEventUrl } from '../.cache/dist-test/utils-calendar.js';

const event = { title: 'Test, tek', date: '2026-05-10', location: 'Ljubljana' };
const detailsFromGoogle = (url) => new URL(url).searchParams.get('details') ?? '';
const bodyFromOutlook = (url) => new URL(url).searchParams.get('body') ?? '';
const icsText = (url) => decodeURIComponent(url.replace('data:text/calendar;charset=utf-8,', ''));
const unfoldIcs = (value) => value.replace(/\r?\n[ \t]/g, '');

describe('individual event calendar action descriptions', () => {
  it('deduplicates equivalent registration and official-info URLs with localized combined labels', () => {
    const sl = buildGoogleCalendarEventUrl({ ...event, registrationUrl: 'https://example.si/event/', noticeUrl: 'https://example.si/event#razpis' });
    const en = buildOutlookCalendarEventUrl({ ...event, registrationUrl: 'https://example.si/event?b=2&a=1', noticeUrl: 'https://example.si/event?a=1&b=2', language: 'en' });
    assert.match(detailsFromGoogle(sl), /Razpis in prijava: https:\/\/example\.si\/event\//);
    assert.equal((detailsFromGoogle(sl).match(/https:\/\/example\.si\/event/g) ?? []).length, 1);
    assert.match(bodyFromOutlook(en), /Official info and registration: https:\/\/example\.si\/event\?b=2&a=1/);
    assert.equal((bodyFromOutlook(en).match(/https:\/\/example\.si\/event/g) ?? []).length, 1);
  });

  it('preserves distinct and single valid URL lines while omitting malformed URLs', () => {
    const distinct = detailsFromGoogle(buildGoogleCalendarEventUrl({ ...event, registrationUrl: 'https://example.si/reg', noticeUrl: 'https://example.si/info' }));
    assert.match(distinct, /Razpis: https:\/\/example\.si\/info/);
    assert.match(distinct, /Prijava: https:\/\/example\.si\/reg/);
    assert.match(detailsFromGoogle(buildGoogleCalendarEventUrl({ ...event, registrationUrl: 'https://example.si/reg', noticeUrl: 'notaurl' })), /Prijava: https:\/\/example\.si\/reg/);
    assert.match(detailsFromGoogle(buildGoogleCalendarEventUrl({ ...event, noticeUrl: 'https://example.si/info' })), /Razpis: https:\/\/example\.si\/info/);
    assert.doesNotMatch(detailsFromGoogle(buildGoogleCalendarEventUrl({ ...event, registrationUrl: 'notaurl', noticeUrl: 'javascript:alert(1)' })), /notaurl|javascript/);
  });

  it('keeps ICS escaped and avoids duplicate equivalent URLs', () => {
    const ics = unfoldIcs(icsText(buildIcsDataUrl({ ...event, registrationUrl: 'https://example.si/event', noticeUrl: 'https://example.si/event/' }))); 
    assert.match(ics, /DESCRIPTION:.*Razpis in prijava: https:\/\/example\.si\/event/s);
    assert.match(ics, /Test\\, tek/);
    assert.equal((ics.match(/https:\/\/example\.si\/event/g) ?? []).length, 1);
  });
});
