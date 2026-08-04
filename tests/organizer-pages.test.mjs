import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const component = readFileSync('src/components/OrganizerPage.astro', 'utf8');
const navigation = readFileSync('src/navigation.ts', 'utf8');
const header = readFileSync('src/components/Header.astro', 'utf8');
const footer = readFileSync('src/components/Footer.astro', 'utf8');
const slPage = readFileSync('src/pages/za-organizatorje.astro', 'utf8');
const enPage = readFileSync('src/pages/en/for-organizers.astro', 'utf8');

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
  for (const action of ['find_race', 'add_race', 'confirm_race']) assert.match(component, new RegExp(`data-organizer-action="${action}"`));
  for (const placement of ['hero', 'process', 'final']) assert.match(component, new RegExp(`data-organizer-placement="${placement}"`));
  assert.doesNotMatch(component, /external_link_clicked|correction_clicked/);
});

test('claim section is explicitly in development and has no non-functional claim control', () => {
  assert.match(component, /Prevzem profila teka/);
  assert.match(component, /V PRIPRAVI/);
  assert.doesNotMatch(component, /<button|claim_race/);
});
