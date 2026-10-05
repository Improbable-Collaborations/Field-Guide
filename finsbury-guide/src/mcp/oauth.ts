import { createHash, randomBytes, timingSafeEqual } from "node:crypto"
import { readFileSync, renameSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { createFieldGuideWeb4Client } from "field-guide-web4-client"
import { JAB_SW1_GLOVES_QUEST_ID } from "../quests/jabSw1Gloves"
import { avatarIdFromJwt } from "./jwtAvatar"
import { memoryStorage } from "./memoryStorage"
import { MCP_PATH } from "./origin"

const ACCESS_MS = 7 * 24 * 60 * 60 * 1000
const REFRESH_MS = 30 * 24 * 60 * 60 * 1000
const CODE_MS = 10 * 60 * 1000

type OauthClient = { clientId: string; redirectUris: string[]; clientName: string }
type AuthCode = {
  clientId: string
  redirectUri: string
  challenge: string
  jwt: string
  resource: string
  exp: number
}
type AccessRow = { jwt: string; clientId: string; exp: number }
type RefreshRow = { jwt: string; clientId: string; exp: number }

const clients = new Map<string, OauthClient>()
const codes = new Map<string, AuthCode>()
const access = new Map<string, AccessRow>()
const refresh = new Map<string, RefreshRow>()

function storeFile(): string | null {
  const v = process.env.FIELD_GUIDE_OAUTH_STORE
  if (v === "memory") return null
  if (v) return v
  if (process.env.VITEST) return join(tmpdir(), `field-guide-mcp-oauth-vitest-${process.pid}.json`)
  return join(process.cwd(), ".field-guide-mcp-oauth.json")
}

function persist(): void {
  const file = storeFile()
  if (!file) return
  const body = {
    clients: [...clients.values()],
    access: [...access.entries()].map(([token, row]) => ({ token, ...row })),
    refresh: [...refresh.entries()].map(([token, row]) => ({ token, ...row })),
  }
  const tmp = `${file}.${process.pid}.tmp`
  writeFileSync(tmp, JSON.stringify(body), { encoding: "utf8", mode: 0o600 })
  renameSync(tmp, file)
}

function hydrate(): void {
  const file = storeFile()
  if (!file) return
  let raw = ""
  try {
    raw = readFileSync(file, "utf8")
  } catch (err) {
    const code = err && typeof err === "object" && "code" in err ? String((err as { code: unknown }).code) : ""
    if (code === "ENOENT") return
    throw err
  }
  const parsed = JSON.parse(raw) as {
    clients?: OauthClient[]
    access?: Array<AccessRow & { token?: string }>
    refresh?: Array<RefreshRow & { token?: string }>
  }
  clients.clear()
  access.clear()
  refresh.clear()
  for (const row of parsed.clients ?? []) {
    if (row?.clientId && Array.isArray(row.redirectUris)) clients.set(row.clientId, row)
  }
  for (const row of parsed.access ?? []) {
    if (typeof row.token === "string") access.set(row.token, { jwt: row.jwt, clientId: row.clientId, exp: row.exp })
  }
  for (const row of parsed.refresh ?? []) {
    if (typeof row.token === "string") refresh.set(row.token, { jwt: row.jwt, clientId: row.clientId, exp: row.exp })
  }
}

hydrate()

export function authorizationServerMetadata(origin: string) {
  const issuer = origin.replace(/\/$/, "")
  return {
    issuer,
    authorization_endpoint: `${issuer}/oauth/authorize`,
    token_endpoint: `${issuer}/oauth/token`,
    registration_endpoint: `${issuer}/oauth/register`,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    code_challenge_methods_supported: ["S256"],
    token_endpoint_auth_methods_supported: ["none"],
    scopes_supported: ["field-guide"],
  }
}

export function protectedResourceMetadata(origin: string, resourcePath = MCP_PATH) {
  const issuer = origin.replace(/\/$/, "")
  const path = resourcePath.startsWith("/") ? resourcePath : `/${resourcePath}`
  return {
    resource: `${issuer}${path}`,
    authorization_servers: [issuer],
    bearer_methods_supported: ["header"],
    scopes_supported: ["field-guide"],
  }
}

export function wwwAuthenticate(origin: string): string {
  const metadata = `${origin.replace(/\/$/, "")}/.well-known/oauth-protected-resource`
  return `Bearer realm="Field Guide", resource_metadata="${metadata}"`
}

export function registerClient(body: unknown): { client_id: string; redirect_uris: string[] } {
  const rec = body && typeof body === "object" ? (body as Record<string, unknown>) : {}
  const name = typeof rec.client_name === "string" ? rec.client_name : "MCP client"
  const uris = Array.isArray(rec.redirect_uris)
    ? rec.redirect_uris.filter((u): u is string => typeof u === "string" && u.trim().length > 0)
    : []
  if (!uris.length) throw new Error("redirect_uris is required.")
  for (const uri of uris) {
    let parsed: URL
    try {
      parsed = new URL(uri)
    } catch {
      throw new Error(`Invalid redirect_uri ${uri}`)
    }
    if (parsed.protocol !== "https:" && parsed.hostname !== "localhost" && parsed.hostname !== "127.0.0.1") {
      throw new Error(`redirect_uri must be https (or localhost): ${uri}`)
    }
  }
  const clientId = `fg_${randomBytes(16).toString("base64url")}`
  clients.set(clientId, { clientId, redirectUris: uris, clientName: name })
  persist()
  return {
    client_id: clientId,
    redirect_uris: uris,
    client_name: name,
    token_endpoint_auth_method: "none",
    grant_types: ["authorization_code", "refresh_token"],
    response_types: ["code"],
  } as { client_id: string; redirect_uris: string[] }
}

export function pkceS256(verifier: string): string {
  return createHash("sha256").update(verifier).digest("base64url")
}

function pkceOk(verifier: string, challenge: string): boolean {
  const got = Buffer.from(pkceS256(verifier))
  const want = Buffer.from(challenge)
  return got.length === want.length && timingSafeEqual(got, want)
}

export async function authenticateOasis(username: string, password: string): Promise<{ jwt: string } | { message: string }> {
  const client = createFieldGuideWeb4Client({
    storage: memoryStorage(),
    listCacheTtlSeconds: 0,
    configuredQuestId: JAB_SW1_GLOVES_QUEST_ID,
    source: "field-guide-mcp-oauth",
  })
  const result = await client.auth.authenticate({
    username: username.trim(),
    email: username.trim(),
    password,
  })
  if (!result.ok) return { message: result.message || "OASIS sign-in failed." }
  const jwt = client.session.getJwt()
  if (!jwt) return { message: "OASIS did not return a session." }
  return { jwt }
}

export function issueAuthorizationCode(args: {
  clientId: string
  redirectUri: string
  challenge: string
  jwt: string
  resource: string
}): string {
  const client = clients.get(args.clientId)
  if (!client) throw new Error("Unknown client_id.")
  if (!client.redirectUris.includes(args.redirectUri)) throw new Error("redirect_uri is not registered for this client.")
  if (!avatarIdFromJwt(args.jwt)) throw new Error("OASIS session is missing an avatar id.")
  const code = randomBytes(24).toString("base64url")
  codes.set(code, {
    clientId: args.clientId,
    redirectUri: args.redirectUri,
    challenge: args.challenge,
    jwt: args.jwt,
    resource: args.resource,
    exp: Date.now() + CODE_MS,
  })
  return code
}

export function clientRedirectAllowed(clientId: string, redirectUri: string): boolean {
  return Boolean(clients.get(clientId)?.redirectUris.includes(redirectUri))
}

function mintTokens(jwt: string, clientId: string): { access_token: string; refresh_token: string; expires_in: number; token_type: "Bearer"; scope: string } {
  const accessToken = `fgat_${randomBytes(24).toString("base64url")}`
  const refreshToken = `fgrt_${randomBytes(24).toString("base64url")}`
  access.set(accessToken, { jwt, clientId, exp: Date.now() + ACCESS_MS })
  refresh.set(refreshToken, { jwt, clientId, exp: Date.now() + REFRESH_MS })
  persist()
  return {
    access_token: accessToken,
    refresh_token: refreshToken,
    token_type: "Bearer",
    expires_in: Math.floor(ACCESS_MS / 1000),
    scope: "field-guide",
  }
}

export function exchangeAuthorizationCode(args: {
  code: string
  clientId: string
  redirectUri: string
  codeVerifier: string
}): ReturnType<typeof mintTokens> {
  const row = codes.get(args.code)
  codes.delete(args.code)
  if (!row || Date.now() >= row.exp) throw new Error("Invalid or expired authorization code.")
  if (row.clientId !== args.clientId) throw new Error("client_id does not match this code.")
  if (row.redirectUri !== args.redirectUri) throw new Error("redirect_uri does not match this code.")
  if (!pkceOk(args.codeVerifier, row.challenge)) throw new Error("code_verifier failed PKCE.")
  return mintTokens(row.jwt, row.clientId)
}

export function exchangeRefreshToken(token: string, clientId: string): ReturnType<typeof mintTokens> {
  const row = refresh.get(token)
  if (!row || Date.now() >= row.exp) throw new Error("Invalid or expired refresh_token.")
  if (row.clientId !== clientId) throw new Error("client_id does not match this refresh_token.")
  refresh.delete(token)
  return mintTokens(row.jwt, row.clientId)
}

export function oasisJwtForAccessToken(token: string): string | null {
  const row = access.get(token)
  if (!row) return null
  if (Date.now() >= row.exp) {
    access.delete(token)
    persist()
    return null
  }
  return row.jwt
}

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

export function authorizePage(args: {
  clientId: string
  redirectUri: string
  state: string
  challenge: string
  resource: string
  error?: string
}): string {
  const err = args.error ? `<p class="err">${escapeHtml(args.error)}</p>` : ""
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Field Guide · Connect</title>
<style>
  body{margin:0;min-height:100dvh;font-family:Georgia,serif;background:#071107;color:#d7ecd7;display:grid;place-items:center}
  form{width:min(22rem,92vw);padding:1.5rem;border:1px solid rgba(74,155,74,.35);background:#0c1a0c}
  h1{font-size:1.15rem;font-weight:400;letter-spacing:.08em;text-transform:uppercase}
  p{color:#9bb89b;font-size:.95rem}
  .err{color:#e07a5f}
  label{display:block;margin:.7rem 0 .25rem;font-size:.8rem;letter-spacing:.1em;text-transform:uppercase}
  input{width:100%;box-sizing:border-box;padding:.7rem;background:#061006;color:#d7ecd7;border:1px solid rgba(74,155,74,.4)}
  button{margin-top:1rem;width:100%;padding:.8rem;background:#c9a84c;border:0;color:#071107;font-weight:600;cursor:pointer}
</style></head>
<body>
<form method="post" action="/oauth/authorize">
  <h1>Hitchhiker's Field Guide</h1>
  <p>Sign in with your OASIS avatar. This lets ChatGPT or Claude read your guide and personal photos. It cannot edit the published Field Guide.</p>
  ${err}
  <input type="hidden" name="client_id" value="${escapeHtml(args.clientId)}"/>
  <input type="hidden" name="redirect_uri" value="${escapeHtml(args.redirectUri)}"/>
  <input type="hidden" name="state" value="${escapeHtml(args.state)}"/>
  <input type="hidden" name="code_challenge" value="${escapeHtml(args.challenge)}"/>
  <input type="hidden" name="resource" value="${escapeHtml(args.resource)}"/>
  <label for="username">Username or email</label>
  <input id="username" name="username" autocomplete="username" required/>
  <label for="password">Password</label>
  <input id="password" name="password" type="password" autocomplete="current-password" required/>
  <button type="submit">Connect</button>
</form>
</body></html>`
}
