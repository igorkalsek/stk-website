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
    title: 'Dodajte ali popravite tek', eyebrow: 'Predlogi in popravki', intro: 'Pošljite predlog za nov tek, popravek ali dopolnitev podatkov. Pred objavo bomo podatke pregledali in preverili.',
    notAuto: 'Predlog ne bo objavljen samodejno. Uradni vir nam pomaga, da podatke preverimo hitreje. Vaš e-naslov uporabimo samo, če potrebujemo dodatno pojasnilo, in ga ne objavimo.',
    chooseType: 'Najprej izberite vrsto predloga', submit: 'Pošlji predlog', submitting: 'Pošiljanje …', sent: 'Oddaja je bila poslana. Če naletite na težave ali želite preveriti oddajo, uporabite rezervni obrazec spodaj.', clear: 'Počisti obrazec', newProposal: 'Oddajte nov predlog', backToCalendar: 'Nazaj na koledar', cleanPath: '/dodaj-ali-popravi-tek/', calendarPath: '/', fallback: 'Imate težave z oddajo? Odprite rezervni obrazec.', selected: 'Izbrani tek za popravek', back: 'Nazaj na stran teka', noSource: 'Izpolnite samo podatke, ki so pomembni za izbrano vrsto predloga.', errorTitle: 'Preverite označena polja:', sourceError: 'Vnesite celoten spletni naslov, na primer https://organizator.si/razpis.', resetConfirm: 'Želite počistiti vnesene spremembe in obnoviti podatke izbranega teka?', sourceWarning: 'To je povezava na Slovenski Tekaški Koledar, ne na uradni vir dogodka. Dodajte stran organizatorja ali pustite polje prazno.', changeError: 'Označite vsaj en podatek, ki ga želite popraviti ali dopolniti.', selectedChanges: 'Izbrano:',
    labels: { proposalType: 'Tip predloga', date: 'Datum', title: 'Naziv prireditve', place: 'Kraj', region: 'Regija', officialSource: 'Uradni vir', description: 'Opis oziroma podrobnosti', organizer: 'Ali ste organizator?', officialAnnouncement2026: 'Ali je za izbrano leto že objavljen uradni razpis ali uradna objava?', email: 'Kontaktni e-naslov', additionalData: 'Kaj želite popraviti ali dopolniti?', placeOptional: 'Kraj (neobvezno)' },
    helpers: { officialSource: 'Povezava do razpisa, strani organizatorja ali prijavnega portala.', newDescription: 'Navedite razdalje, uro starta, vrsto podlage, prijave in druge pomembne informacije.', correctionDescription: 'Navedite obstoječi in pravilen podatek.', additionalData: 'Označite vse podatke, ki jih želite dodati ali popraviti.', additionalDescription: 'Za vsako označeno možnost navedite konkretno novo vrednost, povezavo ali opišite popravek.', email: 'Uporabimo ga le za morebitna vprašanja o predlogu. Ne bo javno objavljen.', privacy: 'Več o projektu in zasebnosti.' },
    placeholders: { description: 'Napišite, kaj dodajate ali popravljate.', additionalDescription: 'Primer: prijavnina 20 € do 1. avgusta; rok prijave 10. avgust; višinski metri 650 m; trasa: https://…', officialSource: 'https://organizator.si/razpis' },
    dynamicLabels: { newDescription: 'Dodatni podatki o teku', correctionDescription: 'Kaj je napačno in kako naj se podatek popravi?', additionalDescription: 'Vnesite manjkajoče ali pravilne podatke' },
    typeLabels, labelsForValues: { yesNo: { Da: 'Da', Ne: 'Ne' }, announcement: { Da: 'Da', Ne: 'Ne', 'Ne vem': 'Ne vem' }, regions: Object.fromEntries(googleProposalFormContract.values.regions.map((value) => [value, value])), additionalData: Object.fromEntries(googleProposalFormContract.values.additionalData.map((value) => [value, value === 'Drugo' ? 'Drugo – navedite v pojasnilu' : value === 'Popravek napačnega dodatnega podatka' ? 'Popravek že objavljenega dodatnega podatka' : value])), changeCategories: changeCategoryLabels.sl }
  },
  en: {
    title: 'Add or correct a race', eyebrow: 'Submissions and corrections', intro: 'Send a proposal for a new race, a correction or additional details. We will review and verify the information before publication.',
    notAuto: 'The proposal will not be published automatically. An official source helps us verify the details faster. We use your email address only if we need clarification, and we do not publish it.',
    chooseType: 'First choose the proposal type', submit: 'Send proposal', submitting: 'Submitting …', sent: 'The submission was sent. If you run into issues or want to verify it, use the backup form below.', clear: 'Clear form', newProposal: 'Submit a new proposal', backToCalendar: 'Back to calendar', cleanPath: '/en/add-or-correct-race/', calendarPath: '/en/', fallback: 'Having trouble submitting? Open the backup form.', selected: 'Selected race for correction', back: 'Back to race page', noSource: 'Fill in only the details that matter for the selected proposal type.', errorTitle: 'Check the highlighted fields:', sourceError: 'Enter the full web address, for example https://organizator.si/razpis.', resetConfirm: 'Clear your changes and restore the selected race details?', sourceWarning: 'This is a Slovenski Tekaški Koledar link, not the official race source. Add the organiser page or leave the field empty.', changeError: 'Select at least one detail you would like to correct or add.', selectedChanges: 'Selected:',
    labels: { proposalType: 'Proposal type', date: 'Date', title: 'Race name', place: 'Place', region: 'Region', officialSource: 'Official source', description: 'Description or details', organizer: 'Are you the organizer?', officialAnnouncement2026: 'Has the official announcement for the selected year already been published?', email: 'Contact email', additionalData: 'What would you like to correct or add?', placeOptional: 'Place (optional)' },
    helpers: { officialSource: 'Link to the race announcement, organiser page or registration portal.', newDescription: 'Include distances, start time, surface, registration and other important details.', correctionDescription: 'Include the existing detail and the correct detail.', additionalData: 'Select all the details you would like to add or correct.', additionalDescription: 'For each selected item, enter the new value, link or describe the correction.', email: 'We use it only for possible questions about the proposal. It will not be published.', privacy: 'More about the project and privacy.' },
    placeholders: { description: 'Describe what should be added or corrected.', additionalDescription: 'Example: entry fee €20 until 1 August; registration deadline 10 August; elevation gain 650 m; route: https://…', officialSource: 'https://organizator.si/razpis' },
    dynamicLabels: { newDescription: 'Additional race details', correctionDescription: 'What is wrong and how should it be corrected?', additionalDescription: 'Enter the missing or correct details' },
    typeLabels, labelsForValues: { yesNo: { Da: 'Yes', Ne: 'No' }, announcement: { Da: 'Yes', Ne: 'No', 'Ne vem': 'I do not know' }, regions: regionLabelsEn, additionalData: additionalDataLabelsEn, changeCategories: changeCategoryLabels.en }
  }
} as const;

export const proposalTypeOptions = (lang: ProposalLanguage) => ['new', 'existing', 'other'].map((value, index) => ({ value, label: proposalFormLocales[lang].typeLabels[lang][index] }));
