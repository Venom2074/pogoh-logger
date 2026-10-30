import {readFile, writeFile, mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve, join} from 'node:path';
import {parseCSV, summarize} from '../companion/core.mjs';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const args = process.argv.slice(2), remote = args.includes('--remote');
const inputIndex = args.indexOf('--data');
const dataDir = inputIndex >= 0 ? resolve(args[inputIndex+1]) : join(root, 'data');
const {readdir} = await import('node:fs/promises');
const get = async url => {
  const response = await fetch(url, {headers: {'User-Agent':'pogoh-companion-builder'}, signal: AbortSignal.timeout(30000)});
  if (!response.ok) throw new Error(`Public data request failed: ${response.status}`);
  return response.text();
};
let files, load;
if (remote) {
  // Public, read-only data. No token and no changes to the logger checkout.
  const entries = JSON.parse(await get('https://api.github.com/repos/Venom2074/pogoh-logger/contents/data'));
  files = entries.filter(x => /^\d{4}-\d{2}\.csv$/.test(x.name)).map(x => x.name).sort();
  load = name => get(`https://raw.githubusercontent.com/Venom2074/pogoh-logger/main/data/${name}`);
} else {
  files = (await readdir(dataDir)).filter(n => /^\d{4}-\d{2}\.csv$/.test(n)).sort();
  load = name => readFile(join(dataDir, name), 'utf8');
}
const stations = parseCSV(await load('stations.csv')).map(s => ({...s, lat:+s.lat, lon:+s.lon, capacity:+s.capacity}));
const rows = [];
for (const name of files) {
  const parsed = parseCSV(await load(name));
  for (const row of parsed) rows.push(row);
}
const summary = summarize(rows, stations);
const destination = join(root,'companion','data');
await mkdir(destination, {recursive:true});
await writeFile(join(destination,'summary.json'), JSON.stringify(summary));
console.log(JSON.stringify({source:remote?'public GitHub data':dataDir, latest:summary.latest.at, ...summary.coverage},null,2));
