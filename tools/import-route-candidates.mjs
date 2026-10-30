import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
import {auditWaySegments,geometryProblems} from '../companion/route-utils.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
const ids=process.argv.slice(2);
if(!ids.length) throw new Error('Supply the candidate IDs to import; this clears their prior review.');
const libraryPath=join(root,'companion/routes.json');
const routes=JSON.parse(await readFile(libraryPath,'utf8'));
const auditOutputs=[];
await mkdir(join(root,'companion/route-data'),{recursive:true});
for(const id of ids) {
  const route=routes.find(r => r.id === id);
  if(!route) throw new Error(`Unknown route: ${id}`);
  const data=JSON.parse(await readFile(join(root,'.tools/route-review',`${id}.geojson`),'utf8'));
  const origin=JSON.parse(await readFile(join(root,'.tools/route-review',`${id}.source.json`),'utf8'));
  const feature=data.features.find(f => f.geometry?.type === 'LineString');
  if(!feature) throw new Error(`${id}: no route line`);
  route.points=feature.geometry.coordinates.map(p => [p[1],p[0]]);
  route.elevations=feature.geometry.coordinates.map(p => p[2]);
  route.ascentMeters=Number(feature.properties['filtered ascend']);
  const segments=feature.properties.messages.slice(1).map(m => ({end:[Number(m[1])/1e6,Number(m[0])/1e6],meters:Number(m[3]),way:m[9],node:m[10]}));
  const audit=auditWaySegments(segments), problems=[...audit.problems,...geometryProblems(route)];
  if(problems.length) throw new Error(`${id}: ${problems.join('; ')}`);
  route.status='candidate'; delete route.review;
  route.checkpoints=origin.waypoints;
  route.source={provider:feature.properties.creator,profile:'trekking',url:origin.url,fetchedAt:origin.fetchedAt,
    attribution:'© OpenStreetMap contributors · ODbL 1.0',license:'https://opendatacommons.org/licenses/odbl/1-0/',
    auditFile:`route-data/${id}.json`,walkMeters:audit.walkMeters,roadMeters:audit.roadMeters};
  auditOutputs.push({id,text:JSON.stringify({source:route.source,segments})});
  console.log(`${id}: candidate imported; ${route.points.length} points; ${audit.walkMeters} m conservative walking allowance; ${audit.roadMeters} m streets.`);
}
for(const output of auditOutputs) await writeFile(join(root,'companion/route-data',`${output.id}.json`),output.text);
await writeFile(libraryPath,JSON.stringify(routes,null,2)+'\n');
