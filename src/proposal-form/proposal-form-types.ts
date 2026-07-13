export type ProposalLanguage = 'sl' | 'en';
export type ProposalTypeKey = 'new' | 'correction' | 'additional' | 'other';

export interface ProposalPrefill {
  eventTitle: string;
  year: string;
  date: string;
  place: string;
  source: string;
  returnUrl: string;
  lang: ProposalLanguage;
  safeReturnUrl: string;
  description: string;
}
