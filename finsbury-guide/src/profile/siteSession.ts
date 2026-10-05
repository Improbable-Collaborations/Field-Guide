/** Live tab presence for a connected chat. Read only. The visitor’s progress is OASIS STAR; the published Field Guide is not writable here. */

export type FieldGuideMode = "map" | "you" | "walk"

export type SiteView = {
  mode: FieldGuideMode
  selectedPlaceId: string
  selectedPinId: string
  wearingPersonaId: string | null
  wearingClusterId: string | null
  lat?: number
  lon?: number
  accuracyM?: number
}

export function parseSiteView(raw: unknown): SiteView | string {
  if (!raw || typeof raw !== "object") return "Site view must be an object."
  const rec = raw as Record<string, unknown>
  const mode = rec.mode
  if (mode !== "map" && mode !== "you" && mode !== "walk") return "Site mode must be map, you, or walk."
  const lat = typeof rec.lat === "number" && Number.isFinite(rec.lat) ? rec.lat : undefined
  const lon = typeof rec.lon === "number" && Number.isFinite(rec.lon) ? rec.lon : undefined
  const accuracyM =
    typeof rec.accuracyM === "number" && Number.isFinite(rec.accuracyM) ? rec.accuracyM : undefined
  return {
    mode,
    selectedPlaceId: typeof rec.selectedPlaceId === "string" ? rec.selectedPlaceId : "",
    selectedPinId: typeof rec.selectedPinId === "string" ? rec.selectedPinId : "",
    wearingPersonaId: typeof rec.wearingPersonaId === "string" ? rec.wearingPersonaId : null,
    wearingClusterId: typeof rec.wearingClusterId === "string" ? rec.wearingClusterId : null,
    lat,
    lon,
    accuracyM,
  }
}

export function formatLiveSiteLine(view: SiteView | null): string {
  if (!view) {
    return "Site: the Field Guide tab has not joined this session. Progress still comes from this avatar’s OASIS quests."
  }
  const wear = view.wearingPersonaId || "published map"
  const cluster = view.wearingClusterId ? ` / ${view.wearingClusterId}` : ""
  const guide = view.selectedPlaceId ? ` · guide ${view.selectedPlaceId}` : ""
  const pin = view.selectedPinId ? ` · pin ${view.selectedPinId}` : ""
  const gps =
    view.lat != null && view.lon != null
      ? ` · GPS ${view.lat.toFixed(5)}, ${view.lon.toFixed(5)}${view.accuracyM != null ? ` ±${Math.round(view.accuracyM)}m` : ""}`
      : ""
  return `Site: ${view.mode} · wearing ${wear}${cluster}${guide}${pin}${gps}`
}
