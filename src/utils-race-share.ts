import { buildEnglishEventDetailPath, buildEventDetailPath, type PublicRaceEvent } from './utils-event-detail.js';
import { PUBLIC_SITE_URL } from './utils-site-url.js';

export type RaceShareLanguage = 'sl' | 'en';

export type RaceShareUrls = {
  detailUrl: string;
  facebook: string;
  whatsapp: string;
  twitter: string;
  email: string;
};

type RaceShareOptions = {
  event: Pick<PublicRaceEvent, 'title' | 'date' | 'place' | 'year' | 'row' | 'naziv_prireditve'>;
  language: RaceShareLanguage;
  formatDate: (value: string) => string;
};

export const buildPublicRaceDetailUrl = (
  event: Pick<PublicRaceEvent, 'year' | 'row' | 'date' | 'title' | 'naziv_prireditve' | 'place'>,
  language: RaceShareLanguage
) => new URL(language === 'en' ? buildEnglishEventDetailPath(event) : buildEventDetailPath(event), PUBLIC_SITE_URL).href;

export const buildRaceShareUrls = ({ event, language, formatDate }: RaceShareOptions): RaceShareUrls => {
  const detailUrl = buildPublicRaceDetailUrl(event, language);
  const shareIntro = language === 'en'
    ? `${event.title} – ${formatDate(event.date)}${event.place ? `, ${event.place}` : ''}. More on Slovenski Tekaški Koledar:`
    : `${event.title} – ${formatDate(event.date)}${event.place ? `, ${event.place}` : ''}. Več na Slovenskem Tekaškem Koledarju:`;
  const shareText = `${shareIntro} ${detailUrl}`;

  return {
    detailUrl,
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(detailUrl)}`,
    whatsapp: `https://wa.me/?text=${encodeURIComponent(shareText)}`,
    twitter: `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}`,
    email: `mailto:?subject=${encodeURIComponent(event.title || 'Slovenski Tekaški Koledar')}&body=${encodeURIComponent(shareText)}`
  };
};
