/** Live "what's on" from Skiddle Event JSON-LD (via Vite proxy). */

export type Gig = {
  id: string
  name: string
  venueName: string
  startDate: string
  url: string
  lng: number
  lat: number
  image?: string
  description?: string
  price?: string
}

type LdEvent = {
  "@type"?: string
  name?: string
  url?: string
  startDate?: string
  description?: string
  image?: string | string[]
  location?: {
    name?: string
    geo?: { latitude?: string | number; longitude?: string | number }
  }
  offers?: { price?: string | number; priceCurrency?: string } | Array<{
    price?: string | number
    priceCurrency?: string
  }>
}

const FPK = { lat: 51.5645, lon: -0.1064 }
const RADIUS_M = 4500

function haversineM(
  a: { lon: number; lat: number },
  b: { lon: number; lat: number },
): number {
  const R = 6371000
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLon = toRad(b.lon - a.lon)
  const lat1 = toRad(a.lat)
  const lat2 = toRad(b.lat)
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

function parseLdEvents(html: string): Gig[] {
  const gigs: Gig[] = []
  const re =
    /<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(html))) {
    let data: unknown
    try {
      data = JSON.parse(m[1])
    } catch {
      continue
    }
    const items = Array.isArray(data) ? data : [data]
    for (const item of items) {
      const gig = ldToGig(item as LdEvent)
      if (gig) gigs.push(gig)
    }
  }
  return gigs
}

function ldToGig(e: LdEvent): Gig | null {
  if (!e || e["@type"] !== "Event") return null
  const geo = e.location?.geo
  if (!geo) return null
  const lat = Number(geo.latitude)
  const lng = Number(geo.longitude)
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
  if (!e.name || !e.url || !e.startDate) return null
  const offers = Array.isArray(e.offers) ? e.offers[0] : e.offers
  const image = Array.isArray(e.image) ? e.image[0] : e.image
  return {
    id: e.url,
    name: e.name.trim(),
    venueName: (e.location?.name || "Venue").trim(),
    startDate: e.startDate,
    url: e.url,
    lng,
    lat,
    image,
    description: e.description?.trim(),
    price:
      offers?.price != null
        ? `${offers.priceCurrency || "GBP"} ${offers.price}`
        : undefined,
  }
}

function dedupe(gigs: Gig[]): Gig[] {
  const seen = new Set<string>()
  const out: Gig[] = []
  for (const g of gigs) {
    const key = `${g.url}|${g.startDate}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push(g)
  }
  return out
}

const SKIP_NAME =
  /hop-on hop-off|thames river cruise|lion king|last ship|central london/i

export function filterLocalGigs(gigs: Gig[]): Gig[] {
  return gigs
    .filter((g) => {
      if (SKIP_NAME.test(g.name) || SKIP_NAME.test(g.venueName)) return false
      const d = haversineM(FPK, { lon: g.lng, lat: g.lat })
      return d <= RADIUS_M
    })
    .sort((a, b) => a.startDate.localeCompare(b.startDate))
}

export function formatGigWhen(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  })
}

/** Match a gig to a curated place by venue name proximity. */
export function gigMatchesVenue(
  gig: Gig,
  venueName: string,
  venueCoords: [number, number],
): boolean {
  const a = gig.venueName.toLowerCase()
  const b = venueName.toLowerCase()
  if (a.includes(b) || b.includes(a)) return true
  // Boston Music Room ↔ The Dome complex
  if (
    (a.includes("dome") && b.includes("boston")) ||
    (a.includes("boston") && b.includes("dome"))
  ) {
    return true
  }
  const d = haversineM(
    { lon: gig.lng, lat: gig.lat },
    { lon: venueCoords[0], lat: venueCoords[1] },
  )
  return d < 120
}

async function fetchSkiddleHtml(pathAndQuery: string): Promise<string> {
  const url = `/api/skiddle${pathAndQuery.startsWith("/") ? "" : "/"}${pathAndQuery}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Skiddle ${res.status}`)
  return res.text()
}

/**
 * Pull nearby listings + a few known venue pages, parse Event JSON-LD.
 */
export async function fetchWhatsOn(): Promise<Gig[]> {
  const paths = [
    `/whats-on/London/?latitude=${FPK.lat}&longitude=${FPK.lon}&radius=3&order=date`,
    "/whats-on/London/Nambucca/",
    "/whats-on/London/The-Dome/",
    "/whats-on/London/The-Garage/",
    "/whats-on/London/Union-Chapel/",
    "/whats-on/London/Islington-Assembly-Hall/",
    "/whats-on/London/O2-Academy-Islington/",
    "/whats-on/London/O2-Forum-Kentish-Town/",
    "/whats-on/London/Alexandra-Palace/",
  ]
  const pages = await Promise.all(
    paths.map(async (p) => {
      try {
        return await fetchSkiddleHtml(p)
      } catch {
        return ""
      }
    }),
  )
  const all = pages.flatMap((html) => (html ? parseLdEvents(html) : []))
  return filterLocalGigs(dedupe(all))
}
