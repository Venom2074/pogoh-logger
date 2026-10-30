// Shared, dependency-free data rules used by the browser, builder, and tests.
export const HOME = '59';
export const NEARBY = ['59', '29', '33', '12', '11'];
export const HISTORY_IDS = [...NEARBY, '49', '50', '51', '2'];
export const MAX_AGE = 20 * 60 * 1000;
const localClock = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit',
  weekday: 'short', hour: '2-digit', hourCycle: 'h23',
});
export function localParts(time) {
  const p = Object.fromEntries(localClock.formatToParts(new Date(time)).map(x => [x.type, x.value]));
  return {date: `${p.year}-${p.month}-${p.day}`, day: ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].indexOf(p.weekday), hour: +p.hour};
}
export function parseCSV(text) {
  const rows = []; let row = [], value = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (quoted && text[i + 1] === '"') { value += '"'; i++; }
      else quoted = !quoted;
    } else if (!quoted && (c === ',' || c === '\n')) {
      row.push(value.replace(/\r$/, '')); value = '';
      if (c === '\n') { rows.push(row); row = []; }
    } else value += c;
  }
  if (quoted) throw new Error('Unclosed CSV quote');
  if (value || row.length) { row.push(value.replace(/\r$/, '')); rows.push(row); }
  const header = rows.shift() || [];
  return rows.filter(r => r.length === header.length).map(r => Object.fromEntries(header.map((k, i) => [k, r[i]])));
}
export function isFresh(time, now = Date.now()) {
  const stamp = Date.parse(time);
  return Number.isFinite(stamp) && now - stamp <= MAX_AGE && stamp - now <= 60000;
}
function count(value) { return Number.isInteger(value) && value >= 0; }
export function normalizeLive(feed, types) {
  if (!Array.isArray(feed?.data?.stations) || !Array.isArray(types?.data?.vehicle_types)) throw new Error('Invalid feed');
  const kinds = new Map(types.data.vehicle_types.map(t => [t.vehicle_type_id,
    t.form_factor !== 'bicycle' ? 'other' : t.propulsion_type === 'human' ? 'pedal_bikes' :
      ['electric_assist', 'electric'].includes(t.propulsion_type) ? 'ebikes' : 'other']));
  return Object.fromEntries(feed.data.stations.map(s => {
    if (!Array.isArray(s.vehicle_types_available) || !count(s.num_docks_available)) throw new Error('Missing station counts');
    const result = {ebikes: 0, pedal_bikes: 0, docks_open: s.num_docks_available,
      is_renting: s.is_renting === true && s.is_installed !== false,
      is_returning: s.is_returning === true && s.is_installed !== false,
      last_reported_utc: s.last_reported, feed_updated_utc: feed.last_updated};
    for (const v of s.vehicle_types_available) {
      if (!count(v.count)) throw new Error('Invalid vehicle count');
      const kind = kinds.get(v.vehicle_type_id);
      if (kind && kind !== 'other') result[kind] += v.count;
    }
    return [String(s.station_id), result];
  }));
}
function historicalRow(row, snapshot) {
  const values = ['ebikes','pedal_bikes','docks_open'].map(k => row[k] === '' ? NaN : Number(row[k]));
  if (!values.every(count) || !['0','1'].includes(row.is_renting) || !['0','1'].includes(row.is_returning)) return null;
  if (!isFresh(row.feed_updated_utc, snapshot) || !isFresh(row.last_reported_utc, snapshot)) return null;
  return {...row, ebikes: values[0], pedal_bikes: values[1], docks_open: values[2],
    is_renting: row.is_renting === '1', is_returning: row.is_returning === '1'};
}
function cellsFor(observations) {
  const cells = new Map();
  for (const {time, ebikes, any} of observations) {
    const p = localParts(time), key = `${p.day}:${p.hour}`;
    if (!cells.has(key)) cells.set(key, {day: p.day, hour: p.hour, dates: new Map()});
    const cell = cells.get(key);
    if (!cell.dates.has(p.date)) cell.dates.set(p.date, []);
    cell.dates.get(p.date).push({ebikes, any});
  }
  return [...cells.values()].map(c => {
    const daily = [...c.dates.values()].map(values => ({
      ebike: values.filter(v => v.ebikes > 0).length / values.length,
      any: values.filter(v => v.any > 0).length / values.length,
      mean: values.reduce((s, v) => s + v.ebikes, 0) / values.length,
    }));
    const samples = [...c.dates.values()].reduce((s, v) => s + v.length, 0);
    const mean = key => Math.round(daily.reduce((s, v) => s + v[key], 0) / daily.length * 1000) / 1000;
    return {day: c.day, hour: c.hour, samples, days: daily.length,
      ebike: mean('ebike'), any: mean('any'), meanEbikes: mean('mean'),
      sufficient: daily.length >= 3 && samples >= 6};
  }).sort((a, b) => a.day - b.day || a.hour - b.hour);
}
export function summarize(rows, stations, now = new Date().toISOString()) {
  const snapshots = new Map();
  for (const r of rows) {
    const time = Date.parse(r.snapshot_utc);
    if (!Number.isFinite(time) || time > Date.parse(now) + 60000) continue;
    if (!snapshots.has(time)) snapshots.set(time, new Map());
    snapshots.get(time).set(String(r.station_id), r);
  }
  const times = [...snapshots.keys()].sort((a,b) => a-b);
  if (!times.length) throw new Error('No valid snapshots to build');
  // Use one snapshot per UTC ten-minute slot; fallback Actions runs cannot inflate samples.
  const slots = new Map(times.map(t => [Math.floor(t / 600000), t]));
  const observations = Object.fromEntries([...HISTORY_IDS, 'nearby'].map(id => [id, []]));
  let discarded = 0;
  for (const time of slots.values()) {
    const valid = new Map();
    for (const [id, row] of snapshots.get(time)) {
      const result = historicalRow(row, time);
      if (result) valid.set(id, result); else discarded++;
    }
    for (const id of HISTORY_IDS) {
      const s = valid.get(id);
      if (s) observations[id].push({time, ebikes: s.is_renting ? s.ebikes : 0,
        any: s.is_renting ? s.ebikes + s.pedal_bikes : 0});
    }
    // Require simultaneous valid observations from EVERY group member.
    if (NEARBY.every(id => valid.has(id))) observations.nearby.push({time,
      ebikes: NEARBY.reduce((n,id) => n + (valid.get(id).is_renting ? valid.get(id).ebikes : 0), 0),
      any: NEARBY.reduce((n,id) => n + (valid.get(id).is_renting ? valid.get(id).ebikes + valid.get(id).pedal_bikes : 0), 0)});
  }
  const last = times.at(-1), first = times[0];
  const latest = Object.fromEntries([...snapshots.get(last)].map(([id,row]) => [id, {
    ...row, ebikes: row.ebikes === '' ? null : +row.ebikes, pedal_bikes: row.pedal_bikes === '' ? null : +row.pedal_bikes,
    docks_open: row.docks_open === '' ? null : +row.docks_open,
    is_renting: row.is_renting === '1', is_returning: row.is_returning === '1',
  }]));
  const gaps = times.slice(1).map((t,i) => (t-times[i])/60000);
  const recent = [...slots.keys()].filter(s => s > Math.floor(last/600000)-144);
  const expected = Math.min(144, Math.floor(last/600000)-Math.floor(first/600000)+1);
  return {schema: 1, builtAt: now, home: HOME, nearby: NEARBY, stations,
    latest: {at: new Date(last).toISOString(), stations: latest},
    coverage: {first: new Date(first).toISOString(), last: new Date(last).toISOString(), snapshots: times.length,
      tenMinuteSlots: slots.size, recentSlots: recent.length, recentExpected: expected,
      recentCoverage: recent.length/expected, longestGapMinutes: Math.round(gaps.reduce((max,n) => Math.max(max,n),0)), discarded},
    history: Object.fromEntries(Object.entries(observations).map(([id, values]) => [id, cellsFor(values)]))};
}
export function distanceKm(a,b) {
  const rad = d => d * Math.PI / 180, p = rad(b.lat-a.lat), q = rad(b.lon-a.lon);
  const v = Math.sin(p/2)**2 + Math.cos(rad(a.lat))*Math.cos(rad(b.lat))*Math.sin(q/2)**2;
  return 6371 * 2 * Math.atan2(Math.sqrt(v), Math.sqrt(1-v));
}
export function validateRides(value) {
  if (!Array.isArray(value) || value.length > 10000) throw new Error('Expected an array of at most 10,000 rides.');
  return value.map(r => {
    if (!r || typeof r !== 'object' || typeof r.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(r.date) ||
        !Number.isFinite(Date.parse(r.date)) || new Date(r.date).toISOString().slice(0,10) !== r.date ||
        typeof r.route !== 'string' || r.route.length > 120 || !['E-bike','Pedal bike'].includes(r.bike) ||
        !Number.isFinite(r.minutes) || r.minutes <= 0 || r.minutes > 1440 ||
        typeof r.notes !== 'string' || r.notes.length > 2000) throw new Error('A ride has invalid fields. No records were imported.');
    return {date: r.date, route: r.route, bike: r.bike, minutes: r.minutes, notes: r.notes};
  });
}
export function mergeRides(current, incoming) {
  return [...new Map([...validateRides(current), ...validateRides(incoming)].map(r => [JSON.stringify(r), r])).values()];
}
