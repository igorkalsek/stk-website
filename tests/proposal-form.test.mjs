import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { googleProposalFormContract } from '../.cache/dist-test/proposal-form/proposal-form-contract.js';
import { requiredProposalFields, isSafeInternalReturnUrl, isSafeHttpUrl, readProposalPrefill, buildGoogleFormsFallbackUrl, getYearContext } from '../.cache/dist-test/proposal-form/proposal-form-controller.js';
import { proposalFormLocales } from '../.cache/dist-test/proposal-form/proposal-form-locales.js';

describe('proposal form contract', () => {
  it('keeps verified Google Forms entry mapping', () => {
    assert.equal(googleProposalFormContract.fields.proposalType, 'entry.1029369192');
    assert.equal(googleProposalFormContract.fields.officialSource, 'entry.1673153264');
    assert.equal(googleProposalFormContract.fields.email, 'entry.600388817');
    assert(googleProposalFormContract.values.regions.includes('Ne vem / nisem prepričan (navedem v opisu)'));
  });
  it('documents required website fields', () => assert.deepEqual([...requiredProposalFields], ['proposalType','date','title','place','region','description','organizer','officialAnnouncement2026','email']));
  it('has SL/EN locale configuration', () => { assert.equal(proposalFormLocales.sl.fallback, 'Odprite obrazec v Google Forms'); assert.equal(proposalFormLocales.en.fallback, 'Open the form in Google Forms'); });
  it('prefills correction query safely', () => {
    const prefill = readProposalPrefill(new URLSearchParams('event=Šmarna gora&year=2027&date=2027-05-01&place=Ljubljana&source=detail&returnUrl=/tek/2027/test/&lang=en'), 'sl');
    assert.equal(prefill.eventTitle, 'Šmarna gora'); assert.equal(prefill.safeReturnUrl, '/tek/2027/test/'); assert.equal(prefill.officialSourceUrl, ''); assert.match(prefill.description, /Year: 2027/); assert.match(prefill.description, /Context source: detail/);
  });
  it('accepts only internal returnUrl paths and http source URLs', () => { assert.equal(isSafeInternalReturnUrl('/tek/2026/a/'), true); assert.equal(isSafeInternalReturnUrl('//evil'), false); assert.equal(isSafeInternalReturnUrl('https://evil.test'), false); assert.equal(isSafeHttpUrl('detail'), false); assert.equal(isSafeHttpUrl('https://example.com/razpis'), true); });
  it('keeps 2026 and 2027 context', () => { assert.equal(getYearContext('2026-01-01'), '2026'); assert.equal(getYearContext('2027'), '2027'); });
  it('preserves fallback prefill without storing private fields in URL/localStorage', () => {
    const url = buildGoogleFormsFallbackUrl(readProposalPrefill(new URLSearchParams('event=Tek&date=2026-03-02&place=Kranj&source=detail&returnUrl=/tek/2026/tek/'), 'sl'));
    assert.match(url, /entry\.528776717=Tek/); assert.doesNotMatch(url, /entry\.600388817/); assert.doesNotMatch(url, /entry\.1673153264=detail/);
    const component = readFileSync(new URL('../src/components/RaceProposalForm.astro', import.meta.url), 'utf8');
    assert.doesNotMatch(component, /localStorage|history\.pushState|Master API|Additional API/);
    assert.match(component, /data-analytics-link-type="correction_form"/);
  });
  it('does not add direct master or API writes', () => {
    const sources = ['src/components/RaceProposalForm.astro','src/proposal-form/proposal-form-controller.ts'].map((f) => readFileSync(new URL(`../${f}`, import.meta.url),'utf8')).join('\n');
    assert.doesNotMatch(sources, /fetch\(|googleapis|spreadsheets|\bD1\b|\bKV\b|master_row|Master API|Additional API/i);
  });
});
