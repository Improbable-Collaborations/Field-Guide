#!/usr/bin/env python3
import datetime
import json
import subprocess

today = datetime.date.today().isoformat()
end = (datetime.date.today() + datetime.timedelta(days=14)).isoformat()

query = """
query GET_EVENT_LISTINGS($filters: FilterInputDtoInput, $pageSize: Int, $page: Int) {
  eventListings(filters: $filters, pageSize: $pageSize, page: $page) {
    data {
      id
      listingDate
      event {
        id
        title
        date
        startTime
        endTime
        contentUrl
        attending
        isTicketed
        venue {
          id
          name
          contentUrl
          address
          area { id name urlName }
          location { latitude longitude }
        }
        artists { id name }
        genres { id name }
      }
    }
    totalResults
  }
}
"""

body = {
    "operationName": "GET_EVENT_LISTINGS",
    "variables": {
        "filters": {
            "areas": {"eq": 13},
            "listingDate": {"gte": today, "lte": end},
        },
        "pageSize": 50,
        "page": 1,
    },
    "query": query,
}

open("/tmp/ra_body.json", "w").write(json.dumps(body))

cmd = [
    "curl",
    "-sS",
    "--max-time",
    "30",
    "-A",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "-H",
    "Content-Type: application/json",
    "-H",
    "Accept: application/json",
    "-H",
    "Referer: https://ra.co/events/uk/london",
    "-H",
    "Origin: https://ra.co",
    "-X",
    "POST",
    "https://ra.co/graphql",
    "--data-binary",
    "@/tmp/ra_body.json",
    "-o",
    "/tmp/ra_gql.json",
    "-w",
    "%{http_code} %{size_download}\n",
]
print(subprocess.check_output(cmd, text=True))

j = json.load(open("/tmp/ra_gql.json"))
if "errors" in j:
    print("errors", json.dumps(j["errors"], indent=2)[:800])
data = ((j.get("data") or {}).get("eventListings") or {})
rows = data.get("data") or []
print("total", data.get("totalResults"), "page", len(rows))
with_geo = 0
for row in rows[:12]:
    e = row.get("event") or {}
    v = e.get("venue") or {}
    loc = v.get("location") or {}
    if loc.get("latitude") is not None:
        with_geo += 1
    arts = ", ".join(a.get("name", "") for a in (e.get("artists") or [])[:3])
    print(
        f"{e.get('title','')[:42]} | {v.get('name')} | {loc.get('latitude')},{loc.get('longitude')} | {e.get('startTime') or e.get('date')} | {arts}"
    )
print("with_geo in sample", with_geo)
