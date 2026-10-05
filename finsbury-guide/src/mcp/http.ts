import express, { type Request, type Response } from "express"
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js"
import { claudeConnectorLink } from "./connectLinks"
import { createFieldGuideMcpServer } from "./createServer"
import { MCP_PATH, MCP_PATH_ALIASES, mcpPathFromWellKnown, publicMcpUrl, publicOrigin } from "./origin"
import {
  authenticateOasis,
  authorizationServerMetadata,
  authorizePage,
  clientRedirectAllowed,
  exchangeAuthorizationCode,
  exchangeRefreshToken,
  issueAuthorizationCode,
  oasisJwtForAccessToken,
  protectedResourceMetadata,
  registerClient,
  wwwAuthenticate,
} from "./oauth"
import { rememberChatGptLocationFromPayload } from "./checkInAtPin"
import { loadLiveMapLayers } from "./loadLiveMapLayers"
import { collectedPinsForJwt, putSiteViewForJwt, takeSiteCommandForJwt } from "./presence"

const PORT = Number(process.env.FIELD_GUIDE_MCP_PORT || 8788)

function bearer(req: Request): string {
  const header = req.header("authorization") || ""
  return header.match(/^Bearer\s+(.+)$/i)?.[1]?.trim() || ""
}

function allowCors(req: Request, res: Response) {
  res.setHeader("Access-Control-Allow-Origin", req.header("origin") || "*")
  res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type, MCP-Protocol-Version, mcp-session-id, X-Public-Origin")
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
  res.setHeader("Access-Control-Expose-Headers", "WWW-Authenticate")
}

const app = express()
app.use(express.json({ limit: "12mb" }))
app.use(express.urlencoded({ extended: false }))
app.use((req, res, next) => {
  allowCors(req, res)
  if (req.method === "OPTIONS") {
    res.status(204).end()
    return
  }
  next()
})

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "field-guide-mcp" })
})

function sendMetadata(req: Request, res: Response, body: unknown) {
  res.setHeader("Cache-Control", "no-store")
  res.json(body)
}

app.get(
  ["/.well-known/oauth-authorization-server", ...MCP_PATH_ALIASES.map((p) => `/.well-known/oauth-authorization-server${p}`)],
  (req, res) => {
    sendMetadata(req, res, authorizationServerMetadata(publicOrigin(req)))
  },
)

app.get(
  ["/.well-known/oauth-protected-resource", ...MCP_PATH_ALIASES.map((p) => `/.well-known/oauth-protected-resource${p}`)],
  (req, res) => {
    sendMetadata(req, res, protectedResourceMetadata(publicOrigin(req), mcpPathFromWellKnown(req.path)))
  },
)

app.post("/oauth/register", (req, res) => {
  try {
    res.status(201).json(registerClient(req.body))
  } catch (err) {
    res.status(400).json({ error: "invalid_client_metadata", error_description: err instanceof Error ? err.message : "register failed" })
  }
})

app.get("/oauth/authorize", (req, res) => {
  const clientId = String(req.query.client_id || "")
  const redirectUri = String(req.query.redirect_uri || "")
  const state = String(req.query.state || "")
  const challenge = String(req.query.code_challenge || "")
  const method = String(req.query.code_challenge_method || "S256")
  const resource = String(req.query.resource || "")
  if (method && method !== "S256") {
    res.status(400).send(authorizePage({ clientId, redirectUri, state, challenge, resource, error: "code_challenge_method must be S256." }))
    return
  }
  if (!clientId || !redirectUri || !challenge) {
    res.status(400).send(authorizePage({ clientId, redirectUri, state, challenge, resource, error: "Missing client_id, redirect_uri, or code_challenge." }))
    return
  }
  if (!clientRedirectAllowed(clientId, redirectUri)) {
    res.status(400).send(authorizePage({ clientId, redirectUri, state, challenge, resource, error: "Unknown client or redirect_uri." }))
    return
  }
  res.type("html").send(authorizePage({ clientId, redirectUri, state, challenge, resource }))
})

app.post("/oauth/authorize", async (req, res) => {
  const clientId = String(req.body.client_id || "")
  const redirectUri = String(req.body.redirect_uri || "")
  const state = String(req.body.state || "")
  const challenge = String(req.body.code_challenge || "")
  const resource = String(req.body.resource || "")
  const username = String(req.body.username || "")
  const password = String(req.body.password || "")
  const bounce = (error: string) => {
    res.status(400).type("html").send(authorizePage({ clientId, redirectUri, state, challenge, resource, error }))
  }
  if (!clientRedirectAllowed(clientId, redirectUri)) {
    bounce("Unknown client or redirect_uri.")
    return
  }
  const auth = await authenticateOasis(username, password)
  if ("message" in auth) {
    bounce(auth.message)
    return
  }
  try {
    const code = issueAuthorizationCode({
      clientId,
      redirectUri,
      challenge,
      jwt: auth.jwt,
      resource,
    })
    const next = new URL(redirectUri)
    next.searchParams.set("code", code)
    if (state) next.searchParams.set("state", state)
    res.redirect(302, next.toString())
  } catch (err) {
    bounce(err instanceof Error ? err.message : "Could not issue authorization code.")
  }
})

app.post("/oauth/token", (req, res) => {
  const grant = String(req.body.grant_type || "")
  const clientId = String(req.body.client_id || "")
  try {
    if (grant === "authorization_code") {
      const tokens = exchangeAuthorizationCode({
        code: String(req.body.code || ""),
        clientId,
        redirectUri: String(req.body.redirect_uri || ""),
        codeVerifier: String(req.body.code_verifier || ""),
      })
      res.json(tokens)
      return
    }
    if (grant === "refresh_token") {
      res.json(exchangeRefreshToken(String(req.body.refresh_token || ""), clientId))
      return
    }
    res.status(400).json({ error: "unsupported_grant_type" })
  } catch (err) {
    res.status(400).json({
      error: "invalid_grant",
      error_description: err instanceof Error ? err.message : "token failed",
    })
  }
})

app.post("/connect", (req, res) => {
  const origin = (req.header("x-public-origin") || publicOrigin(req)).replace(/\/$/, "")
  if (!origin.startsWith("http://") && !origin.startsWith("https://")) {
    res.status(400).json({ ok: false, message: "Missing public origin." })
    return
  }
  const mcpUrl = publicMcpUrl(origin)
  res.json({
    ok: true,
    mcpUrl,
    claudeUrl: claudeConnectorLink(mcpUrl),
  })
})

app.put("/connect/site", (req, res) => {
  const jwt = bearer(req)
  if (!jwt) {
    res.status(401).json({ ok: false, message: "Sign in on You first." })
    return
  }
  const result = putSiteViewForJwt(jwt, req.body)
  if (!result.ok) {
    res.status(400).json(result)
    return
  }
  res.json({
    ...result,
    command: takeSiteCommandForJwt(jwt),
    collectedPinIds: collectedPinsForJwt(jwt),
  })
})

function mcpUnauthorized(req: Request, res: Response) {
  res.setHeader("WWW-Authenticate", wwwAuthenticate(publicOrigin(req)))
  res.status(401).json({ error: "invalid_token", error_description: "Sign in with OASIS via Field Guide OAuth." })
}

async function handleMcp(req: Request, res: Response) {
  const jwt = oasisJwtForAccessToken(bearer(req))
  if (!jwt) {
    mcpUnauthorized(req, res)
    return
  }
  rememberChatGptLocationFromPayload(jwt, req.body)
  const server = createFieldGuideMcpServer(jwt)
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined })
  await server.connect(transport)
  await transport.handleRequest(req, res, req.method === "POST" ? req.body : undefined)
  res.on("close", () => {
    void transport.close()
    void server.close()
  })
}

function mcpRoute(req: Request, res: Response) {
  void handleMcp(req, res).catch((err: unknown) => {
    console.error("[field-guide-mcp]", err)
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: "2.0",
        error: { code: -32603, message: "Internal error" },
        id: null,
      })
    }
  })
}

app.post([...MCP_PATH_ALIASES], mcpRoute)
app.get([...MCP_PATH_ALIASES], mcpRoute)

app.listen(PORT, () => {
  console.error(`[field-guide-mcp] http://127.0.0.1:${PORT}${MCP_PATH}`)
  void loadLiveMapLayers("")
    .then((layers) => {
      console.error(
        `[field-guide-mcp] listings ready RA ${layers.raEvents.length} gigs ${layers.gigs.length} nearby ${layers.nearby.length}`,
      )
    })
    .catch((err: unknown) => {
      console.error("[field-guide-mcp] listings warmup failed", err)
    })
})
