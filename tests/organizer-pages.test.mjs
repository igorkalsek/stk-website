import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const component = readFileSync('src/components/OrganizerPage.astro', 'utf8');
const navigation = readFileSync('src/navigation.ts', 'utf8');
const header = readFileSync('src/components/Header.astro', 'utf8');
const footer = readFileSync('src/components/Footer.astro', 'utf8');
const slPage = readFileSync('src/pages/za-organizatorje.astro', 'utf8');
const enPage = readFileSync('src/pages/en/for-organizers.astro', 'utf8');
const datesComponent = readFileSync('src/components/RaceDates2027Page.astro', 'utf8');
const slDatesPage = readFileSync('src/pages/za-organizatorje/termini-2027.astro', 'utf8');
const enDatesPage = readFileSync('src/pages/en/for-organizers/2027-race-dates.astro', 'utf8');
const styles = readFileSync('src/styles/global.css', 'utf8');

test('publishes equivalent organiser routes with SEO and language alternates', () => {
  assert.match(slPage, /canonicalPath="\/za-organizatorje\/"/);
  assert.match(enPage, /canonicalPath="\/en\/for-organizers\/"/);
  for (const page of [slPage, enPage]) {
    assert.match(page, /alternateLinks=/);
    assert.match(page, /OrganizerPage/);
  }
  assert.match(header, /\['\/za-organizatorje\/', '\/en\/for-organizers\/'\]/);
});

test('navigation and footer lead to organiser pages while legacy forms remain linked', () => {
  assert.match(navigation, /href: '\/za-organizatorje\/', label: 'Za organizatorje'/);
  assert.match(navigation, /href: '\/en\/for-organizers\/', label: 'For organisers'/);
  for (const source of [footer, component]) {
    assert.match(source, /\/dodaj-ali-popravi-tek\//);
    assert.match(source, /\/en\/add-or-correct-race\//);
  }
});

test('CTAs use stable semantic action and placement values without misusing analytics events', () => {
  for (const action of ['check_2027_dates', 'find_race', 'add_race', 'confirm_race', 'view_organizer_stats_info']) assert.match(component, new RegExp(`data-organizer-action="${action}"`));
  for (const placement of ['hero', 'season_preview', 'steps', 'final']) assert.match(component, new RegExp(`data-organizer-placement="${placement}"`));
  assert.doesNotMatch(component, /external_link_clicked|correction_clicked/);
});

test('publishes paired production date routes with canonical, hreflang, x-default and language switch', () => {
  assert.match(slDatesPage, /canonicalPath="\/za-organizatorje\/termini-2027\/"/);
  assert.match(enDatesPage, /canonicalPath="\/en\/for-organizers\/2027-race-dates\/"/);
  for (const page of [slDatesPage, enDatesPage]) {
    assert.match(page, /lang: 'sl'/);
    assert.match(page, /lang: 'en'/);
    assert.match(page, /lang: 'x-default'/);
    assert.match(page, /languageSwitchHref=/);
    assert.match(page, /RaceDates2027Page/);
  }
  assert.match(header, /termini-2027/);
  assert.match(header, /2027-race-dates/);
});

test('date overview uses production data and distinguishes event certainty', () => {
  assert.match(datesComponent, /fetchPlanning2027/);
  assert.doesNotMatch(datesComponent, /demonstracijski podatki|DEMO 0/);
  assert.match(datesComponent, /Potrjeno/);
  assert.match(datesComponent, /Pričakovano/);
  assert.match(datesComponent, /event-status-\$\{event\.status\}/);
  assert.match(styles, /\.event-status-potrjeno/);
  assert.match(styles, /\.event-status-pričakovano/);
  assert.match(styles, /\.event-status-termin_znan/);
});

test('weekends use a desktop table and narrow-screen cards without a wide mobile table', () => {
  assert.match(datesComponent, /class="dates-table"/);
  assert.match(datesComponent, /class="dates-mobile-list"/);
  assert.match(datesComponent, /<article class="weekend-card">/);
  assert.match(styles, /\.dates-mobile-list \{ display: none; \}/);
  assert.match(styles, /@media \(max-width: 719px\).*\.dates-table-wrap \{ display: none; \}.*\.dates-mobile-list \{ display: grid;/s);
});

test('organizer journey retains the existing proposal form and limits prototype copy to future statistics', () => {
  assert.match(component, /\/dodaj-ali-popravi-tek\//);
  assert.match(component, /\/en\/add-or-correct-race\//);
  assert.doesNotMatch(component, /PRIMER PRIKAZA · PROTOTIP/);
  assert.match(component, /PRIMER PRIKAZA STATISTIKE/);
});

test('claim section is explicitly in development and has no non-functional claim control', () => {
  assert.match(component, /Prevzem profila teka/);
  assert.match(component, /V PRIPRAVI/);
  assert.doesNotMatch(component, /<button|claim_race/);
});
