import { describe, expect, it } from "vitest"
import { ALEX, MARGARET } from "./personas"
import { layoutGlyph } from "./starGlyph"

describe("star tetrahedron glyph", () => {
  it("keeps eight dual-tet slots, with unused tips hollow", () => {
    const alex = layoutGlyph(ALEX)
    expect(alex).toHaveLength(8)
    expect(alex.filter((t) => t.cluster).map((t) => t.cluster!.id)).toEqual([
      "nights",
      "boxing",
      "park-circuit",
    ])
    expect(alex.filter((t) => !t.cluster)).toHaveLength(5)
  })

  it("never puts a single activity on a tip", () => {
    for (const p of [ALEX, MARGARET]) {
      for (const c of p.clusters) {
        expect(c.placeIds.length).toBeGreaterThanOrEqual(2)
      }
    }
  })

  it("does not label tips Identity or Community", () => {
    const labels = layoutGlyph(MARGARET)
      .filter((t) => t.cluster)
      .map((t) => t.cluster!.label)
      .join(" ")
    expect(labels).toMatch(/Memorial/)
    expect(labels).not.toMatch(/identity|community|karma/i)
  })

  it("published graph is an empty star: all eight tips hollow", () => {
    expect(layoutGlyph(null).every((t) => t.cluster === null && t.weight === 0)).toBe(
      true,
    )
  })
})
