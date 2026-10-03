/**
 * Personal Trust Graph as claimed vertices, not role labels.
 *
 * Vertices follow Soulbis /star (mitchuski/soulbis): dual tet slots 0–7.
 * Each filled tip is a cluster of records, never a single activity.
 */

export type GuideLayer =
  | "park"
  | "transit"
  | "culture"
  | "sport"
  | "music"
  | "gigs"
  | "ra"
  | "hq"
  | "trail"
  | "nearby"

export type FeedId = "gigs" | "ra" | "nearby"

export type DataCluster = {
  id: string
  /** Named from the records, not from tetrahedron tip vocabulary. */
  label: string
  short: string
  color: string
  placeIds: string[]
  /** STAR quests claimed on this vertex. Objective titles join trail pin ids. */
  starQuestIds?: string[]
  feeds?: FeedId[]
  /** RA/Skiddle genre labels this vertex actually keeps. */
  genres?: string[]
  /** Artists he has seen or follows. */
  artists?: string[]
  /** Rooms he liked that may not have a Guide pin. */
  likedVenues?: string[]
  /** Friends and similar people: where they are going. */
  orbit?: Array<{
    alias: string
    relation: "friend" | "similar"
    venueNames?: string[]
  }>
  /** 0–3 copper (records), 4–7 cyan (orbit). */
  slot: number
}

export type Persona = {
  id: "alex" | "margaret"
  name: string
  age: number
  blurb: string
  clusters: DataCluster[]
}

export const ALEX: Persona = {
  id: "alex",
  name: "Alex",
  age: 30,
  blurb:
    "Electronic nights he actually likes, both JAB gyms, and the park circuit with coffee on the weekend.",
  clusters: [
    {
      id: "nights",
      label: "Music he keeps",
      short: "Music",
      color: "#e8523a",
      slot: 0,
      placeIds: [
        "music-garage",
        "music-nambucca",
        "music-boston",
        "music-forum",
      ],
      likedVenues: ["Fold", "The Cause", "Corsica Studios", "Phonox"],
      genres: [
        "UK Garage",
        "Jungle",
        "Drum & Bass",
        "Breakbeat",
        "Electro",
        "Bass",
      ],
      artists: ["Overmono", "Joy Orbison", "Sherelle", "Salute"],
      orbit: [
        { alias: "Sam", relation: "friend", venueNames: ["Fold", "The Cause"] },
        { alias: "Rio", relation: "friend", venueNames: ["Phonox", "Corsica Studios"] },
        { alias: "Leah", relation: "similar", venueNames: ["E1 London", "Village Underground"] },
      ],
      feeds: ["ra", "gigs", "nearby"],
    },
    {
      id: "boxing",
      label: "JAB gyms",
      short: "Gyms",
      color: "#e07a5f",
      slot: 1,
      placeIds: [
        "jab-sw1-victoria",
        "jab-ec1-moorgate",
        "trail-jab-sw1-gloves",
      ],
      starQuestIds: ["8f2c1a4e-6b7d-4c91-a3e5-1d9f0b4e7c22"],
    },
    {
      id: "park-circuit",
      label: "Park circuit",
      short: "Park",
      color: "#7ddb7d",
      slot: 2,
      placeIds: [
        "finsbury-park",
        "new-river-cafe-edge",
        "parkland-walk-gate",
        "hitchhiker-house",
      ],
    },
  ],
}

export const MARGARET: Persona = {
  id: "margaret",
  name: "Margaret",
  age: 64,
  blurb:
    "Memorial walks, theatres and chapels, and the north London ground she arrives into.",
  clusters: [
    {
      id: "walks",
      label: "Memorial walks",
      short: "Walks",
      color: "#c9a84c",
      slot: 0,
      placeIds: ["trail-highgate", "trail-bunhill", "trail-bow-street"],
    },
    {
      id: "rooms",
      label: "Theatres and chapels",
      short: "Rooms",
      color: "#4ecdc4",
      slot: 1,
      placeIds: [
        "music-park-theatre",
        "music-union-chapel",
        "music-assembly-hall",
        "music-ally-pally",
        "music-salisbury",
      ],
    },
    {
      id: "north",
      label: "North London ground",
      short: "Arrive",
      color: "#5ab4ff",
      slot: 4,
      placeIds: [
        "crouch-end",
        "finsbury-park",
        "manor-house",
        "finsbury-park-station",
        "hitchhiker-house",
      ],
    },
  ],
}

export const PERSONAS: Persona[] = [ALEX, MARGARET]

export function personaById(id: string | null | undefined): Persona | null {
  if (!id) return null
  return PERSONAS.find((p) => p.id === id) ?? null
}

export function clustersFor(
  persona: Persona,
  clusterId?: string | null,
): DataCluster[] {
  if (!clusterId) return persona.clusters
  return persona.clusters.filter((c) => c.id === clusterId)
}

export function clusterPlaceIds(
  persona: Persona,
  clusterId?: string | null,
): Set<string> {
  const ids = new Set<string>()
  for (const c of clustersFor(persona, clusterId)) {
    for (const id of c.placeIds) ids.add(id)
  }
  return ids
}

export function clusterFeeds(
  persona: Persona,
  clusterId?: string | null,
): Set<FeedId> {
  const feeds = new Set<FeedId>()
  for (const c of clustersFor(persona, clusterId)) {
    for (const f of c.feeds ?? []) feeds.add(f)
  }
  return feeds
}

/** Vertex that actually carries this live feed. */
export function clusterForFeed(
  persona: Persona,
  feed: FeedId,
): DataCluster | null {
  return persona.clusters.find((c) => (c.feeds ?? []).includes(feed)) ?? null
}
