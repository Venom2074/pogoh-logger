import {distanceKm} from './core.mjs';
import {validateTrack,routeDistance,movingMinutes} from './route-utils.mjs';

export function rentalLegs(route,stations) {
  if(!route.rentalPlan) return [];
  const plan=route.rentalPlan;
  if(!validateTrack(route) || !Array.isArray(plan.stops)) throw new Error('Invalid rental plan');
  const home=stations.find(x=>x.station_id===route.startStationId);
  if(!home) throw new Error('Start station missing');
  const boundaries=[{station:home,pointIndex:0}];
  for(const stop of plan.stops) {
    const station=stations.find(x=>x.station_id===stop.stationId);
    if(!station || !Number.isInteger(stop.pointIndex) || stop.pointIndex<=boundaries.at(-1).pointIndex || stop.pointIndex>=route.points.length-1) throw new Error('Invalid dock stop order or station');
    boundaries.push({station,pointIndex:stop.pointIndex});
  }
  boundaries.push({station:home,pointIndex:route.points.length-1});
  // Conservatively apply the whole track's walking correction to every leg.
  // The base distance estimate otherwise treats those meters as cycling at 12 km/h.
  const walkingAllowanceMinutes=Math.ceil((route.source?.walkMeters || 0)/1000*(60/4-60/12));
  return boundaries.slice(1).map((end,i) => {
    const start=boundaries[i],km=routeDistance({points:route.points.slice(start.pointIndex,end.pointIndex+1)});
    const min=Math.ceil(km/18*60),max=Math.ceil(km/12*60);
    return {start,end,km,min,max,walkingAllowanceMinutes,budgetMinutes:max+walkingAllowanceMinutes+plan.bufferMinutes};
  });
}

export function rentalPlanProblems(route,stations) {
  if(!validateTrack(route)) return ['Invalid rental-plan track'];
  const plan=route.rentalPlan;
  if(!plan) return movingMinutes(route).max>30 ? ['Ride over 30 minutes needs a planned docking stop'] : [];
  if(plan.schema!==1 || !Number.isInteger(plan.bufferMinutes) || plan.bufferMinutes<5 || plan.bufferMinutes>15 || !Array.isArray(plan.stops) || !plan.stops.length) return ['Invalid rental plan or missing docking buffer'];
  try {
    const legs=rentalLegs(route,stations),problems=[];
    for(const leg of legs) {
      for(const boundary of [leg.start,leg.end]) {
        const p=route.points[boundary.pointIndex];
        if(distanceKm(boundary.station,{lat:p[0],lon:p[1]})>.025) problems.push(`Track misses station ${boundary.station.station_id} dock access`);
      }
      if(leg.budgetMinutes>=30) problems.push(`Rental leg to station ${leg.end.station.station_id} has no buffer below 30 minutes`);
    }
    return [...new Set(problems)];
  } catch(error) {return [error.message];}
}
