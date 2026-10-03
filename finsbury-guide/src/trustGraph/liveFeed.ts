/**
 * Live Knowledge (RA, Skiddle) enters a Promise-face via the graph:
 * taste (genres, artists), rooms he liked or visited, and where his orbit is going.
 */
import { clustersFor, type DataCluster, type FeedId, type Persona } from "./personas"
import type { Place } from "../places"

export type LivePin = {
  venueName: string
  lng: number
  lat: number
  genres?: string[]
  artists?: string[]
}

/** Same-block only, for rooms that already have a Guide pin. */
export const FEED_DOORSTEP_M = 180

export function haversineM(
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

function foldName(name: string): string {
  return name
    .toLowerCase()
    .replace(/^the\s+/, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
}

export function venueNamesMatch(eventVenue: string, placeName: string): boolean {
  const a = foldName(eventVenue)
  const b = foldName(placeName)
  if (!a || !b) return false
  if (a === b) return true
  if (a.includes(b) || b.includes(a)) return true
  if (
    (a.includes("dome") && b.includes("boston")) ||
    (a.includes("boston") && b.includes("dome"))
  ) {
    return true
  }
  return false
}

function foldGenre(name: string): string {
  return name
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\bdnb\b/g, "drum and bass")
    .replace(/\bukg\b/g, "uk garage")
}

export function labelsOverlap(eventLabels: string[] | undefined, kept: string[] | undefined): boolean {
  if (!eventLabels?.length || !kept?.length) return false
  const e = eventLabels.map(foldGenre)
  for (const raw of kept) {
    const k = foldGenre(raw)
    if (!k) continue
    if (e.some((x) => x === k || x.includes(k) || k.includes(x))) return true
  }
  return false
}

export function feedClusters(
  persona: Persona,
  feed: FeedId,
  clusterId?: string | null,
): DataCluster[] {
  return clustersFor(persona, clusterId).filter((c) =>
    (c.feeds ?? []).includes(feed),
  )
}

export function feedAnchorPlaces(
  persona: Persona,
  places: Place[],
  feed: FeedId,
  clusterId?: string | null,
): Place[] {
  const byId = new Map(places.map((p) => [p.id, p]))
  const out: Place[] = []
  const seen = new Set<string>()
  for (const cluster of feedClusters(persona, feed, clusterId)) {
    for (const id of cluster.placeIds) {
      if (seen.has(id)) continue
      const place = byId.get(id)
      if (!place) continue
      seen.add(id)
      out.push(place)
    }
  }
  return out
}

export function eventFitsPlaces(event: LivePin, places: Place[]): boolean {
  for (const place of places) {
    if (
      venueNamesMatch(event.venueName, place.name) ||
      venueNamesMatch(event.venueName, place.shortName)
    ) {
      return true
    }
    const d = haversineM(
      { lon: event.lng, lat: event.lat },
      { lon: place.coords[0], lat: place.coords[1] },
    )
    if (d <= FEED_DOORSTEP_M) return true
  }
  return false
}

function eventFitsCluster(
  event: LivePin,
  cluster: DataCluster,
  places: Place[],
): boolean {
  if (labelsOverlap(event.genres, cluster.genres)) return true
  if (labelsOverlap(event.artists, cluster.artists)) return true
  for (const name of cluster.likedVenues ?? []) {
    if (venueNamesMatch(event.venueName, name)) return true
  }
  const anchors = cluster.placeIds
    .map((id) => places.find((p) => p.id === id))
    .filter((p): p is Place => Boolean(p))
  if (eventFitsPlaces(event, anchors)) return true
  for (const person of cluster.orbit ?? []) {
    for (const name of person.venueNames ?? []) {
      if (venueNamesMatch(event.venueName, name)) return true
    }
  }
  return false
}

/**
 * Unsigned Guide keeps the full feed. A personal graph keeps events that
 * match taste, liked rooms, visited pins, or an orbit venue.
 */
export function relevantLiveEvents<T extends LivePin>(
  events: T[],
  persona: Persona | null,
  places: Place[],
  feed: FeedId,
  clusterId?: string | null,
): T[] {
  if (!persona) return events
  const clusters = feedClusters(persona, feed, clusterId)
  if (!clusters.length) return []
  return events.filter((e) =>
    clusters.some((c) => eventFitsCluster(e, c, places)),
  )
}
