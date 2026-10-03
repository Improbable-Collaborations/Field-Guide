import maplibregl from "maplibre-gl"
import {
  createFieldGuideWeb4Client,
  type TrailPin,
} from "field-guide-web4-client"
import { PLACES, type Place } from "./places"
import "./styles.css"

const client = createFieldGuideWeb4Client({
  source: "playa-guide-web",
})

const PDC: [number, number] = [-87.055, 20.648]
const NEARBY_RADIUS_KM = 8

const listEl = document.getElementById("place-list")!
const statusEl = document.getElementById("status")!
const filtersEl = document.getElementById("filters")!
const authBox = document.getElementById("auth-box")!
const sheet = document.getElementById("sheet")!
const sheetKind = document.getElementById("sheet-kind")!
const sheetTitle = document.getElementById("sheet-title")!
const sheetSub = document.getElementById("sheet-sub")!
const sheetBody = document.getElementById("sheet-body")!
const sheetActions = document.getElementById("sheet-actions")!
const nearbyToggle = document.getElementById("toggle-nearby") as HTMLInputElement

document.getElementById("sheet-close")!.addEventListener("click", hideSheet)

const FILTERS: { id: string; label: string }[] = [
  { id: "all", label: "All" },
  { id: "conservation", label: "Conservation" },
  { id: "hotel_champion", label: "Champion" },
  { id: "hotel_partner", label: "Partner" },
  { id: "hotel_starter", label: "Starter" },
  { id: "gym", label: "Gyms" },
  { id: "nearby", label: "Live drops" },
]

let activeFilter = "all"
let nearbyPins: TrailPin[] = []
const venueMarkers = new Map<string, maplibregl.Marker>()
let nearbyMarkers: maplibregl.Marker[] = []

const map = new maplibregl.Map({
  container: "map",
  style: "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json",
  center: PDC,
  zoom: 11.5,
  pitch: 40,
  bearing: -8,
})
map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "bottom-right")

function setStatus(msg: string) {
  statusEl.textContent = msg
}

function hideSheet() {
  sheet.classList.add("hidden")
  sheet.hidden = true
}

function showSheet(args: {
  kind: string
  title: string
  sub?: string
  body?: string
  actions?: { label: string; href?: string; onClick?: () => void }[]
}) {
  sheetKind.textContent = args.kind
  sheetTitle.textContent = args.title
  sheetSub.textContent = args.sub || ""
  sheetBody.textContent = args.body || ""
  sheetActions.innerHTML = ""
  for (const a of args.actions || []) {
    if (a.href) {
      const link = document.createElement("a")
      link.href = a.href
      link.target = "_blank"
      link.rel = "noopener"
      link.textContent = a.label
      sheetActions.appendChild(link)
    } else {
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
  if (type.startsWith("hotel_")) return type
  if (type === "conservation" || type === "gym" || type === "anchor") return type
  return "anchor"
}

function clearNearbyMarkers() {
  for (const m of nearbyMarkers) m.remove()
  nearbyMarkers = []
}

function drawNearby() {
  clearNearbyMarkers()
  if (!nearbyToggle.checked) return
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
      new maplibregl.Marker({ element: el })
        .setLngLat([pin.lon, pin.lat])
        .addTo(map),
    )
  }
}

function openPlace(place: Place) {
  for (const btn of listEl.querySelectorAll(".place-btn")) {
    btn.classList.toggle("active", (btn as HTMLElement).dataset.id === place.id)
  }
  map.flyTo({ center: place.coords, zoom: 14, pitch: 45, duration: 1200 })
  const actions: { label: string; href?: string; onClick?: () => void }[] = []
  if (place.googleMaps) actions.push({ label: "Maps", href: String(place.googleMaps) })
  if (place.link) actions.push({ label: "Open", href: String(place.link) })
  if (place.starHolonId) {
    actions.push({
      label: "Holon",
      onClick: () => {
        setStatus(`STAR holon ${place.starHolonId}`)
      },
    })
  }
  showSheet({
    kind: place.type.replace(/_/g, " "),
    title: place.shortName || place.name,
    sub: place.subtitle,
    body: place.desc,
    actions,
  })
}

function openNearby(pin: TrailPin) {
  showSheet({
    kind: pin.dropKind || pin.questRole || "nearby",
    title: pin.title || pin.id,
    sub: `${pin.lat.toFixed(5)}, ${pin.lon.toFixed(5)} · ${pin.radiusM}m`,
    body: pin.narrationText || pin.notes || "Live STAR GeoNFT pin from /api/GeoNFTs/nearby.",
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

function renderFilters() {
  filtersEl.innerHTML = ""
  for (const f of FILTERS) {
    const btn = document.createElement("button")
    btn.type = "button"
    btn.className = "filter-btn" + (activeFilter === f.id ? " active" : "")
    btn.textContent = f.label
    btn.addEventListener("click", () => {
      activeFilter = f.id
      renderFilters()
      renderList()
      applyVenueVisibility()
      drawNearby()
    })
    filtersEl.appendChild(btn)
  }
}

function placeVisible(place: Place): boolean {
  if (activeFilter === "all") return place.type !== "anchor" || place.id === "pdc"
  if (activeFilter === "nearby") return false
  return place.type === activeFilter
}

function renderList() {
  listEl.innerHTML = ""
  const venues = PLACES.filter((p) => p.type !== "anchor" || p.id === "pdc")
  for (const place of venues) {
    if (activeFilter !== "all" && activeFilter !== "nearby" && place.type !== activeFilter) {
      continue
    }
    if (activeFilter === "nearby") continue
    const btn = document.createElement("button")
    btn.type = "button"
    btn.className = "place-btn"
    btn.dataset.id = place.id
    btn.setAttribute("role", "listitem")
    btn.innerHTML = `<span class="title"></span><span class="meta"></span>`
    btn.querySelector(".title")!.textContent = place.name
    btn.querySelector(".meta")!.textContent = `${place.type.replace(/_/g, " ")} · ${place.region || ""}`
    btn.addEventListener("click", () => openPlace(place))
    listEl.appendChild(btn)
  }

  if (activeFilter === "all" || activeFilter === "nearby") {
    for (const pin of nearbyPins) {
      const btn = document.createElement("button")
      btn.type = "button"
      btn.className = "place-btn"
      btn.dataset.id = `nearby:${pin.id}`
      btn.innerHTML = `<span class="title"></span><span class="meta"></span>`
      btn.querySelector(".title")!.textContent = `◆ ${pin.title || pin.id}`
      btn.querySelector(".meta")!.textContent = `live · ${pin.dropKind || pin.questRole || "pin"}`
      btn.addEventListener("click", () => {
        map.flyTo({ center: [pin.lon, pin.lat], zoom: 14, duration: 900 })
        openNearby(pin)
      })
      listEl.appendChild(btn)
    }
  }
}

function applyVenueVisibility() {
  for (const place of PLACES) {
    const marker = venueMarkers.get(place.id)
    if (!marker) continue
    const el = marker.getElement()
    el.style.display = placeVisible(place) ? "" : "none"
  }
}

function drawVenues() {
  for (const place of PLACES) {
    if (place.type === "anchor" && place.id !== "pdc" && place.id !== "riviera") {
      // still draw anchors lightly via list only; skip distant region hub on map clutter
    }
    const el = document.createElement("button")
    el.type = "button"
    el.className = `marker ${markerClass(place.type)}`
    el.title = place.name
    el.addEventListener("click", (e) => {
      e.stopPropagation()
      openPlace(place)
    })
    const marker = new maplibregl.Marker({ element: el, anchor: "center" })
      .setLngLat(place.coords)
      .addTo(map)
    venueMarkers.set(place.id, marker)
  }
  applyVenueVisibility()
}

async function refreshNearby() {
  if (!nearbyToggle.checked) {
    nearbyPins = []
    clearNearbyMarkers()
    renderList()
    setStatus(`${PLACES.length} venues · nearby off`)
    return
  }
  setStatus("Fetching STAR nearby…")
  try {
    nearbyPins = await client.geo.nearby({
      lat: PDC[1],
      lon: PDC[0],
      radiusKm: NEARBY_RADIUS_KM,
      forceRefresh: true,
    })
    drawNearby()
    renderList()
    const who = client.session.hasJwt() ? client.session.get().avatarName || "signed in" : "guest"
    setStatus(
      `${PLACES.length} venues · ${nearbyPins.length} nearby · ${who}`,
    )
  } catch (err) {
    console.error(err)
    setStatus(err instanceof Error ? err.message : "Nearby failed")
  }
}

function renderAuth() {
  authBox.innerHTML = ""
  if (client.session.hasJwt()) {
    const who = document.createElement("span")
    who.className = "auth-who"
    who.textContent = client.session.get().avatarName || "Avatar"
    const out = document.createElement("button")
    out.type = "button"
    out.textContent = "Sign out"
    out.addEventListener("click", () => {
      client.session.clear()
      renderAuth()
      setStatus("Signed out")
    })
    authBox.append(who, out)
    return
  }

  const email = document.createElement("input")
  email.type = "email"
  email.placeholder = "email"
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
      email: email.value.trim(),
      password: password.value,
    })
    if (!result.ok) {
      setStatus(result.message)
      return
    }
    renderAuth()
    setStatus(`Signed in as ${result.result.avatarName || result.result.avatarEmail}`)
  })
  authBox.append(email, password, go)
}

nearbyToggle.addEventListener("change", () => {
  void refreshNearby()
})

async function boot() {
  renderAuth()
  renderFilters()
  drawVenues()
  renderList()
  await refreshNearby()
}

void boot()
