import test from 'node:test';
import assert from 'node:assert/strict';
import {rentalLegs,rentalPlanProblems} from '../companion/rental-plan.mjs';
import {routeDistance,routeToGPX} from '../companion/route-utils.mjs';

const stations=[{station_id:'A',name:'Start',lat:40,lon:-80},{station_id:'B',name:'Dock & return',lat:40,lon:-79.98}];
const route={name:'Out and back',startStationId:'A',points:[[40,-80],[40,-79.99],[40,-79.98],[40,-79.99],[40,-80]],source:{walkMeters:0},
  rentalPlan:{schema:1,bufferMinutes:5,stops:[{stationId:'B',name:'Dock & return',pointIndex:2}]}};

test('rental legs partition the plotted ride at the explicit dock visit',()=>{
  const legs=rentalLegs(route,stations);
  assert.equal(legs.length,2);
  assert.equal(legs[0].end.station.station_id,'B');assert.equal(legs[1].start.station.station_id,'B');
  assert.ok(Math.abs(legs.reduce((n,x)=>n+x.km,0)-routeDistance(route))<1e-8);
  assert.deepEqual(rentalPlanProblems(route,stations),[]);
});
test('a nearby station does not qualify unless the track reaches its dock access',()=>{
  const shifted=[stations[0],{...stations[1],lat:40.001}];
  assert.ok(rentalPlanProblems(route,shifted).some(x=>x.includes('misses station B')));
});
test('rental validation rejects unknown stations, unordered indices, and inadequate buffer',()=>{
  for(const stops of [[{stationId:'unknown',pointIndex:2}],[{stationId:'B',pointIndex:0}],[{stationId:'B',pointIndex:5}],
    [{stationId:'B',pointIndex:2},{stationId:'B',pointIndex:1}]]) {
    assert.ok(rentalPlanProblems({...route,rentalPlan:{...route.rentalPlan,stops}},stations).length);
  }
  assert.ok(rentalPlanProblems({...route,rentalPlan:{...route.rentalPlan,bufferMinutes:0}},stations).length);
});
test('long rides require stops and slow legs must retain a buffer below 30 minutes',()=>{
  const far={...route,points:[[40,-80],[40,-79.9],[40,-80]]};
  const farStations=[stations[0],{...stations[1],lon:-79.9}];
  assert.ok(rentalPlanProblems({...far,rentalPlan:undefined},farStations).some(x=>x.includes('needs a planned')));
  assert.ok(rentalPlanProblems({...far,rentalPlan:{...route.rentalPlan,stops:[{stationId:'B',pointIndex:1}]}},farStations).some(x=>x.includes('below 30')));
});
test('budget adds a conservative walking correction rather than treating every meter as cycling',()=>{
  const without=rentalLegs(route,stations),withWalking=rentalLegs({...route,source:{walkMeters:600}},stations);
  for(let i=0;i<2;i++) {
    assert.equal(withWalking[i].km,without[i].km);
    assert.ok(withWalking[i].budgetMinutes>=without[i].budgetMinutes+6);
  }
});
test('GPX exports retain the track and add escaped named docking waypoints',()=>{
  const xml=routeToGPX(route);
  assert.equal((xml.match(/<wpt /g)||[]).length,1);assert.equal((xml.match(/<trkpt /g)||[]).length,route.points.length);
  assert.ok(xml.includes('Dock 1: Dock &amp; return'));assert.ok(xml.indexOf('<wpt ')<xml.indexOf('<trk>'));
  assert.throws(()=>routeToGPX({...route,rentalPlan:{...route.rentalPlan,stops:[{pointIndex:99}]}}));
});
