import { buildRegistrationDeadlineViews, formatRegistrationDeadlineRelative, getRegistrationDeadlineCssState, type RegistrationDeadlineKind } from './utils-registration-deadlines.js';
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
};
