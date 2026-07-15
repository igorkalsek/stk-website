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

export const allowedChangeCategoryValues = [...basicChangeCategoryValues, ...allowedAdditionalDataValues] as const;

export const parsePreselectedChangeCategories = (value: string | null | undefined) => {
  const allowed = new Set<string>(allowedChangeCategoryValues);
  const selected: string[] = [];
  for (const raw of (value ?? '').split(',')) {
    const item = raw.trim();
    if (allowed.has(item) && !selected.includes(item)) selected.push(item);
  }
  return selected;
};

export const fieldCategoryMap = {
  date: 'basic-date-time', startTime: 'basic-date-time', title: 'basic-title-place', place: 'basic-title-place', region: 'basic-title-place', distances: 'basic-distance-surface', surface: 'basic-distance-surface', noticeUrl: 'basic-official-source', registrationUrl: 'basic-official-source', cup: 'basic-cup-series', registrationFee: 'Prijavnina / startnina', registrationDeadline: 'Rok prijave', earlyRegistrationDeadline: 'Cenejša prijava / sprememba cene', dayOfRegistration: 'Prijave na dan dogodka', routeUrl: 'Trasa / zemljevid / GPX', elevationGain: 'Višinski metri'
} as const;

export const getProposalFieldRules = ({ frontendType, hasRaceContext, hasCompleteRaceIdentity, identity = {} }: { frontendType: FrontendProposalType; hasRaceContext: boolean; hasCompleteRaceIdentity: boolean; identity?: Partial<Record<'date' | 'title' | 'place' | 'region', boolean>> }) => {
  const isExisting = frontendType === 'existing';
  const contextIdentity = isExisting && hasRaceContext;
  const identityRule = (key: 'date' | 'title' | 'place' | 'region') => {
    const known = hasCompleteRaceIdentity || Boolean(identity[key]);
    const visible = !contextIdentity || !known;
    return { visible, required: visible, disabled: false, keepEnabledWhenHidden: contextIdentity && known };
  };
  return {
    date: identityRule('date'),
    title: identityRule('title'),
    place: identityRule('place'),
    region: identityRule('region'),
    source: { visible: true, required: false, disabled: false, keepEnabledWhenHidden: false },
    description: { visible: true, required: true, disabled: false, keepEnabledWhenHidden: false },
    organizer: { visible: true, required: true, disabled: false, keepEnabledWhenHidden: false },
    announcement: { visible: true, required: true, disabled: false, keepEnabledWhenHidden: false },
    email: { visible: true, required: true, disabled: false, keepEnabledWhenHidden: false }
  } as const;
};

export const parseProposalMode = (value: string | null | undefined): FrontendProposalType | '' => frontendProposalTypes.includes(value as FrontendProposalType) ? value as FrontendProposalType : '';

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
  const legacySource = params.get('source')?.trim() ?? '';
  const context = params.get('context')?.trim() || (!isSafeHttpUrl(legacySource) ? legacySource : '');
  const officialSourceParam = params.get('officialSource')?.trim() ?? '';
  const noticeUrlParam = params.get('noticeUrl')?.trim() ?? '';
  const officialSourceUrl = isSafeHttpUrl(officialSourceParam) ? officialSourceParam : isSafeHttpUrl(legacySource) ? legacySource : isSafeHttpUrl(noticeUrlParam) ? noticeUrlParam : '';
  const source = legacySource;
  const returnUrl = params.get('returnUrl')?.trim() ?? '';
  const lang = params.get('lang') === 'en' ? 'en' : pageLanguage;
  const safeReturnUrl = isSafeInternalReturnUrl(returnUrl) ? returnUrl : '';
  const description = eventTitle ? buildPrefillDescription({ eventTitle, year, date, place, officialSourceUrl, safeReturnUrl, lang }) : '';
  const get = (key: string) => params.get(key)?.trim() ?? '';
  return { eventTitle, year, date, place, source, officialSourceUrl, returnUrl, lang, safeReturnUrl, description, context, eventKey: get('eventKey'), region: get('region'), startTime: get('startTime'), distances: get('distances'), surface: get('surface'), noticeUrl: noticeUrlParam, registrationUrl: get('registrationUrl'), cup: get('cup'), registrationFee: get('registrationFee'), registrationDeadline: get('registrationDeadline'), earlyRegistrationDeadline: get('earlyRegistrationDeadline'), dayOfRegistration: get('dayOfRegistration'), elevationGain: get('elevationGain'), routeUrl: get('routeUrl') };
};

export const buildPrefillDescription = ({ eventTitle, year, date, place, officialSourceUrl, safeReturnUrl, lang }: { eventTitle: string; year: string; date: string; place: string; officialSourceUrl: string; safeReturnUrl: string; lang: ProposalLanguage }) => {
  const lines = lang === 'en'
    ? ['Language/context: English STK page.', 'Correction or update for an existing race in Slovenski Tekaški Koledar.', '']
    : ['Popravek ali dopolnitev za obstoječi tek v Slovenskem Tekaškem Koledarju.', ''];
  const details = lang === 'en'
    ? [['Race', eventTitle], ['Year', year], ['Date', date], ['Place', place], ['Official source', officialSourceUrl], ['Race page', safeReturnUrl]]
    : [['Tek', eventTitle], ['Leto', year], ['Datum', date], ['Kraj', place], ['Uradni vir', officialSourceUrl], ['Stran teka', safeReturnUrl]];
  for (const [label, value] of details) if (value) lines.push(`${label}: ${value}`);
  lines.push('', lang === 'en' ? 'Please add below which detail should be corrected or updated.' : 'Prosimo, spodaj dopišite, kateri podatek želite popraviti ali dopolniti.');
  return lines.join('\n');
};

export type GoogleFormsSubmissionUrlInput = {
  proposalType?: string;
  date?: string;
  title?: string;
  place?: string;
  region?: string;
  officialSource?: string;
  description?: string;
  organizer?: string;
  officialAnnouncement?: string;
  email?: string;
  additionalData?: readonly string[];
};

export type GoogleFormsSubmissionEntry = readonly [name: string, value: string];

const cleanSubmissionValue = (value: string | undefined) => value?.trim() ?? '';
const appendSubmissionEntry = (entries: GoogleFormsSubmissionEntry[], name: string, value: string | undefined, { includeEmpty = false } = {}) => {
  const cleanValue = cleanSubmissionValue(value);
  if (cleanValue || includeEmpty) entries.push([name, cleanValue]);
};

export const buildGoogleFormsSubmissionEntries = (submission: GoogleFormsSubmissionUrlInput = {}): GoogleFormsSubmissionEntry[] => {
  const { fields } = googleProposalFormContract;
  const entries: GoogleFormsSubmissionEntry[] = [];
  appendSubmissionEntry(entries, fields.proposalType, submission.proposalType);
  appendSubmissionEntry(entries, fields.date, submission.date);
  if (submission.date && /^\d{4}-\d{2}-\d{2}$/.test(submission.date)) {
    const [year, month, day] = submission.date.split('-');
    entries.push([fields.dateYear, String(Number(year))], [fields.dateMonth, String(Number(month))], [fields.dateDay, String(Number(day))]);
  }
  appendSubmissionEntry(entries, fields.title, submission.title);
  appendSubmissionEntry(entries, fields.place, submission.place);
  appendSubmissionEntry(entries, fields.region, submission.region);
  appendSubmissionEntry(entries, fields.officialSource, submission.officialSource, { includeEmpty: true });
  appendSubmissionEntry(entries, fields.description, submission.description);
  appendSubmissionEntry(entries, fields.organizer, submission.organizer);
  appendSubmissionEntry(entries, fields.officialAnnouncement2026, submission.officialAnnouncement);
  appendSubmissionEntry(entries, fields.email, submission.email);
  for (const value of submission.additionalData ?? []) {
    if (allowedAdditionalDataValues.includes(value as typeof allowedAdditionalDataValues[number])) entries.push([fields.additionalData, value]);
  }
  return entries;
};

export const buildGoogleFormsSubmissionUrl = (submission: GoogleFormsSubmissionUrlInput = {}) => {
  const url = new URL(googleProposalFormContract.viewUrl);
  url.searchParams.set('usp', 'pp_url');
  for (const [name, value] of buildGoogleFormsSubmissionEntries(submission)) url.searchParams.append(name, value);
  return url.href;
};

export const buildGoogleFormsFallbackUrl = (prefill: ProposalPrefill, proposalType = googleProposalFormContract.values.proposalTypes[1]) => buildGoogleFormsSubmissionUrl({
  proposalType: prefill.eventTitle ? proposalType : '',
  date: prefill.date,
  title: prefill.eventTitle,
  place: prefill.place,
  region: prefill.eventTitle ? prefill.region || googleProposalFormContract.values.regions.at(-1)! : prefill.region,
  officialSource: prefill.officialSourceUrl,
  description: prefill.description
});

export const getYearContext = (dateOrYear: string) => dateOrYear.includes('2027') ? '2027' : '2026';
