import { trackStkEvent } from './lib/stkAnalytics.js';
import { isRaceSaved, readSavedRaces, toggleSavedRaceInStorage, type MinimalStorage, type SavedRaceInput } from './utils-saved-races.js';

type Language = 'sl' | 'en';
const LABELS = {
  sl: { unsaved: 'Shrani tek', saved: 'Shranjeno', saveAria: 'Shrani tek', removeAria: 'Odstrani iz Mojih tekov' },
  en: { unsaved: 'Save race', saved: 'Saved', saveAria: 'Save race', removeAria: 'Remove from My races' }
} as const;

const getStorage = (): MinimalStorage | null => {
  try { return window.localStorage; } catch { return null; }
};

const getLanguage = (button: HTMLElement): Language => button.dataset.language === 'en' ? 'en' : 'sl';
const getPlacement = (button: HTMLElement) => button.dataset.analyticsPlacement || (typeof button.closest === 'function' ? button.closest<HTMLElement>('[data-analytics-placement]')?.dataset.analyticsPlacement : '') || 'unknown';
const getRace = (button: HTMLElement): SavedRaceInput | null => {
  const eventId = button.dataset.eventId?.trim() ?? '';
  const year = button.dataset.eventYear?.trim() ?? '';
  if (!eventId || !/^\d{4}$/.test(year)) return null;
  return { eventId, year, date: button.dataset.eventDate?.trim() ?? '', title: button.dataset.eventTitle?.trim() ?? '' };
};

const buttonsForRace = (race: Pick<SavedRaceInput, 'eventId' | 'year'>) => Array.from(document.querySelectorAll<HTMLButtonElement>(`[data-saved-race-button][data-event-id="${CSS.escape(race.eventId)}"][data-event-year="${CSS.escape(race.year)}"]`));

const setButtonState = (button: HTMLButtonElement, saved: boolean) => {
  const labels = LABELS[getLanguage(button)];
  button.setAttribute('aria-pressed', saved ? 'true' : 'false');
  const iconOnly = button.dataset.savedRaceIconOnly === 'true';
  button.setAttribute('aria-label', saved ? button.dataset.savedRaceRemoveLabel || labels.removeAria : labels.saveAria);
  button.classList.toggle('saved-race-button-saved', saved);
  const icon = button.querySelector<HTMLElement>('.action-icon');
  if (icon) icon.textContent = saved ? '★' : '☆';
  const label = button.querySelector<HTMLElement>('[data-saved-race-label]');
  if (label) label.textContent = saved ? labels.saved : labels.unsaved;
  else if (!iconOnly) button.textContent = saved ? labels.saved : labels.unsaved;
};

export const initSavedRaceButtons = (root: ParentNode = document) => {
  const storage = getStorage();
  const state = readSavedRaces(storage).state;
  root.querySelectorAll<HTMLButtonElement>('[data-saved-race-button]').forEach((button) => {
    const race = getRace(button);
    setButtonState(button, race ? isRaceSaved(state, race) : false);
    if (button.dataset.savedRaceInitialized === 'true') return;
    button.dataset.savedRaceInitialized = 'true';
    button.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      const clickedRace = getRace(button);
      if (!clickedRace) return;
      const before = isRaceSaved(readSavedRaces(getStorage()).state, clickedRace);
      const result = toggleSavedRaceInStorage(getStorage(), clickedRace);
      if (before === result.saved) return;
      buttonsForRace(clickedRace).forEach((relatedButton) => setButtonState(relatedButton, result.saved));
      trackStkEvent({
        event_type: result.saved ? 'race_saved' : 'race_unsaved',
        event_id: clickedRace.eventId,
        event_name: clickedRace.title,
        event_date: clickedRace.date,
        event_year: clickedRace.year,
        language: getLanguage(button),
        placement: getPlacement(button)
      });
    });
  });
};

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => initSavedRaceButtons());
  else initSavedRaceButtons();
}
