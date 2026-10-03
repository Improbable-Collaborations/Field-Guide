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
        "https://www.skiddle.com/whats-on/London/?latitude=51.5645&longitude=-0.1064&radius=3&order=date",
    ],
    text=True,
    errors="replace",
)

# find /e/ contexts
idxs = [m.start() for m in re.finditer(r"/e/", html)]
print(" /e/ count", len(idxs))
for i in idxs[:6]:
    print(repr(html[i - 40 : i + 80]))

# find listing contexts
for m in re.finditer(r"listingid.{0,40}", html, re.I):
    print("listing", m.group(0))
    break

# Look for escaped JSON in RSC payload
for pat in [
    r"skiddle\.com/e/[^\s\"'\\<>]+",
    r"https:\\+/\\+/www\.skiddle\.com\\+/e\\+/[^\"\\]+",
    r'"link"\s*:\s*"([^"]+)"',
    r'eventname\\?":\\?"([^"\\]+)',
]:
    hits = re.findall(pat, html, re.I)
    print(pat[:40], "->", len(hits), hits[:5])

# Save a slice around first /e/
if idxs:
    open("/tmp/sk_slice.html", "w").write(html[idxs[0] - 500 : idxs[0] + 1500])
    print("wrote /tmp/sk_slice.html")
