import { buildPlanningOverview, fetchPlanning2027, filterPlanningEvents, formatEventPlanningDate, formatPlanningRange, formatPlanningRegion, formatPlanningSurface, type PlanningEvent, type PlanningPayload } from './utils-planning-2027';

type Lang = 'sl' | 'en';
const escapeHtml = (value: string | number) => String(value).replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character]!);

const copy = (lang: Lang) => lang === 'en' ? {
  confirmed: 'Confirmed', expected: 'Expected', known: 'Date window known', weekend: 'Weekend', total: 'Total', show: 'Show events',
  noResults: 'No events match the selected filters.', unknown: 'Date not yet known', location: 'Location not provided'
} : {
  confirmed: 'Potrjeno', expected: 'Pričakovano', known: 'Termin znan', weekend: 'Vikend', total: 'Skupaj', show: 'Prikaži dogodke',
  noResults: 'Izbranim filtrom ne ustreza noben dogodek.', unknown: 'Termin še ni znan', location: 'Kraj ni naveden'
};

function eventHtml(event: PlanningEvent, lang: Lang): string {
  const labels = copy(lang);
  const status = event.status === 'potrjeno' ? labels.confirmed : event.status === 'termin_znan' ? labels.known : labels.expected;
  const details = [event.kraj || labels.location, formatPlanningRegion(event.regija, lang), formatPlanningSurface(event.tip_podlage, lang)].filter(Boolean).map(escapeHtml).join(' · ');
  return `<li class="planning-event"><div class="planning-event-main"><strong>${escapeHtml(event.naziv_prireditve)}</strong><span>${details}</span><time>${escapeHtml(formatEventPlanningDate(event, lang))}</time></div><span class="event-status event-status-${escapeHtml(event.status)}">${status}</span></li>`;
}

function detailsHtml(events: PlanningEvent[], lang: Lang): string {
  return `<details><summary>${copy(lang).show}</summary><ul class="planning-events">${events.map((event) => eventHtml(event, lang)).join('')}</ul></details>`;
}

export function renderPlanningOverview(root: HTMLElement, events: PlanningEvent[], lang: Lang): void {
  const labels = copy(lang);
  const overview = buildPlanningOverview(events);
  const tableBody = root.querySelector<HTMLElement>('[data-weekends-table]');
  const cards = root.querySelector<HTMLElement>('[data-weekends-cards]');
  const unknown = root.querySelector<HTMLElement>('[data-unknown-events]');
  const weekday = root.querySelector<HTMLElement>('[data-weekday-events]');
  const empty = root.querySelector<HTMLElement>('[data-empty-results]');
  if (!tableBody || !cards || !unknown || !weekday || !empty) return;
  tableBody.innerHTML = overview.weekends.map((weekend) => `<tr><th scope="row">${escapeHtml(formatPlanningRange(weekend.start, weekend.end, lang, false))}</th><td>${weekend.confirmed}</td><td>${weekend.expected}</td><td>${weekend.total}</td><td>${detailsHtml(weekend.events, lang)}</td></tr>`).join('');
  cards.innerHTML = overview.weekends.map((weekend) => `<article class="weekend-card"><h3>${escapeHtml(formatPlanningRange(weekend.start, weekend.end, lang, false))}</h3><p>${weekend.confirmed} ${labels.confirmed.toLocaleLowerCase(lang)} · ${weekend.expected} ${labels.expected.toLocaleLowerCase(lang)}</p><strong>${labels.total}: ${weekend.total}</strong>${detailsHtml(weekend.events, lang)}</article>`).join('');
  unknown.hidden = overview.unknown.length === 0;
  const unknownList = unknown.querySelector<HTMLElement>('ul');
  if (unknownList) unknownList.innerHTML = overview.unknown.map((event) => eventHtml(event, lang)).join('');
  weekday.hidden = overview.weekday.length === 0;
  const weekdayList = weekday.querySelector<HTMLElement>('ul');
  if (weekdayList) weekdayList.innerHTML = overview.weekday.map((event) => eventHtml(event, lang)).join('');
  empty.hidden = overview.weekends.length > 0 || overview.weekday.length > 0 || overview.unknown.length > 0;
}

export function initializePlanning2027(root: HTMLElement, initialPayload: PlanningPayload | null, lang: Lang): void {
  let events = initialPayload?.data ?? [];
  const content = root.querySelector<HTMLElement>('[data-planning-content]');
  const fallback = root.querySelector<HTMLElement>('[data-planning-fallback]');
  const selects = [...root.querySelectorAll<HTMLSelectElement>('[data-planning-filter]')];
  const populateDataOptions = () => {
    for (const name of ['region', 'surface']) {
      const select = selects.find((item) => item.name === name);
      if (!select) continue;
      const field = name === 'region' ? 'regija' : 'tip_podlage';
      const selected = select.value;
      while (select.options.length > 1) select.remove(1);
      [...new Set(events.map((event) => event[field]).filter(Boolean))].sort((a, b) => a.localeCompare(b, lang)).forEach((value) => select.add(new Option(name === 'region' ? formatPlanningRegion(value, lang) : formatPlanningSurface(value, lang), value)));
      if ([...select.options].some((option) => option.value === selected)) select.value = selected;
    }
  };
  const updateSummary = () => {
    const summary = root.querySelector<HTMLElement>('[data-planning-summary]');
    if (!summary) return;
    const counts = {
      confirmed: events.filter((event) => event.status === 'potrjeno').length,
      expected: events.filter((event) => event.status === 'pričakovano').length,
      known: events.filter((event) => event.status === 'termin_znan').length
    };
    for (const [name, value] of Object.entries(counts)) {
      const target = summary.querySelector<HTMLElement>(`[data-summary-${name}]`);
      if (target) target.textContent = String(value);
    }
    summary.hidden = false;
  };
  const render = () => {
    const values = Object.fromEntries(selects.map((select) => [select.name, select.value]));
    renderPlanningOverview(root, filterPlanningEvents(events, { month: values.month ?? '', region: values.region ?? '', surface: values.surface ?? '' }), lang);
  };
  const showPayload = () => { populateDataOptions(); updateSummary(); if (content) content.hidden = false; if (fallback) fallback.hidden = true; render(); };
  selects.forEach((select) => select.addEventListener('change', render));
  if (initialPayload) showPayload();
  fetchPlanning2027().then((payload) => {
    if (!payload) return;
    events = payload.data;
    showPayload();
  });
}
