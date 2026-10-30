import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';
import {PUBLIC_FILES,packageCompanion} from '../tools/package-companion.mjs';
import {setupUpdates} from '../companion/updates.mjs';

test('deployment artifact includes every cached asset and only the public allowlist',async () => {
  const destination=await packageCompanion();
  const files=(await readdir(destination,{recursive:true,withFileTypes:true})).filter(x => x.isFile());
  assert.equal(files.length,PUBLIC_FILES.length+1);
  assert.ok(!PUBLIC_FILES.some(x => /(?:\.csv$|README|azure|\.env|settings)/i.test(x)));
  const sw=await readFile(new URL('../companion/sw.js',import.meta.url),'utf8');
  const shell=sw.match(/const SHELL = \[([^\]]+)\]/)[1].match(/'([^']+)'/g).map(x => x.slice(1,-1));
  for(const asset of shell) assert.ok(asset === './' || PUBLIC_FILES.includes(asset),`Missing cached asset: ${asset}`);
  for(const asset of PUBLIC_FILES) assert.ok((await readFile(`${destination}/${asset}`)).length > 0);
});

test('installation paths work below the GitHub Pages project subdirectory',async () => {
  const base=new URL('https://venom2074.github.io/pogoh-logger/');
  const manifest=JSON.parse(await readFile(new URL('../companion/manifest.webmanifest',import.meta.url),'utf8'));
  for(const path of [manifest.id,manifest.start_url,manifest.scope,...manifest.icons.map(x => x.src)]) {
    assert.ok(new URL(path,base).pathname.startsWith('/pogoh-logger/'));
  }
  for(const icon of manifest.icons.filter(x => x.type === 'image/png')) {
    const bytes=await readFile(new URL(`../companion/${icon.src}`,import.meta.url));
    const [width,height]=icon.sizes.split('x').map(Number);
    assert.equal(bytes.readUInt32BE(16),width);assert.equal(bytes.readUInt32BE(20),height);
  }
});

function fixture(waiting={postMessage(){}}) {
  const events={},buttons={},registration={waiting,addEventListener(name,fn){events[`registration:${name}`]=fn;}};
  let reloads=0;
  const nav={serviceWorker:{controller:{},register:async () => registration,addEventListener(name,fn){events[name]=fn;}}};
  const win={location:{reload(){reloads++;}}},notice={hidden:true};
  const button={addEventListener(name,fn){buttons[name]=fn;}};
  return {nav,win,notice,button,events,buttons,registration,reloads:() => reloads};
}
test('a waiting update stays optional and reloads only after explicit activation',async () => {
  const messages=[],f=fixture({postMessage:message => messages.push(message)});
  await setupUpdates(f.nav,f.win,f.notice,f.button);
  assert.equal(f.notice.hidden,false);assert.equal(messages.length,0);
  f.events.controllerchange();assert.equal(f.reloads(),0);
  f.buttons.click();assert.deepEqual(messages,[{type:'ACTIVATE_UPDATE'}]);
  f.events.controllerchange();assert.equal(f.reloads(),1);
});
test('first install and unavailable offline storage do not present a false update',async () => {
  const f=fixture(null);
  await setupUpdates(f.nav,f.win,f.notice,f.button);
  assert.equal(f.notice.hidden,true);
  await setupUpdates({serviceWorker:{...f.nav.serviceWorker,register:async () => {throw Error('blocked');}}},f.win,f.notice,f.button);
  assert.equal(f.notice.hidden,true);
});
test('service worker activates only on the update message and ignores external data',async () => {
  const handlers={};let activated=0;
  runInNewContext(await readFile(new URL('../companion/sw.js',import.meta.url),'utf8'),{
    URL,self:{location:new URL('https://example.com/pogoh-logger/sw.js'),
      addEventListener:(name,fn) => {handlers[name]=fn;},skipWaiting:() => {activated++;}},
  });
  handlers.message({data:{type:'OTHER'}});assert.equal(activated,0);
  handlers.message({data:{type:'ACTIVATE_UPDATE'}});assert.equal(activated,1);
  for(const url of ['https://tile.openstreetmap.org/1/2/3.png','https://pittsburgh.publicbikesystem.net/customer/gbfs/v3.0/station_status','https://example.com/other']) {
    handlers.fetch({request:{method:'GET',url},respondWith(){assert.fail('External data must not be cached');}});
  }
});
