export type ProposalLanguage = 'sl' | 'en';
export type ProposalTypeKey = 'new' | 'correction' | 'additional' | 'other';
export type ProposalMode = 'new' | 'existing' | 'other' | 'confirm';

export interface ProposalPrefill {
  eventTitle: string;
  year: string;
  date: string;
  place: string;
  source: string;
  officialSourceUrl: string;
  returnUrl: string;
  lang: ProposalLanguage;
  safeReturnUrl: string;
  description: string;
  eventKey: string;
  context: string;
  region: string;
  startTime: string;
  distances: string;
  surface: string;
  noticeUrl: string;
  registrationUrl: string;
  cup: string;
  registrationFee: string;
  registrationMinEur: string;
  registrationMaxEur: string;
  registrationDescription: string;
  registrationDeadline: string;
  earlyRegistrationDeadline: string;
  dayOfRegistration: string;
  elevationGain: string;
  routeUrl: string;
  otherDetails: string;
  organizator_naziv: string;
  organizator_url: string;
}
