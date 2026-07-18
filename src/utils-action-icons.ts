const routePath = '<path d="M4 19V5l5-2 6 2 5-2v14l-5 2-6-2-5 2Z"/><path d="M9 3v14M15 5v14"/>';

export type RaceActionIcon = 'registration' | 'notice' | 'calendar' | 'facts' | 'ticket' | 'route' | 'family' | 'notes' | 'vote' | 'link' | 'location' | 'share' | 'ultra' | 'elevation' | 'cup' | 'distances' | 'free' | 'race-day-registration';

const paths: Record<RaceActionIcon, string> = {
  registration: '<path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
  notice: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6M8 13h8M8 17h8"/>',
  calendar: '<rect width="18" height="18" x="3" y="4" rx="2"/><path d="M16 2v4M8 2v4M3 10h18M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01"/>',
  facts: '<path d="M4 7h16M4 12h16M4 17h10"/><path d="M8 3v4M16 3v4"/>',
  ticket: '<path d="M2 9a3 3 0 1 0 0 6v3a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-3a3 3 0 1 0 0-6V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z"/><path d="M13 5v2M13 11v2M13 17v2"/>',
  route: routePath,
  family: '<path d="M16 11a3 3 0 1 0-6 0"/><path d="M7 11a2.5 2.5 0 1 0-5 0M22 11a2.5 2.5 0 1 0-5 0"/><path d="M5 21v-2a5 5 0 0 1 10 0v2M1 21v-1a4 4 0 0 1 5-4M23 21v-1a4 4 0 0 0-5-4"/>',
  notes: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>',
  vote: '<path d="m9 12 2 2 4-5"/><path d="M21 12a9 9 0 1 1-6.2-8.56"/>',
  link: '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
  location: '<path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="3"/>',
  share: '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 10.6 15.4 6.4M8.6 13.4l6.8 4.2"/>',
  ultra: '<path d="M4 18c4-8 8-8 16-12"/><path d="M15 5h5v5"/><path d="M4 18h16"/>',
  elevation: '<path d="m3 18 6-10 4 6 3-4 5 8Z"/><path d="M9 18h12"/>',
  cup: '<path d="M8 4h8v4a4 4 0 0 1-8 0Z"/><path d="M8 6H5a3 3 0 0 0 3 5M16 6h3a3 3 0 0 1-3 5M12 12v5M9 20h6M10 17h4"/>',
  distances: routePath,
  free: '<circle cx="12" cy="12" r="8"/><path d="M12 8v8M9 11h6"/>',
  'race-day-registration': '<rect width="18" height="18" x="3" y="4" rx="2"/><path d="M16 2v4M8 2v4M3 10h18M8.5 16l2 2 5-5"/>'
};

export const renderActionIcon = (icon: RaceActionIcon): string =>
  `<svg class="action-icon-svg" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${paths[icon]}</svg>`;
