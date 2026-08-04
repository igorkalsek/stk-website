export interface NavItem {
  href: string;
  label: string;
  variant?: 'primary' | 'organizer' | 'secondary';
  children?: NavItem[];
}

export const slovenianNavItems: NavItem[] = [
  { href: '/iskalnik-tekov/', label: 'Najdi tek', variant: 'primary' },
  { href: '/moji-teki/', label: 'Moji teki' },
  { href: '/stk-tekobot/', label: 'Tekobot' },
  { href: '/za-organizatorje/', label: 'Za organizatorje', variant: 'organizer' },
  {
    href: '#vec',
    label: 'Več',
    variant: 'secondary',
    children: [
      { href: '/druzinam-prijazni-teki/', label: 'Družinam prijazni teki' },
      { href: '/skupinski-teki/', label: 'Skupinski teki' },
      { href: '/najbolj-glasovani-teki/', label: 'Glasovani teki' },
      { href: '/osebni-koledar/', label: 'Osebni koledar' }
    ]
  }
];

export const englishNavItems: NavItem[] = [
  { href: '/en/find-races/', label: 'Find races', variant: 'primary' },
  { href: '/en/my-races/', label: 'My races' },
  { href: '/en/stk-tekobot/', label: 'STK Tekobot' },
  { href: '/en/for-organizers/', label: 'For organisers', variant: 'organizer' },
  {
    href: '#more',
    label: 'More',
    variant: 'secondary',
    children: [
      { href: '/en/family-friendly-races/', label: 'Family-friendly races' },
      { href: '/en/group-runs/', label: 'Group runs' },
      { href: '/en/most-voted-races/', label: 'Most voted races' },
      { href: '/en/personal-calendar/', label: 'Personal calendar' }
    ]
  }
];

export const getNavItems = (lang = 'sl') => (lang === 'en' ? englishNavItems : slovenianNavItems);
