import { maskWallet, type ProfileSnapshot } from "./model"
import { formatLiveSiteLine, type SiteView } from "./siteSession"
import { formatRaWhen, type RaEvent } from "../ra"
import { formatGigWhen, type Gig } from "../whatsOn"
import type { TrailPin } from "field-guide-web4-client"
import { bearingDegrees, haversineMeters } from "../walk/geo"
import { FINSBURY_PARK_CIRCUIT_PLACE_ID } from "../quests/finsburyParkCircuit"
import { DAY_AFTER_TOMORROW_PLACE_ID } from "../quests/dayAfterTomorrow"
import { formatDayAfterTomorrowVoice } from "../quests/dayAfterTomorrowVoice"

export type LiveListings = {
  raEvents: RaEvent[]
  gigs: Gig[]
  nearby: TrailPin[]
}

function formatLiveListings(listings: LiveListings | null): string[] {
  if (!listings) {
    return ["Live listings: not loaded. Call field_guide_map with layer ra, gig, or nearby."]
  }
  const lines: string[] = [
    `Live listings on the Field Guide map: RA ${listings.raEvents.length}, gigs ${listings.gigs.length}, nearby ${listings.nearby.length}.`,
  ]
  lines.push("", `RA (Resident Advisor London, ${listings.raEvents.length}):`)
  for (const e of listings.raEvents.slice(0, 40)) {
    lines.push(
      `- ${formatRaWhen(e.startDate)} ${e.title} @ ${e.venueName} [${e.lat.toFixed(4)}, ${e.lng.toFixed(4)}] ${e.url}`,
    )
  }
  if (listings.raEvents.length > 40) {
    lines.push(`  … ${listings.raEvents.length - 40} more. Call field_guide_map with layer "ra" for the full GeoJSON.`)
  }
  lines.push("", `Gigs (What's On, ${listings.gigs.length}):`)
  for (const g of listings.gigs.slice(0, 24)) {
    lines.push(
      `- ${formatGigWhen(g.startDate)} ${g.name} @ ${g.venueName} [${g.lat.toFixed(4)}, ${g.lng.toFixed(4)}] ${g.url}`,
    )
  }
  if (listings.gigs.length > 24) {
    lines.push(`  … ${listings.gigs.length - 24} more. Call field_guide_map with layer "gig".`)
  }
  if (listings.nearby.length) {
    lines.push("", `STAR nearby (${listings.nearby.length}):`)
    for (const pin of listings.nearby.slice(0, 24)) {
      lines.push(`- ${pin.title || pin.id} [${pin.lat.toFixed(4)}, ${pin.lon.toFixed(4)}]`)
    }
  }
  return lines
}

/** Plain-language pack a connected Claude or ChatGPT can run with. */
export function formatFieldGuideContext(
  snap: ProfileSnapshot,
  live: SiteView | null = null,
  listings: LiveListings | null = null,
): string {
  const wearFromSite = live?.wearingPersonaId
  const wearing = wearFromSite
    ? `${wearFromSite}${live?.wearingClusterId ? ` / ${live.wearingClusterId}` : ""}`
    : `${snap.wearingPersonaName}${snap.wearingClusterLabel ? ` / ${snap.wearingClusterLabel}` : ""}`
  const lines: string[] = [
    "You are the visitor's Field Guide companion for Hitchhiker's Guide to Finsbury Park (London).",
    "The published Field Guide is read-only. Live RA, gigs, nearby, trails, and venues are in this pack. For a plottable map, call field_guide_map with exactly one layer (ra, gig, nearby, trail, place, or personal). Point features are pins. LineString features with properties.kind walk are authored pedestrian routes. Draw those LineStrings. Do not invent street geometry, and do not request every layer in one call.",
    "You cannot edit trails, pins, copy, or the published Field Guide. You cannot drive the visitor's map or You page.",
    "You may add this visitor's photos with field_guide_drop_photo (imageUrl or imageBase64, plus longitude/latitude or pinId). That writes an avatar-parented holon. It is not a GLOVE mint and not a published-trail edit.",
    "The visitor updates their own progress with the same OASIS JWT mint then STAR path. On a phone that only has ChatGPT, call field_guide_look for the pin, then the visitor taps I'm here so phone GPS is sent to field_guide_check_in. ChatGPT's street address is not GPS. Do not geocode the address. Do not invent coordinates. Do not mark a pin collected unless field_guide_check_in returns ok.",
    "Finsbury Park Circuit: five beacons inside the park plus LineString park-circuit-walk. Call field_guide_map with layer trail and placeId trail-finsbury-park-circuit for the walkable path. Guide using pin lat/lon plus the GPS you just sent. Walk either direction from the nearest beacon. field_guide_open_look is only for a desktop Field Guide tab.",
    "Hitchhiker Stoop: one pavement pin outside Hitchhiker House (hitchhiker-stoop). Smoke-test collect first. Call field_guide_look with that pinId, then the visitor taps I'm here.",
    "",
    formatDayAfterTomorrowVoice({
      mintedSitIds: snap.experiences.filter((e) => e.kind === "sit" && e.minted).map((e) => e.pinId),
      selectedPlaceId: live?.selectedPlaceId ?? null,
      selectedPinId: live?.selectedPinId ?? null,
    }),
    "",
    formatLiveSiteLine(live),
    `Avatar: ${snap.signedIn ? snap.avatarName || snap.avatarEmail || snap.avatarId || "signed in" : "guest (no OASIS session)"}`,
    `Wearing: ${wearing}`,
    `Wallet: ${snap.wallet ? maskWallet(snap.wallet) : "none on this avatar"}. For native balance, NFT assets, and the full address call field_guide_wallet. Context only masks the address. There is no send, swap, or sign tool.`,
    `Guides: ${snap.guidesComplete} of ${snap.guides.length} complete. Pins ${snap.pinsCollected} of ${snap.pinsKnown}.`,
  ]
  if (snap.nextStep) {
    lines.push(
      `Next: ${snap.nextStep.title} on ${snap.nextStep.guideName} (${snap.nextStep.pinId}).`,
    )
  } else {
    lines.push("Next: no open objective on the loaded guides.")
  }
  lines.push("", "Guides:")
  for (const g of snap.guides) {
    const quest = g.starQuestId ? ` STAR quest ${g.starQuestId}` : ""
    lines.push(
      `- ${g.name} [${g.placeId}] ${g.collected}/${g.pinIds.length || 0}${g.complete ? " complete" : ""}${quest}`,
    )
    if (g.subtitle) lines.push(`  ${g.subtitle}`)
    if (g.desc) lines.push(`  ${g.desc}`)
    for (const pin of g.pins) {
      lines.push(`  ${pin.order + 1}. ${pin.collected ? "collected" : "open"} ${pin.id} ${pin.title} [${pin.lat.toFixed(5)}, ${pin.lon.toFixed(5)}] r${pin.radiusM}m`)
      if (pin.narrationText) lines.push(`     ${pin.narrationText}`)
      if (pin.directionHint) lines.push(`     Walk: ${pin.directionHint}`)
      if (live?.lat != null && live.lon != null && pin.lat && pin.lon) {
        const m = Math.round(haversineMeters(live.lat, live.lon, pin.lat, pin.lon))
        const brg = Math.round(bearingDegrees(live.lat, live.lon, pin.lat, pin.lon))
        const inRadius = m <= pin.radiusM
        const sitPin = g.placeId === DAY_AFTER_TOMORROW_PLACE_ID && pin.id.startsWith("sit-")
        const radiusHint = sitPin
          ? " · in radius, call field_guide_sit"
          : " · in radius, open Look then Collect"
        lines.push(`     You: ${m}m toward ${brg}°${inRadius ? radiusHint : ""}`)
      }
      if (g.placeId === FINSBURY_PARK_CIRCUIT_PLACE_ID && !pin.collected) {
        lines.push(`     When they should Look, call field_guide_look then field_guide_check_in with pinId ${pin.id} and this phone's lat/lon`)
      }
      if (g.placeId === DAY_AFTER_TOMORROW_PLACE_ID && pin.id.startsWith("sit-") && !pin.collected) {
        lines.push(`     When they should Sit, call field_guide_sit with pinId ${pin.id}. Do not call field_guide_check_in until the sit widget reports ready. Stay on the sit companion voice.`)
      }
    }
  }
  if (snap.experiences.length) {
    lines.push("", "Recorded experiences:")
    for (const e of snap.experiences.slice(0, 24)) {
      lines.push(`- ${e.title} (${e.kind}${e.minted ? ", in wallet" : ""})`)
    }
  }
  lines.push("", ...formatLiveListings(listings))
  return lines.join("\n")
}
