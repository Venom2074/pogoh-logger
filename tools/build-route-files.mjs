import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
import {geometryProblems,routeToGPX} from '../companion/route-utils.mjs';
import {parseCSV} from '../companion/core.mjs';
import {rentalPlanProblems} from '../companion/rental-plan.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
const routes=JSON.parse(await readFile(join(root,'companion/routes.json'),'utf8'));
const stations=parseCSV(await readFile(join(root,'data/stations.csv'),'utf8')).map(x=>({...x,lat:+x.lat,lon:+x.lon}));
const outputs=[];
// Validate everything before writing anything. A geometry edit invalidates its review.
for(const route of routes) {
  if(route.status !== 'map-reviewed') throw new Error(`${route.id}: map review is required before generating the route library.`);
  const hash=createHash('sha256').update(JSON.stringify({points:route.points,elevations:route.elevations})).digest('hex');
  const problems=[...geometryProblems(route),...rentalPlanProblems(route,stations)];
  if(route.rentalPlan && route.review?.rentalPlanHash!==createHash('sha256').update(JSON.stringify(route.rentalPlan)).digest('hex')) problems.push('Rental plan changed since review');
  if(!/^[a-z0-9-]+$/.test(route.id) || !/^\d{4}-\d{2}-\d{2}$/.test(route.review?.date) || route.review?.geometryHash !== hash || problems.length) {
    throw new Error(`${route.id}: review missing, geometry changed, or invalid track: ${problems.join('; ')}`);
  }
  outputs.push({id:route.id,text:routeToGPX(route)});
}
await mkdir(join(root,'companion/routes'),{recursive:true});
for(const output of outputs) await writeFile(join(root,'companion/routes',`${output.id}.gpx`),output.text);
console.log(`Generated ${outputs.length} reviewed GPX files.`);
