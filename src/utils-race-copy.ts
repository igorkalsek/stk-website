import { formatSloveneDistances } from './utils-slovenian.js';
import { PUBLIC_SITE_URL } from './utils-site-url.js';
import { buildEnglishEventDetailPath, buildEventDetailPath, type PublicRaceEvent } from './utils-event-detail.js';

type RaceCopyLanguage = 'sl' | 'en';

type RaceCopyOptions = {
  event: Pick<PublicRaceEvent, 'title' | 'date' | 'place' | 'distances' | 'year' | 'row' | 'naziv_prireditve'>;
  language: RaceCopyLanguage;
  formatDate: (value: string) => string;
};

export const buildRaceCopyDescription = ({ event, language, formatDate }: RaceCopyOptions) => {
  const lines = [`🏃 ${event.title}`, ''];
  if (event.date) lines.push(`📅 ${formatDate(event.date)}`);
  if (event.place) lines.push(`📍 ${event.place}`);
  if (event.distances) lines.push(`👟 ${formatSloveneDistances(event.distances)}`);

  const detailPath = language === 'en' ? buildEnglishEventDetailPath(event) : buildEventDetailPath(event);
  lines.push('', language === 'en' ? 'More information:' : 'Več informacij:', new URL(detailPath, PUBLIC_SITE_URL).href);

  return lines.join('\n');
};
