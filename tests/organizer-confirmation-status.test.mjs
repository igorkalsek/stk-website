import test from 'node:test';import assert from 'node:assert/strict';import {hasConfirmedOrganizerData} from '../.cache/dist-test/organizer-confirmation-status.js';
const good={ok:true,type:'organizer_confirmations',year:'2026',events:[{event_id:'R000175',data_confirmed:true}]};
test('badge projection requires exact event and year',()=>{assert.equal(hasConfirmedOrganizerData(good,'2026','R000175'),true);assert.equal(hasConfirmedOrganizerData(good,'2026','R000176'),false);assert.equal(hasConfirmedOrganizerData(good,'2027','R000175'),false);assert.equal(hasConfirmedOrganizerData({...good,events:[]},'2026','R000175'),false);assert.equal(hasConfirmedOrganizerData({events:'bad'},'2026','R000175'),false)});

for (const status of ['PENDING_EMAIL', 'PENDING_CONFIRMATION', 'VERIFIED']) {
  test(`${status} or email verification alone does not confirm race data`, () => {
    assert.equal(hasConfirmedOrganizerData({ ...good, events: [{ event_id: 'R000175', status, email_verified: true }] }, '2026', 'R000175'), false);
  });
}
for (const payload of [null, {}, { ...good, ok: false }, { ...good, type: 'other' },
  { ...good, events: [{ event_id: 'R000175', data_confirmed: false }] },
  { ...good, events: [{ event_id: 'R000175', data_confirmed: 'true' }] }]) {
  test(`invalid confirmation projection stays hidden: ${JSON.stringify(payload)}`, () => {
    assert.equal(hasConfirmedOrganizerData(payload, '2026', 'R000175'), false);
  });
}
