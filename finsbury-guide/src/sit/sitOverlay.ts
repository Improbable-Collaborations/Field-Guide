import type { TrailPin } from "field-guide-web4-client"
import type { GeoFix } from "../walk/geo"
import { haversineMeters } from "../walk/geo"
import { accumulatePlayed, gateSitDwell, sitRequiredSeconds } from "./sitDwell"

export type SitHandle = {
  pin: TrailPin
  close: () => void
}

let active: SitHandle | null = null
let timer = 0
let getHere: () => GeoFix | null = () => null
let enteredAt: number | null = null
let dwellSeconds = 0
let lastTick = 0
let audioPlayed = 0
let lastAudioTime = 0
let skipDetected = false
let audio: HTMLAudioElement | null = null

function sitRoot(): HTMLElement {
  const el = document.getElementById("sit")
  if (!el) throw new Error("Sit overlay markup is missing")
  return el
}

function inside(here: GeoFix | null, pin: TrailPin): boolean {
  if (!here) return false
  return haversineMeters(here.lat, here.lon, pin.lat, pin.lon) <= pin.radiusM
}

function paint(pin: TrailPin, status: string, canComplete: boolean) {
  const statusEl = document.getElementById("sit-status")
  const completeBtn = document.getElementById("sit-complete") as HTMLButtonElement | null
  const meter = document.getElementById("sit-meter")
  if (statusEl) statusEl.textContent = status
  if (completeBtn) completeBtn.disabled = !canComplete
  const need = sitRequiredSeconds(pin)
  if (meter) {
    meter.textContent = `Sit ${Math.floor(dwellSeconds)}/${need}s · audio ${Math.floor(audioPlayed)}s`
  }
}

export function closeSit() {
  window.clearInterval(timer)
  timer = 0
  audio?.pause()
  audio = null
  active = null
  enteredAt = null
  dwellSeconds = 0
  audioPlayed = 0
  lastAudioTime = 0
  skipDetected = false
  const el = document.getElementById("sit")
  if (!el) return
  el.classList.add("hidden")
  el.hidden = true
}

export function isSitOpen(): boolean {
  return active != null
}

export function openSit(args: {
  pin: TrailPin
  getHere: () => GeoFix | null
  onComplete: () => Promise<void>
  onClose?: () => void
}): SitHandle {
  closeSit()
  getHere = args.getHere
  const pin = args.pin
  const el = sitRoot()
  const art = document.getElementById("sit-art") as HTMLImageElement
  const title = document.getElementById("sit-title")
  const prompt = document.getElementById("sit-prompt")
  const completeBtn = document.getElementById("sit-complete") as HTMLButtonElement
  const closeBtn = document.getElementById("sit-close") as HTMLButtonElement
  art.src = pin.imageUrl || "/icons/sit-stone.svg"
  art.alt = pin.title
  if (title) title.textContent = pin.title
  if (prompt) prompt.textContent = pin.narrationText || "Sit here. Placeholder audio until the guided sit is recorded."
  el.classList.remove("hidden")
  el.hidden = false

  audio = new Audio(pin.audioUrl || "/audio/day-after-tomorrow-placeholder.wav")
  audio.loop = true
  void audio.play().catch(() => {
    paint(pin, "Headphones needed. Allow audio, then sit.", false)
  })

  const handle: SitHandle = {
    pin,
    close: () => {
      closeSit()
      args.onClose?.()
    },
  }
  active = handle
  closeBtn.onclick = () => handle.close()
  completeBtn.onclick = async () => {
    const need = sitRequiredSeconds(pin)
    const blocked = gateSitDwell({
      dwellSeconds,
      audioSecondsPlayed: audioPlayed,
      requiredSeconds: need,
      skipDetected,
    })
    if (blocked) {
      paint(pin, blocked, false)
      return
    }
    if (!inside(getHere(), pin)) {
      paint(pin, "Stay on the lawn to complete.", false)
      return
    }
    completeBtn.disabled = true
    paint(pin, "Minting sit token…", false)
    try {
      await args.onComplete()
    } finally {
      completeBtn.disabled = false
    }
  }

  lastTick = performance.now()
  timer = window.setInterval(() => {
    const now = performance.now()
    const dt = (now - lastTick) / 1000
    lastTick = now
    const here = getHere()
    const inRadius = inside(here, pin)
    if (inRadius) {
      if (enteredAt == null) enteredAt = Date.now()
      dwellSeconds += dt
    } else {
      enteredAt = null
      audio?.pause()
    }
    if (inRadius && audio?.paused) void audio.play().catch(() => undefined)
    if (audio && !audio.paused) {
      const acc = accumulatePlayed(audioPlayed, lastAudioTime, audio.currentTime)
      audioPlayed = acc.played
      lastAudioTime = audio.currentTime
      if (acc.skipDetected) skipDetected = true
    }
    const need = sitRequiredSeconds(pin)
    const blocked = gateSitDwell({
      dwellSeconds,
      audioSecondsPlayed: audioPlayed,
      requiredSeconds: need,
      skipDetected,
    })
    const gpsLine = here
      ? inRadius
        ? "On the lawn"
        : `${Math.round(haversineMeters(here.lat, here.lon, pin.lat, pin.lon))}m from the sit`
      : "GPS required. No desk stand-in for a sit."
    paint(pin, blocked ? `${gpsLine}. ${blocked}` : `${gpsLine}. Ready to mint ${pin.title}.`, !blocked && inRadius)
  }, 250)

  paint(pin, "GPS required. Sit on the lawn. Placeholder audio will loop.", false)
  return handle
}
