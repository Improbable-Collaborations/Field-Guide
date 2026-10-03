#!/usr/bin/env python3
import json
import math
import re
import subprocess

resp = subprocess.run(
    [
        "curl",
        "-sS",
        "--max-time",
        "25",
        "-A",
        "Mozilla/5.0",
        "-D",
        "-",
        "https://www.skiddle.com/whats-on/London/?latitude=51.5645&longitude=-0.1064&radius=3&order=date",
    ],
    capture_output=True,
    text=True,
    errors="replace",
)
raw = resp.stdout
hdr, _, html = raw.partition("\r\n\r\n")
if "application/ld+json" not in html:
    hdr, _, html = raw.partition("\n\n")
print("HDR", hdr.splitlines()[0] if hdr else "none")
for line in hdr.splitlines():
    if "access-control" in line.lower() or "content-type" in line.lower():
        print(line)

lds = re.findall(
    r'<script[^>]*type="application/ld\+json"[^>]*>(.*?)</script>',
    html,
    re.S,
)
print("ld blocks", len(lds))
events = []
for block in lds:
    try:
        data = json.loads(block)
    except Exception:
        continue
    items = data if isinstance(data, list) else [data]
    for it in items:
        if isinstance(it, dict) and it.get("@type") == "Event":
            events.append(it)


def hav(lon, lat):
    fp = (-0.1064, 51.5645)
    R = 6371000
    lat1, lon1 = math.radians(fp[1]), math.radians(fp[0])
    lat2, lon2 = math.radians(lat), math.radians(lon)
    dlat = lat2 - lat1
    dlon = lon2 - lon1
    h = (
        math.sin(dlat / 2) ** 2
        + math.cos(lat1) * math.cos(lat2) * math.sin(dlon / 2) ** 2
    )
    return 2 * R * math.asin(math.sqrt(h))


near = []
for e in events:
    loc = e.get("location") or {}
    geo = loc.get("geo") or {}
    try:
        lon = float(geo.get("longitude"))
        lat = float(geo.get("latitude"))
    except Exception:
        continue
    d = hav(lon, lat)
    near.append(
        (
            d,
            loc.get("name"),
            e.get("name"),
            e.get("startDate"),
            e.get("url"),
            lon,
            lat,
        )
    )
near.sort()
print("events", len(events), "with geo", len(near))
for row in near[:25]:
    print(
        f"{row[0]:.0f}m | {row[1]} | {str(row[2])[:48]} | {str(row[3])[:16]} | {str(row[4])[:70]}"
    )
print("within 5km", sum(1 for r in near if r[0] < 5000))
