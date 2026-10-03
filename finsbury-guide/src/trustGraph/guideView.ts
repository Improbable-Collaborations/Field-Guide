import type { Place } from "../places"
import {
  clusterFeeds,
  clusterPlaceIds,
  type DataCluster,
  type FeedId,
  type GuideLayer,
  type Persona,
} from "./personas"

export function layerForPlace(place: Place): GuideLayer | null {
  if (place.type === "anchor") return null
  const t = place.type
  if (
    t === "park" ||
    t === "transit" ||
    t === "culture" ||
    t === "sport" ||
    t === "music" ||
    t === "hq" ||
    t === "trail"
  ) {
    return t
  }
  return null
}

export function layersFromClusters(
  persona: Persona,
  places: Place[],
  clusterId?: string | null,
): GuideLayer[] {
  const byId = new Map(places.map((p) => [p.id, p]))
  const layers = new Set<GuideLayer>()
  const placeIds = clusterPlaceIds(persona, clusterId)
  for (const id of placeIds) {
    const place = byId.get(id)
    if (!place) continue
    const layer = layerForPlace(place)
    if (layer) layers.add(layer)
  }
  for (const feed of clusterFeeds(persona, clusterId)) layers.add(feed)
  return [...layers]
}

export function personaShowsLayer(
  persona: Persona | null,
  layer: GuideLayer,
  places: Place[],
  clusterId?: string | null,
): boolean {
  if (!persona) return true
  return layersFromClusters(persona, places, clusterId).includes(layer)
}

/**
 * Promise-face: this place sits on one of the person's claimed clusters.
 */
export function personaAllowsPlace(
  persona: Persona | null,
  place: Place,
  clusterId?: string | null,
): boolean {
  if (!persona) return true
  return clusterPlaceIds(persona, clusterId).has(place.id)
}

export function visiblePlaces(
  places: Place[],
  persona: Persona | null,
  clusterId?: string | null,
): Place[] {
  return places.filter((p) => personaAllowsPlace(persona, p, clusterId))
}

export function visiblePlaceIds(
  places: Place[],
  persona: Persona | null,
  clusterId?: string | null,
): string[] {
  return visiblePlaces(places, persona, clusterId).map((p) => p.id)
}

export function clusterMemberNames(
  cluster: DataCluster,
  places: Place[],
): string[] {
  const byId = new Map(places.map((p) => [p.id, p]))
  return cluster.placeIds
    .map((id) => byId.get(id)?.name)
    .filter((n): n is string => Boolean(n))
}

export function clusterFeedLabels(feeds: FeedId[]): string[] {
  return feeds.map((f) => {
    if (f === "ra") return "RA London"
    if (f === "gigs") return "Skiddle"
    return "STAR nearby"
  })
}

export type ClusterStory = {
  id: string
  label: string
  short: string
  color: string
  count: number
  preview: string[]
  live: string[]
}

export function clusterStories(
  persona: Persona,
  places: Place[],
): ClusterStory[] {
  return persona.clusters.map((cluster) => {
    const names = clusterMemberNames(cluster, places)
    const extra = cluster.likedVenues ?? []
    const people = (cluster.orbit ?? []).map((p) => p.alias)
    const taste = cluster.genres ?? []
    return {
      id: cluster.id,
      label: cluster.label,
      short: cluster.short,
      color: cluster.color,
      count: names.length + extra.length,
      preview: [...names.slice(0, 2), ...extra.slice(0, 2)].slice(0, 3),
      live: [
        ...taste.slice(0, 3),
        ...people.map((n) => `${n} going`),
        ...clusterFeedLabels(cluster.feeds ?? []),
      ],
    }
  })
}

export function clusterForPlace(
  persona: Persona | null,
  placeId: string,
): DataCluster | null {
  if (!persona) return null
  return persona.clusters.find((c) => c.placeIds.includes(placeId)) ?? null
}
