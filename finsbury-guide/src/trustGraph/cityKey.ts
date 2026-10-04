/**
 * Reading a City Key, the portable file a person's Star is drawn from.
 *
 * The key format, the canonical form and the kappa label are defined by
 * mitchuski/star (CLAUDE.md, HOW_THE_SIGIL_WORKS.md) and locked by the
 * conformance pack in mitchuski/agentprivacy-mcp
 * (fixtures/star-hold-conformance). This file follows them; it does not
 * define anything. A matching kappa says the bytes are unchanged since they
 * were stamped. It does not say who holds the key.
 */

export type KappaVerdict = "authentic" | "unnamed" | "mismatch"

/** The only fields this Guide takes from a key. The key itself is not kept. */
export type StarReading = {
  name: string
  sword: string | null
  mage: string | null
  /** Swordsman : Mage size, 1 to 2.2. */
  smRatio: number
  /** How many of the 64 lattice vertices the key has lit. */
  lit: number
  kappa: string | null
  verdict: KappaVerdict
}

/** Keys sorted recursively, array order kept, no whitespace. */
export function canonicalJSON(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(canonicalJSON).join(",")}]`
  const rec = value as Record<string, unknown>
  return `{${Object.keys(rec)
    .sort()
    .map((k) => `${JSON.stringify(k)}:${canonicalJSON(rec[k])}`)
    .join(",")}}`
}

/** sha256 over the canonical key with the top-level kappa left out. */
export async function kappaOf(key: Record<string, unknown>): Promise<string> {
  const { kappa: _kappa, ...rest } = key
  const bytes = new TextEncoder().encode(canonicalJSON(rest))
  const digest = await crypto.subtle.digest("SHA-256", bytes)
  const hex = [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
  return `sha256:${hex}`
}

export async function verdictFor(key: Record<string, unknown>): Promise<KappaVerdict> {
  if (typeof key.kappa !== "string") return "unnamed"
  return (await kappaOf(key)) === key.kappa ? "authentic" : "mismatch"
}

function hexColor(value: unknown): string | null {
  return typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value) ? value : null
}

function ratio(value: unknown): number | null {
  const n = typeof value === "number" ? value : NaN
  return Number.isFinite(n) ? Math.max(1, Math.min(2.2, n)) : null
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

/** A message string means the file is not a City Key. */
export async function readCityKey(text: string): Promise<StarReading | string> {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    return "That file is not JSON."
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return "That file is not a City Key."
  }
  const key = parsed as Record<string, unknown>
  const palette = record(key.palette)
  if (!key.palette && !key.descriptions && !key.lit) return "That file is not a City Key."
  const lit = Array.isArray(key.lit)
    ? new Set(key.lit.filter((v) => Number.isInteger(v) && v >= 0 && v < 64)).size
    : 0
  return {
    name: typeof key.name === "string" ? key.name : "",
    sword: hexColor(palette.sword),
    mage: hexColor(palette.mage),
    // A measured ratio pins the shape; a chosen one is the fallback.
    smRatio: ratio(record(key.figures).ratio) ?? ratio(record(key.geometry).smRatio) ?? 1,
    lit,
    kappa: typeof key.kappa === "string" ? key.kappa : null,
    verdict: await verdictFor(key),
  }
}
