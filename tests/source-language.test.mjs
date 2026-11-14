import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { getSlovenianSourceLanguage } from '../.cache/dist-test/utils-english.js';
import { buildFamilyInfo, buildPublicNotes } from '../.cache/dist-test/utils-race-detail-view.js';

const samples = JSON.parse(readFileSync('tests/fixtures/u09-source-notes.json', 'utf8'));
test('recognises the reviewed Slovenian notes without marking numbers, names or English as Slovenian', () => {
  for (const row of samples) assert.equal(getSlovenianSourceLanguage(row.opombe_javne), 'sl');
  for (const value of ['', '08:45', 'Velenje Trail · Pozoj · Mastodont', 'Children’s races are free.', 'Registration closes on Friday.']) {
    assert.equal(getSlovenianSourceLanguage(value), undefined);
  }
});
test('source-language profile rendering retains family conditions and separate registration notes', () => {
  for (const row of samples) {
    const event = { publicNotes: row.opombe_javne, familyFriendly: row.row !== 311, kidsRaces: row.row === 303 };
    const lang = getSlovenianSourceLanguage(event.publicNotes) ?? 'en';
    const family = buildFamilyInfo(event, lang);
    const notes = buildPublicNotes(event, lang, family);
    const combined = [...family, notes].join(' ');
    // Exact facts survive; generic English fallback must not replace them.
    for (const part of row.opombe_javne.split(/(?<=\.)\s+(?=\p{Lu})/u)) assert.ok(combined.includes(part));
    assert.doesNotMatch(combined, /Family activities are available/);
    for (const text of family) assert.ok(!notes.includes(text));
  }
});
