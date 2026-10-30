import {distanceKm} from './core.mjs';

export function validateTrack(route) {
  return !!route && typeof route.name === 'string' && route.name.length > 0 && route.name.length <= 120 &&
    Array.isArray(route.points) && route.points.length >= 2 && route.points.length <= 50000 &&
    route.points.every(p => Array.isArray(p) && p.length === 2 && Number.isFinite(p[0]) && Math.abs(p[0]) <= 90 && Number.isFinite(p[1]) && Math.abs(p[1]) <= 180);
}
export function routeDistance(route) {
  return route.points.slice(1).reduce((sum,p,i) => sum + distanceKm(
    {lat:route.points[i][0],lon:route.points[i][1]},{lat:p[0],lon:p[1]}),0);
}
export function movingMinutes(route) {
  const km = routeDistance(route);
  return {min:Math.max(1,Math.round(km/18*60)),max:Math.max(1,Math.round(km/12*60))};
}
export function positionOnRoute(route, location) {
  // Local equirectangular projection onto each segment, then haversine distance.
  // Proximity is geographic; it does not imply a rideable station connection.
  const scale = Math.cos(location.lat*Math.PI/180);
  let travelled = 0, best = {distanceKm:Infinity,alongKm:0,segment:0};
  for (let i=1;i<route.points.length;i++) {
    const [aLat,aLon] = route.points[i-1], [bLat,bLon] = route.points[i];
    const dx = (bLon-aLon)*scale, dy = bLat-aLat, denom=dx*dx+dy*dy;
    const t = denom ? Math.max(0,Math.min(1,((location.lon-aLon)*scale*dx+(location.lat-aLat)*dy)/denom)) : 0;
    const projected = {lat:aLat+t*(bLat-aLat),lon:aLon+t*(bLon-aLon)};
    const separation = distanceKm(location,projected);
    const segmentKm = distanceKm({lat:aLat,lon:aLon},{lat:bLat,lon:bLon});
    if (separation < best.distanceKm-1e-8) best = {distanceKm:separation,alongKm:travelled+t*segmentKm,segment:i-1};
    travelled += segmentKm;
  }
  return best;
}
export function nearbyRouteStations(route, stations, radiusKm=.3) {
  return stations.map(station => {
    const proximity=positionOnRoute(route,station),first=route.points[0],last=route.points.at(-1);
    const anchor=String(station.station_id) === String(route.startStationId) &&
      distanceKm(station,{lat:first[0],lon:first[1]}) < .05 && distanceKm(station,{lat:last[0],lon:last[1]}) < .05;
    return {...station,proximity:anchor ? {...proximity,alongKm:0,startFinish:true} : proximity};
  })
    .filter(station => station.proximity.distanceKm <= radiusKm)
    .sort((a,b) => a.proximity.alongKm-b.proximity.alongKm);
}
export function geometryProblems(route, maximumGapKm=.35) {
  if (!validateTrack(route)) return ['Invalid track coordinates'];
  const problems=[];
  for (let i=1;i<route.points.length;i++) {
    const a=route.points[i-1],b=route.points[i];
    if(distanceKm({lat:a[0],lon:a[1]},{lat:b[0],lon:b[1]}) > maximumGapKm) problems.push(`Large geometry gap before point ${i+1}`);
  }
  if (routeDistance(route) < .05) problems.push('Route is too short for a starter ride');
  return problems;
}
export function auditWaySegments(segments) {
  const problems=[]; let walkMeters=0,roadMeters=0;
  for (const s of segments) {
    const tags=Object.fromEntries(s.way.trim().split(/\s+/).filter(Boolean).map(tag => {const i=tag.indexOf('=');return [tag.slice(0,i),tag.slice(i+1)];}));
    const allowed=['yes','designated','permissive'].includes(tags.bicycle);
    if(tags.highway === 'steps') problems.push('Steps in route');
    if(tags.bicycle === 'no' || (['no','private'].includes(tags.access) && !allowed)) problems.push('Restricted bicycle access in route');
    if(tags.reversedirection === 'yes' && tags.oneway === 'yes' && tags['oneway:bicycle'] !== 'no') problems.push('Potential reverse one-way segment');
    if(tags.bicycle === 'dismount' || (['footway','pedestrian'].includes(tags.highway) && !allowed)) walkMeters += s.meters;
    if(['primary','secondary','tertiary','unclassified','residential','primary_link','secondary_link','tertiary_link'].includes(tags.highway)) roadMeters += s.meters;
  }
  return {problems:[...new Set(problems)],walkMeters,roadMeters};
}
const xml = value => String(value).replace(/[&<>"']/g,c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
export function routeToGPX(route) {
  if (!validateTrack(route)) throw new Error('Cannot export invalid geometry');
  const elevation = Array.isArray(route.elevations) && route.elevations.length === route.points.length && route.elevations.every(Number.isFinite);
  const license = route.source ? '<copyright author="OpenStreetMap contributors"><license>https://opendatacommons.org/licenses/odbl/1-0/</license></copyright>' : '';
  const origin = route.source?.url ? `<link href="${xml(route.source.url)}"><text>Route source</text></link>` : '';
  return `<?xml version="1.0" encoding="UTF-8"?>\n<gpx version="1.1" creator="POGOH companion" xmlns="http://www.topografix.com/GPX/1/1">\n<metadata><name>${xml(route.name)}</name>${license}${origin}</metadata>\n<trk><name>${xml(route.name)}</name><desc>Route geometry, not turn instructions. Check current access and conditions.</desc><trkseg>\n${route.points.map((p,i) => `<trkpt lat="${p[0]}" lon="${p[1]}">${elevation ? `<ele>${route.elevations[i]}</ele>` : ''}</trkpt>`).join('\n')}\n</trkseg></trk>\n</gpx>\n`;
}
