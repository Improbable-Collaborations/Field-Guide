#!/usr/bin/env python3
import re
import subprocess

html = subprocess.check_output(
    [
        "curl",
        "-sS",
        "--max-time",
        "25",
        "-A",
        "Mozilla/5.0",
        "https://www.skiddle.com/whats-on/London/Nambucca/",
    ],
    text=True,
    errors="replace",
)
print("len", len(html))
for pat in [
    "eventname",
    "EventName",
    "listingid",
    "start_date",
    "startdate",
    '"events"',
    "self.__next",
    "/e/",
]:
    print(pat, html.count(pat))

cards = re.findall(r'href="(/e/[^"]+)"', html)
print("href /e/", len(cards), "unique", len(set(cards)))
print(list(dict.fromkeys(cards))[:12])

titles = re.findall(r'data-event-name="([^"]+)"', html)
print("data-event-name", titles[:10])

# Nearby search page
html2 = subprocess.check_output(
    [
        "curl",
        "-sS",
        "--max-time",
        "25",
        "-A",
        "Mozilla/5.0",
        "https://www.skiddle.com/whats-on/London/?latitude=51.5645&longitude=-0.1064&radius=3&order=date",
    ],
    text=True,
    errors="replace",
)
print("\nnearby len", len(html2), "/e/", html2.count("/e/"))
cards2 = list(dict.fromkeys(re.findall(r'href="(/e/[^"]+)"', html2)))
print("nearby cards", len(cards2))
print(cards2[:15])

# Try to find structured props in flight data
for needle in ["venueid", "VenueID", "listing", "EventName", "eventcode"]:
    print(needle, html2.count(needle))

# Extract visible event titles near /e/ links
for href in cards2[:8]:
    # grab surrounding 400 chars
    i = html2.find(href)
    chunk = html2[max(0, i - 80) : i + 220].replace("\n", " ")
    print("CHUNK", chunk[:280])
