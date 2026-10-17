import { formatRaceDateBadge } from './utils-date.js';

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December'
];

export const formatEnglishMonthLabel = (month: string) => {
  const monthNumber = Number(month);
  if (!Number.isInteger(monthNumber) || monthNumber < 1 || monthNumber > 12) return month;
  return MONTH_NAMES[monthNumber - 1];
};

export const formatEnglishDateBadge = (value: string, includeYear = false) => formatRaceDateBadge(value, 'en', includeYear);

export const formatEnglishPublicNotes = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return '';

  const hasFamilyFriendlyContext = /družinam prijazno|family-friendly|otroški teki|children(?:’s|'s)? races/iu.test(trimmed);

  let formatted = trimmed
    .replace(/družinam prijazno:/giu, 'Family-friendly:')
    .replace(/vsak tretji otrok iz družine brezplačen/giu, 'every third child from the same family participates free of charge')
    .replace(/otroški teki brezplačni/giu, 'children’s races are free')
    .replace(/otroški teki/giu, 'children’s races');

  if (hasFamilyFriendlyContext) {
    formatted = formatted
      .replace(/\botroci\b/giu, 'children')
      .replace(/\bbrezplačno\b/giu, 'free of charge');
  }

  return formatted;
};

export const formatEnglishSurface = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return '';

  const labels: Record<string, string> = {
    cesta: 'Road',
    asfalt: 'Asphalt',
    makadam: 'Gravel road',
    'cesta/trail': 'Road/trail',
    gorski: 'Mountain',
    'gorski tek': 'Mountain race',
    oviratlon: 'Obstacle run',
    stopnice: 'Stairs',
    trail: 'Trail'
  };

  return labels[trimmed.toLocaleLowerCase('sl-SI')] ?? trimmed.replace(/^./, (letter) => letter.toLocaleUpperCase('en-GB'));
};

export const formatEnglishRegion = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return '';

  const labels: Record<string, string> = {
    Pomurska: 'Mura region', Podravska: 'Drava region', Koroška: 'Carinthia', Savinjska: 'Savinja region',
    Zasavska: 'Central Sava', Posavska: 'Lower Sava', Jugovzhodna: 'Southeast Slovenia',
    'Primorsko-notranjska': 'Primorska-Inner Carniola', Osrednjeslovenska: 'Central Slovenia',
    Gorenjska: 'Upper Carniola', Goriška: 'Gorizia region', 'Obalno-kraška': 'Coastal-Karst',
    'Ne vem / nisem prepričan (navedem v opisu)': 'I do not know / I am not sure (I will explain in the description)'
  };

  return labels[trimmed] ?? trimmed;
};
