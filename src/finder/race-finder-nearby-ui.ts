import { isApprovedLocation, isValidWgs84, NEARBY_RADII_KM, type NearbyEditionLocation, type NearbyPoint, type NearbyRadiusKm } from '../utils-nearby-races.js';

// A reviewed origin catalog is independent of race-edition coordinates.
// Catalog coordinates stay local; selecting a place needs no permission or IO.
export type NearbyOriginPlace = {
  id: string; labelSl: string; labelEn: string;
  latitude: number; longitude: number;
  sourceUrl: string; sourceCheckedOn: string;
  reviewStatus: 'review' | 'approved'; approved_for_runtime: boolean;
};
export function isApprovedNearbyOrigin(place: NearbyOriginPlace): boolean {
  if (!place || place.reviewStatus !== 'approved' || place.approved_for_runtime !== true ||
      !/^[a-z0-9][a-z0-9_-]{0,63}$/i.test(place.id) ||
      !place.labelSl?.trim() || !place.labelEn?.trim() ||
      !isValidWgs84(place)) return false;
  if (!/^https:\/\/[^\s]+$/i.test(place.sourceUrl) ||
      !/^\d{4}-\d{2}-\d{2}$/.test(place.sourceCheckedOn)) return false;
  const date = new Date(place.sourceCheckedOn + 'T00:00:00.000Z');
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0,10) === place.sourceCheckedOn;
}

export type NearbyUiSelection = { origin: NearbyPoint; radiusKm: NearbyRadiusKm };
export type NearbyUi = {
  updateNotice: (message: string) => void;
  updateUnlocated: (races: readonly { date: string; title: string; place: string; href: string }[]) => void;
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
  originPlaces?: readonly NearbyOriginPlace[];
  onChange: (selection: NearbyUiSelection | null) => void;
  root: Document;
}): NearbyUi | null {
  if (!options.enabled || !options.locations.some(isApprovedLocation)) return null;

  const panel = options.root.querySelector<HTMLElement>('[data-nearby-panel]');
  const fields = panel?.querySelector<HTMLFieldSetElement>('[data-nearby-fields]');
  const originGroup = panel?.querySelector<HTMLElement>('[data-nearby-origin-place-group]');
  const originPlace = panel?.querySelector<HTMLSelectElement>('[data-nearby-origin-place]');
  const latitude = panel?.querySelector<HTMLInputElement>('[data-nearby-latitude]');
  const longitude = panel?.querySelector<HTMLInputElement>('[data-nearby-longitude]');
  const radius = panel?.querySelector<HTMLSelectElement>('[data-nearby-radius]');
  const useLocation = panel?.querySelector<HTMLButtonElement>('[data-nearby-geolocate]');
  const apply = panel?.querySelector<HTMLButtonElement>('[data-nearby-apply]');
  const clear = panel?.querySelector<HTMLButtonElement>('[data-nearby-clear]');
  const status = panel?.querySelector<HTMLElement>('[data-nearby-status]');
  const originSummary = panel?.querySelector<HTMLElement>('[data-nearby-origin-summary]');
  if (!panel || !fields || !latitude || !longitude || !radius || !useLocation || !apply || !clear || !status || !originSummary) return null;

  const unlocated = panel.querySelector<HTMLDetailsElement>('[data-nearby-unlocated]');
  const unlocatedCount = panel.querySelector<HTMLElement>('[data-nearby-unlocated-count]');
  const unlocatedList = panel.querySelector<HTMLElement>('[data-nearby-unlocated-list]');
  const updateUnlocated: NearbyUi['updateUnlocated'] = (races) => {
    if (!unlocated || !unlocatedCount || !unlocatedList) return;
    const items = races.map(race => {
      const li = options.root.createElement('li');
      const date = options.root.createElement('time');
      date.dateTime = race.date;
      date.textContent = new Intl.DateTimeFormat(options.locale === 'en' ? 'en-GB' : 'sl-SI', {
        day: 'numeric', month: 'short', year: 'numeric'
      }).format(new Date(`${race.date}T00:00:00`));
      const link = options.root.createElement('a');
      // Only existing, same-site race profiles are allowed in this list.
      if (/^\/(?:tek|en\/races)\/(?:2026|2027)\/r[0-9]+-[a-z0-9-]+\/$/.test(race.href)) link.href = race.href;
      link.textContent = race.title;
      li.append(date, ' · ', link, race.place ? ` · ${race.place}` : '');
      return li;
    });
    unlocatedList.replaceChildren(...items);
    unlocatedCount.textContent = `(${races.length})`;
    unlocated.hidden = races.length === 0;
    if (!races.length) unlocated.open = false;
  };

  const en = options.locale === 'en';
  let pendingGeolocation = 0;
  let activeOrigin: 'manual' | 'place' | 'device' = 'manual';
  let selectedOriginLabel = '';
  let hasAppliedSelection = false;
  const setStatus = (message: string) => { status.textContent = message; };
  const showOrigin = (text: string) => { originSummary.textContent = text; };
  const candidates = options.originPlaces ?? [];
  const origins = candidates.length && candidates.every(isApprovedNearbyOrigin) &&
      new Set(candidates.map(place => place.id)).size === candidates.length ? candidates : [];
  if (origins.length && originGroup && originPlace) {
    for (const place of origins) {
      const option = options.root.createElement('option');
      option.value = place.id;
      option.textContent = en ? place.labelEn : place.labelSl;
      originPlace.append(option);
    }
    originGroup.hidden = false;
  }
  const clearSelection = () => {
    pendingGeolocation++;
    latitude.value = '';
    longitude.value = '';
    if (originPlace) originPlace.value = '';
    radius.value = '25';
    activeOrigin = 'manual';
    selectedOriginLabel = '';
    hasAppliedSelection = false;
    showOrigin('');
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
      hasAppliedSelection = false;
      showOrigin('');
      options.onChange(null);
      setStatus(en ? 'Enter valid latitude and longitude.' : 'Vnesite veljavno zemljepisno širino in dolžino.');
      return;
    }
    hasAppliedSelection = true;
    const label = activeOrigin === 'place'
      ? selectedOriginLabel
      : activeOrigin === 'device'
        ? (en ? 'Device location' : 'Lokacija naprave')
        : (en ? 'Custom coordinates' : 'Ročne koordinate');
    showOrigin((en ? 'Active origin: ' : 'Aktivno izhodišče: ') + label);
    setStatus('');
    options.onChange({ origin, radiusKm });
  };

  // Keep the panel unfocusable until the explicit release flag is enabled.
  fields.disabled = false;
  panel.hidden = false;
  if (origins.length && originGroup && originPlace) {
    originPlace.addEventListener('change', () => {
      pendingGeolocation++;
      const selected = origins.find(place => place.id === originPlace.value);
      if (!selected) {
        latitude.value = ''; longitude.value = '';
        activeOrigin = 'manual'; selectedOriginLabel = ''; hasAppliedSelection = false;
        showOrigin(''); setStatus(''); options.onChange(null);
        return;
      }
      activeOrigin = 'place';
      selectedOriginLabel = en ? selected.labelEn : selected.labelSl;
      latitude.value = String(selected.latitude);
      longitude.value = String(selected.longitude);
      applySelection(); // no geolocation permission or external service
    });
  }
  // Manual typing takes precedence over the catalog and any pending GPS request.
  const onManualEdit = () => {
    pendingGeolocation++;
    activeOrigin = 'manual';
    selectedOriginLabel = '';
    if (originPlace) originPlace.value = '';
    // Previous radius results must not remain active after an origin is edited.
    if (hasAppliedSelection) {
      hasAppliedSelection = false;
      options.onChange(null);
    }
    showOrigin(en ? 'Custom coordinates: apply the search to update results.'
      : 'Ročne koordinate: za posodobitev izberite Prikažite teke.');
  };
  latitude.addEventListener('input', onManualEdit);
  longitude.addEventListener('input', onManualEdit);
  apply.addEventListener('click', applySelection);
  clear.addEventListener('click', clearSelection);
  // Changing the radius with invalid coordinates must also clear stale matches.
  radius.addEventListener('change', applySelection);
  useLocation.addEventListener('click', () => {
    const sequence = ++pendingGeolocation;
    const geolocation = options.root.defaultView?.navigator.geolocation;
    if (!geolocation) {
      setStatus(en ? 'Location access is unavailable. Select a place instead.'
        : 'Dostop do lokacije ni na voljo. Izberite kraj izhodišča.');
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
        if (originPlace) originPlace.value = '';
        activeOrigin = 'device';
        selectedOriginLabel = '';
        latitude.value = String(point.latitude);
        longitude.value = String(point.longitude);
        applySelection();
      },
      () => {
        if (sequence === pendingGeolocation) setStatus(en
          ? 'Location permission denied or unavailable. Select a place instead.'
          : 'Lokacija ni dovoljena ali dosegljiva. Izberite kraj izhodišča.');
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 0 }
    );
  });
  return { updateNotice: setStatus, updateUnlocated, clear: clearSelection };
}
