/** Commands ChatGPT queues for the visitor's live Field Guide tab. Collect still happens only in Walk / Look. */

export type SiteCommand = {
  type: "open-look"
  placeId: string
  pinId: string
}

export function parseSiteCommand(raw: unknown): SiteCommand | string {
  if (!raw || typeof raw !== "object") return "Site command must be an object."
  const rec = raw as Record<string, unknown>
  if (rec.type !== "open-look") return "Site command type must be open-look."
  const placeId = typeof rec.placeId === "string" ? rec.placeId.trim() : ""
  if (!placeId) return "Site command needs placeId."
  const pinId = typeof rec.pinId === "string" ? rec.pinId.trim() : ""
  return { type: "open-look", placeId, pinId }
}
