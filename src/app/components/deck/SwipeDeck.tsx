import { useRef } from 'react'
import {
  AnimatePresence,
  animate,
  motion,
  useIsPresent,
  useMotionValue,
  usePresenceData,
  useReducedMotion,
  useTransform,
} from 'motion/react'
import type { PanInfo } from 'motion/react'
import { copy } from '../../copy/en-GB'
import { MOTION } from '../../design/motion'
import type { DishCardModel } from '../../state/viewModels'
import { DishCard } from '../food/DishCard'

// S3 swipe stack (m1-spec §2: SwipeDeck + SwipeCard). The engine commits the verdict at once; the
// outgoing card finishes its flight on top while the next one rises from the stack beneath it, so
// input is never held for an animation. Behind the top card sits a plain card edge, not the next
// dish: the next card depends on the verdict, and a preview would either lie or flicker mid-drag.

export type Verdict = 'yes' | 'no'
type Dir = 1 | -1

/** Why the top card is changing, so the outgoing and incoming cards can move the right way. */
export type DeckMove =
  { kind: 'none' } | { kind: 'verdict'; dir: Dir; source: 'drag' | 'button' } | { kind: 'undo'; dir: Dir | 0 }

interface MoveContext {
  move: DeckMove
  reduced: boolean
}

const S = MOTION.swipe
const sec = (ms: number) => ms / 1000
const flyDistance = () => Math.max(typeof window === 'undefined' ? 0 : window.innerWidth, 480) * 1.1

const variants = {
  initial: ({ move, reduced }: MoveContext) => {
    if (reduced) return { opacity: 0 }
    if (move.kind === 'undo' && move.dir !== 0) return { x: move.dir * flyDistance(), y: 0, scale: 1, zIndex: 2 }
    return { y: 12, scale: 0.96, zIndex: 1 } // the stack pose of .dish-card.is-behind
  },
  enter: ({ move, reduced }: MoveContext) =>
    reduced
      ? { opacity: 1, transition: { duration: sec(MOTION.reducedFadeMs) } }
      : {
          x: 0,
          y: 0,
          scale: 1,
          transition: {
            duration: sec(move.kind === 'undo' ? MOTION.undoMs : MOTION.settleMs),
            ease: MOTION.settleEase,
          },
        },
  exit: ({ move, reduced }: MoveContext) => {
    if (move.kind === 'verdict') {
      // Reduced motion: hold the stamp for a beat, then fade. No travel, no tilt.
      if (reduced)
        return {
          opacity: [1, 1, 0],
          zIndex: 3,
          transition: { duration: sec(MOTION.reducedFadeMs * 2), times: [0, 0.5, 1], zIndex: { duration: 0 } },
        }
      const fly = move.dir * flyDistance()
      // A button or key press nudges the card first so its stamp lands before it flies.
      const x = move.source === 'button' ? [null, move.dir * S.stampFullPx, fly] : fly
      const duration = sec(MOTION.flyMs + (move.source === 'button' ? MOTION.stampDelayMs : 0))
      return {
        x,
        zIndex: 3,
        transition: {
          x: { duration, ease: MOTION.flyEase, times: move.source === 'button' ? [0, 0.32, 1] : undefined },
          zIndex: { duration: 0 },
        },
      }
    }
    // Undo: the current card sinks back into the stack under the card that returns.
    if (reduced) return { opacity: 0, transition: { duration: sec(MOTION.reducedFadeMs) } }
    return {
      y: 12,
      scale: 0.96,
      opacity: 0,
      zIndex: 0,
      transition: { duration: sec(MOTION.settleMs), ease: MOTION.settleEase, zIndex: { duration: 0 } },
    }
  },
}

/** A released drag commits past 30% of the card's width, or on a fast fling the same way it was dragged. */
export function dragVerdict(offset: number, velocity: number, width: number): Verdict | null {
  if (offset === 0) return null
  const past = Math.abs(offset) > width * S.commitRatio
  const flung = Math.abs(velocity) > S.commitVelocity && Math.sign(velocity) === Math.sign(offset)
  return past || flung ? (offset > 0 ? 'yes' : 'no') : null
}

interface SwipeDeckProps {
  card: DishCardModel | null
  move: DeckMove
  onVerdict: (verdict: Verdict, source: 'drag') => void
  onExitComplete?: () => void
}

export function SwipeDeck({ card, move, onVerdict, onExitComplete }: SwipeDeckProps) {
  const reduced = useReducedMotion() ?? false
  const ctx: MoveContext = { move, reduced }
  return (
    <div className="deck-stack">
      <div className="dish-card is-behind deck-edge" aria-hidden="true" />
      <AnimatePresence custom={ctx} onExitComplete={onExitComplete}>
        {card && <SwipeCard key={card.key} model={card} ctx={ctx} onVerdict={onVerdict} />}
      </AnimatePresence>
    </div>
  )
}

function SwipeCard({
  model,
  ctx,
  onVerdict,
}: {
  model: DishCardModel
  ctx: MoveContext
  onVerdict: SwipeDeckProps['onVerdict']
}) {
  const ref = useRef<HTMLDivElement>(null)
  const isPresent = useIsPresent()
  const leaving = usePresenceData() as MoveContext | undefined
  const x = useMotionValue(0)
  const tilt = ctx.reduced ? 0 : S.maxTiltDeg
  const rotate = useTransform(x, [-300, 0, 300], [-tilt, 0, tilt])
  const yesInk = useTransform(x, [S.stampStartPx, S.stampFullPx], [0, 1])
  const noInk = useTransform(x, [-S.stampFullPx, -S.stampStartPx], [1, 0])

  // With reduced motion the card never travels, so a committed verdict inks its stamp directly.
  const inked = !isPresent && ctx.reduced && leaving?.move.kind === 'verdict' ? leaving.move.dir : 0

  const onDragEnd = (_: unknown, info: PanInfo) => {
    const verdict = dragVerdict(info.offset.x, info.velocity.x, ref.current?.offsetWidth || 320)
    if (verdict) onVerdict(verdict, 'drag')
    else void animate(x, 0, S.springBack)
  }

  return (
    <motion.div
      ref={ref}
      className="swipe-card"
      custom={ctx}
      variants={variants}
      initial="initial"
      animate="enter"
      exit="exit"
      style={{ x, rotate }}
      drag={isPresent ? 'x' : false}
      dragMomentum={false}
      onDragEnd={onDragEnd}
      aria-hidden={isPresent ? undefined : true}
      inert={!isPresent}
    >
      <DishCard
        model={model}
        overlay={
          <>
            <motion.span className="stamp stamp-yes" style={{ opacity: inked === 1 ? 1 : yesInk }} aria-hidden="true">
              {copy.deck.yes}
            </motion.span>
            <motion.span className="stamp stamp-no" style={{ opacity: inked === -1 ? 1 : noInk }} aria-hidden="true">
              {copy.deck.nope}
            </motion.span>
          </>
        }
      />
    </motion.div>
  )
}
