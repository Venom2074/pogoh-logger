import test from 'node:test';
import assert from 'node:assert/strict';
import {appleDirectionsURL,routeSharePayload,canShareRoute,shareRouteFile,blankNavigationReport,
  validateNavigationReports,navigationReportState,NAVIGATION_CHECKS} from '../companion/navigation.mjs';
import {routeToGPX} from '../companion/route-utils.mjs';
import {previewConfig} from '../tools/preview-config.mjs';

const route={id:'test-route',name:'A & B ride',points:[[40.44,-79.95],[40.441,-79.949]],
  review:{geometryHash:'a'.repeat(64)}};
test('Maps handoff requests a travel mode and destination, without implying a custom loop',() => {
  for(const mode of ['cycling','walking']) {
    const url=new URL(appleDirectionsURL({lat:40.442435,lon:-79.951498},mode));
    assert.equal(url.origin,'https://maps.apple.com');assert.equal(url.pathname,'/directions');
    assert.equal(url.searchParams.get('mode'),mode);
    assert.equal(url.searchParams.get('destination'),'40.442435,-79.951498');
    assert.equal(url.searchParams.has('source'),false);assert.equal(url.searchParams.has('waypoint'),false);
  }
  assert.equal(new URL(appleDirectionsURL({lat:'40.44',lon:'-79.95'})).searchParams.get('destination'),'40.44,-79.95');
});
test('Maps links reject missing/impossible coordinates and unsupported modes',() => {
  for(const dest of [null,{}, {lat:' ',lon:0},{lat:[],lon:0},{lat:true,lon:0},{lat:91,lon:0},{lat:0,lon:-181},{lat:NaN,lon:0}]) assert.throws(() => appleDirectionsURL(dest));
  assert.throws(() => appleDirectionsURL({lat:0,lon:0},'driving'));
});
test('share payload is the GPX file itself, not a website link',async () => {
  const payload=routeSharePayload(route);
  assert.equal(payload.files.length,1);assert.equal(payload.files[0].name,'pogoh-test-route.gpx');
  assert.equal(payload.files[0].type,'application/gpx+xml');assert.equal(await payload.files[0].text(),routeToGPX(route));
  assert.equal(payload.url,undefined);
  assert.ok(!routeSharePayload({...route,id:'../../bad'}).files[0].name.includes('/'));
});
test('file sharing respects secure context and reported file support',() => {
  const payload=routeSharePayload(route),platform={share(){},canShare:() => true};
  assert.equal(canShareRoute(payload,platform,true),true);
  assert.equal(canShareRoute(payload,platform,false),false);
  assert.equal(canShareRoute(payload,{share(){}},true),false);
  assert.equal(canShareRoute(payload,{...platform,canShare(){throw Error('blocked');}},true),false);
});
test('share is invoked before awaiting work, preserving click activation',async () => {
  const calls=[];
  const promise=shareRouteFile(route,{canShare:() => true,share:payload => {calls.push(payload.files[0].name);return Promise.resolve();}},true);
  assert.deepEqual(calls,['pogoh-test-route.gpx']);assert.equal(await promise,'shared');
});
test('unsupported, cancelled, and failed sharing have distinct outcomes',async () => {
  let calls=0;
  assert.equal(await shareRouteFile(route,{canShare:() => false,share(){calls++;}},true),'unsupported');assert.equal(calls,0);
  assert.equal(await shareRouteFile(route,{canShare:() => true,share(){throw {name:'AbortError'};}},true),'cancelled');
  assert.equal(await shareRouteFile(route,{canShare:() => true,share(){throw {name:'NotAllowedError'};}},true),'failed');
});
test('fresh device reports never start as passed',() => {
  const report=blankNavigationReport(route);
  assert.equal(report.checkedAt,null);assert.ok(Object.values(report.checks).every(v => v === 'untested'));
  assert.equal(navigationReportState(report,route.review.geometryHash).state,'untested');
});
test('report validation rejects malformed statuses, versions, and workflow names',() => {
  const report=blankNavigationReport(route);
  assert.equal(validateNavigationReports([report]).length,1);
  for(const invalid of [{...report,workflow:'__proto__'},{...report,ios:''},{...report,geometryHash:'old'},
    {...report,checks:{...report.checks,watchMap:'yes'}},{...report,checkedAt:'not a date'}]) assert.throws(() => validateNavigationReports([invalid]));
});
test('partial/failing/changed routes cannot be reported as a working Watch workflow',() => {
  const report=blankNavigationReport(route);
  report.checks.opened='passed';assert.equal(navigationReportState(report,route.review.geometryHash).state,'partial');
  report.checks.watchMap='failed';assert.equal(navigationReportState(report,route.review.geometryHash).state,'failed');
  for(const c of NAVIGATION_CHECKS) report.checks[c.id]='passed';
  assert.equal(navigationReportState(report,route.review.geometryHash).state,'reported');
  assert.equal(navigationReportState(report,'b'.repeat(64)).state,'changed');
  report.checks.haptics='unavailable';assert.equal(navigationReportState(report,route.review.geometryHash).state,'partial');
});
test('Apple Maps report is only for its chosen destination; offline is optional',() => {
  const report=blankNavigationReport(route,'apple-maps');
  for(const c of NAVIGATION_CHECKS.filter(c => !c.gpxOnly && !c.optional)) report.checks[c.id]='passed';
  report.checks.offline='failed';
  assert.equal(report.checks.geometry,'untested');assert.equal(navigationReportState(report,route.review.geometryHash).state,'reported');
  assert.ok(navigationReportState(report,route.review.geometryHash).text.includes('online'));
});
const adapters={WiFi:[{family:'IPv4',address:'192.168.1.10',internal:false}],VPN:[{family:'IPv4',address:'10.5.0.1',internal:false}],
  public:[{family:'IPv4',address:'203.0.113.1',internal:false}],loopback:[{family:'IPv4',address:'127.0.0.1',internal:true}]};
test('preview remains loopback-only unless --phone is explicitly selected',() => {
  assert.deepEqual(previewConfig([],adapters),{host:'127.0.0.1',phone:false,urls:[]});
  const phone=previewConfig(['--phone'],adapters);assert.equal(phone.host,'0.0.0.0');assert.equal(phone.urls.length,2);
  assert.ok(phone.urls.some(r => r.url==='http://192.168.1.10:8765/'));
  assert.throws(() => previewConfig(['--public'],adapters));
});
test('phone preview includes Tailscale CGNAT addresses with correct range boundaries',() => {
  const addresses=['100.63.255.255','100.64.0.1','100.101.102.103','100.127.255.254','100.128.0.1'];
  const result=previewConfig(['--phone'],{Tailscale:addresses.map(address => ({address,family:'IPv4',internal:false}))});
  assert.deepEqual(result.urls.map(x => x.url),['http://100.64.0.1:8765/','http://100.101.102.103:8765/','http://100.127.255.254:8765/']);
});
