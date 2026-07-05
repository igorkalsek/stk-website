export const PUBLIC_SITE_URL = 'https://tekaski-koledar.si';

const PREVIEW_ORIGIN_PATTERNS = [/localhost/i, /127\.0\.0\.1/, /pages\.dev$/i, /\.pages\.dev$/i];

export const getCanonicalOrigin = (currentOrigin: string) => {
  if (PREVIEW_ORIGIN_PATTERNS.some((pattern) => pattern.test(currentOrigin))) return currentOrigin;
  return PUBLIC_SITE_URL;
};
