export function claudeConnectorLink(mcpUrl: string, name = "Field Guide"): string {
  const u = new URL("https://claude.ai/customize/connectors")
  u.searchParams.set("modal", "add-custom-connector")
  u.searchParams.set("connectorName", name)
  u.searchParams.set("connectorUrl", mcpUrl)
  return u.toString()
}

export function chatgptHomeLink(): string {
  return "https://chatgpt.com/plugins"
}
