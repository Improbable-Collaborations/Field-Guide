import { describe, expect, it } from "vitest"
import { canonicalJSON, kappaOf, readCityKey, verdictFor } from "./cityKey"
import pack from "./fixtures/city-key.fixture.json"

type Case = {
  id: string
  expect: "authentic" | "unnamed" | "mismatch"
  canonical: string
  kappa: string
  key: Record<string, unknown>
}
const cases = pack.cases as Case[]

describe("City Key reading follows the Star Hold conformance pack", () => {
  it("covers every case in the pack", () => {
    expect(cases.map((c) => c.id)).toEqual([
      "minimal",
      "unnamed",
      "nested-order",
      "full",
      "unknown-field",
      "unchanged-reexport",
      "mismatch",
    ])
  })

  for (const c of cases) {
    it(`${c.id}: ${c.expect}`, async () => {
      expect(await verdictFor(c.key)).toBe(c.expect)
      if (c.expect === "mismatch") return
      const { kappa: _kappa, ...rest } = c.key
      expect(canonicalJSON(rest)).toBe(c.canonical)
      expect(await kappaOf(c.key)).toBe(c.kappa)
    })
  }

  it("takes only the reading fields from a key", async () => {
    const full = cases.find((c) => c.id === "unknown-field")!
    const reading = await readCityKey(JSON.stringify(full.key))
    expect(typeof reading).toBe("object")
    if (typeof reading === "string") return
    expect(Object.keys(reading).sort()).toEqual(
      ["kappa", "lit", "mage", "name", "smRatio", "sword", "verdict"],
    )
    expect(reading.verdict).toBe("authentic")
    expect(reading.lit).toBe((full.key.lit as number[]).length)
  })

  it("clamps the size ratio and refuses a file that is not a key", async () => {
    const big = await readCityKey(JSON.stringify({ palette: {}, geometry: { smRatio: 9 } }))
    expect(typeof big === "object" && big.smRatio).toBe(2.2)
    const measured = await readCityKey(
      JSON.stringify({ palette: {}, geometry: { smRatio: 2 }, figures: { ratio: 1.5 } }),
    )
    expect(typeof measured === "object" && measured.smRatio).toBe(1.5)
    expect(typeof (await readCityKey("nope"))).toBe("string")
    expect(typeof (await readCityKey('{"a":1}'))).toBe("string")
  })
})
