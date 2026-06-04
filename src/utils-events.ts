export const cleanPublicEventTitle = (title: string) =>
  title.replace(/^EAORCH2026\s*-\s*/i, '').trim();

export const getDisplayEventTitle = (title: string, fallback = 'Naziv teka ni na voljo') => {
  const cleanedTitle = cleanPublicEventTitle(title);
  return cleanedTitle || fallback;
};
