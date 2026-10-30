import {routeToGPX} from './route-utils.mjs';

export const DEVICE_DEFAULTS={ios:'27.2',watchos:'27.0.1'};
export const NAVIGATION_CHECKS=[
  {id:'opened',label:'Route or directions opened on iPhone'},
  {id:'geometry',label:'Imported track matches the plotted shape and direction',gpxOnly:true},
  {id:'watchMap',label:'Route and position appear on Apple Watch'},
  {id:'turns',label:'Useful turn instructions appear'},
  {id:'haptics',label:'Wrist taps work for turns'},
  {id:'locked',label:'Guidance continues with the iPhone locked'},
  {id:'offline',label:'Guidance works without a connection',optional:true},
];
export const WORKFLOWS={
  'apple-maps':{label:'Apple Maps · directions to start'},
  easyroute:{label:'EasyRoute · imported GPX · free Apple map'},
};
export function appleDirectionsURL(destination,mode='cycling') {
  if(!['walking','cycling'].includes(mode)) throw new Error('Choose walking or cycling directions');
  if(!destination || [destination.lat,destination.lon].some(v => typeof v !== 'number' && !(typeof v === 'string' && v.trim()))) throw new Error('Missing destination coordinates');
  const lat=Number(destination.lat),lon=Number(destination.lon);
  if(!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat)>90 || Math.abs(lon)>180) throw new Error('Invalid destination coordinates');
  const url=new URL('https://maps.apple.com/directions');
  // Omitting source lets Maps ask for/use the person's current location.
  // This is a destination handoff, never a claim to transfer the custom loop.
  url.search=new URLSearchParams({destination:`${lat},${lon}`,mode});
  return String(url);
}
export function routeSharePayload(route) {
  const name=typeof route.id === 'string' && /^[a-z0-9-]{1,60}$/.test(route.id) ? route.id :
    String(route.name || 'route').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,60) || 'route';
  const file=new File([routeToGPX(route)],`pogoh-${name}.gpx`,{type:'application/gpx+xml'});
  return {files:[file],title:route.name};
}
export function canShareRoute(payload,platform,secure) {
  if(!secure || typeof platform?.share !== 'function' || typeof platform?.canShare !== 'function') return false;
  try { return platform.canShare({files:payload.files}) === true; } catch { return false; }
}
export async function shareRouteFile(route,platform,secure) {
  const payload=routeSharePayload(route);
  if(!canShareRoute(payload,platform,secure)) return 'unsupported';
  // Call share in the click's activation, before any network request/await.
  try {await platform.share(payload);return 'shared';}
  catch(error) {return error?.name === 'AbortError' ? 'cancelled' : 'failed';}
}
const RESULTS=['untested','passed','failed','unavailable'];
export function blankNavigationReport(route,workflow='easyroute') {
  return {schema:1,routeId:route.id,geometryHash:route.review?.geometryHash || '',workflow,
    ...DEVICE_DEFAULTS,appVersion:'',checkedAt:null,checks:Object.fromEntries(NAVIGATION_CHECKS.map(c => [c.id,'untested'])),notes:''};
}
export function validateNavigationReports(reports) {
  if(!Array.isArray(reports) || reports.length>100) throw new Error('Expected at most 100 device checks');
  return reports.map(r => {
    if(!r || r.schema !== 1 || typeof r.routeId !== 'string' || !/^[a-z0-9-]{1,60}$/.test(r.routeId) ||
      typeof r.geometryHash !== 'string' || !/^[a-f0-9]{64}$/.test(r.geometryHash) || !Object.hasOwn(WORKFLOWS,r.workflow) ||
      typeof r.ios !== 'string' || !r.ios.trim() || r.ios.length>30 || typeof r.watchos !== 'string' || !r.watchos.trim() || r.watchos.length>30 ||
      typeof r.appVersion !== 'string' || r.appVersion.length>60 || typeof r.notes !== 'string' || r.notes.length>2000 ||
      !r.checks || NAVIGATION_CHECKS.some(c => !RESULTS.includes(r.checks[c.id])) ||
      (r.checkedAt !== null && (typeof r.checkedAt !== 'string' || !Number.isFinite(Date.parse(r.checkedAt))))) throw new Error('Invalid device check; existing results were not changed');
    return {schema:1,routeId:r.routeId,geometryHash:r.geometryHash,workflow:r.workflow,ios:r.ios,watchos:r.watchos,
      appVersion:r.appVersion,checkedAt:r.checkedAt,checks:Object.fromEntries(NAVIGATION_CHECKS.map(c => [c.id,r.checks[c.id]])),notes:r.notes};
  });
}
export function navigationReportState(report,currentGeometryHash) {
  if(!report) return {state:'untested',text:'Not tested on your devices'};
  if(report.geometryHash !== currentGeometryHash) return {state:'changed',text:'Route changed — repeat the device check'};
  const checks=NAVIGATION_CHECKS.filter(c => !c.optional && (!c.gpxOnly || report.workflow === 'easyroute')).map(c => report.checks[c.id]);
  if(checks.every(v => v === 'untested')) return {state:'untested',text:'Not tested on your devices'};
  if(checks.some(v => v === 'failed')) return {state:'failed',text:'A required step did not work — use the phone fallback'};
  if(checks.every(v => v === 'passed')) return {state:'reported',text:'Reported working on your devices · online workflow'};
  return {state:'partial',text:'Partly checked — Watch workflow still incomplete'};
}
