import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { googleProposalFormContract } from '../.cache/dist-test/proposal-form/proposal-form-contract.js';
import { requiredProposalFields, isSafeInternalReturnUrl, isSafeHttpUrl, readProposalPrefill, buildGoogleFormsFallbackUrl, buildGoogleFormsSubmissionEntries, buildGoogleFormsSubmissionUrl, buildOrganizerConfirmationDescription, buildOrganizerConfirmationSubmission, getYearContext, mapExistingChangeSelectionToProposalType, additionalDataValuesForChangeSelection, buildStructuredChangeDescription, buildChangePlaceholder, parsePreselectedChangeCategories, parseProposalMode, getProposalFieldRules, additionalDataValuesForStructuredDetails, buildStructuredAdditionalDescription, combineCorrectionDescription, hasStructuredBasicCorrections, structuredBasicCorrectionFields, buildStructuredBasicCorrectionDescription, isValidStructuredBasicDate, isValidStructuredBasicUrl, isValidStructuredRouteUrl, isValidElevationGain, isValidEntryFeeRange } from '../.cache/dist-test/proposal-form/proposal-form-controller.js';
import { proposalFormLocales } from '../.cache/dist-test/proposal-form/proposal-form-locales.js';
import { buildRaceConfirmationContextUrl, buildRaceCorrectionContextUrl, searchPublicRaces } from '../.cache/dist-test/proposal-form/race-correction-context.js';

describe('proposal form contract', () => {
  it('uses plain-language hand-off and selected-race link copy', () => {
    assert.equal(proposalFormLocales.sl.googleFormHandOff, 'Predlog bo poslan v pregled. Ostali boste na tej strani.');
    assert.equal(proposalFormLocales.en.googleFormHandOff, 'The proposal will be submitted for review. You will remain on this page.');
    assert.equal(proposalFormLocales.sl.addAnotherRace, 'Dodajte nov tek');
    assert.equal(proposalFormLocales.en.addAnotherRace, 'Add a new race');
  });
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
    assert.equal(parseProposalMode('confirm'), 'confirm');
    assert.equal(parseProposalMode('bad'), '');
  });
  it('keeps other messages minimal and validates standardized fee values', () => {
    const rules = getProposalFieldRules({ frontendType: 'other', hasRaceContext: false, hasCompleteRaceIdentity: false });
    assert.equal(rules.date.visible, false); assert.equal(rules.title.visible, false); assert.equal(rules.region.visible, false);
    assert.equal(rules.source.required, false); assert.equal(rules.description.required, true); assert.equal(rules.organizer.required, true); assert.equal(rules.email.required, true);
    assert.equal(isValidEntryFeeRange('15', '25'), true); assert.equal(isValidEntryFeeRange('15', '14.99'), false);
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


  it('builds structured basic correction descriptions deterministically', () => {
    assert.equal(hasStructuredBasicCorrections({}), false);
    assert.equal(hasStructuredBasicCorrections({ date: '2026-08-02' }), true);
    assert.deepEqual(structuredBasicCorrectionFields.map((field) => field.key), ['date','title','place','region','startTime','distances','surface','noticeUrl','registrationUrl','cup']);
    const currentValues = { date: '2026-08-01', title: 'Stari tek', place: 'Kranj', startTime: '18:00', registrationUrl: 'https://example.com/stara' };
    const corrections = { registrationUrl: 'https://example.com/nova', date: '2026-08-02', startTime: '19:00', title: '' };
    assert.equal(buildStructuredBasicCorrectionDescription({ lang: 'sl', currentValues, corrections }), 'Osnovni popravki:\n\nDatum\nTrenutno: 2026-08-01\nPredlagano: 2026-08-02\n\nČas začetka\nTrenutno: 18:00\nPredlagano: 19:00\n\nPrijavna povezava\nTrenutno: https://example.com/stara\nPredlagano: https://example.com/nova');
    assert.equal(buildStructuredBasicCorrectionDescription({ lang: 'en', currentValues, corrections: { date: '2026-08-02' } }), 'Basic corrections:\n\nDate\nCurrent: 2026-08-01\nProposed: 2026-08-02');
    assert.equal(isValidStructuredBasicDate('2026-02-30'), false);
    assert.equal(isValidStructuredBasicDate('2026-02-28'), true);
    assert.equal(isValidStructuredBasicUrl('javascript:alert(1)'), false);
    assert.equal(isValidStructuredBasicUrl('https://example.com'), true);
  });

  it('combines basic corrections, explanation, and additional data in Google Forms description while preserving identity entries', () => {
    const description = combineCorrectionDescription({ lang: 'sl', basicDescription: 'Dodatno pojasnilo.', structuredBasicCorrections: { date: '2026-08-02' }, structuredBasicCurrentValues: { date: '2026-08-01' }, structuredDetails: { registrationMinEur: '20' } });
    assert.equal(description, 'Osnovni popravki:\n\nDatum\nTrenutno: 2026-08-01\nPredlagano: 2026-08-02\n\nDodatno pojasnilo.\n\nDodatni podatki:\n\nNajnižja prijavnina: 20');
    const entries = new URLSearchParams(buildGoogleFormsSubmissionEntries({ proposalType: googleProposalFormContract.values.proposalTypes[1], date: '2026-08-01', title: 'Stari tek', place: 'Kranj', region: 'Gorenjska', description, organizer: 'Ne', officialAnnouncement: 'Ne vem', email: 'test@example.com' }));
    assert.equal(entries.get(googleProposalFormContract.fields.date), '2026-08-01');
    assert.equal(entries.get(googleProposalFormContract.fields.title), 'Stari tek');
    assert.match(entries.get(googleProposalFormContract.fields.description), /Predlagano: 2026-08-02/);
  });

  it('maps structured additional details to existing Google Forms values and descriptions', () => {
    assert.deepEqual(additionalDataValuesForStructuredDetails({}), []);
    assert.deepEqual(additionalDataValuesForStructuredDetails({ registrationMinEur: '20', registrationMaxEur: '25', registrationDescription: 'Različne razdalje', registrationDeadline: '2026-08-10', cheaperRegistration: '2026-07-31', raceDayRegistration: 'Da', elevationGain: '650', routeUrl: 'https://example.com/route', otherDetails: 'Otroški teki', correctionIntent: 'correcting' }), ['Prijavnina / startnina','Rok prijave','Cenejša prijava / sprememba cene','Prijave na dan dogodka','Višinski metri','Trasa / zemljevid / GPX','Drugo','Popravek napačnega dodatnega podatka']);
    const sl = buildStructuredAdditionalDescription({ lang: 'sl', details: { registrationMinEur: '20', registrationMaxEur: '25', registrationDescription: 'Različne razdalje', elevationGain: '650' } });
    assert.equal(sl, 'Dodatni podatki:\n\nNajnižja prijavnina: 20\nNajvišja prijavnina: 25\nOpis prijavnine: Različne razdalje\nVišinski metri: 650 m+');
    assert.doesNotMatch(sl, /Rok prijave|entry\./);
    const en = buildStructuredAdditionalDescription({ lang: 'en', details: { routeUrl: 'https://example.com/route', raceDayRegistration: 'Yes' } });
    assert.equal(en, 'Additional details:\n\nRace-day registration: Yes\nRoute, map or GPX: https://example.com/route');
    const combined = combineCorrectionDescription({ lang: 'en', basicDescription: 'Date should be 2026-09-12.', structuredDetails: { registrationMinEur: '20' } });
    assert.equal(combined, 'Date should be 2026-09-12.\n\nAdditional details:\n\nMinimum entry fee: 20');
  });

  it('includes categories for added, changed, removed and unchanged structured values', () => {
    const cases = [
      ['registrationMinEur', '15', 'Prijavnina / startnina'], ['registrationMaxEur', '25', 'Prijavnina / startnina'], ['registrationDescription', 'Cena', 'Prijavnina / startnina'],
      ['registrationDeadline', '2026-08-10', 'Rok prijave'], ['cheaperRegistration', '2026-07-31', 'Cenejša prijava / sprememba cene'], ['raceDayRegistration', 'Da', 'Prijave na dan dogodka'],
      ['elevationGain', '650', 'Višinski metri'], ['routeUrl', 'https://example.com/trasa', 'Trasa / zemljevid / GPX'], ['otherDetails', 'Otroški teki', 'Drugo']
    ];
    for (const [key, value, category] of cases) {
      assert.deepEqual(additionalDataValuesForStructuredDetails({ [key]: value }), [category]);
      assert.deepEqual(additionalDataValuesForStructuredDetails({ [key]: value }, [key]), [category]);
      assert.deepEqual(additionalDataValuesForStructuredDetails({}, [key]), [category]);
      assert.deepEqual(additionalDataValuesForStructuredDetails({}), []);
    }
    assert.deepEqual(additionalDataValuesForStructuredDetails({ registrationMinEur: '25' }, ['registrationMinEur', 'routeUrl']), ['Prijavnina / startnina', 'Trasa / zemljevid / GPX']);
    assert.deepEqual(additionalDataValuesForStructuredDetails({ correctionIntent: 'correcting' }, ['routeUrl']), ['Trasa / zemljevid / GPX', 'Popravek napačnega dodatnega podatka']);
  });

  it('maps each structured entry-fee field to one canonical category', () => {
    for (const details of [{ registrationMinEur: '15' }, { registrationMaxEur: '25' }, { registrationDescription: 'Cena je odvisna od razdalje.' }, { registrationMinEur: '15', registrationMaxEur: '25', registrationDescription: 'Cena je odvisna od razdalje.' }]) {
      assert.deepEqual(additionalDataValuesForStructuredDetails(details), ['Prijavnina / startnina']);
    }
    assert.deepEqual(additionalDataValuesForStructuredDetails({ registrationMinEur: '25', routeUrl: 'https://example.com/trasa' }), ['Prijavnina / startnina', 'Trasa / zemljevid / GPX']);
  });

  it('keeps structured business values identical between direct entries and fallback URL', () => {
    const input = { proposalType: googleProposalFormContract.values.proposalTypes[2], date: '2026-09-12', title: 'Tek', place: 'Kranj', region: 'Gorenjska', officialSource: '', description: buildStructuredAdditionalDescription({ lang: 'sl', details: { registrationMinEur: '20', routeUrl: 'https://example.com/trasa' } }), organizer: 'Ne', officialAnnouncement: 'Ne vem', email: 'test@example.com', additionalData: additionalDataValuesForStructuredDetails({ registrationMinEur: '20', routeUrl: 'https://example.com/trasa' }) };
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

  it('searches public races and builds correction context URLs', () => {
    const base = { id: '1', row: '12', year: '2026', date: '2026-07-19', dateValue: Date.parse('2026-07-19T00:00:00'), title: '20. Gorski tek na Bevkov vrh – trail 2026', displayTitle: '20. Gorski tek na Bevkov vrh – trail 2026', naziv_prireditve: '20. Gorski tek na Bevkov vrh – trail 2026', place: 'Gorenje Jazne', region: 'Goriška', surface: 'trail', distances: '10.5', startTime: '10:00', noticeUrl: 'https://example.com/razpis', registrationUrl: 'https://example.com/prijava', voteUrl: '', publicNotes: '', cup: 'Pokal Primorske', familyFriendly: false, kidsRaces: false };
    const races = [base, { ...base, row: '13', title: 'Šmarna gora', naziv_prireditve: 'Šmarna gora', place: 'Ljubljana', region: 'Osrednjeslovenska' }];
    assert.equal(searchPublicRaces(races, 'bevkov')[0].row, '12');
    assert.equal(searchPublicRaces(races, 'ljubljana')[0].row, '13');
    assert.equal(searchPublicRaces(races, 'Smarna gora')[0].row, '13');
    assert.equal(searchPublicRaces([{ ...base, date: '', title: '' }, ...races], 'tek', 1).length, 1);
    const url = buildRaceCorrectionContextUrl({ ...base, additionalData: { masterRow: '12', registrationMinEur: '20', registrationMaxEur: '25', registrationDeadline: '2026-07-10', earlyRegistrationDeadline: '2026-06-30', dayOfRegistration: 'Da', elevationGain: '650', routeUrl: 'https://example.com/gpx' } }, 'sl', 'https://evil.test/');
    const parsed = new URL(url, 'https://tekaski-koledar.si');
    assert.equal(parsed.pathname, '/dodaj-ali-popravi-tek/');
    assert.equal(parsed.searchParams.get('event'), base.title);
    assert.equal(parsed.searchParams.get('eventKey'), 'r000012');
    assert.equal(parsed.searchParams.get('distances'), '10,5 km');
    assert.equal(parsed.searchParams.get('returnUrl'), '/tek/2026/r000012-20-gorski-tek-na-bevkov-vrh-trail-2026/');
    assert.equal(parsed.searchParams.get('registrationFee'), '20–25');
    assert.equal(parsed.searchParams.get('routeUrl'), 'https://example.com/gpx');
  });
  it('does not add direct master or API writes', () => {
    const sources = ['src/components/RaceProposalForm.astro','src/proposal-form/proposal-form-controller.ts'].map((f) => readFileSync(new URL(`../${f}`, import.meta.url),'utf8')).join('\n');
    assert.doesNotMatch(sources, /googleapis|spreadsheets|\bD1\b|\bKV\b|master_row|Master API|Additional API/i);
    assert.match(sources, /stk-master-api\.igor-kalsek\.workers\.dev/);
  });

  it('builds confirmation URLs from the complete shared race context', () => {
    const race = { row: '12', year: '2026', date: '2026-07-19', title: 'Testni tek', naziv_prireditve: 'Testni tek', place: 'Kranj', region: 'Gorenjska', startTime: '', distances: '', surface: '', noticeUrl: '', registrationUrl: '', cup: '' };
    for (const [lang, path, returnUrl] of [['sl', '/dodaj-ali-popravi-tek/', '/tek/2026/test/'], ['en', '/en/add-or-correct-race/', '/en/races/2026/test/']]) {
      const parsed = new URL(buildRaceConfirmationContextUrl(race, lang, returnUrl), 'https://tekaski-koledar.si');
      assert.equal(parsed.pathname, path); assert.equal(parsed.searchParams.get('mode'), 'confirm');
      assert.equal(parsed.searchParams.get('eventKey'), 'r000012'); assert.equal(parsed.searchParams.get('year'), '2026');
      assert.equal(parsed.searchParams.get('date'), race.date); assert.equal(parsed.searchParams.get('event'), race.title);
      assert.equal(parsed.searchParams.get('place'), race.place); assert.equal(parsed.searchParams.get('returnUrl'), returnUrl);
    }
  });

  it('builds deterministic organizer confirmation description and existing-contract payload', () => {
    const prefill = readProposalPrefill(new URLSearchParams('event=Testni%20tek&eventKey=r000012&year=2026&date=2026-07-19&place=Kranj&region=Gorenjska&officialSource=https%3A%2F%2Fexample.com%2Frazpis'), 'sl');
    const details = { organization: 'ŠD Test', contactPerson: '', email: 'org@example.com', note: '', submissionDate: new Date('2026-07-15T22:30:00Z') };
    assert.equal(buildOrganizerConfirmationDescription({ ...prefill, ...details }), 'Vrsta predloga: Potrditev podatkov organizatorja\nEvent key: r000012\nLeto: 2026\nNaziv teka: Testni tek\nDatum: 2026-07-19\nKraj: Kranj\nOrganizacija: ŠD Test\nKontaktna oseba: \nKontaktni e-naslov: org@example.com\nPotrditvena izjava: Da\nOpomba: \nDatum oddaje: 2026-07-16');
    const submission = buildOrganizerConfirmationSubmission(prefill, details);
    assert.equal(submission.proposalType, googleProposalFormContract.values.proposalTypes[1]);
    assert.deepEqual([submission.date, submission.title, submission.place, submission.region, submission.organizer, submission.officialAnnouncement], ['2026-07-19', 'Testni tek', 'Kranj', 'Gorenjska', 'Da', 'Ne vem']);
    assert.deepEqual(submission.additionalData, []);
    const entries = buildGoogleFormsSubmissionEntries(submission);
    assert.equal(entries.some(([name]) => name === googleProposalFormContract.fields.additionalData), false);
    assert.deepEqual(new Set(entries.map(([name]) => name)), new Set(Object.values(googleProposalFormContract.fields).filter((name) => name !== googleProposalFormContract.fields.additionalData)));
  });
});
