/**
 * Soulbis /star dual-tet as a map legend: glass shells, slow spin,
 * labeled clusters, and a readable story under the jewel.
 *
 * Two things share this panel and must not be confused. Wearing a demo
 * person lays their place clusters on the tips, which is this Guide's own
 * legend. Carrying a City Key draws the visitor's own Star from the file
 * they hold: its colours, its Swordsman : Mage size and its kappa verdict.
 * The key is read in this tab and goes nowhere else.
 */
import * as THREE from "three"
import { readCityKey, type StarReading } from "./cityKey"
import type { ClusterStory } from "./guideView"
import type { Persona } from "./personas"
import { layoutGlyph } from "./starGlyph"
import {
  TET_BOOKS,
  TET_PEOPLE,
  tetraEdgeGeometry,
  tetraGeometry,
  tipWorld,
} from "./tetra"

const SWORD = 0xe8523a
const MAGE = 0x4dd9e8
const SCALE = 1.05
const SPIN = 0.18

function glowSprite(color: number, alpha: number): THREE.SpriteMaterial {
  const cv = document.createElement("canvas")
  cv.width = 128
  cv.height = 128
  const ctx = cv.getContext("2d")!
  const col = new THREE.Color(color)
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64)
  g.addColorStop(0, `rgba(255,255,255,${alpha})`)
  g.addColorStop(
    0.28,
    `rgba(${Math.round(col.r * 255)},${Math.round(col.g * 255)},${Math.round(col.b * 255)},0.7)`,
  )
  g.addColorStop(1, "rgba(0,0,0,0)")
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 128, 128)
  return new THREE.SpriteMaterial({
    map: new THREE.CanvasTexture(cv),
    blending: THREE.AdditiveBlending,
    transparent: true,
    depthWrite: false,
    depthTest: false,
  })
}

function glass(color: number, opacity: number): THREE.MeshPhysicalMaterial {
  return new THREE.MeshPhysicalMaterial({
    color,
    roughness: 0.18,
    metalness: 0.05,
    transparent: true,
    opacity,
    side: THREE.DoubleSide,
    emissive: color,
    emissiveIntensity: 0.45,
    clearcoat: 1,
    clearcoatRoughness: 0.2,
    depthWrite: false,
  })
}

export type StarHandle = {
  setState: (
    persona: Persona | null,
    selectedId: string | null,
    stories: ClusterStory[],
    wearerName?: string,
  ) => void
  dispose: () => void
}

export function mountStar(
  host: HTMLElement,
  onPick: (clusterId: string) => void,
): StarHandle {
  const head = document.createElement("header")
  head.className = "star-hud-head"
  const kicker = document.createElement("p")
  kicker.className = "star-hud-kicker"
  kicker.textContent = "Their Guide"
  const who = document.createElement("p")
  who.className = "star-hud-who"
  who.textContent = "Everyone's map"
  const keyRow = document.createElement("p")
  keyRow.className = "star-key-row"
  const keyBtn = document.createElement("button")
  keyBtn.type = "button"
  keyBtn.className = "star-key-btn"
  const keyNote = document.createElement("span")
  keyNote.className = "star-key-note"
  const keyFile = document.createElement("input")
  keyFile.type = "file"
  keyFile.accept = ".json,application/json"
  keyFile.hidden = true
  keyRow.append(keyBtn, keyNote, keyFile)
  head.append(kicker, who, keyRow)

  const canvasWrap = document.createElement("div")
  canvasWrap.className = "star-glyph-stage"
  const labelsEl = document.createElement("div")
  labelsEl.className = "star-labels"
  canvasWrap.appendChild(labelsEl)

  const cards = document.createElement("div")
  cards.className = "star-cards"

  host.replaceChildren(head, canvasWrap, cards)

  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 40)
  camera.position.set(0.15, 0.2, 3.55)
  camera.lookAt(0, 0, 0)

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.setClearColor(0x000000, 0)
  canvasWrap.insertBefore(renderer.domElement, labelsEl)

  const core = new THREE.Group()
  scene.add(core)

  scene.add(new THREE.AmbientLight(0x223055, 0.8))
  const key = new THREE.PointLight(0x6ea0ff, 1.7, 40)
  key.position.set(3.2, 4, 4.2)
  const fill = new THREE.PointLight(0xff6a4d, 1.2, 40)
  fill.position.set(-4.2, -2.4, -3.2)
  scene.add(key, fill)

  const swordMat = glass(SWORD, 0.38)
  const mageMat = glass(MAGE, 0.38)
  const swordFaces = new THREE.Mesh(tetraGeometry(TET_BOOKS, SCALE), swordMat)
  swordFaces.renderOrder = 10
  const mageFaces = new THREE.Mesh(tetraGeometry(TET_PEOPLE, SCALE), mageMat)
  mageFaces.renderOrder = 10
  const swordEdges = new THREE.LineSegments(
    tetraEdgeGeometry(TET_BOOKS, SCALE),
    new THREE.LineBasicMaterial({
      color: SWORD,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  )
  const mageEdges = new THREE.LineSegments(
    tetraEdgeGeometry(TET_PEOPLE, SCALE),
    new THREE.LineBasicMaterial({
      color: MAGE,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  )
  const swordLine = swordEdges.material as THREE.LineBasicMaterial
  const mageLine = mageEdges.material as THREE.LineBasicMaterial
  core.add(swordFaces, mageFaces, swordEdges, mageEdges)

  const heart = new THREE.Mesh(
    new THREE.IcosahedronGeometry(SCALE * 0.14, 1),
    new THREE.MeshBasicMaterial({
      color: 0xbfe0ff,
      transparent: true,
      opacity: 0.55,
      blending: THREE.AdditiveBlending,
    }),
  )
  heart.renderOrder = 13
  core.add(heart)

  const picks: THREE.Mesh[] = []
  const sprites: THREE.Sprite[] = []
  const tipLocal: THREE.Vector3[] = []

  const addTips = (verts: [number, number, number][], start: number, hex: number) => {
    const mat = glowSprite(hex, 0.95)
    verts.forEach((_, i) => {
      const pos = tipWorld(verts, i, SCALE)
      tipLocal.push(pos.clone())
      const sp = new THREE.Sprite(mat.clone())
      sp.position.copy(pos)
      sp.scale.setScalar(0.22)
      sp.renderOrder = 12
      core.add(sp)
      sprites.push(sp)
      const hit = new THREE.Mesh(
        new THREE.SphereGeometry(0.16, 12, 12),
        new THREE.MeshBasicMaterial({
          transparent: true,
          opacity: 0,
          depthWrite: false,
        }),
      )
      hit.position.copy(pos)
      hit.userData.slot = start + i
      core.add(hit)
      picks.push(hit)
    })
  }
  addTips(TET_BOOKS, 0, SWORD)
  addTips(TET_PEOPLE, 4, MAGE)

  let persona: Persona | null = null
  let selectedId: string | null = null
  let stories: ClusterStory[] = []
  let wearerName = ""
  let carried: StarReading | null = null
  const tmp = new THREE.Vector3()
  const mageTips = tipLocal.slice(4).map((v) => v.clone())

  const keyVerdict = (reading: StarReading): string => {
    if (reading.verdict === "authentic") return "κ matches"
    if (reading.verdict === "mismatch") return "κ does not match · changed since stamped"
    return "no κ on this key"
  }

  const applyKey = (reading: StarReading | null, problem = "") => {
    carried = reading
    const sword = new THREE.Color(reading?.sword ?? SWORD)
    const mage = new THREE.Color(reading?.mage ?? MAGE)
    swordMat.color.copy(sword)
    swordMat.emissive.copy(sword)
    swordLine.color.copy(sword)
    mageMat.color.copy(mage)
    mageMat.emissive.copy(mage)
    mageLine.color.copy(mage)
    const k = 1 / (reading?.smRatio ?? 1)
    mageFaces.scale.setScalar(k)
    mageEdges.scale.setScalar(k)
    mageTips.forEach((base, i) => {
      tipLocal[4 + i].copy(base).multiplyScalar(k)
      sprites[4 + i].position.copy(tipLocal[4 + i])
      picks[4 + i].position.copy(tipLocal[4 + i])
    })
    keyBtn.textContent = reading ? "Put the key down" : "Carry your City Key"
    keyNote.textContent = reading
      ? `${keyVerdict(reading)} · ${reading.lit} of 64 lit`
      : problem || "Read in this tab only"
    keyRow.classList.toggle("warn", reading?.verdict === "mismatch" || Boolean(problem))
  }

  keyBtn.addEventListener("click", () => {
    if (carried) {
      applyKey(null)
      applyTips()
      return
    }
    keyFile.click()
  })
  keyFile.addEventListener("change", () => {
    const file = keyFile.files?.[0]
    keyFile.value = ""
    if (!file) return
    void file
      .text()
      .then(readCityKey)
      .then((reading) => {
        if (typeof reading === "string") applyKey(null, reading)
        else applyKey(reading)
        applyTips()
      })
  })

  const paintTip = (i: number, color: string) => {
    const sp = sprites[i]
    const next = glowSprite(new THREE.Color(color).getHex(), 0.95)
    const old = sp.material as THREE.SpriteMaterial
    sp.material = next
    old.map?.dispose()
    old.dispose()
  }

  const renderCards = () => {
    cards.innerHTML = ""
    if (!persona) {
      const empty = document.createElement("p")
      empty.className = "star-empty"
      empty.textContent =
        "Alex and Margaret are demo people. Pick one to see the rooms, walks, and gyms their graph shows a met peer."
      cards.appendChild(empty)
      return
    }
    for (const story of stories) {
      const btn = document.createElement("button")
      btn.type = "button"
      btn.className =
        "star-card" + (selectedId === story.id ? " active" : "")
      btn.style.setProperty("--cluster", story.color)
      const live = story.live.length ? ` · ${story.live.join(", ")}` : ""
      const more = story.count > story.preview.length ? ` +${story.count - story.preview.length}` : ""
      btn.innerHTML = `<span class="star-card-top"><i></i><b></b><em></em></span><span class="star-card-preview"></span>`
      btn.querySelector("b")!.textContent = story.label
      btn.querySelector("em")!.textContent = `${story.count} places${live}`
      btn.querySelector(".star-card-preview")!.textContent =
        story.preview.join(" · ") + more
      btn.addEventListener("click", () => onPick(story.id))
      cards.appendChild(btn)
    }
  }

  const applyTips = () => {
    const tips = layoutGlyph(persona)
    swordMat.opacity = tips.some((t) => t.index < 4 && t.cluster) ? 0.4 : 0.12
    mageMat.opacity = tips.some((t) => t.index >= 4 && t.cluster) ? 0.4 : 0.12
    for (let i = 0; i < sprites.length; i++) {
      const tip = tips[i]
      const sp = sprites[i]
      const hit = picks[i]
      const filled = Boolean(tip.cluster)
      const on = tip.cluster?.id === selectedId
      if (tip.cluster) paintTip(i, tip.cluster.color)
      const mat = sp.material as THREE.SpriteMaterial
      mat.opacity = filled ? (on ? 1 : 0.9) : 0.12
      sp.scale.setScalar(filled ? (on ? 0.32 : 0.22) : 0.09)
      hit.userData.clusterId = tip.cluster?.id ?? null
    }
    if (!persona) {
      who.textContent = carried ? carried.name || "Unnamed key" : "Everyone's map"
      kicker.textContent = carried ? "Your Star" : wearerName || "Published Guide"
    } else {
      kicker.textContent = wearerName
        ? `${wearerName} wearing · demo`
        : `${persona.name}'s Guide · demo`
      const n = stories.reduce((s, c) => s + c.count, 0)
      who.textContent = selectedId
        ? stories.find((s) => s.id === selectedId)?.label || persona.name
        : `${n} places on ${persona.name}'s graph`
    }
    renderCards()
    syncLabels()
  }

  const labelNodes: HTMLButtonElement[] = []

  const syncLabels = () => {
    labelsEl.innerHTML = ""
    labelNodes.length = 0
    if (!persona) return
    const tips = layoutGlyph(persona)
    for (let i = 0; i < tips.length; i++) {
      const cluster = tips[i].cluster
      if (!cluster) continue
      const el = document.createElement("button")
      el.type = "button"
      el.className =
        "star-float" + (selectedId === cluster.id ? " on" : "")
      el.dataset.slot = String(i)
      el.style.setProperty("--cluster", cluster.color)
      el.textContent = cluster.short
      el.addEventListener("click", (e) => {
        e.stopPropagation()
        onPick(cluster.id)
      })
      labelsEl.appendChild(el)
      labelNodes.push(el)
    }
  }

  const projectLabels = () => {
    const w = canvasWrap.clientWidth || 1
    const h = canvasWrap.clientHeight || 1
    for (const el of labelNodes) {
      const i = Number(el.dataset.slot)
      tmp.copy(tipLocal[i])
      tmp.applyMatrix4(core.matrixWorld)
      tmp.project(camera)
      if (tmp.z > 1) {
        el.style.opacity = "0"
        continue
      }
      el.style.opacity = "1"
      el.style.left = `${(tmp.x * 0.5 + 0.5) * w}px`
      el.style.top = `${(-tmp.y * 0.5 + 0.5) * h}px`
    }
  }

  const ray = new THREE.Raycaster()
  const ptr = new THREE.Vector2()
  const onClick = (e: PointerEvent) => {
    const rect = renderer.domElement.getBoundingClientRect()
    ptr.x = ((e.clientX - rect.left) / rect.width) * 2 - 1
    ptr.y = -((e.clientY - rect.top) / rect.height) * 2 + 1
    ray.setFromCamera(ptr, camera)
    const hit = ray.intersectObjects(picks, false)[0]
    const id = hit?.object.userData.clusterId as string | null | undefined
    if (id) onPick(id)
  }
  renderer.domElement.addEventListener("pointerup", onClick)

  const resize = () => {
    const w = canvasWrap.clientWidth || 280
    const h = canvasWrap.clientHeight || 200
    camera.aspect = w / h
    camera.fov = 38
    camera.position.set(0.15, 0.22, 3.7)
    camera.updateProjectionMatrix()
    renderer.setSize(w, h, false)
  }
  const ro = new ResizeObserver(resize)
  ro.observe(canvasWrap)
  resize()

  let raf = 0
  let last = performance.now()
  const tick = (now: number) => {
    const dt = Math.min(0.05, (now - last) / 1000)
    last = now
    core.rotation.y += SPIN * 0.35 * dt
    core.rotation.x = 0.22 + Math.sin(now / 11000) * 0.05
    const mat = heart.material as THREE.MeshBasicMaterial
    mat.opacity = 0.4 + 0.12 * Math.sin(now / 700)
    renderer.render(scene, camera)
    projectLabels()
    raf = requestAnimationFrame(tick)
  }
  raf = requestAnimationFrame(tick)
  applyKey(null)
  applyTips()

  return {
    setState(nextPersona, nextSelected, nextStories, nextWearer) {
      persona = nextPersona
      selectedId = nextSelected
      stories = nextStories
      wearerName = nextWearer || ""
      applyTips()
    },
    dispose() {
      cancelAnimationFrame(raf)
      ro.disconnect()
      renderer.domElement.removeEventListener("pointerup", onClick)
      renderer.dispose()
      host.replaceChildren()
    },
  }
}
