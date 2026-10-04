import { randomBytes } from "node:crypto"
import { parseSiteView, type SiteView } from "../profile/siteSession"

const WEEK_MS = 7 * 24 * 60 * 60 * 1000

type Ticket = {
  jwt: string
  exp: number
  site: SiteView | null
}

const tickets = new Map<string, Ticket>()

function live(id: string): Ticket | null {
  const row = tickets.get(id)
  if (!row) return null
  if (Date.now() >= row.exp) {
    tickets.delete(id)
    return null
  }
  return row
}

export function issueConnectTicket(jwt: string): string {
  const id = randomBytes(24).toString("base64url")
  tickets.set(id, { jwt, exp: Date.now() + WEEK_MS, site: null })
  return id
}

export function jwtForTicket(id: string): string | null {
  return live(id)?.jwt ?? null
}

export function putSiteView(id: string, jwt: string, raw: unknown): { ok: true; view: SiteView } | { ok: false; message: string } {
  const row = live(id)
  if (!row) return { ok: false, message: "Unknown or expired connector. Press Claude or ChatGPT on You again." }
  if (row.jwt !== jwt) return { ok: false, message: "This connector belongs to a different OASIS session." }
  const view = parseSiteView(raw)
  if (typeof view === "string") return { ok: false, message: view }
  row.site = view
  return { ok: true, view }
}

export function siteViewForTicket(id: string): SiteView | null {
  return live(id)?.site ?? null
}
