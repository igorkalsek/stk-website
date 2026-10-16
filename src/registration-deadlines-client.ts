import { buildRegistrationDeadlineViews, formatRegistrationDeadlineRelative, getRegistrationDeadlineCssState, type RegistrationDeadlineKind } from './utils-registration-deadlines.js';
import { getVerifiedProfileDeadline } from './profile-deadline-v2.js';
import { getTodayIsoInLjubljana } from './utils-date.js';

export const initRegistrationDeadlineCountdowns = (root: ParentNode = document) => {
  const todayIso = getTodayIsoInLjubljana();
  root.querySelectorAll<HTMLElement>('[data-registration-deadline]').forEach((element) => {
    const kind = element.dataset.deadlineKind === 'early' ? 'early' : element.dataset.deadlineKind === 'registration' ? 'registration' : '';
    const deadlineDate = element.dataset.deadlineDate || '';
    if (!kind || !deadlineDate) return;
    const views = buildRegistrationDeadlineViews({
      todayIso,
      eventDate: element.dataset.eventDate || undefined,
      registrationDeadline: kind === 'registration' ? deadlineDate : undefined,
      earlyRegistrationDeadline: kind === 'early' ? deadlineDate : undefined
    });
    const view = views.find((item) => item.kind === kind as RegistrationDeadlineKind && item.date === deadlineDate) ?? views[0];
    if (!view) return;
    element.textContent = formatRegistrationDeadlineRelative(view, element.dataset.language === 'en' ? 'en' : 'sl');
    element.classList.remove('deadline-future', 'deadline-soon', 'deadline-today', 'deadline-past');
    element.classList.add(getRegistrationDeadlineCssState(view));
    element.dataset.registrationDeadlineInitialized = 'true';
  });
  void initVerifiedProfileDeadlines(root);
};

// A failed/missing v2 response leaves #227's neutral HTML/countdown intact.
const initVerifiedProfileDeadlines = async (root: ParentNode) => {
  const elements = [...root.querySelectorAll<HTMLElement>('[data-deadline-edition]')];
  const editionId = elements[0]?.dataset.deadlineEdition;
  const eventDate = elements[0]?.dataset.eventDate;
  const today = getTodayIsoInLjubljana();
  if (!editionId || !eventDate || eventDate < today || !eventDate.startsWith('2026-')) return;
  const originals = elements.map(element => ({ element, label: element.closest('.registration-deadline-detail')?.querySelector('dt'), text: element.textContent, labelText: element.closest('.registration-deadline-detail')?.querySelector('dt')?.textContent }));
  let payload: unknown;
  const render = () => {
    const now = getTodayIsoInLjubljana();
    for (const { element, label, text, labelText } of originals) {
      element.parentElement?.querySelector('[data-deadline-v2-source]')?.remove();
      const language = element.dataset.language === 'en' ? 'en' : 'sl';
      const verified = getVerifiedProfileDeadline(payload, element.dataset.deadlineEdition || '', element.dataset.deadlineDate || '', now, language);
      if (label) label.textContent = verified?.label ?? labelText ?? '';
      // Recompute the neutral countdown too when an open tab crosses midnight.
      const view = buildRegistrationDeadlineViews({ todayIso: now, eventDate, registrationDeadline: element.dataset.deadlineKind === 'registration' ? element.dataset.deadlineDate : undefined, earlyRegistrationDeadline: element.dataset.deadlineKind === 'early' ? element.dataset.deadlineDate : undefined })[0];
      element.textContent = verified?.relative ?? (view ? formatRegistrationDeadlineRelative(view, language) : text);
      if (view) {
        element.classList.remove('deadline-future', 'deadline-soon', 'deadline-today', 'deadline-past');
        element.classList.add(getRegistrationDeadlineCssState(view));
      }
      if (verified) {
        element.dataset.deadlineV2Id = verified.deadlineId;
        const link = document.createElement('a');
        link.href = verified.source;
        link.textContent = language === 'sl' ? 'Uradno dokazilo' : 'Official source';
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.dataset.deadlineV2Source = 'true';
        element.after(link);
      } else {
        delete element.dataset.deadlineV2Id;
      }
    }
  };
  try {
    const query = new URLSearchParams({ contract: '2', year: '2026', from: today, to: eventDate, limit: '100' });
    const response = await fetch(`https://stk-master-api.igor-kalsek.workers.dev/deadlines?${query}`, { cache: 'no-store', signal: AbortSignal.timeout(12000) });
    if (!response.ok) return;
    payload = await response.json();
    render();
  } catch { return; }
  // Check validity at Ljubljana midnight without requiring a rebuild/reload.
  const scheduleMidnight = () => {
    const day = getTodayIsoInLjubljana();
    const nextUtc = new Date(Date.parse(`${day}T00:00:00Z`) + 86400000);
    const hour = Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Ljubljana', hour: '2-digit', hourCycle: 'h23' }).format(nextUtc));
    const midnight = nextUtc.getTime() - hour * 3600000;
    window.setTimeout(() => { render(); scheduleMidnight(); }, Math.max(1, midnight - Date.now()));
  };
  scheduleMidnight();
  document.addEventListener('visibilitychange', render);
  window.addEventListener('pageshow', render);
};
