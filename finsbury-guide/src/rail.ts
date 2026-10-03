/**
 * Path math for rail / tube corridors (lon/lat GeoJSON order).
 */

export type LngLat = [number, number]

function haversineM(a: LngLat, b: LngLat): number {
  const R = 6371000
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(b[1] - a[1])
  const dLon = toRad(b[0] - a[0])
  const lat1 = toRad(a[1])
  const lat2 = toRad(b[1])
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

export type RailPath = {
  coords: LngLat[]
  cumDist: number[]
  totalLength: number
  /** Distance along path of Finsbury Park station. */
  stationDist: number
}

export function buildRailPath(
  coords: LngLat[],
  station: LngLat = [-0.1064, 51.5645],
): RailPath {
  const cumDist = [0]
  for (let i = 1; i < coords.length; i++) {
    cumDist.push(cumDist[i - 1] + haversineM(coords[i - 1], coords[i]))
  }
  let stationDist = 0
  let best = Infinity
  for (let i = 0; i < coords.length; i++) {
    const d = haversineM(station, coords[i])
    if (d < best) {
      best = d
      stationDist = cumDist[i]
    }
  }
  return { coords, cumDist, totalLength: cumDist[cumDist.length - 1] || 1, stationDist }
}

export function pointAlong(
  path: RailPath,
  distanceM: number,
): { lngLat: LngLat; bearing: number } {
  const d = Math.max(0, Math.min(path.totalLength, distanceM))
  let i = 1
  while (i < path.cumDist.length && path.cumDist[i] < d) i++
  const i0 = Math.max(0, i - 1)
  const i1 = Math.min(path.coords.length - 1, i)
  const segLen = path.cumDist[i1] - path.cumDist[i0] || 1
  const t = (d - path.cumDist[i0]) / segLen
  const a = path.coords[i0]
  const b = path.coords[i1]
  const lngLat: LngLat = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]
  const bearing = (Math.atan2(b[0] - a[0], b[1] - a[1]) * 180) / Math.PI
  return { lngLat, bearing }
}

/** Place a service approaching the station by ETA. */
export function approachDistance(
  path: RailPath,
  timeToStationSec: number,
  northbound: boolean,
  speedMps = 14,
): number {
  const approach = Math.min(path.totalLength * 0.45, Math.max(40, timeToStationSec * speedMps))
  if (northbound) {
    return Math.max(0, path.stationDist - approach)
  }
  return Math.min(path.totalLength, path.stationDist + approach)
}
