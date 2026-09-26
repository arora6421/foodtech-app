// Loaded lazily, after the first paint (see motionRuntime.ts): Motion's animation and gesture
// engine (domMax: animations, variants, exit, drag) plus the imperative animate() the swipe uses.
import { animate, domMax } from 'motion/react'

export const features = domMax
export { animate }
