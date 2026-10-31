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


## Three shorter trail rides — October 30, 2026

| Ride | Station | Distance | Moving estimate | Modeled climb |
| --- | --- | --- | --- | --- |
| Eliza quick spin | 2 | 3.5 km | 12–17 min | 11 m |
| South Side riverside | 9 | 3.1 km | 10–15 min | 2 m |
| North Shore riverfront | 23 | 2.5 km | 8–13 min | 13 m |

The three candidates were individually inspected over the rendered OpenStreetMap
street/trail map. Their complete polylines and checkpoint locations were checked
against the public routing/access audit and the official [2024 Three Rivers
Heritage Trail guide](https://friendsoftheriverfront.org/wp-content/uploads/2024/07/2024-Map-and-Guide_web_01-1.pdf).
Every new final audit reports zero street distance, zero conservative walking
distance, and no flagged access/steps/reverse-one-way restrictions. Missing map
tags are not proof of real-world access; signs and current conditions govern.

- Eliza quick spin uses the first part of the reviewed Eliza corridor, returning
  from a point on the trail. An initial misplaced turnaround added a service-road
  spur; that candidate was discarded. The final path stays on the shared trail.
- South Side starts at the trail-side station 9 and turns near the riverfront
  park. The first station-26 candidate used streets and was discarded. The final
  ride stays river-side of the railway; getting to the start from elsewhere can
  still involve a railway crossing, which is disclosed in the route notes.
- North Shore uses the ramped station-23 connection and the same-bank waterfront
  trail past PNC Park, turning just beyond Rachel Carson Bridge. An initial
  farther waypoint introduced roads and an ambiguous footpath; it was discarded.
  Stadium crowds and event restrictions still need checking.

The [operator's current alerts](https://friendsoftheriverfront.org/) listed the
Chateau repair and the Convention Center painting closure. The new tracks do not
enter Chateau or cross to the Convention Center bank. This is a dated source
check, not a live closure guarantee. All three rides exclude travel from CMU,
remain map-only reviews, and have not been field ridden or Watch-tested.
Reviews are bound to geometry/elevation hashes; GPX files were regenerated only
after visual review and the geometry/access checks passed.


## Expansion to ten rides — October 31, 2026

| Ride | Station | Distance | Moving estimate | Climbing note |
| --- | --- | --- | --- | --- |
| Junction Hollow greenway | 2 | 3.6 km | 12–18 min | modeled 24 m |
| North Shore stadium trail | 23 | 2.0 km | 7–10 min | modeled 3 m |
| Hot Metal & GAP ride | 49 | 4.8 km | 16–24 min | bridge ramps; terrain model unreliable |
| Hazelwood Trail out-and-back | 2 | 4.8 km | 16–24 min | modeled 14 m |

All four lines were visually reviewed over OpenStreetMap, with start/finish,
turnarounds, trail joins, ramps, and riverbank continuity inspected. Access audits
show no steps, bicycle prohibition, private-access flag, or reverse one-way
restriction in the final candidates. All report zero on-street distance under
the audit's highway classification. Hot Metal has 66 m of conservatively treated
walking access at the dock, disclosed in the UI. Other final audits report zero
walking distance. These tag-based checks do not replace signs or field rides.

Junction Hollow follows the paved trail to a turnaround before Boundary Street.
An initial point on the wrong side of the railway required a long street detour
and was rejected. The final route does not use informal railway crossings to
Panther Hollow Lake. The [City's cycling-corridor description](https://engage.pittsburghpa.gov/oakland/strategy-safe-multimodal-connection-fifth-avenue-junction-hollow-trail)
and [park entrance map](https://pittsburghparks.org/wp-content/uploads/2020/10/Schenley-Entrances.pdf)
were consulted alongside the route access tags.

The stadium ride heads west from station 23 on the waterfront past Acrisure
Stadium to the science-center trail. Its initial endpoint led to a pedestrian
spur with unclear bike access; the final turnaround is on the bicycle-permitted
trail. It stays before the Chateau repair area. Crowds and event closures still
require caution; it is not a guaranteed unobstructed promenade.

Hot Metal & GAP uses the bicycle bridge and the GAP on the west/south bank,
returning from the plotted trail point toward Hays. Early misplaced points
produced street detours and a wrong-bank destination; these were rejected.
The final turnaround was located on the mapped GAP and the final bridge and
trail connection were inspected. It does not approach the Duquesne–Homestead
closure listed by the [GAP operator](https://gaptrail.org/updates/). The UI shows
Bridge ramps rather than the terrain model's low numeric ascent estimate,
which is not a reliable representation of the bridge deck and approaches.

Hazelwood follows the marked north-bank trail through the fine-gravel connector,
turning before the Hazelwood Green street crossing. The first farther endpoint
introduced one-way bike-lane problems and was rejected. The final route avoids
those lanes. [Hazelwood Green's access guidance](https://hazelwoodgreen.com/visit-us/)
confirms trail connections and asks visitors to stay in public areas and follow
construction signs. Fine gravel, construction activity, and docking time are
explicitly disclosed. The route does not promise access through work zones.

The [riverfront operator's alerts](https://friendsoftheriverfront.org/) were
checked for the Chateau and Convention Center restrictions; these four tracks
do not enter those sections. Source checks are dated, not live closure reports.
All ten rides exclude campus-to-start travel, retain their source/license and
review hash in the dataset, and remain not field ridden.
