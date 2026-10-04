import type { SiteView } from "./siteSession"

export function startFieldGuideSiteLink(opts: {
  ticket: string
  jwt: () => string
  view: () => SiteView
}): () => void {
  let stopped = false
  let inFlight = false

  const tick = async () => {
    if (stopped || inFlight) return
    const jwt = opts.jwt()
    if (!jwt) return
    inFlight = true
    try {
      await fetch(`/connect/${opts.ticket}/site`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${jwt}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(opts.view()),
      })
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
