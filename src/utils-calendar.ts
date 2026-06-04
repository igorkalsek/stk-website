export const GOOGLE_CALENDAR_SUBSCRIPTION_URL = 'https://calendar.google.com/calendar/u/0/r?cid=ebc83d7c094e5c61db2b0682a4da13734af4f2f381bafec7ccb37df56bdb1c92@group.calendar.google.com';

const GOOGLE_CALENDAR_EVENT_URL = 'https://calendar.google.com/calendar/render?action=TEMPLATE';

type CalendarEventLinkInput = {
  title: string;
  date: string;
  location?: string;
  noticeUrl?: string;
  registrationUrl?: string;
};

const formatGoogleCalendarDate = (value: string) => value.replace(/-/g, '');

const getNextDate = (value: string) => {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return '';
  date.setDate(date.getDate() + 1);
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

  return `${GOOGLE_CALENDAR_EVENT_URL}&${params.toString()}`;
};
