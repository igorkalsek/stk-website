export const SAVED_RACES_STORAGE_KEY = 'stkSavedRacesV1';
export const SAVED_RACES_VERSION = 1 as const;
export const MAX_SAVED_RACES = 500;

export type MinimalStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
export type SavedRace = { version: 1; eventId: string; year: string; date: string; title: string };
export type SavedRacesState = { version: 1; races: SavedRace[] };
export type SavedRaceInput = Omit<SavedRace, 'version'>;
export type SavedRacesResult = { state: SavedRacesState; persistent: boolean };

const emptyState = (): SavedRacesState => ({ version: 1, races: [] });
const cleanText = (value: unknown, maxLength = 200) => typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
export const getSavedRaceKey = (race: Pick<SavedRace, 'year' | 'eventId'>) => `${race.year}:${race.eventId}`;

export const validateSavedRace = (value: unknown): SavedRace | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  if (record.version !== SAVED_RACES_VERSION) return null;
  const eventId = cleanText(record.eventId, 80);
  const year = cleanText(record.year, 4);
  const date = cleanText(record.date, 20);
  const title = cleanText(record.title, 200);
  if (!eventId || !/^\d{4}$/.test(year)) return null;
  return { version: 1, eventId, year, date, title };
};

export const normalizeSavedRaceInput = (race: SavedRaceInput): SavedRace | null => validateSavedRace({ ...race, version: 1 });

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

export const validateSavedRacesState = (value: unknown): SavedRacesState | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  if (record.version !== SAVED_RACES_VERSION) return null;
  return { version: 1, races: dedupeSavedRaces(record.races) };
};

export const parseSavedRacesJson = (json: string | null | undefined) => {
  if (!json) return null;
  try { return validateSavedRacesState(JSON.parse(json)); } catch { return null; }
};

export const readSavedRaces = (storage?: MinimalStorage | null): SavedRacesResult => {
  if (!storage) return { state: emptyState(), persistent: false };
  try { return { state: parseSavedRacesJson(storage.getItem(SAVED_RACES_STORAGE_KEY)) ?? emptyState(), persistent: true }; }
  catch { return { state: emptyState(), persistent: false }; }
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

export const addSavedRace = (state: SavedRacesState, race: SavedRaceInput): SavedRacesState => {
  const validRace = normalizeSavedRaceInput(race);
  const validState = validateSavedRacesState(state) ?? emptyState();
  if (!validRace) return validState;
  const withoutCurrent = validState.races.filter((savedRace) => getSavedRaceKey(savedRace) !== getSavedRaceKey(validRace));
  return { version: 1, races: [validRace, ...withoutCurrent].slice(0, MAX_SAVED_RACES) };
};

export const removeSavedRace = (state: SavedRacesState, race: Pick<SavedRace, 'year' | 'eventId'>): SavedRacesState => {
  const validState = validateSavedRacesState(state) ?? emptyState();
  const key = getSavedRaceKey(race);
  return { version: 1, races: validState.races.filter((savedRace) => getSavedRaceKey(savedRace) !== key) };
};

export const toggleSavedRace = (state: SavedRacesState, race: SavedRaceInput) => {
  const validRace = normalizeSavedRaceInput(race);
  const validState = validateSavedRacesState(state) ?? emptyState();
  if (!validRace) return { state: validState, saved: false };
  const saved = !isRaceSaved(validState, validRace);
  return { state: saved ? addSavedRace(validState, validRace) : removeSavedRace(validState, validRace), saved };
};

export const readSavedRaceFromStorage = (storage: MinimalStorage | null | undefined, race: Pick<SavedRace, 'year' | 'eventId'>) => isRaceSaved(readSavedRaces(storage).state, race);
export const addSavedRaceToStorage = (storage: MinimalStorage | null | undefined, race: SavedRaceInput) => writeSavedRaces(storage, addSavedRace(readSavedRaces(storage).state, race));
export const removeSavedRaceFromStorage = (storage: MinimalStorage | null | undefined, race: Pick<SavedRace, 'year' | 'eventId'>) => writeSavedRaces(storage, removeSavedRace(readSavedRaces(storage).state, race));
export const toggleSavedRaceInStorage = (storage: MinimalStorage | null | undefined, race: SavedRaceInput) => {
  const result = toggleSavedRace(readSavedRaces(storage).state, race);
  return { ...writeSavedRaces(storage, result.state), saved: result.saved };
};
