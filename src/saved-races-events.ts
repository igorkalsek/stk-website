export const SAVED_RACES_CHANGED_EVENT = 'stk:saved-races-changed';

export const dispatchSavedRacesChanged = () => {
  if (typeof window === 'undefined' || typeof window.dispatchEvent !== 'function') return;
  window.dispatchEvent(new Event(SAVED_RACES_CHANGED_EVENT));
};
