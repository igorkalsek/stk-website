import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { googleProposalFormContract } from '../.cache/dist-test/proposal-form/proposal-form-contract.js';
import { requiredProposalFields, isSafeInternalReturnUrl, isSafeHttpUrl, readProposalPrefill, buildGoogleFormsFallbackUrl, buildGoogleFormsSubmissionEntries, buildGoogleFormsSubmissionUrl, getYearContext, mapExistingChangeSelectionToProposalType, additionalDataValuesForChangeSelection, buildStructuredChangeDescription, buildChangePlaceholder, parsePreselectedChangeCategories, parseProposalMode, getProposalFieldRules, additionalDataValuesForStructuredDetails, buildStructuredAdditionalDescription, combineCorrectionDescription, isValidStructuredRouteUrl, isValidElevationGain } from '../.cache/dist-test/proposal-form/proposal-form-controller.js';
import { proposalFormLocales } from '../.cache/dist-test/proposal-form/proposal-form-locales.js';

describe('proposal form contract', () => {
  it('keeps verified Google Forms entry mapping', () => {
    assert.equal(googleProposalFormContract.fields.proposalType, 'entry.1029369192');
    assert.equal(googleProposalFormContract.fields.officialSource, 'entry.1673153264');
    assert.equal(googleProposalFormContract.fields.email, 'entry.600388817');
    assert(googleProposalFormContract.values.regions.includes('Ne vem / nisem prepričan (navedem v opisu)'));
  });
  it('documents required website fields', () => assert.deepEqual([...requiredProposalFields], ['proposalType','date','title','place','region','description','organizer','officialAnnouncement2026','email']));
  it('has SL/EN locale configuration', () => { assert.equal(proposalFormLocales.sl.submit, 'Pošlji predlog'); assert.equal(proposalFormLocales.en.submit, 'Send proposal'); assert.equal(proposalFormLocales.sl.intro, 'Predlog za nov tek, popravek ali dopolnitev podatkov se pred objavo pregleda in preveri.'); assert.deepEqual(proposalFormLocales.sl.typeLabels.sl, ['Nov tek', 'Popravek ali dopolnitev obstoječega teka', 'Drugo']); assert.deepEqual(proposalFormLocales.en.typeLabels.en, ['New race', 'Correct or add details to an existing race', 'Other']); assert.equal(proposalFormLocales.sl.labels.additionalData, 'Kaj želite popraviti ali dopolniti?'); assert.equal(proposalFormLocales.sl.labels.placeOptional, 'Kraj (neobvezno)'); assert.equal(proposalFormLocales.sl.labels.officialSource, 'Uradni vir (neobvezno)'); assert.equal(proposalFormLocales.en.labels.officialSource, 'Official source (optional)' ); assert.equal(proposalFormLocales.en.labelsForValues.yesNo.Da, 'Yes'); assert.equal(proposalFormLocales.en.labelsForValues.announcement['Ne vem'], 'I do not know'); assert.equal(proposalFormLocales.en.labelsForValues.additionalData['Trasa / zemljevid / GPX'], 'Route / map / GPX'); assert.equal(proposalFormLocales.sl.helpers.email, 'Uporabi se le za morebitna vprašanja o predlogu in se ne objavi.'); assert.equal(proposalFormLocales.sl.helpers.additionalData, 'Izberite osnovni popravek ali spodaj vnesite dodatne podatke v ločena polja.'); assert.equal(proposalFormLocales.en.helpers.additionalData, 'Select a basic correction or enter additional details in the separate fields below.'); assert.equal(proposalFormLocales.sl.labelsForValues.changeCategories['Popravek napačnega dodatnega podatka'], 'Popravek že objavljenega dodatnega podatka'); assert.equal(proposalFormLocales.en.labelsForValues.changeCategories['Popravek napačnega dodatnega podatka'], 'Correction of already published additional data'); });


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
    assert.equal(rules.source.required, false);
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

  it('maps structured additional details to existing Google Forms values and descriptions', () => {
    assert.deepEqual(additionalDataValuesForStructuredDetails({}), []);
    assert.deepEqual(additionalDataValuesForStructuredDetails({ entryFee: '20 €', registrationDeadline: '2026-08-10', cheaperRegistration: 'nižja cena do 2026-07-31', raceDayRegistration: 'Da', elevationGain: '650', routeUrl: 'https://example.com/route', otherDetails: 'Otroški teki', correctionIntent: 'correcting' }), ['Prijavnina / startnina','Rok prijave','Cenejša prijava / sprememba cene','Prijave na dan dogodka','Višinski metri','Trasa / zemljevid / GPX','Drugo','Popravek napačnega dodatnega podatka']);
    const sl = buildStructuredAdditionalDescription({ lang: 'sl', details: { entryFee: '20 €', elevationGain: '650' } });
    assert.equal(sl, 'Dodatni podatki:\n\nPrijavnina / startnina: 20 €\nVišinski metri: 650 m+');
    assert.doesNotMatch(sl, /Rok prijave|entry\./);
    const en = buildStructuredAdditionalDescription({ lang: 'en', details: { routeUrl: 'https://example.com/route', raceDayRegistration: 'Yes' } });
    assert.equal(en, 'Additional details:\n\nRace-day registration: Yes\nRoute, map or GPX: https://example.com/route');
    const combined = combineCorrectionDescription({ lang: 'en', basicDescription: 'Date should be 2026-09-12.', structuredDetails: { entryFee: '€20' } });
    assert.equal(combined, 'Date should be 2026-09-12.\n\nAdditional details:\n\nEntry fee: €20');
  });

  it('keeps structured business values identical between direct entries and fallback URL', () => {
    const input = { proposalType: googleProposalFormContract.values.proposalTypes[2], date: '2026-09-12', title: 'Tek', place: 'Kranj', region: 'Gorenjska', officialSource: '', description: buildStructuredAdditionalDescription({ lang: 'sl', details: { entryFee: '20 €', routeUrl: 'https://example.com/trasa' } }), organizer: 'Ne', officialAnnouncement: 'Ne vem', email: 'test@example.com', additionalData: additionalDataValuesForStructuredDetails({ entryFee: '20 €', routeUrl: 'https://example.com/trasa' }) };
    const direct = new URLSearchParams(buildGoogleFormsSubmissionEntries(input));
    const fallback = new URL(buildGoogleFormsSubmissionUrl(input)).searchParams;
    assert.equal(direct.get(googleProposalFormContract.fields.description), fallback.get(googleProposalFormContract.fields.description));
    assert.deepEqual(direct.getAll(googleProposalFormContract.fields.additionalData), fallback.getAll(googleProposalFormContract.fields.additionalData));
  });

  it('validates structured route URLs and elevation values', () => {
    assert.equal(isValidStructuredRouteUrl('https://example.com/route'), true);
    assert.equal(isValidStructuredRouteUrl('http://example.com/route'), true);
    assert.equal(isValidStructuredRouteUrl('ftp://example.com/route'), false);
    assert.equal(isValidElevationGain('0'), true);
    assert.equal(isValidElevationGain('650'), true);
    assert.equal(isValidElevationGain('-1'), false);
    assert.equal(isValidElevationGain('1.5'), false);
  });

  it('keeps empty forms empty and prefills correction query safely', () => {
    const empty = readProposalPrefill(new URLSearchParams(''), 'en');
    assert.equal(empty.description, '');
    assert.equal(empty.eventTitle, '');
    const prefill = readProposalPrefill(new URLSearchParams('event=Šmarna gora&year=2027&date=2027-05-01&place=Ljubljana&source=detail&returnUrl=/tek/2027/test/&lang=en'), 'sl');
    assert.equal(prefill.eventTitle, 'Šmarna gora'); assert.equal(prefill.safeReturnUrl, '/tek/2027/test/'); assert.equal(prefill.officialSourceUrl, '');
    const noticePrefill = readProposalPrefill(new URLSearchParams('event=Šmarna gora&year=2027&date=2027-05-01&place=Ljubljana&source=detail&noticeUrl=https%3A%2F%2Fexample.com%2Frazpis&returnUrl=/tek/2027/test/&lang=sl'), 'sl');
    assert.equal(noticePrefill.officialSourceUrl, 'https://example.com/razpis'); assert.match(prefill.description, /Year: 2027/); assert.doesNotMatch(prefill.description, /Context source: detail|Kontekst vira: detail/);
  });
  it('accepts only internal returnUrl paths and http source URLs', () => { assert.equal(isSafeInternalReturnUrl('/tek/2026/a/'), true); assert.equal(isSafeInternalReturnUrl('//evil'), false); assert.equal(isSafeInternalReturnUrl('https://evil.test'), false); assert.equal(isSafeHttpUrl('detail'), false); assert.equal(isSafeHttpUrl('https://example.com/razpis'), true); });
  it('keeps 2026 and 2027 context', () => { assert.equal(getYearContext('2026-01-01'), '2026'); assert.equal(getYearContext('2027'), '2027'); });

  it('builds canonical Google Forms submission entries including repeated additional data', () => {
    const entries = buildGoogleFormsSubmissionEntries({ proposalType: 'Popravek obstoječega vnosa v koledarju', date: '2026-09-12', title: 'Tek', place: 'Kranj', region: 'Gorenjska', officialSource: '', description: 'Izbrane vrste sprememb: Prijavnina / startnina\n\nPrijavnina 20 €.', organizer: 'Ne', officialAnnouncement: 'Ne vem', email: 'test@example.com', additionalData: ['Prijavnina / startnina', 'basic-date-time', 'Popravek napačnega dodatnega podatka'] });
    const params = new URLSearchParams(entries);
    assert.equal(params.get(googleProposalFormContract.fields.officialSource), '');
    assert.equal(params.get(googleProposalFormContract.fields.dateYear), '2026');
    assert.equal(params.get(googleProposalFormContract.fields.dateMonth), '9');
    assert.equal(params.get(googleProposalFormContract.fields.dateDay), '12');
    assert.equal(params.get(googleProposalFormContract.fields.description), 'Izbrane vrste sprememb: Prijavnina / startnina\n\nPrijavnina 20 €.');
    assert.deepEqual(params.getAll(googleProposalFormContract.fields.additionalData), ['Prijavnina / startnina', 'Popravek napačnega dodatnega podatka']);
  });

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
