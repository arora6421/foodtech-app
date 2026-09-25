// Motion constants for Direction A (docs/design/index.html §7; m1-spec §4.4).
// Tactile and unhurried: ease-out, minimal overshoot. Reduced motion swaps everything for short fades.

export const MOTION = {
  swipe: {
    /** Commit past this share of the card's width… */
    commitRatio: 0.3,
    /** …or on a fling faster than this (px/s) in the direction of the drag. */
    commitVelocity: 800,
    maxTiltDeg: 8,
    /** Stamps start to show after this much drag (px) and are fully inked by `stampFullPx`. */
    stampStartPx: 16,
    stampFullPx: 64,
    /** Spring back to centre when a drag doesn't commit. */
    springBack: { type: 'spring', stiffness: 520, damping: 34 } as const,
    /** A committed drag keeps the finger's speed: a spring seeded with the release velocity,
     *  so there is no seam between dragging and flying. Rest thresholds are loose because the
     *  card is off-screen by then. */
    fling: { type: 'spring', stiffness: 170, damping: 26, restDelta: 4, restSpeed: 60 } as const,
  },
  stampDelayMs: 200,
  flyMs: 420,
  flyEase: [0.3, 0.7, 0.2, 1] as const,
  /** The next card rises from the stack pose (`.dish-card.is-behind`) to the top. */
  settleMs: 380,
  settleEase: [0.2, 0.8, 0.2, 1] as const,
  /** An undone card flies back in from the side it left. */
  undoMs: 360,
  revealMs: 720,
  reasonStaggerMs: 60,
  reducedFadeMs: 150,
} as const
