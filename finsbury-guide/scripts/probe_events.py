#!/usr/bin/env python3
"""Probe public event listings near Finsbury Park."""
import json
import re
import subprocess


def curl(url: str) -> str:
    return subprocess.check_output(
        ["curl", "-sS", "--max-time", "25", "-A", "field-guide/1.0", url],
        text=True,
        errors="replace",
    )


def try_next_data(url: str):
    html = curl(url)
    print(f"\n== {url} len={len(html)}")
    m = re.search(
        r'<script id="__NEXT_DATA__" type="application/json">(.*?)</script>',
        html,
        re.S,
    )
    if not m:
        print("no __NEXT_DATA__")
        lds = re.findall(
            r'<script type="application/ld\+json">(.*?)</script>', html, re.S
        )
        print("ld+json", len(lds))
        for i, block in enumerate(lds[:4]):
            try:
                data = json.loads(block)
            except Exception:
                print(" LD parse fail", i, block[:120])
                continue
            print(" LD", i, type(data).__name__, str(data)[:350].replace("\n", " "))
        return
    data = json.loads(m.group(1))
    page = data.get("props", {}).get("pageProps", {})
    print("pageProps keys", list(page.keys())[:40])
    blob = json.dumps(page)
    print("blob", len(blob))
    # find event-like arrays
    for key in page:
        val = page[key]
        if isinstance(val, list) and val and isinstance(val[0], dict):
            print(" list", key, len(val), list(val[0].keys())[:12])
            print("  sample", json.dumps(val[0])[:400])
        elif isinstance(val, dict):
            print(" dict", key, list(val.keys())[:15])


urls = [
    "https://www.skiddle.com/whats-on/London/Nambucca/",
    "https://www.skiddle.com/whats-on/London/?location=Finsbury%20Park&radius=3",
    "https://www.thegarage.london/",
    "https://parktheatre.co.uk/whats-on",
    "https://www.unionchapel.org.uk/whats-on/",
    "https://dice.fm/browse/london",
]
for u in urls:
    try:
        try_next_data(u)
    except Exception as e:
        print("ERR", u, e)
