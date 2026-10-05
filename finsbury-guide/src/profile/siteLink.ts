import type { SiteView } from "./siteSession"
import type { SiteCommand } from "./siteCommand"

export function startFieldGuideSiteLink(opts: {
  jwt: () => string
  view: () => SiteView
  onCommand: (command: SiteCommand) => void | Promise<void>
  onCollected?: (pinIds: string[]) => void
}): () => void {
  let stopped = false
  let inFlight = false

  const tick = async () => {
    if (stopped || inFlight) return
    const jwt = opts.jwt()
    if (!jwt) return
    inFlight = true
    try {
      const res = await fetch("/connect/site", {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${jwt}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(opts.view()),
      })
      if (!res.ok) return
      const body = (await res.json()) as { command?: unknown; collectedPinIds?: unknown }
      if (Array.isArray(body.collectedPinIds)) {
        const ids = body.collectedPinIds.filter((id): id is string => typeof id === "string" && Boolean(id.trim()))
        if (ids.length) opts.onCollected?.(ids)
      }
      if (!body.command || typeof body.command !== "object") return
      const command = body.command as SiteCommand
      if (command.type !== "open-look" || !command.placeId) return
      await opts.onCommand(command)
    } finally {
      inFlight = false
    }
  }

  const timer = window.setInterval(() => {
    void tick()
  }, 1000)
  void tick()
  return () => {
    stopped = true
    window.clearInterval(timer)
  }
}
