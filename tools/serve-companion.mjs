import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve,relative,extname,isAbsolute} from 'node:path';
import {networkInterfaces} from 'node:os';
import {previewConfig} from './preview-config.mjs';
const config=previewConfig(process.argv.slice(2),networkInterfaces());
const root = fileURLToPath(new URL('../companion/',import.meta.url));
const mime = {'.html':'text/html; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.js':'text/javascript; charset=utf-8',
  '.css':'text/css; charset=utf-8','.json':'application/json','.webmanifest':'application/manifest+json','.svg':'image/svg+xml','.png':'image/png','.gpx':'application/gpx+xml'};
const server = createServer(async (request,response) => {
  try {
    if (!['GET','HEAD'].includes(request.method)) { response.writeHead(405);response.end();return; }
    const url = new URL(request.url,'http://localhost');
    const pathname = decodeURIComponent(url.pathname);
    const path = resolve(root,`.${pathname === '/' ? '/index.html' : pathname}`);
    const rel = relative(root,path);
    if (rel.startsWith('..') || isAbsolute(rel) || rel.includes('\0')) {response.writeHead(403);response.end();return;}
    const bytes = await readFile(path);
    response.writeHead(200,{'Content-Type':mime[extname(path)] || 'application/octet-stream','Cache-Control':'no-cache','X-Content-Type-Options':'nosniff'});
    response.end(request.method === 'HEAD' ? undefined : bytes);
  } catch {response.writeHead(404);response.end('Not found');}
});
server.on('error',error => {console.error(error.message);process.exitCode=1;});
server.listen(8765,config.host,() => {
  console.log('POGOH companion: http://127.0.0.1:8765 (Ctrl+C stops it)');
  if(config.phone) {
    console.log('Phone preview enabled. Use the Wi-Fi address on the same LAN, or the computer\'s Tailscale address when both devices use Tailscale:');
    for(const item of config.urls) console.log(`${item.name}: ${item.url}`);
    if(!config.urls.length) console.log('No LAN/Tailscale IPv4 address found. Check the network connection and retry.');
    console.log('HTTP phone preview supports downloads and Maps links. File sharing and offline app caching need HTTPS; full home-screen testing waits for HTTPS hosting. No firewall settings are changed.');
  } else console.log('This computer only. For optional same-Wi-Fi testing, run npm run preview:phone.');
});
