import type { TrailPin } from "field-guide-web4-client"
import type { GeoFix } from "../walk/geo"
import { startCompass } from "./compass"
import { gloveScreenPose } from "./pose"

export type LookHandle = {
  pin: TrailPin
  close: () => void
}

let stream: MediaStream | null = null
let active: LookHandle | null = null
let raf = 0
let stopCompass: (() => void) | null = null
let compassHeading: number | null = null
let getHere: () => GeoFix | null = () => null
let livePin: TrailPin | null = null
let deskStandIn = false

function lookRoot(): HTMLElement {
  const el = document.getElementById("look")
  if (!el) throw new Error("Look overlay markup is missing")
  return el
}

function stopCamera() {
  for (const track of stream?.getTracks() ?? []) track.stop()
  stream = null
  const video = document.getElementById("look-video") as HTMLVideoElement | null
  if (video) video.srcObject = null
}

function paintPose() {
  if (!livePin) return
  const img = document.getElementById("look-glove") as HTMLImageElement | null
  const status = document.getElementById("look-status")
  const collectBtn = document.getElementById("look-collect") as HTMLButtonElement | null
  if (!img || !status || !collectBtn) return

  const here = getHere()
  const heading = compassHeading ?? here?.headingDeg ?? null
  const pose = gloveScreenPose(here, heading, livePin)
  img.classList.toggle("off-frame", !pose.visible)
  img.style.left = `${pose.xPct}%`
  img.style.top = `${pose.yPct}%`
  img.style.transform = `translate(-50%, -50%) scale(${pose.scale})`
  status.textContent = `${livePin.title} · ${pose.turnHint}`
  const canCollect = pose.inRadius || deskStandIn
  collectBtn.disabled = !canCollect
  collectBtn.title = canCollect ? "Mint this glove into your wallet" : pose.turnHint
}

function tick() {
  paintPose()
  raf = window.requestAnimationFrame(tick)
}

export function closeLook() {
  window.cancelAnimationFrame(raf)
  raf = 0
  stopCompass?.()
  stopCompass = null
  compassHeading = null
  livePin = null
  stopCamera()
  active = null
  const el = document.getElementById("look")
  if (!el) return
  el.classList.add("hidden")
  el.hidden = true
}

export async function openLook(args: {
  pin: TrailPin
  getHere: () => GeoFix | null
  deskStandIn?: boolean
  onCollect: () => Promise<void>
  onClose?: () => void
}): Promise<LookHandle> {
  closeLook()
  getHere = args.getHere
  deskStandIn = Boolean(args.deskStandIn)
  livePin = args.pin

  const el = lookRoot()
  const video = document.getElementById("look-video") as HTMLVideoElement
  const img = document.getElementById("look-glove") as HTMLImageElement
  const status = document.getElementById("look-status")!
  const collectBtn = document.getElementById("look-collect") as HTMLButtonElement
  const closeBtn = document.getElementById("look-close") as HTMLButtonElement

  img.src = args.pin.imageUrl || "/icons/boxing-glove.svg"
  img.alt = args.pin.title || "Boxing glove"
  el.classList.remove("hidden")
  el.hidden = false
  paintPose()

  const handle: LookHandle = {
    pin: args.pin,
    close: () => {
      closeLook()
      args.onClose?.()
    },
  }
  active = handle

  closeBtn.onclick = () => handle.close()
  collectBtn.onclick = async () => {
    paintPose()
    if (collectBtn.disabled) {
      status.textContent = collectBtn.title || "Walk closer to collect"
      return
    }
    collectBtn.disabled = true
    status.textContent = "Collecting…"
    try {
      await args.onCollect()
    } finally {
      paintPose()
    }
  }

  if (!navigator.mediaDevices?.getUserMedia) {
    status.textContent = "Camera is not available in this browser"
    return handle
  }

  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: "environment" } },
      audio: false,
    })
    video.srcObject = stream
    await video.play()
  } catch (err) {
    status.textContent =
      err instanceof Error ? err.message : "Camera permission denied"
    return handle
  }

  try {
    stopCompass = await startCompass((deg) => {
      compassHeading = deg
    })
  } catch (err) {
    status.textContent =
      err instanceof Error
        ? `${status.textContent} · ${err.message}`
        : status.textContent
  }

  raf = window.requestAnimationFrame(tick)
  return handle
}

export function isLookOpen(): boolean {
  return active != null
}
