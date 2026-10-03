#!/usr/bin/env python3
"""Build one continuous ECML path through Finsbury Park by endpoint chaining."""
import json
import math

with open("/tmp/fp_rail.json") as f:
    ways = json.load(f)["elements"]


def hav(a, b):
    R = 6371000
    lat1, lon1 = math.radians(a[1]), math.radians(a[0])
    lat2, lon2 = math.radians(b[1]), math.radians(b[0])
    dlat = lat2 - lat1
    dlon = lon2 - lon1
    h = (
        math.sin(dlat / 2) ** 2
        + math.cos(lat1) * math.cos(lat2) * math.sin(dlon / 2) ** 2
    )
    return 2 * R * math.asin(math.sqrt(h))


# Target: through Finsbury Park NR platforms (~ -0.1064, 51.5645)
TARGET_LON = -0.1064

segs = []
for w in ways:
    tags = w.get("tags", {})
    if tags.get("railway") != "rail":
        continue
    if (tags.get("service") or "") in ("yard", "siding", "spur"):
        continue
    name = tags.get("name") or ""
    usage = tags.get("usage") or ""
    if "Gospel Oak" in name:
        continue
    if "East Coast" not in name and "ECM" not in (tags.get("ref") or "") and usage != "main":
        continue
    if usage == "branch":
        continue
    geom = w.get("geometry") or []
    if len(geom) < 3:
        continue
    coords = [(p["lon"], p["lat"]) for p in geom]
    if coords[0][1] > coords[-1][1]:
        coords = coords[::-1]
    mid = coords[len(coords) // 2]
    if not (51.554 <= mid[1] <= 51.576 and -0.112 <= mid[0] <= -0.102):
        continue
    length = sum(hav(coords[i], coords[i + 1]) for i in range(len(coords) - 1))
    segs.append(
        {
            "id": w["id"],
            "name": name,
            "coords": coords,
            "mid": mid,
            "len": length,
        }
    )

print("segs", len(segs))

# Start: southernmost seg whose mid lon is close to TARGET_LON
south_cands = sorted(segs, key=lambda s: s["coords"][0][1])[:12]
start = min(south_cands, key=lambda s: abs(s["mid"][0] - TARGET_LON) + abs(s["coords"][0][1] - 51.556) * 0.5)
print("start", start["id"], start["name"], start["coords"][0], "->", start["coords"][-1])

used = {start["id"]}
path = start["coords"][:]

while True:
    tip = path[-1]
    best = None
    for s in segs:
        if s["id"] in used:
            continue
        # connect tip -> southern end of candidate
        d = hav(tip, s["coords"][0])
        if d > 55:
            continue
        # must extend meaningfully north
        if s["coords"][-1][1] < tip[1] + 0.00015:
            continue
        # prefer same parallel (lon continuity)
        lon_pen = abs(s["mid"][0] - tip[0]) * 8000
        score = d + lon_pen
        if best is None or score < best[0]:
            best = (score, d, s)
    if not best:
        break
    s = best[2]
    add = s["coords"][:]
    if hav(path[-1], add[0]) < 4:
        add = add[1:]
    path.extend(add)
    used.add(s["id"])
    print(f"  + {s['id']} d={best[1]:.1f}m -> {path[-1]}")

print("raw pts", len(path), "segs", len(used))
print(
    "len_m",
    sum(hav(path[i], path[i + 1]) for i in range(len(path) - 1)),
    "start",
    path[0],
    "end",
    path[-1],
)

# Simplify
simp = [path[0]]
acc = 0
for i in range(1, len(path) - 1):
    acc += hav(path[i - 1], path[i])
    if acc >= 22:
        simp.append(path[i])
        acc = 0
simp.append(path[-1])

# Drop rare southward spikes
mono = [simp[0]]
for p in simp[1:]:
    if p[1] >= mono[-1][1] - 0.00008:
        mono.append(p)

print("final", len(mono), "m", sum(hav(mono[i], mono[i + 1]) for i in range(len(mono) - 1)))

coords = [[round(p[0], 7), round(p[1], 7)] for p in mono]
out = {
    "type": "FeatureCollection",
    "features": [
        {
            "type": "Feature",
            "properties": {
                "name": "East Coast Main Line",
                "source": "OpenStreetMap",
                "attribution": "© OpenStreetMap contributors",
            },
            "geometry": {"type": "LineString", "coordinates": coords},
        }
    ],
}
with open("public/finsbury-rail.geojson", "w") as f:
    json.dump(out, f, indent=2)
print("wrote public/finsbury-rail.geojson")
for c in coords:
    print(f"  [{c[0]}, {c[1]}],")
