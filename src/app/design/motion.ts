// Motion constants for Direction A (docs/design/index.html §7; m1-spec §4.4).
// Tactile and unhurried: ease-out, minimal overshoot. Reduced motion swaps everything for short fades.

export const MOTION = {
  swipe: {
    /** Commit past this share of the card's width… */
    commitRatio: 0.3,
    /** …or on a fling faster than this (px/s). */
    commitVelocity: 800,
    maxTiltDeg: 8,
  },
  stampDelayMs: 200,
  flyMs: 420,
  flyEase: [0.3, 0.7, 0.2, 1] as const,
  settleMs: 380,
  revealMs: 720,
  reasonStaggerMs: 60,
  reducedFadeMs: 150,
} as const
