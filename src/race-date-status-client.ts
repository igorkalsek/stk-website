import { formatRaceDateStatus, getEventDatePhase, getTodayIsoInLjubljana } from './utils-date.js';

/** Keep the profile display in sync with the Ljubljana calendar day. */
export const initRaceDateStatuses = (root: ParentNode = document): void => {
  const elements = [...root.querySelectorAll<HTMLElement>('[data-race-date-status]')];
  if (!elements.length) return;
  const render = () => {
    const today = getTodayIsoInLjubljana();
    for (const element of elements) {
      const eventDate = element.dataset.eventDate || '';
      const label = formatRaceDateStatus(eventDate, element.dataset.language === 'en' ? 'en' : 'sl', today);
      element.closest('[data-race-profile]')?.toggleAttribute('data-past-profile', getEventDatePhase(eventDate, today) === 'past');
      element.textContent = label;
      element.hidden = !label;
    }
  };
  render();
  // Refresh an open tab after Ljubljana midnight, including DST and sleep/wake.
  window.setInterval(() => {
    if (document.visibilityState !== 'hidden') render();
  }, 60_000);
  window.addEventListener('pageshow', render);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') render();
  });
};
