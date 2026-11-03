// Run only after visual map review and inspection of the access audit.
// Fetch/import intentionally never calls this step automatically.
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
import {auditWaySegments,geometryProblems,positionOnRoute} from '../companion/route-utils.mjs';
import {parseCSV} from '../companion/core.mjs';
import {rentalPlanProblems} from '../companion/rental-plan.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
const date=process.argv[2],ids=process.argv.slice(3);
if(!/^\d{4}-\d{2}-\d{2}$/.test(date || '') || !ids.length) throw new Error('Usage: node tools/record-route-review.mjs YYYY-MM-DD route-id ...');
const path=join(root,'companion/routes.json'),routes=JSON.parse(await readFile(path,'utf8'));
const stations=parseCSV(await readFile(join(root,'data/stations.csv'),'utf8')).map(x=>({...x,lat:+x.lat,lon:+x.lon}));
for(const id of ids) {
  const route=routes.find(r => r.id === id);
  if(!route) throw new Error(`Unknown route ${id}`);
  const audit=JSON.parse(await readFile(join(root,'companion',route.source.auditFile),'utf8'));
  const problems=[...geometryProblems(route),...auditWaySegments(audit.segments).problems,...rentalPlanProblems(route,stations)];
  for(const checkpoint of route.checkpoints) if(positionOnRoute(route,checkpoint).distanceKm>.08) problems.push(`Checkpoint more than 80 m from track: ${checkpoint.name}`);
  if(problems.length) throw new Error(`${id}: ${problems.join('; ')}`);
  route.status='map-reviewed';
  route.review={date,fieldRidden:false,
    geometryHash:createHash('sha256').update(JSON.stringify({points:route.points,elevations:route.elevations})).digest('hex'),
    checks:['Visual comparison with street/trail map and official park/trail references',
      'Start/finish, checkpoint order, bridge approaches, and trail connections inspected',
      'Routing access/one-way tags inspected; no flagged steps, bicycle prohibition, or reverse one-way',
      'Street connectors, conservative walking sections, and rental-time limits disclosed'],
    limitations:'Map review only. Current closures, signage, bike condition, and real-device navigation have not been field verified.'};
  if(route.rentalPlan) {
    route.review.rentalPlanHash=createHash('sha256').update(JSON.stringify(route.rentalPlan)).digest('hex');
    route.review.checks.push('Plotted docking approaches and ordered rental legs reviewed with walking allowance and docking buffer');
  }
}
await writeFile(path,JSON.stringify(routes,null,2)+'\n');
console.log(`Recorded map-only review for ${ids.join(', ')} on ${date}.`);
