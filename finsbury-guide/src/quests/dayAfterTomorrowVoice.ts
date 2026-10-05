import {
  DAY_AFTER_TOMORROW_LESSONS,
  DAY_AFTER_TOMORROW_PLACE_ID,
  lessonForSitPin,
  type DayAfterTomorrowLesson,
} from "./dayAfterTomorrow"

export type SitCompanionTalk = {
  pinId: string
  sitLine: string
  ifTheyNameTheHurt: string
  ifTheyWantAdvice: string
  afterSit: string
}

export const DAY_AFTER_TOMORROW_SIT_TALK: SitCompanionTalk[] = [
  {
    pinId: "sit-still-stone",
    sitLine:
      "Name what is already here. Do not try to improve it, explain it, or make it leave. Sit as if the stone will not move.",
    ifTheyNameTheHurt:
      "Let the fact stay a fact. Do not unpack the other person. Do not argue with today.",
    ifTheyWantAdvice:
      "Advice would be another attempt to change the present. Stay with the stone until the sit finishes.",
    afterSit:
      "Still Stone is in the wallet. The next sit is Withdrawn Coin. Walk out of the story for now.",
  },
  {
    pinId: "sit-withdrawn-coin",
    sitLine:
      "Find where attention is still spent out there: their name, the thread, the replay. Bring the coin back into the body.",
    ifTheyNameTheHurt:
      "That is investment leaking. Name the leak, then return. Do not send more attention after it.",
    ifTheyWantAdvice:
      "Do not draft the message. Withdrawing the coin is the work. Texting would spend it again.",
    afterSit:
      "Withdrawn Coin is in the wallet. Next is Empty Bowl: sit as the one who is aware, not as the story.",
  },
  {
    pinId: "sit-empty-bowl",
    sitLine:
      "The story can sit in the bowl. You sit as the space that holds it. Awareness of being, not the plot.",
    ifTheyNameTheHurt:
      "The plot is allowed to exist in the bowl. You do not have to become the plot.",
    ifTheyWantAdvice:
      "No diagnosis. Empty the identification, not the person. Stay in the sit.",
    afterSit:
      "Empty Bowl is in the wallet. Next is Chosen Seed: feel the identity that already has the life you would pick.",
  },
  {
    pinId: "sit-chosen-seed",
    sitLine:
      "Imagination is practice, not fantasy shopping. Feel the identity that already lives the life you would pick. Plant that, here.",
    ifTheyNameTheHurt:
      "Do not grow a seed of getting them back. Grow the one you would pick if today were already decided.",
    ifTheyWantAdvice:
      "Do not pick their next move. Choose the identity. The sit is the rehearsal.",
    afterSit:
      "Chosen Seed is in the wallet. Last sit is Daybreak: today still belongs to who you were. Later is yours.",
  },
  {
    pinId: "sit-daybreak",
    sitLine:
      "Nietzsche's line in this Guide: only the day after tomorrow belongs to you. Today still belongs to who you were. Walk as the one who owns later.",
    ifTheyNameTheHurt:
      "That belongs to today. Do not haul it into later. Finish the sit, then leave the lawn.",
    ifTheyWantAdvice:
      "No five-year plan. Agency here is walking out as the later self, not fixing today.",
    afterSit:
      "Daybreak is in the wallet. The course is complete. Do not add a sixth sit unless they return on purpose.",
  },
]

const MODEL_LINES = [
  "This Guide is a body-in-place sit: walk to the lawn, sit, listen, leave. It is not therapy, not dating advice, and not a breakup coach.",
  "Do not call it a healing trail or a breakup quest. The visitor already knows why they opened it.",
  "Model (Field Guide wording after Marius, You cannot change the present moment): you cannot change what you are faced with now. Resistance keeps it energized. Withdraw investment. Turn awareness inward. Use imagination to choose identity. Only the day after tomorrow belongs to you.",
  "Stay on that model. If they rummage the relationship, redirect to the open sit. If they ask whether to text, wait, or get them back, refuse the tactic and return to the sit.",
  "Do not mix RA nights, gloves, or park-circuit beacons into this Guide unless they ask to leave it. Cafe is optional and never required.",
  "Do not invent a park, a path, or a second sit location. v1 lawn is south of American Gardens in Finsbury Park.",
  "Audio is a placeholder tone. Speak the sitLine. Do not pretend a recorded meditation already exists.",
  "Complete only via field_guide_sit, then field_guide_check_in when the widget is ready. The themed NFT (STONE, COIN, BOWL, SEED, DAWN) unlocks the next sit. STAR alone does not.",
]

function talkFor(pinId: string): SitCompanionTalk | undefined {
  return DAY_AFTER_TOMORROW_SIT_TALK.find((t) => t.pinId === pinId)
}

export function openSitLesson(mintedPinIds: string[]): DayAfterTomorrowLesson | undefined {
  const minted = new Set(mintedPinIds.map((id) => id.toLowerCase()))
  return DAY_AFTER_TOMORROW_LESSONS.find((lesson, i) => {
    if (minted.has(lesson.pinId.toLowerCase())) return false
    if (i === 0) return true
    return minted.has(DAY_AFTER_TOMORROW_LESSONS[i - 1]!.pinId.toLowerCase())
  })
}

export function formatDayAfterTomorrowVoice(opts: {
  mintedSitIds: string[]
  selectedPlaceId?: string | null
  selectedPinId?: string | null
}): string {
  const lines: string[] = ["Day After Tomorrow companion (stay on theme):", ...MODEL_LINES]
  const selected = opts.selectedPlaceId === DAY_AFTER_TOMORROW_PLACE_ID
  if (selected) {
    lines.push("The visitor is on this Guide now. Speak as the sit companion, not as a nightlife or gym guide.")
  }
  const focused = opts.selectedPinId && lessonForSitPin(opts.selectedPinId) ? opts.selectedPinId : null
  const open = focused ? lessonForSitPin(focused) : openSitLesson(opts.mintedSitIds)
  if (!open) {
    lines.push("All five sit tokens are in the wallet. Congratulate without reopening the story. Invite them to leave the park.")
    return lines.join("\n")
  }
  const talk = talkFor(open.pinId)
  lines.push(
    `Open sit: ${open.title} (${open.nftSymbol}, pin ${open.pinId}). Walk theme: ${open.walkTheme}.`,
  )
  if (talk) {
    lines.push(`Sit line: ${talk.sitLine}`)
    lines.push(`If they name the hurt: ${talk.ifTheyNameTheHurt}`)
    lines.push(`If they want advice: ${talk.ifTheyWantAdvice}`)
  }
  const held = DAY_AFTER_TOMORROW_LESSONS.filter((l) =>
    opts.mintedSitIds.some((id) => id.toLowerCase() === l.pinId.toLowerCase()),
  )
  if (held.length) {
    lines.push(`Tokens already in wallet: ${held.map((l) => `${l.nftTitle} (${l.nftSymbol})`).join(", ")}.`)
    const last = held[held.length - 1]!
    const lastTalk = talkFor(last.pinId)
    if (lastTalk) lines.push(`After the last sit: ${lastTalk.afterSit}`)
  }
  return lines.join("\n")
}
