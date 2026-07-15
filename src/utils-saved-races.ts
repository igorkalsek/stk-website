export const SAVED_RACES_STORAGE_KEY = 'stkSavedRacesV2';
export const LEGACY_SAVED_RACES_STORAGE_KEY = 'stkSavedRacesV1';
export const SAVED_RACES_VERSION = 2 as const;
export const MAX_SAVED_RACES = 500;

export type MinimalStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
export type SavedRaceStatus = 'following' | 'planning' | 'registered' | 'completed';
export type SavedRace = { version: 2; eventId: string; year: string; date: string; title: string; status: SavedRaceStatus };
export type SavedRacesState = { version: 2; races: SavedRace[] };
export type SavedRaceInput = Omit<SavedRace, 'version' | 'status'> & { status?: SavedRaceStatus };
export type SavedRacesResult = { state: SavedRacesState; persistent: boolean };

export const SAVED_RACE_STATUSES: readonly SavedRaceStatus[] = ['following', 'planning', 'registered', 'completed'];
export const DEFAULT_SAVED_RACE_STATUS: SavedRaceStatus = 'following';
export const SAVED_RACE_STATUS_LABELS = {
  sl: { following: 'Spremljam', planning: 'Planiram', registered: 'Prijavljen', completed: 'Opravljen' },
  en: { following: 'Following', planning: 'Planning', registered: 'Registered', completed: 'Completed' }
} as const;
export const SAVED_RACE_STATUS_COPY = {
  sl: { label: 'Moj status', empty: 'Ni v Mojih tekih', all: 'Vsi', helper: 'Status je shranjen samo v tem brskalniku.', emptyFilter: 'V tem statusu ni shranjenih tekov.' },
  en: { label: 'My status', empty: 'Not in My races', all: 'All', helper: 'The status is stored only in this browser.', emptyFilter: 'There are no saved races with this status.' }
} as const;

const emptyState = (): SavedRacesState => ({ version: 2, races: [] });
const cleanText = (value: unknown, maxLength = 200) => typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
export const getSavedRaceKey = (race: Pick<SavedRace, 'year' | 'eventId'>) => `${race.year}:${race.eventId}`;
export const isSavedRaceStatus = (value: unknown): value is SavedRaceStatus => typeof value === 'string' && SAVED_RACE_STATUSES.includes(value as SavedRaceStatus);

const validateIdentity = (record: Record<string, unknown>) => {
  const eventId = cleanText(record.eventId, 80);
  const year = cleanText(record.year, 4);
  const date = cleanText(record.date, 20);
  const title = cleanText(record.title, 200);
  if (!eventId || !/^\d{4}$/.test(year)) return null;
  return { eventId, year, date, title };
};

export const validateSavedRace = (value: unknown): SavedRace | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  if (record.version !== SAVED_RACES_VERSION) return null;
  const identity = validateIdentity(record);
  if (!identity) return null;
  return { version: 2, ...identity, status: isSavedRaceStatus(record.status) ? record.status : DEFAULT_SAVED_RACE_STATUS };
};

const validateLegacySavedRace = (value: unknown): Omit<SavedRace, 'version' | 'status'> | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  if (record.version !== 1) return null;
  return validateIdentity(record);
};

export const normalizeSavedRaceInput = (race: SavedRaceInput): SavedRace | null => validateSavedRace({ ...race, version: 2, status: isSavedRaceStatus(race.status) ? race.status : DEFAULT_SAVED_RACE_STATUS });

export const dedupeSavedRaces = (races: unknown): SavedRace[] => {
  if (!Array.isArray(races)) return [];
  const seen = new Set<string>();
  const result: SavedRace[] = [];
  for (const item of races) {
    const race = validateSavedRace(item);
    if (!race) continue;
    const key = getSavedRaceKey(race);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(race);
    if (result.length >= MAX_SAVED_RACES) break;
  }
  return result;
};

const dedupeLegacySavedRaces = (races: unknown): SavedRace[] => {
  if (!Array.isArray(races)) return [];
  const seen = new Set<string>();
  const result: SavedRace[] = [];
  for (const item of races) {
    const race = validateLegacySavedRace(item);
    if (!race) continue;
    const key = getSavedRaceKey(race);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push({ version: 2, ...race, status: DEFAULT_SAVED_RACE_STATUS });
    if (result.length >= MAX_SAVED_RACES) break;
  }
  return result;
};

export const validateSavedRacesState = (value: unknown): SavedRacesState | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  if (record.version !== SAVED_RACES_VERSION) return null;
  return { version: 2, races: dedupeSavedRaces(record.races) };
};

const validateLegacySavedRacesState = (value: unknown): SavedRacesState | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  if (record.version !== 1) return null;
  return { version: 2, races: dedupeLegacySavedRaces(record.races) };
};

export const parseSavedRacesJson = (json: string | null | undefined) => {
  if (!json) return null;
  try { return validateSavedRacesState(JSON.parse(json)); } catch { return null; }
};

const parseLegacySavedRacesJson = (json: string | null | undefined) => {
  if (!json) return null;
  try { return validateLegacySavedRacesState(JSON.parse(json)); } catch { return null; }
};

export const readSavedRaces = (storage?: MinimalStorage | null): SavedRacesResult => {
  if (!storage) return { state: emptyState(), persistent: false };
  try {
    const v2 = parseSavedRacesJson(storage.getItem(SAVED_RACES_STORAGE_KEY));
    if (v2) return { state: v2, persistent: true };
    const migrated = parseLegacySavedRacesJson(storage.getItem(LEGACY_SAVED_RACES_STORAGE_KEY));
    if (!migrated) return { state: emptyState(), persistent: true };
    try { storage.setItem(SAVED_RACES_STORAGE_KEY, JSON.stringify(migrated)); storage.removeItem(LEGACY_SAVED_RACES_STORAGE_KEY); return { state: migrated, persistent: true }; }
    catch { return { state: migrated, persistent: false }; }
  } catch { return { state: emptyState(), persistent: false }; }
};

export const writeSavedRaces = (storage: MinimalStorage | null | undefined, state: SavedRacesState): SavedRacesResult => {
  const validated = validateSavedRacesState(state) ?? emptyState();
  if (!storage) return { state: validated, persistent: false };
  try { storage.setItem(SAVED_RACES_STORAGE_KEY, JSON.stringify(validated)); return { state: validated, persistent: true }; }
  catch { return { state: validated, persistent: false }; }
};

export const isRaceSaved = (state: SavedRacesState, race: Pick<SavedRace, 'year' | 'eventId'>) => {
  const key = getSavedRaceKey(race);
  return state.races.some((savedRace) => getSavedRaceKey(savedRace) === key);
};
export const getSavedRaceStatus = (state: SavedRacesState, race: Pick<SavedRace, 'year' | 'eventId'>): SavedRaceStatus | null => validateSavedRacesState(state)?.races.find((savedRace) => getSavedRaceKey(savedRace) === getSavedRaceKey(race))?.status ?? null;

export const addSavedRace = (state: SavedRacesState, race: SavedRaceInput): SavedRacesState => {
  const validRace = normalizeSavedRaceInput(race);
  const validState = validateSavedRacesState(state) ?? emptyState();
  if (!validRace) return validState;
  const withoutCurrent = validState.races.filter((savedRace) => getSavedRaceKey(savedRace) !== getSavedRaceKey(validRace));
  return { version: 2, races: [validRace, ...withoutCurrent].slice(0, MAX_SAVED_RACES) };
};

export const setSavedRaceStatus = (state: SavedRacesState, race: SavedRaceInput, status: SavedRaceStatus): SavedRacesState => {
  const validRace = normalizeSavedRaceInput({ ...race, status });
  const validState = validateSavedRacesState(state) ?? emptyState();
  if (!validRace) return validState;
  const key = getSavedRaceKey(validRace);
  const index = validState.races.findIndex((savedRace) => getSavedRaceKey(savedRace) === key);
  if (index < 0) return addSavedRace(validState, validRace);
  const races = [...validState.races];
  races[index] = validRace;
  return { version: 2, races };
};

export const removeSavedRace = (state: SavedRacesState, race: Pick<SavedRace, 'year' | 'eventId'>): SavedRacesState => {
  const validState = validateSavedRacesState(state) ?? emptyState();
  const key = getSavedRaceKey(race);
  return { version: 2, races: validState.races.filter((savedRace) => getSavedRaceKey(savedRace) !== key) };
};

export const toggleSavedRace = (state: SavedRacesState, race: SavedRaceInput) => {
  const validRace = normalizeSavedRaceInput(race);
  const validState = validateSavedRacesState(state) ?? emptyState();
  if (!validRace) return { state: validState, saved: false };
  const saved = !isRaceSaved(validState, validRace);
  return { state: saved ? addSavedRace(validState, { ...validRace, status: DEFAULT_SAVED_RACE_STATUS }) : removeSavedRace(validState, validRace), saved };
};

export const readSavedRaceFromStorage = (storage: MinimalStorage | null | undefined, race: Pick<SavedRace, 'year' | 'eventId'>) => isRaceSaved(readSavedRaces(storage).state, race);
export const addSavedRaceToStorage = (storage: MinimalStorage | null | undefined, race: SavedRaceInput) => writeSavedRaces(storage, addSavedRace(readSavedRaces(storage).state, race));
export const setSavedRaceStatusInStorage = (storage: MinimalStorage | null | undefined, race: SavedRaceInput, status: SavedRaceStatus): SavedRacesResult => writeSavedRaces(storage, setSavedRaceStatus(readSavedRaces(storage).state, race, status));
export const removeSavedRaceFromStorage = (storage: MinimalStorage | null | undefined, race: Pick<SavedRace, 'year' | 'eventId'>) => writeSavedRaces(storage, removeSavedRace(readSavedRaces(storage).state, race));
export const toggleSavedRaceInStorage = (storage: MinimalStorage | null | undefined, race: SavedRaceInput) => {
  const result = toggleSavedRace(readSavedRaces(storage).state, race);
  return { ...writeSavedRaces(storage, result.state), saved: result.saved };
};
