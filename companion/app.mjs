import {HOME, NEARBY, HISTORY_IDS, isFresh, normalizeLive, distanceKm, localParts, validateRides, mergeRides} from './core.mjs';
import {validateTrack as validateRoute, routeDistance, movingMinutes, nearbyRouteStations, routeToGPX as gpxXML} from './route-utils.mjs';
import {mountNavigationGuide,mountRouteNavigation} from './navigation-ui.mjs';
import {setupUpdates} from './updates.mjs';

const $ = id => document.getElementById(id);
const FEED = 'https://pittsburgh.publicbikesystem.net/customer/gbfs/v3.0/';
const CLOCK = new Intl.DateTimeFormat('en-US', {timeZone:'America/New_York', month:'short', day:'numeric', hour:'numeric', minute:'2-digit', timeZoneName:'short'});
const DAYS = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const stamp = value => Number.isFinite(Date.parse(value)) ? CLOCK.format(new Date(value)) : 'time unavailable';
const percent = value => `${Math.round(value * 100)}%`;
const mapsURL = s => `https://maps.apple.com/?ll=${Number(s.lat)},${Number(s.lon)}&q=${encodeURIComponent(s.name)}`;
let summary, proposals = [], imported = [], rides = [], view, source = 'Bundled snapshot', fetchNote = '', fetching = false;
let stationMap, stationLayer, routeMap, routeStationLayer, activeRouteStations = [], storageAvailable = true, storageProblem = '', rideStorageBlocked = false;
const STORAGE = {rides:'pogoh-rides-v1', routes:'pogoh-routes-v1', status:'pogoh-status-v1'};
function readStored(key) {
  try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : null; }
  catch { storageAvailable = false; if (key === STORAGE.rides) rideStorageBlocked = true; storageProblem = 'Saved browser data could not be read. The stored copy is preserved; export this session before closing.'; return null; }
}
function writeStored(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); return true; }
  catch { storageAvailable = false; storageProblem = 'Browser storage is unavailable or full. Changes are in memory; export before closing.'; return false; }
}
async function json(url) {
  const r = await fetch(url, {cache:'no-cache', signal:AbortSignal.timeout(12000)});
  if (!r.ok) throw new Error(`Request returned ${r.status}`);
  return r.json();
}
function statusFor(id) {
  const s = view?.stations?.[id];
  const known = s && [s.ebikes,s.pedal_bikes,s.docks_open].every(x => Number.isInteger(x) && x >= 0);
  const fresh = known && isFresh(view.at) && isFresh(s.feed_updated_utc) && isFresh(s.last_reported_utc);
  return {s, known, fresh, live: fresh && source === 'Live feed'};
}
function statusLabel(id) {
  const {s, known, fresh, live} = statusFor(id);
  if (!known) return 'Counts unavailable';
  const age = live ? 'Live' : fresh ? 'Dated observation' : 'Old observation';
  if (!s.is_renting && !s.is_returning) return `${age} · rentals & returns closed`;
  if (!s.is_renting) return `${age} · rentals closed`;
  if (!s.is_returning) return `${age} · returns closed`;
  return age;
}
function countsHTML(id, home = false) {
  const {s, known} = statusFor(id);
  const values = known ? [s.ebikes,s.pedal_bikes,s.docks_open] : ['—','—','—'];
  const labels = ['e-bikes','pedal bikes','open docks'];
  return values.map((v,i) => home ? `<div class="count ${i ? 'secondary' : ''}"><strong>${v}</strong><span>${labels[i]}</span></div>` : `<span><strong>${v}</strong>${labels[i]}</span>`).join('');
}
function renderNow() {
  if (!summary || !view) return;
  const {s, known, live} = statusFor(HOME);
  $('home-counts').innerHTML = countsHTML(HOME, true);
  $('home-message').textContent = !known ? 'We couldn’t get counts for this station.' : !s.is_renting ? 'Rentals were closed at this observation.' : !live ? 'Dated counts — refresh and check before leaving.' : s.ebikes > 0 ? 'An e-bike is showing now. Check again before leaving.' : 'No e-bikes showing. Try a nearby station below.';
  $('home-reported').textContent = known ? `Station reported ${stamp(s.last_reported_utc)} · ${statusLabel(HOME)}` : 'No station report is available.';
  const feedTimes = Object.values(view.stations).map(s => Date.parse(s.feed_updated_utc)).filter(Number.isFinite);
  const oldestFeed = feedTimes.length ? new Date(Math.min(...feedTimes)).toISOString() : null;
  const liveFeed = source === 'Live feed' && isFresh(view.at) && isFresh(oldestFeed);
  $('status-banner').className = `status-banner ${liveFeed ? 'live' : 'warning'}`;
  $('status-banner').textContent = `${source} · observed ${stamp(oldestFeed || view.at)}${liveFeed ? '' : ' · not current live availability'}${fetchNote ? ` · ${fetchNote}` : ''}`;
  const home = summary.stations.find(s => s.station_id === HOME);
  let alternatives = summary.stations.filter(s => NEARBY.includes(s.station_id) && s.station_id !== HOME);
  alternatives.sort((a,b) => {
    if ($('station-sort').value === 'ebikes') {
      const score = x => { const t = statusFor(x.station_id); return t.live && t.s.is_renting ? t.s.ebikes : -1; };
      return score(b)-score(a) || distanceKm(home,a)-distanceKm(home,b);
    }
    return distanceKm(home,a)-distanceKm(home,b);
  });
  $('alternatives').innerHTML = alternatives.map(st => `<article class="station-card"><span class="station-id">STATION ${esc(st.station_id)} · ${Math.round(distanceKm(home,st)*1000)} m straight line</span><h3>${esc(st.name)}</h3><div class="numbers">${countsHTML(st.station_id)}</div><div class="station-foot"><span>${esc(statusLabel(st.station_id))}</span><a href="${mapsURL(st)}">Open in Maps ↗</a></div></article>`).join('');
  renderStationMap();
  if (!$('route-detail').hidden) renderRouteStations(activeRouteStations);
}
function createMap(id, center, zoom) {
  if (!globalThis.L) { $(id).textContent = 'The map could not load. Station details and Maps links are available below.'; return null; }
  const map = L.map(id, {scrollWheelZoom:false}).setView(center,zoom);
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom:19, attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  }).on('tileerror',() => { $('map-note').textContent = 'Street tiles are unavailable. Station markers and the list still work.'; }).addTo(map);
  return map;
}
function popup(st) {
  const box = document.createElement('div');
  const h = document.createElement('strong'); h.textContent = st.name; box.append(h,document.createElement('br'));
  const t = statusFor(st.station_id);
  box.append(document.createTextNode(t.known ? `${t.s.ebikes} e-bikes · ${t.s.pedal_bikes} pedal · ${t.s.docks_open} docks` : 'Counts unavailable'),document.createElement('br'),document.createTextNode(statusLabel(st.station_id)),document.createElement('br'));
  const link = document.createElement('a'); link.href = mapsURL(st); link.textContent = 'Open station in Maps'; box.append(link);
  return box;
}
function renderStationMap() {
  if (!stationMap) {
    stationMap = createMap('station-map',[40.4448,-79.951],15);
    if (!stationMap) return;
    stationLayer = L.layerGroup().addTo(stationMap);
  }
  stationLayer.clearLayers();
  for (const st of summary.stations.filter(s => NEARBY.includes(s.station_id))) {
    const t = statusFor(st.station_id), available = t.live && t.s.is_renting;
    const icon = L.divIcon({className:'', html:`<span class="map-marker ${st.station_id === HOME ? 'home' : ''} ${available ? '' : 'unknown'}">${available ? t.s.ebikes : '?'}</span>`,iconSize:[34,34],iconAnchor:[17,17]});
    L.marker([st.lat,st.lon],{icon,title:`${st.name}: ${available ? t.s.ebikes+' e-bikes' : statusLabel(st.station_id)}`,alt:st.name}).addTo(stationLayer).bindPopup(popup(st));
  }
}
async function refreshLive() {
  if (fetching || !summary) return;
  fetching = true; $('refresh').disabled = true; $('refresh').textContent = 'Refreshing…';
  try {
    const [feed, types] = await Promise.all([json(`${FEED}station_status`),json(`${FEED}vehicle_types`)]);
    const stations = normalizeLive(feed, types);
    view = {at:new Date().toISOString(),stations}; source = 'Live feed'; fetchNote = '';
    if (!isFresh(feed.last_updated)) fetchNote = 'The public feed timestamp is stale or invalid';
    writeStored(STORAGE.status,view);
  } catch {
    if (source === 'Live feed') source = 'Saved live observation';
    fetchNote = navigator.onLine ? 'Live request failed; showing dated counts' : 'Offline; showing dated counts';
  } finally {
    fetching = false; $('refresh').disabled = false; $('refresh').textContent = '↻ Refresh status'; renderNow();
  }
}
function currentCells() { return summary.history[$('history-station').value] || []; }
function cellText(c, day, hour) {
  if (!c) return `${DAYS[day]} ${hour}:00 — no observations.`;
  const kind = $('history-kind').value;
  return `${DAYS[day]} ${hour}:00 — ${percent(c[kind])} observed with ${kind === 'ebike' ? 'an e-bike' : 'any bike'}; ${c.samples} ten-minute samples across ${c.days} distinct dates. ${c.sufficient ? 'Enough samples for an observed pattern; no guarantee.' : 'Insufficient data for a timing recommendation.'}`;
}
function renderHistory() {
  const c = summary.coverage;
  $('coverage').innerHTML = `<div><strong>${c.snapshots.toLocaleString()}</strong><span>logged snapshots · ${stamp(c.first)} onward</span></div><div><strong>${percent(c.recentCoverage)}</strong><span>ten-minute slots in last ${c.recentExpected} slots ending ${stamp(c.last)}</span></div><div><strong>${c.longestGapMinutes} min</strong><span>longest gap in the complete dataset</span></div>`;
  const cells = currentCells(), kind = $('history-kind').value;
  const byKey = new Map(cells.map(x => [`${x.day}:${x.hour}`, x]));
  $('heatmap').innerHTML = `<div class="heatmap"><span></span>${Array.from({length:24},(_,h) => `<span class="hour">${h%3 === 0 ? String(h).padStart(2,'0') : ''}</span>`).join('')}${DAYS.map((day,d) => `<span class="axis">${day.slice(0,3)}</span>${Array.from({length:24},(_,h) => {
    const cell = byKey.get(`${d}:${h}`), style = cell?.sufficient ? `background:hsl(101 28% ${89-cell[kind]*60}%)` : '';
    return `<button class="heat-cell ${cell && !cell.sufficient ? 'thin' : ''}" style="${style}" data-day="${d}" data-hour="${h}" aria-label="${esc(cellText(cell,d,h))}" title="${esc(cellText(cell,d,h))}"></button>`;
  }).join('')}`).join('')}</div>`;
  $('cell-detail').textContent = 'Choose an hour to inspect its samples.';
  $('heatmap').querySelectorAll('button').forEach(b => b.addEventListener('click',() => {
    $('cell-detail').textContent = cellText(byKey.get(`${b.dataset.day}:${b.dataset.hour}`),+b.dataset.day,+b.dataset.hour);
    $('history-day').value = b.dataset.day; renderDaily();
  }));
  const sufficient = cells.filter(x => x.sufficient).sort((a,b) => b[kind]-a[kind]);
  $('recommendation').textContent = sufficient.length ? `Among sufficiently sampled hours, ${DAYS[sufficient[0].day]} at ${sufficient[0].hour}:00 had ${percent(sufficient[0][kind])} observed availability (${sufficient[0].days} distinct dates). Tap an hour for its samples; availability can change.` : 'Still collecting data. There aren’t enough repeated weekdays to suggest a departure time yet.';
  renderDaily();
}
function renderDaily() {
  const cells = currentCells().filter(c => c.day === +$('history-day').value), kind = $('history-kind').value;
  const bars = Array.from({length:24},(_,h) => {
    const cell = cells.find(c => c.hour === h), x = 46+h*27, height = cell ? cell[kind]*140 : 0;
    return `<g><title>${esc(cellText(cell,+$('history-day').value,h))}</title>${cell ? `<rect x="${x}" y="${170-height}" width="17" height="${Math.max(1,height)}" rx="2" fill="${cell.sufficient ? '#3f6943' : 'url(#thin)'}" stroke="${cell.sufficient ? '#3f6943' : '#7d8d6c'}"/>` : `<text x="${x+8}" y="169" text-anchor="middle" fill="#859078" font-size="10">—</text>`}<text x="${x+8}" y="190" text-anchor="middle" fill="#66715d" font-size="9">${h}</text></g>`;
  }).join('');
  $('daily-chart').innerHTML = `<svg viewBox="0 0 710 215" role="img" aria-label="Hourly observed bike availability on ${DAYS[+$('history-day').value]}; hatched bars have insufficient data"><defs><pattern id="thin" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="6" height="6" fill="#f1f3e6"/><rect width="2" height="6" fill="#bbc9a6"/></pattern></defs>${[0,50,100].map(n => `<line x1="42" x2="704" y1="${170-n*1.4}" y2="${170-n*1.4}" stroke="#dfe4d5"/><text x="35" y="${174-n*1.4}" text-anchor="end" font-size="10" fill="#6f7a63">${n}%</text>`).join('')}${bars}<text x="370" y="211" text-anchor="middle" font-size="10" fill="#6f7a63">Hour in Pittsburgh · hatched = insufficient data · — = no data</text></svg>`;
  const table = document.createElement('details');
  table.innerHTML = `<summary>Read the hourly sample details</summary><div>${Array.from({length:24},(_,h) => `<p class="small">${esc(cellText(cells.find(c => c.hour === h),+$('history-day').value,h))}</p>`).join('')}</div>`;
  $('daily-chart').append(table);
}
function parseGPX(text, filename) {
  if (text.length > 5000000 || /<!DOCTYPE|<!ENTITY/i.test(text)) throw new Error('Use a GPX file under 5 MB without XML entities.');
  const doc = new DOMParser().parseFromString(text,'application/xml');
  if (doc.querySelector('parsererror') || doc.documentElement.localName !== 'gpx') throw new Error('This is not a valid GPX file.');
  const segments = [...doc.getElementsByTagNameNS('*','trkseg')].filter(s => s.getElementsByTagNameNS('*','trkpt').length);
  const routes = [...doc.getElementsByTagNameNS('*','rte')].filter(s => s.getElementsByTagNameNS('*','rtept').length);
  if (segments.length + routes.length !== 1) throw new Error('Import a single continuous track segment or route. Multiple segments could hide gaps.');
  const container = segments[0] || routes[0], tag = segments.length ? 'trkpt' : 'rtept';
  const points = [...container.getElementsByTagNameNS('*',tag)].map(p => [p.hasAttribute('lat') ? Number(p.getAttribute('lat')) : NaN,p.hasAttribute('lon') ? Number(p.getAttribute('lon')) : NaN]);
  const name = (doc.getElementsByTagNameNS('*','name')[0]?.textContent || filename.replace(/\.gpx$/i,'')).slice(0,120);
  const route = {name,points};
  if (!validateRoute(route)) throw new Error('The GPX needs 2–50,000 valid latitude/longitude points.');
  return route;
}
function download(name, text, type) {
  const url = URL.createObjectURL(new Blob([text],{type}));
  const a = document.createElement('a'); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url),1000);
}
function routeArt(route) {
  if (!validateRoute(route)) return esc(route.symbol);
  const xs=route.points.map(p => p[1]*Math.cos(route.points[0][0]*Math.PI/180)),ys=route.points.map(p => p[0]);
  const minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys);
  const scale=Math.min(240/(maxX-minX || 1),86/(maxY-minY || 1));
  const x=value => 150+(value-(minX+maxX)/2)*scale, y=value => 65-(value-(minY+maxY)/2)*scale;
  const path=xs.map((value,i) => `${i ? 'L' : 'M'}${x(value).toFixed(1)},${y(ys[i]).toFixed(1)}`).join(' ');
  return `<svg viewBox="0 0 300 130" aria-hidden="true"><path d="${path}" fill="none" stroke="currentColor" stroke-width="4" stroke-linejoin="round"/><circle cx="${x(xs[0])}" cy="${y(ys[0])}" r="6" fill="white" stroke="currentColor" stroke-width="3"/></svg>`;
}
function renderRoutes() {
  $('route-options').innerHTML=[...proposals,...imported].map(r => `<option>${esc(r.name)}</option>`).join('');
  $('route-library').innerHTML = proposals.map((r,i) => {
    const hasTrack=validateRoute(r),time=hasTrack ? movingMinutes(r) : null;
    return `<article class="route-card"><div class="route-art ${r.kind}" aria-hidden="true">${routeArt(r)}</div><div class="content"><span class="badge ${r.status === 'map-reviewed' ? 'reviewed' : ''}">${r.status === 'map-reviewed' ? 'MAP REVIEWED' : 'DRAFT · MAP CHECK PENDING'}</span><h2>${esc(r.name)}</h2><p>${esc(r.description)}</p>${hasTrack ? `<div class="route-metrics"><strong>${routeDistance(r).toFixed(1)} km</strong><span>${time.min}–${time.max} min moving</span><span>~${Math.round(r.ascentMeters)} m climb</span></div><p class="small">Start & finish: station ${esc(r.startStationId)} · campus travel excluded</p>` : ''}<button class="button outline" data-proposal="${i}">Choose ride ↗</button></div></article>`;
  }).join('') + imported.map((r,i) => `<article class="route-card"><div class="route-art" aria-hidden="true">${routeArt(r)}</div><div class="content"><span class="badge">IMPORTED GPX · NOT PATH-VERIFIED</span><h2>${esc(r.name)}</h2><p>${routeDistance(r).toFixed(1)} km of imported geometry · ${r.points.length.toLocaleString()} points</p><button class="button outline" data-imported="${i}">Review & export ↗</button></div></article>`).join('');
  $('route-library').querySelectorAll('[data-proposal]').forEach(b => b.addEventListener('click',() => showRoute(proposals[+b.dataset.proposal],false)));
  $('route-library').querySelectorAll('[data-imported]').forEach(b => b.addEventListener('click',() => showRoute(imported[+b.dataset.imported],true)));
}
function showRoute(route, isImported) {
  if (routeMap) { routeMap.remove(); routeMap = null; }
  routeStationLayer=null;
  const panel = $('route-detail'); panel.hidden = false;
  const hasTrack=validateRoute(route),time=hasTrack ? movingMinutes(route) : null;
  const quickNotes={schenley:'Hilly park roads · e-bike recommended. Follow one-way signs.',eliza:'Mostly flat trail · allow extra time to dock within 30 minutes.', 'river-loop':'Busy streets and a railway crossing. Plan a dock stop: this ride can exceed 30 minutes.'};
  panel.innerHTML = `<p class="eyebrow">${isImported ? 'IMPORTED · UNVERIFIED' : route.status === 'map-reviewed' ? 'MAP REVIEWED · NOT FIELD RIDDEN' : 'DRAFT · MAP REVIEW PENDING'}</p><h2 tabindex="-1" id="route-detail-title">${esc(route.name)}</h2>${hasTrack ? `<p class="route-detail-metrics">${routeDistance(route).toFixed(1)} km · ${time.min}–${time.max} min moving${!isImported ? ` · ~${Math.round(route.ascentMeters)} m climb` : ''}</p>` : ''}<p class="notice">${isImported ? 'Imported track: bicycle access has not been checked.' : esc(quickNotes[route.id] || route.rentalNote)}</p><div id="route-map" class="route-detail-map" aria-label="Route track and nearby stations"></div><div class="actions" id="route-actions"></div><div id="route-stations"></div>${!isImported ? `<details class="route-notes"><summary>Route notes & directions</summary><p>${esc(route.terrain)}</p><p>${esc(route.bikeAdvice)}</p><p>${esc(route.rentalNote)}</p><p class="small">Moving time assumes 12–18 km/h. Allow extra for hills, crossings, stops, and travel from campus.</p><ol class="route-overview">${route.overview.map(s => `<li>${esc(s)}</li>`).join('')}</ol><ul class="route-cautions">${route.cautions.map(s => `<li>${esc(s)}</li>`).join('')}</ul></details>` : ''}<details class="route-sources"><summary>Map review & sources</summary><div id="route-evidence" class="small"></div></details>`;
  const back=document.createElement('button');back.className='button outline route-back';back.textContent='← All routes';
  back.addEventListener('click',() => {
    if(routeMap) routeMap.remove();routeMap=null;routeStationLayer=null;activeRouteStations=[];panel.hidden=true;
    $('route-library').hidden=false;
    $('routes-title').tabIndex=-1;$('routes-title').focus({preventScroll:true});$('routes-title').scrollIntoView({behavior:'instant',block:'start'});
  });
  panel.prepend(back);
  $('route-library').hidden=true;
  const navigation=document.createElement('section');navigation.className='route-navigation';navigation.id='route-navigation';
  $('route-actions').after(navigation);mountRouteNavigation(navigation,route,{isImported});
  const follow=document.createElement('button');follow.className='button primary route-follow';follow.textContent='Follow ride ↓';
  follow.addEventListener('click',() => {const heading=navigation.querySelector('h3');heading.tabIndex=-1;heading.focus({preventScroll:true});navigation.scrollIntoView({behavior:'instant',block:'start'});});
  back.after(follow);
  if(hasTrack) {
    routeMap = createMap('route-map',route.points[0],14);
    if(routeMap) {
      const line=L.polyline(route.points,{color:'#335d3d',weight:5}).addTo(routeMap); routeMap.fitBounds(line.getBounds(),{padding:[24,24]});
      routeStationLayer=L.layerGroup().addTo(routeMap);
      addRouteDirection(route);
      const startIcon=L.divIcon({className:'',html:'<span class="route-start">S</span>',iconSize:[28,28],iconAnchor:[14,14]});
      const first=route.points[0],last=route.points.at(-1),closed=distanceKm({lat:first[0],lon:first[1]},{lat:last[0],lon:last[1]})<.025;
      L.marker(first,{icon:startIcon,title:closed ? 'Start and finish' : 'Start'}).addTo(routeMap).bindTooltip(closed ? 'Start / finish' : 'Start');
      if(!closed) L.circleMarker(last,{radius:7,color:'#a0612f'}).addTo(routeMap).bindTooltip('Finish');
      for(const checkpoint of (route.checkpoints || []).slice(1,-1)) L.circleMarker([checkpoint.lat,checkpoint.lon],{radius:5,color:'#a0612f',fillOpacity:.8}).addTo(routeMap).bindTooltip(checkpoint.name);
    }
  }
  if (isImported) {
    panel.querySelector('.route-sources').hidden=true;
    const button = document.createElement('button'); button.className = 'button primary'; button.textContent = 'Export GPX';
    button.addEventListener('click',() => download('pogoh-route.gpx',gpxXML(route),'application/gpx+xml')); $('route-actions').append(button);
    const remove = document.createElement('button'); remove.className = 'button outline'; remove.textContent = 'Remove imported route';
    remove.addEventListener('click',() => {
      if (!confirm('Remove this imported route from this browser? Export GPX first if you want a backup.')) return;
      imported = imported.filter(r => r !== route); writeStored(STORAGE.routes,imported);
      if (routeMap) {routeMap.remove();routeMap=null;} panel.hidden=true; $('route-library').hidden=false; renderRoutes();
    });
    $('route-actions').append(remove);
    const note = document.createElement('p'); note.className = 'small'; note.textContent = 'Export keeps track points; elevation, timestamps, and turn instructions are omitted.'; panel.append(note);
    const near = nearbyRouteStations(route,summary.stations);
    renderRouteStations(near);
  } else {
    if(!hasTrack) {routeMap=createMap('route-map',[route.destination.lat,route.destination.lon],14);}
    if(hasTrack && route.status === 'map-reviewed') {
      const exportLink=document.createElement('a'); exportLink.className='button primary'; exportLink.href=`routes/${route.id}.gpx`; exportLink.download=`pogoh-${route.id}.gpx`; exportLink.textContent='Download GPX'; $('route-actions').prepend(exportLink);
    }
    const stations=hasTrack ? nearbyRouteStations(route,summary.stations) : summary.stations.filter(s => route.stationIds.includes(s.station_id));
    renderRouteStations(stations);
    const sources=(route.sources || []).map(s => `<a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.label)} ↗</a>`).join(' · ');
    $('route-evidence').innerHTML=`<p>${route.status === 'map-reviewed' ? 'Reviewed against maps and routing access tags; no field ride has been completed. Current closures and signs take precedence.' : 'Draft geometry; export is withheld until map review is recorded.'}</p><p>Climb is a filtered terrain-model estimate, not a measured ride. GPX keeps the plotted track; a Maps place link lets Apple choose a different path. Phone import and Watch sync were reported working; this track’s turns and haptics still need checking.</p><p>${sources}</p>${route.source ? `<p>${esc(route.source.attribution)} · <a href="${esc(route.source.url)}" target="_blank" rel="noopener">BRouter source ↗</a> · <a href="${esc(route.source.license)}">Data license</a></p>` : ''}`;
  }
  $('route-detail-title').focus({preventScroll:true});
  panel.scrollIntoView({behavior:'instant',block:'start'});
}
function addRouteDirection(route) {
  const intervals=[.15,.4,.7,.9],total=routeDistance(route);
  let distance=0,next=0;
  for(let i=1;i<route.points.length && next<intervals.length;i++) {
    const a=route.points[i-1],b=route.points[i];
    distance+=distanceKm({lat:a[0],lon:a[1]},{lat:b[0],lon:b[1]});
    if(distance<total*intervals[next]) continue;
    const angle=Math.atan2(-(b[0]-a[0]),(b[1]-a[1])*Math.cos(a[0]*Math.PI/180))*180/Math.PI;
    const icon=L.divIcon({className:'',html:`<span class="route-arrow" style="transform:rotate(${angle}deg)">➤</span>`,iconSize:[22,22],iconAnchor:[11,11]});
    L.marker(b,{icon,interactive:false,keyboard:false}).addTo(routeMap);next++;
  }
}
function renderRouteStations(stations) {
  activeRouteStations = stations;
  if(routeStationLayer) {
    routeStationLayer.clearLayers();
    for(const station of stations) L.circleMarker([station.lat,station.lon],{radius:4,color:'#965628',fillColor:'#fff',fillOpacity:1}).addTo(routeStationLayer).bindPopup(popup(station));
  }
  $('route-stations').innerHTML = `<h3>Stations near this route</h3><p class="small">In ride order · straight-line distance from track. Check docks before returning.</p>${stations.length ? stations.map(s => {const t = statusFor(s.station_id);return `<article class="route-station"><a href="${mapsURL(s)}">${esc(s.name)}</a>${s.proximity ? `<span class="small">${s.proximity.startFinish ? 'Start / finish' : `First pass: ${s.proximity.alongKm.toFixed(1)} km`} · ~${Math.round(s.proximity.distanceKm*1000)} m from track</span>` : ''}<span>${t.known ? `${t.s.ebikes} e-bikes · ${t.s.pedal_bikes} pedal · ${t.s.docks_open} docks` : 'Counts unavailable'}</span><span class="small">${esc(statusLabel(s.station_id))}</span></article>`;}).join('') : '<p class="small">No stations found within 300 m of this route.</p>'}`;
}
function persistRides() {
  if (!rideStorageBlocked) writeStored(STORAGE.rides,rides);
  renderRides();
}
function renderRides() {
  $('storage-note').textContent = storageAvailable ? 'Saved in this browser only. Backups let you move rides between devices.' : storageProblem || 'Storage unavailable. Records are held in memory; export before closing.';
  const today = localParts(Date.now()).date, noon = new Date(`${today}T12:00:00Z`);
  const monday = new Date(noon); monday.setUTCDate(noon.getUTCDate()-((noon.getUTCDay()+6)%7));
  const weekStart = monday.toISOString().slice(0,10);
  const week = rides.filter(r => r.date >= weekStart && r.date <= today);
  $('ride-stats').innerHTML = `<div><strong>${week.length}</strong><span>rides this week · Monday to today</span></div><div><strong>${week.reduce((n,r) => n+r.minutes,0)}</strong><span>minutes this week</span></div><div><strong>${rides.length}</strong><span>rides in this browser</span></div>`;
  const sorted = rides.map((r,i) => ({...r,index:i})).sort((a,b) => b.date.localeCompare(a.date));
  $('ride-list').innerHTML = sorted.length ? sorted.map(r => `<article class="ride-entry"><h3>${esc(r.route)}</h3><p class="small">${esc(r.date)} · ${esc(r.bike)} · ${r.minutes} min</p>${r.notes ? `<p>${esc(r.notes)}</p>` : ''}<button class="remove" data-remove="${r.index}">Delete ride</button></article>`).join('') : '<p class="empty">Your next ride is a good place to start.</p>';
  $('ride-list').querySelectorAll('[data-remove]').forEach(b => b.addEventListener('click',() => {
    if (confirm('Delete this ride from this browser? Export a backup first if you want to keep it.')) { rides.splice(+b.dataset.remove,1); persistRides(); }
  }));
}
function navigate() {
  const page = ['now','times','routes','log'].includes(location.hash.slice(1)) ? location.hash.slice(1) : 'now';
  document.querySelectorAll('.page').forEach(el => { el.hidden = el.id !== `page-${page}`; });
  document.querySelectorAll('[data-page]').forEach(el => {if (el.dataset.page === page) el.setAttribute('aria-current','page'); else el.removeAttribute('aria-current');});
  if (page === 'now' && stationMap) requestAnimationFrame(() => stationMap.invalidateSize());
  if (page === 'routes' && routeMap) requestAnimationFrame(() => routeMap.invalidateSize());
  if (page === 'log') renderRides();
}
async function start() {
  [summary,proposals] = await Promise.all([json('data/summary.json'),json('routes.json')]);
  if (summary.schema !== 1 || !summary.stations?.length || !summary.latest?.stations) throw new Error('Snapshot data has an unsupported format.');
  view = summary.latest;
  const savedStatus = readStored(STORAGE.status);
  if (savedStatus?.stations && Date.parse(savedStatus.at) > Date.parse(view.at) && Date.parse(savedStatus.at) <= Date.now()+60000) {view = savedStatus; source = 'Saved live observation';}
  const savedRides = readStored(STORAGE.rides);
  try { rides = validateRides(savedRides || []); } catch { storageAvailable = false; rideStorageBlocked = true; storageProblem = 'Saved ride records are invalid. The stored copy is preserved. New records stay in memory; export before closing.'; }
  const savedRoutes = readStored(STORAGE.routes);
  if (Array.isArray(savedRoutes)) imported = savedRoutes.filter(validateRoute).slice(0,20);
  $('history-station').innerHTML = `<option value="nearby">Nearby group · 5 stations</option>${HISTORY_IDS.map(id => `<option value="${id}">${esc(summary.stations.find(s => s.station_id === id)?.name || id)}</option>`).join('')}`;
  $('history-station').value = HOME;
  $('history-day').value = localParts(Date.now()).day;
  $('ride-date').value = localParts(Date.now()).date;
  mountNavigationGuide($('navigation-guide'));
  renderNow(); renderHistory(); renderRoutes(); renderRides(); navigate();
  $('refresh').addEventListener('click',refreshLive);
  $('station-sort').addEventListener('change',renderNow);
  ['history-station','history-kind'].forEach(id => $(id).addEventListener('change',renderHistory));
  $('history-day').addEventListener('change',renderDaily);
  window.addEventListener('hashchange',navigate);
  document.addEventListener('visibilitychange',() => {if (!document.hidden) {renderNow();refreshLive();}});
  window.addEventListener('online',refreshLive);
  window.addEventListener('offline',() => {if(source === 'Live feed') source = 'Saved live observation';fetchNote='Offline';renderNow();});
  $('ride-form').addEventListener('submit',event => {
    event.preventDefault();
    try {
      const record = validateRides([{date:$('ride-date').value, route:$('ride-route').value.trim(), bike:$('ride-bike').value, minutes:Number($('ride-minutes').value), notes:$('ride-notes').value.trim()}])[0];
      if (!record.route) throw new Error('Add a route name.');
      rides.push(record); persistRides(); $('ride-notes').value = ''; $('ride-minutes').value = '';
    } catch (e) { $('storage-note').textContent = e.message; }
  });
  $('export-rides').addEventListener('click',() => download(`pogoh-rides-${localParts(Date.now()).date}.json`,JSON.stringify(rides,null,2),'application/json'));
  $('import-rides').addEventListener('change',async event => {
    const file = event.target.files[0]; if (!file) return;
    try {
      if(file.size > 5000000) throw new Error('Use a JSON file under 5 MB.');
      const incoming = validateRides(JSON.parse(await file.text())), before = rides.length;
      const merged = mergeRides(rides,incoming);
      if (merged.length > 10000) throw new Error('The combined log exceeds 10,000 rides. Export and archive older rides first.');
      rides = merged; persistRides(); $('storage-note').textContent = `Imported ${rides.length-before} new rides. ${storageAvailable ? 'Saved in this browser.' : storageProblem}`;
    } catch (e) { $('storage-note').textContent = e.message; }
    event.target.value = '';
  });
  $('gpx-import').addEventListener('change',async event => {
    const file = event.target.files[0]; if (!file) return;
    try {
      if (imported.length >= 20) throw new Error('This browser already holds 20 imported routes. Export your routes before clearing site data.');
      if (file.size > 5000000) throw new Error('Use a GPX file under 5 MB.');
      const route = parseGPX(await file.text(),file.name); imported.push(route);
      const saved = writeStored(STORAGE.routes,imported); renderRoutes(); showRoute(route,true);
      $('route-status').textContent = `Imported ${route.name}. Inspect the geometry and crossings before riding. ${saved ? 'Saved in this browser; export GPX for a backup.' : 'Storage is unavailable; export GPX before closing.'}`;
    } catch (e) { $('route-status').textContent = e.message; }
    event.target.value = '';
  });
  refreshLive();
  setInterval(() => {renderNow(); if (!document.hidden) refreshLive();},60000);
  setupUpdates(navigator,window,$('app-update'),$('apply-update'));
}
start().catch(error => {
  $('fatal').hidden = false; $('fatal').className = 'notice error';
  $('fatal').textContent = `The companion could not load. ${error.message} Serve the companion folder over HTTP and generate data/summary.json with the builder.`;
  $('status-banner').textContent = 'Station status is unavailable. Check POGOH directly.';
});
