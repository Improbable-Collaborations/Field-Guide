import type { TrailPin } from "field-guide-web4-client"
import type { Place } from "../places"
import { JAB_SW1_GLOVES_PLACE_ID, JAB_SW1_GLOVE_PIN_IDS } from "../quests/jabSw1Gloves"
import type { Persona } from "../trustGraph/personas"

export type GuideProgress = {
  placeId: string
  name: string
  trailFile: string
  starQuestId: string
  pinIds: string[]
  collected: number
  complete: boolean
}

export type NextStep = {
  placeId: string
  pinId: string
  title: string
  guideName: string
}

export type Experience = {
  pinId: string
  title: string
  kind: "glove" | "check-in"
  minted: boolean
  placeId: string
}

export type ClusterProgress = {
  id: string
  label: string
  color: string
  placeIds: string[]
  collected: number
  pinTotal: number
}

export type ProfileSnapshot = {
  signedIn: boolean
  avatarName: string
  avatarId: string
  avatarEmail: string
  wallet: string
  wearingPersonaId: string | null
  wearingPersonaName: string
  wearingClusterId: string | null
  wearingClusterLabel: string | null
  clusters: ClusterProgress[]
  guides: GuideProgress[]
  experiences: Experience[]
  nextStep: NextStep | null
  pinsCollected: number
  pinsKnown: number
  guidesComplete: number
}

export function maskWallet(address: string): string {
  const t = address.trim()
  if (!t) return ""
  if (t.length <= 12) return t
  return `${t.slice(0, 4)}…${t.slice(-4)}`
}

function trailKey(place: Place): string {
  return (place.trailFile || "").replace(/\.geojson$/i, "")
}

function pinIdsForGuide(place: Place, trailPins: TrailPin[]): string[] {
  if (place.id === JAB_SW1_GLOVES_PLACE_ID) {
    const known = JAB_SW1_GLOVE_PIN_IDS as readonly string[]
    const loaded = trailPins.filter((p) => p.trail === "jab-sw1-gloves" || known.includes(p.id)).map((p) => p.id)
    return loaded.length ? [...new Set(loaded)] : [...JAB_SW1_GLOVE_PIN_IDS]
  }
  const key = trailKey(place)
  return trailPins.filter((p) => p.trail === key).map((p) => p.id)
}

function collectedSet(checkedIn: string[], minted: string[]): Set<string> {
  const ids = [...checkedIn, ...minted].map((id) => id.toLowerCase())
  return new Set(ids)
}

function titleForPin(pinId: string, trailPins: TrailPin[]): string {
  return trailPins.find((p) => p.id === pinId)?.title || pinId
}

export function buildProfileSnapshot(args: {
  signedIn: boolean
  avatarName: string
  avatarId: string
  avatarEmail: string
  wallet: string
  persona: Persona | null
  clusterId: string | null
  places: Place[]
  trailPins: TrailPin[]
  checkedInIds: string[]
  mintedIds: string[]
}): ProfileSnapshot {
  const done = collectedSet(args.checkedInIds, args.mintedIds)
  const minted = new Set(args.mintedIds.map((id) => id.toLowerCase()))
  const graphPlaces = args.persona
    ? args.places.filter((p) => args.persona!.clusters.some((c) => c.placeIds.includes(p.id)))
    : args.places

  const guidePlaces = graphPlaces.filter((p) => Boolean(p.trailFile))
  const guides: GuideProgress[] = guidePlaces.map((place) => {
    const pinIds = pinIdsForGuide(place, args.trailPins)
    const collected = pinIds.filter((id) => done.has(id.toLowerCase())).length
    return {
      placeId: place.id,
      name: place.name,
      trailFile: place.trailFile || "",
      starQuestId: place.starQuestId || "",
      pinIds,
      collected,
      complete: pinIds.length > 0 && collected >= pinIds.length,
    }
  })

  const clusters: ClusterProgress[] = (args.persona?.clusters ?? []).map((cluster) => {
    const clusterGuides = guides.filter((g) => cluster.placeIds.includes(g.placeId))
    const pinTotal = clusterGuides.reduce((n, g) => n + g.pinIds.length, 0)
    const collected = clusterGuides.reduce((n, g) => n + g.collected, 0)
    return {
      id: cluster.id,
      label: cluster.label,
      color: cluster.color,
      placeIds: cluster.placeIds,
      collected,
      pinTotal,
    }
  })

  const wearing = args.persona?.clusters.find((c) => c.id === args.clusterId) ?? null

  const experienceIds = [...new Set([...args.mintedIds, ...args.checkedInIds])]
  const experiences: Experience[] = experienceIds.map((pinId) => {
    const pin = args.trailPins.find((p) => p.id === pinId)
    const glove = pinId.toLowerCase().startsWith("glove-") || pin?.dropKind === "glove"
    const place = args.places.find((p) => p.trailFile && pinIdsForGuide(p, args.trailPins).includes(pinId))
    return {
      pinId,
      title: titleForPin(pinId, args.trailPins),
      kind: glove ? "glove" : "check-in",
      minted: minted.has(pinId.toLowerCase()),
      placeId: place?.id || "",
    }
  })

  const guidesSorted = [...guides].sort((a, b) => {
    const rank = (g: GuideProgress) => (g.complete ? 2 : g.collected > 0 ? 0 : 1)
    return rank(a) - rank(b)
  })

  let nextStep: NextStep | null = null
  for (const g of guidesSorted) {
    if (!g.pinIds.length || g.complete) continue
    const pinId = g.pinIds.find((id) => !done.has(id.toLowerCase()))
    if (!pinId) continue
    nextStep = {
      placeId: g.placeId,
      pinId,
      title: titleForPin(pinId, args.trailPins),
      guideName: g.name,
    }
    break
  }

  return {
    signedIn: args.signedIn,
    avatarName: args.avatarName,
    avatarId: args.avatarId,
    avatarEmail: args.avatarEmail,
    wallet: args.wallet,
    wearingPersonaId: args.persona?.id ?? null,
    wearingPersonaName: args.persona?.name ?? "Published map",
    wearingClusterId: wearing?.id ?? null,
    wearingClusterLabel: wearing?.label ?? null,
    clusters,
    guides: guidesSorted,
    experiences,
    nextStep,
    pinsCollected: guides.reduce((n, g) => n + g.collected, 0),
    pinsKnown: guides.reduce((n, g) => n + g.pinIds.length, 0),
    guidesComplete: guides.filter((g) => g.complete).length,
  }
}
