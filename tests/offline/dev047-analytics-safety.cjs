// Diagnostic regression against the independently verified serving Code.gs.
// Usage: node tests/offline/dev047-analytics-safety.cjs /absolute/path/Code.gs
// This intentionally demonstrates the existing writer's unsafe failure mode.
// All services are mocks; no network, production script, or Sheet is invoked.
const fs = require('fs'), vm = require('vm'), assert = require('node:assert/strict');
const crypto = require('node:crypto');
const source = fs.readFileSync(process.argv[2], 'utf8');
assert.equal(crypto.createHash('sha256').update(source).digest('hex'), 'f4731b8f89a58dbb2ccac18cd5c3e9343663a1f679c8ca1f863d3b154f1f2b31', 'Use verified serving v48 / Apps main f76fbf6 Code.gs');
const c = {
  console,
  Logger: { log() {} },
  PropertiesService: {
    getScriptProperties: () => ({ getProperty: () => null })
  },
  Utilities: {
    formatDate(date, timezone, format) {
      assert.equal(format, 'yyyy-MM-dd');
      return new Intl.DateTimeFormat('en-CA', {
        timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit'
      }).format(date);
    }
  }
};
vm.createContext(c);
vm.runInContext(source, c);
c.nowIso_ = () => '2026-10-24T18:00:00+02:00';
c.today_ = () => new Date('2026-10-24T00:00:00Z');
const row = { timestamp: '2026-10-23', event_id: 'R000260', event_year: '2026', event_date: '2026-11-15', event_name: 'Testni tek', page_path: '/tek/2026/r000260-test/' };
const options = { aggregateDate: '2026-10-24', updatedAt: '2026-10-24T18:00:00+02:00' };
const bots = Array.from({ length: 100 }, () => ({ ...row, event_type: 'event_detail_viewed' }));
const b = c.STK_buildAnalyticsAggregatesFromRows_(bots, options).aggregates[0];
assert.equal(b.detail_views_30d, 100);
assert.equal(b.community_interest_score_30d, 0);
assert.equal(b.total_interest_actions_30d, 100);
const active = [
  { event_type: 'external_link_clicked', action_type: 'registration_click' },
  { event_type: 'external_link_clicked', action_type: 'official_notice_click' },
  { event_type: 'race_saved' },
  { event_type: 'calendar_add_clicked' }
].map(action => ({ ...row, ...action }));
const a = c.STK_buildAnalyticsAggregatesFromRows_(active, options).aggregates[0];
assert.equal(a.community_interest_score_30d, 15);
assert.equal(c.STK_buildAnalyticsAggregatesFromRows_([...bots, ...active], options).aggregates[0].community_interest_score_30d, 15);
const yearly = c.STK_buildAnalyticsAggregatesFromRows_([...active, { ...row, event_year: '2027', event_date: '2027-11-15', event_type: 'calendar_add_clicked' }], options).aggregates;
assert.equal(yearly.length, 2);
assert.deepEqual(Array.from(yearly, a => [a.event_year, a.community_interest_score_30d]), [['2026', 15], ['2027', 4]]);
const original = [Array(34).fill('legacy-header'), Array(34).fill('preserved-value')];
let cells = structuredClone(original), cleared = false;
c.readSiteAnalyticsRows_ = () => bots;
// Only the aggregate target is mocked; any unexpected service access throws.
c.SpreadsheetApp = {
  openById: () => ({
    getSheetByName: () => ({
      clearContents() { cells = []; cleared = true; },
      getRange() {
        return { setValues() { throw Error('injected write interruption'); } };
      }
    })
  })
};
assert.throws(() => c.STK_writeAnalyticsAggregates(options), /injected write interruption/);
assert.equal(cleared, true);
assert.equal(cells.length, 0);
assert.equal(c.SITE_ANALYTICS_AGGREGATE_HEADERS.length, 67);
console.log(JSON.stringify({ serving: 'v48', botViews: 100, botScore: 0, legacyBotTotal: 100, activeScore: 15, activePlusBotsScore: 15, yearIdentity: '2026:15 / 2027:4', interruption: 'CONFIRMED_UNSAFE: old writer cleared 34-column mock before failed write; no rollback', productionCalls: 0 }));
