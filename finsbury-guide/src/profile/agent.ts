import { PERSONAS } from "../trustGraph/personas"
import { maskWallet, type ProfileSnapshot } from "./model"

export type AgentAction =
  | { type: "none" }
  | { type: "wear-persona"; personaId: "alex" | "margaret" }
  | { type: "pick-cluster"; clusterId: string }
  | { type: "open-place"; placeId: string }

export type AgentReply = {
  text: string
  action: AgentAction
}

function nextIncompleteGuide(snap: ProfileSnapshot) {
  if (snap.nextStep) {
    return snap.guides.find((g) => g.placeId === snap.nextStep?.placeId) ?? snap.guides[0]
  }
  return snap.guides.find((g) => !g.complete && g.pinIds.length > 0) ?? snap.guides[0]
}

function gloveGuide(snap: ProfileSnapshot) {
  return snap.guides.find((g) => g.placeId === "trail-jab-sw1-gloves")
}

export function askFieldGuideAgent(question: string, snap: ProfileSnapshot): AgentReply {
  const q = question.trim()
  if (!q) {
    return {
      text: "Ask me about your wallet, the graph you are wearing, your guides, or what is left to collect.",
      action: { type: "none" },
    }
  }
  const lower = q.toLowerCase()

  if (/\b(wallet|solana|address|nft)\b/.test(lower)) {
    if (!snap.signedIn) {
      return {
        text: "Sign in first. Collect glove mints into the OASIS Solana wallet on this avatar, not a browser extension.",
        action: { type: "none" },
      }
    }
    if (!snap.wallet) {
      return {
        text: "No Solana wallet on this avatar yet. Use Create wallet in this desk, then collect a glove.",
        action: { type: "none" },
      }
    }
    const n = snap.experiences.filter((e) => e.minted).length
    return {
      text: `Wallet ${maskWallet(snap.wallet)} on this avatar. ${n} minted collectible${n === 1 ? "" : "s"} recorded here.`,
      action: { type: "none" },
    }
  }

  if (/\b(who am i|avatar|profile|signed in)\b/.test(lower)) {
    if (!snap.signedIn) {
      return {
        text: "You are a guest on the published Finsbury map. Sign in to attach an OASIS avatar, wallet, and completed experiences.",
        action: { type: "none" },
      }
    }
    const wear = snap.wearingClusterLabel
      ? `${snap.wearingPersonaName} / ${snap.wearingClusterLabel}`
      : snap.wearingPersonaName
    return {
      text: `You are ${snap.avatarName || snap.avatarEmail || "this avatar"}, wearing ${wear}.`,
      action: { type: "none" },
    }
  }

  if (/\bmargaret\b/.test(lower)) {
    return {
      text: "Wearing Margaret: memorial walks, theatres, and the north London ground she arrives into.",
      action: { type: "wear-persona", personaId: "margaret" },
    }
  }

  if (/\balex\b/.test(lower) || (/\b(boxing|jab|glove)/.test(lower) && /\b(graph|wear|guide as)\b/.test(lower))) {
    return {
      text: "Wearing Alex. His graph keeps music rooms, both JAB gyms, and the park circuit. Street gloves sit on the gyms vertex.",
      action: { type: "wear-persona", personaId: "alex" },
    }
  }

  if (/\b(glove|gloves|mitt|jab sw1)\b/.test(lower)) {
    const g = gloveGuide(snap)
    const left = g ? g.pinIds.length - g.collected : 6
    return {
      text: g
        ? `JAB SW1 street gloves: ${g.collected} of ${g.pinIds.length} in this avatar. ${left > 0 ? `${left} still to mint.` : "Hunt complete."} Collect glove mints an SPL into the OASIS Solana wallet, then ticks the STAR objective with the same pin id.`
        : "Street gloves live on Alex's gyms vertex. Wear Alex, then open Street gloves to put the six pins on the map.",
      action: g
        ? { type: "open-place", placeId: "trail-jab-sw1-gloves" }
        : { type: "wear-persona", personaId: "alex" },
    }
  }

  if (/\b(next|what now|left|todo|progress)\b/.test(lower)) {
    const g = nextIncompleteGuide(snap)
    if (!g) {
      return {
        text: snap.guides.length
          ? "Every loaded guide on this graph is complete."
          : "Wear a person on the trust graph to see their guides.",
        action: { type: "none" },
      }
    }
    return {
      text: `Next: ${g.name}. ${g.collected} of ${g.pinIds.length || "?"} collected.`,
      action: { type: "open-place", placeId: g.placeId },
    }
  }

  if (/\b(experience|collected|done|completed)\b/.test(lower)) {
    if (!snap.experiences.length) {
      return {
        text: "No collected experiences on this avatar yet. Open a trail pin and check in, or collect a glove.",
        action: { type: "none" },
      }
    }
    const names = snap.experiences.slice(0, 6).map((e) => e.title).join(", ")
    return {
      text: `${snap.experiences.length} recorded: ${names}.`,
      action: { type: "none" },
    }
  }

  if (/\b(guide|guides|trails)\b/.test(lower)) {
    if (!snap.guides.length) {
      return {
        text: "This published map has trails in the list. Wear Alex or Margaret to see only the guides their graph keeps.",
        action: { type: "none" },
      }
    }
    const line = snap.guides.map((g) => `${g.name} (${g.collected}/${g.pinIds.length || 0})`).join("; ")
    return {
      text: `Guides on this graph: ${line}.`,
      action: { type: "none" },
    }
  }

  if (/\b(graph|cluster|star|vertex)\b/.test(lower)) {
    if (!snap.wearingPersonaId) {
      return {
        text: "Published map: the star is empty until you wear Alex or Margaret. Their clusters are the rooms they actually keep, not role labels.",
        action: { type: "none" },
      }
    }
    const names = snap.clusters.map((c) => c.label).join(", ")
    return {
      text: `${snap.wearingPersonaName}'s vertices: ${names}. Pick one on the star or in this desk to filter the map.`,
      action: { type: "none" },
    }
  }

  for (const persona of PERSONAS) {
    for (const cluster of persona.clusters) {
      if (lower.includes(cluster.label.toLowerCase()) || lower.includes(cluster.id)) {
        return {
          text: `${cluster.label} is a vertex on ${persona.name}'s graph.`,
          action:
            snap.wearingPersonaId === persona.id
              ? { type: "pick-cluster", clusterId: cluster.id }
              : { type: "wear-persona", personaId: persona.id },
        }
      }
    }
  }

  for (const g of snap.guides) {
    if (lower.includes(g.name.toLowerCase()) || lower.includes(g.placeId)) {
      return {
        text: `${g.name}: ${g.collected} of ${g.pinIds.length} collected.`,
        action: { type: "open-place", placeId: g.placeId },
      }
    }
  }

  return {
    text: "I only know this Field Guide: the OASIS avatar, Solana wallet, trust graph you are wearing, authored guides, and what you have collected here.",
    action: { type: "none" },
  }
}
