import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

const sl = readFileSync(new URL('../src/pages/tek/[year]/[slug].astro', import.meta.url), 'utf8');
const en = readFileSync(new URL('../src/pages/en/races/[year]/[slug].astro', import.meta.url), 'utf8');

describe('race detail registration deadline contract', () => {
  it('outputs semantic deadline data attributes and initializes the shared runtime client', () => {
    for (const source of [sl, en]) {
      assert.match(source, /data-registration-deadline/);
      assert.match(source, /data-deadline-kind/);
      assert.match(source, /data-deadline-date/);
      assert.match(source, /data-event-date/);
      assert.match(source, /initRegistrationDeadlineCountdowns/);
    }
  });
  it('uses localized calendar menu copy on SL and EN detail pages', () => {
    assert.match(sl, /Dodaj rok v koledar/);
    assert.match(sl, /Google koledar/);
    assert.match(en, /Add deadline to calendar/);
    assert.match(en, /Google Calendar/);
  });
  it('uses the shared deduplicating helper for detail deadline views', () => {
    assert.match(sl, /buildRegistrationDeadlineViews/);
    assert.match(en, /buildRegistrationDeadlineViews/);
  });
});
