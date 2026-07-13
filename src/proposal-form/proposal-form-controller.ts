import { googleProposalFormContract } from './proposal-form-contract.js';
import type { ProposalLanguage, ProposalPrefill } from './proposal-form-types.js';

export const requiredProposalFields = ['proposalType', 'date', 'title', 'place', 'region', 'description', 'organizer', 'officialAnnouncement2026', 'email'] as const;

export const isSafeInternalReturnUrl = (value: string | null | undefined): value is string => {
  if (!value) return false;
  return value.startsWith('/') && !value.startsWith('//') && !/^https?:\/\//i.test(value);
};

export const readProposalPrefill = (params: URLSearchParams, pageLanguage: ProposalLanguage): ProposalPrefill => {
  const eventTitle = params.get('event')?.trim() ?? '';
  const year = params.get('year')?.trim() ?? '';
  const date = params.get('date')?.trim() ?? '';
  const place = params.get('place')?.trim() ?? '';
  const source = params.get('source')?.trim() ?? '';
  const returnUrl = params.get('returnUrl')?.trim() ?? '';
  const lang = params.get('lang') === 'en' ? 'en' : pageLanguage;
  const safeReturnUrl = isSafeInternalReturnUrl(returnUrl) ? returnUrl : '';
  const description = buildPrefillDescription({ eventTitle, year, date, place, source, safeReturnUrl, lang });
  return { eventTitle, year, date, place, source, returnUrl, lang, safeReturnUrl, description };
};

export const buildPrefillDescription = ({ eventTitle, year, date, place, source, safeReturnUrl, lang }: { eventTitle: string; year: string; date: string; place: string; source: string; safeReturnUrl: string; lang: ProposalLanguage }) => {
  const lines = lang === 'en'
    ? ['Language/context: English STK page.', 'Correction or update for an existing race in Slovenski Tekaški Koledar.', '']
    : ['Popravek ali dopolnitev za obstoječi tek v Slovenskem Tekaškem Koledarju.', ''];
  const details = lang === 'en'
    ? [['Race', eventTitle], ['Year', year], ['Date', date], ['Place', place], ['Source', source], ['Race page', safeReturnUrl]]
    : [['Tek', eventTitle], ['Leto', year], ['Datum', date], ['Kraj', place], ['Vir', source], ['Stran teka', safeReturnUrl]];
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
  if (prefill.source) url.searchParams.set(googleProposalFormContract.fields.officialSource, prefill.source);
  if (prefill.eventTitle) url.searchParams.set(googleProposalFormContract.fields.region, googleProposalFormContract.values.regions.at(-1)!);
  if (prefill.description) url.searchParams.set(googleProposalFormContract.fields.description, prefill.description);
  return url.href;
};

export const getYearContext = (dateOrYear: string) => dateOrYear.includes('2027') ? '2027' : '2026';
