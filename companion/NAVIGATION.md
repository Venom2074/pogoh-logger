# Free phone and Apple Watch navigation - October 30, 2026

User preference: free options only. Target setup: iOS 27.2, watchOS 27.0.1.
The user reports that the route opens correctly in EasyRoute on the iPhone and
that phone-to-Watch sync now works after an initial stall. This confirms the
basic handoff by user report. The tested route was not identified. Exact-track
comparison, turn prompts, haptics, locked-phone behavior, and offline operation
remain individually unconfirmed. The agent has not operated the physical devices.

## Get the preview onto the phone without hosting

The normal `npm run preview` binds only to this computer. Its `127.0.0.1` URL
does not point to this computer when opened on an iPhone.

1. Stop the normal preview with Ctrl+C if it is running.
2. Connect the computer and iPhone to the same private Wi-Fi.
3. In the project folder, run:

   ```powershell
   npm run preview:phone
   ```

4. Open the printed address for the computer's **Wi-Fi** adapter in Safari.
   The address will look like `http://192.168.x.x:8765/`. A VPN may print another
   address too; use the adapter for the network shared with the phone.
5. Keep the preview process running while testing; Ctrl+C stops network access.

If using Tailscale, both devices can instead connect to the same tailnet. Open
the **computer's** Tailscale address (usually `100.x.x.x`), including the port:
`http://COMPUTER-TAILSCALE-IP:8765/#routes`. The preview now prints Tailscale's
standard CGNAT addresses as well as LAN addresses. Adapter names such as
Ethernet 2 do not by themselves identify the right address. The same Wi-Fi is
not needed for this path. Tailscale access policies must allow the connection;
this command does not change them. See [connecting to devices](https://tailscale.com/docs/how-to/connect-to-devices).

Phone preview is an explicit opt-in to bind the static app server to local
network interfaces. The default remains loopback-only. It serves only the
`companion/` folder; ride records and device checks stay in each browser's own
storage. It does not modify firewall settings, GitHub settings, or Azure.
If the phone cannot connect, check the same-Wi-Fi condition and local network
permissions. Do not weaken security settings or expose this port to the internet.

This is HTTP. Downloading GPX files and opening Maps links can be tested there,
but the page's native file-share button and service-worker offline caching
require a secure context and supporting browser. Use the download-and-Files
fallback. Full home-screen/HTTPS behavior waits for an approved deployment.
Changing the preview address creates a different browser storage origin; local
ride logs and device checks will not automatically appear at the new address.

## Two supported handoff paths

| Path | Purpose | Route preservation | Cost/account | Connectivity |
| --- | --- | --- | --- | --- |
| Apple Maps | Walk or cycle to the selected start | Apple calculates its own path; no GPX loop is transferred | Built-in option | Test connected first; offline cycling/Watch behavior is not established here |
| EasyRoute, Apple map layer | Candidate for following the imported GPX on Watch | File preserves our points; compare the app's imported result before following | Developer describes free Apple map and no app account; paid layers/trials excluded | Keep phone connected for first test; do not rely on free offline maps |

[Apple's unified Maps URL documentation](https://developer.apple.com/documentation/mapkit/unified-map-urls)
supports `/directions`, a destination, and walking/cycling modes. Our links omit
the source so Maps uses or asks for the current location. They do not encode the
custom loop. Apple's [Watch directions guide](https://support.apple.com/en-au/guide/watch/apdea7480950/26/watchos/26)
documents cycling directions and turn taps; that is general documentation, not
verification on the user's OS versions. Published custom walking/hiking features
do not establish a custom cycling/GPX workflow.

EasyRoute's [developer overview](https://easyrouteapp.com/about/) describes
Watch guidance, and its [GPX import note](https://easyrouteapp.com/importing-gpx-into-easyroute/)
describes opening GPX through another app's share/export action. The current
[App Store listing](https://apps.apple.com/us/app/easyroute/id605127860) includes
Watch support and GPX-import maintenance. These establish a candidate to test,
not a successful import of our particular tracks.

The developer's [subscription explanation](https://easyrouteapp.com/subscriptions/)
distinguishes the free Apple map from paid map providers and associates offline
use with Mapbox. The app-store label also includes in-app purchases. This
workflow selects the Apple map, avoids trials/subscriptions, and makes no
free-offline guarantee. If a required step asks for payment, mark it unavailable
and use the phone fallback. No paid navigation app was selected or installed.

## Test Apple Maps first

1. Choose a ride and open **Navigation options**.
2. Choose **Walk to start** or **Cycle to start**. Confirm the travel mode,
   destination, and calculated approach before starting.
3. Check the Watch's route map, position, and turn instructions.
4. On a short familiar segment, check wrist taps and behavior with the phone
   screen locked. Keep the phone connected for this first test.

This tests the approach Apple calculated. It does not verify the custom ride
loop. The device form labels this workflow accordingly and omits the GPX-shape
check. Do not infer full-loop Watch support from a successful approach test.

## Test the GPX track

1. Review the ride's geometry and current station/route notes.
2. On a supporting HTTPS page, **Share GPX file** opens the system share sheet.
   Select EasyRoute yourself. Otherwise use **Download GPX**, open Safari's
   Downloads/Files, then use Share to open the file in EasyRoute. If the app
   is not installed, review its listing and use only the free Apple map.
3. Compare the imported shape, direction, distance, bridges, and turnaround with
   the companion. If the import offers recalculation, avoid replacing the track
   without comparison. A changed path is a failed preservation check.
4. Find the matching imported route in EasyRoute on the paired Watch and start
   following it. Menu labels/sync behavior need checking on the actual version.
5. Check map/position, useful turns, taps, and locked-phone guidance on a familiar
   short segment. The GPX files do not contain turn instructions, so an app's
   behavior with these track-only files must be observed rather than assumed.
6. Record observations in the route's device-check panel. Offline is optional
   and independent of a working connected workflow; no offline purchase is part
   of this plan.

Sharing success means only that the operating system accepted the share action.
The companion cannot identify the chosen app, confirm an import, inspect a
Watch, or automatically mark any device check as passed. Cancelling the share
sheet does not start a download. Unsupported/failed sharing leaves the ordinary
download available. No direct-to-Watch or undocumented app URL scheme is used.

## Device-check records

Records are per route and workflow, tied to the reviewed geometry hash. They
include the stated OS/app versions, observations, notes, and save time. The
initial state of every field is **Not tested**. Selecting a workflow preserves
its current unsaved draft. Saving results does not update other routes.

A changed route requires another check; old passing values are not copied into
the new track's form. An incomplete/failed step cannot produce a working-status
label. A fully checked connected workflow is labeled **Reported working**, not
agent-verified. Offline is recorded separately and is never inferred from that
label. Results can be exported as `pogoh-device-checks.json`; they do not sync
between browsers/devices or get sent anywhere automatically. Invalid saved
records are preserved and new checks fall back to memory with an export notice.

## Fallback and limits

If the free GPX path changes the track, lacks useful turns/taps, fails on the
Watch, or prompts for payment, keep the phone and use reviewed Apple Maps
directions to a chosen destination. The companion's map can serve as a stationary
reference to the plotted track; it does not track position or navigate turns.
Basic Watch sync is user-reported working; exact-loop guidance and riding
behavior still need the corresponding observations.

No native Watch app, new paid service, account-requiring backend, route upload
service, publishing change, or Azure/GitHub setting change was introduced.
The optional Wi-Fi server is a temporary local test path, not public hosting.

Automated checks cover link parameters, file content, share capability and
cancellation/failure behavior, manual-result validation, changed geometry, and
the explicit LAN opt-in. Browser checks cover the UI and local persistence.
They do not substitute for device observations. The user's successful basic
sync report is recorded above; remaining ride-guidance observations can be
saved in the per-route device panel when checked.
