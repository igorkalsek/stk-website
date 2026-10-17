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
