import { Server } from "@modelcontextprotocol/sdk/server/index.js"
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js"
import { formatFieldGuideContext } from "../profile/contextPack"
import { loadAvatarGuide } from "./loadAvatarGuide"
import { siteViewForTicket } from "./tickets"

export function createFieldGuideMcpServer(jwt: string, ticket: string): Server {
  const server = new Server(
    { name: "field-guide", version: "0.1.0" },
    { capabilities: { tools: {} } },
  )

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
      {
        name: "field_guide_context",
        description:
          "Read this visitor’s Field Guide pack: authored guides (fixed), ordered steps, this avatar’s STAR progress, and what their open tab is showing. Cannot edit the published Field Guide or drive the UI.",
        inputSchema: { type: "object", properties: {}, additionalProperties: false },
      },
      {
        name: "field_guide_progress",
        description:
          "This avatar’s progress JSON (collected pins, next step) plus live tab presence. Progress changes only when the visitor collects in Walk / Look. The published site is not writable.",
        inputSchema: { type: "object", properties: {}, additionalProperties: false },
      },
    ],
  }))

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const name = request.params.name
    try {
      const snap = await loadAvatarGuide(jwt)
      const live = ticket ? siteViewForTicket(ticket) : null
      if (name === "field_guide_context") {
        return { content: [{ type: "text", text: formatFieldGuideContext(snap, live) }] }
      }
      if (name === "field_guide_progress") {
        return {
          content: [{ type: "text", text: JSON.stringify({ ...snap, site: live }, null, 2) }],
        }
      }
      return {
        content: [{ type: "text", text: JSON.stringify({ error: true, message: `Unknown tool ${name}` }) }],
        isError: true,
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Field Guide MCP failed"
      return {
        content: [{ type: "text", text: JSON.stringify({ error: true, message }) }],
        isError: true,
      }
    }
  })

  return server
}
