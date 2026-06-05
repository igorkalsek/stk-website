const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December'
];

const MONTH_ABBREVIATIONS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKDAY_ABBREVIATIONS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

export const formatEnglishMonthLabel = (month: string) => {
  const monthNumber = Number(month);
  if (!Number.isInteger(monthNumber) || monthNumber < 1 || monthNumber > 12) return month;
  return MONTH_NAMES[monthNumber - 1];
};

export const formatEnglishDateBadge = (value: string) => {
  if (!value) return '';

  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;

  return `${WEEKDAY_ABBREVIATIONS[date.getDay()]} · ${date.getDate()} ${MONTH_ABBREVIATIONS[date.getMonth()]}`;
};

export const formatEnglishSurface = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return '';

  const labels: Record<string, string> = {
    cesta: 'Road',
    'cesta/trail': 'Road/trail',
    gorski: 'Mountain',
    oviratlon: 'Obstacle run',
    stopnice: 'Stairs',
    trail: 'Trail'
  };

  return labels[trimmed.toLocaleLowerCase('sl-SI')] ?? trimmed.replace(/^./, (letter) => letter.toLocaleUpperCase('en-GB'));
};
