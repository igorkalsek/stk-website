import { googleProposalFormContract } from './proposal-form-contract.js';
import type { ProposalLanguage } from './proposal-form-types.js';

const typeLabels = {
  sl: ['Nov tek', 'Popravek ali dopolnitev obstoječega teka', 'Drugo'],
  en: ['New race', 'Correct or add details to an existing race', 'Other']
} as const;

const regionLabelsEn: Record<string, string> = { Pomurska: 'Mura region', Podravska: 'Drava region', Koroška: 'Carinthia', Savinjska: 'Savinja region', Zasavska: 'Central Sava', Posavska: 'Lower Sava', Jugovzhodna: 'Southeast Slovenia', 'Primorsko-notranjska': 'Primorska-Inner Carniola', Osrednjeslovenska: 'Central Slovenia', Gorenjska: 'Upper Carniola', Goriška: 'Gorizia region', 'Obalno-kraška': 'Coastal-Karst', 'Ne vem / nisem prepričan (navedem v opisu)': 'I do not know / I am not sure (I will explain in the description)' };
const additionalDataLabelsEn: Record<string, string> = { 'Prijavnina / startnina': 'Entry fee / start fee', 'Rok prijave': 'Registration deadline', 'Cenejša prijava / sprememba cene': 'Early-bird registration / price change', 'Prijave na dan dogodka': 'Race-day registration', 'Trasa / zemljevid / GPX': 'Route / map / GPX', 'Višinski metri': 'Elevation gain', 'Popravek napačnega dodatnega podatka': 'Correction of already published additional data', Drugo: 'Other – describe below' };

const changeCategoryLabels = {
  sl: {
    'basic-date-time': 'Datum ali ura',
    'basic-title-place': 'Naziv ali kraj',
    'basic-distance-surface': 'Razdalje ali vrsta podlage',
    'basic-official-source': 'Razpis, prijavna povezava ali drug uradni vir',
    'basic-cup-series': 'Pokal ali tekaška serija',
    'Prijavnina / startnina': 'Prijavnina / startnina',
    'Rok prijave': 'Rok prijave',
    'Cenejša prijava / sprememba cene': 'Cenejša prijava / sprememba cene',
    'Prijave na dan dogodka': 'Prijave na dan dogodka',
    'Trasa / zemljevid / GPX': 'Trasa / zemljevid / GPX',
    'Višinski metri': 'Višinski metri',
    'Popravek napačnega dodatnega podatka': 'Popravek že objavljenega dodatnega podatka',
    Drugo: 'Drugo – navedite v pojasnilu'
  },
  en: {
    'basic-date-time': 'Date or time',
    'basic-title-place': 'Name or place',
    'basic-distance-surface': 'Distances or surface type',
    'basic-official-source': 'Race announcement, registration link or other official source',
    'basic-cup-series': 'Cup or running series',
    'Prijavnina / startnina': 'Entry fee / start fee',
    'Rok prijave': 'Registration deadline',
    'Cenejša prijava / sprememba cene': 'Early-bird registration / price change',
    'Prijave na dan dogodka': 'Race-day registration',
    'Trasa / zemljevid / GPX': 'Route / map / GPX',
    'Višinski metri': 'Elevation gain',
    'Popravek napačnega dodatnega podatka': 'Correction of already published additional data',
    Drugo: 'Other – describe below'
  }
} as const;

export const proposalFormLocales = {
  sl: {
    title: 'Dodajte ali popravite tek', eyebrow: 'Predlogi in popravki', intro: 'Predlog za nov tek, popravek ali dopolnitev podatkov se pred objavo pregleda in preveri.',
    notAuto: 'Predlog se ne objavi samodejno. Uradni vir omogoča hitrejše preverjanje podatkov. Kontaktni e-naslov se uporabi samo za morebitna dodatna pojasnila in se ne objavi.',
    chooseType: 'Najprej izberite vrsto predloga', submit: 'Pošlji predlog', submitting: 'Pošiljanje …', sent: 'Predlog je bil poslan v Google obrazec. Če se ne zabeleži, uporabite rezervni obrazec.', clear: 'Počisti obrazec', newProposal: 'Oddajte nov predlog', backToCalendar: 'Nazaj na koledar', cleanPath: '/dodaj-ali-popravi-tek/', calendarPath: '/', fallback: 'Imate težave z oddajo? Odprite rezervni obrazec.', selected: 'Izbrani tek za popravek', back: 'Nazaj na stran teka', noSource: 'Izpolnite samo podatke, ki so pomembni za izbrano vrsto predloga.', errorTitle: 'Preverite označena polja:', sourceError: 'Vnesite celoten spletni naslov, na primer https://organizator.si/razpis.', dateError: 'Vnesite datum v obliki LLLL-MM-DD.', resetConfirm: 'Želite počistiti vnesene spremembe in obnoviti podatke izbranega teka?', sourceWarning: 'To je povezava na Slovenski Tekaški Koledar, ne na uradni vir dogodka. Dodajte stran organizatorja ali pustite polje prazno.', changeError: 'Označite vsaj en podatek, ki ga želite popraviti ali dopolniti.', selectedChanges: 'Izbrani podatki', contextTitle: 'Popravek ali dopolnitev za izbrani tek', currentDetails: 'Trenutno objavljeni podatki', missing: 'Ni podatka', correct: 'Popravi', add: 'Dopolni', addAnotherRace: 'Dodajte drug tek', sendOther: 'Pošljite drugo sporočilo', showAllChanges: 'Prikažite vse možnosti', showFewerChanges: 'Prikažite manj možnosti', addMissingDetails: 'Dopolnite manjkajoče podatke', aboutProposal: 'O predlogu', aboutProposalHelper: 'Podatka pomagata pri preverjanju in pravilni obravnavi predloga.', otherCorrectionOptions: 'Druge možnosti popravka', basicDetails: 'Osnovni podatki', extraDetails: 'Dodatni podatki',
    labels: { proposalType: 'Tip predloga', date: 'Datum', title: 'Naziv prireditve', place: 'Kraj', region: 'Regija', officialSource: 'Uradni vir', description: 'Opis oziroma podrobnosti', organizer: 'Ali ste organizator?', officialAnnouncement2026: 'Ali je za izbrano leto že objavljen uradni razpis ali uradna objava?', email: 'Kontaktni e-naslov', additionalData: 'Kaj želite popraviti ali dopolniti?', placeOptional: 'Kraj (neobvezno)' },
    helpers: { officialSource: 'Povezava do razpisa, strani organizatorja ali prijavnega portala.', newDescription: 'Dodajte podatke, ki še niso zajeti v zgornjih poljih.', correctionDescription: 'Navedite obstoječi in pravilen podatek.', additionalData: 'Označite vse podatke, ki jih želite dodati ali popraviti.', additionalDescription: 'Za vsako označeno možnost navedite konkretno novo vrednost, povezavo ali opišite popravek.', email: 'Uporabi se le za morebitna vprašanja o predlogu in se ne objavi.', privacy: 'Več o projektu in zasebnosti.' },
    placeholders: { description: 'Napišite, kaj dodajate ali popravljate.', newDescription: 'Npr. razdalje, čas starta, vrsta podlage, prijavnina in povezava za prijavo.', otherDescription: 'Napišite sporočilo ali pojasnite predlog.', additionalDescription: 'Primer: prijavnina 20 € do 1. avgusta; rok prijave 10. avgust; višinski metri 650 m; trasa: https://…', officialSource: 'https://organizator.si/razpis' },
    dynamicLabels: { newDescription: 'Dodatni podatki o teku', correctionDescription: 'Kaj je napačno in kako naj se podatek popravi?', additionalDescription: 'Vnesite manjkajoče ali pravilne podatke' },
    typeLabels, labelsForValues: { yesNo: { Da: 'Da', Ne: 'Ne' }, announcement: { Da: 'Da', Ne: 'Ne', 'Ne vem': 'Ne vem' }, regions: Object.fromEntries(googleProposalFormContract.values.regions.map((value) => [value, value])), additionalData: Object.fromEntries(googleProposalFormContract.values.additionalData.map((value) => [value, value === 'Drugo' ? 'Drugo – navedite v pojasnilu' : value === 'Popravek napačnega dodatnega podatka' ? 'Popravek že objavljenega dodatnega podatka' : value])), changeCategories: changeCategoryLabels.sl }
  },
  en: {
    title: 'Add or correct a race', eyebrow: 'Submissions and corrections', intro: 'A proposal for a new race, correction or additional information is reviewed and verified before publication.',
    notAuto: 'Submissions are not published automatically. An official source makes verification faster. The contact email is used only for possible clarification and is not published.',
    chooseType: 'First choose the proposal type', submit: 'Send proposal', submitting: 'Submitting …', sent: 'The proposal was sent to the Google form. If it was not recorded, use the backup form.', clear: 'Clear form', newProposal: 'Submit a new proposal', backToCalendar: 'Back to calendar', cleanPath: '/en/add-or-correct-race/', calendarPath: '/en/', fallback: 'Having trouble submitting? Open the backup form.', selected: 'Selected race for correction', back: 'Back to race page', noSource: 'Fill in only the details that matter for the selected proposal type.', errorTitle: 'Check the highlighted fields:', sourceError: 'Enter the full web address, for example https://organizator.si/razpis.', dateError: 'Enter the date in YYYY-MM-DD format.', resetConfirm: 'Clear your changes and restore the selected race details?', sourceWarning: 'This is a Slovenski Tekaški Koledar link, not the official race source. Add the organiser page or leave the field empty.', changeError: 'Select at least one detail you would like to correct or add.', selectedChanges: 'Selected details', contextTitle: 'Correct or add details for the selected race', currentDetails: 'Currently published details', missing: 'Not available', correct: 'Correct', add: 'Add', addAnotherRace: 'Add another race', sendOther: 'Send another message', showAllChanges: 'Show all options', showFewerChanges: 'Show fewer options', addMissingDetails: 'Add missing details', aboutProposal: 'About the proposal', aboutProposalHelper: 'These details help verify and route the proposal correctly.', otherCorrectionOptions: 'Other correction options', basicDetails: 'Basic details', extraDetails: 'Additional details',
    labels: { proposalType: 'Proposal type', date: 'Date', title: 'Race name', place: 'Place', region: 'Region', officialSource: 'Official source', description: 'Description or details', organizer: 'Are you the organizer?', officialAnnouncement2026: 'Has the official announcement for the selected year already been published?', email: 'Contact email', additionalData: 'What would you like to correct or add?', placeOptional: 'Place (optional)' },
    helpers: { officialSource: 'Link to the race announcement, organiser page or registration portal.', newDescription: 'Add details that are not already covered by the fields above.', correctionDescription: 'Include the existing detail and the correct detail.', additionalData: 'Select all the details you would like to add or correct.', additionalDescription: 'For each selected item, enter the new value, link or describe the correction.', email: 'It is used only for possible questions about the proposal and is not published.', privacy: 'More about the project and privacy.' },
    placeholders: { description: 'Describe what should be added or corrected.', newDescription: 'For example distances, start time, surface type, entry fee and registration link.', otherDescription: 'Write your message or explain the proposal.', additionalDescription: 'Example: entry fee €20 until 1 August; registration deadline 10 August; elevation gain 650 m; route: https://…', officialSource: 'https://organizator.si/razpis' },
    dynamicLabels: { newDescription: 'Additional race details', correctionDescription: 'What is wrong and how should it be corrected?', additionalDescription: 'Enter the missing or correct details' },
    typeLabels, labelsForValues: { yesNo: { Da: 'Yes', Ne: 'No' }, announcement: { Da: 'Yes', Ne: 'No', 'Ne vem': 'I do not know' }, regions: regionLabelsEn, additionalData: additionalDataLabelsEn, changeCategories: changeCategoryLabels.en }
  }
} as const;

export const proposalTypeOptions = (lang: ProposalLanguage) => ['new', 'existing', 'other'].map((value, index) => ({ value, label: proposalFormLocales[lang].typeLabels[lang][index] }));
