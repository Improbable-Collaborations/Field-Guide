/** STAR + map join for Quest 1: street gloves around JAB SW1. */

export const JAB_SW1_GLOVES_QUEST_ID = "8f2c1a4e-6b7d-4c91-a3e5-1d9f0b4e7c22"
export const JAB_SW1_GLOVES_TRAIL_FILE = "jab-sw1-gloves.geojson"
export const JAB_SW1_GLOVES_PACK_FILE = "jab-sw1-gloves-quest.json"
export const JAB_SW1_GLOVES_PLACE_ID = "trail-jab-sw1-gloves"

/** Map and list glove pins only after this trail/quest is the active selection. */
export function glovesQuestSelected(activeTrailId: string): boolean {
  return activeTrailId === JAB_SW1_GLOVES_PLACE_ID
}

export function streetGlovePinVisible(opts: {
  isGlove: boolean
  activeTrailId: string
  personaAllowsGlovesPlace: boolean
}): boolean {
  if (!opts.isGlove) return true
  return glovesQuestSelected(opts.activeTrailId) && opts.personaAllowsGlovesPlace
}

/** Objective title, GeoJSON pin id, ItemCollectedName, NFT MetaData.trailPinId. */
export const JAB_SW1_GLOVE_PIN_IDS = [
  "glove-victoria-door",
  "glove-victoria-colonnade",
  "glove-victoria-station",
  "glove-grosvenor-gardens",
  "glove-buckingham-palace-rd",
  "glove-eccleston-y1",
] as const
