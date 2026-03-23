// src/lib/tts/pauseLibrary.ts
// Shared pause constants for consistent SSML timing across all episodes.

export const Pause = {
  /** Micro (commas, soft separation) */
  P0: 250,
  /** Short (end of short sentence) */
  P1: 500,
  /** Breath (after a key phrase) */
  P2: 1000,
  /** Slow (after a reflection line) */
  P3: 1800,
  /** Drift (end of a reflection loop) */
  P4: 3800,
  /** Sleep (loop section, long silence) */
  P5: 9000,
} as const

export type PauseKey = keyof typeof Pause
export type PauseMs = (typeof Pause)[PauseKey]

/** Returns an SSML <break/> tag for the given pause key. */
export function ssmlBreak(key: PauseKey): string {
  return `<break time="${Pause[key]}ms"/>`
}

/** Returns an SSML <break/> tag for an arbitrary ms value (clamped). */
export function ssmlBreakMs(ms: number): string {
  const safe = Math.max(0, Math.min(60_000, Math.round(ms)))
  return `<break time="${safe}ms"/>`
}

/** Convenience helpers */
export const B = ssmlBreak
export const BM = ssmlBreakMs