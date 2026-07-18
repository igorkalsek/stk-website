import { PUBLIC_SITE_URL } from './utils-site-url.js';
import { buildEnglishEventDetailPath, buildEventDetailPath, type PublicRaceEvent } from './utils-event-detail.js';

type RaceCopyLanguage = 'sl' | 'en';

type RaceCopyOptions = {
  event: Pick<PublicRaceEvent, 'title' | 'date' | 'place' | 'year' | 'row' | 'naziv_prireditve'>;
  language: RaceCopyLanguage;
  formatDate: (value: string) => string;
};

export const buildRaceCopyDescription = ({ event, language, formatDate }: RaceCopyOptions) => {
  const detailPath = language === 'en' ? buildEnglishEventDetailPath(event) : buildEventDetailPath(event);
  const detailUrl = new URL(detailPath, PUBLIC_SITE_URL).href;
  const dateAndPlace = [event.date ? formatDate(event.date) : '', event.place?.trim() ?? ''].filter(Boolean).join(', ');
  return [
    event.title,
    dateAndPlace,
    language === 'en' ? 'More information on the Slovenian Running Calendar:' : 'Več informacij na Slovenskem Tekaškem Koledarju:',
    detailUrl
  ].filter(Boolean).join('\n');
};
