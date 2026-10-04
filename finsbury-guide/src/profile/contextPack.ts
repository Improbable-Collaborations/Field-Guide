import { maskWallet, type ProfileSnapshot } from "./model"
import { formatLiveSiteLine, type SiteView } from "./siteSession"

/** What a connected chat may hold about the visitor. Wallet is masked. */
export type ChatSnapshot = Omit<ProfileSnapshot, "avatarId" | "avatarEmail">

/**
 * The chat is a third party. It gets a closed allow-list of the snapshot:
 * named fields only, so a field added to ProfileSnapshot later is not sent
 * until it is listed here. Never the avatar id or email.
 */
export function chatSnapshot(snap: ProfileSnapshot): ChatSnapshot {
  return {
    signedIn: snap.signedIn,
    avatarName: snap.avatarName,
    wallet: maskWallet(snap.wallet),
    wearingPersonaId: snap.wearingPersonaId,
    wearingPersonaName: snap.wearingPersonaName,
    wearingClusterId: snap.wearingClusterId,
    wearingClusterLabel: snap.wearingClusterLabel,
    clusters: snap.clusters,
    guides: snap.guides,
    experiences: snap.experiences,
    nextStep: snap.nextStep,
    pinsCollected: snap.pinsCollected,
    pinsKnown: snap.pinsKnown,
    guidesComplete: snap.guidesComplete,
  }
}

/** Plain-language pack a connected Claude or ChatGPT can run with. */
export function formatFieldGuideContext(snap: ProfileSnapshot, live: SiteView | null = null): string {
  const wearFromSite = live?.wearingPersonaId
  const wearing = wearFromSite
    ? `${wearFromSite}${live?.wearingClusterId ? ` / ${live.wearingClusterId}` : ""}`
    : `${snap.wearingPersonaName}${snap.wearingClusterLabel ? ` / ${snap.wearingClusterLabel}` : ""}`
  const lines: string[] = [
    "You are the visitor's Field Guide companion for Hitchhiker's Guide to Finsbury Park (London).",
    "This pack is read-only. You may talk through the authored guides and this avatar's progress. You cannot edit trails, pins, copy, or the published Field Guide. You cannot drive the visitor's map or You page.",
    "The visitor updates their own progress only in Walk / Look: JWT, OASIS Solana wallet, mint GLOVE, then STAR. Do not invent a second collect path, and do not write progress from chat.",
    "",
    formatLiveSiteLine(live),
    `Avatar: ${snap.signedIn ? snap.avatarName || "signed in" : "guest (no OASIS session)"}`,
    `Wearing: ${wearing}`,
    `Wallet: ${snap.wallet ? maskWallet(snap.wallet) : "none on this avatar"}`,
    `Guides: ${snap.guidesComplete} of ${snap.guides.length} complete. Pins ${snap.pinsCollected} of ${snap.pinsKnown}.`,
  ]
  if (snap.nextStep) {
    lines.push(
      `Next: ${snap.nextStep.title} on ${snap.nextStep.guideName} (${snap.nextStep.pinId}).`,
    )
  } else {
    lines.push("Next: no open objective on the loaded guides.")
  }
  lines.push("", "Guides:")
  for (const g of snap.guides) {
    const quest = g.starQuestId ? ` STAR quest ${g.starQuestId}` : ""
    lines.push(
      `- ${g.name} [${g.placeId}] ${g.collected}/${g.pinIds.length || 0}${g.complete ? " complete" : ""}${quest}`,
    )
    if (g.subtitle) lines.push(`  ${g.subtitle}`)
    if (g.desc) lines.push(`  ${g.desc}`)
    for (const pin of g.pins) {
      lines.push(`  ${pin.order + 1}. ${pin.collected ? "collected" : "open"} ${pin.id} ${pin.title}`)
      if (pin.narrationText) lines.push(`     ${pin.narrationText}`)
      if (pin.directionHint) lines.push(`     Walk: ${pin.directionHint}`)
    }
  }
  if (snap.experiences.length) {
    lines.push("", "Recorded experiences:")
    for (const e of snap.experiences.slice(0, 24)) {
      lines.push(`- ${e.title} (${e.kind}${e.minted ? ", in wallet" : ""})`)
    }
  }
  return lines.join("\n")
}
