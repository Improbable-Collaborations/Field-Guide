import type { TrailPin } from "field-guide-web4-client"

export type GeoFix = {
  lat: number
  lon: number
  accuracyM?: number
  headingDeg?: number | null
}

export function geoFixFromCoords(coords: {
  latitude: number
  longitude: number
  accuracy?: number
  heading?: number | null
}): GeoFix {
  const heading = coords.heading
  return {
    lat: coords.latitude,
    lon: coords.longitude,
    accuracyM: Number.isFinite(coords.accuracy) ? coords.accuracy : undefined,
    headingDeg:
      heading == null || Number.isNaN(heading) ? null : heading,
  }
}

/** Walk camera: street canyon, not city overview. */
export const WALK_STREET_ZOOM = 18.2
export const WALK_STREET_PITCH = 58
export const DESK_MAP_ZOOM = 13.2
export const DESK_MAP_PITCH = 42

const EARTH_M = 6371000

export function haversineMeters(
  aLat: number,
  aLon: number,
  bLat: number,
  bLon: number,
): number {
  const r1 = (aLat * Math.PI) / 180
  const r2 = (bLat * Math.PI) / 180
  const dLat = ((bLat - aLat) * Math.PI) / 180
  const dLon = ((bLon - aLon) * Math.PI) / 180
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(r1) * Math.cos(r2) * Math.sin(dLon / 2) ** 2
  return 2 * EARTH_M * Math.asin(Math.min(1, Math.sqrt(h)))
}

export function bearingDegrees(
  fromLat: number,
  fromLon: number,
  toLat: number,
  toLon: number,
): number {
  const phi1 = (fromLat * Math.PI) / 180
  const phi2 = (toLat * Math.PI) / 180
  const dLambda = ((toLon - fromLon) * Math.PI) / 180
  const y = Math.sin(dLambda) * Math.cos(phi2)
  const x =
    Math.cos(phi1) * Math.sin(phi2) -
    Math.sin(phi1) * Math.cos(phi2) * Math.cos(dLambda)
  return (radiansToDeg(Math.atan2(y, x)) + 360) % 360
}

export function shortestAngleDelta(fromDeg: number, toDeg: number): number {
  return ((toDeg - fromDeg + 540) % 360) - 180
}

function radiansToDeg(r: number): number {
  return (r * 180) / Math.PI
}

export function nextUncollectedPin(
  pins: TrailPin[],
  isCollected: (id: string) => boolean,
): TrailPin | null {
  const ordered = [...pins].sort((a, b) => a.order - b.order || a.id.localeCompare(b.id))
  return ordered.find((p) => p.id && !isCollected(p.id)) ?? null
}

export function metersToPin(here: GeoFix | null, pin: TrailPin | null): number | null {
  if (!here || !pin) return null
  if (!Number.isFinite(here.lat) || !Number.isFinite(here.lon)) return null
  if (!Number.isFinite(pin.lat) || !Number.isFinite(pin.lon)) return null
  return haversineMeters(here.lat, here.lon, pin.lat, pin.lon)
}

export function insidePinRadius(here: GeoFix | null, pin: TrailPin | null): boolean {
  const m = metersToPin(here, pin)
  if (m == null || !pin) return false
  const r = Number.isFinite(pin.radiusM) && pin.radiusM > 0 ? pin.radiusM : 40
  return m <= r
}

/** Overlay scale: closer = larger mitt. */
export function lookGloveScale(meters: number | null): number {
  if (meters == null) return 1
  return Math.min(1.45, Math.max(0.38, 55 / Math.max(8, meters)))
}

export function deskWalkRequested(search = ""): boolean {
  const q = search.startsWith("?") ? search.slice(1) : search
  return new URLSearchParams(q).has("deskWalk")
}
