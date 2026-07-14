import { googleProposalFormContract } from './proposal-form-contract.js';
import type { ProposalLanguage, ProposalPrefill } from './proposal-form-types.js';


export const frontendProposalTypes = ['new', 'existing', 'other'] as const;
export type FrontendProposalType = typeof frontendProposalTypes[number];

export const basicChangeCategoryValues = ['basic-date-time', 'basic-title-place', 'basic-distance-surface', 'basic-official-source', 'basic-cup-series'] as const;
export const additionalOnlyChangeCategoryValues = googleProposalFormContract.values.additionalData.filter((value) => value !== 'Drugo');
export const allowedAdditionalDataValues = googleProposalFormContract.values.additionalData;

export const mapExistingChangeSelectionToProposalType = (selectedValues: readonly string[]) => {
  const selected = selectedValues.filter(Boolean);
  const additionalOnly = selected.length > 0 && selected.every((value) => additionalOnlyChangeCategoryValues.includes(value as typeof additionalOnlyChangeCategoryValues[number]));
  return additionalOnly ? googleProposalFormContract.values.proposalTypes[2] : googleProposalFormContract.values.proposalTypes[1];
};

export const additionalDataValuesForChangeSelection = (selectedValues: readonly string[]) => selectedValues.filter((value) => allowedAdditionalDataValues.includes(value as typeof allowedAdditionalDataValues[number]));

export const changeDescriptionPrefix = (lang: ProposalLanguage) => lang === 'en' ? 'Selected changes:' : 'Izbrane vrste sprememb:';

export const stripStructuredChangeHeader = (value: string) => value.replace(/^(Izbrane vrste sprememb:|Selected changes:).*?(?:\r?\n\r?\n|$)/s, '').trimStart();

export const buildStructuredChangeDescription = ({ labels, userText, lang }: { labels: readonly string[]; userText: string; lang: ProposalLanguage }) => {
  const cleanText = stripStructuredChangeHeader(userText).trim();
  const header = `${changeDescriptionPrefix(lang)} ${labels.join('; ')}`.trim();
  return cleanText ? `${header}\n\n${cleanText}` : header;
};

export const buildChangePlaceholder = ({ labels, lang }: { labels: readonly string[]; lang: ProposalLanguage }) => {
  if (!labels.length) return lang === 'en' ? 'Enter the missing or correct detail.' : 'Navedite manjkajoči ali pravilen podatek.';
  return labels.map((label) => `${label}:`).join('\n');
};

export const requiredProposalFields = ['proposalType', 'date', 'title', 'place', 'region', 'description', 'organizer', 'officialAnnouncement2026', 'email'] as const;

export const isSafeInternalReturnUrl = (value: string | null | undefined): value is string => {
  if (!value) return false;
  return value.startsWith('/') && !value.startsWith('//') && !/^https?:\/\//i.test(value);
};

export const isSafeHttpUrl = (value: string | null | undefined): value is string => {
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
};

export const readProposalPrefill = (params: URLSearchParams, pageLanguage: ProposalLanguage): ProposalPrefill => {
  const eventTitle = params.get('event')?.trim() ?? '';
  const year = params.get('year')?.trim() ?? '';
  const date = params.get('date')?.trim() ?? '';
  const place = params.get('place')?.trim() ?? '';
  const source = params.get('source')?.trim() ?? '';
  const officialSourceUrl = isSafeHttpUrl(source) ? source : '';
  const returnUrl = params.get('returnUrl')?.trim() ?? '';
  const lang = params.get('lang') === 'en' ? 'en' : pageLanguage;
  const safeReturnUrl = isSafeInternalReturnUrl(returnUrl) ? returnUrl : '';
  const description = eventTitle ? buildPrefillDescription({ eventTitle, year, date, place, source, officialSourceUrl, safeReturnUrl, lang }) : '';
  return { eventTitle, year, date, place, source, officialSourceUrl, returnUrl, lang, safeReturnUrl, description };
};

export const buildPrefillDescription = ({ eventTitle, year, date, place, source, officialSourceUrl, safeReturnUrl, lang }: { eventTitle: string; year: string; date: string; place: string; source: string; officialSourceUrl: string; safeReturnUrl: string; lang: ProposalLanguage }) => {
  const lines = lang === 'en'
    ? ['Language/context: English STK page.', 'Correction or update for an existing race in Slovenski Tekaški Koledar.', '']
    : ['Popravek ali dopolnitev za obstoječi tek v Slovenskem Tekaškem Koledarju.', ''];
  const details = lang === 'en'
    ? [['Race', eventTitle], ['Year', year], ['Date', date], ['Place', place], ['Context source', source && !officialSourceUrl ? source : ''], ['Official source', officialSourceUrl], ['Race page', safeReturnUrl]]
    : [['Tek', eventTitle], ['Leto', year], ['Datum', date], ['Kraj', place], ['Kontekst vira', source && !officialSourceUrl ? source : ''], ['Uradni vir', officialSourceUrl], ['Stran teka', safeReturnUrl]];
  for (const [label, value] of details) if (value) lines.push(`${label}: ${value}`);
  lines.push('', lang === 'en' ? 'Please add below which detail should be corrected or updated.' : 'Prosimo, spodaj dopišite, kateri podatek želite popraviti ali dopolniti.');
  return lines.join('\n');
};

export const buildGoogleFormsFallbackUrl = (prefill: ProposalPrefill, proposalType = googleProposalFormContract.values.proposalTypes[1]) => {
  const url = new URL(googleProposalFormContract.viewUrl);
  url.searchParams.set('usp', 'pp_url');
  if (prefill.eventTitle) url.searchParams.set(googleProposalFormContract.fields.proposalType, proposalType);
  if (prefill.date) url.searchParams.set(googleProposalFormContract.fields.date, prefill.date);
  if (prefill.eventTitle) url.searchParams.set(googleProposalFormContract.fields.title, prefill.eventTitle);
  if (prefill.place) url.searchParams.set(googleProposalFormContract.fields.place, prefill.place);
  if (prefill.officialSourceUrl) url.searchParams.set(googleProposalFormContract.fields.officialSource, prefill.officialSourceUrl);
  if (prefill.eventTitle) url.searchParams.set(googleProposalFormContract.fields.region, googleProposalFormContract.values.regions.at(-1)!);
  if (prefill.description) url.searchParams.set(googleProposalFormContract.fields.description, prefill.description);
  return url.href;
};

export const getYearContext = (dateOrYear: string) => dateOrYear.includes('2027') ? '2027' : '2026';
