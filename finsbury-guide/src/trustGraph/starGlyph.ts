/**
 * Dual tetrahedron layout (Soulbis /star convention).
 * Used by tests; the live view is the Three.js core in starScene.ts.
 */

import type { DataCluster, Persona } from "./personas"

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

export type TipHalf = "records" | "orbit"

export type GlyphTip = {
  index: number
  half: TipHalf
  cluster: DataCluster | null
  weight: number
}

export function clusterWeight(cluster: DataCluster): number {
  return cluster.placeIds.length + (cluster.feeds?.length ?? 0)
}

export function layoutGlyph(persona: Persona | null): GlyphTip[] {
  const bySlot = new Map(
    (persona?.clusters ?? []).map((c) => [c.slot, c] as const),
  )
  return Array.from({ length: 8 }, (_, i) => {
    const cluster = bySlot.get(i) ?? null
    return {
      index: i,
      half: (i < 4 ? "records" : "orbit") as TipHalf,
      cluster,
      weight: cluster ? clusterWeight(cluster) : 0,
    }
  })
}
