import type { FieldGuideWeb4ClientConfig } from "./config.js"
import type { DropsApi } from "./drops.js"
import type { GeoApi } from "./geo.js"
import type { QuestsApi } from "./quests.js"
import type { SessionApi } from "./session.js"
import type { CheckInResult, TrailPin } from "./types.js"

function isSharedDrop(pin: TrailPin): boolean {
  const trail = (pin.trail || "").toLowerCase()
  const role = (pin.questRole || "").toLowerCase()
  const kind = (pin.dropKind || "").toLowerCase()
  return (
    trail.includes("star-drop")
    || trail === "power-crystals"
    || role === "drop"
    || role === "crystal"
    || kind === "drop"
    || kind === "guide"
    || kind === "power-crystal"
    || pin.id.toLowerCase().startsWith("drop-")
  )
}

/** Street glove: pin id is STAR objective title and NFT trailPinId. */
export function isStreetGlovePin(pin: TrailPin): boolean {
  const role = (pin.questRole || "").toLowerCase()
  const kind = (pin.dropKind || "").toLowerCase()
  return kind === "glove" || role === "glove" || pin.id.toLowerCase().startsWith("glove-")
}

/**
 * Browser port of Unity QuestCheckInBridge:
 * shared drops → street-event; gloves → mint to wallet then STAR progress; other quest pins → start/progress/complete.
 */
export function createCheckInApi(
  session: SessionApi,
  config: FieldGuideWeb4ClientConfig,
  quests: QuestsApi,
  geo: GeoApi,
  drops: DropsApi,
) {
  async function applyQuestProgress(
    pin: TrailPin,
    questId: string,
  ): Promise<{ started: boolean; progressed: boolean; completed: boolean; message: string; ok: boolean }> {
    let started = false
    if (!quests.hasStartedLocally(questId)) {
      const start = await quests.start(questId)
      started = start.ok
      if (!start.ok) {
        return {
          ok: false,
          started: false,
          progressed: false,
          completed: false,
          message: `STAR start failed: ${start.message}`,
        }
      }
    } else {
      started = true
    }

    const progress = await quests.progress(questId, pin.id)
    if (!progress.ok) {
      return {
        ok: false,
        started,
        progressed: false,
        completed: false,
        message: `STAR progress failed: ${progress.message}`,
      }
    }
    quests.markObjectiveCompletedLocally(questId, pin.id)

    let completed = false
    const quest = await quests.get(questId, { fresh: true })
    if (quest && quests.allComplete(quest)) {
      const done = await quests.complete(questId)
      completed = done.ok
      if (!done.ok) {
        return {
          ok: false,
          started,
          progressed: true,
          completed: false,
          message: `Objectives done but STAR complete failed: ${done.message}`,
        }
      }
    }

    return {
      ok: true,
      started,
      progressed: true,
      completed,
      message: completed ? "Quest completed" : "Progress recorded",
    }
  }

  return {
    async handle(
      pin: TrailPin,
      opts?: { questId?: string },
    ): Promise<CheckInResult> {
      if (!pin?.id) {
        return { ok: false, kind: "skipped", message: "Pin required" }
      }

      if (isSharedDrop(pin) && !isStreetGlovePin(pin)) {
        session.markCheckedIn(pin.id)
        const state = session.get()
        await geo.postStreetEvent({
          trailPinId: pin.id,
          kind: "collected",
          avatarName: state.avatarName,
          avatarId: state.avatarId,
        })
        return {
          ok: true,
          kind: "shared-drop",
          message: "Shared drop collected (street-event)",
        }
      }

      const questId = (opts?.questId || config.configuredQuestId || "").trim()

      if (isStreetGlovePin(pin)) {
        if (!session.hasJwt()) {
          return { ok: false, kind: "glove", message: "Sign in required to collect a glove" }
        }
        if (!questId) {
          return { ok: false, kind: "glove", message: "Street glove requires a STAR quest id" }
        }

        let mintHash = ""
        let tokenAddress = ""
        let walletAddress = ""

        if (!session.hasMintedCollectible(pin.id)) {
          const minted = await drops.mintCollectibleToWallet(pin)
          if (!minted.ok) {
            return {
              ok: false,
              kind: "glove",
              questId,
              message: minted.message,
              walletAddress: minted.walletAddress,
            }
          }
          session.markMintedCollectible(pin.id)
          mintHash = minted.mintHash
          tokenAddress = minted.tokenAddress
          walletAddress = minted.walletAddress
        } else {
          walletAddress = session.get().solanaWallet
        }

        const quested = await applyQuestProgress(pin, questId)
        if (!quested.ok) {
          return {
            ok: false,
            kind: "glove",
            questId,
            started: quested.started,
            progressed: quested.progressed,
            completed: quested.completed,
            mintHash,
            tokenAddress,
            walletAddress,
            message: `${quested.message} Glove mint was kept; retry check-in will not remint.`,
          }
        }

        session.markCheckedIn(pin.id)
        return {
          ok: true,
          kind: "glove",
          questId,
          started: quested.started,
          progressed: quested.progressed,
          completed: quested.completed,
          mintHash,
          tokenAddress,
          walletAddress,
          message: quested.completed
            ? "Glove in wallet. Street gloves quest complete."
            : "Glove minted to wallet. Progress recorded.",
        }
      }

      session.markCheckedIn(pin.id)

      if (!questId) {
        return {
          ok: true,
          kind: "quest-pin",
          message: "Checked in locally (no configured quest id)",
        }
      }

      const quested = await applyQuestProgress(pin, questId)
      return {
        ok: quested.ok,
        kind: "quest-pin",
        questId,
        started: quested.started,
        progressed: quested.progressed,
        completed: quested.completed,
        message: quested.message,
      }
    },
  }
}

export type CheckInApi = ReturnType<typeof createCheckInApi>
