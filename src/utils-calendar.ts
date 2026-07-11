import { areEquivalentPublicActionUrls, normalizeDetailUrl } from './utils-race-detail-view.js';
export const GOOGLE_CALENDAR_SUBSCRIPTION_URL = 'https://calendar.google.com/calendar/u/0/r?cid=ebc83d7c094e5c61db2b0682a4da13734af4f2f381bafec7ccb37df56bdb1c92@group.calendar.google.com';
export const ICAL_SUBSCRIPTION_URL = 'https://calendar.google.com/calendar/ical/ebc83d7c094e5c61db2b0682a4da13734af4f2f381bafec7ccb37df56bdb1c92%40group.calendar.google.com/public/basic.ics';
export const WEBCAL_SUBSCRIPTION_URL = 'webcal://calendar.google.com/calendar/ical/ebc83d7c094e5c61db2b0682a4da13734af4f2f381bafec7ccb37df56bdb1c92%40group.calendar.google.com/public/basic.ics';


const GOOGLE_CALENDAR_EVENT_URL = 'https://calendar.google.com/calendar/render';

export type CalendarEventLinkInput = {
  title: string;
  date: string;
  location?: string;
  noticeUrl?: string;
  registrationUrl?: string;
  language?: 'sl' | 'en';
};

export type MultiIcsCalendarEventInput = CalendarEventLinkInput & {
  uid: string;
};

export type MultiIcsCalendarInput = {
  events: MultiIcsCalendarEventInput[];
  language?: 'sl' | 'en';
  dtstamp?: Date | string;
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

const EVENT_DETAILS = {
  sl: {
    intro: 'Dodano iz Slovenskega Tekaškega Koledarja. Pred prijavo preverite uradni razpis ali stran organizatorja.',
    notice: 'Razpis:',
    registration: 'Prijava:',
    combined: 'Razpis in prijava:'
  },
  en: {
    intro: 'Added from Slovenski Tekaški Koledar. Before registering, check the official race announcement or the organizer’s website.',
    notice: 'Official info:',
    registration: 'Registration:',
    combined: 'Official info and registration:'
  }
} as const;

const getEventDetails = ({
  noticeUrl = '',
  registrationUrl = '',
  language = 'sl'
}: Pick<CalendarEventLinkInput, 'noticeUrl' | 'registrationUrl' | 'language'>) => {
  const labels = EVENT_DETAILS[language] ?? EVENT_DETAILS.sl;

  const normalizedNoticeUrl = normalizeDetailUrl(noticeUrl);
  const normalizedRegistrationUrl = normalizeDetailUrl(registrationUrl);
  const linkLines = areEquivalentPublicActionUrls(normalizedRegistrationUrl, normalizedNoticeUrl)
    ? [`${labels.combined} ${normalizedRegistrationUrl}`]
    : [
      normalizedNoticeUrl ? `${labels.notice} ${normalizedNoticeUrl}` : '',
      normalizedRegistrationUrl ? `${labels.registration} ${normalizedRegistrationUrl}` : ''
    ];

  return [labels.intro, ...linkLines].filter(Boolean).join('\n');
};

const hasValidAllDayDate = (date: string) => /^\d{4}-\d{2}-\d{2}$/.test(date);

const formatIcsDateTime = (value: Date | string = new Date()) => {
  const date = typeof value === 'string' ? new Date(value) : value;
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
};

const buildIcsEventLines = ({
  title,
  date,
  location = '',
  noticeUrl = '',
  registrationUrl = '',
  language = 'sl',
  uid,
  dtstamp = new Date()
}: CalendarEventLinkInput & { uid: string; dtstamp?: Date | string }) => {
  if (!title || !hasValidAllDayDate(date) || !uid) return [];

  const nextDate = getNextDate(date);
  if (!nextDate) return [];

  return [
    'BEGIN:VEVENT',
    `UID:${escapeIcsText(uid)}`,
    `DTSTAMP:${formatIcsDateTime(dtstamp)}`,
    `DTSTART;VALUE=DATE:${formatGoogleCalendarDate(date)}`,
    `DTEND;VALUE=DATE:${formatGoogleCalendarDate(nextDate)}`,
    `SUMMARY:${escapeIcsText(title)}`,
    location ? `LOCATION:${escapeIcsText(location)}` : '',
    `DESCRIPTION:${escapeIcsText(getEventDetails({ noticeUrl, registrationUrl, language }))}`,
    'END:VEVENT'
  ].filter(Boolean);
};

const buildIcsCalendarLines = (language: 'sl' | 'en', veventLines: string[]) => [
  'BEGIN:VCALENDAR',
  'VERSION:2.0',
  `PRODID:-//Slovenski Tekaski Koledar//STK Website//${language === 'en' ? 'EN' : 'SL'}`,
  'CALSCALE:GREGORIAN',
  'METHOD:PUBLISH',
  ...veventLines,
  'END:VCALENDAR'
].map(foldIcsLine);


export const buildGoogleCalendarEventUrl = ({
  title,
  date,
  location = '',
  noticeUrl = '',
  registrationUrl = '',
  language = 'sl'
}: CalendarEventLinkInput) => {
  if (!title || !hasValidAllDayDate(date)) return '';

  const nextDate = getNextDate(date);
  if (!nextDate) return '';

  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: title,
    dates: `${formatGoogleCalendarDate(date)}/${formatGoogleCalendarDate(nextDate)}`,
    details: getEventDetails({ noticeUrl, registrationUrl, language })
  });

  if (location) params.set('location', location);

  return `${GOOGLE_CALENDAR_EVENT_URL}?${params.toString()}`;
};

const escapeIcsText = (value: string) => value
  .replace(/\\/g, '\\\\')
  .replace(/;/g, '\\;')
  .replace(/,/g, '\\,')
  .replace(/\r?\n/g, '\\n');

const foldIcsLine = (line: string) => {
  const maxLength = 75;
  if (line.length <= maxLength) return line;

  const parts: string[] = [];
  let remaining = line;
  while (remaining.length > maxLength) {
    parts.push(remaining.slice(0, maxLength));
    remaining = ` ${remaining.slice(maxLength)}`;
  }
  parts.push(remaining);
  return parts.join('\r\n');
};

const slugifyFilenamePart = (value: string) => value
  .normalize('NFKD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')
  .slice(0, 80) || 'tek';

export const buildIcsFilename = ({ title, date }: Pick<CalendarEventLinkInput, 'title' | 'date'>) => {
  if (!title || !hasValidAllDayDate(date)) return 'stk-dogodek.ics';
  return `${date}-${slugifyFilenamePart(title)}.ics`;
};

export const buildIcsCalendarEvent = ({
  title,
  date,
  location = '',
  noticeUrl = '',
  registrationUrl = '',
  language = 'sl'
}: CalendarEventLinkInput) => {
  const veventLines = buildIcsEventLines({
    title,
    date,
    location,
    noticeUrl,
    registrationUrl,
    language,
    uid: `${date}-${slugifyFilenamePart(title)}@slovenski-tekaski-koledar`
  });
  if (!veventLines.length) return '';

  return `${buildIcsCalendarLines(language, veventLines).join('\r\n')}\r\n`;
};

export const buildIcsCalendar = ({ events, language = 'sl', dtstamp = new Date() }: MultiIcsCalendarInput) => {
  const seen = new Set<string>();
  const prepared = events
    .filter((event) => event.title && hasValidAllDayDate(event.date) && event.uid && getNextDate(event.date))
    .filter((event) => {
      if (seen.has(event.uid)) return false;
      seen.add(event.uid);
      return true;
    })
    .sort((a, b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title, language === 'en' ? 'en' : 'sl-SI'));

  if (!prepared.length) return '';

  const veventLines = prepared.flatMap((event) => buildIcsEventLines({ ...event, language: event.language ?? language, dtstamp }));
  return `${buildIcsCalendarLines(language, veventLines).join('\r\n')}\r\n`;
};

export const buildIcsDataUrl = (event: CalendarEventLinkInput) => {
  const ics = buildIcsCalendarEvent(event);
  return ics ? `data:text/calendar;charset=utf-8,${encodeURIComponent(ics)}` : '';
};

const OUTLOOK_CALENDAR_EVENT_URL = 'https://outlook.live.com/calendar/0/action/compose';

export const buildOutlookCalendarEventUrl = ({
  title,
  date,
  location = '',
  noticeUrl = '',
  registrationUrl = '',
  language = 'sl'
}: CalendarEventLinkInput) => {
  if (!title || !hasValidAllDayDate(date)) return '';

  const nextDate = getNextDate(date);
  if (!nextDate) return '';

  const params = new URLSearchParams({
    rru: 'addevent',
    subject: title,
    startdt: date,
    enddt: nextDate,
    allday: 'true',
    body: getEventDetails({ noticeUrl, registrationUrl, language })
  });

  if (location) params.set('location', location);

  return `${OUTLOOK_CALENDAR_EVENT_URL}?${params.toString()}`;
};
