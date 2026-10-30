// Deliberately writes candidates to ignored scratch space, never the reviewed library.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
const root = fileURLToPath(new URL('../',import.meta.url));
const routes = JSON.parse(await readFile(join(root,'tools/route-waypoints.json'),'utf8'));
const requested = process.argv.slice(2);
const selected = requested.length ? routes.filter(r => requested.includes(r.id)) : routes;
if (!selected.length) throw new Error('No matching route IDs');
const directory = join(root,'.tools/route-review');
await mkdir(directory,{recursive:true});
for (const route of selected) {
  const url = new URL('https://brouter.de/brouter');
  url.search = new URLSearchParams({lonlats:route.waypoints.map(p => `${p.lon},${p.lat}`).join('|'),profile:route.profile,alternativeidx:'0',format:'geojson'});
  const response = await fetch(url,{headers:{'User-Agent':'POGOH-companion-route-review/1.0'},signal:AbortSignal.timeout(60000)});
  if (!response.ok) throw new Error(`${route.id}: BRouter returned ${response.status}`);
  const data = await response.json(), feature = data.features?.find(f => f.geometry?.type === 'LineString');
  if (!feature) throw new Error(`${route.id}: no line geometry`);
  await writeFile(join(directory,`${route.id}.geojson`),JSON.stringify(data));
  await writeFile(join(directory,`${route.id}.source.json`),JSON.stringify({url:String(url),fetchedAt:new Date().toISOString(),waypoints:route.waypoints},null,2));
  const p = feature.properties;
  console.log(JSON.stringify({id:route.id,points:feature.geometry.coordinates.length,meters:p['track-length'],ascent:p['filtered ascend'],
    tags:p.messages?.slice(1).map(m => ({distance:m[3],way:m[9],node:m[10]}))},null,2));
}
