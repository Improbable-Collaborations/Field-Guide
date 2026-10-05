import { parseSiteView, type SiteView } from "../profile/siteSession"
import { parseSiteCommand, type SiteCommand } from "../profile/siteCommand"
import { avatarIdFromJwt } from "./jwtAvatar"

const LIVE_MS = 15_000

type Presence = { view: SiteView; at: number }

const views = new Map<string, Presence>()
const commands = new Map<string, SiteCommand>()
const collectedPins = new Map<string, Set<string>>()

export function putSiteViewForJwt(
  jwt: string,
  raw: unknown,
): { ok: true; view: SiteView } | { ok: false; message: string } {
  const avatarId = avatarIdFromJwt(jwt)
  if (!avatarId) return { ok: false, message: "Sign in on You so live presence can attach to this avatar." }
  const view = parseSiteView(raw)
  if (typeof view === "string") return { ok: false, message: view }
  views.set(avatarId, { view, at: Date.now() })
  return { ok: true, view }
}

export function siteViewForJwt(jwt: string): SiteView | null {
  const avatarId = avatarIdFromJwt(jwt)
  if (!avatarId) return null
  return views.get(avatarId)?.view ?? null
}

export function liveSiteViewForJwt(jwt: string, now = Date.now()): SiteView | null {
  const avatarId = avatarIdFromJwt(jwt)
  if (!avatarId) return null
  const row = views.get(avatarId)
  if (!row) return null
  if (now - row.at > LIVE_MS) return null
  return row.view
}

export function enqueueSiteCommandForJwt(
  jwt: string,
  raw: unknown,
): { ok: true; command: SiteCommand } | { ok: false; message: string } {
  const avatarId = avatarIdFromJwt(jwt)
  if (!avatarId) return { ok: false, message: "Sign in on You so this avatar's Field Guide tab can receive the command." }
  if (!liveSiteViewForJwt(jwt)) {
    return {
      ok: false,
      message: "The Field Guide tab is not live for this avatar. Keep it open and signed in, then I will open Walk Look on that tab.",
    }
  }
  const command = parseSiteCommand(raw)
  if (typeof command === "string") return { ok: false, message: command }
  commands.set(avatarId, command)
  return { ok: true, command }
}

export function rememberCollectedPinForJwt(jwt: string, pinId: string): void {
  const avatarId = avatarIdFromJwt(jwt)
  const id = pinId.trim()
  if (!avatarId || !id) return
  const set = collectedPins.get(avatarId) ?? new Set<string>()
  set.add(id)
  collectedPins.set(avatarId, set)
}

export function collectedPinsForJwt(jwt: string): string[] {
  const avatarId = avatarIdFromJwt(jwt)
  if (!avatarId) return []
  return [...(collectedPins.get(avatarId) ?? [])]
}

export function takeSiteCommandForJwt(jwt: string): SiteCommand | null {
  const avatarId = avatarIdFromJwt(jwt)
  if (!avatarId) return null
  const command = commands.get(avatarId) ?? null
  if (command) commands.delete(avatarId)
  return command
}
