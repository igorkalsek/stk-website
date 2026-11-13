import { isApprovedLocation, isValidWgs84, NEARBY_RADII_KM, type NearbyEditionLocation, type NearbyPoint, type NearbyRadiusKm } from '../utils-nearby-races.js';

export type NearbyUiSelection = { origin: NearbyPoint; radiusKm: NearbyRadiusKm };
export type NearbyUi = {
  updateNotice: (message: string) => void;
  clear: () => void;
};

/** Reject malformed coordinates instead of silently converting empty text to zero. */
export function parseNearbyOrigin(latitudeRaw: string, longitudeRaw: string): NearbyPoint | null {
  const parse = (raw: string): number | null => {
    const input = raw.trim();
    if (!/^[+-]?(?:\d+(?:[.,]\d+)?|[.,]\d+)$/.test(input)) return null;
    const number = Number(input.replace(',', '.'));
    return Number.isFinite(number) ? number : null;
  };
  const latitude = parse(latitudeRaw);
  const longitude = parse(longitudeRaw);
  if (latitude === null || longitude === null) return null;
  const point = { latitude, longitude };
  return isValidWgs84(point) ? point : null;
}

export function parseNearbyRadius(value: string): NearbyRadiusKm | null {
  if (!/^(10|25|50|100)$/.test(value)) return null;
  const radius = Number(value) as NearbyRadiusKm;
  return NEARBY_RADII_KM.includes(radius) ? radius : null;
}

/**
 * This element is inert unless BOTH the code feature flag and an explicit
 * runtime-approved index exist. Query params / DOM attributes cannot unlock it.
 * Precise user coordinates are held in memory only; no URL, localStorage or
 * analytics writes. Geolocation occurs exclusively on the user's click.
 */
export function mountNearbyFinderUi(options: {
  enabled: boolean;
  locale: 'sl' | 'en';
  locations: readonly NearbyEditionLocation[];
  onChange: (selection: NearbyUiSelection | null) => void;
  root: Document;
}): NearbyUi | null {
  if (!options.enabled || !options.locations.some(isApprovedLocation)) return null;

  const panel = options.root.querySelector<HTMLElement>('[data-nearby-panel]');
  const fields = panel?.querySelector<HTMLFieldSetElement>('[data-nearby-fields]');
  const latitude = panel?.querySelector<HTMLInputElement>('[data-nearby-latitude]');
  const longitude = panel?.querySelector<HTMLInputElement>('[data-nearby-longitude]');
  const radius = panel?.querySelector<HTMLSelectElement>('[data-nearby-radius]');
  const useLocation = panel?.querySelector<HTMLButtonElement>('[data-nearby-geolocate]');
  const apply = panel?.querySelector<HTMLButtonElement>('[data-nearby-apply]');
  const clear = panel?.querySelector<HTMLButtonElement>('[data-nearby-clear]');
  const status = panel?.querySelector<HTMLElement>('[data-nearby-status]');
  if (!panel || !fields || !latitude || !longitude || !radius || !useLocation || !apply || !clear || !status) return null;

  const en = options.locale === 'en';
  let pendingGeolocation = 0;
  const setStatus = (message: string) => { status.textContent = message; };
  const clearSelection = () => {
    pendingGeolocation++;
    latitude.value = '';
    longitude.value = '';
    radius.value = '25';
    setStatus('');
    options.onChange(null);
  };
  const applySelection = () => {
    pendingGeolocation++; // Cancel any earlier geolocation response on manual apply.
    const origin = parseNearbyOrigin(latitude.value, longitude.value);
    const radiusKm = parseNearbyRadius(radius.value);
    if (!origin || radiusKm === null) {
      // A failed new origin must never leave matches from a previous valid origin.
      // Keep the text fields intact so the user can correct the input.
      options.onChange(null);
      setStatus(en ? 'Enter valid latitude and longitude.' : 'Vnesite veljavno zemljepisno širino in dolžino.');
      return;
    }
    setStatus('');
    options.onChange({ origin, radiusKm });
  };

  // This panel is intentionally absent from the visible and focusable UI
  // until future approved-index integration enables it.
  fields.disabled = false;
  panel.hidden = false;
  // A person typing their own origin takes precedence over a pending location permission request.
  latitude.addEventListener('input', () => { pendingGeolocation++; });
  longitude.addEventListener('input', () => { pendingGeolocation++; });
  apply.addEventListener('click', applySelection);
  clear.addEventListener('click', clearSelection);
  // Changing the radius with invalid coordinates must also clear stale matches.
  radius.addEventListener('change', applySelection);
  useLocation.addEventListener('click', () => {
    const sequence = ++pendingGeolocation;
    const geolocation = options.root.defaultView?.navigator.geolocation;
    if (!geolocation) {
      setStatus(en ? 'Location access is unavailable. Enter coordinates instead.'
        : 'Dostop do lokacije ni na voljo. Koordinate lahko vnesete ročno.');
      return;
    }
    setStatus(en ? 'Requesting location permission…' : 'Čakamo na dovoljenje za lokacijo …');
    geolocation.getCurrentPosition(
      (position) => {
        if (sequence !== pendingGeolocation) return;
        const point = {latitude: position.coords.latitude, longitude: position.coords.longitude};
        if (!isValidWgs84(point)) {
          setStatus(en ? 'Invalid location received.' : 'Prejeta lokacija ni veljavna.');
          return;
        }
        latitude.value = String(point.latitude);
        longitude.value = String(point.longitude);
        applySelection();
      },
      () => {
        if (sequence === pendingGeolocation) setStatus(en
          ? 'Location permission denied or unavailable. Enter coordinates instead.'
          : 'Lokacija ni dovoljena ali dosegljiva. Koordinate lahko vnesete ročno.');
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 0 }
    );
  });
  return { updateNotice: setStatus, clear: clearSelection };
}
