import type { TrailPin } from "field-guide-web4-client"
import type { Place } from "../places"
import type { PersonalPhoto } from "../profile/personalPhoto"
import type { RaEvent } from "../ra"
import type { Gig } from "../whatsOn"
import { loadAuthoredTrailPins, loadAuthoredTrailRoutes } from "./loadTrailPins"
import { dayAfterTomorrowPinVisible, DAY_AFTER_TOMORROW_PLACE_ID } from "../quests/dayAfterTomorrow"

export type FieldGuideMapFeature = {
  type: "Feature"
  geometry:
    | { type: "Point"; coordinates: [number, number] }
    | { type: "LineString"; coordinates: [number, number][] }
  properties: Record<string, unknown>
}

export type FieldGuideMap = {
  type: "FeatureCollection"
  name: string
  description: string
  layerCounts: Record<string, number>
  features: FieldGuideMapFeature[]
}

function collectedSet(ids: string[]): Set<string> {
  return new Set(ids.map((id) => id.toLowerCase()))
}

/** GeoJSON of the published Field Guide map. Same trails and venues the site draws. Read only. */
export function buildFieldGuideMap(args: {
  places: Place[]
  collectedIds?: string[]
  mintedIds?: string[]
  placeId?: string
  layer?: string
  personalPhotos?: PersonalPhoto[]
  raEvents?: RaEvent[]
  gigs?: Gig[]
  nearby?: TrailPin[]
}): FieldGuideMap {
  const placeId = args.placeId?.trim() || ""
  const places = placeId ? args.places.filter((p) => p.id === placeId) : args.places
  if (placeId && !places.length) {
    throw new Error(`Unknown placeId ${placeId}. Use a Field Guide place id such as trail-jab-sw1-gloves.`)
  }

  const layer = args.layer?.trim().toLowerCase() || "all"
  if (layer !== "all" && !["trail", "place", "personal", "ra", "gig", "nearby"].includes(layer)) {
    throw new Error(`Unknown layer ${layer}. Use trail, place, personal, ra, gig, nearby, or omit for all.`)
  }
  const include = (source: string) => layer === "all" || layer === source

  const done = collectedSet(args.collectedIds ?? [])
  const trailFilter = new Set(
    places.map((p) => (p.trailFile || "").replace(/\.geojson$/i, "")).filter(Boolean),
  )
  const minted = args.mintedIds ?? args.collectedIds ?? []
  const pins = loadAuthoredTrailPins(args.places).filter((pin) => {
    if (placeId && !trailFilter.has(pin.trail)) return false
    return dayAfterTomorrowPinVisible({
      pin,
      activeTrailId: placeId || DAY_AFTER_TOMORROW_PLACE_ID,
      mintedPinIds: minted,
    })
  })

  const features: FieldGuideMapFeature[] = include("trail")
    ? pins.map((pin) => ({
        type: "Feature",
        geometry: { type: "Point", coordinates: [pin.lon, pin.lat] },
        properties: {
          source: "trail",
          id: pin.id,
          title: pin.title,
          trail: pin.trail,
          collected: done.has(pin.id.toLowerCase()),
        },
      }))
    : []

  if (include("trail")) {
    const routes = loadAuthoredTrailRoutes(args.places).filter((route) => {
      if (!placeId) return true
      return trailFilter.has(route.trail)
    })
    for (const route of routes) {
      features.push({
        type: "Feature",
        geometry: { type: "LineString", coordinates: route.coordinates },
        properties: {
          source: "trail",
          kind: "walk",
          id: route.id,
          title: route.title,
          trail: route.trail,
          pinIds: route.pinIds,
        },
      })
    }
  }

  if (include("place")) {
    for (const place of places) {
      features.push({
        type: "Feature",
        geometry: { type: "Point", coordinates: place.coords },
        properties: {
          source: "place",
          id: place.id,
          title: place.name,
          type: place.type,
          subtitle: place.subtitle || "",
          trailFile: place.trailFile || "",
          starQuestId: place.starQuestId || "",
        },
      })
    }
  }

  if (include("personal")) {
    for (const photo of args.personalPhotos ?? []) {
      features.push({
        type: "Feature",
        geometry: { type: "Point", coordinates: [photo.lon, photo.lat] },
        properties: {
          source: "personal",
          id: photo.id,
          title: photo.caption,
          imageUrl: photo.imageUrl,
          pinId: photo.pinId,
          placeId: photo.placeId,
        },
      })
    }
  }

  if (include("ra")) {
    for (const event of args.raEvents ?? []) {
      features.push({
        type: "Feature",
        geometry: { type: "Point", coordinates: [event.lng, event.lat] },
        properties: {
          source: "ra",
          id: event.id,
          title: event.title,
          venue: event.venueName,
          when: event.startDate,
          url: event.url,
        },
      })
    }
  }

  if (include("gig")) {
    for (const gig of args.gigs ?? []) {
      features.push({
        type: "Feature",
        geometry: { type: "Point", coordinates: [gig.lng, gig.lat] },
        properties: {
          source: "gig",
          id: gig.id,
          title: gig.name,
          venue: gig.venueName,
          when: gig.startDate,
          url: gig.url,
        },
      })
    }
  }

  if (include("nearby")) {
    for (const pin of args.nearby ?? []) {
      features.push({
        type: "Feature",
        geometry: { type: "Point", coordinates: [pin.lon, pin.lat] },
        properties: {
          source: "nearby",
          id: pin.id,
          title: pin.title,
        },
      })
    }
  }

  const layerCounts: Record<string, number> = {}
  for (const f of features) {
    const source = String(f.properties.source || "unknown")
    layerCounts[source] = (layerCounts[source] || 0) + 1
  }

  return {
    type: "FeatureCollection",
    name: placeId || "hitchhikers-field-guide",
    description:
      "Hitchhiker's Field Guide map. Point features are beacons and listings. LineString features with properties.kind walk are authored pedestrian routes. Rehydrate from these geometries. Do not invent street or path coordinates.",
    layerCounts,
    features,
  }
}
