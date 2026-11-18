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
  if (!/^https:\/\/creativecommons\.org\//.test(item.licenseUrl)) return null;
  if (!item.author.trim() || !item.license.trim() || !item.altSl.trim() || !item.altEn.trim()) return null;
  return {
    src: item.assetPath!, alt: language === 'sl' ? item.altSl : item.altEn,
    author: item.author, source: item.source, license: item.license, licenseUrl: item.licenseUrl
  };
}
