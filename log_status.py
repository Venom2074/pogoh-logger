"""Snapshot POGOH station availability into monthly CSV files.

Run on a schedule (GitHub Actions). Each run appends one row per station to
data/YYYY-MM.csv and refreshes data/stations.csv (id -> name, lat, lon).
Standard library only.
"""

import csv
import json
import os
import urllib.request
from datetime import datetime, timezone

BASE = "https://pittsburgh.publicbikesystem.net/customer/gbfs/v3.0"
DATA_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data")

STATUS_FIELDS = [
    "snapshot_utc",      # when this script ran
    "feed_updated_utc",  # feed's own last_updated (spots a stale feed)
    "station_id",
    "ebikes",
    "pedal_bikes",
    "other_vehicles",
    "docks_open",
    "bikes_disabled",
    "docks_disabled",
    "is_renting",
    "is_returning",
    "last_reported_utc",
]


def fetch(feed):
    req = urllib.request.Request(
        f"{BASE}/{feed}", headers={"User-Agent": "personal-pogoh-logger"}
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.load(resp)


def name_text(value):
    """GBFS v3 names are lists of {text, language}; older feeds use strings."""
    if isinstance(value, list):
        for item in value:
            if item.get("language", "").startswith("en"):
                return item.get("text", "")
        return value[0].get("text", "") if value else ""
    return value or ""


def vehicle_kinds():
    """Map vehicle_type_id -> 'ebike' | 'pedal' | 'other'."""
    kinds = {}
    for vt in fetch("vehicle_types")["data"]["vehicle_types"]:
        if vt.get("form_factor") != "bicycle":
            kinds[vt["vehicle_type_id"]] = "other"
        elif vt.get("propulsion_type") == "human":
            kinds[vt["vehicle_type_id"]] = "pedal"
        else:
            kinds[vt["vehicle_type_id"]] = "ebike"
    return kinds


def write_stations():
    stations = fetch("station_information")["data"]["stations"]
    path = os.path.join(DATA_DIR, "stations.csv")
    with open(path, "w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["station_id", "name", "lat", "lon", "capacity"])
        for s in sorted(stations, key=lambda s: int(s["station_id"]) if s["station_id"].isdigit() else 0):
            w.writerow([s["station_id"], name_text(s.get("name")),
                        s.get("lat"), s.get("lon"), s.get("capacity", "")])


def append_status():
    kinds = vehicle_kinds()
    feed = fetch("station_status")
    now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    feed_updated = feed.get("last_updated", "")

    path = os.path.join(DATA_DIR, f"{now[:7]}.csv")
    new_file = not os.path.exists(path)
    with open(path, "a", newline="") as f:
        w = csv.DictWriter(f, fieldnames=STATUS_FIELDS)
        if new_file:
            w.writeheader()
        for s in feed["data"]["stations"]:
            counts = {"ebike": 0, "pedal": 0, "other": 0}
            for vt in s.get("vehicle_types_available", []):
                counts[kinds.get(vt["vehicle_type_id"], "other")] += vt.get("count", 0)
            w.writerow({
                "snapshot_utc": now,
                "feed_updated_utc": feed_updated,
                "station_id": s["station_id"],
                "ebikes": counts["ebike"],
                "pedal_bikes": counts["pedal"],
                "other_vehicles": counts["other"],
                "docks_open": s.get("num_docks_available", ""),
                "bikes_disabled": s.get("num_vehicles_disabled", ""),
                "docks_disabled": s.get("num_docks_disabled", ""),
                "is_renting": int(bool(s.get("is_renting"))),
                "is_returning": int(bool(s.get("is_returning"))),
                "last_reported_utc": s.get("last_reported", ""),
            })
    print(f"{now}: logged {len(feed['data']['stations'])} stations -> {os.path.basename(path)}")


if __name__ == "__main__":
    os.makedirs(DATA_DIR, exist_ok=True)
    write_stations()
    append_status()
