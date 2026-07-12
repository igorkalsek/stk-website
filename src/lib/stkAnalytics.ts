type StkAnalyticsEventType =
  | 'search_performed'
  | 'no_results_search'
  | 'external_link_clicked'
  | 'calendar_add_clicked'
  | 'vote_clicked'
  | 'tekobot_clicked'
  | 'share_clicked'
  | 'correction_clicked'
  | 'copy_clicked'
  | 'race_saved'
  | 'race_unsaved'
  | 'event_detail_viewed'
  | 'event_card_clicked'
  | 'related_race_clicked'
  | 'my_races_viewed'
  | 'my_races_bulk_ics_exported'
  | 'personalized_results_used';

export type StkAnalyticsPlacement =
  | 'home_featured'
  | 'home_this_week'
  | 'home_interest'
  | 'finder_results'
  | 'family_results'
  | 'most_voted_results'
  | 'race_detail'
  | 'related_races'
  | 'my_races'
  | 'personalized_results'
  | 'personal_calendar'
  | 'unknown';

type UserAgentGroup = 'mobile' | 'tablet' | 'desktop' | 'unknown';

export type StkAnalyticsPayload = {
  event_type: StkAnalyticsEventType;
  page_path?: string;
  language?: string;
  event_id?: string;
  event_name?: string;
  event_date?: string;
  event_year?: string;
  target_url?: string;
  action_type?: 'razpis' | 'prijava' | 'uradna_stran' | 'trasa' | 'gpx' | 'other' | string;
  search_query?: string;
  filters_json?: string;
  results_count?: number;
  target_domain?: string;
  calendar_type?: 'google' | 'apple' | 'outlook' | 'ics' | 'other' | string;
  referrer?: string;
  user_agent_group?: UserAgentGroup;
  notes?: string;
  placement?: StkAnalyticsPlacement | string;
};

const STK_SITE_EVENTS_ENDPOINT = 'https://script.google.com/macros/s/AKfycbwSm--BvE-xGB9ZMMjyXFZRh9wNeHUEpUeJyM6aJAUEsV-HIoarel4_bN1Tlf8gG-Z3/exec';
const MAX_FIELD_LENGTH = 500;
const MAX_JSON_FIELD_LENGTH = 1000;
const MAX_QUERY_LENGTH = 120;
const STK_ANALYTICS_OPT_OUT_KEY = 'stkAnalyticsOptOut';
const isStkAnalyticsDev = () => Boolean((import.meta as ImportMeta & { env?: { DEV?: boolean } }).env?.DEV);

const STK_CANONICAL_HOSTS = new Set(['tekaski-koledar.si', 'www.tekaski-koledar.si']);
const STK_LOCAL_HOSTS = new Set(['localhost', '127.0.0.1']);
const STK_PAGES_HOST = 'stk-website.pages.dev';

const isStkPagesHost = (hostname: string) => hostname === STK_PAGES_HOST || hostname.endsWith(`.${STK_PAGES_HOST}`);
const isRecognizedStkHost = (hostname: string) => STK_CANONICAL_HOSTS.has(hostname) || STK_LOCAL_HOSTS.has(hostname) || isStkPagesHost(hostname);

export const isInternalStkNavigationTarget = (href: string, currentHref?: string): boolean => {
  const rawHref = typeof href === 'string' ? href.trim() : '';
  if (!rawHref || /[\u0000-\u001f\s]/.test(rawHref)) return false;

  const browserHref = typeof window !== 'undefined' ? window.location.href : '';
  const baseHref = currentHref || browserHref || 'https://tekaski-koledar.si/';

  try {
    const currentUrl = new URL(baseHref);
    const targetUrl = new URL(rawHref, currentUrl);
    if (targetUrl.protocol !== 'http:' && targetUrl.protocol !== 'https:') return false;

    const currentHost = currentUrl.hostname.toLowerCase();
    const targetHost = targetUrl.hostname.toLowerCase();
    if (targetUrl.origin === currentUrl.origin && isRecognizedStkHost(currentHost)) return true;
    return isRecognizedStkHost(targetHost);
  } catch {
    return false;
  }
};

let hasProcessedAnalyticsToggle = false;

const ALLOWED_EVENT_TYPES = new Set<StkAnalyticsEventType>([
  'search_performed',
  'no_results_search',
  'external_link_clicked',
  'calendar_add_clicked',
  'vote_clicked',
  'tekobot_clicked',
  'share_clicked',
  'correction_clicked',
  'copy_clicked',
  'race_saved',
  'race_unsaved',
  'event_detail_viewed',
  'event_card_clicked',
  'related_race_clicked',
  'my_races_viewed',
  'my_races_bulk_ics_exported',
  'personalized_results_used'
]);

const ALLOWED_PLACEMENTS = new Set<StkAnalyticsPlacement>([
  'home_featured',
  'home_this_week',
  'home_interest',
  'finder_results',
  'family_results',
  'most_voted_results',
  'race_detail',
  'related_races',
  'my_races',
  'personalized_results',
  'personal_calendar',
  'unknown'
]);


const setStkAnalyticsOptOut = () => {
  try {
    window.localStorage?.setItem(STK_ANALYTICS_OPT_OUT_KEY, 'true');
    return true;
  } catch {
    return false;
  }
};

const removeStkAnalyticsOptOut = () => {
  try {
    window.localStorage?.removeItem(STK_ANALYTICS_OPT_OUT_KEY);
    return true;
  } catch {
    return false;
  }
};

const isStkAnalyticsOptedOut = () => {
  try {
    return window.localStorage?.getItem(STK_ANALYTICS_OPT_OUT_KEY) === 'true';
  } catch {
    return false;
  }
};

const cleanStkAnalyticsToggleParam = (url: URL) => {
  try {
    url.searchParams.delete('stk_analytics');
    const cleanUrl = `${url.pathname}${url.search}${url.hash}`;
    window.history.replaceState(window.history.state, document.title, cleanUrl);
  } catch {
    // Analytics controls must fail silently.
  }
};

const processStkAnalyticsToggleParam = () => {
  if (hasProcessedAnalyticsToggle || typeof window === 'undefined') return;
  hasProcessedAnalyticsToggle = true;

  try {
    const url = new URL(window.location.href);
    const toggleValue = url.searchParams.get('stk_analytics');
    if (toggleValue !== 'off' && toggleValue !== 'on') return;

    if (toggleValue === 'off') {
      if (setStkAnalyticsOptOut()) console.info('STK analytics disabled for this browser.');
    } else if (removeStkAnalyticsOptOut()) {
      console.info('STK analytics enabled for this browser.');
    }

    cleanStkAnalyticsToggleParam(url);
  } catch {
    // Analytics controls must fail silently.
  }
};

const normalizePlacement = (value: unknown): StkAnalyticsPlacement | '' => {
  const placement = typeof value === 'string' ? value.trim() : '';
  return ALLOWED_PLACEMENTS.has(placement as StkAnalyticsPlacement) ? placement as StkAnalyticsPlacement : '';
};

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

const EVENT_SCOPED_EVENT_TYPES = new Set<StkAnalyticsEventType>([
  'race_saved',
  'race_unsaved',
  'event_detail_viewed',
  'event_card_clicked',
  'related_race_clicked'
]);

const buildBody = (payload: StkAnalyticsPayload) => ({
  event_type: ALLOWED_EVENT_TYPES.has(payload.event_type) ? payload.event_type : 'external_link_clicked',
  page_path: trimText(payload.page_path || getPagePath()),
  language: trimText(payload.language || inferLanguage(), 12),
  event_id: trimText(payload.event_id, 120),
  event_name: trimText(payload.event_name),
  event_date: trimText(payload.event_date, 40),
  event_year: trimText(payload.event_year, 12),
  target_url: trimText(payload.target_url),
  action_type: trimText(payload.action_type, 80),
  search_query: trimText(payload.search_query, MAX_QUERY_LENGTH),
  filters_json: trimText(payload.filters_json, MAX_JSON_FIELD_LENGTH),
  results_count: Number.isFinite(payload.results_count) ? payload.results_count : '',
  target_domain: trimText(payload.target_domain, 180),
  calendar_type: trimText(payload.calendar_type, 80),
  referrer: trimText(payload.referrer || getReferrer()),
  user_agent_group: payload.user_agent_group || getUserAgentGroup(),
  notes: trimText(payload.notes),
  placement: normalizePlacement(payload.placement)
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

  processStkAnalyticsToggleParam();
  if (isStkAnalyticsOptedOut()) return;
  if (!ALLOWED_EVENT_TYPES.has(payload.event_type)) return;

  const body = buildBody(payload);
  if (EVENT_SCOPED_EVENT_TYPES.has(body.event_type) && (!/^\d{4}$/.test(body.event_year) || (!body.event_id && (!body.event_name || !body.event_date)))) return;
  if (body.event_type === 'external_link_clicked' && body.target_url && isInternalStkNavigationTarget(body.target_url)) return;
  if ((body.event_type === 'search_performed' || body.event_type === 'no_results_search') && !body.search_query && !body.filters_json) return;

  try {
    sendBody(body);
    if (isStkAnalyticsDev()) console.debug('[STK analytics]', body);
  } catch {
    // Analytics must fail silently.
  }
};

const getCard = (element: Element) =>
  element.closest<HTMLElement>('[data-analytics-event-name], [data-event-row], .event-card');

const getCardValue = (card: HTMLElement | null, key: string) => card?.dataset[key] ?? '';

const getPlacement = (element: HTMLElement) => normalizePlacement(element.dataset.analyticsPlacement || getCardValue(getCard(element), 'analyticsPlacement')) || 'unknown';

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

const ACTION_TYPE_MAP: Record<string, string> = {
  razpis: 'official_notice_click',
  prijava: 'registration_click',
  uradna_stran: 'official_site_click',
  trasa: 'route_click',
  gpx: 'gpx_click',
  group_run_form: 'google_form_click',
  correction_form: 'google_form_click'
};

const normalizeActionType = (value: string) => ACTION_TYPE_MAP[value] || value;

const inferLinkType = (link: HTMLAnchorElement) => {
  const explicit = link.dataset.stkAction || link.dataset.analyticsActionType || link.dataset.analyticsLinkType;
  if (explicit) return normalizeActionType(explicit);
  const label = link.textContent?.toLocaleLowerCase('sl-SI') ?? '';
  const href = link.href.toLocaleLowerCase('sl-SI');
  if (label.includes('prijava') || label.includes('registration')) return 'registration_click';
  if (label.includes('razpis') || label.includes('official info')) return 'official_notice_click';
  if (label.includes('uradna') || label.includes('official') || label.includes('organiser') || label.includes('organizer')) return 'official_site_click';
  if (label.includes('gpx') || href.includes('gpx')) return 'gpx_click';
  if (label.includes('trasa') || label.includes('route') || href.includes('strava') || href.includes('map')) return 'route_click';
  return '';
};

const getEventContext = (element: HTMLElement) => {
  const card = getCard(element);
  return {
    event_id: element.dataset.stkEventId || getCardValue(card, 'analyticsEventId') || getCardValue(card, 'eventRow'),
    event_name: element.dataset.stkEventName || getCardValue(card, 'analyticsEventName') || card?.querySelector('h3')?.textContent || '',
    event_date: element.dataset.stkEventDate || getCardValue(card, 'analyticsEventDate') || card?.querySelector('time')?.getAttribute('datetime') || '',
    event_year: element.dataset.stkEventYear || getCardValue(card, 'analyticsEventYear')
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

let hasInitializedStkAnalyticsClickTracking = false;
const pageLoadTrackedEventsByScope = new WeakMap<object, Set<string>>();

export const initializeStkAnalyticsClickTracking = () => {
  if (typeof document === 'undefined' || hasInitializedStkAnalyticsClickTracking) return;
  hasInitializedStkAnalyticsClickTracking = true;

  processStkAnalyticsToggleParam();

  document.addEventListener('click', (event) => {
    const clickedElement = event.target instanceof Element ? event.target.closest<HTMLElement>('a[href], button[data-analytics-event-type], button[data-analytics-action-type]') : null;
    if (!clickedElement) return;

    const explicitEventType = clickedElement.dataset.analyticsEventType as StkAnalyticsEventType | undefined;
    const explicitActionType = clickedElement.dataset.analyticsActionType;
    const explicitContext = getEventContext(clickedElement);
    if (explicitEventType && ALLOWED_EVENT_TYPES.has(explicitEventType)) {
      const targetUrl = clickedElement instanceof HTMLAnchorElement ? clickedElement.href : clickedElement.dataset.analyticsTargetUrl;
      trackStkEvent({
        event_type: explicitEventType,
        ...explicitContext,
        action_type: explicitActionType,
        target_url: targetUrl,
        target_domain: targetUrl ? getStkTargetDomain(targetUrl) : ''
      });
      return;
    }

    const link = clickedElement instanceof HTMLAnchorElement ? clickedElement : null;
    if (!link) return;

    const placement = getPlacement(link);
    const rawHref = link.getAttribute('href') || '';
    if (/^\/(?:en\/races|tek)\/\d{4}\//.test(rawHref) && !link.target) {
      const eventType = placement === 'related_races' ? 'related_race_clicked' : 'event_card_clicked';
      trackStkEvent({ event_type: eventType, ...getEventContext(link), placement });
      return;
    }

    if (isTekobotHref(link.getAttribute('href') ?? '')) {
      trackStkEvent({ event_type: 'tekobot_clicked' });
      return;
    }

    const context = getEventContext(link);
    const calendarType = inferCalendarType(link);
    if (calendarType) {
      trackStkEvent({ event_type: 'calendar_add_clicked', ...context, calendar_type: calendarType, action_type: `${calendarType}_calendar_click`, target_url: link.href, target_domain: getStkTargetDomain(link.href) });
      return;
    }

    const isVote = link.dataset.analyticsAction === 'vote' || /glasuj|vote/i.test(link.textContent ?? '');
    if (isVote) {
      trackStkEvent({ event_type: 'vote_clicked', ...context, action_type: 'vote_click', target_url: link.href, target_domain: getStkTargetDomain(link.href) });
      return;
    }

    const linkType = inferLinkType(link);
    if (linkType) {
      trackStkEvent({
        event_type: 'external_link_clicked',
        ...context,
        action_type: linkType,
        target_url: link.href,
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


const getCurrentPageLoadScope = (): object | null => {
  if (typeof document !== 'undefined') return document.body || document.documentElement || document;
  return null;
};

export const trackStkPageLoadEventOnce = (key: string, payload: StkAnalyticsPayload, scope: object | null = getCurrentPageLoadScope()) => {
  if (!key || !scope) return;
  const trackedEvents = pageLoadTrackedEventsByScope.get(scope) ?? new Set<string>();
  if (trackedEvents.has(key)) return;
  trackedEvents.add(key);
  pageLoadTrackedEventsByScope.set(scope, trackedEvents);
  trackStkEvent(payload);
};
