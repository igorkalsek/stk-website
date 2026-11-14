import { readFileSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const read = name => JSON.parse(readFileSync(new URL(name, import.meta.url)));
const before = read('before.json');
const after = read('after.json');
assert.equal(before.length, 36);
assert.equal(after.length, before.length);
for (const [i, result] of after.entries()) {
  for (const key of ['lang', 'width', 'state', 'cards', 'cardsHash', 'seasonHash']) assert.deepEqual(result[key], before[i][key], `${key}: ${result.lang}/${result.width}/${result.state}`);
  assert.equal(result.status, 200);
  assert.ok(result.scrollWidth <= result.width, 'Horizontal overflow');
  assert.deepEqual(result.errors, []);
  if (result.state === 'multiple') {
    assert.ok(result.next.y <= result.deadline.y);
    assert.ok(result.deadline.y < result.firstCard.y);
    if (result.width === 390) assert.ok(result.firstTitle.y <= 1000);
  }
  if (result.state === 'empty') assert.equal(result.cards, 0);
  if (result.state === 'past') { assert.equal(result.cards, 2); assert.equal(result.next, null); assert.equal(result.deadline, null); }
  if (result.state === 'partial') assert.equal(result.cards, 6);
}
const report = { states: after.length, identicalCardHtml: true, identicalSeasonHtml: true, noHorizontalOverflow: true, noPageErrors: true, mobileFirstTitleWithin1000: true };
writeFileSync(new URL('verification.json', import.meta.url), JSON.stringify(report, null, 2) + '\n');
console.log(report);
