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
const workflow = readFileSync('src/components/OrganizerWorkflow.astro', 'utf8');
const proposalForm = readFileSync('src/components/RaceProposalForm.astro', 'utf8');
const slFormPage = readFileSync('src/pages/dodaj-ali-popravi-tek.astro', 'utf8');
const enFormPage = readFileSync('src/pages/en/add-or-correct-race.astro', 'utf8');

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
  for (const action of ['check_2027_dates', 'find_race', 'add_race']) assert.match(component, new RegExp(`data-organizer-action="${action}"`));
  for (const action of ['check_2027_dates', 'confirm_race', 'view_organizer_stats_info']) assert.match(workflow, new RegExp(action));
  for (const placement of ['hero', 'main']) assert.match(component, new RegExp(`data-organizer-placement="${placement}"`));
  assert.match(workflow, /data-organizer-placement="workflow"/);
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
  assert.match(datesComponent, /Pričakovano · ocena STK/);
  assert.match(datesComponent, /planning-status-guide/);
});

test('planner uses one responsive month and week information architecture', () => {
  assert.match(datesComponent, /class="year-overview"/);
  assert.match(datesComponent, /class="planning-week"/);
  assert.doesNotMatch(datesComponent, /dates-table|dates-mobile-list/);
  assert.match(styles, /\.planning-week/);
});

test('organizer journey retains proposal and finder routes without fictional statistics', () => {
  assert.match(component, /\/dodaj-ali-popravi-tek\//);
  assert.match(component, /\/en\/add-or-correct-race\//);
  assert.doesNotMatch(component, /PRIMER PRIKAZA · PROTOTIP/);
  assert.match(component, /Ko bo funkcija na voljo/);
  assert.doesNotMatch(component, /1\.248|384|127|82/);
});

test('future organiser tools are explicitly in development and have no non-functional control', () => {
  assert.match(component, /Promocija in statistika/);
  assert.match(component, /V PRIPRAVI/);
  assert.doesNotMatch(component, /<button|claim_race/);
});

test('shared workflow provides equivalent SL and EN links and the planner marks step one current', () => {
  for (const route of ['/za-organizatorje/termini-2027/', '/en/for-organizers/2027-race-dates/', '/dodaj-ali-popravi-tek/', '/en/add-or-correct-race/']) assert.match(workflow, new RegExp(route.replaceAll('/', '\\/')));
  assert.match(workflow, /Preverite termin/);
  assert.match(workflow, /Check the date/);
  assert.match(datesComponent, /<OrganizerWorkflow \{lang\} active=\{1\} compact/);
  assert.match(component, /<OrganizerWorkflow \{lang\} \/>/);
  assert.match(workflow, /compact\?: boolean/);
  assert.match(workflow, /!compact && <small>/);
});

test('shared compact workflow marks each destination current without tab semantics', () => {
  assert.match(datesComponent, /<OrganizerWorkflow \{lang\} active=\{1\} compact/);
  assert.match(proposalForm, /<OrganizerWorkflow \{lang\} active=\{2\} compact/);
  assert.match(component, /<OrganizerWorkflow \{lang\} active=\{3\} compact/);
  assert.match(component, /<OrganizerWorkflow \{lang\} \/>/);
  assert.match(workflow, /<nav[^>]+aria-label=/);
  assert.match(workflow, /<span class="organizer-step" aria-current="step">/);
  assert.doesNotMatch(workflow, /<a[^>]+aria-current/);
  assert.match(workflow, /<a class="organizer-step" href=\{step\[2\]\}/);
  assert.doesNotMatch(workflow, /Current step|Trenutni korak|organizer-current-label/);
  assert.doesNotMatch(workflow, /tablist|role="tab"|<script/);
});

test('only navigable workflow steps retain action analytics', () => {
  const activeBranch = workflow.match(/active === index \+ 1 \? \(([\s\S]*?)\) : \(/)?.[1] ?? '';
  const linkBranch = workflow.match(/\) : \(([\s\S]*?)\)\s*\}/)?.[1] ?? '';
  assert.doesNotMatch(activeBranch, /<a|href=|data-organizer-action|data-organizer-placement/);
  assert.match(linkBranch, /<a class="organizer-step" href=\{step\[2\]\}/);
  assert.match(linkBranch, /data-organizer-action=\{step\[3\]\}/);
  assert.match(linkBranch, /data-organizer-placement="workflow"/);
});

test('proposal routes render the bilingual step-two workflow and retain language pairing', () => {
  for (const page of [slFormPage, enFormPage]) assert.match(page, /<RaceProposalForm lang=/);
  assert.match(slFormPage, /languageSwitchHref="\/en\/add-or-correct-race\/"/);
  assert.match(enFormPage, /languageSwitchHref="\/dodaj-ali-popravi-tek\/"/);
  for (const route of ['/za-organizatorje/termini-2027/', '/en/for-organizers/2027-race-dates/', '/dodaj-ali-popravi-tek/', '/en/add-or-correct-race/', '/za-organizatorje/#promotion', '/en/for-organizers/#promotion']) {
    assert.match(workflow, new RegExp(route.replaceAll('/', '\\/')));
  }
});

test('promotion anchor starts with step-three navigation and workflow analytics stay stable', () => {
  assert.match(component, /id="promotion"[^>]*><OrganizerWorkflow \{lang\} active=\{3\} compact \/><div class="organizer-claim-card">/);
  assert.match(workflow, /data-organizer-placement="workflow"/);
  for (const action of ['check_2027_dates', 'confirm_race', 'view_organizer_stats_info']) assert.match(workflow, new RegExp(action));
});

test('promotion anchor clears the sticky header without affecting normal section spacing', () => {
  assert.match(styles, /\.site-header\s*\{[^}]*position:\s*sticky;[^}]*top:\s*0;/s);
  assert.match(styles, /\.header-inner\s*\{[^}]*padding:\s*14px 0;/s);
  assert.match(styles, /\.brand-logo\s*\{[^}]*height:\s*38px;/s);
  assert.match(styles, /\.promotion-section\s*\{[^}]*scroll-margin-top:\s*84px;/s);
});

test('compact workflow stacks without horizontal scrolling through tablet widths', () => {
  const tabletRules = styles.match(/@media \(max-width: 799px\) \{([^\n]+)\}/)?.[1] ?? '';
  assert.match(tabletRules, /\.organizer-workflow-compact ol \{ display: grid; grid-template-columns: 1fr; \}/);
  assert.match(tabletRules, /\.organizer-workflow-compact li \+ li \{ border-top:/);
  assert.match(tabletRules, /border-left: 0;/);
  assert.doesNotMatch(tabletRules, /overflow-x|flex: 0 0 auto/);
});

test('workflow additions do not introduce duplicate literal ids', () => {
  for (const source of [workflow, component, datesComponent]) {
    const ids = [...source.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]);
    assert.equal(new Set(ids).size, ids.length);
  }
});

test('compact planner legend retains all three status meanings', () => {
  for (const copy of ['official date', 'officially known period', 'not organiser-confirmed', 'uradni termin', 'uradno znano obdobje', 'ni potrditev organizatorja']) assert.match(datesComponent, new RegExp(copy));
});

test('planner overview heading avoids repeating the year from the page title', () => {
  assert.match(datesComponent, /en\?'Race date overview':'Pregled terminov'/);
  assert.doesNotMatch(datesComponent, /2027 year overview|Pregled leta 2027/);
});
