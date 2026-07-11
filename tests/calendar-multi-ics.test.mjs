import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildIcsCalendar } from '../.cache/dist-test/utils-calendar.js';

const fixedStamp = '2026-01-02T03:04:05.000Z';
const race = (overrides = {}) => ({
  uid: '2026-r000175-20260724@slovenski-tekaski-koledar',
  title: 'Nočni tek, Kranj; 10 km / trail',
  date: '2026-07-24',
  location: 'Kranj, Gorenjska',
  noticeUrl: 'https://example.com/info',
  registrationUrl: 'https://example.com/register',
  ...overrides
});
const unfold = (value) => value.replace(new RegExp('\\r\\n[ \t]', 'g'), '');
const count = (value, needle) => (value.match(new RegExp(needle, 'g')) ?? []).length;

const eventBlocks = (ics) => [...ics.matchAll(/BEGIN:VEVENT\r\n([\s\S]*?)\r\nEND:VEVENT/g)].map((match) => match[1]);

describe('multi-event ICS calendar builder', () => {
  it('returns an empty result for an empty or invalid event list', () => {
    assert.equal(buildIcsCalendar({ events: [], dtstamp: fixedStamp }), '');
    assert.equal(buildIcsCalendar({ events: [race({ title: '', date: '2026-07-24' })], dtstamp: fixedStamp }), '');
  });

  it('wraps multiple events in exactly one VCALENDAR', () => {
    const ics = buildIcsCalendar({ events: [race(), race({ uid: '2027-r000001-20270501@slovenski-tekaski-koledar', date: '2027-05-01', title: 'Majski tek' })], dtstamp: fixedStamp });
    assert.equal(count(ics, 'BEGIN:VCALENDAR'), 1);
    assert.equal(count(ics, 'END:VCALENDAR'), 1);
    assert.equal(count(ics, 'BEGIN:VEVENT'), 2);
    assert.equal(count(ics, 'END:VEVENT'), 2);
  });

  it('includes combined 2026 and 2027 events sorted by date then title', () => {
    const ics = unfold(buildIcsCalendar({ events: [race({ uid: '2027-r2-20270101@slovenski-tekaski-koledar', date: '2027-01-01', title: 'B tek' }), race({ uid: '2026-r1-20261231@slovenski-tekaski-koledar', date: '2026-12-31', title: 'Z tek' }), race({ uid: '2027-r3-20270101@slovenski-tekaski-koledar', date: '2027-01-01', title: 'A tek' })], dtstamp: fixedStamp }));
    assert.ok(ics.indexOf('SUMMARY:Z tek') < ics.indexOf('SUMMARY:A tek'));
    assert.ok(ics.indexOf('SUMMARY:A tek') < ics.indexOf('SUMMARY:B tek'));
    assert.match(ics, /UID:2026-r1-20261231@slovenski-tekaski-koledar/);
    assert.match(ics, /UID:2027-r2-20270101@slovenski-tekaski-koledar/);
  });

  it('deduplicates stable UIDs and keeps UIDs unique', () => {
    const ics = buildIcsCalendar({ events: [race(), race({ title: 'Duplicate same UID' }), race({ uid: '2026-r000176-20260725@slovenski-tekaski-koledar', date: '2026-07-25' })], dtstamp: fixedStamp });
    const uids = [...ics.matchAll(/^UID:(.+)$/gm)].map((match) => match[1].trim());
    assert.equal(uids.length, 2);
    assert.equal(new Set(uids).size, 2);
    assert.equal(count(ics, 'BEGIN:VEVENT'), 2);
  });

  it('writes correct DTSTART and DTEND for each all-day event', () => {
    const blocks = eventBlocks(buildIcsCalendar({ events: [race({ date: '2026-07-24' }), race({ uid: '2027-r-20271231@slovenski-tekaski-koledar', date: '2027-12-31' })], dtstamp: fixedStamp }));
    assert.match(blocks[0], /DTSTART;VALUE=DATE:20260724/);
    assert.match(blocks[0], /DTEND;VALUE=DATE:20260725/);
    assert.match(blocks[1], /DTSTART;VALUE=DATE:20271231/);
    assert.match(blocks[1], /DTEND;VALUE=DATE:20280101/);
  });

  it('escapes text, folds long lines, and uses CRLF line endings', () => {
    const ics = buildIcsCalendar({ events: [race({ title: `Dolg tek, s podpičjem; poševnico / in\nnovo vrstico ${'zelo '.repeat(30)}`, location: 'Kraj, dvorana; A / B' })], dtstamp: fixedStamp });
    assert.match(unfold(ics), /SUMMARY:Dolg tek\\, s podpičjem\\; poševnico \/ in\\nnovo vrstico/);
    assert.match(unfold(ics), /LOCATION:Kraj\\, dvorana\\; A \/ B/);
    assert.match(ics, /\r\n /);
    assert.doesNotMatch(ics, /(?<!\r)\n/);
    assert.match(ics, /\r\n$/);
  });

  it('uses localized Slovenian and English descriptions', () => {
    const sl = unfold(buildIcsCalendar({ events: [race()], language: 'sl', dtstamp: fixedStamp }));
    const en = unfold(buildIcsCalendar({ events: [race({ language: 'en' })], language: 'en', dtstamp: fixedStamp }));
    assert.match(sl, /Dodano iz Slovenskega Tekaškega Koledarja/);
    assert.match(sl, /Razpis:/);
    assert.match(sl, /Prijava:/);
    assert.match(en, /Added from Slovenski Tekaški Koledar/);
    assert.match(en, /Official info:/);
    assert.match(en, /Registration:/);
    assert.match(en, /DTSTAMP:20260102T030405Z/);
  });
});
