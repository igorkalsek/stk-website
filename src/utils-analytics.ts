type AnalyticsEventType =
  | 'search_performed'
  | 'no_results_search'
  | 'calendar_add_clicked'
  | 'external_link_clicked'
  | 'vote_clicked'
  | 'tekobot_clicked';

type AnalyticsPayload = {
  event_type: AnalyticsEventType;
  page_path?: string;
  language?: string;
  event_id?: string;
  event_name?: string;
  event_date?: string;
  action_type?: string;
  search_query?: string;
  filters_json?: string;
  results_count?: number;
  target_domain?: string;
  calendar_type?: string;
  notes?: string;
};

const ANALYTICS_ENDPOINT = 'https://stk-master-api.igor-kalsek.workers.dev/site-events';
const MAX_FIELD_LENGTH = 500;
const MAX_QUERY_LENGTH = 120;

const trimText = (value: unknown, maxLength = MAX_FIELD_LENGTH) => {
  if (value === undefined || value === null) return '';
  return String(value).replace(/\s+/g, ' ').trim().slice(0, maxLength);
};

const getLanguage = () => document.documentElement.lang || 'sl';

const getPagePath = () => `${window.location.pathname}${window.location.search}`.slice(0, MAX_FIELD_LENGTH);

const getReferrer = () => {
  if (!document.referrer) return '';
  try {
    const url = new URL(document.referrer);
    return `${url.origin}${url.pathname}`.slice(0, MAX_FIELD_LENGTH);
  } catch {
    return '';
  }
};

const getUserAgentGroup = () => {
  const ua = navigator.userAgent.toLowerCase();
  const device = /mobi|android|iphone|ipad/.test(ua) ? 'mobile' : 'desktop';
  const browser = ua.includes('firefox')
    ? 'firefox'
    : ua.includes('edg/')
      ? 'edge'
      : ua.includes('chrome') || ua.includes('crios')
        ? 'chrome'
        : ua.includes('safari')
          ? 'safari'
          : 'other';
  return `${device}_${browser}`;
};

const getTargetDomain = (href: string) => {
  try {
    return new URL(href, window.location.href).hostname.replace(/^www\./, '').slice(0, 180);
  } catch {
    return '';
  }
};

const buildBody = (payload: AnalyticsPayload) => {
  const searchQuery = trimText(payload.search_query, MAX_QUERY_LENGTH);
  return {
    timestamp: new Date().toISOString(),
    event_type: payload.event_type,
    page_path: trimText(payload.page_path || getPagePath()),
    language: trimText(payload.language || getLanguage(), 12),
    event_id: trimText(payload.event_id, 120),
    event_name: trimText(payload.event_name),
    event_date: trimText(payload.event_date, 40),
    action_type: trimText(payload.action_type, 80),
    search_query: searchQuery,
    filters_json: trimText(payload.filters_json, 1000),
    results_count: Number.isFinite(payload.results_count) ? payload.results_count : '',
    target_domain: trimText(payload.target_domain, 180),
    calendar_type: trimText(payload.calendar_type, 80),
    user_agent_group: getUserAgentGroup(),
    referrer: getReferrer(),
    notes: trimText(payload.notes)
  };
};

export const logAnalyticsEvent = (payload: AnalyticsPayload) => {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return;

  const body = buildBody(payload);
  const blob = new Blob([JSON.stringify(body)], { type: 'application/json' });

  try {
    if (navigator.sendBeacon?.(ANALYTICS_ENDPOINT, blob)) return;
  } catch {
    // Ignore analytics failures so user actions are never blocked.
  }

  window.setTimeout(() => {
    fetch(ANALYTICS_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      keepalive: true
    }).catch(() => {
      // Ignore analytics failures so user actions are never blocked.
    });
  }, 0);
};

const getCard = (element: Element) =>
  element.closest<HTMLElement>('[data-analytics-event-name], [data-event-row], .event-card');

const getCardValue = (card: HTMLElement | null, key: string) => card?.dataset[key] ?? '';

const inferCalendarType = (link: HTMLAnchorElement) => {
  const explicit = link.dataset.analyticsCalendarType;
  if (explicit) return explicit;
  const label = link.textContent?.toLowerCase() ?? '';
  const href = link.href.toLowerCase();
  if (label.includes('google') || href.includes('google.com/calendar')) return 'google';
  if (label.includes('outlook') || href.includes('outlook')) return 'outlook';
  if (label.includes('ical') || label.includes('apple') || link.hasAttribute('download')) return 'ics';
  return '';
};

const inferLinkType = (link: HTMLAnchorElement) => {
  const explicit = link.dataset.analyticsLinkType;
  if (explicit) return explicit;
  const label = link.textContent?.toLocaleLowerCase('sl-SI') ?? '';
  const href = link.href.toLocaleLowerCase('sl-SI');
  if (label.includes('prijava') || label.includes('registration')) return 'prijava';
  if (label.includes('razpis') || label.includes('official')) return 'razpis';
  if (label.includes('gpx') || href.includes('gpx')) return 'gpx';
  if (label.includes('trasa') || label.includes('route') || href.includes('strava') || href.includes('map')) return 'trasa';
  return '';
};

const getEventContext = (link: HTMLAnchorElement) => {
  const card = getCard(link);
  return {
    event_id: getCardValue(card, 'analyticsEventId') || getCardValue(card, 'eventRow'),
    event_name: getCardValue(card, 'analyticsEventName') || card?.querySelector('h3')?.textContent || '',
    event_date: getCardValue(card, 'analyticsEventDate') || card?.querySelector('time')?.getAttribute('datetime') || ''
  };
};

export const initializeAnalyticsClickTracking = () => {
  if (typeof document === 'undefined') return;

  document.addEventListener('click', (event) => {
    const link = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>('a[href]') : null;
    if (!link) return;

    const href = link.getAttribute('href') ?? '';
    const isTekobot = /^\/?(?:en\/)?stk-tekobot\/?(?:#.*)?$/i.test(href.replace(/^https?:\/\/[^/]+\//, ''));
    if (isTekobot) {
      logAnalyticsEvent({ event_type: 'tekobot_clicked' });
      return;
    }

    const context = getEventContext(link);
    const calendarType = inferCalendarType(link);
    if (calendarType) {
      logAnalyticsEvent({ event_type: 'calendar_add_clicked', ...context, calendar_type: calendarType });
      return;
    }

    const isVote = link.dataset.analyticsAction === 'vote' || /glasuj|vote/i.test(link.textContent ?? '');
    if (isVote) {
      logAnalyticsEvent({ event_type: 'vote_clicked', ...context });
      return;
    }

    const linkType = inferLinkType(link);
    if (linkType) {
      logAnalyticsEvent({
        event_type: 'external_link_clicked',
        ...context,
        action_type: linkType,
        target_domain: getTargetDomain(link.href)
      });
    }
  }, { capture: true });
};

export const filtersToAnalyticsJson = (filters: Record<string, string | boolean>) => {
  const selected = Object.fromEntries(
    Object.entries(filters).filter(([, value]) => Boolean(value) && value !== 'date')
  );
  return JSON.stringify(selected);
};
