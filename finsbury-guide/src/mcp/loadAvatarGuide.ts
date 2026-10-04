import {
  createFieldGuideWeb4Client,
  isErrorBody,
  pickSolanaFromProviderWallets,
  unwrapResult,
} from "field-guide-web4-client"
import { PLACES } from "../places"
import { JAB_SW1_GLOVES_QUEST_ID } from "../quests/jabSw1Gloves"
import { buildProfileSnapshot, type ProfileSnapshot } from "../profile/model"
import { memoryStorage } from "./memoryStorage"
import { loadAuthoredTrailPins } from "./loadTrailPins"

function jwtPayload(jwt: string): Record<string, unknown> {
  const part = jwt.split(".")[1]
  if (!part) return {}
  const json = Buffer.from(part.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8")
  return JSON.parse(json) as Record<string, unknown>
}

function guidFromPayload(payload: Record<string, unknown>): string {
  const guid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  for (const key of ["avatarId", "AvatarId", "nameid", "sub"]) {
    const v = payload[key]
    if (typeof v === "string" && guid.test(v)) return v
  }
  for (const v of Object.values(payload)) {
    if (typeof v === "string" && guid.test(v)) return v
  }
  return ""
}

export async function loadAvatarGuide(jwt: string): Promise<ProfileSnapshot> {
  const token = jwt.trim()
  if (!token) {
    throw new Error("Sign in on the Field Guide You page, then paste that OASIS JWT as the connector token.")
  }

  let payload: Record<string, unknown> = {}
  try {
    payload = jwtPayload(token)
  } catch {
    throw new Error("That OASIS token is not a valid JWT. Sign in again on the Field Guide You page.")
  }

  const client = createFieldGuideWeb4Client({
    storage: memoryStorage({ "fg-web4.jwt": token }),
    listCacheTtlSeconds: 0,
    configuredQuestId: JAB_SW1_GLOVES_QUEST_ID,
    source: "field-guide-mcp",
  })
  if (!client.session.getJwt()) {
    throw new Error("That OASIS session has expired. Sign in again on the Field Guide You page.")
  }

  const quests = await client.quests.list()
  const collected: string[] = []
  for (const q of quests) {
    for (const o of q.objectives) {
      if (o.isCompleted && o.title) collected.push(o.title)
    }
  }

  let wallet = ""
  let avatarName =
    (typeof payload.unique_name === "string" && payload.unique_name) ||
    (typeof payload.name === "string" && payload.name) ||
    ""
  let avatarEmail = typeof payload.email === "string" ? payload.email : ""
  let avatarId = guidFromPayload(payload)

  const oasis = client.config.oasisBaseUrl
  const res = await fetch(`${oasis}/api/avatar/get-logged-in-avatar`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  const text = await res.text()
  let json: unknown = null
  try {
    json = text ? JSON.parse(text) : null
  } catch {
    json = null
  }
  if (res.ok && !isErrorBody(json).isError) {
    const avatar = unwrapResult(json)
    if (avatar && typeof avatar === "object") {
      const rec = avatar as Record<string, unknown>
      const id = String(rec.id ?? rec.Id ?? "")
      const name = String(rec.username ?? rec.Username ?? rec.name ?? rec.Name ?? "")
      const email = String(rec.email ?? rec.Email ?? "")
      if (id) avatarId = id
      if (name) avatarName = name
      if (email) avatarEmail = email
      wallet = pickSolanaFromProviderWallets(rec.providerWallets ?? rec.ProviderWallets)
    }
  }

  return buildProfileSnapshot({
    signedIn: true,
    avatarName,
    avatarId,
    avatarEmail,
    wallet,
    persona: null,
    clusterId: null,
    places: PLACES,
    trailPins: loadAuthoredTrailPins(PLACES),
    checkedInIds: collected,
    mintedIds: collected.filter((id) => id.toLowerCase().startsWith("glove-")),
  })
}
