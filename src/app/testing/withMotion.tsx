import { domMax, LazyMotion } from 'motion/react'
import type { ReactNode } from 'react'

// Tests render screens the way App does, inside LazyMotion, but with the features supplied
// synchronously so exits, drags and reveals behave as they do once the lazy chunk has loaded.
export function withMotion(ui: ReactNode) {
  return (
    <LazyMotion features={domMax} strict>
      {ui}
    </LazyMotion>
  )
}
