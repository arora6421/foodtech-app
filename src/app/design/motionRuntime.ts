import type { MotionValue, ValueAnimationTransition } from 'motion/react'

// Motion, split in two (M1.7). The app renders with Motion's lightweight `m` components inside
// <LazyMotion features={loadMotionFeatures}>; the animation and drag engine arrives in a separate
// chunk straight after the first paint. Until it has loaded, elements simply sit at their initial
// pose, and entrances play once it arrives, typically before anyone can interact.

let animateImpl:
  ((value: MotionValue<number>, to: number, transition: ValueAnimationTransition<number>) => unknown) | null = null

export const loadMotionFeatures = () =>
  import('./motionFeatures').then((m) => {
    animateImpl = m.animate as typeof animateImpl
    return m.features
  })

/** Animate a motion value with the lazily loaded engine; before it has loaded, jump to the end. */
export function animateValue(value: MotionValue<number>, to: number, transition: ValueAnimationTransition<number>) {
  if (animateImpl) void animateImpl(value, to, transition)
  else value.set(to)
}
