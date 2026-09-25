import { useCallback, useEffect, useRef, useState } from 'react'
import { Navigate, useNavigate } from 'react-router'
import { copy } from '../copy/en-GB'
import { DeckActions } from '../components/deck/DeckActions'
import { DeckTopBar } from '../components/deck/DeckTopBar'
import { SwipeDeck } from '../components/deck/SwipeDeck'
import type { DeckMove, Verdict } from '../components/deck/SwipeDeck'
import { soloSessionStore, useSolo } from '../state/soloSessionStore'
import { counterModel, currentCard } from '../state/viewModels'

// S3 Swipe deck (MVP_SPEC §4). Drag, the buttons and the keyboard all go through `commit`, so every
// input gets the same flight and stamp. Keyboard: ← nope, → yes, Enter on the card "that's the one",
// Backspace or Ctrl/⌘+Z undo. Nothing waits on a timer: the next card is live while the last one flies.

export function DeckScreen() {
  const navigate = useNavigate()
  const status = useSolo((s) => s.status)
  const loaded = useSolo((s) => s.loaded)
  const state = useSolo((s) => s.state)
  const swipe = useSolo((s) => s.swipe)
  const pick = useSolo((s) => s.pick)
  const decide = useSolo((s) => s.decide)
  const undo = useSolo((s) => s.undo)

  const [move, setMove] = useState<DeckMove>({ kind: 'none' })
  // The final swipe's card finishes its flight before the match is revealed.
  const [finishing, setFinishing] = useState(false)
  const directions = useRef<(1 | -1)[]>([])
  const deckRef = useRef<HTMLDivElement>(null)
  const refocusCard = useRef(false)

  const commit = useCallback(
    (verdict: Verdict, source: 'drag' | 'button') => {
      const before = soloSessionStore.getState().state
      if (!before?.current || before.result) return
      const dir = verdict === 'yes' ? 1 : -1
      refocusCard.current = !!deckRef.current?.contains(document.activeElement)
      directions.current.push(dir)
      setMove({ kind: 'verdict', dir, source })
      swipe(verdict)
      if (soloSessionStore.getState().state?.result) setFinishing(true)
    },
    [swipe],
  )

  const back = useCallback(() => {
    const s = soloSessionStore.getState().state
    if (!s || s.result || s.events.length === 0) return
    refocusCard.current = !!deckRef.current?.contains(document.activeElement)
    setMove({ kind: 'undo', dir: directions.current.pop() ?? 0 })
    undo()
  }, [undo])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target instanceof HTMLElement ? e.target : null
      if (e.repeat || (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.closest('[role="dialog"]')))) return
      if (e.key === 'ArrowRight') commit('yes', 'button')
      else if (e.key === 'ArrowLeft') commit('no', 'button')
      else if (e.key === 'Enter' && t?.classList.contains('dish-card')) pick()
      else if (e.key === 'Backspace' || ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z')) back()
      else return
      e.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [commit, pick, back])

  const cardKey = state?.current && !state.result ? `${state.current.cardIndex}:${state.current.offeringId}` : null
  useEffect(() => {
    // Keyboard users keep their place: focus follows onto the new top card.
    if (!refocusCard.current || !cardKey) return
    refocusCard.current = false
    deckRef.current?.querySelector<HTMLElement>('.swipe-card:not([inert]) .dish-card')?.focus({ preventScroll: true })
  }, [cardKey])

  if (status !== 'ready')
    return (
      <main className="screen" aria-busy="true">
        <p className="t-body muted">{copy.welcome.loading}</p>
      </main>
    )
  if (!state || !loaded) return <Navigate to="/craving" replace />
  if (state.result && !finishing) return <Navigate to="/match" replace />
  if (!state.current && !state.result) return <Navigate to="/craving" replace />

  const card = state.current && !state.result ? currentCard(loaded, state, state.current) : null
  const counter = counterModel(state)

  return (
    <main className="screen">
      <h1 className="sr-only">
        {card ? copy.deck.heading(card.offeringName, card.cardNumber ?? 0) : copy.match.title}
      </h1>
      <p className="sr-only" aria-live="polite" aria-atomic="true">
        {card && move.kind !== 'none' ? copy.deck.announce(card.cardNumber ?? 0, card.a11yLabel, counter.likely) : ''}
      </p>
      <DeckTopBar counter={counter} canUndo={state.events.length > 0 && !finishing} onUndo={back} onDecide={decide} />
      <div ref={deckRef} className="contents">
        <SwipeDeck
          card={card}
          move={move}
          onVerdict={commit}
          onExitComplete={() => finishing && navigate('/match', { replace: true })}
        />
      </div>
      <DeckActions
        onNope={() => commit('no', 'button')}
        onYes={() => commit('yes', 'button')}
        onPick={pick}
        disabled={finishing}
      />
    </main>
  )
}
