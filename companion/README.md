# POGOH companion

A local-first, static phone dashboard. No build framework, runtime backend,
API keys, paid services, or additional accounts. The existing logger, Actions
workflow, and Azure resources are unchanged.

## Run and regenerate

Node.js 22+ is enough; there is nothing to install.

```powershell
node tools/build-companion.mjs
node tools/serve-companion.mjs
```

Open <http://127.0.0.1:8765>. The server binds only to this computer. Stop it
with Ctrl+C. Opening `index.html` directly does not support module loading.

For an optional same-Wi-Fi iPhone preview, stop the normal server and run
`npm run preview:phone`. Open the printed Wi-Fi adapter address in Safari.
This explicitly enables local-network access; it does not publish the app.
HTTP preview uses GPX downloads rather than native file sharing/offline app
caching. See the [phone/Watch test guide](NAVIGATION.md) for the full procedure.

The default builder reads the checkout's `data/` directory. To read the latest
public GitHub CSVs without changing that directory, run:

```powershell
node tools/build-companion.mjs --remote
```

The builder discovers **all** monthly CSVs and writes
`companion/data/summary.json`, including provenance and build time. Review and
commit that generated file alongside any app publication. A separate Pages
workflow is prepared locally, pending hosting approval. It rebuilds on app
changes and after successful logger runs started in minutes 00–09 of each hour.
Charts stay dated; live station counts refresh independently. In a restricted Codex sandbox, remote reads and
the localhost server/check may need network approval.

```powershell
node --test tests/*.test.mjs
```

## Screens and data rules

- **Ride now:** station 59 is home. Backups 29, 11, 33, and 12 are compared by
  straight-line distance, explicitly not walking route length. POGOH GBFS v3
  status and vehicle-type feeds are fetched directly by the browser every
  minute while visible. Scooters are excluded. Counts and rental/return status
  are separate. Unknown data is never rendered as zero.
- **Freshness:** the feed timestamp, per-station report, and observation must
  each be at most 20 minutes old, with at most 1 minute of clock skew into the
  future. Failed requests use a labeled saved live observation or bundled CSV
  snapshot. Old counts remain dated, and map markers use `?` instead of an
  apparent current count. Reopening the app rechecks freshness.
- **Best times:** home, each backup, stations 49/50/51/2, and a combined nearby
  group. E-bike availability and any-bike availability are separate. One
  snapshot per UTC ten-minute slot limits extra sampling from fallback runs;
  the newest snapshot in a slot wins. Missing stations in that snapshot remain
  missing. The group requires simultaneous valid observations of all five
  members. Invalid counts and stale feed/station timestamps are excluded.
- **Time:** Node/browser `Intl` uses `America/New_York`, including daylight
  saving. Every date is equally weighted within a weekday/hour cell. Repeated
  autumn hours add observations to the same date; spring's missing hour is not
  filled. A cell needs at least 3 distinct dates and 6 observations to receive a
  highlighted pattern. Consecutive snapshots are not treated as independent
  evidence of many days. This threshold is a conservative UI rule, not a
  statistical confidence interval.
- **Coverage:** recent coverage is occupied UTC ten-minute slots in the last
  144 slots **ending at the newest logged snapshot**, or the shorter observed
  span. It is not a claim about the present, per-station completeness, or feed
  freshness. The timestamp is visible. The longest gap covers the entire
  dataset, including the sparse period before Azure.
- **Routes:** three map-reviewed starter tracks with GPX downloads, horizontal
  distance, rough moving time, filtered climb estimates, direction arrows,
  route notes, and nearby station counts. Map review is explicitly distinct
  from a field ride or current closure check. The rides start at stations 33,
  2, and 49; travel from campus is excluded. Station proximity is calculated to
  line segments and ordered by first pass; it does not establish an accessible
  docking detour. Rental/return operating status and freshness are visible.
  See [route review](ROUTE_REVIEW.md) for evidence and maintenance.
  Imported GPX files remain unverified. Multi-segment files are rejected so gaps
  are not silently joined. Limits: 5 MB, 50,000 points, 20 local routes. Imported
  exports keep horizontal points and discard elevation/timestamps/instructions;
  built-in downloads retain their modeled elevations and source attribution.
- **Ride log:** date, route, bike, minutes, notes, weekly count, and total.
  `localStorage` only; JSON export/import is validated, merges atomically, and
  skips exact duplicates. Invalid imports leave current records intact. Storage
  failure falls back to memory with an export warning. An invalid stored ride
  array is preserved rather than overwritten. The log never syncs automatically.

## Publishing proposal — approval still required

Use the existing public repository's GitHub Pages with an independently
dispatched Pages workflow, serving only `companion/`. That avoids deploying
Azure source or raw monthly CSVs as website files and keeps snapshot logging
independent. Before enabling anything:

1. Review the map-checked starter routes and finish the device tests below.
2. Review the local app and generated summary, then approve pushing the app and
   changing Pages settings/adding the deployment workflow.
3. Publish the folder as a Pages artifact; regenerate its summary before each
   deployment. The deployed site will be public. Personal ride records and
   imported routes remain browser-local, outside the repository and artifact.
4. Verify the actual HTTPS URL on the iPhone, live-feed CORS, path-relative
   assets, service-worker scope, downloads, and the Maps handoff.

The publishing workflow is prepared at `.github/workflows/pages.yml`; it has
not been pushed or enabled. GitHub Pages configuration/publication still needs
approval. See [publishing](PUBLISHING.md). Do not
add a paid proxy if the public feed stops allowing browser access; show dated
snapshots and investigate first.

## Offline and installation

The manifest supports home-screen launch. Safari: Share → Add to Home Screen
on the eventual HTTPS deployment. The service worker caches only same-origin
app assets and the dated summary, using network-first requests. It never caches
GBFS responses or third-party street tiles. Built-in GPX files are cached with
the app for offline downloads after installation. Ride records and imported routes
are local. Street maps and live status need connectivity. Clearing site data
removes local records and routes; export them first. When changing the shell,
bump the cache version in `sw.js`. An available update shows an Update button;
activation waits for a tap so an unfinished form is not interrupted. Refresh
once to discover the update if needed.

## Navigation and remaining checks

Confirmed preferences: TCS Hall home; Schenley and river-trail ideas; iOS 27.2,
watchOS 27.0.1. Device hardware models have not been supplied.

Apple's [Watch guide](https://support.apple.com/guide/watch/get-directions-apdea7480950/watchos)
describes cycling directions and turn taps. This establishes general capability,
not a test on these particular versions/devices. Place links in the companion
open a pin; the rider chooses cycling and reviews Apple's calculated path.
They do not preserve custom GPX geometry. The app now also offers walking and
cycling links to the start, capability-detected GPX file sharing, a free-only
EasyRoute import guide, and local device-check records/export. The user reports phone GPX import and Watch sync working in EasyRoute using
its free Apple map. Exact-track matching, turns/taps, locked-phone use, and offline
operation have not been individually confirmed. Paid layers/offline maps are excluded. No app purchase or new app
account is required by the selected path; see [sources and limits](NAVIGATION.md).

Remaining device checklist:

- Open a station pin in Maps on iPhone; choose cycling and check the route.
- Start navigation and confirm the Watch receives the route, map, turn list,
  and haptics; check alert settings if needed.
- Lock the phone and test a short familiar segment. Record what still works.
- Separately test any exact custom route transfer; do not infer it from the
  successful destination test. Until established, use reviewed phone directions.
- Use the route's device panel to record observations; every check starts as
  untested. File sharing never automatically passes an import/Watch check.

The three starter tracks were reviewed against maps on October 30, 2026:
geometry, trail entrances, bridge approaches, routing access and one-way tags,
terrain estimates, and station proximity. Real rides, same-day closures,
station access detours, campus-to-start connections, and device navigation are
not field verified. See [route review](ROUTE_REVIEW.md). The second handoff
referenced by `plan.md` is not present; these routes implement its broad ideas
using independently checked sources rather than copying absent directions.

[CMU's published terms](https://www.cmu.edu/transportation/wheels/pogoh.html)
were checked October 29, 2026: eligible CMU members have 30-minute rides and
must return to an official available dock; a new rental may follow a completed
return. The app links current terms and does not claim a specific ride will fit
the allowance or guarantee another bike after docking. No fixed overtime prices
are embedded.

## Dependencies and attribution

- POGOH GBFS data: [feed](https://pittsburgh.publicbikesystem.net/customer/gbfs/v3.0/gbfs.json),
  CC BY 4.0, transformed into a local availability summary.
- Leaflet 1.9.4, vendored under `vendor/`; BSD-2-Clause license included.
  JS/CSS SHA-256 verified against the official
  [download page](https://leafletjs.com/download.html).
- Map data © OpenStreetMap contributors; normal interactive tiles from
  `tile.openstreetmap.org`, visible attribution, browser caching, no offline
  prefetch. [Tile policy](https://operations.osmfoundation.org/policies/tiles/).
  No analytics, geolocation prompt, API keys, or billing-dependent tile service.

## Implementation status

Foundation, live data/fallback, analysis engine/charts, local ride log, GPX tools,
offline shell, a map-reviewed starter route library, free navigation handoff,
compact everyday screens, PNG home-screen icons, and an optional update control
are implemented. Phone import/Watch sync are user-reported working. Field rides,
remaining navigation checks, hosted iPhone installation, and publishing remain.
Automatic data regeneration is prepared locally with the publishing workflow. Phase 7 deliberately waits for several
weeks of consistent data. This is not completion of every plan phase.
