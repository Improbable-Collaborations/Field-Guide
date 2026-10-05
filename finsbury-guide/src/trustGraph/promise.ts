/**
 * Promise: what a person's graph shows to someone else.
 *
 * Knowledge is the full cluster in personas.ts. A viewer never reads that
 * directly. They read a projection at the audience the owner granted them.
 * The projection is a closed allow-list: it starts empty and copies named
 * fields only, so a field added to DataCluster later stays private until
 * it is listed here.
 */
import type { DataCluster, Persona } from "./personas"

export type Audience = "private" | "public" | "link" | "acquaintance"

const RANK: Record<Audience, number> = {
  private: 0,
  public: 1,
  link: 2,
  acquaintance: 3,
}

const PUBLIC_FIELDS = ["id", "label", "short", "color", "slot", "placeIds"] as const
const LINK_FIELDS = [...PUBLIC_FIELDS, "feeds", "genres", "likedVenues"] as const
const ACQUAINTANCE_FIELDS = [...LINK_FIELDS, "artists"] as const

/**
 * Never listed at any audience:
 * - orbit: where his friends are going is their Knowledge. They granted it
 *   to him, not to whoever views him. Two hops is nothing.
 * - starQuestIds: a quest says what he was doing, not only where.
 * - disclosure: the policy itself.
 */
const FIELDS: Record<Exclude<Audience, "private">, readonly (keyof DataCluster)[]> = {
  public: PUBLIC_FIELDS,
  link: LINK_FIELDS,
  acquaintance: ACQUAINTANCE_FIELDS,
}

function narrower(a: Audience, b: Audience): Audience {
  return RANK[a] <= RANK[b] ? a : b
}

/** Audience is granted, never computed. A cluster can cap it lower. */
export function audienceFor(cluster: DataCluster, granted: Audience): Audience {
  return narrower(granted, cluster.disclosure?.maxAudience ?? "acquaintance")
}

/** Null means the vertex is absent for this viewer, not blank. */
export function projectCluster(
  cluster: DataCluster,
  granted: Audience,
): DataCluster | null {
  const audience = audienceFor(cluster, granted)
  if (audience === "private") return null
  const deny = new Set<string>(cluster.disclosure?.deny ?? [])
  const out: Record<string, unknown> = {}
  for (const key of FIELDS[audience]) {
    if (deny.has(key)) continue
    const value = cluster[key]
    if (value === undefined) continue
    out[key] = Array.isArray(value) ? [...value] : value
  }
  return out as DataCluster
}

/** The graph as someone else sees it when they wear this person. */
export function projectPersona(persona: Persona, granted: Audience): Persona {
  return {
    ...persona,
    clusters: persona.clusters
      .map((c) => projectCluster(c, granted))
      .filter((c): c is DataCluster => c !== null),
  }
}

/** Demo personas grant link, the same tier a met peer gets. */
export function wornPersona(persona: Persona): Persona {
  return projectPersona(persona, persona.grants ?? "public")
}
