import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mapPublicRaceEventForDetail } from '../.cache/dist-test/utils-event-detail.js';
import { buildPrimaryActions, buildProfileActions } from '../.cache/dist-test/utils-race-detail-view.js';

const registrationUrl = 'https://www.maraton-radenci.si/prijava/maraton-radenska-classic/';
const noticeUrl = 'https://www.maraton-radenci.si/o-maratonu';
const affiliateUrl = 'https://www.ahotu.com/event/maraton-treh-src?linkId=lp_509155&sourceId=stk&tenantId=ahotu';
const marathon = mapPublicRaceEventForDetail({
  row: 11,
  datum: '2027-05-15',
  naziv_prireditve: '45. Maraton treh src',
  kraj: 'Radenci',
  status_dogodka: 'potrjeno',
  vidno_v_javnem_koledarju: 'DA',
  povezava_prijava: registrationUrl,
  povezava_razpis: noticeUrl
}, '2027');
const today = '2026-11-18';

for (const [lang, affiliate, organiser, notice, archiveLabel] of [
  ['sl', 'Prijava prek Ahotu', 'Prijava pri organizatorju', 'Razpis', 'Prijava'],
  ['en', 'Register via Ahotu', 'Register with organiser', 'Official info', 'Registration']
]) {
  test(`Ahotu pilot shows the three localized actions in order (${lang})`, () => {
    const { actions, affiliateDisclosure } = buildProfileActions(marathon, lang, today);
    assert.deepEqual(actions, [
      { kind: 'registration', label: affiliate, url: affiliateUrl, analyticsType: 'prijava', sponsored: true },
      { kind: 'registration', label: organiser, url: registrationUrl, analyticsType: 'prijava', archiveLabel },
      { kind: 'notice', label: notice, url: noticeUrl, analyticsType: 'razpis' }
    ]);
    assert.ok(affiliateDisclosure);
    assert.deepEqual(buildPrimaryActions(marathon, lang).map(action => action.url), [registrationUrl, noticeUrl]);
  });

  test(`Ahotu pilot falls back on any identity mismatch, absent registration, or past date (${lang})`, () => {
    const variants = [
      { year: '2026' }, { row: '12' }, { date: '2027-05-16' },
      { naziv_prireditve: '46. Maraton treh src' }, { place: 'Gornja Radgona' },
      { registrationUrl: '' }, { registrationUrl: 'javascript:alert(1)' }
    ];
    for (const fields of variants) {
      const event = { ...marathon, ...fields };
      assert.deepEqual(buildProfileActions(event, lang, today), {
        actions: buildPrimaryActions(event, lang),
        affiliateDisclosure: ''
      }, JSON.stringify(fields));
    }
    assert.deepEqual(buildProfileActions(marathon, lang, '2027-05-16'), {
      actions: buildPrimaryActions(marathon, lang),
      affiliateDisclosure: ''
    });
  });
}
