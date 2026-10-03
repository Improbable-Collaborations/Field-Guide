export type TflArrival = {
  id: string
  modeName: string
  lineName: string
  platformName: string
  towards: string
  destinationName: string
  timeToStation: number
  expectedArrival: string
  currentLocation: string
  vehicleId?: string
}

const TUBE_STOP = "940GZZLUFPK"
const RAIL_STOP = "910GFNPK"

export async function fetchFinsburyArrivals(): Promise<TflArrival[]> {
  const urls = [
    `https://api.tfl.gov.uk/StopPoint/${TUBE_STOP}/Arrivals`,
    `https://api.tfl.gov.uk/StopPoint/${RAIL_STOP}/Arrivals`,
  ]
  const batches = await Promise.all(
    urls.map(async (url) => {
      const res = await fetch(url)
      if (!res.ok) return [] as TflArrival[]
      const data = (await res.json()) as TflArrival[]
      return Array.isArray(data) ? data : []
    }),
  )
  const seen = new Set<string>()
  const out: TflArrival[] = []
  for (const a of batches.flat()) {
    const key =
      a.id ||
      `${a.lineName}|${a.platformName}|${a.expectedArrival}|${a.vehicleId || ""}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push(a)
  }
  out.sort((a, b) => (a.timeToStation ?? 9e9) - (b.timeToStation ?? 9e9))
  return out
}

export function isNorthbound(a: TflArrival): boolean {
  const p = (a.platformName || "").toLowerCase()
  const t = (a.towards || a.destinationName || "").toLowerCase()
  if (p.includes("north") || p.includes("east")) return true
  if (p.includes("south") || p.includes("west")) return false
  if (
    t.includes("walthamstow") ||
    t.includes("cockfosters") ||
    t.includes("arnos") ||
    t.includes("seven sisters") ||
    t.includes("welwyn") ||
    t.includes("hertford") ||
    t.includes("stevenage") ||
    t.includes("cambridge")
  ) {
    return true
  }
  return false
}

export function lineColor(lineName: string): string {
  const n = (lineName || "").toLowerCase()
  if (n.includes("victoria")) return "#0098d4"
  if (n.includes("piccadilly")) return "#003688"
  if (n.includes("thameslink")) return "#e4572e"
  if (n.includes("great northern") || n.includes("northern")) return "#d4a017"
  return "#8a9a8a"
}

export function formatEta(sec: number): string {
  if (sec < 45) return "Due"
  if (sec < 90) return "1 min"
  return `${Math.round(sec / 60)} min`
}
