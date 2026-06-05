export const normalizeEventWhitespace = (value: string) => value.replace(/\s+/g, ' ').trim();

export const normalizeEventDashes = (value: string) => value.replace(/[‐‑‒–—―]/g, '-');

export const cleanPublicEventTitle = (title: string) =>
  normalizeEventWhitespace(normalizeEventDashes(title).replace(/^EAORCH2026\s*-\s*/i, ''));

export const getDisplayEventTitle = (title: string, fallback = 'Naziv teka ni na voljo') => {
  const cleanedTitle = cleanPublicEventTitle(title);
  return cleanedTitle || fallback;
};

export const normalizeEventMatchText = (value: string) =>
  cleanPublicEventTitle(value).toLocaleLowerCase('sl-SI');
