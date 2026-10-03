import * as THREE from "three"

/** Dual tetrahedra of the stella octangula (Soulbis /star). */
export const TET_BOOKS: [number, number, number][] = [
  [1, 1, 1],
  [1, -1, -1],
  [-1, 1, -1],
  [-1, -1, 1],
]

export const TET_PEOPLE: [number, number, number][] = [
  [-1, -1, -1],
  [-1, 1, 1],
  [1, -1, 1],
  [1, 1, -1],
]

const FACES: [number, number, number][] = [
  [0, 1, 2],
  [0, 3, 1],
  [0, 2, 3],
  [1, 3, 2],
]

const EDGES: [number, number][] = [
  [0, 1],
  [0, 2],
  [0, 3],
  [1, 2],
  [1, 3],
  [2, 3],
]

type Vec3 = [number, number, number]

function mid(a: Vec3, b: Vec3): Vec3 {
  return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2]
}

function len(v: Vec3): number {
  return Math.hypot(v[0], v[1], v[2])
}

function subdivide(tris: Vec3[][], iterations: number): Vec3[][] {
  let out = tris
  for (let k = 0; k < iterations; k++) {
    const next: Vec3[][] = []
    for (const [A, B, C] of out) {
      const ab = mid(A, B)
      const bc = mid(B, C)
      const ca = mid(C, A)
      next.push([A, ab, ca], [ab, B, bc], [ca, bc, C], [ab, bc, ca])
    }
    out = next
  }
  return out
}

/** Soulbis tetraMesh: subdivide ×2, blend toward circumscribed tip. */
export function tetraGeometry(verts: Vec3[], scale: number): THREE.BufferGeometry {
  const tip = len(verts[0])
  const seed = FACES.map((f) => f.map((i) => verts[i] as Vec3))
  const tris = subdivide(seed, 2)
  const positions: number[] = []
  const k = 0.22
  for (const tri of tris) {
    for (const v of tri) {
      const L = len(v) || 1e-6
      positions.push(
        (v[0] * (1 - k) + (v[0] / L) * tip * k) * scale,
        (v[1] * (1 - k) + (v[1] / L) * tip * k) * scale,
        (v[2] * (1 - k) + (v[2] / L) * tip * k) * scale,
      )
    }
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3))
  geo.computeVertexNormals()
  return geo
}

export function tetraEdgeGeometry(
  verts: Vec3[],
  scale: number,
): THREE.BufferGeometry {
  const positions: number[] = []
  for (const [a, b] of EDGES) {
    const va = verts[a]
    const vb = verts[b]
    positions.push(
      va[0] * scale,
      va[1] * scale,
      va[2] * scale,
      vb[0] * scale,
      vb[1] * scale,
      vb[2] * scale,
    )
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3))
  return geo
}

export function tipWorld(verts: Vec3[], index: number, scale: number): THREE.Vector3 {
  const v = verts[index]
  return new THREE.Vector3(v[0] * scale, v[1] * scale, v[2] * scale)
}
