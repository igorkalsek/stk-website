import { googleProposalFormContract } from './proposal-form-contract.js';
import type { ProposalLanguage } from './proposal-form-types.js';

const typeLabels = {
  sl: ['Nov tek', 'Popravek ali dopolnitev obstoječega teka', 'Dopolnitev dodatnih podatkov', 'Drugo'],
  en: ['New race', 'Correction or update for an existing race', 'Additional race data', 'Other']
} as const;

const regionLabelsEn: Record<string, string> = {
  Pomurska: 'Mura region',
  Podravska: 'Drava region',
  Koroška: 'Carinthia',
  Savinjska: 'Savinja region',
  Zasavska: 'Central Sava',
  Posavska: 'Lower Sava',
  Jugovzhodna: 'Southeast Slovenia',
  'Primorsko-notranjska': 'Primorska-Inner Carniola',
  Osrednjeslovenska: 'Central Slovenia',
  Gorenjska: 'Upper Carniola',
  Goriška: 'Gorizia region',
  'Obalno-kraška': 'Coastal-Karst',
  'Ne vem / nisem prepričan (navedem v opisu)': 'I do not know / I am not sure (I will explain in the description)'
};

const additionalDataLabelsEn: Record<string, string> = {
  'Prijavnina / startnina': 'Entry fee / start fee',
  'Rok prijave': 'Registration deadline',
  'Cenejša prijava / sprememba cene': 'Early-bird registration / price change',
  'Prijave na dan dogodka': 'Race-day registration',
  'Trasa / zemljevid / GPX': 'Route / map / GPX',
  'Višinski metri': 'Elevation gain',
  'Popravek napačnega dodatnega podatka': 'Correction of incorrect additional data',
  Drugo: 'Other'
};

export const proposalFormLocales = {
  sl: {
    title: 'Dodajte ali popravite tek', eyebrow: 'Predlogi in popravki', intro: 'Predlog izpolnite na STK. Oddaja gre v obstoječi Google Forms tok in pred objavo ostane ročno preverjena.',
    notAuto: 'Predlog ni objavljen samodejno. Ročno ga preverimo; uradni vir bistveno pospeši preverjanje. Kontaktni e-naslov ni javno objavljen.',
    chooseType: 'Najprej izberite vrsto predloga', submit: 'Pošlji predlog', submitting: 'Pošiljanje …', sent: 'Oddaja je bila poslana obstoječemu Google Forms obrazcu. Zaradi cross-origin omejitev ne moremo potrditi, da jo je Google zagotovo shranil.', clear: 'Počisti obrazec', newProposal: 'Oddajte nov predlog', cleanPath: '/dodaj-ali-popravi-tek/', fallback: 'Odprite obrazec v Google Forms', selected: 'Izbrani tek za popravek', back: 'Nazaj na stran teka', noSource: 'Vir ni obvezen, vendar bo preverjanje brez uradnega vira počasnejše.', errorTitle: 'Preverite označena polja:', sourceError: 'Vnesite varen URL, ki se začne s http:// ali https://.',
    labels: { proposalType: 'Tip predloga', date: 'Datum', title: 'Naziv prireditve', place: 'Kraj', region: 'Regija', officialSource: 'Povezava do uradnega vira', description: 'Opis oziroma podrobnosti', organizer: 'Ali ste organizator?', officialAnnouncement2026: 'Ali je za izbrano leto že objavljen uradni razpis ali uradna objava?', email: 'Kontaktni e-naslov', additionalData: 'Katere dodatne podatke želite dopolniti? (neobvezno)' },
    placeholders: { description: 'Napišite, kaj dodajate ali popravljate. Pri popravku navedite napačen in pravilen podatek.' },
    typeLabels,
    labelsForValues: { yesNo: { Da: 'Da', Ne: 'Ne' }, announcement: { Da: 'Da', Ne: 'Ne', 'Ne vem': 'Ne vem' }, regions: Object.fromEntries(googleProposalFormContract.values.regions.map((value) => [value, value])), additionalData: Object.fromEntries(googleProposalFormContract.values.additionalData.map((value) => [value, value])) }
  },
  en: {
    title: 'Add or correct a race', eyebrow: 'Submissions and corrections', intro: 'Fill in the proposal on STK. Submission still goes through the existing Google Forms flow and remains manually reviewed before publication.',
    notAuto: 'The proposal is not published automatically. We review it manually; an official source makes review much faster. The contact email is not published.',
    chooseType: 'First choose the proposal type', submit: 'Send proposal', submitting: 'Submitting …', sent: 'The submission was sent to the existing Google Forms form. Because of cross-origin limits, STK cannot confirm that Google definitely stored it.', clear: 'Clear form', newProposal: 'Submit a new proposal', cleanPath: '/en/add-or-correct-race/', fallback: 'Open the form in Google Forms', selected: 'Selected race for correction', back: 'Back to race page', noSource: 'A source is not required, but review will be slower without an official source.', errorTitle: 'Check the highlighted fields:', sourceError: 'Enter a safe URL that starts with http:// or https://.',
    labels: { proposalType: 'Proposal type', date: 'Date', title: 'Race name', place: 'Place', region: 'Region', officialSource: 'Official source link', description: 'Description or details', organizer: 'Are you the organizer?', officialAnnouncement2026: 'Has the official announcement for the selected year already been published?', email: 'Contact email', additionalData: 'Which additional data would you like to update? (optional)' },
    placeholders: { description: 'Describe what should be added or corrected. For corrections, include the wrong and correct detail.' },
    typeLabels,
    labelsForValues: { yesNo: { Da: 'Yes', Ne: 'No' }, announcement: { Da: 'Yes', Ne: 'No', 'Ne vem': 'I do not know' }, regions: regionLabelsEn, additionalData: additionalDataLabelsEn }
  }
} as const;

export const proposalTypeOptions = (lang: ProposalLanguage) => googleProposalFormContract.values.proposalTypes.map((value, index) => ({ value, label: proposalFormLocales[lang].typeLabels[lang][index] }));
