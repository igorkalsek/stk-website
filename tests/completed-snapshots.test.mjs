import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { COMPLETED_RACE_SNAPSHOTS_STORAGE_KEY, readCompletedRaceSnapshots, upsertCompletedRaceSnapshot, validateCompletedRaceSnapshotsState } from '../.cache/dist-test/utils-completed-snapshots.js';
const event = (title = 'Tek') => ({ id:'173', row:'173', year:'2026', date:'2026-08-22', title, naziv_prireditve:title, place:'Kranj', region:'Gorenjska', surface:'cesta' });
const storage = () => { const values = new Map(); return { values, getItem:k=>values.get(k) ?? null, setItem:(k,v)=>values.set(k,v), removeItem:k=>values.delete(k) }; };
describe('completed race snapshots', () => {
 it('creates and safely updates one year:eventId snapshot', () => { const s=storage(); assert.equal(upsertCompletedRaceSnapshot(s,event()),true); upsertCompletedRaceSnapshot(s,event('Nov naziv')); const state=readCompletedRaceSnapshots(s); assert.equal(state.snapshots.length,1); assert.equal(state.snapshots[0].title,'Nov naziv'); assert.ok(s.values.has(COMPLETED_RACE_SNAPSHOTS_STORAGE_KEY)); });
 it('rejects corrupt storage and deduplicates valid snapshots', () => { const s=storage(); s.setItem(COMPLETED_RACE_SNAPSHOTS_STORAGE_KEY,'{'); assert.deepEqual(readCompletedRaceSnapshots(s).snapshots,[]); const snap={version:1,eventId:'r000173',year:'2026',date:'2026-08-22',title:'Tek',place:'Kranj',region:'Gorenjska',surface:'cesta'}; assert.equal(validateCompletedRaceSnapshotsState({version:1,snapshots:[snap,snap]}).snapshots.length,1); });
});
