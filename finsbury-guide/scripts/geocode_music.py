#!/usr/bin/env python3
import json
import time
import urllib.parse
import urllib.request

queries = [
    "The Garage Highbury London",
    "Union Chapel Islington London",
    "Park Theatre Finsbury Park London",
    "Nambucca Holloway Road London",
    "Boston Music Room London",
    "The Dome Tufnell Park London",
    "Alexandra Palace London",
    "O2 Academy Islington London",
    "O2 Forum Kentish Town London",
    "The Twelve Pins Finsbury Park London",
    "The Old Dairy Crouch Hill London",
    "Islington Assembly Hall London",
    "The Lexington London Pentonville",
    "Electrowerkz London",
    "The Salisbury Hotel Green Lanes London",
    "The Faltering Fullback Finsbury Park",
    "World's End Finsbury Park London",
]

UA = {"User-Agent": "field-guide-finsbury/1.0 (local demo)"}
for q in queries:
    url = "https://nominatim.openstreetmap.org/search?" + urllib.parse.urlencode(
        {"q": q, "format": "json", "limit": 1}
    )
    req = urllib.request.Request(url, headers=UA)
    try:
        with urllib.request.urlopen(req, timeout=15) as r:
            data = json.loads(r.read().decode())
    except Exception as e:
        print("ERR", q, e)
        time.sleep(1.1)
        continue
    if data:
        d = data[0]
        lon = float(d["lon"])
        lat = float(d["lat"])
        print(f"{lon:.5f},{lat:.5f} | {q} | {d.get('display_name','')[:100]}")
    else:
        print("MISS", q)
    time.sleep(1.05)
