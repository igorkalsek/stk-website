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

export const isCompletionAllowed = (eventDate: string, todayIso = getTodayIsoInLjubljana()) =>
  /^\d{4}-\d{2}-\d{2}$/.test(eventDate) && eventDate <= todayIso;

export const getEventDatePhase = (eventDate: string, todayIso = getTodayIsoInLjubljana()): 'past' | 'today' | 'future' | 'invalid' => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(eventDate)) return 'invalid';
  return eventDate < todayIso ? 'past' : eventDate === todayIso ? 'today' : 'future';
};
