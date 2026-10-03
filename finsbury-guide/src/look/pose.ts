import type { TrailPin } from "field-guide-web4-client"
import {
  bearingDegrees,
  insidePinRadius,
  lookGloveScale,
  metersToPin,
  shortestAngleDelta,
  type GeoFix,
} from "../walk/geo"

export const LOOK_HFOV_DEG = 62

export type GloveScreenPose = {
  visible: boolean
  xPct: number
  yPct: number
  scale: number
  meters: number | null
  inRadius: boolean
  turnHint: string
}

export function gloveScreenPose(
  here: GeoFix | null,
  headingDeg: number | null,
  pin: TrailPin,
  hfovDeg = LOOK_HFOV_DEG,
): GloveScreenPose {
  const meters = metersToPin(here, pin)
  const scale = lookGloveScale(meters)
  const inRadius = insidePinRadius(here, pin)
  if (!here || headingDeg == null || meters == null) {
    return {
      visible: true,
      xPct: 50,
      yPct: 62,
      scale,
      meters,
      inRadius,
      turnHint: here ? "Point the camera down the street" : "Waiting for GPS",
    }
  }

  const bearing = bearingDegrees(here.lat, here.lon, pin.lat, pin.lon)
  const delta = shortestAngleDelta(headingDeg, bearing)
  const half = hfovDeg / 2
  const xPct = 50 + (delta / half) * 50
  const yPct = 48 + Math.min(28, meters * 0.12)
  const visible = Math.abs(delta) <= half + 8
  let turnHint = `${Math.round(meters)}m`
  if (!visible) {
    turnHint = delta < 0 ? `Turn left · ${Math.round(meters)}m` : `Turn right · ${Math.round(meters)}m`
  } else if (!inRadius) {
    turnHint = `${Math.round(meters)}m · walk closer (${pin.radiusM}m)`
  } else {
    turnHint = `${Math.round(meters)}m · collect`
  }

  return {
    visible,
    xPct: Math.min(92, Math.max(8, xPct)),
    yPct: Math.min(82, Math.max(42, yPct)),
    scale,
    meters,
    inRadius,
    turnHint,
  }
}
