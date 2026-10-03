import { askFieldGuideAgent } from "./agent"
import { maskWallet, type ProfileSnapshot } from "./model"

export type AvatarDeskHandle = {
  open: () => void
  close: () => void
  isOpen: () => boolean
  refresh: () => void
}

export type AvatarDeskController = {
  snapshot: () => ProfileSnapshot
  wearPersona: (id: "alex" | "margaret") => void
  pickCluster: (id: string) => void
  openPlace: (id: string) => void
  ensureWallet: () => Promise<{ ok: boolean; address: string; message: string }>
}

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag)
  if (className) node.className = className
  if (text != null) node.textContent = text
  return node
}

function metric(label: string, value: string) {
  const wrap = el("div", "you-metric")
  wrap.append(el("p", "you-metric-value", value), el("p", "you-metric-label", label))
  return wrap
}

export function mountAvatarDesk(
  host: HTMLElement,
  log: HTMLElement,
  ctrl: AvatarDeskController,
): AvatarDeskHandle {
  const messages: Array<{ role: "you" | "bot"; text: string }> = []
  let lastAvatarKey = ""

  const applyAction = (action: ReturnType<typeof askFieldGuideAgent>["action"]) => {
    if (action.type === "wear-persona") ctrl.wearPersona(action.personaId)
    if (action.type === "pick-cluster") ctrl.pickCluster(action.clusterId)
    if (action.type === "open-place") ctrl.openPlace(action.placeId)
  }

  const render = () => {
    const snap = ctrl.snapshot()
    const avatarKey = snap.avatarId || (snap.signedIn ? "in" : "guest")
    if (avatarKey !== lastAvatarKey) {
      lastAvatarKey = avatarKey
      messages.length = 0
      messages.push({ role: "bot", text: askFieldGuideAgent("", snap).text })
    }
    host.replaceChildren()

    const hero = el("header", "you-hero")
    hero.append(
      el("p", "avatar-kicker", "Your path"),
      el("h2", "avatar-name", snap.signedIn ? snap.avatarName || "Avatar" : "Guest"),
      el(
        "p",
        "avatar-meta",
        snap.wearingClusterLabel
          ? `Walking as ${snap.wearingPersonaName} · ${snap.wearingClusterLabel}`
          : `Walking as ${snap.wearingPersonaName}`,
      ),
    )
    host.append(hero)

    const stats = el("div", "you-metrics")
    stats.append(
      metric("collected", snap.pinsKnown ? `${snap.pinsCollected} / ${snap.pinsKnown}` : String(snap.pinsCollected)),
      metric("guides done", `${snap.guidesComplete} / ${snap.guides.length}`),
      metric("in wallet", String(snap.experiences.filter((e) => e.minted).length)),
    )
    host.append(stats)

    const next = el("section", "you-next")
    if (snap.nextStep) {
      next.append(
        el("p", "avatar-kicker", "Up next"),
        el("p", "you-next-title", snap.nextStep.title),
        el("p", "avatar-meta", snap.nextStep.guideName),
      )
      const go = el("button", "you-continue")
      go.type = "button"
      go.textContent = "Continue"
      go.addEventListener("click", () => ctrl.openPlace(snap.nextStep!.placeId))
      next.append(go)
    } else if (snap.pinsKnown && snap.pinsCollected >= snap.pinsKnown) {
      next.append(
        el("p", "avatar-kicker", "Up next"),
        el("p", "you-next-title", "Every loaded guide on this graph is complete."),
        el("p", "avatar-meta", "Wear another person, or walk a new trail on the map."),
      )
    } else {
      next.append(
        el("p", "avatar-kicker", "Up next"),
        el("p", "you-next-title", "No hunt is in motion yet."),
        el("p", "avatar-meta", "Wear a graph, then open a trail. Collecting is how this page fills."),
      )
    }
    host.append(next)

    const guides = el("section", "you-guides")
    guides.append(el("p", "avatar-kicker", "Guides"))
    if (!snap.guides.length) {
      guides.append(el("p", "avatar-meta", "No authored trails on this graph."))
    }
    for (const g of snap.guides) {
      const btn = el("button", "you-guide")
      btn.type = "button"
      const pct = g.pinIds.length ? Math.round((100 * g.collected) / g.pinIds.length) : 0
      const bar = el("span", "you-bar")
      const fill = el("i", "")
      fill.style.width = `${pct}%`
      bar.append(fill)
      const copy = el("span", "you-guide-copy")
      copy.append(
        el("span", "title", g.name),
        el(
          "span",
          "meta",
          g.pinIds.length
            ? `${g.collected} of ${g.pinIds.length}${g.complete ? " · complete" : ""}`
            : "Open on the map to load pins",
        ),
      )
      btn.append(copy, bar)
      btn.addEventListener("click", () => ctrl.openPlace(g.placeId))
      guides.append(btn)
    }
    host.append(guides)

    const logSec = el("section", "you-log")
    logSec.append(el("p", "avatar-kicker", "Collected"))
    if (!snap.experiences.length) {
      logSec.append(el("p", "avatar-meta", "Nothing in the ledger yet."))
    }
    for (const item of snap.experiences) {
      const row = el("p", "you-log-row")
      row.textContent = `${item.title}${item.minted ? " · wallet" : ""}`
      logSec.append(row)
    }
    host.append(logSec)

    const account = el("section", "you-account")
    account.append(el("p", "avatar-kicker", "Account"))
    const walletLine = el(
      "p",
      "avatar-wallet",
      snap.wallet ? maskWallet(snap.wallet) : "No Solana wallet yet",
    )
    if (snap.wallet) walletLine.title = snap.wallet
    account.append(walletLine)
    const makeWallet = el("button", "avatar-btn")
    makeWallet.type = "button"
    makeWallet.textContent = snap.wallet ? "Refresh wallet" : "Create wallet"
    makeWallet.disabled = !snap.signedIn
    makeWallet.addEventListener("click", async () => {
      makeWallet.disabled = true
      makeWallet.textContent = "Working…"
      const result = await ctrl.ensureWallet()
      makeWallet.disabled = false
      log.textContent = result.ok ? `Wallet ${maskWallet(result.address)}` : result.message
      render()
    })
    const wearRow = el("div", "avatar-row")
    for (const id of ["alex", "margaret"] as const) {
      const btn = el("button", "avatar-btn" + (snap.wearingPersonaId === id ? " active" : ""))
      btn.type = "button"
      btn.textContent = id === "alex" ? "Walk as Alex" : "Walk as Margaret"
      btn.addEventListener("click", () => ctrl.wearPersona(id))
      wearRow.append(btn)
    }
    account.append(makeWallet, wearRow)
    host.append(account)

    const agent = el("section", "avatar-block avatar-agent")
    agent.append(el("p", "avatar-kicker", "Ask the Guide"))
    const transcript = el("div", "avatar-chat")
    for (const m of messages) {
      transcript.append(el("p", m.role === "you" ? "avatar-you" : "avatar-bot", m.text))
    }
    const form = el("form", "avatar-ask")
    const input = document.createElement("input")
    input.type = "text"
    input.name = "q"
    input.placeholder = "What is next?"
    input.autocomplete = "off"
    const send = el("button", "avatar-btn")
    send.type = "submit"
    send.textContent = "Ask"
    form.append(input, send)
    form.addEventListener("submit", (e) => {
      e.preventDefault()
      const q = input.value.trim()
      if (!q) return
      messages.push({ role: "you", text: q })
      const reply = askFieldGuideAgent(q, ctrl.snapshot())
      messages.push({ role: "bot", text: reply.text })
      applyAction(reply.action)
      render()
    })
    agent.append(transcript, form)
    host.append(agent)
    transcript.scrollTop = transcript.scrollHeight
  }

  return {
    open() {
      host.closest(".avatar-desk")?.classList.remove("hidden")
      const desk = host.closest(".avatar-desk") as HTMLElement | null
      if (desk) desk.hidden = false
      render()
    },
    close() {
      host.closest(".avatar-desk")?.classList.add("hidden")
      const desk = host.closest(".avatar-desk") as HTMLElement | null
      if (desk) desk.hidden = true
    },
    isOpen() {
      const desk = host.closest(".avatar-desk") as HTMLElement | null
      return Boolean(desk && !desk.hidden)
    },
    refresh() {
      if (this.isOpen()) render()
    },
  }
}
