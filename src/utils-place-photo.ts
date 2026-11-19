/** DEV-061: fail-closed selection. A licence is NOT permission to auto-publish. */
export type PlacePhotoRecord = {
  placeId: string;
  source: string;
  author: string;
  license: string;
  licenseUrl: string;
  altSl: string;
  altEn: string;
  status: string;
  visualReview: string;
  assetPath: string | null;
};

export type PublicPlacePhoto = {
  src: string;
  alt: string;
  author: string;
  source: string;
  license: string;
  licenseUrl: string;
};

/** Known Commons licence markers and their canonical terms. Keep this allowlist explicit. */
export function isSupportedPlacePhotoLicense(license: string, licenseUrl: string): boolean {
  const termsByLicense: Record<string, string> = {
    'CC-BY-4.0': 'https://creativecommons.org/licenses/by/4.0/',
    'CC-BY-SA-4.0': 'https://creativecommons.org/licenses/by-sa/4.0/',
    'CC-BY-SA-3.0': 'https://creativecommons.org/licenses/by-sa/3.0/',
    'CC0-1.0': 'https://creativecommons.org/publicdomain/zero/1.0/',
    'PD-self': 'https://commons.wikimedia.org/wiki/Template:PD-self'
  };
  return Object.hasOwn(termsByLicense, license) && termsByLicense[license] === licenseUrl;
}

/** Only locally hosted, explicitly approved, unambiguous photos may render. */
export function selectPublicPlacePhoto(
  placeId: string | null | undefined,
  records: readonly PlacePhotoRecord[],
  language: 'sl' | 'en'
): PublicPlacePhoto | null {
  if (!/^Q[1-9]\d*$/.test(placeId ?? '')) return null;
  const matches = records.filter((record) => record.placeId === placeId);
  if (matches.length !== 1) return null;
  const item = matches[0];
  if (item.status !== 'PUBLISHED' || item.visualReview !== 'APPROVED') return null;
  // No remote URLs, traversal, SVG, or dynamic paths; explicit optimised raster files only.
  if (!/^\/images\/places\/[a-z0-9-]+\.(?:webp|avif)$/.test(item.assetPath ?? '')) return null;
  if (!/^https:\/\/commons\.wikimedia\.org\/wiki\/File:/.test(item.source)) return null;
  if (!isSupportedPlacePhotoLicense(item.license, item.licenseUrl)) return null;
  if (!item.author.trim() || !item.license.trim() || !item.altSl.trim() || !item.altEn.trim()) return null;
  return {
    src: item.assetPath!, alt: language === 'sl' ? item.altSl : item.altEn,
    author: item.author, source: item.source, license: item.license, licenseUrl: item.licenseUrl
  };
}
