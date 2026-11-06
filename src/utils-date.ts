const ljubljanaDateFormatter = new Intl.DateTimeFormat('en', {
  timeZone: 'Europe/Ljubljana',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit'
});

export const getTodayIsoInLjubljana = (date = new Date()): string => {
  const parts = Object.fromEntries(ljubljanaDateFormatter.formatToParts(date).map((part) => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
};

// Presentation only: keep the existing local date-only parsing for calendar days.
// Include the year when a card is shown outside the current calendar year.
export const formatRaceDateBadge = (value: string, language: 'sl' | 'en', includeYear = false): string => {
  if (!value) return '';
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  const locale = language === 'sl' ? 'sl-SI' : 'en-GB';
  const day = new Intl.DateTimeFormat(locale, { weekday: 'short' }).format(date).replace('.', '').toLocaleUpperCase(locale);
  const compactDate = language === 'en'
    ? `${date.getDate()} ${new Intl.DateTimeFormat('en-US', { month: 'short' }).format(date)}${includeYear ? ` ${date.getFullYear()}` : ''}`
    : new Intl.DateTimeFormat(locale, {
      day: 'numeric', month: 'short', ...(includeYear ? { year: 'numeric' as const } : {})
    }).format(date);
  return `${day} · ${compactDate}`;
};

export const isCompletionAllowed = (eventDate: string, todayIso = getTodayIsoInLjubljana()) =>
  /^\d{4}-\d{2}-\d{2}$/.test(eventDate) && eventDate <= todayIso;

export const getEventDatePhase = (eventDate: string, todayIso = getTodayIsoInLjubljana()): 'past' | 'today' | 'future' | 'invalid' => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(eventDate)) return 'invalid';
  return eventDate < todayIso ? 'past' : eventDate === todayIso ? 'today' : 'future';
};

/** Relative race label computed from date-only calendar days, never from elapsed milliseconds
 * in the viewer's time zone or at static-build time. */
export const formatRaceDateStatus = (eventDate: string, language: 'sl' | 'en', todayIso = getTodayIsoInLjubljana()): string => {
  const asUtcDay = (value: string): number | null => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
    const time = Date.parse(`${value}T00:00:00Z`);
    return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === value ? time : null;
  };
  const race = asUtcDay(eventDate);
  const today = asUtcDay(todayIso);
  if (race === null || today === null) return '';
  const days = (race - today) / 86_400_000;
  if (days < 0) return language === 'sl' ? 'Dogodek je že mimo' : 'This race has already passed';
  if (days === 0) return language === 'sl' ? 'Danes' : 'Today';
  return language === 'sl'
    ? `Prihaja čez ${days} ${days === 1 ? 'dan' : 'dni'}`
    : `Coming in ${days} ${days === 1 ? 'day' : 'days'}`;
};
