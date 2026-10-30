# Starter route review - October 30, 2026

These are map-reviewed cycling tracks, not field-ridden routes or live closure
reports. The GPX tracks preserve the plotted geometry; place links in Apple
Maps do not. The app does not claim exact custom-route Watch navigation.

| Ride | Start / finish | Horizontal distance | Moving-time estimate | Modeled climb |
| --- | --- | --- | --- | --- |
| Schenley Overlook circuit | Station 33 | 5.1 km | 17-25 min | about 60 m |
| Eliza Furnace out-and-back | Station 2 | 7.5 km | 25-37 min | about 22 m |
| Monongahela river loop | Station 49 | 10.2 km | 34-51 min | about 41 m |

Time assumes 12-18 km/h and excludes stops, crossings, and extra climbing time.
It is not a rental allowance. The full river loop exceeds 30 minutes at those
speeds; the Eliza return may also exceed 30 minutes. All rides exclude the
connection from TCS Hall. Shorter turnarounds and available docking stops need
their own time buffer; another rental is never guaranteed.

## Evidence and inspection

- Geometry was generated with BRouter's cycling `trekking` profile from public
  OpenStreetMap data. Requests, provider version, retrieval time, and requested
  checkpoints are stored per route in `routes.json`; segment access tags are
  preserved in `route-data/`. No BRouter requests occur during ordinary app use.
- The lines were visually inspected over OpenStreetMap and compared with the
  [Friends of Schenley Park maps](https://www.friendsofschenleypark.org/park-maps)
  and [Friends of the Riverfront trail map](https://friendsoftheriverfront.org/homepage/three-rivers-heritage-trail/trail-maps/).
  The official park entrance map and 2024 trail guide were also inspected locally.
- The [City's Panther Hollow Bridge project](https://engage.pittsburghpa.gov/panther-hollow-bridge)
  describes the completed restoration. The
  [Serpentine project](https://engage.pittsburghpa.gov/serpentine-drive) describes
  its 2026 bike/pedestrian restoration, but the routing data did not establish
  the desired through-connection. That spur was excluded from the final circuit.
- Schenley's line climbs the one-way Overlook approach in the routed direction,
  passes the Oval, and returns by the eastern road/shared-path connection. The
  approach shares some track with the return; it is not an entirely unique loop.
  An unnecessary waypoint into the Phipps grounds was removed.
- Eliza's route retraces the same paved trail. Its turnaround stays on the
  cycleway before the downtown service/road connection, avoiding an initial
  candidate's gate and street detour to station 31.
- The river loop's Smithfield Street Bridge endpoints were corrected against
  the routed crossing. The final line uses Smithfield and Hot Metal bicycle
  crossings, the South Side Trail, and street connectors near Station Square
  and S 4th Street. The segment audit identifies roughly 1 km of streets, a
  railway level crossing, and short access paths with unclear bicycle tags.
  Those details are disclosed in the app; it is not advertised as all protected.
- All three tracks pass checks for finite coordinates, consecutive gaps below
  350 m, checkpoints within 80 m, and start/finish within 50 m of the named
  station. Access-tag inspection flags steps, bicycle prohibitions, private
  access without an explicit bike allowance, and reverse one-way segments
  without a bicycle exception. The final candidates have none of those flags.
  Missing map tags do not establish legal access; short ambiguous paths are
  treated conservatively as walking sections.

The rendered routes, stated checkpoints, street/trail transitions, and directional
arrows were inspected in the local app. Current construction, temporary signs,
and real-world surface condition still need checking before riding. The trail
operator's linked alerts URL returned 404 during research, so the app links its
[current homepage notices](https://friendsoftheriverfront.org/) rather than
claiming no closures. There is no live closure feed in this companion.

## Rebuild and review

Regenerate downloads from the already-reviewed geometry, without network:

```powershell
node tools/build-route-files.mjs
```

Fetching replacement geometry is a separate, deliberate maintenance action:

```powershell
node tools/fetch-route-candidates.mjs schenley eliza river-loop
node tools/import-route-candidates.mjs schenley eliza river-loop
```

The fetcher stores candidates in ignored `.tools/route-review/`. The importer
copies selected candidates into the local app and **clears their map review**.
Inspect the new lines over the map, the access audits, source changes, road
directions, crossings, station approaches, and any construction. Change the
notes/checkpoints as needed. Only after that manual review, record its date:

```powershell
node tools/record-route-review.mjs YYYY-MM-DD schenley eliza river-loop
node tools/build-route-files.mjs
node --test tests/*.test.mjs
```

The review command records a SHA-256 hash over points and elevations. Editing
either invalidates export generation until another review is recorded. It does
not perform visual review for you. Do not publish stale GPX files after importing
new candidates; the complete library must pass review and artifact checks first.
Update the service-worker cache version/list when changing cached route files.

The generator retains one GPX track per ride, horizontal points, modeled
elevation, and source/license metadata. It does not generate turn instructions
or promise that a navigation app will preserve the line. These are portable
files for a compatible app; Watch testing is still a separate phase.

## Attribution and remaining work

Coordinates and routing tags are derived from OpenStreetMap data, copyright
OpenStreetMap contributors, under [ODbL 1.0](https://opendatacommons.org/licenses/odbl/1-0/).
The derived route-coordinate/audit dataset in `routes.json`, `route-data/`, and
`routes/*.gpx` is provided under that license. Retain attribution when sharing
it. BRouter source and routing implementation: <https://github.com/abrensch/brouter>.
Distance is calculated from the actual polyline; filtered ascent is from the
routing terrain model and is approximate.

Still needed: field rides, actual campus-to-start routes, checked station
detours, and iPhone/Watch navigation tests. No new account, paid service,
GitHub setting, Azure resource, logger change, or hosting was introduced.
