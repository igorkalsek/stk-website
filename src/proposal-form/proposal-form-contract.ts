export const googleProposalFormContract = {
  formId: '1FAIpQLScBgO8Keau-2cZWHubhacvCmbzLbw0wlroE6-rR6TEJnzfgUw',
  viewUrl: 'https://docs.google.com/forms/d/e/1FAIpQLScBgO8Keau-2cZWHubhacvCmbzLbw0wlroE6-rR6TEJnzfgUw/viewform',
  responseUrl: 'https://docs.google.com/forms/d/e/1FAIpQLScBgO8Keau-2cZWHubhacvCmbzLbw0wlroE6-rR6TEJnzfgUw/formResponse',
  fields: {
    proposalType: 'entry.1029369192',
    additionalData: 'entry.577988475',
    date: 'entry.1001315624',
    dateYear: 'entry.1001315624_year',
    dateMonth: 'entry.1001315624_month',
    dateDay: 'entry.1001315624_day',
    title: 'entry.528776717',
    place: 'entry.2041922472',
    region: 'entry.1582791574',
    officialSource: 'entry.1673153264',
    description: 'entry.1306192166',
    organizer: 'entry.1524441401',
    officialAnnouncement2026: 'entry.1848766788',
    email: 'entry.600388817'
  },
  values: {
    proposalTypes: ['Nov tek (dodajanje nove prireditve)', 'Popravek obstoječega vnosa v koledarju', 'Dopolnitev dodatnih podatkov obstoječega teka', 'Drugo'],
    additionalData: ['Prijavnina / startnina', 'Rok prijave', 'Cenejša prijava / sprememba cene', 'Prijave na dan dogodka', 'Trasa / zemljevid / GPX', 'Višinski metri', 'Popravek napačnega dodatnega podatka', 'Drugo'],
    regions: ['Pomurska', 'Podravska', 'Koroška', 'Savinjska', 'Zasavska', 'Posavska', 'Jugovzhodna', 'Primorsko-notranjska', 'Osrednjeslovenska', 'Gorenjska', 'Goriška', 'Obalno-kraška', 'Ne vem / nisem prepričan (navedem v opisu)'],
    yesNo: ['Da', 'Ne'],
    announcement: ['Da', 'Ne', 'Ne vem']
  }
} as const;

export type GoogleProposalField = keyof typeof googleProposalFormContract.fields;
