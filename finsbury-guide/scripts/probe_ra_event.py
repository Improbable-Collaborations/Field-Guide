#!/usr/bin/env python3
import json
import subprocess

# Probe event detail query shapes
candidates = [
    (
        "EVENT",
        """
query ($id: ID!) {
  event(id: $id) {
    id
    title
    date
    startTime
    endTime
    contentUrl
    attending
    interested
    isTicketed
    isFestival
    cost
    minimumAge
    content
    flyerFront
    images { filename path id }
    venue {
      id name address contentUrl
      location { latitude longitude }
      area { name }
    }
    artists { id name contentUrl }
    genres { id name }
    promoters { id name }
    tickets { id title validType soldOut onSaleFrom priceStandard currency }
  }
}
""",
        {"id": "2393339"},
    ),
    (
        "EVENT2",
        """
query ($id: ID!) {
  event(id: $id) {
    id
    title
    date
    startTime
    endTime
    contentUrl
    attending
    interested
    isTicketed
    cost
    minimumAge
    blurb
    content
    images { filename }
    venue { id name address contentUrl location { latitude longitude } }
    artists { id name }
    genres { id name }
  }
}
""",
        {"id": "2393339"},
    ),
]

for name, query, variables in candidates:
    body = {"operationName": name, "query": query, "variables": variables}
    open("/tmp/ra_ev_q.json", "w").write(json.dumps(body))
    out = subprocess.check_output(
        [
            "curl",
            "-sS",
            "--max-time",
            "25",
            "-A",
            "Mozilla/5.0",
            "-H",
            "Content-Type: application/json",
            "-H",
            "Referer: https://ra.co/events/uk/london",
            "-H",
            "Origin: https://ra.co",
            "-X",
            "POST",
            "https://ra.co/graphql",
            "--data-binary",
            "@/tmp/ra_ev_q.json",
        ],
        text=True,
        errors="replace",
    )
    j = json.loads(out)
    print("\n===", name, "===")
    if j.get("errors"):
        print("errors:", json.dumps(j["errors"], indent=2)[:700])
    else:
        ev = (j.get("data") or {}).get("event") or {}
        print("keys", sorted(ev.keys()))
        print(json.dumps(ev, indent=2)[:1200])
