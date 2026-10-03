/** Resident Advisor London listings via ra.co GraphQL (Vite proxy). */

export type RaEvent = {
  id: string
  title: string
  venueName: string
  startDate: string
  endDate?: string
  url: string
  lng: number
  lat: number
  artists: string[]
  genres: string[]
  attending?: number
  interested?: number
  address?: string
  areaName?: string
  content?: string
  imageUrl?: string
  cost?: string
  isTicketed?: boolean
  minimumAge?: string | number | null
}

const LONDON_AREA_ID = 13
const DAYS_AHEAD = 10
const PAGE_SIZE = 80
const MAX_PAGES = 40
/** RA London listings are dated on the venue's calendar, not UTC. */
export const RA_LISTING_TZ = "Europe/London"

export function calendarDate(d: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d)
  const y = parts.find((p) => p.type === "year")?.value
  const m = parts.find((p) => p.type === "month")?.value
  const day = parts.find((p) => p.type === "day")?.value
  if (!y || !m || !day) throw new Error("calendarDate: missing parts")
  return `${y}-${m}-${day}`
}

function addCalendarDays(ymd: string, days: number): string {
  const [y, m, d] = ymd.split("-").map(Number)
  if (!y || !m || !d) throw new Error(`bad calendar day ${ymd}`)
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10)
}

export function listingDateWindow(
  now = new Date(),
  daysAhead = DAYS_AHEAD,
  timeZone = RA_LISTING_TZ,
): { gte: string; lte: string } {
  const gte = calendarDate(now, timeZone)
  return { gte, lte: addCalendarDays(gte, daysAhead) }
}

/** Rough Greater London bbox; drops RA placeholder coords like 52,0. */
function isLondonish(lat: number, lng: number): boolean {
  return lat >= 51.28 && lat <= 51.72 && lng >= -0.55 && lng <= 0.35
}

const LISTINGS_QUERY = `
query GET_EVENT_LISTINGS($filters: FilterInputDtoInput, $pageSize: Int, $page: Int) {
  eventListings(filters: $filters, pageSize: $pageSize, page: $page) {
    data {
      id
      event {
        id
        title
        date
        startTime
        endTime
        contentUrl
        attending
        interestedCount
        isTicketed
        cost
        minimumAge
        content
        flyerFront
        images { filename }
        venue {
          id
          name
          address
          contentUrl
          area { name }
          location { latitude longitude }
        }
        artists { id name }
        genres { id name }
      }
    }
    totalResults
  }
}
`

function eventUrl(contentUrl: string | undefined, id: string): string {
  if (contentUrl?.startsWith("http")) return contentUrl
  if (contentUrl?.startsWith("/")) return `https://ra.co${contentUrl}`
  return `https://ra.co/events/${id}`
}

type GqlRow = {
  event?: {
    id?: string
    title?: string
    date?: string
    startTime?: string
    endTime?: string
    contentUrl?: string
    attending?: number
    interestedCount?: number
    isTicketed?: boolean
    cost?: string
    minimumAge?: string | number | null
    content?: string
    flyerFront?: string | null
    images?: Array<{ filename?: string }>
    venue?: {
      name?: string
      address?: string
      area?: { name?: string }
      location?: { latitude?: number; longitude?: number }
    }
    artists?: Array<{ name?: string }>
    genres?: Array<{ name?: string }>
  }
}

function rowToEvent(row: GqlRow): RaEvent | null {
  const e = row.event
  if (!e?.id || !e.title) return null
  const loc = e.venue?.location
  const lat = Number(loc?.latitude)
  const lng = Number(loc?.longitude)
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
  if (!isLondonish(lat, lng)) return null
  const imageUrl =
    e.flyerFront ||
    e.images?.find((i) => i.filename)?.filename ||
    undefined
  return {
    id: String(e.id),
    title: e.title.trim(),
    venueName: (e.venue?.name || "Venue").trim(),
    startDate: e.startTime || e.date || "",
    endDate: e.endTime,
    url: eventUrl(e.contentUrl, String(e.id)),
    lng,
    lat,
    artists: (e.artists || []).map((a) => a.name || "").filter(Boolean),
    genres: (e.genres || []).map((g) => g.name || "").filter(Boolean),
    attending: e.attending,
    interested: e.interestedCount,
    address: e.venue?.address,
    areaName: e.venue?.area?.name,
    content: e.content?.trim() || undefined,
    imageUrl,
    cost: e.cost?.trim() || undefined,
    isTicketed: e.isTicketed,
    minimumAge: e.minimumAge,
  }
}

async function fetchPage(page: number, gte: string, lte: string): Promise<{
  events: RaEvent[]
  total: number
  rowCount: number
}> {
  const res = await fetch("/api/ra/graphql", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      operationName: "GET_EVENT_LISTINGS",
      query: LISTINGS_QUERY,
      variables: {
        filters: {
          areas: { eq: LONDON_AREA_ID },
          listingDate: { gte, lte },
        },
        pageSize: PAGE_SIZE,
        page,
      },
    }),
  })
  if (!res.ok) throw new Error(`RA GraphQL ${res.status}`)
  const json = (await res.json()) as {
    errors?: unknown[]
    data?: { eventListings?: { data?: GqlRow[]; totalResults?: number } }
  }
  if (json.errors?.length) {
    const first = json.errors[0]
    const msg =
      first && typeof first === "object" && "message" in first
        ? String((first as { message: unknown }).message)
        : "RA GraphQL errors"
    throw new Error(msg)
  }
  const listing = json.data?.eventListings
  const rows = listing?.data || []
  return {
    events: rows.map(rowToEvent).filter((e): e is RaEvent => Boolean(e)),
    total: listing?.totalResults ?? rows.length,
    rowCount: rows.length,
  }
}

export function formatRaWhen(iso: string): string {
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

/** Next ~10 London calendar days of electronic listings with mappable venues. */
export async function fetchRaLondon(now = new Date()): Promise<RaEvent[]> {
  const { gte, lte } = listingDateWindow(now)
  const all: RaEvent[] = []
  let page = 1
  let total = Number.POSITIVE_INFINITY

  while ((page - 1) * PAGE_SIZE < total) {
    if (page > MAX_PAGES) {
      throw new Error(`RA listed more than ${MAX_PAGES * PAGE_SIZE} events`)
    }
    const batch = await fetchPage(page, gte, lte)
    total = batch.total
    if (page === 1 && batch.rowCount === 0 && total > 0) {
      throw new Error("RA returned no rows for a non-empty listing window")
    }
    if (batch.rowCount === 0) break
    all.push(...batch.events)
    page += 1
  }

  const seen = new Set<string>()
  const out: RaEvent[] = []
  for (const e of all) {
    const key = `${e.id}|${e.startDate}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push(e)
  }
  out.sort((a, b) => a.startDate.localeCompare(b.startDate))
  return out
}
