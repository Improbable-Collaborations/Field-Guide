/** STAR + map join for Quest 2: a walkable circuit inside Finsbury Park. */

export const FINSBURY_PARK_CIRCUIT_QUEST_ID = "783700a0-5f6f-4861-993b-7c1ff76b3a26"
export const FINSBURY_PARK_CIRCUIT_TRAIL_FILE = "finsbury-park-circuit.geojson"
export const FINSBURY_PARK_CIRCUIT_PACK_FILE = "finsbury-park-circuit-quest.json"
export const FINSBURY_PARK_CIRCUIT_PLACE_ID = "trail-finsbury-park-circuit"

export function parkCircuitSelected(activeTrailId: string): boolean {
  return activeTrailId === FINSBURY_PARK_CIRCUIT_PLACE_ID
}

export function isParkBeaconPin(pin: { dropKind?: string; questRole?: string }): boolean {
  return pin.dropKind === "beacon" || pin.questRole === "beacon"
}

export function parkBeaconPinVisible(opts: {
  isBeacon: boolean
  activeTrailId: string
  personaAllowsCircuitPlace: boolean
}): boolean {
  if (!opts.isBeacon) return true
  return parkCircuitSelected(opts.activeTrailId) && opts.personaAllowsCircuitPlace
}

/** Objective title, GeoJSON pin id, ItemCollectedName, NFT trailPinId. */
export const FINSBURY_PARK_CIRCUIT_PIN_IDS = [
  "park-manor-house-gate",
  "park-american-gardens",
  "park-athletics-track",
  "park-boating-lake",
  "park-parkland-walk-mouth",
] as const
