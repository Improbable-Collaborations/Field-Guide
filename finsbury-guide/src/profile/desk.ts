import { askFieldGuideAgent } from "./agent"
import { maskWallet, type ProfileSnapshot } from "./model"

export type AvatarDeskHandle = {
  open: () => void
  close: () => void
  isOpen: () => boolean
  refresh: () => void
  selection: () => { placeId: string; pinId: string }
}

export type AvatarDeskController = {
  snapshot: () => ProfileSnapshot
  wearPersona: (id: "alex" | "margaret") => void
  pickCluster: (id: string) => void
  prepareGuide: (id: string) => void
  showGuideOnMap: (id: string) => void
  connectMyAi: (provider: "claude" | "chatgpt") => Promise<{
    ok: boolean
    message: string
    openUrl?: string
    ticket?: string
  }>
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
  let selectedPlaceId = ""
  let selectedPinId = ""

  const selectGuide = (placeId: string) => {
    if (selectedPlaceId !== placeId) selectedPinId = ""
    selectedPlaceId = placeId
    ctrl.prepareGuide(placeId)
  }

  const applyAction = (action: ReturnType<typeof askFieldGuideAgent>["action"]) => {
    if (action.type === "wear-persona") ctrl.wearPersona(action.personaId)
    if (action.type === "pick-cluster") ctrl.pickCluster(action.clusterId)
    if (action.type === "open-place") selectGuide(action.placeId)
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

    if (selectedPlaceId && !snap.guides.some((g) => g.placeId === selectedPlaceId)) {
      selectedPlaceId = ""
      selectedPinId = ""
    }
    const selected = snap.guides.find((g) => g.placeId === selectedPlaceId)
    if (selected && selectedPinId && !selected.pins.some((p) => p.id === selectedPinId)) {
      selectedPinId = ""
    }
    const selectedPin = selected?.pins.find((p) => p.id === selectedPinId)

    const paned = 1 + (selected ? 1 : 0) + (selected && selectedPin ? 1 : 0)
    const triptych = el("div", `you-triptych open-${paned}`)
    const leafGuides = el("section", "you-leaf")
    const leafGuide = el("section", "you-leaf")
    const leafPin = el("section", "you-leaf")

    const next = el("div", "you-next")
    if (snap.nextStep) {
      next.append(
        el("p", "avatar-kicker", "Up next"),
        el("p", "you-next-title", snap.nextStep.title),
        el("p", "avatar-meta", snap.nextStep.guideName),
      )
      const go = el("button", "you-continue")
      go.type = "button"
      go.textContent = "Open guide"
      go.addEventListener("click", () => {
        selectGuide(snap.nextStep!.placeId)
        selectedPinId = snap.nextStep!.pinId
        render()
      })
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
        el("p", "avatar-meta", "Wear a graph, then open a guide. Collecting is how this page fills."),
      )
    }
    leafGuides.append(next)
    leafGuides.append(el("p", "avatar-kicker", "Guides"))
    if (!snap.guides.length) {
      leafGuides.append(el("p", "avatar-meta", "No authored trails on this graph."))
    }
    for (const g of snap.guides) {
      const btn = el("button", "you-guide" + (g.placeId === selectedPlaceId ? " active" : ""))
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
            : "Open to load pins",
        ),
      )
      btn.append(copy, bar)
      btn.addEventListener("click", () => {
        selectGuide(g.placeId)
        render()
      })
      leafGuides.append(btn)
    }

    if (selected) {
      leafGuide.append(
        el("p", "avatar-kicker", selected.starQuestId ? "Quest" : "Guide"),
        el("h3", "you-detail-title", selected.name),
      )
      if (selected.subtitle) leafGuide.append(el("p", "avatar-meta", selected.subtitle))
      if (selected.desc) leafGuide.append(el("p", "you-detail-body", selected.desc))
      leafGuide.append(
        el(
          "p",
          "avatar-meta",
          selected.pinIds.length
            ? `${selected.collected} of ${selected.pinIds.length} collected`
            : "Pins load when you open this guide.",
        ),
      )
      const pinList = el("div", "you-pins")
      if (!selected.pins.length) {
        pinList.append(el("p", "avatar-meta", "No objectives listed yet."))
      }
      for (const pin of selected.pins) {
        const row = el(
          "button",
          "you-pin" + (pin.collected ? " collected" : "") + (pin.id === selectedPinId ? " active" : ""),
        )
        row.type = "button"
        row.textContent = `${pin.collected ? "Collected" : "Open"} · ${pin.title}`
        row.addEventListener("click", () => {
          selectedPinId = pin.id
          render()
        })
        pinList.append(row)
      }
      leafGuide.append(pinList)
      const onMap = el("button", "you-continue")
      onMap.type = "button"
      onMap.textContent = "Show on map"
      onMap.addEventListener("click", () => ctrl.showGuideOnMap(selected.placeId))
      leafGuide.append(onMap)
    }

    if (selectedPin && selected) {
      leafPin.append(
        el("p", "avatar-kicker", "Objective"),
        el("h3", "you-detail-title", selectedPin.title),
        el("p", "avatar-meta", selected.name),
        el(
          "p",
          "you-detail-body",
          selectedPin.narrationText ||
            (selectedPin.collected
              ? "Collected on this avatar."
              : "Still open. Collect it on the map or in Walk / Look."),
        ),
      )
      const onMap = el("button", "you-continue")
      onMap.type = "button"
      onMap.textContent = "Show on map"
      onMap.addEventListener("click", () => ctrl.showGuideOnMap(selected.placeId))
      leafPin.append(onMap)
    }

    triptych.append(leafGuides)
    if (selected) triptych.append(leafGuide)
    if (selected && selectedPin) triptych.append(leafPin)
    host.append(triptych)

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

    const connect = el("section", "you-connect")
    connect.append(el("p", "avatar-kicker", "Personal AI"))
    const note = el("p", "you-connect-note")
    note.textContent =
      "Sign in, then pick Claude or ChatGPT. The chat can read this guide and your progress. It cannot change the Field Guide. Collect stays in Walk / Look."
    const row = el("div", "you-ai-row")

    const makeAiBtn = (
      provider: "claude" | "chatgpt",
      label: string,
      icon: string,
    ) => {
      const btn = el("button", "you-ai-btn")
      btn.type = "button"
      const img = document.createElement("img")
      img.src = icon
      img.alt = ""
      img.className = "you-ai-logo"
      btn.append(img, document.createTextNode(label))
      btn.addEventListener("click", async () => {
        const popup = window.open("about:blank", "field-guide-ai")
        btn.disabled = true
        try {
          const result = await ctrl.connectMyAi(provider)
          note.textContent = result.message
          if (result.ok && result.openUrl && popup && !popup.closed) {
            popup.location.href = result.openUrl
          } else {
            popup?.close()
            if (result.ok && result.openUrl) {
              const fallback = document.createElement("a")
              fallback.href = result.openUrl
              fallback.target = "_blank"
              fallback.rel = "noopener"
              fallback.textContent = "Open " + label
              fallback.className = "you-connect-fallback"
              note.after(fallback)
            }
          }
        } catch (err) {
          popup?.close()
          note.textContent = err instanceof Error ? err.message : "Could not connect."
        } finally {
          btn.disabled = false
        }
      })
      return btn
    }

    row.append(
      makeAiBtn("chatgpt", "ChatGPT", "/icons/openai.svg"),
      makeAiBtn("claude", "Claude", "/icons/anthropic.svg"),
    )
    connect.append(note, row)
    host.append(connect)

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
    selection() {
      return { placeId: selectedPlaceId, pinId: selectedPinId }
    },
  }
}
