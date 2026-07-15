import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { googleProposalFormContract } from '../.cache/dist-test/proposal-form/proposal-form-contract.js';
import { requiredProposalFields, isSafeInternalReturnUrl, isSafeHttpUrl, readProposalPrefill, buildGoogleFormsFallbackUrl, getYearContext, mapExistingChangeSelectionToProposalType, additionalDataValuesForChangeSelection, buildStructuredChangeDescription, buildChangePlaceholder, parsePreselectedChangeCategories, parseProposalMode, getProposalFieldRules } from '../.cache/dist-test/proposal-form/proposal-form-controller.js';
import { proposalFormLocales } from '../.cache/dist-test/proposal-form/proposal-form-locales.js';

describe('proposal form contract', () => {
  it('keeps verified Google Forms entry mapping', () => {
    assert.equal(googleProposalFormContract.fields.proposalType, 'entry.1029369192');
    assert.equal(googleProposalFormContract.fields.officialSource, 'entry.1673153264');
    assert.equal(googleProposalFormContract.fields.email, 'entry.600388817');
    assert(googleProposalFormContract.values.regions.includes('Ne vem / nisem prepričan (navedem v opisu)'));
  });
  it('documents required website fields', () => assert.deepEqual([...requiredProposalFields], ['proposalType','date','title','place','region','officialSource','description','organizer','officialAnnouncement2026','email']));
  it('has SL/EN locale configuration', () => { assert.equal(proposalFormLocales.sl.submit, 'Pošlji predlog'); assert.equal(proposalFormLocales.en.submit, 'Send proposal'); assert.equal(proposalFormLocales.sl.intro, 'Predlog za nov tek, popravek ali dopolnitev podatkov se pred objavo pregleda in preveri.'); assert.deepEqual(proposalFormLocales.sl.typeLabels.sl, ['Nov tek', 'Popravek ali dopolnitev obstoječega teka', 'Drugo']); assert.deepEqual(proposalFormLocales.en.typeLabels.en, ['New race', 'Correct or add details to an existing race', 'Other']); assert.equal(proposalFormLocales.sl.labels.additionalData, 'Kaj želite popraviti ali dopolniti?'); assert.equal(proposalFormLocales.sl.labels.placeOptional, 'Kraj (neobvezno)'); assert.equal(proposalFormLocales.sl.labels.officialSource, 'Uradni vir'); assert.equal(proposalFormLocales.en.labels.officialSource, 'Official source'); assert.equal(proposalFormLocales.en.labelsForValues.yesNo.Da, 'Yes'); assert.equal(proposalFormLocales.en.labelsForValues.announcement['Ne vem'], 'I do not know'); assert.equal(proposalFormLocales.en.labelsForValues.additionalData['Trasa / zemljevid / GPX'], 'Route / map / GPX'); assert.equal(proposalFormLocales.sl.helpers.email, 'Uporabi se le za morebitna vprašanja o predlogu in se ne objavi.'); assert.equal(proposalFormLocales.sl.helpers.additionalData, 'Označite vse podatke, ki jih želite dodati ali popraviti.'); assert.equal(proposalFormLocales.en.helpers.additionalData, 'Select all the details you would like to add or correct.'); assert.equal(proposalFormLocales.sl.labelsForValues.changeCategories['Popravek napačnega dodatnega podatka'], 'Popravek že objavljenega dodatnega podatka'); assert.equal(proposalFormLocales.en.labelsForValues.changeCategories['Popravek napačnega dodatnega podatka'], 'Correction of already published additional data'); });


  it('parses safe preselected change categories and frontend mode only from allowlists', () => {
    assert.deepEqual(parsePreselectedChangeCategories('basic-date-time,Višinski metri,NEVELJAVNO,basic-date-time'), ['basic-date-time', 'Višinski metri']);
    assert.equal(parseProposalMode('new'), 'new');
    assert.equal(parseProposalMode('other'), 'other');
    assert.equal(parseProposalMode('bad'), '');
  });
  it('centralizes field visibility and keeps known context identity enabled while hidden', () => {
    const rules = getProposalFieldRules({ frontendType: 'existing', hasRaceContext: true, hasCompleteRaceIdentity: false, identity: { date: true, title: true, place: false, region: true } });
    assert.deepEqual(rules.date, { visible: false, required: false, disabled: false, keepEnabledWhenHidden: true });
    assert.deepEqual(rules.place, { visible: true, required: true, disabled: false, keepEnabledWhenHidden: false });
    assert.equal(rules.source.required, true);
  });

  it('maps combined change selections to the existing Google Forms proposal values', () => {
    assert.equal(googleProposalFormContract.values.proposalTypes.length, 4);
    assert.equal(mapExistingChangeSelectionToProposalType(['Prijavnina / startnina', 'Rok prijave']), 'Dopolnitev dodatnih podatkov obstoječega teka');
    assert.equal(mapExistingChangeSelectionToProposalType(['basic-date-time']), 'Popravek obstoječega vnosa v koledarju');
    assert.equal(mapExistingChangeSelectionToProposalType(['basic-date-time', 'Višinski metri']), 'Popravek obstoječega vnosa v koledarju');
    assert.equal(mapExistingChangeSelectionToProposalType(['Drugo']), 'Popravek obstoječega vnosa v koledarju');
    assert.deepEqual(additionalDataValuesForChangeSelection(['basic-date-time', 'Višinski metri', 'Popravek napačnega dodatnega podatka']), ['Višinski metri', 'Popravek napačnega dodatnega podatka']);
  });
  it('builds structured combined-change description and dynamic placeholders', () => {
    assert.equal(buildStructuredChangeDescription({ labels: ['Prijavnina / startnina', 'Rok prijave'], userText: 'Prijavnina: 20 €', lang: 'sl' }), 'Izbrane vrste sprememb: Prijavnina / startnina; Rok prijave\n\nPrijavnina: 20 €');
    assert.equal(buildStructuredChangeDescription({ labels: ['Entry fee'], userText: 'Selected changes: Entry fee\n\nEntry fee: €20', lang: 'en' }), 'Selected changes: Entry fee\n\nEntry fee: €20');
    assert.equal(buildChangePlaceholder({ labels: ['Prijavnina', 'Rok prijave'], lang: 'sl' }), 'Prijavnina:\nRok prijave:');
    assert.equal(buildChangePlaceholder({ labels: [], lang: 'en' }), 'Enter the missing or correct detail.');
  });
  it('keeps empty forms empty and prefills correction query safely', () => {
    const empty = readProposalPrefill(new URLSearchParams(''), 'en');
    assert.equal(empty.description, '');
    assert.equal(empty.eventTitle, '');
    const prefill = readProposalPrefill(new URLSearchParams('event=Šmarna gora&year=2027&date=2027-05-01&place=Ljubljana&source=detail&returnUrl=/tek/2027/test/&lang=en'), 'sl');
    assert.equal(prefill.eventTitle, 'Šmarna gora'); assert.equal(prefill.safeReturnUrl, '/tek/2027/test/'); assert.equal(prefill.officialSourceUrl, ''); assert.match(prefill.description, /Year: 2027/); assert.doesNotMatch(prefill.description, /Context source: detail|Kontekst vira: detail/);
  });
  it('accepts only internal returnUrl paths and http source URLs', () => { assert.equal(isSafeInternalReturnUrl('/tek/2026/a/'), true); assert.equal(isSafeInternalReturnUrl('//evil'), false); assert.equal(isSafeInternalReturnUrl('https://evil.test'), false); assert.equal(isSafeHttpUrl('detail'), false); assert.equal(isSafeHttpUrl('https://example.com/razpis'), true); });
  it('keeps 2026 and 2027 context', () => { assert.equal(getYearContext('2026-01-01'), '2026'); assert.equal(getYearContext('2027'), '2027'); });
  it('preserves fallback prefill without storing private fields in URL/localStorage', () => {
    const url = buildGoogleFormsFallbackUrl(readProposalPrefill(new URLSearchParams('event=Tek&date=2026-03-02&place=Kranj&source=detail&returnUrl=/tek/2026/tek/'), 'sl'));
    assert.match(url, /entry\.528776717=Tek/); assert.doesNotMatch(url, /entry\.600388817/); assert.doesNotMatch(url, /entry\.1673153264=detail/);
    const component = readFileSync(new URL('../src/components/RaceProposalForm.astro', import.meta.url), 'utf8');
    assert.doesNotMatch(component, /localStorage|history\.pushState|Master API|Additional API/);
    assert.match(component, /data-analytics-link-type="correction_form"/); assert.match(component, /data-additional-section hidden/); assert.match(component, /data-source-warning/);
  });
  it('does not add direct master or API writes', () => {
    const sources = ['src/components/RaceProposalForm.astro','src/proposal-form/proposal-form-controller.ts'].map((f) => readFileSync(new URL(`../${f}`, import.meta.url),'utf8')).join('\n');
    assert.doesNotMatch(sources, /fetch\(|googleapis|spreadsheets|\bD1\b|\bKV\b|master_row|Master API|Additional API/i);
  });
});
