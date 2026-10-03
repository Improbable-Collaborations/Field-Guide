import type { Map as MapLibreMap, GeoJSONSource } from "maplibre-gl"
import maplibregl from "maplibre-gl"
import {
  buildRailPath,
  pointAlong,
  approachDistance,
  type LngLat,
  type RailPath,
} from "./rail"
import {
  fetchFinsburyArrivals,
  formatEta,
  isNorthbound,
  lineColor,
  type TflArrival,
} from "./tfl"

const RAIL_SOURCE = "finsbury-rail"
const RAIL_LAYER = "finsbury-rail-line"
const POLL_MS = 30_000
const MAX_MARKERS = 8

export type TrainController = {
  setEnabled: (on: boolean) => void
  destroy: () => void
}

type ServiceMarker = {
  key: string
  marker: maplibregl.Marker
  el: HTMLDivElement
  body: HTMLDivElement
}

function boardEl(): HTMLElement {
  let el = document.getElementById("tfl-board")
  if (!el) {
    el = document.createElement("aside")
    el.id = "tfl-board"
    el.className = "tfl-board"
    document.getElementById("app")?.appendChild(el)
  }
  return el
}

function renderBoard(arrivals: TflArrival[], err?: string) {
  const el = boardEl()
  if (err) {
    el.innerHTML = `<p class="tfl-board-title">TfL · Finsbury Park</p><p class="tfl-board-meta">${err}</p>`
    return
  }
  const rows = arrivals.slice(0, 10)
  const hasRail = arrivals.some((a) => a.modeName === "national-rail")
  el.innerHTML = `
    <p class="tfl-board-title">TfL · Finsbury Park</p>
    <p class="tfl-board-meta">${
      hasRail
        ? "Live arrivals on corridor"
        : "Tube live · surface NR predictions empty from TfL"
    }</p>
    <ul class="tfl-board-list">
      ${rows
        .map((a) => {
          const color = lineColor(a.lineName)
          const dest = (a.towards || a.destinationName || "").replace(
            / Underground Station$/i,
            "",
          )
          return `<li>
            <span class="tfl-line" style="background:${color}"></span>
            <span class="tfl-dest">${a.lineName} · ${dest}</span>
            <span class="tfl-eta">${formatEta(a.timeToStation)}</span>
          </li>`
        })
        .join("")}
    </ul>`
}

export function attachTrain(map: MapLibreMap): TrainController {
  let enabled = false
  let path: RailPath | null = null
  let pollTimer = 0
  let raf = 0
  let arrivals: TflArrival[] = []
  let fetchedAt = 0
  const services = new Map<string, ServiceMarker>()

  async function loadPath() {
    const res = await fetch("/finsbury-rail.geojson")
    if (!res.ok) throw new Error(`rail geojson ${res.status}`)
    const fc = await res.json()
    const coords = fc.features?.[0]?.geometry?.coordinates as LngLat[]
    if (!coords?.length) throw new Error("rail geojson empty")
    path = buildRailPath(coords)
    if (!map.getSource(RAIL_SOURCE)) {
      map.addSource(RAIL_SOURCE, { type: "geojson", data: fc })
      map.addLayer({
        id: RAIL_LAYER,
        type: "line",
        source: RAIL_SOURCE,
        paint: {
          "line-color": "#9aa3a0",
          "line-width": 1.25,
          "line-opacity": 0.28,
          "line-dasharray": [2, 2],
        },
      })
    } else {
      ;(map.getSource(RAIL_SOURCE) as GeoJSONSource).setData(fc)
    }
  }

  function clearMarkers() {
    for (const s of services.values()) s.marker.remove()
    services.clear()
  }

  function upsertMarker(a: TflArrival): ServiceMarker {
    const key =
      a.id ||
      `${a.lineName}|${a.platformName}|${a.expectedArrival}|${a.vehicleId || ""}`
    let s = services.get(key)
    if (s) return s
    const el = document.createElement("div")
    el.className = "train-marker"
    const body = document.createElement("div")
    body.className = "train-marker-body"
    const color = lineColor(a.lineName)
    body.innerHTML = `<span class="train-dot" style="background:${color};box-shadow:0 0 0 1px rgba(0,0,0,0.45)"></span>`
    el.appendChild(body)
    el.title = `${a.lineName} · ${a.towards || a.destinationName} · ${formatEta(a.timeToStation)}`
    const marker = new maplibregl.Marker({ element: el, anchor: "center" })
      .setLngLat([-0.1064, 51.5645])
      .addTo(map)
    s = { key, marker, el, body }
    services.set(key, s)
    return s
  }

  function syncMarkers() {
    if (!path || !enabled) return
    const now = Date.now()
    const driftSec = fetchedAt ? (now - fetchedAt) / 1000 : 0
    const keep = new Set<string>()
    const slice = arrivals.slice(0, MAX_MARKERS)
    for (const a of slice) {
      const eta = Math.max(0, (a.timeToStation ?? 0) - driftSec)
      const north = isNorthbound(a)
      const dist = approachDistance(path, eta, north)
      const { lngLat, bearing } = pointAlong(path, dist)
      const s = upsertMarker(a)
      keep.add(s.key)
      s.marker.setLngLat(lngLat)
      s.body.style.transform = `rotate(${bearing}deg)`
      const dest = (a.towards || a.destinationName || "").replace(
        / Underground Station$/i,
        "",
      )
      s.el.title = `${a.lineName} · ${dest} · ${formatEta(eta)}${
        a.currentLocation ? ` · ${a.currentLocation}` : ""
      }`
    }
    for (const [key, s] of services) {
      if (!keep.has(key)) {
        s.marker.remove()
        services.delete(key)
      }
    }
  }

  function tick() {
    if (!enabled) return
    syncMarkers()
    raf = requestAnimationFrame(tick)
  }

  async function refresh() {
    try {
      arrivals = await fetchFinsburyArrivals()
      fetchedAt = Date.now()
      renderBoard(arrivals)
      syncMarkers()
    } catch (e) {
      renderBoard([], e instanceof Error ? e.message : "TfL unavailable")
    }
  }

  async function start() {
    boardEl().classList.remove("hidden")
    try {
      if (!path) await loadPath()
    } catch (e) {
      renderBoard([], e instanceof Error ? e.message : "Rail path failed")
      return
    }
    await refresh()
    window.clearInterval(pollTimer)
    pollTimer = window.setInterval(() => void refresh(), POLL_MS)
    cancelAnimationFrame(raf)
    raf = requestAnimationFrame(tick)
  }

  function stop() {
    window.clearInterval(pollTimer)
    pollTimer = 0
    cancelAnimationFrame(raf)
    raf = 0
    clearMarkers()
    if (map.getLayer(RAIL_LAYER)) map.removeLayer(RAIL_LAYER)
    if (map.getSource(RAIL_SOURCE)) map.removeSource(RAIL_SOURCE)
    path = null
    boardEl().classList.add("hidden")
  }

  return {
    setEnabled(on: boolean) {
      enabled = on
      if (on) void start()
      else stop()
    },
    destroy() {
      enabled = false
      stop()
    },
  }
}
