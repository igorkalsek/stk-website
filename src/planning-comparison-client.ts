import { comparePlanningEvents, formatComparisonRange, matchPlanningLinks, type ComparisonGroup, type PlanningLink } from './utils-planning-comparison.js';
import { formatEventPlanningDate, formatPlanningEventCount, formatPlanningRegion, formatPlanningSurface, type PlanningEvent } from './utils-planning-2027.js';

type Lang = 'sl' | 'en';
type State = 'loading' | 'ready' | 'error';
const escape = (value: string) => value.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
const labels = (lang: Lang): Record<ComparisonGroup, string> => lang === 'en' ? {
  confirmed: 'Confirmed on the selected dates', nearby: 'Confirmed nearby', expected: 'Expected · STK estimate', known: 'Known date windows · exact date unconfirmed'
} : {
  confirmed: 'Potrjeno v izbranem terminu', nearby: 'Potrjeno v bližini', expected: 'Pričakovano · ocena STK', known: 'Znana časovna okna · točen datum ni potrjen'
};

export function initializePlanningComparison(root: HTMLElement, lang: Lang) {
  const date = root.querySelector<HTMLInputElement>('[data-comparison-date]');
  const mode = root.querySelector<HTMLSelectElement>('[data-comparison-mode]');
  const results = root.querySelector<HTMLElement>('[data-comparison-results]');
  const status = root.querySelector<HTMLElement>('[data-comparison-status]');
  if (!date || !mode || !results || !status) return { update: (_events: PlanningEvent[], _state: State) => {}, render: () => {} };
  let events: PlanningEvent[] = [];
  let state: State = 'loading';
  let candidates: PlanningLink[] = [];
  try { candidates = JSON.parse(root.querySelector('[data-planning-links]')?.textContent ?? '[]'); } catch { /* Links are optional. */ }
  if (!Array.isArray(candidates)) candidates = [];
  candidates = candidates.filter(link => link && typeof link.key === 'string' && typeof link.officialUrl === 'string' && typeof link.profilePath === 'string');

  const render = () => {
    results.replaceChildren();
    status.hidden = false;
    if (state !== 'ready') {
      status.textContent = state === 'loading'
        ? (lang === 'en' ? 'Checking the latest race dates …' : 'Preverjamo najnovejše termine …')
        : (lang === 'en' ? 'The comparison is unavailable because the latest dates could not be loaded. Refresh the page to try again.' : 'Primerjava ni na voljo, ker najnovejših terminov ni bilo mogoče naložiti. Poskusite osvežiti stran.');
      return;
    }
    if (!date.value || !date.validity.valid) {
      status.textContent = lang === 'en' ? 'Choose a date in 2027 to compare known events.' : 'Za primerjavo znanih dogodkov izberite datum v letu 2027.';
      return;
    }
    const region = root.querySelector<HTMLSelectElement>('select[name="region"]')?.value ?? '';
    const surface = root.querySelector<HTMLSelectElement>('select[name="surface"]')?.value ?? '';
    const comparison = comparePlanningEvents(events, date.value, mode.value === 'weekend' ? 'weekend' : 'day', { region, surface });
    if (!comparison) { status.textContent = lang === 'en' ? 'Choose a valid date in 2027.' : 'Izberite veljaven datum v letu 2027.'; return; }
    status.hidden = true;
    const names = labels(lang);
    const links = matchPlanningLinks(events, candidates);
    const { range, groups } = comparison;
    const title = `${lang === 'en' ? 'Comparing' : 'Primerjava'}: ${formatComparisonRange(range.start, range.end, lang)}`;
    const nearby = lang === 'en'
      ? `Nearby: 7 days before and 7 days after the selected period (${formatComparisonRange(range.nearbyStart, range.nearbyEnd, lang)}).`
      : `V bližini: 7 dni pred in 7 dni po izbranem obdobju (${formatComparisonRange(range.nearbyStart, range.nearbyEnd, lang)}).`;
    const card = (event: PlanningEvent) => {
      const link = links.get(event);
      const metadata = [event.kraj || (lang === 'en' ? 'Location not provided' : 'Kraj ni naveden'), formatPlanningRegion(event.regija, lang), formatPlanningSurface(event.tip_podlage, lang) || (lang === 'en' ? 'Surface not provided' : 'Podlaga ni navedena')].filter(Boolean).join(' · ');
      const official = link?.officialUrl ? `<a href="${escape(link.officialUrl)}" target="_blank" rel="noopener noreferrer">${lang === 'en' ? 'Official link' : 'Uradna povezava'}</a>` : '';
      const profile = link?.profilePath ? `<a href="${escape(link.profilePath)}">${lang === 'en' ? 'STK race profile' : 'Profil teka na STK'}</a>` : '';
      return `<li class="planning-event"><div class="planning-event-main"><strong>${escape(event.naziv_prireditve)}</strong><time>${escape(formatEventPlanningDate(event, lang))}</time><span>${escape(metadata)}</span>${event.status === 'pričakovano' ? `<em>${names.expected}</em>` : ''}${official || profile ? `<div class="comparison-links">${official}${profile}</div>` : ''}</div></li>`;
    };
    const empty = lang === 'en'
      ? 'STK currently knows of no overlap for the selected dates and filters. The data is incomplete; this does not mean the dates are available.'
      : 'STK za izbrani termin in filtre trenutno ne pozna prekrivanja. Podatki niso popolni; to ne pomeni, da je termin prost.';
    const total = Object.values(groups).reduce((count, group) => count + group.length, 0);
    const note = (text: string) => `<p class="comparison-note">${escape(text)}</p>`;
    const groupHtml = (key: ComparisonGroup) => {
      const group = groups[key];
      const explanation = key === 'expected'
        ? (lang === 'en' ? 'The estimated period overlaps your dates. It is not organiser-confirmed.' : 'Predvideno obdobje vključuje izbrani termin. To ni potrditev organizatorja.')
        : key === 'known'
          ? (lang === 'en' ? 'A known period, without a confirmed exact date.' : 'Znano je obdobje, ne potrjen točen datum.')
          : '';
      const content = group.length
        ? `${explanation ? note(explanation) : ''}<ul class="planning-events">${group.map(card).join('')}</ul>`
        : note(lang === 'en' ? 'No known events in this group for the selected dates and filters.' : 'Za izbrani termin in filtre v tej skupini ni znanih dogodkov.');
      return `<section class="comparison-group comparison-${key}" data-comparison-group="${key}">
        <h4>${names[key]} <span>(${formatPlanningEventCount(group.length, lang)})</span></h4>${content}
      </section>`;
    };
    const coverage = comparison.outsideYear
      ? note(lang === 'en' ? 'Only 2027 data is covered. Parts of the range outside 2027 cannot be assessed.' : 'Podatki zajemajo samo leto 2027. Dela razpona zunaj leta 2027 ni mogoče oceniti.') : '';
    const filterNote = region || surface
      ? note(lang === 'en' ? 'Region and surface filters apply. Events missing these details may be excluded. The month filter only changes the overview below.' : 'Upoštevana sta filtra regije in podlage. Dogodki brez teh podatkov so lahko izključeni. Mesec omejuje samo spodnji pregled.') : '';
    const undated = comparison.undated
      ? note(lang === 'en'
        ? `Without a reliable date or complete period: ${formatPlanningEventCount(comparison.undated, lang)} matching the filters. These events cannot be compared.`
        : `Brez zanesljivega datuma ali celotnega obdobja: ${formatPlanningEventCount(comparison.undated, lang)} z izbranimi filtri. Teh dogodkov ni mogoče primerjati.`) : '';
    const disclaimer = total
      ? note(lang === 'en' ? 'STK data is incomplete. This comparison does not guarantee that dates are available.' : 'Podatki STK niso popolni. Primerjava ne zagotavlja prostega termina.') : '';
    results.innerHTML = `<h3>${escape(title)}</h3>${note(nearby)}${coverage}${filterNote}
      ${total ? `<div class="comparison-groups">${(Object.keys(names) as ComparisonGroup[]).map(groupHtml).join('')}</div>` : `<p class="planning-empty">${empty}</p>`}
      ${undated}${disclaimer}`;
  };
  date.addEventListener('change', render);
  mode.addEventListener('change', render);
  return { render, update: (next: PlanningEvent[], nextState: State) => { events = next; state = nextState; render(); } };
}
