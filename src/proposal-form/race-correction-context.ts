import type { AdditionalEventData } from '../utils-additional.js';
import { buildEnglishEventDetailPath, buildEventDetailPath, getStableEventId, normalizeSloveneText, type PublicRaceEvent } from '../utils-event-detail.js';
import { formatDetailSurface } from '../utils-race-detail-view.js';
import { formatSloveneDistances } from '../utils-slovenian.js';
import type { ProposalLanguage } from './proposal-form-types.js';

export type CorrectionContextRace = PublicRaceEvent & { additionalData?: AdditionalEventData | null };

const addCorrectionParam = (params: URLSearchParams, key: string, value: string | undefined | null) => {
  const cleanValue = value?.trim() ?? '';
  if (cleanValue && cleanValue !== 'undefined') params.set(key, cleanValue);
};

export const proposalPathForLanguage = (language: ProposalLanguage) => language === 'en' ? '/en/add-or-correct-race/' : '/dodaj-ali-popravi-tek/';
export const raceDetailPathForLanguage = (event: Pick<PublicRaceEvent, 'year' | 'row' | 'date' | 'title' | 'naziv_prireditve' | 'place'>, language: ProposalLanguage) => language === 'en' ? buildEnglishEventDetailPath(event) : buildEventDetailPath(event);

export const buildRaceCorrectionContextParams = (event: CorrectionContextRace, language: ProposalLanguage, returnUrl = raceDetailPathForLanguage(event, language)) => {
  const params = new URLSearchParams();
  addCorrectionParam(params, 'event', event.title);
  addCorrectionParam(params, 'year', event.year);
  addCorrectionParam(params, 'date', event.date);
  addCorrectionParam(params, 'place', event.place);
  addCorrectionParam(params, 'context', 'detail');
  addCorrectionParam(params, 'eventKey', getStableEventId(event));
  addCorrectionParam(params, 'region', event.region);
  addCorrectionParam(params, 'startTime', event.startTime);
  addCorrectionParam(params, 'distances', event.distances ? formatSloveneDistances(event.distances) : '');
  addCorrectionParam(params, 'surface', event.surface ? formatDetailSurface(event.surface, language) : '');
  addCorrectionParam(params, 'officialSource', event.noticeUrl);
  addCorrectionParam(params, 'noticeUrl', event.noticeUrl);
  addCorrectionParam(params, 'registrationUrl', event.registrationUrl);
  addCorrectionParam(params, 'cup', event.cup);
  addCorrectionParam(params, 'registrationFee', [event.additionalData?.registrationMinEur, event.additionalData?.registrationMaxEur].filter(Boolean).join('–'));
  addCorrectionParam(params, 'registrationMinEur', event.additionalData?.registrationMinEur);
  addCorrectionParam(params, 'registrationMaxEur', event.additionalData?.registrationMaxEur);
  addCorrectionParam(params, 'registrationDescription', event.additionalData?.registrationDescription);
  addCorrectionParam(params, 'registrationDeadline', event.additionalData?.registrationDeadline);
  addCorrectionParam(params, 'earlyRegistrationDeadline', event.additionalData?.earlyRegistrationDeadline);
  addCorrectionParam(params, 'dayOfRegistration', event.additionalData?.dayOfRegistration);
  addCorrectionParam(params, 'elevationGain', event.additionalData?.elevationGain);
  addCorrectionParam(params, 'routeUrl', event.additionalData?.routeUrl);
  addCorrectionParam(params, 'otherDetails', event.publicNotes);
  addCorrectionParam(params, 'organizator_naziv', event.additionalData?.organizerName);
  addCorrectionParam(params, 'organizator_url', event.additionalData?.organizerUrl);
  addCorrectionParam(params, 'lang', language);
  addCorrectionParam(params, 'returnUrl', returnUrl.startsWith('/') && !returnUrl.startsWith('//') ? returnUrl : raceDetailPathForLanguage(event, language));
  return params;
};

export const buildRaceCorrectionContextUrl = (event: CorrectionContextRace, language: ProposalLanguage, returnUrl?: string) => `${proposalPathForLanguage(language)}?${buildRaceCorrectionContextParams(event, language, returnUrl).toString()}`;

export const buildRaceConfirmationContextUrl = (event: CorrectionContextRace, language: ProposalLanguage, returnUrl?: string) => {
  const params = buildRaceCorrectionContextParams(event, language, returnUrl);
  params.set('mode', 'confirm');
  return `${proposalPathForLanguage(language)}?${params.toString()}`;
};

export const normalizeRaceSearchText = (value: string) => normalizeSloveneText(value).normalize('NFKD').replace(/[\u0300-\u036f]/g, '');

export const isPublicCalendarRace = (event: Partial<PublicRaceEvent> | null | undefined): event is PublicRaceEvent => Boolean(event?.date && event?.title && event?.year && event?.dateValue !== undefined);

export const searchPublicRaces = <T extends PublicRaceEvent>(events: readonly T[], query: string, limit = 10): T[] => {
  const cleanQuery = normalizeRaceSearchText(query.trim());
  if (!cleanQuery) return [];
  const tokens = cleanQuery.split(/\s+/).filter(Boolean);
  const results: T[] = [];
  for (const event of events) {
    if (!isPublicCalendarRace(event)) continue;
    const haystack = normalizeRaceSearchText([event.title, event.naziv_prireditve, event.place, event.region, event.date].filter(Boolean).join(' '));
    if (tokens.every((token) => haystack.includes(token))) results.push(event);
    if (results.length >= limit) break;
  }
  return results;
};
