import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {parseCSV,distanceKm} from '../companion/core.mjs';
import {validateTrack,routeDistance,movingMinutes,positionOnRoute,nearbyRouteStations,geometryProblems,auditWaySegments,routeToGPX} from '../companion/route-utils.mjs';

const line={name:'Test route',points:[[40,-80],[40,-79.998]]};
test('track validation rejects impossible coordinates and missing names',() => {
  assert.equal(validateTrack(line),true);
  for(const bad of [{...line,name:''},{...line,points:[[91,0],[0,0]]},{...line,points:[[0,0]]},{...line,points:[[0,0],[NaN,0]]}]) assert.equal(validateTrack(bad),false);
});
test('track distance and estimates use the actual line and both outbound and return legs',() => {
  const loop={...line,points:[...line.points,line.points[0]]};
  assert.ok(Math.abs(routeDistance(loop)-routeDistance(line)*2)<1e-8);
  assert.ok(routeDistance(line)>.16 && routeDistance(line)<.18);
  assert.ok(movingMinutes(loop).max>=movingMinutes(loop).min);
});
test('station proximity measures to segments instead of only GPX vertices',() => {
  const location={lat:40.0001,lon:-79.999};
  const p=positionOnRoute(line,location);
  assert.ok(p.distanceKm>.010 && p.distanceKm<.012);
  assert.ok(Math.abs(p.alongKm-routeDistance(line)/2)<.0001);
});
test('nearby stations sort by progress and the start station remains first on a loop',() => {
  const loop={name:'Loop',startStationId:'49',points:[[40,-80],[40,-79.998],[40.001,-79.998],[40,-80]]};
  const stations=[{station_id:'A',lat:40.0005,lon:-79.998},{station_id:'49',lat:40,lon:-80},{station_id:'far',lat:41,lon:-80}];
  const near=nearbyRouteStations(loop,stations);
  assert.equal(near[0].station_id,'49'); assert.equal(near[0].proximity.alongKm,0); assert.equal(near[0].proximity.startFinish,true);
  assert.equal(near.length,2);
});
test('geometry checking detects disconnected tracks',() => {
  assert.deepEqual(geometryProblems(line),[]);
  assert.ok(geometryProblems({name:'Jump',points:[[40,-80],[41,-80]]}).some(s => s.includes('gap')));
});
test('access audit catches steps, bicycle bans, private access, and reverse one-ways',() => {
  const segments=['highway=steps','highway=cycleway bicycle=no','highway=service access=private',
    'highway=residential oneway=yes reversedirection=yes'].map(way => ({way,meters:20}));
  const audit=auditWaySegments(segments);
  assert.equal(audit.problems.length,3);
  assert.deepEqual(auditWaySegments([{way:'highway=secondary oneway=yes reversedirection=yes oneway:bicycle=no',meters:100}]).problems,[]);
  assert.deepEqual(auditWaySegments([{way:'highway=service access=private bicycle=yes',meters:10}]).problems,[]);
  assert.equal(auditWaySegments([{way:'highway=footway',meters:12}]).walkMeters,12);
});
test('GPX export escapes XML and retains optional elevations without inventing turns',() => {
  const xml=routeToGPX({...line,name:'A & B <route>',elevations:[200,201],source:{url:'https://example.com/?a=1&b=2'}});
  assert.ok(xml.includes('A &amp; B &lt;route&gt;'));
  assert.ok(xml.includes('<ele>200</ele>'));
  assert.ok(xml.includes('a=1&amp;b=2'));
  assert.equal((xml.match(/<trkpt /g)||[]).length,2);
  assert.throws(() => routeToGPX({name:'Bad',points:[]}));
});
const library=JSON.parse(await readFile(new URL('../companion/routes.json',import.meta.url),'utf8'));
const stations=parseCSV(await readFile(new URL('../data/stations.csv',import.meta.url),'utf8')).map(s => ({...s,lat:+s.lat,lon:+s.lon}));
for(const route of library) test(`${route.id}: reviewed track, access audit, station endpoints, and exported GPX agree`,async () => {
  assert.equal(route.status,'map-reviewed'); assert.equal(route.review.fieldRidden,false);
  assert.equal(createHash('sha256').update(JSON.stringify({points:route.points,elevations:route.elevations})).digest('hex'),route.review.geometryHash);
  assert.deepEqual(geometryProblems(route),[]);
  const station=stations.find(s => s.station_id===route.startStationId),first=route.points[0],last=route.points.at(-1);
  assert.ok(distanceKm(station,{lat:first[0],lon:first[1]})<.05);
  assert.ok(distanceKm(station,{lat:last[0],lon:last[1]})<.05);
  for(const checkpoint of route.checkpoints) assert.ok(positionOnRoute(route,checkpoint).distanceKm<.08,checkpoint.name);
  const audit=JSON.parse(await readFile(new URL(`../companion/${route.source.auditFile}`,import.meta.url),'utf8'));
  assert.deepEqual(auditWaySegments(audit.segments).problems,[]);
  assert.equal(auditWaySegments(audit.segments).walkMeters,route.source.walkMeters);
  const xml=await readFile(new URL(`../companion/routes/${route.id}.gpx`,import.meta.url),'utf8');
  assert.equal(xml,routeToGPX(route));
  assert.equal(nearbyRouteStations(route,stations)[0].station_id,route.startStationId);
  assert.ok(route.cautions.length>0 && route.sources.length>0 && route.rentalNote.length>0);
});
