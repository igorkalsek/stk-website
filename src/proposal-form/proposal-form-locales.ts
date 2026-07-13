import { googleProposalFormContract } from './proposal-form-contract.js';
import type { ProposalLanguage } from './proposal-form-types.js';

const typeLabels = {
  sl: ['Nov tek', 'Popravek ali dopolnitev obstoječega teka', 'Dopolnitev dodatnih podatkov', 'Drugo'],
  en: ['New race', 'Correction or update for an existing race', 'Additional race data', 'Other']
} as const;

export const proposalFormLocales = {
  sl: {
    title: 'Dodajte ali popravite tek', eyebrow: 'Predlogi in popravki', intro: 'Predlog izpolnite na STK. Oddaja gre v obstoječi Google Forms tok in pred objavo ostane ročno preverjena.',
    notAuto: 'Predlog ni objavljen samodejno. Ročno ga preverimo; uradni vir bistveno pospeši preverjanje. Kontaktni e-naslov ni javno objavljen.',
    chooseType: 'Najprej izberite vrsto predloga', submit: 'Pošlji obstoječemu obrazcu', submitting: 'Pošiljanje …', sent: 'Oddaja je bila poslana obstoječemu Google Forms obrazcu. Zaradi cross-origin omejitev ne moremo potrditi, da jo je Google zagotovo shranil.', another: 'Nov predlog', fallback: 'Odprite obrazec v Google Forms', checkCalendar: 'Najprej preverite koledar', selected: 'Izbrani tek za popravek', back: 'Nazaj na stran teka', noSource: 'Vir ni obvezen, vendar bo preverjanje brez uradnega vira počasnejše.', errorTitle: 'Preverite označena polja.', sourceError: 'Vnesite varen URL, ki se začne s http:// ali https://.',
    labels: { proposalType: 'Tip predloga', date: 'Datum', title: 'Naziv prireditve', place: 'Kraj', region: 'Regija', officialSource: 'Povezava do uradnega vira', description: 'Opis oziroma podrobnosti', organizer: 'Ali ste organizator?', officialAnnouncement2026: 'Ali je za izbrano leto že objavljen uradni razpis ali uradna objava?', email: 'Kontaktni e-naslov', additionalData: 'Neobvezna community/dodatna polja' },
    placeholders: { description: 'Napišite, kaj dodajate ali popravljate. Pri popravku navedite napačen in pravilen podatek.' },
    typeLabels
  },
  en: {
    title: 'Add or correct a race', eyebrow: 'Submissions and corrections', intro: 'Fill in the proposal on STK. Submission still goes through the existing Google Forms flow and remains manually reviewed before publication.',
    notAuto: 'The proposal is not published automatically. We review it manually; an official source makes review much faster. The contact email is not published.',
    chooseType: 'First choose the proposal type', submit: 'Send to existing form', submitting: 'Submitting …', sent: 'The submission was sent to the existing Google Forms form. Because of cross-origin limits, STK cannot confirm that Google definitely stored it.', another: 'New proposal', fallback: 'Open the form in Google Forms', checkCalendar: 'Check the calendar first', selected: 'Selected race for correction', back: 'Back to race page', noSource: 'A source is not required, but review will be slower without an official source.', errorTitle: 'Check the highlighted fields.', sourceError: 'Enter a safe URL that starts with http:// or https://.',
    labels: { proposalType: 'Proposal type', date: 'Date', title: 'Race name', place: 'Place', region: 'Region', officialSource: 'Official source link', description: 'Description or details', organizer: 'Are you the organizer?', officialAnnouncement2026: 'Has the official announcement for the selected year already been published?', email: 'Contact email', additionalData: 'Optional community/additional fields' },
    placeholders: { description: 'Describe what should be added or corrected. For corrections, include the wrong and correct detail.' },
    typeLabels
  }
} as const;

export const proposalTypeOptions = (lang: ProposalLanguage) => googleProposalFormContract.values.proposalTypes.map((value, index) => ({ value, label: proposalFormLocales[lang].typeLabels[lang][index] }));
