export function sitRequiredSeconds(pin: { notes?: string; id?: string }, fallback = 90): number {
  const match = (pin.notes || "").match(/(?:^|[;\s])sitSeconds=(\d+)/i)
  if (match) {
    const n = Number(match[1])
    if (Number.isFinite(n) && n > 0) return n
  }
  return fallback
}

export function gateSitDwell(args: {
  dwellSeconds: number
  audioSecondsPlayed: number
  requiredSeconds: number
  skipDetected?: boolean
}): string | null {
  if (args.skipDetected) {
    return "Do not skip the sit audio. Stay with it, then complete."
  }
  if (args.dwellSeconds + 0.5 < args.requiredSeconds) {
    return `Sit in the radius for ${args.requiredSeconds}s (you have ${Math.floor(args.dwellSeconds)}s).`
  }
  const audioNeed = args.requiredSeconds * 0.9
  if (args.audioSecondsPlayed + 0.5 < audioNeed) {
    return `Listen through the sit (${Math.floor(audioNeed)}s of audio, you have ${Math.floor(args.audioSecondsPlayed)}s).`
  }
  return null
}

export function accumulatePlayed(prevPlayed: number, lastCurrentTime: number, currentTime: number): {
  played: number
  skipDetected: boolean
} {
  if (!Number.isFinite(currentTime) || currentTime < 0) {
    return { played: prevPlayed, skipDetected: false }
  }
  const delta = currentTime - lastCurrentTime
  if (delta > 2.5) return { played: prevPlayed, skipDetected: true }
  if (delta < 0) return { played: prevPlayed + currentTime, skipDetected: false }
  return { played: prevPlayed + delta, skipDetected: false }
}
