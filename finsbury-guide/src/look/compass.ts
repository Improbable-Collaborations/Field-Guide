type CompassStop = () => void

function headingFromEvent(ev: DeviceOrientationEvent): number | null {
  const webkit = ev as DeviceOrientationEvent & { webkitCompassHeading?: number }
  if (typeof webkit.webkitCompassHeading === "number" && Number.isFinite(webkit.webkitCompassHeading)) {
    return webkit.webkitCompassHeading
  }
  if (typeof ev.alpha === "number" && Number.isFinite(ev.alpha)) {
    return (360 - ev.alpha) % 360
  }
  return null
}

export async function startCompass(onHeading: (deg: number) => void): Promise<CompassStop> {
  const Doe = window.DeviceOrientationEvent as
    | (typeof DeviceOrientationEvent & { requestPermission?: () => Promise<PermissionState> })
    | undefined

  if (Doe?.requestPermission) {
    const state = await Doe.requestPermission()
    if (state !== "granted") {
      throw new Error("Compass permission denied")
    }
  }

  const handler = (ev: Event) => {
    const deg = headingFromEvent(ev as DeviceOrientationEvent)
    if (deg != null) onHeading(deg)
  }

  window.addEventListener("deviceorientationabsolute", handler)
  window.addEventListener("deviceorientation", handler)
  return () => {
    window.removeEventListener("deviceorientationabsolute", handler)
    window.removeEventListener("deviceorientation", handler)
  }
}
