import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import type { TrailPin } from "field-guide-web4-client"
import type { Place } from "../places"

const trailsDir = join(dirname(fileURLToPath(import.meta.url)), "../../public/trails")

function emptyPin(partial: Partial<TrailPin> & Pick<TrailPin, "id">): TrailPin {
  return {
    title: partial.id,
    lat: 0,
    lon: 0,
    radiusM: 40,
    order: 0,
    questRole: "",
    trail: "",
    wikiSlug: "",
    place: "",
    notes: "",
    narrationText: "",
    directionHint: "",
    audioUrl: "",
    markerStyle: "",
    worldPrefab: "",
    trustOrigin: "",
    peerDisplayName: "",
    peerAvatarId: "",
    trustAudience: "",
    imageUrl: "",
    fileUrl: "",
    dropKind: "",
    vaultId: "",
    temperament: "",
    forgeAttestationId: "",
    principalNotionalUsd: 0,
    ...partial,
  }
}

export function trailPinsFromFeatureCollection(raw: unknown): TrailPin[] {
  if (!raw || typeof raw !== "object") return []
  const features = (raw as { features?: unknown }).features
  if (!Array.isArray(features)) return []
  const pins: TrailPin[] = []
  for (const feature of features) {
    if (!feature || typeof feature !== "object") continue
    const rec = feature as { geometry?: { coordinates?: unknown }; properties?: Record<string, unknown> }
    const props = rec.properties
    const id = typeof props?.id === "string" ? props.id : ""
    if (!id) continue
    const coords = rec.geometry?.coordinates
    const lon = Array.isArray(coords) && typeof coords[0] === "number" ? coords[0] : 0
    const lat = Array.isArray(coords) && typeof coords[1] === "number" ? coords[1] : 0
    pins.push(
      emptyPin({
        id,
        title: typeof props.title === "string" && props.title ? props.title : id,
        lat,
        lon,
        radiusM: typeof props.radiusM === "number" ? props.radiusM : 40,
        order: typeof props.order === "number" ? props.order : 0,
        questRole: typeof props.questRole === "string" ? props.questRole : "",
        trail: typeof props.trail === "string" ? props.trail : "",
        wikiSlug: typeof props.wikiSlug === "string" ? props.wikiSlug : "",
        place: typeof props.place === "string" ? props.place : "",
        notes: typeof props.notes === "string" ? props.notes : "",
        narrationText: typeof props.narrationText === "string" ? props.narrationText : "",
        directionHint: typeof props.directionHint === "string" ? props.directionHint : "",
        dropKind: typeof props.dropKind === "string" ? props.dropKind : "",
        imageUrl: typeof props.imageUrl === "string" ? props.imageUrl : "",
      }),
    )
  }
  return pins
}

export function loadAuthoredTrailPins(places: Place[]): TrailPin[] {
  const files = [...new Set(places.map((p) => p.trailFile).filter((f): f is string => Boolean(f)))]
  const pins: TrailPin[] = []
  for (const file of files) {
    const path = join(trailsDir, file)
    const text = readFileSync(path, "utf8")
    pins.push(...trailPinsFromFeatureCollection(JSON.parse(text) as unknown))
  }
  return pins
}
