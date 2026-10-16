import { getDaysBetweenIsoDates, parseRegistrationDeadlineDate } from './utils-registration-deadlines.js';

type DeadlineType = 'final' | 'online' | 'advance' | 'cheaper';
type Profile = { date: string; naziv_prireditve: string; place: string; registrationUrl: string };
type Edition = Profile & { raceId: string; officialSource: string };

// Reviewed T16/T17 identity bridge. Website row IDs are NOT canonical race IDs.
// Keep this opt-in bounded to the three verified editions; no title/row guessing.
const editions: Edition[] = [
  { raceId: 'R000217', date: '2026-11-07', naziv_prireditve: '4. Lahinja Trail', place: 'Dragatuš', registrationUrl: 'https://protime.si/dogodek/lahinja-trail-2026/', officialSource: 'https://protime.si/dogodek/lahinja-trail-2026/' },
  { raceId: 'R000211', date: '2026-11-07', naziv_prireditve: 'Go4trail', place: 'Nova Gorica', registrationUrl: 'https://protime.si/dogodek/go4trail-tek-treh-vrhov-2026/', officialSource: 'https://protime.si/dogodek/go4trail-tek-treh-vrhov-2026/' },
  { raceId: 'R000218', date: '2026-12-05', naziv_prireditve: '23. Miklavžev tek 2026', place: 'Snovik', registrationUrl: 'https://sd-smartno.si/miklavzev-tek/', officialSource: 'https://sd-smartno.si/wp-content/uploads/2026/09/6621_invitation.pdf' }
];

export const getProfileDeadlineEdition = (profile: Profile): string | undefined => {
  const edition = editions.find(item => item.date === profile.date && item.naziv_prireditve === profile.naziv_prireditve && item.place === profile.place && item.registrationUrl === profile.registrationUrl);
  return edition ? `${edition.raceId}|${edition.date}` : undefined;
};

const labels: Record<'sl' | 'en', Record<DeadlineType, string>> = {
  sl: { final: 'Končni rok prijave', online: 'Rok spletnih prijav', advance: 'Rok predprijav', cheaper: 'Rok cenejše prijave' },
  en: { final: 'Final registration deadline', online: 'Online registration deadline', advance: 'Advance registration deadline', cheaper: 'Cheaper registration deadline' }
};
const order: DeadlineType[] = ['final', 'online', 'advance', 'cheaper'];
const record = (value: unknown): Record<string, unknown> | null => value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;

export const getVerifiedProfileDeadline = (payload: unknown, editionId: string, deadlineDate: string, todayIso: string, language: 'sl' | 'en') => {
  const edition = editions.find(item => `${item.raceId}|${item.date}` === editionId);
  const today = parseRegistrationDeadlineDate(todayIso);
  const date = parseRegistrationDeadlineDate(deadlineDate);
  const response = record(payload);
  if (!edition || !today || !date || date < today || date > edition.date || response?.ok !== true || response.type !== 'deadlines' || response.contract_version !== 2 || !Array.isArray(response.items)) return null;
  const matches = response.items.map(record).filter(item => item?.edition_id === editionId && item?.deadline_date === date);
  if (matches.length !== 1) return null;
  const item = matches[0]!;
  if (item.race_id !== edition.raceId || item.deadline_id !== `dl2|${editionId}|${date}` || item.datum !== edition.date || !Array.isArray(item.deadline_components) || !item.deadline_components.length) return null;
  const types: DeadlineType[] = [];
  for (const value of item.deadline_components) {
    const component = record(value);
    const type = component?.type as DeadlineType;
    const verified = parseRegistrationDeadlineDate(component?.verified_at);
    const until = parseRegistrationDeadlineDate(component?.valid_until);
    const daysRemaining = getDaysBetweenIsoDates(today, date);
    const maxAge = daysRemaining <= 7 ? 7 : daysRemaining <= 21 ? 14 : 45;
    if (!component || !order.includes(type) || types.includes(type) || !verified || !until || verified > today || until < today || until < verified || until > edition.date || getDaysBetweenIsoDates(verified, today) > maxAge || component.official_source !== edition.officialSource) return null;
    types.push(type);
  }
  if (item.deadline_type !== (types.length > 1 ? 'combined' : types[0])) return null;
  const label = order.filter(type => types.includes(type)).map((type, index) => index === 0 ? labels[language][type] : labels[language][type].toLowerCase()).join(language === 'sl' ? ' in ' : ' and ');
  const days = getDaysBetweenIsoDates(today, date);
  const relative = language === 'sl'
    ? `${label}: ${days === 0 ? 'danes' : days === 1 ? 'jutri' : `čez ${days} dni`}`
    : `${label}: ${days === 0 ? 'today' : days === 1 ? 'tomorrow' : `in ${days} days`}`;
  return { label, relative, source: edition.officialSource, deadlineId: item.deadline_id as string };
};
