import { GPX_LINKS } from './data/gpx-links.js';
import { safeHttpUrl, type PublicRaceEvent } from './utils-event-detail.js';

export type GpxLink = {
  route: string;
  year: number | null;
  kind: 'GPX' | 'ZIP';
  url: string;
  sourceUrl: string;
};

export type GpxEvent = {
  edition: { year: string; row: string; date: string; name: string; place: string };
  links: readonly GpxLink[];
};

type EventIdentity = Pick<PublicRaceEvent, 'year' | 'row' | 'date' | 'naziv_prireditve' | 'place'>;

/** Reviewed edition snapshots only. Never infer a family match or carry links into another year.
 * A moved row or changed fingerprint fails closed until the binding is reviewed again. */
export function getGpxLinks(event: EventIdentity, manifest: readonly GpxEvent[] = GPX_LINKS): GpxLink[] {
  const match = manifest.find(({ edition }) => edition.year === event.year && edition.row === event.row
    && edition.date === event.date && edition.name === event.naziv_prireditve && edition.place === event.place);
  if (!match) return [];
  const links = new Map<string, { link: GpxLink; routes: Set<string> }>();
  for (const link of match.links) {
    const url = safeHttpUrl(link.url);
    const sourceUrl = safeHttpUrl(link.sourceUrl);
    if (!url || !sourceUrl || !link.route.trim() || !['GPX', 'ZIP'].includes(link.kind)) continue;
    const previous = links.get(url);
    if (previous) {
      // One button for a shared archive, while preserving all reviewed course names.
      previous.routes.add(link.route);
      if (previous.link.year !== link.year) previous.link.year = null;
    } else links.set(url, { link: { ...link, url, sourceUrl }, routes: new Set([link.route]) });
  }
  return [...links.values()].map(({ link, routes }) => ({ ...link, route: [...routes].join(' / ') }));
}

export const gpxYearLabel = (year: number | null, language: 'sl' | 'en') => {
  if (year === null) return language === 'en' ? 'Track year is unconfirmed' : 'Letnica sledi ni potrjena';
  return language === 'en' ? `GPX labelled ${year}` : `GPX z oznako ${year}`;
};
