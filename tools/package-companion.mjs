import {copyFile,lstat,mkdir,rm,writeFile} from 'node:fs/promises';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

// Publish runtime assets only. Raw data, Azure code, and local files stay out.
export const PUBLIC_FILES=Object.freeze([
  'index.html','styles.css','app.mjs','core.mjs','route-utils.mjs','navigation.mjs',
  'navigation-ui.mjs','updates.mjs','sw.js','routes.json','data/summary.json',
  'routes/schenley.gpx','routes/eliza.gpx','routes/river-loop.gpx',
  'icon.svg','icons/apple-touch-icon.png','icons/icon-192.png','icons/icon-512.png',
  'manifest.webmanifest','vendor/leaflet.js','vendor/leaflet.css','vendor/LICENSE',
]);
const root=fileURLToPath(new URL('..',import.meta.url));
export async function packageCompanion() {
  const destination=resolve(root,'.site'),source=resolve(root,'companion');
  // Validate the complete allowlist before touching an earlier build.
  for(const file of PUBLIC_FILES) {
    if(!(await lstat(resolve(source,file))).isFile()) throw new Error(`Expected a regular public asset: ${file}`);
  }
  // The deletion target is a fixed directory inside this repository.
  await rm(destination,{recursive:true,force:true});
  for(const file of PUBLIC_FILES) {
    const target=resolve(destination,file);
    await mkdir(dirname(target),{recursive:true});
    await copyFile(resolve(source,file),target);
  }
  await writeFile(resolve(destination,'.nojekyll'),'');
  return destination;
}
if(process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  console.log(`Prepared ${PUBLIC_FILES.length} public assets in ${await packageCompanion()}`);
}
