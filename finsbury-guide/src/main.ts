import maplibregl from "maplibre-gl"
import {
  createFieldGuideWeb4Client,
  isSitPin,
  isStreetGlovePin,
  type TrailPin,
} from "field-guide-web4-client"
import { FINSBURY, PLACES, type Place } from "./places"
import { attachTrain } from "./train"
import {
  fetchWhatsOn,
  formatGigWhen,
  gigMatchesVenue,
  type Gig,
} from "./whatsOn"
import { fetchRaLondon, formatRaWhen, type RaEvent } from "./ra"
import { relevantLiveEvents } from "./trustGraph/liveFeed"
import {
  PERSONAS,
  type FeedId,
  type GuideLayer,
  type Persona,
  clusterFeeds,
  clusterForFeed,
} from "./trustGraph/personas"
import {
  clusterForPlace,
  clusterStories,
  personaAllowsPlace,
  personaShowsLayer,
  visiblePlaces,
} from "./trustGraph/guideView"
import { wornPersona } from "./trustGraph/promise"
import { mountStar, type StarHandle } from "./trustGraph/starScene"
import { JAB_SW1_GLOVES_PLACE_ID, streetGlovePinVisible } from "./quests/jabSw1Gloves"
import {
  FINSBURY_PARK_CIRCUIT_PLACE_ID,
  isParkBeaconPin,
  parkBeaconPinVisible,
} from "./quests/finsburyParkCircuit"
import { closeLook, openLook } from "./look/lookOverlay"
import { closeSit, openSit } from "./sit/sitOverlay"
import { dayAfterTomorrowPinVisible } from "./quests/dayAfterTomorrow"
import { mountAvatarDesk } from "./profile/desk"
import { buildProfileSnapshot } from "./profile/model"
import { startFieldGuideSiteLink } from "./profile/siteLink"
import type { SiteCommand } from "./profile/siteCommand"
import { loadPersonalPhotos } from "./profile/personalPhotosApi"
import type { PersonalPhoto } from "./profile/personalPhoto"
import type { FieldGuideMode } from "./profile/siteSession"
import {
  DESK_MAP_PITCH,
  DESK_MAP_ZOOM,
  WALK_STREET_PITCH,
  WALK_STREET_ZOOM,
  deskWalkRequested,
  geoFixFromCoords,
  insidePinRadius,
  metersToPin,
  nextUncollectedPin,
  type GeoFix,
} from "./walk/geo"
import "./styles.css"

const client = createFieldGuideWeb4Client({
  source: "finsbury-guide-web",
  contentBaseUrl: "",
  configuredQuestId: "00df145e-461b-434f-9372-d10c84f2b6df",
})

const NEARBY_RADIUS_KM = 5
const RA_POLL_MS = 10 * 60 * 1000

const listEl = document.getElementById("place-list")!
const statusEl = document.getElementById("status")!
const filtersEl = document.getElementById("filters")!
const personaBtns = document.getElementById("persona-btns")!
const personaBlurb = document.getElementById("persona-blurb")!
const personaClusters = document.getElementById("persona-clusters")!
const starGlyph = document.getElementById("star-glyph")!
const authBox = document.getElementById("auth-box")!
const avatarOpen = document.getElementById("avatar-open") as HTMLButtonElement
const avatarDeskBody = document.getElementById("avatar-desk-body")!
const avatarDeskClose = document.getElementById("avatar-desk-close")!
const sheet = document.getElementById("sheet")!
const sheetKind = document.getElementById("sheet-kind")!
const sheetTitle = document.getElementById("sheet-title")!
const sheetSub = document.getElementById("sheet-sub")!
const sheetBody = document.getElementById("sheet-body")!
const sheetActions = document.getElementById("sheet-actions")!
const nearbyToggle = document.getElementById("toggle-nearby") as HTMLInputElement
const trailsToggle = document.getElementById("toggle-trails") as HTMLInputElement
const trainToggle = document.getElementById("toggle-train") as HTMLInputElement
const gigsToggle = document.getElementById("toggle-gigs") as HTMLInputElement
const raToggle = document.getElementById("toggle-ra") as HTMLInputElement
const raEmbed = document.getElementById("ra-embed")!
const raEmbedKicker = document.getElementById("ra-embed-kicker")!
const raEmbedTitle = document.getElementById("ra-embed-title")!
const raEmbedExternal = document.getElementById("ra-embed-external") as HTMLAnchorElement
const raEmbedClose = document.getElementById("ra-embed-close")!
const raEmbedTabs = document.getElementById("ra-embed-tabs")!
const raEmbedPage = document.getElementById("ra-embed-page")!
const raEmbedSite = document.getElementById("ra-embed-site")!
const raEmbedFrame = document.getElementById("ra-embed-frame") as HTMLIFrameElement
const raEmbedFrameNote = document.getElementById("ra-embed-frame-note")!

const walkEnter = document.getElementById("walk-enter") as HTMLButtonElement
const walkStrip = document.getElementById("walk-strip")!
const walkQuest = document.getElementById("walk-quest")!
const walkNext = document.getElementById("walk-next")!
const walkMeters = document.getElementById("walk-meters")!
const walkLookBtn = document.getElementById("walk-look") as HTMLButtonElement
const walkCollectBtn = document.getElementById("walk-collect") as HTMLButtonElement
const walkDeskBtn = document.getElementById("walk-desk") as HTMLButtonElement

document.getElementById("sheet-close")!.addEventListener("click", hideSheet)
raEmbedClose.addEventListener("click", closeRaEmbed)

for (const tab of raEmbed.querySelectorAll<HTMLButtonElement>(".ra-embed-tab")) {
  tab.addEventListener("click", () => {
    const which = tab.dataset.tab
    for (const t of raEmbed.querySelectorAll<HTMLButtonElement>(".ra-embed-tab")) {
      const on = t === tab
      t.classList.toggle("active", on)
      t.setAttribute("aria-selected", on ? "true" : "false")
    }
    const showPage = which === "page"
    raEmbedPage.classList.toggle("hidden", !showPage)
    raEmbedPage.hidden = !showPage
    raEmbedSite.classList.toggle("hidden", showPage)
    raEmbedSite.hidden = showPage
  })
}

const FILTERS: { id: string; label: string }[] = [
  { id: "all", label: "All" },
  { id: "park", label: "Park" },
  { id: "transit", label: "Transit" },
  { id: "culture", label: "Culture" },
  { id: "sport", label: "Sport" },
  { id: "music", label: "Music" },
  { id: "gigs", label: "What's on" },
  { id: "ra", label: "RA" },
  { id: "hq", label: "HQ" },
  { id: "trail", label: "Trails" },
  { id: "nearby", label: "Live drops" },
]

let activeFilter = "all"
let activePersona: Persona | null = null
let activeClusterId: string | null = null
let starHandle: StarHandle | null = null
let avatarDesk: ReturnType<typeof mountAvatarDesk> | null = null
let stopSiteLink: (() => void) | null = null
let nearbyPins: TrailPin[] = []
let trailPins: TrailPin[] = []
let activeTrailId = ""
const venueMarkers = new Map<string, maplibregl.Marker>()
let nearbyMarkers: maplibregl.Marker[] = []
let trailMarkers: maplibregl.Marker[] = []
let personalMarkers: maplibregl.Marker[] = []
let personalPhotos: PersonalPhoto[] = []
let gigMarkers: maplibregl.Marker[] = []
let raMarkers: maplibregl.Marker[] = []
let liveGigs: Gig[] = []
let liveRa: RaEvent[] = []
let gigsStatus = "What's on · loading…"
let raStatus = "RA · loading…"
let raRefresh: Promise<void> | null = null
let raPopup: maplibregl.Popup | null = null
let raPopupKey: string | null = null

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

function raEventKey(ev: RaEvent): string {
  return `${ev.id}|${ev.startDate}`
}

function closeRaPopup() {
  raPopup?.remove()
  raPopup = null
  raPopupKey = null
}

function closeRaEmbed() {
  raEmbed.classList.add("hidden")
  raEmbed.hidden = true
  raEmbedFrame.src = "about:blank"
  raEmbedPage.innerHTML = ""
  closeRaPopup()
  raPopupKey = null
}

function mapsEmbedUrl(url: string): string {
  try {
    const u = new URL(url)
    if (u.hostname.includes("google.") && u.searchParams.has("q")) {
      return `https://maps.google.com/maps?q=${encodeURIComponent(u.searchParams.get("q") || "")}&output=embed`
    }
  } catch {
    /* keep original */
  }
  return url
}

function iframeSrcFor(url: string, label?: string): string {
  if ((label || "").toLowerCase() === "maps" || url.includes("maps.google.")) {
    return mapsEmbedUrl(url)
  }
  return url
}

function showEmbedTab(which: "page" | "site") {
  for (const t of raEmbed.querySelectorAll<HTMLButtonElement>(".ra-embed-tab")) {
    const on = t.dataset.tab === which
    t.classList.toggle("active", on)
    t.setAttribute("aria-selected", on ? "true" : "false")
  }
  const showPage = which === "page"
  raEmbedPage.classList.toggle("hidden", !showPage)
  raEmbedPage.hidden = !showPage
  raEmbedSite.classList.toggle("hidden", showPage)
  raEmbedSite.hidden = showPage
}

function openWebEmbed(opts: {
  title: string
  url: string
  kicker: string
  externalLabel?: string
  pageHtml?: string
  pageTabLabel?: string
  siteTabLabel?: string
  preferSite?: boolean
  hideSheet?: boolean
  frameNote?: string
}) {
  raEmbedKicker.textContent = opts.kicker
  raEmbedTitle.textContent = opts.title
  raEmbedExternal.href = opts.url
  raEmbedExternal.textContent = opts.externalLabel || "Open tab"
  raEmbedFrame.title = opts.title
  raEmbedFrame.src = iframeSrcFor(opts.url, opts.kicker)
  raEmbedFrameNote.innerHTML =
    opts.frameNote ||
    "If this frame stays blank, the site is blocking embeds. Use <strong>Open tab</strong> or About."

  const hasPage = Boolean(opts.pageHtml)
  raEmbedPage.innerHTML = opts.pageHtml || ""
  raEmbedTabs.hidden = !hasPage
  raEmbedTabs.style.display = hasPage ? "" : "none"

  const pageTab = raEmbedTabs.querySelector<HTMLButtonElement>('[data-tab="page"]')
  const siteTab = raEmbedTabs.querySelector<HTMLButtonElement>('[data-tab="site"]')
  if (pageTab) pageTab.textContent = opts.pageTabLabel || "About"
  if (siteTab) siteTab.textContent = opts.siteTabLabel || "Site"

  const preferSite = opts.preferSite ?? !hasPage
  if (!hasPage) showEmbedTab("site")
  else showEmbedTab(preferSite ? "site" : "page")

  raEmbed.classList.remove("hidden")
  raEmbed.hidden = false
  if (opts.hideSheet) hideSheet()
}

function openRaEmbed(ev: RaEvent) {
  const when = formatRaWhen(ev.startDate)
  const end = ev.endDate ? ` – ${formatRaWhen(ev.endDate)}` : ""
  const lineup = ev.artists.length
    ? ev.artists.map((a) => `<li>${escapeHtml(a)}</li>`).join("")
    : "<li>See RA for full line-up</li>"
  const genres = ev.genres.length
    ? ev.genres.map((g) => `<span class="ra-chip">${escapeHtml(g)}</span>`).join("")
    : `<span class="ra-chip">electronic</span>`
  const cost = ev.cost
    ? escapeHtml(ev.cost.startsWith("£") ? ev.cost : `£${ev.cost}`)
    : ev.isTicketed
      ? "Tickets on RA"
      : "See RA"
  const attending =
    ev.attending != null ? `${ev.attending} attending` : "RA listing"
  const img = ev.imageUrl
    ? `<img class="ra-embed-flyer" src="${escapeHtml(ev.imageUrl)}" alt="" loading="lazy" />`
    : ""
  const body = ev.content
    ? `<div class="ra-embed-copy">${escapeHtml(ev.content).replace(/\n/g, "<br/>")}</div>`
    : `<p class="ra-embed-copy muted">Full write-up on Resident Advisor.</p>`

  const html = `
    ${img}
    <div class="ra-embed-body">
      <p class="ra-embed-when">${escapeHtml(when)}${escapeHtml(end)}</p>
      <h2 class="ra-embed-h">${escapeHtml(ev.title)}</h2>
      <p class="ra-embed-venue">${escapeHtml(ev.venueName)}${
        ev.areaName ? ` · ${escapeHtml(ev.areaName)}` : ""
      }</p>
      ${ev.address ? `<p class="ra-embed-addr">${escapeHtml(ev.address)}</p>` : ""}
      <div class="ra-embed-chips">${genres}</div>
      <p class="ra-embed-stats">${escapeHtml(cost)} · ${escapeHtml(attending)}${
        ev.minimumAge != null && ev.minimumAge !== ""
          ? ` · ${escapeHtml(String(ev.minimumAge))}+`
          : ""
      }</p>
      <h3 class="ra-embed-section">Line-up</h3>
      <ul class="ra-embed-lineup">${lineup}</ul>
      <h3 class="ra-embed-section">About</h3>
      ${body}
    </div>
  `

  openWebEmbed({
    title: ev.title,
    url: ev.url,
    kicker: "Resident Advisor",
    externalLabel: "Open ra.co",
    pageHtml: html,
    pageTabLabel: "Event",
    siteTabLabel: "RA site",
    preferSite: false,
    hideSheet: true,
    frameNote:
      "If this frame stays blank, RA is blocking embeds. Use <strong>Open ra.co</strong> or the Event tab.",
  })
}

const map = new maplibregl.Map({
  container: "map",
  style: "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json",
  center: FINSBURY,
  zoom: 13.2,
  pitch: 42,
  bearing: -12,
})
map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-left")
const geolocate = new maplibregl.GeolocateControl({
  positionOptions: { enableHighAccuracy: true },
  trackUserLocation: true,
  showUserLocation: true,
  fitBoundsOptions: {
    maxZoom: WALK_STREET_ZOOM,
    pitch: WALK_STREET_PITCH,
    padding: { top: 24, left: 24, right: 24, bottom: 170 },
  },
})
map.addControl(geolocate, "top-right")
window.addEventListener("resize", () => {
  map.resize()
})

let walkActive = false
let walkFix: GeoFix | null = null
let walkWatchId: number | null = null
let wakeLock: WakeLockSentinel | null = null
let lastSpokenPinId = ""
let youMarker: maplibregl.Marker | null = null
const deskWalk = deskWalkRequested(window.location.search)

geolocate.on("geolocate", (ev: GeolocationPosition) => {
  applyWalkGps(ev.coords)
})
geolocate.on("error", () => {
  if (walkActive && !deskWalk && !walkFix) {
    walkMeters.textContent = "GPS denied or unavailable"
  }
})

const train = attachTrain(map)
function syncTrain() {
  train.setEnabled(trainToggle.checked)
}
if (map.loaded()) syncTrain()
else map.on("load", syncTrain)

function setStatus(msg: string) {
  statusEl.textContent = msg
}

function hideSheet() {
  sheet.classList.add("hidden")
  sheet.hidden = true
  sheet.querySelector(".gig-sheet-list")?.remove()
  sheetBody.style.whiteSpace = ""
}

function activeQuestId(): string {
  return (
    PLACES.find((p) => p.id === activeTrailId)?.starQuestId ||
    client.config.configuredQuestId ||
    ""
  )
}

function walkHere(): GeoFix | null {
  if (walkFix) return walkFix
  if (!deskWalk) return null
  const pin = nextWalkPin()
  if (!pin) return null
  return { lat: pin.lat, lon: pin.lon }
}

function ensureYouMarker() {
  if (youMarker) return youMarker
  const el = document.createElement("div")
  el.className = "you-puck"
  el.title = "You (GPS)"
  el.innerHTML = `<span class="you-puck-dot"></span><span class="you-puck-label">YOU</span>`
  youMarker = new maplibregl.Marker({ element: el, anchor: "center" })
    .setLngLat(FINSBURY)
    .addTo(map)
  return youMarker
}

function hideYouMarker() {
  youMarker?.remove()
  youMarker = null
}

function applyWalkGps(coords: GeolocationCoordinates) {
  walkFix = geoFixFromCoords(coords)
  ensureYouMarker().setLngLat([walkFix.lon, walkFix.lat])
  refreshWalkStrip()
  if (!walkActive) return
  const heading =
    walkFix.headingDeg != null && Number.isFinite(walkFix.headingDeg)
      ? walkFix.headingDeg
      : map.getBearing()
  map.jumpTo({
    center: [walkFix.lon, walkFix.lat],
    zoom: WALK_STREET_ZOOM,
    pitch: WALK_STREET_PITCH,
    bearing: heading,
  })
}

function requestWalkGps(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!("geolocation" in navigator)) {
      reject(new Error("This browser has no geolocation"))
      return
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 5000,
    })
  })
}

function nextWalkPin() {
  return nextUncollectedPin(trailPins.filter(trailPinVisible), (id) =>
    client.session.isCheckedIn(id),
  )
}

function speakWalk(text: string) {
  const line = text.trim()
  if (!line || typeof speechSynthesis === "undefined") return
  speechSynthesis.cancel()
  const u = new SpeechSynthesisUtterance(line)
  u.rate = 0.95
  speechSynthesis.speak(u)
}

async function holdWakeLock() {
  if (!("wakeLock" in navigator)) return
  try {
    wakeLock = await navigator.wakeLock.request("screen")
  } catch {
    wakeLock = null
  }
}

function releaseWakeLock() {
  void wakeLock?.release()
  wakeLock = null
}

function refreshWalkStrip() {
  if (!walkActive) return
  const place = PLACES.find((p) => p.id === activeTrailId)
  const pin = nextWalkPin()
  const here = walkHere()
  const meters = metersToPin(here, pin)
  walkQuest.textContent = place?.name || "Walk"
  walkNext.textContent = pin ? pin.title || pin.id : "Set complete"
  if (!pin) {
    walkMeters.textContent = "All pins collected"
  } else if (meters == null) {
    walkMeters.textContent = deskWalk
      ? "Desk walk · using pin location as you"
      : "Waiting for GPS…"
  } else {
    const gps =
      walkFix?.accuracyM != null
        ? `GPS ±${Math.round(walkFix.accuracyM)}m`
        : walkFix
          ? "GPS"
          : "next pin"
    walkMeters.textContent = `${Math.round(meters)}m · ${gps} · ${pin.directionHint || pin.place || pin.id}`
  }
  if (pin && isSitPin(pin)) {
    walkLookBtn.textContent = "Sit"
    walkCollectBtn.textContent = "Sit"
  } else {
    walkLookBtn.textContent = "Look"
    walkCollectBtn.textContent = "Collect"
  }
  walkLookBtn.disabled = !pin
  walkCollectBtn.disabled = !pin
  if (pin && pin.id !== lastSpokenPinId) {
    lastSpokenPinId = pin.id
    const line = [pin.narrationText, pin.directionHint].filter(Boolean).join(". ")
    if (line) speakWalk(line)
  }
  if (!pin) lastSpokenPinId = ""
}

function walkStreetCenter(): [number, number] | null {
  const here = walkHere()
  if (here) return [here.lon, here.lat]
  const pin = nextWalkPin()
  if (pin) return [pin.lon, pin.lat]
  return null
}

function frameWalkStreet() {
  const center = walkStreetCenter()
  if (!center) return
  map.jumpTo({
    center,
    zoom: WALK_STREET_ZOOM,
    pitch: WALK_STREET_PITCH,
  })
}

function resizeWalkMap() {
  requestAnimationFrame(() => {
    map.resize()
    requestAnimationFrame(() => {
      if (walkActive) frameWalkStreet()
    })
  })
}

async function startWalk() {
  walkActive = true
  setYouPage(false)
  document.body.classList.add("mode-walk")
  walkStrip.classList.remove("hidden")
  walkStrip.hidden = false
  hideSheet()
  closeRaEmbed()
  await holdWakeLock()
  refreshWalkStrip()
  requestAnimationFrame(() => map.resize())
  setStatus("Asking for GPS…")
  try {
    const pos = await requestWalkGps()
    applyWalkGps(pos.coords)
    setStatus("Walk · GPS live")
  } catch (err) {
    const msg = err instanceof Error ? err.message : "GPS unavailable"
    setStatus(deskWalk ? `Walk · desk stand-in (${msg})` : `Walk · ${msg}`)
    if (deskWalk) frameWalkStreet()
  }
  if (walkWatchId == null && "geolocation" in navigator) {
    walkWatchId = navigator.geolocation.watchPosition(
      (pos) => applyWalkGps(pos.coords),
      (err) => {
        if (!deskWalk && !walkFix) {
          walkMeters.textContent = err.message || "GPS unavailable"
        }
      },
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 20000 },
    )
  }
  void refreshNearby()
}

function stopWalk() {
  walkActive = false
  document.body.classList.remove("mode-walk")
  walkStrip.classList.add("hidden")
  walkStrip.hidden = true
  closeLook()
  closeSit()
  hideYouMarker()
  if (walkWatchId != null) {
    navigator.geolocation.clearWatch(walkWatchId)
    walkWatchId = null
  }
  releaseWakeLock()
  if (typeof speechSynthesis !== "undefined") speechSynthesis.cancel()
  lastSpokenPinId = ""
  map.easeTo({
    center: FINSBURY,
    zoom: DESK_MAP_ZOOM,
    pitch: DESK_MAP_PITCH,
    bearing: -12,
    padding: { top: 0, left: 0, right: 0, bottom: 0 },
    duration: 700,
  })
  resizeWalkMap()
  setStatus("Desk")
}

async function collectPin(pin: TrailPin) {
  if (!client.session.hasJwt()) {
    setStatus("Sign in to collect")
    return
  }
  if (isSitPin(pin) && !walkFix) {
    setStatus("GPS required to sit. No desk stand-in.")
    return
  }
  const result = await client.checkIn.handle(pin, { questId: activeQuestId() })
  setStatus(result.message)
  drawTrailPins()
  renderList()
  refreshWalkStrip()
  avatarDesk?.refresh()
  if (result.ok) {
    closeLook()
    closeSit()
  }
}

async function collectActiveWalkPin() {
  const pin = nextWalkPin()
  if (!pin) {
    setStatus("No pin left to collect")
    return
  }
  if (isSitPin(pin)) {
    await sitAtWalkPin(pin.id)
    return
  }
  if (!deskWalk && !insidePinRadius(walkHere(), pin)) {
    const m = metersToPin(walkHere(), pin)
    setStatus(
      m == null
        ? "GPS required to collect"
        : `Walk closer (${Math.round(m)}m, need ${pin.radiusM}m)`,
    )
    return
  }
  await collectPin(pin)
}

async function sitAtWalkPin(pinId?: string) {
  const pin = pinId
    ? trailPins.filter(trailPinVisible).find((p) => p.id === pinId && !client.session.isCheckedIn(p.id))
    : nextWalkPin()
  if (!pin || !isSitPin(pin)) {
    setStatus("No sit left")
    return
  }
  openSit({
    pin,
    getHere: () => walkFix,
    onComplete: async () => {
      await collectPin(pin)
    },
  })
}

async function lookAtWalkPin(pinId?: string) {
  const pin = pinId
    ? trailPins.filter(trailPinVisible).find((p) => p.id === pinId && !client.session.isCheckedIn(p.id))
    : nextWalkPin()
  if (!pin) {
    setStatus("No pin left to look at")
    return
  }
  if (isSitPin(pin)) {
    await sitAtWalkPin(pin.id)
    return
  }
  await openLook({
    pin,
    getHere: walkHere,
    deskStandIn: deskWalk,
    onCollect: collectActiveWalkPin,
  })
}

async function applyQuestDeepLink() {
  const q = new URLSearchParams(window.location.search)
  const placeId = q.get("place") || ""
  if (!placeId) return
  const place = PLACES.find((p) => p.id === placeId)
  if (!place) return
  await loadTrail(place)
  if (q.get("walk") === "1" || q.get("look") === "1") await startWalk()
  if (q.get("look") === "1") await lookAtWalkPin(q.get("pin") || undefined)
}

function showSheet(args: {
  kind: string
  title: string
  sub?: string
  body?: string
  actions?: { label: string; href?: string; onClick?: () => void }[]
}) {
  sheet.querySelector(".gig-sheet-list")?.remove()
  sheet.querySelector(".glove-sheet-art")?.remove()
  sheet.querySelector(".personal-sheet-art")?.remove()
  sheetKind.textContent = args.kind
  sheetTitle.textContent = args.title
  sheetSub.textContent = args.sub || ""
  sheetBody.textContent = args.body || ""
  sheetActions.innerHTML = ""
  for (const a of args.actions || []) {
    if (a.href) {
      const btn = document.createElement("button")
      btn.type = "button"
      btn.textContent = a.label
      btn.addEventListener("click", () => {
        const about = `<div class="ra-embed-body">
          <h2 class="ra-embed-h">${escapeHtml(args.title)}</h2>
          ${args.sub ? `<p class="ra-embed-venue">${escapeHtml(args.sub)}</p>` : ""}
          ${args.body ? `<p class="ra-embed-copy">${escapeHtml(args.body)}</p>` : ""}
        </div>`
        openWebEmbed({
          title: args.title,
          url: a.href!,
          kicker: a.label,
          pageHtml: about,
          pageTabLabel: "About",
          siteTabLabel: a.label === "Maps" ? "Map" : "Site",
          preferSite: true,
          hideSheet: false,
        })
        map.easeTo({
          padding: { top: 40, bottom: 40, left: 40, right: 420 },
          duration: 400,
        })
      })
      sheetActions.appendChild(btn)
    } else if (a.onClick) {
      const btn = document.createElement("button")
      btn.type = "button"
      btn.textContent = a.label
      btn.addEventListener("click", () => a.onClick?.())
      sheetActions.appendChild(btn)
    }
  }
  sheet.classList.remove("hidden")
  sheet.hidden = false
}

function markerClass(type: string): string {
  if (type === "hq") return "hq"
  if (type === "park") return "conservation"
  if (type === "transit") return "hotel_starter"
  if (type === "culture") return "hotel_partner"
  if (type === "sport") return "gym"
  if (type === "music") return "music"
  if (type === "trail") return "hotel_champion"
  if (type === "anchor") return "anchor"
  return "anchor"
}

function clearMarkers(list: maplibregl.Marker[]) {
  for (const m of list) m.remove()
  list.length = 0
}

function drawNearby() {
  clearMarkers(nearbyMarkers)
  if (!nearbyToggle.checked) return
  if (!graphShowsFeed("nearby")) return
  for (const pin of nearbyPins) {
    const el = document.createElement("button")
    el.type = "button"
    el.className = "marker nearby"
    el.title = pin.title
    el.addEventListener("click", (e) => {
      e.stopPropagation()
      openNearby(pin)
    })
    nearbyMarkers.push(
      new maplibregl.Marker({ element: el }).setLngLat([pin.lon, pin.lat]).addTo(map),
    )
  }
}

function drawTrailPins() {
  clearMarkers(trailMarkers)
  if (!trailsToggle.checked) return
  if (!graphShowsLayer("trail")) return
  for (const pin of trailPins) {
    if (!trailPinVisible(pin)) continue
    const el = document.createElement("button")
    el.type = "button"
    el.title = pin.title
    if (isStreetGlovePin(pin)) {
      el.className = "marker glove" + (client.session.isCheckedIn(pin.id) ? " collected" : "")
      const img = document.createElement("img")
      img.src = "/icons/boxing-glove.svg"
      img.alt = pin.title || "Boxing glove"
      img.draggable = false
      el.appendChild(img)
    } else if (isParkBeaconPin(pin)) {
      el.className = "marker nearby" + (client.session.isCheckedIn(pin.id) ? " collected" : "")
      const img = document.createElement("img")
      img.src = pin.imageUrl || "/icons/park-beacon.svg"
      img.alt = pin.title || "Park beacon"
      img.draggable = false
      el.appendChild(img)
    } else {
      el.className = "marker hotel_champion"
      el.style.width = "10px"
      el.style.height = "10px"
    }
    el.addEventListener("click", (e) => {
      e.stopPropagation()
      openTrailPin(pin)
    })
    trailMarkers.push(
      new maplibregl.Marker({
        element: el,
        anchor: isStreetGlovePin(pin) ? "bottom" : "center",
      }).setLngLat([pin.lon, pin.lat]).addTo(map),
    )
  }
}

function openPersonalPhoto(photo: PersonalPhoto) {
  showSheet({
    kind: "personal photo",
    title: photo.caption,
    sub: `${photo.lat.toFixed(5)}, ${photo.lon.toFixed(5)}`,
    body: "On your personal Field Guide. Not a published trail pin and not a GLOVE collect.",
  })
  const art = document.createElement("img")
  art.className = "personal-sheet-art"
  art.src = photo.imageUrl
  art.alt = photo.caption
  sheetBody.after(art)
}

function drawPersonalPhotos() {
  clearMarkers(personalMarkers)
  for (const photo of personalPhotos) {
    const el = document.createElement("button")
    el.type = "button"
    el.className = "marker personal"
    el.title = photo.caption
    el.addEventListener("click", (e) => {
      e.stopPropagation()
      openPersonalPhoto(photo)
    })
    personalMarkers.push(new maplibregl.Marker({ element: el }).setLngLat([photo.lon, photo.lat]).addTo(map))
  }
}

async function refreshPersonalPhotos() {
  if (!client.session.hasJwt()) {
    personalPhotos = []
    drawPersonalPhotos()
    return
  }
  const avatarId = client.session.get().avatarId
  const jwt = client.session.getJwt()
  if (!avatarId || !jwt) {
    personalPhotos = []
    drawPersonalPhotos()
    return
  }
  try {
    personalPhotos = await loadPersonalPhotos({
      oasisBaseUrl: client.config.oasisBaseUrl,
      jwt,
      avatarId,
    })
    drawPersonalPhotos()
  } catch (err) {
    setStatus(err instanceof Error ? err.message : "Could not load personal photos")
  }
}

function fitPins(pins: TrailPin[]) {
  if (!pins.length) return
  if (pins.length === 1) {
    map.flyTo({ center: [pins[0].lon, pins[0].lat], zoom: 14.5, duration: 900 })
    return
  }
  const bounds = new maplibregl.LngLatBounds(
    [pins[0].lon, pins[0].lat],
    [pins[0].lon, pins[0].lat],
  )
  for (const p of pins) bounds.extend([p.lon, p.lat])
  map.fitBounds(bounds, {
    padding: walkActive
      ? { top: 48, left: 36, right: 36, bottom: 180 }
      : 60,
    maxZoom: 15,
    duration: 900,
  })
}

function wearClusterForPlace(placeId: string) {
  if (!activePersona) return
  const hit = clusterForPlace(activePersona, placeId)
  if (!hit || activeClusterId === hit.id) return
  activeClusterId = hit.id
  renderPersonas()
  applyView()
}

async function loadTrail(place: Place, opts?: { fit?: boolean }) {
  if (!place.trailFile) return
  wearClusterForPlace(place.id)
  activeTrailId = place.id
  setStatus(`Loading trail ${place.trailFile}…`)
  if (place.starQuestId) {
    const exp = await client.content.loadQuestExperience(place.starQuestId)
    trailPins = exp.pins.length ? exp.pins : await client.content.loadTrailFile(place.trailFile)
  } else {
    trailPins = await client.content.loadTrailFile(place.trailFile)
  }
  drawTrailPins()
  if (opts?.fit !== false && !walkActive && !document.body.classList.contains("mode-you")) {
    fitPins(trailPins)
  }
  renderList()
  if (walkActive) refreshWalkStrip()
  avatarDesk?.refresh()
  setStatus(
    trailPins.length
      ? `${place.shortName}: ${trailPins.length} trail pins`
      : `${place.shortName}: no pins in ${place.trailFile}`,
  )
}

function glovesPlace(): Place | undefined {
  return PLACES.find((p) => p.id === JAB_SW1_GLOVES_PLACE_ID)
}

function trailPinVisible(pin: TrailPin): boolean {
  const gloves = glovesPlace()
  const glovesOk = streetGlovePinVisible({
    isGlove: isStreetGlovePin(pin),
    activeTrailId,
    personaAllowsGlovesPlace: Boolean(
      gloves && personaAllowsPlace(activePersona, gloves, graphClusterId()),
    ),
  })
  if (!glovesOk) return false
  const circuit = PLACES.find((p) => p.id === FINSBURY_PARK_CIRCUIT_PLACE_ID)
  const beaconsOk = parkBeaconPinVisible({
    isBeacon: isParkBeaconPin(pin),
    activeTrailId,
    personaAllowsCircuitPlace: Boolean(
      circuit && personaAllowsPlace(activePersona, circuit, graphClusterId()),
    ),
  })
  if (!beaconsOk) return false
  return dayAfterTomorrowPinVisible({
    pin,
    activeTrailId,
    mintedPinIds: client.session.mintedCollectibleIds(),
  })
}

function unloadGlovesIfNotAllowed() {
  const place = glovesPlace()
  if (activeTrailId !== JAB_SW1_GLOVES_PLACE_ID) return
  if (place && personaAllowsPlace(activePersona, place, graphClusterId())) return
  trailPins = []
  activeTrailId = ""
  drawTrailPins()
  renderList()
}

function defaultSiteLabel(type: string): string {
  if (type === "transit") return "TfL"
  if (type === "park" || type === "trail") return "Official site"
  if (type === "culture") return "Area guide"
  if (type === "hq" || type === "anchor") return "Guide page"
  return "Venue site"
}

function mapsHref(place: Place): string {
  if (place.googleMaps) return String(place.googleMaps)
  return `https://maps.google.com/?q=${place.coords[1]},${place.coords[0]}`
}

function openPlace(place: Place) {
  for (const btn of listEl.querySelectorAll(".place-btn")) {
    btn.classList.toggle("active", (btn as HTMLElement).dataset.id === place.id)
  }
  map.flyTo({ center: place.coords, zoom: place.type === "trail" ? 13.5 : 15, pitch: 45, duration: 1100 })

  const actions: { label: string; href?: string; onClick?: () => void }[] = []
  actions.push({ label: "Maps", href: mapsHref(place) })
  if (place.link) {
    actions.push({
      label: String(place.siteLabel || defaultSiteLabel(place.type)),
      href: String(place.link),
    })
  }
  if (place.trailFile) {
    actions.push({
      label: "Show trail",
      onClick: () => {
        void loadTrail(place)
      },
    })
    actions.push({
      label: "Start walk",
      onClick: () => {
        void startWalk()
      },
    })
  }
  if (place.starQuestId) {
    actions.push({
      label: "Quest id",
      onClick: () => setStatus(`STAR quest ${place.starQuestId}`),
    })
  }

  const venueGigs =
    place.type === "music"
      ? shownGigs().filter((g) => gigMatchesVenue(g, place.name, place.coords)).slice(0, 8)
      : []

  showSheet({
    kind: place.type.replace(/_/g, " "),
    title: place.shortName || place.name,
    sub: place.subtitle,
    body: place.desc,
    actions,
  })

  if (venueGigs.length) {
    const wrap = document.createElement("div")
    wrap.className = "gig-sheet-list"
    const head = document.createElement("p")
    head.className = "gig-sheet-head"
    head.textContent = "What's on"
    wrap.appendChild(head)
    for (const gig of venueGigs) {
      const btn = document.createElement("button")
      btn.type = "button"
      btn.className = "gig-sheet-item"
      btn.innerHTML = `<span class="gig-when"></span><span class="gig-name"></span>`
      btn.querySelector(".gig-when")!.textContent = formatGigWhen(gig.startDate)
      btn.querySelector(".gig-name")!.textContent = gig.name
      btn.addEventListener("click", () => openGig(gig))
      wrap.appendChild(btn)
    }
    sheetBody.after(wrap)
  }

  if (place.type === "trail" && place.trailFile) void loadTrail(place)
}

function openGig(gig: Gig) {
  map.flyTo({ center: [gig.lng, gig.lat], zoom: 15.2, pitch: 48, duration: 900 })
  showSheet({
    kind: "what's on",
    title: gig.name,
    sub: `${gig.venueName} · ${formatGigWhen(gig.startDate)}`,
    body: gig.description || `Live listing via Skiddle at ${gig.venueName}.`,
    actions: [
      { label: "Tickets / info", href: gig.url },
    ],
  })
}

function openRa(ev: RaEvent) {
  const key = raEventKey(ev)
  // Toggle: click same event again closes the embed
  if (raPopupKey === key && !raEmbed.hidden) {
    closeRaEmbed()
    return
  }

  closeRaPopup()
  map.easeTo({
    center: [ev.lng, ev.lat],
    zoom: Math.max(map.getZoom(), 13.2),
    padding: { top: 40, bottom: 40, left: 40, right: 420 },
    duration: 650,
  })

  raPopupKey = key
  openRaEmbed(ev)

  // Small map pin popup as a location cue
  const when = formatRaWhen(ev.startDate)
  raPopup = new maplibregl.Popup({
    closeButton: false,
    closeOnClick: false,
    maxWidth: "200px",
    className: "ra-popup ra-popup-mini",
    offset: 12,
    anchor: "bottom",
  })
    .setLngLat([ev.lng, ev.lat])
    .setHTML(
      `<div class="ra-pop"><p class="ra-pop-kicker">RA</p><p class="ra-pop-title">${escapeHtml(ev.title)}</p><p class="ra-pop-meta">${escapeHtml(ev.venueName)} · ${escapeHtml(when)}</p></div>`,
    )
    .addTo(map)
}

function openNearby(pin: TrailPin) {
  showSheet({
    kind: pin.dropKind || pin.questRole || "nearby",
    title: pin.title || pin.id,
    sub: `${pin.lat.toFixed(5)}, ${pin.lon.toFixed(5)} · ${pin.radiusM}m`,
    body: pin.narrationText || pin.notes || "Live STAR GeoNFT from /api/GeoNFTs/nearby.",
    actions: [
      {
        label: "Check in",
        onClick: async () => {
          if (!client.session.hasJwt()) {
            setStatus("Sign in to check in")
            return
          }
          const result = await client.checkIn.handle(pin)
          setStatus(result.message)
        },
      },
    ],
  })
}

function openTrailPin(pin: TrailPin) {
  const glove = isStreetGlovePin(pin)
  const sit = isSitPin(pin)
  showSheet({
    kind: glove ? "street glove" : sit ? "sit" : pin.questRole || "trail pin",
    title: pin.title || pin.id,
    sub: pin.wikiSlug ? `wiki:${pin.wikiSlug}` : pin.id,
    body: glove
      ? `${pin.narrationText || pin.notes || "Street glove."} Check-in mints this glove as an NFT into your Solana wallet. Pin id ${pin.id} is the STAR objective.`
      : sit
        ? `${pin.narrationText || pin.notes || "Sit."} Stay in the radius through the placeholder audio. Completing mints ${pin.title} into your OASIS Solana wallet. That token unlocks the next sit.`
        : pin.narrationText || pin.notes || "Authored Field Guide trail pin.",
    actions: [
      {
        label: glove ? "Collect glove" : sit ? "Sit" : "Check in",
        onClick: () => {
          if (sit) {
            void sitAtWalkPin(pin.id)
            return
          }
          void collectPin(pin)
        },
      },
      ...(glove
        ? [
            {
              label: "Look",
              onClick: () => {
                void openLook({
                  pin,
                  getHere: walkHere,
                  deskStandIn: deskWalk,
                  onCollect: async () => {
                    if (!deskWalk && !insidePinRadius(walkHere(), pin)) {
                      const m = metersToPin(walkHere(), pin)
                      setStatus(
                        m == null
                          ? "GPS required to collect"
                          : `Walk closer (${Math.round(m)}m, need ${pin.radiusM}m)`,
                      )
                      return
                    }
                    await collectPin(pin)
                  },
                })
              },
            },
          ]
        : sit
          ? []
          : []),
    ],
  })
  if (glove) {
    const art = document.createElement("img")
    art.className = "glove-sheet-art"
    art.src = "/icons/boxing-glove.svg"
    art.alt = "Boxing glove"
    sheetKind.after(art)
  }
}

function graphClusterId(): string | null {
  return activePersona ? activeClusterId : null
}

function profileSnapshot() {
  const s = client.session.get()
  return buildProfileSnapshot({
    signedIn: client.session.hasJwt(),
    avatarName: s.avatarName,
    avatarId: s.avatarId,
    avatarEmail: s.avatarEmail,
    wallet: s.solanaWallet,
    persona: activePersona,
    clusterId: graphClusterId(),
    places: PLACES,
    trailPins,
    checkedInIds: client.session.checkedInIds(),
    mintedIds: client.session.mintedCollectibleIds(),
  })
}

function prepareGuideFromDesk(placeId: string) {
  const place = PLACES.find((p) => p.id === placeId)
  if (place?.trailFile) void loadTrail(place, { fit: false })
}

function showGuideOnMap(placeId: string) {
  const place = PLACES.find((p) => p.id === placeId)
  if (!place) return
  setYouPage(false)
  openPlace(place)
}

function setYouPage(on: boolean) {
  if (on && walkActive) stopWalk()
  if (on) {
    closeRaEmbed()
    hideSheet()
    avatarDesk?.open()
  } else {
    avatarDesk?.close()
  }
  document.body.classList.toggle("mode-you", on)
  avatarOpen.classList.toggle("active", on)
  avatarOpen.textContent = on ? "Map" : "You"
  requestAnimationFrame(() => map.resize())
}

function currentMode(): FieldGuideMode {
  if (walkActive) return "walk"
  if (document.body.classList.contains("mode-you")) return "you"
  return "map"
}

function paintProgress() {
  drawTrailPins()
  renderList()
  refreshWalkStrip()
  avatarDesk?.refresh()
}

function applyCollectedPinIds(ids: string[]) {
  for (const id of ids) client.session.markCheckedIn(id)
  if (ids.length) paintProgress()
}

async function pullStarProgress() {
  if (!client.session.hasJwt()) return
  try {
    const ids = await client.quests.syncSessionFromStar()
    applyCollectedPinIds(ids)
  } catch (err) {
    console.warn("[field-guide] STAR progress", err)
  }
  try {
    const read = await client.wallet.read({ includeNfts: true })
    for (const nft of read.nfts) {
      if (nft.trailPinId) client.session.markMintedCollectible(nft.trailPinId)
    }
    if (read.nfts.length) paintProgress()
  } catch (err) {
    console.warn("[field-guide] wallet NFTs", err)
  }
}

function beginSiteLink() {
  stopSiteLink?.()
  stopSiteLink = startFieldGuideSiteLink({
    jwt: () => client.session.getJwt() || "",
    view: () => {
      const sel = avatarDesk?.selection() ?? { placeId: "", pinId: "" }
      return {
        mode: currentMode(),
        selectedPlaceId: sel.placeId || activeTrailId,
        selectedPinId: sel.pinId,
        wearingPersonaId: activePersona?.id ?? null,
        wearingClusterId: graphClusterId(),
        lat: walkFix?.lat,
        lon: walkFix?.lon,
        accuracyM: walkFix?.accuracyM,
      }
    },
    onCommand: applySiteCommand,
    onCollected: applyCollectedPinIds,
  })
}

async function applySiteCommand(command: SiteCommand) {
  const place = PLACES.find((p) => p.id === command.placeId)
  if (!place?.trailFile) {
    setStatus(`Unknown guide ${command.placeId}`)
    return
  }
  await loadTrail(place)
  await startWalk()
  await lookAtWalkPin(command.pinId || undefined)
}

function graphShowsLayer(layer: GuideLayer): boolean {
  return personaShowsLayer(activePersona, layer, PLACES, graphClusterId())
}

function graphShowsFeed(feed: FeedId): boolean {
  if (!activePersona) return true
  return clusterFeeds(activePersona, graphClusterId()).has(feed)
}

function shownGigs() {
  return relevantLiveEvents(
    liveGigs,
    activePersona,
    PLACES,
    "gigs",
    graphClusterId(),
  )
}

function shownRa() {
  return relevantLiveEvents(
    liveRa,
    activePersona,
    PLACES,
    "ra",
    graphClusterId(),
  )
}

function raStatusLine(): string {
  if (!raToggle.checked) return "RA · off"
  if (!liveRa.length) return raStatus
  if (!activePersona) return `RA · ${liveRa.length} electronic (London)`
  const n = shownRa().length
  return `RA · ${n} of ${liveRa.length} on ${activePersona.name}'s music`
}

function applyView() {
  renderFilters()
  renderList()
  applyVenueVisibility()
  drawNearby()
  drawTrailPins()
  drawPersonalPhotos()
  drawGigs()
  drawRa()
  if (liveRa.length) raStatus = raStatusLine()
}

function renderStarGlyph() {
  const wearer = client.session.hasJwt() ? client.session.get().avatarName : ""
  starHandle?.setState(
    activePersona,
    activeClusterId,
    activePersona ? clusterStories(activePersona, PLACES) : [],
    wearer,
  )
  avatarDesk?.refresh()
}

function setPersona(persona: Persona | null) {
  activePersona = persona ? wornPersona(persona) : null
  activeClusterId = null
  activeFilter = "all"
  renderPersonas()
  applyView()
  if (!document.body.classList.contains("mode-you")) flyToGraph()
  unloadGlovesIfNotAllowed()
  avatarDesk?.refresh()
  setStatus(
    persona
      ? `Demo guide as ${persona.name}: ${persona.clusters.map((c) => c.label).join(" · ")}`
      : "Published Guide. No personal graph.",
  )
}

function toggleCluster(clusterId: string) {
  if (!activePersona) return
  const person = activePersona
  activeClusterId = activeClusterId === clusterId ? null : clusterId
  activeFilter = "all"
  renderPersonas()
  applyView()
  if (!document.body.classList.contains("mode-you")) flyToGraph()
  const shown = person.clusters.find((c) => c.id === activeClusterId)
  if (shown) {
    const trailPlace = PLACES.find(
      (p) =>
        shown.placeIds.includes(p.id) &&
        Boolean(p.trailFile) &&
        p.id !== JAB_SW1_GLOVES_PLACE_ID,
    )
    if (trailPlace) void loadTrail(trailPlace)
    else unloadGlovesIfNotAllowed()
  } else {
    unloadGlovesIfNotAllowed()
  }
  setStatus(
    shown
      ? `${person.name}: ${shown.label}`
      : `Guide as ${person.name}: ${person.clusters.map((c) => c.label).join(" · ")}`,
  )
  avatarDesk?.refresh()
}

function renderPersonas() {
  personaBtns.innerHTML = ""
  const add = (label: string, persona: Persona | null) => {
    const btn = document.createElement("button")
    btn.type = "button"
    btn.className =
      "persona-btn" + ((activePersona?.id ?? null) === (persona?.id ?? null) ? " active" : "")
    btn.textContent = label
    btn.addEventListener("click", () => setPersona(persona))
    personaBtns.appendChild(btn)
  }
  add("Published", null)
  for (const p of PERSONAS) {
    add(`${p.name} · ${p.age}`, p)
  }

  if (!activePersona) {
    personaBlurb.textContent =
      "This is the published map. Pick a demo person to see only the places their graph shows a met peer."
    personaClusters.innerHTML = ""
    personaClusters.setAttribute("aria-hidden", "true")
    renderStarGlyph()
    return
  }

  const person = activePersona
  personaBlurb.textContent = person.blurb
  personaClusters.innerHTML = ""
  personaClusters.setAttribute("aria-hidden", "true")
  renderStarGlyph()
}

function filterAllowed(id: string): boolean {
  if (!activePersona) return true
  if (id === "all") return true
  return graphShowsLayer(id as GuideLayer)
}

function renderFilters() {
  filtersEl.innerHTML = ""
  for (const f of FILTERS) {
    const allowed = filterAllowed(f.id)
    const btn = document.createElement("button")
    btn.type = "button"
    btn.className = "filter-btn" + (activeFilter === f.id ? " active" : "")
    btn.textContent = f.label
    btn.disabled = !allowed
    btn.title = allowed ? f.label : "Not on this personal graph"
    btn.addEventListener("click", () => {
      if (!filterAllowed(f.id)) return
      activeFilter = f.id
      if (f.id === "ra") {
        revealRaVertex()
        renderPersonas()
      }
      applyView()
      if (f.id === "ra") {
        fitRaView()
        void refreshRa()
      }
    })
    filtersEl.appendChild(btn)
  }
}

function placeVisible(place: Place): boolean {
  if (!personaAllowsPlace(activePersona, place, graphClusterId())) return false
  if (place.type === "anchor") return activeFilter === "all"
  if (activeFilter === "all") return true
  if (activeFilter === "nearby") return false
  if (activeFilter === "gigs" || activeFilter === "ra") return place.type === "music"
  return place.type === activeFilter
}

function renderList() {
  listEl.innerHTML = ""
  for (const place of PLACES) {
    if (place.type === "anchor") continue
    if (!placeVisible(place)) continue

    const btn = document.createElement("button")
    btn.type = "button"
    btn.className = "place-btn" + (place.id === activeTrailId ? " active" : "")
    btn.dataset.id = place.id
    btn.setAttribute("role", "listitem")
    btn.innerHTML = `<span class="title"></span><span class="meta"></span>`
    btn.querySelector(".title")!.textContent = place.name
    const gigCount =
      place.type === "music"
        ? shownGigs().filter((g) => gigMatchesVenue(g, place.name, place.coords)).length
        : 0
    btn.querySelector(".meta")!.textContent =
      gigCount > 0
        ? `${place.type} · ${gigCount} upcoming`
        : `${place.type} · ${place.sector || place.region || ""}`
    btn.addEventListener("click", () => openPlace(place))
    listEl.appendChild(btn)
  }

  if (
    graphShowsFeed("gigs") &&
    (activeFilter === "all" || activeFilter === "gigs" || activeFilter === "music")
  ) {
    for (const gig of shownGigs().slice(0, activeFilter === "gigs" ? 40 : 12)) {
      const btn = document.createElement("button")
      btn.type = "button"
      btn.className = "place-btn gig-list-item"
      btn.dataset.id = `gig:${gig.id}`
      btn.innerHTML = `<span class="title"></span><span class="meta"></span>`
      btn.querySelector(".title")!.textContent = `♪ ${gig.name}`
      btn.querySelector(".meta")!.textContent =
        `${gig.venueName} · ${formatGigWhen(gig.startDate)}`
      btn.addEventListener("click", () => openGig(gig))
      listEl.appendChild(btn)
    }
  }

  if (graphShowsFeed("ra") && (activeFilter === "all" || activeFilter === "ra")) {
    for (const ev of shownRa().slice(0, activeFilter === "ra" ? 60 : 16)) {
      const btn = document.createElement("button")
      btn.type = "button"
      btn.className = "place-btn ra-list-item"
      btn.dataset.id = `ra:${ev.id}`
      btn.innerHTML = `<span class="title"></span><span class="meta"></span>`
      btn.querySelector(".title")!.textContent = `⌁ ${ev.title}`
      btn.querySelector(".meta")!.textContent =
        `${ev.venueName} · ${formatRaWhen(ev.startDate)}`
      btn.addEventListener("click", () => openRa(ev))
      listEl.appendChild(btn)
    }
  }

  if (
    graphShowsLayer("trail") &&
    (activeFilter === "all" || activeFilter === "trail")
  ) {
    for (const pin of trailPins) {
      if (!trailPinVisible(pin) || !(isStreetGlovePin(pin) || isSitPin(pin))) continue
      const btn = document.createElement("button")
      btn.type = "button"
      btn.className = "place-btn"
      btn.className = "place-btn glove-list-item"
      btn.dataset.id = `glove:${pin.id}`
      btn.innerHTML = `<img class="glove-list-icon" src="/icons/boxing-glove.svg" alt="" /><span class="glove-list-copy"><span class="title"></span><span class="meta"></span></span>`
      btn.querySelector(".title")!.textContent = pin.title || pin.id
      btn.querySelector(".meta")!.textContent = client.session.isCheckedIn(pin.id)
        ? "in your wallet"
        : "street glove · collect to wallet"
      btn.addEventListener("click", () => {
        map.flyTo({ center: [pin.lon, pin.lat], zoom: 16, duration: 800 })
        openTrailPin(pin)
      })
      listEl.appendChild(btn)
    }
  }

  if (
    graphShowsFeed("nearby") &&
    (activeFilter === "all" || activeFilter === "nearby")
  ) {
    for (const pin of nearbyPins) {
      const btn = document.createElement("button")
      btn.type = "button"
      btn.className = "place-btn"
      btn.dataset.id = `nearby:${pin.id}`
      btn.innerHTML = `<span class="title"></span><span class="meta"></span>`
      btn.querySelector(".title")!.textContent = `◆ ${pin.title || pin.id}`
      btn.querySelector(".meta")!.textContent = `live · ${pin.dropKind || pin.questRole || "pin"}`
      btn.addEventListener("click", () => {
        map.flyTo({ center: [pin.lon, pin.lat], zoom: 15, duration: 800 })
        openNearby(pin)
      })
      listEl.appendChild(btn)
    }
  }
}

function revealRaVertex() {
  if (!activePersona) return
  if (clusterFeeds(activePersona, activeClusterId).has("ra")) return
  const hit = clusterForFeed(activePersona, "ra")
  if (hit) activeClusterId = hit.id
}

function fitRaView() {
  if (walkActive || activeFilter !== "ra") return
  const events = shownRa()
  if (!events.length) return
  if (events.length === 1) {
    map.flyTo({
      center: [events[0].lng, events[0].lat],
      zoom: 13.4,
      pitch: 35,
      duration: 900,
    })
    return
  }
  const first = events[0]
  const bounds = new maplibregl.LngLatBounds(
    [first.lng, first.lat],
    [first.lng, first.lat],
  )
  for (const ev of events) bounds.extend([ev.lng, ev.lat])
  map.fitBounds(bounds, {
    padding: { top: 70, left: 48, right: 340, bottom: 48 },
    maxZoom: 12.4,
    duration: 950,
  })
}

function flyToGraph() {
  if (walkActive) return
  if (activeFilter === "ra") {
    fitRaView()
    return
  }
  if (!activePersona) {
    map.flyTo({ center: FINSBURY, zoom: 13.2, pitch: 42, bearing: -12, duration: 900 })
    return
  }
  const pins = visiblePlaces(PLACES, activePersona, graphClusterId()).filter(
    (p) => p.type !== "anchor",
  )
  if (!pins.length) return
  if (pins.length === 1) {
    map.flyTo({ center: pins[0].coords, zoom: 14.6, pitch: 45, duration: 900 })
    return
  }
  const bounds = new maplibregl.LngLatBounds(pins[0].coords, pins[0].coords)
  for (const p of pins) bounds.extend(p.coords)
  map.fitBounds(bounds, {
    padding: { top: 70, left: 48, right: 340, bottom: 48 },
    maxZoom: 13.8,
    duration: 950,
  })
}

function applyVenueVisibility() {
  for (const place of PLACES) {
    const marker = venueMarkers.get(place.id)
    if (!marker) continue
    const el = marker.getElement()
    const show = placeVisible(place)
    el.style.display = show ? "" : "none"
    const cluster = clusterForPlace(activePersona, place.id)
    if (cluster && show) {
      el.style.setProperty("--pin", cluster.color)
      el.classList.add("graph-pin")
      el.classList.toggle(
        "dim",
        Boolean(activeClusterId && cluster.id !== activeClusterId),
      )
    } else {
      el.classList.remove("graph-pin", "dim")
      el.style.removeProperty("--pin")
    }
  }
}

function drawVenues() {
  for (const place of PLACES) {
    if (place.type === "anchor") continue
    const el = document.createElement("button")
    el.type = "button"
    el.className = `marker ${markerClass(place.type)}`
    el.title = place.name
    el.addEventListener("click", (e) => {
      e.stopPropagation()
      openPlace(place)
    })
    venueMarkers.set(
      place.id,
      new maplibregl.Marker({ element: el, anchor: "center" })
        .setLngLat(place.coords)
        .addTo(map),
    )
  }
  applyVenueVisibility()
}

function drawGigs() {
  clearMarkers(gigMarkers)
  if (!gigsToggle.checked) return
  if (!graphShowsFeed("gigs")) return
  if (activeFilter !== "all" && activeFilter !== "gigs" && activeFilter !== "music") {
    return
  }
  for (const gig of shownGigs()) {
    const el = document.createElement("button")
    el.type = "button"
    el.className = "marker gig"
    el.title = `${gig.name} · ${formatGigWhen(gig.startDate)}`
    el.addEventListener("click", (e) => {
      e.stopPropagation()
      openGig(gig)
    })
    gigMarkers.push(
      new maplibregl.Marker({ element: el, anchor: "center" })
        .setLngLat([gig.lng, gig.lat])
        .addTo(map),
    )
  }
}

function drawRa() {
  clearMarkers(raMarkers)
  closeRaEmbed()
  if (!raToggle.checked) return
  if (!graphShowsFeed("ra")) return
  if (activeFilter !== "all" && activeFilter !== "ra") return
  for (const ev of shownRa()) {
    const el = document.createElement("button")
    el.type = "button"
    el.className = "marker ra"
    el.title = `${ev.title} · ${ev.venueName}`
    el.addEventListener("click", (e) => {
      e.stopPropagation()
      openRa(ev)
    })
    raMarkers.push(
      new maplibregl.Marker({ element: el, anchor: "center" })
        .setLngLat([ev.lng, ev.lat])
        .addTo(map),
    )
  }
}

async function refreshGigs() {
  if (!gigsToggle.checked) {
    liveGigs = []
    clearMarkers(gigMarkers)
    gigsStatus = "What's on · off"
    renderList()
    return
  }
  gigsStatus = "What's on · fetching…"
  setStatus(gigsStatus)
  try {
    liveGigs = await fetchWhatsOn()
    gigsStatus = activePersona
      ? `What's on · ${shownGigs().length} of ${liveGigs.length} on ${activePersona.name}'s music`
      : `What's on · ${liveGigs.length} gigs (Skiddle)`
    drawGigs()
    renderList()
    setStatus(`${gigsStatus} · ${raStatus}`)
  } catch (e) {
    liveGigs = []
    clearMarkers(gigMarkers)
    gigsStatus = e instanceof Error ? e.message : "What's on failed"
    setStatus(gigsStatus)
    renderList()
  }
}

async function refreshRa() {
  if (raRefresh) return raRefresh
  raRefresh = runRefreshRa().finally(() => {
    raRefresh = null
  })
  return raRefresh
}

async function runRefreshRa() {
  if (!raToggle.checked) {
    liveRa = []
    clearMarkers(raMarkers)
    raStatus = "RA · off"
    renderList()
    return
  }
  raStatus = "RA · fetching London…"
  setStatus(raStatus)
  try {
    liveRa = await fetchRaLondon()
    raStatus = raStatusLine()
    drawRa()
    renderList()
    setStatus(`${gigsStatus} · ${raStatus}`)
    if (activeFilter === "ra") fitRaView()
  } catch (e) {
    liveRa = []
    clearMarkers(raMarkers)
    raStatus = e instanceof Error ? e.message : "RA failed"
    setStatus(raStatus)
    renderList()
  }
}

async function refreshNearby() {
  if (!nearbyToggle.checked) {
    nearbyPins = []
    clearMarkers(nearbyMarkers)
    renderList()
    setStatus(`Finsbury · nearby off · ${trailPins.length} trail pins`)
    return
  }
  const origin = walkFix ?? { lat: FINSBURY[1], lon: FINSBURY[0] }
  setStatus(
    walkFix
      ? "Fetching STAR nearby around you…"
      : "Fetching STAR nearby around Finsbury Park…",
  )
  try {
    nearbyPins = await client.geo.nearby({
      lat: origin.lat,
      lon: origin.lon,
      radiusKm: NEARBY_RADIUS_KM,
      forceRefresh: true,
    })
    drawNearby()
    renderList()
    const who = client.session.hasJwt()
      ? client.session.get().avatarName || "signed in"
      : "guest"
    setStatus(
      `Finsbury · ${nearbyPins.length} nearby · ${trailPins.length} trail · ${who}`,
    )
  } catch (err) {
    console.error(err)
    setStatus(err instanceof Error ? err.message : "Nearby failed")
  }
}

function renderAuth() {
  authBox.innerHTML = ""
  if (client.session.hasJwt()) {
    const who = document.createElement("button")
    who.type = "button"
    who.className = "auth-who"
    who.textContent = client.session.get().avatarName || "Avatar"
    who.title = "Open avatar desk"
    who.addEventListener("click", () => setYouPage(true))
    const out = document.createElement("button")
    out.type = "button"
    out.textContent = "Sign out"
    out.addEventListener("click", () => {
      client.session.clear()
      personalPhotos = []
      drawPersonalPhotos()
      renderAuth()
      renderStarGlyph()
      setStatus("Signed out")
    })
    authBox.append(who, out)
    return
  }
  const email = document.createElement("input")
  email.type = "email"
  email.placeholder = "username or email"
  email.autocomplete = "username"
  const password = document.createElement("input")
  password.type = "password"
  password.placeholder = "password"
  password.autocomplete = "current-password"
  const go = document.createElement("button")
  go.type = "button"
  go.textContent = "Sign in"
  go.addEventListener("click", async () => {
    setStatus("Signing in…")
    const result = await client.auth.authenticate({
      username: email.value.trim(),
      email: email.value.trim(),
      password: password.value,
    })
    if (!result.ok) {
      setStatus(result.message)
      return
    }
    renderAuth()
    renderStarGlyph()
    avatarDesk?.refresh()
    void refreshPersonalPhotos()
    beginSiteLink()
    void pullStarProgress()
    setStatus(`Signed in as ${result.result.avatarName || result.result.avatarEmail}`)
  })
  authBox.append(email, password, go)
}

walkEnter.addEventListener("click", () => {
  void startWalk()
})
walkDeskBtn.addEventListener("click", () => stopWalk())
walkLookBtn.addEventListener("click", () => {
  void lookAtWalkPin()
})
walkCollectBtn.addEventListener("click", () => {
  void collectActiveWalkPin()
})
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState !== "visible") return
  if (walkActive) void holdWakeLock()
  if (raToggle.checked) void refreshRa()
  void pullStarProgress()
})

nearbyToggle.addEventListener("change", () => {
  void refreshNearby()
})
trailsToggle.addEventListener("change", () => {
  drawTrailPins()
})
trainToggle.addEventListener("change", () => {
  train.setEnabled(trainToggle.checked)
})
gigsToggle.addEventListener("change", () => {
  void refreshGigs()
})
raToggle.addEventListener("change", () => {
  void refreshRa()
})

async function boot() {
  starHandle = mountStar(starGlyph, toggleCluster)
  avatarDesk = mountAvatarDesk(avatarDeskBody, statusEl, {
    snapshot: profileSnapshot,
    wearPersona: (id) => {
      const persona = PERSONAS.find((p) => p.id === id) ?? null
      setPersona(persona)
    },
    pickCluster: (id) => toggleCluster(id),
    prepareGuide: prepareGuideFromDesk,
    showGuideOnMap: showGuideOnMap,
    connectMyAi: async (provider) => {
      const jwt = client.session.getJwt()
      let res: Response
      try {
        res = await fetch("/connect", {
          method: "POST",
          headers: {
            ...(jwt ? { Authorization: `Bearer ${jwt}` } : {}),
            "X-Public-Origin": window.location.origin,
          },
        })
      } catch {
        return { ok: false, message: "Could not reach the Field Guide connector. Run npm run dev." }
      }
      let data: {
        ok?: boolean
        message?: string
        mcpUrl?: string
        claudeUrl?: string
      }
      try {
        data = (await res.json()) as typeof data
      } catch {
        return { ok: false, message: "Personal AI is not running. Start the Field Guide with npm run dev." }
      }
      if (!data.ok || !data.claudeUrl || !data.mcpUrl) {
        return { ok: false, message: data.message || "Could not start the connector." }
      }
      if (jwt) beginSiteLink()
      try {
        await navigator.clipboard.writeText(data.mcpUrl)
      } catch {
        /* clipboard optional */
      }
      if (provider === "chatgpt") {
        return {
          ok: true,
          mcpUrl: data.mcpUrl,
          openUrl: "https://chatgpt.com/plugins",
          message: `Shared Field Guide MCP (OAuth):\n${data.mcpUrl}\nCreate this ChatGPT connector once and keep that name. Sign in with your OASIS avatar. Do not use auth none. Do not recreate it when Field Guide tools change.`,
        }
      }
      return {
        ok: true,
        mcpUrl: data.mcpUrl,
        openUrl: data.claudeUrl,
        message: "Claude is opening with the shared Field Guide URL. Add it. Sign in with OASIS when Claude asks.",
      }
    },
    ensureWallet: () => client.wallet.ensure(),
  })
  avatarOpen.addEventListener("click", () => {
    setYouPage(!document.body.classList.contains("mode-you"))
  })
  avatarDeskClose.addEventListener("click", () => setYouPage(false))
  renderAuth()
  renderPersonas()
  renderFilters()
  drawVenues()
  renderList()
  if (client.session.hasJwt()) {
    beginSiteLink()
    void pullStarProgress()
  }
  await Promise.all([refreshNearby(), refreshGigs(), refreshRa(), refreshPersonalPhotos()])
  await applyQuestDeepLink()
  window.setInterval(() => {
    if (document.visibilityState === "visible" && raToggle.checked) void refreshRa()
  }, RA_POLL_MS)
}

void boot()
