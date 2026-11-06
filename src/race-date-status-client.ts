import { formatRaceDateStatus } from './utils-date.js';

/** Client-only relative status: static HTML retains the authoritative absolute date. */
export const initRaceDateStatuses = (root: ParentNode = document): void => {
  const elements = [...root.querySelectorAll<HTMLElement>('[data-race-date-status]')];
  if (!elements.length) return;
  const render = () => {
    for (const element of elements) {
      const label = formatRaceDateStatus(element.dataset.eventDate || '', element.dataset.language === 'en' ? 'en' : 'sl');
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
