export const GOOGLE_CALENDAR_SUBSCRIPTION_URL = 'https://calendar.google.com/calendar/u/0/r?cid=ebc83d7c094e5c61db2b0682a4da13734af4f2f381bafec7ccb37df56bdb1c92@group.calendar.google.com';
export const ICAL_SUBSCRIPTION_URL = 'https://calendar.google.com/calendar/ical/ebc83d7c094e5c61db2b0682a4da13734af4f2f381bafec7ccb37df56bdb1c92%40group.calendar.google.com/public/basic.ics';
export const WEBCAL_SUBSCRIPTION_URL = 'webcal://calendar.google.com/calendar/ical/ebc83d7c094e5c61db2b0682a4da13734af4f2f381bafec7ccb37df56bdb1c92%40group.calendar.google.com/public/basic.ics';

const GOOGLE_CALENDAR_EVENT_URL = 'https://calendar.google.com/calendar/render';

type CalendarEventLinkInput = {
  title: string;
  date: string;
  location?: string;
  noticeUrl?: string;
  registrationUrl?: string;
};

const formatGoogleCalendarDate = (value: string) => value.replace(/-/g, '');

const getNextDate = (value: string) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return '';

  const [, year, month, day] = match;
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  if (Number.isNaN(date.getTime())) return '';
  if (date.toISOString().slice(0, 10) !== value) return '';

  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
};

export const buildGoogleCalendarEventUrl = ({
  title,
  date,
  location = '',
  noticeUrl = '',
  registrationUrl = ''
}: CalendarEventLinkInput) => {
  if (!title || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return '';

  const nextDate = getNextDate(date);
  if (!nextDate) return '';

  const details = [
    'Dodano iz Slovenskega Tekaškega Koledarja. Pred prijavo preverite uradni razpis ali stran organizatorja.',
    noticeUrl ? `Razpis: ${noticeUrl}` : '',
    registrationUrl ? `Prijava: ${registrationUrl}` : ''
  ].filter(Boolean).join('\n');

  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: title,
    dates: `${formatGoogleCalendarDate(date)}/${formatGoogleCalendarDate(nextDate)}`,
    details
  });

  if (location) params.set('location', location);

  return `${GOOGLE_CALENDAR_EVENT_URL}?${params.toString()}`;
};
