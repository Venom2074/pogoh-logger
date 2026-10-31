# Companion progress — October 30, 2026

User authorized implementation of `plan.md` and confirmed station 59, nearby
backups, Schenley/river-trail ideas, iOS 27.2, and watchOS 27.0.1.

The plan has seven phases; phases 1–6 constitute the first version. Initial
estimate: 3–5 focused sessions including route verification and device testing;
phase 7 needs several weeks of observations rather than just implementation time.

| Phase | Local implementation | Still needed |
| --- | --- | --- |
| 1: validate | Ten-minute Actions cadence confirmed; data summary, user defaults, phone layout, CMU terms, Watch research; starter map paths reviewed | Campus walking/riding connections, field checks, device behavior |
| 2: current view | Live GBFS, home/backup cards, interactive map, refresh, dated fallback, mobile layout | Physical iPhone verification; Pages published and hosted browser checks passed |
| 3: routes | Three map-reviewed starter tracks, directional maps, distance/time/climb, station proximity/counts, GPX downloads, access audits and source evidence | Field rides, campus connections, station access detours |
| 4: patterns | Repeatable builder, weekly heatmap/daily graph, separate e-bike/any-bike views, station/group analysis, DST and coverage rules | More repeated weekday coverage; hourly Pages rebuild active |
| 5: Watch | Navigation handoff, free EasyRoute guide, local device-check records, LAN/Tailscale preview; user reports phone import and Watch sync working | Exact-track comparison, turns/taps, locked-phone behavior, and offline operation are not individually confirmed |
| 6: ride log/usability | Local rides, JSON portability, weekly totals, offline shell, manifest, accessibility states, maintenance docs | Physical iPhone installation/offline checks |
| 7: later improvements | Intentionally deferred | Consistent data, held-out evaluation, demonstrated need |

See `companion/README.md` for commands, data rules, publishing proposal, and
remaining route/device checks. New app code uses no npm dependencies; the map
library is vendored. No changes to logger, monthly data, workflow, Azure,
GitHub settings, tokens, or paid services were made.

Verification of public GitHub data at this implementation pass:

- Latest fetched CSV snapshot: October 29, 2026, 23:43:08 EDT
  (October 30, 03:43:08 UTC).
- 196 snapshots over the whole dataset; 191 unique ten-minute slots.
- Latest day ending at that snapshot: 138/144 slots (95.8%).
- Whole-dataset longest gap: 478 minutes, including pre-Azure logging.
- Live GBFS fetched successfully from the preview browser.

Automated tests: `node --test tests/*.test.mjs` — 35 passing tests.
Browser checks: desktop and 390px phone layout, live feed and map, route proposal,
rejection of disconnected GPX segments, import/preview/export of a synthetic
single track, and saving a synthetic ride across reload. Remaining QA is tracked
above; these checks do not establish real-device Watch compatibility.

October 30 route-library phase: station-33 Schenley circuit (5.1 km), station-2
Eliza out-and-back (7.5 km), and station-49 river loop (10.2 km) now have reviewed
geometry and GPX files. Reviews are explicitly map-only, not field rides. The
river loop's busy streets/railway crossing and rental-time implications are
visible. See `companion/ROUTE_REVIEW.md`. The green location dot was removed
from the header. Local-only work; no publishing/settings/resource changes.

Phase verification: all three map lines and route notes inspected in the
browser; river-loop GPX downloaded and XML-checked for 370 unchanged points
and elevations; start/finish ordering and return-to-library control checked;
390px phone and three-column desktop layouts checked without page overflow.
The route library reloaded successfully from the service-worker cache after
the local HTTP server was stopped (public internet remained connected).
All 15 cached app/GPX asset paths returned HTTP 200 with correct GPX MIME types.
This does not establish fully offline street maps or phone/Watch compatibility.

October 30 navigation phase: user explicitly selected free options only.
Apple Maps links use the documented destination/mode API to approach the start;
they do not transfer a custom loop. EasyRoute's free Apple map is the selected
GPX/Watch candidate; paid maps and offline purchases are excluded. Source checks,
phone-preview commands, exact-track comparison, and fallback are documented in
`companion/NAVIGATION.md`. Native sharing is capability-detected and does not
auto-pass a device check. The form stores only user-reported results; initial
fields remain untested. A browser-only untested QA record may exist at the
localhost origin with a note explicitly identifying it as a UI check.

Default preview remains loopback-only. `npm run preview:phone` is an explicit
opt-in to temporary local-network testing; it was not launched by the agent.
No paid app/service, public hosting, GitHub setting, Azure resource, or logger
change was made. Phase 5's real-device acceptance is still pending.

Navigation verification: 35 automated tests pass. Browser checks confirmed
walking/cycling URLs target the selected start; the GPX-specific check is hidden
for Apple Maps; all device fields start untested; an explicitly untested QA
record survives reload; and the 390px form has no horizontal page overflow.
All 17 cached app/route assets returned HTTP 200. Native share activation,
failure, and cancellation were tested with stubbed platform calls, not an iPhone
share sheet. Physical GPX import, Watch guidance, and haptics remain untested.

## User device-test result - October 30, 2026

The user confirmed that the imported route opens properly in EasyRoute on the
iPhone. After an initial "syncing routes from phone" stall, the user reported
that sync to the Watch works and that testing looks successful. Basic phone
import and phone-to-Watch sync are therefore user-reported working. The tested
route was not identified, so no per-route browser check was automatically marked
passed. Exact-track comparison, turn prompts, wrist taps, locked-phone behavior,
and offline operation were not individually reported. Earlier pending-test
statements above describe the status before this update.

The preview also supports printing Tailscale CGNAT addresses. The existing
preview was verified reachable at the computer's Tailscale address and serving
the current Routes page; no Tailscale policy or firewall setting was changed.
Current automated suite: 36 tests passing, including Tailscale address handling.


## Everyday usability and hosting preparation — October 30, 2026

Phase 6 usability pass: shortened primary instructions, collapsed Watch setup,
chart methodology, route directions/sources, and optional device checks. Choosing
a ride hides the library until All routes is used. Busy roads/railway crossing
and rental-time notices remain visible. Ride backup/import and weekly totals
remain local; no personal records were cleared or auto-marked as passed.

Added iPhone/manifest PNG icons and an explicit update button that activates a
waiting service worker only on request. Cache version v5 includes the new assets.
The user-reported EasyRoute phone import and Watch sync result is reflected in
help; other navigation capabilities remain individually unconfirmed.

Prepared a 22-file runtime-only Pages package and independent publishing workflow.
Read-only GitHub checks confirm the existing repo is public and Pages is disabled.
The workflow rebuilds after app changes/manual dispatch and successful logger runs
started in minutes 00–09, using latest trusted main. It uses the built-in Actions
token with narrowly scoped job permissions; no PAT or logger changes. Publishing,
GitHub Pages settings, Azure resources, and paid services were not changed.
See companion/PUBLISHING.md for the proposed URL and activation procedure.

Summary refreshed read-only from public CSVs: latest October 30, 18:33:07 UTC;
286 snapshots / 279 ten-minute slots; recent coverage 143/144 (99.3%).
Automated checks: 41 passing, including artifact allowlist/cached assets,
project-subdirectory install paths/PNG sizes, opt-in update activation, and
excluding external live feeds/tiles from the service worker.

Browser QA: Ride now, Best times, ride library/detail, and ride-log layouts fit
390px without horizontal page overflow. Live GBFS counts loaded. The waiting
worker Update button activated the new version and reloaded successfully.
The desktop library shows all three rides with help collapsed; browser error
log was empty. The updated route library reloaded from cache after stopping
only the agent-owned preview server (internet remained connected). This is
an offline-shell check, not a physical iPhone/offline-navigation test.
The prepared workflow passed actionlint 1.7.12, downloaded from the official
release and checksum-verified. Packaged HTML asset links were checked. Protected
logger/data/Azure files have no diff. The temporary preview and test tab were
closed; no server was left running by this turn.


## Pages publication authorization — October 30, 2026

The user explicitly authorized proceeding with GitHub Pages if Student Pack or
dynamic hosting does not change the recommendation. Current Student Pack offers
were checked on the official Pack page. The browser already fetches live data;
a backend would mainly enable future cross-device sync/auth/private APIs. Pages
remains appropriate, so publication of the reviewed companion and its independent
workflow is authorized. No new paid service, account, Azure resource, or token
change is needed. Latest existing logger commits were incorporated by fast-forward;
no local logger/raw data edits. Summary refreshed to 18:43:08 UTC, 287 snapshots,
280 ten-minute slots, 143/144 recent coverage. Deployment verification follows.


## Pages deployed and verified — October 30, 2026

Published at https://venom2074.github.io/pogoh-logger/ with HTTPS enforced.
Publication commit `3f492fa`; Actions run 41109930891 succeeded (build and deploy),
including all 41 tests. The root plus 22 runtime assets returned HTTP 200; GPX
MIME types and content, summary freshness, manifest, and icons were checked.
The live hosted browser fetched current GBFS counts. At 390px, the route library
and selected ride have no horizontal overflow; downloads and Maps destination/
travel-mode links are correct. Browser error log was empty. No laptop server
is needed. The homepage can be added to the iPhone Home Screen; physical Safari
installation, native sharing, and remaining Watch checks remain user-device QA.
No Azure resources, tokens, logger code/workflow, or raw data were edited.


## Route-library expansion and favorites — October 30, 2026

Completed the previously interrupted local implementation: three shorter trail
rides (Eliza quick spin 3.5 km, South Side riverside 3.1 km, North Shore riverfront
2.5 km), category filters, and browser-local favorites. New tracks were visually
reviewed on the map and access audited before recording their geometry hashes;
all remain not field ridden. See companion/ROUTE_REVIEW.md for discarded
candidates, final route evidence, and current-closure limits.

Favorites combine with categories, work in cards/details, survive reloads, and
handle empty results/storage failure without touching ride records. Imported
routes have stable geometry/name identities. Same-browser storage changes update
other tabs. Cache v6 and the 26-asset public package include all six GPX files.

50 automated tests pass, including filter intersections, favorite persistence,
invalid/blocked storage, category metadata, six route reviews/exports, and cache/
package completeness. Supported-browser QA confirmed saved favorites after reload,
category/favorite empty states, detail removal and return to the filtered list,
all three plotted tracks, and 390px layout without page overflow. Firefox itself
was not UI-tested: the earlier Windows browser-control attempt was unsupported.
Native sharing still falls back to GPX downloads when unavailable. Publishing
uses the existing approved Pages workflow; no new hosting settings or services.
