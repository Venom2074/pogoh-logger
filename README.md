# POGOH station logger

Snapshots live bike and dock availability for every POGOH station every ~10 minutes, so I can figure out when stations (especially TCS Hall & Forbes Ave near CMU) run out of bikes.

## How it works

- An Azure Function dispatches `.github/workflows/log.yml` every ten minutes.
  The workflow's GitHub Actions schedule remains enabled as a best-effort fallback.
- `log_status.py` reads POGOH's public GBFS v3 feed and appends one row per station to `data/YYYY-MM.csv` (UTC month).
- `data/stations.csv` maps `station_id` to station name, coordinates and capacity.

## Data columns (`data/YYYY-MM.csv`)

| column | meaning |
|---|---|
| `snapshot_utc` | when the snapshot was taken (UTC) |
| `feed_updated_utc` | the feed's own timestamp; if this stops changing, the feed was stale |
| `station_id` | join to `data/stations.csv` |
| `ebikes` / `pedal_bikes` | available e-assist and pedal bikes |
| `other_vehicles` | anything that isn't a bike (e.g. scooters) |
| `docks_open` | empty docks you can return to |
| `bikes_disabled` / `docks_disabled` | broken bikes or docks |
| `is_renting` / `is_returning` | 1 if the station is accepting rentals / returns |
| `last_reported_utc` | when the station last checked in |

Times are UTC; Pittsburgh is UTC-4 (EDT) until Nov 1, 2026, then UTC-5 (EST).

## Run it manually

Actions tab → "Log POGOH station status" → Run workflow. Or locally: `python3 log_status.py`.

## Azure timer

The timer in [`azure/`](azure/README.md) is deployed on Flex Consumption with
zero always-ready instances. See its README for resource names, deployment,
token rotation, verification, credit controls, and stop/delete instructions.
The Azure for Students spending limit remains enabled.

## Data source

Live data: POGOH GBFS feed, https://pittsburgh.publicbikesystem.net/customer/gbfs/v3.0/gbfs.json (CC-BY-4.0).
Historical trip data (starts/ends, not bike counts): https://data.wprdc.org/dataset/pogoh-trip-data
