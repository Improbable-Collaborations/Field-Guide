import express, { type Request, type Response } from "express"
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js"
import { claudeConnectorLink, publicMcpUrl } from "./connectLinks"
import { createFieldGuideMcpServer } from "./createServer"
import { issueConnectTicket, jwtForTicket, putSiteView } from "./tickets"

const PORT = Number(process.env.FIELD_GUIDE_MCP_PORT || 8788)

function bearer(req: Request): string {
  const header = req.header("authorization") || ""
  return header.match(/^Bearer\s+(.+)$/i)?.[1]?.trim() || ""
}

function jwtForRequest(req: Request): string {
  const ticket = typeof req.params.ticket === "string" ? req.params.ticket : ""
  if (ticket) return jwtForTicket(ticket) || ""
  return bearer(req)
}

function allowCors(req: Request, res: Response) {
  res.setHeader("Access-Control-Allow-Origin", req.header("origin") || "*")
  res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type, MCP-Protocol-Version, mcp-session-id, X-Public-Origin")
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
}

const app = express()
app.use(express.json({ limit: "2mb" }))
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

app.post("/connect", (req, res) => {
  const jwt = bearer(req)
  if (!jwt) {
    res.status(401).json({ ok: false, message: "Sign in on You first." })
    return
  }
  const origin = (req.header("x-public-origin") || "").replace(/\/$/, "")
  if (!origin) {
    res.status(400).json({ ok: false, message: "Missing public origin." })
    return
  }
  const ticket = issueConnectTicket(jwt)
  const mcpUrl = publicMcpUrl(origin, ticket)
  res.json({
    ok: true,
    ticket,
    mcpUrl,
    claudeUrl: claudeConnectorLink(mcpUrl),
  })
})

app.put("/connect/:ticket/site", (req, res) => {
  const jwt = bearer(req)
  if (!jwt) {
    res.status(401).json({ ok: false, message: "Sign in on You first." })
    return
  }
  const ticket = typeof req.params.ticket === "string" ? req.params.ticket : ""
  const result = putSiteView(ticket, jwt, req.body)
  if (!result.ok) {
    res.status(400).json(result)
    return
  }
  res.json(result)
})

async function handleMcp(req: Request, res: Response) {
  const jwt = jwtForRequest(req)
  const ticket = typeof req.params.ticket === "string" ? req.params.ticket : ""
  const server = createFieldGuideMcpServer(jwt, ticket)
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

app.post("/mcp", mcpRoute)
app.get("/mcp", mcpRoute)
app.post("/mcp/:ticket", mcpRoute)
app.get("/mcp/:ticket", mcpRoute)

app.listen(PORT, () => {
  console.error(`[field-guide-mcp] http://127.0.0.1:${PORT}/mcp`)
})
