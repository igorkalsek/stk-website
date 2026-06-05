import {
  cleanPublicEventTitle,
  normalizeEventDashes,
  normalizeEventMatchText,
  normalizeEventWhitespace,
} from "./utils-events";

type ApiRecord = Record<string, unknown>;

type VoteMatchableEvent = {
  id: string;
  date: string;
  title: string;
  place: string;
  voteUrl: string;
};

type VoteCandidate = {
  voteUrl: string;
  date: string;
  title: string;
  place: string;
  id: string;
  row: string;
};

type VoteLookup = {
  byRow: Map<string, VoteCandidate[]>;
  byId: Map<string, VoteCandidate[]>;
  byEvent: Map<string, VoteCandidate[]>;
};

type VoteMatchResult = {
  voteUrl: string;
  reason?: string;
};

type VoteUrlValidationResult = {
  safe: boolean;
  reason?: string;
};

const ARRAY_CONTAINERS = ["event", "race", "data", "item", "row", "fields"];
const VOTE_URL_KEYS = ["vote_url", "glasovanje_url", "url_glasovanje"];
const ROW_KEYS = [
  "master_row",
  "masterRow",
  "calendar_row",
  "calendarRow",
  "source_row",
  "sourceRow",
  "row",
  "Row",
  "ROW",
  "row_number",
  "rowNumber",
];
const ID_KEYS = [
  "event_id",
  "eventId",
  "race_id",
  "raceId",
  "edition_id",
  "editionId",
  "id",
  "slug",
];
const TITLE_KEYS = ["naziv_prireditve", "naziv", "title", "name"];
const PLACE_KEYS = ["kraj", "place", "city", "location"];
const DATE_KEYS = ["datum", "date", "event_date"];

const asRecord = (value: unknown): ApiRecord | null =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as ApiRecord)
    : null;

const pickDirect = (item: ApiRecord, key: string): string => {
  const value = item[key];
  return value === undefined || value === null ? "" : String(value).trim();
};

const pickDeep = (item: ApiRecord, key: string): string => {
  const direct = pickDirect(item, key);
  if (direct) return direct;

  for (const container of ARRAY_CONTAINERS) {
    const nested = asRecord(item[container]);
    if (!nested || nested === item) continue;
    const nestedValue = pickDeep(nested, key);
    if (nestedValue) return nestedValue;
  }

  return "";
};

const pickFirst = (item: ApiRecord, keys: string[]) => {
  for (const key of keys) {
    const value = pickDeep(item, key);
    if (value) return value;
  }
  return "";
};

const normalizeKeyPart = (value: string) =>
  normalizeEventMatchText(value)
    .replace(/[^\p{L}\p{N}/]+/gu, " ")
    .trim();

const normalizePlace = (value: string) =>
  normalizeEventWhitespace(normalizeEventDashes(value)).toLocaleLowerCase(
    "sl-SI",
  );

const normalizeDate = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return "";
  const isoMatch = trimmed.match(/\b(\d{4}-\d{2}-\d{2})\b/);
  if (isoMatch) return isoMatch[1];

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toISOString().slice(0, 10);
};

const eventKey = (date: string, title: string, place: string) =>
  [normalizeDate(date), normalizeKeyPart(title), normalizePlace(place)].join(
    "|",
  );

const safeUrl = (value: string) => {
  if (!value) return "";
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) ? url.href : "";
  } catch {
    return "";
  }
};

const getVoteUrlSearchParams = (value: string) => {
  if (!value) return null;

  try {
    return new URL(value).searchParams;
  } catch {
    const query = value.includes("?")
      ? value.slice(value.indexOf("?") + 1)
      : value;
    try {
      return new URLSearchParams(query);
    } catch {
      return null;
    }
  }
};

export const getVoteUrlTitle = (value: string) => {
  if (!value) return "";

  const params = getVoteUrlSearchParams(value);
  if (!params) return "";

  const namedTitle = params.get("entry.1386641006")?.trim();
  if (namedTitle) return namedTitle;

  for (const [key, paramValue] of params.entries()) {
    if (/title|name|naziv|event|race/i.test(key) && paramValue.trim())
      return paramValue.trim();
  }

  return "";
};

export const getVoteUrlDate = (value: string) => {
  const params = getVoteUrlSearchParams(value);
  if (!params) return "";

  const datedIdentifier = params.get("entry.11620528")?.trim();
  if (datedIdentifier) {
    const normalized = normalizeDate(datedIdentifier);
    if (normalized) return normalized;
  }

  for (const [key, paramValue] of params.entries()) {
    if (/date|datum/i.test(key) && paramValue.trim()) {
      const normalized = normalizeDate(paramValue);
      if (normalized) return normalized;
    }
  }

  return "";
};

export const isVoteUrlSafeForEvent = (
  event: VoteMatchableEvent,
  voteUrl: string,
): VoteUrlValidationResult => {
  const urlTitle = getVoteUrlTitle(voteUrl);
  const urlDate = getVoteUrlDate(voteUrl);
  const eventTitle = normalizeKeyPart(event.title);
  const eventDate = normalizeDate(event.date);

  if (urlTitle && normalizeKeyPart(urlTitle) !== eventTitle)
    return { safe: false, reason: "vote-url-title-mismatch" };
  if (urlDate && urlDate !== eventDate)
    return { safe: false, reason: "vote-url-date-mismatch" };

  return { safe: true };
};

const addCandidate = (
  map: Map<string, VoteCandidate[]>,
  key: string,
  candidate: VoteCandidate,
) => {
  if (!key) return;
  const current = map.get(key) ?? [];
  current.push(candidate);
  map.set(key, current);
};

const uniqueByUrl = (candidates: VoteCandidate[]) => {
  const seen = new Set<string>();
  return candidates.filter((candidate) => {
    if (seen.has(candidate.voteUrl)) return false;
    seen.add(candidate.voteUrl);
    return true;
  });
};

const buildVoteLookup = (rows: ApiRecord[]): VoteLookup => {
  const byRow = new Map<string, VoteCandidate[]>();
  const byId = new Map<string, VoteCandidate[]>();
  const byEvent = new Map<string, VoteCandidate[]>();

  rows.forEach((row) => {
    const voteUrl = safeUrl(pickFirst(row, VOTE_URL_KEYS));
    if (!voteUrl) return;

    const urlTitle = getVoteUrlTitle(voteUrl);
    const title = pickFirst(row, TITLE_KEYS) || urlTitle;
    const candidate: VoteCandidate = {
      voteUrl,
      date: normalizeDate(pickFirst(row, DATE_KEYS)) || getVoteUrlDate(voteUrl),
      title,
      place: pickFirst(row, PLACE_KEYS),
      id: pickFirst(row, ID_KEYS),
      row: pickFirst(row, ROW_KEYS),
    };

    addCandidate(byRow, candidate.row, candidate);
    addCandidate(byId, candidate.id, candidate);
    if (candidate.date && candidate.title)
      addCandidate(
        byEvent,
        eventKey(candidate.date, candidate.title, candidate.place),
        candidate,
      );
    if (candidate.date && urlTitle && urlTitle !== candidate.title)
      addCandidate(
        byEvent,
        eventKey(candidate.date, urlTitle, candidate.place),
        candidate,
      );
    if (candidate.date && title)
      addCandidate(
        byEvent,
        eventKey(candidate.date, cleanPublicEventTitle(title), candidate.place),
        candidate,
      );
  });

  return { byRow, byId, byEvent };
};

const titlesMatchStrictly = (
  eventTitle: string,
  candidateTitle: string,
  urlTitle: string,
) => {
  const normalizedEventTitle = normalizeKeyPart(eventTitle);
  const normalizedCandidateTitle = normalizeKeyPart(candidateTitle || urlTitle);
  const normalizedUrlTitle = normalizeKeyPart(urlTitle);

  if (!normalizedEventTitle || !normalizedCandidateTitle) return false;
  if (normalizedCandidateTitle !== normalizedEventTitle) return false;
  if (normalizedUrlTitle && normalizedUrlTitle !== normalizedEventTitle)
    return false;
  return true;
};

const placesMatchWhenAvailable = (
  eventPlace: string,
  candidatePlace: string,
) => {
  const normalizedEventPlace = normalizePlace(eventPlace);
  const normalizedCandidatePlace = normalizePlace(candidatePlace);
  return (
    !normalizedEventPlace ||
    !normalizedCandidatePlace ||
    normalizedEventPlace === normalizedCandidatePlace
  );
};

const findUnambiguous = (
  candidates: VoteCandidate[] | undefined,
  event: VoteMatchableEvent,
): VoteMatchResult => {
  const unique = uniqueByUrl(candidates ?? []);
  if (!unique.length) return { voteUrl: "" };

  const strict = unique.filter((candidate) => {
    const urlValidation = isVoteUrlSafeForEvent(event, candidate.voteUrl);
    if (!urlValidation.safe) return false;

    const candidateDate =
      normalizeDate(candidate.date) || getVoteUrlDate(candidate.voteUrl);
    const eventDate = normalizeDate(event.date);
    if (!candidateDate || candidateDate !== eventDate) return false;
    if (
      !titlesMatchStrictly(
        event.title,
        candidate.title,
        getVoteUrlTitle(candidate.voteUrl),
      )
    )
      return false;
    if (!placesMatchWhenAvailable(event.place, candidate.place)) return false;

    return true;
  });

  const uniqueStrict = uniqueByUrl(strict);
  if (!uniqueStrict.length) return { voteUrl: "", reason: "unverified" };
  if (uniqueStrict.length > 1) return { voteUrl: "", reason: "ambiguous" };

  return { voteUrl: uniqueStrict[0].voteUrl };
};

const warnInDevelopment = (
  message: string,
  details: Record<string, string>,
) => {
  if (!import.meta.env.DEV) return;
  console.warn(`[STK vote_url] ${message}`, details);
};

export const enrichEventsWithVoteUrls = <T extends VoteMatchableEvent>(
  events: T[],
  voteRows: ApiRecord[],
) => {
  const lookup = buildVoteLookup(voteRows);

  return events.map((event) => {
    if (event.voteUrl) {
      const existing = findUnambiguous(
        [
          {
            voteUrl: event.voteUrl,
            date: event.date,
            title: event.title,
            place: event.place,
            id: event.id,
            row: event.id,
          },
        ],
        event,
      );
      if (existing.voteUrl) return event;
      warnInDevelopment("skipped existing vote_url", {
        title: event.title,
        date: event.date,
        reason: existing.reason ?? "unverified",
      });
      return { ...event, voteUrl: "" };
    }

    const candidatesByPriority = [
      lookup.byRow.get(event.id),
      lookup.byId.get(event.id),
      lookup.byEvent.get(eventKey(event.date, event.title, event.place)),
      lookup.byEvent.get(
        eventKey(event.date, cleanPublicEventTitle(event.title), event.place),
      ),
    ];

    for (const candidates of candidatesByPriority) {
      const match = findUnambiguous(candidates, event);
      if (match.voteUrl) return { ...event, voteUrl: match.voteUrl };
      if (match.reason)
        warnInDevelopment("skipped vote_url match", {
          title: event.title,
          date: event.date,
          place: event.place,
          reason: match.reason,
        });
    }

    return event;
  });
};
