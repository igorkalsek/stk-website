export const hasContributionDescription = (description = '') =>
  /prostovoljn\p{L}*\s+prispev\p{L}*|dobrodeln\p{L}*\s+prispev\p{L}*|\bdonacij\p{L}*|\bdonations?\b|\bvoluntary contributions?\b/iu.test(description);

const parseRegistrationAmount = (value: string) => {
  const normalized = value.trim().replace(',', '.').replace(/\s*(€|eur)$/iu, '').trim();
  if (!/^\d+(?:\.\d+)?$/.test(normalized)) return null;
  const amount = Number(normalized);
  return Number.isFinite(amount) ? amount : null;
};

export const getRegistrationFeeBounds = (minValue = '', maxValue = '', description = '') => {
  if (hasContributionDescription(description)) return { min: null, max: null };
  const min = parseRegistrationAmount(minValue);
  const max = parseRegistrationAmount(maxValue);
  if (min !== null && max !== null && min > max) return { min: null, max: null };
  return { min, max };
};
