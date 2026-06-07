type StkAnalyticsEventType =
  | 'search_performed'
  | 'no_results_search'
  | 'external_link_clicked'
  | 'calendar_add_clicked'
  | 'vote_clicked'
  | 'tekobot_clicked';

type UserAgentGroup = 'mobile' | 'tablet' | 'desktop' | 'unknown';

export type StkAnalyticsPayload = {
  event_type: StkAnalyticsEventType;
  page_path?: string;
  language?: string;
  event_id?: string;
  event_name?: string;
  event_date?: string;
  action_type?: 'razpis' | 'prijava' | 'uradna_stran' | 'trasa' | 'gpx' | 'other' | string;
  search_query?: string;
  filters_json?: string;
  results_count?: number;
  target_domain?: string;
  calendar_type?: 'google' | 'apple' | 'outlook' | 'ics' | 'other' | string;
  referrer?: string;
  user_agent_group?: UserAgentGroup;
  notes?: string;
};

const STK_SITE_EVENTS_ENDPOINT = 'https://script.google.com/macros/s/AKfycbwSm--BvE-xGB9ZMMjyXFZRh9wNeHUEpUeJyM6aJAUEsV-HIoarel4_bN1Tlf8gG-Z3/exec';
const MAX_FIELD_LENGTH = 500;
const MAX_JSON_FIELD_LENGTH = 1000;
const MAX_QUERY_LENGTH = 120;

const ALLOWED_EVENT_TYPES = new Set<StkAnalyticsEventType>([
  'search_performed',
  'no_results_search',
  'external_link_clicked',
  'calendar_add_clicked',
  'vote_clicked',
  'tekobot_clicked'
]);

const trimText = (value: unknown, maxLength = MAX_FIELD_LENGTH) => {
  if (value === undefined || value === null) return '';
  return String(value).replace(/\s+/g, ' ').trim().slice(0, maxLength);
};

const inferLanguage = () => {
  if (typeof window === 'undefined') return 'sl';
  return window.location.pathname.startsWith('/en/') ? 'en' : 'sl';
};

const getPagePath = () => {
  if (typeof window === 'undefined') return '';
  return `${window.location.pathname}${window.location.search}`.slice(0, MAX_FIELD_LENGTH);
};

const getReferrer = () => {
  if (typeof document === 'undefined' || !document.referrer) return '';
  try {
    const url = new URL(document.referrer);
    return `${url.origin}${url.pathname}`.slice(0, MAX_FIELD_LENGTH);
  } catch {
    return '';
  }
};

const getUserAgentGroup = (): UserAgentGroup => {
  if (typeof navigator === 'undefined') return 'unknown';

  const ua = navigator.userAgent.toLowerCase();
  const maxTouchPoints = navigator.maxTouchPoints || 0;

  if (/ipad|tablet|kindle|silk|playbook/.test(ua)) return 'tablet';
  if (/android/.test(ua) && !/mobile/.test(ua)) return 'tablet';
  if (/mobi|iphone|ipod|android/.test(ua)) return 'mobile';
  if (/macintosh/.test(ua) && maxTouchPoints > 1) return 'tablet';
  if (ua) return 'desktop';

  return 'unknown';
};

export const getStkTargetDomain = (href: string) => {
  if (typeof window === 'undefined') return '';
  try {
    return new URL(href, window.location.href).hostname.replace(/^www\./, '').slice(0, 180);
  } catch {
    return '';
  }
};

const buildBody = (payload: StkAnalyticsPayload) => ({
  event_type: ALLOWED_EVENT_TYPES.has(payload.event_type) ? payload.event_type : 'external_link_clicked',
  page_path: trimText(payload.page_path || getPagePath()),
  language: trimText(payload.language || inferLanguage(), 12),
  event_id: trimText(payload.event_id, 120),
  event_name: trimText(payload.event_name),
  event_date: trimText(payload.event_date, 40),
  action_type: trimText(payload.action_type, 80),
  search_query: trimText(payload.search_query, MAX_QUERY_LENGTH),
  filters_json: trimText(payload.filters_json, MAX_JSON_FIELD_LENGTH),
  results_count: Number.isFinite(payload.results_count) ? payload.results_count : '',
  target_domain: trimText(payload.target_domain, 180),
  calendar_type: trimText(payload.calendar_type, 80),
  referrer: trimText(payload.referrer || getReferrer()),
  user_agent_group: payload.user_agent_group || getUserAgentGroup(),
  notes: trimText(payload.notes)
});

const sendBody = (body: ReturnType<typeof buildBody>) => {
  const serializedBody = JSON.stringify(body);
  const blob = new Blob([serializedBody], { type: 'text/plain;charset=utf-8' });

  try {
    if (navigator.sendBeacon?.(STK_SITE_EVENTS_ENDPOINT, blob)) return;
  } catch {
    // Analytics must never affect user actions.
  }

  window.setTimeout(() => {
    fetch(STK_SITE_EVENTS_ENDPOINT, {
      method: 'POST',
      mode: 'no-cors',
      keepalive: true,
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: serializedBody
    }).catch(() => {
      // Analytics must fail silently.
    });
  }, 0);
};

export const trackStkEvent = (payload: StkAnalyticsPayload) => {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return;
  if (!ALLOWED_EVENT_TYPES.has(payload.event_type)) return;

  const body = buildBody(payload);
  if ((body.event_type === 'search_performed' || body.event_type === 'no_results_search') && !body.search_query && !body.filters_json) return;

  try {
    sendBody(body);
    if (import.meta.env.DEV) console.debug('[STK analytics]', body);
  } catch {
    // Analytics must fail silently.
  }
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
  if (label.includes('apple')) return 'apple';
  if (label.includes('ical') || link.hasAttribute('download')) return 'ics';
  return '';
};

const inferLinkType = (link: HTMLAnchorElement) => {
  const explicit = link.dataset.analyticsLinkType;
  if (explicit) return explicit;
  const label = link.textContent?.toLocaleLowerCase('sl-SI') ?? '';
  const href = link.href.toLocaleLowerCase('sl-SI');
  if (label.includes('prijava') || label.includes('registration')) return 'prijava';
  if (label.includes('razpis') || label.includes('official info')) return 'razpis';
  if (label.includes('uradna') || label.includes('official') || label.includes('organiser') || label.includes('organizer')) return 'uradna_stran';
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

const isTekobotHref = (href: string) => {
  try {
    const url = new URL(href, window.location.href);
    if (/^\/(?:en\/)?stk-tekobot\/?$/i.test(url.pathname)) return true;
    return url.hostname === 'chatgpt.com' && /stk-tekobot/i.test(`${url.pathname}${url.search}`);
  } catch {
    return false;
  }
};

export const initializeStkAnalyticsClickTracking = () => {
  if (typeof document === 'undefined') return;

  document.addEventListener('click', (event) => {
    const link = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>('a[href]') : null;
    if (!link) return;

    if (isTekobotHref(link.getAttribute('href') ?? '')) {
      trackStkEvent({ event_type: 'tekobot_clicked' });
      return;
    }

    const context = getEventContext(link);
    const calendarType = inferCalendarType(link);
    if (calendarType) {
      trackStkEvent({ event_type: 'calendar_add_clicked', ...context, calendar_type: calendarType });
      return;
    }

    const isVote = link.dataset.analyticsAction === 'vote' || /glasuj|vote/i.test(link.textContent ?? '');
    if (isVote) {
      trackStkEvent({ event_type: 'vote_clicked', ...context });
      return;
    }

    const linkType = inferLinkType(link);
    if (linkType) {
      trackStkEvent({
        event_type: 'external_link_clicked',
        ...context,
        action_type: linkType,
        target_domain: getStkTargetDomain(link.href)
      });
    }
  }, { capture: true });
};

export const filtersToAnalyticsJson = (filters: Record<string, string | boolean>) => {
  const selected = Object.fromEntries(
    Object.entries(filters).filter(([, value]) => Boolean(value) && value !== 'date')
  );
  return Object.keys(selected).length ? JSON.stringify(selected) : '';
};
