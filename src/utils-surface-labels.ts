export const canonicalSurfaceValues = ['cesta', 'asfalt', 'makadam', 'trail', 'cesta/trail', 'gorski tek'] as const;

export type CanonicalSurfaceValue = typeof canonicalSurfaceValues[number];

export const canonicalSurfaceLabels = {
  sl: {
    cesta: 'Cesta',
    asfalt: 'Asfalt',
    makadam: 'Makadam',
    trail: 'Trail',
    'cesta/trail': 'Cesta/trail',
    'gorski tek': 'Gorski tek'
  },
  en: {
    cesta: 'Road',
    asfalt: 'Asphalt',
    makadam: 'Gravel road',
    trail: 'Trail',
    'cesta/trail': 'Road/trail',
    'gorski tek': 'Mountain race'
  }
} as const satisfies Record<'sl' | 'en', Record<CanonicalSurfaceValue, string>>;
