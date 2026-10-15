export type RegistrationDeadlineKind = 'early' | 'registration';
export type RegistrationDeadline = { kind: RegistrationDeadlineKind; date: string };
export type RegistrationDeadlineState = 'future' | 'tomorrow' | 'today' | 'past';
export type RegistrationDeadlineView = { kind: RegistrationDeadlineKind; date: string; daysRemaining: number; state: RegistrationDeadlineState };

const ISO_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const DAY_MS = 86_400_000;

export const parseRegistrationDeadlineDate = (value: unknown): string => {
  if (typeof value !== 'string') return '';
  const match = ISO_RE.exec(value.trim());
  if (!match) return '';
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  if (Number.isNaN(date.getTime())) return '';
  const iso = date.toISOString().slice(0, 10);
  return iso === value.trim() ? iso : '';
};

export const getDaysBetweenIsoDates = (todayIso: string, deadlineIso: string): number => {
  const today = parseRegistrationDeadlineDate(todayIso);
  const deadline = parseRegistrationDeadlineDate(deadlineIso);
  if (!today || !deadline) return Number.NaN;
  return Math.round((Date.parse(`${deadline}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / DAY_MS);
};

const stateForDays = (daysRemaining: number): RegistrationDeadlineState => {
  if (daysRemaining < 0) return 'past';
  if (daysRemaining === 0) return 'today';
  if (daysRemaining === 1) return 'tomorrow';
  return 'future';
};

export const buildRegistrationDeadlineViews = ({
  todayIso,
  eventDate,
  registrationDeadline,
  earlyRegistrationDeadline
}: {
  todayIso: string;
  eventDate?: unknown;
  registrationDeadline?: unknown;
  earlyRegistrationDeadline?: unknown;
}): RegistrationDeadlineView[] => {
  const today = parseRegistrationDeadlineDate(todayIso);
  if (!today) return [];
  const event = parseRegistrationDeadlineDate(eventDate);
  const regular = parseRegistrationDeadlineDate(registrationDeadline);
  const early = parseRegistrationDeadlineDate(earlyRegistrationDeadline);
  const deadlines: RegistrationDeadline[] = [];
  if (early && early !== regular) deadlines.push({ kind: 'early', date: early });
  if (regular) deadlines.push({ kind: 'registration', date: regular });
  return deadlines
    .filter((deadline) => !event || deadline.date <= event)
    .map((deadline) => {
      const daysRemaining = getDaysBetweenIsoDates(today, deadline.date);
      return { ...deadline, daysRemaining, state: stateForDays(daysRemaining) };
    });
};

const slDays = (days: number) => `${days} ${days === 1 ? 'dan' : 'dni'}`;

// A date in rok_prijave does not prove that all registration channels close.
// Keep its date/countdown; only the separately named cheaper field has known semantics.
export const formatRegistrationDeadlineRelative = (deadline: RegistrationDeadlineView, language: 'sl' | 'en'): string => {
  if (language === 'en') {
    if (deadline.kind === 'early') {
      if (deadline.state === 'past') return 'The cheaper-registration deadline has passed';
      if (deadline.state === 'today') return 'Cheaper registration ends today';
      if (deadline.state === 'tomorrow') return 'Cheaper registration ends tomorrow';
      return `Cheaper registration ends in ${deadline.daysRemaining} days`;
    }
    if (deadline.state === 'past') return 'The registration deadline has passed';
    if (deadline.state === 'today') return 'Registration deadline today';
    if (deadline.state === 'tomorrow') return 'Registration deadline tomorrow';
    return `Registration deadline in ${deadline.daysRemaining} days`;
  }
  if (deadline.kind === 'early') {
    if (deadline.state === 'past') return 'Rok cenejše prijave je potekel';
    if (deadline.state === 'today') return 'Cenejša prijava se konča danes';
    if (deadline.state === 'tomorrow') return 'Cenejša prijava se konča jutri';
    return `Cenejša prijava se konča čez ${slDays(deadline.daysRemaining)}`;
  }
  if (deadline.state === 'past') return 'Rok prijave je potekel';
  if (deadline.state === 'today') return 'Rok prijave je danes';
  if (deadline.state === 'tomorrow') return 'Rok prijave je jutri';
  return `Rok prijave je čez ${slDays(deadline.daysRemaining)}`;
};

export const getRegistrationDeadlineCssState = (deadline: RegistrationDeadlineView): 'deadline-future' | 'deadline-soon' | 'deadline-today' | 'deadline-past' => {
  if (deadline.state === 'past') return 'deadline-past';
  if (deadline.state === 'today') return 'deadline-today';
  if (deadline.daysRemaining <= 7) return 'deadline-soon';
  return 'deadline-future';
};
