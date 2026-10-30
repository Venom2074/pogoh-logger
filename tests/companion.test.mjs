import test from 'node:test';
import assert from 'node:assert/strict';
import {parseCSV, localParts, summarize, normalizeLive, isFresh, validateRides, mergeRides, NEARBY} from '../companion/core.mjs';

function row(time,id='59',ebikes=1,extra={}) {
  return {snapshot_utc:time,feed_updated_utc:time,last_reported_utc:time,station_id:id,
    ebikes:String(ebikes),pedal_bikes:'1',docks_open:'5',is_renting:'1',is_returning:'1',...extra};
}
const build = rows => summarize(rows, [], '2027-02-01T00:00:00Z');
test('CSV preserves quoted commas, quotes, line breaks, and CRLF',() => {
  assert.deepEqual(parseCSV('id,name\r\n59,"TCS, ""Hall""\nCMU"\r\n'),[{id:'59',name:'TCS, "Hall"\nCMU'}]);
  assert.throws(() => parseCSV('name\n"bad'));
});
test('local clock handles spring skip and autumn repeated hour',() => {
  assert.deepEqual(localParts('2026-03-08T06:30:00Z'),{date:'2026-03-08',day:6,hour:1});
  assert.equal(localParts('2026-03-08T07:30:00Z').hour,3);
  assert.deepEqual(localParts('2026-11-01T05:30:00Z'),localParts('2026-11-01T06:30:00Z'));
  assert.equal(localParts('2026-10-30T03:00:00Z').date,'2026-10-29');
});
test('freshness rejects missing, old, and future timestamps',() => {
  const now = Date.parse('2026-10-30T03:00:00Z');
  assert.equal(isFresh('2026-10-30T02:40:00Z',now),true);
  assert.equal(isFresh('2026-10-30T02:39:59Z',now),false);
  assert.equal(isFresh('',now),false);
  assert.equal(isFresh('2026-10-30T03:02:00Z',now),false);
});
test('same-slot fallback runs do not inflate samples; newest snapshot wins',() => {
  const out = build([row('2026-10-29T12:03:00Z','59',0),row('2026-10-29T12:07:00Z','59',2)]);
  assert.equal(out.coverage.snapshots,2);
  assert.equal(out.history['59'][0].samples,1);
  assert.equal(out.history['59'][0].ebike,1);
});
test('missing intervals and stations are never manufactured as zeros',() => {
  const out = build([row('2026-10-29T12:03:00Z'),row('2026-10-29T13:03:00Z','33',0)]);
  assert.equal(out.history['59'].length,1);
  assert.deepEqual(out.history.nearby,[]);
  assert.equal(out.coverage.longestGapMinutes,60);
});
test('nearby group requires all members at the same exact snapshot',() => {
  const time = '2026-10-29T12:03:00Z';
  const rows = NEARBY.map(id => row(time,id,id === '33' ? 1 : 0,{pedal_bikes:'0'}));
  assert.equal(build(rows).history.nearby[0].ebike,1);
  assert.equal(build(rows.slice(1)).history.nearby.length,0);
  const shifted = rows.map(r => r.station_id === '33' ? row('2026-10-29T12:04:00Z','33') : r);
  assert.equal(build(shifted).history.nearby.length,0);
});
test('closed stations are unavailable; bad counts and stale reports are excluded',() => {
  const time = '2026-10-29T12:03:00Z';
  const closed = build([row(time,'59',5,{is_renting:'0'})]).history['59'][0];
  assert.equal(closed.ebike,0); assert.equal(closed.any,0);
  for (const extra of [{ebikes:''},{ebikes:'-1'},{pedal_bikes:'wat'},{last_reported_utc:'2026-10-29T11:00:00Z'},{feed_updated_utc:''}]) {
    assert.deepEqual(build([row(time,'59',1,extra)]).history['59'],[]);
  }
});
test('local dates receive equal weight despite unequal snapshot counts',() => {
  const rows = [3,13,23,33,43,53].map(m => row(`2026-10-22T12:${m.toString().padStart(2,'0')}:00Z`));
  rows.push(row('2026-10-29T12:03:00Z','59',0,{pedal_bikes:'0'}));
  const c = build(rows).history['59'][0];
  assert.equal(c.ebike,.5); assert.equal(c.days,2); assert.equal(c.sufficient,false);
});
test('sufficiency requires three distinct weekday dates and six slots',() => {
  const rows = [8,15,22].flatMap(d => [3,13].map(m => row(`2026-10-${d.toString().padStart(2,'0')}T12:${m.toString().padStart(2,'0')}:00Z`)));
  assert.equal(build(rows).history['59'][0].sufficient,true);
});
test('DST repeated hour remains a single date with two independent slots',() => {
  const out = build([row('2026-11-01T05:33:00Z'),row('2026-11-01T06:33:00Z')]);
  const c = out.history['59'][0];
  assert.equal(c.hour,1); assert.equal(c.days,1); assert.equal(c.samples,2);
});
test('cadence uses UTC slots and correctly includes a month rollover',() => {
  const out = build([row('2026-10-31T23:53:00Z'),row('2026-11-01T00:03:00Z')]);
  assert.equal(out.coverage.recentCoverage,1);
  assert.equal(out.coverage.recentExpected,2);
});
test('live normalization separates pedal, e-assist, and non-bike vehicles',() => {
  const types = {data:{vehicle_types:[{vehicle_type_id:'P',form_factor:'bicycle',propulsion_type:'human'},
    {vehicle_type_id:'E',form_factor:'bicycle',propulsion_type:'electric_assist'},
    {vehicle_type_id:'S',form_factor:'scooter_standing',propulsion_type:'electric'}]}};
  const feed = {last_updated:'2026-10-29T12:00:00Z',data:{stations:[{station_id:'59',num_docks_available:4,is_renting:true,is_returning:false,
    vehicle_types_available:[{vehicle_type_id:'P',count:2},{vehicle_type_id:'E',count:3},{vehicle_type_id:'S',count:5}]}]}};
  const s = normalizeLive(feed,types)['59'];
  assert.equal(s.ebikes,3);assert.equal(s.pedal_bikes,2);assert.equal(s.is_returning,false);
  delete feed.data.stations[0].vehicle_types_available;
  assert.throws(() => normalizeLive(feed,types));
});
const ride = {date:'2026-10-29',route:'Schenley',bike:'E-bike',minutes:24,notes:'Nice afternoon'};
test('ride import rejects invalid dates and fields without changing originals',() => {
  assert.throws(() => validateRides([{...ride,date:'2026-02-30'}]));
  assert.throws(() => validateRides([{...ride,minutes:-1}]));
  assert.throws(() => validateRides([{...ride,minutes:'24'}]));
  assert.throws(() => validateRides([{...ride,notes:null}]));
  assert.deepEqual(validateRides([ride]),[ride]);
});
test('ride merge is idempotent and retains different rides on the same date',() => {
  assert.equal(mergeRides([ride],[ride]).length,1);
  assert.equal(mergeRides([ride],[{...ride,minutes:25}]).length,2);
});
