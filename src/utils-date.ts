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
